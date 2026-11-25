import type { Block, LessonDefinition } from '../types';

/**
 * The authored per-lesson coaching from the former scripted coach, normalised across phases.
 * It now serves two purposes: lesson notes for the AI Coach's system prompt, and offline guidance
 * shown when the AI service is unavailable.
 */
export type ModeId = 'teach' | 'guide' | 'challenge' | 'review';
export type Guidance = { mode: ModeId; label: string; text: string };

export const MODE_LABELS: Record<ModeId, string> = { teach: 'Teach me', guide: 'Guide me', challenge: 'Challenge me', review: 'Review my work' };
export const MODE_ORDER: ModeId[] = ['teach', 'guide', 'challenge', 'review'];
/** What each button asks the coach. */
export const MODE_PROMPTS: Record<ModeId, string> = {
  teach: 'Teach me the key idea of this lesson and why it matters for my venture. Use my answers where they help.',
  guide: 'Guide me through this lesson\'s worksheet step by step, starting from what I have already written.',
  challenge: 'Challenge my idea. Push on my weakest assumptions in this lesson and anything that conflicts with my earlier lessons.',
  review: 'Review my work in this lesson. What is strong, what is vague or unsupported, and what should I fix first?',
};

const modeOf = (raw: string): ModeId | null => {
  const k = raw.toLowerCase();
  if (k.startsWith('teach') || k.startsWith('explain')) return 'teach';
  if (k.startsWith('guide')) return 'guide';
  if (k.startsWith('challenge')) return 'challenge';
  if (k.startsWith('review')) return 'review';
  return null;
};

/** Remove the "simulated / scripted / no live AI" framing; keep the teaching content. */
export function cleanGuidance(text: string): string {
  return text
    .replace(/^\s*Scripted field check:\s*/i, 'Field check: ')
    .replace(/^\s*(?:Simulated|Scripted)(?:\s+\w+)?(?:\s+(?:guidance|check))?\s*:\s*/i, '')
    .split(/(?<=[.!?])\s+/)
    .filter(s => !/live AI|simulated|scripted demonstration|predefined|not generated|I have not inspected/i.test(s))
    .join(' ')
    .replace(/[Tt]his scripted check/g, 'This check')
    .replace(/\bScripted field/g, 'Field').replace(/\bscripted field/g, 'field')
    .trim()
    .replace(/^[a-z]/, c => c.toUpperCase());
}

const isCoach = (b: Block) => b.type === 'coach' || (b.type === 'extension' && b.id === 'coach');

/** Extract the lesson's four coaching modes from whichever coach format its phase uses. */
export function lessonGuidance(lesson: LessonDefinition): Guidance[] {
  const block = lesson.sections.flatMap(s => s.blocks).find(isCoach);
  if (!block) return [];
  const p = (block.type === 'coach' ? block : (block as { props?: Record<string, unknown> }).props ?? {}) as Record<string, any>;
  const found = new Map<ModeId, string>();
  if (Array.isArray(p.modes)) for (const m of p.modes) {
    if (typeof m === 'string') { const id = modeOf(m); if (id) found.set(id, `${p.prefix ?? ''}${m}${p.suffix ?? ''}`); continue; }
    const id = modeOf(String(m?.id ?? m?.label ?? ''));
    const text = m?.response ?? p.replies?.[m?.id];
    if (id && typeof text === 'string') found.set(id, text);
  }
  return MODE_ORDER.filter(id => found.has(id)).map(id => ({ mode: id, label: MODE_LABELS[id], text: cleanGuidance(found.get(id)!) })).filter(g => g.text);
}

/** Section blocks the AI Coach replaces: the scripted coach and its "simulated / no live AI" notes. */
export function replacedByAiCoach(block: Block): boolean {
  if (isCoach(block)) return true;
  if (block.type !== 'content') return false;
  const text = JSON.stringify(block.nodes);
  return /Simulated Coach|Simulated guidance|scripted Coach|Scripted demonstration|scripted guidance modes|Responses are predefined|no AI\/backend/i.test(text) && text.length < 600;
}

/** Fill the {missing} token used by the authored review text. */
export const fillMissing = (text: string, missing: number) => text.replace(/\{missing\}/g, String(missing));
