# Visual system and column policy

A grid is a working surface. Start with the decisions the user makes and the evidence needed for them. Divide the screen into context/controls, rows and summary/detail. Dense rows should remain easy to scan over a long session.

Use semantic tokens for canvas, surface, border, text, action, warning, error and success. Preserve an existing host palette or adapt the daylight starter: warm paper, white surfaces, dark ink, restrained burgundy action and quiet gold detail. A pale tint is a background, not a readable text color. Status requires a word/icon as well as color. Measure contrast in the rendered host; example colors do not certify every composition.

Define a column policy rather than accumulating overrides: key, label, semantic type, priority, preferred/minimum width, alignment, formatter and full-detail access. Budget against available container width, including action/selection columns and padding. Fixed or explicitly bounded layout helps prevent an unexpectedly long name from resizing the whole table. Container-aware rules are useful when a sidebar or embedding shell changes available space independently of viewport width.

Right-align numeric columns; use tabular digits and a declared precision/currency format. Never ellipsize a financial amount merely to pass an overflow check. Long descriptions may truncate visually with an accessible route to their complete value. Keep essential facts visible; move secondary identifiers to a reachable detail surface rather than silently losing them. Mobile can use labelled cards or another deliberate structure; shrinking every column to unreadable text is not successful adaptation.

Keep one clear contextual next action in each row and organize utilities in a consistent menu or source/detail affordance. The host may need an always-reachable document utility; preserve it intentionally and include it in the width budget. Close menus on Escape, outside click and action selection. Restore meaningful focus. Menus should not be clipped by the row scroller or intercept the entire viewport. Avoid gratuitous blur/shadow/animation on every cell.

The visible summary must align with the active column policy. If it is outside the row scroller, synchronize measured header geometry or use one shared grid definition. Reflow on actual width/density/column changes; batch reads/writes with an appropriate scheduling mechanism. Presentation must not recalculate canonical aggregates accidentally.

Respect reduced motion. Use obvious keyboard focus, meaningful table headers and labelled mobile fields. Touch targets should be at least 44 CSS pixels, with comfortable spacing; preserve browser zoom and use readable inputs. Test long names, large/negative amounts, empty values, locale formats and increased text size. A page with no horizontal scrollbar can still clip important data; inspect every complete amount and full-detail path.

See the [starter CSS](../assets/grid.css) and [demo](../assets/demo.html). They illustrate a clean, scoped policy; the host should use its existing tokens and component conventions. The example is not an audited accessibility conformance claim. Screen-reader and native-device acceptance require their own relevant evidence.
