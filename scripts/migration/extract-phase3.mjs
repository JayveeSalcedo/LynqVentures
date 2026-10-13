// Phase 03 · Build — deterministic extractor.
// Reads legacy/lessons/phase-3.html (configs, templates, legacy tool functions and dashboard body)
// and writes typed lesson/dashboard JSON for the native React lesson system. Re-runnable:
//   node scripts/migration/extract-phase3.mjs
// Nothing from the legacy document is executed; JSON literals are parsed, and logic-embedded
// strings (coach replies, practice feedback, prompt templates) are read with fixed patterns.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { legacyScript, legacyBody, jsonConst, parseHtml, findAll, textOf, toContent, correctStale, assertCorrectionsUsed } from './legacy.mjs';
import { STALE as STALE_TABLE } from './stale-corrections.mjs';

const root = new URL('../../', import.meta.url);
const js = legacyScript(3);
const configs = jsonConst(js, 'configs');
const templates = jsonConst(js, 'templates');
const curriculum = JSON.parse(readFileSync(new URL('src/data/curriculum.json', root), 'utf8'));
const LESSONS = Array.from({ length: 20 }, (_, i) => 41 + i);
const REFLECTION = ['bias', 'counter', 'constraint'];

// ---------- legacy-string helpers ----------
const STR = "'((?:\\\\.|[^'\\\\])*)'";
/** Unescape a single-quoted JS string body. */
export function jsString(body) {
  return body.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (m, e) => {
    if (e[0] === 'u' && e.length === 5) return String.fromCharCode(parseInt(e.slice(1), 16));
    if (e[0] === 'x' && e.length === 3) return String.fromCharCode(parseInt(e.slice(1), 16));
    return { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' }[e] ?? e;
  });
}
const must = (value, what) => { if (value === undefined || value === null) throw new Error(`Extractor could not find ${what}`); return value; };
const fnSource = name => {
  const start = js.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing legacy function ${name}`);
  const next = js.indexOf('function ', start + 9);
  return js.slice(start, next < 0 ? undefined : next);
};
const clean = s => s.replace(/\s+/g, ' ').trim();
const text = node => clean(textOf(node));
const elements = node => node.children.filter(c => typeof c !== 'string');
const hasInteractive = node => findAll([node], x => ['button', 'input', 'select', 'textarea', 'iframe', 'pre'].includes(x.tag) || (x.attrs.id && x !== node)).length > 0;

// ---------- coach / practice replies (verbatim from practice(), coachMode(), coach()) ----------
const practiceSrc = fnSource('practice');
const practiceFor = n => {
  const m = new RegExp(`if\\(current===${n}\\)\\{\\$\\('practiceFeedback'\\)\\.textContent=i===1\\?${STR}:${STR};return\\}`).exec(practiceSrc)
    ?? new RegExp(`\\}\\$\\('practiceFeedback'\\)\\.textContent=i===1\\?${STR}:${STR}\\}`).exec(practiceSrc);
  return { 1: jsString(must(m, `practice ${n}`)[1]), 0: jsString(m[2]) };
};
const coachSrc = fnSource('coachMode');
const coachFor = (n, mode) => {
  const m = new RegExp(`if\\(current===${n}\\)\\{\\$\\('chat'\\)\\.textContent='Simulated '\\+mode\\+${STR};return\\}`).exec(coachSrc);
  if (m) return `Simulated ${mode}${jsString(m[1])}`;
  const d = must(new RegExp(`\\$\\('chat'\\)\\.textContent='Simulated '\\+mode\\+${STR}\\+\\(mode==='teach'\\?${STR}:mode==='guide'\\?${STR}:${STR}\\)\\+${STR}\\}`).exec(coachSrc), 'default coach');
  const body = mode === 'teach' ? d[2] : mode === 'guide' ? d[3] : d[4];
  return `Simulated ${mode}${jsString(d[1])}${jsString(body)}${jsString(d[5])}`;
};
const review = must(new RegExp(`function coach\\(\\)\\{\\$\\('chat'\\)\\.textContent=${STR}\\+ids\\.filter\\(.*?\\)\\.length\\+${STR}\\}`).exec(js), 'coach()');
const reviewResponse = `${jsString(review[1])}{missing}${jsString(review[2])}`;

// ---------- completion / module status text ----------
const completeSrc = fnSource('complete');
const incompleteNotice = jsString(must(new RegExp(`textContent=${STR};return`).exec(completeSrc), 'complete notice')[1]);
const completedTail = jsString(must(new RegExp(`'Lesson '\\+current\\+${STR}`).exec(completeSrc), 'completed notice')[1]);
const moduleTail = jsString(must(new RegExp(`'Module '\\+c\\.module\\+': '\\+\\([^)]*\\)\\+${STR}`).exec(js), 'module status')[1]);

// ---------- prompt workbenches ----------
function promptSpec(prepareFn, exportFn) {
  const src = fnSource(prepareFn);
  const tasksLiteral = must(/let tasks=\{(.*?)\};/.exec(src), `${prepareFn} tasks`)[1];
  const roles = Object.fromEntries([...tasksLiteral.matchAll(new RegExp(`(\\w+):${STR}`, 'g'))].map(m => [m[1], jsString(m[2])]));
  const body = must(new RegExp(`\\.value='ROLE: '\\+role\\+${STR}\\+tasks\\[role\\]\\+${STR}\\+brief\\(\\)`).exec(src), `${prepareFn} template`);
  const suffix = new RegExp(`brief\\(\\)\\+${STR}\\+JSON\\.stringify\\(cashModel56\\(\\),null,2\\)`).exec(src);
  const exp = must(new RegExp(`\\{\\$\\('\\w+'\\)\\.value=${STR};return\\}download\\(\\$\\('\\w+'\\)\\.value,'([^']+)'\\)`).exec(fnSource(exportFn)), `${exportFn} export`);
  return { roles, taskPrefix: jsString(body[1]), middle: jsString(body[2]), ...(suffix ? { cashSuffix: jsString(suffix[1]) } : {}), empty: jsString(exp[1]), filename: exp[2] };
}

