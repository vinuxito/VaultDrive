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
});
