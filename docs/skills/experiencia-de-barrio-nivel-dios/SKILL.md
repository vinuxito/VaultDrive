---
name: experiencia-de-barrio-nivel-dios
description: >-
  Universal human-first UI/UX architecture & quality filter skill. Guarantees that any
  digital product or screen survives a real human with zero patience, one hand on a
  phone, bad connectivity, interruptions, and no interest in manuals. Transmutes maximum
  system capability into minimum human effort and builds software that understands intent.
---

# Experiencia de Barrio Nivel Dios — Universal Human-First Architecture Skill

> **Universal Operational Protocol & UX Quality Filter**  
> *"Build for people like their time, attention, dignity, and mistakes matter."*  
> *"Yesterday’s lived annoyance becomes tomorrow’s default engineering behavior."*

---

## 1. IDENTITY & OPERATING DOCTRINE

This skill is **not an aesthetic** and it is **not about making software look folksy**.  
It is an **architectural filter of human dignity and low cognitive load**.

Traditional software throws databases and buttons in the user's face:
> *"Here are 14 inputs and a submit button. Good luck. If you fail, read this red error code."*

Software built under **Experiencia de Barrio Nivel Dios** acts as an elite, empathetic work partner:
> *"I understand what task you are trying to pull off, what just changed, what remains unresolved, and what your next safe move is."*

### The Core Contract of Respect
1. **Respect the user enough not to make them feel stupid.** If they are confused, the interface failed, not their brain.
2. **Respect reality enough not to fake certainty.** Never show false zeros or optimistic illusions when data is pending.
3. **Respect the code enough not to patch over rot.** If an interaction hurts, fix the underlying state machine.
4. **Respect the human enough to leave them ultimate authority.** The machine recommends and facilitates; the human signs off.
5. **Respect the evidence enough to let it overrule ego.** Only ship what cold reality and real devices prove works.

---

## 2. THE 7 IRON LAWS (THE BARRIO QUALITY GATES)

Every feature, page, form, modal, and API response must pass these 7 gates before being certified:

```
+-----------------------------------------------------------------------------------+
|                        EXPERIENCIA DE BARRIO NIVEL DIOS                           |
+-----------------------------------------------------------------------------------+
|  1. LEY TOLA:             ¿Qué pasó? ¿Cómo sé que jaló? ¿Qué sigue? (<300ms)      |
|  2. ERGONOMÍA DE SILLÓN:  Operación con 1 mano, pulgar en 40% inferior, targets ≥48px |
|  3. CERO MAMADAS:         Estados físicos reales. Prohibidos los falsos ceros ($0) |
|  4. RESCATE > DISCULPA:   Tu chamba sobrevivió. Nunca castigar al usuario por bugs |
|  5. LENGUAJE DE CANCHA:   Cero jerga de ingeniero. Verdad directa y entendible    |
|  6. HUELLA & RECIBOS:     Evidencia donde importa. Folios, marcas de tiempo, autor |
|  7. TEST DE LA ESQUINA:   "¿Y esta mamada qué?" respondido en <3 segundos         |
+-----------------------------------------------------------------------------------+
```

---

### 🥇 Law 1: La Ley Tola (Immediate Proof of Life)
After any user action (tap, submit, upload, swipe), the interface must answer three questions in **less than 300ms**:
1. **¿Qué pasó?** ("Se guardó tu pronóstico").
2. **¿Cómo sé que es neta?** Visual confirmation (green pulse/halo, haptic feedback, visible timestamp). No guessing whether the server received it.
3. **¿Qué sigue?** The primary button or next card immediately presents the logical next step; the user is never left stranded in an empty dead-end.

---

### 🛋️ Law 2: Ergonomía de Sillón y Pulgar Sucio (Couch-Approved)
Designed for a human lying on a couch, holding a 6.7" phone with one hand, eating tacos with the other, or carrying groceries.
- **Bottom 40% Rule:** All primary navigation, confirmation buttons, floating docks, and primary selectors must live in the natural sweep of the thumb.
- **Trucker Touch Targets:** Minimum tap target of **48×48px** with at least 8px clearance between destructive and constructive actions. No accidental mis-taps.
- **Zero Delicate Micro-Gestures:** Banish microscopic swipe thresholds, hidden pinch-to-zooms, or desktop-style hover tooltips.
- **Strict Single-Handed Orientation:** Viewport never requires two hands just to acknowledge an alert or close a modal.

---

