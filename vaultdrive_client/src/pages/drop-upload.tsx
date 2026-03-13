import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Upload, UploadCloud, Loader2, CheckCircle, XCircle, Clock, AlertCircle, ArrowLeft, FolderOpen, FileIcon } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { hexToBytes } from "../utils/crypto";
import ABRNLogo from "../components/branding/abrn-logo";

interface TokenInfo {
  valid: boolean;
  folder_name: string;
  link_name?: string;
  files_limit: number | null;
  uploaded: number | null;
  expires_at: string | null;
  has_password: boolean;
  error?: string;
}

interface UploadProgress {
  fileName: string;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  bytesUploaded: number;
  bytesTotal: number;
  error?: string;
}

export default function DropUpload() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [password, setPassword] = useState("");

  useEffect(() => {
    initializeDropLink();
  }, [token]);

  const initializeDropLink = async () => {
    const urlKey = searchParams.get("key");
    
    try {
      const apiUrl = urlKey ? `/abrn/api/drop/${token}?key=${encodeURIComponent(urlKey)}` : `/abrn/api/drop/${token}`;
      const response = await fetch(apiUrl);
      
      if (response.status === 404 || response.status === 403) {
        const data = await response.json();
        setError(data.error || "Invalid or expired upload link");
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to validate upload link");
      }

      const data = await response.json() as TokenInfo;
      
      if (!data.valid) {
        setError(data.error || "Invalid upload link");
        setLoading(false);
        return;
      }

      setTokenInfo(data);
      
      if (urlKey) {
        setPassword(urlKey);
      }
    } catch (err) {
      setError("Unable to validate upload link");
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const items = Array.from(e.dataTransfer?.items || []);
    const files: File[] = [];
    
    for (const item of items) {
      const entry = item.webkitGetAsEntry?.();
      if (entry) {
        processEntry(entry, files);
      }
    }
    
    if (files.length > 0) {
      handleUpload(files);
    }
  };

  const processEntry = (entry: any, files: File[], path: string = "") => {
    if (entry.isFile) {
      entry.file((file: File) => {
        if (path) {
          (file as any).webkitRelativePath = path + "/" + file.name;
        }
        files.push(file);
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      dirReader.readEntries(async (entries: any[]) => {
        for (const entry of entries) {
          processEntry(entry, files, path ? `${path}/${entry.name}` : entry.name);
        }
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length > 0) {
      handleUpload(files);
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length > 0) {
      handleUpload(files, true);
    }
  };

  const handleUpload = async (files: File[], isFolder: boolean = false) => {
    if (!password) {
      setError("Please enter the encryption key");
      return;
    }

    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress(files.map(f => ({
      fileName: f.name,
      status: "pending",
      progress: 0,
      bytesUploaded: 0,
      bytesTotal: f.size,
    })));

    await Promise.allSettled(
      files.map(f => uploadFile(f, isFolder))
    );
    
    setUploading(false);
    await initializeDropLink();
  };

  const uploadFile = async (file: File, isFolder: boolean): Promise<void> => {
    const fileName = file.name;
    const relativePath = isFolder && (file as any).webkitRelativePath || "";
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(prev => {
            const updated = [...prev];
            const idx = updated.findIndex(p => p.fileName === fileName);
            if (idx !== -1) {
              updated[idx] = { 
                ...updated[idx], 
                progress: percent,
                status: "uploading",
                bytesUploaded: event.loaded,
                bytesTotal: event.total
              };
            }
            return updated;
          });
        }
      };
      
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadProgress(prev => {
            const updated = [...prev];
            const idx = updated.findIndex(p => p.fileName === fileName);
            if (idx !== -1) {
              updated[idx] = { 
                ...updated[idx], 
                status: "success", 
                progress: 100,
                bytesUploaded: file.size
              };
            }
            return updated;
          });
          resolve();
        } else {
          setUploadProgress(prev => {
            const updated = [...prev];
            const idx = updated.findIndex(p => p.fileName === fileName);
            if (idx !== -1) {
              updated[idx] = { ...updated[idx], status: "error", error: `Upload failed (${xhr.status})` };
            }
            return updated;
          });
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      };
      
      xhr.onerror = () => {
        setUploadProgress(prev => {
          const updated = [...prev];
          const idx = updated.findIndex(p => p.fileName === fileName);
          if (idx !== -1) {
            updated[idx] = { ...updated[idx], status: "error", error: "Network error" };
          }
          return updated;
        });
        reject(new Error("Network error"));
      };
      
      xhr.ontimeout = () => {
        setUploadProgress(prev => {
          const updated = [...prev];
          const idx = updated.findIndex(p => p.fileName === fileName);
          if (idx !== -1) {
            updated[idx] = { ...updated[idx], status: "error", error: "Upload timeout (30 minutes)" };
          }
          return updated;
        });
        reject(new Error("Upload timeout"));
      };
      
      xhr.timeout = 30 * 60 * 1000;
      
      setTimeout(() => {
        (async () => {
          try {
            const urlKey = password;
            if (!urlKey) {
              throw new Error("No encryption key");
            }
            
            const keyResponse = await fetch(`/abrn/api/drop/${token}/encryption-key?key=${encodeURIComponent(urlKey)}`);
            if (!keyResponse.ok) {
              throw new Error("Failed to get encryption key");
            }
            const keyData = await keyResponse.json();
            const rawEncryptionKey = keyData.encryption_key;
            
            const fileBuffer = await file.arrayBuffer();
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encryptionKeyBytes = hexToBytes(rawEncryptionKey);
            const aesKey = await crypto.subtle.importKey(
              "raw",
              new Uint8Array(encryptionKeyBytes),
              { name: "AES-GCM", length: 256 },
              false,
              ["encrypt"]
            );
            
            const encryptedData = await crypto.subtle.encrypt(
              { name: "AES-GCM", iv },
              aesKey,
              fileBuffer
            );
            
            const ivBytes = new Uint8Array(iv);
            const formData = new FormData();
            const blobName = relativePath ? fileName : "files[]";
            formData.append(blobName, new Blob([encryptedData]), relativePath || fileName);
            formData.append("iv", btoa(String.fromCharCode(...Array.from(ivBytes))));
            formData.append("salt", "");
            formData.append("algorithm", "AES-256-GCM");
            formData.append("wrapped_key", urlKey);
            formData.append("password", urlKey);
            
            xhr.open("POST", `/abrn/api/drop/${token}/upload`);
            xhr.send(formData);
          } catch (err) {
            setUploadProgress(prev => {
              const updated = [...prev];
              const idx = updated.findIndex(p => p.fileName === fileName);
              if (idx !== -1) {
                updated[idx] = { ...updated[idx], status: "error", error: err instanceof Error ? err.message : "Upload failed" };
              }
              return updated;
            });
            reject(err);
          }
        })();
      }, 0);
    });
  };


  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  if (loading) {
    return (
      <div className="abrn-page-bg flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-[#7d4f50]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="abrn-page-bg flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <XCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
            <CardTitle>Upload Link Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => navigate("/")} variant="outline" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }


  if (!tokenInfo) {
    return null;
  }

  const completedCount = uploadProgress.filter(p => p.status === "success").length;
  const totalCount = uploadProgress.length;

  return (
    <div className="abrn-page-bg p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex justify-start mb-4">
          <ABRNLogo className="h-12" alt="ABRN Asesores SC" />
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#7d4f50] to-[#c4999b]">
            Secure Drop - ABRN Asesores SC
          </h1>
          <p className="text-muted-foreground">Upload files securely to {tokenInfo.link_name ? `${tokenInfo.link_name} Workspace` : tokenInfo.folder_name}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UploadCloud className="w-5 h-5" />
              Upload Area
            </CardTitle>
            <CardDescription>
              {tokenInfo.files_limit && (
                <span className="flex items-center gap-1">
                  Remaining uploads:{" "}
                  {Math.max(0, (tokenInfo.files_limit - (tokenInfo.uploaded || 0)))}
                </span>
              )}
              {tokenInfo.expires_at && (
                <span className="ml-4 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Expires: {new Date(tokenInfo.expires_at).toLocaleString()}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!uploading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label htmlFor="file-input" className="group relative">
                    <input
                      id="file-input"
                      type="file"
                      multiple
                      className="sr-only"
                      onChange={handleFileChange}
                    />
                    <div className="relative overflow-hidden rounded-xl border border-white/60 bg-white/75 backdrop-blur-sm p-6 transition-all duration-300 group-hover:border-[#7d4f50] group-hover:shadow-lg group-hover:scale-105 group-hover:bg-gradient-to-br group-hover:from-[#7d4f50]/10 group-hover:to-[#c4999b]/10 cursor-pointer">
                      <FileIcon className="w-8 h-8 mx-auto mb-3 text-slate-600 dark:text-slate-400 group-hover:text-[#7d4f50] transition-colors duration-300" />
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-[#7d4f50] transition-colors duration-300">
                        Select Files
                      </span>
                    </div>
                  </label>

                  <label htmlFor="folder-input" className="group relative">
                    <input
                      id="folder-input"
                      {...({ type: "file", webkitdirectory: "", directory: "", multiple: true, className: "sr-only", onChange: handleFolderChange } as any)}
                    />
                    <div className="relative overflow-hidden rounded-xl border border-white/60 bg-white/75 backdrop-blur-sm p-6 transition-all duration-300 group-hover:border-[#7d4f50] group-hover:shadow-lg group-hover:scale-105 group-hover:bg-gradient-to-br group-hover:from-[#7d4f50]/10 group-hover:to-[#c4999b]/10 cursor-pointer">
                      <FolderOpen className="w-8 h-8 mx-auto mb-3 text-slate-600 dark:text-slate-400 group-hover:text-[#7d4f50] transition-colors duration-300" />
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-[#7d4f50] transition-colors duration-300">
                        Select Folder
                      </span>
                    </div>
                  </label>
                </div>

                <div
                  className="border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 cursor-pointer border-[#7d4f50]/30 hover:border-[#7d4f50] hover:bg-gradient-to-br hover:from-[#7d4f50]/5 hover:to-[#c4999b]/5"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <div className="mb-4 transition-transform duration-300 group-hover:scale-110">
                    <Upload className="w-16 h-16 mx-auto text-slate-400 group-hover:text-[#7d4f50] transition-colors duration-300" />
                  </div>
                  <div className="space-y-3">
                    <p className="text-base font-medium text-slate-700 dark:text-slate-300">
                      Drag & drop files or folders here
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-500">
                      Or use the buttons above
                    </p>
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span>Max upload size: 2GB per file</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Loader2 className="w-12 h-12 mx-auto text-[#7d4f50] animate-spin" />
                <p className="text-sm text-muted-foreground text-center">
                  {totalCount > 0 ? `Uploading ${totalCount} file${totalCount > 1 ? 's' : ''}...` : 'Uploading...'}
                </p>
              </div>
            )}

            {uploadProgress.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Upload Progress</h3>
                  <span className="text-xs text-muted-foreground">
                    {completedCount}/{totalCount} completed
                  </span>
                </div>
                {uploadProgress.map((progress, idx) => (
                  <div key={idx} className="space-y-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="truncate flex-1 mr-2" title={progress.fileName}>
                        {progress.fileName}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {progress.bytesUploaded && progress.bytesTotal
                          ? `${formatBytes(progress.bytesUploaded)} / ${formatBytes(progress.bytesTotal)}`
                          : `${progress.progress}%`
                        }
                      </span>
                      {progress.status === "success" && (
                        <CheckCircle className="w-4 h-4 text-green-500 ml-2 flex-shrink-0" />
                      )}
                      {progress.status === "error" && (
                        <XCircle className="w-4 h-4 text-red-500 ml-2 flex-shrink-0" />
                      )}
                      {progress.status === "uploading" && (
                        <Loader2 className="w-4 h-4 text-[#7d4f50] animate-spin ml-2 flex-shrink-0" />
                      )}
                    </div>

                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-[#7d4f50] transition-all duration-300 h-full"
                        style={{ width: `${progress.progress}%` }}
                      />
                    </div>

                    {progress.status === "error" && (
                      <p className="text-xs text-red-600">{progress.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={() => {
                const token = localStorage.getItem("token");
                if (token) {
                  navigate("/abrn/files");
                } else {
                  window.location.href = "https://abrn.mx/";
                }
              }}
              variant="outline"
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
          </CardFooter>
        </Card>

        <Card className="bg-[#f2d7d8] dark:bg-[#7d4f50]/10 border-[#d4a5a6] dark:border-[#7d4f50]">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-[#7d4f50] dark:text-[#c4999b] flex-shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <p className="font-medium">Security Notice</p>
                <p className="text-muted-foreground">
                  Files uploaded here will be encrypted client-side and stored securely.
                  The file owner will need the encryption key to decrypt files.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
