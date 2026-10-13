# Legacy reference documents

These are the per-phase documents the academy used to load in iframes. They are **not shipped or loaded at runtime**: every lesson and dashboard is now native React.

They are kept as read-only migration sources:

- `scripts/migration/extract-phase*.mjs` regenerate `src/data/lessons/**` and `src/data/dashboards/**` from them.
- The tests compare the generated data, scripted text, exports and calculations against them.

`scripts/curriculum.test.mjs` checks that they still equal the documents embedded in `LYNQ_Academy_All_Phases.html`. The only exception is the retired `native-bridge.js` include.

Remove this folder once the extractors are no longer needed. Keep the original combined HTML.
