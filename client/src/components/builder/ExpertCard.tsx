import { useState, useCallback } from 'react';
import { Trash2, Eye, EyeOff, Check, Loader2 } from 'lucide-react';
import type { Expert } from '@shared/schema';
import { useAutoSave } from '@/hooks/useAutoSave';

interface ExpertCardProps {
  expert: Expert;
  onUpdate: (id: number, fields: Record<string, any>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onToggleFollow: (params: { expertId: number; isFollowing: boolean }) => Promise<void>;
}

const FIELDS: { key: keyof Pick<Expert, 'who' | 'focus' | 'why' | 'where'>; label: string; placeholder: string }[] = [
  { key: 'who', label: 'Who', placeholder: 'Credentials, background...' },
  { key: 'focus', label: 'Focus', placeholder: 'Areas of expertise...' },
  { key: 'why', label: 'Why', placeholder: 'Relevance to your BrainLift...' },
  { key: 'where', label: 'Where', placeholder: 'Twitter, website, publications...' },
];

export function ExpertCard({ expert, onUpdate, onDelete, onToggleFollow }: ExpertCardProps) {
  const [name, setName] = useState(expert.name);
  const [fields, setFields] = useState({
    who: expert.who || '',
    focus: expert.focus || '',
    why: expert.why || '',
    where: expert.where || '',
  });

  const handleSave = useCallback(async (data: Record<string, any>) => {
    await onUpdate(expert.id, data);
  }, [expert.id, onUpdate]);

  const { saveStatus, triggerSave, saveImmediately } = useAutoSave({ onSave: handleSave });

  const handleNameBlur = () => {
    if (name.trim() && name !== expert.name) {
      saveImmediately({ name: name.trim() });
    }
  };

  const handleFieldChange = (key: string, value: string) => {
    setFields(prev => ({ ...prev, [key]: value }));
    triggerSave({ [key]: value });
  };

  const handleFieldBlur = (key: string, value: string) => {
    saveImmediately({ [key]: value });
  };

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      {/* Header: Name + actions */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            placeholder="Expert name"
            className="w-full text-base font-semibold text-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground/50 p-0"
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Save indicator */}
          {saveStatus === 'saving' && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
          {saveStatus === 'saved' && <Check size={12} className="text-success" />}

          {/* Follow toggle */}
          <button
            onClick={() => onToggleFollow({ expertId: expert.id, isFollowing: !expert.isFollowing })}
            className="p-1.5 rounded-md bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
            title={expert.isFollowing ? 'Unfollow' : 'Follow'}
          >
            {expert.isFollowing ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>

          {/* Delete */}
          <button
            onClick={() => onDelete(expert.id)}
            className="p-1.5 rounded-md bg-transparent border-none cursor-pointer text-muted-foreground hover:text-destructive transition-colors"
            title="Delete expert"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Editable fields */}
      <div className="flex flex-col gap-2">
        {FIELDS.map(({ key, label, placeholder }) => (
          <div key={key} className="flex items-start gap-2">
            <span className="text-[11px] uppercase tracking-[0.1em] font-semibold text-muted-foreground w-12 shrink-0 pt-1.5">
              {label}
            </span>
            <input
              value={fields[key]}
              onChange={(e) => handleFieldChange(key, e.target.value)}
              onBlur={() => handleFieldBlur(key, fields[key])}
              placeholder={placeholder}
              className="flex-1 text-[13px] text-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground/40 py-1 px-0"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
