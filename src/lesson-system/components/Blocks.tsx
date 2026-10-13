import { useId, useState, type ReactNode } from 'react';
import type { CoachMode, FieldDefinition, LessonState, QuizQuestion, Scene } from '../types';
import { downloadText } from '../deliverable';
import { fillTemplate } from '../state';

export function Step({ number, title, id, children, className }: { number: string; title: string; id: string; children: ReactNode; className?: string }) {
  return <section className={`native-step${className ? ` ${className}` : ''}`} id={id} aria-labelledby={`${id}-heading`}>
    <div className="step-label">{number}</div><h2 id={`${id}-heading`}>{title}</h2>{children}
  </section>;
}

export function VideoPlaceholder({ title, subtitle, note }: { title: string; subtitle?: string; note?: string }) {
  return <div className="video-placeholder"><span className="badge">Video placeholder · media not produced</span><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}<small>{note ?? 'No playable video or generated media is attached.'}</small></div>;
}

export function Storyboard({ scenes, sceneMeta, summary }: { scenes: Scene[]; sceneMeta?: string; summary?: string }) {
  const [index, setIndex] = useState(0);
  const scene = scenes[index];
  const body = <><div className="storyboard"><small>Storyboard preview · no playable video</small><h3>{scene.title}</h3><p>{scene.visual}</p>{sceneMeta && <p className="scene-meta">{fillTemplate(sceneMeta, { scene: index + 1, total: scenes.length })}</p>}</div>
    <div className="actions"><button type="button" aria-label="Previous scene" disabled={!index} onClick={() => setIndex(index - 1)}>← Previous</button><span aria-live="polite">Scene {index + 1} / {scenes.length}</span><button type="button" aria-label="Next scene" disabled={index === scenes.length - 1} onClick={() => setIndex(index + 1)}>Next →</button></div></>;
  return summary ? <details><summary>{summary}</summary>{body}</details> : body;
}

export function Transcript({ scenes, summary }: { scenes: Scene[]; summary?: string }) {
  return <details><summary>{summary ?? 'Read the full narration / transcript'}</summary>{scenes.map((scene, i) => <p key={i}><strong>{i + 1}. {scene.title}</strong><br />{scene.narration}</p>)}</details>;
}

export function VideoPrompt({ prompt, filename, summary, title }: { prompt: string; filename: string; summary?: string; title?: string }) {
  const [status, setStatus] = useState('');
  const id = useId();
  return <details><summary>{summary ?? 'Gemini video prompt — ready to copy'}</summary>
    <textarea id={id} aria-label={summary ?? 'Gemini video prompt'} value={prompt} readOnly className="prompt-text" />
    <div className="actions">
      <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(prompt); setStatus('Gemini prompt copied.'); } catch { (document.getElementById(id) as HTMLTextAreaElement | null)?.select(); setStatus('Clipboard unavailable. The complete prompt is selected; use Copy in your browser or download the prompt.'); } }}>Copy Gemini prompt</button>
      <button type="button" onClick={() => downloadText(title ? `${title}\n\n${prompt}` : prompt, filename)}>Download prompt</button>
    </div><p role="status">{status}</p></details>;
}

export function Field({ field, value, onChange }: { field: FieldDefinition; value: string; onChange: (value: string) => void }) {
  const hintId = field.hint ? `${field.id}-hint` : undefined;
  const common = { id: field.id, value, required: field.required, 'aria-required': field.required, 'aria-describedby': hintId };
  return <div className="field">
    <label htmlFor={field.id}>{field.label}{field.required ? <span aria-hidden="true"> *</span> : <span className="optional"> (optional)</span>}</label>
    {field.hint && <small id={hintId}>{field.hint}</small>}
    {field.kind === 'select'
      ? <select {...common} onChange={e => onChange(e.target.value)}>{(field.options ?? []).map(option => <option key={option.value + option.label} value={option.value}>{option.label}</option>)}</select>
      : field.kind === 'textarea'
        ? <textarea {...common} dir="auto" maxLength={field.maxLength ?? 2000} placeholder={field.placeholder} onChange={e => onChange(e.target.value)} />
        : <input {...common} type={field.kind === 'date' ? 'date' : field.kind === 'number' ? 'number' : 'text'} dir="auto" maxLength={field.kind === 'input' ? field.maxLength ?? 300 : undefined} placeholder={field.placeholder} onChange={e => onChange(e.target.value)} />}
  </div>;
}

export function Worksheet({ fields, state, onChange }: { fields: FieldDefinition[]; state: LessonState; onChange: (id: string, value: string) => void }) {
  return <div className="worksheet">{fields.map(field => <Field key={field.id} field={field} value={state.fields[field.id] ?? ''} onChange={value => onChange(field.id, value)} />)}</div>;
}

