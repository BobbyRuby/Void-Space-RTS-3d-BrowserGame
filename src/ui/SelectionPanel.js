// ============================================================
// VOID SUPREMACY 3D - Selection Panel UI
// Displays information about selected entities
// ============================================================

import { CONFIG, BUILDINGS, UNITS, TEAMS } from '../core/Config.js';
import { eventBus, GameEvents } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';

export class SelectionPanel {
    constructor() {
        this.container = null;
        this.singleView = null;
        this.multiView = null;
        this.productionView = null;

        this.selectedEntities = [];
        this.updateInterval = null;
    }

    init() {
        this.createUI();
        this.setupEventListeners();
        console.log('Selection Panel initialized');
    }

    createUI() {
        this.container = document.createElement('div');
        this.container.id = 'selectionPanel';
        this.container.innerHTML = `
            <!-- Single Unit View -->
            <div class="selection-view" id="singleView">
                <div class="entity-portrait">
                    <span class="portrait-icon" id="entityIcon">🚀</span>
                    <div class="entity-health-bar">
                        <div class="health-fill" id="entityHealthFill"></div>
                    </div>
                </div>
                <div class="entity-info">
                    <div class="entity-name" id="entityName">Unit Name</div>
                    <div class="entity-type" id="entityType">Type</div>
                    <div class="entity-stats" id="entityStats"></div>
                </div>
            </div>

            <!-- Multi-Unit View -->
            <div class="selection-view hidden" id="multiView">
                <div class="multi-header">
                    <span id="multiCount">0</span> units selected
                </div>
                <div class="multi-grid" id="multiGrid"></div>
            </div>

            <!-- Production Queue View -->
            <div class="production-view hidden" id="productionView">
                <div class="production-header">Production Queue</div>
                <div class="production-current" id="productionCurrent">
                    <div class="production-icon" id="prodIcon">-</div>
                    <div class="production-progress">
                        <div class="progress-fill" id="prodProgressFill"></div>
                    </div>
                    <span class="production-name" id="prodName">None</span>
                </div>
                <div class="production-queue" id="productionQueue"></div>
            </div>
        `;

        this.injectStyles();
        document.getElementById('hud').appendChild(this.container);

        // Cache references
        this.singleView = document.getElementById('singleView');
        this.multiView = document.getElementById('multiView');
        this.productionView = document.getElementById('productionView');
    }

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #selectionPanel {
                position: absolute;
                bottom: 10px;
                left: 340px;
                width: 300px;
                background: rgba(5, 15, 30, 0.95);
                border: 2px solid #0af;
                border-radius: 5px;
                font-family: 'Exo 2', sans-serif;
                box-shadow: 0 0 20px rgba(0, 150, 255, 0.3);
                display: none;
            }

            #selectionPanel.visible {
                display: block;
            }

            .selection-view {
                padding: 15px;
            }

            .selection-view.hidden {
                display: none;
            }

            /* Single View */
            #singleView {
                display: flex;
                gap: 15px;
            }

            .entity-portrait {
                width: 80px;
                height: 80px;
                background: rgba(0, 50, 100, 0.4);
                border: 2px solid #068;
                border-radius: 5px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                position: relative;
            }

            .portrait-icon {
                font-size: 36px;
            }

            .entity-health-bar {
                position: absolute;
                bottom: 5px;
                left: 5px;
                right: 5px;
                height: 6px;
                background: rgba(0, 0, 0, 0.5);
                border-radius: 3px;
                overflow: hidden;
            }

            .health-fill {
                height: 100%;
                background: linear-gradient(90deg, #0f0, #8f0);
                width: 100%;
                transition: width 0.2s;
            }

            .health-fill.critical {
                background: linear-gradient(90deg, #f00, #f50);
            }

            .health-fill.damaged {
                background: linear-gradient(90deg, #ff0, #fa0);
            }

            .entity-info {
                flex: 1;
            }

            .entity-name {
                font-family: 'Orbitron', sans-serif;
                font-size: 14px;
                color: #0af;
                margin-bottom: 5px;
            }

            .entity-type {
                font-size: 11px;
                color: #68a;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 10px;
            }

            .entity-stats {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 5px;
                font-size: 11px;
            }

            .stat-item {
                display: flex;
                align-items: center;
                gap: 5px;
            }

            .stat-icon {
                font-size: 12px;
            }

            .stat-value {
                color: #8cf;
            }

            /* Multi View */
            .multi-header {
                font-family: 'Orbitron', sans-serif;
                font-size: 12px;
                color: #0af;
                margin-bottom: 10px;
                text-align: center;
            }

            .multi-grid {
                display: grid;
                grid-template-columns: repeat(6, 1fr);
                gap: 5px;
                max-height: 140px;
                overflow-y: auto;
            }

            .multi-unit {
                width: 40px;
                height: 40px;
                background: rgba(0, 50, 100, 0.3);
                border: 1px solid #068;
                border-radius: 3px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                position: relative;
                font-size: 18px;
            }

            .multi-unit:hover {
                border-color: #0af;
                background: rgba(0, 100, 200, 0.4);
            }

            .multi-unit-health {
                position: absolute;
                bottom: 2px;
                left: 2px;
                right: 2px;
                height: 3px;
                background: rgba(0, 0, 0, 0.5);
                border-radius: 2px;
            }

            .multi-unit-health-fill {
                height: 100%;
                background: #0f0;
                border-radius: 2px;
            }

            /* Production View */
            .production-view {
                padding: 10px 15px;
                border-top: 1px solid #068;
            }

            .production-header {
                font-family: 'Orbitron', sans-serif;
                font-size: 11px;
                color: #68a;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 8px;
            }

            .production-current {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 8px;
            }

            .production-icon {
                width: 35px;
                height: 35px;
                background: rgba(0, 50, 100, 0.4);
                border: 1px solid #068;
                border-radius: 3px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
            }

            .production-progress {
                flex: 1;
                height: 8px;
                background: rgba(0, 0, 0, 0.5);
                border-radius: 4px;
                overflow: hidden;
            }

            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #0af, #08f);
                width: 0%;
                transition: width 0.1s;
            }

            .production-name {
                width: 80px;
                font-size: 11px;
                color: #8ab;
            }

            .production-queue {
                display: flex;
                gap: 5px;
            }

            .queue-item {
                width: 30px;
                height: 30px;
                background: rgba(0, 50, 100, 0.3);
                border: 1px solid #068;
                border-radius: 3px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                cursor: pointer;
            }

            .queue-item:hover {
                border-color: #f44;
                background: rgba(200, 50, 50, 0.3);
            }

            /* Scrollbar */
            .multi-grid::-webkit-scrollbar {
                width: 5px;
            }

            .multi-grid::-webkit-scrollbar-thumb {
                background: #0af;
                border-radius: 3px;
            }
        `;
        document.head.appendChild(style);
    }

    setupEventListeners() {
        eventBus.on(GameEvents.UI_SELECTION_CHANGED, (data) => {
            this.onSelectionChanged(data.selected || data.entities || (Array.isArray(data) ? data : []));
        });

        // Start update loop for real-time stats
        this.updateInterval = setInterval(() => this.updateDisplay(), 100);
    }

    onSelectionChanged(selection) {
        this.selectedEntities = selection || [];

        if (this.selectedEntities.length === 0) {
            this.hide();
            return;
        }

        this.show();
        this.updateDisplay();
    }

    updateDisplay() {
        if (this.selectedEntities.length === 0) return;

        // Filter out dead entities
        this.selectedEntities = this.selectedEntities.filter(e => !e.dead);

        if (this.selectedEntities.length === 0) {
            this.hide();
            return;
        }

        if (this.selectedEntities.length === 1) {
            this.showSingleView(this.selectedEntities[0]);
        } else {
            this.showMultiView(this.selectedEntities);
        }
    }

    showSingleView(entity) {
        if (!entity) return;

        this.singleView.classList.remove('hidden');
        this.multiView.classList.add('hidden');

        // Update portrait
        const icon = this.getEntityIcon(entity);
        document.getElementById('entityIcon').textContent = icon;

        // Update health bar
        const maxHealth = entity.maxHealth || 1;
        const healthPercent = ((entity.health || 0) / maxHealth) * 100;
        const healthFill = document.getElementById('entityHealthFill');
        healthFill.style.width = `${healthPercent}%`;
        healthFill.className = 'health-fill';
        if (healthPercent < 25) healthFill.classList.add('critical');
        else if (healthPercent < 50) healthFill.classList.add('damaged');

        // Update info
        document.getElementById('entityName').textContent = this.getEntityDisplayName(entity);

        // Show construction status if building is under construction
        if (entity.isBuilding && entity.isConstructing) {
            const pct = Math.floor((entity.constructionProgress || 0) * 100);
            document.getElementById('entityType').textContent = `Constructing... ${pct}%`;
        } else {
            document.getElementById('entityType').textContent = entity.isBuilding ? 'Structure' : 'Unit';
        }

        // Update stats
        const statsHtml = this.getEntityStatsHtml(entity);
        document.getElementById('entityStats').innerHTML = statsHtml;

        // Show production if building has queue (buildQueue not productionQueue)
        if (entity.isBuilding && entity.buildQueue && entity.buildQueue.length > 0) {
            this.showProductionQueue(entity);
        } else if (entity.isBuilding && entity.isConstructing) {
            // Show construction progress bar in production view
            this.showConstructionProgress(entity);
        } else {
            this.productionView.classList.add('hidden');
        }
    }

    showConstructionProgress(building) {
        this.productionView.classList.remove('hidden');

        const pct = Math.floor((building.constructionProgress || 0) * 100);
        document.getElementById('prodIcon').textContent = '🔨';
        document.getElementById('prodName').textContent = 'Building...';
        document.getElementById('prodProgressFill').style.width = `${pct}%`;

        // Clear queue display
        const queueDiv = document.getElementById('productionQueue');
        if (queueDiv) queueDiv.innerHTML = '';
    }

    showMultiView(entities) {
        this.singleView.classList.add('hidden');
        this.multiView.classList.remove('hidden');
        this.productionView.classList.add('hidden');

        // Update count
        document.getElementById('multiCount').textContent = entities.length;

        // Build grid
        const grid = document.getElementById('multiGrid');
        grid.innerHTML = '';

        for (const entity of entities) {
            const healthPercent = (entity.health / entity.maxHealth) * 100;
            const item = document.createElement('div');
            item.className = 'multi-unit';
            item.innerHTML = `
                ${this.getEntityIcon(entity)}
                <div class="multi-unit-health">
                    <div class="multi-unit-health-fill" style="width: ${healthPercent}%"></div>
                </div>
            `;

            item.addEventListener('click', () => {
                // Select just this unit
                gameState.selectedEntities = [entity];
                eventBus.emit(GameEvents.UI_SELECTION_CHANGED, { entities: [entity] });
            });

            grid.appendChild(item);
        }
    }

    showProductionQueue(building) {
        this.productionView.classList.remove('hidden');

        // Use buildQueue (the actual property name in Building class)
        const queue = building.buildQueue || [];
        const current = queue[0];

        // Update current production
        if (current && current.type) {
            const config = UNITS[current.type];
            if (config) {
                document.getElementById('prodIcon').textContent = this.getUnitIcon(current.type);
                document.getElementById('prodName').textContent = config.name || this.formatName(current.type);

                // buildProgress is stored on the building itself (0-1 range)
                const progress = (building.buildProgress || 0) * 100;
                document.getElementById('prodProgressFill').style.width = `${Math.min(100, progress)}%`;
            } else {
                document.getElementById('prodIcon').textContent = '❓';
                document.getElementById('prodName').textContent = this.formatName(current.type);
                document.getElementById('prodProgressFill').style.width = '0%';
            }
        } else {
            document.getElementById('prodIcon').textContent = '-';
            document.getElementById('prodName').textContent = 'None';
            document.getElementById('prodProgressFill').style.width = '0%';
        }

        // Update queue
        const queueDiv = document.getElementById('productionQueue');
        queueDiv.innerHTML = '';

        for (let i = 1; i < queue.length && i < 6; i++) {
            const queueItem = queue[i];
            if (!queueItem || !queueItem.type) continue;

            const item = document.createElement('div');
            item.className = 'queue-item';
            item.textContent = this.getUnitIcon(queueItem.type);
            item.title = `Click to cancel ${this.formatName(queueItem.type)}`;

            item.addEventListener('click', () => {
                eventBus.emit(GameEvents.PRODUCTION_CANCEL, {
                    building,
                    index: i
                });
            });

            queueDiv.appendChild(item);
        }

        if (queue.length > 6) {
            const more = document.createElement('div');
            more.className = 'queue-item';
            more.textContent = `+${queue.length - 6}`;
            more.style.fontSize = '10px';
            queueDiv.appendChild(more);
        }
    }

    getEntityIcon(entity) {
        const icons = {
            // Buildings
            commandCenter: '🏛',
            powerPlant: '⚡',
            refinery: '🏭',
            supplyDepot: '📦',
            shipyard: '🚀',
            advancedShipyard: '🛸',
            turret: '🔫',
            radar: '📡',
            // Units
            harvester: '🚜',
            scout: '👁',
            interceptor: '✈️',
            striker: '💥',
            heavy: '🛡',
            bomber: '💣',
            gunship: '🔥',
            frigate: '⚓',
            cruiser: '🚢',
            battlecruiser: '⭐',
            dreadnought: '👑',
            // Aliens
            guardian: '👾',
            sentinel: '🛸'
        };

        return icons[entity.type] || '❓';
    }

    getUnitIcon(type) {
        const icons = {
            harvester: '🚜',
            scout: '👁',
            interceptor: '✈️',
            striker: '💥',
            heavy: '🛡',
            bomber: '💣',
            gunship: '🔥',
            frigate: '⚓',
            cruiser: '🚢',
            battlecruiser: '⭐',
            dreadnought: '👑'
        };
        return icons[type] || '❓';
    }

    getEntityDisplayName(entity) {
        if (!entity || !entity.type) return 'Unknown';
        // Use name from def if available, otherwise format type
        if (entity.def?.name) {
            return entity.def.name;
        }
        return this.formatName(entity.type);
    }

    formatName(type) {
        if (!type) return 'Unknown';
        return type
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }

    getEntityStatsHtml(entity) {
        const stats = [];
        const def = entity.def || {};

        // Health
        stats.push(`
            <div class="stat-item">
                <span class="stat-icon">❤️</span>
                <span class="stat-value">${Math.floor(entity.health || 0)}/${entity.maxHealth || 0}</span>
            </div>
        `);

        // Damage
        if (def.damage) {
            stats.push(`
                <div class="stat-item">
                    <span class="stat-icon">⚔️</span>
                    <span class="stat-value">${def.damage}</span>
                </div>
            `);
        }

        // Speed
        if (def.speed) {
            stats.push(`
                <div class="stat-item">
                    <span class="stat-icon">💨</span>
                    <span class="stat-value">${def.speed}</span>
                </div>
            `);
        }

        // Range
        if (def.range) {
            stats.push(`
                <div class="stat-item">
                    <span class="stat-icon">🎯</span>
                    <span class="stat-value">${def.range}</span>
                </div>
            `);
        }

        // Armor
        if (def.armor) {
            stats.push(`
                <div class="stat-item">
                    <span class="stat-icon">🛡</span>
                    <span class="stat-value">${def.armor}</span>
                </div>
            `);
        }

        // Cargo (for harvesters)
        if (entity.cargo !== undefined && entity.type === 'harvester') {
            const capacity = def.cargoCapacity || entity.cargoCapacity || 100;
            stats.push(`
                <div class="stat-item">
                    <span class="stat-icon">📦</span>
                    <span class="stat-value">${entity.cargo}/${capacity}</span>
                </div>
            `);
        }

        // Energy production (for power plants)
        if (entity.type === 'powerPlant') {
            stats.push(`
                <div class="stat-item">
                    <span class="stat-icon">⚡</span>
                    <span class="stat-value">+${BUILDINGS.powerPlant.energyProduction}/s</span>
                </div>
            `);
        }

        return stats.join('');
    }

    show() {
        this.container.classList.add('visible');
    }

    hide() {
        this.container.classList.remove('visible');
    }

    dispose() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.container.remove();
    }
}

export const selectionPanel = new SelectionPanel();

export default SelectionPanel;
