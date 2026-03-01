/**
 * DOK4 POV Validation Classifier
 *
 * Lightweight gate that determines whether a submitted text qualifies
 * as a Spiky Point of View before entering the full grading pipeline.
 * Uses mid-tier model with temperature 0.0 for deterministic classification.
 */

import { z } from 'zod';
import pRetry from 'p-retry';
import { DOK4_MODELS } from '@shared/schema';
import {
  DOK4_POV_VALIDATION_SYSTEM_PROMPT,
  buildDOK4POVValidationUserPrompt,
} from '../prompts/dok4-pov-validation';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// ─── Zod Schema ──────────────────────────────────────────────────────────────

const povValidationSchema = z.object({
  accept: z.boolean(),
  rejection_reason: z.string().nullable(),
  rejection_category: z.enum([
    'tautology',
    'definition',
    'unfalsifiable',
    'opinion_without_evidence',
    'dok3_misclassification',
    'not_a_claim',
  ]).nullable(),
  confidence: z.enum(['high', 'medium', 'low']),
});

export type POVValidationResult = z.infer<typeof povValidationSchema>;

// ─── LLM Call ────────────────────────────────────────────────────────────────

async function callValidationModel(
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured');
  }

  const run = async () => {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://replit.com',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.0,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error(`RATE_LIMIT: ${model}`);
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('No response content');
    return content as string;
  };

  return pRetry(run, {
    retries: 2,
    onFailedAttempt: error => {
      console.log(`[DOK4-Validate] Model ${model} attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`);
    },
  });
}

function extractJSON(raw: string): unknown {
  const clean = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not find JSON in response');
  return JSON.parse(jsonMatch[0]);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Validate whether a DOK4 submission qualifies as a Spiky Point of View.
 *
 * Short-circuits for degenerate input (< 10 chars).
 * Uses Gemini Flash primary, Sonnet fallback.
 * Low-confidence results default to accept (per spec).
 */
export async function validateDOK4POV(
  dok4Text: string,
  dok3PrimaryText: string,
  dok3FrameworkName: string | null,
  brainliftPurpose: string
): Promise<POVValidationResult> {
  // Short-circuit: reject degenerate input
  if (!dok4Text || dok4Text.trim().length < 10) {
    return {
      accept: false,
      rejection_reason: 'Submission is too short to be a valid point of view.',
      rejection_category: 'not_a_claim',
      confidence: 'high',
    };
  }

  const userPrompt = buildDOK4POVValidationUserPrompt(
    dok4Text,
    dok3PrimaryText,
    dok3FrameworkName,
    brainliftPurpose
  );

  let raw: string;

  try {
    raw = await callValidationModel(
      DOK4_MODELS.GEMINI_FLASH,
      DOK4_POV_VALIDATION_SYSTEM_PROMPT,
      userPrompt
    );
  } catch (primaryErr: any) {
    console.log(`[DOK4-Validate] Gemini Flash failed: ${primaryErr.message}, trying Sonnet fallback`);
    raw = await callValidationModel(
      DOK4_MODELS.SONNET_MID,
      DOK4_POV_VALIDATION_SYSTEM_PROMPT,
      userPrompt
    );
  }

  const parsed = povValidationSchema.parse(extractJSON(raw));

  // Confidence gate: low confidence → accept (per spec)
  if (parsed.confidence === 'low' && !parsed.accept) {
    console.log(`[DOK4-Validate] Low confidence rejection overridden to accept`);
    return {
      accept: true,
      rejection_reason: null,
      rejection_category: null,
      confidence: 'low',
    };
  }

  console.log(`[DOK4-Validate] Result: accept=${parsed.accept}, category=${parsed.rejection_category}, confidence=${parsed.confidence}`);
  return parsed;
}
