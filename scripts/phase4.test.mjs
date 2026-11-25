import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { load, memoryStorage } from './helpers/bundle.mjs';
import { legacyScript, jsonConst, parseHtml, findAll, textOf } from './migration/legacy.mjs';
import { correctedDeep } from './migration/stale-corrections.mjs';

const curriculum = JSON.parse(readFileSync(new URL('../src/data/curriculum.json', import.meta.url)));
const js = legacyScript(4);
const configs = correctedDeep(4, jsonConst(js, 'configs'));
const templates = correctedDeep(4, jsonConst(js, 'templates'));
const lessons = Array.from({ length: 20 }, (_, i) => 61 + i);
const lessonJson = n => JSON.parse(readFileSync(new URL(`../src/data/lessons/phase-4/lesson-${n}.json`, import.meta.url)));
const dashboard = JSON.parse(readFileSync(new URL('../src/data/dashboards/phase-4.json', import.meta.url)));
const schema = n => curriculum.schemas[String(n)];
const blocks = (lesson, type, id) => lesson.sections.flatMap(s => s.blocks).filter(b => b.type === type && (id === undefined || b.id === id));
const tool = (lesson, id) => blocks(lesson, 'extension', id)[0]?.props;

const state = await load('src/lesson-system/state.ts');
const phase4 = (await load('src/phases/phase4/index.ts')).default;
const rows = await load('src/phases/phase4/rows.logic.ts');
const calc = await load('src/phases/phase4/calc.logic.ts');
const pipeline = await load('src/phases/phase4/pipeline.logic.ts');
const brief = await load('src/phases/phase4/brief.logic.ts');
const tools = await load('src/phases/phase4/tools.tsx');

const full = n => ({ ...state.blankState(), fields: Object.fromEntries(schema(n).ids.map(id => [id, `Answer ${id}`])), answers: Object.fromEntries(schema(n).keys.map((k, i) => [i, k])), studied: true, honest: true });
const withStorage = async (data, fn) => { const old = globalThis.localStorage; globalThis.localStorage = memoryStorage(data); try { return await fn(); } finally { globalThis.localStorage = old; } };

test('status lists every Phase 4 lesson and the dashboard as native', () => {
});

