# Phase 2D: Files Page Redesign - Implementation Plan

**VaultDrive v2.0 - Ascension Protocol**

---

## 📋 Overview

Phase 2D transforms the Files page from a basic list view to a modern, glassmorphic file management interface with grid/list views, file cards, and improved navigation.

### Goals
1. Implement grid/list view toggle for files
2. Create file cards with glassmorphism styling
3. Add folder navigation breadcrumbs
4. Integrate search functionality
5. Improve file actions (download, share, delete) with better UX

---

## 🎯 Components to Create

### 1. File Card Component

**File:** `vaultdrive_client/src/components/files/file-card.tsx`

```typescript
interface FileCardProps {
  file: FileData;
  onDownload: (fileId: string, filename: string, metadata: string) => void;
  onShare: (fileId: string, filename: string) => void;
  onDelete: (fileId: string, filename: string) => void;
  onToggleMetadata: (fileId: string) => void;
  isExpanded: boolean;
  viewMode: 'grid' | 'list';
}
```

**Features:**
- Glassmorphism card design
- File icon with type detection
- File name, size, date display
- Expandable metadata section
- Action buttons (download, share, delete, more options)
- Hover effects and transitions
- Responsive design

---

### 2. File Grid Component

**File:** `vaultdrive_client/src/components/files/file-grid.tsx`

```typescript
interface FileGridProps {
  files: FileData[];
  viewMode: 'grid' | 'list';
  onFileSelect?: (fileId: string) => void;
  onFileAction?: (action: FileAction, fileId: string) => void;
}

type FileAction = 'download' | 'share' | 'delete' | 'rename' | 'move';
```

**Features:**
- Grid layout with responsive columns
- File cards in grid view
- File rows in list view
- Smooth transitions between views
- Selection state
- Keyboard navigation

---

### 3. File List Component

**File:** `vaultdrive_client/src/components/files/file-list.tsx`

```typescript
interface FileListProps {
  files: FileData[];
  onFileSelect?: (fileId: string) => void;
  onFileAction?: (action: FileAction, fileId: string) => void;
}
```

**Features:**
- List layout with compact rows
- File icon, name, size, date
- Action buttons on hover
- Metadata expansion
- Better density for many files

---

### 4. File Search Component

**File:** `vaultdrive_client/src/components/files/file-search.tsx`

```typescript
interface FileSearchProps {
  files: FileData[];
  onSearch: (query: string) => void;
  placeholder?: string;
}
```

**Features:**
- Glassmorphism search input
- Real-time filtering
- Search by filename
- Clear button
- Keyboard shortcuts (Ctrl+K)

---

### 5. Folder Breadcrumb Component

**File:** `vaultdrive_client/src/components/files/folder-breadcrumb.tsx`

```typescript
interface FolderBreadcrumbProps {
  currentPath: string;
  folders: Folder[];
  onNavigate: (path: string) => void;
}
```

**Features:**
- Breadcrumb navigation
- Clickable path segments
- Home icon
- Glassmorphism pill design
- Animated transitions

---

## 📁 File Structure

```
vaultdrive_client/src/components/files/
├── file-card.tsx           # Individual file card
├── file-grid.tsx            # Grid view container
├── file-list.tsx            # List view container
├── file-search.tsx           # Search component
├── folder-breadcrumb.tsx     # Folder navigation
└── index.ts                 # Barrel export
```

---

## 🎨 Design System

### File Card Design

```
┌─────────────────────────────────────────────────────────┐
│  📄 document.pdf                    [↓] [⬇] [🗑]  │
│  2.4 MB • Jan 15, 2026                          │
│  🔐 AES-256-GCM                                  │
└─────────────────────────────────────────────────────────┘
```

**States:**
- Default: Glass card with subtle border
- Hover: Slight lift, border highlight
- Selected: Accent border, glow effect
- Expanded: Metadata section visible

### Grid View Layout

```
┌─────────────┬─────────────┬─────────────┐
│  📄 doc1   │  📄 doc2   │  📄 doc3   │
│  2.4 MB     │  2.1 MB     │  1.8 MB     │
│  Jan 15      │  Jan 14      │  Jan 13      │
├─────────────┼─────────────┼─────────────┤
│  📄 doc4   │  📄 doc5   │  📄 doc6   │
│  3.2 MB     │  1.5 MB     │  2.0 MB     │
│  Jan 12      │  Jan 11      │  Jan 10      │
└─────────────┴─────────────┴─────────────┘
```

