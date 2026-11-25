// Phase 5 (Scale, Lessons 81–100) migration tests.
// Parity is checked against curriculum.json, the extracted legacy configs/templates and — for every
// generated text (briefs, exports, prompts, CEO drafts, calculators, review checks) — against the legacy
// functions themselves, executed in an isolated node:vm sandbox with a stub DOM (test-time only).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { load, memoryStorage } from './helpers/bundle.mjs';
import { legacyScript, jsonConst, parseHtml, findAll } from './migration/legacy.mjs';
import { correctedDeep } from './migration/stale-corrections.mjs';

const curriculum = JSON.parse(readFileSync(new URL('../src/data/curriculum.json', import.meta.url)));
const LESSONS = Array.from({ length: 20 }, (_, i) => 81 + i);
const lessonFile = n => new URL(`../src/data/lessons/phase-5/lesson-${String(n).padStart(2, '0')}.json`, import.meta.url);
const lessons = Object.fromEntries(LESSONS.map(n => [n, JSON.parse(readFileSync(lessonFile(n)))]));
const dashboard = JSON.parse(readFileSync(new URL('../src/data/dashboards/phase-5.json', import.meta.url)));
const js = legacyScript(5);
const configs = correctedDeep(5, jsonConst(js, 'configs')), templates = correctedDeep(5, jsonConst(js, 'templates'));
const schema = n => curriculum.schemas[String(n)];
const blocks = n => lessons[n].sections.flatMap(s => s.blocks);
const extProps = (n, id) => blocks(n).filter(b => b.type === 'extension' && b.id === id).map(b => b.props);

const logic = await load('src/phases/phase5/logic.ts');
const state = await load('src/lesson-system/state.ts');
const phase5 = (await load('src/phases/phase5/index.ts')).default;
const escapeHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

// ------------------------------------------------------------------------------------------------
// Legacy sandbox.
function legacy() {
  const els = new Map(), store = new Map(), downloads = [];
  const el = () => ({ value: '', textContent: '', checked: false, style: {}, hidden: false, replaceChildren() {}, append() {}, addEventListener() {}, select() {} });
  const ctx = {
    document: { getElementById: id => { if (!els.has(id)) els.set(id, el()); return els.get(id); }, createElement: () => el(), createTextNode: () => ({}) },
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    setTimeout: () => 0, setInterval: () => 0, confirm: () => true, navigator: {}, __dl: downloads,
  };
  ctx.window = ctx; ctx.parent = ctx; ctx.addEventListener = () => {};
  vm.createContext(ctx);
  vm.runInContext(js, ctx);
  vm.runInContext('download=(v,n)=>__dl.push([v,n])', ctx);
  return {
    run: code => vm.runInContext(code, ctx),
    use(n, s) { vm.runInContext(`current=${n};c=configs[${n}];state=states[${n}]=${JSON.stringify(s)};`, ctx); },
    downloads,
  };
}
const L = legacy();

// A rich, realistic record for lesson n: every field, tool inputs and records of every kind.
const KINDS = ['Unknown / evidence needed', 'Learner-reported evidence / not verified', 'Contrary evidence / review needed', 'Critical blocker / Hold'];
function richState(n, variant = 0) {
  const s = { ...state.blankState(), fields: {}, answers: { 0: 1, 1: 0, 2: 2 }, studied: true, honest: true };
  for (const f of lessons[n].fields) s.fields[f.id] = `${f.id} value ${variant} “quoted” & <tag>`;
  if (variant === 1) { s.fields[lessons[n].fields[1].id] = '   '; delete s.fields[lessons[n].fields[2].id]; }
  for (const panel of extProps(n, 'checkPanel')) panel.items.forEach((item, i) => { s.fields[item.id] = variant === 1 ? 'not a label' : panel.options[(i + variant) % 4]; });
  Object.assign(s.fields, { calcRevenue84: '500', calcCost84: '200', calcSpend84: '6000', calcNew84: '10', calcOverhead84: '1000', calcRecurring84: 'yes',
    cohortEligible85: '40', cohortRetained85: '13', cohortConfirmed85: 'yes', cash92: '100000', reserve92: '20000', outflow92: '15000', inflow92: '5000',
    preMoney97: '4000000', investment97: '1000000', founderBefore97: '60', nextPre97: variant ? '' : '9000000', nextInvestment97: variant ? '' : '3000000', currency97: variant ? 'GBP' : 'USD' });
  const key = extProps(n, 'recordLog')[0].stateKey;
  s[key] = variant === 1 ? [] : KINDS.map((kind, i) => ({ kind, id: `E${i}`, source: `src ${i}`, text: `text ${i}`, meaning: `meaning ${i}`, review: `review ${i}` }));
  return phase5.normalizeExtra(n, s) && state.normalizeState(s, raw => phase5.normalizeExtra(n, raw));
}

