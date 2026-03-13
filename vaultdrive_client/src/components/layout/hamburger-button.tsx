import { Menu, X } from "lucide-react";
import { cn } from "../../lib/utils";

interface HamburgerButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export function HamburgerButton({ isOpen, onClick }: HamburgerButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "p-2 rounded-lg glass transition-all duration-300",
        "hover:bg-[#7d4f50]/10 active:scale-95",
        "min-w-[44px] min-h-[44px] flex items-center justify-center"
      )}
      aria-label={isOpen ? "Close menu" : "Open menu"}
      aria-expanded={isOpen}
    >
      {isOpen ? (
        <X className="w-6 h-6 animate-fade-in" />
      ) : (
        <Menu className="w-6 h-6 animate-fade-in" />
      )}
    </button>
  );
}