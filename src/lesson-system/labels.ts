import curriculum from '../data/curriculum.json';

/**
 * One presentation convention for every lesson and overview. The legacy-derived data keeps its
 * original labels (so it stays traceable to the source); these helpers decide what learners see.
 */
export const SECTION_NAMES = ['WATCH', 'LEARN', 'BUILD', 'AI COACH', 'CHALLENGE', 'KNOWLEDGE CHECK', 'DELIVER & PROGRESS'] as const;
const NAV_NAMES: Record<string, string> = {
  WATCH: 'Watch', LEARN: 'Learn', BUILD: 'Build', 'AI COACH': 'AI Coach', CHALLENGE: 'Challenge', 'KNOWLEDGE CHECK': 'Knowledge check',
  'DELIVER & PROGRESS': 'Deliver', 'DELIVER & PHASE CHECKPOINT': 'Checkpoint', 'DELIVER & GRADUATION': 'Graduation',
};

/** "04 / ASK AI" → "04 / AI COACH"; the final step names the phase checkpoint or graduation. */
export function sectionLabel(label: string, lesson: number): string {
  const step = Number(/^(\d+)/.exec(label)?.[1]);
  if (!(step >= 1 && step <= SECTION_NAMES.length)) return label;
  let name: string = SECTION_NAMES[step - 1];
  if (step === 7 && lesson === 100) name = 'DELIVER & GRADUATION';
  else if (step === 7 && lesson > 0 && lesson % 20 === 0) name = 'DELIVER & PHASE CHECKPOINT';
  return `${String(step).padStart(2, '0')} / ${name}`;
}

/** Short title-case name for the in-page section nav. */
export const navLabel = (label: string, lesson: number) => {
  const name = sectionLabel(label, lesson).replace(/^\d+ \/ /, '');
  return NAV_NAMES[name] ?? name;
};

/** "35–45 minutes · …" → "35–45 min · …". */
export const lessonMeta = (meta: string) => meta.replace(/(\d+\s*[–-]\s*\d+)\s*minutes\b/g, '$1 min');

/** "Phase 04 · Launch · Lessons 61–80". */
export function phaseEyebrow(phase: number): string {
  const title = curriculum.phases[phase - 1]?.title ?? '';
  return `Phase ${String(phase).padStart(2, '0')} · ${title} · Lessons ${(phase - 1) * 20 + 1}–${phase * 20}`;
}
