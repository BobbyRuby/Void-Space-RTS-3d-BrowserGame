// ============================================================
// VOID SUPREMACY 3D - Selection Panel UI (Section Component)
// Displays information about selected entities
// Renders into MainPanel's selection section
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
        this.emptyView = null;
        this.parentSection = null;

        this.selectedEntities = [];
        this.updateInterval = null;
    }

    init(parentSection) {
        this.parentSection = parentSection;
        this.createUI();
        this.setupEventListeners();
        console.log('Selection Panel initialized');
    }

    createUI() {
        this.container = document.createElement('div');
        this.container.id = 'selectionPanel';
        this.container.innerHTML = `
            <div class="section-header">
                <span class="selection-title">SELECTION</span>
                <span class="selection-count" id="selectionCount"></span>
            </div>
            <div class="selection-content">
                <!-- Empty State -->
                <div class="selection-empty" id="emptyView">
                    <span class="empty-icon">🎯</span>
                    <span class="empty-text">No units selected</span>
                    <span class="empty-hint">Click or drag to select</span>
                </div>

                <!-- Single Unit View -->
                <div class="selection-view hidden" id="singleView">
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
                    <div class="multi-grid" id="multiGrid"></div>
                </div>

                <!-- Production Queue View -->
                <div class="production-view hidden" id="productionView">
                    <div class="production-header">Queue</div>
                    <div class="production-current" id="productionCurrent">
                        <div class="production-icon" id="prodIcon">-</div>
                        <div class="production-progress">
                            <div class="progress-fill" id="prodProgressFill"></div>
                        </div>
                        <span class="production-name" id="prodName">None</span>
                    </div>
                    <div class="production-queue" id="productionQueue"></div>
                </div>
            </div>
        `;

        this.injectStyles();

        // Append to parent section
        if (this.parentSection) {
            this.parentSection.appendChild(this.container);
        }

        // Cache references
        this.emptyView = document.getElementById('emptyView');
        this.singleView = document.getElementById('singleView');
        this.multiView = document.getElementById('multiView');
        this.productionView = document.getElementById('productionView');
        this.selectionCount = document.getElementById('selectionCount');
    }

    injectStyles() {
        if (document.getElementById('selectionPanelStyles')) return;

        const style = document.createElement('style');
        style.id = 'selectionPanelStyles';
        style.textContent = `
            #selectionPanel {
                display: flex;
                flex-direction: column;
                height: 100%;
                font-family: 'Exo 2', sans-serif;
            }

            #selectionPanel .section-header {
                padding: 4px 8px;
                background: rgba(0, 100, 200, 0.2);
                border-bottom: 1px solid #068;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .selection-title {
                font-family: 'Orbitron', sans-serif;
                font-size: 10px;
                color: #0af;
                letter-spacing: 1px;
            }

            .selection-count {
                font-size: 10px;
                color: #8cf;
            }

            .selection-content {
                flex: 1;
                overflow: hidden;
                position: relative;
            }

            /* Empty State */
            .selection-empty {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                color: #456;
                text-align: center;
            }

            .selection-empty.hidden {
                display: none;
            }

            .empty-icon {
                font-size: 28px;
                opacity: 0.5;
                margin-bottom: 8px;
            }

            .empty-text {
                font-size: 11px;
                color: #567;
                margin-bottom: 4px;
            }

            .empty-hint {
                font-size: 9px;
                color: #345;
            }

            .selection-view {
                padding: 8px;
                height: 100%;
            }

            .selection-view.hidden {
                display: none;
            }

            /* Single View - Horizontal */
            #singleView {
                display: flex;
                gap: 12px;
                align-items: flex-start;
            }

            .entity-portrait {
                width: 64px;
                height: 64px;
                min-width: 64px;
                background: rgba(0, 50, 100, 0.4);
                border: 2px solid #068;
                border-radius: 6px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                position: relative;
            }

            .portrait-icon {
                font-size: 32px;
            }

            .entity-health-bar {
                position: absolute;
                bottom: 4px;
                left: 4px;
                right: 4px;
                height: 5px;
                background: rgba(0, 0, 0, 0.5);
                border-radius: 2px;
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
                overflow: hidden;
            }

            .entity-name {
                font-family: 'Orbitron', sans-serif;
                font-size: 13px;
                color: #0af;
                margin-bottom: 3px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .entity-type {
                font-size: 10px;
                color: #68a;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 6px;
            }

            .entity-stats {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                font-size: 10px;
            }

            .stat-item {
                display: flex;
                align-items: center;
                gap: 3px;
            }

            .stat-icon {
                font-size: 11px;
            }

            .stat-value {
                color: #8cf;
            }

            /* Multi View */
            #multiView {
                padding: 8px;
            }

            .multi-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                max-height: 140px;
                overflow-y: auto;
            }

            .multi-unit {
                width: 32px;
                height: 32px;
                background: rgba(0, 50, 100, 0.3);
                border: 1px solid #068;
                border-radius: 4px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                position: relative;
                font-size: 16px;
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
                height: 2px;
                background: rgba(0, 0, 0, 0.5);
                border-radius: 1px;
            }

            .multi-unit-health-fill {
                height: 100%;
                background: #0f0;
                border-radius: 1px;
            }

            /* Production View */
            .production-view {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                padding: 6px 8px;
                border-top: 1px solid #068;
                background: rgba(5, 15, 30, 0.95);
            }

            .production-view.hidden {
                display: none;
            }

            .production-header {
                font-size: 9px;
                color: #68a;
                margin-bottom: 4px;
                text-transform: uppercase;
                letter-spacing: 1px;
            }

            .production-current {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .production-icon {
                width: 28px;
                height: 28px;
                background: rgba(0, 50, 100, 0.4);
                border: 1px solid #068;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
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
                font-size: 10px;
                color: #8ab;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .production-queue {
                display: flex;
                gap: 4px;
                margin-left: 36px;
                margin-top: 4px;
            }

            .queue-item {
                width: 24px;
                height: 24px;
                background: rgba(0, 50, 100, 0.3);
                border: 1px solid #068;
                border-radius: 3px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                cursor: pointer;
            }

            .queue-item:hover {
                border-color: #f44;
                background: rgba(200, 50, 50, 0.3);
            }

            /* Scrollbar */
            .multi-grid::-webkit-scrollbar {
                width: 4px;
            }

            .multi-grid::-webkit-scrollbar-thumb {
                background: #0af;
                border-radius: 2px;
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
        this.updateDisplay();
    }

    updateDisplay() {
        // Filter out dead entities
        this.selectedEntities = this.selectedEntities.filter(e => !e.dead);

        // Update count
        if (this.selectionCount) {
            this.selectionCount.textContent = this.selectedEntities.length > 0 ?
                `(${this.selectedEntities.length})` : '';
        }

        if (this.selectedEntities.length === 0) {
            this.showEmptyState();
            return;
        }

        if (this.selectedEntities.length === 1) {
            this.showSingleView(this.selectedEntities[0]);
        } else {
            this.showMultiView(this.selectedEntities);
        }
    }

    showEmptyState() {
        this.emptyView.classList.remove('hidden');
        this.singleView.classList.add('hidden');
        this.multiView.classList.add('hidden');
        this.productionView.classList.add('hidden');
    }

    showSingleView(entity) {
        if (!entity) return;

        this.emptyView.classList.add('hidden');
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
        this.emptyView.classList.add('hidden');
        this.singleView.classList.add('hidden');
        this.multiView.classList.remove('hidden');
        this.productionView.classList.add('hidden');

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

    // ===== Visibility (Deprecated - always visible now) =====

    show() {
        // No-op: Always visible in MainPanel
    }

    hide() {
        // No-op: Always visible in MainPanel
    }

    dispose() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        if (this.container) {
            this.container.remove();
        }
        const style = document.getElementById('selectionPanelStyles');
        if (style) {
            style.remove();
        }
    }
}

export const selectionPanel = new SelectionPanel();

export default SelectionPanel;
