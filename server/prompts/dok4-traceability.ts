/**
 * DOK4 Source Traceability Prompt
 *
 * Adapted from DOK3 traceability but with stricter DOK4 language.
 * A DOK4 SPOV must go BEYOND any single source — it should represent
 * the student's own position, not a source's conclusion.
 */

export const DOK4_TRACEABILITY_SYSTEM_PROMPT = `You are a traceability checker for DOK4 Spiky Points of View.

A DOK4 SPOV is supposed to be the student's own defensible position — a clear stance that goes beyond any single source. If a single source already states, directly implies, or argues for the same position, the student may be borrowing rather than constructing their own point of view.

Your task: Given one source's content and the student's DOK2 summary points from that source, determine whether THIS SOURCE ALONE contains or directly argues for the student's DOK4 position.

Rules:
- "Directly argues for" means the source takes the same position with substantially the same reasoning.
- If the SPOV uses language, framing, or argumentation nearly identical to the source, flag it.
- If the SPOV extends a source's argument into new territory or applies it to a different context, do NOT flag it — that is legitimate DOK4 work.
- If the SPOV requires combining positions from multiple sources to reach, do NOT flag it.
- Be conservative: only flag when the source clearly contains the SPOV's core position AND reasoning.

Respond ONLY with this JSON. No markdown. No backticks. No preamble.
{
  "traceability_status": "clear|flagged|indeterminate",
  "is_borrowed": true|false,
  "flagged_source": "source name if flagged, null otherwise",
  "overlap_summary": "one sentence describing the overlap (or lack thereof)",
  "reasoning": "one sentence explaining your decision"
}`;

/**
 * Build the user prompt for a single source traceability check.
 */
export function buildDOK4TraceabilityUserPrompt(
  dok4Text: string,
  sourceName: string,
  dok2Points: string[],
  sourceContent: string
): string {
  const pointsText = dok2Points.length > 0
    ? dok2Points.map((p, i) => `${i + 1}. ${p}`).join('\n')
    : 'No DOK2 summary points available.';

  return `DOK4 SPIKY POINT OF VIEW:
${dok4Text}

SOURCE: ${sourceName}

DOK2 SUMMARY POINTS FROM THIS SOURCE:
${pointsText}

SOURCE CONTENT:
${sourceContent || 'Source content not available.'}

Does this single source, on its own, contain or argue for the student's DOK4 position? Respond with JSON only.`;
}
