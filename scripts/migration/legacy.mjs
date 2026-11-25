// Migration-time helpers for reading the preserved legacy phase documents.
// Nothing here runs in the application; it only converts trusted curriculum source into JSON data.
import { applyCorrection, matches } from './stale-corrections.mjs';
import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);

/** Main inline script of legacy/lessons/phase-N.html (or 'orientation'). */
export function legacyScript(phase) {
  const name = phase === 'orientation' ? 'orientation' : `phase-${phase}`;
  const html = readFileSync(new URL(`legacy/lessons/${name}.html`, root), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  return scripts.sort((a, b) => b.length - a.length)[0];
}

export function legacyBody(phase) {
  const name = phase === 'orientation' ? 'orientation' : `phase-${phase}`;
  const html = readFileSync(new URL(`legacy/lessons/${name}.html`, root), 'utf8');
  return html.slice(html.indexOf('<body')).replace(/<script[\s\S]*?<\/script>/g, '');
}

/** Parse the JSON literal assigned to `const name=` without evaluating legacy code. */
export function jsonConst(js, name) {
  const match = new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*`).exec(js);
  if (!match) throw new Error(`Missing ${name}`);
  const rest = js.slice(match.index + match[0].length);
  let quoted = null, escaped = false, depth = 0;
  for (let i = 0; i < rest.length; i++) {
    const c = rest[i];
    if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quoted) { quoted = null; if (depth === 0) return JSON.parse(rest.slice(0, i + 1)); } }
    else if (c === '"') quoted = c;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') { depth--; if (depth === 0) return JSON.parse(rest.slice(0, i + 1)); }
  }
  throw new Error(`Unterminated ${name}`);
}

/**
 * Evaluate a pure data literal (array/object of strings/numbers) that is not strict JSON,
 * e.g. single-quoted JS arrays such as `const scenes1=[['a','b']]`. The literal is checked to
 * contain no identifiers outside strings before evaluation, so no legacy code can execute.
 */
export function literalConst(js, name) {
  const match = new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*`).exec(js);
  if (!match) throw new Error(`Missing ${name}`);
  const rest = js.slice(match.index + match[0].length);
  let quoted = null, escaped = false, depth = 0, end = -1;
  for (let i = 0; i < rest.length && end < 0; i++) {
    const c = rest[i];
    if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quoted) quoted = null; }
    else if (c === '"' || c === "'" || c === '`') quoted = c;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') { depth--; if (depth === 0) end = i + 1; }
  }
  const literal = rest.slice(0, end);
  const outside = literal.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\$])*`/g, '""');
  const bare = outside.replace(/^\s*[{,]\s*[A-Za-z_$][\w$]*\s*:/gm, ':').replace(/([{,]\s*)[A-Za-z_$][\w$]*\s*:/g, '$1:');
  if (/[A-Za-z_$(]/.test(bare.replace(/\b(true|false|null)\b/g, ''))) throw new Error(`${name} is not a pure data literal`);
  return Function(`"use strict";return (${literal});`)();
}

const voidTags = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'source', 'wbr', 'col']);
const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', mdash: '—', ndash: '–', hellip: '…', middot: '·', rarr: '→', larr: '←', times: '×', copy: '©' };
export const decode = text => text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : entities[e] ?? m);

/** Parse trusted, generated legacy HTML into a raw element tree: {tag, attrs, children}. */
export function parseHtml(html) {
  const rootNode = { tag: '#root', attrs: {}, children: [] };
  const stack = [rootNode];
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z0-9-]+)\s*>|<([a-zA-Z0-9-]+)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    const top = stack[stack.length - 1];
    if (m[0].startsWith('<!--')) continue;
    if (m[1]) {
      const tag = m[1].toLowerCase();
      const at = stack.map(n => n.tag).lastIndexOf(tag);
      if (at > 0) stack.length = at;
    } else if (m[2]) {
      const tag = m[2].toLowerCase();
      const attrs = {};
      for (const a of (m[3] || '').matchAll(/([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[a[1].toLowerCase()] = a[2] ?? a[3] ?? a[4] ?? null;
      for (const k of Object.keys(attrs)) if (attrs[k] !== null) attrs[k] = decode(attrs[k]);
      const node = { tag, attrs, children: [] };
      top.children.push(node);
      if (!voidTags.has(tag) && !m[4]) stack.push(node);
    } else if (m[5]) {
      top.children.push(decode(m[5]));
    }
  }
  return rootNode.children;
}

/** Find raw nodes matching a predicate (depth-first). */
export function findAll(nodes, predicate, out = []) {
  for (const node of nodes) {
    if (typeof node === 'string') continue;
    if (predicate(node)) out.push(node);
    findAll(node.children, predicate, out);
  }
  return out;
}
export const byId = (nodes, id) => findAll(nodes, n => n.attrs.id === id)[0];
export const textOf = node => typeof node === 'string' ? node : node.children.map(textOf).join(node.tag === 'br' ? '\n' : '');

/**
 * Convert raw legacy nodes into safe ContentNode data for <Content>:
 *  - keeps only class/id/open/colspan/scope/role/aria-label/lang/dir/href attributes;
 *  - turns onclick="openLesson(n)" into {tag:'lesson-link'} and phase navigation into {tag:'phase-link'};
 *  - drops scripts, styles, form controls and other interactive legacy markup (those become typed blocks);
 *  - collapses whitespace-only text.
 */
const keep = ['class', 'id', 'open', 'colspan', 'scope', 'role', 'aria-label', 'lang', 'dir', 'href'];
export function toContent(nodes, { dropIds = [], dropTags = ['script', 'style', 'input', 'textarea', 'select', 'form', 'label', 'dialog', 'iframe', 'img', 'svg'] } = {}) {
  const out = [];
  for (const node of nodes) {
    if (typeof node === 'string') { if (node.trim() || (out.length && node.includes(' '))) out.push(node.replace(/\s+/g, ' ')); continue; }
    if (dropTags.includes(node.tag) || dropIds.includes(node.attrs.id)) continue;
    const children = toContent(node.children, { dropIds, dropTags });
    const onclick = node.attrs.onclick || '';
    const lesson = /openLesson\((\d+)\)/.exec(onclick);
    const phase = /goPhase\((\d)\)|academyPhase['"]?\s*,\s*phase\s*:\s*(\d)/.exec(onclick);
    if (node.tag === 'button' || node.tag === 'a' && onclick) {
      if (lesson) { out.push({ tag: 'lesson-link', attrs: { lesson: lesson[1], class: node.attrs.class ?? null }, children }); continue; }
      if (phase) { out.push({ tag: 'phase-link', attrs: { phase: phase[1] ?? phase[2], class: node.attrs.class ?? null }, children }); continue; }
      if (node.tag === 'button') continue; // other legacy buttons are replaced by typed blocks
    }
    const attrs = {};
    for (const k of keep) if (node.attrs[k] !== undefined) attrs[k] = node.attrs[k];
    out.push({ tag: node.tag, attrs, children });
  }
  // Trim leading/trailing whitespace strings.
  while (typeof out[0] === 'string' && !out[0].trim()) out.shift();
  while (typeof out[out.length - 1] === 'string' && !out[out.length - 1].trim()) out.pop();
  return out;
}

/**
 * Correct statements that only described the old partially-built prototype (e.g. "later lessons are
 * planned previews") and are false now that every lesson is native. Each correction must match at
 * least once across a run (`used` tracks hits) so stale text cannot silently reappear or drift.
 */
export function correctStale(value, corrections, used = new Set()) {
  if (typeof value === 'string') return corrections.reduce((text, c, i) => matches(text, c) ? (used.add(i), applyCorrection(text, c)) : text, value);
  if (Array.isArray(value)) return value.map(v => correctStale(v, corrections, used));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, correctStale(v, corrections, used)]));
  return value;
}
export function assertCorrectionsUsed(corrections, used) {
  const unused = corrections.filter((_, i) => !used.has(i));
  if (unused.length) throw new Error(`Stale-text corrections no longer match the source: ${unused.map(c => c[0]).join(' | ')}`);
}
