import curriculum from '../data/curriculum.json';
import type { LessonSchema, PhaseModule } from './types';

/** Phase modules are loaded on demand so each phase (and each lesson file) is its own chunk. */
const loaders: Record<number, () => Promise<{ default: PhaseModule }>> = {
  1: () => import('../phases/phase1'),
  2: () => import('../phases/phase2'),
  3: () => import('../phases/phase3'),
  4: () => import('../phases/phase4'),
  5: () => import('../phases/phase5'),
};

export const phaseOf = (n: number) => Math.ceil(n / 20);
export const loadPhase = async (phase: number) => (await loaders[phase]()).default;
export const schemaFor = (n: number) => (curriculum.schemas as Record<string, LessonSchema>)[String(n)];
export const lessonName = (n: number) => (curriculum.names as Record<string, string>)[String(n)];
