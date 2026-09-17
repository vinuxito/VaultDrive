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

      let currentX = e.clientX;
      let currentY = e.clientY;

      if (containerRef.current) {
        const bounds = containerRef.current.getBoundingClientRect();
        if (bounds.width > 0 && bounds.height > 0) {
          currentX = Math.max(bounds.left, Math.min(bounds.right, currentX));
          currentY = Math.max(bounds.top, Math.min(bounds.bottom, currentY));
        }
      }

      const deltaX = currentX - startPosRef.current.x;
      const deltaY = currentY - startPosRef.current.y;

      // Require a minimum 4px drag threshold before starting visual lasso
      if (!lassoRect && Math.hypot(deltaX, deltaY) < 5) return;

      // Prevent text selection while actively lassoing
      if (document.body.style.userSelect !== "none") {
        document.body.style.userSelect = "none";
      }

      const left = Math.min(startPosRef.current.x, currentX);
      const top = Math.min(startPosRef.current.y, currentY);
      const right = Math.max(startPosRef.current.x, currentX);
      const bottom = Math.max(startPosRef.current.y, currentY);
      const width = Math.max(0, right - left);
      const height = Math.max(0, bottom - top);

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

      // Apply dynamic modifiers directly from live mouse event
      const isShift = e.shiftKey;
      const isAlt = e.altKey;

      if (isShift) {
        const combined = new Set(initialSelectedRef.current);
        intersectedIds.forEach((id) => combined.add(id));
        onSelectionChange(combined);
      } else if (isAlt) {
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
        document.body.style.userSelect = "";
      }
    };

    const handleBlur = () => {
      if (isTrackingRef.current) {
        isTrackingRef.current = false;
        setLassoRect(null);
        cachedItemsRef.current = [];
        document.body.style.userSelect = "";
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("blur", handleBlur);
      document.body.style.userSelect = "";
    };
  }, [containerRef, lassoRect, onSelectionChange]);

  return {
    lassoRect,
    handleMouseDown,
  };
}
