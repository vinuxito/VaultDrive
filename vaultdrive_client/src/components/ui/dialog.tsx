import React from 'react';
import { useTheme } from '../theme-provider';
import { cn } from '../../lib/utils';

export const Dialog: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }> = ({ open, onOpenChange, children }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => onOpenChange(false)}>
      <div
        className={cn(
          "rounded-lg shadow-lg p-6 w-full max-w-md border",
          isDark
            ? "bg-gradient-to-br from-primary to-primary/90 border-white/10 text-white"
            : "bg-card border-border text-foreground"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

export const DialogContent: React.FC<{ children: React.ReactNode }> = ({ children }) => <div>{children}</div>;
export const DialogHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="mb-4">{children}</div>;
export const DialogTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => <h2 className="text-lg font-semibold">{children}</h2>;
export const DialogDescription: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return <p className={cn("text-sm", isDark ? "text-white/70" : "text-muted-foreground")}>{children}</p>;
};
export const DialogFooter: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="mt-4 flex justify-end">{children}</div>;
