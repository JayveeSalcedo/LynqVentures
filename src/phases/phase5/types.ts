// Typed props for the Phase 5 (Scale) extension tools. All values are curriculum data produced by
// scripts/migration/extract-phase5.mjs from the legacy document; no code or HTML strings.

/** One piece of a legacy string-concatenation expression (CEO drafts, record cards). */
export type Segment =
  | { t: 'text'; v: string }
  /** `note('fieldId')` → trimmed field value or the "[Unknown — evidence needed]" fallback. */
  | { t: 'note'; id: string }
  /** Named value: `body`, `records`, `row.id` … */
  | { t: 'ref'; name: string }
  /** Legacy helper call, e.g. `valuationResult97()`. Resolved by name in logic.ts. */
  | { t: 'call'; name: string };
export type ModeExpr = { cases: { mode: string; segs: Segment[] }[]; otherwise: Segment[] };

/** Evidence record shape shared by every Phase 5 register (legacy key order). */
export type EvidenceRow = { kind: string; id: string; source: string; text: string; meaning: string; review: string };
export type RowColumn = 'source' | 'text' | 'meaning' | 'review';

export type ExportSource = { lit: string | number } | { ref: 'fields' | 'rows' } | { fn: string };

export type RecordLogProps = {
  lesson: number;
  /** Key inside the lesson record, e.g. `readyRows` (legacy shape preserved). */
  stateKey: string;
  title: string;
  intro: string[];
  idField: { label: string; maxLength: number };
  kindField: { label: string; options: string[] };
  columns: { key: RowColumn; label: string; maxLength: number }[];
  addLabel: string;
  limit: number;
  messages: { missing: string; duplicate: string; limit: string; added: string };
  countsPrefix: string;
  card: Segment[];
  removeLabel: string;
  filter: { allLabel: string; exceptionsLabel: string; allStatus: string; exceptionsStatus: string; hiddenKind: string } | null;
  grid: boolean;
  exportLabel: string;
  exportFilename: string;
  exportSpec: [string, ExportSource][];
};

export type CheckPanelProps = {
  title: string;
  intro: string[];
  items: { id: string; label: string }[];
  /** Ordered labels: [unknown, supported, contrary, blocker]. The first is the default. */
  options: string[];
  results: { hold: string; contrary: string; unknown: string; ready: string };
  valuesFn: string;
  resultFn: string;
};

export type CalculatorKind = 'calc84' | 'cohort85' | 'runway92' | 'dilution97';
export type CalculatorProps = {
  calc: CalculatorKind;
  title: string;
  intro: string[];
  items: { id: string; label: string; kind: 'number' | 'checkbox' | 'select'; options?: string[]; min?: string; max?: string }[];
  after: string[];
};

export type PromptWorkbenchProps = {
  title: string;
  intro: string[];
  buttons: { role: string; label: string }[];
  tasks: Record<string, string>;
  /** Text between the task and the appended brief (BOUNDARIES … CONTEXT). */
  boundaries: string;
  textareaLabel: string;
  rows: number;
  downloadLabel: string;
  emptyMessage: string;
  filename: string;
  /** Lessons 93–100 clear the generated prompt on every edit (legacy save()). */
  clearOnEdit: boolean;
};

type CeoBase = { title: string; intro: string[]; buttons: { mode: string; label: string }[]; textareaLabel: string; rows: number; downloadLabel: string; filename: string; unknown: string };
export type CeoWorkbenchProps =
  | (CeoBase & { kind: 'segments'; emptyMessage: string; rowsKey: string; recordsEmpty: string; body: ModeExpr; draft: Segment[] })
  | (CeoBase & { kind: 'final100'; emptyMessage: null; final: { ids: { plan: string[]; pitch: string[] }; titles: { plan: string; pitch: string; otherwise: string }; afterTitle: string; beforeRows: string; beforeResult: string; footer: string } });

export type BriefProps = { previewLabel: string; downloadLabel: string; sections: { heading: string; values: string; result: string }[] };
export type CoachProps = { modes: string[]; prefix: string; suffix: string; initial: string };
export type StoryProps = { summary: string; scenes: { title: string; visual: string; narration: string }[] };
export type VideoPromptProps = { summary: string; prompt: string; filename: string; copyLabel: string; downloadLabel: string; textareaLabel: string };
export type GraduationProps = { title: string; intro: string[]; checkLabel: string; downloadLabel: string; after: string[] };
