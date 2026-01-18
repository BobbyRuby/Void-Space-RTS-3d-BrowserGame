// ============================================================
// VOID SUPREMACY 3D - Command Panel UI
// Action buttons for selected units/buildings
// ============================================================

import { CONFIG, TEAMS } from '../core/Config.js';
import { eventBus, GameEvents } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';
import { FormationType } from '../systems/FormationSystem.js';

// Command types
export const CommandType = {
    MOVE: 'move',
    ATTACK: 'attack',
    STOP: 'stop',
    HOLD: 'hold',
    PATROL: 'patrol',
    GUARD: 'guard',
    HARVEST: 'harvest',
    RETURN_CARGO: 'returnCargo',
    BUILD: 'build',
    CANCEL: 'cancel',
    FORMATION: 'formation',
    ABILITY: 'ability'
};

export class CommandPanel {
    constructor() {
        this.container = null;
        this.commandGrid = null;
        this.selectedEntities = [];

        // Command definitions
        this.commands = {
            [CommandType.MOVE]: {
                icon: '➡️',
                name: 'Move',
                hotkey: 'M',
                description: 'Move to location',
                available: (entities) => entities.some(e => !e.isBuilding),
                action: () => this.startMoveCommand()
            },
            [CommandType.ATTACK]: {
                icon: '⚔️',
                name: 'Attack',
                hotkey: 'A',
                description: 'Attack target or move to attack',
                available: (entities) => entities.some(e => e.stats?.damage > 0),
                action: () => this.startAttackCommand()
            },
            [CommandType.STOP]: {
                icon: '⏹️',
                name: 'Stop',
                hotkey: 'S',
                description: 'Stop current action',
                available: (entities) => entities.some(e => !e.isBuilding),
                action: () => this.stopCommand()
            },
            [CommandType.HOLD]: {
                icon: '🛑',
                name: 'Hold',
                hotkey: 'H',
                description: 'Hold position and attack nearby enemies',
                available: (entities) => entities.some(e => e.stats?.damage > 0),
                action: () => this.holdCommand()
            },
            [CommandType.PATROL]: {
                icon: '🔄',
                name: 'Patrol',
                hotkey: 'P',
                description: 'Patrol between points',
                available: (entities) => entities.some(e => !e.isBuilding),
                action: () => this.startPatrolCommand()
            },
            [CommandType.GUARD]: {
                icon: '🛡️',
                name: 'Guard',
                hotkey: 'G',
                description: 'Guard a unit or position',
                available: (entities) => entities.some(e => e.stats?.damage > 0),
                action: () => this.startGuardCommand()
            },
            [CommandType.HARVEST]: {
                icon: '⛏️',
                name: 'Harvest',
                hotkey: 'V',
                description: 'Gather resources',
                available: (entities) => entities.some(e => e.type === 'harvester'),
                action: () => this.startHarvestCommand()
            },
            [CommandType.RETURN_CARGO]: {
                icon: '🏠',
                name: 'Return',
                hotkey: 'R',
                description: 'Return cargo to refinery',
                available: (entities) => entities.some(e => e.type === 'harvester' && e.cargo > 0),
                action: () => this.returnCargoCommand()
            },
            [CommandType.FORMATION]: {
                icon: '📐',
                name: 'Formation',
                hotkey: 'F',
                description: 'Cycle formation type',
                available: (entities) => entities.filter(e => !e.isBuilding).length > 1,
                action: () => this.cycleFormation()
            },
            [CommandType.CANCEL]: {
                icon: '❌',
                name: 'Cancel',
                hotkey: 'Escape',
                description: 'Cancel current production',
                available: (entities) => entities.some(e => e.isBuilding && e.productionQueue?.length > 0),
                action: () => this.cancelProduction()
            }
        };

        // Current command mode
        this.commandMode = null;
        this.currentFormation = FormationType.BOX;
    }

    init() {
        this.createUI();
        this.setupEventListeners();
        console.log('Command Panel initialized');
    }

