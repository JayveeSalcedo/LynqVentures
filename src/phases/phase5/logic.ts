// Pure Phase 5 (Scale) logic, ported from the legacy phase-5 document. No React and no DOM, so every
// rule can be tested in node. Strings here are logic-embedded legacy text copied verbatim; the tests
// compare these functions against the legacy implementation.
import type { LessonDefinition, LessonState } from '../../lesson-system/types';
import type { CalculatorProps, CeoWorkbenchProps, CheckPanelProps, EvidenceRow, ModeExpr, PromptWorkbenchProps, RecordLogProps, Segment, BriefProps } from './types';

// ------------------------------------------------------------------------------------------------
// Saved-state normalisation (legacy load(n)).

/** Every Scale lesson record carries all twenty registers (legacy `fresh()` order). */
export const ROW_KEYS = ['readyRows', 'bottleRows', 'growthRows', 'econRows', 'retainRows', 'partnerRows', 'orgRows', 'leaderRows', 'processRows', 'kpiRows', 'controlRows', 'capitalRows', 'diligenceRows', 'expansionRows', 'governanceRows', 'strategicRows', 'valuationRows', 'transitionRows', 'exitRows', 'finalRows'] as const;
export const ROW_FIELDS = ['id', 'kind', 'source', 'text', 'meaning', 'review'] as const;
export const ROW_LIMIT = 30;

/** Legacy filter: keep rows whose six columns are strings; cap at 30. Other row keys are preserved. */
export function normalizeRows(raw: unknown): EvidenceRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(r => r !== null && typeof r === 'object' && ROW_FIELDS.every(k => typeof (r as Record<string, unknown>)[k] === 'string')).slice(0, ROW_LIMIT) as EvidenceRow[];
}

/**
 * Mirrors legacy load(): unknown keys (tool inputs, future keys) are kept as saved and every register
 * array is re-validated. Lesson number does not matter: the legacy loader normalised all registers for every lesson.
 */
export function normalizeExtra(_n: number, raw: Record<string, unknown>): Record<string, unknown> {
  return { ...raw, ...Object.fromEntries(ROW_KEYS.map(key => [key, normalizeRows(raw[key])])) };
}

export const rowsOf = (state: LessonState, key: string): EvidenceRow[] => normalizeRows(state[key]);

// ------------------------------------------------------------------------------------------------
// Evidence registers (render*/add*/export*/filter*).

export type RecordDraft = { kind: string; id: string; source: string; text: string; meaning: string; review: string };

/** Legacy add*: every text column required (trimmed), unique case-insensitive ID, local limit. */
export function addRecord(rows: EvidenceRow[], draft: RecordDraft, config: Pick<RecordLogProps, 'limit' | 'messages'>): { rows: EvidenceRow[] } | { error: string } {
  const row: EvidenceRow = { kind: draft.kind, id: '', source: '', text: '', meaning: '', review: '' };
  for (const key of ['id', 'source', 'text', 'meaning', 'review'] as const) {
    row[key] = (draft[key] ?? '').trim();
    if (!row[key]) return { error: config.messages.missing };
  }
  if (rows.some(x => x.id.toLowerCase() === row.id.toLowerCase())) return { error: config.messages.duplicate };
  if (rows.length >= config.limit) return { error: config.messages.limit };
  return { rows: [...rows, row] };
}

export const removeRecord = (rows: EvidenceRow[], index: number) => rows.filter((_, i) => i !== index);

export const countsText = (config: Pick<RecordLogProps, 'countsPrefix' | 'kindField'>, rows: EvidenceRow[]) =>
  config.countsPrefix + config.kindField.options.map(kind => kind + ' ' + rows.filter(r => r.kind === kind).length).join(' · ');

/** Rows shown under the current filter, with their original index (for removal). */
export function visibleRows(rows: EvidenceRow[], config: Pick<RecordLogProps, 'filter'>, exceptionsOnly: boolean): { row: EvidenceRow; index: number }[] {
  return rows.map((row, index) => ({ row, index })).filter(({ row }) => !(exceptionsOnly && config.filter && row.kind === config.filter.hiddenKind));
}

export function filterStatus(config: Pick<RecordLogProps, 'filter'>, exceptionsOnly: boolean): string {
  return config.filter ? (exceptionsOnly ? config.filter.exceptionsStatus : config.filter.allStatus) : '';
}

function evalSegments(segs: Segment[], resolve: (seg: Segment) => string): string {
  return segs.map(seg => seg.t === 'text' ? seg.v : resolve(seg)).join('');
}

