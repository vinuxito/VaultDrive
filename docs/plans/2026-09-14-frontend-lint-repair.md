# Frontend lint repair

Preserve the six-template UI and verified download/PIN behavior. Success means the
existing lint command exits zero without disabling rules, plus passing unit tests
and a production build. Resolve warnings when they share the same causes.

1. Record a fresh lint inventory and unit baseline before edits. Separate unsafe
   typing/test fixtures, React lifecycle/dependencies, and module export issues.
2. Use explicit existing API/domain types and `unknown` narrowing in place of
   `any`. Preserve cryptographic algorithms and network contracts. For React
   lifecycle changes, add focused behavior regressions before implementation.
3. Give independent file groups to separate agents; root integrates and reviews.
   Do not edit unrelated dirty runtime files, generated bundles, or backups.
4. Run lint, focused/full unit tests, typecheck/build and the relevant synthetic
   browser regressions. Build into private staging rather than live `dist`.
5. Publish verified frontend assets if runtime code changed, retain rollback
   assets, check public readiness, document evidence, commit and push on main.
