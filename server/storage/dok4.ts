/**
 * DOK4 Storage Layer
 *
 * Handles persistence of DOK4 submissions (Spiky Points of View).
 * Follows patterns established by dok3.ts.
 */

import {
  db, eq, and, inArray, sql, isNull,
  dok4Submissions, dok4Dok3Links, dok4Dok2Links, dok4CoeModelScores,
  dok3Insights, dok3InsightLinks,
  dok2Summaries, dok2Points, dok2FactRelations, facts,
  brainlifts, factVerifications,
} from './base';
import type { DOK4Status, DOK4PipelineStep, DOK4RejectionCategory, DOK4Confidence } from '@shared/schema';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface DOK4SubmissionWithLinks {
  id: number;
  brainliftId: number;
  text: string;
  status: string;
  currentStep: string | null;
  // POV Validation
  rejectionReason: string | null;
  rejectionCategory: string | null;
  validatedAt: Date | null;
  // Foundation
  foundationIntegrityIndex: string | null;
  dok1ComponentScore: string | null;
  dok2ComponentScore: string | null;
  dok3ComponentScore: string | null;
  foundationCeiling: number | null;
  // Traceability
  traceabilityStatus: string | null;
  traceabilityIsBorrowed: boolean | null;
  traceabilityFlaggedSource: string | null;
  traceabilityOverlapSummary: string | null;
  // Quality
  qualityScoreRaw: number | null;
  qualityScoreFinal: number | null;
  qualityCriteria: unknown;
  s2DivergenceClassification: string | null;
  s2VanillaResponse: string | null;
  positionSummary: string | null;
  frameworkDependency: string | null;
  keyEvidence: unknown;
  vulnerabilityPoints: unknown;
  qualityRationale: string | null;
  qualityFeedback: string | null;
  qualityEvaluatorModel: string | null;
  // COE
  ownershipAssessmentScore: number | null;
  coePerAxisScores: unknown;
  coeConjunctiveFailure: boolean;
  coeConjunctiveFailureAxis: string | null;
  coeEvaluationTier: string | null;
  coeAdjustment: number | null;
  confidenceLevel: string | null;
  // Conversion
  conversionText: string | null;
  conversionScore: number | null;
  conversionFeedback: string | null;
  // Invalidation
  needsRecalculation: boolean;
  // Timestamps
  gradedAt: Date | null;
  createdAt: Date;
  // Links
  linkedDok3InsightIds: number[];
  primaryDok3InsightId: number | null;
  linkedDok2SummaryIds: number[];
}

export interface DOK4EvaluationContext {
  submission: { id: number; text: string; brainliftId: number };
  brainliftPurpose: string;
  primaryDok3: {
    id: number;
    text: string;
    score: number | null;
    frameworkName: string | null;
  } | null;
  linkedDok3s: Array<{
    id: number;
    text: string;
    score: number | null;
    frameworkName: string | null;
    isPrimary: boolean;
  }>;
  linkedDok2s: Array<{
    id: number;
    sourceName: string;
    sourceUrl: string | null;
    displayTitle: string | null;
    grade: number | null;
    points: string[];
    dok1Facts: Array<{
      id: number;
      fact: string;
      score: number;
      verificationScore: number | null;
      isGradeable: boolean;
    }>;
  }>;
  sourceEvidence: Map<string, string>;
}

// ─── CRUD Operations ─────────────────────────────────────────────────────────

/**
 * Create a new DOK4 submission with status 'draft'.
 */
export async function createDOK4Submission(
  brainliftId: number,
  text: string
): Promise<{ id: number }> {
  const [inserted] = await db.insert(dok4Submissions).values({
    brainliftId,
    text,
    status: 'draft' as DOK4Status,
  }).returning({ id: dok4Submissions.id });

  return inserted;
}

/**
 * Get all DOK4 submissions for a brainlift with linked DOK3/DOK2 IDs.
 */
