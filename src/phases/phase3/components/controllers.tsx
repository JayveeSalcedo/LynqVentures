import { useEffect, useRef, useState } from 'react';
import { downloadText } from '../../../lesson-system/deliverable';
import { buildBrief } from '../logic/brief';
import { addRegisterRow, registerExport, registerRows, registers, removeRegisterRow, type Draft } from '../logic/registers';
import {
  BRAND51, CASH56, CASH_SCENARIOS56, CONTRACT48, CONTRACT_CASES48, PROTOTYPE45, SAMPLE57, betaGate58, brandPair51, calculateShares53, cashExport56, cashKeys56,
  cashMessage56, cashModel56, cashValues56, checkContract48, checkPermission49, contractSample48, contrastMessage51, explainTeam55, fixGate59, loadSample57, money56,
  preparePrompt, prototypeConfig45, prototypeHtml45, readinessMessage60, releaseGate50, runOnboard52, sampleExport57, sampleMessage57, sampleModel57,
  shellTransitions, simulateApi45, tokens51, triageIP54, type CashKey, type CashModel, type ShellState,
} from '../logic/tools';
import type { Controller, ToolCtx, ToolProps } from './ToolNote';

const noop: Controller = { actions: {} };

/** Prompt workbench: prepare*(role) fills the read-only prompt; export*Prompt downloads it (or writes the legacy hint). */
function promptController(props: ToolProps, n: number): Controller {
  const spec = props.prompt!;
  const actions = props.items.filter(i => i.kind === 'action') as { fn: string; arg?: string }[];
  const prepareFn = actions.find(a => a.arg)!.fn;
  const exportFn = actions.find(a => !a.arg)!.fn;
  const outputId = (props.items.find(i => i.kind === 'output' && i.tag === 'textarea') as { id: string }).id;
  return {
    actions: {
      [prepareFn]: (ctx, role) => {
        const cash = n === 56 ? (() => { const v = cashValues56(ctx.state); return cashModel56(v.values, v.scenario); })() : undefined;
        ctx.setOut({ [outputId]: preparePrompt(spec, role!, buildBrief(ctx.lesson, ctx.state), cash) });
      },
      [exportFn]: ctx => {
        const text = ctx.out(outputId);
        if (!text) { ctx.setOut({ [outputId]: spec.empty }); return; }
        downloadText(text, spec.filename);
      },
    },
  };
}

function registerController(n: number): Controller {
  const spec = registers[n];
  const changed = (ctx: ToolCtx) => spec.changedOutput ? { [spec.changedOutput.id]: spec.changedOutput.text } : {};
  const actions: Controller['actions'] = {
    [spec.addFn]: ctx => {
      const draft: Draft = Object.fromEntries(ctx.controls.map(c => [c.id, c.control === 'checkbox' ? ctx.checked(c.id) : ctx.value(c.id)]));
      const result = addRegisterRow(spec, registerRows(spec, ctx.state), draft);
      if ('error' in result) { ctx.setOut({ [spec.statusId]: result.error }); return; }
      ctx.update({ [spec.key]: result.rows });
      ctx.setLocal(Object.fromEntries(spec.clear.map(id => [id, ctx.controls.find(c => c.id === id)?.control === 'checkbox' ? false : ''])));
      ctx.setOut({ [spec.statusId]: result.message, ...changed(ctx) });
    },
  };
  if (spec.exportFn) actions[spec.exportFn] = ctx => { const file = registerExport(spec, ctx.state); downloadText(file.text, file.filename); };
  if (n === 60) actions.summarizeReady60 = ctx => ctx.setOut({ readySummary60: readinessMessage60(ctx.state) });
  return {
    actions,
    render: {
      [spec.rowsId]: ctx => {
        const rows = registerRows(spec, ctx.state);
        return <ol className="p3-rows" aria-label="Saved register rows">{rows.map((row, i) => <li key={i} className="row-card">{spec.card(row, i)}
          <div className="actions"><button type="button" className="secondary" onClick={() => { ctx.update({ [spec.key]: removeRegisterRow(rows, i) }); ctx.setOut(changed(ctx)); }}>{spec.removeLabel + (i + 1)}</button></div>
        </li>)}</ol>;
      },
    },
  };
}

