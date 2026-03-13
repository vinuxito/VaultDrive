import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { API_URL } from "../utils/api";
import { decryptFile, base64ToArrayBuffer } from "../utils/crypto";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type PageState = "loading" | "success" | "error";

export default function PublicSharePage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>("loading");
  const [filename, setFilename] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    async function fetchAndDecrypt() {
      try {
        const hashRaw = window.location.hash;
        const hashKey = hashRaw.startsWith("#") ? hashRaw.slice(1) : hashRaw;

        if (!hashKey) {
          setErrorMsg("Invalid share link — missing decryption key");
          setState("error");
          return;
        }

        if (!token) {
          setErrorMsg("Invalid share link — missing token");
          setState("error");
          return;
        }

        const response = await fetch(`${API_URL}/share/${token}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Share link not found or has been revoked");
          }
          throw new Error(`Failed to fetch file (${response.status})`);
        }

        const fileNameHeader = response.headers.get("X-File-Name") ?? "downloaded-file";
        const metadataHeader = response.headers.get("X-File-Metadata");

        if (!metadataHeader) {
          throw new Error("Missing file metadata in server response");
        }

        const metadata = JSON.parse(metadataHeader) as { iv: string; salt?: string };

        if (!metadata.iv) {
          throw new Error("Missing encryption IV in file metadata");
        }

        const iv = new Uint8Array(base64ToArrayBuffer(metadata.iv));

        const rawKeyBuf = base64ToArrayBuffer(hashKey);
        const aesKey = await crypto.subtle.importKey(
          "raw",
          rawKeyBuf,
          { name: "AES-GCM", length: 256 },
          false,
          ["decrypt"]
        );

        const encryptedBlob = await response.blob();
        const encryptedData = await encryptedBlob.arrayBuffer();

        const decryptedData = await decryptFile(encryptedData, aesKey, iv);

        const decryptedBlob = new Blob([decryptedData]);
        const url = window.URL.createObjectURL(decryptedBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileNameHeader;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        setFilename(fileNameHeader);
        setState("success");
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to decrypt file");
        setState("error");
      }
    }

    void fetchAndDecrypt();
  }, [token]);

  return (
    <div className="min-h-screen bg-[#2a1f1f] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gradient-to-br from-[#7d4f50] to-[#6b4345] rounded-2xl shadow-2xl border border-white/10 p-8 text-white text-center">
        <div className="flex justify-center mb-6">
          <img
            src="/abrn/abrn-logo.png"
            alt="ABRN Drive"
            className="w-16 h-16 object-contain"
          />
        </div>
        <h1 className="text-xl font-bold text-white mb-1">ABRN Drive</h1>
        <p className="text-white/60 text-sm mb-8">Secure File Share</p>

        {state === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-[#f2d7d8]" />
            <p className="text-white/80">Decrypting and downloading your file…</p>
          </div>
        )}

        {state === "success" && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            <div>
              <p className="text-lg font-semibold text-white">File downloaded!</p>
              {filename && (
                <p className="text-sm text-white/70 mt-1 break-all">{filename}</p>
              )}
            </div>
            <p className="text-xs text-white/50 mt-2">
              The file was decrypted in your browser and saved to your device.
            </p>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center gap-4">
            <AlertCircle className="w-12 h-12 text-red-400" />
            <div>
              <p className="text-lg font-semibold text-white">Download failed</p>
              <p className="text-sm text-red-300 mt-2 break-words">{errorMsg}</p>
            </div>
            <p className="text-xs text-white/50 mt-2">
              Make sure you have the complete share link, including the key after #.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
