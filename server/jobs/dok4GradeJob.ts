import type { JobHelpers } from 'graphile-worker';
import { storage } from '../storage';
import { dok4GradingEmitter } from '../events/dok4GradingEmitter';
import {
  computeDOK4FoundationIndex,
  checkDOK4SourceTraceability,
  checkS2Divergence,
  evaluateDOK4Quality,
} from '../ai/dok4Grader';
import { recomputeBrainliftScore } from '../services/brainlift';
import { getLearnerContextForGrading, storeObservation } from '../utils/honcho';

const GATE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const INITIAL_POLL_MS = 2000;
const MAX_POLL_MS = 30000;

/**
 * Background job: grade a single DOK4 submission through Steps 1-5.
 * Gate-polls until foundation (DOK1+DOK2+DOK3) grading is complete,
 * then runs the full evaluation pipeline.
 */
export async function dok4GradeJob(
  payload: { submissionId: number; brainliftId: number },
  helpers: JobHelpers
) {
  const { submissionId, brainliftId } = payload;
  helpers.logger.info(`[DOK4 Grade] Starting job for submission ${submissionId}, brainlift ${brainliftId}`);

  // Ensure grading session is tracked
  if (!dok4GradingEmitter.isGradingActive(brainliftId)) {
    dok4GradingEmitter.startGrading(brainliftId);
  }

  dok4GradingEmitter.emitEvent(brainliftId, {
    type: 'dok4:start',
    submissionId,
    brainliftId,
    message: `Starting grading for submission ${submissionId}`,
  });

  // Update status to running
  await storage.updateDOK4Status(submissionId, 'running', 'foundation_integrity');

  // Gate polling: wait for foundation to be graded
  const gateStart = Date.now();
  let pollInterval = INITIAL_POLL_MS;

  dok4GradingEmitter.emitEvent(brainliftId, {
    type: 'dok4:foundation',
    submissionId,
    brainliftId,
    message: 'Waiting for foundation grading to complete...',
  });

  while (true) {
    const gateStatus = await storage.checkDOK4FoundationReady(submissionId);

    if (gateStatus.ready) {
      helpers.logger.info(`[DOK4 Grade] Foundation ready for submission ${submissionId}`);
      break;
    }

    if (Date.now() - gateStart > GATE_TIMEOUT_MS) {
      const errorMsg = `Gate timeout after 15 minutes. Pending: ${gateStatus.pendingDok3Count} DOK3, ${gateStatus.pendingDok2Count} DOK2, ${gateStatus.pendingDok1Count} DOK1`;
      helpers.logger.error(`[DOK4 Grade] ${errorMsg}`);
      await storage.updateDOK4Status(submissionId, 'failed');
      dok4GradingEmitter.emitEvent(brainliftId, {
        type: 'dok4:error',
        submissionId,
        brainliftId,
        message: errorMsg,
        error: errorMsg,
      });
      return;
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
    pollInterval = Math.min(pollInterval * 2, MAX_POLL_MS);
  }

  try {
    // Fetch evaluation context
    const context = await storage.getDOK4EvaluationContext(submissionId);
    if (!context) {
      throw new Error(`Submission ${submissionId} not found`);
    }

    // Fetch learner context from Honcho (non-blocking on failure)
    const learnerContext = await getLearnerContextForGrading(brainliftId);

    // Step 1: Foundation Integrity Index
    dok4GradingEmitter.emitEvent(brainliftId, {
      type: 'dok4:foundation',
      submissionId,
      brainliftId,
      message: 'Computing foundation metrics...',
    });

    const foundation = computeDOK4FoundationIndex(context);
    await storage.saveDOK4FoundationResult(submissionId, {
      foundationIntegrityIndex: foundation.index,
      dok1ComponentScore: foundation.dok1Score,
      dok2ComponentScore: foundation.dok2Score,
      dok3ComponentScore: foundation.dok3Score,
      foundationCeiling: foundation.ceiling,
    });

    // Step 2: Source Traceability
    await storage.updateDOK4Status(submissionId, 'running', 'source_traceability');
    dok4GradingEmitter.emitEvent(brainliftId, {
      type: 'dok4:traceability',
      submissionId,
      brainliftId,
      message: 'Checking source traceability...',
    });

    const traceability = await checkDOK4SourceTraceability(context.submission.text, context);
    await storage.saveDOK4TraceabilityResult(submissionId, {
      traceabilityStatus: traceability.status,
      isBorrowed: traceability.isBorrowed,
      flaggedSource: traceability.flaggedSource,
      overlapSummary: traceability.overlapSummary,
    });

    // Step 3: S2 Divergence Check
    dok4GradingEmitter.emitEvent(brainliftId, {
      type: 'dok4:s2-divergence',
      submissionId,
      brainliftId,
      message: 'Running S2 divergence check...',
    });

    const vanillaResponse = await checkS2Divergence(context.submission.text);

    // Step 4: Quality Evaluation
    await storage.updateDOK4Status(submissionId, 'running', 'quality_evaluation');
    dok4GradingEmitter.emitEvent(brainliftId, {
      type: 'dok4:quality',
      submissionId,
      brainliftId,
      message: 'Evaluating quality...',
    });

    const quality = await evaluateDOK4Quality(context, foundation, traceability, vanillaResponse, learnerContext);

    // Step 5: Save results (ceiling already applied in evaluateDOK4Quality)
    await storage.saveDOK4QualityResult(submissionId, quality);

    dok4GradingEmitter.emitEvent(brainliftId, {
      type: 'dok4:quality',
      submissionId,
      brainliftId,
      message: `Quality evaluation complete: score ${quality.qualityScoreFinal} (raw ${quality.qualityScoreRaw}, ceiling ${foundation.ceiling})`,
      score: quality.qualityScoreFinal,
    });

    helpers.logger.info(`[DOK4 Grade] Submission ${submissionId} graded: score=${quality.qualityScoreFinal} (raw=${quality.qualityScoreRaw}, ceiling=${foundation.ceiling})`);

    // Store grading observation to Honcho (fire-and-forget)
    const brainlift = await storage.getBrainliftById(brainliftId);
    if (brainlift?.createdByUserId) {
      storeObservation(
        brainlift.createdByUserId,
        'dok4-grading',
        `DOK4 SPOV scored ${quality.qualityScoreFinal}/5 (raw: ${quality.qualityScoreRaw}). ${quality.qualityFeedback}`,
        { submissionId, score: quality.qualityScoreFinal, rawScore: quality.qualityScoreRaw }
      );
    }

    // Queue COE job to run the multi-model jury evaluation
    try {
      const { withJob } = await import('../utils/withJob');
      await withJob('dok4:coe')
        .forPayload({ submissionId, brainliftId })
        .queue();
      helpers.logger.info(`[DOK4 Grade] Queued COE job for submission ${submissionId}`);
    } catch (queueErr: any) {
      helpers.logger.error(`[DOK4 Grade] Failed to queue COE job for submission ${submissionId}:`, { err: queueErr });
      // Still mark as completed with provisional confidence if COE can't be queued
      await storage.updateDOK4Status(submissionId, 'completed');
    }
  } catch (err: any) {
    helpers.logger.error(`[DOK4 Grade] Grading failed for submission ${submissionId}:`, { err });
    await storage.updateDOK4Status(submissionId, 'failed');
    dok4GradingEmitter.emitEvent(brainliftId, {
      type: 'dok4:error',
      submissionId,
      brainliftId,
      message: `Grading failed: ${err.message}`,
      error: err.message,
    });
  }

  // Recompute brainlift score
  try {
    await recomputeBrainliftScore(brainliftId);
  } catch (err: any) {
    helpers.logger.error(`[DOK4 Grade] Score recomputation failed:`, { err });
  }
}
