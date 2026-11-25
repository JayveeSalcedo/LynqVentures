// Phase 1 (Discover) migration: parity with the legacy document and curriculum, native rendering,
// state contract, Lesson 01 (formerly the dedicated React page) and the pure Discover logic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { load, memoryStorage } from './helpers/bundle.mjs';
import { corrected } from './migration/stale-corrections.mjs';
import { legacyScript, legacyBody, jsonConst, literalConst, parseHtml, findAll, textOf } from './migration/legacy.mjs';

const curriculum = JSON.parse(readFileSync(new URL('../src/data/curriculum.json', import.meta.url)));
const js = legacyScript(1);
const configs = literalConst(js, 'configs');
const templates = jsonConst(js, 'templates');
const prompts = literalConst(js, 'prompts');
const legacyModules = literalConst(js, 'modules');
const state = await load('src/lesson-system/state.ts');
const logic = await load('src/phases/phase1/logic.ts');
const { LessonView } = await load('src/lesson-system/LessonPage.tsx');
const { DashboardView } = await load('src/lesson-system/PhaseDashboard.tsx');
const phase1 = (await load('src/phases/phase1/index.ts')).default;
const lessons = {};
for (let n = 1; n <= 20; n++) lessons[n] = await phase1.loadLesson(n);
const dashboard = await phase1.loadDashboard();

const pad = n => String(n).padStart(2, '0');
const schema = n => curriculum.schemas[n];
const blocks = lesson => lesson.sections.flatMap(s => s.blocks);
const ofType = (lesson, type, id) => blocks(lesson).filter(b => b.type === type && (!id || b.id === id));
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const full = n => ({ ...state.blankState(), fields: Object.fromEntries(schema(n).ids.map(id => [id, `Answer ${id}`])), answers: Object.fromEntries(schema(n).keys.map((k, i) => [i, k])), studied: true, honest: true });
const FOOTER = corrected(1, 'Local prototype export. No reviewer submission or business validation.');
const legacyLabels = n => Object.fromEntries(findAll(parseHtml(templates[n]), x => x.tag === 'label' && x.attrs.for && x.attrs.for !== 'coachQuestion' && x.attrs.for !== 'videoPrompt').map(l => [l.attrs.for, textOf(l)]));

function withStorage(initial, fn) {
  const old = globalThis.localStorage;
  globalThis.localStorage = memoryStorage(initial);
  try { return fn(globalThis.localStorage); } finally { globalThis.localStorage = old; }
}
const render = (n, initial = {}) => withStorage(initial, () => renderToString(createElement(LessonView, { lesson: lessons[n], module: phase1, navigate() {}, onProgress() {} })).replace(/<!-- -->/g, ''));

test('status lists all twenty lessons and the native dashboard', () => {
  assert.equal(phase1.revokeOnAnyEdit, false, 'legacy save() only revokes invalid completions');
});

