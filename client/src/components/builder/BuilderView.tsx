import { useMemo, useCallback } from 'react';
import { useSearch } from 'wouter';
import { CheckCircle2, Lock } from 'lucide-react';
import type { BrainliftData } from '@shared/schema';
import { PurposePhase } from './PurposePhase';
import { ExpertsPhase } from './ExpertsPhase';

const PHASES = [
  { id: 1, label: 'You & Your Purpose' },
  { id: 2, label: 'Your Experts' },
  { id: 3, label: 'Your Sources' },
  { id: 4, label: 'Your Facts' },
  { id: 5, label: 'Your Summaries' },
  { id: 6, label: 'Your Insights' },
] as const;

interface BuilderViewProps {
  data: BrainliftData;
  slug: string;
}

export function BuilderView({ data, slug }: BuilderViewProps) {
  const searchString = useSearch();

  const activePhase = useMemo(() => {
    const params = new URLSearchParams(searchString);
    const phase = parseInt(params.get('phase') || '1', 10);
    return phase >= 1 && phase <= 6 ? phase : 1;
  }, [searchString]);

  const setActivePhase = useCallback((phase: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set('phase', String(phase));
    params.set('mode', 'build');
    const newUrl = `?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  return (
    <div className="flex gap-6 min-h-[600px]">
      {/* Phase sidebar */}
      <nav className="w-56 shrink-0">
        <div className="text-[11px] uppercase tracking-[0.15em] font-semibold text-muted-foreground mb-3 px-3">
          Build Phases
        </div>
        <ul className="list-none p-0 m-0 flex flex-col gap-0.5">
          {PHASES.map((phase) => {
            const isActive = activePhase === phase.id;
            const isLocked = phase.id > 2;
            return (
              <li key={phase.id}>
                <button
                  onClick={() => !isLocked && setActivePhase(phase.id)}
                  disabled={isLocked}
                  className={`w-full text-left px-3 py-2.5 rounded-md text-[13px] font-medium transition-colors border-none cursor-pointer flex items-center gap-2 ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : isLocked
                        ? 'bg-transparent text-muted-foreground/50 cursor-not-allowed'
                        : 'bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  <span className="text-[11px] font-bold w-5 text-center shrink-0">{phase.id}</span>
                  <span className="flex-1">{phase.label}</span>
                  {isLocked && <Lock size={12} className="shrink-0 opacity-40" />}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Phase content */}
      <div className="flex-1 min-w-0">
        {activePhase === 1 && (
          <PurposePhase data={data} slug={slug} />
        )}
        {activePhase === 2 && (
          <ExpertsPhase data={data} slug={slug} />
        )}
        {activePhase >= 3 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Lock size={32} className="text-muted-foreground/30 mb-3" />
            <h3 className="text-lg font-semibold text-foreground mb-1">
              {PHASES.find(p => p.id === activePhase)?.label}
            </h3>
            <p className="text-muted-foreground text-sm max-w-md">
              This phase is coming soon. Complete the earlier phases first to unlock.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
