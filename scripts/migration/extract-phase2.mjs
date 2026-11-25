// Phase 2 (Validate, Lessons 21–40) extractor.
// Reads legacy/lessons/phase-2.html (read-only) and writes typed lesson + dashboard JSON.
// Usage: node scripts/migration/extract-phase2.mjs [--check]
// Scripted strings embedded in legacy logic (practice/coach/render) are parsed out of the
// legacy functions verbatim; nothing is evaluated.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { legacyBody, legacyScript, jsonConst, parseHtml, findAll, byId, textOf, toContent, correctStale, assertCorrectionsUsed } from './legacy.mjs';
import { STALE as STALE_TABLE } from './stale-corrections.mjs';

const root = new URL('../../', import.meta.url);
const curriculum = JSON.parse(readFileSync(new URL('src/data/curriculum.json', root), 'utf8'));
const js = legacyScript(2);
const configs = jsonConst(js, 'configs');
const templates = jsonConst(js, 'templates');
const LESSONS = Array.from({ length: 20 }, (_, i) => 21 + i);
const REFLECTION = ['bias', 'counter', 'constraint'];

const fail = message => { throw new Error(`extract-phase2: ${message}`); };
const assert = (ok, message) => { if (!ok) fail(message); };
const brText = node => typeof node === 'string' ? node : node.tag === 'br' ? ' ' : node.children.map(brText).join('');
const squash = s => s.replace(/\s+/g, ' ').trim();
const fn = name => {
  const start = js.indexOf(`function ${name}(`);
  assert(start >= 0, `missing function ${name}`);
  const next = js.indexOf('function ', start + 9);
  return js.slice(start, next < 0 ? undefined : next);
};
const STR = "'((?:\\\\.|[^'\\\\])*)'";
const unquote = s => s.replace(/\\(.)/g, '$1');

// ---------- practice(i): per-lesson feedback (option 1 vs any other option) ----------
function practiceFeedback() {
  const src = fn('practice');
  const out = {};
  const branch = new RegExp(`if\\(current(>=|===)(\\d+)\\)\\{\\$\\('practiceFeedback'\\)\\.hidden=false;\\$\\('practiceFeedback'\\)\\.textContent=i===1\\?${STR}:${STR};return;\\}`, 'g');
  let m, last = 0;
  while ((m = branch.exec(src))) {
    const from = Number(m[2]);
    const targets = m[1] === '>=' ? LESSONS.filter(n => n >= from) : [from];
    for (const n of targets) if (!out[n]) out[n] = { good: unquote(m[3]), other: unquote(m[4]) }; // first matching branch wins (duplicate 23 is harmless)
    last = branch.lastIndex;
  }
  const tail = new RegExp(`textContent=i===1\\?${STR}:${STR};\\s*\\}`).exec(src.slice(last));
  assert(tail, 'practice default branch');
  for (const n of LESSONS) if (!out[n]) out[n] = { good: unquote(tail[1]), other: unquote(tail[2]) };
  return out;
}

// ---------- coach(mode): per-lesson scripted replies; `missing` counts config fields only ----------
function coachReplies() {
  const src = fn('coach');
  const out = {};
  const branch = new RegExp(`if\\(current(>=|===)(\\d+)\\)\\{let missing=fields\\.filter\\(\\(\\[id\\]\\)=>!state\\.fields\\[id\\]\\?\\.trim\\(\\)\\)\\.length;\\$\\('chat'\\)\\.textContent=mode==='review'\\?${STR}\\+missing\\+${STR}:mode==='question'\\?${STR}:${STR};return;\\}`, 'g');
  let m, last = 0;
  while ((m = branch.exec(src))) {
    const from = Number(m[2]);
    const targets = m[1] === '>=' ? LESSONS.filter(n => n >= from) : [from];
    const reply = { review: `${unquote(m[3])}{missing}${unquote(m[4])}`, question: unquote(m[5]), other: unquote(m[6]) };
    for (const n of targets) if (!out[n]) out[n] = reply;
    last = branch.lastIndex;
  }
  const rest = src.slice(last);
  const obj = /textContent=\(\{([\s\S]*)\}\)\[mode\]/.exec(rest);
  assert(obj, 'coach default object');
  const map = {};
  for (const e of obj[1].matchAll(new RegExp(`(\\w+):${STR}(?:\\+missing\\+${STR})?`, 'g'))) map[e[1]] = e[3] !== undefined ? `${unquote(e[2])}{missing}${unquote(e[3])}` : unquote(e[2]);
  for (const k of ['teach', 'guide', 'review', 'challenge', 'question']) assert(map[k], `coach default ${k}`);
  for (const n of LESSONS) if (!out[n]) out[n] = { map };
  return out;
}

