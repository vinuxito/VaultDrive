#!/usr/bin/env python3
"""
Remove dark:bg-[linear-gradient(slate)] overrides — these fight bg-card on dark skins.
Also remove dark:border-slate-700 where it overrides border-border.
"""
import os, re

BASE_DIR = os.path.join(os.path.dirname(__file__), "src")
EXTENSIONS = {".tsx", ".ts"}

# Patterns to remove (strip from className strings)
REMOVE_PATTERNS = [
    # Slate dark gradients (various opacity combos)
    r' dark:bg-\[linear-gradient\(180deg,rgba\(30,41,59,[^)]+\)_0%,rgba\(15,23,42,[^)]+\)_100%\)\]',
    r' dark:bg-\[linear-gradient\(180deg,rgba\(30,41,59,[^)]+\)_0%,rgba\(15,23,42,[^)]+\)_90%\)\]',
]

# Paired substitutions: if A and B both present, replace both with C
PAIR_SUBS = [
    # border-border dark:border-slate-700 → border-border
    ("border-border dark:border-slate-700", "border-border"),
    # border-slate-200 dark:border-slate-700 → border-border
    ("border-slate-200 dark:border-slate-700", "border-border"),
]

changed = 0
for root, dirs, files in os.walk(BASE_DIR):
    dirs[:] = [d for d in dirs if d not in {"node_modules", "dist", ".git"}]
    for fname in files:
        if os.path.splitext(fname)[1] not in EXTENSIONS:
            continue
        path = os.path.join(root, fname)
        with open(path, "r", encoding="utf-8") as f:
            original = f.read()
        content = original
        for pat in REMOVE_PATTERNS:
            content = re.sub(pat, "", content)
        for old, new in PAIR_SUBS:
            content = content.replace(old, new)
        if content != original:
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            changed += 1

print(f"Modified {changed} files.")
