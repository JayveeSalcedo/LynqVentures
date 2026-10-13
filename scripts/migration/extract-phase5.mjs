// Phase 5 (Scale, Lessons 81–100) extractor.
// Reads the preserved legacy document legacy/lessons/phase-5.html and writes typed lesson/dashboard JSON:
//   src/data/lessons/phase-5/lesson-81.json … lesson-100.json
//   src/data/dashboards/phase-5.json
// Deterministic and re-runnable: `node scripts/migration/extract-phase5.mjs`.
// Curriculum text comes from `configs`/`templates`; logic-embedded strings (coach replies, practice feedback,
// record-log/check-panel/prompt/CEO-draft wording) are parsed out of the legacy functions with strict patterns
// that throw when the source does not match, so nothing is silently dropped.
import { mkdirSync, writeFileSync } from 'node:fs';
import { legacyScript, legacyBody, jsonConst, literalConst, parseHtml, findAll, byId, toContent } from './legacy.mjs';

const root = new URL('../../', import.meta.url);
const js = legacyScript(5);
const configs = jsonConst(js, 'configs');
const templates = jsonConst(js, 'templates');
const curriculum = JSON.parse((await import('node:fs')).readFileSync(new URL('src/data/curriculum.json', root), 'utf8'));
const LESSONS = Array.from({ length: 20 }, (_, i) => 81 + i);

// ---------------------------------------------------------------------------------------------
// Small helpers for reading legacy JS source without executing it.
const STR = `'(?:\\\\.|[^'\\\\])*'`;
/** Decode a single-quoted JS string literal (including quotes). */
export function decodeJs(lit) {
  if (!/^'(?:\\.|[^'\\])*'$/s.test(lit)) throw new Error(`Not a string literal: ${lit.slice(0, 60)}`);
  return lit.slice(1, -1).replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/gs, (m, e) => {
    if (e[0] === 'u' && e.length === 5) return String.fromCharCode(parseInt(e.slice(1), 16));
    if (e[0] === 'x' && e.length === 3) return String.fromCharCode(parseInt(e.slice(1), 16));
    return { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' }[e] ?? e;
  });
}
/** Source of `function name(...){...}` (brace matched, string aware). */
function fnSource(name) {
  const at = js.search(new RegExp(`function ${name}\\(`));
  if (at < 0) throw new Error(`Missing function ${name}`);
  let depth = 0, quoted = null, escaped = false, started = false;
  for (let i = at; i < js.length; i++) {
    const c = js[i];
    if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quoted) quoted = null; continue; }
    if (c === "'" || c === '"' || c === '`') quoted = c;
    else if (c === '{') { depth++; started = true; }
    else if (c === '}') { depth--; if (started && depth === 0) return js.slice(at, i + 1); }
  }
  throw new Error(`Unterminated function ${name}`);
}
function must(re, text, what) {
  const m = re.exec(text);
  if (!m) throw new Error(`Pattern not found: ${what}`);
  return m;
}

// Tokenizer + parser for the string-concatenation expressions used by the CEO builders and record cards.
function tokenize(src) {
  const out = [];
  const re = /\s*(?:('(?:\\.|[^'\\])*')|([A-Za-z_$][\w$.]*)|(===|\+|\?|:|\(|\)))/gsy;
  let m;
  while (re.lastIndex < src.length) {
    const at = re.lastIndex;
    m = re.exec(src);
    if (!m) { if (/^\s*$/.test(src.slice(at))) break; throw new Error(`Cannot tokenize: ${src.slice(at, at + 60)}`); }
    if (m[1]) out.push({ t: 'str', v: decodeJs(m[1]) });
    else if (m[2]) out.push({ t: 'id', v: m[2] });
    else out.push({ t: 'op', v: m[3] });
  }
  return out;
}
/** Parse `'a'+note('x')+ref+fn()` or `mode==='x'?A:mode==='y'?B:C` into Segment data. */
function parseExpr(src) {
  const toks = tokenize(src);
  let i = 0;
  const peek = (k = 0) => toks[i + k];
  const eat = (t, v) => { const tok = toks[i++]; if (!tok || tok.t !== t || (v !== undefined && tok.v !== v)) throw new Error(`Unexpected ${JSON.stringify(tok)} in ${src.slice(0, 80)}`); return tok; };
  function concat() {
    const segs = [];
    for (;;) {
      const tok = toks[i++];
      if (tok.t === 'str') segs.push({ t: 'text', v: tok.v });
      else if (tok.t === 'id' && peek()?.v === '(') {
        eat('op', '(');
        if (tok.v === 'note') { segs.push({ t: 'note', id: eat('str').v }); eat('op', ')'); }
        else { eat('op', ')'); segs.push({ t: 'call', name: tok.v }); }
      } else if (tok.t === 'id') segs.push({ t: 'ref', name: tok.v });
      else throw new Error(`Unexpected ${JSON.stringify(tok)}`);
      if (peek()?.v !== '+') break;
      i++;
    }
    return segs.reduce((acc, s) => { const last = acc[acc.length - 1]; if (s.t === 'text' && last?.t === 'text') last.v += s.v; else acc.push({ ...s }); return acc; }, []);
  }
  function expr() {
    if (peek()?.t === 'id' && peek().v === 'mode' && peek(1)?.v === '===') {
      const cases = [];
      while (peek()?.t === 'id' && peek().v === 'mode' && peek(1)?.v === '===') {
        i += 2; const mode = eat('str').v; eat('op', '?');
        cases.push({ mode, segs: concat() }); eat('op', ':');
      }
      return { cases, otherwise: concat() };
    }
    return concat();
  }
  const result = expr();
  if (i !== toks.length) throw new Error(`Trailing tokens in ${src.slice(0, 80)}`);
  return result;
}

