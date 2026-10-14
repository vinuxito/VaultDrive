# Live twin reference: el gemelo en vivo (talonario virtual)

## 0. Why it exists

Picture pressing "Registrar pago" or "Enviar recibo" for a partner without having seen what
the partner will receive. Did I pick the right socio? Is that the gross amount or the net? Were
the ISR/IVA retentions applied? Is it NANORED's week or LUGA's?

The old way was a button, a wait, a pop-up, squinting, closing it, fixing a typo, and waiting
again. The **live twin** replaces that. Beside or under the form, a read-only sheet mirrors the
real document and updates within ~35 ms of each change: pick a partner and the header changes,
add a line and it appears on the sheet.

In NanoRed there are **two kinds of twin**:

| Twin | What it mirrors | Where |
|---|---|---|
| **Document twin** (talonario en vivo) | the document a form will produce: the recibo del socio, a weekly report, the WhatsApp/e-mail text, a request for an invoice | client-side, inside the page that has the form |
| **Portal mirror** (espejo del socio) | exactly what the partner sees in their portal | `socio.php` as staff with `?id=` → `IS_MIRROR_MODE`; `public/partials/_workspace_portal.php` mode `mirror` |

Plausible document-twin homes, to confirm against the code before building: the dispatch
confirmation (`public/partials/_despacho_confirmar.php`, text from `recibo_texto()` in
`public/partials/_recibo.php`), payment registration (`public/pagos_socios.php`, partials
`_workspace_payment_*`), the point-of-sale declaration (`public/mostrador.php`), and report
formats (`public/equipos_reporte*.php`).

**The Consigliere Fiscal rule.** Character is welcome as long as the person understands at a
glance. The UI says "Así se verá" or "Vista previa en vivo". "Glass Twin" can stay as an
internal name in code comments or CSS class prefixes (`nr-twin-…`).

---

## 1. Twin safety (non-negotiable, restates SKILL.md §0.6)

- **Read-only.** A twin never POSTs, autosaves, writes a draft to the DB, writes `audit_event`,
  or calls an endpoint that has side effects. If it needs server data, use data already in the
  page (rendered by PHP) or a GET endpoint that was **proven** read-only. Proving one means
  checking the code and then `audit_event` on the **clone** after a walk.
- **Never open the partner's magic link** to preview their portal. Opening it inserts into
  `magic_link_opens` and the cockpit then says "Abierto por el socio". Use mirror mode as staff.
  In mirror mode, partner decisions (acuerdo, cuenta, factura) are refused by design: "Esto sólo
  lo puede decir el socio desde su enlace". Keep that refusal.
- **The server is the source of truth for money.** `Recibo::armar()` / `Recibo::desglose()` (in
  `app/Services/Recibo.php`) compute bruto, subtotal, IVA, ISR/IVA retentions, and neto, and
  they return `estado: NO_EVALUABLE` with `que_pasa` and `acto` when something is missing. The
  twin must not invent a different formula. If the twin does arithmetic on typed values, it is
  labelled **"Borrador: la cifra final la confirma el sistema al guardar"**, and after saving
  the page shows the server's figure.
- **Escape everything.** Write user input with `textContent` or `setAttribute`, never
  `innerHTML`/`.html()` concatenation. The source recipe built the sheet with
  `'<div>' + receptor + '</div>'`, which is an XSS hole.
- **No personal data in fixtures or screenshots** you keep. Twin demos use synthetic partners
  such as "Socio Ejemplo", RFC `XAXX010101000`, and invented amounts.
- **Verify on the clone** (verification.md): twin behavior, plus proof that nothing was written.

---

## 2. The four cardinal sins, and the NanoRed fix

### Sin 1: the iframe white flash (la cegadora)
Setting `iframe.src='preview.php?...'` on every key flashes white for about 300 ms, resets
scroll, steals focus from the input, and burns CPU. **Fix:** the twin is live DOM inside the
page. Mutate text nodes and rows in place. (`subir.php` sends `X-Frame-Options: DENY` anyway.)

### Sin 2: the vanishing sheet (el desaparecido)
The form is 1,800 px tall. Scroll down to the totals and the twin has scrolled away, so you
type blind. **Fix:** `position: sticky; top: 76px;` on the twin column. That is the offset
`workspace.css` already uses for `[data-wb-partner-host]`, below the fixed header.

