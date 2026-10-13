// Pure Phase 2 (Validate) logic, kept separate from React for testing.
import type { LessonDefinition, LessonState } from '../../lesson-system/types';
import { fillTemplate } from '../../lesson-system/state';

export type CoachProps = {
  modes: { id: string; label: string; response: string }[];
  initial: string;
  questionResponse: string;
  /** Legacy coach('review') counts the eight worksheet fields only (not the red-team reflections). */
  countIds: string[];
  questionLabel?: string;
  submitLabel?: string;
};

export type ModuleNoteProps = {
  heading: string;
  lessons: number[];
  complete: string;
  /** `{count}` is replaced by the number of self-completed lessons in the module. */
  incomplete: string;
  notes: unknown[];
  checkpoint?: { complete: string; incomplete: string };
};

export const PHASE2_LESSONS = Array.from({ length: 20 }, (_, i) => 21 + i);

/** Legacy `!state.fields[id]?.trim()` count used by the scripted review reply. */
export const emptyCount = (state: LessonState, ids: string[]) =>
  ids.filter(id => !(typeof state.fields[id] === 'string' && state.fields[id].trim())).length;

/** Scripted coach reply for a mode ('question' uses the question reply). Unknown modes yield ''. */
export function coachReply(props: CoachProps, mode: string, state: LessonState): string {
  const text = mode === 'question' ? props.questionResponse : props.modes.find(m => m.id === mode)?.response ?? '';
  return fillTemplate(text, { missing: emptyCount(state, props.countIds) });
}

/** Module status text exactly as legacy render() wrote it. */
export function moduleStatusText(props: Pick<ModuleNoteProps, 'lessons' | 'complete' | 'incomplete'>, done: (n: number) => boolean): string {
  const count = props.lessons.filter(done).length;
  return count === props.lessons.length ? props.complete : fillTemplate(props.incomplete, { count });
}

export function checkpointText(checkpoint: { complete: string; incomplete: string }, done: (n: number) => boolean): string {
  return PHASE2_LESSONS.every(done) ? checkpoint.complete : checkpoint.incomplete;
}

/**
 * Legacy load() keeps only fields/answers/studied/honest/completed; no lesson-specific
 * structured records exist in Phase 2, so unknown keys are dropped exactly as before.
 */
export const normalizeExtra = (_n: number, _raw: Record<string, unknown>): Record<string, unknown> => ({});

/**
 * Legacy exportBrief(): header, "Locally self-completed"/"Draft" status, every field in DOM order
 * (worksheet, optional support, reflections) headed by its on-page label text — which includes the
 * " *" required marker — and the raw value or "Not entered" (no trimming), then the caveat footer.
 */
export function buildPhase2Markdown(lesson: LessonDefinition, state: LessonState, complete: boolean): string {
  const spec = lesson.deliverable;
  const header = (spec.headerLines ?? []).map(line => fillTemplate(line, {
    module: lesson.module, lesson: String(lesson.number), status: complete ? 'Locally self-completed' : 'Draft',
  })).join('\n');
  const body = lesson.fields.map(field => `## ${field.label}${field.required ? ' *' : ''}\n${state.fields[field.id] || 'Not entered'}`).join('\n\n');
  return `# ${spec.title}\n\n${header}\n\n${body}\n\n${spec.footer}`;
}