// ------------------------------------------------------------------------------------------------
test('phase module: revokes completion on any edit (legacy save) and is fully native', () => {
  assert.equal(phase5.revokeOnAnyEdit, true);
  for (const id of ['story', 'videoPrompt', 'coach', 'recordLog', 'checkPanel', 'calculator', 'promptWorkbench', 'ceoWorkbench', 'brief', 'moduleStatus', 'graduation100']) assert.equal(typeof phase5.extensions[id], 'function', id);
});

test('parity: titles, keys, fields, quiz, scenes, prompts and filenames match curriculum and legacy', () => {
  for (const n of LESSONS) {
    const l = lessons[n], cfg = configs[n], sc = schema(n), t = templates[n];
    assert.equal(l.number, n); assert.equal(l.phase, 5);
    assert.equal(l.title, curriculum.names[n]); assert.equal(l.title, cfg.title);
    assert.equal(sc.key, `lynq.scale.lesson${n}.v1`, 'legacy storage key');
    assert.equal(l.module, cfg.module);
    assert.deepEqual(l.fields.filter(f => f.required).map(f => f.id).sort(), [...sc.ids].sort(), `required set ${n}`);
    assert.deepEqual(l.fields.map(f => f.id), sc.ids);
    for (const [id, label] of cfg.fields) assert.equal(l.fields.find(f => f.id === id).label, label);
    const nodes = parseHtml(t);
    for (const id of ['bias', 'counter', 'constraint']) {
      const legacyLabel = findAll(nodes, x => x.tag === 'label' && x.attrs.for === id)[0];
      const flat = node => typeof node === 'string' ? node : node.children.map(flat).join('');
      assert.equal(l.fields.find(f => f.id === id).label, flat(legacyLabel).replace(/\s+/g, ' ').trim().replace(/ \*$/, ''));
    }
    assert.deepEqual(l.questions, cfg.questions.map(([prompt, options, answer, explanation]) => ({ prompt, options, answer, explanation })));
    assert.deepEqual(l.questions.map(q => q.answer), sc.keys);
    const story = extProps(n, 'story')[0];
    assert.equal(story.scenes.length, cfg.scenes.length);
    assert.deepEqual(story.scenes.map(s => [s.title, s.visual, s.narration]), cfg.scenes);
    const vp = extProps(n, 'videoPrompt')[0];
    assert.equal(vp.prompt, cfg.prompt);
    assert.equal(vp.filename, `LYNQ-Lesson-${n}-Gemini-Video-Prompt.md`);
    assert.ok(t.includes(`download(c.prompt,'${vp.filename}')`));
    assert.equal(l.deliverable.filename, cfg.filename);
    assert.equal(l.deliverable.title, `Lesson ${n} — ${cfg.title}`);
    assert.equal(sc.artifact, false); assert.equal(sc.releaseAck, false);
    assert.equal(blocks(n).filter(b => b.type === 'flag').length, 0, 'no artifact/release flags in Scale');
    assert.deepEqual(lessons[n].sections.map(s => s.label), ['01 / WATCH', '02 / LEARN', '03 / BUILD', '04 / ASK AI COACH', '05 / CHALLENGE', '06 / KNOWLEDGE CHECK', '07 / DELIVER & PROGRESS']);
    const complete = blocks(n).find(b => b.type === 'complete');
    assert.equal(complete.label, `Mark Lesson ${n} complete locally`);
    assert.equal(complete.completedNotice, `Lesson ${n} self-completed locally. This records learning, not scaling readiness or expansion approval.`);
    assert.ok(js.includes(complete.completedNotice.replace(String(n), "'+current+'")));
    // Practice: two options with legacy feedback (i===1 vs other).
    const practice = blocks(n).find(b => b.type === 'practice');
    assert.equal(practice.options.length, 2);
    L.use(n, richState(n));
    for (const i of [0, 1]) { L.run(`practice(${i})`); assert.equal(practice.options[i].feedback, L.run("$('practiceFeedback').textContent")); }
    // Coach replies for every mode.
    const coach = extProps(n, 'coach')[0];
    assert.deepEqual(coach.modes, ['Explain', 'Guide', 'Challenge', 'Review']);
    for (const mode of coach.modes) { L.run(`coachMode('${mode}')`); assert.equal(logic.coachReply(coach.prefix, mode, coach.suffix), L.run("$('chat').textContent")); }
  }
});

test('all curriculum text is carried over (LEARN prose, notes, links) without legacy controls', () => {
  const textOf = nodes => nodes.map(x => typeof x === 'string' ? x : textOf(x.children)).join('');
  for (const n of LESSONS) {
    const learn = lessons[n].sections.find(s => s.id === 'learn').blocks.filter(b => b.type === 'content').map(b => textOf(b.nodes)).join(' ');
    const legacyArticle = findAll(parseHtml(templates[n]), x => x.tag === 'article')[1];
    const flat = node => typeof node === 'string' ? node : node.tag === 'button' ? '' : node.children.map(flat).join('');
    const words = s => s.replace(/\s+/g, ' ').trim();
    for (const li of findAll([legacyArticle], x => x.tag === 'li')) assert.ok(words(learn).includes(words(flat(li))), `lesson ${n} learn item`);
    const json = JSON.stringify(lessons[n]);
    assert.doesNotMatch(json, /onclick|<script|<button|javascript:/i);
  }
});

