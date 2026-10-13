import { useId, useState } from 'react';
import type { ExtensionProps } from '../../../lesson-system/types';
import { fillTemplate, missingCount } from '../../../lesson-system/state';
import { schemaFor } from '../../../lesson-system/registry';

export type CoachProps = {
  modes: { id: string; label: string; response: string }[];
  /** Lessons 41–45: a question box whose reply is fixed scripted text (no AI call). */
  question?: { label: string; button: string; response: string };
  /** Legacy initial text of the chat line (Lessons 46–60). */
  initial?: string;
};

/**
 * Simulated Coach exactly as the legacy page: mode buttons write a fixed reply; "Review My Work"
 * reports how many required fields are empty ({missing}); the optional question box returns a
 * fixed scripted reply. Nothing is sent anywhere.
 */
export function Coach({ lesson, state, props }: ExtensionProps) {
  const { modes, question, initial } = props as unknown as CoachProps;
  const [chat, setChat] = useState(initial ?? '');
  const [text, setText] = useState('');
  const id = useId();
  const ids = schemaFor(lesson.number).ids;
  return <div className="p3-coach">
    <div className="actions" role="group" aria-label="Coach modes">
      {modes.map(m => <button type="button" className="secondary" key={m.id} onClick={() => setChat(fillTemplate(m.response, { missing: missingCount(state, ids) }))}>{m.label}</button>)}
    </div>
    {question && <>
      <label htmlFor={id}>{question.label}</label>
      <textarea id={id} dir="auto" maxLength={2000} value={text} onChange={e => setText(e.target.value)} />
      <div className="actions"><button type="button" className="secondary" onClick={() => setChat(question.response)}>{question.button}</button></div>
    </>}
    <p role="status" className="coach-message" hidden={!chat}>{chat}</p>
  </div>;
}