### 🚫 Law 3: Estado Cero Mamadas (Truth in State & No False Zeros)
- **Banish False Zeros:** If data is loading, offline, or awaiting calculation, **never display `$0.00` or `0 puntos`**. That causes panic and looks like data loss. Display explicit semantic state: `[ Calculando en vivo... ]` or `[ Pendiente ]`.
- **Physical Distinction of States:**
  - *Guardado / Persistido:* Solid, peaceful, verified.
  - *Tentativo / En Tránsito:* Pulsing, dashed borders, explicit badge ("Sin guardar en servidor").
  - *Bloqueado / Cerrado:* Muted, locked padlock icon, readable without blinding contrast drops.
  - *Fallido:* Amber/Red, with an explicit 1-tap retry button.

---

### 🛟 Law 4: Rescate Sobre Disculpa (Recovery Over Apology)
When network, third-party APIs, or servers fail:
- **Anti-Pattern (Lazy Engineering):**
  > *"Error 500: Ocurrió un error inesperado al procesar su solicitud. Intente más tarde."* (Form cleared, 20 minutes of typing erased).
- **Barrio God-Mode Standard:**
  > *"Se nos cortó la señal un segundo, compadre. Pero tranquilo: **tus datos están a salvo aquí en tu teléfono**. En cuanto vuelva el internet, los mandamos solitos. Pícale aquí para reintentar ya."*
- **The Invariant:** **Never punish the user for server or network fragility.** Local state survives in `localStorage` or `IndexedDB`. Provide an explicit retry lever.

---

### 🗣️ Law 5: Lenguaje de Cancha (Human Plain Truth)
Eradicate engineer-speak from all user-facing surfaces:

| ❌ Engineer Jargon | ✅ Lenguaje de Cancha / Human Truth |
|---|---|
| `Internal Server Error 500: PDOException` | `Fuera de lugar. La jugada no pasó, pero no perdiste nada.` |
| `Resource locked by concurrent transaction` | `Alguien más está usando este registro en este momento.` |
| `Authentication token expired (401 Unauthorized)` | `Tu sesión descansó tantito. Pon tu clave y te dejamos exactamente donde estabas.` |
| `Invalid payload schema: field match_id missing` | `Falta elegir el ganador del partido 3 para poder continuar.` |
| `Upload aborted: MIME type image/heic not supported` | `Sube una foto normal (JPG, PNG o PDF); ese formato de iPhone no se deja leer.` |

---

### 🧾 Law 6: La Huella Digital (Evidence Where it Matters)
Trust is never requested; it is demonstrated with receipts:
- If money moved, display the bank, transaction folio, amount, and exact local timestamp.
- If a score changed, show the minute, goal scorer, and who verified it.
- If a rule or calculation took effect, state the exact reason: *"Ganaste $250 MXN porque empataste en 1er lugar con Filemón (bolsa dividida 50/50)"*.

---

### 👴 Law 7: El Test de la Esquina ("¿Y esta mamada qué?")
If a real human opens the screen on a crowded street and asks:
> *"¿Y esta mamada qué? ¿Para qué sirve o qué le pico?"*

...the product failed.  
Every screen must answer that question within **3 seconds** using:
1. A punchy, conversational headline in natural language.
2. Immediate context of where they stand.
3. Exactly **one luminous primary call to action** that pulls them forward.

---

## 3. THE INTENT ENGINE: FROM DATA STORAGE TO WORK PARTNER

When designing backend controllers, CLI commands, or frontend views, apply the **Intent Model**:

```
                       USER ACTIONS (RAW DATA)
                                  │
                                  ▼
                   ┌──────────────────────────────┐
                   │       INTENT DETECTOR        │
                   │  "What is the human actually │
                   │   trying to accomplish?"     │
                   └──────────────┬───────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
        SAFE / AUTOMATABLE STEP        AMBIGUOUS / HIGH-RISK STEP
        Execute instantly in background  Surface recommendation with receipt
        "I squared the 8 clear receipts  "Here is 1 doubtful payment ($300).
         for you automatically."         Apply to Arturo & Mariana? [Confirm]"
```

1. **Infer Context:** Don't ask what the system already knows (user role, active round, balance, pending items).
2. **Pre-calculate the Obvious:** If an action has only one sane resolution, propose it pre-filled rather than demanding manual entry.
3. **Keep Fingers on Levers:** High-consequence decisions (deleting data, closing financial periods, changing rules) always require explicit human confirmation.

---

## 4. AUDIT CHECKLIST FOR ANY AGENT (THE 10 COLD-REALITY QUESTIONS)

