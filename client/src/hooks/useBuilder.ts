import { useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

export function useBuilder(slug: string) {
  const updatePurposeMutation = useMutation({
    mutationFn: async (data: {
      purposeWhatLearning?: string;
      purposeWhyMatters?: string;
      purposeWhatAbleToDo?: string;
      displayPurpose?: string;
    }) => {
      const res = await fetch(`/api/brainlifts/${slug}/purpose`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to update purpose');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brainlift', slug] });
    },
  });

  const synthesizePurposeMutation = useMutation({
    mutationFn: async (data: {
      whatLearning: string;
      whyMatters: string;
      whatAbleToDo: string;
    }) => {
      const res = await fetch(`/api/brainlifts/${slug}/purpose/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to synthesize purpose');
      }
      return res.json() as Promise<{ purpose: string }>;
    },
  });

  const createExpertMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      who?: string;
      focus?: string;
      why?: string;
      where?: string;
      twitterHandle?: string;
    }) => {
      const res = await fetch(`/api/brainlifts/${slug}/experts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create expert');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brainlift', slug] });
    },
  });

  const updateExpertMutation = useMutation({
    mutationFn: async ({ id, ...fields }: {
      id: number;
      name?: string;
      who?: string;
      focus?: string;
      why?: string;
      where?: string;
      twitterHandle?: string;
      draftStatus?: 'draft' | 'complete';
    }) => {
      const res = await fetch(`/api/brainlifts/${slug}/experts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to update expert');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brainlift', slug] });
    },
  });

  return {
    updatePurpose: updatePurposeMutation.mutateAsync,
    isUpdatingPurpose: updatePurposeMutation.isPending,

    synthesizePurpose: synthesizePurposeMutation.mutateAsync,
    isSynthesizing: synthesizePurposeMutation.isPending,

    createExpert: createExpertMutation.mutateAsync,
    isCreatingExpert: createExpertMutation.isPending,

    updateExpert: updateExpertMutation.mutateAsync,
    isUpdatingExpert: updateExpertMutation.isPending,
  };
}