### Sin 3: the ancestor overflow trap (el asesino silencioso de sticky)
Any ancestor (`html`, `body`, or a wrapper) with `overflow: hidden|auto|scroll` silently
disables `position: sticky` for its descendants. **Fix:** `clip` is sticky's friend and `hidden`
is its assassin. Apply it **scoped to the page wrapper**, not as a global `html, body` override
with `!important`. A global override would change every screen and could re-break the sticky
table headers that `tests/e2e/bsk/sondas/cabeceras_pegajosas.js` guards. Note that `base.css`
already writes `overflow:hidden;overflow:clip` on `table`: the second value wins where it is
supported.

```css
.nr-twin-page { overflow-x: clip; }            /* NOT hidden */
```

Then run the sticky-header and phone-overflow probes (verification.md §3).

### Sin 4: the comma catastrophe (el NaN del infierno)
`parseFloat("15,450.00")` gives `15`, and `parseFloat("$15,450.00")` gives `NaN`, so the sheet
says `$NaN`. **Fix:** clean the input first. When it still isn't a number, **say so** instead of
showing 0. A false zero is a lie on a money screen.

```js
function nrImporte(v) {                 // null = "no se puede leer", never 0 by default
  if (v === null || v === undefined) return null;
  var s = String(v).replace(/[^0-9.\-]/g, '');
  if (s === '' || s === '-' || s === '.') return null;
  var n = parseFloat(s);
  return isFinite(n) ? n : null;
}
function nrMoneda(n) {                  // mirrors money(): $1,234.56 ; -0 → 0
  if (n === null) return null;
  if (Math.abs(n) < 0.005) n = 0;
  return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
```

Show `null` as "Falta el importe" (tone `--warning-text`), the same idea as `sin_datos()`.

---

## 3. Why 35 ms

Updating on every raw keystroke (0 ms) re-lays out the page up to 60 times a second and makes
typing feel mushy. A 300 ms debounce makes people pause and wonder whether it is working.
Visual latency is about 50–100 ms, so **35 ms** batches fast typing and still paints "before a
blink".

```js
schedule: function () { var s = this; clearTimeout(s.t); s.t = setTimeout(function () { s.update(); }, 35); }
```

---

## 4. Anatomy of a NanoRed twin (recibo del socio as the model)

The real document is `public/partials/_recibo.php`: "una sola plantilla para el portal, la
impresión y el espejo". The twin mirrors those same parts, in the same order and with the same
words:

```
┌ Vista previa en vivo · Así lo verá el socio        [−] 100% [+] [1:1] [Ocultar] ┐  ← controls
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Socio Ejemplo (Titular: …)            NANORED · 08–14 sep 2026            │ │  1. who + company + week
│ │ RFC: XAXX010101000 · Régimen 612      (or "Sin RFC registrado")           │ │     (.recibo-cab / -quien / -cuando / -fiscalia)
│ ├──────────────────────────────────────────────────────────────────────────┤ │
│ │ Lo que generaste esta semana                                             │ │  2. lines (.recibo-lineas)
│ │  12  Activaciones                                      $1,200.00          │ │
│ │   3  Portabilidad                                        $450.00          │ │
│ ├──────────────────────────────────────────────────────────────────────────┤ │
│ │                          Comisión (IVA incluido)       $1,650.00          │ │  3. totals, monospace,
│ │                          Retención ISR                  −$…               │ │     decimals aligned
│ │                          SE TE DEPOSITA                 $…                │ │
│ ├──────────────────────────────────────────────────────────────────────────┤ │
│ │ Vista previa: no es un comprobante ni una factura.                       │ │  4. honest footer
│ └──────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

1. **Who, company, week.** `display_title` first, with "Titular" labelled when it differs.
   Show the **one** company (NANORED **or** LUGA: never summed, one company per answer) and the
   exact `inicio–fin` range. Show RFC and régimen, or the explicit gap ("Sin RFC registrado",
   "Sin régimen declarado").
2. **Lines.** Units, concept, amount. For other documents, use their own real line structure
   (report rows, message paragraphs).
3. **Totals.** Right-aligned, `font-family: var(--font-mono)`,
   `font-variant-numeric: tabular-nums`, decimals aligned, MXN, and the **basis** labelled
   (bruto / neto / IVA incluido). If the server said `NO_EVALUABLE`, the twin shows `que_pasa`
   and the `acto` link text, not a number.
4. **Honest footer.** "Vista previa: no es un comprobante ni una factura." Drop the source's
   "previsualización fidedigna del CFDI oficial ante el SAT" and its mock QR. NanoRed does not
   stamp CFDI, and a fake QR on a money document is a claim the data can't back.

For a **message twin** (WhatsApp / e-mail), render the exact text `recibo_texto()` or
`recibo_html()` would produce, and label the button truthfully: "Abrir WhatsApp", never
"Mensaje enviado".

---

## 5. Hooking a twin to a screen

### Step 1: split layout, with the template rendered by the server
Render the twin shell **from PHP** with the same labels as the real partial, and put
`data-twin="…"` slots where values go. JS only fills slots.

```php
<div class="nr-twin-page nr-twin-grid">
  <div class="nr-twin-form"><!-- existing form stays exactly as it was: same ids, same names --></div>
  <aside class="nr-twin-col" id="nr-twin" aria-label="Vista previa en vivo" aria-live="polite">
    <div class="nr-twin-head">
      <strong>Vista previa en vivo</strong> <span class="nr-twin-sub">Así lo verá el socio</span>
      <div class="nr-twin-zoom">
        <button type="button" data-twin-zoom="-1" aria-label="Alejar">−</button>
        <output data-twin-zoom-val>100%</output>
        <button type="button" data-twin-zoom="1" aria-label="Acercar">+</button>
        <button type="button" data-twin-zoom="0" aria-label="Tamaño original">1:1</button>
      </div>
    </div>
    <div class="nr-twin-body"><div class="nr-twin-sheet" data-twin-sheet>
      <div class="recibo-quien" data-twin="socio"><?= h($socioInicial ?? '') ?></div>
      <div class="recibo-cuando"><span data-twin="entidad"><?= h($entidad) ?></span> · <span data-twin="rango"><?= h($rango) ?></span></div>
      <div class="nr-twin-total"><span>Se te deposita</span> <b data-twin="neto">—</b></div>
      <p class="nr-twin-pie">Vista previa: no es un comprobante ni una factura.</p>
    </div></div>
  </aside>
