import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  showCloseButton?: boolean;
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  showCloseButton = true,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const startY = useRef<number | null>(null);
  const currentY = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    currentY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    if (startY.current !== null && currentY.current !== null) {
      const deltaY = currentY.current - startY.current;
      const isScrolledToTop = sheetRef.current ? sheetRef.current.scrollTop <= 0 : true;
      if (deltaY > 80 && isScrolledToTop) {
        onClose();
      }
    }
    startY.current = null;
    currentY.current = null;
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-200"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-border bg-card text-card-foreground shadow-2xl p-5 pb-8 sm:pb-6 animate-in slide-in-from-bottom-5 duration-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag pill handle for touch UX */}
        <div className="sm:hidden flex justify-center pb-2 cursor-grab">
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            {title && (
              <h3 className="text-lg font-semibold tracking-tight text-foreground truncate">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {description}
              </p>
            )}
          </div>
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="h-10 w-10 sm:h-8 sm:w-8 -mr-1 -mt-1 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="space-y-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
