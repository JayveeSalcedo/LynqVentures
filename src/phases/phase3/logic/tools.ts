// Pure logic for the Phase 03 specialised tools. Every message and formula is copied from the
// legacy phase-3 functions named in the comments; no DOM access here so it can be unit-tested.
import type { LessonState } from '../../../lesson-system/types';
import shellData from '../data/prototypeShell45.json';

// ---------- Lesson 45 · prototype shell, simulated API ----------
export const prototypeShell45: string = shellData.shell;

/** prototypeHtml45(): the downloadable local sample shell, configured from the worksheet. */
export function prototypeConfig45(fields: Record<string, string>) {
  return { title: (fields.target || 'Fictional registration-route task').slice(0, 250), spec: (fields.spec || 'Sample navigation shell; adapt to your approved flow.').slice(0, 1000) };
}
export function prototypeHtml45(fields: Record<string, string>): string {
  // Same String.replace call as the legacy code (string pattern, first occurrence).
  return prototypeShell45.replace('__CONFIG__', JSON.stringify(prototypeConfig45(fields)).replace(/</g, '\\u003c'));
}
export const PROTOTYPE45 = {
  previewed: 'Local sample shell created. Inspect/adapt it and record the artifact and actual checks; no completion is granted automatically.',
  exported: 'Prototype shell exported. It uses fictional local states and makes no API requests.',
  filename: 'LYNQ-Lesson-45-Prototype-Shell.html',
};
/** States and transitions of the sample shell (rendered natively in the lesson preview). */
export type ShellState = 'entry' | 'choices' | 'recovery' | 'destination';
export const shellTransitions: Record<string, ShellState> = { start: 'choices', available: 'destination', unavailable: 'recovery', cancel: 'entry', retry: 'choices', exit: 'entry', restart: 'entry' };

/** simulateApi45(). */
export function simulateApi45(kind: string): string {
  const v = kind === 'success'
    ? { simulation: true, status: 200, data: [{ id: 'sample-1', label: 'Sample route', available: true }], next: 'Render choices; not a live response' }
    : kind === 'timeout'
      ? { simulation: true, status: 'timeout', data: null, next: 'Explain delay, allow retry/cancel; do not claim saved success' }
      : { simulation: true, status: 401, data: null, next: 'Stop protected action; re-authenticate in a real app; do not retry with leaked credentials' };
  return JSON.stringify(v, null, 2);
}

// ---------- Lesson 48 · API contract lab ----------
export const CONTRACT_CASES48 = ['valid', 'invalid', 'timeout', 'denied'];
/** loadContractSample48(). */
export function contractSample48(mode: string): string {
  const example = mode === 'valid' ? { routes: [{ id: 'sample-1', label: 'Sample route', available: true }] }
    : mode === 'invalid' ? { routes: [{ id: 'sample-1', label: 'Sample route', available: 'yes' }] }
      : mode === 'timeout' ? { scenario: 'timeout', status: null, fallback: 'Bounded retry/cancel; no success claim' }
        : { scenario: 'unauthorized', status: 401, fallback: 'Stop protected action; restore authorized access' };
  return JSON.stringify(example, null, 2);
}
export const CONTRACT48 = { loaded: 'Fictional local sample loaded. No request was made.', edited: 'Sample edited; run the local check again.' };
/** checkContract48(): local shape check with the legacy error rules. */
export function checkContract48(raw: string): string {
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return 'Invalid JSON. Local parsing only; no request made.'; }
  const o = v as Record<string, unknown> | null;
  if (o && typeof o === 'object' && (o.scenario === 'timeout' || o.scenario === 'unauthorized'))
    return 'Failure scenario only: ' + o.scenario + '. Review safe recovery, bounded retry and access. This is not a successful route response or live result.';
  const errors: string[] = [];
  if (!o || !Array.isArray((o as { routes?: unknown }).routes)) errors.push('routes must be an array');
  else {
    const ids = new Set<string>();
    ((o as { routes: unknown[] }).routes).forEach((item, i) => {
      const x = item as Record<string, unknown> | null;
      if (!x || typeof x.id !== 'string' || !x.id.trim()) errors.push('row ' + i + ': non-empty string id required');
      else if (ids.has(x.id)) errors.push('row ' + i + ': duplicate id');
      else ids.add(x.id);
      if (!x || typeof x.label !== 'string' || !x.label.trim()) errors.push('row ' + i + ': non-empty string label required');
      if (!x || typeof x.available !== 'boolean') errors.push('row ' + i + ': boolean available required');
    });
  }
  return errors.length ? 'Local sample shape failed: ' + errors.join('; ') : 'Local sample shape passed for required fields/types and unique IDs. Not an API request, OpenAPI validation, security or semantic check.';
}