// ------------------------------------------------------------------------------------------------
test('every lesson renders natively with all labels, quiz prompts and tools', async () => {
  const { LessonView } = await load('src/lesson-system/LessonPage.tsx');
  const old = globalThis.localStorage;
  try {
    for (const n of LESSONS) {
      for (const saved of [null, richState(n)]) {
        globalThis.localStorage = memoryStorage(saved ? { [schema(n).key]: JSON.stringify(saved) } : {});
        const html = renderToString(createElement(LessonView, { lesson: lessons[n], module: phase5, navigate() {}, onProgress() {} })).replace(/<!-- -->/g, '');
        assert.doesNotMatch(html, /<iframe|<script|Missing lesson tool/);
        assert.ok(html.includes(escapeHtml(lessons[n].hero.title)), `title ${n}`);
        for (const f of lessons[n].fields) assert.ok(html.includes(escapeHtml(f.label)), `label ${n} ${f.id}`);
        for (const q of lessons[n].questions) assert.ok(html.includes(escapeHtml(q.prompt)), `quiz ${n}`);
        const log = extProps(n, 'recordLog')[0];
        for (const label of [log.title, log.addLabel, log.exportLabel, log.idField.label, ...log.columns.map(c => c.label)]) assert.ok(html.includes(escapeHtml(label)), `log ${n} ${label}`);
        for (const panel of extProps(n, 'checkPanel')) for (const label of [panel.title, ...panel.items.map(i => i.label)]) assert.ok(html.includes(escapeHtml(label)));
        for (const calc of extProps(n, 'calculator')) for (const item of calc.items) assert.ok(html.includes(escapeHtml(item.label)), `calc ${n} ${item.id}`);
        for (const tool of [...extProps(n, 'promptWorkbench'), ...extProps(n, 'ceoWorkbench')]) for (const b of tool.buttons) assert.ok(html.includes(escapeHtml(b.label)));
        assert.ok(html.includes(`Mark Lesson ${n} complete locally`));
        assert.ok(html.includes(escapeHtml(`Module ${lessons[n].module}: 0 / 5. Lessons 81–99 interactive; Lesson 100 previews. Learning does not approve expansion.`)));
        if (saved) {
          assert.ok(html.includes('5 / 5 requirements'), `checklist ${n}`);
          assert.ok(html.includes(escapeHtml(logic.countsText(log, saved[log.stateKey]))));
          assert.ok(html.includes(escapeHtml(logic.cardText(log, saved[log.stateKey][0]))));
          for (const panel of extProps(n, 'checkPanel')) assert.ok(html.includes(escapeHtml(logic.checkResult(panel, saved))));
        }
      }
    }
    // Lesson 84 calculator output is rendered.
    globalThis.localStorage = memoryStorage({ [schema(84).key]: JSON.stringify(richState(84)) });
    const html = renderToString(createElement(LessonView, { lesson: lessons[84], module: phase5, navigate() {}, onProgress() {} }));
    assert.ok(html.includes('Contribution/customer-month: 300.00'));
  } finally { globalThis.localStorage = old; }
});

test('Scale dashboard renders natively with hero, all module cards and 20 lesson links', async () => {
  const { DashboardView } = await load('src/lesson-system/PhaseDashboard.tsx');
  assert.equal(dashboard.phase, 5);
  assert.equal(dashboard.hero.title, 'Build capacity for responsible growth.');
  assert.deepEqual(dashboard.modules.map(m => m.code), ['5.1', '5.2', '5.3', '5.4']);
  assert.deepEqual(dashboard.modules.map(m => m.title), curriculum.phases[4].modules.map(m => m.split(' · ')[1]));
  assert.deepEqual(dashboard.modules.flatMap(m => m.lessons.map(l => l.number)), LESSONS);
  for (const l of dashboard.modules.flatMap(m => m.lessons)) { assert.equal(l.title, curriculum.names[l.number]); assert.equal(l.summary, '', 'status-only "Interactive" label removed'); }
  const old = globalThis.localStorage;
  globalThis.localStorage = memoryStorage();
  try {
    const html = renderToString(createElement(DashboardView, { dashboard, navigate() {}, progress: { complete: [81, 82], orientation: false } })).replace(/<!-- -->/g, '');
    assert.doesNotMatch(html, /<iframe|<script/);
    for (const n of LESSONS) assert.ok(html.includes(escapeHtml(curriculum.names[n])), `dashboard lesson ${n}`);
    assert.equal((html.match(/class="lesson-row"/g) || []).length, 20);
    assert.ok(html.includes('PHASE 05 · SCALE'));
    assert.ok(html.includes('Four modules, five lessons each, covering growth, organization, capital and long-term strategy.'));
    assert.doesNotMatch(html, /interactive|Browser-local prototype/i);
    assert.ok(html.includes('2 / 20'));
    assert.ok(html.includes('Progress is saved in this browser. Learning progress is separate from business readiness.'));
  } finally { globalThis.localStorage = old; }
});