// ---------------------------------------------------------------------------------------------
// HTML helpers
const text = node => typeof node === 'string' ? node : node.tag === 'br' ? ' ' : node.children.map(text).join('');
const clean = s => s.replace(/\s+/g, ' ').trim();
const kids = node => node.children.filter(c => typeof c !== 'string' || c.trim());
const has = (node, pred) => findAll([node], pred).length > 0;
const onclickOf = node => node.attrs?.onclick || '';
const calls = (node, re) => findAll([node], n => re.test(onclickOf(n)));
const labelFor = (scope, id) => { const l = findAll([scope], n => n.tag === 'label' && n.attrs.for === id)[0]; if (!l) throw new Error(`No label for ${id}`); return clean(text(l)); };

// ---------------------------------------------------------------------------------------------
// Logic-embedded strings parsed from legacy functions.
const coachSrc = fnSource('coachMode');
const practiceSrc = fnSource('practice');
function coachFor(n) {
  const re = n === 81
    ? new RegExp(`\\}\\$\\('chat'\\)\\.textContent=(${STR})\\+mode\\+(${STR})\\}$`)
    : new RegExp(`current===${n}\\)\\{\\$\\('chat'\\)\\.textContent=(${STR})\\+mode\\+(${STR});return\\}`);
  const m = must(re, coachSrc, `coach ${n}`);
  return { prefix: decodeJs(m[1]), suffix: decodeJs(m[2]) };
}
function practiceFor(n) {
  const re = n === 81
    ? new RegExp(`\\}\\$\\('practiceFeedback'\\)\\.textContent=i===1\\?(${STR}):(${STR})\\}$`)
    : new RegExp(`current===${n}\\)\\{\\$\\('practiceFeedback'\\)\\.textContent=i===1\\?(${STR}):(${STR});return\\}`);
  const m = must(re, practiceSrc, `practice ${n}`);
  return { one: decodeJs(m[1]), other: decodeJs(m[2]) };
}
const briefSrc = fnSource('brief');
function briefSectionsFor(n) {
  const block = new RegExp(`\\(current===${n}\\?((?:${STR}\\+JSON\\.stringify\\(\\w+\\(\\),null,2\\)\\+'\\\\n'\\+\\w+\\(\\)\\+?)+):''\\)`).exec(briefSrc);
  if (!block) return [];
  return [...block[1].matchAll(new RegExp(`(${STR})\\+JSON\\.stringify\\((\\w+)\\(\\),null,2\\)\\+'\\\\n'\\+(\\w+)\\(\\)`, 'g'))].map(m => {
    const heading = decodeJs(m[1]);
    if (!heading.startsWith('\n\n## ') || !heading.endsWith('\n')) throw new Error(`Unexpected brief heading ${heading}`);
    return { heading: heading.slice(5, -1), values: m[2], result: m[3] };
  });
}
const briefFooter = decodeJs(must(new RegExp(`\\+(${STR})\\}$`), briefSrc, 'brief footer')[1]);