export async function getDOK4Submissions(
  brainliftId: number
): Promise<DOK4SubmissionWithLinks[]> {
  const submissions = await db.select().from(dok4Submissions)
    .where(eq(dok4Submissions.brainliftId, brainliftId));

  if (submissions.length === 0) return [];

  const submissionIds = submissions.map(s => s.id);

  // Get DOK3 links
  const dok3Links = await db.select().from(dok4Dok3Links)
    .where(inArray(dok4Dok3Links.submissionId, submissionIds));

  // Get DOK2 links
  const dok2Links = await db.select().from(dok4Dok2Links)
    .where(inArray(dok4Dok2Links.submissionId, submissionIds));

  return submissions.map(s => ({
    id: s.id,
    brainliftId: s.brainliftId,
    text: s.text,
    status: s.status ?? 'draft',
    currentStep: s.currentStep,
    rejectionReason: s.rejectionReason,
    rejectionCategory: s.rejectionCategory,
    validatedAt: s.validatedAt,
    foundationIntegrityIndex: s.foundationIntegrityIndex,
    dok1ComponentScore: s.dok1ComponentScore,
    dok2ComponentScore: s.dok2ComponentScore,
    dok3ComponentScore: s.dok3ComponentScore,
    foundationCeiling: s.foundationCeiling,
    traceabilityStatus: s.traceabilityStatus,
    traceabilityIsBorrowed: s.traceabilityIsBorrowed,
    traceabilityFlaggedSource: s.traceabilityFlaggedSource,
    traceabilityOverlapSummary: s.traceabilityOverlapSummary,
    qualityScoreRaw: s.qualityScoreRaw,
    qualityScoreFinal: s.qualityScoreFinal,
    qualityCriteria: s.qualityCriteria,
    s2DivergenceClassification: s.s2DivergenceClassification,
    s2VanillaResponse: s.s2VanillaResponse,
    positionSummary: s.positionSummary,
    frameworkDependency: s.frameworkDependency,
    keyEvidence: s.keyEvidence,
    vulnerabilityPoints: s.vulnerabilityPoints,
    qualityRationale: s.qualityRationale,
    qualityFeedback: s.qualityFeedback,
    qualityEvaluatorModel: s.qualityEvaluatorModel,
    ownershipAssessmentScore: s.ownershipAssessmentScore,
    coePerAxisScores: s.coePerAxisScores,
    coeConjunctiveFailure: s.coeConjunctiveFailure ?? false,
    coeConjunctiveFailureAxis: s.coeConjunctiveFailureAxis,
    coeEvaluationTier: s.coeEvaluationTier,
    coeAdjustment: s.coeAdjustment,
    confidenceLevel: s.confidenceLevel,
    conversionText: s.conversionText,
    conversionScore: s.conversionScore,
    conversionFeedback: s.conversionFeedback,
    needsRecalculation: s.needsRecalculation ?? false,
    gradedAt: s.gradedAt,
    createdAt: s.createdAt,
    linkedDok3InsightIds: dok3Links
      .filter(l => l.submissionId === s.id)
      .map(l => l.dok3InsightId),
    primaryDok3InsightId: dok3Links
      .find(l => l.submissionId === s.id && l.isPrimary)?.dok3InsightId ?? null,
    linkedDok2SummaryIds: dok2Links
      .filter(l => l.submissionId === s.id)
      .map(l => l.dok2SummaryId),
  }));
}

/**
 * Get a single DOK4 submission, verified to belong to the given brainlift (IDOR-safe).
 */
export async function getDOK4SubmissionForBrainlift(
  submissionId: number,
  brainliftId: number
): Promise<typeof dok4Submissions.$inferSelect | null> {
  const [submission] = await db.select().from(dok4Submissions)
    .where(and(eq(dok4Submissions.id, submissionId), eq(dok4Submissions.brainliftId, brainliftId)));
  return submission || null;
}

/**
 * Link a DOK4 submission to DOK3 insights and DOK2 summaries.
 */
