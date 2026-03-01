import { useState, useCallback, useRef } from 'react';
import { ChevronDown, Plus, Trash2, Link as LinkIcon } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { useAutoSave } from '@/hooks/useAutoSave';
import { FactInput } from './FactInput';
import { SummarySection } from './SummarySection';
import type { BuilderSource, BuilderFact, BuilderSummary } from '@shared/schema';

interface SourceCardProps {
  source: BuilderSource & { facts: BuilderFact[]; summaries: BuilderSummary[] };
  onUpdateSource: (id: number, fields: { title?: string; url?: string }) => Promise<void>;
  onDeleteSource: (id: number) => Promise<void>;
  onCreateFact: (data: { sourceId: number; text: string }) => Promise<void>;
  onUpdateFact: (id: number, fields: { text: string }) => Promise<void>;
  onDeleteFact: (id: number) => Promise<void>;
  onCreateSummary: (data: { sourceId: number; text: string }) => Promise<void>;
  onUpdateSummary: (id: number, fields: { text: string }) => Promise<void>;
  onDeleteSummary: (id: number) => Promise<void>;
}

export function SourceCard({
  source,
  onUpdateSource,
  onDeleteSource,
  onCreateFact,
  onUpdateFact,
  onDeleteFact,
  onCreateSummary,
  onUpdateSummary,
  onDeleteSummary,
}: SourceCardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [title, setTitle] = useState(source.title);
  const [url, setUrl] = useState(source.url || '');

  const handleSaveTitle = useCallback(async (data: { title: string }) => {
    if (data.title.trim() && data.title !== source.title) {
      await onUpdateSource(source.id, { title: data.title });
    }
  }, [source.id, source.title, onUpdateSource]);

  const handleSaveUrl = useCallback(async (data: { url: string }) => {
    if (data.url !== (source.url || '')) {
      await onUpdateSource(source.id, { url: data.url || undefined });
    }
  }, [source.id, source.url, onUpdateSource]);

  const { triggerSave: triggerTitleSave, saveImmediately: saveTitleImmediately } = useAutoSave({
    onSave: handleSaveTitle,
    debounceMs: 1500,
  });

  const { triggerSave: triggerUrlSave, saveImmediately: saveUrlImmediately } = useAutoSave({
    onSave: handleSaveUrl,
    debounceMs: 1500,
  });

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border-l-4 border-l-dok1 rounded-md bg-card border border-border overflow-hidden group">
        {/* Trigger / Header */}
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors">
            <ChevronDown
              size={14}
              className={`text-muted-foreground transition-transform shrink-0 ${isOpen ? '' : '-rotate-90'}`}
            />
            <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  triggerTitleSave({ title: e.target.value });
                }}
                onBlur={() => saveTitleImmediately({ title })}
                placeholder="Source title..."
                className="w-full bg-transparent text-sm font-medium text-foreground border-none outline-none placeholder:text-muted-foreground/50"
              />
              <div className="flex items-center gap-1 mt-0.5">
                <LinkIcon size={10} className="text-muted-foreground/40 shrink-0" />
                <input
                  type="text"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    triggerUrlSave({ url: e.target.value });
                  }}
                  onBlur={() => saveUrlImmediately({ url })}
                  placeholder="URL (optional)"
                  className="w-full bg-transparent text-[11px] text-muted-foreground border-none outline-none placeholder:text-muted-foreground/40"
                />
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSource(source.id);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-destructive bg-transparent border-none cursor-pointer shrink-0"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </CollapsibleTrigger>

        {/* Content */}
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-3">
            {/* Facts section */}
            <FactsSection
              sourceId={source.id}
              facts={source.facts}
              onCreateFact={onCreateFact}
              onUpdateFact={onUpdateFact}
              onDeleteFact={onDeleteFact}
            />

            {/* Summary section */}
            <SummarySection
              sourceId={source.id}
              facts={source.facts}
              summaries={source.summaries}
              onCreateSummary={onCreateSummary}
              onUpdateSummary={onUpdateSummary}
              onDeleteSummary={onDeleteSummary}
            />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function FactsSection({
  sourceId,
  facts,
  onCreateFact,
  onUpdateFact,
  onDeleteFact,
}: {
  sourceId: number;
  facts: BuilderFact[];
  onCreateFact: (data: { sourceId: number; text: string }) => Promise<void>;
  onUpdateFact: (id: number, fields: { text: string }) => Promise<void>;
  onDeleteFact: (id: number) => Promise<void>;
}) {
  const [newFactText, setNewFactText] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCreateFact = async () => {
    const trimmed = newFactText.trim();
    if (!trimmed || isCreating) return;
    setIsCreating(true);
    try {
      await onCreateFact({ sourceId, text: trimmed });
      setNewFactText('');
      setTimeout(() => inputRef.current?.focus(), 50);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="border-l-2 border-l-dok1 pl-3 py-2 space-y-2">
      <span className="text-[11px] uppercase tracking-wider font-semibold text-dok1">Facts</span>
      {facts.length === 0 && !newFactText && (
        <p className="text-xs text-muted-foreground/60 italic m-0">
          No facts yet. Add key facts from this source.
        </p>
      )}
      {facts.length > 0 && (
        <div className="space-y-1.5">
          {facts.map((fact) => (
            <FactInput
              key={fact.id}
              fact={fact}
              onUpdate={onUpdateFact}
              onDelete={onDeleteFact}
            />
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={newFactText}
          onChange={(e) => setNewFactText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreateFact();
          }}
          placeholder="Type a fact and press Enter..."
          className="flex-1 bg-transparent border-b border-dashed border-border text-sm text-foreground px-1 py-1.5 focus:outline-none focus:border-dok1 transition-colors placeholder:text-muted-foreground/40"
        />
        {newFactText.trim() && (
          <button
            onClick={handleCreateFact}
            disabled={isCreating}
            className="flex items-center gap-1 text-[11px] text-dok1 hover:text-dok1/80 bg-transparent border-none cursor-pointer font-medium shrink-0"
          >
            <Plus size={12} />
            Add
          </button>
        )}
      </div>
    </div>
  );
}
