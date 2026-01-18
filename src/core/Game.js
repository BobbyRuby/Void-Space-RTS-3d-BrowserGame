// ============================================================
// VOID SUPREMACY 3D - Main Game Class
// Orchestrates all game modules and manages game lifecycle
// ============================================================

import { CONFIG, TEAMS, BUILDINGS, UNITS, TEAM_NAMES, applyGameConfig } from './Config.js';
import { eventBus, GameEvents } from './EventBus.js';
import { gameState } from './GameState.js';
import { resetSeededRandom, getSeededRandom } from './SeededRandom.js';

import { Unit } from '../entities/Unit.js';
import { Building } from '../entities/Building.js';
import { AlienUnit } from '../entities/AlienUnit.js';

import { sceneManager } from '../rendering/SceneManager.js';
import { combatSystem } from '../systems/CombatSystem.js';
import { aiSystem } from '../systems/AISystem.js';
import { resourceSystem } from '../systems/ResourceSystem.js';
import { selectionSystem } from '../systems/SelectionSystem.js';
import { fogOfWar } from '../systems/FogOfWar.js';
import { pathfinding } from '../systems/Pathfinding.js';
import { formationSystem } from '../systems/FormationSystem.js';
import { inputManager } from '../input/InputManager.js';
import { minimap } from '../ui/Minimap.js';
import { buildMenu } from '../ui/BuildMenu.js';
import { selectionPanel } from '../ui/SelectionPanel.js';
import { commandPanel } from '../ui/CommandPanel.js';
import { settingsPanel } from '../ui/SettingsPanel.js';
import { soundManager } from '../audio/SoundManager.js';
import { saveSystem } from '../persistence/SaveSystem.js';

export class Game {
    constructor() {
        this.initialized = false;
        this.loadingProgress = 0;
        this.defenseTimestamps = new Map(); // Track last defense trigger per building
    }

    async init(canvasId, minimapId, lobbyConfig = null) {
        // Get canvas elements
        const canvas = document.getElementById(canvasId);
        const minimapCanvas = document.getElementById(minimapId);

        if (!canvas || !minimapCanvas) {
            throw new Error('Required canvas elements not found');
        }

        // Apply lobby configuration if provided
        if (lobbyConfig) {
            applyGameConfig(lobbyConfig);
            console.log('Lobby config applied to game');
        }

        // Initialize seeded random number generator
        const seed = CONFIG.MAP_SEED || String(Date.now());
        this.rng = resetSeededRandom(seed);
        console.log('Map seed:', seed);

        // Initialize scene manager
        this.updateLoadingProgress(10, 'Initializing renderer...');
        const scene = sceneManager.init(canvas);

        // Initialize systems
        this.updateLoadingProgress(20, 'Loading systems...');
        combatSystem.init(scene);
        resourceSystem.init(scene);
        selectionSystem.init();
        aiSystem.init();

        // Initialize pathfinding and fog of war
        this.updateLoadingProgress(35, 'Initializing navigation...');
        pathfinding.init();
        fogOfWar.init(scene);
        formationSystem.init();

        // Initialize audio
        this.updateLoadingProgress(45, 'Loading audio...');
        soundManager.init(scene);

        // Initialize input
        this.updateLoadingProgress(55, 'Setting up input...');
        inputManager.init(canvas);

        // Initialize UI
        this.updateLoadingProgress(65, 'Creating UI...');
        minimap.init(minimapCanvas);
        buildMenu.init();
        selectionPanel.init();
        commandPanel.init();
        settingsPanel.init();

        // Initialize persistence
        this.updateLoadingProgress(75, 'Loading save system...');
        await saveSystem.init();

        // Generate world
        this.updateLoadingProgress(80, 'Generating world...');
        resourceSystem.generateOreFields();
        resourceSystem.generateCrystalFields();

        // Spawn bases
        this.updateLoadingProgress(90, 'Spawning bases...');
        this.spawnPlayerBases(scene);
        this.spawnNeutralAliens(scene);

        // Setup event handlers
        this.setupEventHandlers(scene);

        // Calculate initial resources
        this.updateResourceCapacity();

        this.updateLoadingProgress(100, 'Ready!');
        this.initialized = true;

        return this;
    }