/** Native rendering of the Lesson 45 sample shell (same states, text and transitions as the exported HTML). */
function PrototypePreview({ title, spec }: { title: string; spec: string }) {
  const [current, setCurrent] = useState<ShellState>('entry');
  const [status, setStatus] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  useEffect(() => { if (moved.current) heading.current?.focus(); }, [current, status]);
  const go = (button: string) => { const to = shellTransitions[button]; moved.current = true; setCurrent(to); setStatus('Current sample state: ' + to); };
  const b = (id: string, label: string) => <button type="button" onClick={() => go(id)}>{label}</button>;
  return <section className="p3-prototype" aria-label="Local sample prototype shell">
    <small>LOCAL SAMPLE SHELL · FICTIONAL DATA · NO API</small>
    <h3>{title}</h3><p>{spec}</p>
    {current === 'entry' && <div><h4 ref={heading} tabIndex={-1}>Sample invitation</h4><div className="actions">{b('start', 'Explore sample routes')}</div></div>}
    {current === 'choices' && <div><h4 ref={heading} tabIndex={-1}>Choose a sample route</h4><div className="actions">{b('available', 'Available route')}{b('unavailable', 'Unavailable route')}{b('cancel', 'Cancel')}</div></div>}
    {current === 'recovery' && <div><h4 ref={heading} tabIndex={-1}>Sample route unavailable</h4><p>No registration was made. Choose another route or exit.</p><div className="actions">{b('retry', 'Back to choices')}{b('exit', 'Exit')}</div></div>}
    {current === 'destination' && <div><h4 ref={heading} tabIndex={-1}>Sample destination</h4><p>You reached the fictional destination screen. No account, payment or registration exists.</p><div className="actions">{b('restart', 'Restart')}</div></div>}
    <p role="status">{status}</p>
  </section>;
}

const prototype45: Controller = {
  actions: {
    showPrototype45: ctx => { ctx.setView({ prototype: prototypeConfig45(ctx.state.fields), key: Number(ctx.view.key ?? 0) + 1 }); ctx.setOut({ artifactStatus: PROTOTYPE45.previewed }); },
    exportPrototype45: ctx => { downloadText(prototypeHtml45(ctx.state.fields), PROTOTYPE45.filename); ctx.setOut({ artifactStatus: PROTOTYPE45.exported }); },
  },
  render: {
    prototype45: ctx => { const cfg = ctx.view.prototype as { title: string; spec: string } | undefined; return cfg ? <PrototypePreview key={String(ctx.view.key)} {...cfg} /> : null; },
  },
};

const api45: Controller = { actions: { simulateApi45: ctx => ctx.setOut({ apiOutput45: simulateApi45(ctx.value('apiCase45')) }) } };

const contract48: Controller = {
  bound: (ctx, id) => id === 'contractJson48' ? (typeof ctx.state.contractDraft === 'string' ? ctx.state.contractDraft : '')
    : id === 'contractCase48' ? (CONTRACT_CASES48.includes(ctx.state.contractCase as string) ? ctx.state.contractCase as string : 'valid') : undefined,
  change: (ctx, id, value) => {
    if (id === 'contractJson48') { ctx.update({ contractDraft: value }); ctx.setOut({ contractOutput48: CONTRACT48.edited }); return true; }
    if (id === 'contractCase48') { ctx.update({ contractCase: value }); return true; }
    return false;
  },
  actions: {
    loadContractSample48: ctx => { const mode = ctx.value('contractCase48'); ctx.update({ contractDraft: contractSample48(mode), contractCase: mode }); ctx.setOut({ contractOutput48: CONTRACT48.loaded }); },
    checkContract48: ctx => ctx.setOut({ contractOutput48: checkContract48(ctx.value('contractJson48')) }),
  },
};

const permission49: Controller = { actions: { checkPermission49: ctx => ctx.setOut({ policyOutput49: checkPermission49(ctx.value('policyActor49'), ctx.value('policyScope49'), ctx.value('policyAction49'), ctx.checked('policySigned49'), ctx.checked('policyAgent49')) }) } };
const gate50: Controller = { actions: { explainReleaseGate50: ctx => ctx.setOut({ gateOutput50: releaseGate50(ctx.value('gateBuild50'), ctx.value('gateChecks50'), ctx.value('gateControls50'), ctx.value('gateRecovery50')) }) } };

const brand51: Controller = {
  bound: (ctx, id) => id === 'brandInk51' ? (ctx.state.brandInk as string) || BRAND51.defaultInk : id === 'brandPaper51' ? (ctx.state.brandPaper as string) || BRAND51.defaultPaper : undefined,
  change: (ctx, id, value) => { ctx.update({ [id === 'brandInk51' ? 'brandInk' : 'brandPaper']: value }); ctx.setOut({ brandContrast51: BRAND51.changed }); return true; },
  actions: {
    checkBrand51: ctx => {
      const pair = brandPair51(ctx.value('brandInk51'), ctx.value('brandPaper51'));
      if (!pair) { ctx.setOut({ brandContrast51: BRAND51.invalid }); return; }
      ctx.setOut({ brandContrast51: contrastMessage51(pair.ratio) });
      ctx.setView({ brand: { color: pair.text, backgroundColor: pair.background, text: ctx.state.fields.promise || BRAND51.preview } });
    },
    exportTokens51: ctx => {
      const pair = brandPair51(ctx.value('brandInk51'), ctx.value('brandPaper51'));
      if (!pair) { ctx.setOut({ brandContrast51: BRAND51.invalidExport }); return; }
      downloadText(tokens51(pair, ctx.state.fields), BRAND51.filename);
    },
  },
  render: {
    brandPreview51: (ctx, item) => {
      const brand = ctx.view.brand as { color: string; backgroundColor: string; text: string } | undefined;
      return <div className="p3-brand-preview" dir="auto" style={brand ? { color: brand.color, backgroundColor: brand.backgroundColor } : undefined}>{brand?.text ?? item.initial}</div>;
    },
  },
};

