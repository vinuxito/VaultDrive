import { useState, useEffect } from "react";
import { Search, File, Folder, User, Settings } from "lucide-react";
import { cn } from "../../lib/utils";
import { useNavigate } from "react-router-dom";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  // Effect to listen for Cmd+K
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (isOpen) {
          onClose();
        } else {
            // Need to open it, but this component doesn't control that
            // This will be handled in the parent component
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);


  const commands = [
    { group: "Navigation", items: [
      { icon: <File className="w-4 h-4" />, name: "Files", action: () => navigate("/files") },
      { icon: <Folder className="w-4 h-4" />, name: "Shared Files", action: () => navigate("/shared") },
      { icon: <User className="w-4 h-4" />, name: "Profile", action: () => navigate("/profile") },
      { icon: <Settings className="w-4 h-4" />, name: "Settings", action: () => navigate("/settings") },
    ]},
    // { group: "Actions", items: [
    //   { icon: <Upload className="w-4 h-4" />, name: "Upload File", action: () => {} },
    //   { icon: <Share2 className="w-4 h-4" />, name: "Share File", action: () => {} },
    // ]},
  ];

  const filteredCommands = query
    ? commands.map(group => ({
        ...group,
        items: group.items.filter(item => item.name.toLowerCase().includes(query.toLowerCase()))
      })).filter(group => group.items.length > 0)
    : commands;


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16" onClick={onClose}>
      <div 
        className="elegant-overlay w-full max-w-lg rounded-xl border border-[#7d4f50]/20 shadow-2xl animate-fade-in-down"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center p-3 border-b border-[#7d4f50]/15">
          <Search className="w-5 h-5 text-muted-foreground mr-3" />
          <input
            type="text"
            placeholder="Search commands and files..."
            className="w-full bg-transparent focus:outline-none text-foreground placeholder:text-muted-foreground"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <div className="p-2 max-h-96 overflow-y-auto">
          {filteredCommands.map((group, groupIndex) => (
            <div key={group.group} className={cn(groupIndex > 0 && "mt-2")}>
              <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group.group}</p>
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li
                    key={item.name}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-[#7d4f50]/10 cursor-pointer text-foreground/70 hover:text-foreground"
                    onClick={() => {
                        item.action();
                        onClose();
                    }}
                  >
                    {item.icon}
                    <span className="text-sm">{item.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
           {filteredCommands.length === 0 && (
            <p className="text-center p-4 text-sm text-muted-foreground">No results found.</p>
           )}
        </div>
        <div className="p-2 border-t border-[#7d4f50]/15 text-xs text-muted-foreground flex items-center justify-between">
            <span>Navigate with arrows, select with Enter.</span>
            <span>Press <kbd className="px-1.5 py-0.5 border border-[#7d4f50]/20 rounded-md bg-[#7d4f50]/5">ESC</kbd> to close.</span>
        </div>
      </div>
    </div>
  );
}