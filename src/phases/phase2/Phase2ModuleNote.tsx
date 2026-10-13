import type { ContentNode, ExtensionProps } from '../../lesson-system/types';
import { isComplete } from '../../lesson-system/state';
import { schemaFor } from '../../lesson-system/registry';
import { Nodes } from '../../lesson-system/components/Content';
import { readProgress } from '../../progress';
import { checkpointText, moduleStatusText, type ModuleNoteProps } from './phase2.logic';

/**
 * Module note under the completion button (legacy #moduleStatus / Lesson 40 #phaseCheckpoint).
 * Other lessons are re-validated from this browser's saved records; the open lesson uses live state.
 */
export function Phase2ModuleNote({ lesson, state, navigate, props }: ExtensionProps) {
  const config = props as unknown as ModuleNoteProps;
  const saved = readProgress().complete;
  const live = isComplete(state, schemaFor(lesson.number));
  const done = (n: number) => n === lesson.number ? live : saved.includes(n);
  return <div className="note phase2-module-note">
    <h3>{config.heading}</h3>
    <p>{moduleStatusText(config, done)}</p>
    <Nodes nodes={config.notes as ContentNode[]} navigate={navigate} />
    {config.checkpoint && <p>{checkpointText(config.checkpoint, done)}</p>}
  </div>;
}