test('all 20 lessons match the curriculum and the legacy configs, labels, quiz and scenes', () => {
  for (let n = 1; n <= 20; n++) {
    const lesson = lessons[n], s = schema(n), config = configs[n];
    assert.equal(lesson.number, n); assert.equal(lesson.phase, 1); assert.equal(lesson.title, curriculum.names[n]);
    assert.equal(s.key, `lynq.discover.lesson${pad(n)}.v1`);
    assert.equal(lesson.module, config.module || '1.1');
    assert.deepEqual(lesson.fields.map(f => f.id), config.ids, `field order ${n}`);
    assert.deepEqual(lesson.fields.filter(f => f.required).map(f => f.id).sort(), [...s.ids].sort(), `required ${n}`);
    assert.deepEqual(config.ids.filter(id => id !== 'support').sort(), [...s.ids].sort());
    const labels = legacyLabels(n);
    assert.deepEqual(Object.keys(labels).sort(), [...config.ids].sort(), `legacy label ids ${n}`);
    for (const f of lesson.fields) {
      assert.equal(f.label, labels[f.id].replace(/ \*$/, ''), `label ${n}/${f.id}`);
      assert.equal(labels[f.id].endsWith(' *'), f.required, `required marker ${n}/${f.id}`);
      const control = findAll(parseHtml(templates[n]), x => x.attrs.id === f.id)[0];
      assert.equal(f.kind === 'input' ? 'input' : f.kind, control.tag, `kind ${n}/${f.id}`);
      assert.equal(f.placeholder, control.attrs.placeholder ?? undefined, `placeholder ${n}/${f.id}`);
      if (f.kind === 'select') assert.deepEqual(f.options.map(o => o.label), findAll([control], x => x.tag === 'option').map(textOf));
      assert.ok(ofType(lesson, 'fields').some(b => b.ids.includes(f.id)) || ofType(lesson, 'extension', 'fieldGroup').some(b => b.props.ids.includes(f.id)), `field rendered ${n}/${f.id}`);
    }
    const questions = literalConst(js, `questions${n}`);
    assert.deepEqual(lesson.questions.map(q => [q.prompt, q.options, q.answer, q.explanation]), questions, `quiz ${n}`);
    assert.deepEqual(lesson.questions.map(q => q.answer), s.keys);
    const scenes = literalConst(js, `scenes${n}`).map(([title, visual, narration]) => ({ title, visual, narration }));
    for (const b of [...ofType(lesson, 'storyboard'), ...ofType(lesson, 'transcript')]) assert.deepEqual(b.scenes, scenes, `scenes ${n}`);
    assert.equal(ofType(lesson, 'storyboard').length, 1); assert.equal(ofType(lesson, 'transcript').length, 1);
    const prompt = ofType(lesson, 'videoPrompt');
    if (n === 1) assert.equal(prompt.length, 0, 'Lesson 01 has no Gemini prompt in the source');
    else { assert.equal(prompt[0].prompt, corrected(1, prompts[n])); assert.equal(prompt[0].filename, `LYNQ-Lesson-${pad(n)}-Gemini-Video-Prompt.md`); }
    assert.equal(lesson.deliverable.filename, config.filename);
    assert.equal(lesson.deliverable.title, `LYNQ Academy — ${config.deliverable}`);
    assert.equal(ofType(lesson, 'flag').length, 0, `no completion flags in ${n}`);
    assert.ok(!s.artifact && !s.releaseAck);
    for (const type of ['studied', 'honest', 'quiz', 'checklist', 'complete', 'saveStatus', 'reset']) assert.equal(ofType(lesson, type).length, 1, `${type} in ${n}`);
    // Lesson 05 links onward from its starter-pack note ("Begin Lesson 06 →"), as in the source.
    assert.equal(ofType(lesson, 'next').length, n === 5 ? 0 : 1, `next in ${n}`);
    const complete = ofType(lesson, 'complete')[0];
    assert.equal(complete.label, `Mark Lesson ${pad(n)} complete locally`);
    assert.match(complete.completedNotice, new RegExp(`^Lesson ${pad(n)} self-completed locally\\. Download your .+\\. No reviewer approval or venture validation is recorded\\.$`));
    assert.equal(lesson.checklist[0].label, n === 1 ? 'Storyboard or transcript reviewed' : 'Transcript or learning guide reviewed');
    assert.equal(lesson.checklist[1].label, `${config.deliverable} fields complete`);
    assert.deepEqual(lesson.checklist[1].ids, config.profileIds);
    assert.deepEqual(lesson.sections.map(s => s.label.replace('&amp;', '&')), findAll(parseHtml(templates[n]), x => x.attrs.class === 'stepnum').map(textOf));
    assert.equal(lesson.hero.eyebrow.endsWith(`Lesson ${pad(n)}`), true);
  }
});

