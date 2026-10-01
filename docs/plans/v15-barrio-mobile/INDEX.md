# Experiencia de Barrio Nivel Dios — Mobile Sovereign Vault Upgrade (v15)
## Master Index & Execution Roadmap

> *"Máxima capacidad del sistema convertida en mínimo esfuerzo humano. Construye para personas cuyo tiempo, atención, pulgar y dignidad importan."*

---

### Architectural Mission & Context
ABRN Drive operates on top of high-performance infrastructure: a Go microsecond backend, local PostgreSQL 16 socket, client-side AES-256-GCM / Web Cryptography workers, and a live native Android 13 container (`filemon-mobile`) for cold reality verification.

However, the mobile interface currently behaves like a compressed desktop file explorer. This roadmap executes a thorough, sequential transformation under the strict doctrine of the `experiencia-de-barrio-nivel-dios` skill and the 7 Iron Laws of Barrio UX.

---

### Sequential Step Registry

| Step | Plan Document | Core Objective | Barrio Law Filtered |
|---|---|---|---|
| **01** | [Step 1: Ergonomía de Pulgar & Panic Deadbolt](01-thumb-ergonomics-and-panic-deadbolt.md) | Relocate emergency vault lock to bottom 40% thumb zone and mobile dock | **Ley 2: Ergonomía de Sillón** |
| **02** | [Step 2: Thumb-Friendly File Cards & Metadata](02-thumb-friendly-file-cards-and-metadata.md) | Display file size, date, AES-256 seal; 48px touch targets; kill 10px traps | **Ley 3: Cero Mamadas & Ley 7: Test de la Esquina** |
| **03** | [Step 3: Sovereign Mobile PIN Dialer](03-sovereign-mobile-pin-dialer.md) | Dedicated 4x3 tactile numeric dialpad; zero keyboard jump; auto-unlock on 4th digit | **Ley 2: Ergonomía de Sillón & Ley 1: Ley Tola** |
| **04** | [Step 4: Sovereign Mobile Capture](04-sovereign-mobile-capture-and-fab.md) | Direct-to-vault camera encryption (`capture="environment"`) & thumb speed-dial | **The Intent Engine & Ley 4: Rescate Total** |
| **05** | [Step 5: Mobile Folder Navigation](05-mobile-folder-navigation-and-sheets.md) | Swipeable breadcrumb chips & thumb-first folder bottom sheet (no desktop tree) | **Ley 2: Ergonomía & Ley 7: Test de la Esquina** |
| **06** | [Step 6: Ley Tola Proof of Life & Web Share](06-ley-tola-proof-and-native-share.md) | <300ms proof-of-life receipt pill & 1-tap native Web Share (WhatsApp/Telegram) | **Ley 1: Ley Tola & Ley 6: La Huella Digital** |

---

### Non-Negotiable Invariants
1. **Zero Regression on Cryptographic Fortress:** All existing AES-256-GCM, PBKDF2/Argon2, and zero-knowledge seals remain strictly preserved.
2. **Cold Verification with `filemon-mobile`:** Every mobile touch surface must be tested on live Android 13 (LineageOS 20) via Waydroid on Weston `:10.0`.
3. **Selective Test Execution:** In strict compliance with user instructions, do not run the full 110-file test battery concurrently. Run focused tests, `typecheck`, and `build`.
