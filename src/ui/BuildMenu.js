// ============================================================
// VOID SUPREMACY 3D - Build Menu UI (Section Component)
// Construction menu for buildings and unit production
// Renders into MainPanel's build section
// ============================================================

import { CONFIG, BUILDINGS, UNITS, TEAMS } from '../core/Config.js';
import { eventBus, GameEvents } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';

// Helper to normalize cost - handles both number and object formats
function normalizeCost(cost) {
    if (typeof cost === 'number') {
        return { credits: cost, ore: 0, crystals: 0, energy: 0 };
    }
    return {
        credits: cost?.credits || 0,
        ore: cost?.ore || 0,
        crystals: cost?.crystals || 0,
        energy: cost?.energy || 0
    };
}

export class BuildMenu {
    constructor() {
        this.container = null;
        this.buildingList = null;
        this.unitList = null;
        this.selectedBuildingType = null;
        this.isPlacingBuilding = false;
        this.placementGhost = null;
        this.parentSection = null;

        // Tab state
        this.activeTab = 'buildings';

        // Available items based on tech tree
        this.availableBuildings = [];
        this.availableUnits = [];

        // Unit hotkeys only (no building hotkeys)
        this.unitHotkeys = {
            'q': 'harvester',
            'w': 'scout',
            'e': 'interceptor',
            'r': 'striker',
            't': 'heavy',
            'y': 'bomber',
            'u': 'gunship',
            'i': 'frigate',
            'o': 'cruiser',
            'p': 'battlecruiser'
        };
    }

    init(parentSection) {
        this.parentSection = parentSection;
        this.createUI();
        this.setupEventListeners();
        this.updateAvailableItems();
        console.log('Build Menu initialized');
    }

    createUI() {
        // Main container
        this.container = document.createElement('div');
        this.container.id = 'buildMenu';
        this.container.innerHTML = `
            <div class="section-header">
                <span class="build-menu-title">CONSTRUCTION</span>
            </div>
            <div class="build-menu-tabs">
                <button class="build-tab active" data-tab="buildings">Buildings</button>
                <button class="build-tab" data-tab="units">Units</button>
            </div>
            <div class="build-menu-content">
                <div class="build-list" id="buildingList"></div>
                <div class="build-list hidden" id="unitList"></div>
            </div>
            <div class="build-menu-info" id="buildInfo">
                <div class="info-name">Hover to see info</div>
                <div class="info-desc"></div>
                <div class="info-cost"></div>
            </div>
        `;

        // Inject styles
        this.injectStyles();

        // Append to parent section
        if (this.parentSection) {
            this.parentSection.appendChild(this.container);
        }

        // Cache references
        this.buildingList = document.getElementById('buildingList');
        this.unitList = document.getElementById('unitList');
        this.buildInfo = document.getElementById('buildInfo');
    }

