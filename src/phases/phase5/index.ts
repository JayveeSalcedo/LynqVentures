import type { DashboardDefinition, LessonDefinition, PhaseModule } from '../../lesson-system/types';
import { buildBrief, normalizeExtra } from './logic';
import { BriefTool, Calculator, CeoWorkbench, CheckPanel, Coach, Graduation100, ModuleStatus, PromptWorkbench, RecordLogTool, Story, VideoPromptTool } from './components';

/**
 * Phase 05 · Scale (Lessons 81–100). Legacy save() set `completed=false` on every edit
 * ("Draft changed; completion must be confirmed again."), so completion is revoked on any edit.
 */
const phase5: PhaseModule = {
  phase: 5,
  revokeOnAnyEdit: true,
  loadLesson: n => import(`../../data/lessons/phase-5/lesson-${String(n).padStart(2, '0')}.json`).then(m => m.default as unknown as LessonDefinition),
  loadDashboard: () => import('../../data/dashboards/phase-5.json').then(m => m.default as unknown as DashboardDefinition),
  normalizeExtra,
  buildDeliverable: (lesson, state) => buildBrief(lesson, state),
  extensions: {
    story: Story,
    videoPrompt: VideoPromptTool,
    coach: Coach,
    recordLog: RecordLogTool,
    checkPanel: CheckPanel,
    calculator: Calculator,
    promptWorkbench: PromptWorkbench,
    ceoWorkbench: CeoWorkbench,
    brief: BriefTool,
    moduleStatus: ModuleStatus,
    graduation100: Graduation100,
  },
};
export default phase5;
