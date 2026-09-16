import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const activeDialogs: symbol[] = [];

interface UseDialogFocusOptions {
  open: boolean;
  onClose: () => void;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  return Array.from(container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])
    .filter((element) => !element.closest('[aria-hidden="true"], [inert]'));
}

export function useDialogFocus({
  open,
  onClose,
  containerRef,
  initialFocusRef,
}: UseDialogFocusOptions) {
  const openerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const dialogToken = Symbol("dialog");
    activeDialogs.push(dialogToken);
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const container = containerRef.current;
    const initialTarget = initialFocusRef?.current ?? getFocusableElements(container)[0] ?? container;
    initialTarget?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (activeDialogs.at(-1) !== dialogToken) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(containerRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        containerRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === containerRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const wasTopmost = activeDialogs.at(-1) === dialogToken;
      const stackIndex = activeDialogs.lastIndexOf(dialogToken);
      if (stackIndex >= 0) activeDialogs.splice(stackIndex, 1);
      if (wasTopmost) openerRef.current?.focus();
      openerRef.current = null;
    };
  }, [containerRef, initialFocusRef, open]);
}