// ---------- Lesson 49 · permission scenario ----------
/** checkPermission49(). */
export function checkPermission49(actor: string, scope: string, action: string, signed: boolean, agent: boolean): string {
  const allowed = ['read', 'edit', 'delete'].includes(action) && signed && scope === 'assigned' && (actor === 'owner' || (actor === 'collaborator' && action === 'read'));
  return !allowed ? 'DENY in sample policy: identity, scoped grant and action must all permit access. No resource was accessed and no real permission is enforced.'
    : agent && action !== 'read' ? 'HUMAN REVIEW REQUIRED in sample policy: scope/action permit the actor, but agent changes need the example human gate. No action executed.'
      : 'ALLOW in sample policy only: scoped actor/action matched the illustrative grant. No real authentication, access, enforcement or security test occurred.';
}

// ---------- Lesson 50 · release gate, runbook ----------
/** explainReleaseGate50(). */
export function releaseGate50(build: string, checks: string, controls: string, recovery: string): string {
  const gates = [['versioned artifact', build], ['required checks', checks], ['controls/reviews', controls], ['support/recovery', recovery]];
  const blocked = gates.filter(x => x[1] !== 'ready');
  return blocked.length ? 'BLOCKED in sample exercise: ' + blocked.map(x => x[0] + ' (' + x[1] + ')').join('; ') + '. Resolve with owners and actual evidence; no release occurred.'
    : 'ELIGIBLE FOR HUMAN DECISION in sample exercise only. All hypothetical inputs are ready; real evidence, scope and approval still need review. No artifact, test, control or release was verified/executed.';
}
/** exportRunbook50(). */
export function runbook50(briefText: string): string {
  return '# Controlled-Use Runbook — draft\n\n' + briefText + '\n\nBefore controlled use: confirm artifact/environment and owners; inspect actual required check/control evidence; resolve blockers; review audience/data/access and support boundaries.\n\nDuring controlled use: observe agreed signals within resource/privacy limits; stop on defined triggers and notify the responsible owner through the approved process.\n\nRecovery: use the recorded owner/version/data-recovery plan; verify compatibility and restored behaviour. Code rollback alone may not reverse data changes.\n\nThis is an exported planning runbook, not a deployment command or authorization.';
}
export const RUNBOOK50_FILENAME = 'LYNQ-Lesson-50-Release-Runbook.md';

