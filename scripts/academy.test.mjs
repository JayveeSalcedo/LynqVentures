// Academy-wide parity, rendering and navigation checks across all five phases.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { load, memoryStorage } from './helpers/bundle.mjs';

const root = new URL('../', import.meta.url);
const curriculum = JSON.parse(readFileSync(new URL('src/data/curriculum.json', root)));
const routing = await load('src/routing.ts');
const { LessonView } = await load('src/lesson-system/LessonPage.tsx');
const { DashboardView } = await load('src/lesson-system/PhaseDashboard.tsx');
const modules = {};
for (const p of [1, 2, 3, 4, 5]) modules[p] = (await load(`src/phases/phase${p}/index.ts`)).default;
const lessons = {};
for (let n = 1; n <= 100; n++) lessons[n] = await modules[Math.ceil(n / 20)].loadLesson(n);
const strip = html => html.replace(/<!-- -->/g, '');
const blocks = lesson => lesson.sections.flatMap(s => s.blocks);

function render(n) {
  const old = globalThis.localStorage;
  globalThis.localStorage = memoryStorage();
  try { return strip(renderToString(createElement(LessonView, { lesson: lessons[n], module: modules[Math.ceil(n / 20)], navigate() {}, onProgress() {} }))); }
  finally { globalThis.localStorage = old; }
}

test('hash routes stay compatible: #phase/1–5, #lesson/1–100, fallbacks', () => {
  for (let p = 1; p <= 5; p++) assert.deepEqual(routing.parseHash(`#phase/${p}`), { phase: p, lesson: null });
  for (let n = 1; n <= 100; n++) assert.deepEqual(routing.parseHash(`#lesson/${n}`), { phase: Math.ceil(n / 20), lesson: n });
  for (const bad of ['', '#', '#orientation', '#phase/0', '#phase/6', '#lesson/0', '#lesson/101', '#lesson/abc', '#lesson/1/x']) assert.equal(routing.parseHash(bad).lesson, null, bad);
  assert.equal(routing.parseHash('#phase/6').phase, 0);
  assert.equal(routing.hashFor(0), 'orientation'); assert.equal(routing.hashFor(3), 'phase/3'); assert.equal(routing.hashFor(3, 47), 'lesson/47');
});

test('next-lesson navigation crosses every phase boundary and ends in graduation review', () => {
  for (const [from, phase] of [[20, 2], [40, 3], [60, 4], [80, 5]]) {
    assert.deepEqual(routing.nextStep(from), { phase, lesson: from + 1 });
    assert.ok(blocks(lessons[from]).some(b => b.type === 'next'), `lesson ${from} has a next block`);
    assert.match(render(from), new RegExp(`Lesson ${from + 1} — ${curriculum.names[from + 1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  }
  assert.equal(routing.nextStep(100), 'graduation');
  // Lesson 100 ends with the native graduation review (legacy wording) instead of a next lesson.
  assert.ok(blocks(lessons[100]).some(b => b.type === 'extension' && b.id === 'graduation100'));
  assert.ok(!blocks(lessons[100]).some(b => b.type === 'lesson-link'));
  assert.match(render(100), /Your graduation review[\s\S]*Review Academy completion[\s\S]*Download local learning acknowledgement/);
});

test('all 100 lessons match the source curriculum: titles, keys, required fields, quiz answers, flags', () => {
  for (let n = 1; n <= 100; n++) {
    const lesson = lessons[n], schema = curriculum.schemas[n];
    assert.equal(lesson.number, n); assert.equal(lesson.phase, schema.phase); assert.equal(lesson.title, curriculum.names[n], `title ${n}`);
    assert.deepEqual(lesson.fields.filter(f => f.required).map(f => f.id).sort(), [...schema.ids].sort(), `required fields ${n}`);
    for (const id of schema.ids) assert.ok(blocks(lesson).some(b => b.type === 'fields' && b.ids.includes(id)) || blocks(lesson).some(b => b.type === 'extension'), `field ${id} rendered in ${n}`);
    assert.deepEqual(lesson.questions.map(q => q.answer), schema.keys, `quiz ${n}`);
    for (const q of lesson.questions) assert.ok(q.answer >= 0 && q.answer < q.options.length && q.explanation, `question shape ${n}`);
    const flags = blocks(lesson).filter(b => b.type === 'flag').map(b => b.flag);
    assert.equal(flags.includes('artifactReady'), schema.artifact, `artifactReady ${n}`);
    assert.equal(flags.includes('releaseAck50'), schema.releaseAck, `releaseAck50 ${n}`);
    for (const type of ['studied', 'honest', 'quiz', 'complete', 'checklist']) assert.ok(blocks(lesson).some(b => b.type === type), `${type} block in ${n}`);
    assert.match(lesson.deliverable.filename, /^[\w.-]+\.md$/, `filename ${n}`);
    for (const b of blocks(lesson).filter(b => b.type === 'extension')) assert.ok(modules[lesson.phase].extensions[b.id], `extension ${b.id} in ${n}`);
  }
});

test('every lesson renders natively with its fields, quiz and completion controls and no iframe', () => {
  for (let n = 1; n <= 100; n++) {
    const html = render(n);
    assert.doesNotMatch(html, /<iframe|<script/i, `lesson ${n}`);
    assert.doesNotMatch(html, /Missing lesson tool/, `lesson ${n}`);
    for (const f of lessons[n].fields) assert.ok(html.includes(f.label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')), `field label ${f.id} in ${n}`);
    for (const q of lessons[n].questions) assert.ok(html.includes(q.prompt.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')), `question in ${n}`);
  }
});

test('all five phase dashboards render natively with their 20 lessons', async () => {
  for (const p of [1, 2, 3, 4, 5]) {
    const dashboard = await modules[p].loadDashboard();
    assert.equal(dashboard.phase, p);
    assert.equal(dashboard.modules.flatMap(m => m.lessons).map(l => l.number).join(), Array.from({ length: 20 }, (_, i) => (p - 1) * 20 + i + 1).join());
    const old = globalThis.localStorage; globalThis.localStorage = memoryStorage();
    try {
      const html = strip(renderToString(createElement(DashboardView, { dashboard, navigate() {}, progress: { complete: [(p - 1) * 20 + 1], orientation: false } })));
      assert.doesNotMatch(html, /<iframe|<script/i);
      assert.match(html, /1 \/ 20/);
      for (const l of dashboard.modules.flatMap(m => m.lessons)) assert.ok(html.includes(String(l.number).padStart(2, '0')));
    } finally { globalThis.localStorage = old; }
  }
});

test('no runtime HTML injection or string evaluation in application source', () => {
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(new URL(`${e.name}/`, dir)) : [new URL(e.name, dir)]);
  for (const file of walk(new URL('src/', root)).filter(f => /\.(tsx?|json)$/.test(f.pathname))) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /dangerouslySetInnerHTML|\beval\(|new Function\(|innerHTML\s*=|<iframe/, file.pathname);
  }
});

test('original combined HTML is unchanged', () => {
  const hash = createHash('sha256').update(readFileSync(new URL('LYNQ_Academy_All_Phases.html', root))).digest('hex');
  assert.equal(hash, '358c13ce6c495414e3622f519cb3c41da666c3ff080497b8e6a1ff6fb46ffee8');
});
