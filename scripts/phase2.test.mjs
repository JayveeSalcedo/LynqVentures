// Phase 2 (Validate, Lessons 21–40) migration tests: parity with the legacy document and
// curriculum, native rendering, state handling, scripted coach/practice and deliverables.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { load, memoryStorage } from './helpers/bundle.mjs';
import { legacyBody, legacyScript, jsonConst, decode } from './migration/legacy.mjs';
import { correctedDeep } from './migration/stale-corrections.mjs';

const curriculum = JSON.parse(readFileSync(new URL('../src/data/curriculum.json', import.meta.url)));
const js = legacyScript(2);
const configs = correctedDeep(2, jsonConst(js, 'configs'));
const templates = correctedDeep(2, jsonConst(js, 'templates'));
const LESSONS = Array.from({ length: 20 }, (_, i) => 21 + i);
const REFLECTION = ['bias', 'counter', 'constraint'];
const lessonJson = n => JSON.parse(readFileSync(new URL(`../src/data/lessons/phase-2/lesson-${n}.json`, import.meta.url)));
const lessons = Object.fromEntries(LESSONS.map(n => [n, lessonJson(n)]));
const dashboard = JSON.parse(readFileSync(new URL('../src/data/dashboards/phase-2.json', import.meta.url)));
const schema = n => curriculum.schemas[String(n)];
const domLabel = (n, id) => decode(new RegExp(`<label for="${id}">([^<]*)</label>`).exec(templates[n])[1]);
const blocks = (lesson, type) => lesson.sections.flatMap(s => s.blocks).filter(b => b.type === type || b.type === 'extension' && b.id === type);
const fnSource = name => { const a = js.indexOf(`function ${name}(`); return js.slice(a, js.indexOf('function ', a + 9)); };

const state = await load('src/lesson-system/state.ts');
const deliverable = await load('src/lesson-system/deliverable.ts');
const logic = await load('src/phases/phase2/phase2.logic.ts');
const phase2 = (await load('src/phases/phase2/index.ts')).default;
const full = n => ({ ...state.blankState(), fields: Object.fromEntries(schema(n).ids.map(id => [id, `Answer ${id}`])), answers: Object.fromEntries(schema(n).keys.map((k, i) => [i, k])), studied: true, honest: true });

async function withStorage(initial, fn) {
  const old = globalThis.localStorage;
  globalThis.localStorage = memoryStorage(initial);
  try { return await fn(); } finally { globalThis.localStorage = old; }
}

test('phase module: lazy lesson/dashboard loading, revocation rule and extensions', async () => {
  assert.equal(phase2.phase, 2);
  assert.equal(phase2.revokeOnAnyEdit, false);
  assert.match(fnSource('save'), /if\(state\.completed&&!criteria\(\)\.every\(Boolean\)\)state\.completed=false/, 'legacy save() only revokes when criteria fail');
  for (const n of [21, 30, 40]) assert.deepEqual(await phase2.loadLesson(n), lessons[n]);
  assert.deepEqual(await phase2.loadDashboard(), dashboard);
  assert.deepEqual(Object.keys(phase2.extensions).sort(), ['coach', 'moduleNote']);
});

