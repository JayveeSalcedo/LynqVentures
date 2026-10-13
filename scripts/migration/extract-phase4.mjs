// Deterministic extractor for Phase 04 (Launch, Lessons 61–80 + dashboard).
// Reads legacy/lessons/phase-4.html (configs/templates JSON + tool functions) and writes typed JSON:
//   src/data/lessons/phase-4/lesson-61.json … lesson-80.json, src/data/dashboards/phase-4.json
// Run: node scripts/migration/extract-phase4.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { legacyScript, legacyBody, jsonConst, literalConst, parseHtml, findAll, byId, textOf, toContent } from './legacy.mjs';

const root = new URL('../../', import.meta.url);
const js = legacyScript(4);
const configs = jsonConst(js, 'configs');
const templates = jsonConst(js, 'templates');
const S = String.raw`'((?:\\.|[^'\\])*)'`; // single-quoted JS string literal (content captured)

/** Decode the content of a single-quoted JS string literal. */
export function jsString(body) {
  return body.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (m, e) => {
    if (e[0] === 'u') return String.fromCodePoint(parseInt(e.replace(/[u{}]/g, ''), 16));
    if (e[0] === 'x') return String.fromCharCode(parseInt(e.slice(1), 16));
    return { n: '\n', t: '\t', r: '\r' }[e] ?? e;
  });
}

/** Source of `function name(...){...}` (brace-matched, string-aware). */
export function fnSource(name) {
  const start = js.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing function ${name}`);
  let depth = 0, quoted = null, escaped = false;
  for (let i = js.indexOf('{', start); i < js.length; i++) {
    const c = js[i];
    if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quoted) quoted = null; continue; }
    if (c === "'" || c === '"' || c === '`') quoted = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return js.slice(start, i + 1);
  }
  throw new Error(`Unterminated ${name}`);
}

const must = (re, text, what) => { const m = re.exec(text); if (!m) throw new Error(`Could not extract ${what}`); return m; };
const rx = (source, flags = "") => new RegExp(source.replace(/§/g, S), flags);

/** Split a top-level `+` concatenation of literals and row references into card parts. */
function concatParts(expr) {
  const tokens = []; let depth = 0, quoted = false, escaped = false, cur = '';
  for (const c of expr) {
    if (quoted) { cur += c; if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === "'") quoted = false; continue; }
    if (c === "'") quoted = true;
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === '+' && depth === 0) { tokens.push(cur); cur = ''; continue; }
    cur += c;
  }
  tokens.push(cur);
  const parts = [];
  for (const t of tokens) {
    let m;
    if ((m = rx('^§$').exec(t))) parts.push({ text: jsString(m[1]) });
    else if ((m = /^row\.(\w+)$/.exec(t))) parts.push({ key: m[1] });
    else if ((m = rx(String.raw`^\(row\.(\w+)\?§:''\)$`).exec(t))) parts.push({ flag: m[1], text: jsString(m[2]) });
    else if ((m = /^JSON\.stringify\(row\.(\w+)\)$/.exec(t))) parts.push({ json: m[1] });
    else throw new Error(`Unknown card token ${t}`);
  }
  return parts.reduce((out, p) => { const last = out[out.length - 1]; if (last && 'text' in p && !('flag' in p) && 'text' in last && !('flag' in last)) last.text += p.text; else out.push(p); return out; }, []);
}

const el = n => typeof n !== 'string';
const kids = node => node.children.filter(el);
const cls = (node, c) => (node.attrs.class || '').split(/\s+/).includes(c);
const text = node => (typeof node === 'string' ? node : node.tag === 'br' ? ' ' : node.children.map(text).join('')).replace(/\s+/g, ' ');
const clean = s => s.replace(/\s+/g, ' ').trim();
const onclick = node => node.attrs?.onclick || '';
const stripStar = s => s.replace(/\s*\*$/, '');

// ---------- per-lesson script facts ----------
function practiceFeedback(n) {
  const body = fnSource('practice');
  const m = rx(String.raw`if\(current===${n}\)\{\$\('practiceFeedback'\)\.textContent=i===1\?§:§;return\}`).exec(body)
    ?? (n === 61 ? must(rx(String.raw`\$\('practiceFeedback'\)\.textContent=i===1\?§:§\}$`), body, 'practice default') : null);
  if (!m) throw new Error(`practice ${n}`);
  return [jsString(m[2]), jsString(m[1])]; // index 0, index 1
}

