import curriculum from './data/curriculum.json';
import { isComplete, normalizeState } from './lesson-system/state';
import type { LessonSchema } from './lesson-system/types';

type Saved = { completed?: boolean; studied?: boolean; honest?: boolean; fields?: Record<string, unknown>; answers?: Record<number, unknown>; profileCompleted?: boolean };
function read(key: string): Saved {
  try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { return {}; }
}
const fieldsFilled = (s: Saved, ids: string[]) => ids.every(id => typeof s.fields?.[id] === 'string' && (s.fields[id] as string).trim().length > 0);
const correct = (s: Saved, keys: number[]) => keys.every((answer, i) => s.answers?.[i] !== undefined && Number(s.answers[i]) === answer);
export const orientationFieldIds = ['orientationPain', 'orientationUnknown', 'orientationNext', 'orientationBias', 'orientationCounter', 'orientationConstraint'];

/** Completion as recorded in this browser, re-validated against each lesson's completion contract. */
export function readProgress() {
  const complete = Object.entries(curriculum.schemas as Record<string, LessonSchema>)
    .filter(([, schema]) => isComplete(normalizeState(read(schema.key)), schema))
    .map(([n]) => Number(n));
  const profile = read('lynq.orientation.v1'), lesson = read('lynq.orientation.lesson.v1');
  const orientation = profile.completed === true && profile.profileCompleted === true
    && [5, 3, 8, 6, 3].every((limit, i) => Number.isInteger(profile.answers?.[i]) && Number(profile.answers?.[i]) >= 0 && Number(profile.answers?.[i]) < limit)
    && lesson.studied === true && lesson.honest === true && fieldsFilled(lesson, orientationFieldIds) && correct(lesson, [1, 0, 2]);
  return { complete, orientation };
}
export type Progress = ReturnType<typeof readProgress>;

/** Graduation requires orientation plus all 100 lessons self-completed. It is learning completion only. */
export function graduationStatus(progress: Progress) {
  const missing = Array.from({ length: 100 }, (_, i) => i + 1).filter(n => !progress.complete.includes(n));
  return { count: progress.complete.length, missing, orientation: progress.orientation, eligible: progress.orientation && missing.length === 0 };
}
