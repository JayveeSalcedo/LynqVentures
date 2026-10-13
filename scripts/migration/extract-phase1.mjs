// Phase 1 (Discover) extractor: legacy legacy/lessons/phase-1.html → typed lesson/dashboard JSON.
// Deterministic and re-runnable: `node scripts/migration/extract-phase1.mjs`.
// Everything is read from the legacy document. Logic-embedded strings (coach replies, practice
// feedback, preview labels, module status text) are parsed from the legacy functions; a few
// preview layouts are mapped by hand below, copied verbatim from the legacy show*() functions.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { legacyScript, legacyBody, jsonConst, literalConst, parseHtml, findAll, byId, textOf, toContent, correctStale, assertCorrectionsUsed } from './legacy.mjs';
import { STALE as STALE_TABLE } from './stale-corrections.mjs';

const root = new URL('../../', import.meta.url);
const curriculum = JSON.parse(readFileSync(new URL('src/data/curriculum.json', root), 'utf8'));
const js = legacyScript(1);
const configs = literalConst(js, 'configs');
const modules = literalConst(js, 'modules');
const templates = jsonConst(js, 'templates');
const prompts = literalConst(js, 'prompts');
const pad = n => String(n).padStart(2, '0');

/** Evaluate a single JS string literal (already matched by a strict string-literal regex). */
const STRING = String.raw`'(?:[^'\\]|\\.)*'`;
const str = literal => {
  if (!new RegExp(`^${STRING}$`).test(literal)) throw new Error(`Not a string literal: ${literal.slice(0, 40)}`);
  return Function(`"use strict";return (${literal});`)();
};