// ---------- render(): module status and phase checkpoint wording ----------
function statusTexts() {
  const src = fn('render');
  const modules = {};
  const re = new RegExp(`\\[([\\d,]+)\\]\\.every\\(n=>states\\[n\\]\\.completed&&valid\\(n\\)\\)\\?${STR}:\\(?\\[[\\d,]+\\]\\.filter\\(n=>states\\[n\\]\\.completed&&valid\\(n\\)\\)\\.length\\)?\\+${STR}`, 'g');
  for (const m of src.matchAll(re)) {
    const lessons = m[1].split(',').map(Number);
    const code = `2.${(lessons[0] - 21) / 5 + 1}`;
    modules[code] = { lessons, complete: unquote(m[2]), incomplete: `{count}${unquote(m[3])}` };
  }
  assert(Object.keys(modules).length === 4, 'four module status texts');
  const cp = new RegExp(`if\\(current===40\\)\\$\\('phaseCheckpoint'\\)\\.textContent=Object\\.keys\\(configs\\)\\.every\\(n=>states\\[n\\]\\.completed&&valid\\(n\\)\\)\\?${STR}:${STR}`).exec(src);
  assert(cp, 'phase checkpoint text');
  const checklist = new RegExp(`\\[(${STR}(?:,${STR})*)\\]\\.forEach\\(\\(text,i\\)`).exec(src);
  assert(checklist, 'checklist wording');
  const labels = [...checklist[1].matchAll(new RegExp(STR, 'g'))].map(x => unquote(x[1]));
  assert(labels.length === 5, 'five checklist items');
  return { modules, checkpoint: { complete: unquote(cp[1]), incomplete: unquote(cp[2]) }, checklist: labels };
}

// ---------- other legacy strings ----------
const complete = fn('complete');
const incompleteNotice = unquote(new RegExp(`textContent=${STR};\\s*return`).exec(complete)[1]);
const completedNoticeParts = new RegExp(`textContent=${STR}\\+current\\+${STR}`).exec(complete);
const exportSrc = fn('exportBrief');
const exportFooter = unquote(new RegExp(`\\.join\\('\\\\n\\\\n'\\)\\+'\\\\n\\\\n([^']*)'\\)`).exec(exportSrc)[1]);
const previewFooter = new RegExp(`\\+'\\\\n\\\\n([^']*)'`).exec(fn('previewBrief'))[1];
const sceneMeta = new RegExp(`\\$\\('sceneMeta'\\)\\.textContent='([^']*)'\\+\\(index\\+1\\)\\+'([^']*)'`).exec(fn('scene'));
assert(exportSrc.includes("'Locally self-completed'") && exportSrc.includes("'Draft'"), 'export status wording');
assert(exportSrc.includes("Phase 02 · Module '+(configs[current].module||'2.1')+' · Lesson '+current+'\\nStatus: '"), 'export header');
assert(js.includes(".concat(['support','bias','counter','constraint'])"), 'export ids order');
assert(/if\(state\.completed&&!criteria\(\)\.every\(Boolean\)\)state\.completed=false/.test(fn('save')), 'save() revokes only when criteria fail');

const practice = practiceFeedback();
const coach = coachReplies();
const status = statusTexts();

// ---------- lesson conversion ----------
const el = (node, tag, cls) => typeof node !== 'string' && node.tag === tag && (!cls || (node.attrs.class || '').split(/\s+/).includes(cls));
const kids = node => node.children.filter(c => typeof c !== 'string' || c.trim());
const has = (node, pred) => findAll([node], pred).length > 0;
const onclick = (node, text) => has(node, n => (n.attrs.onclick || '').includes(text));
const content = nodes => { const c = toContent(nodes); return c.length ? [{ type: 'content', nodes: c }] : []; };

