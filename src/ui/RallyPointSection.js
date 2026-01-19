// ============================================================
// VOID SUPREMACY 3D - Rally Point Section UI
// Controls for setting and clearing rally points on buildings
// ============================================================

import { eventBus, GameEvents } from '../core/EventBus.js?v=20260119';
import { gameState } from '../core/GameState.js?v=20260119';
import { TEAMS } from '../core/Config.js?v=20260119';

export class RallyPointSection {
    constructor() {
        this.container = null;
        this.selectedBuilding = null;
        this.isSettingRally = false;
    }

    init(parentSection) {
        this.parentSection = parentSection;
        this.createUI();
        this.setupEventListeners();
        console.log('Rally Point Section initialized');
    }

    createUI() {
        this.container = document.createElement('div');
        this.container.id = 'rallyPointContainer';
        this.container.innerHTML = `
            <div class="section-header">
                <span>RALLY</span>
            </div>
            <div class="rally-content" id="rallyContent">
                <div class="rally-empty-state">
                    <span>Select a production building</span>
                </div>
                <div class="rally-controls hidden" id="rallyControls">
                    <button class="rally-btn" id="setRallyBtn" title="Set Rally Point (Y)">
                        <span class="rally-btn-icon">🚩</span>
                        <span class="rally-btn-text">Set</span>
                    </button>
                    <button class="rally-btn rally-btn-danger" id="clearRallyBtn" title="Clear Rally Point">
                        <span class="rally-btn-icon">❌</span>
                        <span class="rally-btn-text">Clear</span>
                    </button>
                    <div class="rally-status" id="rallyStatus">
                        No rally point
                    </div>
                </div>
            </div>
        `;

        this.injectStyles();

        if (this.parentSection) {
            this.parentSection.appendChild(this.container);
        }

        // Cache references
        this.rallyContent = document.getElementById('rallyContent');
        this.rallyControls = document.getElementById('rallyControls');
        this.rallyStatus = document.getElementById('rallyStatus');
        this.setRallyBtn = document.getElementById('setRallyBtn');
        this.clearRallyBtn = document.getElementById('clearRallyBtn');

        // Button listeners
        this.setRallyBtn.addEventListener('click', () => this.startSettingRally());
        this.clearRallyBtn.addEventListener('click', () => this.clearRally());
    }

    injectStyles() {
        if (document.getElementById('rallyPointStyles')) return;

        const style = document.createElement('style');
        style.id = 'rallyPointStyles';
        style.textContent = `
            #rallyPointContainer {
                display: flex;
                flex-direction: column;
                height: 100%;
            }

            .rally-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 8px;
            }

            .rally-empty-state {
                color: #456;
                font-size: 10px;
                text-align: center;
                line-height: 1.4;
            }

            .rally-controls {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                width: 100%;
            }

            .rally-controls.hidden {
                display: none;
            }

            .rally-btn {
                width: 80px;
                height: 36px;
                background: rgba(0, 80, 160, 0.4);
                border: 1px solid #0af;
                border-radius: 4px;
                color: #fff;
                font-family: 'Orbitron', sans-serif;
                font-size: 10px;
                cursor: pointer;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 2px;
                transition: all 0.15s;
            }

            .rally-btn:hover {
                background: rgba(0, 120, 200, 0.6);
                box-shadow: 0 0 10px rgba(0, 170, 255, 0.4);
            }

            .rally-btn.active {
                background: rgba(0, 200, 100, 0.4);
                border-color: #0f8;
                animation: pulse 0.8s ease-in-out infinite;
            }

            @keyframes pulse {
                0%, 100% { box-shadow: 0 0 5px rgba(0, 255, 136, 0.3); }
                50% { box-shadow: 0 0 15px rgba(0, 255, 136, 0.6); }
            }

            .rally-btn-danger {
                background: rgba(100, 40, 40, 0.4);
                border-color: #f44;
            }

            .rally-btn-danger:hover {
                background: rgba(150, 50, 50, 0.6);
                box-shadow: 0 0 10px rgba(255, 68, 68, 0.4);
            }

            .rally-btn-icon {
                font-size: 14px;
            }

            .rally-btn-text {
                font-size: 9px;
                letter-spacing: 0.5px;
            }

            .rally-status {
                font-size: 9px;
                color: #68a;
                text-align: center;
                margin-top: 4px;
            }

            .rally-status.active {
                color: #0f8;
            }

            /* Rally cursor when setting rally point */
            body.cursor-rally {
                cursor: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><text y="18" font-size="18">🚩</text></svg>'), crosshair;
            }
        `;
        document.head.appendChild(style);
    }