/** Source of a top-level legacy function. */
function fnSource(name) {
  const start = js.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing function ${name}`);
  const end = js.indexOf('\nfunction ', start + 1);
  return js.slice(start, end < 0 ? undefined : end);
}

// ---------------------------------------------------------------- coach replies (coachReply)
/**
 * Coach reply objects are literals of string concatenations using `missing` and `profileValid()`.
 * The expression is vetted to contain only those identifiers outside strings, then evaluated twice
 * (profile complete / incomplete) with `{missing}` as the placeholder the framework fills in.
 */
function coachObject(literal) {
  const outside = literal.replace(new RegExp(STRING, 'g'), '""');
  const identifiers = outside.match(/[A-Za-z_$][\w$]*/g) ?? [];
  for (const id of identifiers) if (!['teach', 'guide', 'review', 'challenge', 'missing', 'profileValid'].includes(id)) throw new Error(`Unexpected identifier ${id}`);
  const evaluate = valid => Function('missing', 'profileValid', `"use strict";return (${literal});`)('{missing}', () => valid);
  const complete = evaluate(true), incomplete = evaluate(false);
  const replies = { teach: complete.teach, guide: complete.guide, review: complete.review, challenge: complete.challenge };
  if (incomplete.review !== complete.review) replies.reviewIncomplete = incomplete.review;
  for (const k of ['teach', 'guide', 'challenge']) if (incomplete[k] !== complete[k]) throw new Error(`Unexpected conditional in ${k}`);
  return replies;
}
const coachSource = fnSource('coachReply');
const coach = {};
{
  const OBJ = String.raw`(\{teach:(?:${STRING}|[^'{}])*\})\[mode\]`;
  const first = new RegExp(String.raw`text=current===1\?${OBJ}:${OBJ}`).exec(coachSource);
  coach[1] = coachObject(first[1]);
  coach.default = coachObject(first[2]);
  for (const m of coachSource.matchAll(new RegExp(String.raw`if\(current===(\d+)\)text=${OBJ}`, 'g'))) coach[m[1]] = coachObject(m[2]);
}
const coachPrefix = /\$\('chat'\)\.textContent='([^']*)'\+mode\.toUpperCase\(\)\+'\\n\\n'\+text\+\(\$\('coachQuestion'\)\.value\.trim\(\)\?'\\n\\n([^']*)'/.exec(coachSource);
if (!coachPrefix) throw new Error('coach output format changed');

// ---------------------------------------------------------------- practice feedback (decision)
const decisionSource = fnSource('decision');
const decisions = {};
for (const m of decisionSource.matchAll(new RegExp(String.raw`if\(current===(\d+)\)\{\$\('decisionFeedback'\)\.textContent=choice===1\?(${STRING}):(${STRING});return;\}`, 'g')))
  decisions[m[1]] = { correct: str(m[2]), other: str(m[3]) };
{
  const m = new RegExp(String.raw`\$\('decisionFeedback'\)\.textContent=choice===1\?(${STRING}):(${STRING});\}\s*$`).exec(decisionSource.trim());
  decisions.default = { correct: str(m[1]), other: str(m[2]) };
}

// ---------------------------------------------------------------- previews (show*)
const previewFns = { 3: 'showPurpose', 4: 'showSupportMap', 5: 'showCommitment', 6: 'showJournal', 7: 'showPeopleMap', 8: 'showProblemMap', 9: 'showAlternatives', 10: 'showSelection', 11: 'showSnapshot', 12: 'showJourney', 13: 'showResearch', 14: 'showLandscape', 15: 'showPlan', 16: 'showOpportunity', 17: 'showValue', 18: 'showFit', 19: 'showBrief', 20: 'showCheckpoint' };
function previewSpec(n, rawLabels) {
  const src = fnSource(previewFns[n]);
  // Lessons 3–5: "Label: value" lines joined by a newline, no footer (verbatim from the legacy functions).
  if (n === 3 || n === 4) {
    const lines = [...src.matchAll(/'(?:\\n)?([^'\\]+): '\+\(state\.fields\.(\w+)\?\.trim\(\)\|\|'Not yet entered'\)/g)].map(m => ({ id: m[2], label: m[1] }));
    return { kind: 'lines', joiner: '\n', lines };
  }
  if (n === 5) {
    const one = label => { const m = new RegExp(String.raw`'${label}: '\+\(state\.fields\.(\w+)\?\.trim\(\)`).exec(src); return { id: m[1], label }; };
    if (!src.includes("['week1','week2','week3','week4'].map((id,i)=>'Week '+(i+1)+': '")) throw new Error('showCommitment changed');
    return { kind: 'lines', joiner: '\n', lines: [one('My learning commitment'), one('Schedule and boundary'), ...[1, 2, 3, 4].map(i => ({ id: `week${i}`, label: `Week ${i}` })), one('Review'), one('Fallback')] };
  }
  if (n === 6) {
    // showJournal: three entry blocks, the pattern line and a fixed caveat, joined by blank lines.
    const keys = /\['context','people','observation','workaround','impact','interpretation','next'\]/.exec(src);
    const source = /\|\|'(Source not chosen)'\)/.exec(src);
    const pattern = /'(Tentative pattern \/ next check): '\+\(state\.fields\.pattern/.exec(src);
    const footer = /'Not yet entered'\),'([^']+)'\]\.join/.exec(src);
    if (!keys || !source || !pattern || !footer) throw new Error('showJournal changed');
    return { kind: 'journal', entryKeys: ['context', 'people', 'observation', 'workaround', 'impact', 'interpretation', 'next'], sourceMissing: source[1], patternLabel: pattern[1], footer: footer[1] };
  }
  const footer = /\.join\('\\n\\n'\)\+'\\n\\n([^']+)';/.exec(src)[1];
  if (n <= 9) {
    const table = literalConst(src.replace(/^function \w+\(\)\{let box=\$\('\w+'\);box\.hidden=false;box\.textContent=/, 'const table='), 'table');
    return { kind: 'lines', joiner: '\n\n', lines: table.map(([id, label]) => ({ id, label })), footer };
  }
  // Lessons 10–20 use the live <label> text (including the " *" marker) for each profile field.
  if (!src.includes(`configs[${n}].profileIds.map(id=>$(id).labels[0].textContent+': '`)) throw new Error(`${previewFns[n]} changed`);
  return { kind: 'lines', joiner: '\n\n', lines: configs[n].profileIds.map(id => ({ id, label: rawLabels[id] })), footer };
}

