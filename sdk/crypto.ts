// Zero-knowledge WebCrypto primitives for ABRN Drive.
// Uses globalThis.crypto.subtle cleanly across Node 20+/22+ and modern browsers with zero third-party deps.

function getSubtle(): SubtleCrypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error("WebCrypto SubtleCrypto is unavailable in this runtime");
  }
  return globalThis.crypto.subtle;
}

export function arrayBufferToBase64(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const clean = b64.trim();
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(view)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Hex(data: Uint8Array | ArrayBuffer | string): Promise<string> {
  const bytes = typeof data === "string"
    ? new TextEncoder().encode(data)
    : data instanceof Uint8Array
      ? data
      : new Uint8Array(data);
  const digest = await getSubtle().digest("SHA-256", bytes as BufferSource);
  return bytesToHex(digest);
}

function wrapPemBlock(label: string, der: ArrayBuffer): string {
  const b64 = arrayBufferToBase64(der);
  const lines = b64.match(/.{1,64}/g) ?? [b64];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
}

function stripPemHeaders(pemOrBase64: string, labels: string[]): string {
  let raw = pemOrBase64.trim();
  for (const label of labels) {
    raw = raw
      .replace(`-----BEGIN ${label}-----`, "")
      .replace(`-----END ${label}-----`, "");
  }
  return raw.replace(/\s+/g, "");
}

export interface GeneratedRsaKeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeyPem: string;
  privateKeyPem: string;
  publicKeySpkiBase64: string;
  privateKeyPkcs8Base64: string;
}

export async function generateBotRsaKeyPair(modulusLength = 2048): Promise<GeneratedRsaKeyPair> {
  const pair = await getSubtle().generateKey(
    {
      name: "RSA-OAEP",
      modulusLength,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  const spki = await getSubtle().exportKey("spki", pair.publicKey);
  const pkcs8 = await getSubtle().exportKey("pkcs8", pair.privateKey);
  return {
    publicKey: pair.publicKey,
    privateKey: pair.privateKey,
    publicKeyPem: wrapPemBlock("PUBLIC KEY", spki),
    privateKeyPem: wrapPemBlock("PRIVATE KEY", pkcs8),
    publicKeySpkiBase64: arrayBufferToBase64(spki),
    privateKeyPkcs8Base64: arrayBufferToBase64(pkcs8),
  };
}

export async function importRsaPublicKeySpki(pemOrBase64: string): Promise<CryptoKey> {
  const b64 = stripPemHeaders(pemOrBase64, ["PUBLIC KEY"]);
  const spkiBuffer = base64ToArrayBuffer(b64);
  return getSubtle().importKey(
    "spki",
    spkiBuffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.byteLength + b.byteLength);
  out.set(a, 0);
  out.set(b, a.byteLength);
  return out;
}

function encodeDerLength(length: number): Uint8Array {
  if (length < 0x80) return Uint8Array.of(length);
  const bytes: number[] = [];
  let rem = length;
  while (rem > 0) {
    bytes.unshift(rem & 0xff);
    rem >>= 8;
  }
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

function encodeDer(tag: number, value: Uint8Array): Uint8Array {
  return concatBytes(Uint8Array.of(tag), concatBytes(encodeDerLength(value.length), value));
}

function wrapPkcs1AsPkcs8(pkcs1Key: Uint8Array): ArrayBuffer {
  const version = Uint8Array.of(0x02, 0x01, 0x00);
  const rsaAlgId = Uint8Array.of(
    0x30, 0x0d,
    0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
    0x05, 0x00
  );
  const octet = encodeDer(0x04, pkcs1Key);
  const seq = encodeDer(0x30, concatBytes(version, concatBytes(rsaAlgId, octet)));
  return seq.buffer.slice(seq.byteOffset, seq.byteOffset + seq.byteLength) as ArrayBuffer;
}

export async function importRsaPrivateKeyPkcs8(pemOrBase64: string): Promise<CryptoKey> {
  const trimmed = pemOrBase64.trim();
  let pkcs8Buffer: ArrayBuffer;
  if (trimmed.includes("BEGIN RSA PRIVATE KEY")) {
    const pkcs1B64 = stripPemHeaders(trimmed, ["RSA PRIVATE KEY"]);
    pkcs8Buffer = wrapPkcs1AsPkcs8(new Uint8Array(base64ToArrayBuffer(pkcs1B64)));
  } else {
    const b64 = stripPemHeaders(trimmed, ["PRIVATE KEY"]);
    pkcs8Buffer = base64ToArrayBuffer(b64);
  }
  return getSubtle().importKey(
    "pkcs8",
    pkcs8Buffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );
}

export async function generateAesGcmKey(): Promise<CryptoKey> {
  return getSubtle().generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function encryptBytesAesGcm(
  plaintext: Uint8Array | ArrayBuffer,
  key: CryptoKey
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array; ivBase64: string }> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const input = plaintext instanceof Uint8Array ? plaintext : new Uint8Array(plaintext);
  const encrypted = await getSubtle().encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    input as BufferSource
  );
  return {
    ciphertext: new Uint8Array(encrypted),
    iv,
    ivBase64: arrayBufferToBase64(iv),
  };
}

export async function decryptBytesAesGcm(
  ciphertext: Uint8Array | ArrayBuffer,
  key: CryptoKey,
  ivOrBase64: Uint8Array | string
): Promise<Uint8Array> {
  const iv = typeof ivOrBase64 === "string"
    ? new Uint8Array(base64ToArrayBuffer(ivOrBase64))
    : ivOrBase64;
  const input = ciphertext instanceof Uint8Array ? ciphertext : new Uint8Array(ciphertext);
  const decrypted = await getSubtle().decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    input as BufferSource
  );
  return new Uint8Array(decrypted);
}

export async function wrapKeyRsaOaep(publicKey: CryptoKey, aesKey: CryptoKey): Promise<string> {
  const rawKey = await getSubtle().exportKey("raw", aesKey);
  const wrapped = await getSubtle().encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    rawKey
  );
  return arrayBufferToBase64(wrapped);
}

