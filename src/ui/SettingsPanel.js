// ============================================================
// VOID SUPREMACY 3D - Settings Panel UI
// Graphics quality settings and game options
// ============================================================

import { GRAPHICS_SETTINGS, graphicsLevel } from '../core/Config.js?v=20260119';
import { eventBus, GameEvents } from '../core/EventBus.js?v=20260119';
import { graphicsManager } from '../rendering/GraphicsManager.js?v=20260119';
import { soundManager } from '../audio/SoundManager.js?v=20260119';

// Note: eventBus and GameEvents are used for emitting SETTINGS_OPEN/SETTINGS_CLOSE events
// and for mirroring GRAPHICS_QUALITY_CHANGED when the tier changes outside this panel.

const GRAPHICS_LEVEL_STORAGE_KEY = 'voidspace.graphicsLevel';

export class SettingsPanel {
    constructor() {
        this.container = null;
        this.isVisible = false;
        this.currentLevel = graphicsLevel;
    }

    init() {
        console.log('SettingsPanel.init() called');
        this.createUI();
        this.setupEventListeners();
        console.log('SettingsPanel initialized, container:', this.container);
    }

    createUI() {
        // Reflect the tier actually applied at boot (persisted, or the voted HIGH default),
        // not the static module import which stays at Config's own default value.
        this.currentLevel = typeof graphicsManager.getCurrentLevel === 'function'
            ? (graphicsManager.getCurrentLevel() || graphicsLevel)
            : graphicsLevel;

        // Main container (modal overlay)
        this.container = document.createElement('div');
        this.container.id = 'settingsPanel';
        this.container.className = 'settings-overlay hidden';
        this.container.innerHTML = `
            <div class="settings-panel">
                <div class="settings-header">
                    <span class="settings-title">SETTINGS</span>
                    <button class="settings-close" id="closeSettings">×</button>
                </div>
                <div class="settings-content">
                    <div class="settings-section">
                        <h3>Graphics Quality</h3>
                        <div class="quality-buttons" id="qualityButtons">
                            ${this.createQualityButtons()}
                        </div>
                        <div class="quality-description" id="qualityDescription">
                            ${this.getQualityDescription(this.currentLevel)}
                        </div>
                    </div>
                    <div class="settings-section">
                        <h3>Audio</h3>
                        <div class="audio-row">
                            <label for="volMaster">Master</label>
                            <input type="range" id="volMaster" min="0" max="100" value="100">
                            <span class="audio-val" id="volMasterVal">100</span>
                        </div>
                        <div class="audio-row">
                            <label for="volMusic">Music</label>
                            <input type="range" id="volMusic" min="0" max="100" value="50">
                            <span class="audio-val" id="volMusicVal">50</span>
                        </div>
                        <div class="audio-row">
                            <label for="volSfx">SFX</label>
                            <input type="range" id="volSfx" min="0" max="100" value="70">
                            <span class="audio-val" id="volSfxVal">70</span>
                        </div>
                        <div class="audio-row">
                            <label for="muteAll">Mute</label>
                            <input type="checkbox" id="muteAll">
                        </div>
                    </div>
                    <div class="settings-section">
                        <h3>Performance</h3>
                        <div class="perf-stats" id="perfStats">
                            <div class="perf-stat">
                                <span class="perf-label">FPS:</span>
                                <span class="perf-value" id="perfFPS">--</span>
                            </div>
                            <div class="perf-stat">
                                <span class="perf-label">Draw Calls:</span>
                                <span class="perf-value" id="perfDrawCalls">--</span>
                            </div>
                            <div class="perf-stat">
                                <span class="perf-label">Active Meshes:</span>
                                <span class="perf-value" id="perfMeshes">--</span>
                            </div>
                        </div>
                    </div>
                    <div class="settings-section">
                        <h3>Controls</h3>
                        <div class="controls-info">
                            <div class="control-row"><kbd>WASD</kbd> Pan camera (relative)</div>
                            <div class="control-row"><kbd>Arrow Keys</kbd> Pan camera (absolute)</div>
                            <div class="control-row"><kbd>Q/E</kbd> Rotate camera</div>
                            <div class="control-row"><kbd>Z/X</kbd> Zoom in/out</div>
                            <div class="control-row"><kbd>B</kbd> Build menu</div>
                            <div class="control-row"><kbd>P</kbd> Settings</div>
                            <div class="control-row"><kbd>F5</kbd> Quick save</div>
                            <div class="control-row"><kbd>F9</kbd> Quick load</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.container);
    }

    createQualityButtons() {
        const levels = Object.keys(GRAPHICS_SETTINGS);
        return levels.map(level => `
            <button class="quality-btn ${level === this.currentLevel ? 'active' : ''}"
                    data-level="${level}">
                ${level}
            </button>
        `).join('');
    }

    getQualityDescription(level) {
        const settings = GRAPHICS_SETTINGS[level];
        if (!settings) return '';

        const features = [];

        if (settings.bloom?.enabled) features.push('Bloom');
        if (settings.fxaa) features.push('FXAA');
        if (settings.ssao?.enabled) features.push('SSAO');
        if (settings.shadows?.enabled) {
            features.push(settings.shadows.soft ? 'Soft Shadows' : 'Shadows');
        }
        if (settings.motionBlur?.enabled) features.push('Motion Blur');
        if (settings.volumetric) features.push('Volumetric Effects');
        if (settings.materials === 'pbr') features.push('PBR Materials');

        if (features.length === 0) {
            return '<span class="quality-feature">Basic rendering (best performance)</span>';
        }

        return features.map(f => `<span class="quality-feature">${f}</span>`).join('');
    }

    setupEventListeners() {
        // Close button
        this.container.querySelector('#closeSettings').addEventListener('click', () => {
            this.hide();
        });

        // Click outside to close
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container) {
                this.hide();
            }
        });

        // Quality buttons
        this.container.querySelectorAll('.quality-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const level = btn.dataset.level;
                this.setQuality(level);
            });
        });

        // Audio volume sliders. Reflect persisted values first, then wire changes.
        const muteBox = this.container.querySelector('#muteAll');
        const setSlider = (id, fraction) => {
            const slider = this.container.querySelector('#' + id);
            const valEl = this.container.querySelector('#' + id + 'Val');
            if (!slider) return;
            const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
            slider.value = String(pct);
            if (valEl) valEl.textContent = String(pct);
        };
        setSlider('volMaster', soundManager.masterVolume);
        setSlider('volMusic', soundManager.musicVolume);
        setSlider('volSfx', soundManager.sfxVolume);
        if (muteBox) muteBox.checked = soundManager.muted;

        const bindVol = (id, apply) => {
            const slider = this.container.querySelector('#' + id);
            const valEl = this.container.querySelector('#' + id + 'Val');
            if (!slider) return;
            slider.addEventListener('input', () => {
                if (valEl) valEl.textContent = slider.value;
                apply(parseInt(slider.value, 10) / 100);
            });
        };
        bindVol('volMaster', (v) => soundManager.setMasterVolume(v));
        bindVol('volMusic', (v) => soundManager.setMusicVolume(v));
        bindVol('volSfx', (v) => soundManager.setSfxVolume(v));
        if (muteBox) {
            muteBox.addEventListener('change', () => soundManager.setMuted(muteBox.checked));
        }

        // Update performance stats periodically when visible
        this.perfUpdateInterval = null;

        // Stay in sync if the graphics tier changes outside this panel
        eventBus.on(GameEvents.GRAPHICS_QUALITY_CHANGED, (data) => {
            this.onExternalGraphicsQualityChanged(data?.level);
        });
    }

    setQuality(level) {
        if (!GRAPHICS_SETTINGS[level]) return;

        this.currentLevel = level;

        // Update button states
        this.container.querySelectorAll('.quality-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.level === level);
        });

        // Update description
        const descEl = this.container.querySelector('#qualityDescription');
        if (descEl) {
            descEl.innerHTML = this.getQualityDescription(level);
        }

        // Apply to graphics manager
        graphicsManager.applySettings(level);

        // Persist so the chosen tier survives reload
        try {
            localStorage.setItem(GRAPHICS_LEVEL_STORAGE_KEY, level);
        } catch (error) {
            // Private mode or storage disabled; not fatal
        }
    }

    // Mirror a GRAPHICS_QUALITY_CHANGED event that did not originate from this panel's
    // own setQuality() call (e.g. changed elsewhere at runtime). Does not call
    // applySettings again, it only keeps the UI and persisted value in sync.
    onExternalGraphicsQualityChanged(level) {
        if (!level || !GRAPHICS_SETTINGS[level] || level === this.currentLevel) return;

        this.currentLevel = level;

        if (this.container) {
            this.container.querySelectorAll('.quality-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.level === level);
            });

            const descEl = this.container.querySelector('#qualityDescription');
            if (descEl) {
                descEl.innerHTML = this.getQualityDescription(level);
            }
        }

        try {
            localStorage.setItem(GRAPHICS_LEVEL_STORAGE_KEY, level);
        } catch (error) {
            // Private mode or storage disabled; not fatal
        }
    }

    updatePerfStats() {
        if (!graphicsManager.initialized) return;

        const info = graphicsManager.getPerformanceInfo();

        const fpsEl = this.container.querySelector('#perfFPS');
        const drawCallsEl = this.container.querySelector('#perfDrawCalls');
        const meshesEl = this.container.querySelector('#perfMeshes');

        if (fpsEl) fpsEl.textContent = info.fps;
        if (drawCallsEl) drawCallsEl.textContent = info.drawCalls;
        if (meshesEl) meshesEl.textContent = info.activeMeshes;
    }

    show() {
        this.isVisible = true;
        this.container.classList.remove('hidden');

        // Start performance updates
        this.updatePerfStats();
        this.perfUpdateInterval = setInterval(() => this.updatePerfStats(), 500);

        eventBus.emit(GameEvents.SETTINGS_OPEN, {});
    }

    hide() {
        this.isVisible = false;
        this.container.classList.add('hidden');

        // Stop performance updates
        if (this.perfUpdateInterval) {
            clearInterval(this.perfUpdateInterval);
            this.perfUpdateInterval = null;
        }

        eventBus.emit(GameEvents.SETTINGS_CLOSE, {});
    }

    toggle() {
        console.log('SettingsPanel.toggle() called, isVisible:', this.isVisible);
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    dispose() {
        if (this.perfUpdateInterval) {
            clearInterval(this.perfUpdateInterval);
        }
        if (this.container && this.container.parentElement) {
            this.container.parentElement.removeChild(this.container);
        }
    }
}

// Singleton export
export const settingsPanel = new SettingsPanel();
export default SettingsPanel;
