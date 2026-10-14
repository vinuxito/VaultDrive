# Verification reference: prove UI work without touching production

Server tests (`tests/Unit`, `tests/Integration`) measure the **HTML the server returns**. They
cannot see what a browser does with it. On 2026-09-21, with ~1,300 server checks green, a real
Chrome showed 31/31 screens unreadable in OS dark mode and 26/43 tables with sticky headers
covering rows. UI work is proven in a **real browser on a rehearsal clone**, plus the relevant
server tests run the safe way.

---

## 1. Which runner for which test (never `tests/run-all.sh` on production)

| Situation | How | Notes |
|---|---|---|
| Test classified PURA / LECTURA in `tests/SEGURAS.md` | `/lamp/php/bin/php tests/ensayo/correr_segura.php tests/<…>_test.php` | SELECT-only account (`ENSAYO_READ_DB_USER`/`_PASS`) in a read-only sandbox. It refuses tests with a write, process, or network door (exit 3). |
| Test that talks to the DB only through `Db::pdo()` and may write | `/lamp/php/bin/php tests/ensayo/correr_en_clon.php nanored_rehearsal_<x> tests/<…>_test.php` | Clone account in `ENSAYO_DB_USER`/`_PASS`. **Not** for tests that do HTTP (`test_login`, `test_get`) or spawn processes. |
| Tests in the roadmap manifest (clone / http / pure modes, including browser walks) | `python3 tests/ensayo/roadmap_runner.py --list`, then `--root /tmp/nanored-ensayo-<port> --clone nanored_rehearsal_<x> --port <port> --credentials <private.json> --only <file>` | Credentials must be a private `0600` JSON **outside** `/lamp/www/`. The runner refuses otherwise. |
| Design ratchets `tests/Integration/sistema_de_diseno_test.php`, `tokens_test.php` | clone only: they are INDIRECTA in `SEGURAS.md` | Their ceilings only go down. Lower them in the same commit when a screen improves. |
| "Is this failure mine?" | Run the same suite with HEAD's code: `git archive HEAD \| tar -x -C /tmp/head`, **copy** `vendor/` (don't symlink: psr-4 would resolve to the live tree), and give it its own `.env` with only the clone account | Failures that appear with and without your change are pre-existing. Delete `/tmp/head/.env` afterwards. |

`tests/run-all.sh` writes to the real database, and on 2026-09-16 it erased LA PERLA's trade
name. It is **never** run against production. A plain grep for SQL in a test file is not a
safety proof either: a test with no SQL still wrote to production once.

---

## 2. The rehearsal twin (clone + private server)

1. **A clone exists or is made** with the name pattern `nanored_rehearsal_<something>`. The
   documented recipe (see the header of `tests/ensayo/correr_en_clon.php`) strips the dump's own
   `USE nanored` / `CREATE DATABASE` so the load cannot land on the live DB. Creating a clone or
   a clone-limited MySQL account is a server change: **ask the user first**. Credentials go in a
   private defaults file, never on the command line or in this repo.
2. **Check it:** `/lamp/php/bin/php tests/ensayo/verificar_clon.php nanored_rehearsal_<x>`.
3. **Serve it:**
   ```bash
   ENSAYO_DB_USER=… ENSAYO_DB_PASS=… tests/ensayo/servidor_de_ensayo.sh arrancar nanored_rehearsal_<x> 8099
   tests/ensayo/servidor_de_ensayo.sh estado 8099
   tests/ensayo/servidor_de_ensayo.sh parar 8099      # deletes the private copy
   ```
   The values come from the user's private file, not from you. The script copies the tree
   (without `.git`, `.env`, `storage`, `docs/source_docs`, `CLAUDE.md`, `AGENTS.md`) to
   `/tmp/nanored-ensayo-8099`. It writes a `.env` with only the clone account, placeholder API
   keys, and a **per-start synthetic `MAGIC_LINK_SECRET`**. It runs `php -S 127.0.0.1:8099`
   inside bubblewrap with cURL, sockets, processes, and mail disabled, and it refuses `root` and
   any non-`nanored_rehearsal_` name.
4. **Confirm identity before every walk:**
   `curl --noproxy '*' -s http://127.0.0.1:8099/__ensayo_estado.php` must return
   `{"database":"nanored_rehearsal_<x>","root":"/tmp/nanored-ensayo-8099"}`. The existing
   `*_clon.py` walks refuse to run otherwise. Copy that guard into new ones.
5. **Edits:** the copy is a snapshot. After changing code in `/lamp/www/nanored`, `parar` and
   `arrancar` again (or re-copy the changed files) before re-measuring.
6. **PDF/PNG rendering** of reports on the clone: `tests/ensayo/servidor_render_aislado.sh`
   (bound to the 8099 copy).

**Never** "rehearse" by exporting `DB_NAME=nanored_rehearsal_…` next to the live tree.
`bootstrap.php` loads `.env` over the environment, so it still hits production.

---

## 3. Browser walks (BrowserSkill kit, `tests/e2e/bsk/`)

Requirements: `bsk` CLI with its Chrome extension (`bsk doctor`), Python 3, and **a person
already logged in to the clone** in the bsk agent window. You never type credentials. If the
session is gone, the runner exits `2`: ask the person to log in again.