function recordLogFor(n, stem, note) {
  const Stem = stem[0].toUpperCase() + stem.slice(1);
  const render = fnSource(`render${Stem}${n}`), add = fnSource(`add${Stem}${n}`), exp = fnSource(`export${Stem}${n}`);
  const stateKey = must(new RegExp(`state\\.(\\w+Rows)\\.forEach`), render, 'rows key')[1];
  const kinds = literalConst(js, `${stem}Kinds${n}`);
  const countsPrefix = decodeJs(must(new RegExp(`Counts${n}'\\)\\.textContent=(${STR})\\+${stem}Kinds${n}`), render, 'counts')[1]);
  const card = parseExpr(must(/card\.textContent=(.*?);let b=/s, render, 'card')[1]);
  const removeLabel = decodeJs(must(new RegExp(`b\\.textContent=(${STR})\\+\\(i\\+1\\)`), render, 'remove')[1]);
  const filterM = new RegExp(`FilterStatus${n}'\\)\\.textContent=\\w+\\?(${STR}):(${STR});`).exec(render);
  const hidden = filterM ? decodeJs(must(new RegExp(`if\\(\\w+Exceptions${n}&&row\\.kind===(${STR})\\)return`), render, 'hidden kind')[1]) : null;
  const map = Object.fromEntries([...must(/let map=\{([^}]*)\}/, add, 'map')[1].matchAll(new RegExp(`(\\w+):(${STR})`, 'g'))].map(m => [m[1], decodeJs(m[2])]));
  const kindId = must(new RegExp(`row=\\{kind:\\$\\((${STR})\\)\\.value\\}`), add, 'kind id')[1];
  const statusMsgs = [...add.matchAll(new RegExp(`Status${n}'\\)\\.textContent=(${STR})`, 'g'))].map(m => decodeJs(m[1]));
  const limit = Number(must(/\.length>=(\d+)\)/, add, 'limit')[1]);
  if (statusMsgs.length !== 4) throw new Error(`record log ${n}: expected 4 messages`);
  const expM = must(new RegExp(`download\\(JSON\\.stringify\\(\\{(.*)\\},null,2\\),(${STR})\\)\\}$`, 's'), exp, 'export');
  const exportSpec = splitTop(expM[1]).map(entry => {
    const m = must(/^(\w+):(.*)$/s, entry, 'export entry');
    const v = m[2];
    if (/^\d+$/.test(v)) return [m[1], { lit: Number(v) }];
    if (v.startsWith("'")) return [m[1], { lit: decodeJs(v) }];
    if (v === 'state.fields') return [m[1], { ref: 'fields' }];
    if (v === `state.${stateKey}`) return [m[1], { ref: 'rows' }];
    const call = /^(\w+)\(\)$/.exec(v); if (call) return [m[1], { fn: call[1] }];
    throw new Error(`Unknown export value ${v}`);
  });
  // UI labels from the template note.
  const buttons = findAll([note], b => b.tag === 'button');
  const btn = re => { const b = buttons.find(x => re.test(onclickOf(x))); return b ? clean(text(b)) : null; };
  const columns = ['source', 'text', 'meaning', 'review'].map(key => {
    const el = byId([note], map[key]);
    return { key, label: labelFor(note, map[key]), maxLength: Number(el.attrs.maxlength) };
  });
  const idEl = byId([note], map.id);
  const kindEl = byId([note], decodeJs(kindId));
  const options = findAll([kindEl], o => o.tag === 'option').map(o => clean(text(o)));
  if (JSON.stringify(options) !== JSON.stringify(kinds)) throw new Error(`kind options ${n}`);
  const rowsEl = byId([note], `${stem}Rows${n}`);
  return {
    lesson: n, stateKey, title: clean(text(findAll([note], x => x.tag === 'h3')[0])),
    intro: kids(note).filter(x => typeof x !== 'string' && x.tag === 'p' && !x.attrs.id).map(x => clean(text(x))),
    idField: { label: labelFor(note, map.id), maxLength: Number(idEl.attrs.maxlength) },
    kindField: { label: labelFor(note, decodeJs(kindId)), options: kinds },
    columns,
    addLabel: btn(/^add/),
    limit,
    messages: { missing: statusMsgs[0], duplicate: statusMsgs[1], limit: statusMsgs[2], added: statusMsgs[3] },
    countsPrefix, card, removeLabel,
    filter: filterM ? { allLabel: btn(/\(false\)/), exceptionsLabel: btn(/\(true\)/), exceptionsStatus: decodeJs(filterM[1]), allStatus: decodeJs(filterM[2]), hiddenKind: hidden } : null,
    grid: /grid/.test(rowsEl.attrs.style || ''),
    exportLabel: btn(new RegExp(`^export${Stem}${n}`)),
    exportFilename: decodeJs(expM[2]),
    exportSpec,
  };
}
function splitTop(body) {
  const parts = []; let depth = 0, quoted = false, escaped = false, start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === "'") quoted = false; continue; }
    if (c === "'") quoted = true; else if ('([{'.includes(c)) depth++; else if (')]}'.includes(c)) depth--;
    else if (c === ',' && depth === 0) { parts.push(body.slice(start, i)); start = i + 1; }
  }
  parts.push(body.slice(start));
  return parts;
}

