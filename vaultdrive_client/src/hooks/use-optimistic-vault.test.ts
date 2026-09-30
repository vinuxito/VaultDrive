import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useOptimisticVault, type OptimisticFile } from "./use-optimistic-vault";

describe("useOptimisticVault hook", () => {
  const mockFiles: OptimisticFile[] = [
    { id: "file-1", filename: "doc1.pdf" },
    { id: "file-2", filename: "doc2.png" },
  ];

  it("updates filename optimistically in frame 0", () => {
    const { result } = renderHook(() => useOptimisticVault(mockFiles));

    act(() => {
      result.current.optimisticRename("file-1", "doc1_renamed.pdf");
    });

    expect(result.current.files.find((f) => f.id === "file-1")?.filename).toBe(
      "doc1_renamed.pdf"
    );
    expect(result.current.hasPendingRollback).toBe(true);
  });

  it("removes file optimistically on delete", () => {
    const { result } = renderHook(() => useOptimisticVault(mockFiles));

    act(() => {
      result.current.optimisticDelete("file-1");
    });

    expect(result.current.files.length).toBe(1);
    expect(result.current.files.find((f) => f.id === "file-1")).toBeUndefined();
    expect(result.current.hasPendingRollback).toBe(true);
  });

  it("rolls back deletion cleanly when network fails", () => {
    const { result } = renderHook(() => useOptimisticVault(mockFiles));

    act(() => {
      result.current.optimisticDelete("file-1");
    });
    expect(result.current.files.length).toBe(1);

    act(() => {
      result.current.rollback("file-1");
    });

    expect(result.current.files.length).toBe(2);
    expect(result.current.files.find((f) => f.id === "file-1")?.filename).toBe("doc1.pdf");
    expect(result.current.hasPendingRollback).toBe(false);
  });

  it("rolls back rename cleanly on failure", () => {
    const { result } = renderHook(() => useOptimisticVault(mockFiles));

    act(() => {
      result.current.optimisticRename("file-2", "new_doc2.png");
    });
    expect(result.current.files.find((f) => f.id === "file-2")?.filename).toBe("new_doc2.png");

    act(() => {
      result.current.rollback("file-2");
    });

    expect(result.current.files.find((f) => f.id === "file-2")?.filename).toBe("doc2.png");
    expect(result.current.hasPendingRollback).toBe(false);
  });
});
