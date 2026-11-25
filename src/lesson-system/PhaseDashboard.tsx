import { useEffect, useState } from 'react';
import type { DashboardDefinition, Navigate } from './types';
import type { Progress } from '../progress';
import { loadPhase } from './registry';
import { Nodes } from './components/Content';
import { GraduationReview } from './components/GraduationReview';
import '../native.css';

const phaseNames = ['Discover', 'Validate', 'Build', 'Launch', 'Scale'];

export function PhaseDashboard({ phase, navigate, progress }: { phase: number; navigate: Navigate; progress: Progress }) {
  const [dashboard, setDashboard] = useState<DashboardDefinition | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true; setDashboard(null);
    loadPhase(phase).then(module => module.loadDashboard()).then(d => { if (live) setDashboard(d); }, e => { if (live) setError(String(e)); });
    return () => { live = false; };
  }, [phase]);
  if (error) return <div className="native-scroll"><div className="native-page"><p role="alert">Dashboard could not be loaded. {error}</p></div></div>;
  if (!dashboard) return <div className="native-scroll"><div className="native-page"><p role="status">Loading {phaseNames[phase - 1]} overview…</p></div></div>;
  return <DashboardView dashboard={dashboard} navigate={navigate} progress={progress} />;
}

export function DashboardView({ dashboard, navigate, progress }: { dashboard: DashboardDefinition; navigate: Navigate; progress: Progress }) {
  const phase = dashboard.phase;
  const lessons = Array.from({ length: 20 }, (_, i) => (phase - 1) * 20 + i + 1);
  const done = (n: number) => progress.complete.includes(n);
  const count = lessons.filter(done).length;
  const resume = lessons.find(n => !done(n));
  return <div className="native-scroll"><div className="native-page dashboard" aria-labelledby={`phase-${phase}-title`}>
    <ol className="phasebar" aria-label="Five-phase journey">{phaseNames.map((name, i) => <li key={name}><button type="button" aria-current={i + 1 === phase ? 'step' : undefined} className={i + 1 === phase ? 'current' : ''} onClick={() => navigate(i + 1)}>{String(i + 1).padStart(2, '0')} {name}</button></li>)}</ol>
    <header className="native-hero dashboard-hero">
      <div className="step-label">{dashboard.hero.eyebrow}</div>
      <h1 id={`phase-${phase}-title`}>{dashboard.hero.title}</h1>
      <p>{dashboard.hero.intro}</p>
      {dashboard.hero.badges?.map(b => <span key={b} className="badge">{b}</span>)}
      <div className="actions">{resume ? <button type="button" onClick={() => navigate(phase, resume)}>{count ? 'Continue with' : 'Begin'} Lesson {String(resume).padStart(2, '0')} →</button> : <button type="button" onClick={() => navigate(phase, lessons[19])}>Review the phase checkpoint →</button>}</div>
    </header>
    <section className="native-step" aria-labelledby={`phase-${phase}-progress`}>
      <h2 id={`phase-${phase}-progress`}>Phase completion</h2>
      <p aria-live="polite"><strong>{count} / 20</strong> self-completed locally</p>
      <div className="bar light" role="progressbar" aria-label={`${dashboard.title} completion`} aria-valuemin={0} aria-valuemax={20} aria-valuenow={count}><i style={{ width: `${count * 5}%` }} /></div>
      {dashboard.phaseStatus && <p>{count === 20 ? dashboard.phaseStatus.complete : dashboard.phaseStatus.incomplete}</p>}
    </section>
    <div className="module-grid">{dashboard.modules.map(module => {
      const moduleDone = module.lessons.filter(l => done(l.number)).length;
      const status = dashboard.moduleStatus?.[module.code];
      return <section className="native-step module-card" key={module.code} aria-labelledby={`module-${module.code}`}>
        <div className="step-label">MODULE {module.code}</div>
        <h2 id={`module-${module.code}`}>{module.title}</h2>
        {module.summary && <p>{module.summary}</p>}
        <p>{moduleDone} / 5 self-completed</p>
        {status && <p className="muted">{moduleDone === 5 ? status.complete : status.incomplete}</p>}
        <ul className="lesson-list">{module.lessons.map(lesson => <li key={lesson.number}>
          <button type="button" className="lesson-row" onClick={() => navigate(phase, lesson.number)}>
            <span className="lesson-number">{String(lesson.number).padStart(2, '0')}</span>
            <span><strong>{lesson.title}</strong>{lesson.summary && <><br /><small>{lesson.summary}</small></>}</span>
            <small className="rowstatus">{done(lesson.number) ? 'Self-completed' : 'Available'}</small>
          </button></li>)}</ul>
      </section>;
    })}</div>
    {dashboard.sections.map((section, i) => <section className="native-step" key={i} aria-label={section.heading}><h2>{section.heading}</h2><Nodes nodes={section.nodes} navigate={navigate} /></section>)}
    {phase === 5 && <section className="native-step"><GraduationReview navigate={navigate} /></section>}
    <footer>LYNQ · Everything. Connected. · Learning completion is recorded locally and does not establish business readiness.</footer>
  </div></div>;
}