export function cardText(config: Pick<RecordLogProps, 'card'>, row: EvidenceRow): string {
  return evalSegments(config.card, seg => {
    if (seg.t === 'ref' && seg.name.startsWith('row.')) return String(row[seg.name.slice(4) as keyof EvidenceRow] ?? '');
    throw new Error(`Unsupported card segment ${JSON.stringify(seg)}`);
  });
}

/** The JSON register export (key order and content as legacy export*()). */
export function recordExport(config: Pick<RecordLogProps, 'exportSpec' | 'stateKey'>, lesson: LessonDefinition, state: LessonState): string {
  const value = Object.fromEntries(config.exportSpec.map(([key, source]) => {
    if ('lit' in source) return [key, source.lit];
    if ('ref' in source) return [key, source.ref === 'fields' ? state.fields : rowsOf(state, config.stateKey)];
    return [key, resolveFn(source.fn, lesson, state)];
  }));
  return JSON.stringify(value, null, 2);
}

// ------------------------------------------------------------------------------------------------
// Check-review panels (Lessons 86–100).

export function checkValues(panel: Pick<CheckPanelProps, 'items' | 'options'>, state: LessonState): Record<string, string> {
  return Object.fromEntries(panel.items.map(({ id }) => [id, panel.options.includes(state.fields[id]) ? state.fields[id] : panel.options[0]]));
}

/** Critical blockers dominate, then contrary evidence, then unknowns; otherwise ready for human review (never approved). */
export function checkResult(panel: Pick<CheckPanelProps, 'items' | 'options' | 'results'>, state: LessonState): string {
  const v = Object.values(checkValues(panel, state));
  if (v.includes(panel.options[3])) return panel.results.hold;
  if (v.includes(panel.options[2])) return panel.results.contrary;
  if (v.includes(panel.options[0])) return panel.results.unknown;
  return panel.results.ready;
}

// ------------------------------------------------------------------------------------------------
// Calculators.

export const calcIds84 = ['calcRevenue84', 'calcCost84', 'calcSpend84', 'calcNew84', 'calcOverhead84'];
export function calcValues84(state: LessonState): Record<string, string> {
  return Object.fromEntries([...calcIds84, 'calcRecurring84'].map(id => [id, state.fields[id] ?? '']));
}
/** Lesson 84 customer-month scenario: contribution, margin, CAC, simple payback and overhead coverage. */
export function calcResult84(state: LessonState): string {
  const v = calcValues84(state);
  const num = (id: string) => { const raw = v[id]; if (typeof raw !== 'string' || !raw.trim()) return null; const n = Number(raw); return Number.isFinite(n) && n >= 0 ? n : null; };
  const r = num('calcRevenue84'), cost = num('calcCost84'), spend = num('calcSpend84'), customers = num('calcNew84'), overhead = num('calcOverhead84');
  const fmt = (n: number) => Number.isFinite(n) ? n.toFixed(2) : 'undefined';
  const con = r !== null && cost !== null ? r - cost : null;
  const cac = spend !== null && customers !== null && Number.isInteger(customers) && customers > 0 ? spend / customers : null;
  const out = ['Scenario arithmetic only — inputs/results not verified.'];
  if (calcIds84.some(id => typeof v[id] === 'string' && v[id].trim() && num(id) === null) || (customers !== null && !Number.isInteger(customers))) return out.concat('Invalid input: use finite nonnegative amounts and a whole new-customer count; leave unknowns blank.').join('\n');
  out.push('Contribution/customer-month: ' + (con === null ? 'unknown — enter revenue and variable cost' : fmt(con)));
  out.push('Contribution margin: ' + (con !== null && r !== null && r > 0 ? fmt(con / r * 100) + '%' : 'undefined — positive revenue and known cost required'));
  out.push('CAC: ' + (cac === null ? 'undefined — known cost and positive whole new-customer count required' : fmt(cac)));
  out.push('Simple payback: ' + (v.calcRecurring84 === 'yes' && cac !== null && con !== null && con > 0 ? fmt(cac / con) + ' months (constant contribution, retention and payment assumed)' : 'not calculated — recurring assumption, defined CAC and positive contribution required'));
  out.push('Simple overhead coverage: ' + (overhead !== null && con !== null && con > 0 ? Math.ceil(overhead / con) + ' customer-months (excludes acquisition, capacity changes and cash timing)' : 'not calculated — known overhead and positive contribution required'));
  out.push('No LTV, net profit, growth approval or cash sufficiency established.');
  return out.join('\n');
}

