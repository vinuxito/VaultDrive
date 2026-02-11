import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Upload, UploadCloud, Loader2, CheckCircle, XCircle, Clock, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";

interface TokenInfo {
  valid: boolean;
  folder_name: string;
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
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    initializeDropLink();
  }, [token]);

  const initializeDropLink = async () => {
    // Extract key from URL
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
      
      // Auto-fill password from URL if key is present
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
    
    const files = Array.from(e.dataTransfer.files) as File[];
    if (files.length > 0) {
      handleUpload(files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length > 0) {
      handleUpload(files);
    }
  };

const handleUpload = async (files: File[]) => {
    if (!password) {
      setError("Please enter the encryption password");
      return;
    }

    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress(files.map(f => ({
      fileName: f.name,
      status: "pending",
      progress: 0,
    })));

    for (const file of files) {
      await uploadFile(file);
    }

    setUploading(false);
    await initializeDropLink();
  };

  const uploadFile = async (file: File): Promise<void> => {
    const fileName = file.name;
    
    setUploadProgress(prev => {
      const updated = [...prev];
      const idx = updated.findIndex(p => p.fileName === fileName);
      if (idx === -1) {
        updated[updated.length] = { fileName, status: "uploading", progress: 0 };
      } else {
        updated[idx] = { ...updated[idx], status: "uploading", progress: 0 };
      }
      return updated;
    });

    try {
      // Use the password from input
      const passwordBytes = new TextEncoder().encode(password);
      const salt = crypto.getRandomValues(new Uint8Array(16));

      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        passwordBytes,
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
      );

      const aesKey = await crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: salt,
          iterations: 100000,
          hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );

      const iv = crypto.getRandomValues(new Uint8Array(12));
      const fileBuffer = await file.arrayBuffer();

      const encryptedData = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        fileBuffer
      );

      const exportedKey = await crypto.subtle.exportKey("raw", aesKey);
      const exportedKeyBytes = new Uint8Array(exportedKey);
      const wrappedKey = btoa(String.fromCharCode(...Array.from(exportedKeyBytes)));

      const ivBytes = new Uint8Array(iv);
      const saltBytes = new Uint8Array(salt);

      const formData = new FormData();
      formData.append("file", new Blob([encryptedData]), file.name);
      formData.append("iv", btoa(String.fromCharCode(...Array.from(ivBytes))));
      formData.append("salt", btoa(String.fromCharCode(...Array.from(saltBytes))));
      formData.append("algorithm", "AES-256-GCM");
      formData.append("wrapped_key", wrappedKey);
      formData.append("password", password);

      const response = await fetch(`/abrn/api/drop/${token}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      setUploadProgress(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(p => p.fileName === fileName);
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], status: "success", progress: 100 };
        }
        return updated;
      });

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Upload failed";
      setUploadProgress(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(p => p.fileName === fileName);
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], status: "error", error: errorMsg };
        }
        return updated;
      });
    }
  };

  const handleDone = async () => {
    try {
      const response = await fetch(`/abrn/api/drop/${token}/done`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to deactivate link");
      }

      setCompleted(true);
      setTokenInfo(null);
    } catch (err) {
      setError("Failed to deactivate link");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
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

  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
            <CardTitle>Upload Complete</CardTitle>
            <CardDescription>Your files have been uploaded successfully</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center text-sm text-muted-foreground">
              <div className="font-semibold mb-2">✓ Done!</div>
              <p>Files were encrypted with the password set by the file owner.</p>
              <p className="mt-2 text-xs">
                Contact the file owner if you need the password to decrypt files.
              </p>
            </div>
          </CardContent>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
            Secure Drop
          </h1>
          <p className="text-muted-foreground">Upload files securely to {tokenInfo.folder_name}</p>
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
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                !uploading ? "border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 dark:border-slate-700 dark:hover:border-blue-600 dark:hover:bg-blue-900/20" : "border-slate-300 bg-slate-50"
              }`}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              {!uploading ? (
                <div className="space-y-4">
                  <Upload className="w-12 h-12 mx-auto text-slate-400" />
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Drag & drop files here, or{" "}
                      <label className="text-blue-600 cursor-pointer hover:underline">
                        click to browse
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          onChange={handleFileChange}
                        />
                      </label>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Max file size: 10MB per file
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Loader2 className="w-12 h-12 mx-auto text-blue-600 animate-spin" />
                  <p className="text-sm text-muted-foreground">Uploading files...</p>
                </div>
              )}
            </div>

            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <p className="text-sm text-blue-400">
                  <strong>Enter the password</strong> provided by the file owner to encrypt your upload.
                </p>
              </div>

            <div className="hidden space-y-2">
              <label className="text-sm font-medium">Encryption Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            {uploadProgress.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Upload Progress</h3>
                {uploadProgress.map((progress, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate flex-1">{progress.fileName}</span>
                      {progress.status === "success" && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                      {progress.status === "error" && (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      {progress.status === "uploading" && (
                        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                      )}
                    </div>
                    {progress.status === "error" && (
                      <p className="text-xs text-red-600">{progress.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button
              onClick={handleDone}
              variant="destructive"
              disabled={uploading || uploadProgress.length === 0}
            >
              Done & Deactivate
            </Button>
            <Button
              onClick={() => navigate("/")}
              variant="outline"
            >
              Cancel
            </Button>
          </CardFooter>
        </Card>

        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <p className="font-medium">Security Notice</p>
                <p className="text-muted-foreground">
                  Files uploaded here will be encrypted client-side and stored securely.
                  The file owner will need the encryption password you provide above.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}