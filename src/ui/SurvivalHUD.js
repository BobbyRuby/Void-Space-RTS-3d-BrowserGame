// ============================================================
// VOID SUPREMACY 3D - Survival HUD
// Shows wave number + next-wave countdown / enemies-remaining while a
// Survival match is running. Self-contained singleton (mirrors PauseMenu):
// owns its own poll timer, reads gameState.survival each tick, hidden unless
// gameState.survival.active. Zero Game.js coupling. CSP-clean: built via
// createElement + textContent, styled by external classes, no inline.
// Contract (voidspace-3): gameState.survival =
//   { active, waveNumber, nextWaveIn, waveActive, enemiesRemaining, wavesCleared }
// ============================================================

import { gameState } from '../core/GameState.js?v=20260119';

const POLL_MS = 200;

export class SurvivalHUD {
    constructor() {
        this.container = null;
        this.waveEl = null;
        this.statusEl = null;
        this.scoreEl = null;
        this._interval = null;
        this._visible = false;
        this._build();
        this._interval = setInterval(() => this._tick(), POLL_MS);
    }

    _build() {
        this.container = document.createElement('div');
        this.container.id = 'survivalHud';
        this.container.className = 'survival-hud';

        this.waveEl = document.createElement('div');
        this.waveEl.className = 'survival-wave';

        this.statusEl = document.createElement('div');
        this.statusEl.className = 'survival-status';

        this.scoreEl = document.createElement('div');
        this.scoreEl.className = 'survival-score';

        this.container.appendChild(this.waveEl);
        this.container.appendChild(this.statusEl);
        this.container.appendChild(this.scoreEl);

        const host = document.getElementById('hud') || document.body;
        host.appendChild(this.container);
    }

    _tick() {
        try {
            const s = gameState ? gameState.survival : null;
            if (s && s.active) {
                if (!this._visible) {
                    this.container.classList.add('visible');
                    this._visible = true;
                }
                this.waveEl.textContent = 'Wave ' + (s.waveNumber ?? 0);
                this.statusEl.textContent = s.waveActive
                    ? 'Enemies: ' + (s.enemiesRemaining ?? 0)
                    : 'Next wave: ' + Math.ceil(s.nextWaveIn ?? 0) + 's';
                this.scoreEl.textContent = 'Cleared: ' + (s.wavesCleared ?? 0);
            } else if (this._visible) {
                this.container.classList.remove('visible');
                this._visible = false;
            }
        } catch (e) {
            // Never let a bad field break the frame; log and keep polling.
            console.error('SurvivalHUD tick error:', e);
        }
    }

    dispose() {
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
    }
}

export const survivalHUD = new SurvivalHUD();

export default SurvivalHUD;
