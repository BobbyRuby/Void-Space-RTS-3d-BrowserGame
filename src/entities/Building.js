// ============================================================
// VOID SUPREMACY 3D - Building Class
// Structures: Command Centers, Factories, Turrets, etc.
// Optimized with MaterialPool for shared materials
// ============================================================

import { Entity } from './Entity.js';
import { BUILDINGS, UNITS, TEAMS, TEAM_COLORS, CONFIG } from '../core/Config.js';
import { eventBus, GameEvents } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';
import { MaterialPool } from '../core/MaterialPool.js';

export class Building extends Entity {
    constructor(x, z, team, type, scene) {
        super(x, z, team);

        this.entityType = 'building';
        this.isBuilding = true;
        this.type = type;
        this.def = BUILDINGS[type];
        this.scene = scene;

        // Stats from definition
        this.size = this.def.size;
        this.maxHealth = this.def.maxHealth;
        this.health = this.maxHealth * 0.1;

        // Construction
        this.isConstructing = true;
        this.constructionProgress = 0;
        this.buildTime = this.def.buildTime;

        // Production queue
        this.buildQueue = [];
        this.buildProgress = 0;
        this.rallyPoint = null;

        // Rally point visual markers (created by InputManager)
        this.rallyMarker = null;
        this.rallyLine = null;

        // Refinery specific
        this.storedOre = 0;
        this.storedCrystals = 0;

        // Turret specific
        this.lastFire = 0;
        this.turretHead = null;

        // Alien building flag
        this.isAlien = false;

        if (scene) {
            this.createMesh(scene);
        }
    }

    createMesh(scene) {
        const color = TEAM_COLORS[this.team];

        // Create parent transform node
        this.mesh = new BABYLON.TransformNode('building_' + this.type + '_' + this.id, scene);
        this.mesh.position = new BABYLON.Vector3(this.x, 0, this.z);

        // Try to use enhanced building models if available
        if (window.VoidBuildingsEnhanced) {
            if (!window.VoidBuildingsEnhanced.initialized) {
                window.VoidBuildingsEnhanced.init(scene);
            }
            const success = window.VoidBuildingsEnhanced.createBuildingMesh(
                this.type, this.size, color, this.team, this.mesh
            );
            if (success) {
                if (this.type === 'turret') {
                    // Enhanced model sets parent.turretHead directly (as turretHeadNode)
                    this.turretHead = this.mesh.turretHead ||
                        this.mesh.getChildTransformNodes().find(n =>
                            n.name === 'turretHead' || n.name === 'turretHeadNode'
                        );
                }
                this.addTeamRing(color, scene);
                return;
            }
        }

        // Fallback to default building creation
        switch (this.type) {
            case 'commandCenter':
                this.createCommandCenter(color, scene);
                break;
            case 'powerPlant':
                this.createPowerPlant(color, scene);
                break;
            case 'refinery':
                this.createRefinery(color, scene);
                break;
            case 'shipyard':
            case 'advancedShipyard':
                this.createShipyard(color, scene);
                break;
            case 'turret':
                this.createTurret(color, scene);
                break;
            case 'supplyDepot':
                this.createSupplyDepot(color, scene);
                break;
            case 'radar':
                this.createRadar(color, scene);
                break;
            default:
                this.createGenericBuilding(color, scene);
        }

        this.addTeamRing(color, scene);
    }

