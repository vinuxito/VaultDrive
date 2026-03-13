# ABRN Drive

> Enterprise Zero-Knowledge Cloud Storage Platform (Self-Hosted)  
> Consolidated docs (for humans + agents).  
> Last updated: March 12, 2026

## 0) Agent onboarding
If you're an agent (or Filemón Coder), start here:

1. Read this file top-to-bottom once.
2. Then read `AGENT_MASTER.md` for server runbooks and operational rules.
3. Never run destructive commands (delete/drop/reinstall) without explicit approval.
4. Prefer the **smallest safe change**, verify, then proceed (Next Brick loop).

---

## 1) Documentation map

- **README.md** (this file): product, architecture, dev workflow, API map, feature plan, roadmap.
- **AGENT_MASTER.md**: server + deployment + ops runbooks (systemd, Apache proxy, logs, backups, troubleshooting).
- **docs/PASSWORD_PROTECTED_DROP.md**: Password-protected Secure Drop implementation guide (key wrapping, encryption flow, API usage).

---

<div align="center">
    <img src="vaultdrive_client/public/abrn-logo.png" alt="ABRN Drive Logo" width="120">
    <h1>ABRN Drive</h1>
    <p><em>Enterprise Zero-Knowledge Cloud Storage Platform</em></p>
    <p>
        <img src="https://img.shields.io/badge/Go_1.24-00ADD8?style=for-the-badge&logo=go&logoColor=white" alt="Go">
        <img src="https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React">
        <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
        <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
        <img src="https://img.shields.io/badge/AES--256--GCM-Encrypted-green?style=for-the-badge" alt="Encrypted">
    </p>
</div>

<br>

**ABRN Drive** is an enterprise-grade, self-hosted cloud storage platform with zero-knowledge encryption. Built for businesses that demand maximum privacy and security, featuring team collaboration, secure file sharing, a cinematic Vault Explorer UI, PIN-based authentication, and comprehensive audit logging.