### List View Layout

```
┌─────────────────────────────────────────────────────────┐
│ 📄  document.pdf    2.4 MB  Jan 15, 2026  [⬇][🗑] │
├─────────────────────────────────────────────────────────┤
│ 📄  photo.jpg       1.2 MB  Jan 14, 2026  [⬇][🗑] │
├─────────────────────────────────────────────────────────┤
│ 📄  report.pdf      3.2 MB  Jan 13, 2026  [⬇][🗑] │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 Integration with Existing Code

### Current Files Page Structure

The existing [`files.tsx`](../vaultdrive_client/src/pages/files.tsx) has:
- Basic file list with cards
- Upload section (now using Dropzone)
- Password modal (now with EncryptionPreview)
- Share modal
- Delete confirmation modal
- Manage shares modal

### Integration Points

1. **Replace file list** with FileGrid/FileList component
2. **Add view mode toggle** (grid/list)
3. **Add search bar** with FileSearch component
4. **Add folder breadcrumbs** with FolderBreadcrumb component
5. **Keep existing modals** (share, delete, manage shares)
6. **Keep existing upload flow** (Dropzone + EncryptionPreview)

---

## 📝 Implementation Steps

### Step 1: Create File Card Component

```typescript
// file-card.tsx
import { useState } from 'react';
import { File, Download, Share2, Trash2, MoreVertical, Lock, Shield } from 'lucide-react';
import { cn } from '../../lib/utils';
import { GlassCard } from '../glass/glass-card';
import { formatSize, formatDate } from '../../utils/format';

