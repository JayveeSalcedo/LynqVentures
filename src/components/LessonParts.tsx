import { SHOW_PRODUCTION_TOOLS } from '../lesson-system/flags';
import { createElement, useState, type ReactNode } from 'react';
import type { Draft } from '../lesson-state';
export type ContentNode = string | {tag:string;attrs:Record<string,string | null>;children:ContentNode[]};
const tags = new Set(['section','article','div','span','p','h2','h3','h4','strong','b','em','small','ul','ol','li','br','details','summary']);
// Render curated content as React elements. No HTML injection or legacy scripts.
export function Content({node,navigate}:{node:ContentNode;navigate:(phase:number,lesson?:number)=>void}): ReactNode {
  if (typeof node === 'string') return node.replace('05 · LESSONS 100 · SCALE','05 · LESSONS 81–100 · SCALE');
  const phase = /goPhase\((\d)\)/.exec(node.attrs.onclick || '');
  if (node.tag === 'button' && phase) return <button onClick={() => navigate(Number(phase[1]))}>{node.children.map((child,i) => <Content key={i} node={child} navigate={navigate}/>)}</button>;
  if (!tags.has(node.tag)) return null;
  if (node.tag === 'br') return <br/>;
  return createElement(node.tag,{id:node.attrs.id || undefined,className:node.attrs.class || undefined},node.children.map((child,i) => <Content key={i} node={child} navigate={navigate}/>));
}
export function Step({number,title,id,children}:{number:string;title:string;id:string;children:ReactNode}) {
  return <section className="native-step" id={id}><div className="step-label">{number}</div><h2>{title}</h2>{children}</section>;
}
export type FieldDefinition = {id:string;label:string;type:string;placeholder:string;options:string[]};
export function Worksheet({fields,draft,onChange,requiredIds}:{fields:FieldDefinition[];draft:Draft;onChange:(id:string,value:string)=>void;requiredIds:string[]}) {
  return <div className="worksheet">{fields.map(field => <div className="field" key={field.id}><label htmlFor={field.id}>{field.label}{requiredIds.includes(field.id) ? ' *' : ''}</label>{field.type === 'select' ? <select id={field.id} value={draft.fields[field.id] || ''} onChange={e => onChange(field.id,e.target.value)} required={requiredIds.includes(field.id)}>{field.options.map((option,i) => <option key={option} value={i === 0 ? '' : option}>{option}</option>)}</select> : field.type === 'input' ? <input id={field.id} dir="auto" maxLength={field.id === 'name' ? 100 : 300} placeholder={field.placeholder} value={draft.fields[field.id] || ''} onChange={e => onChange(field.id,e.target.value)} required={requiredIds.includes(field.id)}/> : <textarea id={field.id} dir="auto" maxLength={2000} placeholder={field.placeholder} value={draft.fields[field.id] || ''} onChange={e => onChange(field.id,e.target.value)} required={requiredIds.includes(field.id)}/>}</div>)}</div>;
}
export type Question = [string,string[],number,string];
export function KnowledgeCheck({questions,draft,onAnswer}:{questions:Question[];draft:Draft;onAnswer:(index:number,value:number)=>void}) {
  const [checked,setChecked] = useState(false);
  return <><div>{questions.map(([question,options,answer,explanation],i) => <fieldset key={question}><legend>{i+1}. {question}</legend>{options.map((option,j) => <label className="check" key={option}><input type="radio" name={`question-${i}`} checked={draft.answers[i] === j} onChange={() => {onAnswer(i,j);setChecked(false);}}/>{option}</label>)}{checked && <p className={draft.answers[i] === answer ? 'correct' : 'incorrect'}>{draft.answers[i] === answer ? 'Correct. ' : 'Review this answer. '}{explanation}</p>}</fieldset>)}</div><button onClick={() => setChecked(true)}>Check my answers</button>{checked && <p role="status">{questions.filter((q,i) => draft.answers[i] === q[2]).length} / {questions.length} correct</p>}</>;
}
export function downloadText(text:string,name:string) {
  const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(() => URL.revokeObjectURL(url),1000);
}
/** Internal production prompt; hidden from learners unless production tools are enabled. */
export function VideoPrompt(props:{text:string;name:string}) {
  return SHOW_PRODUCTION_TOOLS ? <VideoPromptPanel {...props}/> : null;
}
function VideoPromptPanel({text,name}:{text:string;name:string}) {
  const [status,setStatus]=useState('');
  return <details><summary>Video production prompt — ready to copy</summary><textarea aria-label="Video production prompt" value={text} readOnly/><div className="actions"><button onClick={async () => {try {await navigator.clipboard.writeText(text);setStatus('Prompt copied.');} catch {setStatus('Clipboard unavailable. Select the text manually or download the prompt.');}}}>Copy prompt</button><button onClick={() => downloadText(text,name)}>Download prompt</button></div><p role="status">{status}</p></details>;
}
export function Checklist({checks}:{checks:[string,boolean][]}) {
  return <><p>{checks.filter(([,done]) => done).length} / {checks.length} requirements</p><ul className="completion-list">{checks.map(([label,done]) => <li key={label}>{done ? '✓' : '○'} {label}</li>)}</ul></>;
}
