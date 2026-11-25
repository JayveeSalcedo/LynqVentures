import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import curriculum from './data/curriculum.json';
import { readProgress } from './progress';
import './styles.css';
import { hashFor, parseHash } from './routing';
import { NativeLesson } from './NativeLesson';
import { sitePage, siteTitle } from './site/pages';
import { SiteLayout } from './site/SiteLayout';
import { Logo } from './site/Logo';
import { Home } from './site/Home';
import { Catalog } from './site/Catalog';
import { Pricing } from './site/Pricing';
import { LessonPage } from './lesson-system/LessonPage';
import { PhaseDashboard } from './lesson-system/PhaseDashboard';
function App() {
  const [location, setLocation] = useState(() => parseHash(window.location.hash));
  const [page, setPage] = useState(() => sitePage(window.location.hash));
  const [menu, setMenu] = useState(false);
  const [progress, setProgress] = useState(readProgress);
  function navigate(phase: number, lesson: number | null = null) {
    window.location.hash = hashFor(phase, lesson);
    setMenu(false);
  }
  function refresh() {
    const next = readProgress();
    setProgress(old => JSON.stringify(old) === JSON.stringify(next) ? old : next);
  }
  useEffect(() => {
    const onHash = () => { setLocation(parseHash(window.location.hash)); setPage(sitePage(window.location.hash)); setMenu(false); };
    window.addEventListener('hashchange', onHash);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('hashchange', onHash); window.removeEventListener('storage', refresh); };
  }, []);
  useEffect(refresh, [location, page]);
  useEffect(() => { document.title = page ? siteTitle[page] : 'LYNQ Venture Studio Academy'; if (page) window.scrollTo(0, 0); }, [page]);
  if (page) return <SiteLayout page={page}>{page === 'home' ? <Home progress={progress}/> : page === 'catalog' ? <Catalog progress={progress}/> : <Pricing/>}</SiteLayout>;
  const title = location.phase ? `Phase ${String(location.phase).padStart(2,'0')} · ${curriculum.phases[location.phase-1].title}${location.lesson ? ` / Lesson ${location.lesson}` : ''}` : 'Module 00 · Welcome & Orientation';
  return <div className={`app ${menu ? 'menu' : ''}`}>
    <aside className="side" id="academy-navigation" aria-label="Academy phases and lessons">
      <a className="brand" href="#home" aria-label="LYNQ home"><Logo height={28}/></a><div className="tag">EVERYTHING. CONNECTED.</div>
      <div className="overall"><strong>Venture Studio Academy</strong><p aria-live="polite">{progress.complete.length} / 100 self-completed</p><ProgressBar value={progress.complete.length} label="Overall completion"/><small>Saved in this browser only</small></div>
      <button className={`phasehome ${!location.phase ? 'current' : ''}`} onClick={() => navigate(0)} aria-current={!location.phase ? 'page' : undefined}>Module 00 · Welcome & Orientation</button>
      <p className="orientation-status">{progress.orientation ? 'Orientation self-completed locally' : 'Orientation available'}</p>
      {curriculum.phases.map(phase => {
        const count = progress.complete.filter(n => Math.ceil(n/20) === phase.id).length;
        return <details className="phase" key={phase.id} open={location.phase === phase.id || undefined}>
          <summary><span>{String(phase.id).padStart(2,'0')} · {phase.title}</span><small>{count} / 20</small></summary>
          <button className="phasehome" onClick={() => navigate(phase.id)}>Open {phase.title} overview</button>
          <ProgressBar value={count*5} label={`${phase.title} completion`}/>
          {phase.modules.map((module, mi) => <React.Fragment key={module}><p className="moduleLabel">{module}</p>{Array.from({length:5},(_,i) => (phase.id-1)*20+mi*5+i+1).map(n => <button key={n} className={`lessonLink ${location.lesson === n ? 'active' : ''}`} aria-current={location.lesson === n ? 'page' : undefined} onClick={() => navigate(phase.id,n)}><span>{String(n).padStart(2,'0')}</span><span>{curriculum.names[String(n) as keyof typeof curriculum.names]}</span><small>{progress.complete.includes(n) ? 'Self-completed' : 'Available'}</small></button>)}</React.Fragment>)}
        </details>;
      })}
      <p className="limitations">100 lessons with a live AI Coach. Videos, cloud saving and certification are coming soon.</p>
    </aside>
    <main className="main"><header className="top"><button className="toggle" aria-expanded={menu} aria-controls="academy-navigation" onClick={() => setMenu(!menu)}>Phases & lessons</button><strong>{title}</strong><a className="site-link" href="#home">LYNQ Academy home</a></header>
      {!location.phase
        ? <NativeLesson key="orientation" orientation navigate={navigate} onProgress={refresh}/>
        : location.lesson
          ? <LessonPage key={location.lesson} n={location.lesson} navigate={navigate} onProgress={refresh}/>
          : <PhaseDashboard key={location.phase} phase={location.phase} navigate={navigate} progress={progress}/>}
    </main>
  </div>;
}
function ProgressBar({value,label}:{value:number;label:string}) {
  return <div className="bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><i style={{width:`${value}%`}}/></div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