// ---------- tool notes → typed items ----------
/** Controller name for a tool note, derived from the legacy functions its buttons call. */
const toolByFn = {
  showPrototype45: 'prototype45', simulateApi45: 'api45', addObservation46: 'register', addRequirement47: 'register', addIntegration48: 'register',
  loadContractSample48: 'contract48', addControl49: 'register', checkPermission49: 'permission49', addCheck50: 'register', explainReleaseGate50: 'gate50',
  checkBrand51: 'brand51', addStep52: 'register', runOnboard52: 'onboard52', addDecision53: 'register', calculateShares53: 'shares53',
  addAsset54: 'register', triageIP54: 'triage54', addTask55: 'register', explainTeam55: 'team55', runCash56: 'cash56', addEvent57: 'register',
  loadSample57: 'sample57', addBeta58: 'register', explainBeta58: 'beta58', addFix59: 'register', explainFix59: 'fix59', addReady60: 'register',
};
function toolItems(note) {
  const labels = new Map(findAll([note], x => x.tag === 'label' && x.attrs.for).map(l => [l.attrs.for, text(l)]));
  const items = [];
  const walk = nodes => {
    for (const node of nodes) {
      if (typeof node === 'string') { if (node.trim()) items.push({ kind: 'content', nodes: [clean(node)] }); continue; }
      const { tag, attrs } = node;
      if (tag === 'label' && attrs.for) continue;
      if (tag === 'label' && attrs.class === 'check') {
        const input = findAll([node], x => x.tag === 'input')[0];
        items.push({ kind: 'control', id: input.attrs.id, label: text(node), control: 'checkbox' });
      } else if ((tag === 'input' || tag === 'select' || tag === 'textarea') && attrs.readonly === undefined) {
        const item = { kind: 'control', id: attrs.id, label: must(labels.get(attrs.id), `label for ${attrs.id}`), control: tag === 'input' ? 'input' : tag };
        if (tag === 'select') item.options = findAll([node], o => o.tag === 'option').map(o => ({ value: o.attrs.value ?? text(o), label: text(o) }));
        if (attrs.type) item.inputType = attrs.type;
        for (const k of ['min', 'max', 'step', 'value', 'placeholder']) if (attrs[k] !== undefined) item[k] = attrs[k];
        if (attrs.maxlength) item.maxLength = Number(attrs.maxlength);
        items.push(item);
      } else if (tag === 'button') {
        const call = must(/^(\w+)\((?:'(\w+)')?\)$/.exec(attrs.onclick ?? ''), `button call ${attrs.onclick}`);
        items.push({ kind: 'action', fn: call[1], ...(call[2] ? { arg: call[2] } : {}), label: text(node) });
      } else if (attrs.id) {
        const out = { kind: 'output', id: attrs.id, tag, initial: text(node) };
        if (attrs.role) out.role = attrs.role;
        if (attrs['aria-label']) out.ariaLabel = attrs['aria-label'];
        if (attrs.title) out.title = attrs.title;
        items.push(out);
      } else if (hasInteractive(node)) {
        walk(node.children);
      } else {
        items.push({ kind: 'content', nodes: toContent([node]) });
      }
    }
  };
  walk(note.children);
  // Merge adjacent content items.
  const merged = [];
  for (const item of items) {
    const last = merged[merged.length - 1];
    if (item.kind === 'content' && last?.kind === 'content') last.nodes.push(...item.nodes); else merged.push(item);
  }
  const fns = merged.filter(i => i.kind === 'action').map(i => i.fn);
  const prepare = fns.find(f => f.startsWith('prepare'));
  if (prepare) {
    const exportFn = must(fns.find(f => f.startsWith('export')), `export for ${prepare}`);
    return { tool: 'prompt', items: merged, prompt: promptSpec(prepare, exportFn) };
  }
  const tool = fns.map(f => toolByFn[f]).find(Boolean);
  return { tool: must(tool, `tool for ${fns.join(',')}`), items: merged };
}

