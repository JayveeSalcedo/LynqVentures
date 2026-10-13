import type { LessonDefinition, LessonState } from './types';
import { fillTemplate } from './state';

/**
 * Standard Markdown deliverable:
 *   # {title}
 *   {headerLines, with {status} {created} {lesson} {module} tokens}
 *   ## {field label}
 *   {value or "Not entered"}
 *   {extra}{footer}
 */
export function buildMarkdown(lesson: LessonDefinition, state: LessonState, complete: boolean, extra = '', now = new Date()): string {
  const spec = lesson.deliverable;
  const tokens = {
    status: complete ? 'Self-completed locally' : 'Draft',
    created: now.toISOString(),
    lesson: String(lesson.number).padStart(2, '0'),
    module: lesson.module,
  };
  const header = (spec.headerLines ?? ['Status: {status}']).map(line => fillTemplate(line, tokens)).join('\n');
  const ids = spec.fieldIds ?? lesson.fields.map(field => field.id);
  const body = ids.map(id => {
    const field = lesson.fields.find(f => f.id === id);
    return `## ${field?.label ?? id}\n${state.fields[id]?.trim() ? state.fields[id] : 'Not entered'}`;
  }).join('\n\n');
  return `# ${spec.title}\n\n${header}\n\n${body}\n\n${extra ? `${extra.trimEnd()}\n\n` : ''}${spec.footer}\n`;
}

/** On-page preview: label/value pairs followed by the lesson's evidence caveat. */
export function buildPreview(lesson: LessonDefinition, state: LessonState): string {
  const ids = lesson.deliverable.fieldIds ?? lesson.fields.map(field => field.id);
  const lines = ids.map(id => `${lesson.fields.find(f => f.id === id)?.label ?? id}: ${state.fields[id]?.trim() || 'Not yet entered'}`);
  return lines.join('\n\n') + (lesson.deliverable.previewFooter ? `\n\n${lesson.deliverable.previewFooter}` : '');
}

export function downloadText(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
