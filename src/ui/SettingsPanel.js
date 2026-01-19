// ============================================================
// VOID SUPREMACY 3D - Settings Panel UI
// Graphics quality settings and game options
// ============================================================

import { GRAPHICS_SETTINGS, graphicsLevel } from '../core/Config.js?v=20260119';
import { eventBus, GameEvents } from '../core/EventBus.js?v=20260119';
import { graphicsManager } from '../rendering/GraphicsManager.js?v=20260119';

// Note: eventBus and GameEvents are used for emitting SETTINGS_OPEN/SETTINGS_CLOSE events

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

        // Inject styles
        this.injectStyles();

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

    injectStyles() {
        if (document.getElementById('settings-panel-styles')) return;

        const style = document.createElement('style');
        style.id = 'settings-panel-styles';
        style.textContent = `
            .settings-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 2000;
                backdrop-filter: blur(5px);
            }

            .settings-overlay.hidden {
                display: none;
            }

            .settings-panel {
                background: linear-gradient(135deg, rgba(20, 30, 50, 0.95), rgba(10, 15, 30, 0.95));
                border: 1px solid rgba(100, 200, 255, 0.3);
                border-radius: 8px;
                width: 450px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5),
                            inset 0 1px 0 rgba(255, 255, 255, 0.1);
            }

            .settings-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                border-bottom: 1px solid rgba(100, 200, 255, 0.2);
                background: rgba(0, 50, 100, 0.3);
            }

            .settings-title {
                color: #64c8ff;
                font-size: 16px;
                font-weight: bold;
                letter-spacing: 2px;
                text-shadow: 0 0 10px rgba(100, 200, 255, 0.5);
            }

            .settings-close {
                background: none;
                border: none;
                color: #aaa;
                font-size: 24px;
                cursor: pointer;
                transition: color 0.2s;
                line-height: 1;
            }

            .settings-close:hover {
                color: #ff6464;
            }

            .settings-content {
                padding: 20px;
            }

            .settings-section {
                margin-bottom: 25px;
            }

            .settings-section:last-child {
                margin-bottom: 0;
            }

            .settings-section h3 {
                color: #8ac4ff;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin: 0 0 15px 0;
                padding-bottom: 8px;
                border-bottom: 1px solid rgba(100, 200, 255, 0.15);
            }

            .quality-buttons {
                display: flex;
                gap: 10px;
                margin-bottom: 15px;
            }

            .quality-btn {
                flex: 1;
                padding: 12px 15px;
                background: rgba(30, 50, 80, 0.6);
                border: 1px solid rgba(100, 200, 255, 0.2);
                border-radius: 4px;
                color: #aac;
                font-size: 11px;
                font-weight: bold;
                letter-spacing: 1px;
                cursor: pointer;
                transition: all 0.2s;
            }

            .quality-btn:hover {
                background: rgba(50, 80, 120, 0.6);
                border-color: rgba(100, 200, 255, 0.4);
                color: #fff;
            }

            .quality-btn.active {
                background: linear-gradient(135deg, rgba(0, 100, 180, 0.6), rgba(0, 80, 150, 0.6));
                border-color: #64c8ff;
                color: #fff;
                box-shadow: 0 0 10px rgba(100, 200, 255, 0.3);
            }

            .quality-description {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                min-height: 30px;
            }

            .quality-feature {
                background: rgba(0, 100, 150, 0.3);
                border: 1px solid rgba(100, 200, 255, 0.2);
                border-radius: 3px;
                padding: 4px 10px;
                font-size: 11px;
                color: #8ac4ff;
            }

            .perf-stats {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 15px;
            }

            .perf-stat {
                background: rgba(0, 30, 60, 0.5);
                border: 1px solid rgba(100, 200, 255, 0.15);
                border-radius: 4px;
                padding: 10px;
                text-align: center;
            }

            .perf-label {
                display: block;
                font-size: 10px;
                color: #6aa;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 5px;
            }

            .perf-value {
                display: block;
                font-size: 16px;
                color: #64c8ff;
                font-weight: bold;
            }

            .controls-info {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .control-row {
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 12px;
                color: #aab;
            }

            .control-row kbd {
                background: rgba(0, 50, 100, 0.5);
                border: 1px solid rgba(100, 200, 255, 0.3);
                border-radius: 3px;
                padding: 3px 8px;
                font-family: monospace;
                font-size: 11px;
                color: #8ac4ff;
                min-width: 50px;
                text-align: center;
            }
        `;

        document.head.appendChild(style);
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

        // Update performance stats periodically when visible
        this.perfUpdateInterval = null;
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
