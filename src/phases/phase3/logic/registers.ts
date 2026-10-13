// Structured row registers for Lessons 46–60 (pure logic; no React).
// Shapes, slice limits, validation order and messages mirror the legacy add*/render*/export* functions.
import type { LessonState } from '../../../lesson-system/types';
import { readinessSummary60 } from './tools';

export type Row = Record<string, string | boolean>;
type Column =
  | { key: string; from: string; kind: 'text'; slice?: number; required?: boolean; fallback?: string }
  | { key: string; from: string; kind: 'select' }
  | { key: string; from: string; kind: 'checkbox' }
  | { key: string; kind: 'const'; value: string };

export type RegisterSpec = {
  lesson: number;
  key: string;
  limit: number;
  addFn: string;
  exportFn?: string;
  rowsId: string;
  statusId: string;
  /** Push order = JSON key order of saved rows. */
  columns: Column[];
  /** Case-insensitive (legacy toLowerCase) or exact uniqueness on a key. */
  unique?: { key: string; exact?: boolean };
  /** Replaces the required-column check (Lesson 57 event-name pattern). */
  valid?: (draft: Record<string, string>) => boolean;
  messages: { missing: string; duplicate?: string; limit: string; added: string };
  card: (row: Row, i: number) => string;
  removeLabel: string;
  /** Text inputs cleared after a successful add (selects keep their value). */
  clear: string[];
  exportFile?: (state: LessonState) => { filename: string; data: unknown };
  /** Lesson 60: a register change invalidates the shown summary. */
  changedOutput?: { id: string; text: string };
};

const s = (row: Row, k: string) => String(row[k]);
const rowsOf = (state: LessonState, key: string) => (Array.isArray(state[key]) ? state[key] as Row[] : []);
const LIMIT30 = 'Local register limit is 30 rows; export before further work.';