export const cohortIds85 = ['cohortEligible85', 'cohortRetained85'];
export function cohortValues85(state: LessonState): Record<string, string> {
  return Object.fromEntries([...cohortIds85, 'cohortConfirmed85'].map(id => [id, state.fields[id] ?? '']));
}
/** Lesson 85 cohort retention: retained ÷ eligible original cohort, only when confirmed and well-formed. */
export function cohortResult85(state: LessonState): string {
  const v = cohortValues85(state);
  const n = (id: string) => { const x = v[id]; return typeof x === 'string' && x.trim() ? Number(x) : null; };
  const eligible = n('cohortEligible85'), retained = n('cohortRetained85');
  const out = ['Scenario arithmetic only — cohort and results not verified.'];
  if (eligible === null || retained === null) return out.concat('Retention: unknown — enter both counts; unknown is not zero.').join('\n');
  if (!Number.isSafeInteger(eligible) || !Number.isSafeInteger(retained) || eligible < 0 || retained < 0 || retained > eligible) return out.concat('Invalid input: use nonnegative whole counts; retained cannot exceed eligible original cohort.').join('\n');
  if (eligible === 0) return out.concat('Retention: undefined — eligible denominator is zero.').join('\n');
  if (v.cohortConfirmed85 !== 'yes') return out.concat('Retention: not calculated — confirm one defined measure/window and fully observed original cohort.').join('\n');
  return out.concat('Retention under your definition: ' + (retained / eligible * 100).toFixed(2) + '% (' + retained + ' / ' + eligible + ')', 'Not verified churn cause, renewal/revenue retention, causal lift or LTV.').join('\n');
}

export const runwayIds92 = ['cash92', 'reserve92', 'outflow92', 'inflow92'];
export function runwayValues92(state: LessonState): Record<string, string> {
  return Object.fromEntries(runwayIds92.map(id => [id, typeof state.fields[id] === 'string' ? state.fields[id] : '']));
}
/** Lesson 92 constant-cash-flow scenario: months above reserve. */
export function runwayResult92(state: LessonState): string {
  const raw = runwayValues92(state), v: Record<string, number> = {};
  for (const id of runwayIds92) {
    if (!raw[id].trim()) return 'Needs inputs — blank is unknown, not zero. Scenario estimate only.';
    v[id] = Number(raw[id]);
    if (!Number.isFinite(v[id]) || v[id] < 0) return 'Invalid input — use finite non-negative amounts in one currency.';
  }
  const buffer = v.cash92 - v.reserve92, burn = v.outflow92 - v.inflow92;
  if (buffer <= 0) return 'Hold — available cash is at or below the stated reserve; review obligations. Scenario estimate only.';
  if (burn <= 0) return 'No depletion projected under constant cash flows; a finite runway is not defined. This does not mean infinite runway or no funding need. Review timing and downside.';
  return 'Estimated months above reserve: ' + (buffer / burn).toFixed(1) + '; monthly net cash outflow: ' + burn.toFixed(2) + '. Constant-flow estimate, not verified runway or funding authority.';
}

