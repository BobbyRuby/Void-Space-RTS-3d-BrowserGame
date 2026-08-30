// ============================================================
// VOID SUPREMACY 3D - Main Game Class
// Orchestrates all game modules and manages game lifecycle
// ============================================================

import { CONFIG, TEAMS, BUILDINGS, UNITS, TEAM_NAMES, GAME_MODES, applyGameConfig } from './Config.js?v=20260119';
import { eventBus, GameEvents } from './EventBus.js?v=20260119';
import { gameState } from './GameState.js?v=20260119';
import { resetSeededRandom, getSeededRandom } from './SeededRandom.js?v=20260119';

import { Unit } from '../entities/Unit.js?v=20260119';
import { Building } from '../entities/Building.js?v=20260119';
import { AlienUnit } from '../entities/AlienUnit.js?v=20260119';

import { sceneManager } from '../rendering/SceneManager.js?v=20260119';
import { combatSystem } from '../systems/CombatSystem.js?v=20260119';
import { aiSystem } from '../systems/AISystem.js?v=20260119';
import { resourceSystem } from '../systems/ResourceSystem.js?v=20260119';
import { selectionSystem } from '../systems/SelectionSystem.js?v=20260119';
import { fogOfWar } from '../systems/FogOfWar.js?v=20260119';
import { pathfinding } from '../systems/Pathfinding.js?v=20260119';
import { formationSystem } from '../systems/FormationSystem.js?v=20260119';
import { forceFieldSystem } from '../systems/ForceFieldSystem.js?v=20260119';
import { buildingPlacementSystem } from '../systems/BuildingPlacementSystem.js?v=20260119';
import { inputManager } from '../input/InputManager.js?v=20260119';
import { minimap } from '../ui/Minimap.js?v=20260119';
import { mainPanel } from '../ui/MainPanel.js?v=20260119';
import { buildMenu } from '../ui/BuildMenu.js?v=20260119';
import { selectionPanel } from '../ui/SelectionPanel.js?v=20260119';
import { commandPanel } from '../ui/CommandPanel.js?v=20260119';
import { rallyPointSection } from '../ui/RallyPointSection.js?v=20260119';
import { settingsPanel } from '../ui/SettingsPanel.js?v=20260119';
import { soundManager } from '../audio/SoundManager.js?v=20260119';
import { saveSystem } from '../persistence/SaveSystem.js?v=20260119';

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

        // Initialize seeded random number generator. A dev-only ?seed= URL param
        // lets a determinism harness pin the seed for reproducible two-run tests.
        let seed = CONFIG.MAP_SEED || String(Date.now());
        if (typeof window !== 'undefined' && window.location && window.location.search) {
            const _sp = new URLSearchParams(window.location.search);
            if (_sp.get('seed')) seed = _sp.get('seed');
        }
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

        // Initialize pathfinding, fog of war, and force fields
        this.updateLoadingProgress(35, 'Initializing navigation...');
        pathfinding.init();
        fogOfWar.init(scene);
        formationSystem.init();
        forceFieldSystem.init(scene);
        buildingPlacementSystem.init(scene);

        // Initialize audio
        this.updateLoadingProgress(45, 'Loading audio...');
        soundManager.init(scene);

        // Initialize input
        this.updateLoadingProgress(55, 'Setting up input...');
        inputManager.init(canvas);

        // Initialize UI
        this.updateLoadingProgress(65, 'Creating UI...');

        // Initialize minimap first (before MainPanel moves it)
        minimap.init(minimapCanvas);

        // Initialize MainPanel (unified C&C style bottom panel)
        mainPanel.init();

        // Initialize UI sections with their parent sections from MainPanel
        buildMenu.init(mainPanel.getBuildSection());
        selectionPanel.init(mainPanel.getSelectionSection());
        commandPanel.init(mainPanel.getCommandSection());
        rallyPointSection.init(mainPanel.getRallySection());

        // Settings panel (modal, not part of MainPanel)
        settingsPanel.init();

        // Initialize persistence
        this.updateLoadingProgress(75, 'Loading save system...');
        await saveSystem.init();

        // Generate world
        this.updateLoadingProgress(80, 'Generating world...');
        resourceSystem.generateOreFields();
        resourceSystem.generateCrystalFields();

        // Keep a scene handle for runtime spawning (survival waves)
        this.scene = scene;

        // Spawn bases
        this.updateLoadingProgress(90, 'Spawning bases...');
        this.spawnPlayerBases(scene);

        // Survival mode runs a wave director instead of ambient alien bases;
        // the waves ARE the enemy. Other modes keep the ambient neutral aliens.
        if (CONFIG.MODE === GAME_MODES.SURVIVAL) {
            this.initSurvival();
        } else {
            this.spawnNeutralAliens(scene);
        }

        // Setup event handlers
        this.setupEventHandlers(scene);

        // Calculate initial resources
        this.updateResourceCapacity();

        // Notify UI that resources/buildings are ready (fixes BuildMenu seeing empty state at init)
        eventBus.emit(GameEvents.RESOURCE_CHANGED, { team: TEAMS.PLAYER });

        this.updateLoadingProgress(100, 'Ready!');
        this.initialized = true;

        // Dev-only determinism/debug surface (VOTE-022). No-op without ?debug.
        this.exposeDebugHooks();

        return this;
    }

    // Dev-only determinism hook (VOTE-022): behind ?debug it exposes window.__void
    // = { game, gameState, stepFixed(n), hashState() } so a harness can step the sim
    // headlessly and hash full-game state - closes the empirical two-run determinism
    // gap and fixes the module-scope wall that froze in-tab smokes. NO ?debug = no
    // global surface (nothing exposed in normal play).
    exposeDebugHooks() {
        if (typeof window === 'undefined' || !window.location) return;
        const params = new URLSearchParams(window.location.search || '');
        if (!params.has('debug')) return;

        window.__void = {
            game: this,
            gameState,
            // Advance the sim n fixed sub-steps headlessly (no render), for a
            // deterministic scripted run. dt defaults to the fixed timestep.
            stepFixed: (n = 60, dt = (CONFIG.FIXED_DT || 1 / 60)) => {
                for (let i = 0; i < n; i++) this.fixedStep(dt);
            },
            // Stable hash of the sim state determinism affects: entities sorted by id
            // (type/team/position rounded to kill float print-noise/health) + per-team
            // resources. Two runs from the same seed must return an identical hash.
            hashState: () => {
                let s = '';
                const ents = gameState.entities.slice().sort((a, b) => (a.id || 0) - (b.id || 0));
                for (const e of ents) {
                    if (!e.mesh) continue;
                    s += `${e.type}:${e.team}:${Math.round(e.mesh.position.x * 100)}:${Math.round(e.mesh.position.z * 100)}:${Math.round((e.health || 0) * 10)};`;
                }
                for (let t = 0; t <= 5; t++) {
                    const r = gameState.resources[t];
                    if (r) s += `R${t}:${Math.round(r.credits)}:${Math.round(r.ore)}:${Math.round(r.crystals)};`;
                }
                let h = 5381;
                for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
                return { hash: h >>> 0, entities: ents.length, len: s.length };
            }
        };
        console.log('[void debug] window.__void ready (stepFixed, hashState); seed pinned via ?seed=');
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

            // Record the supply this trained unit consumed at queue time (Building.js
            // charges unitDef.supply||1), so die() refunds exactly that. Matches the charge.
            unit.supplyCharged = (UNITS[data.unitType]?.supply ?? 1);

            // Auto-rally or auto-harvest
            if (data.rallyPoint) {
                unit.moveTo(data.rallyPoint.x, data.rallyPoint.z);
            } else if (data.unitType === 'harvester') {
                const ore = unit.findNearestOre();
                if (ore) unit.harvest(ore);
            }

            // Supply is already reserved at queue time, just record stat
            gameState.recordUnitBuilt(data.team);

            // Alert for player
            if (data.team === TEAMS.PLAYER) {
                const unitDef = UNITS[data.unitType];
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

        // Handle production cancellation
        eventBus.on(GameEvents.PRODUCTION_CANCEL, (data) => {
            const { building, index } = data;
            if (building && typeof building.cancelProduction === 'function') {
                building.cancelProduction(index);
            }
        });

        // Handle full state reset before a load (dispose every current entity/mesh)
        eventBus.on(GameEvents.GAME_RESET, () => {
            for (const entity of [...gameState.entities]) {
                if (typeof entity.dispose === 'function') entity.dispose();
            }
            gameState.reset();
        });

        // Handle restoring a single entity from save data
        eventBus.on(GameEvents.RESTORE_ENTITY, (data) => {
            const x = data.position ? data.position.x : 0;
            const z = data.position ? data.position.z : 0;
            let entity;

            if (data.isBuilding) {
                // Construct directly - do NOT use createBuilding(), it re-validates
                // placement and spends credits, which would double-charge on restore.
                entity = new Building(x, z, data.team, data.type, scene);
                gameState.addEntity(entity);
                entity.isConstructing = data.isConstructing;
                entity.constructionProgress = data.constructionProgress ?? 1;
                entity.buildQueue = (data.buildQueue || []).map(i => ({ type: i.type }));
                entity.buildProgress = data.buildProgress || 0;
            } else {
                // Alien units are a separate class/def table - rebuild via createAlienUnit
                entity = data.alienType
                    ? this.createAlienUnit(x, z, data.team, data.alienType, scene)
                    : this.createUnit(x, z, data.team, data.type, scene);
                entity.command = data.command;
                if (data.targetX !== undefined) entity.targetX = data.targetX;
                if (data.targetZ !== undefined) entity.targetZ = data.targetZ;
                if (data.type === 'harvester') {
                    entity.cargo = data.cargo || 0;
                    entity.cargoType = data.cargoType;
                }
            }

            // Restore common state + exact transform
            if (entity) {
                entity.health = data.health;
                entity.maxHealth = data.maxHealth;
                if (entity.mesh && data.position) {
                    entity.mesh.position.x = data.position.x;
                    entity.mesh.position.y = data.position.y;
                    entity.mesh.position.z = data.position.z;
                }
                if (entity.mesh && data.rotation !== undefined) {
                    entity.mesh.rotation.y = data.rotation;
                }
            }
        });

        // Handle fog-of-war restore (no-op: serializeExplored() saves no data today)
        eventBus.on(GameEvents.RESTORE_FOG, () => {});

        // Handle auto-defense: nearby units engage attackers when buildings take damage
        eventBus.on(GameEvents.ENTITY_DAMAGED, (data) => {
            const { entity, attacker } = data;

            // Only defend buildings
            if (!entity.isBuilding || entity.dead) return;

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
            if (entity.team === TEAMS.PLAYER && now - lastTrigger > 10000) {
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

    /**
     * Check if a building can be placed at the given position
     * @param {number} x - World X coordinate
     * @param {number} z - World Z coordinate
     * @param {number} team - The team placing the building
     * @param {string} type - The building type
     * @returns {Object} - { valid: boolean, reason?: string }
     */
    canPlaceBuilding(x, z, team, type) {
        // Use the building placement system for validation
        return buildingPlacementSystem.checkPlacementValid(x, z, team);
    }

    createBuilding(x, z, team, type, scene) {
        const buildingDef = BUILDINGS[type];

        // Check placement validity for player (AI bypasses this)
        if (team === TEAMS.PLAYER) {
            const placement = this.canPlaceBuilding(x, z, team, type);
            if (!placement.valid) {
                this.showAlert(placement.reason || 'Cannot place building here', 'danger');
                return null;
            }
        }

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
            const angle = getSeededRandom().next() * Math.PI * 2;
            const dist = 300 + getSeededRandom().next() * 50;
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
        // Calculate max energy and supply for all teams in a single pass
        // Initialize accumulators for each team
        const teamStats = {};
        for (let t = 0; t <= 5; t++) {
            teamStats[t] = { maxEnergy: 0, maxSupply: 0, energyDrain: 0 };
        }

        // Single pass through all buildings (fixes O(teams * buildings) -> O(buildings))
        for (const building of gameState.buildings) {
            if (building.dead) continue;

            const t = building.team;
            if (t < 0 || t > 5) continue;

            const def = building.def;

            // Energy drain starts immediately when building is placed
            teamStats[t].energyDrain += def.energyDrain || 0;

            // Production only counts when construction is complete
            if (!building.isConstructing) {
                teamStats[t].maxEnergy += def.energyProduction || 0;
                teamStats[t].maxSupply += def.supplyProvided || 0;
            }
        }

        // Apply stats to each team's resources
        for (let t = 0; t <= 5; t++) {
            const res = gameState.getResources(t);
            const stats = teamStats[t];
            res.maxEnergy = stats.maxEnergy;
            res.energy = stats.maxEnergy - stats.energyDrain;
            res.energyDrain = stats.energyDrain;
            res.maxSupply = stats.maxSupply;
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
        // Build menu toggle (legacy - now always visible in MainPanel)
        eventBus.on(GameEvents.HOTKEY_BUILD_MENU, () => {
            // Build menu is now always visible, switch to buildings tab instead
            buildMenu.switchTab('buildings');
        });

        // Quick save/load (F5/F9), Settings (F10/Escape), Rally hotkey (Y)
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
            } else if (e.key === 'y' || e.key === 'Y') {
                // Rally point hotkey
                if (!settingsPanel.isVisible) {
                    rallyPointSection.handleHotkey(e.key);
                }
            } else if (e.key === 'Escape') {
                // Close settings panel with Escape
                if (settingsPanel.isVisible) {
                    settingsPanel.hide();
                } else if (gameState.buildMode) {
                    // Cancel build/rally mode
                    eventBus.emit(GameEvents.UI_BUILD_MODE_EXIT, {});
                }
            }
        });
    }

    update(realDt) {
        if (!gameState.running || gameState.paused) return;

        // Fixed-timestep accumulator (VOTE-018): step the SIM at a fixed dt so it is
        // decoupled from render frame rate + deterministic; render/IO runs once per
        // frame. At 60Hz this is exactly ONE step = behavior-identical to the old
        // variable-dt loop (dt-linear movement is aggregate-equivalent). MAX_STEPS
        // clamps a lag spike so a stalled frame cannot run away (no spiral-of-death).
        // FIXED_DT is the felt tick rate - changing it off 1/60 is a board vote.
        const FIXED = CONFIG.FIXED_DT || (1 / 60);
        const MAX = CONFIG.MAX_STEPS || 5;
        this._accumulator = (this._accumulator || 0) + realDt;
        let steps = 0;
        while (this._accumulator >= FIXED && steps < MAX) {
            this.fixedStep(FIXED);
            this._accumulator -= FIXED;
            steps++;
        }
        if (steps >= MAX) this._accumulator = 0; // drop the backlog after a stall

        this.renderStep(realDt);
    }

    // Deterministic simulation step at a fixed dt (VOTE-018). Runs 0..MAX_STEPS times
    // per rendered frame depending on the accumulator. All state-advancing systems.
    fixedStep(dt) {
        gameState.update(dt);

        // Refresh stealth detection before entities acquire targets this tick
        this.updateStealthDetection();

        // Update all entities
        for (const entity of gameState.entities) {
            entity.update(dt);
        }

        // Re-bucket moved units in the spatial grid before combat/flocking queries read it
        gameState.updateSpatialGrid();

        // Update core systems
        combatSystem.update(dt);
        resourceSystem.update(dt);
        aiSystem.update();

        // Update navigation and formations
        pathfinding.updateFromGameState();
        formationSystem.update(dt);

        // Update force field system
        forceFieldSystem.update(dt);

        // Clean up dead entities
        this.cleanupDeadEntities();

        // Survival wave director (no-op unless survival mode is active)
        this.updateSurvival(dt);
    }

    // Render + IO, ONCE per rendered frame (never per sim sub-step): fog/mesh
    // visibility, input, audio, minimap, HUD. Uses the real frame dt.
    renderStep(dt) {
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
        this.updateElement('energyValue', `+${res.maxEnergy} -${res.energyDrain} = ${res.energy}`);
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

        // Survival is ENDLESS: there are no AI-player factions to eliminate, so the
        // win-by-elimination check below would fire instant victory on frame 1. Skip
        // it in survival; only the lose-path (0 player buildings, above) applies.
        if (gameState.survival && gameState.survival.active) {
            return;
        }

        // Check if all enemies are defeated. Enemy factions are the AI player teams
        // (TEAMS.PLAYER+1 .. below TEAMS.NEUTRAL); teams TEAMS.NEUTRAL+ are neutral aliens
        // and are NOT counted for victory by design - even if provoke() has flipped their
        // hostility (that is why this derives from the player/neutral boundary, not the
        // mutable hostility matrix). Behavior-neutral vs the old hardcoded `t<4`, minus the
        // magic number and the latent AI>3 edge. Whether aliens SHOULD block victory is a
        // separate CEO win-condition decision (not decided here).
        let enemiesRemain = false;
        for (let t = TEAMS.PLAYER + 1; t < TEAMS.NEUTRAL; t++) {
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
        this.updateElement('finalBuildings', stats.buildingsBuilt);

        // Match time (gameState.gameTime accumulates seconds) as m:ss
        const secs = Math.floor(gameState.gameTime || 0);
        this.updateElement('finalTime', Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0'));

        // Waves survived only makes sense in Survival mode; hide the cell otherwise.
        const waveCell = document.getElementById('waveCell');
        if (gameState.survival && gameState.survival.active) {
            this.updateElement('finalWaves', gameState.survival.wavesCleared);
            if (waveCell) waveCell.classList.remove('hidden');
        } else if (waveCell) {
            waveCell.classList.add('hidden');
        }
    }

    // ===== Stealth Detection (VOTE-017) =====

    // A def.stealth unit is untargetable + fog-hidden unless a HOSTILE sensor
    // building (radar, def.sensorRange) is within range of it. Recomputed each
    // tick; findTarget (Unit + turret) and fog visibility read unit.detected.
    updateStealthDetection() {
        const units = gameState.units;
        const buildings = gameState.buildings;
        for (const u of units) {
            if (u.dead || !u.def || !u.def.stealth || !u.mesh) continue;
            u.detected = false;
            for (const b of buildings) {
                if (b.dead || b.isConstructing || !b.mesh) continue;
                const range = b.def && b.def.sensorRange;
                if (!range) continue;                              // only sensor buildings
                if (!gameState.isHostile(b.team, u.team)) continue; // hostile sensors only
                const dx = b.mesh.position.x - u.mesh.position.x;
                const dz = b.mesh.position.z - u.mesh.position.z;
                if (dx * dx + dz * dz <= range * range) {
                    u.detected = true;
                    break;
                }
            }
        }
    }

    // ===== Survival Mode (wave director) =====

    initSurvival() {
        // HUD-facing state (contract locked with voidspace-4). Balance = placeholders.
        gameState.survival = {
            active: true,
            waveNumber: 0,       // 1-based once waves start
            nextWaveIn: 20,      // seconds until wave 1 (grace), then between waves
            waveActive: false,
            enemiesRemaining: 0,
            wavesCleared: 0      // completed waves = the score
        };
        this.waveUnits = [];
        // The wave faction (a neutral team, excluded from the elimination win-check)
        // is hostile to the player for the whole match.
        gameState.setHostility(TEAMS.PLAYER, TEAMS.NEUTRAL, true);
    }

    updateSurvival(dt) {
        const s = gameState.survival;
        if (!s || !s.active) return;

        // Prune dead/removed wave units; expose the live count to the HUD.
        this.waveUnits = this.waveUnits.filter(u => u && !u.dead);
        s.enemiesRemaining = this.waveUnits.length;

        if (s.waveActive) {
            // A wave clears when every spawned enemy is dead.
            if (this.waveUnits.length === 0) {
                s.waveActive = false;
                s.wavesCleared++;
                s.nextWaveIn = 25;   // seconds to next wave (placeholder)
            }
        } else {
            s.nextWaveIn -= dt;
            if (s.nextWaveIn <= 0) {
                s.waveNumber++;
                this.spawnWave(s.waveNumber);
                s.waveActive = true;
                s.nextWaveIn = 0;
            }
        }
    }

    spawnWave(n) {
        const scene = this.scene;
        if (!scene) return;

        // Escalate: more enemies each wave, but CAP the per-wave count so late
        // waves cannot grow unbounded (addresses the runaway-scaling flag). The
        // ceiling is a TUNABLE PLACEHOLDER - the CEO owns the real value/curve;
        // this only guarantees a bound exists. Set very high or remove to disable.
        const WAVE_ENEMY_CAP = 40; // placeholder ceiling, CEO-tunable
        const count = Math.min(4 + Math.floor(n * 2), WAVE_ENEMY_CAP);

        // March target = the player's command center (fallback: any player building).
        const base =
            gameState.buildings.find(b => !b.dead && b.team === TEAMS.PLAYER && b.type === 'commandCenter') ||
            gameState.buildings.find(b => !b.dead && b.team === TEAMS.PLAYER);
        const bx = base && base.mesh ? base.mesh.position.x : 0;
        const bz = base && base.mesh ? base.mesh.position.z : 0;

        const edge = (CONFIG.MAP_SIZE || 1200) * 0.45;
        for (let i = 0; i < count; i++) {
            const angle = getSeededRandom().next() * Math.PI * 2;
            const ex = Math.cos(angle) * edge;
            const ez = Math.sin(angle) * edge;
            const type = (i % 4 === 0) ? 'sentinel' : 'guardian';

            const alien = this.createAlienUnit(ex, ez, TEAMS.NEUTRAL, type, scene);
            if (!alien) continue;
            // Home = player base so the guardian AI marches in and engages there
            // rather than patrolling its spawn point. Wide returnRange so it does not
            // reset mid-chase; larger aggro so it engages defenders on arrival.
            alien.homeX = bx;
            alien.homeZ = bz;
            alien.returnRange = CONFIG.MAP_SIZE || 1200;
            alien.aggroRange = 160;
            this.waveUnits.push(alien);
        }

        this.showAlert(`Wave ${n} incoming (${count})`, 'warning');
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
        forceFieldSystem.dispose();
        buildingPlacementSystem.dispose();
        inputManager.dispose();
        minimap.dispose();
        buildMenu.dispose();
        selectionPanel.dispose();
        commandPanel.dispose();
        rallyPointSection.dispose();
        mainPanel.dispose();
        settingsPanel.dispose();
        soundManager.dispose();
        saveSystem.dispose();
    }
}

// Create singleton instance
export const game = new Game();

export default Game;
