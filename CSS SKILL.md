---
name: modern-css
description: Specialized knowledge for writing modern high-quality CSS. Trigger this skill when starting a new CSS project/file, when the user asks about new CSS features (e.g. Masonry, View Transitions, Container Queries, Scroll-driven animations), or requests refactoring of legacy styles to modern standards.
---

# Modern CSS

This skill provides a reference for writing modern, robust, and efficient CSS.

---

## Layout & Responsive Design

### Container Queries
```css
.card {
  container: --my-card / inline-size;
}

@container --my-card (width < 40ch) {
  /* Component-based responsive design */
}

@container (20ch < width < 50ch) {
  /* Range syntax */
}
```

**Container units:** `cqi`, `cqb`, `cqw`, `cqh` - size relative to container dimensions

**Anchored container queries:** Style positioned elements based on anchor fallback state
```css
.tooltip {
  container-type: anchored;
}

@container anchored(top) {
  /* Styles when positioned at top */
}
```

### Media Query Range Syntax
```css
@media (width <= 1024px) { }
@media (360px < width < 1024px) { }
```


### Grid Enhancements
- **Subgrid:** Inherit parent grid lines for nested layouts
- **Masonry:** `display: grid-lanes` for Pinterest-style layouts with logical tab order. (Previously proposed as `grid-template-rows: masonry`).

---

## Color & Theming

### Color Scheme & Light-Dark Function
```css
:root {
  color-scheme: light dark;
  --surface-1: light-dark(white, #222);
  --text-1: light-dark(#222, #fff);
}
```

### Modern Color Spaces
```css
/* OKLCH: uniform brightness, P3+ colors */
.vibrant {
  background: oklch(72% 75% 330);
}

/* Display-P3 for HDR displays */
@media (dynamic-range: high) {
  .neon {
    --neon-red: color(display-p3 1 0 0);
  }
}

/* Better gradients with in oklch */
.gradient {
  background: linear-gradient(
    to right in oklch,
    color(display-p3 1 0 .5),
    color(display-p3 0 1 1)
  );
}
```

### Color Manipulation
```css
/* color-mix() */
.lighten {
  background: color-mix(in oklab, var(--brand), white);
}

/* Relative color syntax */
.lighter {
  background: oklch(from blue calc(l + .25) c h);
  background: oklch(from blue 75% c h); /* Set to specific lightness */
}

.semi-transparent {
  background: oklch(from var(--color) l c h / 50%);
}

.complementary {
  background: hsl(from blue calc(h + 180) s l);
}
```

### Accent Color
```css
:root {
  accent-color: hotpink; /* Tints checkboxes, radios, range inputs */
}
```

---

## Typography

### Text Wrapping
```css
h1 {
  text-wrap: balance; /* Balanced multi-line headings */
  max-inline-size: 25ch;
}

p {
  text-wrap: pretty; /* No orphans */
  max-inline-size: 50ch;
}
```

### Text Box Trim
```css
h1, p, button {
  text-box: trim-both cap alphabetic; /* Optical vertical centering */
}
```

### Fluid Typography
```css
.heading {
  font-size: clamp(1rem, 1rem + 0.5vw, 2rem); /* Respects user preferences */
}
```

### Dynamic Viewport Units
- `dvh` / `dvw` - Dynamic (accounts for mobile browser UI)
- `svh` / `svw` - Small (smallest possible viewport)
- `lvh` / `lvw` - Large (largest possible viewport)

---

## Animations & Motion

### Scroll-Driven Animation
```css
/* Animate on scroll position */
.parallax {
  animation: slide-up linear both;
  animation-timeline: scroll();
}

/* Animate on viewport intersection */
.fade-in {
  animation: fade linear both;
  animation-timeline: view();
  animation-range: cover -75cqi contain 20cqi;
}
```

### View Transitions
**Status:** Baseline Newly Available (Same-document).
Cross-document transitions are in Limited Availability (Chrome/Safari 18.2+).

```css
@view-transition {
  navigation: auto; /* Automatically animate page transitions (MPAs) */
}

nav {
  view-transition-name: --persist-nav; /* Persist specific elements */
  view-transition-class: --site-header; /* Group transitions with classes */
}

/* Style the active transition */
html:active-view-transition {
  overflow: hidden;
}
```

**Nested View Transition Groups:** Preserve 3D transforms and clipping during transitions.

### Advanced Easing with linear()
```css
.springy {
  --spring: linear(
    0, 0.14 4%, 0.94 17%, 1.15 24% 30%, 1.02 43%, 0.98 51%, 1 77%, 1
  );
  transition: transform 1s var(--spring);
}
```

