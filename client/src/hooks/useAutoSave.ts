import { useState, useRef, useCallback } from 'react';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutoSaveOptions {
  onSave: (data: any) => Promise<void>;
  debounceMs?: number;
}

export function useAutoSave({ onSave, debounceMs = 1500 }: UseAutoSaveOptions) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSave = useCallback(async (data: any) => {
    setSaveStatus('saving');
    try {
      await onSave(data);
      setSaveStatus('saved');
      // Reset to idle after 2s
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    }
  }, [onSave]);

  const triggerSave = useCallback((data: any) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSave(data), debounceMs);
  }, [doSave, debounceMs]);

  const saveImmediately = useCallback((data: any) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    doSave(data);
  }, [doSave]);

  return { saveStatus, triggerSave, saveImmediately };
}
