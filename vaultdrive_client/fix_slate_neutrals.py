#!/usr/bin/env python3
"""
Iteration 3: Replace hard-coded slate/white neutrals with semantic CSS var classes.
All skins define --muted, --popover, --input, --border so these are safe to use.
"""
import os

BASE_DIR = os.path.join(os.path.dirname(__file__), "src")
EXTENSIONS = {".tsx", ".ts"}
SKIP_FILES = {"elegant-complete.css", "luxury-tokens.css"}

# Most specific first
REPLACEMENTS = [
    # ── Dropdown / popover menus ────────────────────────────────────────────────
    # file-card & FolderTreeItem context menus
    ("bg-white rounded-lg shadow-lg border border-slate-200",
     "bg-popover rounded-lg shadow-lg border border-border"),
    ("bg-white rounded-lg shadow-lg border border-border",   # already half-fixed
     "bg-popover rounded-lg shadow-lg border border-border"),
    ("rounded-lg border border-slate-200 bg-white shadow-lg",
     "rounded-lg border border-border bg-popover shadow-lg"),

    # ── ActivityFeedPanel side panel ────────────────────────────────────────────
    ("bg-white border-l border-slate-200",  "bg-card border-l border-border"),
    ("bg-white border-l border-border",     "bg-card border-l border-border"),

    # ── Modal / card containers ─────────────────────────────────────────────────
    ("border border-slate-200 bg-white shadow-2xl",   "border border-border bg-card shadow-2xl"),
    ("rounded-3xl border border-slate-200 bg-white",  "rounded-3xl border border-border bg-card"),
    ("rounded-2xl border border-slate-200 bg-white",  "rounded-2xl border border-border bg-card"),
    ("rounded-xl border border-slate-200 bg-white",   "rounded-xl border border-border bg-card"),
    ("rounded-lg border border-slate-200 bg-white",   "rounded-lg border border-border bg-card"),

    # gradient header in AgentApiKeysSection modal
    ("from-[#f8f4f1] to-white",  "from-muted/50 to-card"),

    # ── Muted backgrounds (info panels, code blocks, subtle areas) ──────────────
    # bg-slate-50 → bg-muted
    ("bg-slate-50",  "bg-muted"),

    # ── Remaining border-slate-200 → border-border ──────────────────────────────
    ("border-slate-200",  "border-border"),

    # ── Text colors ──────────────────────────────────────────────────────────────
    # These are safe: muted-foreground is defined per-skin
    ("text-slate-700",  "text-foreground"),
    ("text-slate-600",  "text-muted-foreground"),
    ("text-slate-500",  "text-muted-foreground"),

    # ── Remaining bg-white panel backgrounds (where no dark: alt was present) ──
    # Only in className strings — pattern: "bg-white px-" or "bg-white py-" (panel usage)
    # Leave "bg-white text-primary" alone (intentional contrast on selected tabs)
    # We target explicit standalone panel uses
    (" bg-white px-",   " bg-card px-"),
    (" bg-white py-",   " bg-card py-"),
    (" bg-white p-",    " bg-card p-"),
    ('"bg-white rounded-lg p-',  '"bg-card rounded-lg p-'),
    ('"bg-white rounded-lg shadow',  '"bg-card rounded-lg shadow'),
    (" bg-white divide-",  " bg-card divide-"),
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
