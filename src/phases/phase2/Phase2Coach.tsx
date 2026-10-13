import { useId, useState } from 'react';
import type { ExtensionProps } from '../../lesson-system/types';
import { coachReply, type CoachProps } from './phase2.logic';

/**
 * Venture Coach · simulated (legacy coach(mode)). Replies are fixed curriculum text; the Review
 * reply counts the eight empty worksheet fields only, as the legacy code did.
 */
export function Phase2Coach({ state, props }: ExtensionProps) {
  const config = props as unknown as CoachProps;
  const [mode, setMode] = useState(config.initial);
  const [question, setQuestion] = useState('');
  const id = useId();
  return <div className="phase2-coach">
    <div className="actions" role="group" aria-label="Coach modes">
      {config.modes.map(m => <button type="button" key={m.id} className={mode === m.id ? 'selected secondary' : 'secondary'} aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>{m.label}</button>)}
    </div>
    <p className="coach-message" role="status">{coachReply(config, mode, state)}</p>
    <label htmlFor={id}>{config.questionLabel ?? 'Optional question for the demonstration'}</label>
    <textarea id={id} dir="auto" maxLength={1000} value={question} onChange={e => setQuestion(e.target.value)} />
    <div className="actions"><button type="button" className="secondary" onClick={() => setMode('question')}>{config.submitLabel ?? 'Show simulated guidance'}</button></div>
  </div>;
}
