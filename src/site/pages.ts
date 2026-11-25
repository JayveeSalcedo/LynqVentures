/** Marketing pages live on hash routes alongside the course: #home (or empty), #catalog, #pricing. Any other hash belongs to the course. */
export type SitePage = 'home' | 'catalog' | 'pricing';

export function sitePage(hash: string): SitePage | null {
  if (hash === '' || hash === '#' || hash === '#home') return 'home';
  if (hash === '#catalog') return 'catalog';
  if (hash === '#pricing') return 'pricing';
  return null;
}

export const siteTitle: Record<SitePage, string> = {
  home: 'LYNQ Venture Studio Academy',
  catalog: 'Course catalog · LYNQ Venture Studio Academy',
  pricing: 'Pricing · LYNQ Venture Studio Academy'
};
