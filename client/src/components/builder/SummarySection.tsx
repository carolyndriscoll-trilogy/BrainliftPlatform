import { useState, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { useAutoSave } from '@/hooks/useAutoSave';
import type { BuilderFact, BuilderSummary } from '@shared/schema';

interface SummarySectionProps {
  sourceId: number;
  facts: BuilderFact[];
  summaries: BuilderSummary[];
  onCreateSummary: (data: { sourceId: number; text: string }) => Promise<void>;
  onUpdateSummary: (id: number, fields: { text: string }) => Promise<void>;
  onDeleteSummary: (id: number) => Promise<void>;
}

export function SummarySection({
  sourceId,
  facts,
  summaries,
  onCreateSummary,
  onUpdateSummary,
  onDeleteSummary,
}: SummarySectionProps) {
  const summary = summaries[0]; // One summary per source in this slice
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleStartEditing = () => {
    setDraftText('');
    setIsEditing(true);
  };

  const handleCreateFromDraft = async () => {
    const trimmed = draftText.trim();
    if (!trimmed || isCreating) return;
    setIsCreating(true);
    try {
      await onCreateSummary({ sourceId, text: trimmed });
      setIsEditing(false);
      setDraftText('');
    } finally {
      setIsCreating(false);
    }
  };

  if (!summary && !isEditing) {
    return (
      <div className="border-l-2 border-l-dok2 pl-3 py-2">
        <button
          onClick={handleStartEditing}
          className="flex items-center gap-1.5 text-xs text-dok2 hover:text-dok2/80 bg-transparent border-none cursor-pointer font-medium"
        >
          Add Your Take
        </button>
      </div>
    );
  }

  if (!summary && isEditing) {
    return (
      <div className="border-l-2 border-l-dok2 pl-3 py-2 space-y-2">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-dok2">Your Take</span>
        {facts.length > 0 && (
          <div className="text-[11px] text-muted-foreground space-y-0.5 mb-1">
            {facts.map((f) => (
              <div key={f.id} className="flex gap-1">
                <span className="text-dok1 shrink-0">&bull;</span>
                <span className="truncate">{f.text}</span>
              </div>
            ))}
          </div>
        )}
        <textarea
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          onBlur={() => {
            if (draftText.trim()) {
              handleCreateFromDraft();
            } else {
              setIsEditing(false);
            }
          }}
          autoFocus
          placeholder="Summarize what you've learned from this source in your own words..."
          rows={3}
          className="w-full bg-transparent border border-border rounded-md text-sm text-foreground px-2 py-1.5 focus:outline-none focus:border-dok2 transition-colors resize-y placeholder:text-muted-foreground/50"
        />
      </div>
    );
  }

  return (
    <div className="border-l-2 border-l-dok2 pl-3 py-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-dok2">Your Take</span>
        <button
          onClick={() => onDeleteSummary(summary!.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-destructive bg-transparent border-none cursor-pointer"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Show facts as context */}
      {facts.length > 0 && (
        <div className="text-[11px] text-muted-foreground space-y-0.5 mb-1">
          {facts.map((f) => (
            <div key={f.id} className="flex gap-1">
              <span className="text-dok1 shrink-0">&bull;</span>
              <span className="truncate">{f.text}</span>
            </div>
          ))}
        </div>
      )}

      <SummaryTextarea
        summary={summary!}
        onUpdate={onUpdateSummary}
      />
    </div>
  );
}

function SummaryTextarea({
  summary,
  onUpdate,
}: {
  summary: BuilderSummary;
  onUpdate: (id: number, fields: { text: string }) => Promise<void>;
}) {
  const [text, setText] = useState(summary.text);

  const handleSave = useCallback(async (data: { text: string }) => {
    if (data.text !== summary.text) {
      await onUpdate(summary.id, data);
    }
  }, [summary.id, summary.text, onUpdate]);

  const { triggerSave, saveImmediately } = useAutoSave({
    onSave: handleSave,
    debounceMs: 1500,
  });

  const handleChange = (value: string) => {
    setText(value);
    triggerSave({ text: value });
  };

  return (
    <textarea
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={() => saveImmediately({ text })}
      placeholder="Summarize what you've learned from this source in your own words..."
      rows={3}
      className="w-full bg-transparent border border-border rounded-md text-sm text-foreground px-2 py-1.5 focus:outline-none focus:border-dok2 transition-colors resize-y placeholder:text-muted-foreground/50"
    />
  );
}