// ------------------------------------------------------------------------------------------------
test('normalizeExtra mirrors legacy load(): malformed registers dropped, limits kept, other keys preserved', () => {
  const good = i => ({ id: `R${i}`, kind: KINDS[i % 4], source: 's', text: 't', meaning: 'm', review: 'r' });
  const raw = {
    readyRows: [good(1), null, 'x', 7, [], { id: 'bad', kind: 'k', source: 's', text: 't', meaning: 'm' }, { ...good(2), extra: 1 }, { ...good(3), review: 5 }],
    econRows: Array.from({ length: 45 }, (_, i) => good(i)),
    finalRows: 'not an array', kpiRows: { 0: good(1) },
    calcRevenue84: 'kept', someFutureKey: { a: 1 },
  };
  const out = phase5.normalizeExtra(81, raw);
  assert.deepEqual(out.readyRows, [good(1), { ...good(2), extra: 1 }]);
  assert.equal(out.econRows.length, 30);
  assert.deepEqual(out.finalRows, []); assert.deepEqual(out.kpiRows, []);
  assert.equal(out.calcRevenue84, 'kept'); assert.deepEqual(out.someFutureKey, { a: 1 });
  assert.deepEqual(Object.keys(out).filter(k => k.endsWith('Rows')).sort(), [...logic.ROW_KEYS].sort());
  // Same result as the legacy loader for the register keys.
  const legacyLoaded = JSON.parse(L.run(`localStorage.setItem('lynq.scale.lesson81.v1', ${JSON.stringify(JSON.stringify(raw))}); JSON.stringify(load(81))`));
  for (const key of logic.ROW_KEYS) assert.deepEqual(out[key], legacyLoaded[key], key);
  // Whole-record normalisation never crashes.
  for (const bad of [null, 'x', 42, [], { fields: [], answers: 'no', readyRows: 'x' }]) {
    const s = state.normalizeState(bad, r => phase5.normalizeExtra(81, r));
    assert.deepEqual(s.readyRows, []); assert.equal(s.completed, false);
  }
});

test('completion: explicit, all fields required (incl. red-team), quiz checked, revoked on ANY edit', () => {
  for (const n of [81, 90, 97, 100]) {
    const sc = schema(n), full = richState(n);
    assert.equal(state.requirementsMet(full, sc), true);
    for (const id of sc.ids) assert.equal(state.requirementsMet({ ...full, fields: { ...full.fields, [id]: ' ' } }, sc), false, id);
    assert.equal(state.requirementsMet({ ...full, answers: { 0: 0, 1: 0, 2: 2 } }, sc), false, 'wrong answer');
    assert.equal(state.requirementsMet({ ...full, answers: { 0: '1', 1: '0', 2: '2' } }, sc), true, 'string answers accepted like legacy Number()');
    assert.equal(state.quizCorrect({ ...full, answers: { 0: 1, 1: 0 } }, sc.keys), false);
    assert.equal(state.requirementsMet({ ...full, studied: false }, sc), false);
    assert.equal(state.requirementsMet({ ...full, honest: false }, sc), false);
    const tools = { ...full, fields: { ...full.fields, calcRevenue84: '', partnerFit86: '' } };
    assert.equal(state.requirementsMet(tools, sc), true, 'optional tools never gate completion');
    assert.equal(state.applyEdit(full, { studied: true }, sc, phase5.revokeOnAnyEdit).completed, false, 'edits never complete');
    const done = state.markComplete(full, sc);
    assert.equal(done.completed, true);
    assert.equal(state.markComplete({ ...full, honest: false }, sc), null);
    assert.equal(state.applyEdit(done, { fields: { ...done.fields, calcRevenue84: '1' } }, sc, phase5.revokeOnAnyEdit).completed, false, 'tool edit revokes');
    assert.equal(state.applyEdit(done, { [extProps(n, 'recordLog')[0].stateKey]: [] }, sc, phase5.revokeOnAnyEdit).completed, false, 'register edit revokes');
    // Legacy valid() agrees.
    L.use(n, full); assert.equal(Boolean(L.run(`valid(${n})`)), true);
    L.use(n, { ...full, honest: false }); assert.equal(Boolean(L.run(`valid(${n})`)), false);
  }
});

// ------------------------------------------------------------------------------------------------
test('brief (main deliverable) matches legacy brief() for every lesson; filename and caveats', () => {
  for (const n of LESSONS) for (const variant of [0, 1, 2]) {
    const s = variant === 2 ? state.normalizeState({}, r => phase5.normalizeExtra(n, r)) : richState(n, variant);
    L.use(n, s);
    const md = logic.buildBrief(lessons[n], s);
    assert.equal(md, L.run('brief()'), `brief ${n}/${variant}`);
    assert.equal(phase5.buildDeliverable(lessons[n], s, false), md);
    assert.ok(md.startsWith(`# Lesson ${n} — ${curriculum.names[n]}\n\nLearner assessment; evidence/decision authority not verified.`));
    for (const f of lessons[n].fields.slice(0, 8)) assert.ok(md.includes(`## ${f.label}\n`));
    assert.ok(md.includes('## Red-team\nbias: '));
    assert.ok(md.endsWith('\n\nNo test, expansion or spending authorized/executed.'));
    if (variant === 2) assert.ok(md.includes('[Missing]'));
  }
  L.use(84, richState(84)); L.run('exportBrief()');
  assert.deepEqual(L.downloads.at(-1)[1], lessons[84].deliverable.filename);
});

