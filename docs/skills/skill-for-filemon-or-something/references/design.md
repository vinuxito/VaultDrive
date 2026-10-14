# Design reference: color, contrast, buttons, touch, layout, copy

The contract is `DESIGN.md` (repo root). The tokens live in `public/assets/tokens.css` (the only
`:root`), the preview overrides in `[data-workspace-ui="preview"]` (same file plus
`public/assets/workspace.css`), and the dark theme in `:root[data-tema="oscuro"]` (`tokens.css`)
plus `public/assets/oscuro.css`. Reusable escaped markup lives in
`public/partials/_workspace_components.php`. Screen helpers live in `public/_layout.php`.

---

## 1. Who we design for

These people use the app for hours, with real money at stake:
- **Ángel / operations** loads the week's files, checks partner amounts, sends receipts or
  requests, and finds what is missing.
- **Víctor / tesorería** verifies documents and accounts, prepares and authorizes payments,
  produces the bank file, and records real results.
- **Socio** understands their own cut and supplies the XML. Usually on a phone, arriving by a
  signed link.
- **Store / operator / supervisor** works inventory, the point of sale (`mostrador.php`), stores,
  and territory.

Confusing buttons cause money mistakes. Vibrating colors burn eyes by 2 p.m. A 300 ms lag
feels exhausting. A 28 px target makes a thumb miss three times. The target feeling is a Swiss
watch, a working desk: crisp, instant, unambiguous. It is not a futuristic command center, and
`DESIGN.md` rules out giant gradients, glass panels, and theatrical finance language.

---

## 2. Color is luminance

- **Contrast is about luminance, not hue.** White paper reflects ~100% of light, black ink ~0%,
  and the contrast ratio compares the two. Two saturated hues (red on blue) can "look
  different" and still be unreadable. They also vibrate (chromostereopsis).
- **Squint test (la prueba del bizco).** Squint until colors fade to grey. Can you still read
  every button label? Can you still see where each card ends? If not, it fails. Fix it before
  anything else.

### The ladder (WCAG 2.2, AA is the target in `DESIGN.md`)

| Ratio | Meaning | Use |
|---|---|---|
| < 3:1 | danger zone | decorative borders only. The browser gate flags any **text** here. |
| ≥ 3:1 | large/bold text, meaningful UI borders, focus rings | |
| ≥ 4.5:1 | AA body text | prose, table cells, labels |
| ≥ 7:1 | AAA / "daylight punch" | the figure that decides, totals, H1 |

### Measured values for THIS repo's tokens (recomputed, not copied)

Formula: relative luminance per WCAG. Values from a small Python check on 2026-09-24.

| Pair | Ratio | Verdict |
|---|---:|---|
| `--text-main` #0f172a on white | 17.85 | AAA |
| `--tx-normal` #334155 on `--bg-card-subtle` #f1f5f9 | 9.45 | AAA |
| `--tx-rotulo` #475569 on white | 7.58 | AAA |
| `--text-muted` #64748b on white | 4.76 | AA body, barely |
| `--text-faint` #94a3b8 on white | **2.56** | fails for text. Only for "está ahí por si acaso" |
| white on `--accent` #0284c7 (default face) | **4.10** | fails AA for body text. OK only for ≥ 18.66 px bold or 24 px |
| white on `--accent-hover` #0369a1 | 5.93 | AA |
| white on preview `--accent` #2459d3 | 6.10 | AA |
| white on `--danger` #dc2626 | 4.83 | AA |
| white on `--success` #16a34a | **3.30** | fails for text. Use `--ok` #15803d or text-on-tint |
| `--success-text` #166534 on `--success-bg` | 6.81 | AA |
| `--warning-text` #92400e on `--warning-bg` | 6.84 | AA |
| `--danger-text` #991b1b on `--danger-bg` | 7.60 | AA |
| `--ok` #15803d on `--okbg` #dcfce7 | 4.57 | AA, barely |
| `--warn` #b45309 on `--warnbg` #fef3c7 | 4.51 | AA, barely |

**The amber/gold trap.** White on bright amber `#d97706` is 3.19:1. Either deepen the fill to
`#b45309` (white reaches 5.02) or put dark ink on the amber (`#0f172a` on `#d97706` is 5.6).
Better still, use tinted pills: `--warning-text` on `--warning-bg`.

