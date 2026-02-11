# VaultDrive Ascension Protocol v2.0 - Architectural Plan

## Executive Summary

This document outlines the comprehensive architectural plan for VaultDrive v2.0, transforming it from "secure storage" into an unforgettable, intuitive, and superior zero-knowledge experience.

**Current State:**
- Go 1.24.4 backend with JWT auth, AES-256-GCM encryption
- React 19 + TypeScript + Tailwind CSS + shadcn/ui frontend
- PostgreSQL with users, files, refresh_tokens, file_shares, file_access_keys tables
- Basic file operations: upload, download, sharing

**Target State:**
- Glassmorphism + Clean Brutalist UI
- Folders, tags, versioning, secure notes
- File requests, multi-device sync
- Plugin system, audit mode, SEO-optimized

---

## Phase 1: Foundation & Infrastructure

### 1.1 Database Schema Extensions

#### New Tables

```sql
-- +goose Up
-- Folders for hierarchical organization
CREATE TABLE folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- Tags for flexible categorization
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#6366f1',
    created_at TIMESTAMP NOT NULL
);

CREATE TABLE file_tags (
    file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (file_id, tag_id)
);

-- File versioning
CREATE TABLE file_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    file_size BIGINT NOT NULL,
    encrypted_path TEXT NOT NULL,
    encryption_metadata TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL
);

-- Secure Notes (VaultPad)
CREATE TABLE secure_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    encrypted_content TEXT NOT NULL,
    encryption_metadata TEXT NOT NULL,
    is_locked BOOLEAN DEFAULT FALSE,
    last_accessed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- File Requests (one-way inbound uploads)
CREATE TABLE file_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    expires_at TIMESTAMP,
    max_file_size BIGINT,
    is_active BOOLEAN DEFAULT TRUE,
    uploaded_files JSONB DEFAULT '[]',
    created_at TIMESTAMP NOT NULL
);

-- Plugin System
CREATE TABLE plugins_manifest (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    version VARCHAR(20) NOT NULL,
    manifest JSONB NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- Audit Logs for transparency
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMP NOT NULL
);

-- +goose Down
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS plugins_manifest;
DROP TABLE IF EXISTS file_requests;
DROP TABLE IF EXISTS secure_notes;
DROP TABLE IF EXISTS file_versions;
DROP TABLE IF EXISTS file_tags;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS folders;
```

### 1.2 New API Endpoints

```go
// Folder Operations
POST   /folders/create          // Create folder
GET    /folders                 // List folders
GET    /folders/{id}            // Get folder details
PUT    /folders/{id}            // Rename folder
DELETE /folders/{id}            // Delete folder
PUT    /folders/{id}/move       // Move folder

// Tag Operations
POST   /tags/create             // Create tag
GET    /tags                    // List all tags
PUT    /tags/{id}               // Update tag
DELETE /tags/{id}               // Delete tag
POST   /files/{id}/tags         // Add tag to file
DELETE /files/{id}/tags/{tag_id} // Remove tag from file
GET    /tags/{id}/files         // Get files by tag

// File Versioning
POST   /files/{id}/versions     // Upload new version
GET    /files/{id}/versions     // List versions
GET    /files/{id}/versions/{version_id} // Get version details
POST   /files/{id}/restore/{version_id} // Restore version

// Secure Notes (VaultPad)
POST   /notes/create            // Create note
GET    /notes                   // List notes
GET    /notes/{id}              // Get note
PUT    /notes/{id}              // Update note
DELETE /notes/{id}              // Delete note
POST   /notes/{id}/lock         // Lock note
POST   /notes/{id}/unlock       // Unlock note
POST   /notes/{id}/share        // Share note

// File Requests
POST   /requests/create         // Create upload link
GET    /requests                // List requests
GET    /requests/{id}           // Get request details
DELETE /requests/{id}           // Revoke request
GET    /requests/{token}/upload // Public upload page data
POST   /requests/{token}/upload // Public upload

// Plugin System
POST   /plugins/register        // Register plugin
GET    /plugins                 // List plugins
GET    /plugins/{id}            // Get plugin details
PUT    /plugins/{id}            // Update plugin
DELETE /plugins/{id}            // Delete plugin
POST   /plugins/{id}/enable     // Enable plugin
POST   /plugins/{id}/disable    // Disable plugin

// Audit & Trust
GET    /audit/logs              // Get user audit logs
GET    /audit/proof             // Generate audit proof
```

### 1.3 Sqlc Query Generation

Create SQL queries in `sql/queries/` for all new tables:

- `folders.sql` - CRUD operations for folders
- `tags.sql` - Tag management and file_tag associations
- `file_versions.sql` - Version tracking queries
- `secure_notes.sql` - Note CRUD with encryption metadata
- `file_requests.sql` - Request link management
- `plugins_manifest.sql` - Plugin registration queries
- `audit_logs.sql` - Audit trail queries

