// Pure Phase 1 (Discover) logic, kept separate from React for testing.
import curriculum from '../../data/curriculum.json';
import type { LessonDefinition, LessonSchema, LessonState } from '../../lesson-system/types';
import { fieldsComplete, fillTemplate, missingCount } from '../../lesson-system/state';

export const schemaOf = (n: number) => (curriculum.schemas as Record<string, LessonSchema>)[String(n)];
const reflections = ['assumption', 'evidence', 'constraint'];
/** Legacy `configs[n].profileIds`: the required worksheet fields excluding the three red-team reflections. */
export const profileIds = (n: number) => schemaOf(n).ids.filter(id => !reflections.includes(id));

/**
 * Legacy loadState() kept only fields/answers/studied/honest/completed; Discover lessons store no
 * structured records, so no extra keys are carried forward.
 */
export const normalizeExtra = (): Record<string, unknown> => ({});

/**
 * Legacy exportProfile(): every lesson field (including optional `support`) in config order,
 * values written as entered (only an empty value becomes "Not entered").
 */
export function buildDeliverable(lesson: LessonDefinition, state: LessonState, complete: boolean, now = new Date()): string {
  const spec = lesson.deliverable;
  let out = `# ${spec.title}\n\nPhase 01 · Module ${lesson.module} · Lesson ${String(lesson.number).padStart(2, '0')}\nStatus: ${complete ? 'Self-completed locally' : 'Draft'}\nCreated: ${now.toISOString()}\n\n`;
  for (const id of spec.fieldIds ?? lesson.fields.map(f => f.id)) {
    const label = lesson.fields.find(f => f.id === id)?.label ?? id;
    out += `## ${label}\n${state.fields[id] || 'Not entered'}\n\n`;
  }
  return `${out}${spec.footer}\n`;
}

export type CoachReplies = { teach: string; guide: string; review: string; challenge: string; reviewIncomplete?: string };
export type CoachProps = { modes: { id: keyof CoachReplies; label: string }[]; replies: CoachReplies; heading: string; questionNote: string; questionLabel: string; placeholder: string; maxLength: number; submitLabel: string };

/** Legacy coachReply(): `SCRIPTED DEMO / MODE`, the scripted text, and a note when a question was typed. */
export function coachOutput(n: number, props: CoachProps, state: LessonState, mode: string, asked: boolean): string {
  const replies = props.replies;
  const key = (['teach', 'guide', 'review', 'challenge'].includes(mode) ? mode : 'teach') as 'teach' | 'guide' | 'review' | 'challenge';
  const template = key === 'review' && replies.reviewIncomplete !== undefined && !fieldsComplete(state, profileIds(n)) ? replies.reviewIncomplete : replies[key];
  const text = fillTemplate(template, { missing: missingCount(state, schemaOf(n).ids) });
  return `${props.heading}${key.toUpperCase()}\n\n${text}${asked ? `\n\n${props.questionNote}` : ''}`;
}

export type PreviewProps =
  | { label: string; kind: 'lines'; joiner: string; lines: { id: string; label: string }[]; footer?: string }
  | { label: string; kind: 'journal'; entryKeys: string[]; sourceMissing: string; patternLabel: string; footer: string };

const value = (state: LessonState, id: string) => state.fields[id]?.trim() || 'Not yet entered';

/** Legacy show*() previews (Lessons 03–20). */
export function previewText(props: PreviewProps, state: LessonState): string {
  if (props.kind === 'journal') {
    const entries = [1, 2, 3].map(n => `Entry ${n} — ${state.fields[`entry${n}source`] || props.sourceMissing}\n${props.entryKeys.map(k => `${k}: ${value(state, `entry${n}${k}`)}`).join('\n')}`);
    return [...entries, `${props.patternLabel}: ${value(state, 'pattern')}`, props.footer].join('\n\n');
  }
  const body = props.lines.map(line => `${line.label}: ${value(state, line.id)}`).join(props.joiner);
  return props.footer ? `${body}\n\n${props.footer}` : body;
}

export type StatusPart = { status: string; complete: string; incomplete: string };
const statusLessons: Record<string, number[]> = { '1.1': [1, 2, 3, 4, 5], '1.2': [6, 7, 8, 9, 10], '1.3': [11, 12, 13, 14, 15], '1.4': [16, 17, 18, 19, 20], phase: Array.from({ length: 20 }, (_, i) => i + 1) };

/** Legacy renderProgress() module / Discover pack status lines. */
export function statusText(part: StatusPart, completed: number[]): string {
  const lessons = statusLessons[part.status] ?? [];
  const count = lessons.filter(n => completed.includes(n)).length;
  return count === lessons.length ? part.complete : fillTemplate(part.incomplete, { count });
}
