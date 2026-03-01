async function callSummarizeAPI(model: string, fullText: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://replit.com',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "You are a concise fact summarizer. Summarize the provided text into a maximum of 3 lines. Be direct and clear. Do not use any markdown (no bold, no italics, no bullet points), no formatting, and NO emojis. Provide only the plain text summary."
        },
        {
          role: "user",
          content: `Summarize this fact:\n\n${fullText}`
        }
      ],
      max_tokens: 150,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  const result = data.choices[0]?.message?.content?.trim();
  if (!result) throw new Error('Empty response');
  return result;
}

export async function summarizeFact(fullText: string): Promise<string> {
  if (!process.env.OPENROUTER_API_KEY) {
    return fullText.substring(0, 200) + "...";
  }

  // Primary: Gemini 2.0 Flash
  try {
    return await callSummarizeAPI('google/gemini-2.0-flash-001', fullText);
  } catch (error) {
    console.error("Gemini summarization failed, trying Qwen fallback:", error);
  }

  // Fallback: Qwen
  try {
    return await callSummarizeAPI('qwen/qwen3-32b', fullText);
  } catch (error) {
    console.error("Qwen summarization also failed:", error);
    return fullText.substring(0, 200) + "...";
  }
}