export const dilutionIds97 = ['preMoney97', 'investment97', 'founderBefore97', 'nextPre97', 'nextInvestment97'];
export const currencies97 = ['AED', 'USD', 'EUR'];
export function dilutionValues97(state: LessonState): Record<string, string> {
  return { ...Object.fromEntries(dilutionIds97.map(id => [id, typeof state.fields[id] === 'string' ? state.fields[id] : ''])), currency97: currencies97.includes(state.fields.currency97) ? state.fields.currency97 : 'AED' };
}
/** Lesson 97 simple primary priced-round dilution (optional second round). Excludes instruments and rights. */
export function dilutionResult97(state: LessonState): string {
  const x = dilutionValues97(state), v: Record<string, number> = {};
  for (const id of dilutionIds97) {
    if (!x[id].trim()) { if (id === 'nextPre97' || id === 'nextInvestment97') continue; return 'Needs inputs — blank is unknown,not zero.'; }
    const n = Number(x[id]);
    if (!Number.isFinite(n) || n < 0 || n > 1e12 || (id === 'founderBefore97' && n > 100) || ((id === 'preMoney97' || id === 'nextPre97') && n === 0)) return 'Invalid input — positive pre-money,non-negative investment,founder0–100%;amounts at most1e12 in one currency.';
    v[id] = n;
  }
  const post = v.preMoney97 + v.investment97, keep = v.preMoney97 / post, investor = v.investment97 / post * 100, founder = v.founderBefore97 * keep;
  let out = 'Illustrative ' + x.currency97 + ' primary-priced-round scenario;excluded instruments/rights.\nRound1 post-money: ' + post.toFixed(2) + ';new investor: ' + investor.toFixed(2) + '%;existing holders collectively: ' + (keep * 100).toFixed(2) + '%.\nFounder: ' + v.founderBefore97.toFixed(2) + '% → ' + founder.toFixed(2) + '%;change: ' + (v.founderBefore97 - founder).toFixed(2) + ' percentage points;existing-holder relative dilution: ' + investor.toFixed(2) + '%.';
  if (x.nextPre97.trim() || x.nextInvestment97.trim()) {
    if (v.nextPre97 === undefined || v.nextInvestment97 === undefined) return out + '\nRound2 unknown — enter both optional assumptions;do not infer missing values.';
    const post2 = v.nextPre97 + v.nextInvestment97, keep2 = v.nextPre97 / post2;
    out += '\nRound2 post-money: ' + post2.toFixed(2) + ';new round2 investor: ' + (v.nextInvestment97 / post2 * 100).toFixed(2) + '%;prior round1 investor: ' + (investor * keep2).toFixed(2) + '%;founder: ' + (founder * keep2).toFixed(2) + '%.';
  }
  return out + '\nNo verified value,fully diluted cap table,voting/payout or approved financing.';
}

export const calculators: Record<CalculatorProps['calc'], { values: (s: LessonState) => Record<string, string>; result: (s: LessonState) => string }> = {
  calc84: { values: calcValues84, result: calcResult84 },
  cohort85: { values: cohortValues85, result: cohortResult85 },
  runway92: { values: runwayValues92, result: runwayResult92 },
  dilution97: { values: dilutionValues97, result: dilutionResult97 },
};
const calculatorFns: Record<string, (s: LessonState) => unknown> = {
  calcValues84, calcResult84, cohortValues85, cohortResult85, runwayValues92, runwayResult92, dilutionValues97, dilutionResult97,
};

// ------------------------------------------------------------------------------------------------
// Resolving legacy helper names used by briefs, exports and CEO drafts.

export function extensionProps<T>(lesson: LessonDefinition, id: string): T[] {
  return lesson.sections.flatMap(s => s.blocks).filter(b => b.type === 'extension' && b.id === id).map(b => (b as { props?: unknown }).props as T);
}

export function resolveFn(name: string, lesson: LessonDefinition, state: LessonState): unknown {
  if (calculatorFns[name]) return calculatorFns[name](state);
  for (const panel of extensionProps<CheckPanelProps>(lesson, 'checkPanel')) {
    if (panel.valuesFn === name) return checkValues(panel, state);
    if (panel.resultFn === name) return checkResult(panel, state);
  }
  throw new Error(`Unknown legacy helper ${name} for lesson ${lesson.number}`);
}

// ------------------------------------------------------------------------------------------------
// Brief (main Markdown deliverable) — legacy brief().

export function buildBrief(lesson: LessonDefinition, state: LessonState): string {
  const ids = lesson.deliverable.fieldIds ?? [];
  const label = (id: string) => lesson.fields.find(f => f.id === id)?.label ?? id;
  const log = extensionProps<RecordLogProps>(lesson, 'recordLog')[0];
  const brief = extensionProps<BriefProps>(lesson, 'brief')[0];
  return '# ' + lesson.deliverable.title + '\n\nLearner assessment; evidence/decision authority not verified.\n\n'
    + ids.map(id => '## ' + label(id) + '\n' + (state.fields[id] || '[Missing]')).join('\n\n')
    + '\n\n## Red-team\n' + ['bias', 'counter', 'constraint'].map(id => id + ': ' + (state.fields[id] || '[Missing]')).join('\n')
    + '\n\n## Assessment evidence (not verified)\n' + JSON.stringify(log ? rowsOf(state, log.stateKey) : [], null, 2)
    + (brief?.sections ?? []).map(s => '\n\n## ' + s.heading + '\n' + JSON.stringify(resolveFn(s.values, lesson, state), null, 2) + '\n' + resolveFn(s.result, lesson, state)).join('')
    + lesson.deliverable.footer;
}

// ------------------------------------------------------------------------------------------------
// Agent prompt workbench (prepare*/export*Prompt).