// ---------------------------------------------------------------- module/phase status (renderProgress)
const progressSource = fnSource('renderProgress');
function statusText(id) {
  // e.g. if($('discoveryModuleStatus'))$('discoveryModuleStatus').textContent=discovery===5?'A':discovery+' / 5 …';
  const m = new RegExp(String.raw`\$\('${id}'\)\.textContent=((?:${STRING}|[^;'])*);`).exec(progressSource);
  if (!m) throw new Error(`Missing status ${id}`);
  const expr = m[1];
  const literals = expr.match(new RegExp(STRING, 'g'));
  if (literals.length !== 2) throw new Error(`Unexpected status ${id}`);
  // The incomplete text is prefixed with the live lesson count.
  return { complete: str(literals[0]), incomplete: `{count}${str(literals[1])}` };
}
const statusIds = { modulePackStatus: '1.1', discoveryModuleStatus: '1.2', customerModuleStatus: '1.3', opportunityModuleStatus: '1.4', discoverPackStatus: 'phase' };
const statuses = Object.fromEntries(Object.keys(statusIds).map(id => [id, statusText(id)]));
const checklistLabels = /\[current===1\?'([^']+)':'([^']+)',configs\[current\]\.deliverable\+'([^']+)','([^']+)','([^']+)','([^']+)'\]/.exec(progressSource);
const completedNotice = /'Lesson '\+String\(current\)\.padStart\(2,'0'\)\+'( self-completed locally\. )Discover progress: '\+totalDone\(\)\+' \/ 20 \('\+totalDone\(\)\*5\+'%\)\. Download your '\+configs\[current\]\.deliverable\+'(\. No reviewer approval or venture validation is recorded\.)'/.exec(fnSource('completeLesson'));
const incompleteNotice = /textContent='(Complete the remaining requirements[^']+)'/.exec(fnSource('completeLesson'))[1];
const exportFooter = /out\+='(Local prototype export\.[^']+)\\n'/.exec(fnSource('exportProfile'))[1];
const sceneMeta = /'Planned final scene: '\+\(current===1\?'(\d+)':'(\d+)'\)\+'( seconds · [^']+)'/.exec(fnSource('scene'));

// ---------------------------------------------------------------- stale prototype statements
// Sentences that only described the old iframe prototype and are untrue in the native academy.
const stale = [
  [6, ' Lessons 08–10 remain planned content.'],
  [20, ' Phase 02 lessons are not built or connected in this prototype.'],
];

// ---------------------------------------------------------------- lesson conversion
const cls = node => (node.attrs.class || '').split(/\s+/);
const has = (node, pred) => findAll([node], pred).length > 0;
const hasId = (node, id) => has(node, x => x.attrs.id === id);
const clean = text => text.replace(/\s+/g, ' ').trim();
/** Text content with <br> rendered as a space (headings split across lines). */
const flat = node => typeof node === 'string' ? node : node.tag === 'br' ? ' ' : node.children.map(flat).join('');