// ---------- Lesson 51 · brand token contrast ----------
/** WCAG relative luminance of #RRGGBB (legacy lum()). */
export function luminance(hex: string): number {
  const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
export const contrastRatio = (a: string, b: string) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** brandPair51(): null unless both colours are #RRGGBB. Inputs are trimmed as in the legacy code. */
export function brandPair51(ink: string, paper: string): { text: string; background: string; ratio: number } | null {
  const a = ink.trim(), b = paper.trim();
  if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return null;
  return { text: a, background: b, ratio: contrastRatio(a, b) };
}
export const BRAND51 = { invalid: 'Enter both colours as #RRGGBB.', invalidExport: 'Enter valid #RRGGBB colours before export.', changed: 'Draft changed; check again.', preview: 'Draft brand promise preview', filename: 'LYNQ-Lesson-51-Brand-Tokens.json', defaultInk: '#0B2338', defaultPaper: '#FFFFFF' };
/** checkBrand51() status text. */
export function contrastMessage51(ratio: number): string {
  return ratio.toFixed(2) + ':1 — ' + (ratio >= 4.5 ? 'meets 4.5:1 normal-text threshold' : ratio >= 3 ? 'meets 3:1 large-text threshold only' : 'below normal and large text thresholds') + '. Solid pair only; not a full accessibility audit.';
}
/** exportTokens51() JSON. */
export function tokens51(pair: { text: string; background: string; ratio: number }, fields: Record<string, string>): string {
  return JSON.stringify({ lesson: 51, status: 'draft roles; not approved or a complete design system', version: 'learner draft', colors: { text: pair.text, background: pair.background }, contrast: { ratio: pair.ratio, normalText: pair.ratio >= 4.5, largeText: pair.ratio >= 3, scope: 'solid pair only' }, review: ['claims', 'naming and rights', 'English/Arabic', 'interaction and accessibility'], owner: fields.brandHandoff || 'unassigned' }, null, 2);
}

// ---------- Lessons 52, 54, 55 · fixed illustrative explainers ----------
const onboard52: Record<string, string> = {
  available: 'Welcome → explain task → choose a supported route → show next-step guidance. Proposed first-value signal: usable route guidance shown, not merely account created.',
  unavailable: 'Explain unavailability → offer another route or return to start. Preserve a clear recovery action; do not invent a successful response.',
  declined: 'Optional location declined → retain manual route choice in this fictional scenario. Explain actual product limits; do not imply permission was granted.',
  return: 'Returning user → confirm context and offer resume or restart. Real persistence, retention and identity behaviour require separate implementation.',
};
/** runOnboard52(). */
export const runOnboard52 = (kind: string) => 'ILLUSTRATIVE ONLY: ' + onboard52[kind] + ' No custom flow executed, permission requested or service called.';
const triage54: Record<string, string> = {
  contractor: 'Check contributor agreement, prior obligations, intended rights and proposed entity; payment alone does not resolve the chain.',
  thirdparty: 'Locate exact source/version/terms and intended use; preserve unknowns, attribution/restrictions and reviewer before reuse.',
  ai: 'Record tool/model/source context and applicable terms, human contributions and third-party concerns; generation does not establish cleared or exclusive rights.',
  secret: 'Pause unauthorized disclosure; review access, sharing scope and protection timing with an appropriate qualified reviewer before the demo.',
};
/** triageIP54(). */
export const triageIP54 = (kind: string) => 'ILLUSTRATIVE QUESTIONS ONLY: ' + triage54[kind] + ' No asset, agreement, right or protection verified.';
const team55: Record<string, string> = {
  draft: 'A bounded anonymous draft may be prepared within authorized inputs/tools/caps; human reviews accuracy and owns the outcome. This example does not execute it.',
  publish: 'External publication or messages require explicit appropriate authority and review; a prepared draft is not permission to send.',
  spend: 'Purchases or contracts require the responsible human decision and spending/signing authority; do not infer authority from a role title.',
  access: 'Production access changes and private-data disclosure require appropriate authorization, scoped controls and review; stop when permission is missing.',
};
/** explainTeam55(). */
export const explainTeam55 = (kind: string) => 'ILLUSTRATIVE BOUNDARY ONLY: ' + team55[kind] + ' No action executed or authority granted.';

// ---------- Lesson 53 · share arithmetic ----------
/** calculateShares53(): hypothetical equal-rights issued-share dilution. */
export function calculateShares53(a: string, b: string, issued: string): string {
  const raw = [a, b, issued].map(x => x.trim()), v = raw.map(Number);
  if (raw.some(x => !x) || v.some(x => !Number.isSafeInteger(x) || x < 0 || x > 1000000000) || v[0] + v[1] === 0)
    return 'Enter non-negative whole numbers up to 1,000,000,000; existing total must be greater than zero.';
  const before = v[0] + v[1], after = before + v[2], pct = (x: number) => (100 * x).toFixed(2) + '%';
  return 'HYPOTHETICAL: existing total ' + before + ', after issuance ' + after + '. A: ' + pct(v[0] / before) + ' → ' + pct(v[0] / after) + '; B: ' + pct(v[1] / before) + ' → ' + pct(v[1] / after) + '; new holder: ' + pct(v[2] / after) + '. Rounded display; equal-rights issued shares only. No allocation, valuation, agreement or legal rights established.';
}

// ---------- Lesson 56 · cash model ----------
export const cashKeys56 = ['opening', 'upfront', 'receipts', 'payments', 'funding', 'buffer'] as const;
export type CashKey = typeof cashKeys56[number];
export const CASH_SCENARIOS56 = ['base', 'downside', 'nofunding'];
export const CASH56 = {
  changed: 'Inputs changed; calculate again. Draft assumptions only.',
  invalid: 'Enter all amounts as non-negative numbers up to 1,000,000,000 with at most two decimal places.',
  caption: 'Twelve-month cash scenario — AED, fictional defaults/learner estimates',
  headers: ['Month', 'Opening', 'Customer cash in', 'Cash out', 'Closing'],
  filename: 'LYNQ-Lesson-56-Cash-Scenario.json',
};
export type CashRow = { month: number; opening: number; customerCollections: number; cashPayments: number; closing: number };
export type CashModel = {
  status: string; currencyLabel: string; scenario: string; input: Record<CashKey, number>;
  effective: { receipts: number; payments: number; funding: number }; start: number; netBurn: number; runwayMonths: number | null; buffer: number;
  firstBelowBuffer: number | null; firstNegative: number | null; rows: CashRow[]; limits: string;
};
/** cashModel56(): null when any amount is blank, negative, > 1e9 or has more than two decimals. */
export function cashModel56(values: Record<CashKey, string>, scenario: string): CashModel | null {
  const input = {} as Record<CashKey, number>;
  for (const k of cashKeys56) {
    const raw = String(values[k] ?? '').trim(), v = Number(raw);
    if (!raw || !Number.isFinite(v) || v < 0 || v > 1000000000 || Math.abs(v * 100 - Math.round(v * 100)) > 0.0001) return null;
    input[k] = v;
  }
  const receipts = Math.round(input.receipts * 100 * (scenario === 'downside' ? 0.7 : 1)) / 100;
  const payments = Math.round(input.payments * 100 * (scenario === 'downside' ? 1.2 : 1)) / 100;
  const funding = scenario === 'nofunding' ? 0 : input.funding;
  const start = (Math.round(input.opening * 100) + Math.round(funding * 100) - Math.round(input.upfront * 100)) / 100;
  let balance = start;
  const rows: CashRow[] = [];
  for (let month = 1; month <= 12; month++) {
    const opening = balance;
    balance = (Math.round(opening * 100) + Math.round(receipts * 100) - Math.round(payments * 100)) / 100;
    rows.push({ month, opening, customerCollections: receipts, cashPayments: payments, closing: balance });
  }
  const burn = (Math.round(payments * 100) - Math.round(receipts * 100)) / 100;
  const runway = start < 0 ? 0 : burn > 0 ? start / burn : null;
  return {
    status: 'assumption-based uniform cash exercise; no evidence verified', currencyLabel: 'AED; one currency, no conversion', scenario, input,
    effective: { receipts, payments, funding }, start, netBurn: burn > 0 ? burn : 0, runwayMonths: runway, buffer: input.buffer,
    firstBelowBuffer: start < input.buffer ? 0 : rows.find(x => x.closing < input.buffer)?.month ?? null,
    firstNegative: start < 0 ? 0 : rows.find(x => x.closing < 0)?.month ?? null,
    rows, limits: 'start funding/upfront, constant monthly collections/payments; no intra-month timing or separate tax/debt/working-capital model; no guaranteed runway',
  };
}
export const money56 = (v: number) => v.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** runCash56() status text. */
export function cashMessage56(m: CashModel): string {
  return 'ASSUMPTION-BASED ' + m.scenario + ': start after financing/upfront AED ' + money56(m.start) + '. '
    + (m.start < 0 ? 'Immediate modeled cash shortfall.' : m.runwayMonths === null ? 'No positive constant net burn; no finite runway from this formula (not a guarantee).' : 'Simple constant-burn runway ' + m.runwayMonths.toFixed(2) + ' months; timing may differ.')
    + ' First closing cash below buffer: ' + (m.firstBelowBuffer === null ? 'none within modeled period' : m.firstBelowBuffer === 0 ? 'at start' : 'month ' + m.firstBelowBuffer)
    + '. First negative cash: ' + (m.firstNegative === null ? 'none within modeled period' : m.firstNegative === 0 ? 'at start' : 'month ' + m.firstNegative)
    + '. No balances/funding verified; negative modeled cash is a gap, not automatic borrowing.';
}
/** exportCash56() JSON. */
export const cashExport56 = (fields: Record<string, string>, m: CashModel) => JSON.stringify({ lesson: 56, worksheet: fields, model: m }, null, 2);

// ---------- Lesson 57 · fixed-schema sample events ----------
export const SAMPLE57 = {
  loaded: 'Fictional sample loaded; check to calculate. No real events.',
  changed: 'Sample changed; check again. Fictional data only.',
  filename: 'LYNQ-Lesson-57-Sample-Result.json',
};
export const sampleRows57 = [
  { event_id: 'sample_e1', session_id: 'sample_a', event: 'onboarding_started', timestamp: '2026-01-01T10:00:00Z' },
  { event_id: 'sample_e2', session_id: 'sample_a', event: 'first_value_reached', timestamp: '2026-01-01T10:01:00Z' },
  { event_id: 'sample_e3', session_id: 'sample_b', event: 'onboarding_started', timestamp: '2026-01-01T10:02:00Z' },
  { event_id: 'sample_e4', session_id: 'sample_b', event: 'route_unavailable', timestamp: '2026-01-01T10:03:00Z' },
];
export const loadSample57 = () => JSON.stringify(sampleRows57, null, 2);
export type SampleModel = { status: string; eventCount: number; startedSessions: number; completedSessions: number; completionRate: number | null; orphanFirstValueEvents: number; beforeStartFirstValueEvents: number; unavailableEvents: number; limits: string };
/** sampleModel57(): funnel starts/completions from fictional events, with the legacy schema rules. */
export function sampleModel57(raw: string): SampleModel | { error: string } {
  if (raw.length > 40000) return { error: 'Sample exceeds 40,000 characters.' };
  let rows: unknown;
  try { rows = JSON.parse(raw); } catch { return { error: 'Enter a JSON array of fictional sample events.' }; }
  if (!Array.isArray(rows) || rows.length > 100) return { error: 'Use an array of at most 100 events.' };
  const ids = new Set<string>(), allowed = ['onboarding_started', 'first_value_reached', 'route_unavailable'];
  for (const r of rows) {
    const row = r as Record<string, unknown>;
    if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).sort().join(',') !== 'event,event_id,session_id,timestamp' || typeof row.event_id !== 'string' || typeof row.session_id !== 'string'
      || !/^sample_[a-z0-9_-]{1,60}$/.test(row.event_id) || !/^sample_[a-z0-9_-]{1,60}$/.test(row.session_id) || !allowed.includes(row.event as string) || typeof row.timestamp !== 'string'
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(row.timestamp) || !Number.isFinite(Date.parse(row.timestamp)) || new Date(row.timestamp).toISOString().replace('.000Z', 'Z') !== row.timestamp)
      return { error: 'Invalid fixed schema: exactly allowed keys, sample_* IDs, known event and valid UTC second timestamp required. No real identifiers/properties.' };
    if (ids.has(row.event_id)) return { error: 'Duplicate event_id; resolve duplicates before calculating.' };
    ids.add(row.event_id);
  }
  const events = rows as { event_id: string; session_id: string; event: string; timestamp: string }[];
  const starts = new Map<string, number>();
  events.forEach(x => { if (x.event === 'onboarding_started') { const time = Date.parse(x.timestamp); starts.set(x.session_id, Math.min(starts.get(x.session_id) ?? Infinity, time)); } });
  const completed = new Set<string>();
  let orphan = 0, before = 0;
  events.forEach(x => {
    if (x.event === 'first_value_reached') {
      const start = starts.get(x.session_id);
      if (start === undefined) orphan++; else if (Date.parse(x.timestamp) < start) before++; else completed.add(x.session_id);
    }
  });
  return {
    status: 'fictional sample only; no live tracking or verified customer evidence', eventCount: events.length, startedSessions: starts.size, completedSessions: completed.size,
    completionRate: starts.size ? completed.size / starts.size : null, orphanFirstValueEvents: orphan, beforeStartFirstValueEvents: before,
    unavailableEvents: events.filter(x => x.event === 'route_unavailable').length,
    limits: 'distinct sample sessions, earliest start, first value at/after start, no additional time window, no user retention/revenue/causality or privacy approval',
  };
}
/** checkSample57() status text. */
export function sampleMessage57(m: SampleModel | { error: string }): string {
  if ('error' in m) return m.error;
  return 'FICTIONAL SAMPLE: ' + m.completedSessions + ' / ' + m.startedSessions + ' started sessions reached first value; ' + (m.completionRate === null ? 'no denominator/rate' : (m.completionRate * 100).toFixed(2) + '% under fixed rules') + '. Events ' + m.eventCount + '; unavailable events ' + m.unavailableEvents + '; first-value without start ' + m.orphanFirstValueEvents + '; before-start first-value ' + m.beforeStartFirstValueEvents + '. Not real conversion, retention, revenue or validated demand.';
}
export const sampleExport57 = (m: SampleModel) => JSON.stringify({ lesson: 57, result: m }, null, 2);

