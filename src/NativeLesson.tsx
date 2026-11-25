import { useState } from 'react';
import data from './data/native-lessons.json';
import { fieldsComplete, quizCorrect, makeDeliverable, profileLimits } from './lesson-state';
import { useLessonDraft } from './useLessonDraft';
import { Step, Content, Worksheet, KnowledgeCheck, VideoPrompt, Checklist, downloadText, type ContentNode, type Question } from './components/LessonParts';
import { AiCoach } from './lesson-system/coach/AiCoach';
import { cleanGuidance, MODE_LABELS, MODE_ORDER, type Guidance } from './lesson-system/coach/guidance';
import type { FieldDefinition as LessonField } from './lesson-system/types';

/** Module 00 in the shape the AI Coach reads (lesson number 0). */
const orientationCoachLesson = {
  number: 0,
  title: 'Welcome & Orientation',
  hero: { eyebrow: 'Module 00 · Welcome & Orientation', intro: 'Record a five-question starting profile and a Founder Starting Brief: what feels hardest, one assumption to explore, one manageable next action, and an honest red-team reflection. Then begin Lesson 01.' },
  fields: data.orientationFields.map((f): LessonField => ({ id: f.id, label: f.label, kind: f.type === 'select' ? 'select' : f.type === 'textarea' ? 'textarea' : 'input', required: f.required, options: f.options.map(o => ({ value: o, label: o })) })),
};
/** The authored orientation coaching modes: lesson notes for the AI and offline guidance. */
const orientationGuidance: Guidance[] = MODE_ORDER.map(mode => ({ mode, label: MODE_LABELS[mode], text: cleanGuidance((data.orientationCoach as Record<string, string>)[mode]) }));
const orientationSuggestions = ['I have no idea yet', 'I feel overwhelmed', 'How do the lessons connect?', 'Will customers want it?'];
import './native.css';
// Module 00 · Welcome & Orientation. Lesson 01 now runs on the configuration-driven lesson system (src/phases/phase1).
// `orientation` is accepted for route compatibility; this page always renders the orientation module.
type Props = {orientation?:boolean;navigate:(phase:number,lesson?:number)=>void;onProgress:()=>void};
export function NativeLesson({navigate,onProgress}:Props) {
  const definitions = data.orientationFields;
  const requiredIds = data.orientationFields.map(field => field.id);
  const questions = data.orientationQuestions as Question[];
  const {draft,profile,update,saveStatus,notice,setNotice} = useLessonDraft('lynq.orientation.lesson.v1',requiredIds,questions.map(q => q[2]),onProgress,true);
  const [profileIndex,setProfileIndex]=useState(0);
  const [preview,setPreview]=useState(false);
  const basicFields = definitions.filter(field => !requiredIds.slice(-3).includes(field.id));
  const reflectionFields = definitions.filter(field => requiredIds.slice(-3).includes(field.id));
  const checks: [string,boolean][] = [
    ['Storyboard or transcript reviewed',draft.studied],
    ['Five-question starting profile recorded',profile.profileCompleted],
    ['Three starting-brief fields completed',fieldsComplete(draft,basicFields.filter(field => requiredIds.includes(field.id)).map(field => field.id))],
    ['Three red-team reflections completed',fieldsComplete(draft,reflectionFields.map(field => field.id))],
    ['Knowledge check: 3 / 3 correct',quizCorrect(draft,questions.map(q => q[2]))],
    ['Final self-review confirmed',draft.honest],
  ];
  const valid=checks.every(([,done]) => done);
  const complete=profile.completed && valid;
  function fieldChange(id:string,value:string) {update({fields:{...draft.fields,[id]:value}});setPreview(false);}
  const profileQuestions=data.profile as [string,string[]][];
  const deliverable=makeDeliverable('Founder Starting Brief',complete,definitions,draft,profileQuestions.map(([title,options],i) => `${title}: ${options[profile.answers[i]] || 'Not entered'}`));
  const filename='LYNQ-Founder-Starting-Brief.md';
  return <div className="native-scroll" key="orientation"><div className="native-page">
    <header className="native-hero"><div className="step-label">MODULE 00 · WELCOME & ORIENTATION</div><h1>You have the ambition. Give it a clear next step.</h1><p>Your Journey From Idea to Venture. Start with one real problem, one honest decision and one useful piece of work. LYNQ gives that work a path.</p><small>15–20 minute orientation · No business experience required</small><nav aria-label="Lesson sections">{['watch','learn','build','coach','challenge','knowledge','deliver'].map((id,i) => <a key={id} href="#orientation" onClick={event => {event.preventDefault();document.getElementById(id)?.scrollIntoView({behavior:'smooth'});}}>{String(i+1).padStart(2,'0')} {id === 'knowledge' ? 'Knowledge check' : id}</a>)}</nav></header>
    <Step id="watch" number="01 / WATCH" title="Your journey starts with one useful step.">
      <p>Review the storyboard and full narration. Video media has not been produced.</p>
      <Content node={data.orientationStory as unknown as ContentNode} navigate={navigate}/>
      <VideoPrompt text={data.orientationPrompt} name="LYNQ-Module-00-Gemini-Video-Prompt.md"/>
      <label className="check"><input type="checkbox" checked={draft.studied} onChange={event => update({studied:event.target.checked})}/>I reviewed the storyboard or read the transcript.</label>
    </Step>
    <div className="native-step teaching"><Content node={data.orientationLearn as unknown as ContentNode} navigate={navigate}/></div>
    <Step id="build" number="03 / BUILD" title="Build your Founder Starting Brief.">
      <p>Use short, concrete answers. Local storage stays in this browser; download a copy before changing browsers. Use anonymous notes.</p>
      <div className="starting-profile"><h3>Your starting profile</h3>{profile.profileCompleted ? <><p>Five-question starting profile recorded.</p><dl>{profileQuestions.map(([title,options],i) => <div key={title}><dt>{title}</dt><dd>{options[profile.answers[i]]}</dd></div>)}</dl><button onClick={() => {update({}, {...profile,profileCompleted:false,completed:false});setProfileIndex(0);}}>Edit starting profile</button></> : <><p>Question {profileIndex+1} of 5</p><fieldset><legend>{profileQuestions[profileIndex][0]}</legend>{profileQuestions[profileIndex][1].map((option,i) => <label key={option} className="check"><input type="radio" name="starting-profile" checked={profile.answers[profileIndex] === i} onChange={() => update({}, {...profile,answers:{...profile.answers,[profileIndex]:i}})}/>{option}</label>)}</fieldset><div className="actions"><button disabled={profileIndex === 0} onClick={() => setProfileIndex(profileIndex-1)}>← Back</button><button disabled={profile.answers[profileIndex] === undefined} onClick={() => {if(profileIndex < 4)setProfileIndex(profileIndex+1);else if(profileLimits.every((_,i) => profile.answers[i] !== undefined))update({}, {...profile,profileCompleted:true});}}>{profileIndex === 4 ? 'Record starting profile' : 'Continue →'}</button></div></>}</div>
      <Worksheet fields={basicFields} draft={draft} onChange={fieldChange} requiredIds={requiredIds}/><p className="save-status" role="status">{saveStatus}</p>
      <div className="actions"><button onClick={() => downloadText(deliverable,filename)}>Download Founder Starting Brief</button></div>
    </Step>
    <Step id="coach" number="04 / ASK AI COACH" title="Your thinking partner"><AiCoach lesson={orientationCoachLesson} state={draft} guidance={orientationGuidance} missing={requiredIds.filter(id => !draft.fields[id]?.trim()).length} required={requiredIds.length} suggestions={orientationSuggestions} intro="Pick a mode or ask your own question. The coach reads your starting profile and what you write in this module, and knows how the five phases and 100 lessons fit together."/></Step>
    <Step id="challenge" number="05 / CHALLENGE" title="Give your ambition an honest foundation."><p>A red-team review looks for weak assumptions so you can improve your plan. It is not a judgment of your potential.</p><Worksheet fields={reflectionFields} draft={draft} onChange={fieldChange} requiredIds={requiredIds}/></Step>
    <Step id="knowledge" number="06 / KNOWLEDGE CHECK" title="Check that you know how to move forward."><p>Answer all three. You can retry; all three correct are required for completion.</p><KnowledgeCheck questions={questions} draft={draft} onAnswer={(index,value) => update({answers:{...draft.answers,[index]:value}})}/></Step>
    <Step id="deliver" number="07 / DELIVER & PROGRESS" title="Deliver your Founder Starting Brief.">
      <p>Your worksheet and reflections form your starting brief. Self-completion records learning; it does not establish venture readiness.</p><div className="actions"><button onClick={() => setPreview(!preview)}>{preview ? 'Hide preview' : 'Preview my brief'}</button><button onClick={() => downloadText(deliverable,filename)}>Download Founder Starting Brief</button></div>{preview && <pre className="deliverable-preview">{deliverable}</pre>}
      <label className="check"><input type="checkbox" checked={draft.honest} onChange={event => update({honest:event.target.checked})}/>I understand this is learning progress and will keep assumptions, evidence and unknowns separate.</label><Checklist checks={checks}/>
      <button onClick={() => {if(valid){update({completed:true});setNotice('Module 00 self-completed locally.');}else setNotice('Finish the remaining requirements before marking completion.');}}>Mark Module 00 complete locally</button><p role="status">{notice || (complete ? 'Self-completed locally.' : 'Draft · completion not yet recorded.')}</p><button disabled={!complete} onClick={() => navigate(1,1)}>Begin Phase 01 →</button>
    </Step><footer>LYNQ · Everything. Connected. · Local learning prototype. No cloud saving, reviewer submission or certification.</footer>
  </div></div>;
}
