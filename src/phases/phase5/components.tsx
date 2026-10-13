// Typed, configurable Phase 5 (Scale) lesson tools. One component per legacy tool pattern; the
// per-lesson wording and limits come from extension props in the lesson JSON.
import { useId, useMemo, useState } from 'react';
import type { ExtensionProps, LessonState } from '../../lesson-system/types';
import { graduationStatus, readProgress } from '../../progress';
import type { BriefProps, CalculatorProps, CeoWorkbenchProps, CheckPanelProps, CoachProps, GraduationProps, PromptWorkbenchProps, RecordLogProps, RowColumn, StoryProps, VideoPromptProps } from './types';
import {
  GRADUATION_FILENAME, GRADUATION_UNAVAILABLE, addRecord, buildBrief, buildCeoDraft, buildPrompt, calculators, cardText, checkResult, checkValues, coachReply, countsText,
  download, filterStatus, graduationAcknowledgement, graduationMessage, moduleStatusText, recordExport, removeRecord, resolveFn, rowsOf, visibleRows,
} from './logic';
import './phase5.css';

const props = <T,>(p: ExtensionProps) => p.props as unknown as T;
const Paragraphs = ({ items }: { items: string[] }) => <>{items.map((text, i) => <p key={i}>{text}</p>)}</>;

/**
 * Text generated from the current record (prompts, CEO drafts). When `clearOnEdit` is set the text is
 * only shown while the record is unchanged, matching legacy save() which blanked these textareas on every edit.
 */
function useDerivedText(state: LessonState, clearOnEdit: boolean) {
  const [value, setValue] = useState<{ text: string; base: LessonState; isDraft: boolean }>({ text: '', base: state, isDraft: false });
  const live = !clearOnEdit || value.base === state;
  return {
    text: live ? value.text : '',
    isDraft: live && value.isDraft && value.text !== '',
    set: (text: string, isDraft: boolean) => setValue({ text, base: state, isDraft }),
  };
}

/** Six-scene storyboard placeholder and full transcript (legacy #story list). */
export function Story(p: ExtensionProps) {
  const { summary, scenes } = props<StoryProps>(p);
  return <details><summary>{summary}</summary>
    {scenes.map((s, i) => <div className="note" key={i}>{i + 1}. {[s.title, s.visual, s.narration].join(' — ')}</div>)}
  </details>;
}

export function VideoPromptTool(p: ExtensionProps) {
  const c = props<VideoPromptProps>(p);
  const [status, setStatus] = useState('');
  const id = useId();
  return <details><summary>{c.summary}</summary>
    <textarea id={id} readOnly value={c.prompt} aria-label={c.textareaLabel} className="prompt-text" />
    <div className="actions">
      <button type="button" className="secondary" onClick={async () => {
        try { await navigator.clipboard.writeText(c.prompt); setStatus('Prompt copied.'); }
        catch { (document.getElementById(id) as HTMLTextAreaElement | null)?.select(); setStatus('Copy unavailable; select the prompt or download it.'); }
      }}>{c.copyLabel}</button>
      <button type="button" className="secondary" onClick={() => download(c.prompt, c.filename)}>{c.downloadLabel}</button>
    </div>
    <p role="status">{status}</p>
  </details>;
}

/** Simulated coach: four fixed modes with the lesson's scripted reply. No free-text AI. */
export function Coach(p: ExtensionProps) {
  const c = props<CoachProps>(p);
  const [mode, setMode] = useState<string | null>(null);
  return <>
    <div className="actions" role="group" aria-label="Simulated guidance modes">
      {c.modes.map(m => <button type="button" key={m} className={mode === m ? 'selected' : 'secondary'} aria-pressed={mode === m} onClick={() => setMode(m)}>{m}</button>)}
    </div>
    <p role="status" className="coach-message">{mode ? coachReply(c.prefix, mode, c.suffix) : c.initial}</p>
  </>;
}

