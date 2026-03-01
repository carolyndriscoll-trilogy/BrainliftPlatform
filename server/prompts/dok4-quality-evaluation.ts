/**
 * DOK4 Quality Evaluation Prompt
 *
 * Single quality-tier LLM call that evaluates a DOK4 Spiky Point of View
 * across 6 criteria (S1-S5 for Intellectual Spikiness, D1 for Defensibility).
 */

export const DOK4_QUALITY_SYSTEM_PROMPT = `You are an evaluator of DOK4 Spiky Points of View (SPOVs) within a structured knowledge framework called a BrainLift.

A BrainLift is a student's organized body of knowledge about their domain, built in layers:
- DOK1: Verified facts from specific sources
- DOK2: The student's synthesis of DOK1 facts from a single source
- DOK3: Cross-source insights reflecting the student's conceptual framework
- DOK4: A Spiky Point of View — a clear, defensible position on a contested topic where informed people disagree

Your task is to evaluate whether the student's SPOV demonstrates genuine intellectual spikiness and is defensible based on their evidence base.

EVALUATION CRITERIA:

Intellectual Spikiness — Is this a real position?
  S1: CONTESTABILITY — Could a reasonable, informed person disagree with this position?
      A position everyone already agrees with is not spiky. The SPOV must stake out
      territory where disagreement exists or could exist.
  S2: DIVERGENCE FROM CONVENTIONAL WISDOM — Does the SPOV challenge, refine, or
      extend prevailing thinking in the domain? Compare against the vanilla LLM
      response provided. If the LLM's default answer largely agrees, the position
      may lack spikiness.
  S3: FRAMEWORK DEPENDENCY — Does the SPOV depend on the student's DOK3 conceptual
      framework? A good SPOV should be a natural extension of the student's unique
      analytical lens, not a generic opinion.
  S4: SPECIFICITY — Does the SPOV make a concrete, bounded claim rather than a
      vague platitude? "Companies should innovate" is not spiky. "AI-native startups
      will make traditional consulting firms obsolete within 5 years because..." is.
  S5: INTELLECTUAL COURAGE — Does the student take a position that is professionally
      or intellectually risky? Does it say something that requires conviction rather
      than just observation?

Defensibility — Can it withstand scrutiny?
  D1: EVIDENCE BASE — Is the SPOV supported by the student's DOK1-DOK3 evidence?
      The position need not be proven, but the student should be able to trace the
      reasoning from their evidence to their conclusion. Check: does the evidence
      actually support this claim, or is the student making a leap?

QUALITY LEVELS:

  1 — Not a Position
      Generic observation, tautology, or statement that no reasonable person
      would contest. This is not an SPOV.

  2 — Weak Position
      The student takes a position, but it is either too vague to be contested,
      too obviously correct to be spiky, or disconnected from their evidence base.

  3 — Moderate Position
      A real position that someone could disagree with, but either the evidence
      base is thin, the reasoning has gaps, or the position doesn't clearly derive
      from the student's unique framework.

  4 — Strong Position
      A clear, specific, contestable position that is well-supported by the
      student's evidence and clearly connected to their DOK3 framework.
      The student takes a real stance.

  5 — Exceptional Position
      Everything in 4, plus the position demonstrates genuine intellectual courage.
      It reframes the domain, challenges established thinking, and the student's
      evidence makes a compelling (not just plausible) case. This is rare.

SCORING INSTRUCTIONS:

- Evaluate all 6 criteria before arriving at a score.
- The quality level descriptions are your primary anchor.
- You MUST reference the Foundation Integrity Index and traceability status in your rationale.
- If the S2 vanilla response AGREES with the SPOV, this is evidence against spikiness.
  Weigh this seriously.
- If the traceability check flagged a source, the student may be borrowing a position
  rather than constructing their own. Weigh this seriously.
- Your rationale must cite specific DOK1/DOK2/DOK3 evidence.

Respond ONLY with this JSON. No markdown. No backticks. No preamble.
{
  "criteria": {
    "S1": { "assessment": "strong|partial|weak", "evidence": "one sentence" },
    "S2": { "assessment": "strong|partial|weak", "evidence": "one sentence" },
    "S3": { "assessment": "strong|partial|weak", "evidence": "one sentence" },
    "S4": { "assessment": "strong|partial|weak", "evidence": "one sentence" },
    "S5": { "assessment": "strong|partial|weak", "evidence": "one sentence" },
    "D1": { "assessment": "strong|partial|weak", "evidence": "one sentence" }
  },
  "score": 1-5,
  "s2_divergence_classification": "agree|partially_agree|disagree",
  "position_summary": "One sentence summarizing the student's position",
  "framework_dependency": "One sentence describing how this SPOV connects to the student's DOK3 framework",
  "key_evidence": ["array of 2-4 specific pieces of evidence from the student's DOK1/DOK2/DOK3"],
  "vulnerability_points": ["array of 1-3 weaknesses or counter-arguments the student should address"],
  "rationale": "A paragraph explaining how the criteria informed your score. Reference specific evidence. Address foundation integrity and traceability.",
  "feedback": "One specific, actionable recommendation. Tell the student exactly what to strengthen."
}`;

