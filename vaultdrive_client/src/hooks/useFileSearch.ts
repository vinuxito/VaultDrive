import useSWR from "swr";
import { useMemo } from "react";
import { API_URL } from "../utils/api";

export interface SearchableFile {
  id: string;
  filename: string;
  folder_id: string | null;
  folder_name?: string;
  size: number;
  created_at: string;
}

export function useFileSearch(query: string): SearchableFile[] {
  // Use SWR cache for My Files. Key must match the exact key used in pages/files.tsx
  const { data } = useSWR<SearchableFile[]>(`${API_URL}/files`, {
    revalidateOnFocus: false,
    revalidateOnMount: false,
    revalidateIfStale: false,
  });

  return useMemo(() => {
    if (!data || !query.trim()) return [];
    const q = query.toLowerCase();
    return data
      .filter((f) => f.filename.toLowerCase().includes(q))
      .slice(0, 8); // Limit to top 8 search results
  }, [data, query]);
}
