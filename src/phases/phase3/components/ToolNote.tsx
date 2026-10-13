import { useState, type ReactNode } from 'react';
import type { ContentNode, ExtensionProps, LessonDefinition, LessonState } from '../../../lesson-system/types';
import { Nodes } from '../../../lesson-system/components/Content';
import type { PromptSpec } from '../logic/tools';
import { controllerFor } from './controllers';
import '../phase3.css';

/** Tool markup extracted from the legacy `.note` blocks, in document order. */
export type ToolItem =
  | { kind: 'content'; nodes: ContentNode[] }
  | { kind: 'control'; id: string; label: string; control: 'input' | 'textarea' | 'select' | 'checkbox'; inputType?: string; options?: { value: string; label: string }[]; maxLength?: number; min?: string; max?: string; step?: string; value?: string; placeholder?: string }
  | { kind: 'action'; fn: string; arg?: string; label: string }
  | { kind: 'output'; id: string; tag: string; initial?: string; role?: string; ariaLabel?: string; title?: string };
export type ControlItem = Extract<ToolItem, { kind: 'control' }>;
export type ToolProps = { tool: string; items: ToolItem[]; prompt?: PromptSpec };

export type ToolCtx = {
  lesson: LessonDefinition;
  state: LessonState;
  update: (patch: Partial<LessonState>) => void;
  props: ToolProps;
  controls: ControlItem[];
  /** Current value of a text/select control (bound to the lesson record where the legacy tool saved it). */
  value: (id: string) => string;
  checked: (id: string) => boolean;
  setLocal: (patch: Record<string, string | boolean>) => void;
  out: (id: string) => string | undefined;
  setOut: (patch: Record<string, string>) => void;
  view: Record<string, unknown>;
  setView: (patch: Record<string, unknown>) => void;
};

export type Controller = {
  /** Values persisted in the lesson record; undefined → local draft value. */
  bound?: (ctx: ToolCtx, id: string, fallback: string) => string | undefined;
  /** Handle a control change; return true when handled (bound controls). */
  change?: (ctx: ToolCtx, id: string, value: string) => boolean;
  actions: Record<string, (ctx: ToolCtx, arg?: string) => void>;
  render?: Record<string, (ctx: ToolCtx, item: Extract<ToolItem, { kind: 'output' }>) => ReactNode>;
};

export const controlDefault = (c: ControlItem): string | boolean => c.control === 'checkbox' ? false : c.value ?? c.options?.[0]?.value ?? '';

/** Generic renderer for a legacy tool note; behaviour comes from the lesson's controller. */
export function ToolNote({ lesson, state, update, navigate, props: raw }: ExtensionProps) {
  const props = raw as unknown as ToolProps;
  const controller = controllerFor(props, lesson.number);
  const controls = props.items.filter((i): i is ControlItem => i.kind === 'control');
  const [local, setLocalState] = useState<Record<string, string | boolean>>(() => Object.fromEntries(controls.map(c => [c.id, controlDefault(c)])));
  const [outs, setOuts] = useState<Record<string, string>>({});
  const [view, setViewState] = useState<Record<string, unknown>>({});
  const ctx: ToolCtx = {
    lesson, state, update, props, controls,
    value: id => {
      const c = controls.find(x => x.id === id);
      return controller.bound?.(ctx, id, c ? String(controlDefault(c)) : '') ?? String(local[id] ?? '');
    },
    checked: id => local[id] === true,
    setLocal: patch => setLocalState(old => ({ ...old, ...patch })),
    out: id => outs[id],
    setOut: patch => setOuts(old => ({ ...old, ...patch })),
    view,
    setView: patch => setViewState(old => ({ ...old, ...patch })),
  };
  const onChange = (id: string, value: string) => { if (!controller.change?.(ctx, id, value)) ctx.setLocal({ [id]: value }); };

  // Group consecutive action buttons into one wrapping row.
  const groups: (ToolItem | ToolItem[])[] = [];
  for (const item of props.items) {
    const last = groups[groups.length - 1];
    if (item.kind === 'action' && Array.isArray(last)) last.push(item); else groups.push(item.kind === 'action' ? [item] : item);
  }
  const fid = (id: string) => `p3-${lesson.number}-${id}`;
  return <div className="note tool p3-tool">{groups.map((group, i) => {
    if (Array.isArray(group)) return <div className="actions" key={i}>{group.map((a, j) => a.kind === 'action' &&
      <button type="button" className="secondary" key={j} onClick={() => controller.actions[a.fn]?.(ctx, a.arg)}>{a.label}</button>)}</div>;
    const item = group;
    switch (item.kind) {
      case 'content': return <Nodes key={i} nodes={item.nodes} navigate={navigate} />;
      case 'control': {
        if (item.control === 'checkbox') return <label className="check" key={i}><input type="checkbox" id={fid(item.id)} checked={ctx.checked(item.id)} onChange={e => ctx.setLocal({ [item.id]: e.target.checked })} />{item.label}</label>;
        const common = { id: fid(item.id), value: ctx.value(item.id), onChange: (e: { target: { value: string } }) => onChange(item.id, e.target.value) };
        return <div className="field" key={i}><label htmlFor={fid(item.id)}>{item.label}</label>
          {item.control === 'select'
            ? <select {...common}>{item.options!.map(o => <option key={o.value + o.label} value={o.value}>{o.label}</option>)}</select>
            : item.control === 'textarea'
              ? <textarea {...common} dir="auto" maxLength={item.maxLength} className={item.maxLength && item.maxLength > 2000 ? 'p3-code' : undefined} />
              : <input {...common} type={item.inputType === 'number' ? 'number' : 'text'} dir="auto" maxLength={item.inputType === 'number' ? undefined : item.maxLength} min={item.min} max={item.max} step={item.step} placeholder={item.placeholder} />}
        </div>;
      }
      case 'output': {
        const custom = controller.render?.[item.id];
        if (custom) return <div key={i}>{custom(ctx, item)}</div>;
        const text = outs[item.id] ?? item.initial ?? '';
        if (item.tag === 'textarea') return <textarea key={i} readOnly aria-label={item.ariaLabel ?? 'Prepared prompt'} className="prompt-text" value={text} />;
        if (item.tag === 'pre') return <pre key={i} className="p3-output" role={item.role}>{text}</pre>;
        return <p key={i} role={item.role === 'status' ? 'status' : undefined} className="p3-output-line">{text}</p>;
      }
      default: return null;
    }
  })}</div>;
}
