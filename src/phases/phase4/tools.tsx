import { useId, useState } from 'react';
import type { ExtensionProps } from '../../lesson-system/types';
import { Nodes } from '../../lesson-system/components/Content';
import { readProgress } from '../../progress';
import type { AgentPromptConfig, BriefConfig, CalcConfig, RowInput, RowToolConfig } from './types';
import { addRow, cardText, countsText, exportJson, rowsOf, summarize, summaryText, type Row } from './rows.logic';
import { calculators } from './calc.logic';
import { board67, moveDeal, pipeStages67 } from './pipeline.logic';
import { buildAgentPrompt, buildBrief } from './brief.logic';
import { download } from './download';
import './phase4.css';

type Draft = Record<string, string | boolean>;
const blankDraft = (inputs: RowInput[]): Draft => Object.fromEntries(inputs.map(i => [i.domId, i.kind === 'checkbox' ? false : i.kind === 'select' ? i.options?.[0] ?? '' : '']));

/** Register entry form shared by the row logs and the Lesson 67 board. */
function RowForm({ config, rows, update, onStatus, onChanged }: { config: RowToolConfig; rows: Row[]; update: ExtensionProps['update']; onStatus: (text: string) => void; onChanged?: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => blankDraft(config.inputs));
  const base = useId();
  const set = (id: string, value: string | boolean) => setDraft(d => ({ ...d, [id]: value }));
  const add = () => {
    const result = addRow(rows, draft, config);
    if ('error' in result) { onStatus(result.error); return; }
    update({ [config.stateKey]: result.rows });
    // Legacy clears the text inputs and any checkbox; select choices are kept.
    setDraft(d => ({ ...d, ...Object.fromEntries(config.inputs.filter(i => i.kind !== 'select').map(i => [i.domId, i.kind === 'checkbox' ? false : ''])) }));
    onStatus(config.messages.added);
    onChanged?.();
  };
  return <>
    {config.inputs.map(input => {
      const id = `${base}-${input.domId}`;
      if (input.kind === 'checkbox') return <label key={input.domId} className="check" htmlFor={id}><input id={id} type="checkbox" checked={draft[input.domId] === true} onChange={e => set(input.domId, e.target.checked)} /> {input.label}</label>;
      return <div key={input.domId}>
        <label htmlFor={id}>{input.label}</label>
        {input.kind === 'select'
          ? <select id={id} value={String(draft[input.domId])} onChange={e => set(input.domId, e.target.value)}>{input.options!.map(o => <option key={o} value={o}>{o}</option>)}</select>
          : input.kind === 'textarea'
            ? <textarea id={id} dir="auto" maxLength={input.maxLength} value={String(draft[input.domId])} onChange={e => set(input.domId, e.target.value)} />
            : <input id={id} dir="auto" maxLength={input.maxLength} value={String(draft[input.domId])} onChange={e => set(input.domId, e.target.value)} />}
      </div>;
    })}
    <div className="actions"><button type="button" className="secondary" onClick={add}>{config.addLabel}</button></div>
  </>;
}

/** Lessons 61–66, 68–80: legacy proposed/learner-reported registers (cards, remove, counts, summary, JSON export). */
export function RowLog({ state, update, navigate, props }: ExtensionProps) {
  const config = props as unknown as RowToolConfig;
  const rows = rowsOf(state, config.stateKey);
  const [status, setStatus] = useState('');
  const [summary, setSummary] = useState('');
  const changed = () => { if (config.summary) setSummary(config.summary.changed); };
  return <div className="note p4-tool">
    <h3>{config.title}</h3>
    <Nodes nodes={config.intro} navigate={navigate} />
    <RowForm config={config} rows={rows} update={update} onStatus={setStatus} onChanged={changed} />
    <p role="status">{status}</p>
    {config.counts && <p role="status">{countsText(rows, config.counts)}</p>}
    <div>{rows.map((row, i) => <div className="note p4-card" key={i}>{cardText(row, config.card)}<br />
      <button type="button" className="secondary" onClick={() => { update({ [config.stateKey]: rows.filter((_, j) => j !== i) }); changed(); }}>{config.removeLabel}{config.removeBy === 'id' ? String(row.id) : i + 1}</button></div>)}</div>
    {config.summary && <><div className="actions"><button type="button" className="secondary" onClick={() => setSummary(summaryText(summarize(rows, config.summary!)))}>{config.summary.label}</button></div>
      <p role="status">{summary}</p></>}
    <div className="actions"><button type="button" className="secondary" onClick={() => download(exportJson(state, config), config.exportFilename)}>{config.exportLabel}</button></div>
    <Nodes nodes={config.notes} navigate={navigate} />
  </div>;
}

function DealCard({ row, index, rows, config, update, onStatus }: { row: Row; index: number; rows: Row[]; config: RowToolConfig; update: ExtensionProps['update']; onStatus: (text: string) => void }) {
  const [stage, setStage] = useState(String(row.stage));
  const [note, setNote] = useState('');
  const base = useId();
  const id = String(row.id);
  return <div className="note p4-card">
    {cardText(row, config.card)}<br />
    <label htmlFor={`${base}-stage`}>{board67.stageLabel(id)}</label>
    <select id={`${base}-stage`} value={stage} onChange={e => setStage(e.target.value)}>{pipeStages67.map(s => <option key={s} value={s}>{s}</option>)}</select>
    <label htmlFor={`${base}-note`}>{board67.noteLabel(id)}</label>
    <textarea id={`${base}-note`} dir="auto" maxLength={1000} value={note} onChange={e => setNote(e.target.value)} />
    <div className="actions">
      <button type="button" className="secondary" onClick={() => {
        const result = moveDeal(rows, index, stage, note);
        if ('error' in result) { onStatus(result.error); return; }
        update({ dealRows: result.rows }); setNote(''); onStatus(result.message);
      }}>{board67.move(id)}</button>
      <button type="button" className="secondary" onClick={() => update({ dealRows: rows.filter((_, j) => j !== index) })}>{config.removeLabel}{id}</button>
    </div>
  </div>;
}

