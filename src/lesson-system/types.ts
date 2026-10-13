import type { ComponentType } from 'react';

/**
 * Static curriculum content. Converted from the legacy templates at migration time and
 * rendered as React elements by <Content>. Only whitelisted tags are rendered; no HTML
 * strings are injected and no legacy event handlers survive the conversion.
 */
export type ContentNode = string | ContentElement;
export type ContentElement = { tag: string; attrs: Record<string, string | null>; children: ContentNode[] };

export type FieldKind = 'input' | 'textarea' | 'select' | 'date' | 'number';
export type FieldDefinition = {
  id: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  /** Select options. An option with value '' is the empty placeholder. */
  options?: { value: string; label: string }[];
  /** Whether completion requires the field. Must agree with curriculum.json schemas. */
  required: boolean;
  maxLength?: number;
  hint?: string;
};

export type QuizQuestion = { prompt: string; options: string[]; answer: number; explanation: string };

export type Scene = { title: string; visual: string; narration: string };

/** Scripted coach reply. `{missing}` is replaced by the number of empty required fields. */
export type CoachMode = { id: string; label: string; response: string };

export type CompletionFlag = 'artifactReady' | 'releaseAck50';

/**
 * A lesson page is an ordered list of sections, each holding blocks. Standard lessons are
 * expressed entirely with built-in blocks; specialised tools use `extension` blocks that
 * resolve to typed React components registered by the phase module.
 */
export type Block =
  | { type: 'content'; nodes: ContentNode[] }
  | { type: 'video'; title: string; subtitle?: string; note?: string }
  | { type: 'storyboard'; scenes: Scene[]; sceneMeta?: string; summary?: string }
  | { type: 'transcript'; scenes: Scene[]; summary?: string }
  | { type: 'videoPrompt'; prompt: string; filename: string; summary?: string; title?: string }
  | { type: 'studied'; label: string }
  | { type: 'fields'; ids: string[] }
  | { type: 'saveStatus' }
  | { type: 'coach'; intro?: string; modes: CoachMode[]; questionResponse?: string; questionLabel?: string; submitLabel?: string; quickPrompts?: { label: string; response: string }[] }
  | { type: 'practice'; prompt: string; options: { label: string; feedback: string }[]; legend?: string }
  | { type: 'quiz'; intro?: string }
  | { type: 'flag'; flag: CompletionFlag; label: string }
  | { type: 'honest'; label: string }
  | { type: 'deliverable'; previewLabel?: string; downloadLabel?: string }
  | { type: 'reset'; label?: string }
  | { type: 'checklist' }
  | { type: 'complete'; label: string; completedLabel?: string; completedNotice: string; incompleteNotice: string }
  | { type: 'next' }
  | { type: 'extension'; id: string; props?: Record<string, unknown> };

export type Section = { id: string; label: string; heading: string; blocks: Block[]; className?: string };

export type ChecklistItem =
  | { kind: 'studied'; label: string }
  | { kind: 'fields'; label: string; ids: string[] }
  | { kind: 'quiz'; label: string }
  | { kind: 'honest'; label: string }
  | { kind: 'flag'; label: string; flag: CompletionFlag };

export type DeliverableSpec = {
  /** Markdown document title, e.g. "LYNQ Academy — Founder Profile". */
  title: string;
  /** Exact legacy export filename. */
  filename: string;
  /** Lines written under the title before the fields (no tokens are evaluated). */
  headerLines?: string[];
  /** Fields included in the export, in order. Defaults to all lesson fields. */
  fieldIds?: string[];
  /** Footer appended after the fields. */
  footer: string;
  /** Preview text appended after the field list in on-page previews. */
  previewFooter?: string;
};

export type LessonDefinition = {
  number: number;
  phase: number;
  module: string;
  title: string;
  hero: { eyebrow: string; title: string; intro: string; badges?: string[]; meta?: string };
  fields: FieldDefinition[];
  questions: QuizQuestion[];
  checklist: ChecklistItem[];
  deliverable: DeliverableSpec;
  sections: Section[];
  /** Section navigation shown under the hero. Defaults to the section list. */
  nav?: { id: string; label: string }[];
  footer?: string;
};

/** The persisted lesson record. Unknown keys written by legacy tools are preserved. */
export type LessonState = {
  fields: Record<string, string>;
  answers: Record<number, number>;
  studied: boolean;
  honest: boolean;
  completed: boolean;
  artifactReady?: boolean;
  releaseAck50?: boolean;
  [extra: string]: unknown;
};

export type LessonSchema = { phase: number; key: string; ids: string[]; keys: number[]; artifact: boolean; releaseAck: boolean };

export type Navigate = (phase: number, lesson?: number | null) => void;

export type ExtensionProps = {
  lesson: LessonDefinition;
  state: LessonState;
  /** Merge a patch into the persisted lesson record (completion is re-validated). */
  update: (patch: Partial<LessonState>) => void;
  setField: (id: string, value: string) => void;
  navigate: Navigate;
  props?: Record<string, unknown>;
};
export type Extension = ComponentType<ExtensionProps>;

export type DashboardModule = { code: string; title: string; summary?: string; lessons: { number: number; title: string; summary: string }[] };
export type DashboardDefinition = {
  phase: number;
  title: string;
  hero: { eyebrow: string; title: string; intro: string; badges?: string[] };
  modules: DashboardModule[];
  /** Additional static dashboard content (checkpoint explanations, legends, cautions). */
  sections: { heading: string; nodes: ContentNode[] }[];
  /** Status text keyed by module code, shown when all five lessons are complete / otherwise. */
  moduleStatus?: Record<string, { complete: string; incomplete: string }>;
  phaseStatus?: { complete: string; incomplete: string };
};

export type PhaseModule = {
  phase: number;
  /** Lazily load a lesson definition (code-split per lesson file). */
  loadLesson: (n: number) => Promise<LessonDefinition>;
  loadDashboard: () => Promise<DashboardDefinition>;
  /** Phase 5 revokes completion on any edit; phases 1–4 only when the lesson becomes invalid. */
  revokeOnAnyEdit: boolean;
  /** Normalise lesson-specific structured records (rows, calculators). Returns only the extra keys. */
  normalizeExtra?: (n: number, raw: Record<string, unknown>) => Record<string, unknown>;
  /** Lesson-specific Markdown appended to the standard deliverable (e.g. row logs). */
  deliverableExtra?: (n: number, state: LessonState) => string;
  /** Replace the standard Markdown builder when a phase's legacy export format differs. */
  buildDeliverable?: (lesson: LessonDefinition, state: LessonState, complete: boolean) => string;
  extensions: Record<string, Extension>;
};