export const registers: Record<number, RegisterSpec> = {
  46: {
    lesson: 46, key: 'observationRows', limit: 30, addFn: 'addObservation46', rowsId: 'observationRows46', statusId: 'observationStatus46',
    columns: [
      { key: 'id', from: 'obsId46', kind: 'text', slice: 120, required: true },
      { key: 'action', from: 'obsAction46', kind: 'text', slice: 1000, required: true },
      { key: 'inference', from: 'obsInference46', kind: 'text', slice: 1000, fallback: 'Not interpreted' },
      { key: 'outcome', from: 'obsOutcome46', kind: 'select' },
    ],
    messages: { missing: 'Enter an anonymous ID and an actual observation first.', limit: 'Local log limit is 30 rows; export your findings before further collection.', added: 'Observation saved locally; not verified by the Academy.' },
    card: (r, i) => 'Row ' + (i + 1) + ' · ' + s(r, 'id') + '\nObserved: ' + s(r, 'action') + '\nInterpretation: ' + s(r, 'inference') + '\nOutcome/assistance: ' + s(r, 'outcome'),
    removeLabel: 'Remove row ', clear: ['obsId46', 'obsAction46', 'obsInference46'],
  },
  47: {
    lesson: 47, key: 'requirementRows', limit: 30, addFn: 'addRequirement47', exportFn: 'exportRegister47', rowsId: 'requirementRows47', statusId: 'requirementStatus47',
    columns: [
      { key: 'id', from: 'reqId47', kind: 'text', slice: 80, required: true },
      { key: 'statement', from: 'reqBehaviour47', kind: 'text', slice: 1000, required: true },
      { key: 'source', from: 'reqSource47', kind: 'text', slice: 200, required: true },
      { key: 'evidenceStatus', from: 'reqStatus47', kind: 'select' },
      { key: 'priority', from: 'reqPriority47', kind: 'select' },
      { key: 'criterion', from: 'reqCriterion47', kind: 'text', slice: 1000, required: true },
    ],
    unique: { key: 'id' },
    messages: { missing: 'Enter ID, behaviour/constraint, source/owner and criterion first. Mark unknown sources explicitly.', duplicate: 'Requirement ID already exists; use a unique ID.', limit: LIMIT30, added: 'Requirement saved locally; source and criterion not verified.' },
    card: r => s(r, 'id') + ' · ' + s(r, 'priority') + '\nRequirement: ' + s(r, 'statement') + '\nSource/owner: ' + s(r, 'source') + '\nStatus: ' + s(r, 'evidenceStatus') + '\nCriterion: ' + s(r, 'criterion'),
    removeLabel: 'Remove requirement ', clear: ['reqId47', 'reqBehaviour47', 'reqSource47', 'reqCriterion47'],
    exportFile: st => ({ filename: 'LYNQ-Lesson-47-Requirements.json', data: { lesson: 47, status: 'learner draft; not approved or verified', requirements: st.requirementRows || [] } }),
  },
  48: {
    lesson: 48, key: 'integrationRows', limit: 30, addFn: 'addIntegration48', exportFn: 'exportArchitecture48', rowsId: 'integrationRows48', statusId: 'integrationStatus48',
    columns: [
      { key: 'id', from: 'intId48', kind: 'text', slice: 80, required: true },
      { key: 'purpose', from: 'intPurpose48', kind: 'text', slice: 300, required: true },
      { key: 'status', from: 'intStatus48', kind: 'select' },
      { key: 'contract', from: 'intContract48', kind: 'text', slice: 1000, required: true },
      { key: 'owner', from: 'intOwner48', kind: 'text', slice: 1000, required: true },
    ],
    unique: { key: 'id' },
    messages: { missing: 'Enter ID, purpose/requirements, contract and owner/limits first; keep unknowns explicit.', duplicate: 'Integration ID already exists; use a unique ID.', limit: LIMIT30, added: 'Saved locally. No connection or capability check performed.' },
    card: r => s(r, 'id') + ' · ' + s(r, 'status') + '\nPurpose/requirements: ' + s(r, 'purpose') + '\nContract: ' + s(r, 'contract') + '\nOwnership/limits: ' + s(r, 'owner'),
    removeLabel: 'Remove integration ', clear: ['intId48', 'intPurpose48', 'intContract48', 'intOwner48'],
    exportFile: st => ({ filename: 'LYNQ-Lesson-48-Architecture.json', data: { lesson: 48, status: 'learner architecture draft; no integrations connected', fields: st.fields, integrations: st.integrationRows || [], sampleContract: st.contractDraft || '' } }),
  },
  49: {
    lesson: 49, key: 'controlRows', limit: 30, addFn: 'addControl49', exportFn: 'exportSecurity49', rowsId: 'controlRows49', statusId: 'controlStatusMessage49',
    columns: [
      { key: 'id', from: 'controlId49', kind: 'text', slice: 80, required: true },
      { key: 'control', from: 'controlRisk49', kind: 'text', slice: 1000, required: true },
      { key: 'status', from: 'controlStatus49', kind: 'select' },
      { key: 'evidence', from: 'controlEvidence49', kind: 'text', slice: 1000, required: true },
      { key: 'owner', from: 'controlOwner49', kind: 'text', slice: 300, required: true },
    ],
    unique: { key: 'id' },
    messages: { missing: 'Enter ID, risk/control, evidence/reason or explicit unknown, and owner/release gate first.', duplicate: 'Control ID already exists; use a unique ID.', limit: LIMIT30, added: 'Saved locally. No implementation/evidence verification or certification.' },
    card: r => s(r, 'id') + ' · ' + s(r, 'status') + '\nRisk/control: ' + s(r, 'control') + '\nEvidence/reason: ' + s(r, 'evidence') + '\nOwner/gate: ' + s(r, 'owner'),
    removeLabel: 'Remove control ', clear: ['controlId49', 'controlRisk49', 'controlEvidence49', 'controlOwner49'],
    exportFile: st => ({ filename: 'LYNQ-Lesson-49-Security-Data.json', data: { lesson: 49, status: 'learner planning checklist; no security/compliance certification', fields: st.fields, controls: st.controlRows || [] } }),
  },
  50: {
    lesson: 50, key: 'checkRows', limit: 30, addFn: 'addCheck50', exportFn: 'exportRelease50', rowsId: 'checkRows50', statusId: 'checkStatusMessage50',
    columns: [
      { key: 'id', from: 'checkId50', kind: 'text', slice: 120, required: true },
      { key: 'expected', from: 'checkExpected50', kind: 'text', slice: 1000, required: true },
      { key: 'status', from: 'checkStatus50', kind: 'select' },
      { key: 'observed', from: 'checkObserved50', kind: 'text', slice: 1000, required: true },
    ],
    unique: { key: 'id' },
    messages: { missing: 'Enter ID/requirement, expected behaviour/version and actual evidence or why not run, with owner/next action.', duplicate: 'Check ID already exists; use a unique ID.', limit: LIMIT30, added: 'Saved locally. No test was executed or verified.' },
    card: r => s(r, 'id') + ' · ' + s(r, 'status') + '\nExpected/version: ' + s(r, 'expected') + '\nObserved/evidence/owner: ' + s(r, 'observed'),
    removeLabel: 'Remove check ', clear: ['checkId50', 'checkExpected50', 'checkObserved50'],
    exportFile: st => ({ filename: 'LYNQ-Lesson-50-Release.json', data: { lesson: 50, status: 'learner release record; no build/deployment/approval verified', fields: st.fields, checks: st.checkRows || [] } }),
  },
  52: {
    lesson: 52, key: 'stepRows', limit: 30, addFn: 'addStep52', exportFn: 'exportFlow52', rowsId: 'stepRows52', statusId: 'stepStatus52',
    columns: [
      { key: 'id', from: 'stepId52', kind: 'text', slice: 80, required: true },
      { key: 'action', from: 'stepAction52', kind: 'text', slice: 1000, required: true },
      { key: 'kind', from: 'stepKind52', kind: 'select' },
      { key: 'next', from: 'stepNext52', kind: 'text', slice: 1000, required: true },
    ],
    unique: { key: 'id' },
    messages: { missing: 'Enter step ID, action/response and next/alternative/check status.', duplicate: 'Step ID already exists; choose a unique ID.', limit: 'Local limit is 30 steps; export before further work.', added: 'Saved locally in entry order; not executed or validated.' },
    card: (r, i) => (i + 1) + '. ' + s(r, 'id') + ' · ' + s(r, 'kind') + '\n' + s(r, 'action') + '\nNext/alternatives/check status: ' + s(r, 'next'),
    removeLabel: 'Remove step ', clear: ['stepId52', 'stepAction52', 'stepNext52'],
    exportFile: st => ({ filename: 'LYNQ-Lesson-52-Onboarding-Flow.json', data: { lesson: 52, status: 'learner planning flow; no execution or validation', fields: st.fields, steps: st.stepRows || [] } }),
  },
  53: {
    lesson: 53, key: 'decisionRows', limit: 30, addFn: 'addDecision53', exportFn: 'exportFormation53', rowsId: 'decisionRows53', statusId: 'decisionStatus53',
    columns: [
      { key: 'id', from: 'decisionId53', kind: 'text', slice: 100, required: true },
      { key: 'question', from: 'decisionQuestion53', kind: 'text', slice: 1000, required: true },
      { key: 'status', from: 'decisionState53', kind: 'select' },
      { key: 'source', from: 'decisionSource53', kind: 'text', slice: 1000, required: true },
    ],
    unique: { key: 'id' },
    messages: { missing: 'Enter topic, question/options and source/status with reviewer/next action.', duplicate: 'Decision ID already exists; use a unique ID.', limit: 'Local limit is 30 decisions; export before further work.', added: 'Saved locally; source and review not verified.' },
    card: r => s(r, 'id') + ' · ' + s(r, 'status') + '\n' + s(r, 'question') + '\nSource/reviewer/next action: ' + s(r, 'source'),
    removeLabel: 'Remove decision ', clear: ['decisionId53', 'decisionQuestion53', 'decisionSource53'],
    exportFile: st => ({ filename: 'LYNQ-Lesson-53-Decisions.json', data: { lesson: 53, status: 'planning; no legal review or execution verified', fields: st.fields, decisions: st.decisionRows || [] } }),
  },
  54: {
    lesson: 54, key: 'assetRows', limit: 30, addFn: 'addAsset54', exportFn: 'exportIP54', rowsId: 'assetRows54', statusId: 'assetStatus54',
    columns: [
      { key: 'id', from: 'assetId54', kind: 'text', slice: 120, required: true },
      { key: 'origin', from: 'assetOrigin54', kind: 'text', slice: 1000, required: true },
      { key: 'status', from: 'assetState54', kind: 'select' },
      { key: 'evidence', from: 'assetEvidence54', kind: 'text', slice: 1000, required: true },
    ],
    unique: { key: 'id' },
    messages: { missing: 'Enter asset ID, origin/proposed owner and evidence/unknowns with reviewer/next action.', duplicate: 'Asset ID already exists; use a unique ID.', limit: 'Local limit is 30 assets; export before further work.', added: 'Saved locally; rights and sources not verified.' },
    card: r => s(r, 'id') + ' · ' + s(r, 'status') + '\nOrigin/proposed owner: ' + s(r, 'origin') + '\nEvidence/limits/reviewer: ' + s(r, 'evidence'),
    removeLabel: 'Remove asset ', clear: ['assetId54', 'assetOrigin54', 'assetEvidence54'],
    exportFile: st => ({ filename: 'LYNQ-Lesson-54-IP-Register.json', data: { lesson: 54, status: 'planning; rights and protection not verified', fields: st.fields, assets: st.assetRows || [] } }),
  },
  55: {
    lesson: 55, key: 'taskRows', limit: 30, addFn: 'addTask55', exportFn: 'exportTeam55', rowsId: 'taskRows55', statusId: 'taskStatus55',
    columns: [
      { key: 'id', from: 'taskId55', kind: 'text', slice: 100, required: true },
      { key: 'owner', from: 'taskOwner55', kind: 'text', slice: 120, required: true },
      { key: 'work', from: 'taskWork55', kind: 'text', slice: 1000, required: true },
      { key: 'status', from: 'taskState55', kind: 'select' },
      { key: 'check', from: 'taskCheck55', kind: 'text', slice: 1000, required: true },
    ],
    unique: { key: 'id' },
    messages: { missing: 'Enter outcome ID, accountable human role (or explicit gap), executor/reviewer boundaries and evidence/checkpoint.', duplicate: 'Outcome ID already exists; use a unique ID.', limit: 'Local limit is 30 outcomes; export before further work.', added: 'Saved locally; no assignment sent or commitment verified.' },
    card: r => s(r, 'id') + ' · ' + s(r, 'status') + '\nAccountable human role: ' + s(r, 'owner') + '\nExecutor/reviewer/capacity/authority: ' + s(r, 'work') + '\nEvidence/checkpoint/escalation: ' + s(r, 'check'),
    removeLabel: 'Remove responsibility ', clear: ['taskId55', 'taskOwner55', 'taskWork55', 'taskCheck55'],
    exportFile: st => ({ filename: 'LYNQ-Lesson-55-Responsibility-Matrix.json', data: { lesson: 55, status: 'planning; roles/commitments/authority not verified', fields: st.fields, responsibilities: st.taskRows || [] } }),
  },
  57: {
    lesson: 57, key: 'eventRows', limit: 30, addFn: 'addEvent57', exportFn: 'exportAnalytics57', rowsId: 'eventRows57', statusId: 'eventStatus57',
    columns: [
      { key: 'name', from: 'eventName57', kind: 'text' },
      { key: 'trigger', from: 'eventTrigger57', kind: 'text', slice: 1000 },
      { key: 'properties', from: 'eventProperties57', kind: 'text', slice: 1000 },
      { key: 'review', from: 'eventReview57', kind: 'text', slice: 1000 },
      { key: 'status', kind: 'const', value: 'Proposed / not instrumented' },
    ],
    valid: d => /^[a-z][a-z0-9_]{0,79}$/.test(d.eventName57) && !!d.eventTrigger57 && !!d.eventProperties57 && !!d.eventReview57,
    unique: { key: 'name', exact: true },
    messages: { missing: 'Enter lowercase snake_case name, trigger/unit, allowed properties/data review and owner/check status.', duplicate: 'Event name already exists; use a unique name.', limit: 'Local limit is 30 events; export before further work.', added: 'Saved locally; no tracking or schema deployed.' },
    card: r => s(r, 'name') + ' · Proposed / not instrumented\nTrigger/source/unit: ' + s(r, 'trigger') + '\nProperties/data review: ' + s(r, 'properties') + '\nOwner/checks: ' + s(r, 'review'),
    removeLabel: 'Remove event ', clear: ['eventName57', 'eventTrigger57', 'eventProperties57', 'eventReview57'],
    exportFile: st => ({ filename: 'LYNQ-Lesson-57-Measurement-Plan.json', data: { lesson: 57, status: 'measurement planning; not instrumented', fields: st.fields, events: st.eventRows || [] } }),
  },
  58: {
    lesson: 58, key: 'betaRows', limit: 30, addFn: 'addBeta58', exportFn: 'exportBeta58', rowsId: 'betaRows58', statusId: 'betaStatus58',
    columns: [
      { key: 'id', from: 'betaId58', kind: 'text', slice: 100, required: true },
      { key: 'evidence', from: 'betaEvidence58', kind: 'text', slice: 1000, required: true },
      { key: 'status', from: 'betaState58', kind: 'select' },
      { key: 'priority', from: 'betaPriority58', kind: 'select' },
      { key: 'action', from: 'betaAction58', kind: 'text', slice: 1000, required: true },
    ],
    unique: { key: 'id' },
    messages: { missing: 'Enter ID, version/source/evidence or planned check, and interpretation/limits/owner/action.', duplicate: 'Record ID already exists; use a unique ID.', limit: 'Local limit is 30 records; export before further work.', added: 'Saved locally; no beta or evidence verified.' },
    card: r => s(r, 'id') + ' · ' + s(r, 'status') + ' · ' + s(r, 'priority') + '\nSource/task/evidence: ' + s(r, 'evidence') + '\nInterpretation/limits/owner/action: ' + s(r, 'action'),
    removeLabel: 'Remove beta record ', clear: ['betaId58', 'betaEvidence58', 'betaAction58'],
    exportFile: st => ({ filename: 'LYNQ-Lesson-58-Beta-Report.json', data: { lesson: 58, status: 'learner-reported beta plan/report; no execution or approval verified', fields: st.fields, evidence: st.betaRows || [] } }),
  },
  59: {
    lesson: 59, key: 'fixRows', limit: 30, addFn: 'addFix59', exportFn: 'exportFix59', rowsId: 'fixRows59', statusId: 'fixStatus59',
    columns: [
      { key: 'id', from: 'fixId59', kind: 'text', slice: 100, required: true },
      { key: 'source', from: 'fixSource59', kind: 'text', slice: 1000, required: true },
      { key: 'priority', from: 'fixPriority59', kind: 'select' },
      { key: 'scope', from: 'fixScope59', kind: 'text', slice: 1000, required: true },
      { key: 'status', from: 'fixState59', kind: 'select' },
      { key: 'check', from: 'fixCheck59', kind: 'text', slice: 1000, required: true },
    ],
    unique: { key: 'id' },
    messages: { missing: 'Enter ID, source/limits, scope/owner and criteria/artifact/check status.', duplicate: 'Improvement ID already exists; use a unique ID.', limit: 'Local limit is 30 improvements; export before further work.', added: 'Saved locally; no change implemented or check verified.' },
    card: (r, i) => (i + 1) + '. ' + s(r, 'id') + ' · ' + s(r, 'priority') + ' · ' + s(r, 'status') + '\nSource/limits: ' + s(r, 'source') + '\nScope/owner: ' + s(r, 'scope') + '\nCriteria/artifact/checks: ' + s(r, 'check'),
    removeLabel: 'Remove improvement ', clear: ['fixId59', 'fixSource59', 'fixScope59', 'fixCheck59'],
    exportFile: st => ({ filename: 'LYNQ-Lesson-59-Improvements.json', data: { lesson: 59, status: 'learner improvement record; no implementation or verification executed', fields: st.fields, improvements: st.fixRows || [] } }),
  },
  60: {
    lesson: 60, key: 'readyRows', limit: 40, addFn: 'addReady60', exportFn: 'exportReady60', rowsId: 'readyRows60', statusId: 'readyStatus60',
    columns: [
      { key: 'id', from: 'readyId60', kind: 'text', slice: 100, required: true },
      { key: 'domain', from: 'readyDomain60', kind: 'select' },
      { key: 'source', from: 'readySource60', kind: 'text', slice: 1000, required: true },
      { key: 'status', from: 'readyState60', kind: 'select' },
      { key: 'critical', from: 'readyCritical60', kind: 'checkbox' },
      { key: 'owner', from: 'readyOwner60', kind: 'text', slice: 1000, required: true },
    ],
    unique: { key: 'id' },
    messages: { missing: 'Enter ID, scope/source/evidence status and reviewer/owner/conditions.', duplicate: 'Record ID already exists; use a unique ID.', limit: 'Local limit is 40 records; export before further work.', added: 'Saved locally; review/evidence not verified.' },
    card: r => s(r, 'id') + ' · ' + s(r, 'domain') + ' · ' + s(r, 'status') + (r.critical ? ' · UNRESOLVED CRITICAL BLOCKER' : '') + '\nSource/evidence: ' + s(r, 'source') + '\nReviewer/owner/conditions: ' + s(r, 'owner'),
    removeLabel: 'Remove readiness record ', clear: ['readyId60', 'readySource60', 'readyOwner60', 'readyCritical60'],
    exportFile: st => ({ filename: 'LYNQ-Lesson-60-Readiness-Assessment.json', data: { lesson: 60, status: 'learner readiness assessment; not verified or authorized launch', fields: st.fields, records: st.readyRows || [], summary: readinessSummary60(st) } }),
    changedOutput: { id: 'readySummary60', text: 'Register changed; summarize again.' },
  },
};