</div>
```

### Step 2: the sticky contract, with tokens and no hex

```css
.nr-twin-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(320px, .85fr);
  gap: var(--sp-5); align-items: start; }
.nr-twin-col  { position: sticky; top: 76px; max-height: calc(100vh - 96px);
  display: flex; flex-direction: column; background: var(--bg-card-subtle);
  border: 1px solid var(--border-main); border-radius: 12px; }
.nr-twin-body { overflow: auto; }              /* the ONE labelled local scroll region, if the sheet is tall */
.nr-twin-sheet { background: var(--bg-card); color: var(--tx-fuerte); transform-origin: top center;
  padding: var(--sp-5); border-radius: 10px; }
.nr-twin-total b { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.nr-twin-zoom button { min-width: var(--tap); min-height: var(--tap); }
@media (max-width: 1279px) { .nr-twin-grid { grid-template-columns: 1fr; }
  .nr-twin-col { position: static; max-height: none; } }
```

Notes:
- The source used a dark "obsidian" shell `#0f172a`. Here the shell is a calm surface (tokens).
  If you want a dark shell, use `--os-fondo` / `--os-tx` and add the selector to `oscuro.css` if
  it carries `--tx-invertido`.
- `DESIGN.md`: don't impose nested fixed-height scrolling just to look like a cockpit. On
  < 1280 px the twin becomes a normal section under the form, or goes behind the toggle.
- Load CSS/JS through `asset()` so the cache busts by content hash.

### Step 3: the reactive updater (vanilla JS, `public/assets/twin-<screen>.js`)

```js
(function () {
  'use strict';
  var T = {
    t: null, zoom: 1, root: null, form: null,
    init: function () {
      this.root = document.getElementById('nr-twin'); if (!this.root) return;
      this.form = document.querySelector('[data-twin-form]'); if (!this.form) return;
      var s = this;
      ['input', 'change'].forEach(function (ev) { s.form.addEventListener(ev, function () { s.schedule(); }); });
      this.root.addEventListener('click', function (e) {
        var b = e.target.closest('[data-twin-zoom]'); if (!b) return;
        var d = +b.getAttribute('data-twin-zoom'); s.setZoom(d === 0 ? 1 : s.zoom + d * 0.1);
      });
      this.update();
    },
    schedule: function () { var s = this; clearTimeout(s.t); s.t = setTimeout(function () { s.update(); }, 35); },
    setZoom: function (z) {
      this.zoom = Math.max(0.65, Math.min(z, 1.4));
      this.root.querySelector('[data-twin-sheet]').style.transform = 'scale(' + this.zoom + ')';
      this.root.querySelector('[data-twin-zoom-val]').textContent = Math.round(this.zoom * 100) + '%';
    },
    slot: function (k, v) { var el = this.root.querySelector('[data-twin="' + k + '"]'); if (el) el.textContent = v; },
    update: function () {                       // READ the form, WRITE only text into the sheet
      var f = this.form;
      var socio = f.querySelector('[name="socio_nombre"]');
      this.slot('socio', socio && socio.value.trim() ? socio.value.trim() : 'Elige un socio');
      var neto = nrMoneda(nrImporte((f.querySelector('[name="importe"]') || {}).value));
      this.slot('neto', neto === null ? 'Falta el importe' : neto);
    }
  };
  window.nrTwin = T;
  document.addEventListener('DOMContentLoaded', function () { T.init(); });
})();
```

The field names above (`socio_nombre`, `importe`) are placeholders. Read the real form, and
never rename existing inputs: tests and handlers depend on them.

---

## 6. The toggle: respect small screens

On a 27" monitor, side by side is paradise. On a 13" laptop or tablet it squeezes the form.
Give the action bar a Tier-2 toggle:

```html
<button type="button" class="p-btn-secondary" data-twin-toggle aria-controls="nr-twin" aria-expanded="true">
  Ocultar vista previa
</button>
```

```js
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-twin-toggle]'); if (!b) return; e.preventDefault();
  var tw = document.getElementById('nr-twin'); var abierto = !tw.hidden;
  tw.hidden = abierto;                                  // hidden = zero footprint, no clicks
  b.setAttribute('aria-expanded', String(!abierto));
  b.textContent = abierto ? 'Ver vista previa' : 'Ocultar vista previa';
  if (!abierto && window.nrTwin) window.nrTwin.update();
  try { localStorage.setItem('nanored_twin', abierto ? '0' : '1'); } catch (x) {}
});
```

The toggle never touches form state. The stored flag is a per-viewer convenience only. Sound is
optional (`NrSonido`, design.md §7). The source called a `VxSound.snap()` that was never
defined, so any cue here must be one that exists.

---

## 7. La Viejita's final inspection (run on the clone, in a real browser)

1. "¿Si escribo rápido, parpadea en blanco como foco de árbol de Navidad?" → If yes, fail:
   something is reloading.
2. "¿Si bajo hasta el final del formulario, la hoja se fue pa' arriba?" → If yes, fail: an
   ancestor has `overflow:hidden`. Use `clip` on the page wrapper.
3. "¿Si el importe lleva comas o signo de pesos, sale NaN o $0.00?" → If yes, fail: clean the
   input, and show "Falta el importe" when it can't be read.
4. "¿Si le pico a Zoom u Ocultar, se borró lo que había escrito?" → If yes, fail: the preview
   must never touch form state.
5. "¿La vista previa dice lo mismo que el documento de verdad?" Compare the twin, after save,
   against `_recibo.php` / `Recibo::armar` for the same partner, company, and week. Any
   difference fails.
6. "¿Escribió algo en la base?" Check `audit_event` and `magic_link_opens` on the clone before
   and after the walk. Any new row from the twin fails.
7. "¿Se lee en oscuro y en el teléfono?" Check the contrast probe in both themes and 390×844
   with no horizontal overflow.
8. "¿Parece un recibo de verdad que le puedes dar al socio en la mano?" If yes, "Te quedó chulo
   de bonito, mi vida."

---

## 8. From the source, dropped or changed (and why)

- **jQuery recipe (`$(document).on`, `.html()`)** became vanilla JS with `textContent`. There is
  no jQuery here, and `.html()` with user input was XSS.
- **`cleanFloat` returning 0** became `nrImporte` returning null, shown as "Falta el importe".
  The repo forbids false zeros.
- **Fiscal watermark claiming a faithful CFDI preview, plus the mock QR,** became an honest
  footer. NanoRed does not stamp CFDI, and screen sentences are claims.
- **Global `html, body { overflow-x: clip !important; overflow-y: visible !important }`** was
  scoped to the page wrapper. A global override risks every screen and the sticky table headers.
- **Fixed-height obsidian shell `#0f172a`** became token surfaces, with a local scroll only if
  needed, per the hex ratchet and `DESIGN.md`.
- **CFDI 4.0 / Nómina 1.2 / REP 2.0 sections** (emisor, receptor, SAT claves, percepciones) were
  replaced by NanoRed documents (recibo del socio, reports, messages). Those CFDI types are
  another product's.
- **`#NvoCFD`, `#rnombre`, `#rrfc`, `#Total` selectors and `js2/vx-glass-twin-*.js`** belong to
  another product and were replaced by placeholders and `public/assets/`.
- **"Ver/Ocultar" via `.hide()/.show()`** became the `hidden` attribute plus `aria-expanded`,
  giving zero footprint and accessibility.
- **Added:** the twin-safety section (§1). The sources never considered writes. Here a twin must
  never write to production or open a partner's magic link.