---

## Phase 2: UI/UX Overhaul

### 2.1 Visual Design System

**Glassmorphism + Clean Brutalist Fusion**

```css
/* Glassmorphism utilities */
.glass {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.glass-dark {
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Clean Brutalist accents */
.brutalist-border {
  border: 2px solid currentColor;
}

.brutalist-shadow {
  box-shadow: 4px 4px 0 currentColor;
}

/* Theme transitions */
.theme-transition {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### 2.2 Component Architecture

```
src/
├── components/
│   ├── layout/
│   │   ├── DashboardLayout.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── Breadcrumbs.tsx
│   ├── upload/
│   │   ├── DropZone.tsx        // Drag-and-drop zone
│   │   ├── UploadProgress.tsx  // Animated progress
│   │   └── UploadPreview.tsx   // Pre-upload encryption preview
│   ├── files/
│   │   ├── FileGrid.tsx        // Grid view
│   │   ├── FileList.tsx        // List view
│   │   ├── FileCard.tsx        // File item
│   │   ├── FileDetails.tsx     // Progressive disclosure panel
│   │   ├── FileSearch.tsx      // Encrypted fuzzy search
│   │   └── FileVersionHistory.tsx
│   ├── folders/
│   │   ├── FolderTree.tsx      // Hierarchical navigation
│   │   ├── FolderBreadcrumb.tsx
│   │   └── CreateFolderModal.tsx
│   ├── tags/
│   │   ├── TagList.tsx
│   │   ├── TagBadge.tsx
│   │   └── TagManager.tsx
│   ├── notes/
│   │   ├── NoteEditor.tsx      // Markdown editor
│   │   ├── NoteList.tsx
│   │   ├── NoteCard.tsx
│   │   └── AutolockTimer.tsx
│   ├── trust/
│   │   ├── FeedbackBar.tsx     // Emoji feedback
│   │   ├── PrivacyExplainer.tsx // Animated explainers
│   │   └── AuditLogViewer.tsx
│   └── ui/
│       └── (shadcn components)
```

### 2.3 Dashboard Layout

```tsx
// DashboardLayout.tsx - Main v2.0 layout
export default function DashboardLayout() {
  return (
    <div className="min-h-screen theme-transition">
      {/* Animated background gradient */}
      <AnimatedBackground />
      
      <div className="flex">
        <Sidebar className="glass-dark" />
        
        <main className="flex-1 p-6">
          <Header>
            <ThemeToggle className="cinematic" />
            <SearchBar />
          </Header>
          
          <DashboardContent />
        </main>
      </div>
      
      <FeedbackBar />
    </div>
  );
}
```

### 2.4 Drag-and-Drop Upload

```tsx
// DropZone.tsx - Animated upload zone
export default function DropZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        drop-zone glass rounded-xl p-8 text-center
        transition-all duration-300
        ${isDragging ? 'scale-105 border-primary' : ''}
      `}
    >
      <motion.div
        animate={isDragging ? { scale: [1, 1.1, 1] } : {}}
        transition={{ repeat: Infinity, duration: 1 }}
      >
        <UploadIcon className="w-12 h-12 mx-auto mb-4" />
      </motion.div>
      
      <p className="text-lg font-medium">
        Drop files here to encrypt & upload
      </p>
      
      {isDragging && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="encryption-preview mt-4"
        >
          <LockIcon className="w-4 h-4 inline mr-2" />
          <span>Encrypting with AES-256-GCM...</span>
        </motion.div>
      )}
      
      {uploadProgress > 0 && uploadProgress < 100 && (
        <Progress value={uploadProgress} className="mt-4" />
      )}
    </div>
  );
}
```

### 2.5 Encrypted Search

```tsx
// FileSearch.tsx - Client-side fuzzy search
import Fuse from 'fuse.js';

export default function FileSearch({ files }: { files: FileData[] }) {
  const [query, setQuery] = useState('');
  
  const fuse = new Fuse(files, {
    keys: ['filename', 'metadata'],
    threshold: 0.3,
    includeScore: true
  });
  
  const results = query ? fuse.search(query) : [];
  
  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search encrypted filenames..."
        className="glass pl-10"
      />
      
      {results.length > 0 && (
        <SearchResults results={results} />
      )}
    </div>
  );
}
```

### 2.6 Onboarding Animation

```tsx
// Onboarding.tsx - First-run animation
export default function Onboarding() {
  const steps = [
    {
      title: "Your Key",
      animation: "key-generation",
      text: "Your encryption key is generated client-side. Never leaves your device."
    },
    {
      title: "Your Cloud",
      animation: "encrypted-upload",
      text: "Files are encrypted before upload. Server sees only gibberish."
    },
    {
      title: "Your Rules",
      animation: "sharing-controls",
      text: "Share securely. Revoke anytime. No questions asked."
    }
  ];
  
  return (
    <OnboardingFlow steps={steps} />
  );
}
```