    updateLoadingProgress(progress, text) {
        this.loadingProgress = progress;

        const progressEl = document.getElementById('loadingProgress');
        const textEl = document.getElementById('loadingText');

        if (progressEl) {
            progressEl.style.width = progress + '%';
        }
        if (textEl) {
            textEl.textContent = text;
        }
    }

    setupEventHandlers(scene) {
        // Handle building placement from UI or AI
        eventBus.on(GameEvents.BUILDING_PLACED, (data) => {
            this.createBuilding(data.position.x, data.position.z, data.team, data.type, scene);
            // Clear build mode after placing (for player)
            if (data.team === TEAMS.PLAYER) {
                gameState.buildMode = null;
            }
        });

        // Handle unit spawning from buildings
        eventBus.on(GameEvents.UNIT_SPAWNED, (data) => {
            const unit = this.createUnit(data.position.x, data.position.z, data.team, data.unitType, scene);

            // Auto-rally or auto-harvest
            if (data.rallyPoint) {
                unit.moveTo(data.rallyPoint.x, data.rallyPoint.z);
            } else if (data.unitType === 'harvester') {
                const ore = unit.findNearestOre();
                if (ore) unit.harvest(ore);
            }

            // Update supply
            const unitDef = UNITS[data.unitType];
            gameState.modifyResource(data.team, 'supply', unitDef.supply);
            gameState.recordUnitBuilt(data.team);

            // Alert for player
            if (data.team === TEAMS.PLAYER) {
                this.showAlert(`${unitDef.name} ready!`, 'info');
            }
        });

        // Handle building completion
        eventBus.on(GameEvents.BUILDING_COMPLETED, (data) => {
            if (data.building.team === TEAMS.PLAYER) {
                this.showAlert(`${data.building.def.name} complete!`, 'success');
            }
            this.updateResourceCapacity();
        });

        // Handle alerts
        eventBus.on(GameEvents.UI_ALERT, (data) => {
            if (data.team === TEAMS.PLAYER) {
                this.showAlert(data.message, data.type);
            }
        });

        // Handle game end check
        eventBus.on(GameEvents.ENTITY_DESTROYED, () => {
            this.checkGameEnd();
        });

        // Handle build mode enter (from hotkeys)
        eventBus.on(GameEvents.UI_BUILD_MODE_ENTER, (data) => {
            gameState.buildMode = data.mode;
            console.log('Build mode entered:', data.mode);
        });

        // Handle build mode exit
        eventBus.on(GameEvents.UI_BUILD_MODE_EXIT, () => {
            gameState.buildMode = null;
            console.log('Build mode exited');
        });

        // Handle building placement start (from BuildMenu UI clicks)
        eventBus.on(GameEvents.BUILDING_PLACEMENT_START, (data) => {
            gameState.buildMode = data.type;
            console.log('Building placement started:', data.type);
        });

        // Handle building placement cancel
        eventBus.on(GameEvents.BUILDING_PLACEMENT_CANCEL, () => {
            gameState.buildMode = null;
            console.log('Building placement cancelled');
        });

        // Handle unit queue request from BuildMenu
        eventBus.on(GameEvents.UNIT_QUEUE_REQUEST, (data) => {
            const { type, team } = data;
            console.log('Unit queue request:', type, 'for team', team);

            // Find a production building that can build this unit
            const productionBuilding = gameState.entities.find(e =>
                e.team === team &&
                e.isBuilding &&
                !e.dead &&
                !e.isConstructing &&
                e.def?.canBuild?.includes(type)
            );

            if (productionBuilding) {
                // Building.queueUnit handles cost deduction and validation
                const success = productionBuilding.queueUnit(type);
                console.log('Unit queued at', productionBuilding.type, 'success:', success);

                if (success && team === TEAMS.PLAYER) {
                    const unitDef = UNITS[type];
                    this.showAlert(`${unitDef.name} queued`, 'info');
                }
            } else {
                console.log('No production building found for', type);
                if (team === TEAMS.PLAYER) {
                    this.showAlert('No building available to produce this unit', 'error');
                }
            }
        });

        // Handle auto-defense: nearby units engage attackers when buildings take damage
        eventBus.on(GameEvents.ENTITY_DAMAGED, (data) => {
            const { entity, attacker } = data;

            // Only defend buildings
            if (!entity.isBuilding || entity.dead) return;

            // Only for player team (team 0) - AI handles its own logic
            if (entity.team !== TEAMS.PLAYER) return;

            // Need a valid attacker to engage
            if (!attacker || attacker.dead) return;

            // Cooldown check - prevent command spam
            const now = Date.now();
            const lastTrigger = this.defenseTimestamps.get(entity.id) || 0;
            if (now - lastTrigger < CONFIG.DEFENSE_COOLDOWN) return;
            this.defenseTimestamps.set(entity.id, now);

            // Find nearby friendly units
            const defenders = this.findNearbyDefenders(entity, CONFIG.DEFENSE_RADIUS);

            // Command idle defenders to engage
            for (const unit of defenders) {
                if (this.isUnitIdle(unit)) {
                    unit.attack(attacker);
                }
            }

            // Alert player (first attack only, use longer cooldown)
            if (now - lastTrigger > 10000) {
                this.showAlert(`${entity.def?.name || 'Structure'} under attack!`, 'warning');
            }
        });
    }

