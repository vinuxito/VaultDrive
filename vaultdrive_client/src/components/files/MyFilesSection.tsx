import { useState } from "react";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Upload,
  Download,
  File,
  Trash2,
  Share2,
  Users,
  Shield,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";

interface FileData {
  id: string;
  filename: string;
  file_size: number;
  created_at: string;
  metadata: string;
  pin_wrapped_key?: string;
}

interface MyFilesSectionProps {
  files: FileData[];
  loading: boolean;
  selectedFile: File | null;
  uploading: boolean;
  error: string;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  onDownload: (fileId: string, filename: string, metadata: string, dropWrappedKey?: string) => void;
  onDelete: (fileId: string, filename: string) => void;
  onShare: (fileId: string, filename: string) => void;
  onManageShares: (fileId: string, filename: string) => void;
}

// Helper functions
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const parseMetadata = (metadataString: string) => {
  try {
    return JSON.parse(metadataString);
  } catch {
    return null;
  }
};

export const MyFilesSection: React.FC<MyFilesSectionProps> = ({
  files,
  loading,
  selectedFile,
  uploading,
  error,
  onFileSelect,
  onUpload,
  onDownload,
  onDelete,
  onShare,
  onManageShares,
}) => {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const toggleExpand = (fileId: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Files
          </CardTitle>
          <CardDescription>
            Upload and encrypt your files securely. Files are encrypted on your
            device before upload.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-8">
              <input
                id="file-input"
                type="file"
                onChange={onFileSelect}
                className="flex-1 text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
              />
              <Button
                onClick={onUpload}
                disabled={!selectedFile || uploading}
                className="gap-2 bg-[#7d4f50] hover:bg-[#6b4345] text-white border-0 rounded-md"
              >
                <Upload className="w-4 h-4" />
                {uploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Files List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Files</CardTitle>
          <CardDescription>
            {loading
              ? "Loading files..."
              : `${files.length} file${files.length !== 1 ? "s" : ""} stored`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading your files...
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-12">
              <File className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No files uploaded yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Upload your first file to get started
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file) => {
                const isExpanded = expandedFiles.has(file.id);
                const metadata = parseMetadata(file.metadata);

                return (
                  <div
                    key={file.id}
                    className="rounded-lg border bg-card overflow-hidden"
                  >
                    {/* Main File Row */}
                    <div className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <File className="w-5 h-5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{file.filename}</p>
                          <div className="flex gap-3 text-sm text-muted-foreground">
                            <span>{formatFileSize(file.file_size)}</span>
                            <span>•</span>
                            <span>{formatDate(file.created_at)}</span>
                            {metadata && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Shield className="w-3 h-3" />
                                  {metadata.algorithm || "Encrypted"}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleExpand(file.id)}
                          className="gap-2"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                          {isExpanded ? "Hide" : "Show"} Details
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            onDownload(
                              file.id,
                              file.filename,
                              file.metadata,
                              file.pin_wrapped_key
                            )
                          }
                          className="gap-2 border-blue-500 text-[#7d4f50] hover:bg-[#f2d7d8] dark:hover:bg-[#6b4345] dark:text-[#c4999b]"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onShare(file.id, file.filename)}
                          className="gap-2 border-purple-500 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950 dark:text-purple-400"
                        >
                          <Share2 className="w-4 h-4" />
                          Share
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onManageShares(file.id, file.filename)}
                          className="gap-2 border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950 dark:text-orange-400"
                        >
                          <Users className="w-4 h-4" />
                          Manage
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onDelete(file.id, file.filename)}
                          className="gap-2 border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 dark:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Metadata */}
                    {isExpanded && metadata && (
                      <div className="border-t bg-muted/50 p-4">
                        <h4 className="text-sm font-medium mb-2">
                          Encryption Metadata
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">
                              Algorithm:
                            </span>
                            <span className="ml-2 font-mono">
                              {metadata.algorithm || "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">IV:</span>
                            <span className="ml-2 font-mono text-xs truncate block max-w-md">
                              {metadata.iv || "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Salt:</span>
                            <span className="ml-2 font-mono text-xs truncate block max-w-md">
                              {metadata.salt || "N/A"}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
