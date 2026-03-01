import { Router } from 'express';
import { storage } from '../storage';
import { extractAndRankExperts, diagnoseExpertFormat } from '../ai/experts';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, BadRequestError, NotFoundError } from '../middleware/error-handler';
import { requireBrainliftAccess, requireBrainliftModify } from '../middleware/brainlift-auth';

export const expertsRouter = Router();

// Get experts for a brainlift
expertsRouter.get(
  '/api/brainlifts/:slug/experts',
  requireAuth,
  requireBrainliftAccess,
  asyncHandler(async (req, res) => {
    const expertsList = await storage.getExpertsByBrainliftId(req.brainlift!.id);
    res.json(expertsList);
  })
);

// Refresh/extract experts for a brainlift using AI
expertsRouter.post(
  '/api/brainlifts/:slug/experts/refresh',
  requireAuth,
  requireBrainliftModify,
  asyncHandler(async (req, res) => {
    const brainlift = req.brainlift!;

    // Run expert extraction
    const expertsData = await extractAndRankExperts({
      brainliftId: brainlift.id,
      title: brainlift.title,
      description: brainlift.description,
      author: brainlift.author,
      facts: brainlift.facts,
      originalContent: brainlift.originalContent || '',
      readingList: brainlift.readingList || [],
    });

    const savedExperts = await storage.saveExperts(brainlift.id, expertsData);

    // Run expert format diagnostics and save
    let expertDiagnostics = null;
    if (brainlift.originalContent) {
      console.log('[Expert Refresh] Running diagnostics for:', brainlift.slug);
      expertDiagnostics = await diagnoseExpertFormat(brainlift.originalContent);
      console.log('[Expert Refresh] Diagnostics result:', JSON.stringify(expertDiagnostics, null, 2));

      // Save diagnostics to brainlift
      await storage.updateBrainliftFields(brainlift.id, { expertDiagnostics });
    } else {
      console.log('[Expert Refresh] No originalContent for:', brainlift.slug);
    }

    res.json({
      ...brainlift,
      experts: savedExperts,
      expertDiagnostics
    });
  })
);

// Update expert following status (nested under brainlift for authorization)
expertsRouter.patch(
  '/api/brainlifts/:slug/experts/:id/follow',
  requireAuth,
  requireBrainliftModify,
  asyncHandler(async (req, res) => {
    const expertId = parseInt(req.params.id);
    if (isNaN(expertId)) {
      throw new BadRequestError('Invalid expert ID');
    }
    const { isFollowing } = req.body;

    if (typeof isFollowing !== 'boolean') {
      throw new BadRequestError('isFollowing must be a boolean');
    }

    const updated = await storage.updateExpertFollowingForBrainlift(
      expertId, req.brainlift!.id, isFollowing
    );
    if (!updated) {
      throw new NotFoundError('Expert not found');
    }
    res.json(updated);
  })
);

// Delete an expert (nested under brainlift for authorization)
expertsRouter.delete(
  '/api/brainlifts/:slug/experts/:id',
  requireAuth,
  requireBrainliftModify,
  asyncHandler(async (req, res) => {
    const expertId = parseInt(req.params.id);
    if (isNaN(expertId)) {
      throw new BadRequestError('Invalid expert ID');
    }
    const deleted = await storage.deleteExpertForBrainlift(expertId, req.brainlift!.id);
    if (!deleted) {
      throw new NotFoundError('Expert not found');
    }
    res.json({ success: true });
  })
);

// Create a single expert (Builder flow)
expertsRouter.post(
  '/api/brainlifts/:slug/experts',
  requireAuth,
  requireBrainliftModify,
  asyncHandler(async (req, res) => {
    const { name, who, focus, why, where, twitterHandle } = req.body;

    if (!name?.trim()) {
      throw new BadRequestError('Expert name is required');
    }

    const expert = await storage.createExpert({
      brainliftId: req.brainlift!.id,
      name: name.trim(),
      source: 'manual',
      isFollowing: true,
      who: who || null,
      focus: focus || null,
      why: why || null,
      where: where || null,
      twitterHandle: twitterHandle || null,
      draftStatus: 'draft',
    });

    res.status(201).json(expert);
  })
);

// Update a single expert (Builder flow)
expertsRouter.patch(
  '/api/brainlifts/:slug/experts/:id',
  requireAuth,
  requireBrainliftModify,
  asyncHandler(async (req, res) => {
    const expertId = parseInt(req.params.id);
    if (isNaN(expertId)) {
      throw new BadRequestError('Invalid expert ID');
    }

    const { name, who, focus, why, where, twitterHandle, draftStatus } = req.body;
    const fields: Record<string, any> = {};
    if (name !== undefined) fields.name = name;
    if (who !== undefined) fields.who = who;
    if (focus !== undefined) fields.focus = focus;
    if (why !== undefined) fields.why = why;
    if (where !== undefined) fields.where = where;
    if (twitterHandle !== undefined) fields.twitterHandle = twitterHandle;
    if (draftStatus !== undefined) fields.draftStatus = draftStatus;

    const updated = await storage.updateExpertForBrainlift(expertId, req.brainlift!.id, fields);
    if (!updated) {
      throw new NotFoundError('Expert not found');
    }
    res.json(updated);
  })
);

// Get followed experts for a brainlift (used by tweet search)
expertsRouter.get(
  '/api/brainlifts/:slug/experts/following',
  requireAuth,
  requireBrainliftAccess,
  asyncHandler(async (req, res) => {
    const followedExperts = await storage.getFollowedExperts(req.brainlift!.id);
    res.json(followedExperts);
  })
);
