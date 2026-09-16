import React, { createContext, useContext, useId, useRef } from 'react';
import { useDialogFocus } from '../../hooks/useDialogFocus';

const DialogTitleContext = createContext<string | null>(null);

export const Dialog: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }> = ({ open, onOpenChange, children }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogFocus({ open, onClose: () => onOpenChange(false), containerRef: dialogRef });
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => onOpenChange(false)}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="rounded-lg shadow-lg p-6 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto border bg-card border-border text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogTitleContext.Provider value={titleId}>{children}</DialogTitleContext.Provider>
      </div>
    </div>
  );
};

export const DialogContent: React.FC<{ children: React.ReactNode }> = ({ children }) => <div>{children}</div>;
export const DialogHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="mb-4">{children}</div>;
export const DialogTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const titleId = useContext(DialogTitleContext);
  return <h2 id={titleId ?? undefined} className="text-lg font-semibold">{children}</h2>;
};
export const DialogDescription: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <p className="text-sm text-muted-foreground">{children}</p>;
};
export const DialogFooter: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="mt-4 flex justify-end">{children}</div>;