/** Evidence register (legacy render, add, filter and export functions): typed rows saved under the legacy key. */
export function RecordLogTool(p: ExtensionProps) {
  const c = props<RecordLogProps>(p);
  const { state, update, lesson } = p;
  const rows = rowsOf(state, c.stateKey);
  const blank = () => ({ kind: c.kindField.options[0], id: '', source: '', text: '', meaning: '', review: '' });
  const [draft, setDraft] = useState(blank);
  const [status, setStatus] = useState('');
  const [exceptions, setExceptions] = useState(false);
  const base = useId();
  const set = (key: keyof typeof draft, value: string) => setDraft({ ...draft, [key]: value });
  return <div className="note p5-tool">
    <h3>{c.title}</h3>
    <Paragraphs items={c.intro} />
    <form onSubmit={e => {
      e.preventDefault();
      const result = addRecord(rows, draft, c);
      if ('error' in result) { setStatus(result.error); return; }
      update({ [c.stateKey]: result.rows });
      setDraft({ ...blank(), kind: draft.kind });
      setStatus(c.messages.added);
    }}>
      <label htmlFor={`${base}-id`}>{c.idField.label}</label>
      <input id={`${base}-id`} maxLength={c.idField.maxLength} dir="auto" value={draft.id} onChange={e => set('id', e.target.value)} />
      <label htmlFor={`${base}-kind`}>{c.kindField.label}</label>
      <select id={`${base}-kind`} value={draft.kind} onChange={e => set('kind', e.target.value)}>{c.kindField.options.map(o => <option key={o}>{o}</option>)}</select>
      {c.columns.map(col => <div key={col.key}>
        <label htmlFor={`${base}-${col.key}`}>{col.label}</label>
        <textarea id={`${base}-${col.key}`} maxLength={col.maxLength} dir="auto" value={draft[col.key as RowColumn]} onChange={e => set(col.key, e.target.value)} />
      </div>)}
      <div className="actions"><button type="submit" className="secondary">{c.addLabel}</button></div>
    </form>
    <p role="status">{status}</p>
    <p>{countsText(c, rows)}</p>
    {c.filter && <>
      <div className="actions">
        <button type="button" className="secondary" aria-pressed={!exceptions} onClick={() => setExceptions(false)}>{c.filter.allLabel}</button>
        <button type="button" className="secondary" aria-pressed={exceptions} onClick={() => setExceptions(true)}>{c.filter.exceptionsLabel}</button>
      </div>
      <p role="status">{filterStatus(c, exceptions)}</p>
    </>}
    <div className={c.grid ? 'p5-rows p5-grid' : 'p5-rows'}>
      {visibleRows(rows, c, exceptions).map(({ row, index }) => <div className="note p5-card" key={`${index}-${row.id}`}>
        {cardText(c, row)}
        <br />
        <button type="button" className="secondary" onClick={() => { update({ [c.stateKey]: removeRecord(rows, index) }); }}>{`${c.removeLabel}${index + 1}`}</button>
      </div>)}
    </div>
    <div className="actions"><button type="button" className="secondary" onClick={() => download(recordExport(c, lesson, state), c.exportFilename)}>{c.exportLabel}</button></div>
  </div>;
}

/** Optional check-review panel (Lessons 86–100). Learner labels only; critical blockers dominate. */
export function CheckPanel(p: ExtensionProps) {
  const c = props<CheckPanelProps>(p);
  const values = checkValues(c, p.state);
  return <div className="note p5-tool">
    <h3>{c.title}</h3>
    <Paragraphs items={c.intro} />
    {c.items.map(item => <div key={item.id}>
      <label htmlFor={item.id}>{item.label}</label>
      <select id={item.id} value={values[item.id]} onChange={e => p.setField(item.id, e.target.value)}>{c.options.map(o => <option key={o}>{o}</option>)}</select>
    </div>)}
    <p role="status" className="p5-output">{checkResult(c, p.state)}</p>
  </div>;
}

/** Scenario calculators (84 unit economics, 85 cohort retention, 92 runway, 97 dilution). Inputs live in state.fields as legacy. */
export function Calculator(p: ExtensionProps) {
  const c = props<CalculatorProps>(p);
  const calc = calculators[c.calc];
  const values = calc.values(p.state);
  return <div className="note p5-tool">
    <h3>{c.title}</h3>
    <Paragraphs items={c.intro} />
    {c.items.map(item => item.kind === 'checkbox'
      ? <label className="check" key={item.id}><input id={item.id} type="checkbox" checked={p.state.fields[item.id] === 'yes'} onChange={e => p.setField(item.id, e.target.checked ? 'yes' : 'no')} /> {item.label}</label>
      : <div key={item.id}>
        <label htmlFor={item.id}>{item.label}</label>
        {item.kind === 'select'
          ? <select id={item.id} value={values[item.id]} onChange={e => p.setField(item.id, e.target.value)}>{item.options!.map(o => <option key={o}>{o}</option>)}</select>
          : <input id={item.id} type="number" min={item.min} max={item.max} step="any" inputMode="decimal" value={values[item.id] ?? ''} onChange={e => p.setField(item.id, e.target.value)} />}
      </div>)}
    <pre role="status" className="p5-output">{calc.result(p.state)}</pre>
    <Paragraphs items={c.after} />
  </div>;
}