test('parity: titles, keys, fields, quiz, scenes, prompts and filenames match curriculum.json and the legacy source', async () => {
  for (const n of lessons) {
    const lesson = await phase4.loadLesson(n), legacy = configs[n], tpl = parseHtml(templates[n]);
    assert.equal(lesson.number, n); assert.equal(lesson.phase, 4); assert.equal(lesson.module, legacy.module);
    assert.equal(lesson.title, curriculum.names[n]); assert.equal(lesson.title, legacy.title);
    assert.equal(schema(n).key, `lynq.launch.lesson${n}.v1`);
    assert.deepEqual(lesson.fields.filter(f => f.required).map(f => f.id).sort(), [...schema(n).ids].sort(), `required ${n}`);
    assert.equal(lesson.fields.length, schema(n).ids.length);
    for (const [id, label] of legacy.fields) assert.equal(lesson.fields.find(f => f.id === id)?.label, label, `${n} ${id}`);
    for (const id of ['bias', 'counter', 'constraint']) {
      const legacyLabel = textOf(findAll(tpl, x => x.tag === 'label' && x.attrs.for === id)[0]).trim().replace(/\s*\*$/, '');
      assert.equal(lesson.fields.find(f => f.id === id).label, legacyLabel);
    }
    const placed = blocks(lesson, 'fields').flatMap(b => b.ids);
    assert.deepEqual([...placed].sort(), lesson.fields.map(f => f.id).sort(), 'every field placed once');
    assert.deepEqual(lesson.questions.map(q => [q.prompt, q.options, q.answer, q.explanation]), legacy.questions);
    assert.deepEqual(lesson.questions.map(q => q.answer), schema(n).keys);
    const storyboard = blocks(lesson, 'storyboard')[0];
    assert.deepEqual(storyboard.scenes.map(s => [s.title, s.visual, s.narration]), legacy.scenes);
    assert.equal(storyboard.scenes.length, 6);
    const prompt = blocks(lesson, 'videoPrompt')[0];
    assert.equal(prompt.prompt, legacy.prompt);
    assert.equal(prompt.filename, `LYNQ-Lesson-${n}-Gemini-Video-Prompt.md`);
    assert.ok(templates[n].includes(`download(c.prompt,'${prompt.filename}')`));
    assert.equal(lesson.deliverable.filename, legacy.filename);
    assert.equal(blocks(lesson, 'flag').length, 0, 'no artifactReady/releaseAck50 in Launch');
    assert.equal(schema(n).artifact || schema(n).releaseAck, false);
    // Legacy practice/coach labels and completion button.
    for (const b of findAll(tpl, x => x.tag === 'button' && /^coachMode\('/.test(x.attrs.onclick || ''))) assert.ok(blocks(lesson, 'coach')[0].modes.some(m => m.label === textOf(b).trim()), `${n} coach ${textOf(b)}`);
    for (const b of findAll(tpl, x => x.tag === 'button' && /^practice\(/.test(x.attrs.onclick || ''))) assert.ok(blocks(lesson, 'practice')[0].options.some(o => o.label === textOf(b).trim()));
    assert.equal(blocks(lesson, 'complete')[0].label, `Mark Lesson ${n} complete locally`);
    assert.equal(blocks(lesson, 'complete')[0].completedNotice, `Lesson ${n} self-completed locally. This records learning, not market fit or launch approval.`);
    // Every legacy tool export filename is reproduced.
    for (const file of [...js.matchAll(new RegExp(`'(LYNQ-Lesson-${n}-[^']+\\.(?:json|md))'`, 'g'))].map(m => m[1])) {
      const all = JSON.stringify(lesson);
      assert.ok(all.includes(`"${file}"`), `${n} ${file}`);
    }
  }
});

test('coach replies and practice feedback are the legacy scripted text', async () => {
  const l61 = await phase4.loadLesson(61), l80 = await phase4.loadLesson(80), l67 = await phase4.loadLesson(67);
  assert.equal(blocks(l61, 'coach')[0].modes.find(m => m.id === 'teach').response, 'Simulated teach guidance: specify user/buyer/trigger, supported outcome, first channel and evidence. Preserve unknowns, readiness blockers and human authority. Filled fields are not market validation.');
  assert.equal(blocks(l80, 'coach')[0].modes.find(m => m.id === 'Review').response, 'Simulated Review guidance: Record a bounded decision, owner/date and evidence gates; preserve Hold where needed. No traction verified or expansion approved.');
  const practice = blocks(l67, 'practice')[0];
  assert.equal(practice.options[1].feedback, 'Keep the evidence-based stage, owner and next action. Excitement alone does not establish won status or revenue.');
  assert.equal(practice.options[0].feedback, 'Stage enthusiasm cannot verify a contract, payment or customer result.');
  for (const n of lessons) {
    const lesson = await phase4.loadLesson(n);
    for (const m of blocks(lesson, 'coach')[0].modes) assert.ok(m.response.startsWith(`Simulated ${m.id} guidance: `) && m.response.length > 60);
    for (const o of blocks(lesson, 'practice')[0].options) assert.ok(js.includes(o.feedback.replace(/'/g, "\\'")), `${n} practice feedback verbatim`);
  }
});

test('every lesson renders natively via LessonView with all labels, prompts and tools', async () => {
  const { LessonView } = await load('src/lesson-system/LessonPage.tsx');
  await withStorage({}, async () => {
    for (const n of lessons) {
      const lesson = await phase4.loadLesson(n);
      const html = renderToString(createElement(LessonView, { lesson, module: phase4, navigate() {}, onProgress() {} })).replace(/<!-- -->/g, '');
      assert.doesNotMatch(html, /<iframe|<script|Missing lesson tool/);
      const decoded = html.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      for (const text of [lesson.hero.title, ...lesson.fields.map(f => f.label), ...lesson.questions.map(q => q.prompt)]) assert.ok(decoded.includes(text), `${n}: ${text}`);
      for (const ext of blocks(lesson, 'extension')) {
        if (ext.props?.title) assert.ok(decoded.includes(ext.props.title), `${n} ${ext.id}`);
        for (const input of ext.props?.inputs ?? []) assert.ok(decoded.includes(input.label), `${n} ${input.label}`);
      }
      assert.ok(decoded.includes('0 / 5 requirements'));
      assert.ok(decoded.includes(`Module ${lesson.module}: 0 / 5. Completion is learning progress, not verified traction or scaling approval.`));
      assert.doesNotMatch(decoded, /lessons are interactive|Gemini video prompt/, `${n} learner-facing copy`);
    }
  });
});

test('dashboard renders natively with hero, four modules and all 20 lesson links', async () => {
  const { DashboardView } = await load('src/lesson-system/PhaseDashboard.tsx');
  const d = await phase4.loadDashboard();
  assert.deepEqual(d, dashboard);
  assert.equal(d.hero.title, 'Enter the market with focus.');
  assert.deepEqual(d.modules.map(m => m.code), ['4.1', '4.2', '4.3', '4.4']);
  assert.deepEqual(d.modules.map(m => m.title), curriculum.phases[3].modules.map(m => m.replace(/^4\.\d · /, '')));
  assert.deepEqual(d.modules.flatMap(m => m.lessons.map(l => l.number)), lessons);
  for (const m of d.modules) for (const l of m.lessons) assert.equal(l.title, curriculum.names[l.number]);
  const html = renderToString(createElement(DashboardView, { dashboard: d, navigate() {}, progress: { complete: [61, 62], orientation: false } })).replace(/<!-- -->/g, '');
  assert.doesNotMatch(html, /<iframe|<script/);
  for (const n of lessons) assert.ok(html.includes(`<span class="lesson-number">${n}</span>`), `link ${n}`);
  assert.ok(html.includes('GTM plan') && html.includes('Traction assessment'));
  assert.doesNotMatch(html, /Interactive|lessons are interactive|backend/);
  assert.ok(html.includes('2 / 20'));
});

test('normalizeExtra mirrors the legacy load(): filters, limits, history slice and calculator objects', () => {
  const good = { id: 'A', name: 'n', evidence: 'e', test: 't', owner: 'o', status: 'Proposed test / not executed' };
  const raw = {
    channelRows: [good, { ...good, id: 7 }, null, 'x', [], { id: 'B' }, ...Array.from({ length: 25 }, (_, i) => ({ ...good, id: `R${i}` }))],
    dealRows: [{ id: 'D', stage: 'New', context: 'c', evidence: 'e', owner: 'o', history: Array.from({ length: 50 }, (_, i) => ({ i })) }, { id: 'E', stage: 'New', context: 'c', evidence: 'e', owner: 'o', history: 'bad' }],
    journeyRows: Array.from({ length: 35 }, (_, i) => ({ id: `J${i}`, area: 'a', scope: 's', observed: 'o', status: 's', owner: 'o', critical: true })),
    gateRows: { not: 'array' }, calc66: ['bad'], rate73: { rateEligible73: '10' }, review76: 'bad', supportRows: 5, custom: { keep: true },
  };
  const out = phase4.normalizeExtra(66, raw);
  assert.equal(out.channelRows.length, 20); assert.deepEqual(out.channelRows[0], good);
  assert.ok(out.channelRows.every(r => typeof r.id === 'string'));
  assert.equal(out.dealRows[0].history.length, 40); assert.deepEqual(out.dealRows[0].history[0], { i: 10 });
  assert.deepEqual(out.dealRows[1].history, []);
  assert.equal(out.journeyRows.length, 30); assert.equal(out.journeyRows[0].critical, true);
  assert.deepEqual(out.gateRows, []); assert.deepEqual(out.supportRows, []);
  assert.deepEqual(out.calc66, {}); assert.deepEqual(out.review76, {}); assert.deepEqual(out.rate73, { rateEligible73: '10' });
  assert.deepEqual(out.custom, { keep: true }, 'unknown keys preserved');
  for (const key of Object.keys(rows.rowSpecs)) assert.ok(Array.isArray(out[key]), key);
  for (const bad of [{}, { channelRows: null }, { packageRows: [{ id: 1 }] }]) assert.doesNotThrow(() => phase4.normalizeExtra(61, bad));
  const s = state.normalizeState({ fields: { gtmContext: 'x' }, channelRows: [good], calc66: 3 }, raw => phase4.normalizeExtra(61, raw));
  assert.deepEqual(s.channelRows, [good]); assert.deepEqual(s.calc66, {});
  assert.equal(rows.rowSpecs.supportRows.limit, 20); assert.equal(rows.rowSpecs.measureRows.limit, 30);
  // The limits/required keys agree with the legacy load() source.
  for (const [key, spec] of Object.entries(rows.rowSpecs)) assert.ok(js.includes(`${key}:Array.isArray(x.${key})?x.${key}.filter(r=>r&&${JSON.stringify(spec.keys).replace(/"/g, "'")}.every(k=>typeof r[k]==='string')).slice(0,${spec.limit})`), key);
});

test('all fields are required; quiz answers gate completion', () => {
  for (const n of [61, 67, 73, 80]) {
    const s = full(n), sc = schema(n);
    assert.equal(state.requirementsMet(s, sc), true);
    for (const id of sc.ids) assert.equal(state.requirementsMet({ ...s, fields: { ...s.fields, [id]: '  ' } }, sc), false, `${n} ${id}`);
    assert.equal(state.requirementsMet({ ...s, answers: { ...s.answers, 0: (sc.keys[0] + 1) % 3 } }, sc), false);
    assert.equal(state.quizCorrect({ ...s, answers: { 0: 1, 1: 0, 2: 2 } }, sc.keys), JSON.stringify(sc.keys) === '[1,0,2]');
    assert.equal(state.quizCorrect({ ...s, answers: { 0: 1, 1: 0 } }, sc.keys), false);
    assert.equal(state.requirementsMet({ ...s, studied: false }, sc), false);
    assert.equal(state.requirementsMet({ ...s, honest: false }, sc), false);
  }
});

test('completion is explicit and revoked on any edit (legacy save() cleared completed)', () => {
  assert.equal(phase4.revokeOnAnyEdit, true);
  assert.ok(/function save\(\)\{state\.completed=false;/.test(js));
  const n = 66, sc = schema(n);
  assert.equal(state.markComplete({ ...full(n), honest: false }, sc), null);
  const done = state.markComplete(full(n), sc);
  assert.equal(done.completed, true);
  assert.equal(state.applyEdit(full(n), { studied: true }, sc, true).completed, false, 'edits never complete');
  assert.equal(state.applyEdit(done, { packageRows: [] }, sc, phase4.revokeOnAnyEdit).completed, false, 'tool edit revokes');
  assert.equal(state.applyEdit(done, { calc66: { calcPrice66: '5' } }, sc, phase4.revokeOnAnyEdit).completed, false);
  assert.equal(state.applyEdit(done, { fields: { ...done.fields, offer: 'changed' } }, sc, phase4.revokeOnAnyEdit).completed, false);
});

test('row registers: required columns, duplicate IDs, limits, key order, cards, counts and JSON export', async () => {
  const l61 = await phase4.loadLesson(61), c61 = tool(l61, 'rowLog');
  const draft = { channelId61: ' A1 ', channelName61: 'Seg', channelEvidence61: 'Ev', channelTest61: 'Test', channelOwner61: 'Own' };
  assert.deepEqual(rows.addRow([], { ...draft, channelTest61: ' ' }, c61), { error: 'Enter every channel test field, including evidence/unknowns and owner/caps.' });
  const added = rows.addRow([], draft, c61).rows;
  assert.deepEqual(added, [{ status: 'Proposed test / not executed', id: 'A1', name: 'Seg', evidence: 'Ev', test: 'Test', owner: 'Own' }]);
  assert.deepEqual(Object.keys(added[0]), ['status', 'id', 'name', 'evidence', 'test', 'owner']);
  assert.deepEqual(rows.addRow(added, { ...draft, channelId61: 'a1' }, c61), { error: 'ID already exists; choose a unique ID.' });
  const twenty = Array.from({ length: 20 }, (_, i) => ({ ...added[0], id: `X${i}` }));
  assert.deepEqual(rows.addRow(twenty, draft, c61), { error: 'Local limit: 20 options. Export and review before more work.' });
  assert.equal(rows.cardText(added[0], c61.card), 'A1 · Proposed test / not executed\nSeg\nEvidence/limits: Ev\nTest: Test\nOwner/caps: Own');
  const st = { ...state.blankState(), fields: { gtmContext: 'G' }, channelRows: added };
  assert.equal(rows.exportJson(st, c61), JSON.stringify({ lesson: 61, status: 'planning only; no campaign execution', fields: { gtmContext: 'G' }, proposedTests: added }, null, 2));
  assert.equal(c61.exportFilename, 'LYNQ-Lesson-61-Channel-Tests.json');

  const l68 = await phase4.loadLesson(68), c68 = tool(l68, 'rowLog');
  const r68 = rows.addRow([], { checkId68: 'C1', checkArea68: 'Setup / first supported value', checkScope68: 's', checkObserved68: 'o', checkState68: 'Failed / unresolved', checkCritical68: true, checkOwner68: 'w' }, c68).rows;
  assert.deepEqual(Object.keys(r68[0]), ['area', 'status', 'critical', 'id', 'scope', 'observed', 'owner']);
  assert.equal(rows.cardText(r68[0], c68.card), 'C1 · Setup / first supported value · Failed / unresolved · UNRESOLVED CRITICAL BLOCKER\nScope/expected: s\nObserved/source: o\nOwner/review: w');
  const x = rows.summarize(r68, c68.summary);
  assert.equal(x.status, 'HOLD / GAPS IN LEARNER REGISTER'); assert.deepEqual(x.criticalBlockers, ['C1']); assert.equal(x.missingAreas.length, 5);
  assert.equal(rows.summaryText(x), `HOLD / GAPS IN LEARNER REGISTER. Missing areas: ${x.missingAreas.join('; ')}. Unresolved: C1. Critical: C1. coverage and learner status only; no actual-site test, sufficiency, certification or release authority`);
  const passed = c68.summary.areas.map((area, i) => ({ id: `P${i}`, area, status: 'Learner-reported passed / evidence referenced', critical: false, scope: 's', observed: 'o', owner: 'w' }));
  assert.equal(rows.summarize(passed, c68.summary).status, 'FURTHER HUMAN REVIEW ONLY');
  assert.equal(JSON.parse(rows.exportJson({ ...state.blankState(), journeyRows: passed }, c68)).summary.status, 'FURTHER HUMAN REVIEW ONLY');

  const l71 = await phase4.loadLesson(71), c71 = tool(l71, 'rowLog');
  assert.deepEqual(c71.summary.areas, ['Readiness / authority decision', 'Product / control / recovery check', 'Offer / website / campaign action', 'Support / monitoring / escalation', 'Rollout / rollback / expansion']);
  assert.equal(c71.summary.areaKey, 'type');

  const l72 = await phase4.loadLesson(72), c72 = tool(l72, 'rowLog');
  const r72 = [{ status: 'Learner-reported evaluation', id: 'E1' }, { status: 'Learner-reported evaluation', id: 'E2' }];
  assert.equal(rows.countsText(r72, c72.counts), 'Record-label counts only, not unique customers/revenue/activation: Proposed / not run 0 · Hold / qualified out 0 · Learner-reported qualified conversation 0 · Learner-reported evaluation 2 · Learner-reported accepted commitment / payment unverified 0 · Learner-reported collected payment / evidence referenced 0');
  assert.equal(c72.limit, 30);

  // Every row-log lesson: legacy limit, state key and option lists.
  const expected = { 61: ['channelRows', 20], 62: ['goalRows', 20], 63: ['actionRows', 20], 64: ['messageRows', 20], 65: ['assetRows', 20], 66: ['packageRows', 20], 68: ['journeyRows', 30], 69: ['campaignRows', 20], 70: ['supportRows', 20], 71: ['releaseRows', 30], 72: ['customerRows', 30], 73: ['measureRows', 30], 74: ['feedbackRows', 30], 75: ['retentionRows', 30], 76: ['performanceRows', 30], 77: ['processRows', 30], 78: ['roomRows', 30], 79: ['planRows', 30], 80: ['gateRows', 30] };
  for (const [n, [key, limit]] of Object.entries(expected)) {
    const c = tool(await phase4.loadLesson(Number(n)), 'rowLog');
    assert.equal(c.stateKey, key); assert.equal(c.limit, limit); assert.equal(rows.rowSpecs[key].limit, limit);
    for (const k of rows.rowSpecs[key].keys) assert.ok(c.prefix.some(p => p.key === k) || c.keys.some(p => p.key === k), `${n} ${k}`);
    const sample = Object.fromEntries(c.inputs.map(i => [i.domId, i.kind === 'select' ? i.options[0] : i.kind === 'checkbox' ? false : `v-${i.domId}`]));
    const one = rows.addRow([], sample, c).rows;
    assert.equal(rows.normalizeRowList(one, key).length, 1, `${n} row survives normalisation`);
    for (const opt of c.inputs.filter(i => i.kind === 'select')) for (const o of opt.options) assert.ok(templates[n].includes(`<option>${o}</option>`));
    if (c.counts) assert.ok(js.includes(JSON.stringify(c.counts.options).replace(/"/g, "'")), `${n} counts options`);
  }
});

test('Lesson 67 pipeline: stage moves need a different stage and a note; history capped at 40; remove', async () => {
  const c67 = tool(await phase4.loadLesson(67), 'pipeline67');
  assert.deepEqual(c67.inputs.find(i => i.domId === 'dealStage67').options, pipeline.pipeStages67);
  assert.ok(js.includes(`const pipeStages67=${JSON.stringify(pipeline.pipeStages67).replace(/"/g, "'")};`));
  const deal = rows.addRow([], { dealId67: 'D1', dealStage67: 'New', dealContext67: 'c', dealEvidence67: 'e', dealOwner67: 'o' }, c67).rows;
  assert.deepEqual(Object.keys(deal[0]), ['stage', 'status', 'history', 'id', 'context', 'evidence', 'owner']);
  assert.deepEqual(deal[0].history, []);
  assert.deepEqual(pipeline.moveDeal(deal, 0, 'New', 'note'), { error: 'Choose a different simulated stage.' });
  assert.deepEqual(pipeline.moveDeal(deal, 0, 'Qualified', '  '), { error: 'Enter a transition evidence/next-action note; nothing moved.' });
  const now = new Date('2026-01-01T00:00:00Z');
  const moved = pipeline.moveDeal(deal, 0, 'Qualified', ' fit confirmed ', now);
  assert.equal(moved.message, 'Simulated stage updated locally; no buyer outcome or revenue verified.');
  assert.equal(moved.rows[0].stage, 'Qualified');
  assert.deepEqual(moved.rows[0].history, [{ from: 'New', to: 'Qualified', note: 'fit confirmed', at: '2026-01-01T00:00:00.000Z', status: 'simulated, not verified' }]);
  assert.deepEqual(Object.keys(moved.rows[0]), Object.keys(deal[0]), 'key order kept');
  const full40 = [{ ...deal[0], history: Array.from({ length: 40 }, () => ({})) }];
  assert.deepEqual(pipeline.moveDeal(full40, 0, 'Proposal', 'n'), { error: 'Local history limit: 40 moves. Export before more work.' });
  assert.equal(rows.cardText(moved.rows[0], c67.card), `D1 · Simulated / not verified\nContext: c\nEvidence: e\nOwner/next action: o\nHistory: ${JSON.stringify(moved.rows[0].history)}`);
  assert.equal(rows.countsText(moved.rows, c67.counts), 'Simulated-board counts only: New 0 · Qualified 1 · Evaluation 0 · Proposal 0 · Closed won 0 · Closed lost 0. No actual sales/revenue.');
  for (const s of [pipeline.board67.sameStage, pipeline.board67.noNote, pipeline.board67.historyLimit, pipeline.board67.moved, "' · simulated'", "'Target simulated stage for '", "'Transition evidence/next-action note for '", "'Move simulated record '"]) assert.ok(js.includes(s), s);
  assert.equal(c67.removeLabel, 'Remove pipeline record '); assert.equal(c67.removeBy, 'id');
});

test('Lesson 66 contribution calculator: normal, zero, blank, negative and range cases', () => {
  const base = { calcUnit66: 'per seat / USD / month', calcPrice66: '100', calcCost66: '40', calcFixed66: '1000' };
  assert.equal(calc.calculate66(base), 'Hypothetical only: contribution per unit 60.00; contribution / price 60.00%; units to cover stated fixed cost 17. Before excluded costs; not net profit, forecast, demand or price approval.');
  assert.match(calc.calculate66({ ...base, calcPrice66: '0', calcCost66: '0' }), /contribution per unit 0\.00; contribution \/ price undefined at zero price; units to cover stated fixed cost not achievable with nonpositive contribution/);
  assert.match(calc.calculate66({ ...base, calcCost66: '120' }), /contribution per unit -20\.00; contribution \/ price -20\.00%; units to cover stated fixed cost not achievable/);
  assert.match(calc.calculate66({ ...base, calcFixed66: '0' }), /units to cover stated fixed cost 0\./);
  const invalid = 'Enter unit/currency/period and finite nonnegative inputs; missing values are not zero.';
  for (const bad of [{ calcPrice66: '' }, { calcPrice66: '-1' }, { calcUnit66: ' ' }, { calcFixed66: 'abc' }, { calcCost66: undefined }]) assert.equal(calc.calculate66({ ...base, ...bad }), invalid);
  assert.equal(calc.calculate66({}), invalid);
  assert.equal(calc.calculate66({ ...base, calcPrice66: '1e308', calcCost66: '0', calcFixed66: '1e308' }), 'Hypothetical only: contribution per unit ' + (1e308).toFixed(2) + '; contribution / price 100.00%; units to cover stated fixed cost 1. Before excluded costs; not net profit, forecast, demand or price approval.');
  assert.equal(calc.calculate66({ ...base, calcPrice66: '1', calcCost66: '0.5', calcFixed66: '1e300' }), 'Scenario exceeds supported numeric range; use smaller inputs and compatible units.');
});

test('Lesson 73 activation rate calculator: rates, zero denominators, subsets and invalid counts', () => {
  const base = { rateContext73: 'cohort A / 14 days', rateEligible73: '200', rateActivated73: '50', rateActive73: '40', rateRepeat73: '10' };
  assert.equal(calc.calculateRate73(base), 'Scenario only: activation 25.00%; meaningful usage participation 20.00%; within-window repeat share 25.00%. Same compatible cohort/window required; repeat share is not retention. No source, behavior, causal improvement or traction verified.');
  assert.match(calc.calculateRate73({ ...base, rateEligible73: '0', rateActivated73: '0', rateActive73: '0', rateRepeat73: '0' }), /activation undefined \(zero denominator\); meaningful usage participation undefined \(zero denominator\); within-window repeat share undefined \(zero denominator\)/);
  assert.equal(calc.calculateRate73({ ...base, rateActivated73: '201' }), 'Incompatible subsets: activated/active cannot exceed eligible; repeat cannot exceed active.');
  assert.equal(calc.calculateRate73({ ...base, rateRepeat73: '41' }), 'Incompatible subsets: activated/active cannot exceed eligible; repeat cannot exceed active.');
  const invalid = 'Enter context and finite nonnegative whole counts; missing data is not zero.';
  for (const bad of [{ rateEligible73: '' }, { rateActive73: '-1' }, { rateRepeat73: '1.5' }, { rateContext73: '' }, { rateEligible73: '1e20' }]) assert.equal(calc.calculateRate73({ ...base, ...bad }), invalid);
});

test('Lesson 76 revenue/cost review calculator: subtotals, margins, negative cash, blanks and bounds', () => {
  const base = { reviewContext76: 'USD · Q1 2026 · scenario', reviewRevenue76: '10000', reviewDirect76: '4000', reviewOpex76: '3000', reviewOpening76: '5000', reviewReceipts76: '8000', reviewFunding76: '0', reviewPayments76: '9000' };
  assert.equal(calc.calculateReview76(base), 'Illustrative scenario only — USD · Q1 2026 · scenario · Gross subtotal: 6,000.00 · Gross margin: 60.00% · Operating subtotal: 3,000.00 (not net profit) · Closing cash bridge: 4,000.00 · No source, accounting classification or cash availability verified.');
  assert.match(calc.calculateReview76({ ...base, reviewRevenue76: '0' }), /Gross subtotal: -4,000\.00 · Gross margin: undefined \(zero net revenue\) · Operating subtotal: -7,000\.00/);
  assert.match(calc.calculateReview76({ ...base, reviewPayments76: '20000' }), /Closing cash bridge: -7,000\.00 · Negative closing cash: funding\/timing gap requires review\./);
  assert.equal(calc.calculateReview76({ ...base, reviewContext76: ' ' }), 'Enter currency, exact period and scenario/source limits.');
  const invalid = 'Enter every amount explicitly: finite non-negative values up to 1 trillion. Blank is unknown; zero must be entered.';
  for (const bad of [{ reviewDirect76: '' }, { reviewOpex76: '-5' }, { reviewFunding76: '1e13' }, { reviewReceipts76: 'x' }]) assert.equal(calc.calculateReview76({ ...base, ...bad }), invalid);
  assert.ok(js.includes(`const reviewIds76=${JSON.stringify(calc.reviewIds76).replace(/"/g, "'")};`));
});

test('calculator, agent prompt and brief configurations match the legacy markup', async () => {
  const c66 = tool(await phase4.loadLesson(66), 'calc66'), c73 = tool(await phase4.loadLesson(73), 'rate73'), c76 = tool(await phase4.loadLesson(76), 'review76');
  assert.deepEqual(c66.inputs.map(i => i.domId), ['calcUnit66', 'calcPrice66', 'calcCost66', 'calcFixed66']);
  assert.deepEqual(c73.inputs.map(i => i.domId), ['rateContext73', 'rateEligible73', 'rateActivated73', 'rateActive73', 'rateRepeat73']);
  assert.deepEqual(c76.inputs.map(i => i.domId), calc.reviewIds76);
  assert.equal(c66.changed, 'Inputs changed; recalculate. Hypothetical only.');
  assert.equal(c73.initial, 'Enter compatible scenario counts; no source or behavior verified.');
  for (const n of lessons) {
    const lesson = await phase4.loadLesson(n), p = tool(lesson, 'agentPrompt');
    assert.equal(p.roles.length, 3); assert.ok(p.filename.startsWith(`LYNQ-Lesson-${n}-`) && p.filename.endsWith('.md'));
    assert.match(p.suffix, /^\nBOUNDARIES: [\s\S]+\nCONTEXT \(inspect\/redact before sharing\):\n$/);
    for (const r of p.roles) assert.ok(p.tasks[r.role], `${n} ${r.role}`);
    const text = brief.buildAgentPrompt(p, p.roles[0].role, 'BRIEF');
    assert.equal(text, `ROLE: ${p.roles[0].role}\nTASK: ${p.tasks[p.roles[0].role]}${p.suffix}BRIEF`);
    assert.equal(p.emptyMessage, 'Prepare a role prompt first.');
    assert.ok(js.includes(p.tasks[p.roles[1].role].replace(/'/g, "\\'")));
  }
});

test('Markdown deliverables reproduce the legacy brief() for every lesson', async () => {
  const headings = { 61: ['Proposed channel tests', 'channelRows'], 66: ['Proposed packages / not approved or billed', 'packageRows'], 67: ['Simulated pipeline records / no actual sales or revenue', 'dealRows'], 73: ['Learner measurement records / source and behavior not verified', 'measureRows'], 76: ['Learner operating review / accounts and sources not verified', 'performanceRows'], 80: ['Learner traction assessment / evidence and scaling authority not verified', 'gateRows'] };
  for (const n of lessons) {
    const lesson = await phase4.loadLesson(n), cfg = configs[n];
    const b = tool(lesson, 'brief');
    if (headings[n]) { assert.equal(b.heading, headings[n][0]); assert.equal(b.key, headings[n][1]); }
    const s = { ...full(n), ...phase4.normalizeExtra(n, {}), fields: { ...full(n).fields, [cfg.fields[1][0]]: '' } };
    const row = Object.fromEntries(rows.rowSpecs[b.key].keys.map(k => [k, `v-${k}`]));
    const expectedRows = [b.key === 'dealRows' ? { ...row, history: [] } : row];
    s[b.key] = [row, { id: 3 }];
    if (b.extra) s[b.extra.key] = { input: '5' };
    const md = phase4.buildDeliverable(lesson, s, false);
    const expected = '# Lesson ' + n + ' — ' + cfg.title + '\n\nPlanning draft; learner-reported, not independently reviewed.\n\n'
      + cfg.fields.map(([id, label], i) => '## ' + label + '\n' + (i === 1 ? '[Missing]' : `Answer ${id}`)).join('\n\n')
      + '\n\n## Red-team review\nbias: Answer bias\ncounter: Answer counter\nconstraint: Answer constraint'
      + '\n\n## ' + b.heading + '\n' + JSON.stringify(expectedRows, null, 2)
      + (b.extra ? '\n\n' + b.extra.label + ':\n' + JSON.stringify({ input: '5' }, null, 2) : '')
      + '\n\nNo commercial approval, billing, campaign, outreach, spending, launch authorization or customer results verified.';
    assert.equal(md, expected, `brief ${n}`);
    assert.equal(lesson.deliverable.filename, cfg.filename);
    for (const id of schema(n).ids) assert.ok(id === cfg.fields[1][0] || md.includes(`Answer ${id}`));
  }
  const l66 = await phase4.loadLesson(66);
  assert.deepEqual(tool(l66, 'brief').extra, { label: 'Hypothetical calculator inputs (not validated results)', key: 'calc66' });
  assert.deepEqual(tool(await phase4.loadLesson(73), 'brief').extra, { label: 'Scenario rate inputs (not validated observations)', key: 'rate73' });
  assert.deepEqual(tool(await phase4.loadLesson(76), 'brief').extra, { label: 'Illustrative period calculator inputs (not verified accounts)', key: 'review76' });
  // A blank (reset) record still exports without crashing.
  assert.match(phase4.buildDeliverable(l66, state.blankState(), false), /## Proposed packages \/ not approved or billed\n\[\]\n\nHypothetical calculator inputs \(not validated results\):\n\{\}/);
});

test('module status counts validated completions in the lesson module', () => withStorage({}, () => {
  assert.equal(tools.moduleStatusText('4.2', [66, 67, 71], 'X'), 'Module 4.2: 2 / 5. X');
  assert.deepEqual(tools.moduleLessons('4.4'), [76, 77, 78, 79, 80]);
  localStorage.setItem(schema(62).key, JSON.stringify({ ...full(62), completed: true }));
  localStorage.setItem(schema(63).key, JSON.stringify({ ...full(63), completed: true, honest: false }));
  const html = renderToString(createElement(tools.ModuleStatus, { props: { module: '4.1', suffix: 'S' }, state: state.blankState() }));
  assert.match(html, /Module 4\.1: 1 \/ 5\. S/);
}));