test('scripted coach, practice feedback and previews are copied from the legacy functions', () => {
  const coachSrc = js.slice(js.indexOf('function coachReply('), js.indexOf('function decision('));
  const decisionSrc = js.slice(js.indexOf('function decision('), js.indexOf('function showPurpose('));
  for (let n = 1; n <= 20; n++) {
    const coach = ofType(lessons[n], 'extension', 'coach');
    assert.equal(coach.length, 1);
    const p = coach[0].props;
    assert.deepEqual(p.modes.map(m => m.label), ['Teach me', 'Guide me', 'Review my work', 'Challenge my idea']);
    // Replies are concatenations of legacy literals; every sentence must appear in coachReply().
    for (const reply of Object.values(p.replies)) for (const piece of reply.split(/\{missing\}|\n|(?<=\. )/)) if (piece.trim()) assert.ok(coachSrc.includes(piece), `coach text ${n}: ${piece.slice(0, 40)}`);
    assert.equal('reviewIncomplete' in p.replies, n <= 9, `profileValid branch ${n}`);
    const practice = ofType(lessons[n], 'practice');
    assert.equal(practice.length, n === 1 ? 0 : 1);
    if (n > 1) {
      assert.equal(practice[0].options.length, 3);
      for (const o of practice[0].options) assert.ok(decisionSrc.includes(o.feedback), `practice feedback ${n}`);
      assert.notEqual(practice[0].options[1].feedback, practice[0].options[0].feedback);
      assert.equal(practice[0].options[0].feedback, practice[0].options[2].feedback);
      assert.ok(templates[n].includes(`onclick="decision(1)">${practice[0].options[1].label}</button>`));
    }
    const preview = ofType(lessons[n], 'extension', 'preview');
    assert.equal(preview.length, n <= 2 ? 0 : 1, `preview ${n}`);
    if (n >= 10) for (const line of preview[0].props.lines) assert.equal(line.label, legacyLabels(n)[line.id]);
    if (n >= 3 && n <= 9 && n !== 6) for (const line of preview[0].props.lines) assert.ok(js.includes(`${line.label}: '`) || js.includes(`['${line.id}','${line.label}']`) || /^Week \d$/.test(line.label), `preview label ${n}`);
  }
});

test('every lesson renders natively: title, labels, quiz prompts, tools; no iframe, script or missing tool', () => {
  for (let n = 1; n <= 20; n++) {
    const html = render(n);
    assert.doesNotMatch(html, /<iframe|<script|Missing lesson tool/i, `lesson ${n}`);
    assert.ok(html.includes(esc(lessons[n].hero.title)), `title ${n}`);
    for (const f of lessons[n].fields) assert.ok(html.includes(esc(f.label)), `label ${n}/${f.id}`);
    for (const q of lessons[n].questions) assert.ok(html.includes(esc(q.prompt)), `question ${n}`);
    // The scripted coach is replaced by the live AI Coach, whose buttons are the lesson's authored modes.
    assert.ok(html.includes('AI Coach') && html.includes('Teach me') && !html.includes('SCRIPTED DEMO'), `coach ${n}`);
    assert.ok(html.includes(`Mark Lesson ${pad(n)} complete locally`));
    assert.ok(html.includes(esc(ofType(lessons[n], 'extension', 'download')[0].props.label)), `download ${n}`);
    assert.match(html, n === 5 ? /Begin Lesson 06 →/ : n < 20 ? new RegExp(`Lesson ${pad(n + 1)} — `) : /Lesson 21 — /);
  }
  const six = render(6);
  for (const i of [1, 2, 3]) assert.ok(six.includes(`Journal entry ${i}`));
  assert.equal((six.match(/<(input|textarea|select)[^>]*id="entry\d\w+"/g) ?? []).length, 24, 'all 24 journal inputs');
  assert.doesNotMatch(six, /Lessons 08–10 remain planned content/);
  assert.doesNotMatch(render(20), /Phase 02 lessons are not built or connected/);
  assert.match(render(5), /0 \/ 5 lessons self-completed\. Complete or review the remaining Module 1\.1 work/);
});

test('Discover dashboard renders natively with modules, all 20 lessons and the checkpoint guidance', () => {
  assert.equal(dashboard.phase, 1);
  assert.equal(dashboard.hero.title, 'Great ventures start with better questions.');
  assert.deepEqual(dashboard.modules.map(m => [m.code, m.title, m.summary]), legacyModules.map(m => [m[0], m[1], m[2]]));
  assert.deepEqual(dashboard.modules.flatMap(m => m.lessons.map(l => [l.number, l.title, l.summary])), legacyModules.flatMap(m => m[3]).map((l, i) => [i + 1, l[0], l[1]]));
  const html = withStorage({}, () => renderToString(createElement(DashboardView, { dashboard, navigate() {}, progress: { complete: [1, 2], orientation: true } }))).replace(/<!-- -->/g, '');
  assert.doesNotMatch(html, /<iframe|<script/);
  for (let n = 1; n <= 20; n++) assert.ok(html.includes(esc(curriculum.names[n])), `lesson ${n}`);
  assert.match(html, /2 \/ 20/); assert.match(html, /Continue with Lesson 03/);
  assert.ok(html.includes('Is this problem worth exploring further?'));
  assert.ok(html.includes('Opportunity Brief'));
  assert.doesNotMatch(html, /This prototype includes/);
  assert.ok(legacyBody(1).includes('Great ventures start<br>with better questions.'));
});