Don't trust any ratio you did not measure. That includes the source manuals: they listed white
on `#16a34a` as 4.6 (really 3.30) and ink on gold as 9.8 (really 5.6). Recompute, or run the
rendered-contrast probe (verification.md §3). The probe measures what the browser paints, after
opacity, inheritance and dark-mode token swaps.

---

## 3. 60-30-10: suit, shirt, tie

```
60% suit   → canvas     var(--bg-main)            (#f8fafc; preview #f5f5f2)
30% shirt  → surfaces   var(--bg-card) + 1px var(--border-main), radius 10–12px, no heavy shadow
10% tie    → accent     var(--accent)  ONLY: the one primary action, active tab, focus ring,
                                               the figure that decides
```

If everything is colorful, nothing is important. Use accent like hot sauce.

**The law of `--tx-manda`.** It means "esto espera tu mano" and nothing else. It is not a
decorative border, a title, or an icon tint. On a finished day you shouldn't see it anywhere.

## 4. Token discipline (lessons this repo paid for)

- **One `:root`,** in `tokens.css`. New tokens go there, named by **job** (`--tx-rotulo`,
  `--borde-control`), never by value (`--gray-500`). The name comes from the property plus the
  selector that uses it. Three or fewer uses is not a system: leave it alone or fold it into an
  existing job.
- **Legacy aliases stay** (`--muted`, `--line`, `--ink`, `--blue`, `--ok`, `--warn`…). They
  have hundreds of uses, so renaming them in the same commit as another change hides which one
  broke things.
- **Before merging two colors, measure ΔE2000 and contrast.** Sometimes the number says it is
  a design change, not a refactor. Example: the `--tx-normal` collapse, #374151 to #334155,
  was ΔE 1.85 and contrast went 10.31 to 10.35.
- **Hex ratchet:** `tests/Integration/sistema_de_diseno_test.php` and `tokens_test.php` count
  served sizes and colors. Their ceilings only go down. Both are classified INDIRECTA in
  `tests/SEGURAS.md`, so they run on the clone only.
- **Source ink is data, not design.** A reproduced owner document, an e-mail body, an exported
  PNG/PDF, and brand marks (`--marca-whatsapp`, `--marca-outlook`…) keep their colors.
- **Alpha:** `var(--t,#hex)33` is not CSS, and the border silently turns opaque. Use
  `color-mix(in srgb, var(--t) 20%, transparent)`.
- **SVG:** the `fill=` attribute rejects `var()`. `style="fill:var(--…)"` works and beats the
  attribute.
