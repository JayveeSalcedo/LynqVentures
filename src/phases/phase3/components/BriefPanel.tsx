import { useEffect, useRef, useState } from 'react';
import type { ExtensionProps } from '../../../lesson-system/types';
import { downloadText } from '../../../lesson-system/deliverable';
import { buildBrief } from '../logic/brief';
import { RUNBOOK50_FILENAME, runbook50 } from '../logic/tools';

export type BriefProps = { previewLabel: string; downloadLabel: string; runbookLabel?: string };

/** Preview/download of the legacy brief (and the Lesson 50 runbook). Preview hides again when a field changes. */
export function BriefPanel({ lesson, state, props }: ExtensionProps) {
  const { previewLabel, downloadLabel, runbookLabel } = props as unknown as BriefProps;
  const [preview, setPreview] = useState<string | null>(null);
  const fields = JSON.stringify(state.fields);
  const first = useRef(fields);
  useEffect(() => { if (fields !== first.current) { first.current = fields; setPreview(null); } }, [fields]);
  return <div className="p3-brief">
    <div className="actions">
      <button type="button" className="secondary" onClick={() => setPreview(buildBrief(lesson, state))}>{previewLabel}</button>
      <button type="button" className="secondary" onClick={() => downloadText(buildBrief(lesson, state), lesson.deliverable.filename)}>{downloadLabel}</button>
      {runbookLabel && <button type="button" className="secondary" onClick={() => downloadText(runbook50(buildBrief(lesson, state)), RUNBOOK50_FILENAME)}>{runbookLabel}</button>}
    </div>
    {preview !== null && <pre className="deliverable-preview" tabIndex={0} aria-label={`${lesson.deliverable.title} preview`}>{preview}</pre>}
  </div>;
}
