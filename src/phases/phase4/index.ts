import type { DashboardDefinition, LessonDefinition, PhaseModule } from '../../lesson-system/types';
import { normalizeExtra } from './rows.logic';
import { buildBrief } from './brief.logic';
import { AgentPrompt, Brief, Calculator, ModuleStatus, Pipeline67, RowLog } from './tools';

/**
 * Phase 04 · Launch. The legacy `save()` cleared `completed` on every edit, so completion is
 * revoked on any edit here too. Exports reproduce the legacy `brief()` Markdown exactly.
 */
const phase4: PhaseModule = {
  phase: 4,
  revokeOnAnyEdit: true,
  loadLesson: n => import(`../../data/lessons/phase-4/lesson-${String(n).padStart(2, '0')}.json`).then(m => m.default as LessonDefinition),
  loadDashboard: () => import('../../data/dashboards/phase-4.json').then(m => m.default as DashboardDefinition),
  normalizeExtra,
  buildDeliverable: (lesson, state) => buildBrief(lesson, state),
  extensions: { rowLog: RowLog, pipeline67: Pipeline67, calc66: Calculator, rate73: Calculator, review76: Calculator, agentPrompt: AgentPrompt, brief: Brief, moduleStatus: ModuleStatus },
};
export default phase4;