const onboard52: Controller = { actions: { runOnboard52: ctx => ctx.setOut({ onboardResult52: runOnboard52(ctx.value('onboardCase52')) }) } };
const shares53: Controller = { actions: { calculateShares53: ctx => ctx.setOut({ sharesResult53: calculateShares53(ctx.value('sharesA53'), ctx.value('sharesB53'), ctx.value('sharesNew53')) }) } };
const triage54: Controller = { actions: { triageIP54: ctx => ctx.setOut({ ipResult54: triageIP54(ctx.value('ipCase54')) }) } };
const team55: Controller = { actions: { explainTeam55: ctx => ctx.setOut({ teamResult55: explainTeam55(ctx.value('teamCase55')) }) } };

const cashId = (k: CashKey) => `cash_${k}56`;
const currentCash = (ctx: ToolCtx) => cashValues56(ctx.state);
const cash56: Controller = {
  bound: (ctx, id) => {
    const { values, scenario } = currentCash(ctx);
    if (id === 'cashScenario56') return scenario;
    const key = cashKeys56.find(k => cashId(k) === id);
    return key ? values[key] : undefined;
  },
  change: (ctx, id, value) => {
    const { values, scenario } = currentCash(ctx);
    const draft: Record<string, string> = Object.fromEntries(cashKeys56.map(k => [k, cashId(k) === id ? value : values[k]]));
    draft.scenario = id === 'cashScenario56' && CASH_SCENARIOS56.includes(value) ? value : scenario;
    ctx.update({ cashDraft: draft });
    ctx.setOut({ cashResult56: CASH56.changed });
    ctx.setView({ cash: null });
    return true;
  },
  actions: {
    runCash56: ctx => {
      const { values, scenario } = currentCash(ctx);
      const m = cashModel56(values, scenario);
      ctx.setOut({ cashResult56: m ? cashMessage56(m) : CASH56.invalid });
      ctx.setView({ cash: m });
    },
    exportCash56: ctx => {
      const { values, scenario } = currentCash(ctx);
      const m = cashModel56(values, scenario);
      if (!m) { ctx.setOut({ cashResult56: CASH56.invalid }); ctx.setView({ cash: null }); return; }
      downloadText(cashExport56(ctx.state.fields, m), CASH56.filename);
    },
  },
  render: {
    cashTable56: ctx => {
      const m = ctx.view.cash as CashModel | null | undefined;
      if (!m) return null;
      return <div className="table-scroll"><table><caption>{CASH56.caption}</caption>
        <thead><tr>{CASH56.headers.map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead>
        <tbody>{m.rows.map(r => <tr key={r.month}><td>{r.month}</td><td>{money56(r.opening)}</td><td>{money56(r.customerCollections)}</td><td>{money56(r.cashPayments)}</td><td>{money56(r.closing)}</td></tr>)}</tbody>
      </table></div>;
    },
  },
};

const sample57: Controller = {
  bound: (ctx, id) => id === 'sampleJson57' ? (typeof ctx.state.sampleDraft === 'string' ? ctx.state.sampleDraft : '') : undefined,
  change: (ctx, id, value) => { if (id !== 'sampleJson57') return false; ctx.update({ sampleDraft: value }); ctx.setOut({ sampleResult57: SAMPLE57.changed }); return true; },
  actions: {
    loadSample57: ctx => { ctx.update({ sampleDraft: loadSample57() }); ctx.setOut({ sampleResult57: SAMPLE57.loaded }); },
    checkSample57: ctx => ctx.setOut({ sampleResult57: sampleMessage57(sampleModel57(ctx.value('sampleJson57'))) }),
    exportSample57: ctx => {
      const m = sampleModel57(ctx.value('sampleJson57'));
      if ('error' in m) { ctx.setOut({ sampleResult57: m.error }); return; }
      downloadText(sampleExport57(m), SAMPLE57.filename);
    },
  },
};

const beta58: Controller = { actions: { explainBeta58: ctx => ctx.setOut({ betaGate58: betaGate58(ctx.value('betaBuild58'), ctx.value('betaData58'), ctx.value('betaMeasure58'), ctx.value('betaSupport58')) }) } };
const fix59: Controller = { actions: { explainFix59: ctx => ctx.setOut({ fixGate59: fixGate59(ctx.value('fixArtifact59'), ctx.value('fixTests59'), ctx.value('fixControls59'), ctx.value('fixRecovery59')) }) } };

const fixed: Record<string, Controller> = { prototype45, api45, contract48, permission49, gate50, brand51, onboard52, shares53, triage54, team55, cash56, sample57, beta58, fix59 };

export function controllerFor(props: ToolProps, n: number): Controller {
  if (props.tool === 'prompt' && props.prompt) return promptController(props, n);
  if (props.tool === 'register' && registers[n]) return registerController(n);
  return fixed[props.tool] ?? noop;
}

/** Tool names this phase can render (used by tests to detect unknown tools). */
export const knownTools = (tool: string, n: number) => tool === 'prompt' || (tool === 'register' && !!registers[n]) || tool in fixed;
