import { useState } from 'react';
import { graduationStatus, readProgress } from '../../progress';
import type { Navigate } from '../types';

/** Academy-wide learning review. Eligibility records learning completion, never business readiness. */
export function GraduationReview({ navigate }: { navigate: Navigate }) {
  const [status, setStatus] = useState(() => graduationStatus(readProgress()));
  const firstMissing = status.missing[0];
  return <section className="graduation" aria-labelledby="graduation-heading">
    <h3 id="graduation-heading">Graduation review</h3>
    <button type="button" onClick={() => setStatus(graduationStatus(readProgress()))}>Re-check graduation eligibility</button>
    <p role="status">{status.eligible
      ? 'Orientation and all 100 lessons are self-completed locally. You are eligible for the local graduation review. This records learning completion only; it does not certify the venture, its evidence or business readiness.'
      : `${status.count} / 100 lessons self-completed locally${status.orientation ? '' : ' · orientation not yet self-completed'}. Graduation review requires orientation and every lesson to be completed separately.`}</p>
    {!status.eligible && <div className="actions">
      {!status.orientation && <button type="button" onClick={() => navigate(0)}>Open orientation</button>}
      {firstMissing && <button type="button" onClick={() => navigate(Math.ceil(firstMissing / 20), firstMissing)}>Open first incomplete lesson ({firstMissing})</button>}
    </div>}
    {!status.eligible && status.missing.length > 0 && <details><summary>Incomplete lessons ({status.missing.length})</summary><p>{status.missing.join(', ')}</p></details>}
  </section>;
}
