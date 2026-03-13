import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { FolderPlus, FolderTree as FolderTreeIcon } from "lucide-react";
import { FolderTree } from "./FolderTree";
import type { Folder } from "../files/FolderBreadcrumb";

interface MyFoldersSectionProps {
  folders: Folder[];
  loading: boolean;
  onCreateFolder: () => void;
  onCreateSubfolder: (parentId: string) => void;
  onNavigateToFolder: (folderId: string) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string, name: string) => void;
}

export const MyFoldersSection: React.FC<MyFoldersSectionProps> = ({
  folders,
  loading,
  onCreateFolder,
  onCreateSubfolder,
  onNavigateToFolder,
  onRenameFolder,
  onDeleteFolder,
}) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FolderTreeIcon className="w-5 h-5" />
                Folder Management
              </CardTitle>
              <CardDescription>
                {loading
                  ? "Loading folders..."
                  : `${folders.length} folder${folders.length !== 1 ? "s" : ""} created`}
              </CardDescription>
            </div>
            <Button
              onClick={onCreateFolder}
              className="gap-2 bg-[#7d4f50] hover:bg-[#6b4345] text-white border-0"
            >
              <FolderPlus className="w-4 h-4" />
              Create Root Folder
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading folders...
            </div>
          ) : folders.length === 0 ? (
            <div className="text-center py-12">
              <FolderTreeIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No folders created yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Create your first folder to organize your files
              </p>
            </div>
          ) : (
            <FolderTree
              folders={folders}
              onNavigateToFolder={onNavigateToFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onCreateSubfolder={onCreateSubfolder}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};
