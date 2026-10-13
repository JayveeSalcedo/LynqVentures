import { useState } from 'react';
import type { LessonSchema, LessonState } from './types';
import { applyEdit, markComplete, normalizeState } from './state';

type Options = { schema: LessonSchema; revokeOnAnyEdit: boolean; normalizeExtra?: (raw: Record<string, unknown>) => Record<string, unknown>; onProgress: () => void };

function read(key: string): { value: unknown; error: boolean } {
  try { return { value: JSON.parse(localStorage.getItem(key) || '{}'), error: false }; } catch { return { value: {}, error: true }; }
}

const OK = 'Local autosave · this browser only';

/** Load, edit and persist one lesson record under its original localStorage key. */
export function useLessonState({ schema, revokeOnAnyEdit, normalizeExtra, onProgress }: Options) {
  const [initial] = useState(() => read(schema.key));
  const [state, setState] = useState<LessonState>(() => normalizeState(initial.value, normalizeExtra));
  const [saveStatus, setSaveStatus] = useState(initial.error ? 'Saved draft could not be read. Download a copy of your work before leaving.' : OK);
  const [notice, setNotice] = useState('');

  function persist(next: LessonState): boolean {
    setState(next);
    try {
      localStorage.setItem(schema.key, JSON.stringify(next));
      setSaveStatus('Saved in this browser only.');
      onProgress();
      return true;
    } catch {
      setSaveStatus('Browser storage unavailable. Work is in memory only; download before closing.');
      return false;
    }
  }

  function update(patch: Partial<LessonState>) {
    const next = applyEdit(state, patch, schema, revokeOnAnyEdit);
    setNotice(state.completed && !next.completed ? 'Draft changed; completion must be confirmed again.' : '');
    persist(next);
  }

  /** Explicit completion. Returns false (and leaves the record unchanged) when requirements are unmet. */
  function complete(): boolean {
    const next = markComplete(state, schema);
    if (!next) return false;
    if (!persist(next)) { setState(state); return false; }
    return true;
  }

  function reset(blank: LessonState) { persist(blank); setNotice(''); }

  return { state, update, complete, reset, saveStatus, notice, setNotice };
}
