import { useState } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Share2, Users, Mail, Check, AlertCircle } from "lucide-react";
import { API_URL } from "../../utils/api";

interface QuickShareProps {
  fileId: string;
  filename: string;
  onShareComplete?: () => void;
}

export function QuickShare({ fileId, filename, onShareComplete }: QuickShareProps) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sharing, setSharing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleShare = async () => {
    if (!recipientEmail) return;

    setSharing(true);
    setError("");
    setSuccess(false);

    try {
      const token = localStorage.getItem("token");

      // Get recipient's public key
      const publicKeyResponse = await fetch(
        `${API_URL}/user/public-key?email=${encodeURIComponent(recipientEmail)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!publicKeyResponse.ok) {
        if (publicKeyResponse.status === 404) {
          throw new Error("User not found with that email");
        }
        throw new Error("Failed to get recipient public key");
      }

      await publicKeyResponse.json();

      // For now, use placeholder wrapped key
      const wrappedKey = "placeholder_wrapped_key_" + Date.now();

      // Share the file
      const shareResponse = await fetch(`${API_URL}/files/${fileId}/share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipient_email: recipientEmail,
          wrapped_key: wrappedKey,
        }),
      });

      if (!shareResponse.ok) {
        const data = await shareResponse.json();
        throw new Error(data.error || "Failed to share file");
      }

      setSuccess(true);
      setRecipientEmail("");
      setTimeout(() => setSuccess(false), 3000);

      if (onShareComplete) {
        onShareComplete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to share file");
    } finally {
      setSharing(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Share2 className="w-4 h-4 text-primary" />
          Quick Share
        </CardTitle>
        <CardDescription className="text-xs">
          Share with team members instantly
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="p-2 bg-muted/50 rounded-md">
          <p className="text-xs font-medium truncate">{filename}</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium flex items-center gap-1">
            <Mail className="w-3 h-3" />
            Team Member Email
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="teammate@company.com"
              className="flex-1 px-3 py-2 text-sm border rounded-md bg-background focus-ring"
              disabled={sharing}
              onKeyDown={(e) => {
                if (e.key === "Enter" && recipientEmail) {
                  handleShare();
                }
              }}
            />
            <Button
              onClick={handleShare}
              disabled={!recipientEmail || sharing}
              size="sm"
              className="gap-1"
            >
              {sharing ? (
                <>
                  <Users className="w-4 h-4 animate-pulse" />
                  <span className="hidden sm:inline">Sharing...</span>
                </>
              ) : success ? (
                <>
                  <Check className="w-4 h-4" />
                  <span className="hidden sm:inline">Shared</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Share</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-2 bg-destructive/10 text-destructive text-xs rounded-md flex items-start gap-1">
            <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-2 bg-green-500/10 text-green-700 dark:text-green-400 text-xs rounded-md flex items-center gap-1">
            <Check className="w-3 h-3" />
            File shared successfully!
          </div>
        )}

        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground flex items-start gap-1">
            <Users className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>
              The recipient will receive access to download this encrypted file.
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
