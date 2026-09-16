# Step 3: Speculative Decryption Pipelining & Optical Focus Animation

## Overview
Because ABRN Drive operates on high-speed infrastructure with hardware-accelerated WebCrypto, the user should never stare at a generic spinner while waiting for decryption. This step introduces speculative pipelining and "The Lens"—an optical focus animation that makes client-side zero-knowledge decryption feel tangible and instantaneous.

---

## Detailed Objectives

### 1. Speculative Hover-to-Decrypt Pipelining
* **Concept**: A user's cursor typically lingers over an item for 100–300ms before clicking. During this idle latency window, the browser can fetch the ciphertext and prime WebCrypto.
* **Implementation**:
  - Add `onMouseEnter` with a 70ms debounce timer on file rows.
  - If the user has already unlocked the folder key or entered their session PIN, send a speculative priming message to `preview.worker.ts`:
    - Fetch the initial ciphertext stream or metadata.
    - Pre-derive or unwrap the AES-256-GCM symmetric key in WebWorker memory.
  - When the user actually clicks, the key is already warm and the payload is buffered in memory. Perceived latency drops from ~250ms to <16ms (0 visible frames of delay).

### 2. "The Lens" Optical Focus Transition
* **Problem**: Standard spinners treat encryption like a slow backend burden. In ABRN Drive, encryption is the primary product value.
* **Design**:
  - Replace the rotating SVG spinner in `FilePreviewModal.tsx` with a stylized 100ms optical aperture animation:
    - Initial frame: A sleek glyph matrix of mathematical entropy / hex fragments (`4f1e a432 d88f...`) rendered with subtle glow.
    - Transition: A quick horizontal blur/focus pass (`filter: blur(...)` to `blur(0)` with sub-pixel sharpness) where the matrix dissolves into the rendered text, image, or PDF.
    - Timing: Exactly 100ms with cubic-bezier easing (`cubic-bezier(0.16, 1, 0.3, 1)`), snappy and premium.

### 3. Fluid PIN Tumbler Micro-Animation
* For files requiring explicit PIN confirmation:
  - The 4-digit PIN boxes appear as sleek metallic safe tumblers.
  - As digits are entered, the dot fills with a subtle spring scale animation (`scale-110` -> `scale-100`).
  - Upon typing the 4th digit, verification runs immediately without requiring an extra button click.
  - If correct, the tumblers slide open like an aperture, transitioning directly into the decrypted document.

---

## Verification Plan
1. **Perceived Latency Benchmark**: Measure time from click to first rendered frame with hover priming vs cold click.
2. **Animation Frame Budget**: Ensure "The Lens" transition maintains 60fps / 120fps with zero layout thrashing or repaint spikes.
3. **Vitest / Worker Tests**: Worker test suite verifying speculative priming messages and instant cache hits on preview request.