// ---------- lesson conversion ----------
function convertLesson(n) {
  const cfg = configs[n];
  const schema = curriculum.schemas[n];
  const doc = parseHtml(templates[n]);
  const lessonNode = findAll(doc, x => x.attrs.id === 'lesson')[0];
  const intro = findAll([lessonNode], x => x.attrs.class === 'lessonintro')[0];
  const h1 = findAll([intro], x => x.tag === 'h1')[0];
  const hero = {
    eyebrow: text(findAll([intro], x => x.attrs.class === 'eyebrow')[0]),
    title: clean(h1.children.map(c => typeof c === 'string' ? c : c.tag === 'br' ? ' ' : textOf(c)).join('')),
    intro: text(findAll([intro], x => x.tag === 'p')[0]),
    meta: text(findAll([intro], x => x.tag === 'small')[0]),
  };
  const fieldNodes = findAll([lessonNode], x => x.attrs.class === 'field');
  const fields = fieldNodes.map(f => {
    const control = findAll([f], x => ['textarea', 'input', 'select'].includes(x.tag))[0];
    const label = text(findAll([f], x => x.tag === 'label')[0]).replace(/\s*\*$/, '');
    return { id: control.attrs.id, label, kind: 'textarea', required: schema.ids.includes(control.attrs.id), maxLength: Number(control.attrs.maxlength ?? 2000) };
  });
  const sections = [];
  let flag = null;
  for (const article of findAll([lessonNode], x => x.tag === 'article')) {
    const kids = elements(article);
    const label = text(kids.find(k => k.attrs.class === 'stepnum'));
    const h2 = kids.find(k => k.tag === 'h2');
    const name = label.replace(/^\d+ \/ /, '');
    const id = { WATCH: 'watch', LEARN: 'learn', BUILD: 'build', CHALLENGE: 'challenge', 'KNOWLEDGE CHECK': 'quiz', 'DELIVER & PROGRESS': 'deliver' }[name] ?? (name.startsWith('ASK AI') ? 'coach' : must(null, `section ${label}`));
    const blocks = [];
    const content = nodes => { if (!nodes.length) return; const last = blocks[blocks.length - 1]; if (last?.type === 'content') last.nodes.push(...nodes); else blocks.push({ type: 'content', nodes }); };
    let fieldRun = null;
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i];
      const onclick = k.attrs.onclick ?? '';
      if (k.attrs.class !== 'field') fieldRun = null;
      if (k === h2 || k.attrs.class === 'stepnum') continue;
      if (k.attrs.class === 'video') {
        blocks.push({ type: 'video', title: text(findAll([k], x => x.tag === 'h3')[0]), subtitle: text(findAll([k], x => x.tag === 'p')[0]) });
      } else if (k.tag === 'details' && findAll([k], x => x.attrs.id === 'story').length) {
        const scenes = cfg.scenes.map(([title, visual, narration]) => ({ title, visual, narration }));
        blocks.push({ type: 'storyboard', scenes, summary: text(findAll([k], x => x.tag === 'summary')[0]) });
        blocks.push({ type: 'transcript', scenes });
      } else if (k.tag === 'details' && findAll([k], x => x.attrs.id === 'videoPrompt').length) {
        const dl = findAll([k], x => /^download\(prompt,'/.test(x.attrs.onclick ?? ''))[0];
        blocks.push({ type: 'videoPrompt', prompt: cfg.prompt, filename: must(/^download\(prompt,(.*)\)$/.exec(dl.attrs.onclick), 'prompt filename')[1].replace(/'\+current\+'/g, String(n)).replace(/^'|'$/g, ''), summary: text(findAll([k], x => x.tag === 'summary')[0]) });
      } else if (k.tag === 'label' && k.attrs.class === 'check') {
        const input = findAll([k], x => x.tag === 'input')[0].attrs.id;
        if (input === 'studied') blocks.push({ type: 'studied', label: text(k) });
        else if (input === 'honest') blocks.push({ type: 'honest', label: text(k) });
        else if (input === 'artifactReady' || input === 'releaseAck50') { flag = { flag: input, label: text(k) }; blocks.push({ type: 'flag', ...flag }); }
        else throw new Error(`Unknown checkbox ${input}`);
      } else if (k.attrs.id === 'saveStatus') {
        content([{ tag: 'p', attrs: { class: 'muted' }, children: [text(k)] }]);
        blocks.push({ type: 'saveStatus' });
      } else if (k.tag === 'form') {
        blocks.push({ type: 'fields', ids: findAll([k], x => x.tag === 'textarea').map(x => x.attrs.id) });
      } else if (k.attrs.class === 'field') {
        const fid = findAll([k], x => x.tag === 'textarea')[0].attrs.id;
        if (fieldRun) fieldRun.ids.push(fid); else { fieldRun = { type: 'fields', ids: [fid] }; blocks.push(fieldRun); }
      } else if (k.tag === 'h3' && /^practice\(/.test(kids[i + 1]?.attrs.onclick ?? '')) {
        const feedback = practiceFor(n);
        const options = [];
        while (/^practice\((\d)\)$/.test(kids[i + 1]?.attrs.onclick ?? '')) { i++; options.push({ label: text(kids[i]), feedback: feedback[/\d/.exec(kids[i].attrs.onclick)[0]] }); }
        if (kids[i + 1]?.attrs.id === 'practiceFeedback') i++;
        blocks.push({ type: 'practice', prompt: text(k), options });
      } else if (/coachMode\(|^coach\(\)/.test(onclick) || (k.tag === 'div' && !k.attrs.class && findAll([k], x => /coachMode\(/.test(x.attrs.onclick ?? '')).length)) {
        const modes = [];
        let question;
        for (; i < kids.length; i++) {
          const c = kids[i];
          const buttons = c.tag === 'button' ? [c] : findAll([c], x => x.tag === 'button');
          if (c.attrs.id === 'chat') { blocks.push({ type: 'extension', id: 'coach', props: { modes, ...(question ? { question } : {}), initial: text(c) } }); break; }
          if (c.tag === 'label' && c.attrs.for === 'coachQuestion') { question = { label: text(c) }; continue; }
          if (c.tag === 'textarea') continue;
          for (const b of buttons) {
            const oc = b.attrs.onclick ?? '';
            const mode = /^coachMode\('(\w+)'\)$/.exec(oc);
            if (mode) modes.push({ id: mode[1], label: text(b), response: coachFor(n, mode[1]) });
            else if (oc === 'coach()') modes.push({ id: 'review', label: text(b), response: reviewResponse });
            else {
              const reply = must(new RegExp(`getElementById\\('chat'\\)\\.textContent=${STR}`).exec(oc), `coach question ${oc}`);
              question = { ...question, button: text(b), response: jsString(reply[1]) };
            }
          }
        }
      } else if (k.attrs.id === 'quiz') {
        blocks.push({ type: 'quiz' });
        while (kids[i + 1] && (kids[i + 1].attrs.onclick === 'checkQuiz()' || kids[i + 1].attrs.id === 'quizFeedback')) i++;
      } else if (k.attrs.id === 'checklist') {
        blocks.push({ type: 'checklist' });
      } else if (k.attrs.id === 'complete') {
        blocks.push({ type: 'complete', label: text(k), completedNotice: `Lesson ${n}${completedTail}`, incompleteNotice });
        if (kids[i + 1]?.attrs.id === 'completionFeedback') i++;
      } else if (k.attrs.id === 'moduleStatus') {
        blocks.push({ type: 'extension', id: 'moduleStatus', props: { module: cfg.module, text: moduleTail } });
      } else if (onclick === 'previewBrief()') {
        const props = { previewLabel: text(k) };
        while (kids[i + 1] && ['exportBrief()', 'exportRunbook50()'].includes(kids[i + 1].attrs.onclick) || kids[i + 1]?.attrs.id === 'briefPreview') {
          i++;
          if (kids[i].attrs.onclick === 'exportBrief()') props.downloadLabel = text(kids[i]);
          if (kids[i].attrs.onclick === 'exportRunbook50()') props.runbookLabel = text(kids[i]);
        }
        blocks.push({ type: 'extension', id: 'brief', props });
      } else if (onclick === 'resetDraft()') {
        blocks.push({ type: 'reset', label: text(k) });
      } else if (onclick === 'view(false)') {
        continue;
      } else if (k.attrs.class === 'note' && hasInteractive(k)) {
        blocks.push({ type: 'extension', id: 'tool', props: toolItems(k) });
      } else {
        // Static curriculum content. Phase 04 preview button (Lesson 60) becomes a dashboard link.
        for (const b of findAll([k], x => x.attrs.onclick === 'previewLaunch60()')) b.attrs.onclick = 'goPhase(4)';
        if (onclick === 'previewLaunch60()') k.attrs.onclick = 'goPhase(4)';
        content(toContent([k]));
      }
    }
    sections.push({ id, label, heading: h2 ? text(h2) : name.charAt(0) + name.slice(1).toLowerCase(), blocks });
  }
  const mainIds = cfg.fields.map(f => f[0]);
  const checklist = [
    { kind: 'studied', label: 'Storyboard/transcript reviewed' },
    { kind: 'fields', label: 'All worksheet fields completed', ids: mainIds },
    { kind: 'fields', label: 'Challenge reflections completed', ids: REFLECTION },
    { kind: 'quiz', label: 'Knowledge check answered correctly' },
    { kind: 'honest', label: 'Honest self-review confirmed' },
  ];
  if (flag) checklist.push({ kind: 'flag', flag: flag.flag, label: flag.flag === 'artifactReady' ? 'Prototype artifact recorded' : 'Release record acknowledgement confirmed' });
  return {
    number: n, phase: 3, module: cfg.module, title: cfg.title, hero,
    fields,
    questions: cfg.questions.map(([prompt, options, answer, explanation]) => ({ prompt, options, answer, explanation })),
    checklist,
    deliverable: { title: cfg.deliverable, filename: cfg.filename, footer: '' },
    sections,
  };
}

// ---------- dashboard ----------
function convertDashboard() {
  const body = parseHtml(legacyBody(3));
  const dash = findAll(body, x => x.attrs.id === 'dashboard')[0];
  const kids = elements(dash);
  const h1 = kids.find(k => k.tag === 'h1');
  const modules = kids.filter(k => k.tag === 'article').map(article => {
    const [code, title] = text(findAll([article], x => x.tag === 'h2')[0]).split(' · ');
    const lessons = findAll([article], x => x.tag === 'p').map(p => {
      const button = findAll([p], x => x.tag === 'button')[0];
      const [num, ...rest] = text(button).split(' · ');
      return { number: Number(num), title: rest.join(' · '), summary: text(findAll([p], x => x.tag === 'small')[0]) };
    });
    return { code, title, lessons };
  });
  return {
    phase: 3,
    title: 'Phase 03 · Build',
    hero: {
      eyebrow: text(kids.find(k => k.attrs.class === 'eyebrow')),
      title: clean(h1.children.map(c => typeof c === 'string' ? c : c.tag === 'br' ? ' ' : textOf(c)).join('')),
      intro: text(kids.find(k => k.tag === 'p')),
    },
    modules,
    sections: [],
  };
}

// ---------- write ----------
const STALE = STALE_TABLE[3];
const staleUsed = new Set();
const out = (path, value) => {
  if (typeof value !== 'string') value = correctStale(value, STALE, staleUsed);
  const url = new URL(path, root);
  mkdirSync(new URL('.', url), { recursive: true });
  writeFileSync(url, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
};
for (const n of LESSONS) {
  const lesson = convertLesson(n);
  // Phase boundary: the checkpoint links to the Launch overview; also offer Lesson 61 directly.
  if (n === 60) lesson.sections.at(-1).blocks.push({ type: 'next' });
  out(`src/data/lessons/phase-3/lesson-${n}.json`, lesson);
}
out('src/data/dashboards/phase-3.json', convertDashboard());
assertCorrectionsUsed(STALE, staleUsed);
// Lesson 45 downloadable prototype shell (exported as a file; never rendered or executed by the app).
out('src/phases/phase3/data/prototypeShell45.json', { shell: jsonConst(js, 'prototypeShell45') });
console.log(`Phase 3: wrote ${LESSONS.length} lessons, dashboard and prototype shell.`);
