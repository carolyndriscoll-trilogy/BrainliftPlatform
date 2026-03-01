import type { JobHelpers } from 'graphile-worker';
import { storage } from '../storage';
import {
  computeDOK4FoundationIndex,
  computeScoreAdjustment,
} from '../ai/dok4Grader';
import { recomputeBrainliftScore } from '../services/brainlift';

/**
 * Background job: recalculate DOK4 submission after foundation data changes.
 * Recomputes Foundation Index, reclamps qualityScoreFinal, re-applies COE adjustment.
 */
export async function dok4RecalculateJob(
  payload: { submissionId: number; brainliftId: number },
  helpers: JobHelpers
) {
  const { submissionId, brainliftId } = payload;
  helpers.logger.info(`[DOK4 Recalculate] Starting for submission ${submissionId}`);

  try {
    const context = await storage.getDOK4EvaluationContext(submissionId);
    if (!context) {
      helpers.logger.error(`[DOK4 Recalculate] Submission ${submissionId} not found`);
      return;
    }

    // Get current submission state
    const submissions = await storage.getDOK4Submissions(brainliftId);
    const submission = submissions.find(s => s.id === submissionId);
    if (!submission) {
      helpers.logger.error(`[DOK4 Recalculate] Submission ${submissionId} not in brainlift ${brainliftId}`);
      return;
    }

    // Check if DOK2 count still meets minimum (2 from different sources)
    const dok2Validation = await storage.validateMultiSourceLinks(submission.linkedDok2SummaryIds);
    if (!dok2Validation.valid) {
      helpers.logger.error(`[DOK4 Recalculate] Submission ${submissionId}: DOK2 multi-source requirement no longer met`);
      await storage.updateDOK4Status(submissionId, 'failed');
      return;
    }

    // Recompute Foundation Index
    const foundation = computeDOK4FoundationIndex(context);
    await storage.saveDOK4FoundationResult(submissionId, {
      foundationIntegrityIndex: foundation.index,
      dok1ComponentScore: foundation.dok1Score,
      dok2ComponentScore: foundation.dok2Score,
      dok3ComponentScore: foundation.dok3Score,
      foundationCeiling: foundation.ceiling,
    });

    // Reclamp qualityScoreFinal
    const rawScore = submission.qualityScoreRaw;
    if (rawScore !== null) {
      const newFinal = Math.max(1, Math.min(5, Math.min(rawScore, foundation.ceiling)));

      // Re-apply COE adjustment if COE was previously run
      if (submission.ownershipAssessmentScore !== null) {
        const adjustment = computeScoreAdjustment(
          submission.ownershipAssessmentScore,
          submission.coeConjunctiveFailure,
          newFinal
        );
        await storage.saveDOK4ScoreAdjustment(submissionId, adjustment);
        helpers.logger.info(`[DOK4 Recalculate] Submission ${submissionId}: foundation=${foundation.index.toFixed(4)}, ceiling=${foundation.ceiling}, raw=${rawScore}, reclamp=${newFinal}, coe-adjusted=${adjustment.qualityScoreFinal}`);
      } else {
        // No COE — just update the final score directly
        await storage.clearDOK4RecalculationFlag(submissionId, newFinal);
        helpers.logger.info(`[DOK4 Recalculate] Submission ${submissionId}: foundation=${foundation.index.toFixed(4)}, ceiling=${foundation.ceiling}, raw=${rawScore}, reclamp=${newFinal}`);
        // Early return since we already cleared the flag
        await recomputeBrainliftScore(brainliftId).catch(err =>
          helpers.logger.error(`[DOK4 Recalculate] Score recomputation failed:`, { err })
        );
        return;
      }
    }

    // Clear the recalculation flag
    await storage.clearDOK4RecalculationFlag(submissionId);

    helpers.logger.info(`[DOK4 Recalculate] Submission ${submissionId} recalculated successfully`);
  } catch (err: any) {
    helpers.logger.error(`[DOK4 Recalculate] Failed for submission ${submissionId}:`, { err });
  }

  try {
    await recomputeBrainliftScore(brainliftId);
  } catch (err: any) {
    helpers.logger.error(`[DOK4 Recalculate] Score recomputation failed:`, { err });
  }
}
