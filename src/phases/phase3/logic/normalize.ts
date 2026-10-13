// Normalise Phase 03 lesson-specific saved data. The legacy load() accepted any record with
// `fields` and `answers`, and each tool re-checked its own keys on use (Array.isArray, typeof,
// allowed-value lists). Here those checks run once on load: malformed values are dropped,
// valid data is kept under the same keys/shapes, and register rows are capped at the legacy limits.
import { normalizeRegister, registers } from './registers';
import { CASH_SCENARIOS56, CONTRACT_CASES48, cashKeys56 } from './tools';

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Keys owned by Phase 03 tools; anything else is passed through untouched. */
const owned = new Set([...Object.values(registers).map(r => r.key), 'contractDraft', 'contractCase', 'brandInk', 'brandPaper', 'cashDraft', 'sampleDraft']);

export function normalizeExtra(n: number, raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = Object.fromEntries(Object.entries(raw).filter(([k]) => !owned.has(k)));
  const register = registers[n];
  if (register) {
    const rows = normalizeRegister(register, raw[register.key]);
    if (rows) out[register.key] = rows;
  }
  if (n === 48) {
    if (typeof raw.contractDraft === 'string') out.contractDraft = raw.contractDraft;
    if (typeof raw.contractCase === 'string' && CONTRACT_CASES48.includes(raw.contractCase)) out.contractCase = raw.contractCase;
  }
  if (n === 51) {
    if (typeof raw.brandInk === 'string') out.brandInk = raw.brandInk;
    if (typeof raw.brandPaper === 'string') out.brandPaper = raw.brandPaper;
  }
  if (n === 56 && isObject(raw.cashDraft)) {
    const draft: Record<string, string> = {};
    for (const k of cashKeys56) if (typeof raw.cashDraft[k] === 'string') draft[k] = raw.cashDraft[k] as string;
    if (typeof raw.cashDraft.scenario === 'string' && CASH_SCENARIOS56.includes(raw.cashDraft.scenario)) draft.scenario = raw.cashDraft.scenario;
    out.cashDraft = draft;
  }
  if (n === 57 && typeof raw.sampleDraft === 'string') out.sampleDraft = raw.sampleDraft;
  return out;
}
