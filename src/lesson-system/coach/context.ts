import type { FieldDefinition, LessonDefinition, LessonState } from '../types';
import { loadPhase, phaseOf, schemaFor } from '../registry';
import { isComplete, normalizeState } from '../state';
import curriculum from '../../data/curriculum.json';

/** What the coach needs from a lesson. Orientation (number 0) supplies the same shape. */
export type CoachLesson = Pick<LessonDefinition, 'number' | 'title' | 'fields'> & { hero: Pick<LessonDefinition['hero'], 'eyebrow' | 'intro' | 'meta'> };

/** Compact course map (phases, modules, lesson ranges) so the coach can explain how work connects. */
export const courseOutline = () => curriculum.phases.map((p, i) => `Phase ${p.id} ${p.title} (Lessons ${i * 20 + 1}–${i * 20 + 20}): ${p.modules.join('; ')}`).join('\n');

export type Answer = { label: string; value: string };
export type EarlierLesson = { number: number; title: string; complete: boolean; answers: Answer[] };

export const MAX_EARLIER = 8;
const PHASES = ['Orientation', 'Discover', 'Validate', 'Build', 'Launch', 'Scale'];

/**
 * Earlier lessons whose work this lesson builds on: the "Recommended: Lessons 73, 76, 81–89" header
 * plus the immediately preceding lesson. Most recent first, capped so the prompt stays small.
 */
export function relatedLessons(meta: string | undefined, n: number, max = MAX_EARLIER): number[] {
  const found = new Set<number>();
  const rec = /(?:Recommended|Review)[^·]*$/i.exec(meta ?? '')?.[0].replace(/Module\s+\d+(?:\.\d+)?/gi, '') ?? '';
  for (const [, a, b] of rec.matchAll(/(\d+)(?:\s*[–-]\s*(\d+))?/g)) {
    const from = Number(a), to = b ? Number(b) : from;
    for (let i = Math.min(from, to); i <= Math.max(from, to); i++) found.add(i);
  }
  if (n > 1) found.add(n - 1);
  return [...found].filter(i => i >= 1 && i < n).sort((x, y) => y - x).slice(0, max);
}

/** Field answers as label/value pairs, using option labels for selects. Empty answers are skipped. */
export function answersFor(fields: FieldDefinition[], values: Record<string, string>): Answer[] {
  return fields.flatMap(f => {
    const raw = values[f.id]?.trim();
    if (!raw) return [];
    const value = f.kind === 'select' ? f.options?.find(o => o.value === raw)?.label ?? raw : raw;
    return [{ label: f.label, value }];
  });
}

const readSaved = (key: string): unknown => { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; } };

/** Saved work from related earlier lessons in this browser. Lessons with no answers are left out. */
export async function earlierWork(lesson: CoachLesson): Promise<EarlierLesson[]> {
  const result: EarlierLesson[] = [];
  for (const m of relatedLessons(lesson.hero.meta, lesson.number)) {
    const schema = schemaFor(m);
    const state = normalizeState(readSaved(schema.key));
    if (!Object.values(state.fields).some(v => v?.trim())) continue;
    const def = await (await loadPhase(phaseOf(m))).loadLesson(m);
    const answers = answersFor(def.fields, state.fields);
    if (answers.length) result.push({ number: m, title: def.title, complete: isComplete(state, schema), answers });
  }
  return result;
}

/** The orientation founder profile as question/answer pairs (stored as option indexes). */
export async function founderProfile(): Promise<Answer[]> {
  const saved = readSaved('lynq.orientation.v1') as { answers?: Record<string, unknown> };
  const answers = saved?.answers ?? {};
  if (!Object.keys(answers).length) return [];
  const { profile } = (await import('../../data/native-lessons.json')).default as unknown as { profile: [string, string[]][] };
  return profile.flatMap(([question, options], i) => {
    const pick = Number(answers[i]);
    return Number.isInteger(pick) && options[pick] ? [{ label: question, value: options[pick] }] : [];
  });
}

export async function buildCoachContext(lesson: CoachLesson, state: Pick<LessonState, 'fields'>) {
  const [earlier, profile] = await Promise.all([earlierWork(lesson), founderProfile()]);
  return {
    lesson: { number: lesson.number, title: lesson.title, phase: PHASES[phaseOf(lesson.number)], module: lesson.hero.eyebrow.split(' · Lesson')[0], intro: lesson.hero.intro },
    profile,
    current: answersFor(lesson.fields, state.fields),
    earlier,
    course: courseOutline(),
  };
}
