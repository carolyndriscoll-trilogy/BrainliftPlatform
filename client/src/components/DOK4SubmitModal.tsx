import { useState, useMemo } from 'react';
import { X, AlertTriangle, Check } from 'lucide-react';
import type { DOK3InsightWithLinks } from '@/hooks/useDOK3Insights';
import { tokens } from '@/lib/colors';
import { TactileButton } from '@/components/ui/tactile-button';

interface DOK2SummaryRef {
  id: number;
  sourceName: string;
  sourceUrl: string | null;
  displayTitle: string | null;
  category: string;
  grade: number | null;
}

interface DOK4SubmitModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (params: {
    text: string;
    dok3InsightIds: number[];
    primaryDok3Id: number;
    dok2SummaryIds: number[];
  }) => Promise<{ accept: boolean; rejection_reason?: string }>;
  isSubmitting: boolean;
  insights: DOK3InsightWithLinks[];
  dok2Summaries: DOK2SummaryRef[];
}

export function DOK4SubmitModal({
  show,
  onClose,
  onSubmit,
  isSubmitting,
  insights,
  dok2Summaries,
}: DOK4SubmitModalProps) {
  const [text, setText] = useState('');
  const [selectedDok3Ids, setSelectedDok3Ids] = useState<number[]>([]);
  const [primaryDok3Id, setPrimaryDok3Id] = useState<number | null>(null);
  const [selectedDok2Ids, setSelectedDok2Ids] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Only show graded insights as options
  const gradedInsights = useMemo(
    () => insights.filter(i => i.status === 'graded'),
    [insights],
  );

  // Group DOK2 summaries by source for multi-source validation
  const dok2BySource = useMemo(() => {
    const map = new Map<string, DOK2SummaryRef[]>();
    for (const s of dok2Summaries) {
      const key = s.sourceName.toLowerCase().trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [dok2Summaries]);

  // Count unique sources in selected DOK2s
  const selectedSourceCount = useMemo(() => {
    const sources = new Set<string>();
    for (const id of selectedDok2Ids) {
      const s = dok2Summaries.find(d => d.id === id);
      if (s) sources.add(s.sourceName.toLowerCase().trim());
    }
    return sources.size;
  }, [selectedDok2Ids, dok2Summaries]);

  const canSubmit = text.trim().length >= 10 &&
    selectedDok3Ids.length >= 1 &&
    primaryDok3Id !== null &&
    selectedDok2Ids.length >= 2 &&
    selectedSourceCount >= 2 &&
    !isSubmitting;

  const toggleDok3 = (id: number) => {
    setSelectedDok3Ids(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      // If primary is deselected, clear it
      if (!next.includes(primaryDok3Id!)) {
        setPrimaryDok3Id(next.length > 0 ? next[0] : null);
      }
      return next;
    });
  };

  const toggleDok2 = (id: number) => {
    setSelectedDok2Ids(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit || primaryDok3Id === null) return;
    setError(null);

    try {
      const result = await onSubmit({
        text: text.trim(),
        dok3InsightIds: selectedDok3Ids,
        primaryDok3Id,
        dok2SummaryIds: selectedDok2Ids,
      });

      if (!result.accept) {
        setError(result.rejection_reason ?? 'Submission rejected');
      } else {
        // Success — close modal and reset
        setText('');
        setSelectedDok3Ids([]);
        setPrimaryDok3Id(null);
        setSelectedDok2Ids([]);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Submission failed');
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-border">
          <h2 className="text-[20px] font-bold text-foreground m-0">Submit Spiky Point of View</h2>
          <button onClick={onClose} className="p-2 bg-transparent border-0 cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="px-8 py-6 space-y-8">
          {/* SPOV Text */}
          <div>
            <label className="block text-[12px] uppercase tracking-[0.2em] font-semibold text-muted-foreground mb-3">
              Your Position
            </label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="State your Spiky Point of View — a clear, defensible, falsifiable position that emerges from your DOK3 framework..."
              className="w-full h-32 p-4 bg-sidebar border border-border rounded-lg text-[14px] text-foreground placeholder:text-muted-light resize-vertical focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="mt-1 text-[11px] text-muted-light">
              {text.trim().length} characters {text.trim().length < 10 && '(minimum 10)'}
            </div>
          </div>

          {/* DOK3 Insight Selection */}
          <div>
            <label className="block text-[12px] uppercase tracking-[0.2em] font-semibold text-muted-foreground mb-3">
              Supporting DOK3 Insights
              <span className="normal-case tracking-normal font-normal text-muted-light ml-2">Select at least one. Click star to set primary.</span>
            </label>
            {gradedInsights.length === 0 ? (
              <p className="text-[13px] text-muted-light italic">No graded DOK3 insights available. Grade your insights first.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {gradedInsights.map(insight => {
                  const isSelected = selectedDok3Ids.includes(insight.id);
                  const isPrimary = primaryDok3Id === insight.id;
                  return (
                    <div
                      key={insight.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-border/80'
                      }`}
                      onClick={() => toggleDok3(insight.id)}
                    >
                      <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary border-primary' : 'border-border'}`}>
                        {isSelected && <Check size={14} className="text-primary-foreground" />}
                      </div>
                      <p className="text-[13px] text-foreground m-0 flex-1 line-clamp-2">{insight.text}</p>
                      {isSelected && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setPrimaryDok3Id(insight.id); }}
                          className={`text-[10px] uppercase tracking-[0.15em] font-semibold px-2 py-1 rounded border-0 cursor-pointer transition-colors ${
                            isPrimary ? 'bg-primary text-primary-foreground' : 'bg-sidebar text-muted-foreground hover:bg-primary/10'
                          }`}
                        >
                          {isPrimary ? 'Primary' : 'Set Primary'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* DOK2 Summary Selection */}
          <div>
            <label className="block text-[12px] uppercase tracking-[0.2em] font-semibold text-muted-foreground mb-3">
              Supporting DOK2 Sources
              <span className="normal-case tracking-normal font-normal text-muted-light ml-2">
                Select at least 2 from different sources ({selectedSourceCount} source{selectedSourceCount !== 1 ? 's' : ''} selected)
              </span>
            </label>
            {dok2Summaries.length === 0 ? (
              <p className="text-[13px] text-muted-light italic">No DOK2 summaries available.</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {Array.from(dok2BySource.entries()).map(([sourceKey, summaries]) => (
                  <div key={sourceKey} className="mb-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-1.5 px-1">
                      {summaries[0].sourceName}
                    </div>
                    {summaries.map(s => {
                      const isSelected = selectedDok2Ids.includes(s.id);
                      return (
                        <div
                          key={s.id}
                          className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                            isSelected ? 'border-primary/50 bg-primary/5' : 'border-transparent hover:bg-sidebar'
                          }`}
                          onClick={() => toggleDok2(s.id)}
                        >
                          <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary border-primary' : 'border-border'}`}>
                            {isSelected && <Check size={14} className="text-primary-foreground" />}
                          </div>
                          <span className="text-[13px] text-foreground flex-1 truncate">
                            {s.displayTitle || s.category}
                          </span>
                          {s.grade !== null && (
                            <span className="text-[11px] text-muted-foreground shrink-0">{s.grade}/5</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
            {selectedDok2Ids.length >= 2 && selectedSourceCount < 2 && (
              <div className="mt-2 flex items-center gap-2 text-[12px] text-warning">
                <AlertTriangle size={14} />
                Select summaries from at least 2 different sources
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-lg border border-warning/50 bg-warning/5">
              <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
              <div>
                <div className="text-[13px] font-semibold text-foreground mb-1">Submission Rejected</div>
                <div className="text-[13px] text-muted-foreground">{error}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-border flex items-center justify-end gap-4">
          <button
            onClick={onClose}
            className="px-6 py-3 text-[13px] text-muted-foreground bg-transparent border border-border rounded-lg cursor-pointer hover:bg-sidebar transition-colors"
          >
            Cancel
          </button>
          <TactileButton
            variant="raised"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-8 py-3 text-[13px]"
          >
            {isSubmitting ? 'Submitting...' : 'Submit SPOV'}
          </TactileButton>
        </div>
      </div>
    </div>
  );
}
