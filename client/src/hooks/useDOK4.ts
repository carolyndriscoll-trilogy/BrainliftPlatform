import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useMemo } from 'react';

export interface DOK4SubmissionWithLinks {
  id: number;
  brainliftId: number;
  text: string;
  status: string;
  currentStep: string | null;
  // POV Validation
  rejectionReason: string | null;
  rejectionCategory: string | null;
  // Foundation
  foundationIntegrityIndex: string | null;
  dok1ComponentScore: string | null;
  dok2ComponentScore: string | null;
  dok3ComponentScore: string | null;
  foundationCeiling: number | null;
  // Traceability
  traceabilityStatus: string | null;
  traceabilityIsBorrowed: boolean | null;
  traceabilityFlaggedSource: string | null;
  // Quality
  qualityScoreRaw: number | null;
  qualityScoreFinal: number | null;
  qualityCriteria: Record<string, { assessment: string; evidence: string }> | null;
  s2DivergenceClassification: string | null;
  positionSummary: string | null;
  frameworkDependency: string | null;
  keyEvidence: string[] | null;
  vulnerabilityPoints: string[] | null;
  qualityRationale: string | null;
  qualityFeedback: string | null;
  qualityEvaluatorModel: string | null;
  // COE
  ownershipAssessmentScore: number | null;
  coePerAxisScores: Record<string, number> | null;
  coeConjunctiveFailure: boolean;
  coeConjunctiveFailureAxis: string | null;
  coeAdjustment: number | null;
  confidenceLevel: string | null;
  // Links
  linkedDok3InsightIds: number[];
  primaryDok3InsightId: number | null;
  linkedDok2SummaryIds: number[];
  // Timestamps
  gradedAt: string | null;
  createdAt: string;
}

interface SubmitDOK4Params {
  text: string;
  dok3InsightIds: number[];
  primaryDok3Id: number;
  dok2SummaryIds: number[];
}

interface SubmitDOK4Response {
  accept: boolean;
  rejection_reason?: string;
  rejection_category?: string;
  submission: DOK4SubmissionWithLinks;
}

export function useDOK4(slug: string) {
  const queryKey = ['dok4-submissions', slug];

  const query = useQuery<DOK4SubmissionWithLinks[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/brainlifts/${slug}/dok4`);
      if (!res.ok) throw new Error('Failed to fetch DOK4 submissions');
      return res.json();
    },
    enabled: !!slug,
  });

  const submissions = query.data ?? [];

  const derived = useMemo(() => {
    const completedSubmissions = submissions.filter(s => s.status === 'completed');
    const runningSubmissions = submissions.filter(s => s.status === 'running');
    const rejectedSubmissions = submissions.filter(s =>
      s.rejectionReason !== null && s.status === 'draft'
    );
    const failedSubmissions = submissions.filter(s => s.status === 'failed');

    const scores = completedSubmissions
      .map(s => s.qualityScoreFinal)
      .filter((s): s is number => s !== null);
    const meanScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : null;

    const highQualityCount = scores.filter(s => s >= 4).length;
    const needsWorkCount = scores.filter(s => s <= 2).length;

    return {
      completedSubmissions,
      runningSubmissions,
      rejectedSubmissions,
      failedSubmissions,
      meanScore,
      totalCount: submissions.length,
      highQualityCount,
      needsWorkCount,
    };
  }, [submissions]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
  };

  const submitMutation = useMutation({
    mutationFn: async (params: SubmitDOK4Params): Promise<SubmitDOK4Response> => {
      const res = await fetch(`/api/brainlifts/${slug}/dok4`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to submit DOK4');
      }
      return res.json();
    },
    onSuccess: invalidate,
  });

  return {
    submissions,
    isLoading: query.isLoading,
    ...derived,
    submit: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
    invalidate,
  };
}