function checkPanelFor(n, stem, note) {
  const ids = literalConst(js, `${stem}CheckIds${n}`), labels = literalConst(js, `${stem}CheckLabels${n}`);
  const values = fnSource(`${stem}Values${n}`), result = fnSource(`${stem}Result${n}`);
  const expectValues = `function ${stem}Values${n}(){return Object.fromEntries(${stem}CheckIds${n}.map(id=>[id,${stem}CheckLabels${n}.includes(state.fields[id])?state.fields[id]:${stem}CheckLabels${n}[0]]))}`;
  if (values !== expectValues) throw new Error(`Unexpected values function ${n}`);
  const r = must(new RegExp(`^function ${stem}Result${n}\\(\\)\\{let v=Object\\.values\\(${stem}Values${n}\\(\\)\\);if\\(v\\.includes\\(${stem}CheckLabels${n}\\[3\\]\\)\\)return (${STR});if\\(v\\.includes\\(${stem}CheckLabels${n}\\[2\\]\\)\\)return (${STR});if\\(v\\.includes\\(${stem}CheckLabels${n}\\[0\\]\\)\\)return (${STR});return (${STR})\\}$`), result, `result ${n}`);
  return {
    title: clean(text(findAll([note], x => x.tag === 'h3')[0])),
    intro: kids(note).filter(x => typeof x !== 'string' && x.tag === 'p' && !x.attrs.id).map(x => clean(text(x))),
    items: ids.map(id => ({ id, label: labelFor(note, id) })),
    options: labels,
    results: { hold: decodeJs(r[1]), contrary: decodeJs(r[2]), unknown: decodeJs(r[3]), ready: decodeJs(r[4]) },
    valuesFn: `${stem}Values${n}`, resultFn: `${stem}Result${n}`,
  };
}

function calculatorFor(n, note) {
  const calc = { 84: 'calc84', 85: 'cohort85', 92: 'runway92', 97: 'dilution97' }[n];
  const items = [];
  const before = [], after = [];
  let seenInput = false;
  for (const child of kids(note)) {
    if (typeof child === 'string') continue;
    if (child.tag === 'h3') continue;
    const inputs = findAll([child], x => x.tag === 'input' || x.tag === 'select');
    if (child.tag === 'p' && !child.attrs.id) { (seenInput ? after : before).push(clean(text(child))); continue; }
    if (child.tag === 'p' || child.tag === 'pre') { seenInput = true; continue; } // output element
    if (child.tag === 'label' && child.attrs.class === 'check') {
      const input = inputs[0]; seenInput = true;
      items.push({ id: input.attrs.id, label: clean(text(child)), kind: 'checkbox' });
      continue;
    }
    if (child.tag === 'label') continue;
    for (const input of inputs) {
      seenInput = true;
      const item = { id: input.attrs.id, label: labelFor(note, input.attrs.id), kind: input.tag === 'select' ? 'select' : 'number' };
      if (input.tag === 'select') item.options = findAll([input], o => o.tag === 'option').map(o => clean(text(o)));
      for (const k of ['min', 'max']) if (input.attrs[k] !== undefined) item[k] = input.attrs[k];
      items.push(item);
    }
  }
  return { calc, title: clean(text(findAll([note], x => x.tag === 'h3')[0])), intro: before, items, after };
}