```bash
export NANORED_URL=http://127.0.0.1:8099          # ALWAYS set it: recorrer.py defaults to production
python3 tests/e2e/bsk/recorrer.py --autoprueba     # can the runner still turn red? (DOM-only injections)
python3 tests/e2e/bsk/recorrer.py                  # equipos pages + 5 journeys
python3 tests/e2e/bsk/recorrer.py --todas          # every menu page
python3 tests/e2e/bsk/recorrer.py --todas --tema oscuro
python3 tests/e2e/bsk/temas_clon.py                # both themes, clone 8099 only (checks identity)
```

Exit codes: `0` clean, `1` something broke (listed at the end), `2` no session or no bsk.

Probes (`tests/e2e/bsk/sondas/*.js`: one read-only expression each, returns JSON):

| Probe | Catches |
|---|---|
| `contraste.js` | every visible text's WCAG ratio (fails over 2 texts under 3:1), "Fatal error", `NaN`, `undefined`, `[object`, broken images |
| `cabeceras_pegajosas.js` | sticky table headers sitting over their first rows |
| `movil.js` | phone-width problems (horizontal overflow, cramped targets) |
| `ranking.js`, `bandeja.js`, `financiera.js`, `comparativo.js`, `promedios.js` | screen-specific truths |

To add a probe, write `sondas/<nombre>.js` as **one expression** returning `JSON.stringify({...})`
that only reads, and call it with `sonda(sid, '<nombre>.js')`. Run `--autoprueba` whenever a
probe changes, because a runner that never fails proves nothing.

**Partner portal walks:** sign a link **inside the clone's copy** with
`MagicLinkAuthService::generarMagicLink(...)`, navigate privately, and never print it, even in
an error. `tests/e2e/bsk/portal_terminos_clon.py` is the template. Production magic links are
never generated or opened by an agent.

**Legacy Node scripts** (`tests/e2e/huella_color.js`, `censo_color.js`, `foco_visible.js`,
`contar_sistema.js`, `dos_caras_medicion.js`, `playwright_*.js`) are hard-wired to
`http://localhost/nanored/public/`, which is the **live** Apache, and they take a real
`nanored_sid` cookie. Do not run them as they are. To use one, first adapt its base URL to the
rehearsal server in a local copy, with a clone session, and say so in the report. Otherwise
reproduce the measurement with a bsk probe.

**`bin/nanored ui:auditar`** logs in and GETs 63 screens. Its default `--base` is the live site,
so **never run it with the default**. Run it only from the rehearsal copy
(`/lamp/php/bin/php /tmp/nanored-ensayo-8099/bin/nanored ui:auditar --base http://127.0.0.1:8099 [--viewport mobile|desktop] [--pantalla a.php,b.php]`)
with a clone-only web test account the user provides privately. It prints a mobile-face
**proposal** that the owner approves. Don't apply it on your own.

Other browser tools (the Claude Browser pane, Playwright MCP, gstack `/browse`) follow the same
rules: target the clone URL, a human does any login, GET and read-only probes unless the walk
is a scripted clone write-walk, and restore any `localStorage` you changed.

---

## 4. What to measure for a UI change

- **Contrast** in light **and** `data-tema="oscuro"`, on every changed screen, with no new
  texts under 3:1. Also check the ratio of the one figure that decides.
- **Color census and fingerprint.** The fingerprint (a hash of every painted color) answers
  *whether* anything moved. The census (color → element count) answers *what* moved: whether
  the intended swap happened and whether an unrequested color appeared. A color-token sweep
  needs both. Screens behind a click (drawers, dialogs) aren't covered by the fingerprint, so
  pair it with the static check that resolves every `var()` to its value.
- **Sticky:** headers not covering rows, and the twin column staying in view on a long form.
- **Reflow:** 1440×900, 1536×1024, 1024×768, 390×844, 320 px wide, and 200% text/zoom. No
  page-level horizontal scroll.
- **Keyboard:** Tab through 40 elements. Each one shows focus, `Escape` closes, `⌘K` opens and
  closes without navigating.
- **Truth of sentences:** every count or "cuadra" on the screen matches the database for the
  same company and week.
- **Side effects:** compare `audit_event` (and `magic_link_opens` for portal work) on the clone
  before and after. Run `git status --short` in the repo too, since a read-only agent has
  written before.
- **Performance:** measure PHP render time separately from the whole HTTP time, before and
  after, on the same fixture. Report the `<20 ms` aspiration honestly.

---

## 5. Evidence and closeout (only when the user asks to close a milestone)

- Screenshots use **synthetic fixtures** or clone data with no personal data visible (no
  CLABE, e-mail, RFC, phone, or customer names). Store them under
  `docs/reports/evidence/<topic>-<date>/`.
- Closeout artifacts per the repo's CLAUDE.md: `docs/memories/session-YYYY-MM-DD-<topic>.md`,
  `docs/reports/YYYY-MM-DD-<topic>-verification.md` and `.html` (self-contained, inline CSS),
  and the `README.md` update. Every claim cites the command, its exit code, and its output.
- Commit on `main` only when the user asks. Never append `&& git commit` after a pipe (`| tail`),
  because the exit code would be `tail`'s.
