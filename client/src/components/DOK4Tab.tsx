import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Lightbulb, RefreshCw, Loader2, ChevronDown, ChevronUp, Info, AlertTriangle, Plus } from 'lucide-react';
import { PiFootprintsFill } from 'react-icons/pi';
import type { DOK4SubmissionWithLinks } from '@/hooks/useDOK4';
import type { DOK4GradingSSEEvent } from '@/hooks/useDOK4GradingEvents';
import { tokens, getScoreChipColors } from '@/lib/colors';
import { TactileButton } from '@/components/ui/tactile-button';

// ─── Criteria Metadata ─────────────────────────────────────────────────────────

interface CriterionMeta {
  key: string;
  name: string;
  description: string;
}

interface AxisMeta {
  id: string;
  label: string;
  question: string;
  criteria: CriterionMeta[];
}

const QUALITY_CRITERIA: AxisMeta[] = [
  {
    id: 'S',
    label: 'Intellectual Spikiness',
    question: 'How sharp is the position?',
    criteria: [
      { key: 'S1', name: 'Position Clarity', description: 'Can you identify a clear, falsifiable claim?' },
      { key: 'S2', name: 'Divergence from Default', description: 'Does this position differ from what a vanilla LLM would say?' },
      { key: 'S3', name: 'Multi-Source Synthesis', description: 'Does the SPOV draw on multiple DOK2 sources to construct something new?' },
      { key: 'S4', name: 'Framework Extension', description: 'Does it extend or apply the DOK3 framework in a novel direction?' },
      { key: 'S5', name: 'Insight Density', description: 'Is the argument concise and information-dense, avoiding padding?' },
    ],
  },
  {
    id: 'D',
    label: 'Defensibility',
    question: 'Can the position withstand challenge?',
    criteria: [
      { key: 'D1', name: 'Defensibility', description: 'Could this position survive reasonable counterargument?' },
    ],
  },
];

const COE_AXES: { key: string; label: string; max: number }[] = [
  { key: 'evidence_grounding', label: 'Evidence Grounding', max: 5 },
  { key: 'reasoning_depth', label: 'Reasoning Depth', max: 5 },
  { key: 'epistemic_honesty', label: 'Epistemic Honesty', max: 5 },
  { key: 'argumentative_coherence', label: 'Argumentative Coherence', max: 4 },
];

// ─── Component Props ────────────────────────────────────────────────────────────

interface DOK4TabProps {
  submissions: DOK4SubmissionWithLinks[];
  isLoading: boolean;
  meanScore: number | null;
  totalCount: number;
  highQualityCount: number;
  needsWorkCount: number;
  latestEvent: DOK4GradingSSEEvent | null;
  onNewSubmission: () => void;
}

function getGradeLabel(score: number | null): string {
  if (score === null) return 'Ungraded';
  if (score === 5) return 'Excellent';
  if (score === 4) return 'Strong';
  if (score === 3) return 'Adequate';
  if (score === 2) return 'Weak';
  return 'Failed';
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'draft': return 'Draft';
    case 'running': return 'Grading';
    case 'completed': return 'Graded';
    case 'failed': return 'Error';
    default: return status;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': return tokens.success;
    case 'running': return tokens.info;
    case 'failed': return tokens.danger;
    default: return tokens.textMuted;
  }
}

function getAssessmentColor(assessment: string): { bg: string; text: string } {
  const lower = assessment.toLowerCase();
  if (lower === 'strong' || lower === 'excellent') return { bg: tokens.successSoft, text: tokens.success };
  if (lower === 'partial' || lower === 'adequate') return { bg: tokens.warningSoft, text: tokens.warning };
  return { bg: tokens.dangerSoft, text: tokens.danger };
}

type SortMode = 'score' | 'status';