    addTeamRing(color, scene) {
        const ring = BABYLON.MeshBuilder.CreateTorus('ring_' + this.id, {
            diameter: this.size * 2.5,
            thickness: 0.5,
            tessellation: 24  // Reduced for performance
        }, scene);
        ring.position.y = 0.1;
        ring.parent = this.mesh;

        // Use shared team ring material from MaterialPool
        ring.material = MaterialPool.getTeamMaterial(this.team, 'ring');

        // Selection ring (larger, green, hidden by default)
        this.selectionRing = BABYLON.MeshBuilder.CreateTorus('selectionRing_' + this.id, {
            diameter: this.size * 3,
            thickness: 0.4,
            tessellation: 24  // Reduced for performance
        }, scene);
        this.selectionRing.position.y = 0.15;
        this.selectionRing.parent = this.mesh;

        // Use shared selection material from MaterialPool
        this.selectionRing.material = MaterialPool.getSelectionMaterial();
        this.selectionRing.isVisible = false;

        // Progress bar (background + fill)
        const barWidth = this.size * 2;
        const barHeight = 0.5;
        const barY = this.size + 5;

        // Background (dark)
        this.progressBarBg = BABYLON.MeshBuilder.CreatePlane('progressBg_' + this.id, {
            width: barWidth,
            height: barHeight
        }, scene);
        this.progressBarBg.position.y = barY;
        this.progressBarBg.rotation.x = -Math.PI / 4;
        this.progressBarBg.parent = this.mesh;
        this.progressBarBg.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;

        const bgMat = new BABYLON.StandardMaterial('progressBgMat_' + this.id, scene);
        bgMat.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        bgMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        this.progressBarBg.material = bgMat;
        this.progressBarBg.isVisible = false;

        // Fill (green/yellow)
        this.progressBarFill = BABYLON.MeshBuilder.CreatePlane('progressFill_' + this.id, {
            width: barWidth,
            height: barHeight * 0.8
        }, scene);
        this.progressBarFill.position.y = barY;
        this.progressBarFill.position.z = -0.01;
        this.progressBarFill.rotation.x = -Math.PI / 4;
        this.progressBarFill.parent = this.mesh;
        this.progressBarFill.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;

        const fillMat = new BABYLON.StandardMaterial('progressFillMat_' + this.id, scene);
        fillMat.emissiveColor = new BABYLON.Color3(0, 0.8, 0.2);
        fillMat.diffuseColor = new BABYLON.Color3(0, 0.8, 0.2);
        this.progressBarFill.material = fillMat;
        this.progressBarFill.isVisible = false;
        this.progressBarWidth = barWidth;
    }