export async function linkDOK4Submission(
  submissionId: number,
  brainliftId: number,
  links: {
    dok3InsightIds: number[];
    primaryDok3Id: number;
    dok2SummaryIds: number[];
  }
): Promise<void> {
  // Insert DOK3 links
  if (links.dok3InsightIds.length > 0) {
    await db.insert(dok4Dok3Links).values(
      links.dok3InsightIds.map(dok3InsightId => ({
        submissionId,
        dok3InsightId,
        isPrimary: dok3InsightId === links.primaryDok3Id,
      }))
    );
  }

  // Insert DOK2 links
  if (links.dok2SummaryIds.length > 0) {
    await db.insert(dok4Dok2Links).values(
      links.dok2SummaryIds.map(dok2SummaryId => ({
        submissionId,
        dok2SummaryId,
      }))
    );
  }
}

/**
 * Update DOK4 submission status and optionally the current pipeline step.
 */
export async function updateDOK4Status(
  submissionId: number,
  status: DOK4Status,
  currentStep?: DOK4PipelineStep
): Promise<void> {
  const updates: Record<string, unknown> = { status };
  if (currentStep !== undefined) {
    updates.currentStep = currentStep;
  }
  await db.update(dok4Submissions)
    .set(updates)
    .where(eq(dok4Submissions.id, submissionId));
}

// ─── Pipeline Result Savers ──────────────────────────────────────────────────

/**
 * Save POV Validation result.
 */
export async function saveDOK4ValidationResult(
  submissionId: number,
  result: {
    accepted: boolean;
    rejectionReason?: string;
    rejectionCategory?: DOK4RejectionCategory;
  }
): Promise<void> {
  if (result.accepted) {
    await db.update(dok4Submissions)
      .set({
        status: 'pending' as DOK4Status,
        validatedAt: new Date(),
      })
      .where(eq(dok4Submissions.id, submissionId));
  } else {
    await db.update(dok4Submissions)
      .set({
        status: 'rejected' as DOK4Status,
        rejectionReason: result.rejectionReason ?? null,
        rejectionCategory: result.rejectionCategory ?? null,
        validatedAt: new Date(),
      })
      .where(eq(dok4Submissions.id, submissionId));
  }
}

/**
 * Save Foundation Integrity Index result.
 */
export async function saveDOK4FoundationResult(
  submissionId: number,
  result: {
    foundationIntegrityIndex: number;
    dok1ComponentScore: number;
    dok2ComponentScore: number;
    dok3ComponentScore: number;
    foundationCeiling: number;
  }
): Promise<void> {
  await db.update(dok4Submissions)
    .set({
      foundationIntegrityIndex: result.foundationIntegrityIndex.toFixed(4),
      dok1ComponentScore: result.dok1ComponentScore.toFixed(4),
      dok2ComponentScore: result.dok2ComponentScore.toFixed(4),
      dok3ComponentScore: result.dok3ComponentScore.toFixed(4),
      foundationCeiling: result.foundationCeiling,
    })
    .where(eq(dok4Submissions.id, submissionId));
}

/**
 * Save Source Traceability result.
 */
export async function saveDOK4TraceabilityResult(
  submissionId: number,
  result: {
    traceabilityStatus: string;
    isBorrowed: boolean;
    flaggedSource: string | null;
    overlapSummary: string | null;
  }
): Promise<void> {
  await db.update(dok4Submissions)
    .set({
      traceabilityStatus: result.traceabilityStatus,
      traceabilityIsBorrowed: result.isBorrowed,
      traceabilityFlaggedSource: result.flaggedSource,
      traceabilityOverlapSummary: result.overlapSummary,
    })
    .where(eq(dok4Submissions.id, submissionId));
}

/**
 * Save Quality Evaluation result.
 */
