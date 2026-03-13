import { forwardRef, type ReactNode } from "react";
import { cn } from "../../lib/utils";

interface ElegantInputProps extends Omit<React.ComponentProps<"input">, "ref"> {
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  breathe?: boolean;
}

export const ElegantInput = forwardRef<HTMLInputElement, ElegantInputProps>(
  ({ className, type = "text", startIcon, endIcon, breathe = true, ...props }, ref) => {
    const breatheClass = breathe ? "" : "";

    return (
      <div className="relative">
        {startIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {startIcon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            "elegant-input",
            "w-full",
            startIcon && "pl-10",
            endIcon && "pr-10",
            breatheClass && "transition-all",
            className
          )}
          ref={ref}
          {...props}
        />
        {endIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {endIcon}
          </div>
        )}
      </div>
    );
  }
);

ElegantInput.displayName = "ElegantInput";