export async function unwrapKeyRsaOaep(privateKey: CryptoKey, wrappedKeyB64: string): Promise<CryptoKey> {
  const wrappedBytes = base64ToArrayBuffer(wrappedKeyB64);
  const rawKey = await getSubtle().decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    wrappedBytes
  );
  return getSubtle().importKey(
    "raw",
    rawKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

// Mirrors VaultDrive frontend wrapKeyWithAES: Base64([12-byte IV][AES-GCM wrapped DEK])
export async function wrapKeyAesGcm(wrappingKey: CryptoKey, fileKey: CryptoKey): Promise<string> {
  const rawFileKey = await getSubtle().exportKey("raw", fileKey);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const wrapped = await getSubtle().encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    wrappingKey,
    rawFileKey
  );
  const combined = new Uint8Array(12 + wrapped.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(wrapped), 12);
  return arrayBufferToBase64(combined);
}

export async function unwrapKeyAesGcm(wrappingKey: CryptoKey, wrappedB64: string): Promise<CryptoKey> {
  const data = new Uint8Array(base64ToArrayBuffer(wrappedB64));
  if (data.length <= 12) {
    throw new Error("Invalid AES-wrapped key payload");
  }
  const iv = data.subarray(0, 12);
  const ciphertext = data.subarray(12);
  const rawKey = await getSubtle().decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    wrappingKey,
    ciphertext as BufferSource
  );
  return getSubtle().importKey(
    "raw",
    rawKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export interface EncryptUploadClient {
  getMyPublicKey(): Promise<{ data: { public_key: string } }>;
  uploadEncryptedFile(formData: FormData, opts?: { idempotencyKey?: string }): Promise<{ replayed?: boolean; data: { id: string; filename: string; file_size: number; folder_id?: string | null; metadata?: string } }>;
}

export interface DownloadDecryptClient {
  downloadFile(fileId: string): Promise<{
    ciphertext: ArrayBuffer;
    wrappedKey: string;
    folderWrappedKey?: string;
    credentialScheme?: string;
    fileMetadata: string;
    filename: string;
  }>;
  getFile(fileId: string): Promise<{ data: { filename?: string; metadata?: string } }>;
}

function toBytes(data: Uint8Array | ArrayBuffer | string): Uint8Array {
  if (typeof data === "string") {
    return new TextEncoder().encode(data);
  }
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

export async function encryptAndUploadForOwner(
  client: EncryptUploadClient,
  options: {
    filename: string;
    data: Uint8Array | ArrayBuffer | string;
    folderId?: string;
    mimeType?: string;
    extraMetadata?: Record<string, unknown>;
    recipientPublicKeySpki?: string;
    idempotencyKey?: string;
  }
) {
  const plainBytes = toBytes(options.data);
  const plainSha256 = await sha256Hex(plainBytes);

  let publicKeySpki = options.recipientPublicKeySpki;
  if (!publicKeySpki) {
    const pkResp = await client.getMyPublicKey();
    publicKeySpki = pkResp.data.public_key;
  }
  const rsaPublicKey = await importRsaPublicKeySpki(publicKeySpki);

  const dek = await generateAesGcmKey();
  const { ciphertext, ivBase64 } = await encryptBytesAesGcm(plainBytes, dek);
  const wrappedKey = await wrapKeyRsaOaep(rsaPublicKey, dek);

  const mimeType = options.mimeType ?? "application/octet-stream";
  const metadataPayload = {
    originalName: options.filename,
    originalSize: plainBytes.byteLength,
    mimeType,
    sha256: plainSha256,
    iv: ivBase64,
    algorithm: "AES-256-GCM",
    credential_scheme: "rsa",
    ...(options.extraMetadata ?? {}),
  };

  const formData = new FormData();
  const cipherCopy = new Uint8Array(ciphertext.byteLength);
  cipherCopy.set(ciphertext);
  formData.append("file", new Blob([cipherCopy.buffer], { type: "application/octet-stream" }), options.filename);
  formData.append("iv", ivBase64);
  formData.append("algorithm", "AES-256-GCM");
  formData.append("wrapped_key", wrappedKey);
  formData.append("credential_scheme", "rsa");
  formData.append("metadata", JSON.stringify(metadataPayload));
  if (options.folderId) {
    formData.append("folder_id", options.folderId);
  }

  const uploaded = await client.uploadEncryptedFile(formData, { idempotencyKey: options.idempotencyKey });
  return {
    file: uploaded.data,
    replayed: uploaded.replayed,
    sha256: plainSha256,
    wrappedKey,
    ivBase64,
  };
}

export async function decryptFolderKeyWithPrivateKey(
  wrappedFolderKeyB64: string,
  privateKeyOrPem: CryptoKey | string
): Promise<CryptoKey> {
  const priv = typeof privateKeyOrPem === "string"
    ? await importRsaPrivateKeyPkcs8(privateKeyOrPem)
    : privateKeyOrPem;
  return unwrapKeyRsaOaep(priv, wrappedFolderKeyB64);
}

export async function encryptAndUploadWithFolderKey(
  client: EncryptUploadClient,
  options: {
    filename: string;
    data: Uint8Array | ArrayBuffer | string;
    folderId: string;
    folderKey: CryptoKey;
    mimeType?: string;
    extraMetadata?: Record<string, unknown>;
    idempotencyKey?: string;
  }
) {
  const plainBytes = toBytes(options.data);
  const plainSha256 = await sha256Hex(plainBytes);

  const dek = await generateAesGcmKey();
  const { ciphertext, ivBase64 } = await encryptBytesAesGcm(plainBytes, dek);
  const wrappedKey = await wrapKeyAesGcm(options.folderKey, dek);

  const mimeType = options.mimeType ?? "application/octet-stream";
  const metadataPayload = {
    originalName: options.filename,
    originalSize: plainBytes.byteLength,
    mimeType,
    sha256: plainSha256,
    iv: ivBase64,
    algorithm: "AES-256-GCM",
    credential_scheme: "folder",
    ...(options.extraMetadata ?? {}),
  };

  const formData = new FormData();
  const cipherCopy = new Uint8Array(ciphertext.byteLength);
  cipherCopy.set(ciphertext);
  formData.append("file", new Blob([cipherCopy.buffer], { type: "application/octet-stream" }), options.filename);
  formData.append("iv", ivBase64);
  formData.append("algorithm", "AES-256-GCM");
  formData.append("wrapped_key", wrappedKey);
  formData.append("credential_scheme", "folder");
  formData.append("folder_id", options.folderId);
  formData.append("metadata", JSON.stringify(metadataPayload));

  const uploaded = await client.uploadEncryptedFile(formData, { idempotencyKey: options.idempotencyKey });
  return {
    file: uploaded.data,
    replayed: uploaded.replayed,
    sha256: plainSha256,
    wrappedKey,
    ivBase64,
  };
}

export async function downloadAndDecryptWithPrivateKey(
  client: DownloadDecryptClient,
  fileId: string,
  privateKeyOrPem: CryptoKey | string,
  options?: { folderKey?: CryptoKey; verifySha256?: boolean }
) {
  const priv = typeof privateKeyOrPem === "string"
    ? await importRsaPrivateKeyPkcs8(privateKeyOrPem)
    : privateKeyOrPem;

  const dl = await client.downloadFile(fileId);
  let metaRaw = dl.fileMetadata;
  let fallbackFilename = dl.filename;
  if (!metaRaw || !metaRaw.includes('"iv"')) {
    const fileMetaResp = await client.getFile(fileId);
    metaRaw = fileMetaResp.data.metadata || metaRaw;
    fallbackFilename = fallbackFilename || fileMetaResp.data.filename || fileId;
  }

  let metadata: Record<string, unknown> = {};
  if (metaRaw) {
    try {
      metadata = JSON.parse(metaRaw) as Record<string, unknown>;
    } catch {
      throw new Error("Invalid X-File-Metadata JSON returned by server");
    }
  }

  const iv = typeof metadata.iv === "string" ? metadata.iv : "";
  if (!iv) {
    throw new Error("File metadata does not contain decryption IV");
  }

  const scheme = (dl.credentialScheme || (typeof metadata.credential_scheme === "string" ? metadata.credential_scheme : "rsa")).toLowerCase();
  if (!dl.wrappedKey) {
    throw new Error("Missing X-Wrapped-Key header in download response; cannot decrypt zero-knowledge file");
  }

  let dek: CryptoKey;
  if (scheme === "folder") {
    let folderKey = options?.folderKey;
    if (!folderKey) {
      if (!dl.folderWrappedKey) {
        throw new Error("Folder-encrypted file requires either options.folderKey or X-Folder-Wrapped-Key header");
      }
      folderKey = await unwrapKeyRsaOaep(priv, dl.folderWrappedKey);
    }
    dek = await unwrapKeyAesGcm(folderKey, dl.wrappedKey);
  } else if (scheme === "rsa" || scheme === "") {
    dek = await unwrapKeyRsaOaep(priv, dl.wrappedKey);
  } else {
    throw new Error(`File uses credential_scheme=${scheme} which requires password/PIN key derivation rather than RSA private key unwrapping`);
  }

  const plaintext = await decryptBytesAesGcm(dl.ciphertext, dek, iv);
  const actualSha256 = await sha256Hex(plaintext);
  const expectedSha256 = typeof metadata.sha256 === "string" ? metadata.sha256 : "";
  const sha256Verified = expectedSha256 ? actualSha256 === expectedSha256 : null;
  if (options?.verifySha256 !== false && expectedSha256 && !sha256Verified) {
    throw new Error(`Decrypted plaintext SHA-256 mismatch (expected ${expectedSha256}, got ${actualSha256})`);
  }

  return {
    data: plaintext,
    text: () => new TextDecoder().decode(plaintext),
    filename: (typeof metadata.originalName === "string" && metadata.originalName) || fallbackFilename || fileId,
    mimeType: (typeof metadata.mimeType === "string" && metadata.mimeType) || "application/octet-stream",
    sha256: actualSha256,
    sha256Verified,
    metadata,
  };
}
