import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireBrainliftAccess, requireBrainliftModify } from '../middleware/brainlift-auth';
import { asyncHandler, BadRequestError, NotFoundError } from '../middleware/error-handler';
import { storage } from '../storage';
import { validateDOK4POV } from '../ai/dok4PovValidator';
import { dok4GradingEmitter } from '../events/dok4GradingEmitter';

export const dok4Router = Router();

/**
 * POST /api/brainlifts/:slug/dok4
 * Create a DOK4 submission, run POV Validation, and queue grading if accepted.
 */
dok4Router.post(
  '/api/brainlifts/:slug/dok4',
  requireAuth,
  requireBrainliftModify,
  asyncHandler(async (req, res) => {
    const brainliftId = req.brainlift!.id;

    const { text, dok3InsightIds, primaryDok3Id, dok2SummaryIds } = req.body;

    // Validate required fields
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new BadRequestError('text is required');
    }
    if (!Array.isArray(dok3InsightIds) || dok3InsightIds.length === 0) {
      throw new BadRequestError('dok3InsightIds must be a non-empty array');
    }
    if (!dok3InsightIds.every((id: unknown) => typeof id === 'number' && Number.isInteger(id))) {
      throw new BadRequestError('dok3InsightIds must contain only integers');
    }
    if (typeof primaryDok3Id !== 'number' || !Number.isInteger(primaryDok3Id)) {
      throw new BadRequestError('primaryDok3Id must be an integer');
    }
    if (!dok3InsightIds.includes(primaryDok3Id)) {
      throw new BadRequestError('primaryDok3Id must be included in dok3InsightIds');
    }
    if (!Array.isArray(dok2SummaryIds) || dok2SummaryIds.length < 2) {
      throw new BadRequestError('dok2SummaryIds must contain at least 2 entries');
    }
    if (!dok2SummaryIds.every((id: unknown) => typeof id === 'number' && Number.isInteger(id))) {
      throw new BadRequestError('dok2SummaryIds must contain only integers');
    }

    // Validate multi-source requirement for DOK2s
    const dok2Validation = await storage.validateMultiSourceLinks(dok2SummaryIds);
    if (!dok2Validation.valid) {
      throw new BadRequestError(dok2Validation.error!);
    }

    // IDOR check: primary DOK3 must belong to this brainlift
    const primaryDok3 = await storage.getDOK3InsightForBrainlift(primaryDok3Id, brainliftId);
    if (!primaryDok3) {
      throw new NotFoundError('Primary DOK3 insight not found');
    }

    // Get brainlift purpose for validation
    const brainlift = req.brainlift!;

    // Create submission
    const { id: submissionId } = await storage.createDOK4Submission(brainliftId, text.trim());

    // Link DOK3 and DOK2 records
    await storage.linkDOK4Submission(submissionId, brainliftId, {
      dok3InsightIds,
      primaryDok3Id,
      dok2SummaryIds,
    });

    // Run POV Validation synchronously
    await storage.updateDOK4Status(submissionId, 'draft', 'pov_validation');

    const validationResult = await validateDOK4POV(
      text.trim(),
      primaryDok3.text,
      primaryDok3.frameworkName ?? null,
      brainlift.description
    );

    await storage.saveDOK4ValidationResult(submissionId, {
      accepted: validationResult.accept,
      rejectionReason: validationResult.rejection_reason ?? undefined,
      rejectionCategory: validationResult.rejection_category ?? undefined,
    });

    if (!validationResult.accept) {
      // Return rejection but don't fail the HTTP request
      const submissions = await storage.getDOK4Submissions(brainliftId);
      const submission = submissions.find(s => s.id === submissionId);
      return res.status(200).json({
        accept: false,
        rejection_reason: validationResult.rejection_reason,
        rejection_category: validationResult.rejection_category,
        submission,
      });
    }

    // Queue grading job
    try {
      const { withJob } = await import('../utils/withJob');
      await withJob('dok4:grade')
        .forPayload({ submissionId, brainliftId })
        .queue();
    } catch (err) {
      console.error(`[DOK4 Route] Failed to queue grade job for submission ${submissionId}:`, err);
    }

    const submissions = await storage.getDOK4Submissions(brainliftId);
    const submission = submissions.find(s => s.id === submissionId);
    res.status(201).json({ accept: true, submission });
  })
);