---

## Phase 3: New Capabilities

### 3.1 File Versioning

**Architecture:**
- Store encrypted deltas or full copies based on file size
- Track version number, created_at, created_by
- Allow restore to any previous version

**Backend:**
```go
func (cfg *ApiConfig) handlerUploadVersion(w http.ResponseWriter, r *http.Request) {
  // Get file_id from URL
  // Extract version number (current max + 1)
  // Store encrypted blob with new path: /versions/{file_id}/v{version}
  // Update file_versions table
}
```

**Frontend:**
```tsx
// VersionHistory.tsx
export default function VersionHistory({ fileId }) {
  const versions = useVersions(fileId);
  
  return (
    <div className="version-timeline">
      {versions.map((version) => (
        <VersionCard
          version={version}
          onRestore={() => restoreVersion(version.id)}
          onDownload={() => downloadVersion(version.id)}
        />
      ))}
    </div>
  );
}
```

### 3.2 Secure Notes (VaultPad)

**Architecture:**
- Notes stored as encrypted blobs (AES-256-GCM)
- Autolock timeout (configurable, default 5 min)
- Markdown rendering with live preview
- Sharing via wrapped keys

**Component:**
```tsx
// NoteEditor.tsx
export default function NoteEditor({ note }) {
  const [content, setContent] = useState('');
  const [isLocked, setIsLocked] = useState(note.is_locked);
  
  useEffect(() => {
    if (!isLocked) {
      const timer = setTimeout(() => setIsLocked(true), 5 * 60 * 1000);
      return () => clearTimeout(timer);
    }
  }, [isLocked, content]);
  
  return (
    <div className="note-editor">
      <MarkdownToolbar />
      {isLocked ? (
        <LockScreen onUnlock={() => setIsLocked(false)} />
      ) : (
        <MarkdownEditor value={content} onChange={setContent} />
      )}
      <AutolockIndicator remaining={timer} />
    </div>
  );
}
```

### 3.3 File Requests

**Architecture:**
- Generate unique token per request
- Public endpoint for upload (no auth required)
- Sender encrypts with vault's public key before upload
- Owner receives encrypted blob, can decrypt with private key

**Public Upload Flow:**
```
1. Requestor visits: /requests/{token}/upload
2. Server returns: vault's public key, request metadata
3. Browser encrypts file with vault key
4. Encrypted blob uploaded to /requests/{token}/upload
5. VaultDrive owner sees new file in "Shared with me" or "Requests"
```

### 3.4 Multi-Device Sync (Experimental)

**Architecture:**
- IndexedDB for local encrypted cache
- Sync queue for pending operations
- Background sync via Service Worker
- Conflict resolution: last-write-wins with merge strategy

**Service Worker:**
```typescript
// sync-worker.ts
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-files') {
    event.waitUntil(syncFiles());
  }
});

async function syncFiles() {
  const pendingOps = await getPendingOperations();
  for (const op of pendingOps) {
    try {
      await fetch(op.endpoint, { method: op.method, body: op.body });
      await removePendingOperation(op.id);
    } catch (error) {
      await markOperationFailed(op.id, error);
    }
  }
}
```

---

## Phase 4: Trust & Transparency

### 4.1 Feedback Mechanism

```tsx
// FeedbackBar.tsx
export default function FeedbackBar() {
  const [show, setShow] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  
  useEffect(() => {
    // Show after upload/share actions
    if (lastAction) {
      setShow(true);
      const timer = setTimeout(() => setShow(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [lastAction]);
  
  return show ? (
    <motion.div className="feedback-bar glass-dark fixed bottom-4 right-4 p-4 rounded-lg">
      <p className="text-sm mb-2">How was your experience?</p>
      <div className="flex gap-2">
        <EmojiButton emoji="😊" label="Secure" />
        <EmojiButton emoji="😐" label="Okay" />
        <EmojiButton emoji="😟" label="Confused" />
      </div>
    </motion.div>
  ) : null;
}
```

### 4.2 Explainable Privacy

```tsx
// PrivacyExplainer.tsx
export default function PrivacyExplainer() {
  return (
    <div className="privacy-explainer">
      <ExplainerCard
        title="Zero-Knowledge"
        icon={ShieldIcon}
        animation="key-never-leaves"
      >
        <p>
          Your encryption key is generated in your browser and never sent to our servers.
          Even we can't see your files.
        </p>
      </ExplainerCard>
      
      <ExplainerCard
        title="Client-Side Encryption"
        icon={LockIcon}
        animation="encryption-flow"
      >
        <p>
          Files are encrypted before they leave your device using AES-256-GCM.
          The server only receives encrypted blobs.
        </p>
      </ExplainerCard>
    </div>
  );
}
```