// ---------- Lessons 58, 59 · hypothetical gates ----------
/** explainBeta58(). */
export function betaGate58(build: string, data: string, measure: string, support: string): string {
  const checks = [['version/checks/controls', build], ['cohort/data/participation', data], ['measurement/quality', measure], ['support/stop/recovery', support]];
  const gaps = checks.filter(x => x[1] !== 'ready');
  return gaps.length ? 'BLOCKED IN HYPOTHETICAL EXERCISE: ' + gaps.map(x => x[0]).join('; ') + '. Resolve with actual evidence and owners. No beta action.'
    : 'ELIGIBLE FOR HUMAN REVIEW IN HYPOTHETICAL EXERCISE ONLY. Real evidence, boundaries and decision authority still require review. No beta starts or approval is granted.';
}
/** explainFix59(). */
export function fixGate59(artifact: string, tests: string, controls: string, recovery: string): string {
  const checks = [['artifact/version', artifact], ['acceptance/regression', tests], ['controls/blockers', controls], ['recovery/owner', recovery]];
  const gaps = checks.filter(x => x[1] !== 'ready');
  return gaps.length ? 'BLOCKED IN HYPOTHETICAL EXERCISE: ' + gaps.map(x => x[0] + ' (' + x[1] + ')').join('; ') + '. Resolve with actual evidence/owners. No change released.'
    : 'ELIGIBLE FOR HUMAN REVIEW IN HYPOTHETICAL EXERCISE ONLY. Actual artifact, evidence, compatibility and authority still require review. No implementation, approval or release occurs.';
}

