import { useEffect, useRef, useState } from 'react';
import type { LessonState } from '../types';
import { buildCoachContext, type CoachLesson } from './context';
import { CoachText } from './CoachText';
import { fillMissing, MODE_LABELS, MODE_ORDER, MODE_PROMPTS, type Guidance, type ModeId } from './guidance';

/** `kind` marks messages produced in the browser: an instant field check, or offline guidance. */
type Message = { role: 'user' | 'assistant'; content: string; kind?: 'check' | 'offline' };

type Props = { lesson: CoachLesson; state: Pick<LessonState, 'fields'>; guidance: Guidance[]; missing: number; required: number; intro?: string; suggestions?: string[] };

/**
 * The lesson's one coach. Buttons are the lesson's authored coaching modes; replies come from the
 * live AI (via /api/coach) grounded in this lesson's answers, earlier lessons and the authored notes.
 * If the AI is unavailable, a mode button falls back to the authored guidance, marked as offline.
 */
export function AiCoach({ lesson, state, guidance, missing, required, intro, suggestions }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [used, setUsed] = useState<number[] | null>(null);
  const live = useRef(true);
  // Set on every mount, not just at creation: StrictMode mounts, unmounts and remounts in development,
  // and a flag only cleared on unmount would stay false and drop every reply.
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const authored = (mode: ModeId) => guidance.find(g => g.mode === mode);

  async function send(text: string, mode?: ModeId) {
    const content = text.trim();
    if (!content || busy) return;
    let next: Message[] = [...messages, { role: 'user', content: mode ? MODE_LABELS[mode] : content }];
    if (mode === 'review') next = [...next, { role: 'assistant', kind: 'check', content: missing ? `Field check: ${missing} of ${required} required field${required === 1 ? '' : 's'} still empty. I'll review what you've written so far.` : `Field check: all ${required} required fields are filled in. Now for the substance.` }];
    setMessages(next); setInput(''); setBusy(true); setError('');
    // The AI sees the button's full request; browser-only messages (checks, offline notes) are not sent.
    const conversation = next.filter(m => !m.kind).map((m, i, all) => i === all.length - 1 && mode ? { role: m.role, content } : { role: m.role, content: m.content });
    const fallback = (reason: string) => {
      const g = mode && authored(mode);
      if (g) setMessages([...next, { role: 'assistant', kind: 'offline', content: fillMissing(g.text, missing) }]);
      setError(g ? `${reason} Showing this lesson's offline guidance instead.` : reason);
    };
    try {
      const context = await buildCoachContext(lesson, state);
      if (live.current) setUsed(context.earlier.map(e => e.number));
      const res = await fetch('/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...context, guidance: guidance.map(g => ({ label: g.label, text: g.text })), messages: conversation }) });
      const data = await res.json().catch(() => ({})) as { reply?: string; message?: string };
      if (!live.current) return;
      if (res.ok && data.reply) setMessages([...next, { role: 'assistant', content: data.reply }]);
      else fallback(data.message ?? 'The AI Coach is unavailable right now.');
    } catch {
      if (live.current) fallback('The AI Coach could not be reached.');
    } finally {
      if (live.current) setBusy(false);
    }
  }

  const modes = guidance.length ? guidance.map(g => g.mode) : MODE_ORDER;
  return <section className="ai-coach" aria-labelledby={`ai-coach-${lesson.number}`}>
    <header>
      <h3 id={`ai-coach-${lesson.number}`}>AI Coach</h3>
      <span className="badge">Live AI</span>
    </header>
    <p className="ai-coach-intro">{intro ?? 'Pick a mode or ask your own question. The coach reads your answers here, your founder profile and your saved work from related earlier lessons in this browser.'}</p>

    <div className="actions ai-coach-modes">{modes.map(mode => <button key={mode} type="button" disabled={busy} onClick={() => send(MODE_PROMPTS[mode], mode)}>{MODE_LABELS[mode]}</button>)}</div>

    {messages.length > 0 && <ol className="ai-coach-log" aria-live="polite">
      {messages.map((m, i) => <li key={i} className={`${m.role}${m.kind ? ` ${m.kind}` : ''}`}>
        <span className="who">{m.role === 'user' ? 'You' : m.kind === 'offline' ? 'Offline guidance' : m.kind === 'check' ? 'Quick check' : 'Coach'}</span>
        <div className="text">{m.role === 'assistant' ? <CoachText text={m.content} /> : m.content}</div>
      </li>)}
    </ol>}
    {busy && <p className="ai-coach-status" role="status">Coach is thinking…</p>}
    {error && <p className="ai-coach-error" role="alert">{error}</p>}
    {used && lesson.number > 0 && <p className="ai-coach-context">{used.length ? `Using your saved work from Lesson${used.length > 1 ? 's' : ''} ${[...used].sort((a, b) => a - b).join(', ')}.` : 'No saved work from related earlier lessons was found in this browser.'}</p>}

    <form onSubmit={e => { e.preventDefault(); send(input); }}>
      <label htmlFor={`ai-coach-input-${lesson.number}`}>Your question</label>
      <textarea id={`ai-coach-input-${lesson.number}`} value={input} maxLength={4000} rows={3} placeholder="e.g. Is my customer segment specific enough?"
        onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(input); } }} />
      {suggestions?.length ? <div className="actions ai-coach-suggestions">{suggestions.map(s => <button key={s} type="button" className="secondary" disabled={busy} onClick={() => send(s)}>{s}</button>)}</div> : null}
      <div className="actions"><button type="submit" disabled={busy || !input.trim()}>Ask the coach</button>
        {messages.length > 0 && <button type="button" className="secondary" disabled={busy} onClick={() => { setMessages([]); setError(''); setUsed(null); }}>Start over</button>}</div>
    </form>
    <p className="ai-coach-note">Replies are generated by an AI model (via Groq) and can be wrong. Treat them as a thinking partner, not evidence. Your answers are sent to the AI service to generate replies, so don't include personal, confidential or customer-identifying information.</p>
  </section>;
}
