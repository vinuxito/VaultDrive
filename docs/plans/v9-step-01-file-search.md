# v9 — Step 1: Command Palette File Search
> **Operation Go Live** | Step 1 of 7
> **Index**: [v9-go-live-index.md](./v9-go-live-index.md)
> **Estimated Time**: ~3 hours
> **Priority**: 🔴 Critical — First visible feature users experience

---

## Problem Statement

The Cmd+K Command Palette today is navigation-only — you can jump to Dashboard, Files, Settings. But users expect Spotlight-level power: **type a filename, find it instantly**.

The blocker has always been stated as "zero-knowledge encrypted files can't be searched server-side." That is **correct** — but incomplete. The filenames stored in `FileData.filename` are **already decrypted client-side** after the SWR fetch. Every file the user owns is already in memory. We simply need to query that in-memory list.

There is zero cryptographic risk here. We do not touch ciphertext. We search `filename` strings that are already plaintext in the browser.

---

## What We Build

1. **`useFileSearch` hook** — reads the SWR file cache and returns a fuzzy-matched list of files given a query string.
2. **Extend `command-palette.tsx`** — add a "My Files" section that populates results from `useFileSearch` as the user types.
3. **File result items** — each result shows an icon by file type, the filename, and the folder path. Clicking navigates to `/files` and selects/highlights that file row via URL state.
4. **Empty state** — gracefully handles vault being locked (PIN not entered yet) or SWR cache being empty.

---

## Exact Files to Modify

### NEW: `vaultdrive_client/src/hooks/useFileSearch.ts`

This hook wraps SWR's `useSWRConfig` to read the cached file list and filter it by query string.

```typescript
import useSWR from "swr";
import { useMemo } from "react";

export interface SearchableFile {
  id: string;
  filename: string;
  folder_id: string | null;
  folder_name?: string;
  size: number;
  created_at: string;
}

const FILE_CACHE_KEY = "/api/files";

export function useFileSearch(query: string): SearchableFile[] {
  const { data } = useSWR<SearchableFile[]>(FILE_CACHE_KEY, {
    // Do NOT re-fetch — only read what's already cached
    revalidateOnFocus: false,
    revalidateOnMount: false,
    revalidateIfStale: false,
  });

  return useMemo(() => {
    if (!data || !query.trim()) return [];
    const q = query.toLowerCase();
    return data
      .filter((f) => f.filename.toLowerCase().includes(q))
      .slice(0, 8); // max 8 results in palette
  }, [data, query]);
}
```

**Why this works**: SWR stores its data in a global in-memory cache. Since the Files page already fetches `/api/files` when the user navigates there, calling `useSWR` with the same key inside the palette will read from that same cache without making a new network request.

**Edge case handled**: If the user opened the palette without visiting the Files page first, `data` will be `undefined`, which returns an empty array — no crash.

---

### MODIFY: `vaultdrive_client/src/components/ui/command-palette.tsx`

Add a new import and a new `Command.Group` block:

**Add to imports:**
```typescript
import { useFileSearch } from "../../hooks/useFileSearch";
import { File, FileText, Image, Film, Archive } from "lucide-react";
```

**Add state inside `CommandPalette()`:**
```typescript
const [inputValue, setInputValue] = useState("");
const fileResults = useFileSearch(inputValue);
```

**Add `onValueChange` to `<Command.Input>`:**
```tsx
<Command.Input
  autoFocus
  value={inputValue}
  onValueChange={setInputValue}
  placeholder={`Search ${branding.productName} or type a command...`}
  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground"
/>
```

**Add new group just above the Navigation group:**
```tsx
{fileResults.length > 0 && (
  <Command.Group
    heading="Files"
    className="px-2 text-xs font-medium py-2 text-muted-foreground"
  >
    {fileResults.map((file) => (
      <Command.Item
        key={file.id}
        value={`file-${file.id}-${file.filename}`}
        onSelect={() =>
          runCommand(() =>
            navigate("/files", { state: { highlightFileId: file.id } })
          )
        }
        className="flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm transition-colors text-foreground hover:bg-muted aria-selected:bg-muted"
      >
        <FileTypeIcon
          filename={file.filename}
          className="mr-3 h-4 w-4 text-muted-foreground"
        />
        <div className="flex flex-col">
          <span className="font-medium">{file.filename}</span>
          {file.folder_name && (
            <span className="text-xs text-muted-foreground">
              in {file.folder_name}
            </span>
          )}
        </div>
      </Command.Item>
    ))}
  </Command.Group>
)}
```

**Add helper component at the bottom of the file:**
```tsx
function FileTypeIcon({ filename, className }: { filename: string; className?: string }) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext))
    return <Image className={className} />;
  if (["mp4", "mov", "avi", "mkv"].includes(ext))
    return <Film className={className} />;
  if (["pdf", "doc", "docx", "txt", "md"].includes(ext))
    return <FileText className={className} />;
  if (["zip", "tar", "gz", "rar"].includes(ext))
    return <Archive className={className} />;
  return <File className={className} />;
}
```

---

### MODIFY: `vaultdrive_client/src/pages/files.tsx`

Handle the `highlightFileId` navigation state to visually scroll and briefly highlight a file:

**In component, add:**
```typescript
import { useLocation } from "react-router-dom";

const location = useLocation();
const highlightFileId = (location.state as { highlightFileId?: string } | null)?.highlightFileId;

useEffect(() => {
  if (!highlightFileId) return;
  const el = document.getElementById(`file-row-${highlightFileId}`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("highlight-pulse");
    setTimeout(() => el.classList.remove("highlight-pulse"), 2000);
  }
}, [highlightFileId, /* after files load */]);
```

**Add CSS in `index.css`:**
```css
@keyframes highlight-pulse {
  0%, 100% { background-color: transparent; }
  30%, 70% { background-color: hsl(var(--primary) / 0.15); }
}
.highlight-pulse {
  animation: highlight-pulse 2s ease;
}
```

**On each file row element, add `id`:**
```tsx
<div id={`file-row-${file.id}`} ...>
```

---

## Verification Checklist

- [ ] `npm run build` is green with no TypeScript errors.
- [ ] Open app → navigate to Files page (populates SWR cache).
- [ ] Press `Cmd+K` → type part of a filename → file results appear in "Files" section.
- [ ] Click a file result → navigates to `/files` and the file row scrolls into view with a brief glow.
- [ ] Press `Cmd+K` before visiting Files → no crash, "Files" section is empty, navigation still works.
- [ ] Press `Cmd+K` → type garbage → "No results found." appears.

---

## Commit Message

```
feat(v9/step-1): add filename search to command palette via SWR in-memory cache
```

---

*← Back to [v9-go-live-index.md](./v9-go-live-index.md) | Next → [v9-step-02-webauthn.md](./v9-step-02-webauthn.md)*
