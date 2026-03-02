/**
 * DOK4 Grader Service
 *
 * Multi-step evaluation pipeline for DOK4 Spiky Points of View:
 *   Step 1: Compute Foundation Integrity Index (pure math, includes DOK3 component)
 *   Step 2: Source Traceability Check (parallel LLM calls, mid-tier)
 *   Step 3: S2 LLM Divergence Check (vanilla mid-tier response)
 *   Step 4: Quality Evaluation (single quality-tier LLM call)
 *   Step 5: Final Score Computation (pure math — apply ceiling)
 */

import { z } from 'zod';
import pLimit from 'p-limit';
import { DOK4_MODELS } from '@shared/schema';
import type { DOK4GradingProgress } from '@shared/import-progress';
import { callOpenRouterModel, extractJSON } from './llm-utils';
import type { DOK4EvaluationContext } from '../storage/dok4';
import {
  DOK4_TRACEABILITY_SYSTEM_PROMPT,
  buildDOK4TraceabilityUserPrompt,
} from '../prompts/dok4-traceability';
import {
  DOK4_QUALITY_SYSTEM_PROMPT,
  buildDOK4QualityUserPrompt,
} from '../prompts/dok4-quality-evaluation';
import {
  DOK4_COE_SYSTEM_PROMPT,
  buildDOK4COEUserPrompt,
} from '../prompts/dok4-coe';

export type DOK4ProgressCallback = (event: DOK4GradingProgress) => void;

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const criterionSchema = z.object({
  assessment: z.enum(['strong', 'partial', 'weak']),
  evidence: z.string(),
});

const dok4QualitySchema = z.object({
  criteria: z.object({
    S1: criterionSchema,
    S2: criterionSchema,
    S3: criterionSchema,
    S4: criterionSchema,
    S5: criterionSchema,
    D1: criterionSchema,
  }),
  score: z.number().min(1).max(5),
  s2_divergence_classification: z.enum(['agree', 'partially_agree', 'disagree']),
  position_summary: z.string(),
  framework_dependency: z.string(),
  key_evidence: z.array(z.string()),
  vulnerability_points: z.array(z.string()),
  rationale: z.string(),
  feedback: z.string(),
});

const traceabilitySchema = z.object({
  traceability_status: z.enum(['clear', 'flagged', 'indeterminate']),
  is_borrowed: z.boolean(),
  flagged_source: z.string().nullable(),
  overlap_summary: z.string().nullable(),
  reasoning: z.string(),
});

const axisScoreSchema = z.object({
  total: z.number(),
}).passthrough(); // Allow E1, E2, etc. dynamic keys

const coeSchema = z.object({
  axis_scores: z.object({
    evidence_grounding: axisScoreSchema,
    reasoning_depth: axisScoreSchema,
    epistemic_honesty: axisScoreSchema,
    argumentative_coherence: axisScoreSchema,
  }),
  total_score: z.number().min(0).max(19),
  ownership_assessment: z.string(),
  feedback: z.string(),
});

// ─── Result Types ────────────────────────────────────────────────────────────

export interface DOK4FoundationMetrics {
  dok1Score: number;
  dok2Score: number;
  dok3Score: number;
  index: number;
  ceiling: number;
}

export interface DOK4TraceabilityResult {
  status: string;
  isBorrowed: boolean;
  flaggedSource: string | null;
  overlapSummary: string | null;
}

export interface DOK4QualityResult {
  qualityScoreRaw: number;
  qualityScoreFinal: number;
  qualityCriteria: unknown;
  s2DivergenceClassification: string;
  s2VanillaResponse: string | null;
  positionSummary: string;
  frameworkDependency: string;
  keyEvidence: string[];
  vulnerabilityPoints: string[];
  qualityRationale: string;
  qualityFeedback: string;
  qualityEvaluatorModel: string;
}

export interface DOK4COEModelResult {
  model: string;
  modelFamily: string;
  axisScores: unknown;
  totalScore: number;
  ownershipAssessment: string;
  feedback: string;
  status: string;
  error: string | null;
}

export interface DOK4COEResult {
  ownershipAssessmentScore: number;
  perAxisScores: {
    evidence_grounding: number;
    reasoning_depth: number;
    epistemic_honesty: number;
    argumentative_coherence: number;
  };
  conjunctiveFailure: boolean;
  conjunctiveFailureAxis: string | null;
  evaluationTier: string;
  modelResults: DOK4COEModelResult[];
}

