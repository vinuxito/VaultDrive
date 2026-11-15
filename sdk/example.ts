import {
  AbrnDriveClient,
  encryptAndUploadForOwner,
  downloadAndDecryptWithPrivateKey,
} from "./index.ts";

async function main() {
  const client = new AbrnDriveClient({
    baseUrl: process.env.ABRN_BASE_URL ?? "https://app.abrn.mx/abrn/api",
    apiKey: process.env.ABRN_API_KEY ?? "",
  });

  const whoami = await client.introspect();
  console.log("Auth type:", whoami.data.auth_type, "Kind:", whoami.data.key_kind);
  console.log("Scopes:", whoami.data.scopes);
  if (whoami.data.allowed_folder_ids?.length) {
    console.log("Folder jail:", whoami.data.allowed_folder_ids);
  }

  // Zero-knowledge encrypted upload to owner vault (RSA-OAEP + AES-256-GCM)
  const uploaded = await encryptAndUploadForOwner(client, {
    filename: "cfdi-resumen.txt",
    data: "Factura A-1029 timbrada",
    mimeType: "text/plain",
  });
  console.log(`Uploaded encrypted ciphertext ID=${uploaded.file.id} sha256=${uploaded.sha256}`);

  // Download and decrypt locally when ABRN_RSA_PRIVATE_KEY_PEM is provided
  const privateKeyPem = process.env.ABRN_RSA_PRIVATE_KEY_PEM;
  if (privateKeyPem) {
    const decrypted = await downloadAndDecryptWithPrivateKey(client, uploaded.file.id, privateKeyPem);
    console.log(`Decrypted ${decrypted.filename} (sha256 verified=${decrypted.sha256Verified}): ${decrypted.text()}`);
  }

  // Special Delete-Only key soft-delete (recoverable in app Papelera)
  if (process.env.ABRN_DELETE_API_KEY) {
    const deleter = new AbrnDriveClient({
      baseUrl: process.env.ABRN_BASE_URL ?? "https://app.abrn.mx/abrn/api",
      apiKey: process.env.ABRN_DELETE_API_KEY,
    });
    await deleter.softDeleteFile(uploaded.file.id, "Limpieza automatizada de prueba");
    console.log(`Moved ${uploaded.file.id} to Recoverable Trash via Special Delete-Only key`);
  }
}

main().catch(console.error);
