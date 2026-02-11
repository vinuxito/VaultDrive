# Roadmap – capabilities & UI ideas for Drive (derived from the current README)

---

## Short‑term roadmap (features to implement first)

1️⃣ **File version history view** – adds a core capability for users.
   - Add an endpoint `GET /files/:id/versions` that returns the list of versions (already stored in the DB).
   - In the UI, add a “Versions” tab on the file‑card that shows a timeline with timestamps, size, and a “Restore” button.

2️⃣ **Favorites / starred items** – quick access for power users.
   - Add a `starred` boolean column to the `files` table (or a separate `favorites` table).
   - In the UI, add a star icon on file‑cards and folder rows; a “Starred” view can be added to the sidebar.

3️⃣ **Bulk actions** – improves ergonomics for large folders.
   - Add checkboxes to file‑cards and folder rows.
   - Add a bulk‑action toolbar (Delete, Move, Share, Add tag).
   - Backend already supports bulk delete via `DELETE /files?ids=…` – reuse that for Delete.

4️⃣ **Dark mode** – aligns with OS preferences and modern UI expectations.
   - Add a CSS toggle in the UI that switches a `data-theme="dark"` attribute.
   - Store the preference in `localStorage`.

5️⃣ **Responsive sidebar & grid view** – enhances usability on tablets and small screens.
   - Make the folder tree collapsible on narrow screens, with a hamburger button to toggle it.
   - Add a toggle between list view and grid view (cards displayed in rows) in the toolbar.
   - In grid view, use CSS grid with `auto-fit` and `minmax(200px, 1fr)` to adjust the number of columns based on viewport width.

---

## Longer‑term ideas (optional)

* File‑level permissions – share a single file with external users.
* Activity feed – show recent actions (uploads, shares, deletions) in a sidebar or top bar.
* Export / import – enable migration to another instance or backup.
* Webhooks – allow external systems (e.g., CI, analytics) to react to changes.
* File‑level comments – discussion on a specific file (useful for reviews).
* Search by content – full‑text search inside PDFs or markdown files.

---

## UI flow diagram (high‑level)

```mermaid
flowchart TD
    A[Sidebar (folder tree)] -->|click| B[File list (list or grid view)]
    B -->|select| C[Details pane (metadata, version list, preview)]
    C -->|share| D[Share modal]
    B -->|search| E[Search input (command palette)]
    A -->|toggle dark mode| F[Dark mode CSS]
    B -->|star| G[Starred icon (animated)]
    B -->|filter tags| H[Tag filter dropdown]
    B -->|bulk actions| I[Bulk‑action toolbar]
    B -->|drag‑and‑drop| J[Move files/folders]
```

---

## Prioritised roadmap (short‑term) – specific instructions

1️⃣ **File version history view**
   - Add a new handler `GET /files/:id/versions` that queries the `file_versions` table for the given file and returns an array of `{id, created_at, size}`.
   - In the UI (`src/components/files/file-card.tsx`), add a “Versions” tab next to the existing tabs. Render the timeline using a simple list; each entry shows the timestamp (formatted with `formatDate`) and size (formatted with `formatSize`).
   - Add a “Restore” button that calls `POST /files/:id/restore` (new endpoint) with the selected version ID. The server creates a new `file_versions` row and updates the current file record.

2️⃣ **Favorites / starred items**
   - Add a `starred` boolean column to the `files` table (migration script `ALTER TABLE files ADD COLUMN starred BOOLEAN NOT NULL DEFAULT FALSE`).
   - Update the `GET /files` response to include `starred` for each file.
   - In the UI (`src/components/files/file-card.tsx`), add a star icon button that toggles the `starred` flag via `PATCH /files/:id`.
   - Add a “Starred” view in the sidebar that filters files where `starred = true`.

3️⃣ **Bulk actions**
   - Add a checkbox component to each file‑card and folder row (`src/components/files/file-card.tsx`).
   - Add a bulk‑action toolbar (`src/components/files/bulk-toolbar.tsx`) with buttons for Delete, Move, Share, Add tag.
   - Implement Delete by calling `DELETE /files?ids=…` with the selected IDs.
   - Implement Move by calling `PATCH /files/:id` for each selected file with the new `parent_id`.
   - Implement Share by opening the existing share modal for each selected file.

4️⃣ **Dark mode**
   - Add a toggle switch in the settings page (`src/pages/settings.tsx`).
   - When toggled, set `document.documentElement.dataset.theme = "dark"` (or "light").
   - Persist the choice in `localStorage` (`window.localStorage.setItem("theme", theme)`).
   - Add dark‑mode CSS variables in `src/styles/glass.css` (e.g., `--background: #1e1e1e`).

5️⃣ **Responsive sidebar & grid view**
   - Make the folder tree collapsible on narrow screens: add a hamburger button in the sidebar header that toggles a `collapsed` class on the sidebar element.
   - Add a view‑mode toggle (list / grid) in the toolbar (`src/components/layout/command-palette.tsx`).
   - In grid view, set `display: grid` on the file list container with `grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))`.
   - Adjust the file‑card CSS to fit the grid layout (e.g., remove the left border, add a margin).

---

## Longer‑term ideas (optional)

* **File‑level permissions** – extend the `file_shares` table with a `file_id` column and add UI share modal for files.
* **Activity feed** – add an endpoint `GET /activity?since=…` that aggregates events from `file_versions`, `file_shares`, etc., and render a list in the sidebar.
* **Export / import** – add a “Export” button in the settings page that triggers a server‑side dump of the DB (e.g., `pg_dump`) and a zip of the `public/` assets; add an “Import” endpoint that accepts such a zip and restores the DB.
* **Webhooks** – add a `webhooks` table with `url`, `secret`, `events`; on relevant events, POST a JSON payload to each URL.
* **File‑level comments** – add a `comments` table linked to `files`; UI adds a comment icon on file‑cards that opens a thread view.
* **Search by content** – add a `tsvector` column on `files` (or a separate `search` table) that indexes the text of PDFs and markdown files; update the search endpoint to use `to_tsquery`.
