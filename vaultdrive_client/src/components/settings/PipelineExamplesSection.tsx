import { useState } from "react";
import { Workflow, Copy } from "lucide-react";

type Lang = "curl" | "python" | "node" | "pseudocode";

interface PipelineSnippet {
  lang: Lang;
  label: string;
  code: string;
}

function getBaseUrl(): string {
  return `${window.location.origin}/abrn/api/v1`;
}

function buildSnippets(): PipelineSnippet[] {
  const base = getBaseUrl();
  return [
    {
      lang: "curl",
      label: "curl",
      code: `# 1. Search for files
FILES=$(curl -s "${base}/files?q=invoice" \\
  -H "Authorization: Bearer $ABRN_KEY")
echo "$FILES" | jq '.data[].filename'

# 2. Download ciphertext (first match)
FILE_ID=$(echo "$FILES" | jq -r '.data[0].id')
curl -s "${base}/files/$FILE_ID/download" \\
  -H "Authorization: Bearer $ABRN_KEY" \\
  -o encrypted.bin -D headers.txt

# 3. Extract wrapped key from response headers
WRAPPED_KEY=$(grep -i X-Wrapped-Key headers.txt | cut -d' ' -f2)
echo "Wrapped key: $WRAPPED_KEY"
echo "Decrypt with owner's PIN-derived RSA private key"`,
    },
    {
      lang: "python",
      label: "Python",
      code: `import requests, json

BASE = "${base}"
HEADERS = {"Authorization": f"Bearer {ABRN_KEY}"}

# 1. Search for files
files = requests.get(f"{BASE}/files", params={"q": "invoice"},
                     headers=HEADERS).json()
print([f["filename"] for f in files["data"]])

# 2. Download ciphertext
file_id = files["data"][0]["id"]
resp = requests.get(f"{BASE}/files/{file_id}/download",
                    headers=HEADERS)
ciphertext = resp.content
wrapped_key = resp.headers.get("X-Wrapped-Key")

# 3. Decrypt requires owner's PIN-encrypted RSA private key
# Agent stores ciphertext; owner decrypts in browser
with open("encrypted.bin", "wb") as f:
    f.write(ciphertext)
print(f"Wrapped key: {wrapped_key}")
print(f"Downloaded {len(ciphertext)} bytes of ciphertext")`,
    },
    {
      lang: "node",
      label: "Node.js",
      code: `const BASE = "${base}";
const headers = { Authorization: \`Bearer \${ABRN_KEY}\` };

// 1. Search for files
const filesRes = await fetch(\`\${BASE}/files?q=invoice\`, { headers });
const { data: files } = await filesRes.json();
console.log(files.map(f => f.filename));

// 2. Download ciphertext
const fileId = files[0].id;
const dlRes = await fetch(\`\${BASE}/files/\${fileId}/download\`, { headers });
const ciphertext = Buffer.from(await dlRes.arrayBuffer());
const wrappedKey = dlRes.headers.get("X-Wrapped-Key");

// 3. Agent moves ciphertext; decryption requires owner's key
const fs = await import("fs");
fs.writeFileSync("encrypted.bin", ciphertext);
console.log(\`Wrapped key: \${wrappedKey}\`);
console.log(\`Downloaded \${ciphertext.length} bytes\`);`,
    },
    {
      lang: "pseudocode",
      label: "Agent logic",
      code: `AGENT: Reconciliation Bot
SCOPES: files:list, files:read_metadata, files:download_ciphertext

1. SEARCH files where name contains "invoice"
   → GET /api/v1/files?q=invoice
   → receive list of {id, filename, file_size, created_at}

2. FOR EACH matching file:
   a. DOWNLOAD ciphertext
      → GET /api/v1/files/{id}/download
      → receive: encrypted bytes + X-Wrapped-Key header

   b. STORE ciphertext in agent workspace
      (agent cannot decrypt — no PIN, no RSA private key)

   c. LOG metadata for reconciliation record

3. NOTIFY owner that N files are staged for review
   Owner opens ABRN Drive → decrypts in browser → confirms

TRUST BOUNDARY:
  Agent sees: filenames, sizes, timestamps, ciphertext
  Agent cannot see: file contents, decryption keys, PIN
  Owner controls: which scopes the agent has, revoke anytime`,
    },
  ];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
    >
      <Copy className="w-3 h-3" />
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function PipelineExamplesSection() {
  const [activeLang, setActiveLang] = useState<Lang>("curl");
  const snippets = buildSnippets();
  const activeSnippet = snippets.find((s) => s.lang === activeLang) ?? snippets[0];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Workflow className="w-5 h-5 text-[#7d4f50]" />
          File fetch pipeline
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Copy-paste the full search &rarr; download &rarr; decrypt workflow. Agents move ciphertext; owners decrypt.
        </p>
      </div>

      <div className="rounded-2xl border border-[#e8d9d0] dark:border-slate-700 bg-[linear-gradient(180deg,#fffdfb_0%,#f8f3ef_100%)] dark:bg-[linear-gradient(180deg,rgba(30,41,59,0.96)_0%,rgba(15,23,42,0.92)_100%)] px-4 py-3">
        <div className="grid gap-2 sm:grid-cols-3 text-[11px] text-slate-600 dark:text-slate-300">
          <div className="rounded-xl border border-white/70 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-3 py-2">
            <span className="font-medium text-emerald-700 dark:text-emerald-400">Step 1</span> — Search files by name or metadata
          </div>
          <div className="rounded-xl border border-white/70 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-3 py-2">
            <span className="font-medium text-sky-700 dark:text-sky-400">Step 2</span> — Download ciphertext + wrapped key
          </div>
          <div className="rounded-xl border border-white/70 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-3 py-2">
            <span className="font-medium text-amber-700 dark:text-amber-400">Step 3</span> — Owner decrypts with PIN in browser
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
          {snippets.map((s) => (
            <button
              key={s.lang}
              type="button"
              onClick={() => setActiveLang(s.lang)}
              className={`px-4 py-2 text-xs font-medium transition-colors ${
                activeLang === s.lang
                  ? "bg-white dark:bg-slate-900 text-[#7d4f50] border-b-2 border-[#7d4f50]"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="bg-slate-900 dark:bg-slate-950 px-4 py-3">
          <div className="flex justify-end mb-2">
            <CopyButton text={activeSnippet.code} />
          </div>
          <pre className="text-[11px] text-emerald-400 font-mono whitespace-pre-wrap break-all leading-relaxed overflow-x-auto">
            {activeSnippet.code}
          </pre>
        </div>
      </div>
    </div>
  );
}
