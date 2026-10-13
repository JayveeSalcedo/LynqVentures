/** Hash routes: #orientation (or empty), #phase/1–5, #lesson/1–100. Unknown hashes fall back to orientation. */
export type Location = { phase: number; lesson: number | null };

export function parseHash(hash: string): Location {
  const lesson = /^#lesson\/(\d+)$/.exec(hash);
  if (lesson && Number(lesson[1]) >= 1 && Number(lesson[1]) <= 100) return { phase: Math.ceil(Number(lesson[1]) / 20), lesson: Number(lesson[1]) };
  const phase = /^#phase\/([1-5])$/.exec(hash);
  return { phase: phase ? Number(phase[1]) : 0, lesson: null };
}

export const hashFor = (phase: number, lesson: number | null = null) => lesson ? `lesson/${lesson}` : phase ? `phase/${phase}` : 'orientation';

/** Next step after a lesson: the following lesson (crossing phase boundaries), or graduation review after 100. */
export const nextStep = (n: number): Location | 'graduation' => n < 100 ? { phase: Math.ceil((n + 1) / 20), lesson: n + 1 } : 'graduation';