function convertLesson(n) {
  const cfg = configs[n];
  const schema = curriculum.schemas[n];
  const doc = parseHtml(templates[n]);
  const section = byId(doc, 'lesson');
  const intro = findAll([section], x => el(x, 'div', 'lessonintro'))[0];
  const eyebrow = squash(textOf(findAll([intro], x => el(x, 'div', 'eyebrow'))[0]));
  const h1 = findAll([intro], x => x.tag === 'h1')[0];
  const heroTitle = squash(brText(h1));
  const heroIntro = squash(textOf(findAll([intro], x => el(x, 'p', 'muted'))[0]));
  const badges = findAll([intro], x => el(x, 'span', 'badge')).map(b => squash(textOf(b)));
  const meta = squash(textOf(findAll([intro], x => x.tag === 'small')[0]));
  const module = cfg.module || '2.1';
  assert(eyebrow.startsWith(`Module ${module} · `) && eyebrow.endsWith(`Lesson ${n}`), `eyebrow ${n}`);
  assert(heroTitle.replace(/\.$/, '') === curriculum.names[n], `title ${n}: ${heroTitle}`);

  // Fields: DOM labels (with legacy " *" marker), placeholders, required flags.
  const fieldIds = cfg.fields.map(([id]) => id);
  const allIds = [...fieldIds, 'support', ...REFLECTION];
  assert(JSON.stringify([...fieldIds, ...REFLECTION]) === JSON.stringify(schema.ids), `schema ids ${n}`);
  assert(cfg.fields.length === 8, `eight fields ${n}`);
  const fields = allIds.map(id => {
    const control = byId(doc, id);
    assert(control && control.tag === 'textarea', `textarea ${id} in ${n}`);
    const label = findAll(doc, x => x.tag === 'label' && x.attrs.for === id)[0];
    const domLabel = squash(textOf(label));
    const required = schema.ids.includes(id);
    const base = required ? domLabel.replace(/ \*$/, '') : domLabel;
    assert(!required || domLabel.endsWith(' *'), `required marker ${id} ${n}`);
    const cfgField = cfg.fields.find(([f]) => f === id);
    if (cfgField) assert(cfgField[1] === base, `config label ${id} ${n}: ${cfgField[1]} vs ${base}`);
    const def = { id, label: base, kind: 'textarea', required, maxLength: Number(control.attrs.maxlength) || 2000 };
    if (control.attrs.placeholder) def.placeholder = control.attrs.placeholder;
    return def;
  });

  // Scenes, quiz, prompt.
  assert(cfg.scenes.length === 6, `six scenes ${n}`);
  const scenes = cfg.scenes.map(([title, visual, narration]) => ({ title, visual, narration }));
  const questions = cfg.questions.map(([prompt, options, answer, explanation]) => ({ prompt, options, answer, explanation }));
  assert(JSON.stringify(questions.map(q => q.answer)) === JSON.stringify(schema.keys), `quiz keys ${n}`);

  const reply = coach[n];
  const coachModes = [];
  const sections = [];
  const nav = [];
  const articles = findAll([section], x => el(x, 'article', 'step'));
  for (const article of articles) {
    const id = article.attrs.id;
    const children = kids(article);
    const label = squash(textOf(children.find(c => el(c, 'div', 'stepnum'))));
    const heading = squash(textOf(children.find(c => c.tag === 'h2')));
    const blocks = [];
    let pending = [];
    const flush = () => { blocks.push(...content(pending)); pending = []; };
    const push = block => { flush(); blocks.push(block); };
    let challengeFields = [];
    for (let i = 0; i < children.length; i++) {
      const c = children[i];
      if (typeof c === 'string') { pending.push(c); continue; }
      const cid = c.attrs.id;
      if (el(c, 'div', 'stepnum') || (c.tag === 'h2' && squash(textOf(c)) === heading && !blocks.length && !pending.length)) continue;
      if (['practiceFeedback', 'briefPreview', 'completionFeedback', 'quizFeedback', 'chat', 'coachQuestion'].includes(cid)) continue;
      if (el(c, 'div', 'video')) {
        const parts = kids(c);
        push({ type: 'video', title: squash(textOf(parts.find(x => x.tag === 'h3'))), subtitle: squash(textOf(parts.find(x => x.tag === 'p'))), note: squash(textOf(parts.find(x => x.tag === 'small'))) });
        continue;
      }
      if (c.tag === 'details') {
        const summary = squash(textOf(c.children.find(x => x.tag === 'summary')));
        if (byId([c], 'sceneTitle')) { push({ type: 'storyboard', scenes, summary, sceneMeta: `${sceneMeta[1]}{scene}${sceneMeta[2]}` }); continue; }
        if (byId([c], 'transcript')) { push({ type: 'transcript', scenes, summary }); continue; }
        if (byId([c], 'videoPrompt')) {
          const dl = /download\('([^']+)',prompt\)/.exec(findAll([c], x => (x.attrs.onclick || '').startsWith('download('))[0].attrs.onclick);
          push({ type: 'videoPrompt', prompt: cfg.prompt, filename: dl[1], summary });
          continue;
        }
      }
      if (el(c, 'label', 'check') && byId([c], 'studied')) { push({ type: 'studied', label: squash(textOf(c)) }); continue; }
      if (el(c, 'label', 'check') && byId([c], 'honest')) { push({ type: 'honest', label: squash(textOf(c)) }); continue; }
      if (c.tag === 'h3' && /^Practice:/.test(squash(textOf(c)))) {
        // Practice heading, optional question paragraph(s), then the three practice(i) buttons.
        let j = i + 1;
        const question = [];
        while (children[j] && children[j].tag === 'p') question.push(squash(textOf(children[j++])));
        const actions = children[j];
        assert(actions && el(actions, 'div', 'actions') && onclick(actions, 'practice('), `practice actions ${n}`);
        const buttons = findAll([actions], x => x.tag === 'button');
        assert(buttons.length === 3 && buttons.every((b, k) => b.attrs.onclick === `practice(${k})`), `practice buttons ${n}`);
        push({ type: 'practice', legend: squash(textOf(c)), prompt: question.join(' '), options: buttons.map((b, k) => ({ label: squash(textOf(b)), feedback: k === 1 ? practice[n].good : practice[n].other })) });
        i = j;
        continue;
      }
      if (cid === 'saveStatus') { push({ type: 'saveStatus' }); continue; }
      if (cid === 'profile') { push({ type: 'fields', ids: findAll([c], x => x.tag === 'textarea').map(x => x.attrs.id) }); continue; }
      if (el(c, 'div', 'field') && id === 'challenge') { flush(); challengeFields.push(findAll([c], x => x.tag === 'textarea')[0].attrs.id); if (!(children[i + 1] && el(children[i + 1], 'div', 'field'))) { blocks.push({ type: 'fields', ids: challengeFields }); challengeFields = []; } continue; }
      if (c.tag === 'button' && (c.attrs.onclick || '') === 'previewBrief()') {
        const exportButton = findAll([article], x => x.attrs.onclick === 'exportBrief()')[0];
        push({ type: 'deliverable', previewLabel: squash(textOf(c)), downloadLabel: squash(textOf(exportButton)) });
        continue;
      }
      if (el(c, 'div', 'actions') && onclick(c, 'exportBrief()')) {
        const resetButton = findAll([c], x => /resetDialog/.test(x.attrs.onclick || ''))[0];
        push({ type: 'reset', label: squash(textOf(resetButton)) });
        continue;
      }
      if (id === 'coach' && el(c, 'div', 'actions')) {
        for (const b of findAll([c], x => x.tag === 'button')) coachModes.push({ id: b.attrs['data-mode'], label: squash(textOf(b)) });
        continue;
      }
      if (id === 'coach' && c.tag === 'p' && !blocks.length) { pending.push(c); continue; }
      if (id === 'coach' && (c.tag === 'label' || c.tag === 'textarea' || c.tag === 'button')) continue;
      if (cid === 'quizForm') { push({ type: 'quiz' }); continue; }
      if (c.tag === 'button' && c.attrs.onclick === 'grade()') continue;
      if (cid === 'checklist') { push({ type: 'checklist' }); continue; }
      if (cid === 'complete') {
        push({ type: 'complete', label: `Mark Lesson ${n} complete locally`, completedLabel: `Lesson ${n} self-completed locally`,
          completedNotice: `${unquote(completedNoticeParts[1])}${n}${unquote(completedNoticeParts[2])}`, incompleteNotice });
        assert(squash(textOf(c)) === `Mark Lesson ${n} complete locally`, `complete label ${n}`);
        continue;
      }
      if (el(c, 'div', 'note') && byId([c], 'moduleStatus')) {
        const parts = kids(c);
        const code = module;
        const st = status.modules[code];
        assert(st && st.lessons.includes(n), `module status ${n}`);
        push({ type: 'extension', id: 'moduleNote', props: {
          heading: squash(textOf(parts.find(x => x.tag === 'h3'))),
          lessons: st.lessons, complete: st.complete, incomplete: st.incomplete,
          // render() rewrites #phaseCheckpoint only when current === 40; elsewhere (Lesson 39) its static text stays.
          notes: toContent(parts.filter(x => x.tag === 'p' && x.attrs.id !== 'moduleStatus' && !(n === 40 && x.attrs.id === 'phaseCheckpoint'))),
          ...(n === 40 ? { checkpoint: status.checkpoint } : {}),
        } });
        continue;
      }
      if (c.tag === 'p' && /^Next:/.test(squash(textOf(c)))) {
        if (n === 40) {
          // Legacy: "Next: Phase 03 · Build — planned preview only. Proceed is a scoped decision, not automatic launch authorisation."
          // Phase 3 is now available, so the obsolete "planned preview only" clause is replaced by real navigation; the caveat stays.
          const text = squash(textOf(c));
          const caveat = text.slice(text.indexOf('Proceed is'));
          assert(caveat.startsWith('Proceed is a scoped decision'), 'lesson 40 next caveat');
          push({ type: 'content', nodes: [{ tag: 'p', attrs: {}, children: [caveat] }] });
        } else {
          // Legacy Lessons 23/24 point their next button at Lesson 23 (a source bug); the framework `next` block always opens n + 1.
          assert(findAll([c], x => /^openLesson\(\d+\)$/.test(x.attrs.onclick || '')).length === 1, `next link ${n}`);
        }
        push({ type: 'next' });
        continue;
      }
      pending.push(c);
    }
    flush();
    if (id === 'coach') {
      const modes = coachModes.map(m => ({ ...m, response: reply.map ? reply.map[m.id] : m.id === 'review' ? reply.review : reply.other }));
      assert(modes.length === 4 && modes.every(m => m.response), `coach modes ${n}`);
      const insertAt = blocks.findIndex(b => b.type !== 'content');
      blocks.splice(insertAt < 0 ? blocks.length : insertAt, 0, { type: 'extension', id: 'coach', props: {
        modes, initial: 'teach', questionResponse: reply.map ? reply.map.question : reply.question,
        countIds: fieldIds,
        questionLabel: squash(textOf(findAll([article], x => x.tag === 'label' && x.attrs.for === 'coachQuestion')[0])),
        submitLabel: squash(textOf(findAll([article], x => x.attrs.onclick === "coach('question')")[0])),
      } });
    }
    if (id === 'finish') {
      const help = findAll([section], x => el(x, 'p', 'help'))[0];
      blocks.splice(blocks.findIndex(b => b.type === 'next'), 0, { type: 'content', nodes: toContent([help]) });
    }
    sections.push({ id, label, heading, blocks });
  }
  for (const a of findAll([section], x => el(x, 'div', 'links'))[0].children.filter(x => x.tag === 'a')) nav.push({ id: a.attrs.href.slice(1), label: squash(textOf(a)).replace(/^\d+\s+/, '') });

  const [cStudied, cFields, cReflection, cQuiz, cHonest] = status.checklist;
  const lesson = {
    number: n, phase: 2, module, title: curriculum.names[n],
    hero: { eyebrow, title: heroTitle, intro: heroIntro, badges, meta },
    fields, questions,
    checklist: [
      { kind: 'studied', label: cStudied },
      { kind: 'fields', label: cFields, ids: fieldIds },
      { kind: 'fields', label: cReflection, ids: REFLECTION },
      { kind: 'quiz', label: cQuiz },
      { kind: 'honest', label: cHonest },
    ],
    deliverable: {
      title: `LYNQ Academy — ${cfg.deliverable}`, filename: cfg.filename,
      headerLines: ['Phase 02 · Module {module} · Lesson {lesson}', 'Status: {status}'],
      fieldIds, footer: exportFooter, previewFooter,
    },
    sections, nav,
  };
  // Every legacy element of interest must have been mapped.
  const blockTypes = sections.flatMap(s => s.blocks.map(b => b.type === 'extension' ? b.id : b.type));
  for (const t of ['video', 'storyboard', 'transcript', 'videoPrompt', 'studied', 'practice', 'saveStatus', 'fields', 'deliverable', 'reset', 'coach', 'quiz', 'checklist', 'honest', 'complete', 'moduleNote', 'next']) assert(blockTypes.includes(t), `block ${t} in ${n}`);
  return lesson;
}

