import { useState, useCallback } from 'react';
import { Sparkles, Check, Loader2, Pencil } from 'lucide-react';
import type { BrainliftData } from '@shared/schema';
import { useBuilder } from '@/hooks/useBuilder';
import { useAutoSave } from '@/hooks/useAutoSave';
import { TactileButton } from '@/components/ui/tactile-button';

interface PurposePhaseProps {
  data: BrainliftData;
  slug: string;
}

export function PurposePhase({ data, slug }: PurposePhaseProps) {
  const [whatLearning, setWhatLearning] = useState(data.purposeWhatLearning || '');
  const [whyMatters, setWhyMatters] = useState(data.purposeWhyMatters || '');
  const [whatAbleToDo, setWhatAbleToDo] = useState(data.purposeWhatAbleToDo || '');
  const [synthesized, setSynthesized] = useState(data.displayPurpose || '');
  const [editingSynthesized, setEditingSynthesized] = useState(false);

  const { updatePurpose, synthesizePurpose, isSynthesizing } = useBuilder(slug);

  const handleSave = useCallback(async (fields: Record<string, string>) => {
    await updatePurpose(fields);
  }, [updatePurpose]);

  const { saveStatus, triggerSave, saveImmediately } = useAutoSave({
    onSave: handleSave,
  });

  const handleFieldChange = (field: string, value: string, setter: (v: string) => void) => {
    setter(value);
    triggerSave({ [field]: value });
  };

  const handleFieldBlur = (field: string, value: string) => {
    saveImmediately({ [field]: value });
  };

  const handleSynthesize = async () => {
    if (!whatLearning && !whyMatters && !whatAbleToDo) return;
    const result = await synthesizePurpose({ whatLearning, whyMatters, whatAbleToDo });
    setSynthesized(result.purpose);
    setEditingSynthesized(false);
  };

  const handleSaveSynthesized = async () => {
    await updatePurpose({ displayPurpose: synthesized });
    setEditingSynthesized(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground m-0">You & Your Purpose</h2>
          <p className="text-muted-foreground text-sm mt-1 m-0">
            What are you trying to learn and why? These prompts help define the lens through which your BrainLift is built.
          </p>
        </div>
        <SaveIndicator status={saveStatus} />
      </div>

      <div className="flex flex-col gap-5">
        {/* What I'm trying to learn */}
        <PromptCard
          label="What I'm trying to learn"
          placeholder="Describe the subject or question you're exploring..."
          value={whatLearning}
          onChange={(v) => handleFieldChange('purposeWhatLearning', v, setWhatLearning)}
          onBlur={() => handleFieldBlur('purposeWhatLearning', whatLearning)}
        />

        {/* Why it matters to me */}
        <PromptCard
          label="Why it matters to me"
          placeholder="Why is this important to you personally or professionally?"
          value={whyMatters}
          onChange={(v) => handleFieldChange('purposeWhyMatters', v, setWhyMatters)}
          onBlur={() => handleFieldBlur('purposeWhyMatters', whyMatters)}
        />

        {/* What I want to be able to do */}
        <PromptCard
          label="What I want to be able to do"
          placeholder="What outcome or capability are you working toward?"
          value={whatAbleToDo}
          onChange={(v) => handleFieldChange('purposeWhatAbleToDo', v, setWhatAbleToDo)}
          onBlur={() => handleFieldBlur('purposeWhatAbleToDo', whatAbleToDo)}
        />
      </div>

      {/* Synthesize Button */}
      <div className="mt-6">
        <TactileButton
          variant="raised"
          onClick={handleSynthesize}
          disabled={isSynthesizing || (!whatLearning && !whyMatters && !whatAbleToDo)}
          className="flex items-center gap-2"
        >
          {isSynthesizing ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          {isSynthesizing ? 'Synthesizing...' : 'Synthesize Purpose'}
        </TactileButton>
      </div>

      {/* Synthesized Purpose Display */}
      {synthesized && (
        <div className="mt-5 bg-card rounded-lg border border-border p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-[0.15em] font-semibold text-muted-foreground">
              Your Purpose Statement
            </span>
            <button
              onClick={() => setEditingSynthesized(!editingSynthesized)}
              className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none cursor-pointer"
            >
              <Pencil size={12} />
              Edit
            </button>
          </div>
          {editingSynthesized ? (
            <div>
              <textarea
                value={synthesized}
                onChange={(e) => setSynthesized(e.target.value)}
                className="w-full p-3 rounded-md text-sm bg-background border border-border text-foreground resize-none outline-none focus:border-primary/50"
                rows={3}
              />
              <div className="flex gap-2 mt-2 justify-end">
                <button
                  onClick={() => setEditingSynthesized(false)}
                  className="text-[12px] text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer"
                >
                  Cancel
                </button>
                <TactileButton variant="raised" onClick={handleSaveSynthesized} className="text-[12px] px-3 py-1.5">
                  Save
                </TactileButton>
              </div>
            </div>
          ) : (
            <p className="text-foreground text-[15px] leading-relaxed m-0">{synthesized}</p>
          )}
        </div>
      )}
    </div>
  );
}

function PromptCard({
  label,
  placeholder,
  value,
  onChange,
  onBlur,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <label className="block text-[13px] font-semibold text-foreground mb-2">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        rows={3}
        className="w-full p-3 rounded-md text-sm bg-background border border-border text-foreground placeholder:text-muted-foreground/60 resize-none outline-none focus:border-primary/50 transition-colors"
      />
    </div>
  );
}

function SaveIndicator({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (status === 'idle') return null;

  return (
    <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
      {status === 'saving' && (
        <>
          <Loader2 size={12} className="animate-spin" />
          Saving...
        </>
      )}
      {status === 'saved' && (
        <>
          <Check size={12} className="text-success" />
          Saved
        </>
      )}
      {status === 'error' && (
        <span className="text-destructive">Save failed</span>
      )}
    </span>
  );
}
