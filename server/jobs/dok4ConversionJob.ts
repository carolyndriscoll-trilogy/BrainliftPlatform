import type { JobHelpers } from 'graphile-worker';
import { storage } from '../storage';
import { dok4GradingEmitter } from '../events/dok4GradingEmitter';
import { evaluateDOK4Conversion } from '../ai/dok4ConversionEvaluator';
import { recomputeBrainliftScore } from '../services/brainlift';

/**
 * Background job: evaluate an antimemetic conversion for a DOK4 submission.
 */
export async function dok4ConversionJob(
  payload: { submissionId: number; brainliftId: number; conversionText: string },
  helpers: JobHelpers
) {
  const { submissionId, brainliftId, conversionText } = payload;
  helpers.logger.info(`[DOK4 Conversion] Starting for submission ${submissionId}`);

  if (!dok4GradingEmitter.isGradingActive(brainliftId)) {
    dok4GradingEmitter.startGrading(brainliftId);
  }

  await storage.updateDOK4Status(submissionId, 'running', 'conversion_evaluation');

  dok4GradingEmitter.emitEvent(brainliftId, {
    type: 'dok4:start',
    submissionId,
    brainliftId,
    message: 'Evaluating antimemetic conversion...',
  });

  try {
    // Get submission for context
    const submissions = await storage.getDOK4Submissions(brainliftId);
    const submission = submissions.find(s => s.id === submissionId);
    if (!submission) throw new Error(`Submission ${submissionId} not found`);

    // Get brainlift purpose
    const context = await storage.getDOK4EvaluationContext(submissionId);
    if (!context) throw new Error(`Evaluation context not found for submission ${submissionId}`);

    const result = await evaluateDOK4Conversion({
      originalSpov: submission.text,
      conversionText,
      positionSummary: submission.positionSummary ?? '',
      qualityScoreFinal: submission.qualityScoreFinal!,
      brainliftPurpose: context.brainliftPurpose,
    });

    await storage.saveDOK4ConversionResult(submissionId, {
      conversionText,
      conversionScore: result.conversionScore,
      conversionCriteria: result.conversionCriteria,
      conversionRationale: result.conversionRationale,
      conversionFeedback: result.conversionFeedback,
      conversionEvaluatorModel: result.conversionEvaluatorModel,
    });

    await storage.updateDOK4Status(submissionId, 'completed');

    dok4GradingEmitter.emitEvent(brainliftId, {
      type: 'dok4:complete',
      submissionId,
      brainliftId,
      message: `Conversion evaluated: score ${result.conversionScore}/5`,
      score: result.conversionScore,
    });

    dok4GradingEmitter.emitEvent(brainliftId, {
      type: 'dok4:done',
      submissionId,
      brainliftId,
      message: 'Conversion evaluation complete',
    });

    dok4GradingEmitter.endGrading(brainliftId);

    helpers.logger.info(`[DOK4 Conversion] Submission ${submissionId}: score=${result.conversionScore}`);
  } catch (err: any) {
    helpers.logger.error(`[DOK4 Conversion] Failed for submission ${submissionId}:`, { err });
    // Restore to completed status (conversion failure shouldn't break the submission)
    await storage.updateDOK4Status(submissionId, 'completed');
    dok4GradingEmitter.emitEvent(brainliftId, {
      type: 'dok4:error',
      submissionId,
      brainliftId,
      message: `Conversion evaluation failed: ${err.message}`,
      error: err.message,
    });
  }

  try {
    await recomputeBrainliftScore(brainliftId);
  } catch (err: any) {
    helpers.logger.error(`[DOK4 Conversion] Score recomputation failed:`, { err });
  }
}
