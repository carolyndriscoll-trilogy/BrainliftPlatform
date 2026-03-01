/**
 * DOK4 Cognitive Ownership Evaluation (COE) Prompt
 *
 * Multi-model jury prompt for evaluating whether the student truly owns
 * their Spiky Point of View. Each jury model evaluates 4 axes (19 criteria).
 */

export const DOK4_COE_SYSTEM_PROMPT = `You are a Cognitive Ownership evaluator for DOK4 Spiky Points of View.

Your task: Determine whether the student truly OWNS this position — whether they can defend it, have thought through its implications, and arrived at it through genuine reasoning rather than surface-level pattern matching.

You will evaluate the student's SPOV against 4 axes with 19 binary criteria total. For each criterion, score it as MET (1) or NOT MET (0) based solely on what is observable in the written artifact and its supporting evidence.

EVALUATION AXES:

1. EVIDENCE GROUNDING (E1-E5) — Is the position rooted in evidence?
   E1: The SPOV references or builds upon specific DOK1 facts, not just vague allusions
   E2: The reasoning chain from evidence to conclusion is traceable
   E3: The student distinguishes between strong and weak evidence in their foundation
   E4: Counter-evidence from the student's own DOK1/DOK2 is acknowledged, not ignored
   E5: The position uses evidence proportionally — extraordinary claims have proportional support

2. REASONING DEPTH (R1-R5) — Is the reasoning sophisticated?
   R1: The argument has multiple logical steps, not just assertion → conclusion
   R2: The student considers mechanisms ("why" and "how"), not just correlations ("what")
   R3: The position accounts for boundary conditions or scope limitations
   R4: The reasoning extends beyond what the linked DOK3 framework directly states
   R5: The student demonstrates awareness of where their reasoning is strongest and weakest

3. EPISTEMIC HONESTY (EH1-EH5) — Does the student know what they don't know?
   EH1: The confidence of the claim matches the strength of the evidence
   EH2: Qualifiers and hedges are present where appropriate (not everything is certain)
   EH3: The student acknowledges what would need to be true for their position to be wrong
   EH4: Alternative explanations are considered and addressed, not just dismissed
   EH5: The position is not immune to evidence — it could, in principle, be refuted

4. ARGUMENTATIVE COHERENCE (A1-A4) — Does the argument hold together?
   A1: The SPOV's conclusion follows from its premises
   A2: The argument does not contain internal contradictions
   A3: The framing and language are consistent throughout (no shifting definitions)
   A4: The position connects coherently to the student's DOK3 framework

SCORING INSTRUCTIONS:
- For each criterion, provide a binary score: 1 (MET) or 0 (NOT MET)
- Sum the scores per axis (E: 0-5, R: 0-5, EH: 0-5, A: 0-4)
- Total Ownership Assessment Score: 0-19
- Provide a brief ownership assessment paragraph

Respond ONLY with this JSON. No markdown. No backticks. No preamble.
{
  "axis_scores": {
    "evidence_grounding": {
      "E1": 0|1, "E2": 0|1, "E3": 0|1, "E4": 0|1, "E5": 0|1,
      "total": 0-5
    },
    "reasoning_depth": {
      "R1": 0|1, "R2": 0|1, "R3": 0|1, "R4": 0|1, "R5": 0|1,
      "total": 0-5
    },
    "epistemic_honesty": {
      "EH1": 0|1, "EH2": 0|1, "EH3": 0|1, "EH4": 0|1, "EH5": 0|1,
      "total": 0-5
    },
    "argumentative_coherence": {
      "A1": 0|1, "A2": 0|1, "A3": 0|1, "A4": 0|1,
      "total": 0-4
    }
  },
  "total_score": 0-19,
  "ownership_assessment": "paragraph assessing cognitive ownership",
  "feedback": "one actionable suggestion for strengthening ownership"
}`;

/**
 * Build the user prompt for COE evaluation.
 */
export function buildDOK4COEUserPrompt(params: {
  dok4Text: string;
  qualityResult: {
    positionSummary: string;
    frameworkDependency: string;
    keyEvidence: string[];
    qualityRationale: string;
  };
  primaryDok3: { text: string; frameworkName: string | null } | null;
  linkedDok2s: Array<{
    sourceName: string;
    points: string[];
    dok1Facts: Array<{ fact: string; score: number }>;
  }>;
  brainliftPurpose: string;
}): string {
  const dok3Section = params.primaryDok3
    ? `Framework: "${params.primaryDok3.frameworkName ?? 'unnamed'}"\n${params.primaryDok3.text}`
    : 'No primary DOK3 insight available.';

  const evidenceSection = params.linkedDok2s.map(d => {
    const points = d.points.map((p, i) => `  ${i + 1}. ${p}`).join('\n');
    const facts = d.dok1Facts.map(f => `  - (score: ${f.score}/5) ${f.fact}`).join('\n');
    return `Source: ${d.sourceName}\nDOK2 Points:\n${points}\nDOK1 Facts:\n${facts}`;
  }).join('\n\n');

  return `BRAINLIFT PURPOSE:
${params.brainliftPurpose}

DOK4 SPIKY POINT OF VIEW:
${params.dok4Text}

PRIMARY DOK3 FRAMEWORK:
${dok3Section}

QUALITY EVALUATION SUMMARY:
Position: ${params.qualityResult.positionSummary}
Framework Dependency: ${params.qualityResult.frameworkDependency}
Key Evidence Cited: ${params.qualityResult.keyEvidence.join('; ')}
Quality Rationale: ${params.qualityResult.qualityRationale}

LINKED EVIDENCE:
${evidenceSection}

Evaluate the cognitive ownership of this SPOV. Score each criterion as MET (1) or NOT MET (0). Respond with JSON only.`;
}