**Live Demo:** [https://dev-app.filemonprime.net/abrn/](https://dev-app.filemonprime.net/abrn/)

**Test User:** filemon@abrn.mx / 986532

## Features

### 🔐 Secure Authentication
- JWT-based authentication with refresh token rotation
- bcrypt password hashing (cost factor 10)
- Automatic RSA-2048 key pair generation per user
- Encrypted private key storage
- **PIN login**: users can authenticate with either password or 4-digit PIN
- **Set-PIN banner**: users without a PIN are prompted on first login

### 🔑 4-Digit PIN System
- Every user has an optional 4-digit PIN stored as a bcrypt hash
- PIN replaces password for Secure Drop file decryption
- Drop links created with a PIN-wrapped key (no plaintext key in transport)
- `POST /api/users/pin` — set or change PIN
- `GET /api/users/pin/status` — check if PIN is configured

### 💾 Zero-Knowledge Encryption
- **Client-side encryption**: Files encrypted before upload with AES-256-GCM
- **Password-based key derivation**: PBKDF2-SHA256 (100,000 iterations)
- **Metadata storage**: IV, salt, and encrypted metadata stored server-side
- **Backend blind storage**: Server never sees plaintext files or keys

### 🤝 Secure File Sharing
- **User-to-user sharing**: RSA-2048 wrapped key system
- **Group sharing**: Share files with teams and organizations
- **Instant revocation**: Remove access immediately by deleting wrapped keys
- **Granular permissions**: Owner, member, viewer roles

### 👥 Team Collaboration
- **Groups**: Create teams with multiple members
- **Group file sharing**: Share encrypted files with entire groups
- **Member management**: Add/remove members, assign roles
- **Group audit**: Track who shared what files to which groups

### 📧 Email Support *(code preserved, removed from active UI)*
- IMAP integration code exists in `handle_email_accounts.go.disabled` and `handle_email_fetching.go.disabled`
- Removed from sidebar and routing to reduce surface area; code is intact for future re-activation

### 🔗 Secure Drop
- **Write-only uploads**: Upload files without authentication via token
- **Auto-folder creation**: Owners can create upload links that create folders automatically
- **Token-based access**: Share URLs with clients, no passwords needed for uploaders
- **PIN-protected keys**: Drop links are secured with owner's 4-digit PIN (replaces password; see `docs/PASSWORD_PROTECTED_DROP.md`)
- **Revocable links**: Deactivate tokens immediately after use
- **Encrypted uploads**: Client-side AES-256-GCM encryption with PIN-wrapped key
- **No user account**: Uploaders don't need to register or log in
- **Write-only access**: Uploaders can upload but cannot read/list/download

### 🗂️ Vault Explorer (Files Redesign)
- **Split-pane layout**: 240px collapsible tree sidebar + rich file panel
- **Tree navigation**: All Files → Starred → My Folders (per folder) → Shared with Me → Drop Links (per token, with active/used/expired badges)
- **Origin badges**: Each file shows its source — My Upload, Drop: link, @user share, or group
- **Inline star toggle**: Star/unstar files directly from the file row
- **Bulk selection**: Checkbox per file → floating action bar → bulk download or bulk delete
- **Bulk download modal**: Detects PIN vs. password need per file, sequential decrypt with per-file progress
- **Search**: Instant client-side filename filter within the active tree node

### 📊 Audit Logging
- Comprehensive activity tracking
- File access logs
- Share event tracking
- User action history

### 🎨 Modern UI/UX
- **React 19** with TypeScript
- **Glassmorphism design**: Beautiful frosted glass effects
- **Responsive layout**: Works on desktop, tablet, and mobile
- **Dark mode support**: System-aware theme switching
- **Reusable components**: FileWidget for consistent file display
- **shadcn/ui**: High-quality accessible components

## Tech Stack

### Backend
- **Go 1.24.4**: High-performance REST API server
- **PostgreSQL**: Relational database with ACID guarantees
- **sqlc**: Type-safe SQL code generation
- **Goose**: Database migration management
- **JWT**: Stateless authentication with refresh tokens
- **bcrypt**: Secure password hashing

### Frontend
- **React 19**: Modern UI framework with concurrent features
- **TypeScript**: Type safety and better developer experience
- **Vite**: Lightning-fast build tool and dev server
- **Tailwind CSS 4**: Utility-first styling framework
- **shadcn/ui**: Accessible, customizable component library
- **Radix UI**: Unstyled, accessible component primitives
- **Lucide React**: Beautiful, consistent icon set

### Infrastructure
- **Apache**: Reverse proxy with SSL termination
- **systemd**: Service management and process supervision
- **inotify**: File system event monitoring for auto-reload

### Development Tools
- **Auto-reload system**: Automatic backend restart on frontend changes
- **FileWidget component**: Reusable file display across the app
- **Hot module replacement**: Instant feedback during development

## Quick Start

### Prerequisites
- Go 1.24.4 or higher
- PostgreSQL 13 or higher
- Node.js 20 or higher
- Apache 2.4 (for production)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ABRN-Drive
   ```

2. **Database setup**
   ```bash
   # Create database
   sudo -u postgres createdb abrndrive

   # Set environment variable
   export DB_URL="postgresql://user:pass@localhost:5432/abrndrive?sslmode=disable"

   # Run migrations
   cd sql/schema
   for file in *.sql; do
     psql "$DB_URL" < "$file"
   done
   cd ../..
   ```

3. **Environment variables**
   ```bash
   export DB_URL="postgresql://user:pass@localhost:5432/abrndrive?sslmode=disable"
   export JWT_SECRET="your-secret-key-minimum-32-characters-recommended"
   export PORT="8082"
   ```

4. **Backend build and run**
   ```bash
   # Build
   make build

   # Run directly (development)
   ./abrndrive

   # Or use systemd (production)
   sudo systemctl start abrndrive
   ```

5. **Frontend build and run**
   ```bash
   cd vaultdrive_client

   # Install dependencies
   npm install

   # Development server (with HMR)
   npm run dev
   # Opens on http://localhost:5173

   # Production build
   npm run build
   # Creates dist/ folder served by Go backend
   ```

6. **Access the application**
   - Development: `http://localhost:8082`
   - Production (with Apache): `https://dev-app.filemonprime.net/abrn/`

## Auto-Reload Development Workflow

ABRN Drive includes an **automatic reload system** that eliminates manual backend restarts:

```bash
cd vaultdrive_client

# Edit React components...

# Build
npm run build

# Auto-reload service detects changes → Restarts backend → Changes live in 3 seconds!
```

**How it works:**
1. Watch service (`abrn-watch`) monitors `vaultdrive_client/dist/` directory
2. When files change, waits 3 seconds (debounce)
3. Automatically restarts `abrndrive` backend service
4. Your changes are immediately available!

**Monitor auto-reload:**
```bash
sudo journalctl -u abrn-watch -f
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed documentation.

## API Endpoints

### Authentication (All endpoints prefixed with `/abrn/api/`)
- `POST /abrn/api/register` - Create account & generate RSA keys
- `POST /abrn/api/login` - Get JWT tokens; accepts `password` or `pin` field; returns `pin_set: bool`
- `POST /abrn/api/refresh` - Refresh access token
- `GET /abrn/api/users/me` - Get current user profile

### PIN (All endpoints prefixed with `/abrn/api/`)
- `POST /abrn/api/users/pin` - Set or update 4-digit PIN (auth required)
- `GET /abrn/api/users/pin/status` - Returns `{ pin_set: bool }` (auth required)

### Files (All endpoints prefixed with `/abrn/api/`)
- `POST /abrn/api/files/upload` - Upload encrypted file (multipart)
- `GET /abrn/api/files` - List your files (includes `starred` field)
- `GET /abrn/api/files/{id}/download` - Download encrypted file
- `POST /abrn/api/files/{id}/star` - Toggle star status
- `DELETE /abrn/api/files/{id}` - Delete file
- `POST /abrn/api/files/{id}/share` - Share file with user
- `GET /abrn/api/files/{id}/shares` - List file shares
- `DELETE /abrn/api/files/{id}/revoke/{user_id}` - Revoke access
- `GET /abrn/api/files/shared` - List files shared with you

### Groups (All endpoints prefixed with `/abrn/api/`)
- `POST /abrn/api/groups` - Create group
- `GET /abrn/api/groups` - List your groups
- `GET /abrn/api/groups/{id}` - Get group details
- `PUT /abrn/api/groups/{id}` - Update group
- `DELETE /abrn/api/groups/{id}` - Delete group
- `POST /abrn/api/groups/{id}/members` - Add member
- `DELETE /abrn/api/groups/{id}/members/{user_id}` - Remove member
- `POST /abrn/api/groups/{id}/files` - Share file to group
- `GET /abrn/api/groups/{id}/files` - List group files

### Email *(handlers disabled — code preserved as `.disabled` files)*
- Routes removed from active routing; handlers in `handle_email_accounts.go.disabled`, `handle_email_fetching.go.disabled`, `imap_client.go.disabled`

### Secure Drop - Write-Only File Upload
- `GET /abrn/api/drop/{token}` - Get token info
- `POST /abrn/api/drop/{token}/upload` - Upload encrypted file via token
- `GET /abrn/api/drop/{token}/files` - List files uploaded via a token (owner only, auth required)
- `POST /abrn/api/drop/{token}/done` - Deactivate upload link
- `GET /abrn/api/drop/{token}/owner-info` - Get owner's public key
- `POST /abrn/api/drop/create` - Create upload token (auth required; uses PIN to wrap key)
- `GET /abrn/api/drop/tokens` - List user's upload tokens (auth required)

**Frontend Route:** `/drop/:token` - Public upload page (no auth required)

**PIN Protection:** Drop links are secured with the owner's 4-digit PIN. See `docs/PASSWORD_PROTECTED_DROP.md`.

## Quick Reference Guide

**For fast-copy commands and troubleshooting:**

📖 **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - One-stop guide for:
- Critical paths and file locations
- One-command reload workflows
- API endpoints table
- Service management commands
- Debugging checklist
- Common pitfalls & solutions

**Essential Commands:**
```bash
# Frontend build (auto-reloads in 3-5s)
cd vaultdrive_client && npm run build

# Backend rebuild
cd /lamp/www/ABRN-Drive && go build && sudo systemctl restart abrndrive

# Check all services
sudo systemctl status abrndrive abrn-watch apache2 postgresql

# View backend logs
sudo journalctl -u abrndrive -f

# Test API locally
curl -i http://localhost:8082/abrn/api/drop/testtoken123
```

## Architecture & Component Design

### FileWidget - Reusable File Display Component

ABRN Drive features a **unified file display component** used throughout the application for design consistency:

**Location:** `vaultdrive_client/src/components/files/FileWidget.tsx`

**Usage:**
```tsx
import { FileWidget } from "../components/files";

<FileWidget
  file={fileData}
  context="my-files"  // "my-files" | "shared-files" | "group-files"
  onDownload={handleDownload}
  onShare={handleShare}
  onManageShares={handleManageShares}
  onDelete={handleDelete}
  showActions={true}
  showDetails={true}
  enableExpand={true}
/>
```

**Features:**
- Context-aware action buttons (Share, Download, Delete)
- Metadata display with expandable encryption details
- Badge system for ownership and group sharing
- Conditional rendering based on user permissions
- Consistent UI/UX across Files, Groups, and Shared pages

### Project Structure

```
ABRN-Drive/
├── main.go                          # HTTP server, routing, static file serving
├── handle_*.go                      # API endpoint handlers
│   ├── handle_login.go              # PIN + password dual-auth
│   ├── handle_user_pin.go           # Set PIN / PIN status
│   ├── handle_drop.go               # Secure Drop (PIN-wrapped keys)
│   ├── handle_list_files.go         # File list (includes starred field)
│   ├── handle_file_star.go          # Star toggle
│   ├── handle_email_*.go.disabled   # Email handlers (preserved, inactive)
│   └── imap_client.go.disabled      # IMAP client (preserved, inactive)
├── middleware_*.go                  # Authentication, CORS middleware
├── internal/database/               # sqlc generated code
├── sql/
│   ├── queries/                     # SQL queries (.sql)
│   └── schema/                      # Database migrations
│       ├── 023_user_pin.sql         # pin_hash, pin_set_at on users
│       └── 024_upload_tokens_pin_wrapped_key.sql  # pin_wrapped_key on file_access_keys
├── vaultdrive_client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── vault/               # ⭐ Vault Explorer components
│   │   │   │   ├── VaultTree.tsx    # Left sidebar tree navigation
│   │   │   │   ├── OriginBadge.tsx  # File origin pill (My Upload / Drop / Shared / Group)
│   │   │   │   ├── BulkActionBar.tsx       # Floating bulk selection bar
│   │   │   │   ├── BulkDownloadModal.tsx   # Sequential bulk decrypt modal
│   │   │   │   └── index.ts
│   │   │   ├── files/
│   │   │   │   ├── FileWidget.tsx   # Reusable file component
│   │   │   │   └── index.ts
│   │   │   ├── layout/
│   │   │   │   ├── dashboard-layout.tsx    # PIN banner for unset PIN
│   │   │   │   └── sidebar.tsx             # Email nav item removed
│   │   │   ├── upload/
│   │   │   │   └── CreateUploadLinkModal.tsx  # PIN field (replaces password)
│   │   │   ├── branding/            # ABRN logo and footer
│   │   │   └── ui/                  # shadcn/ui components
│   │   ├── pages/
│   │   │   ├── files.tsx            # ⭐ Vault Explorer (split-pane redesign)
│   │   │   ├── login.tsx            # PIN ↔ password tab toggle
│   │   │   ├── settings.tsx         # PIN management card
│   │   │   ├── groups.tsx
│   │   │   ├── shared.tsx
│   │   │   └── drop-upload.tsx
│   │   ├── utils/
│   │   │   ├── api.ts               # API client (setPIN, getPINStatus)
│   │   │   ├── crypto.ts            # Encryption utilities
│   │   │   └── format.ts            # Formatters
│   │   └── App.tsx                  # Routing (email route removed)
│   └── dist/                        # ⭐ Watched by auto-reload
├── watch-and-reload.sh              # ⭐ Auto-reload script
└── abrndrive                        # Compiled backend binary
```

## Security Architecture

**ABRN Drive** implements a **Zero-Knowledge Architecture** where the server acts as a blind storage provider. The backend never sees files in plaintext or has access to decryption keys.

### Cryptographic Primitives

- **File Encryption:** AES-256-GCM (Authenticated Encryption with Associated Data)
- **Key Derivation:** PBKDF2-SHA256 (100,000 iterations) with unique per-file salts
- **Key Exchange:** RSA-2048 (OAEP padding for secure key wrapping)
- **Password Hashing:** bcrypt (cost factor 10)
- **Token Signing:** HS256 (HMAC-SHA256 for JWT)

### Encryption Flow

#### 1. User Registration
```
1. User provides email + password
2. Backend hashes password with bcrypt
3. Client generates RSA-2048 key pair
4. Client encrypts private key with user password
5. Backend stores: bcrypt hash, encrypted private key, public key
```

#### 2. File Upload
```
1. User selects file + provides encryption password
2. Client derives AES-256 key with PBKDF2 (password + random salt)
3. Client encrypts file with AES-256-GCM
4. Client uploads: encrypted blob + IV + salt + metadata
5. Backend stores encrypted data (cannot decrypt)
```

#### 3. File Sharing
```
1. Owner retrieves recipient's public RSA key
2. Owner decrypts file key with their password
3. Owner wraps file key with recipient's public key (RSA-OAEP)
4. Backend stores wrapped key in file_access_keys table
5. Recipient unwraps key with their private key
6. Recipient decrypts file with unwrapped AES key
```

#### 4. Group Sharing
```
1. Owner shares file to group
2. For each group member:
   - Wrap file key with member's public RSA key
   - Store in file_access_keys with group_id
3. Members access via group OR individual share
4. Revoke all by deleting group shares
```

### Security Features

✅ **Zero-Knowledge**: Server cannot decrypt files
✅ **End-to-End Encryption**: Files encrypted before leaving client
✅ **Forward Secrecy**: Each file has unique encryption key
✅ **Secure Key Exchange**: RSA-2048 for sharing
✅ **Instant Revocation**: Delete wrapped key = immediate access removal
✅ **Authenticated Encryption**: AES-GCM prevents tampering
✅ **Password Stretching**: PBKDF2 100,000 iterations
✅ **Token Rotation**: Refresh token mechanism

## Development Workflow

### Making Changes

ABRN Drive includes an **automatic development workflow** that streamlines the development process:

#### Frontend Changes
```bash
cd vaultdrive_client

# 1. Make your changes to React components

# 2. Build
npm run build

# 3. Wait 3 seconds
# Auto-reload service automatically restarts backend

# 4. Refresh browser
# See your changes immediately!
```

#### Backend Changes
```bash
# 1. Make changes to Go handlers/models

# 2. Rebuild
make build

# 3. Restart service
sudo systemctl restart abrndrive
```

#### Database Changes
```bash
# 1. Create migration
cd sql/schema
touch 017_new_feature.sql

# 2. Write SQL
# ALTER TABLE ...

# 3. Run migration
psql "$DB_URL" < 017_new_feature.sql

# 4. Update queries (if needed)
cd ../queries
# Edit .sql files

# 5. Regenerate sqlc
cd ../..
sqlc generate

# 6. Rebuild
make build
sudo systemctl restart abrndrive
```

### Monitoring & Debugging

**View backend logs:**
```bash
sudo journalctl -u abrndrive -f
```

**View auto-reload logs:**
```bash
sudo journalctl -u abrn-watch -f
```

**Check service status:**
```bash
sudo systemctl status abrndrive abrn-watch
```

**Test API endpoints:**
```bash
# Get token
TOKEN=$(curl -s -X POST https://dev-app.filemonprime.net/abrn/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test@test.com","password":"test123"}' | jq -r '.access_token')

# List files
curl -H "Authorization: Bearer $TOKEN" \
  https://dev-app.filemonprime.net/abrn/api/files | jq
```

## Documentation

- **[DEVELOPMENT.md](DEVELOPMENT.md)** - Comprehensive development guide with:
  - Auto-reload system documentation
  - FileWidget component usage
  - Adding new pages and API endpoints
  - Database migrations
  - Testing strategies
  - Troubleshooting guide

- **[DEPLOYMENT-INSTRUCTIONS.md](DEPLOYMENT-INSTRUCTIONS.md)** - Production deployment guide with:
  - Initial deployment setup
  - Auto-reload system configuration
  - Apache reverse proxy setup
  - Systemd service management
  - Security best practices
  - Monitoring and troubleshooting

## Key Features Summary

| Feature | Description | Status |
|---------|-------------|--------|
| Zero-Knowledge Encryption | AES-256-GCM client-side encryption | ✅ Production |
| File Management | Upload, download, delete encrypted files | ✅ Production |
| Vault Explorer | Split-pane file browser with tree navigation | ✅ Production |
| Origin Badges | Per-file source tagging (My Upload / Drop / Shared / Group) | ✅ Production |
| Bulk Download | Multi-select, credential-aware sequential decrypt | ✅ Production |
| Starred Files | Star toggle with instant sidebar count | ✅ Production |
| 4-Digit PIN System | PIN login, PIN-protected Drop links | ✅ Production |
| Secure Drop | Write-only file upload via PIN-protected tokens | ✅ Production |
| Secure Sharing | RSA-2048 wrapped key sharing | ✅ Production |
| Group Collaboration | Team file sharing with access control | ✅ Production |
| Email Integration | IMAP handlers preserved, inactive | ⏸️ Disabled |
| Auto-Reload System | Automatic backend restart on changes | ✅ Production |
| Audit Logging | Comprehensive activity tracking | ✅ Production |
| Mobile Responsive | Adaptive UI for all screen sizes | ✅ Production |
| Dark Mode | System-aware theme switching | ✅ Production |

## Technology Highlights

- **Go 1.24.4** - Latest Go runtime with performance improvements
- **React 19** - Concurrent features and automatic batching
- **TypeScript** - Type safety across the entire frontend
- **PostgreSQL** - ACID compliance and relational integrity
- **sqlc** - Compile-time type-safe SQL queries
- **Vite** - Sub-second HMR and optimized builds
- **Tailwind CSS 4** - Modern utility-first styling
- **systemd** - Reliable service management

## License

This project is proprietary software developed for ABRN Asesores.

## Contact

**ABRN Asesores**
- Website: [https://dev-app.filemonprime.net/abrn/](https://dev-app.filemonprime.net/abrn/)
- Support: Contact your ABRN administrator

---

**Last Updated:** March 12, 2026
**Version:** Production — Vault Explorer + PIN System
**Built with ❤️ for enterprise security and privacy**

---

## Appendix A — Development Guide (merged)

This section is merged from `DEVELOPMENT.md` and kept here so agents don't have to hunt.

# ABRN Drive - Development Guide

## Table of Contents
- [Development Workflow](#development-workflow)
- [Auto-Reload System](#auto-reload-system)
- [Frontend Development](#frontend-development)
- [Backend Development](#backend-development)
- [Component Architecture](#component-architecture)
- [Testing](#testing)

---

## Development Workflow

### Quick Start

1. **Start watching for changes** (automatic reload enabled by default)
   ```bash
   # Check watch service status
   sudo systemctl status abrn-watch
   ```

2. **Make frontend changes**
   ```bash
   cd vaultdrive_client
   # Edit your React components...
   ```

3. **Build and deploy**
   ```bash
   npm run build
   # Watch service automatically restarts backend within 3 seconds
   ```

4. **Refresh browser** - See your changes immediately!

---

## Auto-Reload System

### Overview

ABRN Drive includes an **automatic reload system** that eliminates manual backend restarts during development.

**How it works:**
```
Frontend Change → Build → dist/ updated → Watch detects → Backend restarts → Changes live!
```

### Components

#### 1. Watch Service (`abrn-watch.service`)
**Location:** `/etc/systemd/system/abrn-watch.service`

**Purpose:** Systemd service that runs the watch script 24/7

**Commands:**
```bash
# Check status
sudo systemctl status abrn-watch

# View live logs
sudo journalctl -u abrn-watch -f

# Restart watch service
sudo systemctl restart abrn-watch

# Temporarily disable
sudo systemctl stop abrn-watch

# Re-enable
sudo systemctl start abrn-watch
```

#### 2. Watch Script (`watch-and-reload.sh`)
**Location:** `/lamp/www/ABRN-Drive/watch-and-reload.sh`

**Features:**
- Monitors `vaultdrive_client/dist/` directory for changes
- 3-second debounce to avoid rapid restarts during build
- Automatic backend service restart
- Detailed logging with timestamps
- Runs continuously in background

**Manual execution (for testing):**
```bash
cd /lamp/www/ABRN-Drive
./watch-and-reload.sh
```

#### 3. File System Monitor (`inotify-tools`)
**Package:** `inotify-tools`

Provides efficient file system event monitoring without polling.

### Configuration

#### Disable Auto-Reload (if needed)
```bash
sudo systemctl stop abrn-watch
sudo systemctl disable abrn-watch
```

#### Change Watch Directory
Edit `/lamp/www/ABRN-Drive/watch-and-reload.sh`:
```bash
DIST_DIR="/lamp/www/ABRN-Drive/vaultdrive_client/dist"  # Change this
```

#### Adjust Debounce Time
Edit `/lamp/www/ABRN-Drive/watch-and-reload.sh`:
```bash
DEBOUNCE_SECONDS=3  # Increase for slower builds
```

---

## Frontend Development

### Project Structure
```
vaultdrive_client/
├── src/
│   ├── components/
│   │   ├── files/
│   │   │   ├── FileWidget.tsx      # ⭐ Reusable file display component
│   │   │   └── index.ts
│   │   ├── layout/
│   │   │   ├── dashboard-layout.tsx
│   │   │   └── sidebar.tsx
│   │   └── ui/                     # shadcn/ui components
│   ├── pages/
│   │   ├── files.tsx
│   │   ├── groups.tsx
│   │   ├── shared.tsx
│   │   └── email.tsx
│   ├── utils/
│   │   ├── api.ts
│   │   ├── crypto.ts
│   │   └── format.ts
│   └── App.tsx
├── dist/                            # ⭐ Watched by auto-reload
└── package.json
```

### Build Commands

```bash
cd vaultdrive_client

# Standard build (auto-reload will trigger)
npm run build

# Development server (no auto-reload needed)
npm run dev

# Lint code
npm run lint

# Preview production build
npm run preview
```

### Adding New Pages

1. **Create page component**
   ```tsx
   // src/pages/my-page.tsx
   import { DashboardLayout } from "../components/layout/dashboard-layout";

   export default function MyPage() {
     return (
       <DashboardLayout>
         <div>My content</div>
       </DashboardLayout>
     );
   }
   ```

2. **Add route in App.tsx**
   ```tsx
   import MyPage from "./pages/my-page";

   <Route path="/my-page" element={<MyPage />} />
   ```

3. **Build and test**
   ```bash
   npm run build
   # Auto-reload kicks in
   # Refresh browser to see new page
   ```

---

## Backend Development

### Project Structure
```
ABRN-Drive/
├── main.go                          # HTTP server & routing
├── handle_*.go                      # Request handlers
├── middleware_*.go                  # Middleware functions
├── internal/database/               # sqlc generated code
├── sql/
│   ├── queries/                     # SQL queries (.sql)
│   └── schema/                      # Migrations (.sql)
├── vaultdrive_client/dist/          # Frontend assets (served by Go)
├── watch-and-reload.sh              # ⭐ Auto-reload script
└── abrndrive                        # Compiled binary
```

### Build and Run

```bash
cd /lamp/www/ABRN-Drive

# Build backend
make build

# Run backend manually (for testing)
./abrndrive

# Or use systemd service
sudo systemctl restart abrndrive
sudo systemctl status abrndrive
```

### Adding New API Endpoints

1. **Create handler function**
   ```go
   // handle_my_feature.go
   func (cfg *ApiConfig) myFeatureHandler(w http.ResponseWriter, r *http.Request, user database.User) {
       // Your logic here
       respondWithJSON(w, http.StatusOK, data)
   }
   ```

2. **Add route in main.go**
   ```go
   mux.Handle("GET /api/my-feature", apiConfig.middlewareAuth(apiConfig.myFeatureHandler))
   ```

3. **Rebuild and restart**
   ```bash
   make build
   sudo systemctl restart abrndrive
   ```

### Database Migrations

1. **Create migration file**
   ```bash
   cd sql/schema
   # Create new file with incrementing number
   touch 017_my_migration.sql
   ```

2. **Write SQL**
   ```sql
   -- name: 017_my_migration
   ALTER TABLE files ADD COLUMN my_field TEXT;
   ```

3. **Run migration**
   ```bash
   goose -dir sql/schema postgres "$DB_URL" up
   ```

4. **Regenerate sqlc**
   ```bash
   sqlc generate
   ```

---

## Component Architecture

### FileWidget Component

**Location:** `vaultdrive_client/src/components/files/FileWidget.tsx`

**Purpose:** Reusable file display component used across the application for consistent UI/UX.

**Usage:**
```tsx
import { FileWidget } from "../components/files";

<FileWidget
  file={fileData}
  context="my-files"           // "my-files" | "shared-files" | "group-files"
  onDownload={handleDownload}
  onShare={handleShare}
  onManageShares={handleManageShares}
  onDelete={handleDelete}
  showActions={true}
  showDetails={true}
  enableExpand={true}
/>
```

**Contexts:**
- `my-files`: Shows all action buttons (Share, Manage, Download, Delete)
- `shared-files`: Shows only Download button
- `group-files`: Shows Download button + group metadata

**Features:**
- File metadata display (size, date, encryption status)
- Badge system (ownership, group sharing)
- Expandable encryption details
- Group sharing information
- Conditional action buttons based on context

### Dashboard Layout

**Location:** `vaultdrive_client/src/components/layout/dashboard-layout.tsx`

Provides consistent layout with sidebar, top nav, and user dropdown.

**Usage:**
```tsx
import { DashboardLayout } from "../components/layout/dashboard-layout";

export default function MyPage() {
  return (
    <DashboardLayout>
      <div>Page content...</div>
    </DashboardLayout>
  );
}
```

---

## Testing

### Manual Testing

**Test Suite Location:** `/admin/tests`

**Access:** Admin users only

**Features:**
- File upload/list/metadata tests
- Group create/list tests
- Group file sharing tests (validates no 400 errors)
- Shared file visibility tests
- Test data cleanup

**Usage:**
1. Login as admin user
2. Navigate to `/admin/tests`
3. Click "Run All Tests"
4. Review results with ✅/❌ indicators
5. Export results to JSON if needed

### API Testing

```bash
# Get auth token
TOKEN="your-jwt-token"

# Test file upload
curl -X POST https://dev-app.filemonprime.net/abrn/files/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.txt" \
  -F "password=test123"

# Test file list
curl https://dev-app.filemonprime.net/abrn/files \
  -H "Authorization: Bearer $TOKEN"

# Test group creation
curl -X POST https://dev-app.filemonprime.net/abrn/groups \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Group","description":"Testing"}'
```

---

## Troubleshooting

### Auto-Reload Not Working

**Check watch service:**
```bash
sudo systemctl status abrn-watch
sudo journalctl -u abrn-watch -n 50
```

**Common issues:**
- Watch service stopped: `sudo systemctl start abrn-watch`
- inotify-tools not installed: `sudo apt install inotify-tools`
- Script permissions: `chmod +x /lamp/www/ABRN-Drive/watch-and-reload.sh`

### Frontend Not Updating

1. **Build completed successfully?**
   ```bash
   cd vaultdrive_client
   ls -lh dist/assets/
   ```

2. **Backend restarted?**
   ```bash
   sudo systemctl status abrndrive
   # Check start time matches recent build
   ```

3. **Browser cache:**
   - Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
   - Clear browser cache
   - Open in incognito/private window

### Backend Build Errors

**Check Go version:**
```bash
go version  # Should be 1.24.4+
```

**Clear build cache:**
```bash
go clean -cache
make build
```

**Database connection issues:**
```bash
# Verify environment variables
echo $DB_URL
echo $JWT_SECRET

# Test database connection
psql "$DB_URL" -c "SELECT version();"
```

---

## Performance Optimization

### Frontend

- Use `React.memo` for expensive components
- Implement virtual scrolling for long file lists
- Lazy load routes with `React.lazy`
- Optimize images and assets

### Backend

- Use connection pooling (PostgreSQL)
- Add caching layer (Redis)
- Optimize SQL queries
- Index frequently queried columns

---

## Security Considerations

### Frontend

- Never store unencrypted passwords
- Use AES-256-GCM for file encryption
- Implement proper CORS policies
- Validate all user inputs

### Backend

- Use prepared statements (sqlc does this)
- Implement rate limiting
- Validate JWT tokens on every request
- Use HTTPS in production
- Sanitize all database inputs

---

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes
# ...

# Build and test
npm run build
# Auto-reload happens
# Test in browser

# Commit changes
git add .
git commit -m "Add: My feature description"

# Push to remote
git push origin feature/my-feature

# Create pull request on GitHub
```

---

## Additional Resources

- [React Documentation](https://react.dev/)
- [Go Documentation](https://go.dev/doc/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [sqlc Documentation](https://docs.sqlc.dev/)
- [Vite Documentation](https://vitejs.dev/)

---

**Last Updated:** February 3, 2026
**Maintainer:** ABRN Drive Team


---

## Appendix B — Feature Plan (merged)

This section is merged from `FEATURE-PLAN.md`. It is intentionally explicit (tables, endpoints, file paths).

# VaultDrive Feature Implementation Plan

## Overview
Two major features to implement:
1. Persistent test user "filemon" with hardcoded credentials
2. Group-based file sharing system

---

## Feature 1: Test User (filemon)

### Requirements
- **Username/Email**: filemon@abrn.mx
- **Password**: 986532
- **Purpose**: Always-available test user for suite testing

### Implementation

#### Approach 1: Database Migration (Recommended)
Create a new migration script to insert the test user directly into the database.

**File**: `/lamp/www/VaultDrive/sql/schema/002_test_user_migration.sql`

```sql
-- Create test filemon user
-- Password: 986532 (bcrypt hash will be pre-generated)

INSERT INTO users (
  id,
  username,
  email,
  first_name,
  last_name,
  password_hash,
  public_key,
  private_key_encrypted,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'filemon',
  'filemon@test.abrn',
  'Filemon',
  'Prime',
  '$2a$10$<BCRYPT_HASH_HERE>',  -- Will be generated below
  '<RSA_PUBLIC_KEY>',           -- Generated during initial setup
  '<RSA_PRIVATE_KEY_ENCRYPTED>', -- Generated during initial setup
  NOW(),
  NOW()
) ON CONFLICT (username) DO NOTHING;
```

#### Approach 2: One-time Setup Script
Run a Go script to generate the user with proper keys and hashing.

**File**: `/lamp/www/VaultDrive/cmd/createtestuser/main.go`

```go
package main

import (
    "fmt"
    "log"
    "database/sql"
    _ "github.com/lib/pq"
    "github.com/Pranay0205/VaultDrive/auth"
    "crypto/aes"
    "crypto/cipher"
    "crypto/rand"
    "crypto/rsa"
    "crypto/x509"
    "crypto/sha256"
    "encoding/pem"
    "io"
    "encoding/base64"
    "time"
)

func main() {
    // Connect to database
    conn, err := sql.Open("postgres", "postgres://postgres:postgres@localhost:5432/vaultdrive?sslmode=disable")
    if err != nil {
        log.Fatal(err)
    }
    defer conn.Close()

    // Test connection
    if err := conn.Ping(); err != nil {
        log.Fatal(err)
    }

    fmt.Println("Connected to database")

    // Generate password hash
    password := "986532"
    hashedPassword, err := auth.HashPassword(password)
    if err != nil {
        log.Fatal(err)
    }

    // Generate RSA keys
    privKey, pubKey, err := generateRSAKeys()
    if err != nil {
        log.Fatal(err)
    }

    // Encrypt private key with password
    encryptedPrivKey, err := encryptPrivateKey(privKey, password)
    if err != nil {
        log.Fatal(err)
    }

    // Insert user
    query := `INSERT INTO users (username, email, first_name, last_name, password_hash, public_key, private_key_encrypted, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`

    _, err = conn.Exec(query,
        "filemon",
        "filemon@test.abrn",
        "Filemon",
        "Prime",
        hashedPassword,
        pubKey,
        encryptedPrivKey,
        time.Now(),
        time.Now(),
    )

    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("Test user 'filemon' created successfully!")
    fmt.Println("Username: filemon")
    fmt.Println("Password: 986532")
}
```

### Deployment Steps

1. Compile and run test user creator:
```bash
cd /lamp/www/VaultDrive
go run cmd/createtestuser/main.go
```

2. Verify user exists:
```bash
PGPASSWORD=postgres psql -h localhost -U postgres -d vaultdrive -c "SELECT username, email FROM users WHERE username='filemon';"
```

3. Test login:
```bash
curl -X POST http://localhost:8081/login \
  -H "Content-Type: application/json" \
  -d '{"email":"filemon@abrn.mx","password":"986532"}' | jq .
```

#### Documentation Update
Add to `/lamp/www/VaultDrive/ABRN-BRANDING-UPGRADE.md`:

```markdown
## Test User Credentials

For testing purposes, always use:
- **Username/Email**: filemon@abrn.mx
- **Password**: 986532

This user is pre-created in the database and cannot be deleted.
```

---

## Feature 2: Group-Based File Sharing

### Requirements
- Create groups from existing users
- Share files with entire group (one-click)
- All group members can access shared files automatically
- Groups managed by their creator

### Data Model Design

#### New Tables Required

```sql
-- Groups table
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

-- Group members table
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member', -- 'member', 'admin', 'owner'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, user_id)
);

-- Group file shares table
CREATE TABLE group_file_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  wrapped_key TEXT NOT NULL, -- Group-level wrapped key
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),
  UNIQUE (group_id, file_id)
);

-- Indexes for performance
CREATE INDEX idx_groups_user ON groups(user_id);
CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_group_file_shares_group ON group_file_shares(group_id);
CREATE INDEX idx_group_file_shares_file ON group_file_shares(file_id);
```

### API Endpoints Required

#### Group Management
- `GET /groups` - List user's groups
- `POST /groups` - Create new group
- `GET /groups/{id}` - Get group details + members
- `PUT /groups/{id}` - Update group metadata
- `DELETE /groups/{id}` - Delete group

#### Group Members
- `POST /groups/{id}/members` - Add user to group
- `GET /groups/{id}/members` - List group members
- `DELETE /groups/{id}/members/{user_id}` - Remove user from group
- `PUT /groups/{id}/members/{user_id}/role` - Update member role

#### Group File Sharing
- `POST /groups/{id}/files/{file_id}/share` - Share file to group
- `GET /groups/{id}/files` - Get all files shared to group
- `DELETE /groups/{id}/files/{file_id}` - Unshare file from group

#### User View
- `GET /user/groups` - List groups user belongs to
- `GET /user/groups/{id}/files` - Get files shared via groups

### Frontend Components Required

#### Group Management UI
```
vaultdrive_client/src/pages/
├── groups.tsx              # Group list & management
└── group-detail.tsx        # Group detail view
```

**groups.tsx**:
- List all groups
- Create new group modal
- Manage group members
- One-click file sharing to group

**group-detail.tsx**:
- Group info edit
- Member list with roles
- Add/remove members
- File sharing management

#### Components
```
vaultdrive_client/src/components/
└── groups/
    ├── group-select.tsx          # Dropdown select for groups
    ├── group-member-list.tsx     # Display group members
    ├── group-badge.tsx           # Visual badge for group
    ├── file-share-modal.tsx      # Share file dialog
    └── create-group-modal.tsx    # Create new group modal
```

### User Flow

#### Creating a Group

1. User clicks "New Group" button
2. Modal opens: enter group name, description
3. Select users to add (from user list)
4. Save
5. Group created, members added

#### Sharing File to Group

**Flow 1**:
1. On file page, click "Share"
2. Select "Share with Group"
3. Choose group from dropdown
4. File shared to all group members

**Flow 2** (One-click):
1. On file page, right-click file
2. Context menu: "Share to [Group Name]"
3. Instantly shared to entire group

Automatically:
- `group_file_shares` record created
- Individual `file_shares` records added for each group member
- `file_access_keys` wrapped keys created (if needed)

#### Accessing Group Shared Files

1. Group member logs in
2. Navigates to "Shared with Me" page
3. Sees files shared via groups
4. Can decrypt and access files

### Implementation Plan

#### Phase 1: Database Schema

**1. Create migration**: `/lamp/www/VaultDrive/sql/schema/003_groups.sql`

```sql
-- Groups table
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

-- Group members
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_group_user UNIQUE (group_id, user_id)
);

-- Group file shares
CREATE TABLE IF NOT EXISTS group_file_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  wrapped_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),
  CONSTRAINT uq_group_file UNIQUE (group_id, file_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_groups_user ON groups(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_file_shares_group ON group_file_shares(group_id);
CREATE INDEX IF NOT EXISTS idx_group_file_shares_file ON group_file_shares(file_id);
```

**2. Run migration**:
```bash
cd /lamp/www/VaultDrive/sql/schema
PGPASSWORD=postgres psql -h localhost -U postgres -d vaultdrive -f 003_groups.sql
```

#### Phase 2: Backend API

**Create handlers**:
- `/lamp/www/VaultDrive/handle_groups.go` - Group CRUD
- `/lamp/www/VaultDrive/handle_group_members.go` - Member management
- `/lamp/www/VaultDrive/handle_group_shares.go` - File sharing

**SQL queries**: `/lamp/www/VaultDrive/sql/queries/groups.sql`

```sql
-- name: GetGroupsByUserID :many
SELECT * FROM groups WHERE user_id = $1 ORDER BY created_at DESC;

-- name: CreateGroup :one
INSERT INTO groups (user_id, name, description)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetGroupByID :one
SELECT * FROM groups WHERE id = $1;

-- name: GetGroupMembers :many
SELECT gm.*, u.username, u.email, u.first_name, u.last_name
FROM group_members gm
JOIN users u ON gm.user_id = u.id
WHERE gm.group_id = $1;

-- name: AddGroupMember :one
INSERT INTO group_members (group_id, user_id, role)
VALUES ($1, $2, $3)
RETURNING *;

-- name: ShareFileToGroup :one
INSERT INTO group_file_shares (group_id, file_id, wrapped_key, created_by)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetGroupFiles :many
SELECT f.*, gfs.created_at as shared_at
FROM group_file_shares gfs
JOIN files f ON gfs.file_id = f.id
WHERE gfs.group_id = $1;
```

**Route registration in main.go**:
```go
// Group routes
mux.HandleFunc("GET /groups", apiConfig.getGroupsHandler)
mux.HandleFunc("POST /groups", apiConfig.createGroupHandler)
mux.HandleFunc("GET /groups/{id}", apiConfig.getGroupHandler)
mux.DELETE("/groups/{id}", apiConfig.deleteGroupHandler)

// Group members
mux.HandleFunc("POST /groups/{id}/members", apiConfig.addGroupMemberHandler)
mux.HandleFunc("GET /groups/{id}/members", apiConfig.getGroupMembersHandler)
mux.DELETE("/groups/{id}/members/{userId}", apiConfig.removeGroupMemberHandler)

// Group file sharing
mux.HandleFunc("POST /groups/{id}/files/{fileId}/share", apiConfig.shareFileToGroupHandler)
mux.HandleFunc("GET /groups/{id}/files", apiConfig.getGroupFilesHandler)
```

#### Phase 3: Frontend UI

**Create components**:
```bash
mkdir -p vaultdrive_client/src/components/groups
mkdir -p vaultdrive_client/src/pages/groups
```

**Pages**:
- `vaultdrive_client/src/pages/groups.tsx` - Group list
- `vaultdrive_client/src/pages/group-detail.tsx` - Group details

**Components**:
- `vaultdrive_client/src/components/groups/group-select.tsx`
- `vaultdrive_client/src/components/groups/group-badge.tsx`
- `vaultdrive_client/src/components/groups/add-group-modal.tsx`

**Update App.tsx routes**:
```tsx
import Groups from "./pages/groups";
import GroupDetail from "./pages/group-detail";

// In Routes:
<Route path="/groups" element={<Groups />} />
<Route path="/groups/:id" element={<GroupDetail />} />
```

**Update sidebar.tsx**:
```tsx
import { Users, Folder } from "lucide-react";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: FolderOpen, label: "Files", path: "/files" },
  { icon: Users, label: "Groups", path: "/groups" },  // NEW
  { icon: FileText, label: "Notes", path: "/notes" },
  { icon: Link2, label: "Shared", path: "/shared" },
];
```

#### Phase 4: File Sharing Integration

**Update files page**:
- Add "Share to Group" dropdown to file actions
- Context menu for quick sharing to groups
- Group badge on files shared via groups

**Update shared page**:
- Show which files were shared via groups
- Display group badges

### Security Considerations

**Key Management**:
1. File owner generates file's AES key (existing)
2. When sharing to group:
   - Wrap file's AES key with GROUP's public key
   - Store in `group_file_shares.wrapped_key`
3. When group member downloads:
   - Fetch group's wrapped key
   - Member decrypts with their private key (existing flow)

**Access Control**:
- Only creator can delete group
- Members can be removed (access revoked)
- Group can be renamed by creator
- When group deleted: all group_file_shares cascade deleted

### Example Workflows

#### Scenario 1: Team Collaboration

1. Alice creates group "Marketing Team"
2. Adds Bob, Charlie to group
3. Alice uploads "campaign.pdf"
4. Alice shares to "Marketing Team" (one click)
5. Bob and Charlie can now access "campaign.pdf"

#### Scenario 2: Project Groups

1. Create group: "Project Alpha"
2. Add 5 team members
3. Upload 20 files
4. Share all 20 files to "Project Alpha" in one action
5. All members can access all files

### Database Queries Examples

```sql
-- Create group
INSERT INTO groups (user_id, name, description)
VALUES ('user-uuid', 'Team Alpha', 'Project team for Alpha');

-- Add member to group
INSERT INTO group_members (group_id, user_id, role)
VALUES ('group-uuid', 'member-uuid', 'admin');

-- Share file to all group members
-- This is done by the backend handler automatically
-- when POST /groups/{id}/files/{fileId}/share is called

-- Get all files user can access via groups
SELECT DISTINCT f.*
FROM group_file_shares gfs
JOIN files f ON gfs.file_id = f.id
JOIN group_members gm ON gfs.group_id = gm.group_id
WHERE gm.user_id = 'current-user-uuid';

-- Get groups for a user
SELECT g.*, gm.role
FROM groups g
JOIN group_members gm ON g.id = gm.group_id
WHERE gm.user_id = 'current-user-uuid';
```

### Testing Checklist

#### Test User
- [ ] Login with filemon@abrn.mx / 986532
- [ ] Verify bcrypt hash valid
- [ ] Can upload files
- [ ] Can create groups
- [ ] Can share files

#### Groups Feature
- [ ] Create group with name
- [ ] Add members to group
- [ ] Remove members from group
- [ ] Delete group
- [ ] Share file to group
- [ ] File visible to all group members
- [ ] Group members can decrypt files
- [ ] Remove member revokes file access
- [ ] Delete group removes all shares

#### UI/UX
- [ ] Group management page accessible
- [ ] File context menu shows groups
- [ ] One-click sharing works
- [ ] Group badges display correctly

### Implementation Timeline

| Phase | Tasks | Est. Time |
|-------|-------|-----------|
| 1 | Test user creation script & docs | 1-2 hours |
| 2 | Group database schema & migration | 2-3 hours |
| 3 | Group API handlers (3 files) | 4-6 hours |
| 4 | Group UI components (6 files) | 6-8 hours |
| 5 | File sharing integration | 2-3 hours |
| 6 | Testing & bug fixes | 3-4 hours |
| | **Total** | **18-26 hours** |

### Files to Modify/Create

**New Files**:
- `/lamp/www/VaultDrive/sql/schema/003_groups.sql`
- `/lamp/www/VaultDrive/handle_groups.go`
- `/lamp/www/VaultDrive/handle_group_members.go`
- `/lamp/www/VaultDrive/handle_group_shares.go`
- `/lamp/www/VaultDrive/sql/queries/groups.sql`
- `/lamp/www/VaultDrive/cmd/createtestuser/main.go`

**Modify Files**:
- `/lamp/www/VaultDrive/main.go` - Add group routes
- `/lamp/www/VaultDrive/vaultdrive_client/src/pages/files.tsx` - Add group sharing
- `/lamp/www/VaultDrive/vaultdrive_client/src/pages/shared.tsx` - Show group badges
- `/lamp/www/VaultDrive/vaultdrive_client/src/components/layout/sidebar.tsx` - Add Groups menu
- `/lamp/www/VaultDrive/vaultdrive_client/src/App.tsx` - Add group routes

**Create Frontend**:
- `/lamp/www/VaultDrive/vaultdrive_client/src/pages/groups.tsx`
- `/lamp/www/VaultDrive/vaultdrive_client/src/pages/group-detail.tsx`
- `/lamp/www/VaultDrive/vaultdrive_client/src/components/groups/*.tsx` (6 components)

---

## Summary

### Feature 1: Test User
- **Goal**: Always-available test user
- **Credentials**: filemon@abrn.mx / 986532
- **Implementation**: Database migration or setup script
- **Time**: 1-2 hours

### Feature 2: Group Sharing
- **Goal**: One-click file sharing to pre-defined user groups
- **Complexity**: Medium (requires schema, API, UI)
- **Est. Time**: 16-24 hours
- **Key Tables**: groups, group_members, group_file_shares
- **Key Endpoints**: 9 new API endpoints
- **Key UI**: Groups page, file sharing integration

### Ready to Implement?

This plan provides:
✅ Complete database schema
✅ SQL queries
✅ API endpoint specifications
✅ Frontend component structure
✅ User workflow flows
✅ Testing checklist
✅ Implementation timeline

Shall I proceed with implementation?


---

## Appendix C — TODO / Roadmap (merged)

This section is merged from `TODO.md`.

### Mobile UI/UX Overhaul

- [ ] **Responsive File List**: Refactor the file list component to be responsive, using a card-based grid or flexbox-based list to prevent overlapping elements on smaller screens.
- [ ] **Mobile-First Navigation**: Implement a responsive navigation bar that collapses into a hamburger menu on mobile devices.
- [ ] **Responsive Cards**: Ensure all card components are fully responsive to prevent text and component overlap within the cards themselves.