// ---------- Lesson 60 · readiness register summary ----------
export const readyDomains60 = ['Product and task', 'Controls and data', 'Brand and onboarding', 'Formation and IP', 'Team and authority', 'Cash and operations', 'Analytics and quality', 'Beta and improvements'];
/** readinessSummary60(): coverage/status only. */
export function readinessSummary60(state: LessonState) {
  const rows = (Array.isArray(state.readyRows) ? state.readyRows : []) as { id: string; domain: string; status: string; critical: boolean }[];
  const missing = readyDomains60.filter(d => !rows.some(x => x.domain === d));
  const unreviewed = rows.filter(x => x.status !== 'Learner-reported reviewed / evidence referenced').map(x => x.id);
  const critical = rows.filter(x => x.critical === true).map(x => x.id);
  return {
    status: missing.length || unreviewed.length || critical.length ? 'HOLD / GAPS IN LEARNER REGISTER' : 'ELIGIBLE FOR FURTHER HUMAN REVIEW ONLY',
    missingDomains: missing, unreviewedRecords: unreviewed, criticalBlockers: critical, recordCount: rows.length,
    limits: 'coverage/status only; no source inspection, sufficiency, legal/security/financial certification or launch authority',
  };
}
/** summarizeReady60() status text. */
export function readinessMessage60(state: LessonState): string {
  const x = readinessSummary60(state);
  return x.status + '. Missing domains: ' + (x.missingDomains.join('; ') || 'none') + '. Unreviewed: ' + (x.unreviewedRecords.join(', ') || 'none') + '. Critical blockers: ' + (x.criticalBlockers.join(', ') || 'none') + '. ' + x.limits + '. No launch action.';
}