/**
 * GET /api/brainlifts/:slug/dok4
 * List all DOK4 submissions for a brainlift.
 */
dok4Router.get(
  '/api/brainlifts/:slug/dok4',
  requireAuth,
  requireBrainliftAccess,
  asyncHandler(async (req, res) => {
    const submissions = await storage.getDOK4Submissions(req.brainlift!.id);
    res.json(submissions);
  })
);

/**
 * GET /api/brainlifts/:slug/dok4/:id
 * Get a single DOK4 submission with full evaluation data.
 */
dok4Router.get(
  '/api/brainlifts/:slug/dok4/:id',
  requireAuth,
  requireBrainliftAccess,
  asyncHandler(async (req, res) => {
    const submissionId = parseInt(req.params.id);
    if (isNaN(submissionId)) throw new BadRequestError('Invalid submission ID');

    const brainliftId = req.brainlift!.id;

    // Get all submissions and find this one (includes links)
    const submissions = await storage.getDOK4Submissions(brainliftId);
    const submission = submissions.find(s => s.id === submissionId);

    if (!submission) throw new NotFoundError('DOK4 submission not found');

    res.json(submission);
  })
);

/**
 * POST /api/brainlifts/:slug/dok4/:id/conversion
 * Submit an antimemetic conversion for a DOK4 submission.
 * Gated: qualityScoreFinal >= 3, status = completed, needsRecalculation = false.
 */
dok4Router.post(
  '/api/brainlifts/:slug/dok4/:id/conversion',
  requireAuth,
  requireBrainliftModify,
  asyncHandler(async (req, res) => {
    const submissionId = parseInt(req.params.id);
    if (isNaN(submissionId)) throw new BadRequestError('Invalid submission ID');

    const brainliftId = req.brainlift!.id;
    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length < 10) {
      throw new BadRequestError('Conversion text must be at least 10 characters');
    }

    // Gate check
    const eligibility = await storage.checkDOK4ConversionEligible(submissionId, brainliftId);
    if (!eligibility.eligible) {
      throw new BadRequestError(eligibility.reason!);
    }

    // Queue conversion job
    try {
      const { withJob } = await import('../utils/withJob');
      await withJob('dok4:conversion')
        .forPayload({ submissionId, brainliftId, conversionText: text.trim() })
        .queue();
    } catch (err) {
      console.error(`[DOK4 Route] Failed to queue conversion job for submission ${submissionId}:`, err);
      throw new BadRequestError('Failed to queue conversion evaluation');
    }

    res.status(202).json({ queued: true, submissionId });
  })
);

/**
 * GET /api/brainlifts/:slug/dok4-grading-events
 * SSE endpoint for real-time DOK4 grading updates.
 * No asyncHandler — SSE endpoints manage their own response lifecycle.
 */
dok4Router.get(
  '/api/brainlifts/:slug/dok4-grading-events',
  requireAuth,
  requireBrainliftAccess,
  (req, res) => {
    const brainlift = req.brainlift!;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(`event: connected\ndata: ${JSON.stringify({ brainliftId: brainlift.id })}\n\n`);

    if (!dok4GradingEmitter.isGradingActive(brainlift.id)) {
      res.write(`event: idle\ndata: ${JSON.stringify({ message: 'No active grading' })}\n\n`);
    }

    const unsubscribe = dok4GradingEmitter.subscribe(brainlift.id, (event) => {
      res.write(`id: ${event.id}\n`);
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);

      if (event.type === 'dok4:done') {
        setTimeout(() => res.end(), 100);
      }
    });

    req.on('close', () => {
      unsubscribe();
    });

    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30000);

    req.on('close', () => {
      clearInterval(keepAlive);
    });
  }
);
