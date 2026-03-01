import { useState, useCallback } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { useAutoSave } from '@/hooks/useAutoSave';
import { SourceCard } from './SourceCard';
import { TactileButton } from '@/components/ui/tactile-button';
import type { BuilderCategory, BuilderSource, BuilderFact, BuilderSummary } from '@shared/schema';

type EnrichedSource = BuilderSource & { facts: BuilderFact[]; summaries: BuilderSummary[] };

interface CategoryCardProps {
  category: BuilderCategory & { sources: EnrichedSource[] };
  onUpdateCategory: (id: number, fields: { name: string }) => Promise<void>;
  onDeleteCategory: (id: number) => Promise<void>;
  onCreateSource: (data: { categoryId: number; title: string; url?: string }) => Promise<void>;
  onUpdateSource: (id: number, fields: { title?: string; url?: string }) => Promise<void>;
  onDeleteSource: (id: number) => Promise<void>;
  onCreateFact: (data: { sourceId: number; text: string }) => Promise<void>;
  onUpdateFact: (id: number, fields: { text: string }) => Promise<void>;
  onDeleteFact: (id: number) => Promise<void>;
  onCreateSummary: (data: { sourceId: number; text: string }) => Promise<void>;
  onUpdateSummary: (id: number, fields: { text: string }) => Promise<void>;
  onDeleteSummary: (id: number) => Promise<void>;
}

export function CategoryCard({
  category,
  onUpdateCategory,
  onDeleteCategory,
  onCreateSource,
  onUpdateSource,
  onDeleteSource,
  onCreateFact,
  onUpdateFact,
  onDeleteFact,
  onCreateSummary,
  onUpdateSummary,
  onDeleteSummary,
}: CategoryCardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [name, setName] = useState(category.name);

  const handleSave = useCallback(async (data: { name: string }) => {
    if (data.name.trim() && data.name !== category.name) {
      await onUpdateCategory(category.id, { name: data.name });
    }
  }, [category.id, category.name, onUpdateCategory]);

  const { triggerSave, saveImmediately } = useAutoSave({
    onSave: handleSave,
    debounceMs: 1500,
  });

  const handleAddSource = async () => {
    await onCreateSource({ categoryId: category.id, title: 'New Source' });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border-l-4 border-l-dok2 rounded-lg bg-card-elevated border border-border overflow-hidden">
        {/* Trigger / Header */}
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors group">
            <ChevronDown
              size={16}
              className={`text-muted-foreground transition-transform shrink-0 ${isOpen ? '' : '-rotate-90'}`}
            />
            <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  triggerSave({ name: e.target.value });
                }}
                onBlur={() => saveImmediately({ name })}
                placeholder="Category name..."
                className="w-full bg-transparent text-base font-semibold text-foreground border-none outline-none placeholder:text-muted-foreground/50"
              />
            </div>
            <span className="text-[11px] text-muted-foreground/60 shrink-0">
              {category.sources.length} source{category.sources.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteCategory(category.id);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-destructive bg-transparent border-none cursor-pointer shrink-0"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </CollapsibleTrigger>

        {/* Content */}
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-3">
            {category.sources.length === 0 ? (
              <p className="text-sm text-muted-foreground/60 italic m-0 py-2">
                No sources yet. Add a source by title or URL.
              </p>
            ) : (
              category.sources.map((source) => (
                <SourceCard
                  key={source.id}
                  source={source}
                  onUpdateSource={onUpdateSource}
                  onDeleteSource={onDeleteSource}
                  onCreateFact={onCreateFact}
                  onUpdateFact={onUpdateFact}
                  onDeleteFact={onDeleteFact}
                  onCreateSummary={onCreateSummary}
                  onUpdateSummary={onUpdateSummary}
                  onDeleteSummary={onDeleteSummary}
                />
              ))
            )}

            <TactileButton
              variant="flat"
              onClick={handleAddSource}
              className="flex items-center gap-1.5 text-xs"
            >
              <Plus size={13} />
              Add Source
            </TactileButton>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