/** Agent prompt workbench: role prompts for an approved external tool, including the current brief. */
export function PromptWorkbench(p: ExtensionProps) {
  const c = props<PromptWorkbenchProps>(p);
  const out = useDerivedText(p.state, c.clearOnEdit);
  const id = useId();
  return <div className="note p5-tool">
    <h3>{c.title}</h3>
    <Paragraphs items={c.intro} />
    <div className="actions">{c.buttons.map(b => <button type="button" className="secondary" key={b.role} onClick={() => out.set(buildPrompt(c, b.role, buildBrief(p.lesson, p.state)), true)}>{b.label}</button>)}</div>
    <textarea id={id} rows={c.rows} readOnly aria-label={c.textareaLabel} value={out.text} />
    <div className="actions"><button type="button" className="secondary" onClick={() => out.isDraft ? download(out.text, c.filename) : out.set(c.emptyMessage, false)}>{c.downloadLabel}</button></div>
  </div>;
}

/** CEO draft builders (93–100): local text assembly from worksheet notes, records and review gates. */
export function CeoWorkbench(p: ExtensionProps) {
  const c = props<CeoWorkbenchProps>(p);
  const out = useDerivedText(p.state, true);
  return <div className="note p5-tool">
    <h3>{c.title}</h3>
    <Paragraphs items={c.intro} />
    <div className="actions">{c.buttons.map(b => <button type="button" className="secondary" key={b.mode} onClick={() => out.set(buildCeoDraft(c, b.mode, p.lesson, p.state), true)}>{b.label}</button>)}</div>
    <textarea rows={c.rows} readOnly aria-label={c.textareaLabel} value={out.text} />
    <div className="actions"><button type="button" className="secondary" onClick={() => {
      if (out.isDraft) download(out.text, c.filename);
      else if (c.emptyMessage) out.set(c.emptyMessage, false);
    }}>{c.downloadLabel}</button></div>
  </div>;
}

/** Preview/download of the lesson brief (legacy previewBrief/exportBrief). */
export function BriefTool(p: ExtensionProps) {
  const c = props<BriefProps>(p);
  const [open, setOpen] = useState(false);
  return <>
    <div className="actions">
      <button type="button" className="secondary" aria-expanded={open} onClick={() => setOpen(true)}>{c.previewLabel}</button>
      <button type="button" className="secondary" onClick={() => download(buildBrief(p.lesson, p.state), p.lesson.deliverable.filename)}>{c.downloadLabel}</button>
    </div>
    {open && <pre className="deliverable-preview" tabIndex={0} aria-label="Brief preview">{buildBrief(p.lesson, p.state)}</pre>}
  </>;
}

/** Module completion line under the completion button (legacy #moduleStatus). */
export function ModuleStatus(p: ExtensionProps) {
  const module = (p.props as { module: string }).module;
  // Recomputed on every render: the lesson record is persisted before React re-renders.
  return <p>{moduleStatusText(module, readProgress().complete)}</p>;
}

/** Lesson 100 graduation review: Module 00 plus all 100 lessons; learning completion only. */
export function Graduation100(p: ExtensionProps) {
  const c = props<GraduationProps>(p);
  const [tick, setTick] = useState(0);
  const [notice, setNotice] = useState<{ text: string; base: LessonState } | null>(null);
  const status = useMemo(() => graduationStatus(readProgress()), [p.state, tick]);
  const message = notice && notice.base === p.state ? notice.text : graduationMessage(status);
  return <div className="note p5-tool">
    <h3>{c.title}</h3>
    <Paragraphs items={c.intro} />
    <p role="status">{message}</p>
    <div className="actions">
      <button type="button" className="secondary" onClick={() => { setNotice(null); setTick(tick + 1); }}>{c.checkLabel}</button>
      <button type="button" className="secondary" onClick={() => {
        const fresh = graduationStatus(readProgress());
        setTick(tick + 1);
        if (!fresh.eligible) { setNotice({ text: GRADUATION_UNAVAILABLE, base: p.state }); return; }
        setNotice(null);
        download(graduationAcknowledgement(String(resolveFn('finalResult100', p.lesson, p.state))), GRADUATION_FILENAME);
      }}>{c.downloadLabel}</button>
    </div>
    <Paragraphs items={c.after} />
  </div>;
}