/**
 * Build the user prompt for DOK4 quality evaluation.
 */
export function buildDOK4QualityUserPrompt(params: {
  brainliftPurpose: string;
  dok4Text: string;
  primaryDok3: { text: string; frameworkName: string | null; score: number | null } | null;
  linkedDok3s: Array<{ text: string; frameworkName: string | null; score: number | null; isPrimary: boolean }>;
  linkedDok2s: Array<{
    sourceName: string;
    grade: number | null;
    points: string[];
    dok1Facts: Array<{ fact: string; score: number; verificationScore: number | null }>;
  }>;
  sourceEvidence: Map<string, { sourceName: string; content: string }>;
  foundationMetrics: {
    dok1Score: number;
    dok2Score: number;
    dok3Score: number;
    index: number;
  };
  traceabilityStatus: string;
  vanillaResponse: string | null;
  learnerContext?: string | null;
}): string {
  // Build DOK3 context
  const dok3Section = params.linkedDok3s.map(d => {
    const prefix = d.isPrimary ? '[PRIMARY] ' : '';
    return `${prefix}${d.frameworkName ? `"${d.frameworkName}": ` : ''}${d.text} (score: ${d.score ?? 'ungraded'}/5)`;
  }).join('\n');

  // Build linked evidence section
  const linkedEvidence = params.linkedDok2s.map(dok2 => {
    const pointsText = dok2.points.length > 0
      ? dok2.points.map((p, i) => `${i + 1}. ${p}`).join('\n')
      : 'No summary points available.';

    const factsText = dok2.dok1Facts.length > 0
      ? dok2.dok1Facts.map(f =>
        `- (extraction: ${f.score}/5, verification: ${f.verificationScore ?? 'n/a'}/5) ${f.fact}`
      ).join('\n')
      : 'No DOK1 facts available for this source.';

    return `---
Source: ${dok2.sourceName}
DOK2 Summary (grade: ${dok2.grade ?? 'ungraded'}/5):
${pointsText}

DOK1 Facts from this source:
${factsText}
---`;
  }).join('\n\n');

  // Build source content section
  const sourceContentEntries = Array.from(params.sourceEvidence.entries());
  const sourceContent = sourceContentEntries.length > 0
    ? sourceContentEntries.map(([_url, { sourceName, content }]) =>
      `---\nSource: ${sourceName}\n${content}\n---`
    ).join('\n\n')
    : 'No cached source content available.';

  const m = params.foundationMetrics;

  return `BRAINLIFT PURPOSE:
${params.brainliftPurpose || 'No specific purpose defined.'}

DOK4 SPIKY POINT OF VIEW:
${params.dok4Text}

DOK3 CONCEPTUAL FRAMEWORK:
${dok3Section || 'No DOK3 insights linked.'}

LINKED EVIDENCE:
${linkedEvidence}

SOURCE CONTENT:
${sourceContent}

FOUNDATION METRICS:
DOK1 Component Score: ${m.dok1Score.toFixed(2)}/5
DOK2 Component Score: ${m.dok2Score.toFixed(2)}/5
DOK3 Component Score: ${m.dok3Score.toFixed(2)}/5
Foundation Integrity Index: ${m.index.toFixed(4)}

TRACEABILITY: ${params.traceabilityStatus}

S2 VANILLA LLM RESPONSE (what a default LLM says about this topic without the student's framework):
${params.vanillaResponse || 'Vanilla response not available.'}${params.learnerContext ? `

LEARNER CONTEXT:
${params.learnerContext}` : ''}`;
}
