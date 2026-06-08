# Step 10 — Command Palette v2: File Search + Full Coverage

**Parent:** [v4 Production Launch Index](./v4-production-launch-index.md)  
**Phase:** III — Production Polish  
**Status:** 🔲 TODO  
**Priority:** MEDIUM — Power user delight  
**Depends on:** Step 9 (SWR Everywhere) — needs SWR cache for file search  

---

## Why This Matters

Cmd+K v1 has navigation shortcuts. Cmd+K v2 becomes the brain of the app. The user types a filename and finds it instantly. Types "help" and goes to Help Center. Types "theme" and switches skins. This is how Linear, Notion, and Vercel work — and it's why power users love them.

## Current State (v1)

**File:** `vaultdrive_client/src/components/ui/command-palette.tsx` (142 lines)

| Feature | v1 |
|---------|-----|
| Navigation (Dashboard, Vault, Groups) | ✅ |
| Account (Settings, Access Center, Sign Out) | ✅ |
| File search | ❌ |
| Help Center link | ❌ |
| Admin shortcuts | ❌ |
| Recent files | ❌ |
| Theme switcher | ❌ |

## What We Will Build (v2)

### 1. File Search Integration

Connect to the SWR cache (from Step 9) to search file names in real-time:

```tsx
const { data: files } = useSWR<FileData[]>(`${API_URL}/files`);

const filteredFiles = useMemo(() => {
  if (!search || !files) return [];
  return files.filter(f => 
    f.name.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 5); // Top 5 results
}, [search, files]);
```

When the user selects a file result, navigate to `/files?highlight=<fileId>`.

For larger vaults, add server-side search via the `pg_trgm` index (migration 041):
```tsx
// If local cache has > 100 files, debounce to server search
const { data: searchResults } = useSWR(
  search.length >= 2 ? `${API_URL}/files?search=${encodeURIComponent(search)}` : null,
  { dedupingInterval: 300 }
);
```

### 2. Help Center Link

Add to the Navigation group:
```tsx
<Command.Item onSelect={() => navigate('/help')}>
  <HelpCircle className="w-4 h-4" />
  Help Center
</Command.Item>
```

### 3. Admin Shortcuts (Admin-Only)

Only render for admin users:
```tsx
{isAdmin && (
  <Command.Group heading="Admin">
    <Command.Item onSelect={() => navigate('/admin')}>
      <Shield className="w-4 h-4" />
      User Management
    </Command.Item>
    <Command.Item onSelect={() => navigate('/settings?tab=audit')}>
      <FileText className="w-4 h-4" />
      Audit Logs
    </Command.Item>
  </Command.Group>
)}
```

### 4. Recent Files Quick Access

Show the 5 most recently accessed files at the top of the palette (before search results):
```tsx
const recentFiles = useMemo(() => {
  if (!files) return [];
  return [...files]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);
}, [files]);
```

### 5. Theme Switcher

Allow switching skins directly from Cmd+K:
```tsx
<Command.Group heading="Appearance">
  {['quantix', 'light', 'dark', 'cyberpunk', 'elegant', 'business'].map(skin => (
    <Command.Item key={skin} onSelect={() => setTheme(skin)}>
      <Palette className="w-4 h-4" />
      {skin.charAt(0).toUpperCase() + skin.slice(1)} Theme
    </Command.Item>
  ))}
</Command.Group>
```

## Architecture

```
Command Palette v2
├── [Search Bar] — real-time filter
├── Recent Files (5) — most recently updated
├── File Search Results (5) — matching files
├── Navigation — Dashboard, My Vault, Shared, Groups, Access Center, Help
├── Account — Settings, Sign Out
├── Admin (if admin) — User Management, Audit Logs
└── Appearance — 6 theme options
```

## Verification

| Check | Expected Result |
|-------|----------------|
| Type filename → results appear | ✅ From SWR cache |
| Select file → navigates to vault with highlight | ✅ |
| "help" → Help Center item | ✅ |
| Admin shortcuts hidden for non-admins | ✅ |
| Recent files show at top | ✅ |
| Theme switch works | ✅ |
| E2E suite still green | ✅ 42+ |

## Files to Change

| File | Change |
|------|--------|
| `src/components/ui/command-palette.tsx` | Major enhancement — file search, groups, admin, themes |
| `src/pages/files.tsx` | Add `highlight` query param support |
