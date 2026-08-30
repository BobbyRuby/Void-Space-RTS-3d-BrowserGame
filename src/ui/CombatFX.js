// ============================================================
// VOID SUPREMACY 3D - Combat FX
// Subtle screen-edge cues driven by existing game events:
//   COMBAT_EXPLOSION -> brief warm flash at the screen edges
//   ENTITY_DAMAGED (player team only) -> brief red vignette
// Self-contained singleton (mirrors SurvivalHUD.js): owns a single
// overlay div, appended to #hud, styled entirely by index.css classes.
// Zero Game.js coupling. CSP-clean: createElement + classList only,
// no inline style/on*= attributes. Photosensitivity-safe: disabled by
// default when the user has OS reduced-motion set (index.css handles
// that), and independently user-toggleable via localStorage.
// ============================================================

import { eventBus, GameEvents } from '../core/EventBus.js?v=20260119';
import { TEAMS } from '../core/Config.js?v=20260119';

const STORAGE_KEY = 'voidspace.screenFx';
const FLASH_THROTTLE_MS = 120;
const VIGNETTE_THROTTLE_MS = 150;
const FLASH_DURATION_MS = 220;
const VIGNETTE_DURATION_MS = 260;

export class CombatFX {
    constructor() {
        this.enabled = this._readEnabled();
        this.overlay = null;
        this._unsubExplosion = null;
        this._unsubDamage = null;
        this._flashTimeout = null;
        this._vignetteTimeout = null;
        this._lastFlash = 0;
        this._lastVignette = 0;
        this._inited = false;
    }

    _readEnabled() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw === '0') return false;
            if (raw === '1') return true;
            return true;
        } catch (error) {
            return true;
        }
    }

    init() {
        if (this._inited) return;
        this._inited = true;

        this.overlay = document.createElement('div');
        this.overlay.className = 'combat-fx-overlay';

        const host = document.getElementById('hud') || document.body;
        host.appendChild(this.overlay);

        this._unsubExplosion = eventBus.on(GameEvents.COMBAT_EXPLOSION, (data) => this._onExplosion(data));
        this._unsubDamage = eventBus.on(GameEvents.ENTITY_DAMAGED, (data) => this._onDamage(data));
    }

    _onExplosion(data) {
        try {
            if (!this.enabled) return;
            if (!this.overlay) return;
            const now = Date.now();
            if (now - this._lastFlash < FLASH_THROTTLE_MS) return;
            this._lastFlash = now;
            this._playCue('fx-explosion-flash', FLASH_DURATION_MS, '_flashTimeout');
        } catch (error) {
            console.error('CombatFX explosion handler error:', error);
        }
    }

    _onDamage(data) {
        try {
            if (!this.enabled) return;
            if (!this.overlay) return;
            if (!data || !data.entity || data.entity.team !== TEAMS.PLAYER) return;
            const now = Date.now();
            if (now - this._lastVignette < VIGNETTE_THROTTLE_MS) return;
            this._lastVignette = now;
            this._playCue('fx-damage-vignette', VIGNETTE_DURATION_MS, '_vignetteTimeout');
        } catch (error) {
            console.error('CombatFX damage handler error:', error);
        }
    }

    // Remove + reflow + re-add restarts the CSS animation even when it is
    // still running from a rapid prior trigger.
    _playCue(className, durationMs, timeoutField) {
        if (!this.overlay) return;
        if (this[timeoutField]) {
            clearTimeout(this[timeoutField]);
            this[timeoutField] = null;
        }
        this.overlay.classList.remove(className);
        void this.overlay.offsetWidth;
        this.overlay.classList.add(className);
        this[timeoutField] = setTimeout(() => {
            if (this.overlay) this.overlay.classList.remove(className);
            this[timeoutField] = null;
        }, durationMs);
    }

    setEnabled(enabled) {
        this.enabled = !!enabled;
        try {
            localStorage.setItem(STORAGE_KEY, this.enabled ? '1' : '0');
        } catch (error) {
            // Private mode or storage disabled; not fatal
        }
        if (!this.enabled && this.overlay) {
            this.overlay.classList.remove('fx-explosion-flash');
            this.overlay.classList.remove('fx-damage-vignette');
        }
    }

    dispose() {
        if (typeof this._unsubExplosion === 'function') this._unsubExplosion();
        if (typeof this._unsubDamage === 'function') this._unsubDamage();
        this._unsubExplosion = null;
        this._unsubDamage = null;
        if (this._flashTimeout) clearTimeout(this._flashTimeout);
        if (this._vignetteTimeout) clearTimeout(this._vignetteTimeout);
        this._flashTimeout = null;
        this._vignetteTimeout = null;
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        this.overlay = null;
        this._inited = false;
    }
}

export const combatFX = new CombatFX();

export default CombatFX;