    // ===== Entity Creation =====

    createUnit(x, z, team, type, scene) {
        const unit = new Unit(x, z, team, type, scene);
        gameState.addEntity(unit);
        return unit;
    }

    createBuilding(x, z, team, type, scene) {
        const buildingDef = BUILDINGS[type];

        // Check cost
        if (team === TEAMS.PLAYER && !gameState.canAfford(team, buildingDef.cost)) {
            this.showAlert('Insufficient credits', 'danger');
            return null;
        }

        // Spend credits
        if (buildingDef.cost > 0) {
            gameState.spendCredits(team, buildingDef.cost);
        }

        const building = new Building(x, z, team, type, scene);
        gameState.addEntity(building);

        // Update capacity
        this.updateResourceCapacity();

        return building;
    }

    createAlienUnit(x, z, team, type, scene) {
        const alien = new AlienUnit(x, z, team, type, scene);
        gameState.addEntity(alien);
        return alien;
    }

    // ===== Base Spawning =====

    spawnPlayerBases(scene) {
        const numPlayers = 1 + CONFIG.NUM_AI_PLAYERS;
        const angleStep = (Math.PI * 2) / numPlayers;
        // Scale base distance with map size
        const baseDist = Math.min(200, CONFIG.MAP_SIZE * 0.17);

        for (let t = 0; t < numPlayers; t++) {
            const angle = angleStep * t - Math.PI / 2;
            const x = Math.cos(angle) * baseDist;
            const z = Math.sin(angle) * baseDist;

            // Command Center (starts complete)
            const cc = new Building(x, z, t, 'commandCenter', scene);
            cc.constructionProgress = 1;
            cc.isConstructing = false;
            cc.health = cc.maxHealth;
            gameState.addEntity(cc);

            // Spawn starting harvesters based on config
            const numHarvesters = CONFIG.STARTING_HARVESTERS || 1;
            for (let h = 0; h < numHarvesters; h++) {
                const hAngle = (h / Math.max(numHarvesters, 1)) * Math.PI * 0.5;
                const hx = x + 20 + Math.cos(hAngle) * (h * 8);
                const hz = z + Math.sin(hAngle) * (h * 8);
                const harvester = new Unit(hx, hz, t, 'harvester', scene);
                gameState.addEntity(harvester);
            }

            // Set starting credits from config
            const res = gameState.getResources(t);
            res.credits = CONFIG.STARTING_CREDITS || 1000;

            // Starting ore near base
            resourceSystem.generateStartingOreForBase(x, z, angle);
        }

        // Update capacity after spawning buildings
        this.updateResourceCapacity();
    }