test('parity with curriculum.json and the legacy document for all 20 lessons', () => {
  for (const n of LESSONS) {
    const l = lessons[n], cfg = configs[n], s = schema(n);
    assert.equal(l.number, n); assert.equal(l.phase, 2); assert.equal(s.phase, 2);
    assert.equal(l.title, curriculum.names[n], `title ${n}`);
    assert.ok(l.hero.title.startsWith(curriculum.names[n]), `hero title ${n}`);
    assert.equal(s.key, `lynq.validate.lesson${n}.v1`, `storage key ${n}`);
    assert.equal(l.module, cfg.module || '2.1');
    assert.ok(l.hero.eyebrow.endsWith(`Lesson ${n}`));
    // Fields: legacy order, labels, placeholders, required set.
    const ids = [...cfg.fields.map(([id]) => id), 'support', ...REFLECTION];
    assert.deepEqual(l.fields.map(f => f.id), ids, `field ids ${n}`);
    assert.deepEqual(l.fields.filter(f => f.required).map(f => f.id).sort(), [...s.ids].sort(), `required ${n}`);
    assert.equal(l.fields.find(f => f.id === 'support').required, false);
    for (const [id, label] of cfg.fields) assert.equal(l.fields.find(f => f.id === id).label, label, `${n} ${id}`);
    for (const f of l.fields) {
      assert.equal(`${f.label}${f.required ? ' *' : ''}`, domLabel(n, f.id), `DOM label ${n} ${f.id}`);
      assert.equal(f.kind, 'textarea');
      const ph = new RegExp(`<textarea id="${f.id}"[^>]*?placeholder="([^"]*)"`).exec(templates[n]);
      assert.equal(f.placeholder, ph ? decode(ph[1]) : undefined, `placeholder ${n} ${f.id}`);
    }
    // Quiz.
    assert.deepEqual(l.questions, cfg.questions.map(([prompt, options, answer, explanation]) => ({ prompt, options, answer, explanation })));
    assert.deepEqual(l.questions.map(q => q.answer), s.keys);
    // Scenes, prompt, prompt filename.
    const scenes = cfg.scenes.map(([title, visual, narration]) => ({ title, visual, narration }));
    assert.equal(scenes.length, 6);
    assert.deepEqual(blocks(l, 'storyboard')[0].scenes, scenes);
    assert.deepEqual(blocks(l, 'transcript')[0].scenes, scenes);
    assert.equal(blocks(l, 'storyboard')[0].sceneMeta, 'Planned scene {scene} · about 25 seconds in final edit');
    const vp = blocks(l, 'videoPrompt')[0];
    assert.equal(vp.prompt, cfg.prompt);
    assert.equal(vp.filename, `LYNQ-Lesson-${n}-Gemini-Video-Prompt.md`);
    assert.ok(templates[n].includes(`download('${vp.filename}',prompt)`));
    // Deliverable.
    assert.equal(l.deliverable.filename, cfg.filename);
    assert.equal(l.deliverable.title, `LYNQ Academy — ${cfg.deliverable}`);
    assert.deepEqual(l.deliverable.fieldIds, cfg.fields.map(([id]) => id));
    // Flags: none in Phase 2.
    assert.equal(s.artifact, false); assert.equal(s.releaseAck, false);
    assert.equal(blocks(l, 'flag').length, 0);
    // Checklist wording and contract.
    assert.deepEqual(l.checklist.map(c => c.label), ['Storyboard/transcript reviewed', 'Eight worksheet fields complete', 'Three red-team reflections complete', 'Quiz 3 / 3 correct', 'Final self-review confirmed']);
    assert.deepEqual(l.checklist[1].ids, cfg.fields.map(([id]) => id));
    assert.deepEqual(l.checklist[2].ids, REFLECTION);
    // Studied / honest wording from the template.
    assert.ok(templates[n].includes(`<input id="studied" type="checkbox">${blocks(l, 'studied')[0].label}</label>`));
    assert.ok(decode(templates[n]).includes(`<input id="honest" type="checkbox">${blocks(l, 'honest')[0].label}</label>`));
    // Completion wording.
    const c = blocks(l, 'complete')[0];
    assert.equal(c.label, `Mark Lesson ${n} complete locally`);
    assert.equal(c.completedLabel, `Lesson ${n} self-completed locally`);
    assert.equal(c.completedNotice, `Lesson ${n} self-completed locally. This is not validated demand or a submitted assignment.`);
    assert.equal(c.incompleteNotice, 'Complete the remaining requirements before local self-completion.');
    assert.equal(blocks(l, 'next').length, 1);
    // Step labels.
    assert.deepEqual(l.sections.map(x => x.label), [...templates[n].matchAll(/<div class="stepnum">([^<]*)<\/div>/g)].map(m => decode(m[1])));
    assert.deepEqual(l.sections.map(x => x.heading), [...templates[n].matchAll(/<div class="stepnum">[^<]*<\/div><h2>([^<]*)<\/h2>/g)].map(m => decode(m[1])));
  }
});

