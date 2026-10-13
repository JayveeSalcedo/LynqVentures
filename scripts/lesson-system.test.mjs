import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { load, memoryStorage } from './helpers/bundle.mjs';

const state = await load('src/lesson-system/state.ts');
const deliverable = await load('src/lesson-system/deliverable.ts');
const curriculum = JSON.parse(readFileSync(new URL('../src/data/curriculum.json', import.meta.url)));
const schema = n => curriculum.schemas[String(n)];
const full = n => ({ ...state.blankState(), fields: Object.fromEntries(schema(n).ids.map(id => [id, `Answer ${id}`])), answers: Object.fromEntries(schema(n).keys.map((k, i) => [i, k])), studied: true, honest: true });

test('normalizeState drops malformed values and preserves lesson-specific records', () => {
  for (const raw of [null, 'x', 42, [], { fields: [], answers: 'no' }]) assert.deepEqual(state.normalizeState(raw), state.blankState());
  const s = state.normalizeState({ fields: { a: 'ok', b: 3, c: null }, answers: { 0: '1', 1: -1, 2: 'x', 3: 2.5, 4: 0 }, studied: 'true', honest: true, completed: 1, artifactReady: 'yes', releaseAck50: true, observationRows: [{ id: 'P1' }] });
  assert.deepEqual(s.fields, { a: 'ok' });
  assert.deepEqual(s.answers, { 0: 1, 4: 0 });
  assert.equal(s.studied, false); assert.equal(s.honest, true); assert.equal(s.completed, false);
  assert.equal(s.artifactReady, false); assert.equal(s.releaseAck50, true);
  assert.deepEqual(s.observationRows, [{ id: 'P1' }]);
  const custom = state.normalizeState({ rows: 'bad', keep: 1 }, raw => ({ rows: Array.isArray(raw.rows) ? raw.rows : [] }));
  assert.deepEqual(custom.rows, []); assert.equal('keep' in custom, false);
});

test('required fields, quiz keys, study and self-review gate completion; optional fields do not', () => {
  const n = 2, s = full(n);
  assert.equal(state.requirementsMet(s, schema(n)), true);
  for (const id of schema(n).ids) assert.equal(state.requirementsMet({ ...s, fields: { ...s.fields, [id]: '   ' } }, schema(n)), false, id);
  assert.equal(state.requirementsMet({ ...s, studied: false }, schema(n)), false);
  assert.equal(state.requirementsMet({ ...s, honest: false }, schema(n)), false);
  assert.equal(state.requirementsMet({ ...s, answers: { ...s.answers, 0: (schema(n).keys[0] + 1) % 3 } }, schema(n)), false);
  assert.equal(state.requirementsMet({ ...s, answers: {} }, schema(n)), false);
  assert.equal(state.requirementsMet({ ...s, fields: { ...s.fields, support: '' } }, schema(n)), true, 'optional support field');
});

test('artifactReady (Lesson 45) and releaseAck50 (Lesson 50) are required only where specified', () => {
  assert.equal(state.requirementsMet(full(45), schema(45)), false);
  assert.equal(state.requirementsMet({ ...full(45), artifactReady: true }, schema(45)), true);
  assert.equal(state.requirementsMet(full(50), schema(50)), false);
  assert.equal(state.requirementsMet({ ...full(50), releaseAck50: true }, schema(50)), true);
  assert.equal(state.requirementsMet({ ...full(50), artifactReady: true }, schema(50)), false);
  assert.equal(state.requirementsMet(full(44), schema(44)), true);
});

test('completion is explicit and revoked when an edit invalidates the lesson', () => {
  const n = 30;
  assert.equal(state.markComplete({ ...full(n), studied: false }, schema(n)), null);
  const done = state.markComplete(full(n), schema(n));
  assert.equal(done.completed, true);
  assert.equal(state.applyEdit(full(n), { studied: true }, schema(n), false).completed, false, 'edits never complete');
  assert.equal(state.applyEdit(done, { fields: { ...done.fields, handoff: 'changed' } }, schema(n), false).completed, true);
  assert.equal(state.applyEdit(done, { fields: { ...done.fields, [schema(n).ids[0]]: '' } }, schema(n), false).completed, false);
  assert.equal(state.applyEdit(done, { answers: { 0: 9 } }, schema(n), false).completed, false);
  assert.equal(state.applyEdit(done, { fields: { ...done.fields, x: 'y' } }, schema(n), true).completed, false, 'Scale revokes on any edit');
  assert.equal(state.isComplete({ ...full(n), completed: true, honest: false }, schema(n)), false);
});

test('Markdown deliverable lists fields with status, header tokens, extra sections and footer', () => {
  const lesson = { number: 7, module: '1.2', fields: [{ id: 'a', label: 'Alpha', kind: 'textarea', required: true }, { id: 'b', label: 'Beta', kind: 'input', required: false }],
    deliverable: { title: 'LYNQ Academy — Test Map', filename: 'LYNQ-Test.md', headerLines: ['Phase 01 · Module {module} · Lesson {lesson}', 'Status: {status}', 'Created: {created}'], footer: 'Local prototype export.' } };
  const md = deliverable.buildMarkdown(lesson, { ...state.blankState(), fields: { a: 'Hello' } }, false, '## Rows\n- one', new Date('2026-01-02T03:04:05Z'));
  assert.equal(md, '# LYNQ Academy — Test Map\n\nPhase 01 · Module 1.2 · Lesson 07\nStatus: Draft\nCreated: 2026-01-02T03:04:05.000Z\n\n## Alpha\nHello\n\n## Beta\nNot entered\n\n## Rows\n- one\n\nLocal prototype export.\n');
  assert.match(deliverable.buildMarkdown(lesson, state.blankState(), true), /Status: Self-completed locally/);
});

