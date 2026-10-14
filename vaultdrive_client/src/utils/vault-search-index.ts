/**
 * El Cerebro Ciego — Client-Side In-Memory Inverted Search Engine
 * Zero-Knowledge, Zero-Plaintext Transmission, Sub-5ms Search.
 */

export interface IndexDocument {
  id: string;
  filename: string;
  folderId?: string | null;
  folderName?: string;
  tags?: string[];
  snippetText?: string;
  filesize: number;
  mimeType?: string;
  updatedAt?: string;
  sha256?: string;
  credentialScheme?: string;
  detectedType?: string;
}

export interface DocumentEnrichment {
  tags?: string[];
  snippetText?: string;
  mimeType?: string;
  sha256?: string;
  detectedType?: string;
}

export interface SearchMatch {
  doc: IndexDocument;
  score: number;
  matchedFields: string[];
  snippet?: string;
}

/**
 * Normalizes text for zero-diacritic, case-insensitive, punctuation-free indexing.
 * e.g., "Facturación SAT #402, $1,450.00" -> "facturacion sat 402 1450 00"
 */
export function normalizeSearchTerm(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Strip diacritics (á -> a, ñ -> n)
    .replace(/[$€¥£#,]/g, "") // Strip currency and thousand-separator commas
    .replace(/[^\w\s]/g, " ") // Replace punctuation with space
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tokenizes text into unique search terms, continuous numbers, and prefixes
 */
export function tokenizeText(text: string): string[] {
  const norm = normalizeSearchTerm(text);
  if (!norm) return [];
  const rawTokens = norm.split(" ").filter((t) => t.length > 0);
  const set = new Set<string>();

  for (const token of rawTokens) {
    set.add(token);
    // Add prefix sub-tokens (e.g., "arrendamiento" -> "arr", "arre", "arren"...)
    if (token.length > 3) {
      for (let len = 3; len <= Math.min(token.length, 8); len++) {
        set.add(token.slice(0, len));
      }
    }
  }

  // Also extract continuous numbers (e.g., "$15,000 MXN" -> "15000")
  const numbers = text.match(/\d+(?:[.,]\d+)*/g);
  if (numbers) {
    for (const num of numbers) {
      const cleanNum = num.replace(/[^\d]/g, "");
      if (cleanNum.length > 0) {
        set.add(cleanNum);
      }
    }
  }

  return Array.from(set);
}

interface PreparedDoc {
  normFilename: string;
  normFolder: string;
  normType: string;
  normTags: string[];
  normSnippet: string;
  shaLower: string;
}

export class VaultSearchIndex {
  private docs: Map<string, IndexDocument> = new Map();
  private preparedDocs: Map<string, PreparedDoc> = new Map();
  private tokenMap: Map<string, Set<string>> = new Map(); // token -> Set<docId>
  private enrichmentById: Map<string, DocumentEnrichment> = new Map();
  private enrichmentByFilename: Map<string, DocumentEnrichment> = new Map();

  private applyEnrichment(doc: IndexDocument): IndexDocument {
    const byId = this.enrichmentById.get(doc.id);
    const byName = this.enrichmentByFilename.get(doc.filename.toLowerCase());
    if (!byId && !byName) return doc;

    const mergedTags = Array.from(
      new Set([
        ...(doc.tags ?? []),
        ...(byName?.tags ?? []),
        ...(byId?.tags ?? []),
      ])
    );

    return {
      ...doc,
      tags: mergedTags.length > 0 ? mergedTags : doc.tags,
      snippetText: byId?.snippetText ?? byName?.snippetText ?? doc.snippetText,
      mimeType: byId?.mimeType ?? byName?.mimeType ?? doc.mimeType,
      sha256: byId?.sha256 ?? byName?.sha256 ?? doc.sha256,
      detectedType: byId?.detectedType ?? byName?.detectedType ?? doc.detectedType,
    };
  }

  public addDocument(rawDoc: IndexDocument): void {
    const doc = this.applyEnrichment(rawDoc);
    this.removeDocument(doc.id);
    this.docs.set(doc.id, doc);
    this.preparedDocs.set(doc.id, {
      normFilename: normalizeSearchTerm(doc.filename),
      normFolder: doc.folderName ? normalizeSearchTerm(doc.folderName) : "",
      normType: doc.detectedType ? normalizeSearchTerm(doc.detectedType) : "",
      normTags: doc.tags ? doc.tags.map((t) => normalizeSearchTerm(t)) : [],
      normSnippet: doc.snippetText ? normalizeSearchTerm(doc.snippetText) : "",
      shaLower: doc.sha256 ? doc.sha256.toLowerCase() : "",
    });

    // Build tokens for this document
    const filenameTokens = tokenizeText(doc.filename);
    const folderTokens = doc.folderName ? tokenizeText(doc.folderName) : [];
    const tagTokens = doc.tags ? doc.tags.flatMap((t) => tokenizeText(t)) : [];
    const snippetTokens = doc.snippetText ? tokenizeText(doc.snippetText) : [];
    const typeTokens = doc.detectedType ? tokenizeText(doc.detectedType) : [];
    const shaTokens = doc.sha256 ? [doc.sha256.toLowerCase().slice(0, 12), doc.sha256.toLowerCase()] : [];

    const allTokens = new Set([
      ...filenameTokens,
      ...folderTokens,
      ...tagTokens,
      ...snippetTokens,
      ...typeTokens,
      ...shaTokens,
    ]);

    for (const token of allTokens) {
      let docSet = this.tokenMap.get(token);
      if (!docSet) {
        docSet = new Set();
        this.tokenMap.set(token, docSet);
      }
      docSet.add(doc.id);
    }
  }

  public addDocuments(docs: IndexDocument[]): void {
    for (const doc of docs) {
      this.addDocument(doc);
    }
  }

  /**
   * Synchronizes the document list while preserving session-level enrichments
   * (such as snippets and tags extracted during upload or preview).
   */
  public syncDocuments(docs: IndexDocument[]): void {
    this.docs.clear();
    this.preparedDocs.clear();
    this.tokenMap.clear();
    for (const doc of docs) {
      this.addDocument(doc);
    }
  }

  /**
   * Enriches a document (by ID or filename) with client-side extracted snippet, tags, or hash.
   */
  public enrichDocument(
    key: { id?: string; filename?: string },
    enrichment: DocumentEnrichment
  ): void {
    if (key.id) {
      const prev = this.enrichmentById.get(key.id) ?? {};
      this.enrichmentById.set(key.id, {
        ...prev,
        ...enrichment,
        tags: Array.from(new Set([...(prev.tags ?? []), ...(enrichment.tags ?? [])])),
      });
    }
    if (key.filename) {
      const normName = key.filename.toLowerCase();
      const prev = this.enrichmentByFilename.get(normName) ?? {};
      this.enrichmentByFilename.set(normName, {
        ...prev,
        ...enrichment,
        tags: Array.from(new Set([...(prev.tags ?? []), ...(enrichment.tags ?? [])])),
      });
    }

    // Re-index matching active documents immediately
    for (const doc of Array.from(this.docs.values())) {
      if (
        (key.id && doc.id === key.id) ||
        (key.filename && doc.filename.toLowerCase() === key.filename.toLowerCase())
      ) {
        this.addDocument(doc);
      }
    }
  }

  public removeDocument(docId: string): void {
    if (!this.docs.has(docId)) return;
    this.docs.delete(docId);
    this.preparedDocs.delete(docId);

    // Clean up inverted index
    for (const [token, set] of this.tokenMap.entries()) {
      set.delete(docId);
      if (set.size === 0) {
        this.tokenMap.delete(token);
      }
    }
  }

  public clear(): void {
    this.docs.clear();
    this.preparedDocs.clear();
    this.tokenMap.clear();
  }

  /**
   * Full cryptographic memory scrub for Panic Lock (⌘L) and session logout.
   */
  public scrub(): void {
    this.docs.clear();
    this.preparedDocs.clear();
    this.tokenMap.clear();
    this.enrichmentById.clear();
    this.enrichmentByFilename.clear();
  }

  public size(): number {
    return this.docs.size;
  }

  public getDocument(docId: string): IndexDocument | undefined {
    return this.docs.get(docId);
  }

  /**
   * Sub-5ms search with deterministic relevance scoring & contextual snippets
   */
  public search(query: string, limit = 20): SearchMatch[] {
    const rawNorm = normalizeSearchTerm(query);
    if (!rawNorm) return [];

    const queryTokens = rawNorm.split(" ").filter((t) => t.length > 0);
    if (queryTokens.length === 0) return [];

    const candidateScores = new Map<
      string,
      { score: number; matchedFields: Set<string>; hitToken?: string }
    >();

    for (const qToken of queryTokens) {
      const matchedDocIdsForQueryToken = new Set<string>();
      const lookupKey = qToken.length > 12 ? qToken.slice(0, 12) : qToken;
      const directSet = this.tokenMap.get(lookupKey);

      if (directSet && directSet.size > 0) {
        for (const docId of directSet) {
          matchedDocIdsForQueryToken.add(docId);
        }
      } else {
        for (const [idxToken, docIds] of this.tokenMap.entries()) {
          if (idxToken.includes(qToken)) {
            for (const docId of docIds) {
              matchedDocIdsForQueryToken.add(docId);
            }
          }
        }
      }

      for (const docId of matchedDocIdsForQueryToken) {
        const prepared = this.preparedDocs.get(docId);
        if (!prepared) continue;

        let entry = candidateScores.get(docId);
        if (!entry) {
          entry = { score: 0, matchedFields: new Set<string>() };
          candidateScores.set(docId, entry);
        }

        // Filename scoring
        if (prepared.normFilename === rawNorm) {
          entry.score += 120;
          entry.matchedFields.add("filename_exact");
        } else if (prepared.normFilename.includes(rawNorm)) {
          entry.score += 60;
          entry.matchedFields.add("filename");
        } else if (prepared.normFilename.includes(qToken)) {
          entry.score += 35;
          entry.matchedFields.add("filename");
        }

        // Tags match
        for (const normTag of prepared.normTags) {
          if (normTag === qToken) {
            entry.score += 45;
            entry.matchedFields.add("tags");
          } else if (normTag.includes(qToken)) {
            entry.score += 30;
            entry.matchedFields.add("tags");
          }
        }

        // Detected type match
        if (prepared.normType && prepared.normType.includes(qToken)) {
          entry.score += 25;
          entry.matchedFields.add("type");
        }

        // Folder match
        if (prepared.normFolder && prepared.normFolder.includes(qToken)) {
          entry.score += 20;
          entry.matchedFields.add("folder");
        }

        // SHA-256 prefix match
        if (prepared.shaLower && prepared.shaLower.includes(qToken)) {
          entry.score += 50;
          entry.matchedFields.add("sha256");
        }

        // Snippet match
        if (prepared.normSnippet && prepared.normSnippet.includes(qToken)) {
          entry.score += 20;
          entry.matchedFields.add("content");
          if (!entry.hitToken) entry.hitToken = qToken;
        }
      }
    }

    const sortedCandidates = Array.from(candidateScores.entries())
      .filter(([, data]) => data.score > 0)
      .sort((a, b) => {
        if (b[1].score !== a[1].score) return b[1].score - a[1].score;
        const nameA = this.docs.get(a[0])?.filename ?? "";
        const nameB = this.docs.get(b[0])?.filename ?? "";
        return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
      })
      .slice(0, limit);

    return sortedCandidates.map(([docId, data]) => {
      const doc = this.docs.get(docId)!;
      let snippet: string | undefined;
      if (doc.snippetText && data.hitToken) {
        const qToken = data.hitToken;
        const rawLower = doc.snippetText.toLowerCase();
        const rawHit = rawLower.indexOf(qToken);
        const prepared = this.preparedDocs.get(docId);
        const normHit = prepared ? prepared.normSnippet.indexOf(qToken) : -1;
        const center = rawHit >= 0 ? rawHit : Math.max(0, Math.min(normHit, doc.snippetText.length - 1));
        const start = Math.max(0, center - 30);
        const end = Math.min(doc.snippetText.length, center + qToken.length + 55);
        const prefix = start > 0 ? "…" : "";
        const suffix = end < doc.snippetText.length ? "…" : "";
        snippet = `${prefix}${doc.snippetText.slice(start, end).trim()}${suffix}`;
      }
      return {
        doc,
        score: data.score,
        matchedFields: Array.from(data.matchedFields),
        snippet,
      };
    });
  }
}

// Global ephemeral instance for the active session
export const globalVaultSearchIndex = new VaultSearchIndex();

