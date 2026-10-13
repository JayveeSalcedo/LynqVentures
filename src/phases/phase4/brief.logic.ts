import type { Block, LessonDefinition, LessonState } from '../../lesson-system/types';
import type { AgentPromptConfig, BriefConfig } from './types';
import { rowsOf, rowSpecs } from './rows.logic';

export const redTeamIds = ['bias', 'counter', 'constraint'];

const extensionProps = <T,>(lesson: LessonDefinition, id: string): T | undefined => {
  for (const section of lesson.sections) for (const block of section.blocks as Block[]) if (block.type === 'extension' && block.id === id) return block.props as T;
  return undefined;
};
export const briefConfig = (lesson: LessonDefinition) => extensionProps<BriefConfig>(lesson, 'brief');

/** Exact port of the legacy Launch `brief()` Markdown (also used as the agent-prompt context). */
export function buildBrief(lesson: LessonDefinition, state: LessonState): string {
  const config = briefConfig(lesson);
  if (!config) throw new Error(`Lesson ${lesson.number} has no brief configuration`);
  const value = (id: string) => state.fields[id] || '[Missing]';
  const worksheet = lesson.fields.filter(f => !redTeamIds.includes(f.id));
  const rows = config.key in rowSpecs ? rowsOf(state, config.key) : [];
  const extraValue = config.extra ? (state[config.extra.key] && typeof state[config.extra.key] === 'object' && !Array.isArray(state[config.extra.key]) ? state[config.extra.key] : {}) : null;
  return '# Lesson ' + lesson.number + ' — ' + lesson.title + '\n\n' + config.header + '\n\n'
    + worksheet.map(f => '## ' + f.label + '\n' + value(f.id)).join('\n\n')
    + '\n\n## Red-team review\n' + redTeamIds.map(id => id + ': ' + value(id)).join('\n')
    + '\n\n## ' + config.heading + '\n' + JSON.stringify(rows, null, 2)
    + (config.extra ? '\n\n' + config.extra.label + ':\n' + JSON.stringify(extraValue, null, 2) : '')
    + '\n\n' + config.footer;
}

/** Legacy `prepare*(role)` prompt text. */
export function buildAgentPrompt(config: AgentPromptConfig, role: string, brief: string): string {
  return 'ROLE: ' + role + '\nTASK: ' + config.tasks[role] + config.suffix + brief;
}
