import type { DashboardDefinition, LessonDefinition, PhaseModule } from '../../lesson-system/types';
import { buildDeliverable, normalizeExtra } from './logic';
import { Coach, Download, FieldGroup, ModuleNote, Preview } from './extensions';

const phase1: PhaseModule = {
  phase: 1,
  // Legacy save() clears completion only when the lesson no longer meets its requirements.
  revokeOnAnyEdit: false,
  loadLesson: n => import(`../../data/lessons/phase-1/lesson-${String(n).padStart(2, '0')}.json`).then(m => m.default as LessonDefinition),
  loadDashboard: () => import('../../data/dashboards/phase-1.json').then(m => m.default as DashboardDefinition),
  normalizeExtra: () => normalizeExtra(),
  buildDeliverable: (lesson, state, complete) => buildDeliverable(lesson, state, complete),
  extensions: { coach: Coach, preview: Preview, download: Download, fieldGroup: FieldGroup, moduleNote: ModuleNote },
};
export default phase1;
