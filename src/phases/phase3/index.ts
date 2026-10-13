import type { DashboardDefinition, LessonDefinition, PhaseModule } from '../../lesson-system/types';
import { ToolNote } from './components/ToolNote';
import { BriefPanel } from './components/BriefPanel';
import { Coach } from './components/Coach';
import { ModuleStatus } from './components/ModuleStatus';
import { buildBrief } from './logic/brief';
import { normalizeExtra } from './logic/normalize';

const phase3: PhaseModule = {
  phase: 3,
  // Legacy save() only cleared completion when valid() failed.
  revokeOnAnyEdit: false,
  loadLesson: n => import(`../../data/lessons/phase-3/lesson-${String(n).padStart(2, '0')}.json`).then(m => m.default as unknown as LessonDefinition),
  loadDashboard: () => import('../../data/dashboards/phase-3.json').then(m => m.default as unknown as DashboardDefinition),
  normalizeExtra,
  // The legacy brief() format (field ids, lesson-specific register tails) is reproduced exactly.
  buildDeliverable: (lesson, state) => buildBrief(lesson, state),
  extensions: { tool: ToolNote, brief: BriefPanel, coach: Coach, moduleStatus: ModuleStatus },
};
export default phase3;
