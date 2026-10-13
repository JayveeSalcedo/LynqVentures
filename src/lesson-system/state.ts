import type { ChecklistItem, LessonSchema, LessonState } from './types';

const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export const blankState = (): LessonState => ({ fields: {}, answers: {}, studied: false, honest: false, completed: false });

const core = new Set(['fields', 'answers', 'studied', 'honest', 'completed', 'artifactReady', 'releaseAck50']);

/**
 * Normalise a saved lesson record. Core keys are type-checked; malformed values are dropped
 * rather than trusted. Lesson-specific keys (row logs, calculator inputs) are passed through
 * `normalizeExtra` when provided, otherwise preserved as-is so no saved work is lost.
 */
export function normalizeState(raw: unknown, normalizeExtra?: (raw: Record<string, unknown>) => Record<string, unknown>): LessonState {
  const value = object(raw);
  const extraRaw = Object.fromEntries(Object.entries(value).filter(([k]) => !core.has(k)));
  const extra = normalizeExtra ? normalizeExtra(extraRaw) : extraRaw;
  const state: LessonState = {
    ...extra,
    fields: Object.fromEntries(Object.entries(object(value.fields)).filter(([, v]) => typeof v === 'string')) as Record<string, string>,
    answers: Object.fromEntries(Object.entries(object(value.answers))
      .filter(([, v]) => (typeof v === 'number' || typeof v === 'string' && v.trim() !== '') && Number.isInteger(Number(v)) && Number(v) >= 0)
      .map(([k, v]) => [k, Number(v)])),
    studied: value.studied === true,
    honest: value.honest === true,
    completed: value.completed === true,
  };
  if ('artifactReady' in value) state.artifactReady = value.artifactReady === true;
  if ('releaseAck50' in value) state.releaseAck50 = value.releaseAck50 === true;
  return state;
}

export const filled = (state: LessonState, id: string) => typeof state.fields[id] === 'string' && state.fields[id].trim().length > 0;
export const fieldsComplete = (state: LessonState, ids: string[]) => ids.every(id => filled(state, id));
export const quizCorrect = (state: LessonState, keys: number[]) => keys.every((answer, i) => state.answers[i] !== undefined && Number(state.answers[i]) === answer);
export const missingCount = (state: LessonState, ids: string[]) => ids.filter(id => !filled(state, id)).length;

/** The exact completion contract from the source curriculum (studied, honest, fields, quiz, flags). */
export function requirementsMet(state: LessonState, schema: LessonSchema): boolean {
  return state.studied === true && state.honest === true && fieldsComplete(state, schema.ids) && quizCorrect(state, schema.keys)
    && (!schema.artifact || state.artifactReady === true) && (!schema.releaseAck || state.releaseAck50 === true);
}

/** Completion is explicit: a saved `completed` flag only counts while the requirements hold. */
export const isComplete = (state: LessonState, schema: LessonSchema) => state.completed === true && requirementsMet(state, schema);

/**
 * Apply an edit. Completion is never granted here. It is revoked when the lesson becomes invalid,
 * or on any edit when `revokeOnAnyEdit` is set (the original Scale behaviour).
 */
export function applyEdit(state: LessonState, patch: Partial<LessonState>, schema: LessonSchema, revokeOnAnyEdit: boolean): LessonState {
  const next = { ...state, ...patch } as LessonState;
  const keepCompleted = state.completed && !revokeOnAnyEdit && requirementsMet(next, schema);
  return { ...next, completed: keepCompleted };
}

/** Explicit completion request. Returns null when the requirements are not met. */
export function markComplete(state: LessonState, schema: LessonSchema): LessonState | null {
  return requirementsMet(state, schema) ? { ...state, completed: true } : null;
}

export function checklistStatus(items: ChecklistItem[], state: LessonState, schema: LessonSchema): [string, boolean][] {
  return items.map(item => {
    switch (item.kind) {
      case 'studied': return [item.label, state.studied];
      case 'honest': return [item.label, state.honest];
      case 'quiz': return [item.label, quizCorrect(state, schema.keys)];
      case 'fields': return [item.label, fieldsComplete(state, item.ids)];
      case 'flag': return [item.label, state[item.flag] === true];
    }
  });
}

export const fillTemplate = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (match, key) => key in values ? String(values[key]) : match);
