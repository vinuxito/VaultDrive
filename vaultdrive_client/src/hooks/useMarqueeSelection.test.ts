import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMarqueeSelection } from "./useMarqueeSelection";

describe("useMarqueeSelection", () => {
  it("initializes without active selection rectangle", () => {
    const containerRef = { current: document.createElement("div") };
    const onSelectionChange = vi.fn();

    const { result } = renderHook(() =>
      useMarqueeSelection({
        containerRef,
        selectedIds: new Set(),
        onSelectionChange,
      })
    );

    expect(result.current.lassoRect).toBeNull();
  });

  it("ignores mouse down when clicking interactive elements", () => {
    const container = document.createElement("div");
    const button = document.createElement("button");
    container.appendChild(button);
    const containerRef = { current: container };
    const onSelectionChange = vi.fn();

    const { result } = renderHook(() =>
      useMarqueeSelection({
        containerRef,
        selectedIds: new Set(),
        onSelectionChange,
      })
    );

    act(() => {
      result.current.handleMouseDown({
        button: 0,
        clientX: 10,
        clientY: 10,
        target: button,
      } as unknown as React.MouseEvent);
    });

    expect(result.current.lassoRect).toBeNull();
  });

  it("tracks mouse movement, updates lassoRect, and cleans up on mouseup", () => {
    const container = document.createElement("div");
    const containerRef = { current: container };
    const onSelectionChange = vi.fn();

    const { result } = renderHook(() =>
      useMarqueeSelection({
        containerRef,
        selectedIds: new Set(),
        onSelectionChange,
      })
    );

    act(() => {
      result.current.handleMouseDown({
        button: 0,
        clientX: 10,
        clientY: 10,
        target: container,
      } as unknown as React.MouseEvent);
    });

    act(() => {
      window.dispatchEvent(
        new MouseEvent("mousemove", {
          clientX: 60,
          clientY: 70,
        })
      );
    });

    expect(result.current.lassoRect).not.toBeNull();
    expect(result.current.lassoRect?.width).toBe(50);
    expect(result.current.lassoRect?.height).toBe(60);
    expect(result.current.lassoRect?.isSelecting).toBe(true);

    act(() => {
      window.dispatchEvent(new MouseEvent("mouseup"));
    });

    expect(result.current.lassoRect).toBeNull();
  });
});
