import { useState, useCallback } from "react";

export interface OptimisticFile {
  id: string;
  filename: string;
  [key: string]: unknown;
}

interface RollbackEntry<T extends OptimisticFile> {
  fileId: string;
  previousState: T;
  action: "rename" | "delete" | "update";
}

export function useOptimisticVault<T extends OptimisticFile>(initialFiles: T[]) {
  const [files, setFiles] = useState<T[]>(initialFiles);
  const [rollbackLedger, setRollbackLedger] = useState<RollbackEntry<T>[]>([]);

  // Sync with upstream files when they update from server
  const syncFiles = useCallback((serverFiles: T[]) => {
    setFiles(serverFiles);
  }, []);

  const optimisticRename = useCallback((fileId: string, newFilename: string) => {
    setFiles((current) => {
      const target = current.find((f) => f.id === fileId);
      if (!target) return current;

      setRollbackLedger((prev) => [
        ...prev,
        { fileId, previousState: { ...target }, action: "rename" },
      ]);

      return current.map((f) =>
        f.id === fileId ? { ...f, filename: newFilename } : f
      );
    });
  }, []);

  const optimisticDelete = useCallback((fileId: string) => {
    setFiles((current) => {
      const target = current.find((f) => f.id === fileId);
      if (!target) return current;

      setRollbackLedger((prev) => [
        ...prev,
        { fileId, previousState: { ...target }, action: "delete" },
      ]);

      return current.filter((f) => f.id !== fileId);
    });
  }, []);

  const rollback = useCallback((fileId: string) => {
    setRollbackLedger((prev) => {
      const entry = prev.find((e) => e.fileId === fileId);
      if (!entry) return prev;

      setFiles((current) => {
        if (entry.action === "delete") {
          return [...current, entry.previousState];
        }
        return current.map((f) =>
          f.id === fileId ? entry.previousState : f
        );
      });

      return prev.filter((e) => e.fileId !== fileId);
    });
  }, []);

  const commit = useCallback((fileId: string) => {
    setRollbackLedger((prev) => prev.filter((e) => e.fileId !== fileId));
  }, []);

  return {
    files,
    setFiles,
    syncFiles,
    optimisticRename,
    optimisticDelete,
    rollback,
    commit,
    hasPendingRollback: rollbackLedger.length > 0,
  };
}
