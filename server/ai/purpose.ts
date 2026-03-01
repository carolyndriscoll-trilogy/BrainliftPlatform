import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface PurposeInput {
  whatLearning: string;
  whyMatters: string;
  whatAbleToDo: string;
}

export async function synthesizePurpose(input: PurposeInput): Promise<string> {
  const { text } = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    prompt: `You are helping a student articulate the purpose of their learning project (called a "BrainLift"). Given their three responses below, synthesize a concise 1–2 sentence purpose statement that captures what they're learning, why it matters, and what they want to achieve.

Write in first person from the student's perspective. Be direct and specific — avoid generic phrases. The purpose should feel personal and motivating.

What I'm trying to learn:
${input.whatLearning}

Why it matters to me:
${input.whyMatters}

What I want to be able to do:
${input.whatAbleToDo}

Purpose statement:`,
  });

  return text.trim();
}
