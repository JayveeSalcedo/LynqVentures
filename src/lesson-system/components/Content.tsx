import { createElement, type ReactNode } from 'react';
import type { ContentNode, Navigate } from '../types';

/** Tags rendered from curriculum data. Anything else is dropped (with its children kept for text tags only). */
const tags = new Set(['section', 'article', 'div', 'span', 'p', 'h2', 'h3', 'h4', 'h5', 'strong', 'b', 'em', 'i', 'small', 'ul', 'ol', 'li', 'br', 'hr',
  'details', 'summary', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'code', 'pre', 'blockquote', 'dl', 'dt', 'dd', 'sup', 'sub', 'mark', 'figure', 'figcaption']);
const voids = new Set(['br', 'hr']);

/**
 * Render curated curriculum content as React elements. Pseudo-tags produced by the migration
 * converter map legacy navigation onto the React router:
 *   { tag: 'lesson-link', attrs: { lesson: '42' } }  → button opening that lesson
 *   { tag: 'phase-link',  attrs: { phase: '3' } }    → button opening that dashboard
 *   { tag: 'a', attrs: { href } }                     → external https links only
 */
export function Content({ node, navigate }: { node: ContentNode; navigate: Navigate }): ReactNode {
  if (typeof node === 'string') return node.replace('05 · LESSONS 100 · SCALE', '05 · LESSONS 81–100 · SCALE');
  const children = node.children.map((child, i) => <Content key={i} node={child} navigate={navigate} />);
  const className = node.attrs.class || undefined;
  const legacyPhase = /goPhase\((\d)\)/.exec(node.attrs.onclick || '');
  if (node.tag === 'button' && legacyPhase) return <button className={className} onClick={() => navigate(Number(legacyPhase[1]))}>{children}</button>;
  if (node.tag === 'lesson-link') {
    const n = Number(node.attrs.lesson);
    return Number.isInteger(n) && n >= 1 && n <= 100 ? <button type="button" className={className} onClick={() => navigate(Math.ceil(n / 20), n)}>{children}</button> : <>{children}</>;
  }
  if (node.tag === 'phase-link') {
    const p = Number(node.attrs.phase);
    return Number.isInteger(p) && p >= 0 && p <= 5 ? <button type="button" className={className} onClick={() => navigate(p)}>{children}</button> : <>{children}</>;
  }
  if (node.tag === 'a') {
    const href = node.attrs.href || '';
    return /^https:\/\//.test(href) ? <a href={href} className={className} target="_blank" rel="noopener noreferrer">{children}</a> : <span className={className}>{children}</span>;
  }
  if (!tags.has(node.tag)) return null;
  const props: Record<string, unknown> = { id: node.attrs.id || undefined, className };
  if (node.tag === 'details' && node.attrs.open !== undefined) props.open = true;
  if ((node.tag === 'td' || node.tag === 'th') && node.attrs.colspan) props.colSpan = Number(node.attrs.colspan);
  if (node.tag === 'th' && node.attrs.scope) props.scope = node.attrs.scope;
  if (node.attrs.role === 'note' || node.attrs.role === 'status') props.role = node.attrs.role;
  if (node.attrs['aria-label']) props['aria-label'] = node.attrs['aria-label'];
  if (node.attrs.lang) props.lang = node.attrs.lang;
  if (node.attrs.dir) props.dir = node.attrs.dir;
  return voids.has(node.tag) ? createElement(node.tag, props) : createElement(node.tag, props, children);
}

export function Nodes({ nodes, navigate }: { nodes: ContentNode[]; navigate: Navigate }) {
  return <>{nodes.map((node, i) => <Content key={i} node={node} navigate={navigate} />)}</>;
}
