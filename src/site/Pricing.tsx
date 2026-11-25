import marketing from '../data/marketing.json';
import { Faq } from './Home';

export function Pricing() {
  const { tiers, placeholder, note } = marketing.pricing;
  return <>
    <section className="hero compact">
      <div className="eyebrow">Pricing</div>
      <h1>Simple, self-paced access</h1>
      <p className="lead">Start free, then choose how you want to complete the Academy.</p>
      {placeholder && <p className="draft" role="note">{note}</p>}
    </section>

    <section className="section" aria-label="Plans">
      <div className="tiers">
        {tiers.map(tier => <article className={`tier ${tier.highlight ? 'highlight' : ''}`} key={tier.name}>
          {tier.highlight && <span className="pill">Most popular</span>}
          <h2>{tier.name}</h2>
          <p className="price"><strong>{tier.price}</strong>{tier.period && <small> {tier.period}</small>}</p>
          <p>{tier.description}</p>
          <ul>{tier.features.map(f => <li key={f}>{f}</li>)}</ul>
          {tier.cta.href
            ? <a className={`btn ${tier.highlight ? 'primary' : 'secondary'}`} href={tier.cta.href}>{tier.cta.label}</a>
            : <button className="btn secondary" type="button" disabled>{tier.cta.label} (coming soon)</button>}
        </article>)}
      </div>
    </section>

    <Faq />
  </>;
}