// ---------- dashboard ----------
function convertDashboard(lessons) {
  const doc = parseHtml(legacyBody(2));
  const dash = byId(doc, 'dashboard');
  const children = kids(dash);
  const eyebrow = squash(textOf(children.find(c => el(c, 'div', 'eyebrow'))));
  const title = squash(brText(children.find(c => c.tag === 'h1')));
  const intro = squash(textOf(children.find(c => el(c, 'p', 'muted'))));
  const modules = findAll([dash], x => el(x, 'article', 'module')).map(m => {
    const [code, name] = squash(textOf(m.children.find(x => x.tag === 'header').children.find(x => x.tag === 'h3'))).split(' · ');
    const st = status.modules[code];
    return {
      code, title: name,
      lessons: findAll([m], x => el(x, 'button', 'lessonrow')).map(b => {
        const number = Number(b.attrs['data-number']);
        const lesson = lessons.find(l => l.number === number);
        assert(squash(textOf(b.children.filter(x => typeof x !== 'string')[1])) === lesson.title, `dashboard title ${number}`);
        return { number, title: lesson.title, summary: lesson.hero.intro };
      }),
      _status: { complete: st.complete, incomplete: st.incomplete.replace(/^\{count\} \/ 5 lessons self-completed locally\. /, '') },
    };
  });
  const moduleStatus = Object.fromEntries(modules.map(m => [m.code, m._status]));
  for (const m of modules) delete m._status;
  const stats = findAll([dash], x => el(x, 'div', 'stat')).filter(s => !findAll([s], x => x.attrs.id === 'phaseCount').length);
  const roadmapAt = children.findIndex(c => c.tag === 'h2');
  const sections = [
    { heading: 'Validate overview', nodes: [
      { tag: 'div', attrs: { class: 'actions' }, children: [{ tag: 'phase-link', attrs: { phase: '1', class: 'secondary' }, children: [squash(textOf(findAll([dash], x => x.tag === 'a' && /academyDiscover/.test(x.attrs.onclick || ''))[0]))] }] },
      { tag: 'div', attrs: { class: 'grid3' }, children: toContent(stats) },
    ] },
    { heading: squash(textOf(children[roadmapAt])), nodes: toContent([children[roadmapAt + 1]]) },
    ...findAll([dash], x => el(x, 'div', 'note')).map(note => ({ heading: squash(textOf(note.children.find(x => x.tag === 'h3'))), nodes: toContent(note.children.filter(x => typeof x === 'string' || x.tag !== 'h3')) })),
  ];
  return { phase: 2, title: eyebrow, hero: { eyebrow, title, intro }, modules, sections, moduleStatus, phaseStatus: status.checkpoint };
}

const lessons = LESSONS.map(convertLesson);
const staleUsed = new Set();
const correctedLessons = lessons.map(l => correctStale(l, STALE_TABLE[2], staleUsed));
const dashboard = correctStale(convertDashboard(lessons), STALE_TABLE[2], staleUsed);
assertCorrectionsUsed(STALE_TABLE[2], staleUsed);
const write = (path, data) => { const url = new URL(path, root); mkdirSync(new URL('.', url), { recursive: true }); writeFileSync(url, `${JSON.stringify(data, null, 2)}\n`); };
const only = process.argv.includes('--check') ? null : true;
if (only) {
  for (const lesson of correctedLessons) write(`src/data/lessons/phase-2/lesson-${lesson.number}.json`, lesson);
  write('src/data/dashboards/phase-2.json', dashboard);
}
console.log(`Phase 2: ${lessons.length} lessons and dashboard ${only ? 'written' : 'checked'}.`);