/** Draft values keyed by legacy control id: strings for text/select, booleans for checkboxes. */
export type Draft = Record<string, string | boolean>;

/**
 * Validate and append a register row exactly as the legacy add* function: trimmed values,
 * required check (or custom pattern), duplicate ID, row limit, then push with slice limits.
 */
export function addRegisterRow(spec: RegisterSpec, rows: Row[], draft: Draft): { rows: Row[]; message: string } | { error: string } {
  const text = Object.fromEntries(spec.columns.filter(c => c.kind === 'text').map(c => [(c as { from: string }).from, String(draft[(c as { from: string }).from] ?? '').trim()]));
  const ok = spec.valid ? spec.valid(text) : spec.columns.every(c => c.kind !== 'text' || !c.required || text[c.from]);
  if (!ok) return { error: spec.messages.missing };
  if (spec.unique) {
    const col = spec.columns.find(c => c.key === spec.unique!.key) as { from: string };
    const candidate = text[col.from];
    const same = (v: unknown) => spec.unique!.exact ? v === candidate : String(v).toLowerCase() === candidate.toLowerCase();
    if (rows.some(r => same(r[spec.unique!.key]))) return { error: spec.messages.duplicate! };
  }
  if (rows.length >= spec.limit) return { error: spec.messages.limit };
  const row: Row = {};
  for (const c of spec.columns) {
    if (c.kind === 'const') row[c.key] = c.value;
    else if (c.kind === 'checkbox') row[c.key] = draft[c.from] === true;
    else if (c.kind === 'select') row[c.key] = String(draft[c.from] ?? '');
    else row[c.key] = (c.slice ? text[c.from].slice(0, c.slice) : text[c.from]) || c.fallback || '';
  }
  return { rows: [...rows, row], message: spec.messages.added };
}

export const removeRegisterRow = (rows: Row[], index: number) => rows.filter((_, i) => i !== index);

/** Keep only rows with the legacy shape (string columns, boolean `critical`); cap at the legacy limit. */
export function normalizeRegister(spec: RegisterSpec, raw: unknown): Row[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.filter(r => r !== null && typeof r === 'object' && !Array.isArray(r) && spec.columns.every(c => c.kind === 'checkbox' || typeof (r as Row)[c.key] === 'string'))
    .map(r => {
      const row: Row = {};
      for (const c of spec.columns) row[c.key] = c.kind === 'checkbox' ? (r as Row)[c.key] === true : (r as Row)[c.key];
      return row;
    })
    .slice(0, spec.limit);
}

export const registerRows = (spec: RegisterSpec, state: LessonState) => rowsOf(state, spec.key);
export const registerExport = (spec: RegisterSpec, state: LessonState) => {
  const file = spec.exportFile!(state);
  return { filename: file.filename, text: JSON.stringify(file.data, null, 2) };
};
