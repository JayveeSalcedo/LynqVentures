import { useEffect, useState } from 'react';
import type { Block, LessonDefinition, Navigate, PhaseModule } from './types';
import { blankState, checklistStatus, isComplete, missingCount, requirementsMet } from './state';
import { buildMarkdown, buildPreview, downloadText } from './deliverable';
import { useLessonState } from './useLessonState';
import { lessonName, loadPhase, phaseOf, schemaFor } from './registry';
import { Nodes } from './components/Content';
import { Checklist, KnowledgeCheck, Practice, ScriptedCoach, Step, Storyboard, Transcript, VideoPlaceholder, VideoPrompt, Worksheet } from './components/Blocks';
import { GraduationReview } from './components/GraduationReview';
import { nextStep } from '../routing';
import '../native.css';

type Props = { n: number; navigate: Navigate; onProgress: () => void };

/** Loads the phase module and lesson definition, then renders the lesson natively. */
export function LessonPage({ n, navigate, onProgress }: Props) {
  const [loaded, setLoaded] = useState<{ n: number; module: PhaseModule; lesson: LessonDefinition } | { n: number; error: string } | null>(null);
  useEffect(() => {
    let live = true;
    loadPhase(phaseOf(n)).then(async module => ({ n, module, lesson: await module.loadLesson(n) }))
      .then(value => { if (live) setLoaded(value); }, (error: unknown) => { if (live) setLoaded({ n, error: String(error) }); });
    return () => { live = false; };
  }, [n]);
  if (!loaded || loaded.n !== n) return <div className="native-scroll"><div className="native-page"><p role="status">Loading Lesson {n}…</p></div></div>;
  if ('error' in loaded) return <div className="native-scroll"><div className="native-page"><p role="alert">Lesson {n} could not be loaded. {loaded.error}</p></div></div>;
  return <LessonView key={n} lesson={loaded.lesson} module={loaded.module} navigate={navigate} onProgress={onProgress} />;
}

