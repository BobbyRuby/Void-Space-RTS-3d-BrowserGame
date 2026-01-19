// ============================================================
// VOID SUPREMACY 3D - Main Panel UI (C&C Style)
// Unified always-visible bottom panel containing all UI sections
// ============================================================

import { eventBus, GameEvents } from '../core/EventBus.js?v=20260119';
import { gameState } from '../core/GameState.js?v=20260119';
import { TEAMS } from '../core/Config.js?v=20260119';

export class MainPanel {
    constructor() {
        this.container = null;
        this.initialized = false;

        // Section references
        this.buildSection = null;
        this.selectionSection = null;
        this.commandSection = null;
        this.rallySection = null;
        this.minimapSection = null;
    }

    init() {
        this.createUI();
        this.injectStyles();
        this.initialized = true;
        console.log('Main Panel initialized');
    }

    createUI() {
        // Main panel container
        this.container = document.createElement('div');
        this.container.id = 'mainPanel';

        this.container.innerHTML = `
            <div id="buildSection" class="panel-section">
                <!-- BuildMenu will render here -->
            </div>
            <div id="selectionSection" class="panel-section">
                <!-- SelectionPanel will render here -->
            </div>
            <div id="commandSection" class="panel-section">
                <!-- CommandPanel will render here -->
            </div>
            <div id="rallySection" class="panel-section">
                <!-- RallyPointSection will render here -->
            </div>
            <div id="minimapSection" class="panel-section">
                <!-- Minimap will be moved here -->
            </div>
        `;

        // Add to HUD
        const hud = document.getElementById('hud');
        if (hud) {
            hud.appendChild(this.container);
        }

        // Cache section references
        this.buildSection = document.getElementById('buildSection');
        this.selectionSection = document.getElementById('selectionSection');
        this.commandSection = document.getElementById('commandSection');
        this.rallySection = document.getElementById('rallySection');
        this.minimapSection = document.getElementById('minimapSection');

        // Move existing minimap container into our minimap section
        this.moveMinimapToSection();
    }

    moveMinimapToSection() {
        const existingMinimap = document.getElementById('minimapContainer');
        if (existingMinimap && this.minimapSection) {
            // Remove from old position and add to our section
            this.minimapSection.appendChild(existingMinimap);

            // Override inline styles to fit in section
            existingMinimap.style.position = 'relative';
            existingMinimap.style.bottom = 'auto';
            existingMinimap.style.right = 'auto';
            existingMinimap.style.width = '100%';
            existingMinimap.style.height = '100%';
            existingMinimap.style.margin = '0';
            existingMinimap.style.borderRadius = '0';
            existingMinimap.style.border = 'none';
            existingMinimap.style.boxShadow = 'none';
        }
    }

    injectStyles() {
        const style = document.createElement('style');
        style.id = 'mainPanelStyles';
        style.textContent = `
            /* Main Panel - Always visible at bottom */
            #mainPanel {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 200px;
                display: flex;
                background: rgba(5, 15, 30, 0.95);
                border-top: 2px solid #0af;
                box-shadow: 0 -4px 20px rgba(0, 150, 255, 0.3);
                z-index: 20;
                pointer-events: auto;
            }

            /* Panel Sections */
            .panel-section {
                height: 100%;
                border-right: 1px solid #068;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }

            .panel-section:last-child {
                border-right: none;
            }

            /* Build Section - Fixed 300px */
            #buildSection {
                width: 300px;
                min-width: 300px;
            }

            /* Selection Section - Flex fill */
            #selectionSection {
                flex: 1;
                min-width: 200px;
            }

            /* Command Section - Fixed 220px */
            #commandSection {
                width: 220px;
                min-width: 220px;
            }

            /* Rally Section - Fixed 100px */
            #rallySection {
                width: 100px;
                min-width: 100px;
            }

            /* Minimap Section - Fixed 200px */
            #minimapSection {
                width: 200px;
                min-width: 200px;
                padding: 4px;
            }

            /* Section Headers */
            .section-header {
                padding: 4px 8px;
                background: rgba(0, 100, 200, 0.2);
                border-bottom: 1px solid #068;
                font-family: 'Orbitron', sans-serif;
                font-size: 10px;
                color: #0af;
                letter-spacing: 1px;
                text-transform: uppercase;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .section-content {
                flex: 1;
                overflow: auto;
                padding: 4px;
            }

            /* Empty State Message */
            .empty-state {
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100%;
                color: #456;
                font-size: 11px;
                text-align: center;
                padding: 10px;
            }

            /* Hide old bottomBar if it exists */
            #bottomBar {
                display: none !important;
            }

            /* Override minimap container when inside main panel */
            #minimapSection #minimapContainer {
                position: relative !important;
                bottom: auto !important;
                right: auto !important;
                width: 100% !important;
                height: 100% !important;
                border-radius: 3px !important;
                border: 1px solid #068 !important;
                box-shadow: none !important;
            }

            /* Minimap label inside panel */
            #minimapSection #minimapLabel {
                font-size: 8px;
            }
        `;
        document.head.appendChild(style);
    }

    // Get section element for external components to render into
    getBuildSection() {
        return this.buildSection;
    }

    getSelectionSection() {
        return this.selectionSection;
    }

    getCommandSection() {
        return this.commandSection;
    }

    getRallySection() {
        return this.rallySection;
    }

    getMinimapSection() {
        return this.minimapSection;
    }

    dispose() {
        if (this.container) {
            this.container.remove();
        }
        const style = document.getElementById('mainPanelStyles');
        if (style) {
            style.remove();
        }
    }
}

// Singleton instance
export const mainPanel = new MainPanel();

export default MainPanel;