test('normalizeExtra and normalizeState tolerate malformed saved data and keep valid core data', () => {
  const norm = raw => state.normalizeState(raw, extra => phase1.normalizeExtra(6, extra));
  for (const raw of [null, 'x', 7, [], { fields: 'no', answers: [1] }]) assert.deepEqual(norm(raw), state.blankState());
  const s = norm({ fields: { entry1context: 'Venue', entry1people: 4, pattern: null }, answers: { 0: '1', 1: 'x', 2: -2 }, studied: true, honest: 'yes', completed: true, rows: [1, 2, 3], extra: { a: 1 } });
  assert.deepEqual(s.fields, { entry1context: 'Venue' });
  assert.deepEqual(s.answers, { 0: 1 });
  assert.equal(s.studied, true); assert.equal(s.honest, false); assert.equal(s.completed, true);
  assert.equal('rows' in s, false, 'legacy loadState() keeps only the core record');
  assert.equal(state.isComplete(s, schema(6)), false, 'saved completion is re-validated');
});

test('Lesson 01: legacy drafts normalise, key/fields/quiz match, optional support, completion contract', () => {
  const n = 1, s = schema(1), lesson = lessons[1];
  assert.equal(s.key, 'lynq.discover.lesson01.v1');
  assert.deepEqual(lesson.fields.map(f => f.id), ['name', 'stage', 'why', 'strengths', 'people', 'problem', 'hours', 'goal', 'support', 'assumption', 'evidence', 'constraint']);
  assert.equal(lesson.fields.find(f => f.id === 'support').required, false);
  assert.equal(lesson.fields.find(f => f.id === 'name').maxLength, 100);
  assert.deepEqual(lesson.fields.find(f => f.id === 'hours').options.map(o => o.value), ['', '1–2 hours', '3–5 hours', '6–10 hours', 'More than 10 hours']);
  assert.deepEqual(lesson.questions.map(q => q.answer), [1, 1, 2]);
  // Legacy draft written by the previous React page / iframe.
  const draft = state.normalizeState({ fields: { name: 'Alias', why: 42 }, answers: { 0: '1', 1: null, 2: '' }, studied: 'true', honest: true, completed: 1 }, extra => phase1.normalizeExtra(1, extra));
  assert.deepEqual(draft.fields, { name: 'Alias' }); assert.deepEqual(draft.answers, { 0: 1 });
  assert.equal(draft.studied, false); assert.equal(draft.completed, false);
  // Required fields, quiz, study and self-review gate completion; support is optional.
  assert.equal(state.requirementsMet(full(n), s), true);
  assert.equal(full(n).fields.support, undefined);
  for (const id of s.ids) assert.equal(state.requirementsMet({ ...full(n), fields: { ...full(n).fields, [id]: '  ' } }, s), false, id);
  for (const patch of [{ studied: false }, { honest: false }, { answers: { 0: 0, 1: 1, 2: 2 } }, { answers: {} }]) assert.equal(state.requirementsMet({ ...full(n), ...patch }, s), false);
  // Explicit completion; revoked only by invalidating edits.
  const done = state.markComplete(full(n), s);
  assert.equal(state.applyEdit(full(n), { honest: true }, s, phase1.revokeOnAnyEdit).completed, false, 'edits never complete');
  assert.equal(state.applyEdit(done, { fields: { ...done.fields, name: 'Updated alias' } }, s, phase1.revokeOnAnyEdit).completed, true);
  assert.equal(state.applyEdit(done, { fields: { ...done.fields, support: 'Time' } }, s, phase1.revokeOnAnyEdit).completed, true);
  assert.equal(state.applyEdit(done, { fields: { ...done.fields, name: '' } }, s, phase1.revokeOnAnyEdit).completed, false);
  assert.equal(state.applyEdit(done, { answers: { ...done.answers, 2: 0 } }, s, phase1.revokeOnAnyEdit).completed, false);
  // Saved draft is rendered back into the page; clear-draft dialog and Founder Profile preview/download exist.
  const html = render(1, { [s.key]: JSON.stringify({ ...full(1), fields: { ...full(1).fields, name: 'Layla' }, completed: true }) });
  assert.ok(html.includes('value="Layla"'));
  assert.match(html, /Self-completed locally/);
  for (const text of ['Clear local draft', 'Preview my brief', 'Download Founder Profile', 'What help or constraint should you plan for?', 'More questions to discuss', 'Which belief about yourself or the problem might be wrong?']) assert.ok(html.includes(text), text);
});