export async function saveDOK4QualityResult(
  submissionId: number,
  result: {
    qualityScoreRaw: number;
    qualityScoreFinal: number;
    qualityCriteria: unknown;
    s2DivergenceClassification: string | null;
    s2VanillaResponse: string | null;
    positionSummary: string | null;
    frameworkDependency: string | null;
    keyEvidence: string[] | null;
    vulnerabilityPoints: string[] | null;
    qualityRationale: string;
    qualityFeedback: string;
    qualityEvaluatorModel: string;
  }
): Promise<void> {
  await db.update(dok4Submissions)
    .set({
      qualityScoreRaw: result.qualityScoreRaw,
      qualityScoreFinal: result.qualityScoreFinal,
      qualityCriteria: result.qualityCriteria,
      s2DivergenceClassification: result.s2DivergenceClassification,
      s2VanillaResponse: result.s2VanillaResponse,
      positionSummary: result.positionSummary,
      frameworkDependency: result.frameworkDependency,
      keyEvidence: result.keyEvidence,
      vulnerabilityPoints: result.vulnerabilityPoints,
      qualityRationale: result.qualityRationale,
      qualityFeedback: result.qualityFeedback,
      qualityEvaluatorModel: result.qualityEvaluatorModel,
      gradedAt: new Date(),
      status: 'completed' as DOK4Status,
      confidenceLevel: 'provisional' as DOK4Confidence,
    })
    .where(eq(dok4Submissions.id, submissionId));
}

/**
 * Save COE aggregate result.
 */
export async function saveDOK4COEResult(
  submissionId: number,
  result: {
    ownershipAssessmentScore: number;
    coePerAxisScores: unknown;
    coeConjunctiveFailure: boolean;
    coeConjunctiveFailureAxis: string | null;
    coeEvaluationTier: string;
  }
): Promise<void> {
  await db.update(dok4Submissions)
    .set({
      ownershipAssessmentScore: result.ownershipAssessmentScore,
      coePerAxisScores: result.coePerAxisScores,
      coeConjunctiveFailure: result.coeConjunctiveFailure,
      coeConjunctiveFailureAxis: result.coeConjunctiveFailureAxis,
      coeEvaluationTier: result.coeEvaluationTier,
    })
    .where(eq(dok4Submissions.id, submissionId));
}

/**
 * Save individual COE model jury score.
 */
export async function saveDOK4COEModelScore(
  submissionId: number,
  modelScore: {
    model: string;
    modelFamily: string;
    axisScores: unknown;
    ownershipAssessment: string | null;
    feedback: string | null;
    status: string;
    error: string | null;
  }
): Promise<void> {
  await db.insert(dok4CoeModelScores).values({
    submissionId,
    model: modelScore.model,
    modelFamily: modelScore.modelFamily,
    axisScores: modelScore.axisScores,
    ownershipAssessment: modelScore.ownershipAssessment,
    feedback: modelScore.feedback,
    status: modelScore.status,
    error: modelScore.error,
    completedAt: modelScore.status === 'completed' ? new Date() : null,
  });
}

/**
 * Apply COE score adjustment to qualityScoreFinal.
 */
export async function saveDOK4ScoreAdjustment(
  submissionId: number,
  adjustment: {
    coeAdjustment: number;
    qualityScoreFinal: number;
    confidenceLevel: DOK4Confidence;
  }
): Promise<void> {
  await db.update(dok4Submissions)
    .set({
      coeAdjustment: adjustment.coeAdjustment,
      qualityScoreFinal: adjustment.qualityScoreFinal,
      confidenceLevel: adjustment.confidenceLevel,
    })
    .where(eq(dok4Submissions.id, submissionId));
}

// ─── Evaluation Context ──────────────────────────────────────────────────────

/**
 * Get full evaluation context for a DOK4 submission.
 * Walks: submission → brainlift → DOK3 links → DOK2 links → points + DOK1 facts → verifications
 */