export interface DOK4ScoreAdjustment {
  coeAdjustment: number;
  qualityScoreFinal: number;
  confidenceLevel: 'provisional' | 'standard' | 'verified';
}

export interface DOK4GradeResult {
  submissionId: number;
  foundation: DOK4FoundationMetrics;
  traceability: DOK4TraceabilityResult;
  quality: DOK4QualityResult;
}

// ─── Step 1: Foundation Integrity Index ───────────────────────────────────────

/**
 * Compute DOK4 Foundation Integrity Index.
 * DOK1 (25%): Mean of verification consensus scores (deduplicated by factId)
 * DOK2 (35%): Mean of linked DOK2 grades
 * DOK3 (40%): Primary DOK3 insight score only
 * Ceiling: >=4.0→5, >=3.0→4, >=2.0→3, <2.0→2 (4 tiers, not 3 like DOK3)
 */
export function computeDOK4FoundationIndex(context: DOK4EvaluationContext): DOK4FoundationMetrics {
  // DOK1 component: Mean of verification consensus scores (deduplicated)
  const seenFactIds = new Set<number>();
  const dok1Scores: number[] = [];

  for (const dok2 of context.linkedDok2s) {
    for (const fact of dok2.dok1Facts) {
      if (!seenFactIds.has(fact.id) && fact.isGradeable && fact.verificationScore !== null) {
        seenFactIds.add(fact.id);
        dok1Scores.push(fact.verificationScore);
      }
    }
  }

  const dok1Score = dok1Scores.length > 0
    ? dok1Scores.reduce((sum, s) => sum + s, 0) / dok1Scores.length
    : 0;

  // DOK2 component: Mean of linked DOK2 grades
  const dok2Grades = context.linkedDok2s
    .map(d => d.grade)
    .filter((g): g is number => g !== null);
  const dok2Score = dok2Grades.length > 0
    ? dok2Grades.reduce((sum, g) => sum + g, 0) / dok2Grades.length
    : 0;

  // DOK3 component: Primary DOK3 insight score
  const dok3Score = context.primaryDok3?.score ?? 0;

  // Weighted index: DOK1 25% + DOK2 35% + DOK3 40%
  const index = 0.25 * dok1Score + 0.35 * dok2Score + 0.40 * dok3Score;

  // 4-tier ceiling (differs from DOK3's 3-tier)
  let ceiling: number;
  if (index >= 4.0) {
    ceiling = 5;
  } else if (index >= 3.0) {
    ceiling = 4;
  } else if (index >= 2.0) {
    ceiling = 3;
  } else {
    ceiling = 2;
  }

  console.log(`[DOK4-Grade] Foundation: DOK1=${dok1Score.toFixed(2)}, DOK2=${dok2Score.toFixed(2)}, DOK3=${dok3Score}, Index=${index.toFixed(4)}, Ceiling=${ceiling}`);

  return { dok1Score, dok2Score, dok3Score, index, ceiling };
}

// ─── Step 2: Source Traceability Check ────────────────────────────────────────