function convertLesson(n) {
  const html = stale.filter(([k]) => k === n).reduce((h, [, s]) => { if (!h.includes(s)) throw new Error(`stale text missing in ${n}`); return h.replace(s, ''); }, templates[n]);
  const nodes = parseHtml(html);
  const config = configs[n];
  const schema = curriculum.schemas[n];
  const moduleCode = config.module || '1.1';
  const intro = findAll(nodes, x => cls(x).includes('lessonintro'))[0];
  const hero = {
    eyebrow: textOf(findAll([intro], x => cls(x).includes('eyebrow'))[0]),
    title: clean(flat(findAll([intro], x => x.tag === 'h1')[0])),
    intro: clean(textOf(findAll([intro], x => x.tag === 'p')[0])),
    badges: findAll([intro], x => cls(x).includes('badge')).map(x => clean(textOf(x))),
    meta: clean(textOf(findAll([intro], x => x.tag === 'small')[0])),
  };
  const rawLabels = {};
  const fields = [];
  function field(div) {
    const label = findAll([div], x => x.tag === 'label')[0];
    const control = findAll([div], x => ['input', 'textarea', 'select'].includes(x.tag))[0];
    const id = control.attrs.id;
    if (label.attrs.for !== id) throw new Error(`label mismatch ${n} ${id}`);
    const raw = textOf(label);
    rawLabels[id] = raw;
    const text = raw.replace(/ \*$/, '');
    if (text !== raw.replace(' *', '')) throw new Error(`label marker ${n} ${id}`);
    const help = findAll([div], x => x.tag === 'p' && cls(x).includes('help'))[0];
    const def = { id, label: text, kind: control.tag === 'select' ? 'select' : control.tag === 'textarea' ? 'textarea' : 'input', required: schema.ids.includes(id) };
    if (control.attrs.placeholder) def.placeholder = control.attrs.placeholder;
    if (control.tag === 'select') def.options = findAll([control], x => x.tag === 'option').map(o => ({ value: o.attrs.value ?? textOf(o), label: textOf(o) }));
    if (control.attrs.maxlength) def.maxLength = Number(control.attrs.maxlength);
    if (help) def.hint = clean(textOf(help));
    fields.push(def);
    return id;
  }

  const sections = [];
  for (const article of findAll(nodes, x => x.tag === 'article')) {
    const id = article.attrs.id;
    const blocks = [];
    let buffer = [];
    const flush = () => { const c = toContent(buffer); if (c.length) blocks.push({ type: 'content', nodes: c }); buffer = []; };
    const pushFields = ids => { const last = blocks[blocks.length - 1]; if (last?.type === 'fields' && !buffer.length) last.ids.push(...ids); else { flush(); blocks.push({ type: 'fields', ids }); } };
    function walkForm(children) {
      for (const child of children) {
        if (typeof child === 'string') continue;
        if (cls(child).includes('field')) pushFields([field(child)]);
        else if (child.tag === 'details') {
          flush();
          const summary = textOf(findAll([child], x => x.tag === 'summary')[0]);
          const ids = findAll([child], x => cls(x).includes('field')).map(field);
          blocks.push({ type: 'extension', id: 'fieldGroup', props: { summary, open: child.attrs.open !== undefined, ids } });
        } else walkForm(child.children);
      }
    }
    const children = article.children;
    let headingSeen = false;
    for (let i = 0; i < children.length; i++) {
      const node = children[i];
      if (typeof node === 'string') { buffer.push(node); continue; }
      const c = cls(node);
      if (c.includes('stepnum')) continue;
      if (node.tag === 'h2' && !headingSeen) { headingSeen = true; continue; }
      if (node.attrs.id && /Preview$|^decisionFeedback$|^quizFeedback$|^completionFeedback$|^chat$/.test(node.attrs.id)) continue;
      if (c.includes('storycontrols')) continue;
      if (c.includes('video')) {
        flush();
        if (hasId(node, 'sceneTitle')) blocks.push({ type: 'storyboard', scenes: scenesOf(n), sceneMeta: sceneMetaFor(n) });
        else blocks.push({ type: 'content', nodes: toContent([{ ...node, attrs: { ...node.attrs, class: 'video-placeholder' }, children: node.children.filter(x => typeof x === 'string' || x.attrs['aria-hidden'] !== 'true') }]) });
        continue;
      }
      if (node.tag === 'details' && hasId(node, 'sceneTitle')) { flush(); blocks.push({ type: 'storyboard', scenes: scenesOf(n), sceneMeta: sceneMetaFor(n), summary: textOf(node.children.find(x => x.tag === 'summary')) }); continue; }
      if (node.tag === 'details' && hasId(node, 'videoPrompt')) {
        flush();
        const help = findAll([node], x => x.tag === 'p' && cls(x).includes('help') && !x.attrs.id)[0];
        if (help) blocks.push({ type: 'content', nodes: toContent([help]) });
        blocks.push({ type: 'videoPrompt', prompt: prompts[n], filename: `LYNQ-Lesson-${pad(n)}-Gemini-Video-Prompt.md`, title: `# LYNQ Lesson ${pad(n)} — Gemini video prompt`, summary: textOf(node.children.find(x => x.tag === 'summary')) });
        continue;
      }
      if (node.tag === 'details' && hasId(node, 'transcript')) { flush(); blocks.push({ type: 'transcript', scenes: scenesOf(n), summary: textOf(node.children.find(x => x.tag === 'summary')) }); continue; }
      if (node.tag === 'label' && hasId(node, 'studied')) { flush(); blocks.push({ type: 'studied', label: clean(textOf(node)) }); continue; }
      if (node.tag === 'label' && hasId(node, 'honest')) { flush(); blocks.push({ type: 'honest', label: clean(textOf(node)) }); continue; }
      if (node.tag === 'form' && node.attrs.id === 'profile') { walkForm(node.children); continue; }
      if (c.includes('field')) { pushFields([field(node)]); continue; }
      if (node.attrs.id === 'saveStatus') { flush(); blocks.push({ type: 'saveStatus' }); continue; }
      if (node.tag === 'div' && c.includes('actions') && has(node, x => /decision\(/.test(x.attrs.onclick || ''))) {
        // Practice: the preceding <h3> (and optional prompt <p>) introduce the scenario.
        const nonBlank = () => buffer.filter(x => typeof x !== 'string' || x.trim());
        let prompt = '';
        let last = nonBlank().at(-1);
        if (last?.tag === 'p') { prompt = clean(textOf(last)); buffer.splice(buffer.lastIndexOf(last), 1); last = nonBlank().at(-1); }
        if (last?.tag !== 'h3') throw new Error(`practice heading ${n}`);
        buffer.splice(buffer.lastIndexOf(last), 1);
        flush();
        const feedback = decisions[n] ?? decisions.default;
        const options = findAll([node], x => x.tag === 'button').map((b, j) => ({ label: clean(textOf(b)), feedback: j === 1 ? feedback.correct : feedback.other }));
        if (!findAll([node], x => x.tag === 'button').every((b, j) => b.attrs.onclick === `decision(${j})`)) throw new Error(`practice order ${n}`);
        blocks.push({ type: 'practice', legend: clean(textOf(last)), prompt, options });
        continue;
      }
      if (node.tag === 'button' && /^show\w+\(\)$/.test(node.attrs.onclick || '')) {
        flush();
        if (node.attrs.onclick !== `${previewFns[n]}()`) throw new Error(`preview fn ${n}`);
        blocks.push({ type: 'extension', id: 'preview', props: { label: clean(textOf(node)), ...previewSpec(n, rawLabels) } });
        continue;
      }
      if (c.includes('actions') && has(node, x => x.attrs.onclick === 'exportProfile()')) {
        flush();
        const label = clean(textOf(findAll([node], x => x.attrs.onclick === 'exportProfile()')[0]));
        blocks.push({ type: 'extension', id: 'download', props: { label } });
        if (has(node, x => x.attrs.onclick === 'confirmReset()')) blocks.push({ type: 'reset', label: clean(textOf(findAll([node], x => x.attrs.onclick === 'confirmReset()')[0])) });
        continue;
      }
      if (node.attrs.id === 'modes') {
        flush();
        const modes = findAll([node], x => x.tag === 'button').map(b => ({ id: b.attrs['data-mode'], label: clean(textOf(b)) }));
        const label = children.slice(i).find(x => x.tag === 'label' && x.attrs.for === 'coachQuestion');
        const input = children.slice(i).find(x => x.attrs?.id === 'coachQuestion');
        const button = children.slice(i).find(x => x.attrs?.onclick === 'coachReply()');
        blocks.push({ type: 'extension', id: 'coach', props: {
          modes, replies: coach[n] ?? coach.default, heading: coachPrefix[1], questionNote: coachPrefix[2],
          questionLabel: textOf(label), placeholder: input.attrs.placeholder, maxLength: Number(input.attrs.maxlength), submitLabel: clean(textOf(button)),
        } });
        continue;
      }
      if ((node.tag === 'label' && node.attrs.for === 'coachQuestion') || node.attrs.id === 'coachQuestion' || node.attrs.onclick === 'coachReply()' || node.attrs.onclick === 'grade()') continue;
      if (node.attrs.id === 'quizForm') { flush(); blocks.push({ type: 'quiz' }); continue; }
      if (node.attrs.id === 'checklist') { flush(); blocks.push({ type: 'checklist' }); continue; }
      if (node.attrs.id === 'complete') {
        flush();
        blocks.push({ type: 'complete', label: `Mark Lesson ${pad(n)} complete locally`, completedLabel: `Lesson ${pad(n)} self-completed locally`,
          completedNotice: `Lesson ${pad(n)}${completedNotice[1]}Download your ${config.deliverable}${completedNotice[2]}`, incompleteNotice });
        if (clean(textOf(node)) !== `Mark Lesson ${pad(n)} complete locally`) throw new Error(`complete label ${n}`);
        continue;
      }
      if (c.includes('note') && has(node, x => statusIds[x.attrs.id])) {
        flush();
        const parts = node.children.filter(x => typeof x !== 'string' || x.trim()).map(x => typeof x !== 'string' && statusIds[x.attrs.id] ? { status: statusIds[x.attrs.id], ...statuses[x.attrs.id] } : { nodes: toContent([x]) });
        blocks.push({ type: 'extension', id: 'moduleNote', props: { parts } });
        continue;
      }
      if (c.includes('help') && has(node, x => x.attrs.onclick === `openLesson(${n + 1})`)) { flush(); blocks.push({ type: 'next' }); continue; }
      if (node.tag === 'button' && node.attrs.onclick === "view('dashboard')") { buffer.push({ ...node, attrs: { ...node.attrs, onclick: 'goPhase(1)' } }); continue; }
      buffer.push(node);
    }
    flush();
    const heading = clean(textOf(article.children.find(x => x.tag === 'h2')));
    sections.push({ id, label: textOf(article.children.find(x => cls(x).includes('stepnum'))), heading, blocks });
  }
  // Lesson 20 hands off to Phase 02, which is now part of the academy.
  if (n === 20) sections.at(-1).blocks.push({ type: 'next' });

  // Fields ordered as in the legacy configs (export order).
  const ordered = config.ids.map(fid => { const f = fields.find(x => x.id === fid); if (!f) throw new Error(`field ${fid} missing in ${n}`); return f; });
  if (ordered.length !== fields.length) throw new Error(`extra fields in ${n}`);
  const questions = literalConst(js, `questions${n}`).map(([prompt, options, answer, explanation]) => ({ prompt, options, answer, explanation }));
  const nav = findAll(nodes, x => cls(x).includes('links'))[0].children.filter(x => x.tag === 'a').map(a => ({ id: a.attrs.href.slice(1), label: textOf(a).replace(/^\d+ /, '') }));
  const lesson = {
    number: n, phase: 1, module: moduleCode, title: curriculum.names[n], hero,
    fields: ordered, questions,
    checklist: [
      { kind: 'studied', label: n === 1 ? checklistLabels[1] : checklistLabels[2] },
      { kind: 'fields', label: config.deliverable + checklistLabels[3], ids: config.profileIds },
      { kind: 'fields', label: checklistLabels[4], ids: ['assumption', 'evidence', 'constraint'] },
      { kind: 'quiz', label: checklistLabels[5] },
      { kind: 'honest', label: checklistLabels[6] },
    ],
    deliverable: {
      title: `LYNQ Academy — ${config.deliverable}`, filename: config.filename,
      headerLines: ['Phase 01 · Module {module} · Lesson {lesson}', 'Status: {status}', 'Created: {created}'],
      fieldIds: config.ids, footer: exportFooter,
    },
    sections, nav,
  };
  if (n === 1) adaptLessonOne(lesson);
  return lesson;
}

function scenesOf(n) { return literalConst(js, `scenes${n}`).map(([title, visual, narration]) => ({ title, visual, narration })); }
function sceneMetaFor(n) { return `Planned final scene: ${n === 1 ? sceneMeta[1] : sceneMeta[2]}${sceneMeta[3]}`; }

/**
 * Lesson 1 previously ran on the dedicated React page; keep its behaviour: the deliver step offers
 * a Founder Profile preview and download next to the self-review (the legacy page had none there).
 */
function adaptLessonOne(lesson) {
  const finish = lesson.sections.find(s => s.id === 'finish');
  const at = finish.blocks.findIndex(b => b.type === 'checklist');
  finish.blocks.splice(at, 0, { type: 'extension', id: 'download', props: { label: 'Download Founder Profile', preview: true, previewLabel: 'Preview my brief' } });
  // Order as before: preview/download, self-review, checklist, complete, next.
  const honest = finish.blocks.findIndex(b => b.type === 'honest');
  const [h] = finish.blocks.splice(honest, 1);
  finish.blocks.splice(finish.blocks.findIndex(b => b.type === 'checklist'), 0, h);
}

// ---------------------------------------------------------------- dashboard
function convertDashboard() {
  const body = parseHtml(legacyBody(1));
  const dash = byId(body, 'dashboard');
  const hero = findAll([dash], x => cls(x).includes('hero'))[0];
  const roadmap = byId([dash], 'roadmap');
  const checkpoint = findAll([dash], x => cls(x).includes('checkpoint'))[0];
  const stats = findAll([dash], x => cls(x).includes('stat'));
  const deliverableStat = stats.find(s => textOf(s).includes('Phase deliverable'));
  // The checkpoint <small> only described which lessons the old prototype contained; it is dropped.
  const checkpointSmall = findAll([checkpoint], x => x.tag === 'small')[0];
  if (!/This prototype includes/.test(textOf(checkpointSmall))) throw new Error('checkpoint note changed');
  let number = 0;
  return {
    phase: 1,
    title: 'Discover',
    hero: {
      eyebrow: textOf(findAll([hero], x => cls(x).includes('eyebrow'))[0]),
      title: clean(flat(findAll([hero], x => x.tag === 'h1')[0])),
      intro: clean(textOf(findAll([hero], x => x.tag === 'p')[0])),
      badges: [clean(textOf(findAll([roadmap], x => x.tag === 'span' && cls(x).includes('badge'))[0]))],
    },
    modules: modules.map(([code, title, summary, lessons]) => ({
      code, title, summary,
      lessons: lessons.map(([name, outcome]) => { number++; if (name !== curriculum.names[number]) throw new Error(`module lesson ${number}`); return { number, title: name, summary: outcome }; }),
    })),
    sections: [
      { heading: textOf(findAll([roadmap], x => x.tag === 'h2')[0]), nodes: toContent(findAll([roadmap], x => x.tag === 'p')) },
      { heading: clean(textOf(findAll([deliverableStat], x => x.tag === 'small')[0])), nodes: toContent([{ tag: 'p', attrs: {}, children: [findAll([deliverableStat], x => x.tag === 'strong')[0], ' · ', textOf(findAll([deliverableStat], x => x.tag === 'small')[1])] }]) },
      { heading: textOf(findAll([checkpoint], x => cls(x).includes('eyebrow'))[0]), nodes: toContent(checkpoint.children.filter(x => typeof x !== 'string' && x !== checkpointSmall && !cls(x).includes('eyebrow'))) },
    ],
  };
}

// ---------------------------------------------------------------- write
const only = process.argv.slice(2).map(Number).filter(Boolean);
const STALE = STALE_TABLE[1];
const staleUsed = new Set();
const outDir = new URL('src/data/lessons/phase-1/', root);
mkdirSync(outDir, { recursive: true });
for (let n = 1; n <= 20; n++) {
  if (only.length && !only.includes(n)) continue;
  writeFileSync(new URL(`lesson-${pad(n)}.json`, outDir), JSON.stringify(correctStale(convertLesson(n), STALE, staleUsed), null, 1) + '\n');
}
mkdirSync(new URL('src/data/dashboards/', root), { recursive: true });
writeFileSync(new URL('src/data/dashboards/phase-1.json', root), JSON.stringify(correctStale(convertDashboard(), STALE, staleUsed), null, 1) + '\n');
assertCorrectionsUsed(STALE, staleUsed);
console.log('Phase 1 extracted.');
