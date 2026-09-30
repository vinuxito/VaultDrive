# Step 6: Lenguaje de Cancha, Test de la Esquina y Verificación Integral

> **Iron Law 5 (Lenguaje de Cancha)**: *"Eradicate engineer-speak from all user-facing surfaces. Human plain truth without losing technical prestige."*  
> **Iron Law 7 (Test de la Esquina)**: *"¿Y esta mamada qué? Every screen answers in <3 seconds with one luminous primary call to action."*

---

## 1. Problem Statement & Current Bottlenecks

1. **Jargon Alienation**: Non-technical users opening ABRN Drive are still greeted with intimidating acronyms: `AES-256-GCM`, `PBKDF2 (100,000 iterations)`, `Shamir Secret Sharing (k of n)`, `Key derivation failed`, and `HTTP 401 Unauthorized`.
2. **Missing 3-Second Context (Test de la Esquina)**: When navigating between `Files`, `Access Center`, and `Shared`, the headers are descriptive database tags rather than actionable human orientation. A user asks: *"¿Y qué hago aquí?"* and has to read multiple paragraphs.
3. **Multi-Platform Reality**: Changes must be proven to work flawlessly across Desktop Chrome and Native Android 13 (Waydroid LineageOS 20) with cold execution evidence.

---

## 2. Proposed Architecture & Humanization Audit

```
+-----------------------------------------------------------------------------------+
|                        LENGUAJE DE CANCHA DICTIONARY                              |
+-----------------------------------------------------------------------------------+
|  ❌ CRYPTIC ENGINEER JARGON               │  ✅ LENGUAJE DE CANCHA (HUMAN TRUTH)  |
|───────────────────────────────────────────┼───────────────────────────────────────|
|  Client-side AES-256-GCM encryption       │  Blindado en tu dispositivo           |
|  PBKDF2 key derivation failed             │  Tu contraseña o PIN no coincide      |
|  Shamir Secret Sharing (3 of 5 fragments) │  Llaves de auxilio (tienes 3 de 5)    |
|  Session token expired (401 Unauthorized) │  Tu sesión descansó por seguridad     |
|  Resource locked by concurrent mutation   │  Alguien más está usando este archivo |
|  Payload validation error: missing field  │  Falta escribir el nombre             |
+-----------------------------------------------------------------------------------+
```

### Files to Modify
- **[MODIFY] `vaultdrive_client/src/i18n/locales/es/drive.json`**: Translate all technical alerts, error strings, and tooltips into respectful, plain Mexican Spanish.
- **[MODIFY] `vaultdrive_client/src/i18n/locales/en/drive.json`**: Align English copy with direct, natural, non-jargon phrasing.
- **[MODIFY] `vaultdrive_client/src/pages/files.tsx`**: Add the 3-second contextual hero strip (`Tus Archivos (X blindados) · Todo en orden`).
- **[MODIFY] `vaultdrive_client/src/pages/access-center.tsx`**: Add 3-second orientation headline (`Rutas de Acceso · Quien puede ver tus archivos y ligas de subida`).
- **[MODIFY] `README.md`**: Record the v13 milestone, test counts, and architecture reports.

---

## 3. Step-by-Step Implementation Details

### A. The Cancha Translation Pass (`i18n`)
1. Audit and replace error messages:
   - Instead of *"Failed to unwrap folder key with private key"*:  
     *"No pudimos abrir esta carpeta con tus llaves actuales. Revisa que tu PIN sea el correcto."*
   - Instead of *"Token expired (401)"*:  
     *"Tu sesión descansó un momento por seguridad. Pon tu PIN y te dejamos exactamente donde estabas."*
   - Instead of *"Invalid file signature / integrity check failed"*:  
     *"El archivo parece dañado o fue modificado en el camino. No es seguro abrirlo."*
2. Reassuring affirmative states:
   - *"Bóveda blindada y al día."*
   - *"Todo seguro. Nadie en la red puede ver tus archivos."*

### B. Test de la Esquina Header Pass
1. On `pages/files.tsx`:
   - Replace complex metric headers with a clean, confident punchline:
     ```tsx
     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
       <div>
         <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
           <ShieldCheck className="w-5 h-5 text-emerald-500" />
           Tus Archivos
         </h1>
         <p className="text-xs text-muted-foreground">
           {visibleFiles.length} documentos blindados en tu chip · Todo en orden
         </p>
       </div>
       {/* Exactly one primary luminous CTA */}
       <Button onClick={triggerUpload} className="hidden sm:inline-flex gap-2">
         <Upload className="w-4 h-4" />
         Subir Archivo
       </Button>
     </div>
     ```
2. On `pages/access-center.tsx`:
   - Clear headline: *"¿Quién tiene acceso a tus cosas?"* with instantaneous summary counts.

---

## 4. Verification & Quality Gate (The Full 8K Reality Battery)

### Cold Execution Verification Battery
1. **Frontend Unit & Component Tests**:
   - `npm test` across all 104+ test suites. Target: 100% pass rate.
2. **Strict TypeScript Compilation**:
   - `npm run typecheck` (`tsc -b && tsc -p tsconfig.e2e.json --noEmit`): 0 errors.
3. **Production Bundle Build**:
   - `npm run build`: Exit code 0, verifying clean tree and asset hashing.
4. **Backend Contract Tests**:
   - `PATH="/home/vinuxito/.cache/abrndrive-recovery/go/bin:$PATH" DB_URL='' go test ./...`
   - `PATH="/home/vinuxito/.cache/abrndrive-recovery/go/bin:$PATH" go vet ./...`
5. **Native Android 13 Waydroid Verification**:
   - Run `python3 .agents/skills/filemon-remote-mobile/scripts/filemon_mobile_client.py audit https://abrndrive.filemonprime.net/abrn/files`
   - Assert: `Verdict: PASSED`, thumb targets $\ge 48\text{px}$, bottom clearance $> 80\text{px}$, zero JS console errors.
6. **Documentation Deliverables**:
   - Create session memory in `docs/memories/`
   - Create Markdown verification report in `docs/reports/`
   - Create self-contained HTML verification report in `docs/reports/`
   - Commit & push cleanly to `origin/main`.
