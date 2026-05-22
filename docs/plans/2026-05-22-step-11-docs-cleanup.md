# Step 11 — Documentation & Legacy Cleanup

**Parent:** [Hackathon Index](./2026-05-22-hackathon-index.md)  
**Priority:** 🟢 Important  
**Effort:** S (half day)  
**Status:** 🔲 TODO

---

## Why This Matters

53 markdown files in `docs/` still reference "ABRN" — the old product name. For a judge reviewing the repo, or a contributor onboarding, this creates confusion: *"Is this QuantiX-Drive or ABRN-Drive? Are these docs current?"*

Clean docs signal a clean product. Stale docs signal neglect. A judge who `grep -r ABRN docs/` and gets 53 hits will think the rename was sloppy.

---

## Current State (Verified)

```bash
$ grep -rl "ABRN\|abrn" docs/ --include="*.md" | wc -l
53
```

Most occurrences fall into 4 categories:
1. **Example URLs** using `dev-app.filemonprime.net/abrn/...` (stale)
2. **Migration docs** (`06_DOMAIN_MIGRATION.md`) describing the rename (historical)
3. **Session memory files** referencing the old name in historical context
4. **Plan files** discussing the downstream overlay strategy (legitimate)

---

## Implementation Plan

### 11.1 — Categorize All 53 Files

Run `grep -rl "ABRN\|abrn" docs/ --include="*.md"` and categorize each file:

| Category | Action | Expected count |
|----------|--------|----------------|
| **Update** | Replace ABRN → QuantiX where it refers to *this* product | ~30 files |
| **Archive** | Add "Historical Document" header, preserve old names | ~5 files |
| **Preserve** | Legitimate downstream overlay references, keep as-is | ~15 files |
| **Delete** | Truly stale docs that add no value | ~3 files |

### 11.2 — Batch Rename Pass

For "Update" files, use precise `sed` replacements:

```bash
# Product name (when referring to THIS product, not downstream)
sed -i 's/ABRN-Drive/QuantiX Drive/g'
sed -i 's/abrn-drive/quantix-drive/g'

# Example URLs
sed -i 's|dev-app.filemonprime.net/abrn/|quantixdrive.filemonprime.net/quantix/|g'

# Standalone product name (carefully — don't touch downstream overlay refs)
# This one needs manual review, not blind sed
```

**IMPORTANT:** References to "ABRN-Drive" as a *downstream overlay product* are intentional and correct. Only replace references where ABRN is being used as the name of *this* product.

### 11.3 — Archive Headers

For historical docs like `06_DOMAIN_MIGRATION.md`:

```markdown
> [!NOTE]
> **Historical Document.** This describes the 2026 rename from ABRN-Drive to QuantiX Drive.
> Preserved for historical context. The current product name is QuantiX Drive.
```

### 11.4 — Verify i18n Override Files Untouched

The `abrn-overrides` locale files are part of the working downstream architecture:

**Files that must NOT be renamed:**
- `vaultdrive_client/src/locales/en/abrn-overrides.json`
- `vaultdrive_client/src/locales/es/abrn-overrides.json`
- References in `vaultdrive_client/src/i18n/index.ts`

These are correctly named — they override QuantiX defaults for the ABRN downstream deployment.

### 11.5 — Final Grep Count

After cleanup:
```bash
$ grep -rl "ABRN\|abrn" docs/ --include="*.md" | wc -l
# Target: < 5 (archival + legitimate downstream refs only)
```

---

## Verification

| Check | Expected | How to verify |
|-------|----------|---------------|
| Grep count | < 5 files | `grep -rl "ABRN\|abrn" docs/ --include="*.md" \| wc -l` |
| Example URLs | All point to quantixdrive | Spot-check 3 docs |
| Archive headers | Present on historical docs | Open migration doc |
| i18n files intact | abrn-overrides unchanged | `cat` both files |
| Tests pass | No regressions | `npm run test` + `go test ./...` |

---

## Risk

**None.** Pure documentation. Reversible by `git revert`. No code, no data, no runtime changes.

---

## Evidence Log

| Date | What was done | Verified? | Commit |
|------|--------------|-----------|--------|
| | | | |
