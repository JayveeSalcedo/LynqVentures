import { useId, useState } from 'react';
import type { LessonState } from '../types';
import { downloadText } from '../deliverable';

export type RecordColumn = {
  id: string;
  label: string;
  kind: 'input' | 'textarea' | 'select';
  options?: string[];
  /** Adding a row is refused until required columns are filled. */
  required?: boolean;
  maxLength?: number;
  /** Stored when an optional column is left empty (e.g. "Not interpreted"). */
  fallback?: string;
  placeholder?: string;
};

export type RecordLogConfig = {
  /** Key inside the lesson record, e.g. "observationRows" (legacy shape preserved). */
  stateKey: string;
  title?: string;
  intro?: string;
  columns: RecordColumn[];
  limit: number;
  addLabel: string;
  messages: { missing: string; limit: string; added: string; removed?: string };
  /** Optional per-row card label, e.g. "Row" → "Row 1 · {first column}". */
  rowLabel?: string;
  allowRemove?: boolean;
  /** Optional standalone export. */
  export?: { label: string; filename: string; title: string; footer?: string; empty?: string };
};

export type RecordRow = Record<string, string>;

/** Keep only rows whose listed columns are strings; cap to the legacy limit. */
export function normalizeRows(raw: unknown, columns: string[], limit: number): RecordRow[] {
  return Array.isArray(raw) ? raw.filter(r => r && typeof r === 'object' && columns.every(k => typeof (r as RecordRow)[k] === 'string')).slice(0, limit) as RecordRow[] : [];
}

export function rowsMarkdown(rows: RecordRow[], columns: RecordColumn[], rowLabel = 'Row', empty = 'No rows recorded.'): string {
  if (!rows.length) return empty;
  return rows.map((row, i) => `### ${rowLabel} ${i + 1}\n` + columns.map(c => `- ${c.label}: ${row[c.id] || 'Not entered'}`).join('\n')).join('\n\n');
}

/** Validate and append a row. Returns the new rows or an error message. */
export function addRow(rows: RecordRow[], draft: Record<string, string>, config: Pick<RecordLogConfig, 'columns' | 'limit' | 'messages'>): { rows: RecordRow[] } | { error: string } {
  if (config.columns.some(c => c.required && !draft[c.id]?.trim())) return { error: config.messages.missing };
  if (rows.length >= config.limit) return { error: config.messages.limit };
  const row = Object.fromEntries(config.columns.map(c => {
    const value = (draft[c.id] ?? (c.kind === 'select' ? c.options?.[0] ?? '' : '')).trim();
    return [c.id, (value || c.fallback || '').slice(0, c.maxLength ?? 1000)];
  }));
  return { rows: [...rows, row] };
}

export function RecordLog({ config, state, update }: { config: RecordLogConfig; state: LessonState; update: (patch: Partial<LessonState>) => void }) {
  const rows = normalizeRows(state[config.stateKey], config.columns.map(c => c.id), config.limit);
  const blank = () => Object.fromEntries(config.columns.map(c => [c.id, c.kind === 'select' ? c.options?.[0] ?? '' : '']));
  const [draft, setDraft] = useState<Record<string, string>>(blank);
  const [status, setStatus] = useState('');
  const base = useId();
  const md = () => `# ${config.export!.title}\n\n${rowsMarkdown(rows, config.columns, config.rowLabel, config.export!.empty)}\n\n${config.export!.footer ?? 'Local learning record. Not verified by the Academy.'}\n`;
  return <div className="tool record-log">
    {config.title && <h3>{config.title}</h3>}
    {config.intro && <p>{config.intro}</p>}
    <form onSubmit={e => {
      e.preventDefault();
      const result = addRow(rows, draft, config);
      if ('error' in result) { setStatus(result.error); return; }
      update({ [config.stateKey]: result.rows }); setDraft(blank()); setStatus(config.messages.added);
    }}>
      <div className="grid2">{config.columns.map(c => {
        const id = `${base}-${c.id}`;
        return <div className="field" key={c.id}><label htmlFor={id}>{c.label}{c.required ? <span aria-hidden="true"> *</span> : ''}</label>
          {c.kind === 'select'
            ? <select id={id} value={draft[c.id]} onChange={e => setDraft({ ...draft, [c.id]: e.target.value })}>{c.options!.map(o => <option key={o} value={o}>{o}</option>)}</select>
            : c.kind === 'textarea'
              ? <textarea id={id} dir="auto" maxLength={c.maxLength ?? 1000} placeholder={c.placeholder} value={draft[c.id]} onChange={e => setDraft({ ...draft, [c.id]: e.target.value })} />
              : <input id={id} dir="auto" maxLength={c.maxLength ?? 1000} placeholder={c.placeholder} value={draft[c.id]} onChange={e => setDraft({ ...draft, [c.id]: e.target.value })} />}
        </div>;
      })}</div>
      <div className="actions"><button type="submit">{config.addLabel}</button>
        {config.export && <button type="button" onClick={() => downloadText(md(), config.export!.filename)}>{config.export.label}</button>}</div>
    </form>
    <p role="status">{status}</p>
    <p>{rows.length} / {config.limit} rows saved locally</p>
    <ol className="record-rows">{rows.map((row, i) => <li key={i} className="row-card">
      <strong>{config.rowLabel ?? 'Row'} {i + 1}</strong>{'\n'}{config.columns.map(c => `${c.label}: ${row[c.id] || 'Not entered'}`).join('\n')}
      {config.allowRemove && <div className="actions"><button type="button" className="secondary" aria-label={`Remove ${config.rowLabel ?? 'row'} ${i + 1}`} onClick={() => { update({ [config.stateKey]: rows.filter((_, j) => j !== i) }); setStatus(config.messages.removed ?? 'Row removed.'); }}>Remove</button></div>}
    </li>)}</ol>
  </div>;
}