test('learn content is carried over in full (every learn paragraph/list item text present)', () => {
  const text = node => typeof node === 'string' ? node : node.children.map(text).join('');
  for (const n of LESSONS) {
    const learn = lessons[n].sections.find(s => s.id === 'learn');
    const all = learn.blocks.filter(b => b.type === 'content').flatMap(b => b.nodes).map(text).join(' ').replace(/\s+/g, ' ');
    const html = templates[n].slice(templates[n].indexOf('id="learn"'), templates[n].indexOf('<h3>Practice:'));
    for (const m of html.matchAll(/<(p|li|h3)>([\s\S]*?)<\/\1>/g)) {
      const plain = decode(m[2].replace(/<br>/g, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
      if (plain) assert.ok(all.replace(/\s+/g, '').includes(plain.replace(/\s+/g, '')), `${n}: ${plain.slice(0, 60)}`);
    }
  }
});

test('practice scenarios: legacy prompt, three options and option-1 vs other feedback verbatim', () => {
  const src = fnSource('practice');
  for (const n of LESSONS) {
    const p = blocks(lessons[n], 'practice');
    assert.equal(p.length, 1);
    const [block] = p;
    assert.ok(block.legend.startsWith('Practice:'));
    assert.ok(decode(templates[n]).includes(`<h3>${block.legend}</h3>`));
    assert.equal(block.options.length, 3);
    for (const [i, o] of block.options.entries()) assert.ok(decode(templates[n]).includes(`onclick="practice(${i})">${o.label}</button>`), `${n} option ${i}`);
    assert.equal(block.options[0].feedback, block.options[2].feedback);
    assert.notEqual(block.options[0].feedback, block.options[1].feedback);
    assert.ok(src.includes(`i===1?'${block.options[1].feedback}':'${block.options[0].feedback}'`), `feedback pair ${n}`);
  }
  // Spot-check branch selection: >=39 shared branch, 38 own branch, 21 default branch.
  assert.match(blocks(lessons[40], 'practice')[0].options[1].feedback, /^Pause dependent work/);
  assert.equal(blocks(lessons[39], 'practice')[0].options[1].feedback, blocks(lessons[40], 'practice')[0].options[1].feedback);
  assert.match(blocks(lessons[38], 'practice')[0].options[1].feedback, /^Keep the control proposed/);
  assert.equal(blocks(lessons[21], 'practice')[0].options[1].feedback, 'Useful distinction: clarity does not establish adoption or payment.');
  assert.match(blocks(lessons[29], 'practice')[0].prompt, /What needs separating in this statement\?/);
});

test('scripted coach: legacy modes and replies verbatim; Review counts the eight worksheet fields only', () => {
  const src = fnSource('coach');
  for (const n of LESSONS) {
    const [coach] = blocks(lessons[n], 'coach');
    const p = coach.props;
    assert.deepEqual(p.modes.map(m => [m.id, m.label]), [['teach', 'Teach'], ['guide', 'Guide'], ['review', 'Review'], ['challenge', 'Challenge']]);
    assert.deepEqual(p.countIds, configs[n].fields.map(([id]) => id));
    for (const m of p.modes) {
      const literal = m.response.includes('{missing}') ? m.response.split('{missing}').join("'+missing+'") : m.response;
      assert.ok(src.includes(`'${literal}'`), `${n} ${m.id}`);
    }
    assert.ok(src.includes(`'${p.questionResponse}'`), `${n} question`);
    assert.match(p.modes.find(m => m.id === 'review').response, /\{missing\}/);
    if (n > 21) assert.equal(p.modes[0].response, p.modes[1].response, 'non-review modes share one reply after Lesson 21');
  }
  const p21 = blocks(lessons[21], 'coach')[0].props;
  const s = { ...state.blankState(), fields: { handoff: 'x', group: '  ', bias: '', counter: '' } };
  assert.equal(logic.coachReply(p21, 'review', s), 'Validation Brief check: 7 required fields still empty. This scripted check counts fields only; it cannot verify evidence, execute experiments or establish demand.');
  assert.equal(logic.coachReply(p21, 'review', full(21)), logic.coachReply(p21, 'review', full(21)).replace(/\d+/, '0'));
  assert.equal(logic.coachReply(p21, 'review', { ...full(21), fields: { ...full(21).fields, bias: '' } }).match(/(\d+) required/)[1], '0', 'reflections not counted (legacy)');
  assert.match(logic.coachReply(p21, 'question', s), /^This is a scripted demonstration, not an AI answer to your question\. Record/);
  assert.equal(logic.coachReply(p21, 'unknown', s), '');
  const p40 = blocks(lessons[40], 'coach')[0].props;
  assert.equal(logic.coachReply(p40, 'review', state.blankState()), 'Review check: 8 required fields empty. Scripted field counting cannot verify sources, decisions, readiness, compliance or demand.');
  assert.equal(logic.coachReply(p40, 'question', s), 'This is a scripted demonstration, not an AI answer to your question.');
});

test('module status and Lesson 40 phase checkpoint wording and logic', () => {
  const texts = {};
  for (const n of LESSONS) {
    const [note] = blocks(lessons[n], 'moduleNote');
    const p = note.props;
    assert.ok(p.lessons.includes(n));
    assert.ok(p.heading.startsWith(`Module ${lessons[n].module}`) && decode(templates[n]).includes(`<h3>${p.heading}</h3><p id="moduleStatus">`), `heading ${n}`);
    assert.ok(js.includes(`'${p.complete}'`) && js.includes(`'${p.incomplete.replace('{count}', '')}'`), `status ${n}`);
    assert.equal('checkpoint' in p, n === 40);
    texts[lessons[n].module] = p;
  }
  assert.equal(Object.keys(texts).length, 4);
  const p = texts['2.2'];
  assert.equal(logic.moduleStatusText(p, n => n === 26 || n === 27), '2 / 5 lessons self-completed locally. Complete each separately; evidence verification remains separate.');
  assert.equal(logic.moduleStatusText(p, () => true), 'All five lessons self-completed locally. Module 2.2 learning pack complete; source verification, demand and venture approval remain separate.');
  assert.equal(logic.moduleStatusText(texts['2.1'], () => false), '0 / 5 lessons self-completed locally. Complete each separately to finish the learning module.');
  const cp = blocks(lessons[40], 'moduleNote')[0].props.checkpoint;
  assert.equal(logic.checkpointText(cp, () => true), 'All 20 Validate lessons self-completed locally. Phase 02 learning pack complete. Decision, evidence verification, demand and production approval remain separate.');
  assert.equal(logic.checkpointText(cp, n => n !== 33), 'Phase 02 learning pack requires all 20 lessons separately. Decision choice does not certify demand or approve launch.');
  // Lesson 39 keeps its static checkpoint paragraph (legacy only rewrites it on Lesson 40).
  const notes39 = JSON.stringify(blocks(lessons[39], 'moduleNote')[0].props.notes);
  assert.ok(notes39.length > 2);
});

test('every lesson renders natively via LessonView + the Phase 2 module', async () => {
  const { LessonView } = await load('src/lesson-system/LessonPage.tsx');
  await withStorage({}, async () => {
    for (const n of LESSONS) {
      const lesson = await phase2.loadLesson(n);
      let html = renderToString(createElement(LessonView, { lesson, module: phase2, navigate() {}, onProgress() {} }));
      assert.doesNotMatch(html, /<iframe|<script|dangerouslySetInnerHTML|Missing lesson tool/, `lesson ${n}`);
      html = decode(html.replace(/<!-- -->/g, ''));
      for (const text of [lesson.hero.title, ...lesson.fields.map(f => f.label), ...lesson.questions.map(q => q.prompt), blocks(lesson, 'practice')[0].legend,
        `Mark Lesson ${n} complete locally`, 'Storyboard/transcript reviewed', '0 / 5 requirements', 'AI Coach', 'Challenge me',
        '0 / 5 lessons self-completed locally']) assert.ok(html.includes(text), `${n}: ${text}`);
      assert.ok(html.includes(`Lesson ${n + 1} — ${curriculum.names[n + 1]}`), `next lesson ${n}`);
    }
  });
});

test('rendered progress reflects saved completions and live state', async () => {
  const { LessonView } = await load('src/lesson-system/LessonPage.tsx');
  const saved = Object.fromEntries(LESSONS.filter(n => n !== 40).map(n => [schema(n).key, JSON.stringify({ ...full(n), completed: true })]));
  await withStorage({ ...saved, [schema(40).key]: JSON.stringify({ ...full(40), completed: true }) }, async () => {
    const html = decode(renderToString(createElement(LessonView, { lesson: lessons[40], module: phase2, navigate() {}, onProgress() {} })).replace(/<!-- -->/g, ''));
    assert.ok(html.includes('Lesson 40 self-completed locally'));
    assert.ok(html.includes('All five lessons self-completed locally. Module 2.4 learning pack complete'));
    assert.ok(html.includes('All 20 Validate lessons self-completed locally.'));
    assert.ok(html.includes('5 / 5 requirements'));
  });
  await withStorage({ ...saved, [schema(40).key]: JSON.stringify({ ...full(40), completed: true, honest: false }) }, async () => {
    const html = decode(renderToString(createElement(LessonView, { lesson: lessons[40], module: phase2, navigate() {}, onProgress() {} })).replace(/<!-- -->/g, ''));
    assert.ok(html.includes('Mark Lesson 40 complete locally'));
    assert.ok(html.includes('4 / 5 lessons self-completed locally.'));
    assert.ok(html.includes('Phase 02 learning pack requires all 20 lessons separately.'));
  });
});

test('dashboard renders natively with hero, all modules, 20 lesson links and status text', async () => {
  const { DashboardView } = await load('src/lesson-system/PhaseDashboard.tsx');
  const body = legacyBody(2);
  assert.equal(dashboard.phase, 2);
  assert.equal(dashboard.hero.title, 'Turn assumptions into better decisions.');
  assert.ok(body.includes(dashboard.hero.intro));
  assert.deepEqual(dashboard.modules.map(m => m.code), ['2.1', '2.2', '2.3', '2.4']);
  for (const m of dashboard.modules) assert.ok(body.includes(`<h3>${m.code} · ${m.title}</h3>`));
  assert.deepEqual(dashboard.modules.flatMap(m => m.lessons.map(l => l.number)), LESSONS);
  for (const m of dashboard.modules) for (const l of m.lessons) { assert.equal(l.title, curriculum.names[l.number]); assert.equal(l.summary, lessons[l.number].hero.intro); }
  assert.equal(dashboard.phaseStatus.incomplete, blocks(lessons[40], 'moduleNote')[0].props.checkpoint.incomplete);
  const html = decode(renderToString(createElement(DashboardView, { dashboard, navigate() {}, progress: { complete: [21, 22, 23, 24, 25], orientation: false } })).replace(/<!-- -->/g, ''));
  assert.doesNotMatch(html, /<iframe|<script/);
  for (const n of LESSONS) assert.ok(html.includes(`<span class="lesson-number">${n}</span>`) && html.includes(curriculum.names[n]), `link ${n}`);
  for (const text of ['Turn assumptions into better decisions.', 'Bring your Discover decision', 'Your proposed Validate roadmap', 'Open Discover prototype', '5 / 20', dashboard.moduleStatus['2.1'].complete, dashboard.moduleStatus['2.2'].incomplete, dashboard.phaseStatus.incomplete, 'Continue with Lesson 26'])
    assert.ok(html.includes(text), text);
});

test('normalizeExtra and normalizeState tolerate malformed or legacy saved data', () => {
  assert.deepEqual(logic.normalizeExtra(21, {}), {});
  assert.deepEqual(logic.normalizeExtra(21, { rows: [1, 2], junk: 'x' }), {}, 'legacy load() keeps only core keys');
  for (const raw of [null, 'x', 7, [], { fields: 'no', answers: [1] }, { fields: { handoff: 3, group: 'ok' }, answers: { 0: '1', 1: 'bad' }, studied: 'yes', junk: { deep: 1 } }]) {
    const s = state.normalizeState(raw, extra => phase2.normalizeExtra(21, extra));
    assert.equal(typeof s.fields, 'object'); assert.equal(s.completed, false); assert.equal('junk' in s, false);
  }
  const s = state.normalizeState({ fields: { handoff: 3, group: 'ok' }, answers: { 0: '1', 1: 'bad' }, studied: true, honest: true, completed: true }, extra => phase2.normalizeExtra(21, extra));
  assert.deepEqual(s.fields, { group: 'ok' }); assert.deepEqual(s.answers, { 0: 1 }); assert.equal(s.studied, true);
  assert.equal(state.isComplete(s, schema(21)), false, 'saved completion is re-validated');
});

test('requirements: optional support, required reflections, quiz correctness and explicit, revocable completion', () => {
  for (const n of [21, 29, 35, 40]) {
    const s = full(n), sc = schema(n);
    assert.equal(state.requirementsMet(s, sc), true);
    assert.equal(state.requirementsMet({ ...s, fields: { ...s.fields, support: '' } }, sc), true, 'support optional');
    for (const id of [...configs[n].fields.map(([id]) => id), ...REFLECTION]) assert.equal(state.requirementsMet({ ...s, fields: { ...s.fields, [id]: ' ' } }, sc), false, `${n} ${id}`);
    assert.equal(state.quizCorrect({ ...s, answers: { 0: 1, 1: 0, 2: 1 } }, sc.keys), false);
    assert.equal(state.quizCorrect({ ...s, answers: { 0: '1', 1: 0, 2: 2 } }, sc.keys), true);
    assert.equal(state.requirementsMet({ ...s, answers: { 0: 1, 1: 0 } }, sc), false);
    assert.equal(state.requirementsMet({ ...s, studied: false }, sc), false);
    assert.equal(state.requirementsMet({ ...s, honest: false }, sc), false);
    assert.equal(state.markComplete({ ...s, honest: false }, sc), null);
    const done = state.markComplete(s, sc);
    assert.equal(done.completed, true);
    assert.equal(state.applyEdit(s, { studied: true }, sc, phase2.revokeOnAnyEdit).completed, false, 'edits never complete');
    assert.equal(state.applyEdit(done, { fields: { ...done.fields, support: 'note' } }, sc, phase2.revokeOnAnyEdit).completed, true, 'valid edit keeps completion (legacy save)');
    assert.equal(state.applyEdit(done, { fields: { ...done.fields, bias: '' } }, sc, phase2.revokeOnAnyEdit).completed, false);
    assert.equal(state.applyEdit(done, { answers: { ...done.answers, 1: 2 } }, sc, phase2.revokeOnAnyEdit).completed, false);
  }
});

test('Markdown deliverable reproduces legacy exportBrief() for every lesson', () => {
  for (const n of LESSONS) {
    const cfg = configs[n], l = lessons[n];
    const ids = [...cfg.fields.map(([id]) => id), 'support', ...REFLECTION];
    const values = Object.fromEntries(ids.map((id, i) => [id, i % 3 === 0 ? '' : `Value ${id}\nline two`]));
    const legacy = status => `# LYNQ Academy — ${cfg.deliverable}\n\nPhase 02 · Module ${cfg.module || '2.1'} · Lesson ${n}\nStatus: ${status}\n\n${ids.map(id => `## ${domLabel(n, id)}\n${values[id] || 'Not entered'}`).join('\n\n')}\n\nNo real AI, test execution, source verification or demand validation.`;
    const s = { ...state.blankState(), fields: values };
    assert.equal(phase2.buildDeliverable(l, s, false), legacy('Draft'), `draft ${n}`);
    assert.equal(phase2.buildDeliverable(l, s, true), legacy('Locally self-completed'), `complete ${n}`);
    assert.equal(l.deliverable.filename, cfg.filename);
    assert.match(l.deliverable.filename, /^LYNQ-.+\.md$/);
    // Preview (legacy previewBrief): worksheet labels only, trimmed values, caveat footer.
    const preview = deliverable.buildPreview(l, { ...s, fields: { ...values, [cfg.fields[1][0]]: '  ' } });
    const expected = cfg.fields.map(([id, label], i) => `${label}: ${i === 1 ? 'Not yet entered' : values[id].trim() || 'Not yet entered'}`).join('\n\n') + '\n\nThis plan does not prove demand or represent completed research.';
    assert.equal(preview, expected, `preview ${n}`);
  }
  // Whitespace-only values are exported as-is (legacy used `value || 'Not entered'` without trimming).
  assert.match(phase2.buildDeliverable(lessons[21], { ...state.blankState(), fields: { handoff: '  ' } }, false), /## Discover handoff[^\n]*\*\n  \n/);
});