export async function getDOK4EvaluationContext(
  submissionId: number
): Promise<DOK4EvaluationContext | null> {
  // 1. Get the submission
  const [submission] = await db.select({
    id: dok4Submissions.id,
    text: dok4Submissions.text,
    brainliftId: dok4Submissions.brainliftId,
  }).from(dok4Submissions)
    .where(eq(dok4Submissions.id, submissionId));

  if (!submission) return null;

  // 2. Get brainlift purpose
  const [bl] = await db.select({
    description: brainlifts.description,
  }).from(brainlifts)
    .where(eq(brainlifts.id, submission.brainliftId));

  const brainliftPurpose = bl?.description ?? '';

  // 3. Get linked DOK3 insights
  const dok3LinkRows = await db.select({
    dok3InsightId: dok4Dok3Links.dok3InsightId,
    isPrimary: dok4Dok3Links.isPrimary,
  }).from(dok4Dok3Links)
    .where(eq(dok4Dok3Links.submissionId, submissionId));

  const dok3Ids = dok3LinkRows.map(l => l.dok3InsightId);
  let linkedDok3s: DOK4EvaluationContext['linkedDok3s'] = [];
  let primaryDok3: DOK4EvaluationContext['primaryDok3'] = null;

  if (dok3Ids.length > 0) {
    const insights = await db.select({
      id: dok3Insights.id,
      text: dok3Insights.text,
      score: dok3Insights.score,
      frameworkName: dok3Insights.frameworkName,
    }).from(dok3Insights)
      .where(inArray(dok3Insights.id, dok3Ids));

    linkedDok3s = insights.map(i => ({
      id: i.id,
      text: i.text,
      score: i.score,
      frameworkName: i.frameworkName,
      isPrimary: dok3LinkRows.find(l => l.dok3InsightId === i.id)?.isPrimary ?? false,
    }));

    primaryDok3 = linkedDok3s.find(d => d.isPrimary) ?? null;
  }

  // 4. Get linked DOK2 summaries
  const dok2LinkRows = await db.select({
    dok2SummaryId: dok4Dok2Links.dok2SummaryId,
  }).from(dok4Dok2Links)
    .where(eq(dok4Dok2Links.submissionId, submissionId));

  const dok2Ids = dok2LinkRows.map(l => l.dok2SummaryId);
  let linkedDok2s: DOK4EvaluationContext['linkedDok2s'] = [];
  const sourceEvidence = new Map<string, string>();

  if (dok2Ids.length > 0) {
    const summaries = await db.select({
      id: dok2Summaries.id,
      sourceName: dok2Summaries.sourceName,
      sourceUrl: dok2Summaries.sourceUrl,
      displayTitle: dok2Summaries.displayTitle,
      grade: dok2Summaries.grade,
    }).from(dok2Summaries)
      .where(inArray(dok2Summaries.id, dok2Ids));

    // Get DOK2 points
    const points = await db.select({
      summaryId: dok2Points.summaryId,
      text: dok2Points.text,
    }).from(dok2Points)
      .where(inArray(dok2Points.summaryId, dok2Ids));

    // Get DOK1 facts linked to these DOK2s
    const factRelations = await db.select({
      summaryId: dok2FactRelations.summaryId,
      factId: dok2FactRelations.factId,
    }).from(dok2FactRelations)
      .where(inArray(dok2FactRelations.summaryId, dok2Ids));

    const allFactIds = Array.from(new Set(factRelations.map(r => r.factId)));
    let factsData: Array<{ id: number; fact: string; score: number; isGradeable: boolean }> = [];
    let verificationsData: Array<{ factId: number; consensusScore: number | null; evidenceContent: string | null; evidenceUrl: string | null }> = [];

    if (allFactIds.length > 0) {
      factsData = await db.select({
        id: facts.id,
        fact: facts.fact,
        score: facts.score,
        isGradeable: facts.isGradeable,
      }).from(facts)
        .where(inArray(facts.id, allFactIds));

      verificationsData = await db.select({
        factId: factVerifications.factId,
        consensusScore: factVerifications.consensusScore,
        evidenceContent: factVerifications.evidenceContent,
        evidenceUrl: factVerifications.evidenceUrl,
      }).from(factVerifications)
        .where(inArray(factVerifications.factId, allFactIds));
    }

    // Build lookup maps
    const factsMap = new Map(factsData.map(f => [f.id, f]));
    const verificationsMap = new Map(verificationsData.map(v => [v.factId, v]));
    const pointsByDok2 = new Map<number, string[]>();
    for (const p of points) {
      const existing = pointsByDok2.get(p.summaryId) || [];
      existing.push(p.text);
      pointsByDok2.set(p.summaryId, existing);
    }
    const factRelsByDok2 = new Map<number, number[]>();
    for (const r of factRelations) {
      const existing = factRelsByDok2.get(r.summaryId) || [];
      existing.push(r.factId);
      factRelsByDok2.set(r.summaryId, existing);
    }

    linkedDok2s = summaries.map(s => {
      const dok2FactIds = factRelsByDok2.get(s.id) || [];
      const dok1Facts = dok2FactIds
        .map(fId => {
          const f = factsMap.get(fId);
          if (!f) return null;
          const v = verificationsMap.get(fId);
          return {
            id: f.id,
            fact: f.fact,
            score: f.score,
            verificationScore: v?.consensusScore ?? null,
            isGradeable: f.isGradeable,
          };
        })
        .filter((f): f is NonNullable<typeof f> => f !== null);

      return {
        id: s.id,
        sourceName: s.sourceName,
        sourceUrl: s.sourceUrl,
        displayTitle: s.displayTitle,
        grade: s.grade,
        points: pointsByDok2.get(s.id) || [],
        dok1Facts,
      };
    });

    // Build source evidence map
    for (const v of verificationsData) {
      if (v.evidenceContent && v.evidenceUrl) {
        const key = v.evidenceUrl.toLowerCase().replace(/\/+$/, '');
        if (!sourceEvidence.has(key) || v.evidenceContent.length > (sourceEvidence.get(key)?.length ?? 0)) {
          sourceEvidence.set(key, v.evidenceContent);
        }
      }
    }
  }

  return {
    submission,
    brainliftPurpose,
    primaryDok3,
    linkedDok3s,
    linkedDok2s,
    sourceEvidence,
  };
}

