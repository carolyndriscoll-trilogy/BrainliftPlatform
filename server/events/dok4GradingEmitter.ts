/**
 * DOK4 Grading Event Emitter
 *
 * Manages real-time event broadcasting for DOK4 grading jobs.
 * Pattern mirrors dok3GradingEmitter.ts.
 */

import type { DOK4GradingStage } from '@shared/import-progress';

export interface DOK4GradingEvent {
  id: string;
  type: DOK4GradingStage;
  submissionId: number;
  brainliftId: number;
  message: string;
  score?: number;
  error?: string;
  timestamp: number;
}

export type DOK4GradingCallback = (event: DOK4GradingEvent) => void;

interface ActiveGrading {
  brainliftId: number;
  subscribers: Set<DOK4GradingCallback>;
  eventCounter: number;
}

const activeGradings = new Map<number, ActiveGrading>();
const pendingSubscribers = new Map<number, Set<DOK4GradingCallback>>();

function generateEventId(brainliftId: number, counter: number): string {
  return `dok4-${brainliftId}-${counter}`;
}

export function startGrading(brainliftId: number): void {
  activeGradings.delete(brainliftId);

  const pending = pendingSubscribers.get(brainliftId);
  const initialSubscribers = pending ? new Set(pending) : new Set<DOK4GradingCallback>();
  pendingSubscribers.delete(brainliftId);

  activeGradings.set(brainliftId, {
    brainliftId,
    subscribers: initialSubscribers,
    eventCounter: 0,
  });
}

export function emitEvent(brainliftId: number, event: Omit<DOK4GradingEvent, 'id' | 'timestamp'>): void {
  const grading = activeGradings.get(brainliftId);
  if (!grading) return;

  const fullEvent: DOK4GradingEvent = {
    ...event,
    id: generateEventId(brainliftId, grading.eventCounter++),
    timestamp: Date.now(),
  };

  for (const callback of Array.from(grading.subscribers)) {
    try {
      callback(fullEvent);
    } catch (err) {
      console.error('[DOK4GradingEmitter] Error in subscriber callback:', err);
    }
  }
}

export function endGrading(brainliftId: number): void {
  const grading = activeGradings.get(brainliftId);
  if (!grading) return;

  emitEvent(brainliftId, {
    type: 'dok4:done',
    submissionId: 0,
    brainliftId,
    message: 'All grading complete',
  });

  setTimeout(() => {
    activeGradings.delete(brainliftId);
  }, 5000);
}

export function subscribe(brainliftId: number, callback: DOK4GradingCallback): () => void {
  const grading = activeGradings.get(brainliftId);

  if (!grading) {
    if (!pendingSubscribers.has(brainliftId)) {
      pendingSubscribers.set(brainliftId, new Set());
    }
    pendingSubscribers.get(brainliftId)!.add(callback);

    return () => {
      const pending = pendingSubscribers.get(brainliftId);
      if (pending) {
        pending.delete(callback);
        if (pending.size === 0) pendingSubscribers.delete(brainliftId);
      }
      const active = activeGradings.get(brainliftId);
      if (active) active.subscribers.delete(callback);
    };
  }

  grading.subscribers.add(callback);

  return () => {
    grading.subscribers.delete(callback);
  };
}

export function isGradingActive(brainliftId: number): boolean {
  return activeGradings.has(brainliftId);
}

export const dok4GradingEmitter = {
  startGrading,
  emitEvent,
  endGrading,
  subscribe,
  isGradingActive,
};