test('progress re-validates saved completions and orientation from localStorage', async () => {
  const progress = await load('src/progress.ts');
  const old = globalThis.localStorage;
  try {
    const good = { ...full(2), completed: true };
    globalThis.localStorage = memoryStorage({ [schema(2).key]: JSON.stringify(good), [schema(3).key]: JSON.stringify({ ...full(3), completed: true, studied: false }), [schema(4).key]: '{broken', [schema(45).key]: JSON.stringify({ ...full(45), completed: true }) });
    const p = progress.readProgress();
    assert.deepEqual(p.complete, [2]); assert.equal(p.orientation, false);
    const g = progress.graduationStatus(p);
    assert.equal(g.eligible, false); assert.equal(g.missing.length, 99);
    const all = Object.fromEntries(Object.keys(curriculum.schemas).map(n => [schema(n).key, JSON.stringify({ ...full(n), completed: true, artifactReady: true, releaseAck50: true })]));
    globalThis.localStorage = memoryStorage({ ...all, 'lynq.orientation.v1': JSON.stringify({ answers: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }, profileCompleted: true, completed: true }),
      'lynq.orientation.lesson.v1': JSON.stringify({ studied: true, honest: true, answers: { 0: 1, 1: 0, 2: 2 }, fields: Object.fromEntries(progress.orientationFieldIds.map(id => [id, 'x'])) }) });
    const everything = progress.graduationStatus(progress.readProgress());
    assert.equal(everything.eligible, true); assert.equal(everything.count, 100);
    globalThis.localStorage = memoryStorage({ ...all, 'lynq.orientation.v1': JSON.stringify({ answers: { 0: 0 }, profileCompleted: true, completed: true }) });
    assert.equal(progress.graduationStatus(progress.readProgress()).eligible, false, 'orientation required');
  } finally { globalThis.localStorage = old; }
});

test('generic LessonView renders every block type natively without iframe or HTML injection', async () => {
  const { LessonView } = await load('src/lesson-system/LessonPage.tsx');
  const lesson = { number: 2, phase: 1, module: '1.1', title: 'Fixture', hero: { eyebrow: 'E', title: 'Fixture lesson', intro: 'Intro' },
    fields: [{ id: 'context', label: 'Context field', kind: 'textarea', required: true }, { id: 'support', label: 'Support', kind: 'select', required: false, options: [{ value: '', label: 'Choose' }, { value: 'x', label: 'X' }] }],
    questions: [{ prompt: 'Q1?', options: ['a', 'b'], answer: 1, explanation: 'Because' }],
    checklist: [{ kind: 'studied', label: 'Studied' }, { kind: 'quiz', label: 'Quiz' }],
    deliverable: { title: 'T', filename: 'T.md', footer: 'F' },
    sections: [{ id: 'watch', label: '01 / WATCH', heading: 'Watch', blocks: [{ type: 'video', title: 'V' }, { type: 'storyboard', scenes: [{ title: 'S1', visual: 'v', narration: 'n' }] }, { type: 'transcript', scenes: [{ title: 'S1', visual: 'v', narration: 'Narration text' }] }, { type: 'videoPrompt', prompt: 'P', filename: 'p.md' }, { type: 'studied', label: 'I reviewed' }] },
      { id: 'learn', label: '02 / LEARN', heading: 'Learn', blocks: [{ type: 'content', nodes: [{ tag: 'p', attrs: {}, children: ['Teaching ', { tag: 'script', attrs: {}, children: ['alert(1)'] }, { tag: 'lesson-link', attrs: { lesson: '3' }, children: ['Go 3'] }] }] }] },
      { id: 'build', label: '03 / BUILD', heading: 'Build', blocks: [{ type: 'fields', ids: ['context', 'support'] }, { type: 'saveStatus' }, { type: 'extension', id: 'missingTool' }] },
      { id: 'coach', label: '04', heading: 'Coach', blocks: [{ type: 'coach', modes: [{ id: 'review', label: 'Review', response: '{missing} empty' }] }, { type: 'practice', prompt: 'Which?', options: [{ label: 'A', feedback: 'fa' }] }] },
      { id: 'quiz', label: '06', heading: 'Quiz', blocks: [{ type: 'quiz' }] },
      { id: 'finish', label: '07', heading: 'Finish', blocks: [{ type: 'flag', flag: 'artifactReady', label: 'Artifact ready' }, { type: 'honest', label: 'Honest' }, { type: 'deliverable' }, { type: 'reset' }, { type: 'checklist' }, { type: 'complete', label: 'Mark complete', completedNotice: 'done', incompleteNotice: 'not yet' }, { type: 'next' }] }] };
  const old = globalThis.localStorage;
  globalThis.localStorage = memoryStorage();
  try {
    let html = renderToString(createElement(LessonView, { lesson, module: { phase: 1, revokeOnAnyEdit: false, extensions: {}, loadLesson: async () => lesson, loadDashboard: async () => null }, navigate() {}, onProgress() {} }));
    assert.doesNotMatch(html, /<iframe|<script|alert\(1\)/);
    html = html.replace(/<!-- -->/g, '');
    for (const text of ['Fixture lesson', 'Context field', '(optional)', 'Narration text', 'Teaching', 'Go 3', 'Q1?', 'Mark complete', 'Missing lesson tool: missingTool', 'Lesson 03 — Symptoms', '0 / 2 requirements']) assert.ok(html.includes(text) || html.includes(text.replace('Symptoms', '')), text);
  } finally { globalThis.localStorage = old; }
});
