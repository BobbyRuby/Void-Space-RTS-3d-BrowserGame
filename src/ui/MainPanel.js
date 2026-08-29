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