// ---------- prompt workbenches (all lessons with prepare*/export*Prompt) ----------
export type PromptSpec = { roles: Record<string, string>; taskPrefix: string; middle: string; cashSuffix?: string; empty: string; filename: string };
/** prepare*(role): 'ROLE: ' + role + task + boundaries + brief() (+ Lesson 56 helper result). */
export function preparePrompt(spec: PromptSpec, role: string, briefText: string, cashModel?: CashModel | null): string {
  return 'ROLE: ' + role + spec.taskPrefix + spec.roles[role] + spec.middle + briefText + (spec.cashSuffix !== undefined ? spec.cashSuffix + JSON.stringify(cashModel ?? null, null, 2) : '');
}

/** Lesson 56 input defaults (legacy `value` attributes) and the values cashModel56 reads (draft or default). */
export const CASH_DEFAULTS56: Record<CashKey, string> = { opening: '100000', upfront: '20000', receipts: '10000', payments: '20000', funding: '0', buffer: '10000' };
export function cashValues56(state: LessonState): { values: Record<CashKey, string>; scenario: string } {
  const draft = (state.cashDraft && typeof state.cashDraft === 'object' ? state.cashDraft : {}) as Record<string, unknown>;
  const values = Object.fromEntries(cashKeys56.map(k => [k, typeof draft[k] === 'string' ? draft[k] as string : CASH_DEFAULTS56[k]])) as Record<CashKey, string>;
  const scenario = typeof draft.scenario === 'string' && CASH_SCENARIOS56.includes(draft.scenario) ? draft.scenario : 'base';
  return { values, scenario };
}
