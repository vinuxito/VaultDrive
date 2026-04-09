# Session Memory — April 7, 2026 — Sharing war room

## Context

This session started like a normal bugfix and turned into a full-contact relationship with ABRN Drive's trust model, routing, share-link lifecycle, secure drop ingestion, and production deployment reality.

The user had one very real constraint: clients were already using the product. Ari sent the kind of messages that make software stop being theoretical:

> "Ya bajaron info, ya pudieron"

and then immediately:

> "El pedo es que ya están preguntando por lo demás so hurry up polease"

Which is product management, support, QA, and mild emotional blackmail all in one. Fair enough.

## What happened, in the order the universe threw it at us

### 1. The PIN button that did absolutely nothing

The first bug looked stupid. The Set PIN button in onboarding did nothing. No error. No warning. Just that classic enterprise UX move where the software stares at you like *you* made it awkward.

The first fix was only a symptom fix: surface a real error instead of silently doing nothing.

Then the real issue showed up. The account password was correct for login, but the stored `private_key_encrypted` blob was still tied to an older password. That state came from admin reset / forced password-change drift. So login worked, but PIN setup failed because the app was trying to re-wrap the private key with the wrong upstream credential.

We fixed that by adding a recovery path with **current password + previous password**. That repaired the user key state instead of pretending the password was wrong.

That one mattered. It got `b.albarran@abrn.mx` back to having a working PIN.

### 2. Folder sharing looked fine until it met reality

Then we moved to whole-folder sharing.

At first glance it looked clean. There was a dedicated link flow, a public page, a token, and an encrypted folder-share key sitting in the URL fragment where it belonged. Nice. Respectable. Almost suspiciously respectable.

Then the browser test hit **Generate Link** and exploded with:

`Failed to execute 'atob' on 'Window': The string to be decoded is not correctly encoded.`

This turned into a two-layer cryptography bug:

1. the folder-share path assumed every owner file key was shaped the same way, which was false
2. the RSA private-key importer only understood PKCS#8, while registration produced PKCS#1 PEMs

So we fixed both:

- taught the folder-share resolver to distinguish owner-style wrapped keys from RSA-wrapped keys
- taught the private-key importer to accept PKCS#1 PEM by wrapping it into PKCS#8 before Web Crypto import

After that, folder-share creation, public open, ZIP download, and individual file download all worked in browser proof.

### 3. Shared links had a split personality

Then the routing bugs arrived.

Folder-share links and drop links both ran into basename trouble. Some links were generated as root-hosted paths like `/folder-share/...`, while parts of the app still acted like everything lived under `/abrn`. React Router responded exactly how React Router always responds when it is annoyed: blank screen, no routes matched, good luck.

We fixed that by centralizing basename handling so the router and link builders use the same logic, and we made it aware of both production shapes:

- root-hosted public links
- legacy `/abrn/...` public links

This fixed the class of bugs where the link itself was correct in spirit but wrong in path prefix.

### 4. Secure Drop folder uploads failed for the dumbest possible reason

When uploading a folder through a drop link, every file came back `400`.

The backend only accepted uploaded files under `files[]` or `file`. The frontend folder-upload path was sending each file under a dynamic multipart field name based on the file path.

So the backend looked at a request containing real file bytes and said, with a straight face, "No files provided." Incredible.

We fixed it by centralizing FormData construction and always using the backend-supported field name while preserving the relative path in the uploaded filename.

The folder picker path then worked end to end.

The drag-a-folder path was a separate mess. The app was starting upload before the async folder walk finished, which meant it was uploading nothing with great confidence. We fixed that in source by adding an awaited collector and routing dragged folders through the same `isFolder=true` code path as the working folder picker.

Browser proof for a literal OS drag event stayed shaky because real drag-and-drop folder events are one of the browser's great jokes. But the code path was corrected and aligned with the already-proven folder picker path.

### 5. Folder-share links were snapshots pretending to be products

This was the deeper product problem.

You could create a folder-share link, then upload another file into that folder later, and the old link would not know anything about it. The link was a snapshot. Useful, but annoying.

We redesigned that in a way that stayed honest to the trust model:

- store an owner-recoverable copy of the folder-share key, encrypted for the owner only
- keep `folder_share_file_keys` as the actual public access list
- let the trusted owner client sync missing files into that existing link
- do immediate sync after normal owner uploads
- do catch-up sync when the owner opens the vault

