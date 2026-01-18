// ============================================================
// VOID SUPREMACY 3D - Build Menu UI
// Construction menu for buildings and unit production
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

        // Tab state
        this.activeTab = 'buildings';

        // Available items based on tech tree
        this.availableBuildings = [];
        this.availableUnits = [];

        // Hotkeys
        this.buildingHotkeys = {
            'q': 'powerPlant',
            'w': 'refinery',
            'e': 'supplyDepot',
            'r': 'shipyard',
            't': 'advancedShipyard',
            'y': 'turret',
            'u': 'radar'
        };

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

    init() {
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
            <div class="build-menu-header">
                <span class="build-menu-title">CONSTRUCTION</span>
                <button class="build-menu-close" id="closeBuildMenu">×</button>
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
                <div class="info-name">Select an item to build</div>
                <div class="info-desc"></div>
                <div class="info-cost"></div>
            </div>
        `;

        // Inject styles
        this.injectStyles();

        document.getElementById('hud').appendChild(this.container);

        // Cache references
        this.buildingList = document.getElementById('buildingList');
        this.unitList = document.getElementById('unitList');
        this.buildInfo = document.getElementById('buildInfo');
    }

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #buildMenu {
                position: absolute;
                bottom: 10px;
                left: 10px;
                width: 250px;
                height: 90px;
                background: rgba(5, 15, 30, 0.95);
                border: 2px solid #0af;
                border-radius: 5px;
                font-family: 'Exo 2', sans-serif;
                box-shadow: 0 0 20px rgba(0, 150, 255, 0.3);
                display: none;
                overflow: hidden;
            }

            #buildMenu.visible {
                display: block;
            }

            .build-menu-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 3px 8px;
                border-bottom: 1px solid #0af;
                background: rgba(0, 100, 200, 0.2);
            }

            .build-menu-title {
                font-family: 'Orbitron', sans-serif;
                font-size: 9px;
                color: #0af;
                letter-spacing: 1px;
            }

            .build-menu-close {
                background: none;
                border: none;
                color: #0af;
                font-size: 14px;
                cursor: pointer;
                padding: 0 3px;
            }

            .build-menu-close:hover {
                color: #fff;
            }

            .build-menu-tabs {
                display: flex;
                border-bottom: 1px solid #068;
            }

            .build-tab {
                flex: 1;
                padding: 4px;
                background: none;
                border: none;
                color: #68a;
                font-family: 'Orbitron', sans-serif;
                font-size: 9px;
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
                padding: 4px;
                max-height: 42px;
                overflow-x: auto;
                overflow-y: hidden;
            }

            .build-list {
                display: flex;
                gap: 4px;
                flex-wrap: nowrap;
            }

            .build-list.hidden {
                display: none;
            }

            .build-item {
                width: 36px;
                height: 36px;
                min-width: 36px;
                background: rgba(0, 50, 100, 0.3);
                border: 1px solid #068;
                border-radius: 3px;
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
            }

            .build-item.disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }

            .build-item.disabled:hover {
                border-color: #068;
            }

            .build-item-icon {
                font-size: 18px;
            }

            .build-item-name {
                display: none;
            }

            .build-item-hotkey {
                position: absolute;
                top: 1px;
                left: 2px;
                font-size: 7px;
                color: #0af;
                font-family: 'Orbitron', sans-serif;
            }

            .build-item-cost {
                position: absolute;
                bottom: 1px;
                right: 2px;
                font-size: 6px;
                color: #ffd700;
            }

            .build-menu-info {
                display: none;
            }

            /* Scrollbar styling */
            .build-menu-content::-webkit-scrollbar {
                height: 3px;
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

        // Close button
        document.getElementById('closeBuildMenu').addEventListener('click', () => {
            this.hide();
        });

        // Game events
        eventBus.on(GameEvents.BUILDING_COMPLETE, () => this.updateAvailableItems());
        eventBus.on(GameEvents.RESOURCES_CHANGED, () => this.updateItemStates());
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
    }

    updateAvailableItems() {
        this.updateBuildingList();
        this.updateUnitList();
    }

    updateBuildingList() {
        const playerRes = gameState.getResources(TEAMS.PLAYER);
        this.buildingList.innerHTML = '';

        const buildings = [
            { type: 'powerPlant', icon: '⚡', name: 'Power Plant', desc: 'Generates energy for your base', hotkey: 'Q' },
            { type: 'refinery', icon: '🏭', name: 'Refinery', desc: 'Processes ore and crystals', hotkey: 'W' },
            { type: 'supplyDepot', icon: '📦', name: 'Supply Depot', desc: 'Increases unit capacity', hotkey: 'E' },
            { type: 'shipyard', icon: '🚀', name: 'Shipyard', desc: 'Produces basic combat units', hotkey: 'R' },
            { type: 'advancedShipyard', icon: '🛸', name: 'Adv. Shipyard', desc: 'Produces advanced warships', hotkey: 'T' },
            { type: 'turret', icon: '🔫', name: 'Turret', desc: 'Defensive weapon platform', hotkey: 'Y' },
            { type: 'radar', icon: '📡', name: 'Radar', desc: 'Reveals large area of map', hotkey: 'U' }
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
                <span class="build-item-hotkey">${building.hotkey}</span>
                <span class="build-item-icon">${building.icon}</span>
                <span class="build-item-name">${building.name}</span>
                <span class="build-item-cost">$${cost.credits}</span>
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
                <span class="build-item-hotkey">${unit.hotkey}</span>
                <span class="build-item-icon">${unit.icon}</span>
                <span class="build-item-name">${unit.name}</span>
                <span class="build-item-cost">$${cost.credits}</span>
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

        this.buildInfo.innerHTML = `
            <div class="info-name">${item.name}</div>
            <div class="info-desc">${item.desc}</div>
            <div class="info-cost">
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
            </div>
        `;
    }

    showUnitInfo(item, config, cost) {
        const playerRes = gameState.getResources(TEAMS.PLAYER) || {};
        cost = cost || normalizeCost(config.cost);

        this.buildInfo.innerHTML = `
            <div class="info-name">${item.name}</div>
            <div class="info-desc">${item.desc}</div>
            <div class="info-cost">
                <span class="cost-item ${(playerRes.credits || 0) < cost.credits ? 'insufficient' : ''}">
                    💰 ${cost.credits}
                </span>
                ${cost.ore ? `<span class="cost-item ${(playerRes.ore || 0) < cost.ore ? 'insufficient' : ''}">
                    🪨 ${cost.ore}
                </span>` : ''}
                <span class="cost-item">⏱ ${(config.buildTime || 0)}s</span>
                <span class="cost-item">👥 ${config.supply || 1}</span>
            </div>
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
                }
            } else {
                const config = UNITS[type];
                if (config) {
                    const cost = normalizeCost(config.cost);
                    canBuild = this.canAfford(cost) &&
                        this.hasProductionBuilding(type) &&
                        this.hasEnoughSupply(config.supply || 1);
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
        this.hide();
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

    handleHotkey(key) {
        const lowerKey = key.toLowerCase();

        if (this.activeTab === 'buildings' && this.buildingHotkeys[lowerKey]) {
            const type = this.buildingHotkeys[lowerKey];
            const config = BUILDINGS[type];
            if (config) {
                const cost = normalizeCost(config.cost);
                if (this.canAfford(cost) && this.meetsRequirements(config)) {
                    this.startBuildingPlacement(type);
                }
            }
        } else if (this.activeTab === 'units' && this.unitHotkeys[lowerKey]) {
            const type = this.unitHotkeys[lowerKey];
            const config = UNITS[type];
            if (config) {
                const cost = normalizeCost(config.cost);
                if (this.canAfford(cost) &&
                    this.hasProductionBuilding(type) &&
                    this.hasEnoughSupply(config.supply || 1)) {
                    this.queueUnit(type);
                }
            }
        }
    }

    // ===== Visibility =====

    show() {
        this.container.classList.add('visible');
        this.updateAvailableItems();
    }

    hide() {
        this.container.classList.remove('visible');
    }

    toggle() {
        if (this.container.classList.contains('visible')) {
            this.hide();
        } else {
            this.show();
        }
    }

    isVisible() {
        return this.container.classList.contains('visible');
    }

    dispose() {
        this.container.remove();
    }
}

export const buildMenu = new BuildMenu();

export default BuildMenu;