- **Dark theme:** only `data-tema="oscuro"` moves tokens. It is opt-in with light as the
  default, because following the OS made 31/31 screens unreadable. White text (`--tx-invertido`)
  on a surface that **lightens** in dark (accent becomes #38bdf8) drops to about 2.1:1.
  `oscuro.css` re-points `--tx-invertido` for those selectors only. When you add a component
  whose background is accent, success, danger, warning, or text-main with `--tx-invertido`
  text, add its selector there. Tokens only, no hex.

---

## 5. The only four buttons (flat, per `DESIGN.md`)

The source recipe used gradient plus glow plus a 9999px pill. `DESIGN.md` forbids giant
gradients and heavy shadows and sets radius at 8 px for controls. Keep the **tiers**, drop the
chrome. Reuse existing classes (`.p-btn*`, `.btn`, `.mc-btn-touch`) before inventing any.

```css
/* Tier 1 — the ONE primary per screen ("Preparar pago", "Registrar pago", "Guardar") */
.p-btn-primary { min-height: var(--tap); padding: var(--sp-2) var(--sp-5);
  border-radius: 8px; border: 1px solid transparent;
  background: var(--accent); color: var(--tx-invertido);
  font-size: var(--fs-3); font-weight: var(--fw-fuerte);
  transition: transform var(--mov) ease, background-color var(--mov) ease; }
.p-btn-primary:hover { background: var(--accent-hover); }
/* Tier 2 — safe alternatives ("Ver recibo", "Exportar", "Filtros") */
.p-btn-secondary { min-height: var(--tap); border-radius: 8px;
  border: 1px solid var(--borde-control); background: var(--bg-card); color: var(--tx-fuerte); }
/* Tier 3 — quiet utilities ("Volver", "Cerrar", "Limpiar") */
.p-btn-ghost { min-height: var(--tap); background: transparent; border: 0; color: var(--tx-rotulo); }
.p-btn-ghost:hover { background: var(--accent-light); color: var(--accent-hover); }
/* Tier 4 — irreversible ("Anular corte", "Quitar cuenta") */
.p-btn-danger { min-height: var(--tap); border-radius: 8px;
  background: var(--danger); color: var(--tx-invertido); font-weight: var(--fw-fuerte); }
/* One press for all */
:is(.p-btn-primary,.p-btn-secondary,.p-btn-ghost,.p-btn-danger):active { transform: scale(.97); }
:is(.p-btn-primary,.p-btn-secondary,.p-btn-ghost,.p-btn-danger):focus-visible {
  outline: 3px solid var(--border-focus); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  :is(.p-btn-primary,.p-btn-secondary,.p-btn-ghost,.p-btn-danger) { transition: none; }
  :is(.p-btn-primary,.p-btn-secondary,.p-btn-ghost,.p-btn-danger):active { transform: none; }
}
```

This is an illustration of the tiers. Read the existing definitions in `premium.css` and
`base.css` first and change them only if the task is to change them. If white on the default
`--accent` (4.10:1) carries body-size text, make the label bold at ≥ 18.66 px or use
`--accent-hover` for the fill. Decide with a measurement.

**Rules.** Show only one Tier-1 button at a time, because three primaries freeze the user. A
disabled button gets an **adjacent** reason in text, not only a tooltip. Money confirmations
state who, company and week, action, amount, and effect before submit. An unknown outcome
reads "Comprobar estado", never an automatic retry.

## 6. Status pills

Use `pill($text, $tone)`, `estado_pill()` (`_layout.php`), or `workspace_status($label, $tone)`
(`_workspace_components.php`). Tinted surface, dark text of the same family, always a word:

| Meaning | Surface / text tokens | Example words |
|---|---|---|
| Proven done | `--success-bg` / `--success-text` (or `--okbg`/`--ok`) | "Pagado (con comprobante)", "Cuadra" |
| Pending action | `--warning-bg` / `--warning-text` | "Falta factura", "Por revisar" |
| Blocker / error | `--danger-bg` / `--danger-text` | "Bloqueado: falta CLABE" |
| In transit / info | `--transit-bg` / `--transit-text` | "Enviado a revisión" |
| Unknown / read-only | `--bg-card-subtle` / `--tx-rotulo` | "No disponible", "Sólo lectura" |

Green requires a **proven** completed step: an attached XML is not fiscal acceptance, and an
exported bank file is not payment. Every state needs text, never color alone.

---

## 7. Tactile physics

1. **Touch targets ≥ 48 px** on phones (`--tap`, `--mc-touch-min`), 44 px minimum anywhere.
   Fitts's law: a thumb is 10–14 mm wide. Row actions and table icons count too.
2. **Mobile inputs at 16 px** (iOS Safari zooms below that), with `inputmode="decimal"` for money
   and `inputmode="numeric"` for counts and ICCID digits.
3. **Micro-press:** `transform: scale(.97)` within `--mov: 140ms`, which tells the brain "I felt
   the click". Turn it off under `prefers-reduced-motion`.
4. **Web-Audio cues (optional).** An oscillator needs no audio files. It suits "eyes-up" work
   such as the counter (`mostrador.php`) or scanning SIMs. Only with all of these:
   - opt-in per viewer and off by default (a `localStorage` flag in try/catch);
   - never the only signal: the text or state change is the real outcome;
   - the success chime plays **only after the server confirmed** the action, never on click;
   - it respects a muted preference and must not throw if `AudioContext` is missing.

```js
var NrSonido = { ctx: null, on: false,
  init: function () { try { this.on = localStorage.getItem('nanored_sonido') === '1'; } catch (e) {} },
  c: function () { if (!this.on) return null;
    if (!this.ctx) { var A = window.AudioContext || window.webkitAudioContext; if (A) this.ctx = new A(); }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); return this.ctx; },
  beep: function (f, type, dur, g) { try { var c = this.c(); if (!c) return;
    var o = c.createOscillator(), v = c.createGain(); o.type = type || 'sine';
    o.frequency.setValueAtTime(f, c.currentTime); v.gain.setValueAtTime(g || .12, c.currentTime);
    v.gain.exponentialRampToValueAtTime(.0001, c.currentTime + dur);
    o.connect(v); v.connect(c.destination); o.start(); o.stop(c.currentTime + dur); } catch (e) {} },
  agregado: function () { this.beep(880, 'sine', .06, .12); },
  quitado:  function () { this.beep(440, 'triangle', .08, .10); },
  confirmado: function () { var s = this; s.beep(523.25,'sine',.15,.10);   // call ONLY after server OK
    setTimeout(function(){ s.beep(659.25,'sine',.15,.10); }, 60);
    setTimeout(function(){ s.beep(783.99,'sine',.25,.14); }, 120); },
  error: function () { this.beep(180, 'sawtooth', .16, .15); } };
```

---

## 8. Desktop vs phone

These are the `DESIGN.md` breakpoints, respecting available width, not user agent:
- **≥ 1280 px:** full sidebar (~232–260 px, `--wb-sidebar-width`) and list+detail side by side
  (~65/35, detail ≥ 320 px). Content max 1440 px. **Don't** force `100vh` with no scroll or
  nested fixed-height scroll just to look like a cockpit.
- **768–1279 px:** compact navigation, one primary pane, detail as a full-width section or a
  properly managed overlay.
- **< 768 px:** labeled mobile nav, stacked summary, partner cards with identity, amount, status,
  and action. Main actions go in the lower third or a sticky bottom dock (thumb zone), padded by
  `--sab`. Full detail screen with "Volver a la semana". No hover-only control.
- **Zero footprint across the boundary.** Phone overlays (bottom trays, floating capsules) must
  not exist on desktop, visually or for pointer hit-testing. `display:none` or
  `visibility:hidden` is free, but `opacity:0` still counts, still catches clicks, and inflated
  the served-element ratchets once.
- Reflow at 320 px and 200% zoom with no page-level horizontal scroll. A wide evidence table
  may get a **labeled** local scroll region. Keep pinch-zoom: never `maximum-scale=1` or
  `user-scalable=no`.

## 9. Content voice (plain Spanish for non-coders)

- Short sentences in sentence case. Use task verbs: "Cargar archivos", "Ver recibo", "Solicitar
  factura", "Preparar pago", "Registrar pago", "Ver comprobante".
- Each screen gets context, one H1 (`hero()` / `workspace_heading()`), one sentence explaining
  the task, one primary action, the content, then secondary details.
- Show partners by `display_title`, and `titular_nombre` labeled "Titular" where identity
  matters. The visible name is never a key.
- Missing data states its reason ("No disponible: falta una semana sellada"). `NO_EVALUABLE`
  never shows as `$0.00`.
- A sentence is a claim. Check it against what the database knows: "100 % cuadrada" after
  comparing 0 figures was a real bug. "PayJoy (552)" over 366 rows was another.
- Character is welcome if the eye understands at once (the "Consigliere Fiscal" rule): "Así se
  verá" beats "Glass Twin"; "Mesa soberana", "docket", "monóculo" go.

## 10. From the source, dropped or changed (and why)

- **The 10 Evinux tenant themes** (`uilightness`, `evinuxnet`, `frog`… in
  `css/vx-theme-tokens.css`) and the `vx-` tokens were dropped. NanoRed has one palette, one
  `:root`, and an opt-in dark theme. Adding tenants would be new scope.
- **Gradient + glow + 9999px pill buttons** were flattened, because `DESIGN.md` avoids giant
  gradients, glass panels, and heavy shadows and specifies 8 px control radius.
- **Hard-coded hex in recipes** became tokens, because of the hex ratchet.
- **Contrast figures:** several were wrong and were replaced by measured values (§2).
- **The desktop "100vh, zero scroll" law and the 820 px breakpoint** were replaced by the
  `DESIGN.md` breakpoints, which rule out nested fixed-height scroll.
- **`user-scalable=no, maximum-scale=1.0`** was dropped because it breaks WCAG zoom.
- **Body theme class from `$Emisor->eUITheme`** was dropped, because the theme comes from
  `layout_head()` and `data-tema`.
- **`$verJS` bump** was replaced by `asset()` content hashing.
- **`node tools/viejito_full_app_audit.cjs` and `.agents/skills/cfd-mobile-grid/...`** were
  replaced by this repo's runners (verification.md), since those paths don't exist here.
- **jQuery `global:false` / blockUI trap:** there is no jQuery here. The equivalent is the CSRF
  token plus no double-submit.
- **SAT `PUE`+`99` rule and the `cfds` table** belong to another product and were dropped:
  NanoRed does not issue CFDI.
- **"No pitch-black dark mode" (light only)** was adapted. The rule became "light by default,
  calm opt-in dark, no neon".