export function KnowledgeCheck({ questions, answers, onAnswer, name = 'question' }: { questions: QuizQuestion[]; answers: Record<number, number>; onAnswer: (index: number, value: number) => void; name?: string }) {
  const [checked, setChecked] = useState(false);
  const correct = questions.filter((q, i) => answers[i] === q.answer).length;
  return <>
    <div>{questions.map((q, i) => <fieldset key={i}><legend>{i + 1}. {q.prompt}</legend>
      {q.options.map((option, j) => <label className="check" key={j}><input type="radio" name={`${name}-${i}`} checked={answers[i] === j} onChange={() => { onAnswer(i, j); setChecked(false); }} />{option}</label>)}
      {checked && <p className={answers[i] === q.answer ? 'correct' : 'incorrect'}>{answers[i] === q.answer ? 'Correct. ' : answers[i] === undefined ? 'Choose an answer. ' : 'Review this answer. '}{q.explanation}</p>}
    </fieldset>)}</div>
    <button type="button" onClick={() => setChecked(true)}>Check my answers</button>
    {checked && <p role="status">{correct} / {questions.length} correct{correct === questions.length ? '' : ' · retry the remaining questions'}</p>}
  </>;
}

/** Scripted coach. Replies are fixed curriculum text; `{missing}` reports empty required fields only. */
export function ScriptedCoach({ intro, modes, questionResponse, questionLabel, submitLabel, quickPrompts, missing }: { intro?: string; modes: CoachMode[]; questionResponse?: string; questionLabel?: string; submitLabel?: string; quickPrompts?: { label: string; response: string }[]; missing: number }) {
  const [mode, setMode] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [log, setLog] = useState<{ who: string; text: string }[]>([]);
  const [status, setStatus] = useState('');
  const id = useId();
  const say = (text: string) => fillTemplate(text, { missing });
  const current = modes.find(m => m.id === mode);
  return <>
    <p>{intro ?? 'Simulated Coach · no live AI connection. Replies are scripted and do not verify evidence or venture readiness.'}</p>
    <div className="actions" role="group" aria-label="Coach modes">{modes.map(m => <button type="button" key={m.id} aria-pressed={mode === m.id} className={mode === m.id ? 'selected' : ''} onClick={() => setMode(m.id)}>{m.label}</button>)}</div>
    {current && <p className="coach-message" aria-live="polite">{say(current.response)}</p>}
    {quickPrompts && <div className="actions">{quickPrompts.map(p => <button type="button" key={p.label} onClick={() => { setLog(old => [...old, { who: 'You', text: p.label }, { who: 'Simulated Coach', text: say(p.response) }]); setStatus('Demo response shown. No question was sent to an AI service.'); }}>{p.label}</button>)}</div>}
    <div role="log" aria-label="Founder Coach conversation">{log.map((m, i) => <div className="coach-message" key={i}><strong>{m.who}</strong><p>{m.text}</p></div>)}</div>
    <form onSubmit={event => {
      event.preventDefault();
      if (!question.trim()) { setStatus('Write a question first.'); return; }
      setLog(old => [...old, { who: 'You', text: question }, { who: 'Simulated Coach', text: say(questionResponse ?? 'This is a scripted demonstration, not an AI answer to your question.') }]);
      setQuestion(''); setStatus('Demo response shown. No question was sent to an AI service.');
    }}>
      <label htmlFor={id}>{questionLabel ?? 'Your question (optional)'}</label>
      <textarea id={id} dir="auto" maxLength={1500} value={question} onChange={e => setQuestion(e.target.value)} />
      <small>Use anonymous examples. Keep passwords and confidential details out of the chat.</small>
      <div className="actions"><button type="submit">{submitLabel ?? 'Show simulated guidance'}</button><button type="button" onClick={() => { setLog([]); setQuestion(''); setStatus('Chat cleared from this tab.'); }}>Clear chat</button></div>
    </form><p role="status">{status}</p>
  </>;
}

/** Scenario practice with scripted feedback per option. Not saved and not required for completion. */
export function Practice({ prompt, options, legend }: { prompt: string; options: { label: string; feedback: string }[]; legend?: string }) {
  const [choice, setChoice] = useState<number | null>(null);
  const name = useId();
  return <fieldset className="practice"><legend>{legend ?? 'Practice scenario'}</legend>{prompt && <p>{prompt}</p>}
    {options.map((option, i) => <label className="check" key={i}><input type="radio" name={name} checked={choice === i} onChange={() => setChoice(i)} />{option.label}</label>)}
    <p role="status" className="coach-message" hidden={choice === null}>{choice !== null ? options[choice].feedback : ''}</p>
  </fieldset>;
}

export function Checklist({ checks }: { checks: [string, boolean][] }) {
  return <><p>{checks.filter(([, done]) => done).length} / {checks.length} requirements</p>
    <ul className="completion-list">{checks.map(([label, done]) => <li key={label}><span aria-hidden="true">{done ? '✓' : '○'}</span> {label}<span className="visually-hidden">{done ? ' — done' : ' — not done'}</span></li>)}</ul></>;
}
