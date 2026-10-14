import useSWR from "swr";
import { useMemo } from "react";
import { API_URL } from "../utils/api";
import { globalVaultSearchIndex } from "../utils/vault-search-index";

export interface SearchableFile {
  id: string;
  filename: string;
  folder_id: string | null;
  folder_name?: string;
  size: number;
  created_at: string;
  snippet?: string;
}

export function useFileSearch(query: string): SearchableFile[] {
  // Use SWR cache for My Files. Key must match the exact key used in pages/files.tsx
  const { data } = useSWR<SearchableFile[]>(`${API_URL}/files`, {
    revalidateOnFocus: false,
    revalidateOnMount: false,
    revalidateIfStale: false,
  });

  return useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const resultsMap = new Map<string, SearchableFile>();

    // 1. Check Zero-Knowledge RAM Index (includes content snippets, RFCs, amounts, tags)
    const indexMatches = globalVaultSearchIndex.search(trimmed, 8);
    for (const match of indexMatches) {
      resultsMap.set(match.doc.id, {
        id: match.doc.id,
        filename: match.doc.filename,
        folder_id: match.doc.folderId ?? null,
        folder_name: match.doc.folderName,
        size: match.doc.filesize,
        created_at: match.doc.updatedAt ?? "",
        snippet: match.snippet,
      });
    }

    // 2. Fallback / supplement with SWR cache
    if (data) {
      const q = trimmed.toLowerCase();
      for (const f of data) {
        if (!resultsMap.has(f.id) && f.filename.toLowerCase().includes(q)) {
          resultsMap.set(f.id, f);
        }
      }
    }

    return Array.from(resultsMap.values()).slice(0, 8);
  }, [data, query]);
}