function coachReply(n, mode) {
  const body = fnSource('coachMode');
  let m = rx(String.raw`if\(current===${n}\)\{let guidance=\{([^}]*)\};\$\('chat'\)\.textContent='Simulated '\+mode\+' guidance: '\+guidance\[mode\]\+§;return\}`).exec(body);
  if (m) {
    const guidance = Object.fromEntries([...m[1].matchAll(rx(String.raw`(\w+):§`, "g"))].map(x => [x[1], jsString(x[2])]));
    if (!(mode in guidance)) throw new Error(`coach ${n} ${mode}`);
    return `Simulated ${mode} guidance: ${guidance[mode]}${jsString(m[2])}`;
  }
  m = rx(String.raw`if\(current===${n}\)\{\$\('chat'\)\.textContent='Simulated '\+mode\+' guidance: ((?:\\.|[^'\\])*)';return\}`).exec(body)
    ?? (n === 61 ? must(rx(String.raw`\$\('chat'\)\.textContent='Simulated '\+mode\+' guidance: ((?:\\.|[^'\\])*)'\}$`), body, 'coach default') : null);
  if (!m) throw new Error(`coach ${n}`);
  return `Simulated ${mode} guidance: ${jsString(m[1])}`;
}

function briefFacts(n) {
  const body = fnSource('brief');
  const header = jsString(must(/'\\n\\n(Planning draft[^']*)\\n\\n'/, body, 'brief header')[1]);
  const footer = jsString(must(/'\\n\\n(No commercial approval[^']*)'\}$/, body, 'brief footer')[1]);
  const headingExpr = must(/'\\n\\n## '\+\((.*?)\)\+'\\n'\+JSON\.stringify\(/, body, 'brief heading')[1];
  const headings = Object.fromEntries([...headingExpr.matchAll(rx(String.raw`current===(\d+)\?§`, "g"))].map(x => [x[1], jsString(x[2])]));
  headings[61] = jsString(must(rx(String.raw`:§$`), headingExpr, 'default heading')[1]);
  const rowsExpr = must(/JSON\.stringify\((current===80\?state\.gateRows.*?),null,2\)/, body, 'brief rows')[1];
  const keys = Object.fromEntries([...rowsExpr.matchAll(/current===(\d+)\?state\.(\w+)/g)].map(x => [x[1], x[2]]));
  keys[61] = must(/:state\.(\w+)$/, rowsExpr, 'default rows')[1];
  const extras = Object.fromEntries([...body.matchAll(/current===(\d+)\?'\\n\\n([^']*):\\n'\+JSON\.stringify\(state\.(\w+),null,2\)/g)].map(x => [x[1], { label: jsString(x[2]), key: x[3] }]));
  return { header, heading: headings[n], key: keys[n], ...(extras[n] ? { extra: extras[n] } : {}), footer };
}

function exportPayload(src) {
  const m = must(/download\(JSON\.stringify\(\{(.*)\},null,2\),'([^']+)'\)/, src, 'export payload');
  const entries = [...m[1].matchAll(rx(String.raw`(\w+):(?:(\d+)|§|state\.fields|state\.(\w+)|(\w+)\(\))`, "g"))].map(x =>
    x[2] !== undefined ? { name: x[1], kind: 'const', value: Number(x[2]) }
      : x[3] !== undefined ? { name: x[1], kind: 'const', value: jsString(x[3]) }
        : x[4] !== undefined ? { name: x[1], kind: 'state', key: x[4] }
          : x[5] !== undefined ? { name: x[1], kind: 'summary' }
            : { name: x[1], kind: 'fields' });
  return { entries, filename: m[2] };
}

// ---------- tools ----------
function toolInputs(note) {
  const labels = {}, inputs = [];
  for (const node of findAll(note.children, () => true)) {
    if (node.tag === 'label' && node.attrs.for) labels[node.attrs.for] = clean(text(node));
    if (node.tag === 'label' && cls(node, 'check')) { const box = findAll(node.children, x => x.tag === 'input')[0]; labels[box.attrs.id] = clean(text(node)); }
  }
  for (const node of findAll(note.children, x => ['input', 'textarea', 'select'].includes(x.tag) && x.attrs.id && x.attrs.readonly === undefined)) {
    const input = { domId: node.attrs.id, label: labels[node.attrs.id] };
    if (!input.label) throw new Error(`No label for ${node.attrs.id}`);
    if (node.tag === 'select') Object.assign(input, { kind: 'select', options: kids(node).filter(o => o.tag === 'option').map(o => clean(text(o))) });
    else if (node.attrs.type === 'checkbox') input.kind = 'checkbox';
    else Object.assign(input, { kind: node.tag === 'textarea' ? 'textarea' : 'input' });
    if (node.attrs.maxlength) input.maxLength = Number(node.attrs.maxlength);
    for (const a of ['type', 'min', 'step', 'max']) if (node.attrs[a] && node.attrs.type !== 'checkbox') input[a] = node.attrs[a];
    inputs.push(input);
  }
  return inputs;
}

/** Note content before the first label/input (excluding the h3 title), and plain paragraphs after the controls. */
function noteText(note) {
  const children = kids(note);
  const first = children.findIndex(x => x.tag === 'label' || x.tag === 'button');
  const intro = toContent(children.slice(0, first).filter(x => x.tag !== 'h3'));
  const lastControl = children.map((x, i) => (['button', 'label', 'input', 'textarea', 'select'].includes(x.tag) || x.attrs.id) ? i : -1).reduce((a, b) => Math.max(a, b), -1);
  const notes = toContent(children.slice(lastControl + 1));
  return { title: clean(text(children.find(x => x.tag === 'h3'))), intro, notes };
}

function rowTool(n, note) {
  const button = name => findAll(note.children, x => x.tag === 'button' && new RegExp(`^${name}`).test(onclick(x)))[0];
  const addButton = findAll(note.children, x => x.tag === 'button' && /^add\w+\(\)/.test(onclick(x)))[0];
  const addName = /^(\w+)\(\)/.exec(onclick(addButton))[1];
  const exportButton = findAll(note.children, x => x.tag === 'button' && /^export\w+\(\)/.test(onclick(x)))[0];
  const add = fnSource(addName);
  const map = must(/let map=\{([^}]*)\},row=\{(.*?)\};for/, add, `${addName} map`);
  const keys = [...map[1].matchAll(/(\w+):'(\w+)'/g)].map(x => ({ key: x[1], input: x[2] }));
  const prefix = map[2].split(/,(?=\w+:)/).map(entry => {
    let m;
    if ((m = /^(\w+):\$\('(\w+)'\)\.(?:value|checked)$/.exec(entry))) return { key: m[1], input: m[2] };
    if ((m = rx(String.raw`^(\w+):§$`).exec(entry))) return { key: m[1], value: jsString(m[2]) };
    if ((m = /^(\w+):\[\]$/.exec(entry))) return { key: m[1], value: [] };
    throw new Error(`Unknown row prefix ${entry}`);
  });
  const stateKey = must(/state\.(\w+)\.push\(row\)/, add, 'state key')[1];
  const statusId = must(/if\(!row\[k\]\)\{\$\('(\w+)'\)/, add, 'status id')[1];
  const messages = {
    missing: jsString(must(rx(String.raw`if\(!row\[k\]\)\{\$\('\w+'\)\.textContent=§;return\}`), add, 'missing')[1]),
    duplicate: jsString(must(rx(String.raw`row\.id\.toLowerCase\(\)\)\)\{\$\('\w+'\)\.textContent=§`), add, 'duplicate')[1]),
    limit: jsString(must(rx(String.raw`\.length>=\d+\)\{\$\('\w+'\)\.textContent=§`), add, 'limit')[1]),
    added: jsString([...add.matchAll(rx(String.raw`\$\('${statusId}'\)\.textContent=§`, 'g'))].pop()[1]),
  };
  const limit = Number(must(/\.length>=(\d+)\)/, add, 'limit n')[1]);
  const renderName = must(/save\(\);(render\w+)\(\)/, add, 'render')[1];
  const render = fnSource(renderName);
  const card = concatParts(must(/card\.textContent=(.*?);let /, render, 'card')[1]);
  let removeLabel, removeBy;
  let m = rx(String.raw`b\.textContent=§\+\(i\+1\)`).exec(render);
  if (m) { removeLabel = jsString(m[1]); removeBy = 'index'; } else { removeLabel = jsString(must(rx(String.raw`remove\.textContent=§\+row\.id`), render, 'remove')[1]); removeBy = 'id'; }
  const countsMatch = rx(String.raw`\$\('\w+'\)\.textContent=§\+(\w+)\.map\((\w+)=>\3\+' '\+state\.\w+\.filter\(r=>r\.(\w+)===\3\)\.length\)\.join\(' · '\)(?:\+§)?;`).exec(render);
  const counts = countsMatch ? { prefix: jsString(countsMatch[1]), key: countsMatch[4], options: literalConst(js, countsMatch[2]), suffix: countsMatch[5] ? jsString(countsMatch[5]) : '' } : undefined;
  const exportName = /^(\w+)\(\)/.exec(onclick(exportButton))[1];
  const payload = exportPayload(fnSource(exportName));
  let summary;
  const summarizeButton = button('summarize');
  if (summarizeButton) {
    const sumName = must(/(\w+Summary\d+)\(\)/, fnSource(/^(\w+)\(\)/.exec(onclick(summarizeButton))[1]), 'summary fn')[1];
    const sum = fnSource(sumName);
    const areasName = must(/=(\w+)\.filter\(\w+=>!rows\.some/, sum, 'areas')[1];
    summary = {
      areaKey: must(/rows\.some\(r=>r\.(\w+)===\w+\)/, sum, 'area key')[1],
      areas: literalConst(js, areasName),
      passed: jsString(must(rx(String.raw`r\.status!==§`), sum, 'passed')[1]),
      hold: jsString(must(rx(String.raw`critical\.length\?§:§`), sum, 'hold')[1]),
      ok: jsString(must(rx(String.raw`critical\.length\?§:§`), sum, 'ok')[2]),
      limits: jsString(must(rx(String.raw`limits:§`), sum, 'limits')[1]),
      label: clean(text(summarizeButton)),
      changed: jsString(must(/textContent='(Register changed[^']*)'/, render, 'changed')[1]),
    };
  }
  return {
    lesson: n, stateKey, ...noteText(note), inputs: toolInputs(note), prefix, keys, limit, messages,
    addLabel: clean(text(addButton)), card, removeLabel, removeBy, ...(counts ? { counts } : {}), ...(summary ? { summary } : {}),
    exportLabel: clean(text(exportButton)), exportFilename: payload.filename, exportPayload: payload.entries,
  };
}

function calcTool(n, note, stateKey) {
  const button = findAll(note.children, x => x.tag === 'button')[0];
  const result = findAll(note.children, x => x.tag === 'p' && x.attrs.id)[0];
  const bindName = { calc66: 'bindCalc66', rate73: 'bindRate73', review76: 'bindReview76' }[stateKey];
  const changed = jsString(must(rx(String.raw`textContent=§\}\}\)\}$`), fnSource(bindName), 'calc changed')[1]);
  const inputs = toolInputs(note).map(({ kind, ...rest }) => ({ ...rest, type: rest.type === 'number' ? 'number' : 'text' }));
  return { lesson: n, stateKey, ...noteText(note), inputs, buttonLabel: clean(text(button)), initial: clean(text(result)), changed };
}

function promptTool(note) {
  const buttons = findAll(note.children, x => x.tag === 'button' && /^prepare\w+\('\w+'\)/.test(onclick(x)));
  const prepareName = /^(\w+)\(/.exec(onclick(buttons[0]))[1];
  const exportButton = findAll(note.children, x => x.tag === 'button' && /^export\w+\(\)/.test(onclick(x)))[0];
  const exportSrc = fnSource(/^(\w+)\(\)/.exec(onclick(exportButton))[1]);
  const prepare = fnSource(prepareName);
  const tasks = Object.fromEntries([...must(/let tasks=\{(.*?)\};/, prepare, 'tasks')[1].matchAll(rx(String.raw`(\w+):§`, "g"))].map(x => [x[1], jsString(x[2])]));
  const children = kids(note);
  return {
    title: clean(text(children.find(x => x.tag === 'h3'))),
    intro: toContent(children.filter(x => x.tag === 'p')),
    roles: buttons.map(b => ({ role: /\('(\w+)'\)/.exec(onclick(b))[1], label: clean(text(b)) })),
    tasks,
    suffix: jsString(must(rx(String.raw`\+tasks\[role\]\+§\+brief\(\)`), prepare, 'prompt suffix')[1]),
    ariaLabel: findAll(note.children, x => x.tag === 'textarea')[0].attrs['aria-label'],
    downloadLabel: clean(text(exportButton)),
    filename: must(/download\(\$\('\w+'\)\.value,'([^']+)'\)/, exportSrc, 'prompt filename')[1],
    emptyMessage: jsString(must(rx(String.raw`\.value=§;return`), exportSrc, 'empty prompt')[1]),
  };
}

// ---------- lessons ----------
const render = fnSource('render'), complete = fnSource('completeLesson');
const checklistLabels = must(/' \/ 5 requirements: ([^']*)\.'/, render, 'checklist')[1].split(', ');
const moduleStatusSuffix = jsString(must(rx(String.raw`' / 5\. ((?:\\.|[^'\\])*)'`), render, 'module status')[1]);
const completedSuffix = jsString(must(rx(String.raw`'Lesson '\+current\+§`), complete, 'completed')[1]);
const incompleteNotice = jsString(must(rx(String.raw`textContent=§;render\(\);return`), complete, 'incomplete')[1]);
const sectionIds = ['watch', 'learn', 'build', 'coach', 'challenge', 'quiz', 'deliver'];

function lesson(n) {
  const config = configs[n];
  const nodes = parseHtml(templates[n]).filter(el);
  const intro = nodes.find(x => cls(x, 'lessonintro'));
  const introKids = kids(intro);
  const hero = {
    eyebrow: clean(text(introKids.find(x => cls(x, 'eyebrow')))),
    title: clean(text(introKids.find(x => x.tag === 'h1'))),
    intro: clean(text(introKids.find(x => x.tag === 'p'))),
    meta: clean(text(introKids.find(x => x.tag === 'small'))),
  };
  const worksheetIds = config.fields.map(f => f[0]);
  const fields = config.fields.map(([id, label]) => {
    const node = findAll(nodes, x => x.tag === 'label' && x.attrs.for === id)[0];
    if (clean(text(node)) !== `${label} *`) throw new Error(`Lesson ${n}: label mismatch for ${id}`);
    const maxLength = Number(findAll(nodes, x => x.attrs.id === id)[0].attrs.maxlength);
    return { id, label, kind: 'textarea', required: true, maxLength };
  });
  const scenes = config.scenes.map(([title, visual, narration]) => ({ title, visual, narration }));
  const brief = briefFacts(n);
  const sections = [];
  const nav = [];
  nodes.filter(x => x.tag === 'article').forEach((article, index) => {
    const children = kids(article);
    const label = clean(text(children.find(x => cls(x, 'stepnum'))));
    const h2 = children.find(x => x.tag === 'h2');
    const blocks = [];
    let buffer = [];
    const flush = () => { if (buffer.length) { const c = toContent(buffer); if (c.length) blocks.push({ type: 'content', nodes: c }); buffer = []; } };
    const push = block => { flush(); blocks.push(block); };
    const modes = [];
    let briefLabels = {};
    const walk = list => {
      for (let i = 0; i < list.length; i++) {
        const node = list[i];
        if (cls(node, 'stepnum') || node === h2) continue;
        const ids = findAll([node], x => !!x.attrs.id).map(x => x.attrs.id);
        const click = onclick(node);
        if (cls(node, 'video')) push({ type: 'video', title: clean(text(kids(node).find(x => x.tag === 'h3'))), subtitle: clean(text(kids(node).find(x => x.tag === 'p'))) });
        else if (node.tag === 'details' && ids.includes('story')) {
          const summary = clean(text(kids(node).find(x => x.tag === 'summary')));
          push({ type: 'storyboard', scenes, summary }); push({ type: 'transcript', scenes });
        } else if (node.tag === 'details' && ids.includes('videoPrompt')) {
          const dl = findAll([node], x => /download\(c\.prompt,'/.test(onclick(x)))[0];
          push({ type: 'videoPrompt', prompt: config.prompt, filename: /'([^']+)'\)/.exec(onclick(dl))[1], summary: clean(text(kids(node).find(x => x.tag === 'summary'))) });
        } else if (node.tag === 'label' && ids.includes('studied')) push({ type: 'studied', label: clean(text(node)) });
        else if (node.tag === 'label' && ids.includes('honest')) push({ type: 'honest', label: clean(text(node)) });
        else if (node.tag === 'h3' && /^practice\(/.test(onclick(list[i + 1] || { attrs: {} }))) {
          const options = [];
          let j = i + 1;
          while (list[j] && /^practice\((\d)\)/.test(onclick(list[j]))) { options.push({ index: Number(/\((\d)\)/.exec(onclick(list[j]))[1]), label: clean(text(list[j])) }); j++; }
          const feedback = practiceFeedback(n);
          push({ type: 'practice', prompt: clean(text(node)), options: options.map(o => ({ label: o.label, feedback: feedback[o.index] })) });
          i = j - 1;
        } else if (node.attrs.id === 'practiceFeedback' || node.attrs.id === 'briefPreview' || node.attrs.id === 'quizFeedback' || node.attrs.id === 'completionFeedback' || /^checkQuiz/.test(click)) continue;
        else if (node.attrs.id === 'saveStatus') push({ type: 'saveStatus' });
        else if (node.tag === 'form' && node.attrs.id === 'profile') push({ type: 'fields', ids: findAll(node.children, x => x.tag === 'textarea').map(x => x.attrs.id) });
        else if (node.tag === 'div' && cls(node, 'field')) {
          const id = findAll(node.children, x => x.tag === 'textarea')[0].attrs.id;
          const last = blocks[blocks.length - 1];
          const label = stripStar(clean(text(findAll(node.children, x => x.tag === 'label')[0])));
          if (!fields.some(f => f.id === id)) fields.push({ id, label, kind: 'textarea', required: true, maxLength: Number(findAll(node.children, x => x.tag === 'textarea')[0].attrs.maxlength) });
          if (last?.type === 'fields' && !buffer.length) last.ids.push(id); else push({ type: 'fields', ids: [id] });
        } else if (cls(node, 'note') && findAll([node], x => /^prepare\w+\('/.test(onclick(x))).length) push({ type: 'extension', id: 'agentPrompt', props: promptTool(node) });
        else if (cls(node, 'note') && findAll([node], x => /^calculate66\(/.test(onclick(x))).length) push({ type: 'extension', id: 'calc66', props: calcTool(n, node, 'calc66') });
        else if (cls(node, 'note') && findAll([node], x => /^calculateRate73\(/.test(onclick(x))).length) push({ type: 'extension', id: 'rate73', props: calcTool(n, node, 'rate73') });
        else if (cls(node, 'note') && findAll([node], x => /^calculateReview76\(/.test(onclick(x))).length) push({ type: 'extension', id: 'review76', props: calcTool(n, node, 'review76') });
        else if (cls(node, 'note') && findAll([node], x => /^addDeal67\(/.test(onclick(x))).length) push({ type: 'extension', id: 'pipeline67', props: rowTool(n, node) });
        else if (cls(node, 'note') && findAll([node], x => /^add\w+\(\)/.test(onclick(x))).length) push({ type: 'extension', id: 'rowLog', props: rowTool(n, node) });
        else if (/^previewBrief/.test(click)) briefLabels.preview = clean(text(node));
        else if (/^exportBrief/.test(click)) { briefLabels.download = clean(text(node)); push({ type: 'extension', id: 'brief', props: { previewLabel: briefLabels.preview, downloadLabel: briefLabels.download, ...brief } }); }
        else if (/^resetDraft/.test(click)) push({ type: 'reset', label: clean(text(node)) });
        else if (/^coachMode\('/.test(click)) { const mode = /\('(\w+)'\)/.exec(click)[1]; modes.push({ id: mode, label: clean(text(node)), response: coachReply(n, mode) }); }
        else if (cls(node, 'actions') && findAll([node], x => /^coachMode/.test(onclick(x))).length) walk(kids(node));
        else if (node.attrs.id === 'chat') push({ type: 'coach', intro: clean(text(node)), modes: modes.splice(0) });
        else if (node.attrs.id === 'quiz') push({ type: 'quiz' });
        else if (node.attrs.id === 'checklist') push({ type: 'checklist' });
        else if (node.attrs.id === 'complete') push({ type: 'complete', label: clean(text(node)), completedNotice: `Lesson ${n}${completedSuffix}`, incompleteNotice });
        else if (node.attrs.id === 'moduleStatus') push({ type: 'extension', id: 'moduleStatus', props: { module: config.module, suffix: moduleStatusSuffix } });
        else if (ids.some(id => !['story'].includes(id)) && node.tag !== 'p' && node.tag !== 'div') throw new Error(`Lesson ${n}: unhandled element ${node.tag}#${ids.join(',')}`);
        else buffer.push(node);
      }
    };
    walk(article.children.filter(el));
    flush();
    if (briefLabels.preview && !blocks.some(b => b.id === 'brief')) throw new Error(`Lesson ${n}: brief not placed`);
    if (n === 80 && index === 6) blocks.push({ type: 'next' });
    const id = sectionIds[index];
    sections.push({ id, label, heading: h2 ? clean(text(h2)) : 'Knowledge check', blocks });
    nav.push({ id, label: clean(label.replace(/^\d+\s*\/\s*/, '')) });
  });
  // Every legacy element id that carries curriculum must have been placed.
  const unplaced = findAll(nodes, x => x.attrs.id && x.tag === 'textarea' && !fields.some(f => f.id === x.attrs.id) && !/\d\d$/.test(x.attrs.id) && !['videoPrompt'].includes(x.attrs.id));
  if (unplaced.length) throw new Error(`Lesson ${n}: unplaced ${unplaced.map(x => x.attrs.id)}`);
  return {
    number: n, phase: 4, module: config.module, title: config.title, hero, fields,
    questions: config.questions.map(([prompt, options, answer, explanation]) => ({ prompt, options, answer, explanation })),
    checklist: [
      { kind: 'fields', label: checklistLabels[0], ids: worksheetIds },
      { kind: 'fields', label: checklistLabels[1], ids: ['bias', 'counter', 'constraint'] },
      { kind: 'quiz', label: checklistLabels[2] },
      { kind: 'studied', label: checklistLabels[3] },
      { kind: 'honest', label: checklistLabels[4] },
    ],
    deliverable: { title: `Lesson ${n} — ${config.title}`, filename: config.filename, headerLines: [brief.header], fieldIds: [...worksheetIds, 'bias', 'counter', 'constraint'], footer: brief.footer },
    sections, nav,
  };
}

// ---------- dashboard ----------
function dashboard() {
  const body = parseHtml(legacyBody(4));
  const dash = byId(body, 'dashboard');
  const intro = kids(dash).find(x => cls(x, 'lessonintro'));
  const ps = kids(intro).filter(x => x.tag === 'p');
  const modules = kids(dash).filter(x => x.tag === 'article').map(card => {
    const c = kids(card);
    return {
      code: clean(text(c.find(x => cls(x, 'eyebrow')))).replace(/^MODULE\s+/, ''),
      title: clean(text(c.find(x => x.tag === 'h2'))),
      lessons: c.filter(x => x.tag === 'button').map(b => {
        const number = Number(/openLesson\((\d+)\)/.exec(onclick(b))[1]);
        const small = kids(b).find(x => x.tag === 'small');
        const title = clean(b.children.filter(x => x !== small).map(text).join('')).replace(/^\d+\s*·\s*/, '');
        return { number, title, summary: clean(text(small)) };
      }),
    };
  });
  return {
    phase: 4, title: 'Launch',
    hero: { eyebrow: clean(text(kids(intro).find(x => cls(x, 'eyebrow')))), title: clean(text(kids(intro).find(x => x.tag === 'h1'))), intro: clean(text(ps[0])) },
    modules,
    sections: [{ heading: 'Launch lessons', nodes: toContent(ps.slice(1)) }],
  };
}

const out = new URL('src/data/lessons/phase-4/', root);
mkdirSync(out, { recursive: true });
mkdirSync(new URL('src/data/dashboards/', root), { recursive: true });
for (const n of Object.keys(configs).map(Number)) writeFileSync(new URL(`lesson-${n}.json`, out), JSON.stringify(lesson(n), null, 1) + '\n');
writeFileSync(new URL('src/data/dashboards/phase-4.json', root), JSON.stringify(dashboard(), null, 1) + '\n');
console.log(`Phase 4: wrote ${Object.keys(configs).length} lessons and the dashboard.`);
