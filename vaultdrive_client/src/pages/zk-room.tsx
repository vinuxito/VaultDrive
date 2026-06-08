import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import {
  Send,
  Key,
  Users,
  Lock,
  Edit3,
  MessageSquare,
  Copy,
  Check,
  ArrowLeft,
  ShieldAlert,
} from "lucide-react";
import { API_URL } from "../utils/api";
import {
  generateECDHKeyPair,
  exportECDHPublicKey,
  importECDHPublicKey,
  deriveSharedSecret,
  generateRoomKey,
  exportRoomKey,
  importRoomKey,
  encryptRoomKeyEnvelope,
  decryptRoomKeyEnvelope,
  encryptRoomData,
  decryptRoomData,
} from "../utils/zk-room-crypto";

interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
}

export default function ZKRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation(["drive", "common"]);

  const [status, setStatus] = useState<"connecting" | "exchanging" | "ready" | "error">("connecting");
  const [errorMessage, setErrorMessage] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"editor" | "chat">("editor");

  // Room cryptography state
  const [roomKey, setRoomKey] = useState<CryptoKey | null>(null);

  const peerSecrets = useRef<Map<string, CryptoKey>>(new Map());

  // UI state
  const [docText, setDocText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [peers, setPeers] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const clientIdRef = useRef<string>("");

  // Refs for tracking connections and edits
  const sseRef = useRef<EventSource | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const activePeersRef = useRef<Set<string>>(new Set());
  const roomKeyRef = useRef<CryptoKey | null>(null);

  useEffect(() => {
    let active = true;

    async function initRoom() {
      try {
        // 1. Generate local ECDH key pair for key exchange
        const keyPair = await generateECDHKeyPair();
        if (!active) return;
        // 2. Determine room role and load/generate master room key
        const hash = window.location.hash.substring(1);
        if (hash) {
          // Joiner: import the RoomKey direct from URL hash (no server knowledge)
          try {
            const key = await importRoomKey(hash);
            setRoomKey(key);
            roomKeyRef.current = key;
            setStatus("ready");
          } catch (err) {
            console.error("Invalid RoomKey hash in URL:", err);
            setStatus("error");
            setErrorMessage("Invalid key signature in URL hash.");
          }
        } else {
          // Creator: generate a new random RoomKey
          const key = await generateRoomKey();
          const keyB64 = await exportRoomKey(key);
          if (!active) return;

          setRoomKey(key);
          roomKeyRef.current = key;
          window.location.hash = keyB64; // Set hash for sharing
          setStatus("ready");
        }

        // 3. Obtain single-use SSE ticket from the backend
        const authToken = localStorage.getItem("token");
        if (!authToken) {
          navigate("/login");
          return;
        }

        const ticketResp = await fetch(`${API_URL}/events/ticket`, {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        });

        if (!ticketResp.ok) {
          throw new Error("Failed to secure one-time SSE ticket");
        }

        const { ticket } = await ticketResp.json();
        if (!active) return;

        // 4. Establish SSE connection
        const sse = new EventSource(`${API_URL}/v1/rooms/${roomId}/connect?ticket=${ticket}`);
        sseRef.current = sse;

        sse.onmessage = async (e) => {
          if (!active) return;
          try {
            const msg = JSON.parse(e.data);
            
            if (msg.event === "connected") {
              setClientId(msg.client_id);
              clientIdRef.current = msg.client_id;
              // Broadcast our ECDH public key to peers
              const pubJWK = await exportECDHPublicKey(keyPair.publicKey);
              await broadcastEvent(msg.client_id, "peer-joined", { pubKey: pubJWK });
            } else if (msg.event === "connected-peers") {
              // Existing peers listing if any
            }
          } catch (err) {
            console.error("Error processing SSE greeting:", err);
          }
        };

        // Custom Event Handlers
        sse.addEventListener("message", async (e: any) => {
          if (!active) return;
          try {
            const outer = JSON.parse(e.data);
            if (!outer.event || outer.sender_id === clientIdRef.current) return;

            const sender = outer.sender_id;
            const eventType = outer.event;
            const innerData = outer.data;

            if (eventType === "peer-joined") {
              // Peer joined: add to list and derive ECDH shared secret
              setPeers((prev) => new Set([...prev, sender]));
              activePeersRef.current.add(sender);

              const peerPub = await importECDHPublicKey(innerData.pubKey);
              const shared = await deriveSharedSecret(keyPair.privateKey, peerPub);
              peerSecrets.current.set(sender, shared);

              // If we are the key holder, encrypt the RoomKey and send it to the new peer
              if (roomKeyRef.current) {
                const envelope = await encryptRoomKeyEnvelope(shared, roomKeyRef.current);
                const localPubJWK = await exportECDHPublicKey(keyPair.publicKey);
                await broadcastEvent(clientIdRef.current, "key-delivery", {
                  target: sender,
                  envelope,
                  pubKey: localPubJWK,
                });
              }
            } else if (eventType === "key-delivery") {
              // We received key delivery
              if (innerData.target !== clientIdRef.current) return;

              const peerPub = await importECDHPublicKey(innerData.pubKey);
              const shared = await deriveSharedSecret(keyPair.privateKey, peerPub);
              const decryptedRoomKey = await decryptRoomKeyEnvelope(shared, innerData.envelope);

              setRoomKey(decryptedRoomKey);
              roomKeyRef.current = decryptedRoomKey;
              setStatus("ready");
              setPeers((prev) => new Set([...prev, sender]));
              activePeersRef.current.add(sender);
            } else if (eventType === "document-update") {
              // Document text synced
              const currentKey = roomKeyRef.current;
              if (currentKey) {
                const plaintext = await decryptRoomData(currentKey, innerData);
                setDocText(plaintext);
              }
            } else if (eventType === "chat-message") {
              // Chat message received
              const currentKey = roomKeyRef.current;
              if (currentKey) {
                const plainJSON = await decryptRoomData(currentKey, innerData);
                const msgObj = JSON.parse(plainJSON);
                setMessages((prev) => [...prev, msgObj]);
              }
            }
          } catch (err) {
            console.error("Error handling broadcast frame:", err);
          }
        });

        sse.onerror = (e) => {
          console.error("SSE connection error:", e);
          if (active) {
            setStatus("error");
            setErrorMessage("Disconnected from room relay server.");
          }
        };

      } catch (err: any) {
        console.error("Initialization error:", err);
        if (active) {
          setStatus("error");
          setErrorMessage(err.message || "Failed to initialize secure session.");
        }
      }
    }

    initRoom();

    return () => {
      active = false;
      if (sseRef.current) {
        sseRef.current.close();
      }
    };
  }, [roomId, navigate]);

  // Helper function to send encrypted payloads to Go relay
  async function broadcastEvent(sender: string, event: string, data: any) {
    try {
      await fetch(`${API_URL}/v1/rooms/${roomId}/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_id: sender,
          event,
          data,
        }),
      });
    } catch (err) {
      console.error("Broadcast failed:", err);
    }
  }

  // Handle typing inside editor
  const handleEditorChange = async (val: string) => {
    setDocText(val);
    if (!roomKey) return;

    try {
      const envelope = await encryptRoomData(roomKey, val);
      await broadcastEvent(clientIdRef.current, "document-update", envelope);
    } catch (err) {
      console.error("Failed to encrypt document update:", err);
    }
  };

  // Handle sending chat message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !roomKey) return;

    try {
      const msgObj: ChatMessage = {
        id: crypto.randomUUID(),
        senderId: clientIdRef.current.slice(0, 6),
        text: inputMessage.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, msgObj]);
      setInputMessage("");

      const envelope = await encryptRoomData(roomKey, JSON.stringify(msgObj));
      await broadcastEvent(clientIdRef.current, "chat-message", envelope);
    } catch (err) {
      console.error("Failed to encrypt message:", err);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-7xl mx-auto p-4 space-y-4">
      {/* Top Navigation */}
      <div className="flex items-center justify-between border border-primary/10 bg-card/60 backdrop-blur-md px-5 py-3.5 rounded-2xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-1.5 rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              {t("drive:rooms.secureRoom", "Zero-Knowledge Room")}
            </h1>
            <p className="text-xs text-muted-foreground">ID: {roomId}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Peer counter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/60 rounded-xl text-xs font-semibold text-muted-foreground border border-border">
            <Users className="w-3.5 h-3.5" />
            <span>{peers.size + 1} {t("drive:rooms.active", "active")}</span>
          </div>

          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-xs font-semibold cursor-pointer transition-all active:scale-95"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>{t("common:actions.copied", "Copied")}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>{t("drive:rooms.invite", "Invite")}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Layout Area */}
      {status === "connecting" && (
        <div className="flex-1 flex flex-col items-center justify-center bg-card/40 border border-primary/5 rounded-3xl p-8 space-y-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-muted-foreground">{t("drive:rooms.establishing", "Establishing zero-knowledge handshake...")}</p>
        </div>
      )}

      {status === "error" && (
        <div className="flex-1 flex flex-col items-center justify-center bg-card/40 border border-danger/10 rounded-3xl p-8 space-y-4">
          <ShieldAlert className="w-12 h-12 text-danger animate-pulse" />
          <p className="text-sm font-semibold text-foreground">{t("drive:rooms.error", "Security Connection Blocked")}</p>
          <p className="text-xs text-muted-foreground max-w-sm text-center">{errorMessage}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold rounded-xl transition-all cursor-pointer"
          >
            {t("drive:rooms.returnDashboard", "Return to Dashboard")}
          </button>
        </div>
      )}

      {status === "ready" && (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
          {/* Editor Area (takes 2 cols on desktop) */}
          <div className={`md:col-span-2 flex flex-col bg-card/60 backdrop-blur-md border border-primary/10 rounded-3xl p-5 min-h-0 ${activeTab === "editor" ? "flex" : "hidden md:flex"}`}>
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5" />
                {t("drive:rooms.secureDoc", "Encrypted Document Pad")}
              </span>
              {/* Tab Toggles on Mobile */}
              <div className="flex md:hidden bg-muted/80 p-0.5 rounded-lg border border-border">
                <button
                  onClick={() => setActiveTab("editor")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md ${activeTab === "editor" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                >
                  {t("drive:rooms.pad", "Pad")}
                </button>
                <button
                  onClick={() => setActiveTab("chat")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md ${activeTab === "chat" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                >
                  {t("drive:rooms.chatTab", "Chat")} ({messages.length})
                </button>
              </div>
            </div>

            <textarea
              ref={editorRef}
              value={docText}
              onChange={(e) => handleEditorChange(e.target.value)}
              placeholder={t("drive:rooms.editorPlaceholder", "Start typing collaborative, encrypted notes here...")}
              className="flex-1 w-full bg-transparent text-foreground placeholder:text-muted-foreground/60 border-none outline-none resize-none text-sm font-mono leading-relaxed focus:ring-0 selection:bg-primary/20"
            />
          </div>

          {/* Chat Sidebar Pane */}
          <div className={`flex flex-col bg-card/60 backdrop-blur-md border border-primary/10 rounded-3xl p-5 min-h-0 ${activeTab === "chat" ? "flex" : "hidden md:flex"}`}>
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                {t("drive:rooms.chat", "Secure Team Chat")}
              </span>
              {/* Tab Toggles on Mobile */}
              <div className="flex md:hidden bg-muted/80 p-0.5 rounded-lg border border-border">
                <button
                  onClick={() => setActiveTab("editor")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md ${activeTab === "editor" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                >
                  {t("drive:rooms.pad", "Pad")}
                </button>
                <button
                  onClick={() => setActiveTab("chat")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md ${activeTab === "chat" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                >
                  {t("drive:rooms.chatTab", "Chat")} ({messages.length})
                </button>
              </div>
            </div>

            {/* Message Thread */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1.5 scrollbar-thin scrollbar-thumb-primary/10">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground/60 p-4">
                  <Key className="w-8 h-8 text-muted-foreground/30 mb-2 animate-bounce" />
                  <p className="text-xs font-semibold">{t("drive:rooms.noMessages", "Zero-Knowledge conversation initialized.")}</p>
                  <p className="text-[10px] max-w-[200px] mt-1">{t("drive:rooms.noMessagesDesc", "All sent messages are ciphered browser-side.")}</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isSelf = msg.senderId === clientId.slice(0, 6);
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[85%] ${isSelf ? "ml-auto items-end" : "mr-auto items-start"}`}
                    >
                      <span className="text-[10px] text-muted-foreground/80 mb-0.5 px-1 font-mono">
                        {isSelf ? t("drive:rooms.you", "You") : `Peer #${msg.senderId}`}
                      </span>
                      <div
                        className={`rounded-2xl px-4 py-2 text-xs font-medium ${
                          isSelf
                            ? "bg-primary text-black rounded-tr-none"
                            : "bg-muted text-foreground rounded-tl-none border border-border"
                        }`}
                      >
                        {msg.text}
                      </div>
                      <span className="text-[9px] text-muted-foreground/50 mt-1 px-1">{msg.timestamp}</span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="flex items-center gap-2 mt-4">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={t("drive:rooms.chatPlaceholder", "Send secure message...")}
                className="flex-1 bg-muted/60 text-foreground placeholder:text-muted-foreground/60 border border-border rounded-xl px-4 py-2.5 text-xs outline-none focus:border-primary/50 transition-colors"
              />
              <button
                type="submit"
                className="p-2.5 bg-primary hover:bg-primary/95 text-black rounded-xl transition-all cursor-pointer active:scale-95"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