### @starting-style
```css
.dialog {
  transition: opacity .5s, scale .5s;

  @starting-style {
    opacity: 0;
    scale: 1.1;
  }
}
```

---

## Custom Properties & Advanced Features

### @property
Type-safe, animatable custom properties:
```css
@property --gradient-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}

.animate {
  transition: --gradient-angle 1s ease;

  &:hover {
    --gradient-angle: 360deg;
  }
}
```

### Math Functions & calc-size()
**Newly Available:** `calc-size()` allows calculations and transitions on intrinsic sizes (auto, min-content).

```css
/* Finally: Animate to auto height! */
.accordion-content {
  height: 0;
  overflow: hidden;
  transition: height 0.3s ease;
}

.accordion-item.open .accordion-content {
  height: calc-size(auto);
}

.radial-layout {
  --_angle: calc(var(--sibling-index) * var(--_offset));
  translate:
    calc(cos(var(--_angle)) * var(--_circle-size))
    calc(sin(var(--_angle)) * var(--_circle-size));
}
```

### Tree Counting Functions (Coming Soon)
```css
.staggered {
  animation-delay: calc(sibling-index() * .1s);
  background-color: hsl(sibling-count() 50% 50%);
}
```

### Conditional CSS with if() (Coming Soon)
```css
.dynamic {
  color: if(
    style(--theme: dark),
    white,
    black
  );
}
```

---

## Architecture & Organization

### Cascade Layers
```css
@layer reset, design-system, components, utilities;

@import "open-props/colors" layer(design-system);
@import "components/nav/base.css" layer(components.nav);

@layer components.nav.primary {
  nav {
    position: sticky;
    inset-block-start: 0;
  }
}
```

Benefits:
- Import third-party CSS with lower specificity
- Organize styles by concern, not selector weight
- Nested layers create clear hierarchies

---

## Interactive Components

### Dialog
```html
<dialog id="modal">
  <form method="dialog">
    <button value="cancel">Cancel</button>
    <button value="confirm">Confirm</button>
  </form>
</dialog>

<button commandfor="modal" command="showModal">Open</button>
<button commandfor="modal" command="close">Close</button>
```

**New:** `closedby` attribute enables light-dismiss behavior

### Popover
```html
<button popovertarget="menu">Show Menu</button>
<div popover id="menu">...</div>
```

**popover=hint:** Ephemeral tooltips that don't dismiss other popovers

```css
[popover] {
  transition:
    display .5s allow-discrete,
    overlay .5s allow-discrete,
    opacity .5s;

  @starting-style {
    &:popover-open {
      opacity: 0;
    }
  }
}
```

### Anchor Positioning
```css
.tooltip-anchor {
  anchor-name: --tooltip;
}

.tooltip[popover] {
  position-anchor: --tooltip;
  position-area: block-start;
  position-try-fallbacks: flip-block;
  position-try-order: most-height;
}
```

**Pseudo-elements:** `anchor()`, `::scroll-button()`, `::scroll-marker()`

### Exclusive Accordion
```html
<details name="accordion">...</details>
<details name="accordion">...</details>
<!-- Only one can be open at a time -->
```

### Customizable Select
```css
select {
  appearance: base-select; /* Full CSS control */
}

/* Style options with rich HTML */
select option::before {
  content: ""; /* Can include images, icons */
}
```

### Search Element
```html
<search>
  <form>
    <input type="search" name="q">
    <button type="submit">Search</button>
  </form>
</search>
```

---

## Form Enhancements

### Field Sizing
```css
textarea, select, input {
  field-sizing: content; /* Auto-grow to content */
}

textarea {
  min-block-size: 3lh; /* Line-height units */
  max-block-size: 80dvh;
}
```

### Better Validation Pseudo-Classes
```css
/* Wait for user interaction before showing errors */
:user-invalid {
  outline-color: red;
}

:user-valid {
  outline-color: green;
}

label:has(+ input:user-invalid) {
  text-decoration: underline wavy red;
}
```

### HR in Select
```html
<select>
  <option>Option 1</option>
  <hr>
  <option>Option 2</option>
</select>
```

---

## Visual Effects

### Scrollbar Styling
```css
.custom-scrollbar {
  scrollbar-color: hotpink transparent;
  scrollbar-width: thin;
}
```

### Shape Function
```css
.complex-clip {
  clip-path: shape(
    from 0% 0%,
    curve by 50% 25% via 25% 50%,
    line to 100% 100%
  );
}
```

### Corner Shapes
```css
.fancy-corners {
  corner-shape: squircle;
  corner-shape: notch;
  corner-shape: scoop;
  corner-shape: superellipse(0.7);
}
```

---

## Progressive Enhancement Patterns