test('evidence registers: add rules, filters, counts, cards and JSON export match legacy', () => {
  for (const n of LESSONS) {
    const c = extProps(n, 'recordLog')[0];
    const Stem = { 81: 'Ready', 82: 'Bottle', 83: 'Growth', 84: 'Econ', 85: 'Retain', 86: 'Partner', 87: 'Org', 88: 'Leader', 89: 'Process', 90: 'Kpi', 91: 'Control', 92: 'Capital', 93: 'Diligence', 94: 'Expansion', 95: 'Governance', 96: 'Strategic', 97: 'Valuation', 98: 'Transition', 99: 'Exit', 100: 'Final' }[n];
    const stem = Stem[0].toLowerCase() + Stem.slice(1);
    assert.equal(c.limit, 30);
    assert.deepEqual(c.kindField.options, KINDS);
    assert.equal(c.exportFilename.endsWith('.json'), true);
    // Legacy add sequence vs native addRecord.
    const s = richState(n, 1);
    L.use(n, s);
    let rows = [];
    const attempts = [
      { kind: KINDS[2], id: ' A1 ', source: 's', text: 't', meaning: 'm', review: 'r' },
      { kind: KINDS[0], id: 'a1', source: 's', text: 't', meaning: 'm', review: 'r' },
      { kind: KINDS[0], id: 'B', source: 's', text: '  ', meaning: 'm', review: 'r' },
      { kind: KINDS[1], id: 'B', source: ' s2 ', text: 't2', meaning: 'm2', review: 'r2' },
    ];
    for (const a of attempts) {
      L.run(`$('${stem}Kind${n}').value=${JSON.stringify(a.kind)};` + ['Id', 'Source', 'Text', 'Meaning', 'Review'].map(k => `$('${stem}${k}${n}').value=${JSON.stringify(a[k.toLowerCase()])};`).join('') + `add${Stem}${n}()`);
      const result = logic.addRecord(rows, a, c);
      const legacyMsg = L.run(`$('${stem}Status${n}').textContent`);
      if ('error' in result) assert.equal(result.error, legacyMsg); else { rows = result.rows; assert.equal(c.messages.added, legacyMsg); }
    }
    assert.equal(JSON.stringify(rows), L.run(`JSON.stringify(state.${c.stateKey})`));
    const full = Array.from({ length: 30 }, (_, i) => ({ kind: KINDS[0], id: `X${i}`, source: 's', text: 't', meaning: 'm', review: 'r' }));
    assert.deepEqual(logic.addRecord(full, { kind: KINDS[0], id: 'new', source: 's', text: 't', meaning: 'm', review: 'r' }, c), { error: c.messages.limit });
    assert.match(c.messages.limit, /30 records/);
    // Counts, cards, filter.
    const rich = richState(n);
    L.use(n, rich);
    L.run(`render${Stem}${n}()`);
    assert.equal(logic.countsText(c, rich[c.stateKey]), L.run(`$('${stem}Counts${n}').textContent`));
    const legacyCard = new Function('row', `return ${/card\.textContent=(.*?);let b=/s.exec(js.slice(js.indexOf(`function render${Stem}${n}(`)))[1]}`);
    for (const row of rich[c.stateKey]) assert.equal(logic.cardText(c, row), legacyCard(row));
    if (n >= 90) {
      assert.ok(c.filter, `filter ${n}`);
      assert.deepEqual(logic.visibleRows(rich[c.stateKey], c, true).map(x => x.row.kind), [KINDS[0], KINDS[2], KINDS[3]]);
      assert.equal(logic.visibleRows(rich[c.stateKey], c, false).length, 4);
      L.run(`filter${Stem}${n}(true)`); assert.equal(logic.filterStatus(c, true), L.run(`$('${stem}FilterStatus${n}').textContent`));
      L.run(`filter${Stem}${n}(false)`); assert.equal(logic.filterStatus(c, false), L.run(`$('${stem}FilterStatus${n}').textContent`));
    } else assert.equal(c.filter, null);
    assert.deepEqual(logic.removeRecord(rich[c.stateKey], 1).map(r => r.id), ['E0', 'E2', 'E3']);
    // JSON export.
    L.run(`export${Stem}${n}()`);
    const [value, name] = L.downloads.at(-1);
    assert.equal(name, c.exportFilename);
    assert.equal(logic.recordExport(c, lessons[n], rich), value, `export ${n}`);
  }
});

test('check-review panels (86–100): labels normalised, blockers dominate, wording matches legacy', () => {
  for (const n of LESSONS.filter(n => n >= 86)) {
    const panel = extProps(n, 'checkPanel')[0];
    assert.equal(panel.items.length, 4);
    const combos = [[0, 0, 0, 0], [1, 1, 1, 1], [1, 2, 1, 1], [1, 3, 2, 0], [0, 1, 1, 1], [2, 1, 1, 1], [1, 1, 1, 3]];
    for (const combo of [...combos, null]) {
      const s = richState(n);
      panel.items.forEach((item, i) => { s.fields[item.id] = combo ? panel.options[combo[i]] : 'tampered'; });
      L.use(n, s);
      assert.deepEqual(logic.checkValues(panel, s), JSON.parse(L.run(`JSON.stringify(${panel.valuesFn}())`)));
      assert.equal(logic.checkResult(panel, s), L.run(`${panel.resultFn}()`));
    }
    const s = richState(n); panel.items.forEach(item => { s.fields[item.id] = panel.options[1]; });
    assert.match(logic.checkResult(panel, s), /not approved/);
    s.fields[panel.items[0].id] = panel.options[3];
    assert.match(logic.checkResult(panel, s), /^Hold/);
  }
});

test('calculators: Lesson 84 unit economics', () => {
  const run = f => logic.calcResult84({ ...state.blankState(), fields: f });
  const base = { calcRevenue84: '500', calcCost84: '200', calcSpend84: '6000', calcNew84: '10', calcOverhead84: '1000', calcRecurring84: 'yes' };
  assert.equal(run(base), 'Scenario arithmetic only — inputs/results not verified.\nContribution/customer-month: 300.00\nContribution margin: 60.00%\nCAC: 600.00\nSimple payback: 2.00 months (constant contribution, retention and payment assumed)\nSimple overhead coverage: 4 customer-months (excludes acquisition, capacity changes and cash timing)\nNo LTV, net profit, growth approval or cash sufficiency established.');
  assert.match(run({}), /Contribution\/customer-month: unknown — enter revenue and variable cost/);
  assert.match(run({ ...base, calcNew84: '0' }), /CAC: undefined/);
  assert.match(run({ ...base, calcRecurring84: 'no' }), /Simple payback: not calculated/);
  assert.match(run({ ...base, calcCost84: '600' }), /Contribution\/customer-month: -100.00[\s\S]*Simple payback: not calculated[\s\S]*overhead coverage: not calculated/);
  assert.match(run({ ...base, calcRevenue84: '0', calcCost84: '0' }), /Contribution margin: undefined/);
  for (const bad of [{ calcRevenue84: '-1' }, { calcCost84: 'abc' }, { calcNew84: '2.5' }, { calcSpend84: 'Infinity' }]) assert.match(run({ ...base, ...bad }), /Invalid input/);
});

test('calculators: Lesson 85 cohort retention', () => {
  const run = f => logic.cohortResult85({ ...state.blankState(), fields: f });
  assert.equal(run({ cohortEligible85: '40', cohortRetained85: '13', cohortConfirmed85: 'yes' }), 'Scenario arithmetic only — cohort and results not verified.\nRetention under your definition: 32.50% (13 / 40)\nNot verified churn cause, renewal/revenue retention, causal lift or LTV.');
  assert.match(run({ cohortEligible85: '40' }), /unknown — enter both counts; unknown is not zero/);
  assert.match(run({ cohortEligible85: '0', cohortRetained85: '0', cohortConfirmed85: 'yes' }), /undefined — eligible denominator is zero/);
  assert.match(run({ cohortEligible85: '10', cohortRetained85: '11', cohortConfirmed85: 'yes' }), /Invalid input/);
  assert.match(run({ cohortEligible85: '-1', cohortRetained85: '0' }), /Invalid input/);
  assert.match(run({ cohortEligible85: '10.5', cohortRetained85: '1' }), /Invalid input/);
  assert.match(run({ cohortEligible85: '10', cohortRetained85: '1' }), /not calculated — confirm/);
});

test('calculators: Lesson 92 runway and Lesson 97 dilution', () => {
  const r = f => logic.runwayResult92({ ...state.blankState(), fields: f });
  assert.equal(r({ cash92: '100000', reserve92: '20000', outflow92: '15000', inflow92: '5000' }), 'Estimated months above reserve: 8.0; monthly net cash outflow: 10000.00. Constant-flow estimate, not verified runway or funding authority.');
  assert.match(r({ cash92: '100' }), /^Needs inputs — blank is unknown, not zero/);
  assert.match(r({ cash92: '10', reserve92: '10', outflow92: '1', inflow92: '0' }), /^Hold — available cash is at or below/);
  assert.match(r({ cash92: '10', reserve92: '0', outflow92: '1', inflow92: '1' }), /^No depletion projected/);
  assert.match(r({ cash92: '-5', reserve92: '0', outflow92: '1', inflow92: '0' }), /^Invalid input/);
  assert.match(r({ cash92: 'x', reserve92: '0', outflow92: '1', inflow92: '0' }), /^Invalid input/);
  const d = f => logic.dilutionResult97({ ...state.blankState(), fields: f });
  const one = d({ preMoney97: '4000000', investment97: '1000000', founderBefore97: '60', currency97: 'USD' });
  assert.match(one, /^Illustrative USD primary-priced-round scenario/);
  assert.match(one, /Round1 post-money: 5000000.00;new investor: 20.00%;existing holders collectively: 80.00%/);
  assert.match(one, /Founder: 60.00% → 48.00%;change: 12.00 percentage points/);
  assert.match(d({ preMoney97: '4000000', investment97: '1000000', founderBefore97: '60', nextPre97: '9000000', nextInvestment97: '3000000' }), /Round2 post-money: 12000000.00;new round2 investor: 25.00%;prior round1 investor: 15.00%;founder: 36.00%/);
  assert.match(d({ preMoney97: '4000000', investment97: '1000000', founderBefore97: '60', nextPre97: '9000000' }), /Round2 unknown — enter both/);
  assert.equal(d({}), 'Needs inputs — blank is unknown,not zero.');
  for (const bad of [{ preMoney97: '0' }, { founderBefore97: '101' }, { investment97: '-1' }, { preMoney97: '2e12' }, { investment97: 'abc' }]) assert.match(d({ preMoney97: '1', investment97: '1', founderBefore97: '50', ...bad }), /^Invalid input/);
  assert.equal(logic.dilutionValues97({ ...state.blankState(), fields: { currency97: 'GBP' } }).currency97, 'AED');
});

test('calculators match the legacy implementations across a grid of inputs', () => {
  const vals = ['', '0', '1', '2.5', '-3', 'abc', '100', '1e13', ' 7 '];
  const fields = [];
  for (let i = 0; i < 400; i++) {
    const pick = k => vals[(i * 7 + k * 13 + (i >> k)) % vals.length];
    fields.push({ calcRevenue84: pick(1), calcCost84: pick(2), calcSpend84: pick(3), calcNew84: pick(4), calcOverhead84: pick(5), calcRecurring84: i % 2 ? 'yes' : 'no',
      cohortEligible85: pick(6), cohortRetained85: pick(7), cohortConfirmed85: i % 3 ? 'yes' : '', cash92: pick(1), reserve92: pick(3), outflow92: pick(5), inflow92: pick(7),
      preMoney97: pick(2), investment97: pick(4), founderBefore97: pick(6), nextPre97: pick(8), nextInvestment97: pick(1), currency97: ['AED', 'USD', 'EUR', 'X'][i % 4] });
  }
  for (const [n, fns] of [[84, ['calcResult84']], [85, ['cohortResult85']], [92, ['runwayResult92']], [97, ['dilutionResult97']]]) for (const f of fields) {
    const s = { ...state.blankState(), fields: f };
    L.use(n, s);
    for (const fn of fns) assert.equal(logic[fn](s), L.run(`${fn}()`), `${fn} ${JSON.stringify(f)}`);
  }
});

test('agent prompts (every role) and CEO drafts (every mode) match legacy text and filenames', () => {
  for (const n of LESSONS) for (const variant of [0, 1]) {
    const s = richState(n, variant);
    const p = extProps(n, 'promptWorkbench')[0];
    const Stem = { 81: 'Ready', 82: 'Bottle', 83: 'Growth', 84: 'Econ', 85: 'Retain', 86: 'Partner', 87: 'Org', 88: 'Leader', 89: 'Process', 90: 'Kpi', 91: 'Control', 92: 'Capital', 93: 'Diligence', 94: 'Expansion', 95: 'Governance', 96: 'Strategic', 97: 'Valuation', 98: 'Transition', 99: 'Exit', 100: 'Final' }[n];
    const area = /\$\('(\w+Prompt\d+)'\)\.value='ROLE/.exec(js.slice(js.indexOf(`function prepare${Stem}${n}(`)))[1];
    assert.equal(p.clearOnEdit, n >= 93);
    assert.equal(p.emptyMessage, 'Prepare a role prompt first.');
    assert.deepEqual(p.buttons.map(b => b.role).sort(), Object.keys(p.tasks).sort());
    L.use(n, s);
    for (const { role } of p.buttons) {
      L.run(`prepare${Stem}${n}('${role}')`);
      assert.equal(logic.buildPrompt(p, role, logic.buildBrief(lessons[n], s)), L.run(`$('${area}').value`), `prompt ${n} ${role}`);
    }
    L.run(`export${Stem}Prompt${n}()`);
    assert.equal(L.downloads.at(-1)[1], p.filename);
    for (const ceo of extProps(n, 'ceoWorkbench')) for (const { mode } of [...ceo.buttons, { mode: 'unknown-mode' }]) {
      L.run(`buildCeo${n}('${mode}')`);
      assert.equal(logic.buildCeoDraft(ceo, mode, lessons[n], s), L.run(`$('ceoDraft${n}').value`), `ceo ${n} ${mode}`);
      L.run(`exportCeo${n}()`);
      assert.equal(L.downloads.at(-1)[1], ceo.filename);
    }
  }
  // Empty-draft messages.
  for (const n of LESSONS.filter(n => n >= 93 && n < 100)) {
    const ceo = extProps(n, 'ceoWorkbench')[0];
    L.use(n, richState(n)); L.run(`$('ceoDraft${n}').value='';exportCeo${n}()`);
    assert.equal(ceo.emptyMessage, L.run(`$('ceoDraft${n}').value`));
  }
});

// ------------------------------------------------------------------------------------------------
test('graduation (Lesson 100): orientation + all 100 lessons incl. artifactReady 45 and releaseAck50 50; learning only', async () => {
  const progress = await load('src/progress.ts');
  const { LessonView } = await load('src/lesson-system/LessonPage.tsx');
  const full = n => ({ ...state.blankState(), fields: Object.fromEntries(schema(n).ids.map(id => [id, 'x'])), answers: Object.fromEntries(schema(n).keys.map((k, i) => [i, k])), studied: true, honest: true, completed: true });
  const all = (patch = {}) => Object.fromEntries(Object.keys(curriculum.schemas).map(n => [schema(n).key, JSON.stringify({ ...full(n), artifactReady: true, releaseAck50: true, ...(patch[n] || {}) })]));
  const orientation = { 'lynq.orientation.v1': JSON.stringify({ answers: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }, profileCompleted: true, completed: true }),
    'lynq.orientation.lesson.v1': JSON.stringify({ studied: true, honest: true, answers: { 0: 1, 1: 0, 2: 2 }, fields: Object.fromEntries(progress.orientationFieldIds.map(id => [id, 'x'])) }) };
  const old = globalThis.localStorage;
  const check = storage => { globalThis.localStorage = memoryStorage(storage); return progress.graduationStatus(progress.readProgress()); };
  try {
    const eligible = check({ ...all(), ...orientation });
    assert.equal(eligible.eligible, true);
    assert.equal(logic.graduationMessage(eligible), 'Academy learning self-completed locally: Module 00 and 100 / 100 lessons. No accreditation or business-readiness endorsement.');
    assert.equal(check(all()).eligible, false, 'orientation required');
    assert.equal(logic.graduationMessage(check(all())), '100 / 100 learning completions; Module 00 pending. Remaining lesson IDs: none. Complete outstanding learning before the acknowledgement.');
    const no45 = check({ ...all({ 45: { artifactReady: false } }), ...orientation });
    assert.equal(no45.eligible, false); assert.deepEqual(no45.missing, [45]);
    const no50 = check({ ...all({ 50: { releaseAck50: false } }), ...orientation });
    assert.deepEqual(no50.missing, [50]);
    const no100 = check({ ...all({ 100: { completed: false } }), ...orientation });
    assert.equal(logic.graduationMessage(no100), '99 / 100 learning completions; Module 00 self-completed. Remaining lesson IDs: 100. Complete outstanding learning before the acknowledgement.');
    const stale = check({ ...all({ 99: { honest: false } }), ...orientation });
    assert.deepEqual(stale.missing, [99], 'completed flag re-validated against the schema');
    // Rendered on Lesson 100.
    globalThis.localStorage = memoryStorage({ ...all(), ...orientation });
    let html = renderToString(createElement(LessonView, { lesson: lessons[100], module: phase5, navigate() {}, onProgress() {} }));
    assert.ok(html.includes('Academy learning self-completed locally: Module 00 and 100 / 100 lessons.'));
    assert.ok(html.includes('Download local learning acknowledgement'));
    globalThis.localStorage = memoryStorage();
    html = renderToString(createElement(LessonView, { lesson: lessons[100], module: phase5, navigate() {}, onProgress() {} }));
    assert.ok(html.includes('0 / 100 learning completions; Module 00 pending.'));
  } finally { globalThis.localStorage = old; }
  // Acknowledgement export equals legacy text (timestamp aside) and keeps the learning-only caveat.
  const s = richState(100);
  L.use(100, s);
  L.run('graduationSnapshot100={eligible:true};downloadGraduation100()');
  const [value, name] = L.downloads.at(-1);
  assert.equal(name, logic.GRADUATION_FILENAME);
  const ours = logic.graduationAcknowledgement(logic.resolveFn('finalResult100', lessons[100], s), new Date('2026-01-01T00:00:00Z'));
  const strip = t => t.replace(/Generated: .*\n/, 'Generated: X\n');
  assert.equal(strip(ours), strip(value));
  assert.match(ours, /No accreditation,identity verification,mentor assessment,investment approval or business-readiness endorsement/);
  L.run("graduationSnapshot100={eligible:false};downloadGraduation100()");
  assert.equal(logic.GRADUATION_UNAVAILABLE, L.run("$('graduationStatus100').textContent"));
});

test('module status line counts module lessons only', () => {
  assert.equal(logic.moduleStatusText('5.2', [81, 86, 87, 90, 91]), 'Module 5.2: 3 / 5. Lessons 81–99 interactive; Lesson 100 previews. Learning does not approve expansion.');
  assert.equal(logic.moduleStatusText('5.4', []), 'Module 5.4: 0 / 5. Lessons 81–99 interactive; Lesson 100 previews. Learning does not approve expansion.');
});
