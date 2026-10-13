import type { DashboardDefinition, LessonDefinition, PhaseModule } from '../../lesson-system/types';
import { buildPhase2Markdown, normalizeExtra } from './phase2.logic';
import { Phase2Coach } from './Phase2Coach';
import { Phase2ModuleNote } from './Phase2ModuleNote';

const phase2: PhaseModule = {
  phase: 2,
  // Legacy save() clears completion only when the completion criteria no longer hold.
  revokeOnAnyEdit: false,
  loadLesson: n => import(`../../data/lessons/phase-2/lesson-${String(n).padStart(2, '0')}.json`).then(m => m.default as LessonDefinition),
  loadDashboard: () => import('../../data/dashboards/phase-2.json').then(m => m.default as DashboardDefinition),
  normalizeExtra,
  buildDeliverable: buildPhase2Markdown,
  extensions: { coach: Phase2Coach, moduleNote: Phase2ModuleNote },
};
export default phase2;
