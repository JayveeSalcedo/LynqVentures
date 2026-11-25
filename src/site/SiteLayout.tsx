import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import marketing from '../data/marketing.json';
import type { SitePage } from './pages';
import { Logo } from './Logo';
import './site.css';

const links: { page: SitePage; label: string; href: string }[] = [
  { page: 'home', label: 'Home', href: '#home' },
  { page: 'catalog', label: 'Catalog', href: '#catalog' },
  { page: 'pricing', label: 'Pricing', href: '#pricing' }
];

/** Elements that fade and slide in as they scroll into view. Uses a data attribute so React-managed classes are untouched. */
const REVEAL = '.story, .stats div, .journey li, .tile, .steps li, .callout, .faq details, .final, .course, .tier, .lesson-card';

function useScrollReveal(root: React.RefObject<HTMLElement | null>, key: string) {
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const seen = new Map<Element, number>();
    const targets = [...el.querySelectorAll<HTMLElement>(REVEAL)];
    for (const t of targets) {
      const i = seen.get(t.parentElement!) ?? 0; seen.set(t.parentElement!, i + 1);
      t.style.setProperty('--d', `${Math.min(i, 5) * 80}ms`);
      t.dataset.reveal = 'out';
    }
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { (e.target as HTMLElement).dataset.reveal = 'in'; io.unobserve(e.target); }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    targets.forEach(t => io.observe(t));
    return () => { io.disconnect(); targets.forEach(t => { delete t.dataset.reveal; t.style.removeProperty('--d'); }); };
  }, [root, key]);
}

/** Fades the bottom glass out over the last 120px of scrolling so the footer is never covered. */
function useGlassFade(root: React.RefObject<HTMLElement | null>, key: string) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const remaining = el.scrollHeight - el.clientHeight - el.scrollTop;
      el.style.setProperty('--glass', String(Math.max(0, Math.min(1, remaining / 120))));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    el.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    ro?.observe(el); if (el.firstElementChild) ro?.observe(el.querySelector('.site-main') ?? el);
    return () => { cancelAnimationFrame(frame); el.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); ro?.disconnect(); };
  }, [root, key]);
}

export function SiteLayout({ page, children }: { page: SitePage; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref, page);
  useGlassFade(ref, page);
  return <div className="site" ref={ref}>
    <header className="site-header">
      <a className="site-brand" href="#home" aria-label={`${marketing.brand.name} home`}><Logo height={30} title={marketing.brand.name}/><small>{marketing.brand.tagline}</small></a>
      <nav aria-label="Main">
        {links.map(l => <a key={l.page} href={l.href} aria-current={l.page === page ? 'page' : undefined}>{l.label}</a>)}
        <a className="site-cta" href="#orientation">Start the course</a>
      </nav>
    </header>
    <main className="site-main">{children}</main>
    <footer className="site-footer">
      <span className="footer-brand"><Logo height={18} title={marketing.brand.name}/><strong>{marketing.brand.product}</strong></span>
      <span>Pricing, accounts and certification are not available yet.</span>
    </footer>
    <div className="site-glass" aria-hidden="true"/>
  </div>;
}