export function LessonView({ lesson, module, navigate, onProgress }: { lesson: LessonDefinition; module: PhaseModule; navigate: Navigate; onProgress: () => void }) {
  const n = lesson.number;
  const schema = schemaFor(n);
  const { state, update, complete, reset, saveStatus, notice, setNotice } = useLessonState({
    schema, revokeOnAnyEdit: module.revokeOnAnyEdit, onProgress,
    normalizeExtra: module.normalizeExtra ? raw => module.normalizeExtra!(n, raw) : undefined,
  });
  const [preview, setPreview] = useState(false);
  const [resetting, setResetting] = useState(false);
  const done = isComplete(state, schema);
  const markdown = () => module.buildDeliverable ? module.buildDeliverable(lesson, state, done) : buildMarkdown(lesson, state, done, module.deliverableExtra?.(n, state) ?? '');
  const setField = (id: string, value: string) => { update({ fields: { ...state.fields, [id]: value } }); setPreview(false); };
  const checks = checklistStatus(lesson.checklist, state, schema);
  const phase = phaseOf(n);

  function renderBlock(block: Block, key: number) {
    switch (block.type) {
      case 'content': return <Nodes key={key} nodes={block.nodes} navigate={navigate} />;
      case 'video': return <VideoPlaceholder key={key} {...block} />;
      case 'storyboard': return <Storyboard key={key} scenes={block.scenes} sceneMeta={block.sceneMeta} summary={block.summary} />;
      case 'transcript': return <Transcript key={key} scenes={block.scenes} summary={block.summary} />;
      case 'videoPrompt': return <VideoPrompt key={key} {...block} />;
      case 'studied': return <label key={key} className="check"><input type="checkbox" checked={state.studied} onChange={e => update({ studied: e.target.checked })} />{block.label}</label>;
      case 'fields': return <Worksheet key={key} fields={block.ids.map(id => lesson.fields.find(f => f.id === id)!).filter(Boolean)} state={state} onChange={setField} />;
      case 'saveStatus': return <p key={key} className="save-status" role="status">{saveStatus}</p>;
      case 'coach': return <ScriptedCoach key={key} {...block} missing={missingCount(state, schema.ids)} />;
      case 'practice': return <Practice key={key} {...block} />;
      case 'quiz': return <div key={key}>{block.intro && <p>{block.intro}</p>}<KnowledgeCheck name={`lesson-${n}-q`} questions={lesson.questions} answers={state.answers} onAnswer={(i, v) => update({ answers: { ...state.answers, [i]: v } })} /></div>;
      case 'flag': return <label key={key} className="check"><input type="checkbox" checked={state[block.flag] === true} onChange={e => update({ [block.flag]: e.target.checked })} />{block.label}</label>;
      case 'honest': return <label key={key} className="check"><input type="checkbox" checked={state.honest} onChange={e => update({ honest: e.target.checked })} />{block.label}</label>;
      case 'deliverable': return <div key={key}>
        <div className="actions"><button type="button" aria-expanded={preview} onClick={() => setPreview(!preview)}>{preview ? 'Hide preview' : block.previewLabel ?? 'Preview my brief'}</button>
          <button type="button" onClick={() => downloadText(markdown(), lesson.deliverable.filename)}>{block.downloadLabel ?? `Download ${lesson.deliverable.title.replace(/^LYNQ Academy — /, '')}`}</button></div>
        {preview && <pre className="deliverable-preview" tabIndex={0} aria-label="Deliverable preview">{buildPreview(lesson, state)}</pre>}</div>;
      case 'reset': return <div key={key}>
        <button type="button" onClick={() => setResetting(true)}>{block.label ?? 'Clear local draft'}</button>
        {resetting && <div role="alertdialog" aria-labelledby={`reset-${n}`} aria-describedby={`reset-${n}-desc`}><h3 id={`reset-${n}`}>Clear this Lesson {n} draft?</h3><p id={`reset-${n}-desc`}>This removes your local worksheet, tools, quiz answers and completion. Download a copy first if you need it.</p>
          <div className="actions"><button type="button" onClick={() => { reset(blankState()); setPreview(false); setResetting(false); }}>Clear Lesson {n} draft</button><button type="button" autoFocus onClick={() => setResetting(false)}>Keep my draft</button></div></div>}</div>;
      case 'checklist': return <Checklist key={key} checks={checks} />;
      case 'complete': return <div key={key}>
        <button type="button" onClick={() => { if (requirementsMet(state, schema) && complete()) setNotice(block.completedNotice); else setNotice(block.incompleteNotice); }}>{done ? block.completedLabel ?? block.label : block.label}</button>
        <p role="status">{notice || (done ? 'Self-completed locally.' : 'Draft · completion not yet recorded.')}</p></div>;
      case 'next': {
        const next = nextStep(n);
        return next === 'graduation'
          ? <GraduationReview key={key} navigate={navigate} />
          : <div key={key} className="actions"><button type="button" onClick={() => navigate(next.phase, next.lesson)}>Lesson {String(next.lesson).padStart(2, '0')} — {lessonName(next.lesson!)} →</button></div>;
      }
      case 'extension': {
        const Tool = module.extensions[block.id];
        return Tool ? <Tool key={key} lesson={lesson} state={state} update={update} setField={setField} navigate={navigate} props={block.props} /> : <p key={key} role="alert">Missing lesson tool: {block.id}</p>;
      }
    }
  }

  const nav = lesson.nav ?? lesson.sections.map(s => ({ id: s.id, label: s.label }));
  return <div className="native-scroll"><article className="native-page" aria-labelledby={`lesson-${n}-title`}>
    <header className="native-hero">
      <div className="actions"><button type="button" className="secondary" onClick={() => navigate(phase)}>← {['', 'Discover', 'Validate', 'Build', 'Launch', 'Scale'][phase]} dashboard</button></div>
      <div className="step-label">{lesson.hero.eyebrow}</div>
      <h1 id={`lesson-${n}-title`}>{lesson.hero.title}</h1>
      <p>{lesson.hero.intro}</p>
      {lesson.hero.badges?.map(b => <span key={b} className="badge">{b}</span>)} {lesson.hero.meta && <small>{lesson.hero.meta}</small>}
      <nav aria-label="Lesson sections">{nav.map((item, i) => <a key={item.id} href={`#lesson/${n}`} onClick={e => { e.preventDefault(); document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' }); }}>{String(i + 1).padStart(2, '0')} {item.label}</a>)}</nav>
      <p className="lesson-status" role="status">{done ? 'Self-completed locally' : 'Draft · completion not recorded'}</p>
    </header>
    {lesson.sections.map(section => <Step key={section.id} id={section.id} number={section.label} title={section.heading} className={section.className}>{section.blocks.map(renderBlock)}</Step>)}
    <nav className="lesson-pager actions" aria-label="Lesson navigation">
      {n > 1 && <button type="button" className="secondary" onClick={() => navigate(phaseOf(n - 1), n - 1)}>← Lesson {String(n - 1).padStart(2, '0')}</button>}
      <button type="button" className="secondary" onClick={() => navigate(phase)}>Phase overview</button>
      {n < 100 && <button type="button" className="secondary" onClick={() => navigate(phaseOf(n + 1), n + 1)}>Lesson {String(n + 1).padStart(2, '0')} →</button>}
    </nav>
    <footer>{lesson.footer ?? 'LYNQ · Everything. Connected. · Local learning prototype. No cloud saving, reviewer submission or certification.'}</footer>
  </article></div>;
}
