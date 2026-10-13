# LYNQ Venture Studio Academy

A React + TypeScript + Vite version of `LYNQ_Academy_All_Phases.html`. Orientation, the five phase dashboards and all 100 lessons run natively in React. No iframes, legacy scripts or injected HTML are used at runtime. The original combined HTML is unchanged and remains the source reference.

## Run

```sh
npm install
npm run dev       # development server
npm test          # 101 automated tests
npm run build     # type-check + production build into dist/
npm run preview   # serve the production build
```

## Architecture

```
src/
  main.tsx                 App shell: sidebar, mobile menu, hash routing, progress
  routing.ts               #orientation · #phase/1–5 · #lesson/1–100, next-step rules
  progress.ts              Re-validated completion for all 100 lessons + orientation; graduation status
  NativeLesson.tsx         Orientation (Module 00)
  lesson-system/           Shared, configuration-driven lesson engine
    types.ts               LessonDefinition, Block, DashboardDefinition, PhaseModule, ExtensionProps
    state.ts               Saved-state normalisation and the completion contract (pure functions)
    useLessonState.ts      Loads/saves a lesson under its original localStorage key
    LessonPage.tsx         Loads a lesson lazily and renders its sections/blocks
    PhaseDashboard.tsx     Shared phase dashboard
    deliverable.ts         Markdown deliverables, previews, downloads
    components/            Content renderer, storyboard/transcript, worksheet, scripted coach,
                           practice, quiz, checklist, graduation review
    tools/RecordLog.tsx    Generic configurable row log
  phases/phase1…phase5/    One PhaseModule per phase: typed extension components, pure *.logic
                           modules, record normalisers, deliverable builders, phase CSS
  data/
    curriculum.json        100 titles, storage keys, required fields, quiz keys, artifact/release flags
    lessons/phase-N/       One LessonDefinition JSON per lesson (lesson-01 … lesson-100)
    dashboards/phase-N.json
    native-lessons.json    Orientation content
legacy/lessons/            Read-only legacy phase documents used by extractors and tests (not shipped)
scripts/
  migration/               Deterministic extractors: legacy documents → typed JSON
  *.test.mjs               node:test suites
```

**How a lesson is put together**

- Each lesson is a `LessonDefinition`: hero, fields, quiz questions, checklist, deliverable spec, and ordered sections of typed blocks. The blocks are content, video placeholder, storyboard, transcript, video prompt, studied, fields, coach, practice, quiz, flag, honest, deliverable, checklist, complete, reset, next and extension.
- Standard lessons are pure data rendered by the shared components.
- Specialised behaviour lives in `extension` blocks. These resolve to typed React components registered by the phase module, with their calculations in separate pure-logic files.

**Code splitting**

- Each phase module is a lazily loaded chunk.
- Each lesson JSON file is also its own chunk, loaded through a dynamic import (the build produces about 117 chunks).

**How curriculum content is stored**

- Teaching content is stored as a whitelisted `ContentNode` tree and rendered with `React.createElement`.
- There is no `dangerouslySetInnerHTML`, `eval` or `new Function` in `src/`; a test enforces this.
- Legacy `openLesson(n)` and phase links became typed `lesson-link` and `phase-link` nodes that use the router.

**Regenerating the data**

- `node scripts/migration/extract-phaseN.mjs` regenerates a phase's data from `legacy/lessons/phase-N.html`.
- The extractors are deterministic: re-running them reproduces the committed JSON exactly.
- Scripted text (coach replies, practice feedback, status lines, export wording) is parsed out of the legacy functions, not retyped.

## Migration status

Complete. Orientation, all five dashboards and Lessons 1–100 are native. The runtime iframe, the `postMessage` bridge and the temporary per-phase routing flags have been removed.

The legacy phase documents moved from `public/lessons/` to `legacy/lessons/`. They are no longer deployed and are kept only as the migration source for the extractors and parity tests. Delete that folder once the extractors are no longer needed.

**Tools by lesson**

| Lessons | Tools |
|---|---|
| 1–20 (Discover) | Scripted coach per lesson, per-lesson artifact previews (purpose statement, support map, commitment plan, journal, people/problem maps, alternatives, selection, snapshot, journey, research log, landscape, plan, opportunity, value, fit, brief, checkpoint), Lesson 6 problem journal groups, module/phase status |
| 21–40 (Validate) | Scripted coach (the Review count uses the legacy worksheet-field rule), module notes, Lesson 40 phase checkpoint, exact legacy brief export |
| 41–60 (Build) | 45 prototype shell preview, simulated API, agent prompts, HTML download and `artifactReady`; registers for 46–60; 48 API contract checker; 49 permission checker; 50 release gate, runbook and `releaseAck50`; 51 WCAG contrast checker and tokens; 52 onboarding run; 53 share calculator; 54 IP triage; 56 cash and runway model; 57 analytics sample checker; 58–60 beta/fix gates and readiness summary; prompt workbenches |
| 61–80 (Launch) | Row logs with legacy duplicate/limit rules; 66 pricing contribution calculator; 67 sales pipeline board with stage history; 73 activation rate; 76 revenue/cost review; role-prompt builders; legacy brief export |
| 81–100 (Scale) | Evidence registers with exception filters; check-review panels (86–100); calculators: 84 unit economics, 85 cohort retention, 92 runway and buffer, 97 dilution; prompt workbenches; CEO draft builders (93–100); Lesson 100 graduation review and acknowledgement |

## Compatibility decisions