### Feature Detection
```css
@supports (animation-timeline: view()) {
  .fade-in {
    animation: fade linear both;
    animation-timeline: view();
  }
}

@supports (container-type: inline-size) {
  .responsive-card {
    container-type: inline-size;
  }
}
```

### Respect User Preferences
```css
@media (prefers-reduced-motion: no-preference) {
  .animated {
    animation: slide 1s ease;
  }
}

@media (prefers-color-scheme: dark) {
  :root {
    --surface: #222;
  }
}

@media (prefers-contrast: more) {
  .text {
    font-weight: 600;
  }
}
```

---

## Checking Browser Support: Baseline

**What is Baseline?** A unified way to understand cross-browser feature availability. Features are marked as:

- **Widely Availabl:** Supported in the last 2.5 years of all major browsers
- **Newly Availab:** Available in all major browsers
- **Limited Availability:** Not yet in all browsers

### How to Check Baseline Status

0. BEST: Fetch https://web-platform-dx.github.io/web-features-explorer/groups/ and find the feature in there, then fetch it's detail page.
1. **Can I Use:** [caniuse.com](https://caniuse.com) shows Baseline badges at the top of each feature
2. **MDN:** Look for the Baseline badge in the browser compatibility table
3. **web.dev:** Feature articles include Baseline status


**Remember:** Always check Baseline status, use `@supports` for cutting-edge features, and respect user preferences with media queries. Modern CSS is about progressive enhancement and building resilient interfaces that work for everyone.


---

## Real-World Example: Modern Component

Here's a card component using many modern CSS features:

```css
/* Cascade layer for organization */
@layer components.card {

  /* Custom properties with @property */
  @property --card-hue {
    syntax: "<number>";
    inherits: false;
    initial-value: 200;
  }

  .card {
    /* Container for responsive design */
    container: card / inline-size;

    /* Logical properties */
    inline-size: 100%;
    padding-inline: var(--space-md);
    padding-block: var(--space-lg);

    /* Modern color system */
    background: light-dark(
      oklch(98% 0.02 var(--card-hue)),
      oklch(20% 0.02 var(--card-hue))
    );

    /* Border with relative color */
    border: 1px solid oklch(from var(--surface) calc(l * 0.9) c h);

    /* Smooth corners */
    border-radius: var(--radius-md);

    /* View transition */
    view-transition-name: --card;

    /* Scroll-driven animation */
    animation: fade-in linear both;
    animation-timeline: view();
    animation-range: entry 0% cover 30%;

    /* Anchor for tooltips */
    anchor-name: --card-anchor;

    /* Transition custom property */
    transition: --card-hue 0.5s var(--ease-spring-3);

    &:hover {
      --card-hue: 280;
    }

    /* Responsive typography in container */
    @container card (width > 30ch) {
      .card__title {
        font-size: clamp(1.5rem, 3cqi, 2.5rem);
        text-wrap: balance;
      }
    }

    @container card (width < 30ch) {
      .card__image {
        aspect-ratio: 16 / 9;
        object-fit: cover;
      }
    }
  }

  .card__title {
    /* Text box trim for optical alignment */
    text-box: trim-both cap alphabetic;
    text-wrap: balance;

    /* Logical margin */
    margin-block-end: var(--space-sm);
  }

  .card__body {
    text-wrap: pretty;
    max-inline-size: 65ch;
  }

  .card__cta {
    /* Inherit font */
    font: inherit;

    /* Accent color */
    accent-color: var(--brand);

    /* Field sizing */
    field-sizing: content;

    /* Logical properties */
    padding-inline: var(--space-md);
    padding-block: var(--space-sm);

    /* Modern color with relative syntax */
    background: oklch(from var(--brand) l c h);
    color: oklch(from var(--brand) 95% 0.05 h);

    &:hover {
      background: oklch(from var(--brand) calc(l * 1.1) c h);
    }

    &:user-invalid {
      outline: 2px solid light-dark(red, #ff6b6b);
    }
  }

  /* Popover tooltip anchored to card */
  .card__tooltip[popover] {
    position-anchor: --card-anchor;
    position-area: block-start;
    position-try-fallbacks: flip-block;

    /* Entry animation */
    @starting-style {
      opacity: 0;
      scale: 0.9;
    }

    transition:
      opacity 0.2s,
      scale 0.2s,
      display 0.2s allow-discrete,
      overlay 0.2s allow-discrete;
  }

  /* Scroll state container queries */
  @supports (container-type: scroll-state) {
    .card__sticky-header {
      container-type: scroll-state;
      position: sticky;
      inset-block-start: 0;

      @container scroll-state(stuck: top) {
        box-shadow: 0 2px 8px oklch(0% 0 0 / 0.1);
      }
    }
  }

  /* Respect user preferences */
  @media (prefers-reduced-motion: reduce) {
    .card {
      animation: none;
      transition: none;
    }
  }

  @media (prefers-contrast: more) {
    .card {
      border-width: 2px;
    }
  }
}

/* Keyframes for scroll animation */
@keyframes fade-in {
  from {
    opacity: 0;
    scale: 0.95;
  }
  to {
    opacity: 1;
    scale: 1;
  }
}
```

### HTML for the Example

```html
<article class="card">
  <img
    class="card__image"
    src="image.jpg"
    alt="Description"
    loading="lazy"
  >

  <h2 class="card__title">Card Title</h2>

  <p class="card__body">
    Card description with pretty text wrapping that avoids orphans.
  </p>

  <button
    class="card__cta"
    popovertarget="card-tooltip"
  >
    Learn More
  </button>

  <div
    class="card__tooltip"
    popover="hint"
    id="card-tooltip"
  >
    Additional information appears here
  </div>
</article>
```


## Canonical Resources

- [CSS Wrapped 2025](https://chrome.dev/css-wrapped-2025/) - The year's CSS features
- [The Coyier CSS Starter](https://frontendmasters.com/blog/the-coyier-css-starter/) - Opinionated modern baseline
- [Adam Argyle's CascadiaJS 2025 Deck](https://cascadiajs-2025.netlify.app/) - (markdownified locally in ./argyle-cacadia-2025-deck.md)
- [Modern CSS in Real Life](https://chriscoyier.net/2023/06/06/modern-css-in-real-life/) - Practical applications


## Usage Guidelines

1.  **Prioritize Stability:**
    *   Recommend **Newly Available** or **Widely Available** features for production code.
    *   Use **Limited Availability** features with progressive enhancement, graceful degredation, or `@supports`. Or ask the user how they want to handle it.

2.  **Use the web platform:**
    *   Always prefer standard CSS solutions over JavaScript libraries for layout, animation, and interaction (e.g., use CSS Masonry instead of Masonry.js, Popover API instead of custom tooltip scripts).

3.  **Code Style:**
    *   Use modern color spaces (`oklch`) for new palettes.





--- URL: https://cascadiajs-2025.netlify.app/ ---

Oops, CSS Got Away From Me… Send Halp! \| 2025

## CSS can do what?!CSS can do what?!CSS can do what?!CSS can do what?!CSS can do what?!CSS can do what?!CSS can do what?!

# 25 rad features in 25 minutes

[cascadiajs-2025.netlify.app/](https://cascadiajs-2025.netlify.app)

Adam Argyle [next slide](/01-page-transitions/)


--- URL: https://cascadiajs-2025.netlify.app/01-page-transitions/ ---

Page Transitions

# Page Transitions

Easily transition elements or entire pages

    @view-transition {
      navigation: auto;
    }

    nav {
        view-transition-name: --persist-nav;
    }

[nerdy.dev](https://nerdy.dev) [next slide](/02-media-query-ranges/)


--- URL: https://cascadiajs-2025.netlify.app/02-media-query-ranges/ ---

Media Query Ranges

#### Media Query

# Range Syntax

    @media (width <= 1024px) {
        
    }

    @media (360px < width < 1024px) {
        
    }

    @container (20ch < width < 50ch) {
        
    }

    .card-grid {
        container-type: inline-size;

        > .card {
            @container (20ch < width < 50ch) {…}
        }
    }

[next slide](/03-container-query/)


--- URL: https://cascadiajs-2025.netlify.app/03-container-query/ ---

Container Queries

# Container Queries

    /* Define a container */
    .card {
      container: --my-first-cq / inline-size;
    }

    /* Query Nearest Container */
    @container (width < 40ch) {
        …
    }

    /* Query Container By Name */
    @container --my-first-cq (width < 40ch) {
        …
    }

    .perfect-bento {
      container: --perfect-bento / size;

      > .bento-layout {
        @container --perfect-bento (orientation: landscape) {
          grid-auto-flow: column;
        }
      }
    }

    .container-units {
      inline-size: 50cqi;
        block-size: 50cqb;
    }

[Demo](https://codepen.io/argyleink/pres/RwdRaVg?editors=0100) [next slide](/04-cascade-layers/)


--- URL: https://cascadiajs-2025.netlify.app/04-cascade-layers/ ---

Cascade Layers

# Cascade Layers

    @layer design.system, components, utilities;

    @import "open-props/colors" layer(design.system);
    @import "open-props/easings" layer(design.system);

    @import "components/nav/base.css" layer(components.nav);

    @layer components.nav.primary {
        nav {
            container: --primary-nav / inline-size;
            view-transition-name: --primary-nav;

            position: sticky;
            inset-block-start: 0;
        }
    }

    .demo {
        /* isolate just the demo tricks */
    }

    @layer demo.support {
        /* center the demo, etc */
    }

[next slide](/05-field-sizing/)


--- URL: https://cascadiajs-2025.netlify.app/05-field-sizing/ ---

Field Sizing

# Field Sizing

    textarea, select, input {
      field-sizing: content;
    }

    /* defensive styles */
    textarea {
      min-block-size: 3lh;
      max-block-size: 80svh;
      min-inline-size: var(--size-content-1);
      max-inline-size: var(--size-content-2);
    }

    /* defensive styles */
    select {
      min-inline-size: 5ch;
    }

[Demo](https://codepen.io/argyleink/pres/JjxQLoW?editors=0100) [Demo](https://codepen.io/argyleink/pres/WNLzyJK?editors=0100) [next slide](/06-color-scheme/)


--- URL: https://cascadiajs-2025.netlify.app/06-color-scheme/ ---

Color Scheme

# Color Scheme

Toggle light/dark page, inputs and custom components

    :root {
      color-scheme: light dark;
    }

    /* customize */
    :root {
      color-scheme: light dark;

      color: light-dark(#333, white);
      background: light-dark(white, black);
    }

    .dark  { color-scheme: dark }
    .light { color-scheme: light }

    section {
      background: light-dark(#ddd, #222);
      color: light-dark(#222, #ddd);
    }

[Demo](https://codepen.io/argyleink/pres/QwjPWGe?editors=0100) [next slide](/07-light-dark/)


--- URL: https://cascadiajs-2025.netlify.app/07-light-dark/ ---

light-dark()

# light-dark()

Leverage `color-scheme` for
easy adaptive color

    :root {
      color: light-dark(#333, white);
      background: light-dark(white, black);
    }

    section {
      border: 2px solid light-dark(lightgray, darkgray);
    }

    :root {
      --surface-1: light-dark(white, #222);
      --surface-2: light-dark(#eee, #444);
      --text-1:    light-dark(#222, #fff);
      --text-2:    light-dark(#444, #ddd);
    }

[Demo](https://codepen.io/argyleink/pres/bGPvvqm?editors=0100) [Demo](https://codepen.io/argyleink/pres/QWXmrqN?editors=0100) [next slide](/08-accent-color/)


--- URL: https://cascadiajs-2025.netlify.app/08-accent-color/ ---

Accent Color

# Accent Color

Quickly tint tons of built-in elements

    :root {
      accent-color: hotpink;
    }

    input[type="range"] {
      accent-color: black;
    }

[Demo](https://codepen.io/argyleink/pres/KKmaaEK?editors=0100) [Demo](https://codepen.io/argyleink/pres/vYPdBOO?editors=0100) [next slide](/09-@property/)


--- URL: https://cascadiajs-2025.netlify.app/09-@property/ ---

@property

# @property

Type safe, interpolatable, CSS variables

    @property --unbreakable-color {
      syntax: "<color>";
      inherits: false;
      initial-value: #decade;
    }

    @property --interpolatable-percentage {
      syntax: "<percentage>";
      inherits: true;
      initial-value: 0%;
    }

    .animate-the-property {
      transition: --interpolatable-percentage 1s ease-out;

      &:hover {
        --interpolatable-percentage: 100%;
      }
    }

    @property --animate {
      syntax: '<percentage>';
      initial-value: 0%;
      inherits: false;
    }

    @keyframes use-keyframes { to {
      --animate: 100%;
    }}

[Noisee](https://noisee.netlify.app) [Demo](https://codepen.io/argyleink/pres/rNwWwor?editors=0100) [next slide](/10-scroll-driven-animation/)


--- URL: https://cascadiajs-2025.netlify.app/10-scroll-driven-animation/ ---

Scroll Driven Animation

# Scroll Driven Animation

Animate on scroll or on viewport intersection

    .animate-on-scroll {
      animation: somethin-coo linear both;
      animation-timeline: scroll();
    }

    .animate-on-viewport-intersection {
      animation: somethin-coo linear both;
      animation-timeline: view();
    }

    @supports (animation-timeline: view()) {
      animation: slide-in linear both;
      animation-timeline: view(x);
      animation-range: cover -75cqi contain 20cqi;
    }

[scroll()](https://codepen.io/argyleink/pres/vYxGKPz?editors=0100) [scroll()](https://codepen.io/argyleink/pres/ZEdrzJZ?editors=0100) [view()](https://codepen.io/argyleink/pres/VwNMLQN?editors=0100) [view()](https://codepen.io/argyleink/pres/gOyoBLj?editors=0100) [view()](https://codepen.io/argyleink/pres/MWMQJQy?editors=0100) [view()](https://codepen.io/argyleink/pres/qBQByGN?editors=0100) [next slide](/11-linear/)


--- URL: https://cascadiajs-2025.netlify.app/11-linear/ ---

linear()

# linear()

Doesn't feel linear

    .springy {
      --spring: linear(
        0, 0.14 4%, 0.94 17%, 1.15 24% 30%, 1.02 43%, 0.98 51%, 1 77%, 1
      );
      transition: transform 1s var(--spring);
    }

    @import "open-props/easings";

    @media (prefers-reduced-motion: no-preference) {
      .springy {
        transition: transform 1s var(--ease-spring-3);
      }
    }

[Demo](https://codepen.io/argyleink/pres/XWOOydB?editors=0100) [Tool](https://linear-easing-generator.netlify.app/) [Library](https://open-props.style/#easing) [next slide](/12-hr-in-select/)


--- URL: https://cascadiajs-2025.netlify.app/12-hr-in-select/ ---

\<hr\> in \<select\>

# Horizonal Rules in Select Elements

    <select>
      <option>Option 1</option>
      <hr>
      <option>Option 2</option>
      <option>Option 3</option>
    </select>

Select with HR example

------------------------------------------------------------------------

Option 1 Option 2 Option 3

------------------------------------------------------------------------

Option 4 Option 5 Option 6 [Article](https://developer.chrome.com/blog/hr-in-select)

Chrome 119+, Safari 17+, Firefox 122+

[next slide](/13-search-element/)


--- URL: https://cascadiajs-2025.netlify.app/13-search-element/ ---

A search element

# A Search Element

    <search>
      <form>
        <label for="movie">Find a Movie</label>
        <input type="search" id="movie" name="q">
        <button type="submit">Search</button>
      </form>
    </search>

[Demo](https://codepen.io/argyleink/pres/WNLZqYZ?editors=1100) [next slide](/14-user-valid/)


--- URL: https://cascadiajs-2025.netlify.app/14-user-valid/ ---

:user-valid and :user-invalid

# Better Validation

`:valid` and `:invalid` are eager, `:user-valid` and `:user-invalid`
are lazy

    :user-valid {
      outline-color: green;
    }

    :user-invalid {
      outline-color: red;
    }

    input {
      label:has(+ &:user-invalid) {
        text-decoration: underline wavy red;
      }
    }

    input {
      label:has(+ &:user-valid)::after {
        color: green;
        content: " ✓";
      }
    }

[Demo](https://codepen.io/web-dot-dev/pen/wvNJGrO) [Demo](https://codepen.io/argyleink/pres/mdaPvYY?editors=0100) [Demo](https://codepen.io/argyleink/pres/eYbZbPY?editors=0100) [Demo](https://codepen.io/argyleink/pres/GRbYMGw?editors=1100) [next slide](/15-exclusive-accordion/)


--- URL: https://cascadiajs-2025.netlify.app/15-exclusive-accordion/ ---

Exclusive Accordion

# Exclusive Accordion

    <details name="linked-accordions">
      …
    </details>
    <details name="linked-accordions">
      …
    </details>

[Demo](https://codepen.io/argyleink/pres/MWMPOap?editors=1000) [next slide](/16-math/)


--- URL: https://cascadiajs-2025.netlify.app/16-math/ ---

Math

# Math

Lots of math

    .math-trig-you-name-it {
      rotate: cos(1rad) sin(2rad) tan(3rad);
      scale: pow(2, 3);
      translate: atan2(1, 2) asin(0.5) acos(0.5);
    }

    .radial-layout {
      --_angle: calc(var(--sibling-index) * var(--_offset));
      
      translate: 
        calc(cos(var(--_angle)) * var(--_circle-size))
        calc(sin(var(--_angle)) * var(--_circle-size))
      ;
    }

    :root {
      --mass: 1;
      --stiffness: 100;
      --damping: 5;
      --start-velocity: 0; 
    }

[Demo](https://codepen.io/argyleink/pres/jOovoav?editors=0100) [Demo](https://codepen.io/argyleink/pres/OJozxrB?editors=0100) [Demo](https://codepen.io/matthiasott/pen/yLWoXaN?editors=1000) [Demo](https://codepen.io/argyleink/pres/KKLaNdd?editors=0100) [Demo](https://codepen.io/nocksock/pres/QWXzPQg?editors=0100) [Demo](https://codepen.io/enbee81/pres/xxNzJem?editors=0100) [next slide](/17-function-teaser-slide/)


--- URL: https://cascadiajs-2025.netlify.app/17-function-teaser-slide/ ---

More Functions

# More Functions

These are in the works

    .random {
      z-index: random();
      order: random-item();
    }

    .use-nth-child-value {
      background-color: hsl(sibling-count() 50% 50%);
      animation-delay: calc(sibling-index() * .1s);
    }

    .progress {
      progress()
      media-progress()
      container-progress()
    }

    .mix {
      mix()
      calc-mix()
      cross-fade()
      transform-mix()
    }

    .misc {
      first-valid()
      toggle()
      calc-size()
    }

CSS [Values Level 5](https://drafts.csswg.org/css-values-5/)

[next slide](/18-text-wrap/)


--- URL: https://cascadiajs-2025.netlify.app/18-text-wrap/ ---

Text Wrap

# Text Wrap

Balanced blocks or orphanless paragraphs

    h1 {
      text-wrap: balance;
      max-inline-size: 25ch;
    }

    p {
      text-wrap: pretty;
      max-inline-size: 50ch;
    }

[Demo](https://codepen.io/argyleink/pres/eYxEENW?editors=0100) [Demo](https://codepen.io/web-dot-dev/pen/KKxjpQm?editors=0100) [Demo](https://codepen.io/web-dot-dev/pen/eYLwpRx?editors=0100) [next slide](/19-color-mix/)


--- URL: https://cascadiajs-2025.netlify.app/19-color-mix/ ---

Color Mix

# Color Mix

Brew your own colors

    .lighten-the-brand {
      background: color-mix(in oklab, var(--brand), white);
    }

    .reduce-transparency {
      background: color-mix(in oklab, var(--background), transparent 80%);
    }

    .nest-it {
      color: color-mix(in oklch, purple 40%, color-mix(in oklab, plum, white));
    }

[Demo](https://codepen.io/web-dot-dev/pen/poZKLdw?editors=0100) [Demo](https://codepen.io/web-dot-dev/pen/bGjKvyW?editors=0100) [Demo](https://color-mix.style) [next slide](/20-color-spaces/)


--- URL: https://cascadiajs-2025.netlify.app/20-color-spaces/ ---

Color Spaces

# Color Spaces

Blueray-like colors & gradients

    .hdr-syntax {
      background: color(display-p3 1 0 1);
      background: oklch(72% 75% 330);
    }

    .richer-colors {
      background: red;
      background: color(display-p3 1 0 0);
      background: oklch(63% 100% 30);
    }

    .sick-neons {
      @media (dynamic-range: high) {
        --neon-red: color(display-p3 1 0 0);
        --neon-blue: color(display-p3 0 0.75 1);
      }
    }

    .better-gradients {
      background: linear-gradient(
        to right in oklch, 
        color(display-p3 1 0 .5), 
        color(display-p3 0 1 1)
      );
    }

[Demo](https://codepen.io/argyleink/pen/RwyOyeq?editors=0100) [Demo](https://codepen.io/argyleink/pen/rNvEeQp?editors=0100) [Demo](https://codepen.io/argyleink/pen/abarGpJ?editors=0100) [Demo](https://codepen.io/argyleink/pen/XWdapvY?editors=0100) [Demo](https://codepen.io/argyleink/pen/xxyNNdx?editors=0100) [Demo](https://gradient.style) [next slide](/21-relative-color/)


--- URL: https://cascadiajs-2025.netlify.app/21-relative-color/ ---

Relative Color

# Relative Color

Derive and compute colors from colors

    .lighten-by-25 {
      background: oklch(from blue calc(l * 1.25) c h);
      background: oklch(from blue calc(l + .25) c h);
    }

    .lighten-to-75 {
      background: oklch(from blue 75% c h);
    }

    .set-alpha {
      background: hsl(from blue h s l / 50%);
      background: oklch(from blue l c h / 50%);
      background: rgb(from blue r g b / 50%);
    }

    .complementary-color {
      background: hsl(from blue calc(h + 180) s l);
    }

[Demo](https://codepen.io/web-dot-dev/pen/oNVLPPK?editors=0100) [Demo](https://codepen.io/web-dot-dev/pen/QWoEVJO?editors=0100) [Demo](https://codepen.io/web-dot-dev/pen/YzdByvg?editors=0100) [Demo](https://codepen.io/web-dot-dev/pen/PoVWEGK?editors=0100) [next slide](/22-scrollbars/)


--- URL: https://cascadiajs-2025.netlify.app/22-scrollbars/ ---

Scrollbars

# Scrollbars

Easily customize the scrollbar

    .custom-scrollbar {
      scrollbar-color: hotpink transparent;
    }

    .custom-scrollbar-size {
      scrollbar-width: none;
      scrollbar-width: thin;
    }

[Demo](https://codepen.io/web-dot-dev/pen/yLwMexO?editors=0100) [Demo](https://codepen.io/web-dot-dev/pen/YzgZwOO?editors=0100) [next slide](/23-starting-style/)


--- URL: https://cascadiajs-2025.netlify.app/23-starting-style/ ---

Starting Style

# @starting-style

Easy entry effects

    @starting-style { 
      scale: 0; 
    }

    .present-the-thing {
      transition: opacity .5s ease, scale .5s ease;

      @starting-style {
        opacity: 0; 
        scale: 1.1; 
      }
    }

[Demo](https://codepen.io/argyleink/pres/qBGOamz?editors=0100) [Demo](https://codepen.io/jh3y/pen/bGyrwbE?editors=0100) [next slide](/24-dialog/)


--- URL: https://cascadiajs-2025.netlify.app/24-dialog/ ---

Dialog

# Dialog

An element for synchronous blocking UI

    <dialog></dialog>

    <dialog>
      <form method="dialog">
        …
        <button value="cancel">Cancel</button>
        <button value="confirm">Confirm</button>
      </form>
    </dialog>

    document.querySelector('dialog').showModal();
    document.querySelector('dialog').close();

    <dialog id="dialog">
      <p>Hi, I'm a dialog.</p>
      <button commandfor="dialog" command="close">Ok</button>
    </dialog>

    <button commandfor="dialog" command="showModal">Open Dialog</button> 

[Demo](https://codepen.io/argyleink/pres/OJeWWNZ?editors=0100) [Demo](https://codepen.io/argyleink/pres/VwJvqrW?editors=0100) [Demo](https://codepen.io/argyleink/pres/ZENRLva?editors=0100) [Demo](https://nerdy.dev/have-a-dialog) [next slide](/25-popover/)


--- URL: https://cascadiajs-2025.netlify.app/25-popover/ ---

Popover

# Popover

An element for asynchronous non-blocking UI

    <button popovertarget="demo">Show</button>
      
    <div popover id="demo">…</div>

    [popover] {
      &, &::backdrop {
        transition: 
          display .5s allow-discrete, 
          overlay .5s allow-discrete, 
          opacity .5s;
        opacity: 0;
      }
    }

    [popover] {
      @starting-style {
        &:popover-open,
        &:popover-open::backdrop {
          opacity: 0;
        }
      }
    }

[Demo](https://codepen.io/argyleink/pres/xxozrJw?editors=0100) [Read](https://nerdy.dev/steal-this-popover-starter-kit) [next slide](/26-anchor/)


--- URL: https://cascadiajs-2025.netlify.app/26-anchor/ ---

Anchor Positioning

# Anchor Positioning

Intelligent and convenient element positioning

    .anchor {
      anchor-name: --over-easy;
    }

    .positioned-element {
      position-anchor: --over-easy;
      position: fixed;
      position-area: block-end;
    }

    .anchored[popover] {
      position-anchor: --somewhere;
      inset: auto;
      position-area: block-start;
      position-try-fallbacks: flip-block;
      position-try-order: most-height;
    }

[Demo](https://codepen.io/argyleink/pres/bGZoBYO?editors=0100) [Demo](https://codepen.io/jh3y/pres/BaVOqwz?editors=0100) [Demo](https://codepen.io/jh3y/pres/nRgxPoB?editors=0100) [Demo](https://codepen.io/jh3y/pres/dyLjbwG?editors=0100) [Demo](https://codepen.io/jh3y/pres/PoxjQRX?editors=0100) [Tool](https://chrome.dev/anchor-tool/) [next slide](/27-text-box-trim/)


--- URL: https://cascadiajs-2025.netlify.app/27-text-box-trim/ ---

Text Box Trim

# Text Box Trim

Switch from double leading to fit line-heights

    h1, p, button {
      text-box: trim-both cap alphabetic;
    }

[Demo](https://codepen.io/argyleink/pres/wvboZdY?editors=0100) [Demo](https://codepen.io/argyleink/pres/wvberMj?editors=0100) [Demo](https://codepen.io/argyleink/pres/wvLmmyQ?editors=0100) [next slide](/28-outro/)


--- URL: https://cascadiajs-2025.netlify.app/28-outro/ ---

Oops, CSS Got Away From Me… Send Halp! \| 2025
[](https://nerdy.dev "site") [](https://nerdy.dev "site") [](https://nerdy.dev "site") [](https://nerdy.dev "site") [](https://nerdy.dev "site") [](https://nerdy.dev "site") [](https://nerdy.dev "site")

# Thank You

[](https://twitter.com/argyleink "twitter") [](https://elk.zone/front-end.social/@argyleink "mastodon") [](https://bsky.app/profile/nerdy.dev "bluesky") [next slide]()
