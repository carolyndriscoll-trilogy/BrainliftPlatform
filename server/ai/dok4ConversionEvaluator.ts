/**
 * DOK4 Antimemetic Conversion Evaluator
 *
 * Evaluates whether a student can translate their SPOV into a form
 * that overcomes natural resistance to novel ideas.
 * Quality-tier model, single call.
 */

import { z } from 'zod';
import { DOK4_MODELS } from '@shared/schema';
import { callOpenRouterModel, extractJSON } from './llm-utils';
import {
  DOK4_CONVERSION_SYSTEM_PROMPT,
  buildDOK4ConversionUserPrompt,
} from '../prompts/dok4-conversion';

const conversionCriterionSchema = z.object({
  assessment: z.enum(['strong', 'partial', 'weak']),
  evidence: z.string(),
});

const conversionSchema = z.object({
  criteria: z.object({
    B1: conversionCriterionSchema,
    B2: conversionCriterionSchema,
    C1: conversionCriterionSchema,
    C2: conversionCriterionSchema,
    P1: conversionCriterionSchema,
  }),
  raw_total: z.number().min(0).max(10),
  score: z.number().min(1).max(5),
  rationale: z.string(),
  feedback: z.string(),
});

export interface DOK4ConversionResult {
  conversionScore: number;
  conversionCriteria: unknown;
  conversionRationale: string;
  conversionFeedback: string;
  conversionEvaluatorModel: string;
}

/**
 * Evaluate an antimemetic conversion of a DOK4 SPOV.
 */
export async function evaluateDOK4Conversion(params: {
  originalSpov: string;
  conversionText: string;
  positionSummary: string;
  qualityScoreFinal: number;
  brainliftPurpose: string;
}): Promise<DOK4ConversionResult> {
  const userPrompt = buildDOK4ConversionUserPrompt(params);

  let raw: string;
  let usedModel: string;

  try {
    console.log('[DOK4-Conversion] Calling Opus for conversion evaluation...');
    raw = await callOpenRouterModel(
      DOK4_MODELS.OPUS,
      DOK4_CONVERSION_SYSTEM_PROMPT,
      userPrompt,
      2000
    );
    usedModel = DOK4_MODELS.OPUS;
  } catch (opusErr: any) {
    console.log(`[DOK4-Conversion] Opus failed (${opusErr.message}), trying Sonnet fallback...`);
    raw = await callOpenRouterModel(
      DOK4_MODELS.OPUS_FALLBACK,
      DOK4_CONVERSION_SYSTEM_PROMPT,
      userPrompt,
      2000
    );
    usedModel = DOK4_MODELS.OPUS_FALLBACK;
  }

  const evaluation = conversionSchema.parse(extractJSON(raw));

  console.log(`[DOK4-Conversion] Score: ${evaluation.score}/5 (raw_total: ${evaluation.raw_total}/10), model: ${usedModel}`);

  return {
    conversionScore: evaluation.score,
    conversionCriteria: evaluation.criteria,
    conversionRationale: evaluation.rationale,
    conversionFeedback: evaluation.feedback,
    conversionEvaluatorModel: usedModel,
  };
}