    setupEventListeners() {
        // Listen for selection changes
        eventBus.on(GameEvents.UI_SELECTION_CHANGED, (data) => {
            this.onSelectionChanged(data.selected || data.entities || []);
        });

        // Listen for rally point set completion
        eventBus.on(GameEvents.RALLY_POINT_SET, (data) => {
            this.onRallyPointSet(data);
        });

        // Listen for command mode exit (ESC pressed, etc.)
        eventBus.on(GameEvents.UI_BUILD_MODE_EXIT, () => {
            if (this.isSettingRally) {
                this.cancelSettingRally();
            }
        });
    }

    onSelectionChanged(selection) {
        // Find production building in selection
        this.selectedBuilding = null;

        for (const entity of selection) {
            if (entity.isBuilding &&
                !entity.dead &&
                !entity.isConstructing &&
                entity.team === TEAMS.PLAYER &&
                entity.def?.canBuild?.length > 0) {
                this.selectedBuilding = entity;
                break;
            }
        }

        this.updateDisplay();
    }

    updateDisplay() {
        const emptyState = this.rallyContent.querySelector('.rally-empty-state');

        if (!this.selectedBuilding) {
            // No production building selected
            emptyState.classList.remove('hidden');
            emptyState.style.display = 'block';
            this.rallyControls.classList.add('hidden');
            return;
        }

        // Production building selected
        emptyState.style.display = 'none';
        this.rallyControls.classList.remove('hidden');

        // Update status
        if (this.selectedBuilding.rallyPoint) {
            const rp = this.selectedBuilding.rallyPoint;
            this.rallyStatus.textContent = `Rally set`;
            this.rallyStatus.classList.add('active');
        } else {
            this.rallyStatus.textContent = 'No rally point';
            this.rallyStatus.classList.remove('active');
        }

        // Update button state
        this.setRallyBtn.classList.toggle('active', this.isSettingRally);
    }

    startSettingRally() {
        if (!this.selectedBuilding) return;

        this.isSettingRally = true;
        this.setRallyBtn.classList.add('active');
        document.body.classList.add('cursor-rally');

        // Enter rally point mode
        eventBus.emit(GameEvents.UI_BUILD_MODE_ENTER, {
            mode: 'rallyPoint',
            building: this.selectedBuilding
        });
    }

    cancelSettingRally() {
        this.isSettingRally = false;
        this.setRallyBtn.classList.remove('active');
        document.body.classList.remove('cursor-rally');
    }

    onRallyPointSet(data) {
        if (data.building === this.selectedBuilding) {
            this.cancelSettingRally();
            this.updateDisplay();
        }
    }

    clearRally() {
        if (!this.selectedBuilding) return;

        // Clear rally point on building
        if (this.selectedBuilding.rallyPoint) {
            this.selectedBuilding.rallyPoint = null;

            // Clear visual marker if it exists
            if (this.selectedBuilding.rallyMarker) {
                this.selectedBuilding.rallyMarker.dispose();
                this.selectedBuilding.rallyMarker = null;
            }
            if (this.selectedBuilding.rallyLine) {
                this.selectedBuilding.rallyLine.dispose();
                this.selectedBuilding.rallyLine = null;
            }
        }

        this.updateDisplay();

        eventBus.emit(GameEvents.UI_ALERT, {
            message: 'Rally point cleared',
            type: 'info',
            team: TEAMS.PLAYER
        });
    }

    // Handle hotkey for setting rally point
    handleHotkey(key) {
        if (key.toLowerCase() === 'y' && this.selectedBuilding) {
            if (this.isSettingRally) {
                this.cancelSettingRally();
                eventBus.emit(GameEvents.UI_BUILD_MODE_EXIT, {});
            } else {
                this.startSettingRally();
            }
            return true;
        }
        return false;
    }

    dispose() {
        this.cancelSettingRally();
        if (this.container) {
            this.container.remove();
        }
        const style = document.getElementById('rallyPointStyles');
        if (style) {
            style.remove();
        }
    }
}

// Singleton instance
export const rallyPointSection = new RallyPointSection();

export default RallyPointSection;