Before submitting or closing any task, the implementing agent must answer:

- [ ] **1. Thumb Sweep:** Can I complete the main task with only my thumb on a 360px viewport?
- [ ] **2. 48px Target:** Are all clickable buttons, pills, and toggles at least 48px tall/wide?
- [ ] **3. No False Zeros:** Does any widget display `$0` or `0` when data is actually absent or calculating?
- [ ] **4. Work Survival:** If I turn on Airplane Mode and click submit, does my input survive?
- [ ] **5. Plain Spanish/English:** Is there any stack trace, HTTP code, or database term shown to the user?
- [ ] **6. Receipt Visibility:** Is there a clear folio, timestamp, or visual confirmation that the action completed?
- [ ] **7. Fast Path (<300ms):** Does the UI give instant tactile/visual feedback before network roundtrips complete?
- [ ] **8. 3-Second Rule:** Does the screen explain what it does without requiring explanation?
- [ ] **9. Clean Recovery:** Does every error view provide a prominent, working escape/retry button?
- [ ] **10. Zero Dead Ends:** When a process completes, is the next step immediately presented?

---

## 5. INSTALLATION & USAGE ACROSS PROJECTS

### Method 1: Local Project Installation (Standard)
Drop this skill directory into your repository:
```bash
mkdir -p .agents/skills/experiencia-de-barrio-nivel-dios
cp -r /lamp/www/laquiniela/.agents/skills/experiencia-de-barrio-nivel-dios/* .agents/skills/experiencia-de-barrio-nivel-dios/
```

### Method 2: Global Link on this LAMP Host
Symlink into any project's skill registry:
```bash
ln -s /lamp/www/laquiniela/.agents/skills/experiencia-de-barrio-nivel-dios /lamp/www/<tu-proyecto>/.agents/skills/experiencia-de-barrio-nivel-dios
```

### Method 3: 1-Line Universal Installer Script
Run the bundled installer script:
```bash
bash /lamp/www/laquiniela/.agents/skills/experiencia-de-barrio-nivel-dios/install.sh /lamp/www/<tu-proyecto>
```

### How to Instruct an AI Agent to Use It
Add this instruction to your project's `AGENTS.md`, `CLAUDE.md`, or initial prompt:
> *"Before delivering any frontend, flow, or error recovery, audit your work against the `experiencia-de-barrio-nivel-dios` skill. No technical jargon, no false zeros, thumb-friendly ergonomics, and zero dead ends."*

---

## 6. ABRN-DRIVE (VAULTDRIVE) COMPONENT MAPPING (`v13–v18`)

| Barrio Law | ABRN-Drive Implementation |
|---|---|
| **1. Ley Tola (`<300ms`)** | `ReciboSagradoCard.tsx` (desktop) & `MobileProofPill.tsx` (mobile) display real SHA-256 ciphertext hash + 1-tap Share immediately upon upload; `VaultOmnibar.tsx` searches 550+ docs in `<1.5ms`. |
| **2. Ergonomía de Sillón** | `login.tsx` fits 100% of inputs, PIN switcher, and submit CTA above the fold on `480×960` portrait; `BottomNav.tsx` and radial FAB keep primary levers in the lower 40% thumb zone with `48px` targets. |
| **3. Estado Cero Mamadas** | `VaultPrivacyShutter.tsx` uses tactile 4x3 `SovereignPinPad` (zero virtual keyboard jump); single-surface clean empty vault state without mock crypto buttons or false zeros. |
| **4. Rescate Sobre Disculpa** | IndexedDB `rescue-ledger` survives offline drops; `globalVaultSearchIndex.syncDocuments()` preserves local triage `#tags` and snippets across server metadata refreshes. |
| **5. Lenguaje de Cancha** | `home.tsx` and `drive.json` (`en`/`es`) use human sovereignty copy and natural-language activity feeds (zero `snake_case` telemetry noise). |
| **6. La Huella Digital** | `FilePreviewModal.tsx`, `ReciboSagradoCard.tsx`, and `drop.tsx` show live SHA-256 seals, Folios, and 1-tap TXT/WhatsApp receipts. |
| **7. Test de la Esquina (`<3s`)** | `document-triage.ts` (`triageFileObject`) classifies CFDI 4.0 XMLs, contracts, bank statements, and IDs locally in RAM and offers 1-click **`Auto-nombrar: {suggestedFilename}`** (`data-testid="triage-auto-rename-btn"`). |