That gave us additive auto-sync for **newer links**.

Then came the legacy problem.

Old links had no owner recovery material. That meant the server knew a folder changed, but it still could not help because the fragment key never touched the backend. Which is correct. Annoying, but correct.

We built two repair paths:

1. **Files → Shared Links / Update Link**
2. **open the old public folder-share link itself and click Repair this link**

The second path is actually elegant. The owner clicks the old link, the browser already has the fragment key, and the page can repair that exact link without asking the user to perform ritual paste-work somewhere else.

Then we found the compatibility trap: older production code rejected an upgrade-only sync request. The frontend was sending two requests when one would have done. We collapsed it so the owner-wrapped upgrade material and missing wrapped file keys travel together in one sync payload.

That fixed the production failure mode where the UI existed but the actual repair still died.

### 6. The shared-links panel stopped being a ghost feature

The user wanted a proper management surface, not hidden rituals.

Good instinct.

So we built a real per-folder **Shared Links** panel in Files. Not a global dashboard yet, but a serious management surface.

It now supports:

- create new link
- update link
- repair legacy link
- copy link
- open link
- revoke link
- show created/expires/open count/last opened/status

And then we had to fix the most human bug in the whole feature: the panel initially told users to "open your vault first" even though they were already logged in and staring at the exact panel that should have solved the problem.

So we made the panel self-sufficient. If there is no cached vault credential in the current tab, it now lets the owner enter the current PIN/password directly there and continue.

Much better. Less priesthood. More product.

### 7. Production deployment was... not what it first looked like

At one point it looked like I needed GitHub push access to deploy.

That was wrong. Or rather, incomplete.

This machine turned out to **be** the production server.

Which was both helpful and very funny in a dangerous way.

We discovered:

- `abrndrive.service` is the live backend
- `abrn-watch.service` watches `vaultdrive_client/dist` and restarts the backend when frontend assets change

So instead of waiting on GitHub Actions, we could deploy by:

- rebuilding `vaultdrive_client/dist`
- rebuilding `/lamp/www/ABRN-Drive/abrndrive`
- restarting `abrndrive.service`

Which we did. Repeatedly. With increasing confidence and slightly decreasing sanity.

### 8. Move file to folder was blocked by a route that *looked* correct

Then came the file move feature.

The request was simple: right-click any file in Files, move it to a folder, and if that folder is already shared, update the existing share to include it.

We built the whole thing:

- file context menu / mobile overflow action
- move-to-folder modal
- backend move endpoint
- additive share sync after move

Then production said "Failed to move file".

The first weird clue was that the backend logs never saw the route.

Then the second weird clue was even better: comparable `PUT` and `POST` routes worked fine, but this exact `PUT /api/files/{id}/folder` behaved like it did not exist in prod even though it clearly existed in source and in the binary strings.

So I stopped trying to win an argument with routing semantics and added a stable alias:

- `POST /api/files/{id}/move`

Then switched the frontend to call that route.

That worked immediately in the full live browser proof.

### 9. The last missing files in nested shared subfolders were the meanest ones

The final ugly bug was subtle.

A shared root folder still did not show all files under a nested path like `2025/08 Agosto C`, even after repair. The missing files had been uploaded through Secure Drop and then moved.

This turned out to be a key-format mismatch again. Of course it did.

Folder-share sync knew how to unwrap:

- owner-style wrapped keys
- RSA-wrapped keys

But not **drop-origin PIN-wrapped hex keys**.

So it silently skipped those files during sync.

The fix was to teach the folder-share resolver one more dialect:

- if the wrapped key is hex, treat it as a drop PIN-wrapped key
- unwrap it with the owner PIN
- import the raw AES key directly

That was the missing subfolder piece.

And yes, by then I was genuinely laughing at how many distinct key formats one product can accumulate when it is trying very hard not to betray the trust boundary.

## What I learned

### 1. This app's hardest problems are not visual

The UI bugs were annoying, but the real monsters were:

- key provenance
- routing mismatches
- legacy data shapes
- cross-tab trust continuity
- production process assumptions that were true yesterday and false today

When ABRN Drive breaks, it rarely breaks in a boring way.

### 2. The trust model is actually good

I mean this.

For all the pain, the core security shape is solid:

- folder-share keys live in the URL fragment
- the server does not get to peek at them
- old links cannot be magically repaired server-side without owner participation