- **Storage keys.** Every original `localStorage` key and record shape is kept: `lynq.orientation.v1`, `lynq.orientation.lesson.v1`, and `lynq.{discover|validate|build|launch|scale}.lessonNN.v1`.
  - Lesson-specific records stay under their legacy keys inside each lesson record (for example `observationRows`, `calc66`, `dealRows[].history`, `review76`, `cashDraft`).
  - Each phase's `normalizeExtra` mirrors that phase's legacy `load()` filters and limits. Unknown keys are kept, so no saved work is lost.
- **Malformed data.** Malformed values are dropped rather than trusted. If a stored record can't be parsed, the lesson still renders and tells the learner to download a copy.
- **Completion contract.** Completion is unchanged from the source. It requires the storyboard to be reviewed, every required field, all quiz answers correct, the honest self-review, `artifactReady` (Lesson 45) and `releaseAck50` (Lesson 50).
  - Optional fields such as `support` never block completion.
  - Progress, dashboards and graduation re-check this contract on every read.
- **Explicit completion.** Completion is only ever set by the "Mark … complete" button.
  - Phases 1–3 revoke it when an edit makes the lesson invalid, as their legacy `save()` did.
  - Launch and Scale revoke it on *any* edit, because their legacy `save()` cleared completion unconditionally. This is preserved per phase through `revokeOnAnyEdit`.
- **Graduation.** Graduation eligibility needs orientation plus all 100 lessons. It is computed natively from saved progress, not through the old iframe handshake. It is worded throughout as learning completion, not venture or business readiness.
- **Exports.** Export filenames and Markdown/JSON content follow each phase's legacy export functions, and the parity tests compare them against the legacy code.
- **Stale prototype statements.** A few statements described lessons as "planned previews" or a "planned handoff only". They are corrected through one documented table (`scripts/migration/stale-corrections.mjs`), which both the extractors and the tests apply.
- **Deliberate small differences from the legacy pages:**
  - Quiz feedback shows each question's explanation beside that question.
  - Practice options are radio buttons.
  - Save-status and reset-dialog wording is shared.
  - Navigation between phases is always direct, including two legacy "Next" links that pointed to the wrong lesson.
  - Long unbroken legacy strings wrap on narrow screens.

## Testing

`npm test` runs 101 tests:

- **Academy-wide (`academy.test.mjs`):**
  - For all 100 lessons: titles, required-field sets, quiz answers and the artifact/release flags match `curriculum.json`.
  - Every lesson and dashboard renders without an iframe or script.
  - Hash routes and back-compatible fallbacks work.
  - Next-lesson navigation works across 20→21, 40→41, 60→61 and 80→81, and Lesson 100 ends in the graduation review.
  - No HTML injection or string evaluation exists in `src/`.
  - The original HTML is byte-identical.
- **Framework (`lesson-system.test.mjs`):** saved-state normalisation and malformed data, optional versus required fields, artifact/release gates, explicit completion and revocation, Markdown builder, progress and graduation (orientation is required), and a render of every block type.
- **Per phase (`phase1`–`phase5`):**
  - Parity against the legacy source: fields, labels, quiz text and explanations, scenes, prompts, coach and practice text, module status, export filenames and content.
  - Legacy-record normalisation and tool logic with meaningful cases, including calculators with zero, blank, negative and invalid input, and row-log limits and duplicates.
  - The Phase 5 tests also run the legacy functions in a sandbox at test time and compare outputs exactly.
- **Orientation (`lesson-state`, `native-render`):** orientation profile, completion and rendering.
- **Legacy documents (`curriculum.test.mjs`):** the legacy reference documents still match the combined HTML.

**Browser verification (headless Chrome, production build):**

- **Saved data:** legacy saved drafts and structured rows load, including string quiz answers and a corrupt record.
- **Rendering:** orientation, all five dashboards and all 100 lessons render, with an accessibility audit per page (labels, button names, duplicate IDs, headings) and no console errors.
- **Completing all 100 lessons through the UI:**
  - Completion is refused while a lesson is incomplete.
  - All tool buttons are exercised.
  - The deliverable downloads with the expected filename and content.
- **Revocation and gates:**
  - Completion is revoked on invalid edits (phases 1–3) and on any edit (phases 4–5).
  - `artifactReady` and `releaseAck50` gate completion.
- **Navigation:** phase-boundary next links with browser back and forward.
- **Graduation:** it is refused before orientation, and becomes eligible after orientation is completed through its UI, with the acknowledgement download.
- **Persistence:** progress survives a full reload.
- **Mobile:** no horizontal overflow at 375px on all 106 pages, and the mobile menu works.

## Persistence and deployment

This is still a browser-local learning prototype. It has no accounts, backend, live AI, payments or cloud sync.

- **Coach replies** are scripted.
- **Video placeholders and prompts** have no media attached.
- **Browser data is scoped to the exact origin.** Progress saved under a file URL or a different host/port does not transfer, so use a stable origin.

To deploy, put `dist/` on any static host. For Vercel, `vercel.json` sets the build to `npm ci` + `npm run build` with output `dist/`, caches the hashed `assets/` long-term, keeps `index.html` uncached, and adds basic security headers. Because routes are hash-based, no server routing is needed; non-asset paths fall back to `index.html`. All curriculum content ships to the browser, and completion is self-reported and validated on the client.

**Recommended next step for accounts and cloud persistence:**

1. Add authentication.
2. Add a small API that stores each lesson record under the same key and shape, as a per-user document. The `useLessonState` hook is the single read/write point.
3. Keep `localStorage` as an offline cache, and on first sign-in run a one-time import of existing browser records.
4. Re-run the completion contract (`src/lesson-system/state.ts`, which is pure and shareable) on the server before recording completion or graduation.
5. Serve curriculum chunks behind the authenticated origin if access must be restricted.