export function FileCard({ file, onDownload, onShare, onDelete, onToggleMetadata, isExpanded, viewMode }: FileCardProps) {
  const [showActions, setShowActions] = useState(false);

  const getFileIcon = () => {
    // Return appropriate icon based on file type
    return File;
  };

  return (
    <GlassCard
      className={cn(
        'transition-all duration-300',
        isExpanded && 'ring-2 ring-primary/50',
        viewMode === 'grid' ? 'hover:shadow-lg' : ''
      )}
      hover={showActions}
    >
      {/* File Info */}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            {getFileIcon()}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{file.filename}</h3>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{formatSize(file.file_size)}</span>
            <span>•</span>
            <span>{formatDate(file.created_at)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleMetadata(file.id)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          
          {viewMode === 'list' && (
            <>
              <button
                onClick={() => onDownload(file.id, file.filename, file.metadata)}
                className="p-2 hover:bg-blue-500/20 rounded-lg transition-colors text-blue-500"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => onShare(file.id, file.filename)}
                className="p-2 hover:bg-purple-500/20 rounded-lg transition-colors text-purple-500"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(file.id, file.filename)}
                className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded Metadata */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-primary" />
            <span className="font-medium">Encryption Details</span>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Algorithm:</span>
              <span className="font-mono">AES-256-GCM</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">File ID:</span>
              <span className="font-mono text-xs">{file.id}</span>
            </div>
          </div>
          
          <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-blue-600 dark:text-blue-400 flex items-start gap-2">
              <Shield className="w-4 h-4 shrink-0" />
              <span>
                This file is encrypted with AES-256-GCM. You need your password to decrypt and download it.
              </span>
            </p>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
```

### Step 2: Create File Grid Component

```typescript
// file-grid.tsx
import { FileCard } from './file-card';
import { cn } from '../../lib/utils';

export function FileGrid({ files, viewMode, onFileSelect, onFileAction }: FileGridProps) {
  return (
    <div className={cn(
      'grid gap-4 transition-all duration-300',
      viewMode === 'grid' 
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        : 'grid-cols-1'
    )}>
      {files.map((file) => (
        <FileCard
          key={file.id}
          file={file}
          onDownload={onFileAction}
          onShare={onFileAction}
          onDelete={onFileAction}
          onToggleMetadata={onFileSelect}
          isExpanded={false}
          viewMode={viewMode}
        />
      ))}
    </div>
  );
}
```

### Step 3: Create File List Component

```typescript
// file-list.tsx
import { FileCard } from './file-card';
import { cn } from '../../lib/utils';

export function FileList({ files, viewMode, onFileSelect, onFileAction }: FileListProps) {
  return (
    <div className="space-y-2">
      {files.map((file) => (
        <FileCard
          key={file.id}
          file={file}
          onDownload={onFileAction}
          onShare={onFileAction}
          onDelete={onFileAction}
          onToggleMetadata={onFileSelect}
          isExpanded={false}
          viewMode={viewMode}
        />
      ))}
    </div>
  );
}
```

### Step 4: Create File Search Component

```typescript
// file-search.tsx
import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { GlassInput } from '../glass/glass-input';

export function FileSearch({ files, onSearch, placeholder = 'Search files...' }: FileSearchProps) {
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    onSearch(e.target.value);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
  };

  return (
    <div className="relative">
      <GlassInput
        value={query}
        onChange={handleSearch}
        placeholder={placeholder}
        className="pl-10"
      />
      {query && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 p-1.5 hover:bg-white/10 rounded-full transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
```

### Step 5: Create Folder Breadcrumb Component

```typescript
// folder-breadcrumb.tsx
import { Home, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export function FolderBreadcrumb({ currentPath, folders, onNavigate }: FolderBreadcrumbProps) {
  const pathSegments = currentPath.split('/').filter(Boolean);
  
  return (
    <nav className="flex items-center gap-2 text-sm">
      <button
        onClick={() => onNavigate('')}
        className="flex items-center gap-2 hover:bg-white/10 px-3 py-2 rounded-lg transition-colors"
      >
        <Home className="w-4 h-4" />
        <span className="font-medium">Home</span>
      </button>
      
      {pathSegments.map((segment, index) => (
        <>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <button
            onClick={() => onNavigate(pathSegments.slice(0, index + 1).join('/'))}
            className="hover:bg-white/10 px-3 py-2 rounded-lg transition-colors"
          >
            {segment}
          </button>
        </>
      ))}
    </nav>
  );
}
```

### Step 6: Create Barrel Export

```typescript
// index.ts
export { FileCard } from './file-card';
export { FileGrid } from './file-grid';
export { FileList } from './file-list';
export { FileSearch } from './file-search';
export { FolderBreadcrumb } from './folder-breadcrumb';

export type { FileCardProps, FileGridProps, FileListProps, FileSearchProps, FolderBreadcrumbProps, FileAction };
```

### Step 7: Update Files Page

Update [`files.tsx`](../vaultdrive_client/src/pages/files.tsx) to:
1. Import new components
2. Add view mode state
3. Add search state
4. Replace file list with FileGrid/FileList
5. Add view toggle button
6. Add search bar
7. Add folder breadcrumbs

---

## 🧪 Testing Checklist

- [ ] File card displays correctly in grid view
- [ ] File card displays correctly in list view
- [ ] View toggle switches between grid/list
- [ ] Search filters files correctly
- [ ] Folder breadcrumbs navigate correctly
- [ ] File actions (download, share, delete) work
- [ ] Metadata expansion works
- [ ] Responsive design works on mobile
- [ ] Glassmorphism styling consistent
- [ ] Animations are smooth (60fps)
- [ ] Keyboard navigation works
- [ ] No TypeScript errors
- [ ] No ESLint errors

---

## 📊 Success Metrics

1. **User Experience**
   - Files page feels modern and intuitive
   - Grid/list toggle provides flexibility
   - Search is fast and responsive
   - File cards are visually appealing

2. **Technical**
   - No TypeScript errors
   - No ESLint errors
   - Animations perform at 60fps
   - Components are accessible (keyboard, screen reader)

3. **Design**
   - Consistent with glassmorphism design system
   - Smooth transitions between views
   - Responsive on all screen sizes

---

## 🚀 Next Steps After Phase 2D

### Phase 2E: Search & Filter
- [ ] Implement advanced search with filters
- [ ] Add tag-based filtering
- [ ] Add date range filter
- [ ] Add file type filter

### Phase 3: New Capabilities
- [ ] Folder management (Phase 3A)
- [ ] Secure Notes / VaultPad (Phase 3B)
- [ ] File versioning (Phase 3C)
- [ ] File requests (Phase 3D)

---

## ✨ Summary

Phase 2D: Files Page Redesign creates a modern file management interface with:

| Component | Purpose | Priority |
|-----------|---------|----------|
| `file-card.tsx` | Individual file card with glassmorphism | P0 |
| `file-grid.tsx` | Grid view container | P0 |
| `file-list.tsx` | List view container | P0 |
| `file-search.tsx` | Search component | P1 |
| `folder-breadcrumb.tsx` | Folder navigation | P1 |

These components will transform the files page from a basic list to a modern, intuitive file management experience with grid/list views, search, and folder navigation.

**Ready for implementation in Code mode.**
