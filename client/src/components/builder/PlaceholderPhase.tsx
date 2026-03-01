import { Construction } from 'lucide-react';

interface PlaceholderPhaseProps {
  label: string;
}

export function PlaceholderPhase({ label }: PlaceholderPhaseProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Construction size={32} className="text-muted-foreground/30 mb-3" />
      <h3 className="text-lg font-semibold text-foreground mb-1">{label}</h3>
      <p className="text-muted-foreground text-sm max-w-md">
        This phase is under construction. Content and tools for this step are coming soon.
      </p>
    </div>
  );
}
