import { Plus, Users } from 'lucide-react';
import type { BrainliftData } from '@shared/schema';
import { useBuilder } from '@/hooks/useBuilder';
import { useExperts } from '@/hooks/useExperts';
import { ExpertCard } from './ExpertCard';
import { TactileButton } from '@/components/ui/tactile-button';

interface ExpertsPhaseProps {
  data: BrainliftData;
  slug: string;
}

export function ExpertsPhase({ data, slug }: ExpertsPhaseProps) {
  const { createExpert, isCreatingExpert, updateExpert } = useBuilder(slug);
  const { toggleFollow, deleteExpert } = useExperts(slug);

  const experts = data.experts || [];

  const handleAddExpert = async () => {
    await createExpert({ name: '' });
  };

  const handleUpdateExpert = async (id: number, fields: Record<string, any>) => {
    await updateExpert({ id, ...fields });
  };

  const handleDeleteExpert = async (id: number) => {
    await deleteExpert(id);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground m-0">Your Experts</h2>
          <p className="text-muted-foreground text-sm mt-1 m-0">
            Who are the people shaping your understanding of this topic? Add the thinkers, researchers, and practitioners you want to learn from.
          </p>
        </div>
        <TactileButton
          variant="raised"
          onClick={handleAddExpert}
          disabled={isCreatingExpert}
          className="flex items-center gap-1.5"
        >
          <Plus size={14} />
          Add Expert
        </TactileButton>
      </div>

      {experts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-card rounded-lg border border-dashed border-border">
          <Users size={32} className="text-muted-foreground/30 mb-3" />
          <h3 className="text-base font-semibold text-foreground mb-1">No experts yet</h3>
          <p className="text-muted-foreground text-sm max-w-md mb-4">
            Add the people who inform your thinking on this topic. For each expert, describe who they are, what they focus on, and why they matter to your BrainLift.
          </p>
          <TactileButton
            variant="raised"
            onClick={handleAddExpert}
            disabled={isCreatingExpert}
            className="flex items-center gap-1.5"
          >
            <Plus size={14} />
            Add Your First Expert
          </TactileButton>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {experts.map((expert) => (
            <ExpertCard
              key={expert.id}
              expert={expert}
              onUpdate={handleUpdateExpert}
              onDelete={handleDeleteExpert}
              onToggleFollow={toggleFollow}
            />
          ))}
        </div>
      )}
    </div>
  );
}