export async function checkDOK4SourceTraceability(
  dok4Text: string,
  context: DOK4EvaluationContext
): Promise<DOK4TraceabilityResult> {
  // Group DOK2s by normalized source URL
  const sourceMap = new Map<string, {
    sourceName: string;
    dok2Points: string[];
    content: string;
  }>();

  for (const dok2 of context.linkedDok2s) {
    const key = dok2.sourceUrl
      ? dok2.sourceUrl.toLowerCase().replace(/\/+$/, '')
      : dok2.sourceName.toLowerCase().trim();

    const existing = sourceMap.get(key);
    if (existing) {
      existing.dok2Points.push(...dok2.points);
    } else {
      const content = dok2.sourceUrl
        ? (context.sourceEvidence.get(dok2.sourceUrl.toLowerCase().replace(/\/+$/, '')) ?? '')
        : '';

      sourceMap.set(key, {
        sourceName: dok2.sourceName,
        dok2Points: [...dok2.points],
        content,
      });
    }
  }

  const limit = pLimit(10);
  const sources = Array.from(sourceMap.values());

  console.log(`[DOK4-Grade] Traceability: checking ${sources.length} unique sources`);

  const results = await Promise.all(
    sources.map(source =>
      limit(async () => {
        const userPrompt = buildDOK4TraceabilityUserPrompt(
          dok4Text,
          source.sourceName,
          source.dok2Points,
          source.content
        );

        let raw: string;
        try {
          raw = await callOpenRouterModel(
            DOK4_MODELS.GEMINI_FLASH,
            DOK4_TRACEABILITY_SYSTEM_PROMPT,
            userPrompt,
            500
          );
        } catch (primaryErr: any) {
          console.log(`[DOK4-Grade] Traceability Gemini failed for ${source.sourceName}: ${primaryErr.message}, trying Sonnet fallback`);
          raw = await callOpenRouterModel(
            DOK4_MODELS.SONNET_MID,
            DOK4_TRACEABILITY_SYSTEM_PROMPT,
            userPrompt,
            500
          );
        }

        const parsed = traceabilitySchema.parse(extractJSON(raw));
        return { sourceName: source.sourceName, ...parsed };
      })
    )
  );

  // Deterministic precedence: flagged > clear > indeterminate
  const flaggedResult = results.find(r => r.traceability_status === 'flagged');
  if (flaggedResult) {
    console.log(`[DOK4-Grade] Traceability FLAGGED: "${flaggedResult.sourceName}"`);
    return {
      status: 'flagged',
      isBorrowed: flaggedResult.is_borrowed,
      flaggedSource: flaggedResult.flagged_source ?? flaggedResult.sourceName,
      overlapSummary: flaggedResult.overlap_summary,
    };
  }

  const clearResult = results.find(r => r.traceability_status === 'clear');
  if (clearResult) {
    console.log('[DOK4-Grade] Traceability: clear');
    return { status: 'clear', isBorrowed: false, flaggedSource: null, overlapSummary: null };
  }

  console.log('[DOK4-Grade] Traceability: indeterminate');
  return { status: 'indeterminate', isBorrowed: false, flaggedSource: null, overlapSummary: null };
}

// ─── Step 3: S2 LLM Divergence Check ─────────────────────────────────────────

/**
 * Get a vanilla LLM response to the SPOV's topic (without BrainLift context).
 * The quality evaluator will compare this against the student's position.
 */
export async function checkS2Divergence(dok4Text: string): Promise<string | null> {
  // Convert the SPOV to a question for the vanilla LLM
  const questionPrompt = `Convert the following position statement into a neutral question that could be asked to any knowledgeable person. Return ONLY the question, nothing else.

Position: ${dok4Text}`;

  try {
    const question = await callOpenRouterModel(
      DOK4_MODELS.GEMINI_FLASH,
      'You convert position statements into neutral questions. Respond with ONLY the question.',
      questionPrompt,
      200,
      0.0
    );

    // Get vanilla response (no BrainLift context)
    const vanillaResponse = await callOpenRouterModel(
      DOK4_MODELS.GEMINI_FLASH,
      'You are a knowledgeable expert. Answer the question directly and concisely in 2-3 paragraphs.',
      question.trim(),
      800,
      0.3
    );

    console.log(`[DOK4-Grade] S2 Divergence: got ${vanillaResponse.length} char vanilla response`);
    return vanillaResponse;
  } catch (err: any) {
    console.error(`[DOK4-Grade] S2 Divergence check failed: ${err.message}`);
    return null;
  }
}

// ─── Step 4: Quality Evaluation ──────────────────────────────────────────────

