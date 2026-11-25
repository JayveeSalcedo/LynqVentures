import curriculum from '../data/curriculum.json';
import marketing from '../data/marketing.json';
import type { Progress } from '../progress';

const names = curriculum.names as Record<string, string>;

export function Catalog({ progress }: { progress: Progress }) {
  return <>
    <section className="hero compact">
      <div className="eyebrow">Course catalog</div>
      <h1>Everything in the Academy</h1>
      <p className="lead">One orientation module and five phases. Take them in order, or jump to the phase you need.</p>
    </section>

    <section className="section" aria-label="Modules">
      <div className="catalog">
        <article className="course free">
          <header><span className="num">00</span><div><h2>Orientation <span className="pill">Free</span></h2><span className="meta">Module 00</span></div></header>
          <p>Set up your founder profile and commitment before you start the five phases.</p>
          <footer>
            <span className="meta">{progress.orientation ? 'Completed' : 'Not started'}</span>
            <a className="btn primary" href="#orientation">{progress.orientation ? 'Review' : 'Start'}</a>
          </footer>
        </article>

        {curriculum.phases.map((phase, i) => {
          const first = i * 20 + 1, last = first + 19;
          const done = progress.complete.filter(n => n >= first && n <= last).length;
          return <article className="course" key={phase.id}>
            <header><span className="num">{String(phase.id).padStart(2, '0')}</span><div><h2>{phase.title}</h2><span className="meta">Lessons {first}–{last} · {phase.modules.length} modules</span></div></header>
            <p>{marketing.phases[i].blurb}</p>
            <details className="lesson-list">
              <summary>What's inside</summary>
              {phase.modules.map((m, mi) => <div key={m}>
                <h3>{m}</h3>
                <ol start={first + mi * 5}>{Array.from({ length: 5 }, (_, k) => first + mi * 5 + k).map(n => <li key={n}>{names[String(n)]}</li>)}</ol>
              </div>)}
              <p className="outcome"><b>You leave with:</b> {marketing.phases[i].outcome}</p>
            </details>
            <footer>
              <div className="progress"><span className="meta">{done} / 20 completed</span><div className="mini-bar" aria-hidden="true"><i style={{ width: `${done * 5}%` }}/></div></div>
              <a className="btn primary" href={`#phase/${phase.id}`}>{done ? 'Continue' : 'Open'}</a>
            </footer>
          </article>;
        })}
      </div>
    </section>
  </>;
}
