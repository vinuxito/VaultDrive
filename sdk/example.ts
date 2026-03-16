import { ABRNClient } from "./client";

async function main() {
  const client = new ABRNClient({
    baseUrl: "https://abrndrive.filemonprime.net/abrn/api",
    apiKey: process.env.ABRN_KEY ?? "",
  });

  const whoami = await client.introspect();
  console.log("Auth type:", whoami.data.auth_type);
  console.log("Scopes:", whoami.data.scopes);

  const { data: files } = await client.listFiles("invoice");
  console.log(`Found ${files.length} files matching "invoice"`);

  for (const file of files.slice(0, 3)) {
    console.log(`  ${file.filename} (${file.file_size} bytes, ${file.origin ?? "vault"})`);

    const trust = await client.getFileTrust(file.id);
    console.log(`    Protection: ${trust.data.protection}`);
    console.log(`    Access: ${trust.data.access_state}`);

    const dl = await client.downloadFile(file.id);
    console.log(`    Downloaded ${dl.ciphertext.byteLength} bytes of ciphertext`);
    console.log(`    Wrapped key present: ${dl.wrappedKey ? "yes" : "no"}`);
  }

  const { data: auditEvents } = await client.listAudit({
    resource_type: "agent_api_key",
    limit: 5,
  });
  console.log(`\nRecent agent events: ${auditEvents.length}`);
  for (const event of auditEvents) {
    console.log(`  ${event.action} at ${event.created_at}`);
  }
}

main().catch(console.error);
