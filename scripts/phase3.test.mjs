// Phase 03 · Build — native migration tests (parity with the legacy document, rendering, tools).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { load, memoryStorage } from './helpers/bundle.mjs';
import { corrected } from './migration/stale-corrections.mjs';
import { legacyScript, legacyBody, jsonConst, parseHtml, findAll, textOf } from './migration/legacy.mjs';

const root = new URL('../', import.meta.url);
const curriculum = JSON.parse(readFileSync(new URL('src/data/curriculum.json', root)));
const js = legacyScript(3);
const configs = jsonConst(js, 'configs');
const templates = jsonConst(js, 'templates');
const LESSONS = Array.from({ length: 20 }, (_, i) => 41 + i);
const lessonJson = n => JSON.parse(readFileSync(new URL(`src/data/lessons/phase-3/lesson-${n}.json`, root)));
const dashboard = JSON.parse(readFileSync(new URL('src/data/dashboards/phase-3.json', root)));
const schema = n => curriculum.schemas[String(n)];
const clean = s => s.replace(/\s+/g, ' ').trim();
const blocks = lesson => lesson.sections.flatMap(s => s.blocks);
const tools = lesson => blocks(lesson).filter(b => b.type === 'extension' && b.id === 'tool');
const decode = html => html.replace(/<!-- -->/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");

const state = await load('src/lesson-system/state.ts');
const phase = (await load('src/phases/phase3/index.ts')).default;
const T = await load('src/phases/phase3/logic/tools.ts');
const R = await load('src/phases/phase3/logic/registers.ts');
const B = await load('src/phases/phase3/logic/brief.ts');
const C = await load('src/phases/phase3/components/controllers.tsx');
const full = (n, extra = {}) => ({ ...state.blankState(), fields: Object.fromEntries(schema(n).ids.map(id => [id, `Answer ${id}`])), answers: Object.fromEntries(schema(n).keys.map((k, i) => [i, k])), studied: true, honest: true, ...extra });

function withStorage(fn, initial = {}) {
  const old = globalThis.localStorage;
  globalThis.localStorage = memoryStorage(initial);
  try { return fn(); } finally { globalThis.localStorage = old; }
}

test('lesson data parity with curriculum.json and the legacy configs/templates (all 20 lessons)', async () => {
  for (const n of LESSONS) {
    const l = lessonJson(n), cfg = configs[n], doc = parseHtml(templates[n]);
    const loaded = await phase.loadLesson(n);
    assert.equal(loaded.number, n);
    assert.equal(l.title, curriculum.names[n], `${n} title`);
    assert.equal(l.title, cfg.title);
    assert.equal(l.module, cfg.module);
    assert.equal(schema(n).key, `lynq.build.lesson${n}.v1`);
    assert.deepEqual(l.fields.filter(f => f.required).map(f => f.id).sort(), [...schema(n).ids].sort(), `${n} required ids`);
    assert.deepEqual(l.fields.map(f => f.id), [...cfg.fields.map(f => f[0]), 'bias', 'counter', 'constraint']);
    for (const [id, label] of cfg.fields) assert.equal(l.fields.find(f => f.id === id).label, label, `${n} ${id} label`);
    for (const f of findAll(doc, x => x.attrs.class === 'field')) {
      const id = findAll([f], x => x.tag === 'textarea')[0].attrs.id;
      assert.equal(l.fields.find(x => x.id === id).label, clean(textOf(findAll([f], x => x.tag === 'label')[0])).replace(/ \*$/, ''), `${n} template label ${id}`);
    }
    const fieldBlocks = blocks(l).filter(b => b.type === 'fields').flatMap(b => b.ids);
    assert.deepEqual(fieldBlocks.sort(), l.fields.map(f => f.id).sort(), `${n} every field rendered once`);
    assert.deepEqual(l.questions.map(q => [q.prompt, q.options, q.answer, q.explanation]), cfg.questions, `${n} quiz`);
    assert.deepEqual(l.questions.map(q => q.answer), schema(n).keys);
    const story = blocks(l).find(b => b.type === 'storyboard');
    assert.deepEqual(story.scenes.map(s => [s.title, s.visual, s.narration]), cfg.scenes);
    const vp = blocks(l).find(b => b.type === 'videoPrompt');
    assert.equal(vp.prompt, cfg.prompt);
    assert.equal(vp.filename, `LYNQ-Lesson-${n}-Gemini-Video-Prompt.md`);
    assert.ok(templates[n].includes(`'${vp.filename}'`) || templates[n].includes("'LYNQ-Lesson-'+current+'-Gemini-Video-Prompt.md'"));
    assert.equal(l.deliverable.filename, cfg.filename);
    assert.equal(l.deliverable.title, cfg.deliverable);
    const flags = blocks(l).filter(b => b.type === 'flag');
    assert.equal(flags.some(f => f.flag === 'artifactReady'), schema(n).artifact, `${n} artifactReady`);
    assert.equal(flags.some(f => f.flag === 'releaseAck50'), schema(n).releaseAck, `${n} releaseAck50`);
    for (const f of flags) assert.equal(f.label, clean(textOf(findAll(doc, x => x.tag === 'label' && findAll([x], y => y.attrs.id === f.flag).length)[0])));
    assert.equal(l.checklist.some(c => c.kind === 'flag'), flags.length > 0);
    assert.deepEqual(l.sections.map(s => s.label.slice(0, 2)), ['01', '02', '03', '04', '05', '06', '07']);
    const complete = blocks(l).find(b => b.type === 'complete');
    assert.equal(complete.label, `Mark Lesson ${n} complete locally`);
    assert.equal(complete.completedNotice, `Lesson ${n} self-completed locally.`);
    // Practice options + feedback come verbatim from practice().
    const practice = blocks(l).find(b => b.type === 'practice');
    assert.equal(practice.options.length, 2);
    for (const o of practice.options) { assert.ok(templates[n].includes(`>${o.label}</button>`)); assert.ok(js.includes(`'${o.feedback.replace(/'/g, "\\'")}'`), o.feedback); }
    // Coach modes: every legacy button reproduced; replies exist in coachMode()/coach().
    const coach = blocks(l).find(b => b.id === 'coach');
    assert.deepEqual(coach.props.modes.map(m => m.label), ['Teach Me', 'Guide Me', 'Review My Work', 'Challenge My Idea']);
    for (const m of coach.props.modes) {
      if (m.id === 'review') { for (const part of m.response.split('{missing}')) assert.ok(js.includes(part), `${n} review`); continue; }
      const tail = m.response.replace(/^Simulated \w+( guidance)?: /, '');
      assert.ok(js.includes(tail.split(' No live AI')[0].slice(0, 60)), `${n} coach ${m.id}`);
    }
    assert.equal(!!coach.props.question, n <= 45, `${n} question box`);
  }
});

test('every lesson renders natively with all labels, quiz prompts and tools (no iframe/script)', async () => {
  const { LessonView } = await load('src/lesson-system/LessonPage.tsx');
  for (const n of LESSONS) {
    const lesson = await phase.loadLesson(n);
    const html = decode(withStorage(() => renderToString(createElement(LessonView, { lesson, module: phase, navigate() {}, onProgress() {} }))));
    assert.doesNotMatch(html, /<iframe|<script/i, `${n}`);
    assert.ok(!html.includes('Missing lesson tool'), `${n} missing tool`);
    assert.ok(html.includes(lesson.hero.title), `${n} title`);
    for (const f of lesson.fields) assert.ok(html.includes(f.label), `${n} label ${f.id}`);
    for (const q of lesson.questions) assert.ok(html.includes(q.prompt), `${n} quiz`);
    for (const tool of tools(lesson)) {
      assert.ok(C.knownTools(tool.props.tool, n), `${n} tool ${tool.props.tool}`);
      for (const item of tool.props.items) {
        if (item.kind === 'control' || item.kind === 'action') assert.ok(html.includes(item.label), `${n} ${item.label}`);
        if (item.kind === 'action' && !['prompt'].includes(tool.props.tool)) assert.ok(!!C.controllerFor(tool.props, n).actions[item.fn] || item.fn.startsWith('export') && R.registers[n]?.exportFn === item.fn, `${n} action ${item.fn}`);
        if (item.options) for (const o of item.options) assert.ok(html.includes(o.label), `${n} option ${o.label}`);
      }
    }
    assert.ok(html.includes(`Module ${lesson.module}: 0 / 5 self-completed locally.`), `${n} module status`);
  }
});

test('every tool action is wired to a controller handler', () => {
  for (const n of LESSONS) for (const tool of tools(lessonJson(n))) {
    const controller = C.controllerFor(tool.props, n);
    for (const item of tool.props.items.filter(i => i.kind === 'action')) assert.equal(typeof controller.actions[item.fn], 'function', `${n} ${item.fn}`);
  }
});

test('Build dashboard renders natively with hero, modules and all 20 lesson links', async () => {
  const { DashboardView } = await load('src/lesson-system/PhaseDashboard.tsx');
  const d = await phase.loadDashboard();
  const html = decode(renderToString(createElement(DashboardView, { dashboard: d, navigate() {}, progress: { complete: [41], orientation: false } })));
  assert.doesNotMatch(html, /<iframe|<script/i);
  const body = corrected(3, legacyBody(3));
  assert.ok(body.includes('Develop the product<br>and business foundation.'));
  assert.equal(d.hero.title, 'Develop the product and business foundation.');
  assert.ok(html.includes(d.hero.intro) && body.includes(d.hero.intro));
  assert.deepEqual(d.modules.map(m => m.code), ['3.1', '3.2', '3.3', '3.4']);
  for (const m of d.modules) assert.ok(html.includes(m.title));
  assert.deepEqual(d.modules.flatMap(m => m.lessons.map(l => l.number)), LESSONS);
  for (const l of d.modules.flatMap(m => m.lessons)) {
    assert.equal(l.title, curriculum.names[l.number]);
    assert.ok(html.includes(l.title) && html.includes(l.summary));
    assert.ok(body.includes(`<small>${l.summary}</small>`));
  }
  assert.ok(html.includes('1 / 20'));
});

test('normalizeExtra drops malformed saved data, keeps valid rows and legacy limits', () => {
  const ok = { id: 'P1', action: 'clicked', inference: 'Not interpreted', outcome: 'Outcome unknown' };
  const rows = [ok, null, 'x', { id: 2, action: 'a', inference: 'b', outcome: 'c' }, { id: 'P2' }, ...Array(40).fill(ok)];
  const s46 = state.normalizeState({ fields: {}, answers: {}, observationRows: rows, other: 1 }, raw => phase.normalizeExtra(46, raw));
  assert.equal(s46.observationRows.length, 30);
  assert.deepEqual(s46.observationRows[0], ok);
  assert.equal(s46.other, 1, 'unknown keys preserved');
  assert.equal('observationRows' in phase.normalizeExtra(46, { observationRows: 'bad' }), false);
  const r60 = phase.normalizeExtra(60, { readyRows: Array(50).fill({ id: 'R', domain: 'Product and task', source: 's', status: 'x', critical: 'yes', owner: 'o', junk: 1 }) }).readyRows;
  assert.equal(r60.length, 40); assert.equal(r60[0].critical, false); assert.equal('junk' in r60[0], false);
  assert.deepEqual(phase.normalizeExtra(48, { contractDraft: 5, contractCase: 'evil' }), {});
  assert.deepEqual(phase.normalizeExtra(48, { contractDraft: '{}', contractCase: 'timeout' }), { contractDraft: '{}', contractCase: 'timeout' });
  assert.deepEqual(phase.normalizeExtra(56, { cashDraft: { opening: '5', upfront: 3, scenario: 'boom', extra: 'x' } }).cashDraft, { opening: '5' });
  assert.deepEqual(phase.normalizeExtra(56, { cashDraft: [] }), {});
  assert.deepEqual(phase.normalizeExtra(51, { brandInk: '#000000', brandPaper: null }), { brandInk: '#000000' });
  assert.deepEqual(phase.normalizeExtra(57, { sampleDraft: '[]', eventRows: {} }), { sampleDraft: '[]' });
  for (const n of LESSONS) for (const raw of [{}, { x: null }, { [R.registers[n]?.key ?? 'k']: [1, 2] }]) assert.doesNotThrow(() => phase.normalizeExtra(n, raw));
});

test('required, optional, quiz and flag handling; completion explicit and revoked only when invalid', () => {
  assert.equal(phase.revokeOnAnyEdit, false);
  assert.match(js, /function save\(\)\{if\(!valid\(\)\)state\.completed=false/);
  for (const n of [41, 45, 50, 56, 60]) {
    const s = full(n, n === 45 ? { artifactReady: true } : n === 50 ? { releaseAck50: true } : {});
    assert.equal(state.requirementsMet(s, schema(n)), true, `${n}`);
    for (const id of ['bias', 'counter', 'constraint']) assert.equal(state.requirementsMet({ ...s, fields: { ...s.fields, [id]: ' ' } }, schema(n)), false, `${n} ${id} required`);
    assert.equal(state.requirementsMet({ ...s, answers: { ...s.answers, 1: (schema(n).keys[1] + 1) % 3 } }, schema(n)), false);
    assert.equal(state.requirementsMet({ ...s, fields: { ...s.fields, unrelated: '' } }, schema(n)), true);
    const done = state.markComplete(s, schema(n));
    assert.equal(done.completed, true);
    assert.equal(state.applyEdit(done, { observationRows: [] }, schema(n), phase.revokeOnAnyEdit).completed, true, 'tool edits keep completion');
    assert.equal(state.applyEdit(done, { studied: false }, schema(n), phase.revokeOnAnyEdit).completed, false);
  }
  assert.equal(state.requirementsMet(full(45), schema(45)), false);
  assert.equal(state.requirementsMet(full(50), schema(50)), false);
  assert.equal(state.applyEdit(state.markComplete(full(50, { releaseAck50: true }), schema(50)), { releaseAck50: false }, schema(50), false).completed, false);
});

test('brief deliverables reproduce the legacy format for every lesson', () => {
  for (const n of LESSONS) {
    const l = lessonJson(n);
    const s = { ...full(n), fields: { ...full(n).fields, [l.fields[0].id]: '' } };
    const md = phase.buildDeliverable(l, s, false);
    assert.ok(md.startsWith(`# ${configs[n].deliverable}\n\nPhase 03 · Module ${configs[n].module} · Lesson ${n}\n\n${l.fields[0].id}: Not entered\n\n`), `${n}`);
    for (const f of l.fields.slice(1)) assert.ok(md.includes(`${f.id}: Answer ${f.id}`), `${n} ${f.id}`);
    const tail = B.briefTail(n, {}).split('\n').filter(Boolean).pop();
    assert.ok(md.endsWith(tail), `${n} caveat`);
    assert.ok(js.includes(tail.replace(/^Register summary.*/, '')), `${n} tail verbatim`);
  }
  const s60 = { ...full(60), readyRows: [{ id: 'R1', domain: 'Product and task', source: 's', status: 'Unknown / not reviewed', critical: true, owner: 'o' }] };
  const md = B.buildBrief(lessonJson(60), s60);
  assert.ok(md.includes('"id": "R1"') && md.includes('"criticalBlockers": [\n    "R1"\n  ]'));
  assert.ok(B.buildBrief(lessonJson(56), { ...full(56), cashDraft: { opening: '1' } }).includes('{\n  "opening": "1"\n}'));
  assert.equal(T.runbook50('BRIEF').split('\n')[2], 'BRIEF');
});

test('every hand-copied tool message exists verbatim in the legacy script', () => {
  const strings = [];
  for (const spec of Object.values(R.registers)) {
    strings.push(...Object.values(spec.messages), spec.removeLabel);
    if (spec.exportFile) { const f = spec.exportFile({ fields: {} }); strings.push(f.filename, f.data.status); }
  }
  for (const group of [T.PROTOTYPE45, T.CONTRACT48, T.BRAND51, T.CASH56, T.SAMPLE57]) for (const v of Object.values(group)) if (typeof v === 'string') strings.push(v);
  strings.push(...T.CASH56.headers, T.RUNBOOK50_FILENAME, ...T.readyDomains60);
  for (const s of strings) assert.ok(js.includes(s), s);
  for (const [k, v] of Object.entries(T.CASH_DEFAULTS56)) assert.ok(templates[56].includes(`id="cash_${k}56" type="number" min="0" max="1000000000" step="0.01" value="${v}"`), k);
  for (const fn of ['runOnboard52', 'triageIP54', 'explainTeam55']) for (const kind of ['available', 'unavailable', 'declined', 'return', 'contractor', 'thirdparty', 'ai', 'secret', 'draft', 'publish', 'spend', 'access']) {
    const out = T[fn](kind);
    if (!out.includes('undefined')) assert.ok(js.includes(out.replace(/^[A-Z ]+: /, '').split(' No ')[0]), `${fn} ${kind}`);
  }
});

test('Lesson 45: prototype shell export, native preview text and simulated API', () => {
  assert.equal(T.prototypeShell45, jsonConst(js, 'prototypeShell45'));
  const html = T.prototypeHtml45({ target: 'Route </script> task', spec: '' });
  assert.ok(html.includes('const cfg={"title":"Route \\u003c/script> task","spec":"Sample navigation shell; adapt to your approved flow."}'));
  assert.ok(T.prototypeHtml45({}).includes('"title":"Fictional registration-route task"'));
  assert.equal(T.prototypeConfig45({ target: 'x'.repeat(300) }).title.length, 250);
  for (const text of ['LOCAL SAMPLE SHELL \u00b7 FICTIONAL DATA \u00b7 NO API', 'Sample invitation', 'Explore sample routes', 'Choose a sample route', 'Sample route unavailable', 'No registration was made. Choose another route or exit.', 'Sample destination', 'You reached the fictional destination screen. No account, payment or registration exists.', 'Back to choices', 'Current sample state: ']) assert.ok(T.prototypeShell45.includes(text), text);
  for (const [from, to] of Object.entries(T.shellTransitions)) assert.ok(T.prototypeShell45.includes(`['${from}','${to}']`));
  assert.deepEqual(JSON.parse(T.simulateApi45('success')).status, 200);
  assert.equal(JSON.parse(T.simulateApi45('timeout')).status, 'timeout');
  assert.equal(JSON.parse(T.simulateApi45('denied')).status, 401);
});

test('Lesson 48: contract sample loader and checker error rules', () => {
  assert.match(T.checkContract48(T.contractSample48('valid')), /^Local sample shape passed/);
  assert.equal(T.checkContract48(T.contractSample48('invalid')), 'Local sample shape failed: row 0: boolean available required');
  assert.match(T.checkContract48(T.contractSample48('timeout')), /^Failure scenario only: timeout\./);
  assert.match(T.checkContract48(T.contractSample48('denied')), /^Failure scenario only: unauthorized\./);
  assert.equal(T.checkContract48('{oops'), 'Invalid JSON. Local parsing only; no request made.');
  assert.equal(T.checkContract48('null'), 'Local sample shape failed: routes must be an array');
  assert.equal(T.checkContract48('{"routes":[{"id":"a","label":"A","available":true},{"id":"a","label":" ","available":1},null]}'),
    'Local sample shape failed: row 1: duplicate id; row 1: non-empty string label required; row 1: boolean available required; row 2: non-empty string id required; row 2: non-empty string label required; row 2: boolean available required');
});

test('Lessons 49, 50, 58, 59: permission and gate explainers', () => {
  assert.match(T.checkPermission49('owner', 'assigned', 'delete', true, false), /^ALLOW/);
  assert.match(T.checkPermission49('owner', 'assigned', 'delete', true, true), /^HUMAN REVIEW REQUIRED/);
  assert.match(T.checkPermission49('collaborator', 'assigned', 'read', true, true), /^ALLOW/);
  assert.match(T.checkPermission49('collaborator', 'assigned', 'edit', true, false), /^DENY/);
  assert.match(T.checkPermission49('owner', 'other', 'read', true, false), /^DENY/);
  assert.match(T.checkPermission49('owner', 'assigned', 'read', false, false), /^DENY/);
  assert.match(T.checkPermission49('visitor', 'assigned', 'read', true, false), /^DENY/);
  assert.equal(T.releaseGate50('unknown', 'failed', 'ready', 'ready'), 'BLOCKED in sample exercise: versioned artifact (unknown); required checks (failed). Resolve with owners and actual evidence; no release occurred.');
  assert.match(T.releaseGate50('ready', 'ready', 'ready', 'ready'), /^ELIGIBLE FOR HUMAN DECISION/);
  assert.equal(T.betaGate58('ready', 'unknown', 'ready', 'unknown'), 'BLOCKED IN HYPOTHETICAL EXERCISE: cohort/data/participation; support/stop/recovery. Resolve with actual evidence and owners. No beta action.');
  assert.match(T.betaGate58('ready', 'ready', 'ready', 'ready'), /^ELIGIBLE FOR HUMAN REVIEW/);
  assert.match(T.fixGate59('ready', 'failed', 'ready', 'ready'), /acceptance\/regression \(failed\)/);
  assert.match(T.fixGate59('ready', 'ready', 'ready', 'ready'), /^ELIGIBLE FOR HUMAN REVIEW/);
});

test('Lesson 51: WCAG luminance and contrast ratio against known values; token export', () => {
  assert.equal(T.luminance('#FFFFFF'), 1);
  assert.equal(T.luminance('#000000'), 0);
  assert.equal(T.contrastRatio('#000000', '#FFFFFF'), 21);
  assert.equal(T.contrastRatio('#FFFFFF', '#FFFFFF'), 1);
  assert.equal(T.contrastRatio('#777777', '#FFFFFF').toFixed(2), '4.48');
  assert.equal(T.contrastRatio('#767676', '#ffffff').toFixed(2), '4.54');
  assert.equal(T.contrastMessage51(4.54), '4.54:1 — meets 4.5:1 normal-text threshold. Solid pair only; not a full accessibility audit.');
  assert.match(T.contrastMessage51(T.contrastRatio('#949494', '#FFFFFF')), /meets 3:1 large-text threshold only/);
  assert.match(T.contrastMessage51(1), /below normal and large text thresholds/);
  assert.equal(T.brandPair51('#0B2338', 'white'), null);
  assert.equal(T.brandPair51(' #0b2338 ', '#FFF'), null);
  const pair = T.brandPair51(' #0B2338', '#FFFFFF ');
  assert.equal(pair.text, '#0B2338');
  const tokens = JSON.parse(T.tokens51(pair, { brandHandoff: '' }));
  assert.equal(tokens.owner, 'unassigned'); assert.equal(tokens.contrast.normalText, true); assert.equal(tokens.contrast.scope, 'solid pair only');
});

test('Lesson 53: share calculator normal, zero and invalid input', () => {
  assert.equal(T.calculateShares53('60', '40', '25'), 'HYPOTHETICAL: existing total 100, after issuance 125. A: 60.00% → 48.00%; B: 40.00% → 32.00%; new holder: 20.00%. Rounded display; equal-rights issued shares only. No allocation, valuation, agreement or legal rights established.');
  assert.match(T.calculateShares53('1', '0', '0'), /A: 100\.00% → 100\.00%; B: 0\.00% → 0\.00%; new holder: 0\.00%/);
  const bad = 'Enter non-negative whole numbers up to 1,000,000,000; existing total must be greater than zero.';
  for (const args of [['0', '0', '5'], ['', '1', '1'], ['-1', '5', '1'], ['1.5', '1', '1'], ['1', '1', '1000000001'], ['x', '1', '1']]) assert.equal(T.calculateShares53(...args), bad, args.join());
});

test('Lesson 56: cash model scenarios, burn, runway, zero/negative and invalid inputs', () => {
  const base = { ...T.CASH_DEFAULTS56 };
  const m = T.cashModel56(base, 'base');
  assert.equal(m.start, 80000); assert.equal(m.netBurn, 10000); assert.equal(m.runwayMonths, 8);
  assert.equal(m.rows.length, 12); assert.deepEqual(m.rows[0], { month: 1, opening: 80000, customerCollections: 10000, cashPayments: 20000, closing: 70000 });
  assert.equal(m.rows[11].closing, -40000); assert.equal(m.firstBelowBuffer, 8); assert.equal(m.firstNegative, 9);
  assert.equal(T.cashMessage56(m), 'ASSUMPTION-BASED base: start after financing/upfront AED 80,000.00. Simple constant-burn runway 8.00 months; timing may differ. First closing cash below buffer: month 8. First negative cash: month 9. No balances/funding verified; negative modeled cash is a gap, not automatic borrowing.');
  const down = T.cashModel56(base, 'downside');
  assert.deepEqual(down.effective, { receipts: 7000, payments: 24000, funding: 0 }); assert.equal(down.netBurn, 17000);
  assert.equal(down.runwayMonths.toFixed(2), '4.71');
  const funded = T.cashModel56({ ...base, funding: '50000' }, 'nofunding');
  assert.equal(funded.start, 80000); assert.equal(funded.effective.funding, 0);
  assert.equal(T.cashModel56({ ...base, funding: '50000' }, 'base').start, 130000);
  const flat = T.cashModel56({ ...base, receipts: '20000' }, 'base');
  assert.equal(flat.netBurn, 0); assert.equal(flat.runwayMonths, null); assert.equal(flat.firstNegative, null);
  assert.match(T.cashMessage56(flat), /No positive constant net burn; no finite runway/);
  assert.match(T.cashMessage56(flat), /First closing cash below buffer: none within modeled period/);
  const neg = T.cashModel56({ ...base, opening: '0' }, 'base');
  assert.equal(neg.start, -20000); assert.equal(neg.runwayMonths, 0); assert.equal(neg.firstNegative, 0); assert.equal(neg.firstBelowBuffer, 0);
  assert.match(T.cashMessage56(neg), /AED -20,000\.00\. Immediate modeled cash shortfall\. First closing cash below buffer: at start\. First negative cash: at start\./);
  const zero = T.cashModel56({ opening: '0', upfront: '0', receipts: '0', payments: '0', funding: '0', buffer: '0' }, 'base');
  assert.equal(zero.start, 0); assert.equal(zero.runwayMonths, null); assert.equal(zero.firstBelowBuffer, null);
  assert.equal(T.cashModel56({ ...base, receipts: '0.1', payments: '0.2' }, 'base').rows[0].closing, 79999.9);
  for (const bad of ['', '-1', '1.001', '1000000001', 'abc', 'Infinity']) assert.equal(T.cashModel56({ ...base, opening: bad }, 'base'), null, bad);
  assert.equal(T.cashValues56({ cashDraft: { opening: '5', scenario: 'downside' } }).values.opening, '5');
  assert.equal(T.cashValues56({}).scenario, 'base');
  assert.equal(JSON.parse(T.cashExport56({ a: 'b' }, m)).model.runwayMonths, 8);
});

test('Lesson 57: sample event checker funnel starts/completions and schema errors', () => {
  const m = T.sampleModel57(T.loadSample57());
  assert.equal(m.startedSessions, 2); assert.equal(m.completedSessions, 1); assert.equal(m.completionRate, 0.5); assert.equal(m.unavailableEvents, 1);
  assert.equal(T.sampleMessage57(m), 'FICTIONAL SAMPLE: 1 / 2 started sessions reached first value; 50.00% under fixed rules. Events 4; unavailable events 1; first-value without start 0; before-start first-value 0. Not real conversion, retention, revenue or validated demand.');
  const ev = (id, session, event, t) => ({ event_id: id, session_id: session, event, timestamp: t });
  const odd = T.sampleModel57(JSON.stringify([ev('sample_1', 'sample_a', 'first_value_reached', '2026-01-01T09:00:00Z'), ev('sample_2', 'sample_a', 'onboarding_started', '2026-01-01T10:00:00Z'), ev('sample_3', 'sample_b', 'first_value_reached', '2026-01-01T10:00:00Z')]));
  assert.equal(odd.beforeStartFirstValueEvents, 1); assert.equal(odd.orphanFirstValueEvents, 1); assert.equal(odd.completedSessions, 0);
  assert.match(T.sampleMessage57(T.sampleModel57('[]')), /0 \/ 0 started sessions reached first value; no denominator\/rate/);
  assert.equal(T.sampleModel57('nope').error, 'Enter a JSON array of fictional sample events.');
  assert.equal(T.sampleModel57('{}').error, 'Use an array of at most 100 events.');
  assert.equal(T.sampleModel57(JSON.stringify(Array(101).fill(0))).error, 'Use an array of at most 100 events.');
  assert.equal(T.sampleModel57('x'.repeat(40001)).error, 'Sample exceeds 40,000 characters.');
  assert.match(T.sampleModel57(JSON.stringify([ev('user_1', 'sample_a', 'onboarding_started', '2026-01-01T10:00:00Z')])).error, /^Invalid fixed schema/);
  assert.match(T.sampleModel57(JSON.stringify([ev('sample_1', 'sample_a', 'onboarding_started', '2026-02-30T10:00:00Z')])).error, /^Invalid fixed schema/);
  assert.match(T.sampleModel57(JSON.stringify([{ ...ev('sample_1', 'sample_a', 'onboarding_started', '2026-01-01T10:00:00Z'), email: 'x' }])).error, /^Invalid fixed schema/);
  assert.equal(T.sampleModel57(JSON.stringify([ev('sample_1', 'sample_a', 'onboarding_started', '2026-01-01T10:00:00Z'), ev('sample_1', 'sample_b', 'onboarding_started', '2026-01-01T10:00:00Z')])).error, 'Duplicate event_id; resolve duplicates before calculating.');
});

test('Lesson 60: readiness summary', () => {
  const rows = T.readyDomains60.map((domain, i) => ({ id: `R${i}`, domain, source: 's', status: 'Learner-reported reviewed / evidence referenced', critical: false, owner: 'o' }));
  assert.equal(T.readinessSummary60({ readyRows: rows }).status, 'ELIGIBLE FOR FURTHER HUMAN REVIEW ONLY');
  const gap = T.readinessSummary60({ readyRows: [{ ...rows[0], critical: true }, { ...rows[1], status: 'Unknown / not reviewed' }] });
  assert.equal(gap.status, 'HOLD / GAPS IN LEARNER REGISTER'); assert.deepEqual(gap.criticalBlockers, ['R0']); assert.deepEqual(gap.unreviewedRecords, ['R1']); assert.equal(gap.missingDomains.length, 6);
  assert.match(T.readinessMessage60({}), /^HOLD \/ GAPS IN LEARNER REGISTER\. Missing domains: Product and task; .*\. Unreviewed: none\. Critical blockers: none\. coverage\/status only; .*\. No launch action\.$/);
});

test('register rows: required columns, duplicates, limits, slices, fallbacks and exports', () => {
  const s46 = R.registers[46];
  assert.deepEqual(R.addRegisterRow(s46, [], { obsId46: ' ', obsAction46: 'x' }), { error: s46.messages.missing });
  const added = R.addRegisterRow(s46, [], { obsId46: ' P1 ', obsAction46: 'a'.repeat(1200), obsInference46: '  ', obsOutcome46: 'Outcome unknown' });
  assert.deepEqual(Object.keys(added.rows[0]), ['id', 'action', 'inference', 'outcome']);
  assert.equal(added.rows[0].id, 'P1'); assert.equal(added.rows[0].action.length, 1000); assert.equal(added.rows[0].inference, 'Not interpreted');
  assert.equal(R.addRegisterRow(s46, Array(30).fill(added.rows[0]), { obsId46: 'P1', obsAction46: 'b' }).error, s46.messages.limit, 'no uniqueness in 46');
  assert.equal(s46.card(added.rows[0], 0).split('\n')[0], 'Row 1 · P1');
  const s47 = R.registers[47];
  const draft = { reqId47: 'R1', reqBehaviour47: 'b', reqSource47: 's', reqCriterion47: 'c', reqStatus47: 'Assumption / proposal', reqPriority47: 'Must' };
  const r47 = R.addRegisterRow(s47, [], draft).rows;
  assert.equal(R.addRegisterRow(s47, r47, { ...draft, reqId47: 'r1' }).error, 'Requirement ID already exists; use a unique ID.');
  assert.equal(R.addRegisterRow(s47, Array(30).fill({ ...r47[0], id: 'other' }), draft).error, s47.messages.limit);
  const e = R.registerExport(s47, { fields: {}, requirementRows: r47 });
  assert.equal(e.filename, 'LYNQ-Lesson-47-Requirements.json'); assert.deepEqual(JSON.parse(e.text), { lesson: 47, status: 'learner draft; not approved or verified', requirements: r47 });
  const s57 = R.registers[57];
  const ev = { eventName57: 'route_started', eventTrigger57: 't', eventProperties57: 'p', eventReview57: 'r' };
  assert.equal(R.addRegisterRow(s57, [], { ...ev, eventName57: 'Route-Started' }).error, s57.messages.missing);
  const r57 = R.addRegisterRow(s57, [], ev).rows;
  assert.equal(r57[0].status, 'Proposed / not instrumented');
  assert.ok(!('error' in R.addRegisterRow(s57, [{ ...r57[0], name: 'ROUTE_STARTED' }], ev)), 'exact uniqueness in 57');
  assert.equal(R.addRegisterRow(s57, r57, ev).error, 'Event name already exists; use a unique name.');
  const s60 = R.registers[60];
  const r60 = R.addRegisterRow(s60, [], { readyId60: 'R1', readyDomain60: 'Product and task', readySource60: 's', readyState60: 'Unknown / not reviewed', readyCritical60: true, readyOwner60: 'o' }).rows;
  assert.equal(r60[0].critical, true); assert.match(s60.card(r60[0], 0), /UNRESOLVED CRITICAL BLOCKER/);
  assert.equal(JSON.parse(R.registerExport(s60, { fields: { a: 'b' }, readyRows: r60 }).text).summary.criticalBlockers[0], 'R1');
  assert.deepEqual(R.removeRegisterRow([1, 2, 3], 1), [1, 3]);
  for (const spec of Object.values(R.registers)) assert.ok(templates[spec.lesson].includes(`onclick="${spec.addFn}()"`) && templates[spec.lesson].includes(`id="${spec.rowsId}"`), spec.addFn);
});

test('prompt workbenches: extracted roles, boundaries, filenames and the Lesson 56 helper suffix', () => {
  for (const n of LESSONS) for (const tool of tools(lessonJson(n)).filter(t => t.props.tool === 'prompt')) {
    const spec = tool.props.prompt;
    const roles = tool.props.items.filter(i => i.kind === 'action' && i.arg).map(i => i.arg);
    assert.equal(roles.length, 3);
    for (const role of roles) {
      assert.ok(spec.roles[role], `${n} ${role}`);
      const text = T.preparePrompt(spec, role, 'BRIEF', null);
      assert.ok(text.startsWith(`ROLE: ${role}\nTASK: ${spec.roles[role]}\n`));
      assert.ok(js.includes(spec.roles[role]));
    }
    assert.match(spec.filename, new RegExp(`^LYNQ-Lesson-${n}-.*Prompt\\.md$`));
    assert.ok(js.includes(spec.middle.split('\n')[1].slice(0, 80)));
    assert.equal(!!spec.cashSuffix, n === 56);
  }
  const p56 = tools(lessonJson(56)).find(t => t.props.tool === 'prompt').props.prompt;
  assert.ok(T.preparePrompt(p56, 'model', 'B', null).endsWith('B\nCurrent helper assumptions/result or invalid: null'));
  const p45 = tools(lessonJson(45)).find(t => t.props.tool === 'prompt').props.prompt;
  assert.equal(p45.filename, 'LYNQ-Lesson-45-Agent-Prompt.md'); assert.equal(p45.empty, 'Select a role to prepare a prompt first.');
  assert.ok(p45.middle.endsWith('LEARNER CONTEXT (inspect/redact before sharing):\n'));
});

test('controllers wire UI actions to state exactly as the legacy handlers', () => {
  const harness = (n, toolName, st = full(n)) => {
    const lesson = lessonJson(n);
    const props = tools(lesson).find(t => t.props.tool === toolName).props;
    const controller = C.controllerFor(props, n);
    const controls = props.items.filter(i => i.kind === 'control');
    const h = { state: st, local: Object.fromEntries(controls.map(c => [c.id, c.control === 'checkbox' ? false : c.value ?? c.options?.[0]?.value ?? ''])), outs: {}, view: {} };
    const ctx = () => ({ lesson, props, controls, state: h.state, view: h.view,
      update: patch => { h.state = { ...h.state, ...patch }; },
      value: id => controller.bound?.(ctx(), id, '') ?? String(h.local[id] ?? ''), checked: id => h.local[id] === true,
      setLocal: p => Object.assign(h.local, p), out: id => h.outs[id], setOut: p => Object.assign(h.outs, p), setView: p => Object.assign(h.view, p) });
    h.act = (fn, arg) => controller.actions[fn](ctx(), arg);
    h.change = (id, v) => { if (!controller.change?.(ctx(), id, v)) h.local[id] = v; };
    return h;
  };
  const r = harness(49, 'register');
  r.act('addControl49');
  assert.equal(r.outs.controlStatusMessage49, R.registers[49].messages.missing);
  Object.assign(r.local, { controlId49: 'C1', controlRisk49: 'risk', controlEvidence49: 'unknown', controlOwner49: 'owner' });
  r.act('addControl49');
  assert.deepEqual(r.state.controlRows, [{ id: 'C1', control: 'risk', status: 'Proposed / not verified', evidence: 'unknown', owner: 'owner' }]);
  assert.equal(r.local.controlId49, ''); assert.equal(r.local.controlStatus49, 'Proposed / not verified');
  const r60 = harness(60, 'register');
  Object.assign(r60.local, { readyId60: 'R1', readySource60: 's', readyOwner60: 'o', readyCritical60: true });
  r60.act('addReady60');
  assert.equal(r60.state.readyRows[0].critical, true); assert.equal(r60.local.readyCritical60, false);
  assert.equal(r60.outs.readySummary60, 'Register changed; summarize again.');
  r60.act('summarizeReady60'); assert.match(r60.outs.readySummary60, /Critical blockers: R1\./);
  const cash = harness(56, 'cash56');
  assert.equal(cash.state.cashDraft, undefined);
  cash.act('runCash56'); assert.match(cash.outs.cashResult56, /runway 8\.00 months/); assert.equal(cash.view.cash.rows.length, 12);
  cash.change('cash_opening56', '-5');
  assert.deepEqual(cash.state.cashDraft, { opening: '-5', upfront: '20000', receipts: '10000', payments: '20000', funding: '0', buffer: '10000', scenario: 'base' });
  assert.equal(cash.outs.cashResult56, T.CASH56.changed); assert.equal(cash.view.cash, null);
  cash.act('runCash56'); assert.equal(cash.outs.cashResult56, T.CASH56.invalid);
  const p = harness(46, 'prompt');
  p.act('exportResearch46'); assert.equal(p.outs.researchPrompt46, 'Choose a role to prepare a prompt first.');
  p.act('prepareResearch46', 'organiser'); assert.match(p.outs.researchPrompt46, /^ROLE: organiser\nTASK: Organise only supplied/);
  assert.ok(p.outs.researchPrompt46.endsWith('No usability, demand or readiness verified.'));
  const k = harness(48, 'contract48');
  k.change('contractCase48', 'invalid'); k.act('loadContractSample48');
  assert.equal(k.state.contractCase, 'invalid'); assert.equal(k.outs.contractOutput48, T.CONTRACT48.loaded);
  k.act('checkContract48'); assert.match(k.outs.contractOutput48, /boolean available required/);
  const b = harness(51, 'brand51', { ...full(51), fields: { promise: 'Clear routes' } });
  b.act('checkBrand51'); assert.match(b.outs.brandContrast51, /^\d+\.\d\d:1 — meets 4\.5:1/); assert.equal(b.view.brand.text, 'Clear routes');
  b.change('brandInk51', 'navy'); assert.equal(b.state.brandInk, 'navy'); b.act('checkBrand51'); assert.equal(b.outs.brandContrast51, 'Enter both colours as #RRGGBB.');
  const s = harness(57, 'sample57');
  s.act('loadSample57'); s.act('checkSample57'); assert.match(s.outs.sampleResult57, /^FICTIONAL SAMPLE: 1 \/ 2/);
  const sh = harness(53, 'shares53'); sh.act('calculateShares53'); assert.match(sh.outs.sharesResult53, /^HYPOTHETICAL: existing total 100/);
  const pr = harness(45, 'prototype45'); pr.act('showPrototype45'); assert.equal(pr.view.prototype.title, 'Answer target'); assert.equal(pr.outs.artifactStatus, T.PROTOTYPE45.previewed);
});
