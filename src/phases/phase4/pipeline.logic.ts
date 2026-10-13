import type { Row } from './rows.logic';

/** Legacy `pipeStages67` and the board strings from `renderDeals67`, verbatim. */
export const pipeStages67 = ['New', 'Qualified', 'Evaluation', 'Proposal', 'Closed won', 'Closed lost'];
export const board67 = {
  column: (stage: string) => stage + ' · simulated',
  stageLabel: (id: string) => 'Target simulated stage for ' + id,
  noteLabel: (id: string) => 'Transition evidence/next-action note for ' + id,
  move: (id: string) => 'Move simulated record ' + id,
  remove: (id: string) => 'Remove pipeline record ' + id,
  sameStage: 'Choose a different simulated stage.',
  noNote: 'Enter a transition evidence/next-action note; nothing moved.',
  historyLimit: 'Local history limit: 40 moves. Export before more work.',
  moved: 'Simulated stage updated locally; no buyer outcome or revenue verified.',
};

/** Legacy stage move: a different stage and a note are required; history keeps at most 40 moves. */
export function moveDeal(rows: Row[], index: number, to: string, note: string, now = new Date()): { rows: Row[]; message: string } | { error: string } {
  const row = rows[index];
  if (!row) return { error: board67.sameStage };
  if (to === row.stage) return { error: board67.sameStage };
  if (!note.trim()) return { error: board67.noNote };
  const history = Array.isArray(row.history) ? row.history : [];
  if (history.length >= 40) return { error: board67.historyLimit };
  const next = { ...row, history: [...history, { from: row.stage, to, note: note.trim(), at: now.toISOString(), status: 'simulated, not verified' }], stage: to };
  return { rows: rows.map((r, i) => i === index ? next : r), message: board67.moved };
}