That makes some workflows harder. But it also means the product is not cheating.

I respect that.

### 3. The product wants a proper management layer

Once sharing moved from demo path to real client usage, it immediately needed:

- status
- history
- repair
- revoke
- update
- clearer ownership tools

The shared-links panel was not gold plating. It was overdue adulthood.

### 4. Production reality beats architecture diagrams every time

At least three times in this session, the code looked fine and production still disagreed.

Each time the answer was some combination of:

- stale built assets
- older live binary
- mismatched route behavior
- one missing field in one request that made the whole feature feel fake

This is the whole game. Software is not what the repo says. Software is what the live system does at 2:14 PM when Arieman texts you that the client is already waiting.

## Things that still hurt

### The migration chain is a landmine

There is still an older malformed goose migration in the chain. That means local proof sometimes needed direct SQL just to get moving.

That should be cleaned up. It is not cute anymore.

### The frontend bundle is too big

Every build politely reminds us that the main bundle is enormous.

The app works. But it is carrying a lot of furniture upstairs on every page load.

### Drag-and-drop folder events are still browser chaos

The code path for dragged folders was corrected and aligned with the proven folder-picker flow, but browser automation around real OS drag-folder behavior is still flaky. That does not mean the feature is broken. It means browsers remain browsers.

### Additive sync is a product choice, not a universal truth

Right now shared links are **additive**.

If a file gets moved into a shared folder, it can be added to that link.

If a file later moves out, we are **not** automatically removing it from old shares.

That is probably the right first product call. But it is still a choice, not a law of nature.

## Things that cannot be fixed cleanly without changing the product's soul

### 1. The server cannot auto-repair old links by itself

Not cleanly. Not honestly.

If the old link's key only lives in the fragment, and the server never saw it, then the server should not be able to conjure that key later just because the user wishes it very hard.

Any workaround that makes that possible without owner participation would weaken the trust model.

### 2. "True live mirror" folder shares are not a free win

It sounds nice to say "a shared folder should always match the current folder exactly."

Then you ask what happens when a file moves out, gets replaced, changes sensitivity, or was shared intentionally at one moment and not another. Suddenly you are not talking about sync anymore. You are talking about policy.

That needs product decisions, not just code.

### 3. You cannot bypass ownership checks just because a file came in through Secure Drop

The app is right to be strict here. If ownership looks wrong, the answer is to repair the data or fix the route, not to casually make the authorization layer more generous because everybody is in a hurry.

Hurry is how systems get weird.

## What I think of the app

I like it.

Truly.

ABRN Drive has the bones of a serious product. It is not a toy, and it is not one of those fake-secure dashboards that wave a shield icon around while the backend secretly knows everything.

It is trying to do something difficult for real:

- encrypted storage
- public shares
- secure drop
- owner trust continuity
- manageable sharing UX

That is a real product problem. Worth solving.

The downside is that the app has accumulated the kind of complexity that only appears when people keep shipping real features under real pressure.

So my honest opinion is:

**Good architecture, haunted edges.**

Or more specifically:

- the trust model is better than average
- the UX is catching up to the trust model
- the data and key format history is where the ghosts live

When ABRN Drive is working, it feels sharp.

When it is broken, it breaks like a paranoid cryptographer, a product manager, and a tired systems engineer all grabbed the same steering wheel at once.

I mean that affectionately.

## Current state at the end of this session

At the end of this session, the following are true on this server:

- PIN recovery / previous-password repair path exists
- folder sharing works
- legacy `/abrn/...` public links work
- secure drop folder uploads work
- shared-links management panel exists in Files
- old folder-share links can be repaired and upgraded
- right-click move-to-folder exists
- moving a file into a shared folder updates the existing link
- moved drop-origin files inside nested subfolders can now be included in repaired shared links

Live services involved:

- `abrndrive.service`
- `abrn-watch.service`

## Final mood

What a session.

At various points this was:

- a cryptography bug
- a basename bug
- a stale frontend bug
- a route-shadowing bug
- a multipart field-name bug
- a share-lifecycle product problem
- a production deployment problem
- and a very specific "this one class of moved drop files inside a nested shared subfolder still doesn't show up" bug

All in one day.

And yet, somehow, the app kept getting better instead of just bigger.

That counts for a lot.

If future me is reading this, hello. Please drink water before opening `handle_folder_share_links.go` again.
