import { useState, useRef, useCallback, useEffect } from "react";

export interface LassoRect {
  left: number;
  top: number;
  width: number;
  height: number;
  isSelecting: boolean;
}

interface UseMarqueeSelectionOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  selectedIds: Set<string>;
  onSelectionChange: (newSelectedIds: Set<string>) => void;
  enabled?: boolean;
}

export function useMarqueeSelection({
  containerRef,
  selectedIds,
  onSelectionChange,
  enabled = true,
}: UseMarqueeSelectionOptions) {
  const [lassoRect, setLassoRect] = useState<LassoRect | null>(null);
  const isTrackingRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cachedItemsRef = useRef<Array<{ id: string; rect: DOMRect }>>([]);
  const initialSelectedRef = useRef<Set<string>>(new Set());
  const modifierRef = useRef<{ shift: boolean; alt: boolean }>({ shift: false, alt: false });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled || e.button !== 0) return; // Only left click

      const target = e.target as HTMLElement;
      // Do not initiate lasso if clicking on an interactive control or inside an active modal/menu
      if (
        target.closest(
          "button, a, input, textarea, select, [role='menu'], [role='menuitem'], [data-prevent-marquee='true'], .lucide"
        )
      ) {
        return;
      }

      // Check if clicking inside the container
      if (containerRef.current && !containerRef.current.contains(target)) {
        return;
      }

      isTrackingRef.current = true;
      startPosRef.current = { x: e.clientX, y: e.clientY };
      initialSelectedRef.current = new Set(selectedIds);
      modifierRef.current = { shift: e.shiftKey, alt: e.altKey };

      // Cache bounding rects of all visible rows/cards to avoid reflow thrashing during drag
      if (containerRef.current) {
        const elements = containerRef.current.querySelectorAll<HTMLElement>(
          "[data-file-row-id], [data-file-id]"
        );
        cachedItemsRef.current = Array.from(elements).map((el) => ({
          id: (el.getAttribute("data-file-row-id") || el.getAttribute("data-file-id"))!,
          rect: el.getBoundingClientRect(),
        }));
      }
    },
    [enabled, containerRef, selectedIds]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isTrackingRef.current) return;

      const deltaX = e.clientX - startPosRef.current.x;
      const deltaY = e.clientY - startPosRef.current.y;

      // Require a minimum 4px drag threshold before starting visual lasso
      if (!lassoRect && Math.hypot(deltaX, deltaY) < 5) return;

      const left = Math.min(startPosRef.current.x, e.clientX);
      const top = Math.min(startPosRef.current.y, e.clientY);
      const right = Math.max(startPosRef.current.x, e.clientX);
      const bottom = Math.max(startPosRef.current.y, e.clientY);
      const width = right - left;
      const height = bottom - top;

      setLassoRect({ left, top, width, height, isSelecting: true });

      // Calculate 2D AABB intersection
      const intersectedIds = new Set<string>();
      cachedItemsRef.current.forEach(({ id, rect }) => {
        const intersects = !(
          rect.left > right ||
          rect.right < left ||
          rect.top > bottom ||
          rect.bottom < top
        );
        if (intersects) {
          intersectedIds.add(id);
        }
      });

      // Apply modifiers
      if (modifierRef.current.shift) {
        const combined = new Set(initialSelectedRef.current);
        intersectedIds.forEach((id) => combined.add(id));
        onSelectionChange(combined);
      } else if (modifierRef.current.alt) {
        const subtracted = new Set(initialSelectedRef.current);
        intersectedIds.forEach((id) => subtracted.delete(id));
        onSelectionChange(subtracted);
      } else {
        onSelectionChange(intersectedIds);
      }
    };

    const handleMouseUp = () => {
      if (isTrackingRef.current) {
        isTrackingRef.current = false;
        setLassoRect(null);
        cachedItemsRef.current = [];
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [lassoRect, onSelectionChange]);

  return {
    lassoRect,
    handleMouseDown,
  };
}