    injectStyles() {
        if (document.getElementById('buildMenuStyles')) return;

        const style = document.createElement('style');
        style.id = 'buildMenuStyles';
        style.textContent = `
            #buildMenu {
                display: flex;
                flex-direction: column;
                height: 100%;
                font-family: 'Exo 2', sans-serif;
            }

            #buildMenu .section-header {
                padding: 4px 8px;
                background: rgba(0, 100, 200, 0.2);
                border-bottom: 1px solid #068;
            }

            .build-menu-title {
                font-family: 'Orbitron', sans-serif;
                font-size: 10px;
                color: #0af;
                letter-spacing: 1px;
            }

            .build-menu-tabs {
                display: flex;
                border-bottom: 1px solid #068;
            }

            .build-tab {
                flex: 1;
                padding: 6px;
                background: none;
                border: none;
                color: #68a;
                font-family: 'Orbitron', sans-serif;
                font-size: 10px;
                cursor: pointer;
                transition: all 0.2s;
            }

            .build-tab:hover {
                background: rgba(0, 150, 255, 0.1);
                color: #0af;
            }

            .build-tab.active {
                background: rgba(0, 150, 255, 0.2);
                color: #0af;
                border-bottom: 2px solid #0af;
            }

            .build-menu-content {
                flex: 1;
                padding: 6px;
                overflow-x: auto;
                overflow-y: auto;
            }

            .build-list {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 4px;
            }

            .build-list.hidden {
                display: none;
            }

            .build-item {
                aspect-ratio: 1;
                min-width: 50px;
                max-width: 60px;
                background: rgba(0, 50, 100, 0.3);
                border: 1px solid #068;
                border-radius: 4px;
                cursor: pointer;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                transition: all 0.15s;
                position: relative;
            }

            .build-item:hover {
                background: rgba(0, 100, 200, 0.4);
                border-color: #0af;
                transform: scale(1.05);
            }

            .build-item.disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }

            .build-item.disabled:hover {
                border-color: #068;
                transform: none;
            }

            .build-item-icon {
                font-size: 22px;
            }

            .build-item-name {
                display: none;
            }

            .build-item-hotkey {
                position: absolute;
                top: 2px;
                left: 3px;
                font-size: 8px;
                color: #0af;
                font-family: 'Orbitron', sans-serif;
            }

            .build-item-cost {
                position: absolute;
                bottom: 2px;
                right: 3px;
                font-size: 7px;
                color: #ffd700;
            }

            .build-item-cost.unaffordable {
                color: #f44;
            }

            .build-menu-info {
                padding: 6px 8px;
                border-top: 1px solid #068;
                background: rgba(0, 50, 100, 0.2);
                min-height: 45px;
            }

            .build-menu-info .info-name {
                font-family: 'Orbitron', sans-serif;
                font-size: 10px;
                color: #0af;
                margin-bottom: 2px;
            }

            .build-menu-info .info-desc {
                font-size: 9px;
                color: #8ab;
                margin-bottom: 3px;
            }

            .build-menu-info .info-cost {
                display: flex;
                gap: 8px;
                font-size: 9px;
            }

            .build-menu-info .cost-item {
                display: flex;
                align-items: center;
                gap: 2px;
            }

            .build-menu-info .cost-item.insufficient {
                color: #f44;
            }

            /* Scrollbar styling */
            .build-menu-content::-webkit-scrollbar {
                width: 4px;
                height: 4px;
            }

            .build-menu-content::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.3);
            }

            .build-menu-content::-webkit-scrollbar-thumb {
                background: #0af;
                border-radius: 2px;
            }
        `;
        document.head.appendChild(style);
    }