export async function evaluateDOK4Quality(
  context: DOK4EvaluationContext,
  foundation: DOK4FoundationMetrics,
  traceability: DOK4TraceabilityResult,
  vanillaResponse: string | null,
  learnerContext?: string | null
): Promise<DOK4QualityResult> {
  // Build traceability status string
  const traceabilityStatus = traceability.status === 'flagged'
    ? `flagged: "${traceability.flaggedSource}" — this source appears to contain the SPOV's position${traceability.isBorrowed ? ' (likely borrowed)' : ''}`
    : traceability.status;

  // Build source evidence for prompt
  const sourceEvidenceForPrompt = new Map<string, { sourceName: string; content: string }>();
  for (const dok2 of context.linkedDok2s) {
    if (dok2.sourceUrl) {
      const key = dok2.sourceUrl.toLowerCase().replace(/\/+$/, '');
      const content = context.sourceEvidence.get(key);
      if (content && !sourceEvidenceForPrompt.has(key)) {
        sourceEvidenceForPrompt.set(key, { sourceName: dok2.sourceName, content });
      }
    }
  }

  const userPrompt = buildDOK4QualityUserPrompt({
    brainliftPurpose: context.brainliftPurpose,
    dok4Text: context.submission.text,
    primaryDok3: context.primaryDok3,
    linkedDok3s: context.linkedDok3s,
    linkedDok2s: context.linkedDok2s.map(d => ({
      sourceName: d.sourceName,
      grade: d.grade,
      points: d.points,
    })),
    sourceEvidence: sourceEvidenceForPrompt,
    foundationMetrics: {
      dok1Score: foundation.dok1Score,
      dok2Score: foundation.dok2Score,
      dok3Score: foundation.dok3Score,
      index: foundation.index,
    },
    traceabilityStatus,
    vanillaResponse,
    learnerContext,
  });

  // Try Opus primary, Sonnet fallback
  let raw: string;
  let usedModel: string;

  try {
    console.log('[DOK4-Grade] Calling Opus for quality evaluation...');
    raw = await callOpenRouterModel(
      DOK4_MODELS.OPUS,
      DOK4_QUALITY_SYSTEM_PROMPT,
      userPrompt,
      4000
    );
    usedModel = DOK4_MODELS.OPUS;
  } catch (opusErr: any) {
    console.log(`[DOK4-Grade] Opus failed (${opusErr.message}), trying Sonnet fallback...`);
    try {
      raw = await callOpenRouterModel(
        DOK4_MODELS.OPUS_FALLBACK,
        DOK4_QUALITY_SYSTEM_PROMPT,
        userPrompt,
        4000
      );
      usedModel = DOK4_MODELS.OPUS_FALLBACK;
    } catch (sonnetErr: any) {
      console.error(`[DOK4-Grade] Both models failed. Opus: ${opusErr.message}, Sonnet: ${sonnetErr.message}`);
      throw new Error('Both grading models failed');
    }
  }

  const evaluation = dok4QualitySchema.parse(extractJSON(raw));

  // Apply ceiling
  const qualityScoreFinal = Math.max(1, Math.min(5, Math.min(evaluation.score, foundation.ceiling)));

  console.log(`[DOK4-Grade] Quality: raw=${evaluation.score}, ceiling=${foundation.ceiling}, final=${qualityScoreFinal}, model=${usedModel}`);

  return {
    qualityScoreRaw: evaluation.score,
    qualityScoreFinal,
    qualityCriteria: evaluation.criteria,
    s2DivergenceClassification: evaluation.s2_divergence_classification,
    s2VanillaResponse: vanillaResponse,
    positionSummary: evaluation.position_summary,
    frameworkDependency: evaluation.framework_dependency,
    keyEvidence: evaluation.key_evidence,
    vulnerabilityPoints: evaluation.vulnerability_points,
    qualityRationale: evaluation.rationale,
    qualityFeedback: evaluation.feedback,
    qualityEvaluatorModel: usedModel,
  };
}

// ─── Step 6: Cognitive Ownership Evaluation (COE) ─────────────────────────────

const COE_MODELS = [
  { model: DOK4_MODELS.COE_MODEL_1, family: 'anthropic' },
  { model: DOK4_MODELS.COE_MODEL_2, family: 'google' },
  { model: DOK4_MODELS.COE_MODEL_3, family: 'openai' },
] as const;

const CONJUNCTIVE_THRESHOLD = 2; // Any axis below this = conjunctive failure

/**
 * Run Cognitive Ownership Evaluation using a multi-model jury.
 * 3 quality-tier models from different families evaluate 4 axes (19 criteria).
 */
