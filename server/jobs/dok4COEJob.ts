import type { JobHelpers } from 'graphile-worker';
import { storage } from '../storage';
import { dok4GradingEmitter } from '../events/dok4GradingEmitter';
import {
  evaluateCognitiveOwnership,
  computeScoreAdjustment,
} from '../ai/dok4Grader';
import { recomputeBrainliftScore } from '../services/brainlift';

/**
 * Background job: run COE jury evaluation and score adjustment for a DOK4 submission.
 * Triggered automatically after dok4GradeJob completes successfully.
 */
export async function dok4COEJob(
  payload: { submissionId: number; brainliftId: number },
  helpers: JobHelpers
) {
  const { submissionId, brainliftId } = payload;
  helpers.logger.info(`[DOK4 COE] Starting COE for submission ${submissionId}`);

  // Ensure grading session is tracked
  if (!dok4GradingEmitter.isGradingActive(brainliftId)) {
    dok4GradingEmitter.startGrading(brainliftId);
  }

  await storage.updateDOK4Status(submissionId, 'running', 'cognitive_ownership');

  dok4GradingEmitter.emitEvent(brainliftId, {
    type: 'dok4:coe',
    submissionId,
    brainliftId,
    message: 'Running cognitive ownership evaluation (3-model jury)...',
  });

  try {
    // Fetch evaluation context
    const context = await storage.getDOK4EvaluationContext(submissionId);
    if (!context) {
      throw new Error(`Submission ${submissionId} not found`);
    }

    // Get current quality result from the submission
    const submissions = await storage.getDOK4Submissions(brainliftId);
    const submission = submissions.find(s => s.id === submissionId);
    if (!submission || submission.qualityScoreFinal === null) {
      throw new Error(`Submission ${submissionId} has no quality score — COE cannot proceed`);
    }

    const qualityResult = {
      positionSummary: submission.positionSummary ?? '',
      frameworkDependency: submission.frameworkDependency ?? '',
      keyEvidence: (submission.keyEvidence as string[]) ?? [],
      qualityRationale: submission.qualityRationale ?? '',
      qualityScoreFinal: submission.qualityScoreFinal,
    };

    // Run COE jury (3 models in parallel)
    const coeResult = await evaluateCognitiveOwnership(context, {
      ...qualityResult,
      qualityScoreRaw: submission.qualityScoreRaw ?? qualityResult.qualityScoreFinal,
      qualityCriteria: submission.qualityCriteria,
      s2DivergenceClassification: submission.s2DivergenceClassification ?? 'agree',
      s2VanillaResponse: submission.s2VanillaResponse ?? null,
      vulnerabilityPoints: (submission.vulnerabilityPoints as string[]) ?? [],
      qualityFeedback: submission.qualityFeedback ?? '',
      qualityEvaluatorModel: submission.qualityEvaluatorModel ?? '',
    });

    // Save individual model scores
    for (const modelResult of coeResult.modelResults) {
      await storage.saveDOK4COEModelScore(submissionId, {
        model: modelResult.model,
        modelFamily: modelResult.modelFamily,
        axisScores: modelResult.axisScores,
        ownershipAssessment: modelResult.ownershipAssessment || null,
        feedback: modelResult.feedback || null,
        status: modelResult.status,
        error: modelResult.error,
      });
    }

    // Save aggregate COE result
    await storage.saveDOK4COEResult(submissionId, {
      ownershipAssessmentScore: coeResult.ownershipAssessmentScore,
      coePerAxisScores: coeResult.perAxisScores,
      coeConjunctiveFailure: coeResult.conjunctiveFailure,
      coeConjunctiveFailureAxis: coeResult.conjunctiveFailureAxis,
      coeEvaluationTier: coeResult.evaluationTier,
    });

    dok4GradingEmitter.emitEvent(brainliftId, {
      type: 'dok4:coe',
      submissionId,
      brainliftId,
      message: `COE complete: ownership score ${coeResult.ownershipAssessmentScore}/19${coeResult.conjunctiveFailure ? ' (conjunctive failure)' : ''}`,
    });

    // Compute and apply score adjustment
    await storage.updateDOK4Status(submissionId, 'running', 'score_adjustment');

    dok4GradingEmitter.emitEvent(brainliftId, {
      type: 'dok4:score-adjustment',
      submissionId,
      brainliftId,
      message: 'Applying score adjustment...',
    });

    const adjustment = computeScoreAdjustment(
      coeResult.ownershipAssessmentScore,
      coeResult.conjunctiveFailure,
      qualityResult.qualityScoreFinal
    );

    await storage.saveDOK4ScoreAdjustment(submissionId, adjustment);
    await storage.updateDOK4Status(submissionId, 'completed');

    dok4GradingEmitter.emitEvent(brainliftId, {
      type: 'dok4:complete',
      submissionId,
      brainliftId,
      message: `COE complete: final score ${adjustment.qualityScoreFinal} (adjustment: ${adjustment.coeAdjustment >= 0 ? '+' : ''}${adjustment.coeAdjustment})`,
      score: adjustment.qualityScoreFinal,
    });

    dok4GradingEmitter.emitEvent(brainliftId, {
      type: 'dok4:done',
      submissionId,
      brainliftId,
      message: 'All grading stages complete',
    });

    dok4GradingEmitter.endGrading(brainliftId);

    helpers.logger.info(`[DOK4 COE] Submission ${submissionId}: ownership=${coeResult.ownershipAssessmentScore}/19, adjustment=${adjustment.coeAdjustment}, final=${adjustment.qualityScoreFinal}`);
  } catch (err: any) {
    helpers.logger.error(`[DOK4 COE] Failed for submission ${submissionId}:`, { err });
    await storage.updateDOK4Status(submissionId, 'failed');
    dok4GradingEmitter.emitEvent(brainliftId, {
      type: 'dok4:error',
      submissionId,
      brainliftId,
      message: `COE failed: ${err.message}`,
      error: err.message,
    });
  }

  // Recompute brainlift score
  try {
    await recomputeBrainliftScore(brainliftId);
  } catch (err: any) {
    helpers.logger.error(`[DOK4 COE] Score recomputation failed:`, { err });
  }
}