### 4.3 Audit Mode

```go
// Generate audit proof
func (cfg *ApiConfig) handlerGetAuditProof(w http.ResponseWriter, r *http.Request) {
  userID := getUserIDFromContext(r)
  
  proof := AuditProof{
    GeneratedAt:   time.Now().UTC(),
    UserID:        userID,
    KeyCreatedAt:  cfg.getUserKeyCreationTime(userID),
    FileAccessLogs: cfg.getUserFileAccessLogs(userID),
    ShareHistory:  cfg.getUserShareHistory(userID),
  }
  
  // Sign the proof
  proof.Signature = signProof(proof)
  
  respondWithJSON(w, http.StatusOK, proof)
}
```

---

## Phase 5: Social & SEO

### 5.1 Public Pages with SEO

```tsx
// About page with structured data
export default function About() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "VaultDrive",
    "applicationCategory": "SecurityApplication",
    "description": "Zero-knowledge encrypted cloud storage",
    "features": [
      "Client-side encryption",
      "Secure file sharing",
      "Self-hosted option"
    ]
  };
  
  return (
    <>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
      <AboutPage />
    </>
  );
}
```

### 5.2 Demo Sandbox

```tsx
// Demo mode - no auth required
export default function DemoPage() {
  const mockFiles = [
    { id: '1', filename: 'sample-document.pdf', encrypted: true },
    { id: '2', filename: 'photo.jpg', encrypted: true },
  ];
  
  return (
    <DemoMode>
      <DemoFiles files={mockFiles} />
      <DemoExplanation />
    </DemoMode>
  );
}
```

---

## Phase 6: Plugin System

### 6.1 Plugin Manifest Schema

```json
{
  "name": "example-plugin",
  "version": "1.0.0",
  "description": "Example VaultDrive plugin",
  "permissions": ["file:read", "file:write", "audit:read"],
  "endpoints": {
    "settings": "/plugins/example/settings",
    "action": "/plugins/example/action"
  },
  "ui": {
    "menuItem": "Example Plugin",
    "icon": "plugin-icon.svg"
  }
}
```

### 6.2 Plugin API

```typescript
// Plugin API exposed to plugin developers
interface VaultDrivePluginAPI {
  // File operations
  listFiles(): Promise<FileData[]>;
  encryptFile(file: File): Promise<EncryptedFile>;
  decryptFile(encryptedFile: EncryptedFile): Promise<File>;
  
  // Audit
  getAuditLogs(): Promise<AuditLog[]>;
  
  // UI
  addMenuItem(config: MenuItemConfig): void;
  addToolbarButton(config: ToolbarButtonConfig): void;
  
  // Settings
  getPluginSettings(): Promise<Record<string, any>>;
  setPluginSettings(settings: Record<string, any>): Promise<void>;
}
```

---

## Phase 7: Implementation Roadmap

### Order of Execution

```
Phase 1 (Foundation): Weeks 1-2
├── Database migrations
├── Sqlc queries
└── Backend handlers

Phase 2 (UI/UX): Weeks 2-4
├── Design system
├── Dashboard layout
├── Drag-drop upload
└── Search & navigation

Phase 3 (Features): Weeks 4-8
├── Versioning
├── Secure notes
├── File requests
└── Multi-device sync

Phase 4 (Trust): Weeks 6-7
├── Feedback system
├── Privacy explainers
└── Audit mode

Phase 5 (Growth): Weeks 7-8
├── Public pages
├── SEO optimization
└── Demo mode

Phase 6 (Plugins): Weeks 8-10
├── Plugin API
├── Plugin registry
└── Plugin UI

Phase 7 (Polish): Weeks 10-12
├── Testing
├── Accessibility
└── Performance
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Complexity creep | Features bloat | Strict MVP scope, defer plugins to v2.1 |
| Performance regression | Slow UI | Lazy load components, optimize queries |
| Security regression | Encryption flaws | Third-party audit, extensive testing |
| Database migration failures | Data loss | Test migrations, rollback plan ready |
| Plugin security | Malicious plugins | Sandboxing, permission system |

---

## Success Metrics

- **User Engagement**: Increase session duration by 40%
- **Task Completion**: 95% upload success rate
- **Trust Signals**: 80% positive feedback on privacy confidence
- **Performance**: <2s page load, <500ms interactions
- **SEO**: Top 3 ranking for "encrypted cloud storage"

---

## Final Strike Command

```json
{
  "next": "Execute Phase 1: Foundation & Infrastructure",
  "focus": "Database migrations, sqlc generation, backend handlers",
  "meta": "Your data. Your cloud. Your silence. VaultDrive v2."
}
```
