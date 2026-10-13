import { useState } from 'react';
import data from '../data/native-lessons.json';
type Mode = 'teach' | 'guide' | 'review' | 'challenge';
const modes: [Mode,string][] = [['teach','Teach Me'],['guide','Guide Me'],['review','Review My Work'],['challenge','Challenge My Idea']];
/** Orientation (Module 00) simulated coach. Replies are scripted; nothing is sent to an AI service. */
export function Coach() {
  const [mode,setMode]=useState<Mode>('teach');
  const [question,setQuestion]=useState('');
  const [messages,setMessages]=useState<{who:string;text:string}[]>([]);
  const [status,setStatus]=useState('');
  function ask(text:string) {
    if (!text.trim()) {setStatus('Write a question first.');return;}
    const patterns=[/41|42|43|connect|handoff/i,/overwhelm|afraid|stuck|alone|fear|exhaust|ضغط|خائف/i,/no idea|several ideas|start|begin|فكرة|ابدأ/i,/customer|demand|validat|want|عميل/i,/mvp|feature|build|prototype/i,/fund|invest|legal|medical|finance/i];
    const index=patterns.findIndex(pattern => pattern.test(text));
    const response=data.orientationResponses[index < 0 ? 6 : index];
    setMessages(old => [...old,{who:'You',text},{who:'Simulated Coach',text:response}]);setQuestion('');setStatus('Demo response shown. No question was sent to an AI service.');
  }
  return <><p>Simulated Coach · no live AI connection. Replies are scripted and do not verify evidence or venture readiness.</p><div className="actions">{modes.map(([value,label]) => <button key={value} aria-pressed={mode === value} className={mode === value ? 'selected' : ''} onClick={() => {setMode(value);setMessages(old => [...old,{who:'Simulated Coach',text:data.orientationCoach[value]}]);}}>{label}</button>)}</div>
    <div role="log" aria-label="Founder Coach conversation">{messages.map((message,i) => <div className="coach-message" key={i}><strong>{message.who}</strong><p>{message.text}</p></div>)}</div>
    <form onSubmit={event => {event.preventDefault();ask(question);}}><label htmlFor="coach-question">Your question</label><textarea id="coach-question" dir="auto" maxLength={1500} value={question} onChange={event => setQuestion(event.target.value)}/><small>Use anonymous examples. Keep passwords and confidential details out of the chat.</small><div className="actions"><button type="submit">Ask AI Coach</button><button type="button" onClick={() => {setMessages([]);setQuestion('');setStatus('Chat cleared from this tab.');}}>Clear chat</button></div></form>
    <div className="actions">{['I have no idea yet','I feel overwhelmed','How lessons connect','Will customers want it?'].map(text => <button key={text} onClick={() => ask(text)}>{text}</button>)}</div><p role="status">{status}</p>
  </>;
}
