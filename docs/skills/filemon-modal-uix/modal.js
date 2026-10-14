/**
 * ============================================================================
 * FILEMÓN MODAL UI/UX — MASTER JAVASCRIPT CONTROLLER (modal.js)
 * Universal Cinemascope Executive Modal & Sticky Tactical Dock
 * Zero-dependency, vanilla JS, accessible, armchair-ergonomic, keyboard god-mode.
 * ============================================================================
 */

(function (global) {
  'use strict';

  class FilemonModal {
    /**
     * @param {Object} config - Configuration options
     * @param {string} [config.dialogId='executive-modal'] - ID of the <dialog> element
     * @param {boolean} [config.enableAudio=true] - Enable Web Audio haptic feedback
     * @param {number} [config.armedTimeoutMs=5000] - Duration in ms the delete button stays armed
     */
    constructor(config = {}) {
      this.dialogId = config.dialogId || 'executive-modal';
      this.enableAudio = config.enableAudio !== false;
      this.armedTimeoutMs = config.armedTimeoutMs || 5000;

      this.dialog = document.getElementById(this.dialogId);
      this.stage = document.getElementById('modal-stage-body');
      this.stageContent = document.getElementById('modal-content-stage');
      this.transmuteDeck = document.querySelector('.modal-transmute-deck');

      this.activePayload = null;
      this.activeStageText = '';
      this.deleteArmedAt = 0;
      this.deleteTimer = null;
      this.keydownHandler = null;

      // Registered callbacks
      this.onDelete = null;
      this.onHeroAction = null;
      this.onFavorite = null;
      this.onTransmute = null;

      this.audioCtx = null;

      this.init();
    }

    /**
     * Synthesize clean, subtle micro-haptics via Web Audio API.
     * Zero external MP3/WAV assets required.
     * @param {'tick'|'arm'|'confirm'|'close'} type
     */
    playHaptic(type = 'tick') {
      if (!this.enableAudio) return;
      try {
        if (!this.audioCtx) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (!AudioContextClass) return;
          this.audioCtx = new AudioContextClass();
        }
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
        }

        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        if (type === 'tick') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1400, now);
          osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.04);
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.05);
        } else if (type === 'arm') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(320, now);
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.09);
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.1);
        } else if (type === 'confirm') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, now); // D5
          osc.frequency.setValueAtTime(880, now + 0.06); // A5
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.16);
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.18);
        } else if (type === 'close') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(220, now + 0.05);
          gain.gain.setValueAtTime(0.06, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.05);
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.06);
        }
      } catch (err) {
        // Silently ignore audio blockages from browser autoplay policies
      }
    }

    /**
     * Bind core click handlers and backdrop dismissal
     */
    init() {
      if (!this.dialog) return;

      // Close when clicking directly on the backdrop (outside dialog bounds)
      this.dialog.addEventListener('click', (e) => {
        if (e.target === this.dialog) {
          this.close();
        }
      });

      // Header close button
      const closeBtn = document.getElementById('modal-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.close());
      }

      // Dock back button
      const dockBackBtn = document.getElementById('modal-dock-back');
      if (dockBackBtn) {
        dockBackBtn.addEventListener('click', () => this.close());
      }

      // Dock favorite toggle button
      const dockPinBtn = document.getElementById('modal-dock-pin');
      if (dockPinBtn) {
        dockPinBtn.addEventListener('click', async () => {
          this.playHaptic('tick');
          const isFavorited = dockPinBtn.classList.toggle('favorited');
          if (this.activePayload) {
            this.activePayload.is_favorite = isFavorited;
          }
          if (this.onFavorite) {
            try {
              await this.onFavorite(this.activePayload, isFavorited);
            } catch (err) {
              console.error('[FilemonModal] onFavorite error:', err);
            }
          }
        });
      }

      // 2-Step Armed Delete Button
      const dockDeleteBtn = document.getElementById('modal-dock-delete');
      if (dockDeleteBtn) {
        dockDeleteBtn.addEventListener('click', async () => {
          const now = Date.now();
          if (now - this.deleteArmedAt > this.armedTimeoutMs) {
            // First tap: Arm the button for 5 seconds
            this.deleteArmedAt = now;
            dockDeleteBtn.classList.add('armed');
            dockDeleteBtn.innerHTML = `<span style="font-size:11px;font-weight:800;letter-spacing:0.04em;">¿BORRAR?</span>`;
            dockDeleteBtn.title = 'Toca de nuevo para confirmar borrado inmediato';
            this.playHaptic('arm');

            if (this.deleteTimer) clearTimeout(this.deleteTimer);
            this.deleteTimer = setTimeout(() => this.resetDeleteArm(), this.armedTimeoutMs);
            return;
          }

          // Second tap within window: Confirmed deletion!
          this.resetDeleteArm();
          this.playHaptic('confirm');
          this.close();

          if (this.onDelete) {
            try {
              await this.onDelete(this.activePayload);
            } catch (err) {
              console.error('[FilemonModal] onDelete error:', err);
            }
          }
        });
      }

      // Hero Action Button (Primary Lever)
      const heroActionBtn = document.getElementById('modal-dock-hero-action');
      if (heroActionBtn) {
        heroActionBtn.addEventListener('click', async () => {
          this.playHaptic('confirm');
          if (this.onHeroAction) {
            try {
              await this.onHeroAction(this.activePayload, this.activeStageText);
            } catch (err) {
              console.error('[FilemonModal] onHeroAction error:', err);
            }
          }
          this.close();
        });
      }
    }

    /**
     * Disarm the delete button and restore original icon
     */
    resetDeleteArm() {
      this.deleteArmedAt = 0;
      if (this.deleteTimer) {
        clearTimeout(this.deleteTimer);
        this.deleteTimer = null;
      }
      const dockDeleteBtn = document.getElementById('modal-dock-delete');
      if (dockDeleteBtn) {
        dockDeleteBtn.classList.remove('armed');
        dockDeleteBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        `;
        dockDeleteBtn.title = 'Borrar (Del)';
      }
    }

    /**
     * Open the Cinemascope Executive Modal with dynamic payload and options
     * @param {Object} payload - Item/entity data model
     * @param {Object} [options={}] - Custom renderers, labels, and action callbacks
     */
    open(payload = {}, options = {}) {
      if (!this.dialog) return;

      this.activePayload = payload;
      this.activeStageText = payload.text || payload.content || '';
      this.resetDeleteArm();

      // Register callbacks
      this.onDelete = options.onDelete || null;
      this.onHeroAction = options.onHeroAction || null;
      this.onFavorite = options.onFavorite || null;
      this.onTransmute = options.onTransmute || null;

      // 1. Populate Zone 1: Frozen Hero Header
      const typeBadge = document.getElementById('modal-type-badge');
      if (typeBadge) {
        typeBadge.textContent = (payload.type || 'ITEM').toUpperCase();
        if (payload.typeClass) {
          typeBadge.className = `badge executive-badge ${payload.typeClass}`;
        }
      }

      const originPill = document.getElementById('modal-origin-pill');
      if (originPill) {
        originPill.textContent = payload.origin || 'Sistema';
        originPill.style.display = payload.origin ? 'inline-flex' : 'none';
      }

      const telemetryChip = document.getElementById('modal-telemetry-chip');
      if (telemetryChip) {
        telemetryChip.textContent = payload.telemetry || '';
        telemetryChip.style.display = payload.telemetry ? 'inline-flex' : 'none';
      }

      const metricChip = document.getElementById('modal-metric-chip');
      if (metricChip) {
        metricChip.textContent = payload.metric || '';
        metricChip.style.display = payload.metric ? 'inline-flex' : 'none';
      }

      const timestampChip = document.getElementById('modal-timestamp-chip');
      if (timestampChip) {
        timestampChip.textContent = payload.timestamp || 'Ahora';
      }

      // 2. Populate Zone 2: Transmutation Deck & Stage Viewport
      if (this.transmuteDeck) {
        if (Array.isArray(options.transmutations) && options.transmutations.length > 0) {
          this.transmuteDeck.style.display = 'flex';
          this.transmuteDeck.innerHTML = `
            <span class="transmute-deck-label">⚡ Acciones:</span>
            ${options.transmutations.map((t, idx) => `
              <button class="transmute-chip-btn" data-action="${t.id}" data-index="${idx + 1}" type="button" title="Atajo: ${idx + 1}">
                ${t.icon ? `<span>${t.icon}</span>` : ''}
                <span>${t.label}</span>
                <kbd class="kbd-subtle">${idx + 1}</kbd>
              </button>
            `).join('')}
          `;

          // Bind transmutation click listeners
          this.transmuteDeck.querySelectorAll('.transmute-chip-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              const actionId = btn.getAttribute('data-action');
              const transmuteDef = options.transmutations.find(t => t.id === actionId);
              if (transmuteDef && typeof transmuteDef.handler === 'function') {
                this.playHaptic('tick');
                const result = await transmuteDef.handler(this.activePayload, this.activeStageText);
                if (result !== undefined && result !== null) {
                  this.activeStageText = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
                  this.renderStageContent(this.activeStageText, options.renderStage);
                }
              }
            });
          });
        } else {
          this.transmuteDeck.style.display = 'none';
        }
      }

      // Render Stage Viewport
      this.renderStageContent(this.activeStageText, options.renderStage);

      // 3. Populate Zone 3: Sticky Tactical Dock
      const receiptBadge = document.getElementById('modal-dock-receipt');
      if (receiptBadge) {
        receiptBadge.textContent = payload.receipt || `ID #${payload.id || 0} • Verificado`;
      }

      const pinBtn = document.getElementById('modal-dock-pin');
      if (pinBtn) {
        pinBtn.classList.toggle('favorited', Boolean(payload.is_favorite));
      }

      const heroActionText = document.getElementById('modal-hero-action-text');
      if (heroActionText) {
        heroActionText.textContent = options.heroActionText || 'CONFIRMAR';
      }

      // 4. Attach Keyboard God-Mode
      this.attachKeyboardNav(options.transmutations);

      // Show native modal
      this.dialog.showModal();
      this.playHaptic('tick');
    }

    /**
     * Render or update content inside Zone 2 stage viewport
     */
    renderStageContent(content, customRenderer) {
      if (!this.stageContent) return;
      if (typeof customRenderer === 'function') {
        this.stageContent.innerHTML = customRenderer(this.activePayload, content);
      } else {
        const escaped = String(content)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        this.stageContent.innerHTML = `<div class="stage-code-container"><code>${escaped}</code></div>`;
      }
    }

    /**
     * Setup keyboard shortcuts (Esc, Enter, C, Del, P, 1-9)
     */
    attachKeyboardNav(transmutations = []) {
      if (this.keydownHandler) {
        window.removeEventListener('keydown', this.keydownHandler);
      }

      this.keydownHandler = (e) => {
        if (!this.dialog.open) return;

        // Skip hotkeys if user is editing inside an input/textarea
        const tag = (e.target.tagName || '').toUpperCase();
        if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) {
          if (e.key === 'Escape') {
            e.preventDefault();
            this.close();
          }
          return;
        }

        // Close on Escape
        if (e.key === 'Escape') {
          e.preventDefault();
          this.close();
          return;
        }

        // Hero Action on Enter or 'c' / 'C'
        if (e.key === 'Enter' || e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          document.getElementById('modal-dock-hero-action')?.click();
          return;
        }

        // Delete (Armed 2-step) on Delete or Backspace
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          document.getElementById('modal-dock-delete')?.click();
          return;
        }

        // Favorite Toggle on 'p' / 'P' or 'f' / 'F'
        if (e.key === 'p' || e.key === 'P' || e.key === 'f' || e.key === 'F') {
          e.preventDefault();
          document.getElementById('modal-dock-pin')?.click();
          return;
        }

        // Numerical keys 1-9 for instant Transmutation Deck dispatch
        if (Array.isArray(transmutations) && /^[1-9]$/.test(e.key)) {
          const index = parseInt(e.key, 10) - 1;
          if (index >= 0 && index < transmutations.length) {
            e.preventDefault();
            const btn = this.transmuteDeck?.querySelector(`[data-index="${index + 1}"]`);
            if (btn) btn.click();
          }
        }
      };

      window.addEventListener('keydown', this.keydownHandler);
    }

    /**
     * Close the modal and clean up state
     */
    close() {
      if (!this.dialog || !this.dialog.open) return;

      this.resetDeleteArm();
      if (this.keydownHandler) {
        window.removeEventListener('keydown', this.keydownHandler);
        this.keydownHandler = null;
      }

      this.playHaptic('close');
      this.dialog.close();
      this.activePayload = null;
      this.activeStageText = '';
    }
  }

  // Export module or attach to global window
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FilemonModal;
  } else {
    global.FilemonModal = FilemonModal;
  }
})(typeof window !== 'undefined' ? window : this);