export async function evaluateCognitiveOwnership(
  context: DOK4EvaluationContext,
  qualityResult: DOK4QualityResult
): Promise<DOK4COEResult> {
  const limit = pLimit(3);

  const userPrompt = buildDOK4COEUserPrompt({
    dok4Text: context.submission.text,
    qualityResult: {
      positionSummary: qualityResult.positionSummary,
      frameworkDependency: qualityResult.frameworkDependency,
      keyEvidence: qualityResult.keyEvidence,
      qualityRationale: qualityResult.qualityRationale,
    },
    primaryDok3: context.primaryDok3,
    linkedDok2s: context.linkedDok2s.map(d => ({
      sourceName: d.sourceName,
      points: d.points,
    })),
    brainliftPurpose: context.brainliftPurpose,
  });

  console.log(`[DOK4-COE] Running jury with ${COE_MODELS.length} models in parallel`);

  const modelResults: DOK4COEModelResult[] = await Promise.all(
    COE_MODELS.map(({ model, family }) =>
      limit(async (): Promise<DOK4COEModelResult> => {
        try {
          const raw = await callOpenRouterModel(
            model,
            DOK4_COE_SYSTEM_PROMPT,
            userPrompt,
            2000
          );
          const parsed = coeSchema.parse(extractJSON(raw));

          return {
            model,
            modelFamily: family,
            axisScores: parsed.axis_scores,
            totalScore: parsed.total_score,
            ownershipAssessment: parsed.ownership_assessment,
            feedback: parsed.feedback,
            status: 'completed',
            error: null,
          };
        } catch (err: any) {
          console.error(`[DOK4-COE] Model ${model} failed: ${err.message}`);
          return {
            model,
            modelFamily: family,
            axisScores: {},
            totalScore: 0,
            ownershipAssessment: '',
            feedback: '',
            status: 'failed',
            error: err.message,
          };
        }
      })
    )
  );

  // Filter to successful results
  const successful = modelResults.filter(r => r.status === 'completed');

  if (successful.length === 0) {
    throw new Error('All COE jury models failed');
  }

  // Trimmed mean per axis across successful models
  const axisNames = ['evidence_grounding', 'reasoning_depth', 'epistemic_honesty', 'argumentative_coherence'] as const;
  const perAxisScores: Record<string, number> = {};

  for (const axis of axisNames) {
    const scores = successful
      .map(r => (r.axisScores as Record<string, { total: number }>)?.[axis]?.total)
      .filter((s): s is number => s !== undefined && s !== null);

    if (scores.length >= 3) {
      // Trimmed mean: drop highest and lowest, average the rest
      scores.sort((a, b) => a - b);
      perAxisScores[axis] = scores[1]; // Middle value of 3
    } else if (scores.length > 0) {
      // Not enough for trimmed mean, use regular mean
      perAxisScores[axis] = scores.reduce((a, b) => a + b, 0) / scores.length;
    } else {
      perAxisScores[axis] = 0;
    }
  }

  // Total ownership score
  const ownershipAssessmentScore = Math.round(
    Object.values(perAxisScores).reduce((sum, s) => sum + s, 0)
  );

  // Conjunctive failure: any axis below threshold
  let conjunctiveFailure = false;
  let conjunctiveFailureAxis: string | null = null;

  for (const axis of axisNames) {
    if (perAxisScores[axis] < CONJUNCTIVE_THRESHOLD) {
      conjunctiveFailure = true;
      conjunctiveFailureAxis = axis;
      break;
    }
  }

  console.log(`[DOK4-COE] Score=${ownershipAssessmentScore}/19, conjunctive_failure=${conjunctiveFailure}${conjunctiveFailureAxis ? ` (${conjunctiveFailureAxis})` : ''}`);

  return {
    ownershipAssessmentScore,
    perAxisScores: perAxisScores as DOK4COEResult['perAxisScores'],
    conjunctiveFailure,
    conjunctiveFailureAxis,
    evaluationTier: 'jury',
    modelResults,
  };
}

// ─── Step 7: Score Adjustment ────────────────────────────────────────────────

/**
 * Compute COE score adjustment.
 * 15-19: +1 (can push past ceiling, max 5)
 * 10-14: no change
 * <10 OR conjunctive failure: -1 (min 1)
 */
export function computeScoreAdjustment(
  ownershipScore: number,
  conjunctiveFailure: boolean,
  qualityScoreFinal: number
): DOK4ScoreAdjustment {
  let adjustment: number;

  if (conjunctiveFailure || ownershipScore < 10) {
    adjustment = -1;
  } else if (ownershipScore >= 15) {
    adjustment = 1;
  } else {
    adjustment = 0;
  }

  // +1 CAN push past ceiling (intentional per spec), but max 5
  const adjustedScore = Math.max(1, Math.min(5, qualityScoreFinal + adjustment));

  console.log(`[DOK4-COE] Score adjustment: ownership=${ownershipScore}, conjunctive=${conjunctiveFailure}, adjustment=${adjustment >= 0 ? '+' : ''}${adjustment}, ${qualityScoreFinal}→${adjustedScore}`);

  return {
    coeAdjustment: adjustment,
    qualityScoreFinal: adjustedScore,
    confidenceLevel: 'standard',
  };
}
