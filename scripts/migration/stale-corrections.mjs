// Statements from the partially-built prototype that described lessons as unavailable or "planned".
// They are false now that all 100 lessons are native, so extractors replace them and tests apply
// the same table when comparing generated data with the legacy source.
export const STALE = {
  1: [
    [' Phase 02 is a planned handoff only.', ' Phase 02 · Validate continues with Lesson 21.'],
    ['Phase 02 · Validate — planned handoff', 'Phase 02 · Validate — next'],
  ],
  3: [
    ['Phase 04 begins with interactive Lesson 61; later lessons remain planned previews.', 'Phase 04 continues with Lesson 61; all 100 lessons are interactive.'],
    ['Phase 04 Lesson 61 is available; later lessons are planned previews.', 'Phase 04 continues with Lesson 61.'],
  ],
};
/** Apply a phase's corrections to a legacy string (for test comparisons). */
export const corrected = (phase, text) => (STALE[phase] ?? []).reduce((t, [from, to]) => t.split(from).join(to), text);
