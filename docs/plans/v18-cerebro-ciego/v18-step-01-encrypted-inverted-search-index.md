# v18 Step 01: Client-Side Inverted Search Index
> **Encrypted In-Memory Token Indexer for Zero-Knowledge Vault Search**

---

## 1. Objective
Build an ultra-light, zero-dependency client-side search index engine in [`vaultdrive_client/src/utils/vault-search-index.ts`](file:///lamp/www/ABRN-Drive/vaultdrive_client/src/utils/vault-search-index.ts) that allows instantaneous full-text and metadata search (<5ms) across vault files without leaking plaintext or search queries to the server.

---

## 2. Technical Architecture & Data Model

### Index Structure
```typescript
export interface IndexDocument {
  id: string;
  filename: string;
  folderId?: string | null;
  folderName?: string;
  tags?: string[];
  snippetText?: string;
  filesize: number;
  mimeType: string;
  updatedAt: string;
  sha256?: string;
  credentialScheme?: string;
}

export interface SearchMatch {
  doc: IndexDocument;
  score: number;
  matchedFields: string[];
  snippet?: string;
}
```

### Capabilities
1. **Tokenization & Normalization:** Lowercasing, diacritic removal (folding á->a, é->e, etc.), punctuation stripping, and n-gram substring indexing for partial matches (e.g. searching "arre" matches "arrendamiento").
2. **Field Weighting:** Exact filename match > Tag match > Folder match > Text snippet match.
3. **Inverted Token Map:** `Map<token, Set<docId>>` for sub-millisecond lookups.
4. **Memory Scrubbing:** Ephemeral in-memory instance cleared on panic lock (`⌘L`) or session expiry.

---

## 3. Implementation Target
- Create `vaultdrive_client/src/utils/vault-search-index.ts`
- Create unit test: `vaultdrive_client/src/utils/vault-search-index.test.ts`
  - Verify tokenization & diacritic insensitivity.
  - Verify sub-5ms query resolution for 500+ documents.
  - Verify zero-result handling and ranking relevance.

---

## 4. Verification Gate
- Targeted Vitest: `npx vitest run src/utils/vault-search-index.test.ts`
- `npm run typecheck` clean.
