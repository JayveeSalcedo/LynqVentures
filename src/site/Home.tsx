import curriculum from '../data/curriculum.json';
import marketing from '../data/marketing.json';
import type { Progress } from '../progress';

export const courseStats = () => ({
  lessons: Object.keys(curriculum.names).length,
  phases: curriculum.phases.length,
  modules: curriculum.phases.reduce((sum, p) => sum + p.modules.length, 0)
});

export function Home({ progress }: { progress: Progress }) {
  const stats = courseStats();
  const started = progress.complete.length > 0 || progress.orientation;
  return <>
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow">{marketing.hero.eyebrow}</div>
        <h1>{marketing.hero.title}</h1>
        <p className="lead">{marketing.hero.intro}</p>
        <div className="hero-actions">
          <a className="btn primary" href="#orientation">{started ? 'Continue the course' : 'Start free orientation'}</a>
          <a className="btn secondary" href="#catalog">Browse the catalog</a>
        </div>
      </div>
      <div className="hero-media">
        <a className="pill-cta" href="#lesson/1">{marketing.hero.previewLabel}</a>
        <a className="media-card lesson-card" href="#lesson/1" aria-label="Open Lesson 1">
          <span className="eyebrow">{marketing.hero.preview.eyebrow}</span>
          <strong>{curriculum.names['1']}</strong>
          <span>{marketing.hero.preview.summary}</span>
          <ul>{marketing.hero.preview.points.map(t => <li key={t}>{t}</li>)}</ul>
        </a>
      </div>
    </section>

    <section className="story" aria-labelledby="story-heading">
      <svg className="lines" viewBox="0 0 1000 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <g fill="none" stroke="#BCF2DF" strokeOpacity=".35" strokeWidth="2">
          <path d="M0 90H70a30 30 0 0 1 30 30V300"/><path d="M0 230H40a24 24 0 0 0 24-24V150"/>
          <path d="M1000 60H920a30 30 0 0 0-30 30V250a30 30 0 0 0 30 30H1000"/><path d="M1000 340H860a30 30 0 0 1-30-30"/>
        </g>
        <g fill="#BCF2DF" fillOpacity=".5"><circle cx="100" cy="300" r="5"/><circle cx="64" cy="150" r="5"/><circle cx="890" cy="90" r="5"/><circle cx="830" cy="310" r="5"/></g>
      </svg>
      <h2 id="story-heading"><span className="mark">{marketing.story.heading}</span></h2>
      {marketing.story.paragraphs.map(t => <p key={t}>{t}</p>)}
    </section>

    <dl className="stats strip">
      <div><dt>Lessons</dt><dd>{stats.lessons}</dd></div>
      <div><dt>Phases</dt><dd>{stats.phases}</dd></div>
      <div><dt>Modules</dt><dd>{stats.modules}</dd></div>
    </dl>

    <section className="section" aria-labelledby="journey">
      <h2 id="journey">One journey, five phases</h2>
      <ol className="journey">
        {curriculum.phases.map((phase, i) => <li key={phase.id}>
          <span className="num">{String(phase.id).padStart(2, '0')}</span>
          <h3>{phase.title}</h3>
          <p>{marketing.phases[i].blurb}</p>
          <small><b>You leave with:</b> {marketing.phases[i].outcome}</small>
        </li>)}
      </ol>
    </section>

    <section className="section" aria-labelledby="inside">
      <h2 id="inside">What's inside</h2>
      <div className="grid">
        {marketing.features.map(f => <article className="tile" key={f.title}><h3>{f.title}</h3><p>{f.text}</p></article>)}
      </div>
    </section>

    <section className="section" aria-labelledby="how">
      <h2 id="how">How it works</h2>
      <ol className="steps">
        {marketing.steps.map((s, i) => <li key={s.title}><span className="num">{i + 1}</span><div><h3>{s.title}</h3><p>{s.text}</p></div></li>)}
      </ol>
    </section>

    <section className="section" aria-labelledby="honest">
      <div className="callout">
        <h2 id="honest">What's not available yet</h2>
        <ul>{marketing.notYet.map(t => <li key={t}>{t}</li>)}</ul>
      </div>
    </section>

    <Faq />

    <section className="section final">
      <h2>Ready to begin?</h2>
      <p>Start with the free orientation module. No sign-up needed.</p>
      <a className="btn primary" href="#orientation">Start free orientation</a>
    </section>
  </>;
}

export function Faq() {
  return <section className="section" aria-labelledby="faq">
    <h2 id="faq">Frequently asked questions</h2>
    <div className="faq">
      {marketing.faq.map(item => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}
    </div>
  </section>;
}
