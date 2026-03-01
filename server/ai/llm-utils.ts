/**
 * Shared LLM Utilities
 *
 * Common functions for calling OpenRouter models and parsing JSON responses.
 * Extracted from dok3Grader.ts for reuse across DOK3 and DOK4 grading pipelines.
 */

import pRetry from 'p-retry';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

/**
 * Call an OpenRouter model with system and user prompts.
 * Includes automatic retry with exponential backoff (2 retries).
 */
export async function callOpenRouterModel(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature: number = 0.1
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
        temperature,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error(`[LLM] 429 rate limit from ${model}`);
        throw new Error(`RATE_LIMIT: ${model}`);
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response content');
    }

    return content as string;
  };

  return pRetry(run, {
    retries: 2,
    onFailedAttempt: error => {
      console.log(`[LLM] Model ${model} attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`);
    },
  });
}

/**
 * Extract JSON from an LLM response, stripping markdown fences.
 */
export function extractJSON(raw: string): unknown {
  const clean = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not find JSON in response');
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (err: any) {
    throw new Error(`Failed to parse JSON from LLM response: ${err.message}`);
  }
}