    setupEventListeners() {
        // Tab switching
        this.container.querySelectorAll('.build-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });

        // Game events
        eventBus.on(GameEvents.BUILDING_COMPLETED, () => this.updateAvailableItems());
        eventBus.on(GameEvents.RESOURCES_CHANGED, () => this.updateItemStates());
        eventBus.on(GameEvents.RESOURCE_CHANGED, () => this.updateItemStates());
    }

    switchTab(tab) {
        this.activeTab = tab;

        // Update tab buttons
        this.container.querySelectorAll('.build-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });

        // Show/hide lists
        this.buildingList.classList.toggle('hidden', tab !== 'buildings');
        this.unitList.classList.toggle('hidden', tab !== 'units');

        // Update info
        this.buildInfo.querySelector('.info-name').textContent = 'Hover to see info';
        this.buildInfo.querySelector('.info-desc').textContent = '';
        this.buildInfo.querySelector('.info-cost').innerHTML = '';
    }

    updateAvailableItems() {
        this.updateBuildingList();
        this.updateUnitList();
    }

    updateBuildingList() {
        const playerRes = gameState.getResources(TEAMS.PLAYER);
        this.buildingList.innerHTML = '';

        const buildings = [
            { type: 'powerPlant', icon: '⚡', name: 'Power Plant', desc: 'Generates energy for your base' },
            { type: 'refinery', icon: '🏭', name: 'Refinery', desc: 'Processes ore and crystals' },
            { type: 'supplyDepot', icon: '📦', name: 'Supply Depot', desc: 'Increases unit capacity' },
            { type: 'shipyard', icon: '🚀', name: 'Shipyard', desc: 'Produces basic combat units' },
            { type: 'advancedShipyard', icon: '🛸', name: 'Adv. Shipyard', desc: 'Produces advanced warships' },
            { type: 'turret', icon: '🔫', name: 'Turret', desc: 'Defensive weapon platform' },
            { type: 'radar', icon: '📡', name: 'Radar', desc: 'Reveals large area of map' },
            { type: 'forceFieldGenerator', icon: '🛡️', name: 'Force Field', desc: 'Creates barriers between generators' }
        ];

        for (const building of buildings) {
            const config = BUILDINGS[building.type];
            if (!config) continue;
            const cost = normalizeCost(config.cost);
            const canBuild = this.canAfford(cost);
            const meetsRequirements = this.meetsRequirements(config);

            const item = document.createElement('div');
            item.className = `build-item ${(!canBuild || !meetsRequirements) ? 'disabled' : ''}`;
            item.dataset.type = building.type;
            item.dataset.category = 'building';

            item.innerHTML = `
                <span class="build-item-icon">${building.icon}</span>
                <span class="build-item-name">${building.name}</span>
                <span class="build-item-cost ${!canBuild ? 'unaffordable' : ''}">$${cost.credits}</span>
            `;

            item.addEventListener('mouseenter', () => {
                this.showItemInfo(building, config, cost);
            });

            item.addEventListener('click', () => {
                if (canBuild && meetsRequirements) {
                    this.startBuildingPlacement(building.type);
                }
            });

            this.buildingList.appendChild(item);
        }
    }

    updateUnitList() {
        this.unitList.innerHTML = '';

        const units = [
            { type: 'harvester', icon: '🚜', name: 'Harvester', desc: 'Collects resources', hotkey: 'Q' },
            { type: 'scout', icon: '👁', name: 'Scout', desc: 'Fast recon unit', hotkey: 'W' },
            { type: 'interceptor', icon: '✈️', name: 'Interceptor', desc: 'Fast attack fighter', hotkey: 'E' },
            { type: 'striker', icon: '💥', name: 'Striker', desc: 'Balanced combat ship', hotkey: 'R' },
            { type: 'heavy', icon: '🛡', name: 'Heavy', desc: 'Armored assault ship', hotkey: 'T' },
            { type: 'bomber', icon: '💣', name: 'Bomber', desc: 'Anti-building specialist', hotkey: 'Y' },
            { type: 'gunship', icon: '🔥', name: 'Gunship', desc: 'Heavy weapons platform', hotkey: 'U' },
            { type: 'frigate', icon: '⚓', name: 'Frigate', desc: 'Medium warship', hotkey: 'I' },
            { type: 'cruiser', icon: '🚢', name: 'Cruiser', desc: 'Heavy warship', hotkey: 'O' },
            { type: 'battlecruiser', icon: '⭐', name: 'Battlecruiser', desc: 'Capital ship', hotkey: 'P' }
        ];

        for (const unit of units) {
            const config = UNITS[unit.type];
            if (!config) continue;

            const cost = normalizeCost(config.cost);
            const canBuild = this.canAfford(cost);
            const hasProduction = this.hasProductionBuilding(unit.type);
            const hasSupply = this.hasEnoughSupply(config.supply || 1);

            const item = document.createElement('div');
            item.className = `build-item ${(!canBuild || !hasProduction || !hasSupply) ? 'disabled' : ''}`;
            item.dataset.type = unit.type;
            item.dataset.category = 'unit';

            item.innerHTML = `
                <span class="build-item-icon">${unit.icon}</span>
                <span class="build-item-name">${unit.name}</span>
                <span class="build-item-cost ${!canBuild ? 'unaffordable' : ''}">$${cost.credits}</span>
            `;

            item.addEventListener('mouseenter', () => {
                this.showUnitInfo(unit, config, cost);
            });

            item.addEventListener('click', () => {
                if (canBuild && hasProduction && hasSupply) {
                    this.queueUnit(unit.type);
                }
            });

            this.unitList.appendChild(item);
        }
    }

    showItemInfo(item, config, cost) {
        const playerRes = gameState.getResources(TEAMS.PLAYER) || {};
        cost = cost || normalizeCost(config.cost);

        this.buildInfo.querySelector('.info-name').textContent = item.name;
        this.buildInfo.querySelector('.info-desc').textContent = item.desc;
        this.buildInfo.querySelector('.info-cost').innerHTML = `
            <span class="cost-item ${(playerRes.credits || 0) < cost.credits ? 'insufficient' : ''}">
                💰 ${cost.credits}
            </span>
            ${cost.ore ? `<span class="cost-item ${(playerRes.ore || 0) < cost.ore ? 'insufficient' : ''}">
                🪨 ${cost.ore}
            </span>` : ''}
            ${cost.crystals ? `<span class="cost-item ${(playerRes.crystals || 0) < cost.crystals ? 'insufficient' : ''}">
                💎 ${cost.crystals}
            </span>` : ''}
            ${cost.energy ? `<span class="cost-item ${(playerRes.energy || 0) < cost.energy ? 'insufficient' : ''}">
                ⚡ ${cost.energy}
            </span>` : ''}
        `;
    }

    showUnitInfo(item, config, cost) {
        const playerRes = gameState.getResources(TEAMS.PLAYER) || {};
        cost = cost || normalizeCost(config.cost);

        this.buildInfo.querySelector('.info-name').textContent = item.name;
        this.buildInfo.querySelector('.info-desc').textContent = item.desc;
        this.buildInfo.querySelector('.info-cost').innerHTML = `
            <span class="cost-item ${(playerRes.credits || 0) < cost.credits ? 'insufficient' : ''}">
                💰 ${cost.credits}
            </span>
            ${cost.ore ? `<span class="cost-item ${(playerRes.ore || 0) < cost.ore ? 'insufficient' : ''}">
                🪨 ${cost.ore}
            </span>` : ''}
            <span class="cost-item">⏱ ${(config.buildTime || 0)}s</span>
            <span class="cost-item">👥 ${config.supply || 1}</span>
        `;
    }

    updateItemStates() {
        // Update visual state of all items based on current resources
        this.container.querySelectorAll('.build-item').forEach(item => {
            const type = item.dataset.type;
            const category = item.dataset.category;

            let canBuild = false;
            if (category === 'building') {
                const config = BUILDINGS[type];
                if (config) {
                    const cost = normalizeCost(config.cost);
                    canBuild = this.canAfford(cost) && this.meetsRequirements(config);
                    // Update cost display
                    const costEl = item.querySelector('.build-item-cost');
                    if (costEl) {
                        costEl.classList.toggle('unaffordable', !this.canAfford(cost));
                    }
                }
            } else {
                const config = UNITS[type];
                if (config) {
                    const cost = normalizeCost(config.cost);
                    canBuild = this.canAfford(cost) &&
                        this.hasProductionBuilding(type) &&
                        this.hasEnoughSupply(config.supply || 1);
                    // Update cost display
                    const costEl = item.querySelector('.build-item-cost');
                    if (costEl) {
                        costEl.classList.toggle('unaffordable', !this.canAfford(cost));
                    }
                }
            }

            item.classList.toggle('disabled', !canBuild);
        });
    }

    // ===== Resource/Requirement Checks =====

    canAfford(cost) {
        const playerRes = gameState.getResources(TEAMS.PLAYER);
        if (!playerRes) return false;

        return playerRes.credits >= (cost.credits || 0) &&
            playerRes.ore >= (cost.ore || 0) &&
            playerRes.crystals >= (cost.crystals || 0) &&
            playerRes.energy >= (cost.energy || 0);
    }

    meetsRequirements(config) {
        // Check tech requirements
        if (config.requires) {
            for (const req of config.requires) {
                if (!this.hasBuilding(req)) return false;
            }
        }
        return true;
    }

    hasBuilding(type) {
        return gameState.entities.some(e =>
            e.team === TEAMS.PLAYER &&
            e.type === type &&
            !e.dead &&
            !e.isConstructing
        );
    }

    hasProductionBuilding(unitType) {
        // Check if player has a building that can produce this unit type
        // Buildings have 'canBuild' arrays listing what they can produce
        return gameState.entities.some(e =>
            e.team === TEAMS.PLAYER &&
            e.isBuilding &&
            !e.dead &&
            !e.isConstructing &&
            e.def?.canBuild?.includes(unitType)
        );
    }

    hasEnoughSupply(required) {
        const playerRes = gameState.getResources(TEAMS.PLAYER);
        // maxSupply = total capacity, supply = currently used
        return playerRes && (playerRes.maxSupply - playerRes.supply) >= required;
    }

    // ===== Building Placement =====

    startBuildingPlacement(type) {
        this.selectedBuildingType = type;
        this.isPlacingBuilding = true;
        eventBus.emit(GameEvents.BUILDING_PLACEMENT_START, { type });
    }

    cancelBuildingPlacement() {
        this.selectedBuildingType = null;
        this.isPlacingBuilding = false;
        eventBus.emit(GameEvents.BUILDING_PLACEMENT_CANCEL);
    }

    // ===== Unit Production =====

    queueUnit(type) {
        eventBus.emit(GameEvents.UNIT_QUEUE_REQUEST, {
            type,
            team: TEAMS.PLAYER
        });
    }

    // ===== Hotkey Handling =====
    // Note: Letter hotkeys (QWERTYU) disabled to avoid conflict with camera controls (WASD, QE)
    // Players use click to select build items - C&C style

    handleHotkey(key) {
        // Tab switching with number keys only
        if (key === '1') {
            this.switchTab('buildings');
            return true;
        } else if (key === '2') {
            this.switchTab('units');
            return true;
        }

        return false;
    }

    // ===== Visibility (Deprecated - always visible now) =====

    show() {
        // No-op: Always visible in MainPanel
    }

    hide() {
        // No-op: Always visible in MainPanel
    }

    toggle() {
        // No-op: Always visible in MainPanel
    }

    isVisible() {
        return true; // Always visible
    }

    dispose() {
        if (this.container) {
            this.container.remove();
        }
        const style = document.getElementById('buildMenuStyles');
        if (style) {
            style.remove();
        }
    }
}

export const buildMenu = new BuildMenu();

export default BuildMenu;
