#!/usr/bin/env python3
"""
Replace hardcoded burgundy palette with CSS-variable-based Tailwind classes.
All #7d4f50 / #6b4345 / #f2d7d8 / etc. → primary / primary-foreground / etc.
Order: most-specific patterns first to avoid double-substitution issues.
"""
import os
import sys

BASE_DIR = os.path.join(os.path.dirname(__file__), "src")
EXTENSIONS = {".tsx", ".ts"}
SKIP_FILES = {"elegant-complete.css", "luxury-tokens.css"}

# Ordered: most specific first
REPLACEMENTS = [
    # ── #6b4345 with opacity  (must beat plain [#6b4345] replacement) ──────────
    ("[#6b4345]/30",    "primary/20"),

    # ── #f2d7d8 with opacity  (must beat contextual text-/bg- replacements) ───
    ("[#f2d7d8]/65",    "primary-foreground/65"),
    ("[#f2d7d8]/60",    "primary-foreground/60"),
    ("[#f2d7d8]/40",    "primary-foreground/40"),
    ("[#f2d7d8]/30",    "primary-foreground/30"),

    # ── #d4a5a6 with opacity ────────────────────────────────────────────────────
    ("[#d4a5a6]/50",    "primary/40"),
    ("[#d4a5a6]/40",    "primary/30"),
    ("[#d4a5a6]/25",    "primary/20"),

    # ── Main primary palette ────────────────────────────────────────────────────
    # #7d4f50 → primary  (all Tailwind opacity suffixes /N survive intact)
    ("[#7d4f50]",       "primary"),

    # #6b4345 remaining (no opacity modifier) → primary/90
    ("[#6b4345]",       "primary/90"),

    # #f2d7d8 by context (text vs bg)
    ("text-[#f2d7d8]",         "text-primary-foreground"),
    ("hover:bg-[#f2d7d8]",     "hover:bg-primary/10"),
    ("bg-[#f2d7d8]",           "bg-primary/10"),
    ("[#f2d7d8]",               "primary-foreground"),   # catch-all

    # #d4a5a6 remaining (no opacity)
    ("text-[#d4a5a6]",         "text-primary/60"),
    ("[#d4a5a6]",               "primary/40"),

    # Other burgundy-family colors
    ("[#e2b9bb]",       "primary/20"),
    ("[#c4999b]",       "primary"),
    ("[#9f7475]",       "primary/60"),   # mid-point used in gradients
    ("[#d7bbbc]",       "primary/20"),   # light used in gradients

    # ── Warm light card backgrounds → bg-card ──────────────────────────────────
    ("bg-[linear-gradient(180deg,#fffdfb_0%,#f6efea_100%)]",  "bg-card"),
    ("bg-[linear-gradient(180deg,#fffdfb_0%,#f8f3ef_100%)]",  "bg-card"),
    ("bg-[linear-gradient(180deg,#fffdfa_0%,#f8f2ee_100%)]",  "bg-card"),
    ("bg-[linear-gradient(180deg,#fcfbf9_0%,#f7f3ef_100%)]",  "bg-card"),
    ("[#fbfaf8]",       "card"),
    ("[#fbf7f3]",       "card"),
    ("[#2a1f1f]",       "card"),

    # ── Warm borders ────────────────────────────────────────────────────────────
    ("[#e8d9d0]",       "border"),

    # ── rgba shadows: burgundy RGB → neutral black (shadows remain subtle) ─────
    # In Tailwind arbitrary shadow values:  shadow-[..._rgba(125,79,80,0.N)]
    ("rgba(125,79,80,",    "rgba(0,0,0,"),
    ("rgba(125, 79, 80,",  "rgba(0,0,0,"),
    ("rgba(107,67,69,",    "rgba(0,0,0,"),
    ("rgba(107, 67, 69,",  "rgba(0,0,0,"),
]

def process_file(path: str) -> int:
    with open(path, "r", encoding="utf-8") as f:
        original = f.read()
    content = original
    for old, new in REPLACEMENTS:
        content = content.replace(old, new)
    if content != original:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return 1
    return 0

changed = 0
for root, dirs, files in os.walk(BASE_DIR):
    # Skip node_modules or dist
    dirs[:] = [d for d in dirs if d not in {"node_modules", "dist", ".git"}]
    for fname in files:
        ext = os.path.splitext(fname)[1]
        if ext not in EXTENSIONS:
            continue
        if fname in SKIP_FILES:
            continue
        path = os.path.join(root, fname)
        changed += process_file(path)

print(f"Modified {changed} files.")
