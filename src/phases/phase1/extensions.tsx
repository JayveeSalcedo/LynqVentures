import { useEffect, useId, useState } from 'react';
import type { ContentNode, ExtensionProps } from '../../lesson-system/types';
import { isComplete } from '../../lesson-system/state';
import { downloadText } from '../../lesson-system/deliverable';
import { Worksheet } from '../../lesson-system/components/Blocks';
import { Nodes } from '../../lesson-system/components/Content';
import { readProgress } from '../../progress';
import { buildDeliverable, coachOutput, previewText, schemaOf, statusText, type CoachProps, type PreviewProps, type StatusPart } from './logic';
import './phase1.css';

/** Scripted coach with the legacy four modes. Replies are fixed curriculum text; nothing is sent anywhere. */
export function Coach({ lesson, state, props }: ExtensionProps) {
  const p = props as unknown as CoachProps;
  const [mode, setMode] = useState<string>('teach');
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState(false);
  const id = useId();
  return <div className="p1-coach">
    <div className="actions" role="group" aria-label="Coach modes">{p.modes.map(m => <button type="button" key={m.id} aria-pressed={mode === m.id} className={mode === m.id ? 'selected' : 'secondary'} onClick={() => { setMode(m.id); setAsked(Boolean(question.trim())); }}>{m.label}</button>)}</div>
    <div className="coach-message" aria-live="polite">{coachOutput(lesson.number, p, state, mode, asked)}</div>
    <label htmlFor={id}>{p.questionLabel}</label>
    <input id={id} dir="auto" maxLength={p.maxLength} placeholder={p.placeholder} value={question} onChange={e => setQuestion(e.target.value)} />
    <div className="actions"><button type="button" onClick={() => setAsked(Boolean(question.trim()))}>{p.submitLabel}</button></div>
  </div>;
}

/** Artifact preview built from the current worksheet (legacy show*() functions). Hidden again after any edit. */
export function Preview({ state, props }: ExtensionProps) {
  const p = props as unknown as PreviewProps;
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [state]);
  return <div>
    <div className="actions"><button type="button" className="secondary" aria-expanded={open} onClick={() => setOpen(true)}>{p.label}</button></div>
    {open && <p className="deliverable-preview" role="status">{previewText(p, state)}</p>}
  </div>;
}

/** Markdown deliverable download (legacy exportProfile()), optionally with an on-page preview (Lesson 01). */
export function Download({ lesson, state, props }: ExtensionProps) {
  const p = (props ?? {}) as { label: string; preview?: boolean; previewLabel?: string };
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [state]);
  const markdown = () => buildDeliverable(lesson, state, isComplete(state, schemaOf(lesson.number)));
  return <div>
    <div className="actions">
      {p.preview && <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide preview' : p.previewLabel ?? 'Preview'}</button>}
      <button type="button" className={p.preview ? undefined : 'secondary'} onClick={() => downloadText(markdown(), lesson.deliverable.filename)}>{p.label}</button>
    </div>
    {open && <pre className="deliverable-preview" tabIndex={0} aria-label="Deliverable preview">{markdown()}</pre>}
  </div>;
}

/** A collapsible group of worksheet fields (Lesson 06 journal entries). */
export function FieldGroup({ lesson, state, setField, props }: ExtensionProps) {
  const p = props as unknown as { summary: string; open: boolean; ids: string[] };
  const fields = p.ids.map(id => lesson.fields.find(f => f.id === id)).filter(f => f !== undefined);
  return <details className="p1-group" open={p.open || undefined}><summary>{p.summary}</summary><Worksheet fields={fields} state={state} onChange={setField} /></details>;
}

/** Module / Discover pack status note, re-validated from saved lesson records. */
export function ModuleNote({ props, navigate }: ExtensionProps) {
  const parts = (props as unknown as { parts: ({ nodes: ContentNode[] } | StatusPart)[] }).parts;
  const completed = readProgress().complete;
  return <div className="note">{parts.map((part, i) => 'status' in part
    ? <p key={i} role="status">{statusText(part, completed)}</p>
    : <Nodes key={i} nodes={part.nodes} navigate={navigate} />)}</div>;
}