export function DOK4Tab({
  submissions,
  isLoading,
  meanScore,
  totalCount,
  highQualityCount,
  needsWorkCount,
  latestEvent,
  onNewSubmission,
}: DOK4TabProps) {
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});
  const [sortMode, setSortMode] = useState<SortMode>('score');

  const toggleExpanded = (id: number) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const runningSubmissions = useMemo(
    () => submissions.filter(s => s.status === 'running'),
    [submissions],
  );

  // Sort: completed (score desc) → running → draft → failed
  const sortedSubmissions = useMemo(() => {
    // Exclude rejected drafts from main list
    const displayable = submissions.filter(s => !(s.status === 'draft' && s.rejectionReason));
    if (sortMode === 'status') {
      const statusOrder: Record<string, number> = {
        completed: 0, running: 1, draft: 2, failed: 3,
      };
      return [...displayable].sort((a, b) =>
        (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
      );
    }
    return [...displayable].sort((a, b) => {
      if (a.status === 'completed' && b.status === 'completed') {
        return (b.qualityScoreFinal ?? 0) - (a.qualityScoreFinal ?? 0);
      }
      if (a.status === 'completed') return -1;
      if (b.status === 'completed') return 1;
      const statusOrder: Record<string, number> = { running: 0, draft: 1, failed: 2 };
      return (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
    });
  }, [submissions, sortMode]);

  // Rejected submissions shown separately
  const rejectedSubmissions = useMemo(
    () => submissions.filter(s => s.status === 'draft' && s.rejectionReason),
    [submissions],
  );

  const getMeanScoreColor = (score: number) => {
    if (score >= 4.5) return tokens.success;
    if (score >= 3.5) return tokens.info;
    if (score >= 1.5) return tokens.warning;
    if (score > 0) return tokens.danger;
    return tokens.textMuted;
  };

  if (isLoading) {
    return (
      <div className="max-w-[1200px] mx-auto p-12 text-center text-muted-foreground">
        Loading DOK4 submissions...
      </div>
    );
  }

  // Empty state
  if (submissions.length === 0) {
    return (
      <div className="max-w-[1200px] mx-auto">
        <div className="flex flex-col gap-4 mb-6 pb-4">
          <h2 className="text-[30px] font-bold text-foreground tracking-tight leading-[1.1] m-0">
            DOK4 Spiky Points of View
          </h2>
          <p className="text-[15px] text-muted-light m-0 max-w-2xl font-serif italic">
            Your original, defensible positions that emerge from your DOK3 frameworks.
          </p>
        </div>

        <div className="bg-card-elevated rounded-xl shadow-card py-20 px-12">
          <div className="flex flex-col items-center text-center">
            <Lightbulb size={40} className="text-muted-light opacity-40 mb-8" />
            <h3 className="font-serif text-[24px] text-foreground m-0 mb-4">
              No SPOVs Yet
            </h3>
            <p className="text-[14px] text-muted-light m-0 max-w-md leading-relaxed mb-10">
              DOK4 Spiky Points of View are original, defensible positions that build on your DOK3 frameworks
              and are supported by evidence from multiple DOK2 sources. Submit your first SPOV to begin.
            </p>
            <TactileButton
              variant="raised"
              onClick={onNewSubmission}
              className="flex items-center gap-3 px-8 py-4 text-[14px]"
            >
              <Plus size={18} />
              Submit SPOV
            </TactileButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-col gap-4 mb-6 pb-4">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-[30px] font-bold text-foreground tracking-tight leading-[1.1] m-0">
              DOK4 Spiky Points of View
            </h2>
          </div>
          <TactileButton
            variant="raised"
            onClick={onNewSubmission}
            className="flex items-center gap-2 px-5 py-3 text-[13px] shrink-0"
          >
            <Plus size={16} />
            New SPOV
          </TactileButton>
        </div>
        <p className="text-[15px] text-muted-light m-0 max-w-2xl font-serif italic">
          Your original, defensible positions. Grades reflect intellectual spikiness, defensibility, and cognitive ownership.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="flex justify-between mb-16">
        {[
          { label: ['TOTAL', 'SPOVS'], value: totalCount, color: tokens.primary },
          { label: ['MEAN', 'GRADE'], value: meanScore !== null ? meanScore.toFixed(2) : '—', color: meanScore !== null ? getMeanScoreColor(meanScore) : tokens.textMuted },
          { label: ['HIGH', 'QUALITY'], value: highQualityCount, color: tokens.success },
          { label: ['NEEDS', 'WORK'], value: needsWorkCount, color: needsWorkCount > 0 ? tokens.warning : tokens.textMuted },
        ].map((stat, i) => (
          <div
            key={i}
            className="w-[160px] py-6 px-5 bg-card-elevated rounded-lg shadow-card flex flex-col animate-fade-slide-in"
            style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'backwards' }}
          >
            <div className="font-serif text-[54px] leading-none font-normal tracking-wide" style={{ color: stat.color }}>
              {stat.value}
            </div>
            <div className="mt-5 text-[13px] text-muted-foreground font-semibold tracking-[0.35em] leading-relaxed">
              {stat.label[0]}
              {stat.label[1] && <br />}
              {stat.label[1]}
            </div>
          </div>
        ))}
      </div>

      {/* Real-time grading indicator */}
      {runningSubmissions.length > 0 && latestEvent && (
        <div className="bg-primary/5 border border-border rounded-xl p-4 mb-8 flex items-center gap-3">
          <Loader2 size={16} className="animate-spin text-primary" />
          <span className="text-[13px] text-muted-foreground">{latestEvent.message}</span>
        </div>
      )}

      {/* Rejected Submissions */}
      {rejectedSubmissions.length > 0 && (
        <div className="mb-16">
          <div className="flex items-baseline gap-3 mb-4">
            <h3 className="text-[18px] font-semibold text-foreground m-0">Rejected Submissions</h3>
            <span className="text-[11px] text-muted-foreground">{rejectedSubmissions.length}</span>
          </div>
          <div className="space-y-4">
            {rejectedSubmissions.map(sub => (
              <div key={sub.id} className="bg-card-elevated rounded-xl shadow-card overflow-hidden border-l-4 border-l-warning/50">
                <div className="px-8 py-6">
                  <p className="font-serif text-[15px] leading-[1.6] text-muted-foreground m-0 mb-3 line-clamp-2">
                    {sub.text}
                  </p>
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={14} className="text-warning" />
                    <span className="text-[12px] text-warning font-semibold">{sub.rejectionReason}</span>
                    {sub.rejectionCategory && (
                      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground px-2 py-0.5 rounded-full bg-sidebar">
                        {sub.rejectionCategory.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Submissions */}
      {sortedSubmissions.length > 0 && (
        <>
          <div className="flex items-baseline justify-between animate-fade-slide-in" style={{ animationDelay: '400ms', animationFillMode: 'backwards' }}>
            <h3 className="text-[24px] font-semibold text-foreground m-0">
              Submissions
            </h3>
            <button
              onClick={() => setSortMode(prev => prev === 'score' ? 'status' : 'score')}
              className="flex items-center gap-2 text-[10px] uppercase tracking-[0.35em] text-muted-light font-semibold bg-transparent border-0 p-0 cursor-pointer hover:text-muted-foreground transition-colors duration-200"
            >
              {sortMode === 'score' ? 'By Score' : 'By Status'}
            </button>
          </div>
          <hr className="border-t border-border mt-4 mb-12" />

          <div className="flex flex-col gap-16">
            {sortedSubmissions.map((submission, index) => (
              <SubmissionCard
                key={submission.id}
                submission={submission}
                expanded={expandedIds[submission.id] ?? false}
                onToggle={() => toggleExpanded(submission.id)}
                animationDelay={(index + 6) * 80}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Submission Card ──────────────────────────────────────────────────────────

interface SubmissionCardProps {
  submission: DOK4SubmissionWithLinks;
  expanded: boolean;
  onToggle: () => void;
  animationDelay: number;
}

function SubmissionCard({ submission, expanded, onToggle, animationDelay }: SubmissionCardProps) {
  const gradeColors = submission.qualityScoreFinal !== null ? getScoreChipColors(submission.qualityScoreFinal) : null;
  const gradeLabel = getGradeLabel(submission.qualityScoreFinal);
  const hasCriteria = submission.qualityCriteria && Object.keys(submission.qualityCriteria).length > 0;
  const isCompleted = submission.status === 'completed';
  const isRunning = submission.status === 'running';

  return (
    <div
      className="animate-fade-slide-in"
      style={{ animationDelay: `${animationDelay}ms`, animationFillMode: 'backwards' }}
    >
      <div className="bg-card-elevated rounded-xl shadow-card overflow-hidden">
        {/* Header: Score + Text + Meta */}
        <div className="flex gap-8 px-10 py-12">
          {/* Score Circle */}
          <div className="flex flex-col items-center gap-3 shrink-0">
            {isRunning ? (
              <div className="flex items-center justify-center w-14 h-14 rounded-full border border-border">
                <Loader2 size={24} className="animate-spin text-primary" />
              </div>
            ) : (
              <div
                className="flex items-center justify-center w-14 h-14 rounded-full font-serif text-[28px] font-normal"
                style={{
                  backgroundColor: 'transparent',
                  color: gradeColors ? gradeColors.text : tokens.textMuted,
                  border: `1px solid ${tokens.border}`,
                }}
              >
                {submission.qualityScoreFinal !== null ? submission.qualityScoreFinal : '—'}
              </div>
            )}
            <span
              className="text-[9px] uppercase tracking-[0.25em]"
              style={{ color: isRunning ? tokens.info : (gradeColors ? gradeColors.text : tokens.textMuted) }}
            >
              {isRunning ? getStatusLabel(submission.status) : gradeLabel}
            </span>
          </div>

          {/* SPOV Text & Meta */}
          <div className="flex flex-col gap-4 flex-1 min-w-0">
            <p className="font-serif text-[18px] leading-[1.6] text-foreground m-0">
              {submission.text}
            </p>

            {/* Meta row */}
            <div className="flex items-center gap-4 flex-wrap">
              {submission.positionSummary && (
                <span className="text-[11px] text-muted-foreground italic">
                  {submission.positionSummary}
                </span>
              )}
              {submission.confidenceLevel && (
                <>
                  <span className="text-muted-light">·</span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                    {submission.confidenceLevel}
                  </span>
                </>
              )}
              {submission.coeAdjustment !== null && submission.coeAdjustment !== 0 && (
                <>
                  <span className="text-muted-light">·</span>
                  <span className={`text-[10px] uppercase tracking-[0.2em] font-semibold ${submission.coeAdjustment > 0 ? 'text-success' : 'text-warning'}`}>
                    COE {submission.coeAdjustment > 0 ? '+' : ''}{submission.coeAdjustment}
                  </span>
                </>
              )}
              {!isCompleted && !isRunning && (
                <span
                  className="text-[10px] uppercase tracking-[0.2em] font-semibold"
                  style={{ color: getStatusColor(submission.status) }}
                >
                  {getStatusLabel(submission.status)}
                </span>
              )}
            </div>

            {/* Traceability flag */}
            {submission.traceabilityStatus === 'flagged' && (
              <div className="group relative inline-flex items-center gap-2 text-[9px] uppercase tracking-[0.35em] font-semibold text-warning">
                <PiFootprintsFill size={14} className="opacity-50" />
                Traceability flagged{submission.traceabilityFlaggedSource ? `: ${submission.traceabilityFlaggedSource}` : ''}
                <Info size={11} className="opacity-50 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-full left-0 mb-2 w-72 px-4 py-3 bg-foreground text-background text-[12px] leading-[1.5] rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200 z-10 normal-case tracking-normal font-normal">
                  This SPOV appears closely traceable to a single source. A DOK4 position should go beyond what any individual source states — building original argumentation on your DOK3 framework.
                  <div className="absolute top-full left-6 border-4 border-transparent border-t-foreground" />
                </div>
              </div>
            )}

            {/* S2 Divergence badge */}
            {submission.s2DivergenceClassification && (
              <span className={`text-[10px] uppercase tracking-[0.2em] font-semibold ${
                submission.s2DivergenceClassification === 'disagree' ? 'text-success' :
                submission.s2DivergenceClassification === 'partially_agree' ? 'text-warning' :
                'text-muted-foreground'
              }`}>
                S2: {submission.s2DivergenceClassification.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </div>

        {/* Rationale & Feedback - Always visible for completed */}
        {isCompleted && (submission.qualityRationale || submission.qualityFeedback) && (
          <div className="px-10 pb-12 flex flex-col gap-8">
            {submission.qualityRationale && (
              <div className="rounded-xl p-10 bg-primary/5 border border-border">
                <div className="flex items-center gap-2.5 mb-8">
                  <Lightbulb size={20} style={{ color: tokens.warning }} />
                  <span className="text-[14px] uppercase tracking-[0.15em] font-semibold" style={{ color: tokens.warning }}>
                    Rationale
                  </span>
                </div>
                <p className="font-serif text-[15px] leading-[2] text-foreground m-0 whitespace-pre-wrap">
                  {submission.qualityRationale}
                </p>
              </div>
            )}
            {submission.qualityFeedback && (
              <div className="rounded-xl p-10 bg-primary/5 border border-border">
                <div className="flex items-center gap-2.5 mb-8">
                  <RefreshCw size={20} style={{ color: tokens.success }} />
                  <span className="text-[14px] uppercase tracking-[0.15em] font-semibold" style={{ color: tokens.success }}>
                    How to Improve
                  </span>
                </div>
                <p className="font-serif text-[15px] leading-[2] text-foreground m-0 whitespace-pre-wrap italic">
                  {submission.qualityFeedback}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Expand toggle for completed submissions */}
        {isCompleted && (hasCriteria || submission.ownershipAssessmentScore !== null) && (
          <div className="px-10 pb-10">
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              className="flex items-center gap-2 text-[12px] text-muted-light bg-transparent p-0 cursor-pointer text-left uppercase tracking-[0.35em] font-semibold border-0 border-b border-solid border-muted-light/50 hover:border-dashed hover:text-muted-foreground hover:border-muted-foreground transition-colors duration-300"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {expanded ? 'HIDE DETAILS' : 'VIEW CRITERIA, COE & FOUNDATION'}
            </button>
          </div>
        )}

        {/* Expandable Details */}
        <AnimatePresence initial={false}>
          {expanded && isCompleted && (
            <motion.div
              key="details"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ height: { duration: 0.4, ease: 'easeInOut' }, opacity: { duration: 0.2 } }}
              className="overflow-hidden"
            >
              <div className="px-10 py-14 border-t border-border">
                {/* Quality Criteria Breakdown */}
                {hasCriteria && (
                  <div className="mb-12">
                    <span className="text-[13px] uppercase tracking-[0.3em] font-bold text-muted-foreground block mb-8">
                      Quality Criteria
                    </span>
                    <div className="space-y-10">
                      {QUALITY_CRITERIA.map(axis => {
                        const axisCriteria = axis.criteria.filter(
                          c => submission.qualityCriteria![c.key]
                        );
                        if (axisCriteria.length === 0) return null;

                        return (
                          <div key={axis.id}>
                            <div className="flex items-baseline gap-3 mb-5">
                              <span className="text-[11px] uppercase tracking-[0.3em] font-bold" style={{ color: tokens.primary }}>
                                {axis.label}
                              </span>
                              <span className="text-[11px] italic text-muted-light font-serif">
                                {axis.question}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-5">
                              {axisCriteria.map((criterion, idx) => {
                                const data = submission.qualityCriteria![criterion.key];
                                const colors = getAssessmentColor(data.assessment);
                                const isOddLast = axisCriteria.length % 2 === 1 && idx === axisCriteria.length - 1;

                                return (
                                  <div
                                    key={criterion.key}
                                    className={`rounded-lg p-5 bg-sidebar border border-border shadow-card ${isOddLast ? 'col-span-2 max-w-[calc(50%-0.625rem)] mx-auto' : ''}`}
                                  >
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                      <span className="text-[12px] font-semibold text-foreground min-w-0">
                                        {criterion.name}
                                      </span>
                                      <span
                                        className="text-[9px] uppercase tracking-[0.2em] font-bold px-2 py-0.5 rounded-full shrink-0"
                                        style={{ backgroundColor: colors.bg, color: colors.text }}
                                      >
                                        {data.assessment}
                                      </span>
                                    </div>
                                    <p className="text-[13px] leading-[1.6] text-muted-foreground m-0">
                                      {data.evidence}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* COE Ownership Scores */}
                {submission.ownershipAssessmentScore !== null && (
                  <div className="mb-12">
                    <span className="text-[13px] uppercase tracking-[0.3em] font-bold text-muted-foreground block mb-8">
                      Cognitive Ownership Evaluation
                    </span>
                    <div className="grid grid-cols-2 gap-6 mb-6">
                      {/* Overall ownership score */}
                      <div className="col-span-2 rounded-lg p-6 bg-sidebar border border-border flex items-center gap-6">
                        <div
                          className="font-serif text-[36px] leading-none"
                          style={{ color: submission.ownershipAssessmentScore >= 15 ? tokens.success : submission.ownershipAssessmentScore >= 10 ? tokens.info : tokens.warning }}
                        >
                          {submission.ownershipAssessmentScore}
                        </div>
                        <div>
                          <div className="text-[12px] font-semibold text-foreground">Ownership Score</div>
                          <div className="text-[11px] text-muted-foreground">
                            out of 19 · {submission.ownershipAssessmentScore >= 15 ? 'Strong ownership (+1 adjustment)' : submission.ownershipAssessmentScore >= 10 ? 'Adequate ownership (no adjustment)' : 'Weak ownership (-1 adjustment)'}
                          </div>
                        </div>
                        {submission.coeConjunctiveFailure && (
                          <div className="ml-auto flex items-center gap-2 text-warning">
                            <AlertTriangle size={14} />
                            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold">
                              Conjunctive Failure{submission.coeConjunctiveFailureAxis ? `: ${submission.coeConjunctiveFailureAxis.replace(/_/g, ' ')}` : ''}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Per-axis scores */}
                      {submission.coePerAxisScores && COE_AXES.map(axis => {
                        const score = submission.coePerAxisScores![axis.key] ?? 0;
                        const pct = (score / axis.max) * 100;
                        return (
                          <div key={axis.key} className="rounded-lg p-5 bg-sidebar border border-border">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-[11px] font-semibold text-foreground">{axis.label}</span>
                              <span className="text-[14px] font-serif text-foreground">{Math.round(score)}/{axis.max}</span>
                            </div>
                            <div className="h-1.5 bg-border rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: score < 2 ? tokens.danger : score < 3 ? tokens.warning : tokens.success,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Foundation Metrics */}
                <div className="mb-12">
                  <span className="text-[13px] uppercase tracking-[0.3em] font-bold text-muted-foreground block mb-8">
                    Foundation Metrics
                  </span>
                  <div className="grid grid-cols-3 gap-6">
                    {[
                      { label: 'DOK1 Facts', tooltip: 'Mean verification consensus score of deduplicated DOK1 facts from linked sources.', value: submission.dok1ComponentScore },
                      { label: 'DOK2 Synthesis', tooltip: 'Mean grade of linked DOK2 summaries.', value: submission.dok2ComponentScore },
                      { label: 'DOK3 Framework', tooltip: 'Primary DOK3 insight score.', value: submission.dok3ComponentScore },
                    ].map(metric => (
                      <div
                        key={metric.label}
                        className="group relative rounded-lg p-6 bg-sidebar border border-border flex flex-col items-center text-center"
                      >
                        <div className="font-serif text-[32px] text-foreground leading-none">
                          {metric.value ?? '—'}
                        </div>
                        <div className="mt-3 flex items-center gap-1.5">
                          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            {metric.label}
                          </span>
                          <Info size={11} className="text-muted-light opacity-60 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 px-4 py-3 bg-foreground text-background text-[12px] leading-[1.5] rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200 z-10">
                          <div className="font-semibold mb-1">{metric.label}</div>
                          {metric.tooltip}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                  {submission.foundationCeiling !== null && (
                    <div className="mt-4 text-[11px] text-muted-foreground text-center">
                      Foundation Ceiling: {submission.foundationCeiling} · Index: {submission.foundationIntegrityIndex ?? '—'}
                    </div>
                  )}
                </div>

                {/* Vulnerability Points */}
                {submission.vulnerabilityPoints && submission.vulnerabilityPoints.length > 0 && (
                  <div className="mb-12">
                    <span className="text-[13px] uppercase tracking-[0.3em] font-bold text-muted-foreground block mb-4">
                      Vulnerability Points
                    </span>
                    <ul className="list-disc list-inside space-y-2">
                      {submission.vulnerabilityPoints.map((point, i) => (
                        <li key={i} className="text-[13px] text-muted-foreground leading-relaxed">{point}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Evaluator Model */}
                {submission.qualityEvaluatorModel && (
                  <div className="text-[10px] text-muted-light uppercase tracking-[0.2em]">
                    Evaluated by {submission.qualityEvaluatorModel}
                    {submission.gradedAt && ` · ${new Date(submission.gradedAt).toLocaleDateString()}`}
                  </div>
                )}

                {/* Collapse button */}
                <div className="mt-10">
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggle(); }}
                    className="text-[10px] text-muted-light bg-transparent p-0 cursor-pointer text-left uppercase tracking-[0.35em] font-semibold border-0 border-b border-solid border-muted-light/50 hover:border-dashed hover:text-muted-foreground hover:border-muted-foreground transition-colors duration-300"
                  >
                    HIDE DETAILS
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