// ─── Gate Check ──────────────────────────────────────────────────────────────

/**
 * Check if a DOK4 submission's foundation is fully graded.
 * All linked DOK3 insights must be graded, all linked DOK2s must have grades,
 * and all DOK1 facts must be scored.
 */
export async function checkDOK4FoundationReady(submissionId: number): Promise<{
  ready: boolean;
  pendingDok3Count: number;
  pendingDok2Count: number;
  pendingDok1Count: number;
}> {
  // Check DOK3 links
  const dok3Links = await db.select({ dok3InsightId: dok4Dok3Links.dok3InsightId })
    .from(dok4Dok3Links)
    .where(eq(dok4Dok3Links.submissionId, submissionId));

  if (dok3Links.length === 0) {
    return { ready: false, pendingDok3Count: 0, pendingDok2Count: 0, pendingDok1Count: 0 };
  }

  const dok3Ids = dok3Links.map(l => l.dok3InsightId);

  // Check ungraded DOK3 insights
  const ungradedDok3 = await db.select({ id: dok3Insights.id })
    .from(dok3Insights)
    .where(and(
      inArray(dok3Insights.id, dok3Ids),
      sql`${dok3Insights.score} IS NULL`
    ));

  // Check DOK2 links
  const dok2Links = await db.select({ dok2SummaryId: dok4Dok2Links.dok2SummaryId })
    .from(dok4Dok2Links)
    .where(eq(dok4Dok2Links.submissionId, submissionId));

  const dok2Ids = dok2Links.map(l => l.dok2SummaryId);

  // Check ungraded DOK2 summaries
  let pendingDok2Count = 0;
  let pendingDok1Count = 0;

  if (dok2Ids.length > 0) {
    const ungradedDok2 = await db.select({ id: dok2Summaries.id })
      .from(dok2Summaries)
      .where(and(
        inArray(dok2Summaries.id, dok2Ids),
        isNull(dok2Summaries.grade)
      ));
    pendingDok2Count = ungradedDok2.length;

    // Check ungraded DOK1 facts via dok2_fact_relations
    const ungradedFacts = await db.selectDistinct({ factId: facts.id })
      .from(dok2FactRelations)
      .innerJoin(facts, eq(dok2FactRelations.factId, facts.id))
      .where(and(
        inArray(dok2FactRelations.summaryId, dok2Ids),
        eq(facts.isGradeable, true),
        isNull(facts.score)
      ));
    pendingDok1Count = ungradedFacts.length;
  }

  const pendingDok3Count = ungradedDok3.length;

  return {
    ready: pendingDok3Count === 0 && pendingDok2Count === 0 && pendingDok1Count === 0,
    pendingDok3Count,
    pendingDok2Count,
    pendingDok1Count,
  };
}