    createUI() {
        this.container = document.createElement('div');
        this.container.id = 'commandPanel';
        this.container.innerHTML = `
            <div class="command-header">
                <span class="command-title">COMMANDS</span>
                <span class="command-mode" id="commandModeDisplay"></span>
            </div>
            <div class="command-grid" id="commandGrid"></div>
            <div class="formation-display" id="formationDisplay">
                Formation: <span id="currentFormation">Box</span>
            </div>
        `;

        this.injectStyles();
        document.getElementById('hud').appendChild(this.container);

        this.commandGrid = document.getElementById('commandGrid');
    }

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #commandPanel {
                position: absolute;
                bottom: 10px;
                left: 560px;
                width: 200px;
                height: 90px;
                background: rgba(5, 15, 30, 0.95);
                border: 2px solid #0af;
                border-radius: 5px;
                font-family: 'Exo 2', sans-serif;
                box-shadow: 0 0 20px rgba(0, 150, 255, 0.3);
                display: none;
                overflow: hidden;
            }

            #commandPanel.visible {
                display: block;
            }

            .command-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 4px 8px;
                border-bottom: 1px solid #068;
                background: rgba(0, 100, 200, 0.2);
            }

            .command-title {
                font-family: 'Orbitron', sans-serif;
                font-size: 9px;
                color: #0af;
                letter-spacing: 1px;
            }

            .command-mode {
                font-size: 9px;
                color: #ff0;
                text-transform: uppercase;
            }

            .command-grid {
                display: grid;
                grid-template-columns: repeat(5, 1fr);
                gap: 3px;
                padding: 5px;
            }

            .command-btn {
                width: 34px;
                height: 34px;
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

            .command-btn:hover:not(.disabled) {
                background: rgba(0, 100, 200, 0.4);
                border-color: #0af;
            }

            .command-btn.active {
                background: rgba(0, 150, 255, 0.4);
                border-color: #0af;
                box-shadow: 0 0 8px rgba(0, 150, 255, 0.5);
            }

            .command-btn.disabled {
                opacity: 0.3;
                cursor: not-allowed;
            }

            .command-icon {
                font-size: 16px;
            }

            .command-name {
                display: none;
            }

            .command-hotkey {
                position: absolute;
                top: 1px;
                right: 2px;
                font-size: 7px;
                color: #0af;
                font-family: 'Orbitron', sans-serif;
            }

            .formation-display {
                padding: 3px 8px;
                border-top: 1px solid #068;
                font-size: 8px;
                color: #68a;
                text-align: center;
            }

            .formation-display span {
                color: #0af;
                font-family: 'Orbitron', sans-serif;
            }

            /* Command cursor indicators */
            .cursor-move { cursor: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><text y="18" font-size="18">➡️</text></svg>'), auto; }
            .cursor-attack { cursor: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><text y="18" font-size="18">⚔️</text></svg>'), auto; }
            .cursor-patrol { cursor: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><text y="18" font-size="18">🔄</text></svg>'), auto; }
            .cursor-guard { cursor: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><text y="18" font-size="18">🛡️</text></svg>'), auto; }
            .cursor-harvest { cursor: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><text y="18" font-size="18">⛏️</text></svg>'), auto; }
        `;
        document.head.appendChild(style);
    }

    setupEventListeners() {
        eventBus.on(GameEvents.UI_SELECTION_CHANGED, (data) => {
            this.onSelectionChanged(data.selected || data.entities || (Array.isArray(data) ? data : []));
        });

        // Listen for command completions
        eventBus.on(GameEvents.COMMAND_COMPLETE, () => {
            this.clearCommandMode();
        });
    }

    onSelectionChanged(selection) {
        this.selectedEntities = selection || [];

        if (this.selectedEntities.length === 0) {
            this.hide();
            this.clearCommandMode();
            return;
        }

        this.show();
        this.updateCommands();
    }

    updateCommands() {
        this.commandGrid.innerHTML = '';

        for (const [type, cmd] of Object.entries(this.commands)) {
            const isAvailable = cmd.available(this.selectedEntities);
            const isActive = this.commandMode === type;

            const btn = document.createElement('div');
            btn.className = `command-btn ${!isAvailable ? 'disabled' : ''} ${isActive ? 'active' : ''}`;
            btn.dataset.command = type;

            btn.innerHTML = `
                <span class="command-hotkey">${cmd.hotkey}</span>
                <span class="command-icon">${cmd.icon}</span>
                <span class="command-name">${cmd.name}</span>
            `;

            btn.title = cmd.description;

            if (isAvailable) {
                btn.addEventListener('click', () => {
                    cmd.action();
                    this.updateCommands();
                });
            }

            this.commandGrid.appendChild(btn);
        }

        // Update formation display
        document.getElementById('currentFormation').textContent =
            this.currentFormation.charAt(0).toUpperCase() + this.currentFormation.slice(1);
    }

    // ===== Command Handlers =====

    startMoveCommand() {
        this.setCommandMode(CommandType.MOVE);
        document.body.classList.add('cursor-move');
    }

    startAttackCommand() {
        this.setCommandMode(CommandType.ATTACK);
        document.body.classList.add('cursor-attack');
    }

    stopCommand() {
        for (const entity of this.selectedEntities) {
            if (!entity.isBuilding) {
                entity.target = null;
                entity.path = null;
                entity.command = 'idle';
                eventBus.emit(GameEvents.UNIT_STOP, entity);
            }
        }
    }

    holdCommand() {
        for (const entity of this.selectedEntities) {
            if (!entity.isBuilding) {
                entity.target = null;
                entity.path = null;
                entity.command = 'hold';
                entity.holdPosition = entity.mesh ? {
                    x: entity.mesh.position.x,
                    z: entity.mesh.position.z
                } : null;
                eventBus.emit(GameEvents.UNIT_HOLD, entity);
            }
        }
    }

    startPatrolCommand() {
        this.setCommandMode(CommandType.PATROL);
        document.body.classList.add('cursor-patrol');
    }

    startGuardCommand() {
        this.setCommandMode(CommandType.GUARD);
        document.body.classList.add('cursor-guard');
    }

    startHarvestCommand() {
        this.setCommandMode(CommandType.HARVEST);
        document.body.classList.add('cursor-harvest');
    }

    returnCargoCommand() {
        for (const entity of this.selectedEntities) {
            if (entity.type === 'harvester' && entity.cargo > 0) {
                // Find nearest refinery
                const refineries = gameState.entities.filter(e =>
                    e.type === 'refinery' &&
                    e.team === entity.team &&
                    !e.dead &&
                    !e.isConstructing
                );

                if (refineries.length > 0 && entity.mesh) {
                    const pos = entity.mesh.position;
                    let nearest = refineries[0];
                    let nearestDist = Infinity;

                    for (const ref of refineries) {
                        if (ref.mesh) {
                            const dx = ref.mesh.position.x - pos.x;
                            const dz = ref.mesh.position.z - pos.z;
                            const dist = Math.sqrt(dx * dx + dz * dz);
                            if (dist < nearestDist) {
                                nearestDist = dist;
                                nearest = ref;
                            }
                        }
                    }

                    entity.command = 'returnCargo';
                    entity.returnTarget = nearest;
                    eventBus.emit(GameEvents.HARVESTER_RETURN, { harvester: entity, target: nearest });
                }
            }
        }
    }

    cycleFormation() {
        const formations = Object.values(FormationType).filter(f => f !== FormationType.CUSTOM);
        const currentIndex = formations.indexOf(this.currentFormation);
        this.currentFormation = formations[(currentIndex + 1) % formations.length];

        eventBus.emit(GameEvents.FORMATION_CHANGED, {
            units: this.selectedEntities.filter(e => !e.isBuilding),
            formation: this.currentFormation
        });

        this.updateCommands();
    }

    cancelProduction() {
        for (const entity of this.selectedEntities) {
            if (entity.isBuilding && entity.productionQueue?.length > 0) {
                eventBus.emit(GameEvents.PRODUCTION_CANCEL, {
                    building: entity,
                    index: 0 // Cancel current
                });
            }
        }
    }

    // ===== Command Mode =====

    setCommandMode(mode) {
        this.commandMode = mode;
        document.getElementById('commandModeDisplay').textContent =
            mode ? this.commands[mode]?.name.toUpperCase() : '';
    }

    clearCommandMode() {
        this.commandMode = null;
        document.getElementById('commandModeDisplay').textContent = '';

        // Remove all cursor classes
        document.body.classList.remove(
            'cursor-move', 'cursor-attack', 'cursor-patrol',
            'cursor-guard', 'cursor-harvest'
        );
    }

    getCommandMode() {
        return this.commandMode;
    }

    // ===== Hotkey Handling =====

    handleHotkey(key) {
        const upperKey = key.toUpperCase();

        for (const [type, cmd] of Object.entries(this.commands)) {
            if (cmd.hotkey.toUpperCase() === upperKey) {
                if (cmd.available(this.selectedEntities)) {
                    cmd.action();
                    this.updateCommands();
                    return true;
                }
            }
        }

        // Escape cancels command mode
        if (key === 'Escape') {
            this.clearCommandMode();
            return true;
        }

        return false;
    }

    // ===== Visibility =====

    show() {
        this.container.classList.add('visible');
    }

    hide() {
        this.container.classList.remove('visible');
    }

    dispose() {
        this.clearCommandMode();
        this.container.remove();
    }
}

export const commandPanel = new CommandPanel();

export default CommandPanel;
