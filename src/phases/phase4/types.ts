import type { ContentNode } from '../../lesson-system/types';

/** One legacy register input, in DOM order. `domId` is the legacy element id (e.g. "channelId61"). */
export type RowInput = {
  domId: string;
  label: string;
  kind: 'input' | 'textarea' | 'select' | 'checkbox';
  options?: string[];
  maxLength?: number;
};

/** Initial keys of a new legacy row, in insertion order: a constant, or a select/checkbox value. */
export type RowPrefix = { key: string; value: unknown } | { key: string; input: string };

/** Card text: literal text, a row value, a flag-dependent suffix, or JSON of a row value. */
export type CardPart = { text: string } | { key: string } | { flag: string; text: string } | { json: string };

export type ExportEntry =
  | { name: string; kind: 'const'; value: string | number }
  | { name: string; kind: 'fields' }
  | { name: string; kind: 'state'; key: string }
  | { name: string; kind: 'summary' };

/** Coverage summary used by Lessons 68 (journeySummary68) and 71 (releaseSummary71). */
export type SummaryConfig = {
  areaKey: string;
  areas: string[];
  passed: string;
  hold: string;
  ok: string;
  limits: string;
  label: string;
  changed: string;
};

export type CountsConfig = { prefix: string; key: string; options: string[]; suffix: string };

export type RowToolConfig = {
  lesson: number;
  stateKey: string;
  title: string;
  intro: ContentNode[];
  inputs: RowInput[];
  prefix: RowPrefix[];
  /** Required trimmed text keys, in legacy `map` order. */
  keys: { key: string; input: string }[];
  limit: number;
  messages: { missing: string; duplicate: string; limit: string; added: string };
  addLabel: string;
  card: CardPart[];
  removeLabel: string;
  removeBy: 'index' | 'id';
  counts?: CountsConfig;
  summary?: SummaryConfig;
  exportLabel: string;
  exportFilename: string;
  exportPayload: ExportEntry[];
  notes: ContentNode[];
};

export type CalcInput = { domId: string; label: string; type: 'text' | 'number'; maxLength?: number; min?: string; step?: string; max?: string };
export type CalcConfig = { lesson: number; stateKey: 'calc66' | 'rate73' | 'review76'; title: string; intro: ContentNode[]; inputs: CalcInput[]; buttonLabel: string; initial: string; changed: string; notes: ContentNode[] };

export type AgentPromptConfig = {
  title: string;
  intro: ContentNode[];
  roles: { role: string; label: string }[];
  tasks: Record<string, string>;
  /** Text between the task and the brief: "\nBOUNDARIES: …\nCONTEXT (inspect/redact before sharing):\n". */
  suffix: string;
  ariaLabel: string;
  downloadLabel: string;
  filename: string;
  emptyMessage: string;
};

export type BriefConfig = {
  previewLabel: string;
  downloadLabel: string;
  header: string;
  heading: string;
  key: string;
  extra?: { label: string; key: string };
  footer: string;
};