// ─── Conversion ─────────────────────────────────────────────────────────────

/**
 * Save DOK4 conversion evaluation result.
 */
export async function saveDOK4ConversionResult(
  submissionId: number,
  result: {
    conversionText: string;
    conversionScore: number;
    conversionCriteria: unknown;
    conversionRationale: string;
    conversionFeedback: string;
    conversionEvaluatorModel: string;
  }
): Promise<void> {
  await db.update(dok4Submissions)
    .set({
      conversionText: result.conversionText,
      conversionScore: result.conversionScore,
      conversionCriteria: result.conversionCriteria,
      conversionRationale: result.conversionRationale,
      conversionFeedback: result.conversionFeedback,
      conversionEvaluatorModel: result.conversionEvaluatorModel,
      conversionSubmittedAt: new Date(),
      conversionGradedAt: new Date(),
    })
    .where(eq(dok4Submissions.id, submissionId));
}

/**
 * Validate that a submission is eligible for conversion (gate check).
 */
export async function checkDOK4ConversionEligible(
  submissionId: number,
  brainliftId: number
): Promise<{ eligible: boolean; reason?: string }> {
  const [sub] = await db.select({
    status: dok4Submissions.status,
    qualityScoreFinal: dok4Submissions.qualityScoreFinal,
    needsRecalculation: dok4Submissions.needsRecalculation,
    conversionScore: dok4Submissions.conversionScore,
  }).from(dok4Submissions)
    .where(and(
      eq(dok4Submissions.id, submissionId),
      eq(dok4Submissions.brainliftId, brainliftId),
    ));

  if (!sub) return { eligible: false, reason: 'Submission not found' };
  if (sub.status !== 'completed') return { eligible: false, reason: 'Submission must be fully graded first' };
  if (sub.qualityScoreFinal === null || sub.qualityScoreFinal < 3) {
    return { eligible: false, reason: 'Quality score must be at least 3 to submit a conversion' };
  }
  if (sub.needsRecalculation) return { eligible: false, reason: 'Submission needs recalculation — foundation data has changed' };
  if (sub.conversionScore !== null) return { eligible: false, reason: 'Conversion already submitted' };

  return { eligible: true };
}

/**
 * Clear the needsRecalculation flag and update qualityScoreFinal.
 */
export async function clearDOK4RecalculationFlag(
  submissionId: number,
  qualityScoreFinal?: number
): Promise<void> {
  const updates: Record<string, unknown> = {
    needsRecalculation: false,
    recalculationReason: null,
    recalculationTriggeredAt: null,
  };
  if (qualityScoreFinal !== undefined) {
    updates.qualityScoreFinal = qualityScoreFinal;
  }
  await db.update(dok4Submissions)
    .set(updates)
    .where(eq(dok4Submissions.id, submissionId));
}

// ─── Aggregate Score ─────────────────────────────────────────────────────────

/**
 * Get the mean DOK4 quality score for a brainlift (completed submissions only).
 */
export async function getDOK4MeanScore(brainliftId: number): Promise<number | null> {
  const [result] = await db.select({
    mean: sql<string | null>`AVG(${dok4Submissions.qualityScoreFinal})`,
  }).from(dok4Submissions)
    .where(and(
      eq(dok4Submissions.brainliftId, brainliftId),
      eq(dok4Submissions.status, 'completed'),
      sql`${dok4Submissions.qualityScoreFinal} IS NOT NULL`
    ));

  return result?.mean ? parseFloat(result.mean) : null;
}
