# Six-template visibility and contrast repair

Preserve the six existing templates, their palette identities, typography and layouts. Repair demonstrated foreground/background mismatches and clipped content, without changing encryption or download behavior.

1. Reproduce current failures: check semantic text/background ratios, capture the file protection modal and route inventory using synthetic browser fixtures.
2. Repair shared CSS tokens and trust surfaces; contextual component fixes in separate vault, page and shared-component lanes. Do not apply blanket white-to-dark replacements.
3. Exercise all routed screens in each skin, desktop and mobile; verify modal scrolling, theme switching/persistence, forms and key interactive states. Record fixture limitations separately from live backend health.
4. Run unit tests, lint, production build and download regressions. Publish verified static assets with a rollback copy, verify public assets and health, document exact results and commit only task files to main.

Initial findings: trust panels assume a dark surface; legacy gradients mix primary colors with white foreground regardless of skin; muted and accent token pairs fail contrast; global !important utility overrides interfere with normal theme/component composition.
