import type { ExtensionProps } from '../../../lesson-system/types';
import { readProgress } from '../../../progress';

const moduleLessons: Record<string, number[]> = { '3.1': [41, 42, 43, 44, 45], '3.2': [46, 47, 48, 49, 50], '3.3': [51, 52, 53, 54, 55], '3.4': [56, 57, 58, 59, 60] };

/** Legacy #moduleStatus line: module count of valid self-completions, re-read on every render. */
export function ModuleStatus({ props }: ExtensionProps) {
  const { module, text } = props as { module: string; text: string };
  let count = 0;
  try { const done = readProgress().complete; count = (moduleLessons[module] ?? []).filter(n => done.includes(n)).length; } catch { count = 0; }
  return <p className="p3-module-status">{'Module ' + module + ': ' + count + text}</p>;
}
