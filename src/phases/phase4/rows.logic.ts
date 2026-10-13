import type { LessonState } from '../../lesson-system/types';
import type { CardPart, CountsConfig, ExportEntry, RowToolConfig, SummaryConfig } from './types';

export type Row = Record<string, unknown>;

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Row registers and their required string keys / limits, exactly as in the legacy `load(n)`. */
export const rowSpecs: Record<string, { keys: string[]; limit: number }> = {
  gateRows: { keys: ['id', 'kind', 'source', 'text', 'meaning', 'review'], limit: 30 },
  planRows: { keys: ['id', 'kind', 'source', 'text', 'meaning', 'review'], limit: 30 },
  roomRows: { keys: ['id', 'kind', 'source', 'text', 'meaning', 'review'], limit: 30 },
  processRows: { keys: ['id', 'kind', 'source', 'text', 'meaning', 'review'], limit: 30 },
  performanceRows: { keys: ['id', 'kind', 'source', 'text', 'meaning', 'review'], limit: 30 },
  retentionRows: { keys: ['id', 'kind', 'source', 'text', 'meaning', 'review'], limit: 30 },
  feedbackRows: { keys: ['id', 'kind', 'source', 'text', 'meaning', 'review'], limit: 30 },
  measureRows: { keys: ['id', 'type', 'definition', 'source', 'observed', 'review'], limit: 30 },
  customerRows: { keys: ['id', 'status', 'scope', 'observed', 'handoff', 'review'], limit: 30 },
  releaseRows: { keys: ['id', 'type', 'scope', 'evidence', 'status', 'review'], limit: 30 },
  supportRows: { keys: ['id', 'type', 'scenario', 'steps', 'evidence', 'review'], limit: 20 },
  campaignRows: { keys: ['id', 'audience', 'creative', 'path', 'owner'], limit: 20 },
  journeyRows: { keys: ['id', 'area', 'scope', 'observed', 'status', 'owner'], limit: 30 },
  dealRows: { keys: ['id', 'stage', 'context', 'evidence', 'owner'], limit: 20 },
  packageRows: { keys: ['id', 'scope', 'charge', 'evidence', 'review'], limit: 20 },
  assetRows: { keys: ['id', 'type', 'purpose', 'content', 'source', 'owner'], limit: 20 },
  messageRows: { keys: ['id', 'type', 'audience', 'text', 'evidence', 'review'], limit: 20 },
  actionRows: { keys: ['id', 'stage', 'plan', 'evidence', 'metric', 'owner'], limit: 20 },
  goalRows: { keys: ['id', 'type', 'metric', 'baseline', 'target', 'owner'], limit: 20 },
  channelRows: { keys: ['id', 'name', 'evidence', 'test', 'owner'], limit: 20 },
};
export const calcKeys = ['calc66', 'rate73', 'review76'] as const;

/** Legacy filter: rows must carry every required key as a string; then the slice limit applies. */
export function normalizeRowList(raw: unknown, key: string): Row[] {
  const spec = rowSpecs[key];
  if (!spec || !Array.isArray(raw)) return [];
  const rows = raw.filter(r => isObject(r) && spec.keys.every(k => typeof r[k] === 'string')).slice(0, spec.limit) as Row[];
  return key === 'dealRows' ? rows.map(r => ({ ...r, history: Array.isArray(r.history) ? r.history.slice(-40) : [] })) : rows;
}

/**
 * Mirror of the legacy Launch `load(n)`: every lesson record carries all registers (fresh defaults),
 * unknown keys are preserved, malformed registers reset to empty, calculator inputs must be objects.
 */
export function normalizeExtra(_n: number, raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };
  for (const key of Object.keys(rowSpecs)) out[key] = normalizeRowList(raw[key], key);
  for (const key of calcKeys) out[key] = isObject(raw[key]) ? raw[key] : {};
  return out;
}

export const rowsOf = (state: LessonState, key: string): Row[] => normalizeRowList(state[key], key);
export const str = (value: unknown) => typeof value === 'string' ? value : value === undefined ? 'undefined' : String(value);

/** Validate and append a register row with the legacy checks and key order. */
export function addRow(rows: Row[], draft: Record<string, string | boolean>, config: Pick<RowToolConfig, 'prefix' | 'keys' | 'limit' | 'messages'>): { rows: Row[] } | { error: string } {
  const row: Row = {};
  for (const p of config.prefix) row[p.key] = 'input' in p ? draft[p.input] : Array.isArray(p.value) ? [...p.value] : p.value;
  for (const { key, input } of config.keys) {
    const value = typeof draft[input] === 'string' ? (draft[input] as string).trim() : '';
    row[key] = value;
    if (!value) return { error: config.messages.missing };
  }
  if (rows.some(x => str(x.id).toLowerCase() === str(row.id).toLowerCase())) return { error: config.messages.duplicate };
  if (rows.length >= config.limit) return { error: config.messages.limit };
  return { rows: [...rows, row] };
}

export function cardText(row: Row, parts: CardPart[]): string {
  return parts.map(p => 'text' in p && !('flag' in p) ? p.text : 'key' in p ? str(row[p.key]) : 'flag' in p ? (row[p.flag] ? p.text : '') : JSON.stringify(row[p.json])).join('');
}

export function countsText(rows: Row[], counts: CountsConfig): string {
  return counts.prefix + counts.options.map(option => option + ' ' + rows.filter(r => r[counts.key] === option).length).join(' · ') + counts.suffix;
}

export function summarize(rows: Row[], s: SummaryConfig) {
  const missing = s.areas.filter(area => !rows.some(r => r[s.areaKey] === area));
  const unresolved = rows.filter(r => r.status !== s.passed).map(r => r.id);
  const critical = rows.filter(r => r.critical === true).map(r => r.id);
  return { status: missing.length || unresolved.length || critical.length ? s.hold : s.ok, missingAreas: missing, unresolvedRecords: unresolved, criticalBlockers: critical, limits: s.limits };
}

export function summaryText(x: ReturnType<typeof summarize>): string {
  return x.status + '. Missing areas: ' + (x.missingAreas.join('; ') || 'none') + '. Unresolved: ' + (x.unresolvedRecords.join(', ') || 'none') + '. Critical: ' + (x.criticalBlockers.join(', ') || 'none') + '. ' + x.limits;
}

/** The register JSON export, keys in legacy order. */
export function exportJson(state: LessonState, config: Pick<RowToolConfig, 'exportPayload' | 'stateKey' | 'summary'>): string {
  const payload: Record<string, unknown> = {};
  for (const entry of config.exportPayload as ExportEntry[]) {
    if (entry.kind === 'const') payload[entry.name] = entry.value;
    else if (entry.kind === 'fields') payload[entry.name] = state.fields;
    else if (entry.kind === 'state') payload[entry.name] = entry.key in rowSpecs ? rowsOf(state, entry.key) : (isObject(state[entry.key]) ? state[entry.key] : {});
    else if (config.summary) payload[entry.name] = summarize(rowsOf(state, config.stateKey), config.summary);
  }
  return JSON.stringify(payload, null, 2);
}