    spawnNeutralAliens(scene) {
        for (let i = 0; i < CONFIG.NUM_NEUTRAL_ALIENS; i++) {
            const team = TEAMS.NEUTRAL + i;

            // Place alien bases near crystal fields or in strategic locations
            const angle = Math.random() * Math.PI * 2;
            const dist = 300 + Math.random() * 50;
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;

            if (!resourceSystem.isInAsteroidBelt(x, z)) {
                // Alien structure
                const alienBase = new Building(x, z, team, 'commandCenter', scene);
                alienBase.constructionProgress = 1;
                alienBase.isConstructing = false;
                alienBase.health = alienBase.maxHealth;
                alienBase.isAlien = true;
                gameState.addEntity(alienBase);

                // Spawn guardian units
                for (let g = 0; g < 3; g++) {
                    const gAngle = (g / 3) * Math.PI * 2;
                    const guardian = new AlienUnit(
                        x + Math.cos(gAngle) * 25,
                        z + Math.sin(gAngle) * 25,
                        team,
                        'guardian',
                        scene
                    );
                    gameState.addEntity(guardian);
                }

                // One sentinel
                const sentinel = new AlienUnit(x, z + 35, team, 'sentinel', scene);
                gameState.addEntity(sentinel);
            }
        }
    }

    // ===== Resource Management =====

    updateResourceCapacity() {
        // Calculate max energy and supply for all teams
        for (let t = 0; t <= 5; t++) {
            let maxEnergy = 0;
            let maxSupply = 0;
            let energyDrain = 0;

            for (const building of gameState.buildings) {
                if (building.dead || building.team !== t || building.isConstructing) continue;

                const def = building.def;
                maxEnergy += def.energyProduction || 0;
                energyDrain += def.energyDrain || 0;
                maxSupply += def.supplyProvided || 0;
            }

            const res = gameState.getResources(t);
            res.maxEnergy = maxEnergy;
            res.energy = maxEnergy - energyDrain;
            res.maxSupply = maxSupply;
        }
    }

    // ===== Auto-Defense Helpers =====

    findNearbyDefenders(building, radius) {
        const defenders = [];
        const bPos = building.mesh.position;

        for (const entity of gameState.entities) {
            // Must be friendly unit (not building)
            if (entity.isBuilding || entity.dead) continue;
            if (entity.team !== building.team) continue;

            // Must be combat-capable (has weapons)
            if (!entity.def?.damage) continue;

            // Check distance
            const dx = entity.mesh.position.x - bPos.x;
            const dz = entity.mesh.position.z - bPos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist <= radius) {
                defenders.push(entity);
            }
        }

