# 08 · System leverage that a human can actually use

## A user outcome is more than a service response

For human-facing features, evaluate the path from the user's actual task to the
result and back. Keep company, period, record, document identity, and source context
visible where mistakes would matter. Do not certify mobile because desktop CSS shrank.
A backend capability can have a higher demonstrated scope than its unfinished UI;
report that boundary honestly.

## Desktop acceptance

Use keyboard-only and pointer journeys. Check visible focus, meaningful labels,
tab order, Escape/close behavior, modal focus return, browser zoom, scroll position,
long filenames, large values, and narrow windows. A button that exists under an overlay
is not available. A fast empty preview is not useful speed.

For document systems, test actual content navigation, meaningful search, page/sheet
location, original-versus-interpreted labels, and permission errors. A source pane that
pretty-prints XML is a representation; do not call it byte-for-byte original unless
that property was actually verified through the retained artifact path.

## Mobile acceptance

Use the real target device when available and disclose when testing is only emulated.
Check portrait/landscape, browser chrome, soft keyboard, touch targets, thumb reach,
zoom/pan, fixed controls, overlays, and content safe areas. A proposed ergonomic baseline
for this skill is approximately 48 CSS-pixel touch targets where feasible; this is an
internal target, not a claim of universal conformance to an external standard.

Normal actions should fit the viewport; a wide document may need its own intentional
pan/zoom area. Do not force the whole app sideways to reach Close. For dense workbooks,
provide clear sheet/cell navigation and honest limitations rather than pretending a
phone is a full desktop spreadsheet editor.

## Brenda's dock as an application pattern

A persistent bottom action area can keep decisions reachable while a person reviews
long content. It still needs context, safe-area/keyboard handling, scroll padding, and
clear destructive-action separation. The dock should not hide the last row, obscure
the current amount, or convert an accidental tap into an irreversible action.

Treat this as an adaptable pattern from the conversation, not a law that every control
must occupy a fixed fraction of the screen. Discover the actual installed Brenda skill
before invoking it. Validate the current design with the people who use it.

## Interruptions are normal

Test leaving for a call, email, camera, or another app; then returning. Preserve useful
context when safe, but revalidate expired authority. Do not cache sensitive content
past the host's policy merely to make restoration look smooth. Label stale data and
provide a recovery path that does not lose the user's place unnecessarily.

## Safe action sequence

For meaningful side effects, use contextual preview → explicit authorized confirmation
→ operation → observed receipt. Keep prepared separate from sent, and accepted separate
from completed. Idempotency and server-side checks matter even when the button disables.
A confirmation dialog alone is not a complete double-submission control.

## Plain language and accessible evidence

The user should understand what happened, what remains, and how to verify it. Color
supports status; text and semantics must carry it too. Prefer “File unavailable; your
invoice was not changed” over a raw error dump or a false green state. Do not conceal
uncertainty to make the interface feel premium.

UX belongs in the coordination ledger. If every failure requires Victor to explain
a recovery path on a call, the system has transferred work to the center even when
all services are technically running.