test('Lesson 01 Founder Profile export keeps the legacy Markdown format and filename', () => {
  const lesson = lessons[1];
  const s = { ...full(1), fields: { ...full(1).fields, name: 'Layla', support: '   ' } };
  const md = logic.buildDeliverable(lesson, s, true, new Date('2026-01-02T03:04:05Z'));
  assert.equal(lesson.deliverable.filename, 'LYNQ-Founder-Profile.md');
  assert.ok(md.startsWith('# LYNQ Academy — Founder Profile\n\nPhase 01 · Module 1.1 · Lesson 01\nStatus: Self-completed locally\nCreated: 2026-01-02T03:04:05.000Z\n\n## Preferred name\nLayla\n\n## Your starting point\nAnswer stage\n\n'));
  assert.ok(md.includes('## What help or constraint should you plan for?\n   \n\n'), 'legacy writes entered values verbatim');
  assert.ok(md.endsWith(`## If you only had half the time, what would you still do?\nAnswer constraint\n\n${FOOTER}\n`));
  assert.match(logic.buildDeliverable(lesson, state.blankState(), false), /Status: Draft[\s\S]*## Preferred name\nNot entered/);
});

test('every lesson exports its deliverable with title, status, every field and the caveat footer', () => {
  for (let n = 1; n <= 20; n++) {
    const lesson = lessons[n];
    const md = phase1.buildDeliverable(lesson, { ...full(n), fields: { ...full(n).fields, support: '' } }, false);
    assert.ok(md.startsWith(`# LYNQ Academy — ${configs[n].deliverable}\n\nPhase 01 · Module ${configs[n].module || '1.1'} · Lesson ${pad(n)}\nStatus: Draft\nCreated: `), `header ${n}`);
    const labels = legacyLabels(n);
    for (const id of configs[n].ids) assert.ok(md.includes(`## ${labels[id].replace(' *', '')}\n${id === 'support' ? 'Not entered' : `Answer ${id}`}\n\n`), `field ${n}/${id}`);
    assert.ok(md.endsWith(`${FOOTER}\n`));
    assert.match(lesson.deliverable.filename, /^LYNQ-[\w-]+\.md$/);
  }
});

test('coach output: missing count, profile branch and question note', () => {
  const p = ofType(lessons[3], 'extension', 'coach')[0].props;
  const blank = state.blankState();
  const out = logic.coachOutput(3, p, blank, 'review', false);
  assert.ok(out.startsWith(`SCRIPTED DEMO / REVIEW\n\nPurpose & Learning Plan check: ${schema(3).ids.length} required fields still empty. Complete your purpose`));
  const profileOnly = { ...blank, fields: Object.fromEntries(logic.profileIds(3).map(id => [id, 'x'])) };
  assert.match(logic.coachOutput(3, p, profileOnly, 'review', false), /check: 3 required fields still empty\. All eight plan entries are present/);
  assert.match(logic.coachOutput(3, p, full(3), 'review', true), /0 required fields still empty[\s\S]*\n\nYour question was entered locally\. This preview does not generate a custom answer\.$/);
  assert.equal(logic.coachOutput(3, p, blank, 'teach', false), `SCRIPTED DEMO / TEACH\n\n${p.replies.teach}`);
  assert.ok(logic.coachOutput(3, p, blank, 'unknown', false).startsWith('SCRIPTED DEMO / TEACH'));
  const p12 = ofType(lessons[12], 'extension', 'coach')[0].props;
  assert.match(logic.coachOutput(12, p12, { ...blank, fields: { context: 'a', support: 'b' } }, 'review', false), /Journey Map check: 10 required fields still empty\. This scripted check counts fields only/);
  assert.ok(logic.profileIds(20).includes('handoff'));
});

test('artifact previews reproduce the legacy show*() text', () => {
  const pv = n => ofType(lessons[n], 'extension', 'preview')[0].props;
  assert.equal(logic.previewText(pv(3), { ...state.blankState(), fields: { purpose: '  Help visitors  ', habit: '' } }),
    'My working purpose: Help visitors\nPeople I want to understand: Not yet entered\nMy learning habit: Not yet entered\nMy boundary and review point: Not yet entered');
  assert.match(logic.previewText(pv(5), state.blankState()), /^My learning commitment: Not yet entered\nSchedule and boundary: Not yet entered\nWeek 1: Not yet entered\nWeek 2[\s\S]*\nFallback: Not yet entered$/);
  const journal = logic.previewText(pv(6), { ...state.blankState(), fields: { entry1source: 'Observed firsthand', entry1context: 'Venue entrance', pattern: 'No pattern yet' } });
  assert.ok(journal.startsWith('Entry 1 — Observed firsthand\ncontext: Venue entrance\npeople: Not yet entered\n'));
  assert.ok(journal.includes('\n\nEntry 2 — Source not chosen\ncontext: Not yet entered'));
  assert.ok(journal.endsWith('\n\nTentative pattern / next check: No pattern yet\n\nSource labels are learner-provided. Planned entries are not collected evidence.'));
  assert.match(logic.previewText(pv(7), state.blankState()), /^Problem clue \/ source: Not yet entered\n\nAffected group hypothesis[\s\S]*\n\nThis map is exploratory\. Learner statements are not verified demand or buyer commitment\.$/);
  assert.ok(logic.previewText(pv(18), state.blankState()).endsWith('\n\nThis assessment does not prove demand, predict success or grant permission. No total score is calculated.'));
  assert.ok(logic.previewText(pv(10), { ...state.blankState(), fields: { candidatea: 'Queue' } }).startsWith('Candidate A: person, task, context and evidence status *: Queue\n\n'));
});

test('module and Discover pack status lines follow saved completions', () => {
  const note = n => ofType(lessons[n], 'extension', 'moduleNote')[0].props.parts.filter(p => 'status' in p);
  const [m12] = note(6);
  assert.equal(logic.statusText(m12, [1, 6, 7]), '2 / 5 lessons self-completed locally. Complete each separately to finish this learning module.');
  assert.equal(logic.statusText(m12, [6, 7, 8, 9, 10]), 'All five lessons self-completed locally. Module 1.2 learning pack complete; no validation, certification or approval is implied.');
  const [, pack] = note(20);
  assert.equal(logic.statusText(pack, []), '0 / 20 lessons self-completed locally. Finish the remaining learning work before calling Discover complete.');
  assert.equal(logic.statusText(pack, Array.from({ length: 20 }, (_, i) => i + 1)), '20 / 20 lessons self-completed locally. Discover learning pack complete; this is not venture validation.');
  for (const n of [1, 2, 3, 4]) assert.equal(ofType(lessons[n], 'extension', 'moduleNote').length, 0);
  // Rendered from validated saved records: a stale completed flag does not count.
  const saved = Object.fromEntries([6, 7].map(n => [schema(n).key, JSON.stringify({ ...full(n), completed: true })]));
  saved[schema(8).key] = JSON.stringify({ ...full(8), completed: true, honest: false });
  assert.match(render(9, saved), /2 \/ 5 lessons self-completed locally/);
});

test('curriculum text is carried over in full (every paragraph, list item, heading and summary)', () => {
  const decode = html => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ');
  const dropped = ['Lessons 08–10 remain planned content.', 'Phase 02 lessons are not built or connected in this prototype.'];
  for (let n = 1; n <= 20; n++) {
    const text = decode(render(n));
    const nodes = findAll(parseHtml(templates[n]), x => x.tag === 'article');
    for (const node of findAll(nodes, x => ['p', 'li', 'h3', 'summary', 'small', 'b'].includes(x.tag) && !x.attrs.id)) {
      const flat = x => typeof x === 'string' ? x : x.tag === 'br' ? ' ' : x.children.map(flat).join('');
      let t = flat(node).replace(/\s+/g, ' ').trim();
      for (const d of dropped) t = t.replace(d, '').trim();
      t = corrected(1, t);
      // Video-generation prompts are production tools, hidden from learners by default.
      if (!t || /^Next:/.test(t) || /Gemini video prompt/.test(t)) continue;
      // Scripted-coach disclaimers are replaced by the live AI Coach.
      if (/scripted guidance modes|Responses are predefined|Simulated Coach/.test(t)) continue;
      assert.ok(text.includes(t) || text.replace(/ /g, '').includes(t.replace(/ /g, '')), `lesson ${n}: ${t.slice(0, 60)}`);
    }
  }
});
