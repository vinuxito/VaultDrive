import { Home, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  created_at?: string;
}

interface FolderBreadcrumbProps {
  currentFolderId: string | null;
  folders: Folder[];
  onNavigate: (folderId: string | null) => void;
}

export const FolderBreadcrumb: React.FC<FolderBreadcrumbProps> = ({
  currentFolderId,
  folders,
  onNavigate,
}) => {
  // Build path from current folder to root
  const buildPath = (): Folder[] => {
    if (!currentFolderId) return [];

    const path: Folder[] = [];
    let currentId: string | null = currentFolderId;

    while (currentId) {
      const folder = folders.find(f => f.id === currentId);
      if (!folder) break;
      path.unshift(folder);
      currentId = folder.parentId;
    }

    return path;
  };

  const path = buildPath();

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm mb-4">
      {/* Home / Root */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onNavigate(null)}
        className={`gap-1 h-8 px-2 ${
          !currentFolderId ? "text-[#7d4f50]" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Home className="w-4 h-4" />
        <span>Home</span>
      </Button>

      {/* Path segments */}
      {path.map((folder, index) => {
        const isLast = index === path.length - 1;
        return (
          <div key={folder.id} className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate(folder.id)}
              className={`h-8 px-2 ${
                isLast ? "text-[#7d4f50] font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
              disabled={isLast}
            >
              {folder.name}
            </Button>
          </div>
        );
      })}
    </nav>
  );
};