/** Lesson 67: simulated pipeline board with stage columns, evidence-noted moves, history and removal. */
export function Pipeline67({ state, update, navigate, props }: ExtensionProps) {
  const config = props as unknown as RowToolConfig;
  const rows = rowsOf(state, 'dealRows');
  const [status, setStatus] = useState('');
  return <div className="note p4-tool">
    <h3>{config.title}</h3>
    <Nodes nodes={config.intro} navigate={navigate} />
    <RowForm config={config} rows={rows} update={update} onStatus={setStatus} />
    <p role="status">{status}</p>
    {config.counts && <p role="status">{countsText(rows, config.counts)}</p>}
    <div className="p4-board">{pipeStages67.map(stage => <section className="note" key={stage} aria-label={board67.column(stage)}>
      <h3>{board67.column(stage)}</h3>
      {rows.map((row, i) => row.stage === stage ? <DealCard key={`${String(row.id)}-${i}-${stage}-${(row.history as unknown[]).length}`} row={row} index={i} rows={rows} config={config} update={update} onStatus={setStatus} /> : null)}
    </section>)}</div>
    <div className="actions"><button type="button" className="secondary" onClick={() => download(exportJson(state, config), config.exportFilename)}>{config.exportLabel}</button></div>
    <Nodes nodes={config.notes} navigate={navigate} />
  </div>;
}

/** Lessons 66 / 73 / 76: local scenario calculators. Inputs persist under calc66 / rate73 / review76. */
export function Calculator({ state, update, navigate, props }: ExtensionProps) {
  const config = props as unknown as CalcConfig;
  const raw = state[config.stateKey];
  const values = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const [result, setResult] = useState(config.initial);
  const base = useId();
  return <div className="note p4-tool">
    <h3>{config.title}</h3>
    <Nodes nodes={config.intro} navigate={navigate} />
    {config.inputs.map(input => <div key={input.domId}>
      <label htmlFor={`${base}-${input.domId}`}>{input.label}</label>
      <input id={`${base}-${input.domId}`} type={input.type} dir={input.type === 'text' ? 'auto' : undefined} maxLength={input.maxLength} min={input.min} step={input.step} max={input.max}
        value={typeof values[input.domId] === 'string' ? values[input.domId] as string : ''}
        onChange={e => { update({ [config.stateKey]: { ...values, [input.domId]: e.target.value } }); setResult(config.changed); }} />
    </div>)}
    <div className="actions"><button type="button" className="secondary" onClick={() => setResult(calculators[config.stateKey](values))}>{config.buttonLabel}</button></div>
    <p role="status">{result}</p>
    <Nodes nodes={config.notes} navigate={navigate} />
  </div>;
}

/** Agent prompt workbench: role prompts built from the current brief; nothing is sent anywhere. */
export function AgentPrompt({ lesson, state, navigate, props }: ExtensionProps) {
  const config = props as unknown as AgentPromptConfig;
  const [text, setText] = useState('');
  const id = useId();
  return <div className="note p4-tool">
    <h3>{config.title}</h3>
    <Nodes nodes={config.intro} navigate={navigate} />
    <div className="actions">{config.roles.map(r => <button type="button" className="secondary" key={r.role} onClick={() => setText(buildAgentPrompt(config, r.role, buildBrief(lesson, state)))}>{r.label}</button>)}</div>
    <textarea id={id} className="p4-prompt" readOnly aria-label={config.ariaLabel} value={text} />
    <div className="actions"><button type="button" className="secondary" onClick={() => { if (!text) { setText(config.emptyMessage); return; } download(text, config.filename); }}>{config.downloadLabel}</button></div>
  </div>;
}

/** Preview / download of the legacy Launch Markdown brief. */
export function Brief({ lesson, state, props }: ExtensionProps) {
  const config = props as unknown as BriefConfig;
  const [open, setOpen] = useState(false);
  return <div>
    <div className="actions">
      <button type="button" className="secondary" aria-expanded={open} onClick={() => setOpen(true)}>{config.previewLabel}</button>
      <button type="button" className="secondary" onClick={() => download(buildBrief(lesson, state), lesson.deliverable.filename)}>{config.downloadLabel}</button>
    </div>
    {open && <pre className="deliverable-preview" tabIndex={0} aria-label="Deliverable preview">{buildBrief(lesson, state)}</pre>}
  </div>;
}

export const moduleLessons = (module: string) => { const m = Number(module.split('.')[1]); return Array.from({ length: 5 }, (_, i) => 60 + (m - 1) * 5 + i + 1); };
export const moduleStatusText = (module: string, complete: number[], suffix: string) => `Module ${module}: ${moduleLessons(module).filter(n => complete.includes(n)).length} / 5. ${suffix}`;

/** Legacy `#moduleStatus`: validated local completions in this lesson's module. */
export function ModuleStatus({ props }: ExtensionProps) {
  const { module, suffix } = props as { module: string; suffix: string };
  // Re-rendered whenever the lesson record changes, so the persisted completion is current.
  let complete: number[] = [];
  try { complete = readProgress().complete; } catch { complete = []; }
  return <p>{moduleStatusText(module, complete, suffix)}</p>;
}
