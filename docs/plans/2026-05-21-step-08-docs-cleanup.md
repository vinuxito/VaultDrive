# Step 8 — Documentation & Legacy Cleanup

**Parent:** [Hackathon Index](./2026-05-21-hackathon-index.md)  
**Priority:** 🟢 Important  
**Effort:** S (half day)

---

## Why This Matters

53 markdown files in `docs/` still reference "ABRN" — the old product name. For a judge reviewing the repo, or a contributor onboarding, this creates confusion: *"Is this QuantiX-Drive or ABRN-Drive? Are these docs current?"*

Clean docs signal a clean product. Stale docs signal neglect.

---

## Current State (Verified)

```bash
$ grep -rl "ABRN\|abrn" docs/ --include="*.md" | wc -l
53
```

Most occurrences are:
- **Example URLs** using `dev-app.filemonprime.net/abrn/...` (stale).
- **Migration docs** (`06_DOMAIN_MIGRATION.md`) that describe the rename process.
- **Session memory files** that reference the old name in historical context.
- **Plan files** that discuss the downstream overlay strategy.

---

## Success Condition

After this step:
1. `grep -rl "ABRN\|abrn" docs/ --include="*.md"` returns **< 5 files** (archival only).
2. All example URLs point to `quantixdrive.filemonprime.net/quantix/...`.
3. Archival docs (like the domain migration doc) have a header noting they're historical.
4. A note in `README.md` explains the rename for new contributors.
5. No code changes. No migration changes. Docs only.

---

## Implementation Plan

### 8.1 — Inventory the 53 Files

Run the grep and categorize each file into one of:
- **Update:** Replace ABRN references with QuantiX.
- **Archive:** Add a "Historical" header and keep the old name for context.
- **Skip:** File is already correct or is a plan file referencing the overlay strategy legitimately.

### 8.2 — Batch Rename Pass

For "Update" files:
- Replace `ABRN-Drive` → `QuantiX Drive`.
- Replace `abrn-drive` → `quantix-drive`.
- Replace `dev-app.filemonprime.net/abrn/` → `quantixdrive.filemonprime.net/quantix/`.
- Replace `ABRN` → `QuantiX` where it's clearly referring to the product (not the downstream overlay concept).

**Important:** The downstream overlay concept is intentionally named "ABRN-Drive" in current code and plans. References to it as a *downstream product* should be preserved — they're accurate. Only references to ABRN as *the name of this product* should be updated.

### 8.3 — Archive Headers

For docs like `06_DOMAIN_MIGRATION.md`:

```markdown
> **⚠️ Historical Document**  
> This document describes the 2026 rename from ABRN-Drive to QuantiX Drive.
> It is preserved for historical context. The current product name is QuantiX Drive.
```

### 8.4 — README Contributor Note

Add to `README.md` in the appropriate section:

```markdown
> **Note:** This project was renamed from ABRN-Drive to QuantiX Drive in early 2026.
> Some archival docs in `docs/` retain the old name for historical context.
> The downstream overlay product (ABRN-Drive) is a separate deployment that
> shares this codebase — references to it as a downstream are intentional.
```

### 8.5 — Verify the i18n Override Files

The `abrn-overrides` locale files are **intentionally named** for the downstream overlay. These should NOT be renamed — they're part of the working i18n architecture.

**Files to preserve as-is:**
- `vaultdrive_client/src/locales/en/abrn-overrides.json`
- `vaultdrive_client/src/locales/es/abrn-overrides.json`
- References in `vaultdrive_client/src/i18n/index.ts`

---

## Verification

| Check | Expected | How to verify |
|-------|----------|---------------|
| grep count | < 5 files | `grep -rl "ABRN\|abrn" docs/ --include="*.md" \| wc -l` |
| Example URLs | All point to quantixdrive | Spot-check 3 docs |
| Archive headers | Present on historical docs | Open migration doc |
| README note | Contributor note present | Read README |
| i18n files intact | abrn-overrides unchanged | Check file contents |
| Tests pass | No regressions | Run vitest + go test |

---

## Risk

**None.** Pure documentation. Reversible by `git revert`. No code, no data, no runtime changes.

---

## Evidence Log

| Date | What was done | Verified? | Commit |
|------|--------------|-----------|--------|
| | | | |