        return defenders;
    }

    isUnitIdle(unit) {
        // Unit is idle if not currently attacking or moving to attack
        if (unit.attackTarget && !unit.attackTarget.dead) return false;
        if (unit.isAttackMoving) return false;

        // Has move target but not attack-moving - consider idle for defense
        // (will interrupt move to defend base)
        return true;
    }

    // ===== Game Loop =====

    start() {
        gameState.start();

        // Hide loading screen
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }

        // Start background music
        soundManager.playMusic('ambient');

        // Register global hotkeys
        this.registerHotkeys();

        // Start render loop
        sceneManager.startRenderLoop((dt) => this.update(dt));
    }

    registerHotkeys() {
        // Build menu toggle
        eventBus.on(GameEvents.HOTKEY_BUILD_MENU, () => {
            buildMenu.toggle();
        });

        // Quick save/load (F5/F9), Build menu (B), Settings (F10/Escape)
        window.addEventListener('keydown', (e) => {
            if (e.key === 'F5') {
                e.preventDefault();
                saveSystem.quickSave();
                this.showAlert('Game saved!', 'success');
            } else if (e.key === 'F9') {
                e.preventDefault();
                saveSystem.quickLoad();
                this.showAlert('Game loaded!', 'info');
            } else if (e.key === 'F10' || e.key === 'p' || e.key === 'P') {
                // F10 or P opens settings (F10 may be blocked by browser)
                e.preventDefault();
                e.stopPropagation();
                console.log('Settings hotkey pressed:', e.key);
                settingsPanel.toggle();
            } else if (e.key === 'b' || e.key === 'B') {
                // Don't toggle build menu if settings panel is open
                if (!settingsPanel.isVisible) {
                    buildMenu.toggle();
                }
            } else if (e.key === 'Escape') {
                // Close settings panel with Escape
                if (settingsPanel.isVisible) {
                    settingsPanel.hide();
                }
            }
        });
    }

    update(dt) {
        if (!gameState.running || gameState.paused) return;

        gameState.update(dt);

        // Update all entities
        for (const entity of gameState.entities) {
            entity.update(dt);
        }

        // Update core systems
        combatSystem.update(dt);
        resourceSystem.update(dt);
        aiSystem.update();

        // Update navigation and formations
        pathfinding.updateFromGameState();
        formationSystem.update(dt);

        // Update fog of war
        fogOfWar.update();
        fogOfWar.updateEntityVisibility();

        // Update input
        inputManager.update(dt);

        // Update audio
        soundManager.update(dt);

        // Render minimap
        minimap.render();

        // Update HUD
        this.updateHUD();

        // Clean up dead entities
        this.cleanupDeadEntities();
    }

    cleanupDeadEntities() {
        // Remove dead entities from game state
        for (let i = gameState.entities.length - 1; i >= 0; i--) {
            if (gameState.entities[i].dead) {
                gameState.removeEntity(gameState.entities[i]);
            }
        }
    }

    // ===== UI Updates =====

    updateHUD() {
        const res = gameState.getResources(TEAMS.PLAYER);

        this.updateElement('creditsValue', Math.floor(res.credits));
        this.updateElement('oreValue', Math.floor(res.ore));
        this.updateElement('crystalsValue', Math.floor(res.crystals));
        this.updateElement('energyValue', `${res.energy}/${res.maxEnergy}`);
        this.updateElement('supplyValue', `${res.supply}/${res.maxSupply}`);
    }

    updateElement(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    showAlert(message, type = 'info') {
        const alertsContainer = document.getElementById('alerts');
        if (!alertsContainer) return;

        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.textContent = message;
        alertsContainer.appendChild(alert);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            alert.style.opacity = '0';
            setTimeout(() => alert.remove(), 300);
        }, 3000);
    }

    // ===== Game End =====

    checkGameEnd() {
        // Check if player has any buildings left
        const playerBuildings = gameState.buildings.filter(b =>
            !b.dead && b.team === TEAMS.PLAYER
        );

        if (playerBuildings.length === 0) {
            this.endGame(false);
            return;
        }

        // Check if all enemies are defeated
        let enemiesRemain = false;
        for (let t = 1; t < 4; t++) {
            const enemyBuildings = gameState.buildings.filter(b =>
                !b.dead && b.team === t
            );
            if (enemyBuildings.length > 0) {
                enemiesRemain = true;
                break;
            }
        }

        if (!enemiesRemain) {
            this.endGame(true);
        }
    }

    endGame(victory) {
        gameState.end(victory ? TEAMS.PLAYER : null);

        const stats = gameState.stats[TEAMS.PLAYER];
        const gameOverScreen = document.getElementById('gameOverScreen');
        const resultTitle = document.getElementById('resultTitle');

        if (gameOverScreen) {
            gameOverScreen.style.display = 'flex';
        }

        if (resultTitle) {
            resultTitle.textContent = victory ? 'VICTORY!' : 'DEFEAT';
            resultTitle.style.color = victory ? '#0f0' : '#f00';
        }

        this.updateElement('finalBuilt', stats.unitsBuilt);
        this.updateElement('finalLost', stats.unitsLost);
        this.updateElement('finalKills', stats.enemyKilled);
    }

    // ===== Cleanup =====

    dispose() {
        gameState.reset();
        sceneManager.dispose();
        combatSystem.dispose();
        resourceSystem.dispose();
        selectionSystem.dispose();
        aiSystem.dispose();
        fogOfWar.dispose();
        pathfinding.dispose();
        formationSystem.dispose();
        inputManager.dispose();
        minimap.dispose();
        buildMenu.dispose();
        selectionPanel.dispose();
        commandPanel.dispose();
        settingsPanel.dispose();
        soundManager.dispose();
        saveSystem.dispose();
    }
}

// Create singleton instance
export const game = new Game();

export default Game;
