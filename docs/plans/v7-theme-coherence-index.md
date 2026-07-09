# Operation: Undeniable Visual Coherence — Dynamic Skin Refinement & Theme Guardrails

Welcome to **Operation: Undeniable Visual Coherence**. This roadmap outlines the precise steps to make ABRN-Drive visually breathtaking, dynamically consistent across all custom skins, and systematically protected against future styling drift.

---

## 🛋️ Design & Coherence Goals

1. **Pixel-Perfect Scrollbar Insets**: Eliminate ugly browser-default scrollbars overlapping rounded corners (`rounded-2xl`). Style scrollbar thumbs dynamically to match active skins.
2. **Skin-Specific Ambient Glows**: Expand ambient radial glow backdrop effects (orbs) to all skins (Light, Dark, Elegant, Business, Cyberpunk).
3. **Smooth Micro-Animations**: Implement CSS `@starting-style` transitions for all modals, popovers, and dropdown components to create a fluid, high-end feel.
4. **Tailwind Guardrails (The Block)**: Restrict the Tailwind build so that raw, default neutrals cannot be generated. Compile only theme variables, guaranteeing code consistency.
5. **Git Pre-Commit Sanitization**: Automate linting and color cleaning using pre-commit hooks to make it impossible to check in hardcoded hex values or standard Tailwind colors.

---

## 🗺️ Step-by-Step Plans

### 🎨 [Step 1: Visual Refinement & Ambient Glows](file:///lamp/www/ABRN-Drive/docs/plans/v7-step-01-design-polish.md)
Polishes scrollbar styling per skin, embeds ambient glow orbs into light/dark/elegant/business/cyberpunk background bodies, and adjusts the modal markup to inset scrollable regions.

### 🛡️ [Step 2: Tailwind Build Guardrails & Theme Stripping](file:///lamp/www/ABRN-Drive/docs/plans/v7-step-02-tailwind-guardrails.md)
Configures Tailwind to override standard color schemes, making raw colors uncompilable. Swaps out remaining hardcoded neutrals inside the React component files.

### ⛓️ [Step 3: Pre-Commit & Verification Automation](file:///lamp/www/ABRN-Drive/docs/plans/v7-step-03-git-hook-enforcement.md)
Sets up lint hooks and integrates color-sanitizing script checks in the commit pipeline to guarantee long-term formatting and styling safety.

### 🧪 [Step 4: E2E Smoke Verification & HTML Report](file:///lamp/www/ABRN-Drive/docs/plans/v7-step-04-verification-report.md)
Runs the test suite, generates a beautiful HTML test coverage report, and updates the repository README to document the skin-system design and enforcement rules.

---

*Let's execute with strategic precision and absolute zero-friction.*