export const buildPrompt = (config: Pick<PromptWorkbenchProps, 'tasks' | 'boundaries'>, role: string, brief: string) =>
  'ROLE: ' + role + '\nTASK: ' + config.tasks[role] + config.boundaries + brief;

// ------------------------------------------------------------------------------------------------
// CEO draft builders (buildCeo93 … buildCeo100).

export function buildCeoDraft(config: CeoWorkbenchProps, mode: string, lesson: LessonDefinition, state: LessonState): string {
  const note = (id: string) => state.fields[id]?.trim() || config.unknown;
  if (config.kind === 'final100') {
    const f = config.final;
    const ids = mode === 'plan' ? f.ids.plan : mode === 'pitch' ? f.ids.pitch : (lesson.deliverable.fieldIds ?? []);
    const title = mode === 'plan' ? f.titles.plan : mode === 'pitch' ? f.titles.pitch : f.titles.otherwise;
    const label = (id: string) => lesson.fields.find(x => x.id === id)?.label ?? id;
    return '# ' + title + f.afterTitle + ids.map(id => '## ' + label(id) + '\n' + note(id)).join('\n\n')
      + f.beforeRows + JSON.stringify(rowsOf(state, 'finalRows'), null, 2) + f.beforeResult + String(resolveFn('finalResult100', lesson, state)) + f.footer;
  }
  const records = rowsOf(state, config.rowsKey).map(r => r.id + ' | ' + r.kind + ' | ' + r.source + ' | ' + r.text + ' | ' + r.meaning + ' | ' + r.review).join('\n') || config.recordsEmpty;
  const resolve = (seg: Segment): string => {
    if (seg.t === 'note') return note(seg.id);
    if (seg.t === 'call') return String(resolveFn(seg.name, lesson, state));
    if (seg.t === 'ref' && seg.name === 'records') return records;
    if (seg.t === 'ref' && seg.name === 'body') return evalMode(config.body, mode, resolve);
    throw new Error(`Unsupported CEO segment ${JSON.stringify(seg)}`);
  };
  return evalSegments(config.draft, resolve);
}
function evalMode(expr: ModeExpr, mode: string, resolve: (seg: Segment) => string): string {
  const match = expr.cases.find(c => c.mode === mode);
  return evalSegments(match ? match.segs : expr.otherwise, resolve);
}

// ------------------------------------------------------------------------------------------------
// Coach, module status and graduation wording.

export const coachReply = (prefix: string, mode: string, suffix: string) => prefix + mode + suffix;

export function moduleStatusText(module: string, complete: number[]): string {
  const start = 81 + (Number(module.split('.')[1]) - 1) * 5;
  const count = [0, 1, 2, 3, 4].map(i => start + i).filter(n => complete.includes(n)).length;
  return 'Module ' + module + ': ' + count + ' / 5. Lessons 81–99 interactive; Lesson 100 previews. Learning does not approve expansion.';
}

export type Graduation = { count: number; missing: number[]; orientation: boolean; eligible: boolean };
/** Legacy academyGraduationResult wording. Eligibility records learning completion only. */
export function graduationMessage(g: Graduation): string {
  return g.eligible
    ? 'Academy learning self-completed locally: Module 00 and 100 / 100 lessons. No accreditation or business-readiness endorsement.'
    : g.count + ' / 100 learning completions; Module 00 ' + (g.orientation ? 'self-completed' : 'pending') + '. Remaining lesson IDs: ' + (g.missing.join(', ') || 'none') + '. Complete outstanding learning before the acknowledgement.';
}
export const GRADUATION_UNAVAILABLE = 'Acknowledgement unavailable: Module 00 and all 100 lesson schemas must pass. Review Academy completion first.';
export const GRADUATION_FILENAME = 'LYNQ-Academy-Local-Learning-Acknowledgement.md';
export function graduationAcknowledgement(finalResult: string, now = new Date()): string {
  return '# LYNQ Academy — local learning acknowledgement\n\nGenerated: ' + now.toISOString() + '\nModule 00 and all 100 lessons passed browser-local self-completion schemas.\nSelf-reported learning record only. No accreditation,identity verification,mentor assessment,investment approval or business-readiness endorsement.\n\n## Final review limits\n' + finalResult + '\n\nContinue with your human-reviewed venture operating dossier and next 90-day plan.';
}

// ------------------------------------------------------------------------------------------------
/** Legacy download(): JSON files as application/json, everything else as plain text. */
export function download(value: string, name: string) {
  const blob = new Blob([value], { type: name.endsWith('.json') ? 'application/json' : 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
