// ============================================================
// VOID SUPREMACY 3D - Pause Menu
// Esc toggles a pause overlay: Resume / Settings / Save / Load / Quit.
// Self-contained singleton: owns its Esc listener and defers to the
// game's own Esc handling when a settings panel or build mode is active.
// ============================================================

import { gameState } from '../core/GameState.js?v=20260119';
import { settingsPanel } from './SettingsPanel.js?v=20260119';
import { saveSystem } from '../persistence/SaveSystem.js?v=20260119';

export class PauseMenu {
    constructor() {
        this.container = null;
        this.isOpen = false;
        this._buildOverlay();
        this._onKeyDown = (e) => this._handleKey(e);
        window.addEventListener('keydown', this._onKeyDown);
    }

    _buildOverlay() {
        this.container = document.createElement('div');
        this.container.id = 'pauseOverlay';
        this.container.className = 'pause-overlay';
        this.container.innerHTML = `
            <div class="pause-menu">
                <h2 class="pause-title">Paused</h2>
                <button type="button" class="pause-btn" data-action="resume">Resume</button>
                <button type="button" class="pause-btn" data-action="settings">Settings</button>
                <button type="button" class="pause-btn" data-action="save">Save (F5)</button>
                <button type="button" class="pause-btn" data-action="load">Load (F9)</button>
                <button type="button" class="pause-btn pause-btn-quit" data-action="quit">Quit to Menu</button>
            </div>
        `;
        document.body.appendChild(this.container);
        this.container.querySelectorAll('.pause-btn').forEach(btn => {
            btn.addEventListener('click', () => this._action(btn.dataset.action));
        });
    }

    _handleKey(e) {
        if (e.key !== 'Escape') return;
        // Defer to the game's own Esc handling when a settings panel is open
        // or a build/rally mode is active (Game.js already handles those cases).
        if (settingsPanel && settingsPanel.isVisible) return;
        if (gameState && gameState.buildMode) return;
        // Only toggle while a match is running.
        if (!gameState || !gameState.running) return;
        e.preventDefault();
        this.toggle();
    }

    _action(action) {
        switch (action) {
            case 'resume':
                this.close();
                break;
            case 'settings':
                if (settingsPanel.show) { settingsPanel.show(); } else { settingsPanel.toggle(); }
                break;
            case 'save':
                saveSystem.quickSave();
                break;
            case 'load':
                saveSystem.quickLoad();
                this.close();
                break;
            case 'quit':
                location.reload();
                break;
        }
    }

    toggle() {
        if (this.isOpen) { this.close(); } else { this.open(); }
    }

    open() {
        this.isOpen = true;
        this.container.classList.add('visible');
        if (gameState.pause) { gameState.pause(); }
    }

    close() {
        this.isOpen = false;
        this.container.classList.remove('visible');
        if (gameState.resume) { gameState.resume(); }
    }

    dispose() {
        window.removeEventListener('keydown', this._onKeyDown);
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
    }
}

export const pauseMenu = new PauseMenu();

export default PauseMenu;
