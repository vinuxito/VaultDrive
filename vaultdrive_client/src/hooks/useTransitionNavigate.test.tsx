import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTransitionNavigate } from "./useTransitionNavigate";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

describe("useTransitionNavigate hook", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Reflect.deleteProperty(document, "startViewTransition");
  });

  it("should fall back to normal navigate if startViewTransition is not supported", () => {
    const { result } = renderHook(() => useTransitionNavigate());
    
    result.current("/test-path", { replace: true });
    
    expect(mockNavigate).toHaveBeenCalledWith("/test-path", { replace: true });
  });

  it("should wrap navigate inside startViewTransition if supported", () => {
    const mockStartViewTransition = vi.fn((cb: () => void) => {
      cb();
      return { ready: Promise.resolve() };
    });
    
    Object.defineProperty(document, "startViewTransition", { value: mockStartViewTransition, configurable: true });

    const { result } = renderHook(() => useTransitionNavigate());
    
    result.current("/transition-path");

    expect(mockStartViewTransition).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/transition-path", undefined);
  });
});