const PROMPT_TAIL = new RegExp(`\\.value='ROLE: '\\+role\\+'\\\\nTASK: '\\+tasks\\[role\\]\\+(${STR})\\+brief\\(\\)\\}$`);
function promptFor(n, stem, note) {
  const Stem = stem[0].toUpperCase() + stem.slice(1);
  const prep = fnSource(`prepare${Stem}${n}`), exp = fnSource(`export${Stem}Prompt${n}`);
  const tasks = Object.fromEntries([...must(/let tasks=\{(.*?)\};\$\(/s, prep, 'tasks')[1].matchAll(new RegExp(`(\\w+):(${STR})`, 'g'))].map(m => [m[1], decodeJs(m[2])]));
  const boundaries = decodeJs(must(PROMPT_TAIL, prep, `prompt tail ${n}`)[1]);
  const em = must(new RegExp(`\\.value=(${STR});return\\}download\\(\\$\\('\\w+'\\)\\.value,(${STR})\\)\\}$`), exp, 'prompt export');
  const area = findAll([note], x => x.tag === 'textarea')[0];
  const buttons = findAll([note], b => b.tag === 'button');
  return {
    title: clean(text(findAll([note], x => x.tag === 'h3')[0])),
    intro: kids(note).filter(x => typeof x !== 'string' && x.tag === 'p').map(x => clean(text(x))),
    buttons: buttons.filter(b => /^prepare/.test(onclickOf(b))).map(b => ({ role: must(/\('(\w+)'\)/, onclickOf(b), 'role')[1], label: clean(text(b)) })),
    tasks, boundaries,
    textareaLabel: area.attrs['aria-label'], rows: Number(area.attrs.rows),
    downloadLabel: clean(text(buttons.find(b => /^export/.test(onclickOf(b))))),
    emptyMessage: decodeJs(em[1]), filename: decodeJs(em[2]),
    clearOnEdit: n >= 93,
  };
}

function ceoFor(n, note) {
  const build = fnSource(`buildCeo${n}`), exp = fnSource(`exportCeo${n}`);
  const area = findAll([note], x => x.tag === 'textarea')[0];
  const buttons = findAll([note], b => b.tag === 'button');
  const base = {
    title: clean(text(findAll([note], x => x.tag === 'h3')[0])),
    intro: kids(note).filter(x => typeof x !== 'string' && x.tag === 'p').map(x => clean(text(x))),
    buttons: buttons.filter(b => /^buildCeo/.test(onclickOf(b))).map(b => ({ mode: must(/\('(\w+)'\)/, onclickOf(b), 'mode')[1], label: clean(text(b)) })),
    textareaLabel: area.attrs['aria-label'], rows: Number(area.attrs.rows),
    downloadLabel: clean(text(buttons.find(b => /^exportCeo/.test(onclickOf(b))))),
  };
  if (n === 100) {
    const fm = must(new RegExp(`^function exportCeo100\\(\\)\\{if\\(!\\$\\('ceoDraft100'\\)\\.value\\)return;download\\(\\$\\('ceoDraft100'\\)\\.value,(${STR})\\)\\}$`), exp, 'ceo100 export');
    const m = must(new RegExp(`ids=mode==='plan'\\?(\\[[^\\]]*\\]):mode==='pitch'\\?(\\[[^\\]]*\\]):c\\.fields\\.map\\(x=>x\\[0\\]\\);\\$\\('ceoDraft100'\\)\\.value='# '\\+\\(mode==='plan'\\?(${STR}):mode==='pitch'\\?(${STR}):(${STR})\\)\\+(${STR})\\+ids\\.map\\(id=>'## '\\+c\\.fields\\.find\\(x=>x\\[0\\]===id\\)\\[1\\]\\+'\\\\n'\\+note\\(id\\)\\)\\.join\\('\\\\n\\\\n'\\)\\+(${STR})\\+JSON\\.stringify\\(state\\.finalRows,null,2\\)\\+(${STR})\\+finalResult100\\(\\)\\+(${STR})\\}$`), build, 'ceo100');
    const empty = must(new RegExp(`note=id=>state\\.fields\\[id\\]\\?\\.trim\\(\\)\\|\\|(${STR})`), build, 'note fallback');
    return { ...base, kind: 'final100', filename: decodeJs(fm[1]), emptyMessage: null, unknown: decodeJs(empty[1]),
      final: { ids: { plan: literalConst(`const x=${m[1]}`, 'x'), pitch: literalConst(`const x=${m[2]}`, 'x') }, titles: { plan: decodeJs(m[3]), pitch: decodeJs(m[4]), otherwise: decodeJs(m[5]) },
        afterTitle: decodeJs(m[6]), beforeRows: decodeJs(m[7]), beforeResult: decodeJs(m[8]), footer: decodeJs(m[9]) } };
  }
  const fm = must(new RegExp(`^function exportCeo${n}\\(\\)\\{if\\(!\\$\\('ceoDraft${n}'\\)\\.value\\)\\{\\$\\('ceoDraft${n}'\\)\\.value=(${STR});return\\}download\\(\\$\\('ceoDraft${n}'\\)\\.value,(${STR})\\)\\}$`), exp, `ceo export ${n}`);
  const m = must(new RegExp(`^function buildCeo${n}\\(mode\\)\\{let note=id=>state\\.fields\\[id\\]\\?\\.trim\\(\\)\\|\\|(${STR}),records=state\\.(\\w+)\\.map\\(r=>r\\.id\\+' \\| '\\+r\\.kind\\+' \\| '\\+r\\.source\\+' \\| '\\+r\\.text\\+' \\| '\\+r\\.meaning\\+' \\| '\\+r\\.review\\)\\.join\\('\\\\n'\\)\\|\\|(${STR});let body=(.*?);\\$\\('ceoDraft${n}'\\)\\.value=(.*)\\}$`, 's'), build, `ceo ${n}`);
  return { ...base, kind: 'segments', emptyMessage: decodeJs(fm[1]), filename: decodeJs(fm[2]), unknown: decodeJs(m[1]), rowsKey: m[2], recordsEmpty: decodeJs(m[3]), body: parseExpr(m[4]), draft: parseExpr(m[5]) };
}

// ---------------------------------------------------------------------------------------------
const STEMS = { 81: 'ready', 82: 'bottle', 83: 'growth', 84: 'econ', 85: 'retain', 86: 'partner', 87: 'org', 88: 'leader', 89: 'process', 90: 'kpi', 91: 'control', 92: 'capital', 93: 'diligence', 94: 'expansion', 95: 'governance', 96: 'strategic', 97: 'valuation', 98: 'transition', 99: 'exit', 100: 'final' };
const ext = (id, props) => ({ type: 'extension', id, props });

function buildLesson(n) {
  const cfg = configs[n];
  const stem = STEMS[n];
  const nodes = parseHtml(templates[n]);
  const intro = findAll(nodes, x => x.attrs.class === 'lessonintro')[0];
  const articles = nodes.filter(x => typeof x !== 'string' && x.tag === 'article');
  if (articles.length !== 7) throw new Error(`Lesson ${n}: expected 7 steps`);
  const fieldsById = new Map();
  for (const [id, label] of cfg.fields) fieldsById.set(id, { id, label, kind: 'textarea', required: true, maxLength: 2000 });
  const worksheetIds = cfg.fields.map(f => f[0]);
  const practice = practiceFor(n), coach = coachFor(n);
  const checkIds = js.includes(`const ${stem}CheckIds${n}=`) ? literalConst(js, `${stem}CheckIds${n}`) : [];
  const sections = [];

  for (const article of articles) {
    const children = kids(article);
    const label = clean(text(children.find(c => c.attrs?.class === 'stepnum')));
    const h2 = children.find(c => c.tag === 'h2');
    const blocks = [];
    let pending = [];
    const flush = () => { if (pending.length) { const content = toContent(pending); if (content.length) blocks.push({ type: 'content', nodes: content }); pending = []; } };
    const push = block => { flush(); const last = blocks[blocks.length - 1]; if (block.type === 'fields' && last?.type === 'fields') last.ids.push(...block.ids); else blocks.push(block); };
    for (let i = 0; i < children.length; i++) {
      const c = children[i];
      if (typeof c === 'string') { pending.push(c); continue; }
      const cls = c.attrs.class || '', click = onclickOf(c);
      if (cls === 'stepnum' || c === h2) continue;
      if (cls === 'video') { push({ type: 'video', title: clean(text(c.children.find(x => x.tag === 'h3'))), note: clean(text(c.children.find(x => x.tag === 'p'))) }); continue; }
      if (c.tag === 'details' && byId([c], 'story')) {
        push(ext('story', { summary: clean(text(c.children.find(x => x.tag === 'summary'))), scenes: cfg.scenes.map(([title, visual, narration]) => ({ title, visual, narration })) }));
        continue;
      }
      if (c.tag === 'details' && byId([c], 'videoPrompt')) {
        const btns = findAll([c], b => b.tag === 'button');
        const dl = btns.find(b => /^download\(c\.prompt,/.test(onclickOf(b)));
        push(ext('videoPrompt', { summary: clean(text(c.children.find(x => x.tag === 'summary'))), prompt: cfg.prompt, filename: must(/'([^']+)'\)$/, onclickOf(dl), 'prompt file')[1],
          copyLabel: clean(text(btns.find(b => onclickOf(b) === 'copyPrompt()'))), downloadLabel: clean(text(dl)), textareaLabel: 'Gemini video prompt' }));
        continue;
      }
      if (c.tag === 'label' && byId([c], 'studied')) { push({ type: 'studied', label: clean(text(c)) }); continue; }
      if (c.tag === 'label' && byId([c], 'honest')) { push({ type: 'honest', label: clean(text(c)) }); continue; }
      if (c.tag === 'h3' && /^Practice/.test(clean(text(c))) && /^practice\(/.test(onclickOf(children.slice(i + 1).find(x => typeof x !== 'string')))) {
        const options = [];
        let j = i + 1;
        for (; j < children.length; j++) {
          const x = children[j];
          if (typeof x === 'string') continue;
          const pm = /^practice\((\d)\)$/.exec(onclickOf(x));
          if (pm) { options.push({ label: clean(text(x)), feedback: Number(pm[1]) === 1 ? practice.one : practice.other }); continue; }
          if (x.attrs.id === 'practiceFeedback') { j++; break; }
          break;
        }
        push({ type: 'practice', prompt: clean(text(c)), options, legend: 'Practice scenario' });
        i = j - 1; continue;
      }
      if (c.attrs.id === 'saveStatus') { push({ type: 'saveStatus' }); continue; }
      if (c.tag === 'form' && c.attrs.id === 'profile') {
        const ids = findAll([c], x => x.tag === 'textarea').map(x => x.attrs.id);
        for (const id of ids) if (labelFor(c, id) !== `${fieldsById.get(id).label} *`) throw new Error(`Label mismatch ${n} ${id}`);
        push({ type: 'fields', ids }); continue;
      }
      if (cls === 'field' && findAll([c], x => x.tag === 'textarea' && ['bias', 'counter', 'constraint'].includes(x.attrs.id)).length) {
        const id = findAll([c], x => x.tag === 'textarea')[0].attrs.id;
        fieldsById.set(id, { id, label: labelFor(c, id).replace(/ \*$/, ''), kind: 'textarea', required: true, maxLength: 2000 });
        push({ type: 'fields', ids: [id] }); continue;
      }
      if (cls === 'note' && calls(c, /^add\w+\d+\(\)$/).length) { push(ext('recordLog', recordLogFor(n, stem, c))); continue; }
      if (cls === 'note' && findAll([c], x => x.tag === 'select' && checkIds.includes(x.attrs.id)).length) { push(ext('checkPanel', checkPanelFor(n, stem, c))); continue; }
      if (cls === 'note' && findAll([c], x => ['calcRevenue84', 'cohortEligible85', 'cash92', 'preMoney97'].includes(x.attrs.id)).length) { push(ext('calculator', calculatorFor(n, c))); continue; }
      if (cls === 'note' && calls(c, /^prepare\w+\(/).length) { push(ext('promptWorkbench', promptFor(n, stem, c))); continue; }
      if (cls === 'note' && calls(c, /^buildCeo/).length) { push(ext('ceoWorkbench', ceoFor(n, c))); continue; }
      if (cls === 'note' && byId([c], 'graduationStatus100')) {
        const btns = findAll([c], b => b.tag === 'button');
        const ps = kids(c).filter(x => typeof x !== 'string' && x.tag === 'p');
        push(ext('graduation100', { title: clean(text(c.children.find(x => x.tag === 'h3'))), intro: ps.filter(p => !p.attrs.id && ps.indexOf(p) < ps.findIndex(q => q.attrs.id)).map(p => clean(text(p))),
          checkLabel: clean(text(btns.find(b => onclickOf(b) === 'checkGraduation100()'))), downloadLabel: clean(text(btns.find(b => onclickOf(b) === 'exportGraduation100()'))),
          after: ps.filter(p => !p.attrs.id && ps.indexOf(p) > ps.findIndex(q => q.attrs.id)).map(p => clean(text(p))) }));
        continue;
      }
      if (click === 'previewBrief()') {
        const exportBtn = children.slice(i + 1).find(x => typeof x !== 'string' && onclickOf(x) === 'exportBrief()');
        push(ext('brief', { previewLabel: clean(text(c)), downloadLabel: clean(text(exportBtn)), sections: briefSectionsFor(n) }));
        continue;
      }
      if (click === 'exportBrief()' || c.attrs.id === 'briefPreview') continue;
      if (/^coachMode\(/.test(click)) {
        const modes = [];
        let j = i;
        for (; j < children.length; j++) {
          const x = children[j];
          if (typeof x === 'string') continue;
          const cm = /^coachMode\('(\w+)'\)$/.exec(onclickOf(x));
          if (cm) { modes.push(cm[1]); continue; }
          if (x.attrs.id === 'chat') { push(ext('coach', { modes, prefix: coach.prefix, suffix: coach.suffix, initial: clean(text(x)) })); j++; }
          break;
        }
        i = j - 1; continue;
      }
      if (c.attrs.id === 'quiz') { push({ type: 'quiz' }); continue; }
      if (click === 'checkQuiz()' || c.attrs.id === 'quizFeedback' || c.attrs.id === 'completionFeedback') continue;
      if (c.attrs.id === 'checklist') { push({ type: 'checklist' }); continue; }
      if (c.attrs.id === 'complete') {
        push({ type: 'complete', label: clean(text(c)), completedNotice: `Lesson ${n} self-completed locally. This records learning, not scaling readiness or expansion approval.`, incompleteNotice: 'Complete the remaining requirements before marking learning complete.' });
        continue;
      }
      if (click === 'resetDraft()') { push({ type: 'reset', label: clean(text(c)) }); continue; }
      if (c.attrs.id === 'moduleStatus') { push(ext('moduleStatus', { module: cfg.module })); continue; }
      if (c.tag === 'button' || findAll([c], x => x.tag === 'input' || x.tag === 'select' || x.tag === 'textarea' || (x.tag === 'button' && !/openLesson/.test(onclickOf(x)))).length) throw new Error(`Lesson ${n}: unclassified interactive node ${c.tag}#${c.attrs.id || ''}.${cls} ${click}`);
      pending.push(c);
    }
    flush();
    const step = label.split('/ ')[1];
    const id = { WATCH: 'watch', LEARN: 'learn', BUILD: 'build', 'ASK AI COACH': 'coach', CHALLENGE: 'challenge', 'KNOWLEDGE CHECK': 'quiz', 'DELIVER & PROGRESS': 'deliver' }[step];
    if (!id) throw new Error(`Unknown step ${label}`);
    sections.push({ id, label, heading: h2 ? clean(text(h2)) : 'Knowledge check.', blocks });
  }

  // Coverage: the brief and record log must exist; checks from legacy functions must be represented.
  const allBlocks = sections.flatMap(s => s.blocks);
  const extIds = allBlocks.filter(b => b.type === 'extension').map(b => b.id);
  for (const need of ['story', 'videoPrompt', 'recordLog', 'brief', 'coach', 'promptWorkbench', 'moduleStatus']) if (!extIds.includes(need)) throw new Error(`Lesson ${n}: missing ${need}`);
  if (n >= 86 && !extIds.includes('checkPanel')) throw new Error(`Lesson ${n}: missing check panel`);
  if (n >= 93 && !extIds.includes('ceoWorkbench')) throw new Error(`Lesson ${n}: missing CEO workbench`);
  if ([84, 85, 92, 97].includes(n) && !extIds.includes('calculator')) throw new Error(`Lesson ${n}: missing calculator`);
  if (n === 100 && !extIds.includes('graduation100')) throw new Error('Lesson 100: missing graduation');

  const fieldOrder = [...worksheetIds, 'bias', 'counter', 'constraint'];
  const fields = fieldOrder.map(id => { const f = fieldsById.get(id); if (!f) throw new Error(`Lesson ${n}: missing field ${id}`); return f; });
  const schema = curriculum.schemas[n];
  if (JSON.stringify(fields.map(f => f.id)) !== JSON.stringify(schema.ids)) throw new Error(`Lesson ${n}: field ids differ from schema`);
  if (cfg.title !== curriculum.names[n]) throw new Error(`Lesson ${n}: title differs from curriculum`);

  const h1 = intro.children.find(x => x.tag === 'h1');
  return {
    number: n, phase: 5, module: cfg.module, title: cfg.title,
    hero: {
      eyebrow: clean(text(intro.children.find(x => x.attrs?.class === 'eyebrow'))),
      title: clean(text(h1)),
      intro: clean(text(intro.children.find(x => x.tag === 'p'))),
      meta: clean(text(intro.children.find(x => x.tag === 'small'))),
    },
    fields,
    questions: cfg.questions.map(([prompt, options, answer, explanation]) => ({ prompt, options, answer, explanation })),
    checklist: [
      { kind: 'fields', label: 'worksheet', ids: worksheetIds },
      { kind: 'fields', label: 'red-team', ids: ['bias', 'counter', 'constraint'] },
      { kind: 'quiz', label: 'correct quiz' },
      { kind: 'studied', label: 'studied' },
      { kind: 'honest', label: 'honest acknowledgement' },
    ],
    deliverable: { title: `Lesson ${n} — ${cfg.title}`, filename: cfg.filename, fieldIds: worksheetIds, footer: briefFooter },
    sections,
    nav: sections.map(s => ({ id: s.id, label: s.label.split('/ ')[1] })),
  };
}

function buildDashboard() {
  const body = parseHtml(legacyBody(5));
  const dash = byId(body, 'dashboard');
  const sidebar = findAll(body, x => x.attrs.class === 'sidebar')[0];
  const cards = findAll([dash], x => x.tag === 'article');
  const modules = cards.map(card => {
    const code = clean(text(card.children.find(x => x.attrs?.class === 'eyebrow'))).replace('MODULE ', '');
    return {
      code, title: clean(text(card.children.find(x => x.tag === 'h2'))),
      lessons: findAll([card], x => x.tag === 'button').map(b => {
        const number = Number(must(/openLesson\((\d+)\)/, onclickOf(b), 'lesson')[1]);
        const small = b.children.find(x => x.tag === 'small');
        const label = clean(b.children.filter(x => x !== small).map(text).join(''));
        const title = label.replace(/^\d+ · /, '');
        if (title !== curriculum.names[number]) throw new Error(`Dashboard title ${number}`);
        return { number, title, summary: clean(text(small)) };
      }),
    };
  });
  return {
    phase: 5, title: 'Phase 05 · Scale',
    hero: {
      eyebrow: clean(text(dash.children.find(x => x.attrs?.class === 'eyebrow'))),
      title: clean(text(dash.children.find(x => x.tag === 'h1'))),
      intro: clean(text(dash.children.find(x => x.tag === 'p'))),
    },
    modules,
    sections: [{ heading: clean(text(sidebar.children.find(x => x.tag === 'h2'))), nodes: toContent(sidebar.children.filter(x => typeof x !== 'string' && x.tag === 'p' && !x.attrs.id)) }],
  };
}

const outLessons = new URL('src/data/lessons/phase-5/', root);
mkdirSync(outLessons, { recursive: true });
for (const n of LESSONS) {
  const lesson = buildLesson(n);
  writeFileSync(new URL(`lesson-${String(n).padStart(2, '0')}.json`, outLessons), JSON.stringify(lesson, null, 1) + '\n');
}
mkdirSync(new URL('src/data/dashboards/', root), { recursive: true });
writeFileSync(new URL('src/data/dashboards/phase-5.json', root), JSON.stringify(buildDashboard(), null, 1) + '\n');
console.log(`Phase 5: wrote ${LESSONS.length} lessons and the dashboard.`);
