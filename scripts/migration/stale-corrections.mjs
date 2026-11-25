// Learner-facing corrections applied on top of the legacy source.
//
// 1. Statements from the partially-built prototype that described lessons as unavailable or
//    "planned". They are false now that all 100 lessons are native.
// 2. Development/status wording that should never reach learners ("draft for review",
//    "Original curriculum", "· Interactive", "Local prototype export", "this prototype").
//    Privacy and limits notes are kept; only the product name in them changes.
//
// Extractors replace these, and tests apply the same table when comparing generated data with the
// legacy source. Corrections run in order on each string, so later entries may match text produced
// by earlier ones. Entries are [from, to] substring replacements, or [from, to, 'exact'] for a
// whole-string match. Every entry must match at least once per extraction run.

// Privacy/limits notes referred to the app as "this prototype". Lessons 45, 46 and 48 are excluded
// by not applying these in Phase 3, where "prototype" means the learner's own product prototype.
const PRODUCT_NAME = [
  [' this local prototype', ' the Academy'],
  [' this prototype', ' the Academy'],
  ['This prototype', 'The Academy'],
];

export const STALE = {
  1: [
    [' Phase 02 is a planned handoff only.', ' Phase 02 · Validate continues with Lesson 21.'],
    ['Phase 02 · Validate — planned handoff', 'Phase 02 · Validate — next'],
    ['Local prototype export. No reviewer submission or business validation.', 'Exported from LYNQ Venture Studio Academy. Not instructor-reviewed and not evidence of business validation.'],
    ...PRODUCT_NAME,
  ],
  2: [
    ['Four modules, five lessons each. This Phase 02 sequence is a draft for review. Lessons 21–40 are interactive.', 'Four modules, five lessons each.'],
    ...PRODUCT_NAME,
  ],
  3: [
    ['Phase 04 begins with interactive Lesson 61; later lessons remain planned previews.', 'Phase 04 continues with Lesson 61.'],
    ['Phase 04 Lesson 61 is available; later lessons are planned previews.', 'Phase 04 continues with Lesson 61.'],
    ['Original curriculum: four modules, five lessons each. All 20 Build lessons (41–60) interactive; Phase 04 continues with Lesson 61. Intended', 'Four modules, five lessons each. Intended'],
    [' All 20 Build lessons are available. Learning completion is separate from venture readiness; Phase 04 continues with Lesson 61.', ' Learning completion is separate from venture readiness.'],
    [' · Interactive', ''],
    [' (interactive).', '.'],
    [' separately; this prototype saves', ' separately; the Academy saves'],
    [' this local prototype', ' the Academy'],
  ],
  4: [
    ['All five Module 4.1 lessons (61–65) are interactive. All five Module 4.2 lessons (66–70) are interactive; All five Module 4.3 lessons (71–75) are interactive. All five Module 4.4 lessons (76–80) are interactive. No campaign, customer outreach, AI or backend is connected.', 'Four modules, five lessons each. The Academy plans and records your launch work; it does not run campaigns, contact customers or connect to AI.'],
    ['All 20 Launch lessons are interactive. Completion is local learning progress', 'Completion is learning progress'],
    [' · Interactive planning', ''],
    [' · Interactive', ''],
    [' (interactive).', '.'],
    ...PRODUCT_NAME,
  ],
  5: [
    ['Lessons 81–100 are interactive. No live AI, capacity test or expansion is connected.', 'Four modules, five lessons each, covering growth, organization, capital and long-term strategy.'],
    ['Browser-local prototype. Learning progress is separate from business readiness.', 'Progress is saved in this browser. Learning progress is separate from business readiness.'],
    ['Interactive', '', 'exact'],
    ...PRODUCT_NAME,
  ],
};

/** Apply one correction to a string; returns the input unchanged when it does not match. */
export const applyCorrection = (text, [from, to, mode]) => mode === 'exact' ? (text === from ? to : text) : text.split(from).join(to);
export const matches = (text, [from, , mode]) => mode === 'exact' ? text === from : text.includes(from);

/** Apply a phase's corrections to a legacy string (for test comparisons). */
export const corrected = (phase, text) => (STALE[phase] ?? []).reduce(applyCorrection, text);

/** Apply a phase's corrections to every string inside a legacy value (for test comparisons). */
export const correctedDeep = (phase, value) =>
  typeof value === 'string' ? corrected(phase, value)
    : Array.isArray(value) ? value.map(v => correctedDeep(phase, v))
      : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, correctedDeep(phase, v)]))
        : value;