    createCommandCenter(color, scene) {
        const parent = this.mesh;

        // Main hexagonal base - use shared hull material
        const base = BABYLON.MeshBuilder.CreateCylinder('base', {
            height: 4,
            diameter: this.size * 2,
            tessellation: 6
        }, scene);
        base.parent = parent;
        base.position.y = 2;
        base.material = MaterialPool.getTeamMaterial(this.team, 'hull');

        // Central tower - use shared base material
        const tower = BABYLON.MeshBuilder.CreateCylinder('tower', {
            height: 12,
            diameterTop: 3,
            diameterBottom: 5,
            tessellation: 8
        }, scene);
        tower.parent = parent;
        tower.position.y = 8;
        tower.material = MaterialPool.getTeamMaterial(this.team, 'base');

        // Antenna
        const antenna = BABYLON.MeshBuilder.CreateCylinder('antenna', {
            height: 6,
            diameter: 0.5
        }, scene);
        antenna.parent = parent;
        antenna.position.y = 17;
        antenna.material = MaterialPool.getTeamMaterial(this.team, 'base');

        // Dishes
        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2;
            const dish = BABYLON.MeshBuilder.CreateDisc('dish', { radius: 2 }, scene);
            dish.parent = parent;
            dish.position.set(Math.cos(angle) * 8, 6, Math.sin(angle) * 8);
            dish.rotation.x = Math.PI / 4;
            dish.rotation.y = angle;
            dish.material = MaterialPool.getTeamMaterial(this.team, 'hull');
        }
    }

    createPowerPlant(color, scene) {
        const parent = this.mesh;

        // Reactor core - use shared glow material
        const core = BABYLON.MeshBuilder.CreateSphere('core', { diameter: this.size }, scene);
        core.parent = parent;
        core.position.y = this.size / 2 + 2;
        core.material = MaterialPool.getTeamMaterial(this.team, 'glow');

        // Containment rings - use shared base material
        for (let i = 0; i < 3; i++) {
            const ring = BABYLON.MeshBuilder.CreateTorus('ring' + i, {
                diameter: this.size * 1.3,
                thickness: 0.3,
                tessellation: 24
            }, scene);
            ring.parent = parent;
            ring.position.y = this.size / 2 + 2;
            ring.rotation.x = Math.PI / 2;
            ring.rotation.y = (i / 3) * Math.PI;
            ring.material = MaterialPool.getTeamMaterial(this.team, 'base');
        }

        // Base - use shared metallic material
        const base = BABYLON.MeshBuilder.CreateCylinder('base', {
            height: 2,
            diameter: this.size * 1.5,
            tessellation: 8
        }, scene);
        base.parent = parent;
        base.position.y = 1;
        base.material = MaterialPool.getTeamMaterial(this.team, 'metallic');
    }

    createRefinery(color, scene) {
        const parent = this.mesh;

        // Main processing building - use shared hull material
        const main = BABYLON.MeshBuilder.CreateBox('main', {
            width: this.size * 1.5,
            height: 8,
            depth: this.size * 1.2
        }, scene);
        main.parent = parent;
        main.position.y = 4;
        main.material = MaterialPool.getTeamMaterial(this.team, 'hull');

        // Storage tanks - use shared metallic material
        for (let i = -1; i <= 1; i += 2) {
            const tank = BABYLON.MeshBuilder.CreateCylinder('tank', {
                height: 10,
                diameter: 4
            }, scene);
            tank.parent = parent;
            tank.position.set(i * 7, 5, 0);
            tank.material = MaterialPool.getTeamMaterial(this.team, 'metallic');
        }

        // Smokestacks - use shared metallic material
        for (let i = 0; i < 2; i++) {
            const stack = BABYLON.MeshBuilder.CreateCylinder('stack', {
                height: 6,
                diameterTop: 1.5,
                diameterBottom: 2
            }, scene);
            stack.parent = parent;
            stack.position.set(-3 + i * 6, 11, -4);
            stack.material = MaterialPool.getTeamMaterial(this.team, 'metallic');
        }

        // Landing pad - use shared hull material
        const pad = BABYLON.MeshBuilder.CreateCylinder('pad', {
            height: 0.5,
            diameter: 12
        }, scene);
        pad.parent = parent;
        pad.position.set(0, 0.25, 10);
        pad.material = MaterialPool.getTeamMaterial(this.team, 'hull');
    }

    createShipyard(color, scene) {
        const parent = this.mesh;
        const scale = this.type === 'advancedShipyard' ? 1.3 : 1;

        // Hangar structure - use shared metallic material
        const hangar = BABYLON.MeshBuilder.CreateBox('hangar', {
            width: this.size * 1.8 * scale,
            height: 10 * scale,
            depth: this.size * 1.4 * scale
        }, scene);
        hangar.parent = parent;
        hangar.position.y = 5 * scale;
        hangar.material = MaterialPool.getTeamMaterial(this.team, 'metallic');

        // Crane gantry - use shared base material
        const gantry = BABYLON.MeshBuilder.CreateBox('gantry', {
            width: this.size * 2 * scale,
            height: 2,
            depth: 2
        }, scene);
        gantry.parent = parent;
        gantry.position.y = 14 * scale;
        gantry.material = MaterialPool.getTeamMaterial(this.team, 'base');

        // Support pillars
        for (let i = -1; i <= 1; i += 2) {
            const pillar = BABYLON.MeshBuilder.CreateCylinder('pillar', {
                height: 14 * scale,
                diameter: 1.5
            }, scene);
            pillar.parent = parent;
            pillar.position.set(i * this.size * scale, 7 * scale, 0);
            pillar.material = MaterialPool.getTeamMaterial(this.team, 'base');
        }

        // Construction bay glow - use shared glow material
        const bayGlow = BABYLON.MeshBuilder.CreatePlane('bayGlow', {
            width: this.size * scale,
            height: 6 * scale
        }, scene);
        bayGlow.parent = parent;
        bayGlow.position.set(0, 5 * scale, this.size * 0.7 * scale + 0.1);
        bayGlow.material = MaterialPool.getTeamMaterial(this.team, 'glow');
    }

    createTurret(color, scene) {
        const parent = this.mesh;

        // Base platform - use shared metallic material
        const base = BABYLON.MeshBuilder.CreateCylinder('base', {
            height: 2,
            diameter: this.size * 2,
            tessellation: 8
        }, scene);
        base.parent = parent;
        base.position.y = 1;
        base.material = MaterialPool.getTeamMaterial(this.team, 'metallic');

        // Rotating turret head
        const head = new BABYLON.TransformNode('turretHead', scene);
        head.parent = parent;
        head.position.y = 3;
        this.turretHead = head;

        // Turret body - use shared base material
        const body = BABYLON.MeshBuilder.CreateCylinder('body', {
            height: 3,
            diameterTop: 3,
            diameterBottom: 4,
            tessellation: 8
        }, scene);
        body.parent = head;
        body.position.y = 1;
        body.material = MaterialPool.getTeamMaterial(this.team, 'base');

        // Twin barrels - use shared metallic material
        for (let i = -1; i <= 1; i += 2) {
            const barrel = BABYLON.MeshBuilder.CreateCylinder('barrel', {
                height: 6,
                diameter: 0.6
            }, scene);
            barrel.parent = head;
            barrel.position.set(i * 1.2, 2, 4);
            barrel.rotation.x = Math.PI / 2;
            barrel.material = MaterialPool.getTeamMaterial(this.team, 'metallic');
        }
    }

    createSupplyDepot(color, scene) {
        const parent = this.mesh;

        // Platform - use shared metallic material
        const platform = BABYLON.MeshBuilder.CreateBox('platform', {
            width: this.size * 2,
            height: 1,
            depth: this.size * 2
        }, scene);
        platform.parent = parent;
        platform.position.y = 0.5;
        platform.material = MaterialPool.getTeamMaterial(this.team, 'metallic');

        // Containers - use shared base material
        for (let i = 0; i < 4; i++) {
            const container = BABYLON.MeshBuilder.CreateBox('container' + i, {
                width: 3,
                height: 3,
                depth: 5
            }, scene);
            container.parent = parent;
            container.position.set(
                (i % 2 === 0 ? -1 : 1) * 2.5,
                2.5 + Math.floor(i / 2) * 3.5,
                0
            );
            container.material = MaterialPool.getTeamMaterial(this.team, 'base');
        }
    }

    createRadar(color, scene) {
        const parent = this.mesh;

        // Base - use shared metallic material
        const base = BABYLON.MeshBuilder.CreateCylinder('base', {
            height: 2,
            diameter: this.size * 1.5,
            tessellation: 8
        }, scene);
        base.parent = parent;
        base.position.y = 1;
        base.material = MaterialPool.getTeamMaterial(this.team, 'metallic');

        // Tower - use shared metallic material
        const tower = BABYLON.MeshBuilder.CreateCylinder('tower', {
            height: 10,
            diameter: 1.5
        }, scene);
        tower.parent = parent;
        tower.position.y = 7;
        tower.material = MaterialPool.getTeamMaterial(this.team, 'metallic');

        // Rotating dish
        const dishParent = new BABYLON.TransformNode('dishParent', scene);
        dishParent.parent = parent;
        dishParent.position.y = 12;
        this.turretHead = dishParent;

        // Dish - use shared base material
        const dish = BABYLON.MeshBuilder.CreateDisc('dish', { radius: 4 }, scene);
        dish.parent = dishParent;
        dish.rotation.x = -Math.PI / 4;
        dish.material = MaterialPool.getTeamMaterial(this.team, 'base');
    }

    createGenericBuilding(color, scene) {
        const box = BABYLON.MeshBuilder.CreateBox('building', {
            width: this.size,
            height: this.size * 0.8,
            depth: this.size
        }, scene);
        box.parent = this.mesh;
        box.position.y = this.size * 0.4;
        box.material = MaterialPool.getTeamMaterial(this.team, 'base');
    }

    update(dt) {
        if (this.dead) return;

        // Update selection ring visibility
        if (this.selectionRing) {
            this.selectionRing.isVisible = this.selected;
        }

        // Update progress bar visibility and fill
        this.updateProgressBar();

        // Construction
        if (this.isConstructing) {
            this.constructionProgress += dt / this.buildTime;
            this.health = this.maxHealth * (0.1 + 0.9 * this.constructionProgress);

            if (this.constructionProgress >= 1) {
                this.isConstructing = false;
                this.constructionProgress = 1;
                this.health = this.maxHealth;

                eventBus.emit(GameEvents.BUILDING_COMPLETED, {
                    building: this
                });
            }
            return;
        }

        // Building production
        if (this.buildQueue.length > 0) {
            const building = this.buildQueue[0];
            const unitDef = UNITS[building.type];
            this.buildProgress += dt / unitDef.buildTime;

            if (this.buildProgress >= 1) {
                this.spawnUnit(building.type);
                this.buildQueue.shift();
                this.buildProgress = 0;
            }
        }

        // Refinery processing
        if (this.type === 'refinery' && !this.isConstructing) {
            const processAmount = Math.min(this.storedOre, this.def.processRate * dt);
            if (processAmount > 0) {
                this.storedOre -= processAmount;
                gameState.modifyResource(this.team, 'ore', -processAmount);
                gameState.modifyResource(this.team, 'credits', processAmount * 2);
            }

            const crystalProcess = Math.min(this.storedCrystals, this.def.processRate * 0.5 * dt);
            if (crystalProcess > 0) {
                this.storedCrystals -= crystalProcess;
                gameState.modifyResource(this.team, 'crystals', -crystalProcess);
                gameState.modifyResource(this.team, 'credits', crystalProcess * CONFIG.CRYSTAL_VALUE_MULTIPLIER * 2);
            }
        }

        // Turret combat
        if (this.type === 'turret' && !this.isConstructing) {
            const target = this.findTarget();
            if (target) {
                // Rotate turret to face target (if turretHead exists)
                if (this.turretHead) {
                    const dx = target.mesh.position.x - this.mesh.position.x;
                    const dz = target.mesh.position.z - this.mesh.position.z;
                    const targetAngle = Math.atan2(dx, dz);
                    this.turretHead.rotation.y = targetAngle;
                }

                // Fire regardless of turretHead
                const now = performance.now();
                if (now - this.lastFire > this.def.fireRate) {
                    this.fireAt(target);
                    this.lastFire = now;
                }
            }
        }

        // Radar rotation
        if (this.type === 'radar' && this.turretHead) {
            this.turretHead.rotation.y += dt * 0.5;
        }
    }

    updateProgressBar() {
        if (!this.progressBarBg || !this.progressBarFill) return;

        // Determine if we should show progress bar
        const showConstruction = this.isConstructing;
        const showProduction = this.buildQueue.length > 0 && !this.isConstructing;
        const showBar = showConstruction || showProduction;

        this.progressBarBg.isVisible = showBar;
        this.progressBarFill.isVisible = showBar;

        if (!showBar) return;

        // Get the progress value (0-1)
        let progress = 0;
        if (showConstruction) {
            progress = this.constructionProgress || 0;
            // Yellow for construction
            if (this.progressBarFill.material) {
                this.progressBarFill.material.emissiveColor = new BABYLON.Color3(1, 0.8, 0);
                this.progressBarFill.material.diffuseColor = new BABYLON.Color3(1, 0.8, 0);
            }
        } else if (showProduction) {
            progress = this.buildProgress || 0;
            // Green for production
            if (this.progressBarFill.material) {
                this.progressBarFill.material.emissiveColor = new BABYLON.Color3(0, 0.8, 0.2);
                this.progressBarFill.material.diffuseColor = new BABYLON.Color3(0, 0.8, 0.2);
            }
        }

        // Scale the fill bar based on progress
        const fullWidth = this.progressBarWidth || (this.size * 2);
        const fillWidth = Math.max(0.01, progress * fullWidth);

        this.progressBarFill.scaling.x = progress;
        // Offset so it grows from left to right
        this.progressBarFill.position.x = -(fullWidth - fillWidth) / 2;
    }

    findTarget() {
        let closest = null;
        let closestDist = this.def.range || 0;

        for (const ent of gameState.entities) {
            if (ent.dead || ent.team === this.team) continue;
            if (!gameState.isHostile(this.team, ent.team)) continue;

            const dist = Math.hypot(
                ent.mesh.position.x - this.mesh.position.x,
                ent.mesh.position.z - this.mesh.position.z
            );
            if (dist < closestDist) {
                closest = ent;
                closestDist = dist;
            }
        }
        return closest;
    }

    fireAt(target) {
        const startPos = this.mesh.position.clone();
        startPos.y = 5;

        const hardpoints = this.def.hardpoints;

        if (hardpoints && hardpoints.length > 0) {
            // Fire from each hardpoint with slight delay for visual effect
            const damagePerHardpoint = this.def.damage / hardpoints.length;

            hardpoints.forEach((hp, index) => {
                // Stagger shots slightly (50ms between each hardpoint)
                setTimeout(() => {
                    if (this.dead || (target && target.dead)) return;

                    // For turrets, use turretHead rotation for proper hardpoint positioning
                    let hardpointOffset = { x: hp.x, y: hp.y, z: hp.z };

                    eventBus.emit(GameEvents.COMBAT_PROJECTILE_FIRED, {
                        shooter: this,
                        target,
                        startPos: this.mesh.position.clone(),
                        damage: damagePerHardpoint,
                        hardpointOffset: hardpointOffset,
                        hardpointWeapon: hp.weapon || this.def.weaponType
                    });
                }, index * 50);
            });
        } else {
            // Fallback to single shot
            eventBus.emit(GameEvents.COMBAT_PROJECTILE_FIRED, {
                shooter: this,
                target,
                startPos,
                damage: this.def.damage
            });
        }
    }

    queueUnit(unitType) {
        const unitDef = UNITS[unitType];
        const res = gameState.getResources(this.team);

        // Normalize cost - handle both number and object formats
        const cost = typeof unitDef.cost === 'number' ? unitDef.cost : (unitDef.cost?.credits || 0);

        if (res.credits < cost) {
            eventBus.emit(GameEvents.UI_ALERT, {
                message: 'Insufficient credits',
                type: 'danger',
                team: this.team
            });
            return false;
        }

        if (res.supply + (unitDef.supply || 1) > res.maxSupply) {
            eventBus.emit(GameEvents.UI_ALERT, {
                message: 'Supply limit reached',
                type: 'danger',
                team: this.team
            });
            return false;
        }

        gameState.spendCredits(this.team, cost);
        this.buildQueue.push({ type: unitType });

        eventBus.emit(GameEvents.BUILDING_QUEUE_START, {
            building: this,
            unitType
        });

        return true;
    }

    spawnUnit(unitType) {
        const unitDef = UNITS[unitType];
        const angle = Math.random() * Math.PI * 2;
        const dist = this.size + 8;
        const x = this.mesh.position.x + Math.cos(angle) * dist;
        const z = this.mesh.position.z + Math.sin(angle) * dist;

        eventBus.emit(GameEvents.UNIT_SPAWNED, {
            building: this,
            unitType,
            position: { x, z },
            team: this.team,
            rallyPoint: this.rallyPoint
        });
    }

    takeDamage(amount, attacker) {
        this.health -= amount;

        // Provoke neutrals when attacked
        if (this.team >= TEAMS.NEUTRAL && attacker) {
            gameState.provoke(attacker.team, this.team);
        }

        eventBus.emit(GameEvents.ENTITY_DAMAGED, {
            entity: this,
            amount,
            attacker,
            remainingHealth: this.health
        });

        if (this.health <= 0) {
            this.die(attacker);
        }
    }

    die(killer) {
        this.dead = true;

        gameState.recordBuildingLost(this.team);

        if (killer) {
            gameState.recordKill(killer.team);
        }

        // Clean up rally point visuals
        if (this.rallyMarker) {
            this.rallyMarker.dispose();
            this.rallyMarker = null;
        }
        if (this.rallyLine) {
            this.rallyLine.dispose();
            this.rallyLine = null;
        }

        eventBus.emit(GameEvents.BUILDING_DESTROYED, {
            building: this,
            killer
        });

        this.dispose();
    }
}

export default Building;
