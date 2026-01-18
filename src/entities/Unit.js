// ============================================================
// VOID SUPREMACY 3D - Unit Class
// Combat units, harvesters, and all mobile entities
// Optimized with MaterialPool for shared materials
// ============================================================

import { Entity } from './Entity.js';
import { UNITS, TEAMS, TEAM_COLORS, CONFIG } from '../core/Config.js';
import { eventBus, GameEvents } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';
import { MaterialPool } from '../core/MaterialPool.js';
import { LODManager } from '../rendering/LODManager.js';
import { forceFieldSystem } from '../systems/ForceFieldSystem.js';

export class Unit extends Entity {
    constructor(x, z, team, type, scene) {
        super(x, z, team);

        this.entityType = 'unit';
        this.isUnit = true;
        this.type = type;
        this.def = UNITS[type];
        this.scene = scene;

        // Stats from definition
        this.size = this.def.size;
        this.maxHealth = this.def.maxHealth;
        this.health = this.maxHealth;
        this.shield = this.def.shield || 0;
        this.maxShield = this.shield;
        this.speed = this.def.speed;

        // Movement
        this.targetX = x;
        this.targetZ = z;
        this.moveCommand = null;
        this.command = 'idle';
        this.guardTarget = null;

        // Combat
        this.attackTarget = null;
        this.lastFire = 0;
        this.isAttackMoving = false;
        this.holdPosition = false;
        this.patrolPoints = null;
        this.patrolIndex = 0;

        // Harvesting (for harvesters)
        this.harvestTarget = null;
        this.cargo = 0;
        this.cargoType = null; // 'ore' or 'crystal'
        this.isReturning = false;

        // Store team color for LOD billboard
        this.teamColor = TEAM_COLORS[this.team] ?
            new BABYLON.Color3(TEAM_COLORS[this.team].r, TEAM_COLORS[this.team].g, TEAM_COLORS[this.team].b) :
            new BABYLON.Color3(1, 1, 1);

        if (scene) {
            this.createMesh(scene);
            this.mesh.position = new BABYLON.Vector3(x, this.size, z);

            // Register with LOD manager for distance-based detail switching
            this.registerWithLODManager();
        }
    }

    /**
     * Register this unit with the LOD manager for distance-based detail switching
     */
    registerWithLODManager() {
        if (!LODManager.enabled) return;

        // Collect LOD meshes from the unit hierarchy
        const lodMeshes = this.collectLODMeshes();

        // Register with LOD manager
        LODManager.register(
            this.id,
            lodMeshes,
            this.mesh.position,
            this.size,
            this.teamColor
        );
    }

    /**
     * Collect meshes for LOD levels from the unit's mesh hierarchy
     * @returns {Object} - { high: Mesh, medium: Mesh, low: Mesh }
     */
    collectLODMeshes() {
        // Find the primary mesh in the hierarchy
        // For now, we use the same mesh for all LOD levels
        // Enhanced ships could provide multiple detail levels
        let primaryMesh = null;

        if (this.mesh && this.mesh.getChildMeshes) {
            const children = this.mesh.getChildMeshes();
            if (children.length > 0) {
                // Find the largest/main mesh (usually the body)
                primaryMesh = children.find(m => m.name.includes('body') || m.name.includes('hull')) || children[0];
            }
        }

        // Return same mesh for all levels (LOD manager handles visibility)
        return {
            high: primaryMesh,
            medium: primaryMesh,
            low: primaryMesh
        };
    }

    createMesh(scene) {
        const color = TEAM_COLORS[this.team];
        const parent = new BABYLON.TransformNode('unit_' + this.type + '_' + this.id, scene);
        let usedEnhanced = false;

        // Try to use enhanced ship models if available
        if (window.VoidShipsEnhanced) {
            if (!window.VoidShipsEnhanced.initialized) {
                window.VoidShipsEnhanced.init(scene);
            }
            const success = window.VoidShipsEnhanced.createShipMesh(
                this.type, this.size, color, this.team, parent
            );
            if (success) {
                usedEnhanced = true;
            }
        }

        if (!usedEnhanced) {
            // Fallback to default ship creation
            if (this.type === 'harvester') {
                this.createHarvesterMesh(color, parent, scene);
            } else if (['scout', 'interceptor', 'striker'].includes(this.type)) {
                this.createFighterMesh(color, parent, scene);
            } else if (['heavy', 'bomber', 'gunship'].includes(this.type)) {
                this.createMediumMesh(color, parent, scene);
            } else {
                this.createCapitalMesh(color, parent, scene);
            }

            // Engine glow - use MaterialPool for shared team emissive material
            const engineGlow = BABYLON.MeshBuilder.CreateSphere('engineGlow', {
                diameter: this.size * 0.4,
                segments: 6
            }, scene);
            engineGlow.parent = parent;
            engineGlow.position.z = -this.size * 0.7;

            // Use shared emissive material from MaterialPool
            engineGlow.material = MaterialPool.getTeamMaterial(this.team, 'emissive');
        }

        // Selection ring (hidden by default) - use shared selection material
        this.selectionRing = BABYLON.MeshBuilder.CreateTorus('selectionRing_' + this.id, {
            diameter: this.size * 3,
            thickness: 0.3,
            tessellation: 24  // Reduced for performance
        }, scene);
        this.selectionRing.parent = parent;
        this.selectionRing.position.y = -this.size + 0.2;
        this.selectionRing.rotation.x = Math.PI / 2;

        // Use shared selection material from MaterialPool
        this.selectionRing.material = MaterialPool.getSelectionMaterial();
        this.selectionRing.isVisible = false;

        this.mesh = parent;
    }

    createHarvesterMesh(color, parent, scene) {
        const body = BABYLON.MeshBuilder.CreateBox('body', {
            width: this.size * 1.5,
            height: this.size * 0.8,
            depth: this.size * 2
        }, scene);
        body.parent = parent;

        // Use shared hull material from MaterialPool
        body.material = MaterialPool.getTeamMaterial(this.team, 'hull');

        // Mining drill
        const drill = BABYLON.MeshBuilder.CreateCylinder('drill', {
            height: this.size,
            diameterTop: 0.2,
            diameterBottom: this.size * 0.5
        }, scene);
        drill.parent = parent;
        drill.position.z = this.size * 1.2;
        drill.rotation.x = Math.PI / 2;

        // Use shared metallic material from MaterialPool
        drill.material = MaterialPool.getTeamMaterial(this.team, 'metallic');

        return body;
    }

    createFighterMesh(color, parent, scene) {
        const body = BABYLON.MeshBuilder.CreateCylinder('body', {
            height: this.size * 2,
            diameterTop: 0,
            diameterBottom: this.size * 0.8,
            tessellation: 4
        }, scene);
        body.parent = parent;
        body.rotation.x = -Math.PI / 2;

        // Use shared base material from MaterialPool
        const mat = MaterialPool.getTeamMaterial(this.team, 'base');
        body.material = mat;

        // Wings
        for (let i = -1; i <= 1; i += 2) {
            const wing = BABYLON.MeshBuilder.CreateBox('wing', {
                width: this.size * 1.5,
                height: 0.2,
                depth: this.size * 0.8
            }, scene);
            wing.parent = parent;
            wing.position.x = i * this.size * 0.6;
            wing.rotation.z = i * 0.2;
            wing.material = mat;
        }

        return body;
    }

    createMediumMesh(color, parent, scene) {
        const body = BABYLON.MeshBuilder.CreateBox('body', {
            width: this.size * 0.8,
            height: this.size * 0.6,
            depth: this.size * 1.5
        }, scene);
        body.parent = parent;

        // Use shared base material from MaterialPool
        const mat = MaterialPool.getTeamMaterial(this.team, 'base');
        body.material = mat;

        // Engine pods
        for (let i = -1; i <= 1; i += 2) {
            const pod = BABYLON.MeshBuilder.CreateCylinder('pod', {
                height: this.size * 0.8,
                diameter: this.size * 0.4
            }, scene);
            pod.parent = parent;
            pod.position.set(i * this.size * 0.5, 0, -this.size * 0.4);
            pod.rotation.x = Math.PI / 2;
            pod.material = mat;
        }

        return body;
    }

    createCapitalMesh(color, parent, scene) {
        const body = BABYLON.MeshBuilder.CreateBox('body', {
            width: this.size * 0.5,
            height: this.size * 0.4,
            depth: this.size * 1.2
        }, scene);
        body.parent = parent;

        // Use shared hull material from MaterialPool
        const mat = MaterialPool.getTeamMaterial(this.team, 'hull');
        body.material = mat;

        // Bridge
        const bridge = BABYLON.MeshBuilder.CreateBox('bridge', {
            width: this.size * 0.3,
            height: this.size * 0.25,
            depth: this.size * 0.3
        }, scene);
        bridge.parent = parent;
        bridge.position.set(0, this.size * 0.25, this.size * 0.3);
        bridge.material = mat;

        // Armor plates - use shared accent material from MaterialPool
        const plateMat = MaterialPool.getTeamMaterial(this.team, 'accent');

        for (let i = -1; i <= 1; i += 2) {
            const plate = BABYLON.MeshBuilder.CreateBox('plate', {
                width: this.size * 0.15,
                height: this.size * 0.5,
                depth: this.size * 0.8
            }, scene);
            plate.parent = parent;
            plate.position.x = i * this.size * 0.35;
            plate.material = plateMat;
        }

        return body;
    }

    update(dt) {
        if (this.dead) return;

        // Update selection ring visibility
        if (this.selectionRing) {
            this.selectionRing.isVisible = this.selected;
        }

        // Shield regeneration
        if (this.shield < this.maxShield) {
            this.shield = Math.min(this.maxShield, this.shield + dt * 5);
        }

        // Harvesting logic
        if (this.type === 'harvester') {
            this.updateHarvester(dt);
            return;
        }

        // Combat logic
        if (this.attackTarget && !this.attackTarget.dead) {
            const dist = this.distanceTo(this.attackTarget);

            if (dist > this.def.range) {
                // Move closer
                if (!this.holdPosition) {
                    this.moveToward(this.attackTarget.mesh.position.x, this.attackTarget.mesh.position.z, dt);
                }
            } else {
                // Fire
                const now = performance.now();
                if (now - this.lastFire > this.def.fireRate) {
                    this.fireAt(this.attackTarget);
                    this.lastFire = now;
                }
            }
        } else {
            this.attackTarget = null;

            // Attack-move: find targets while moving
            if (this.isAttackMoving || this.holdPosition) {
                const target = this.findTarget();
                if (target) {
                    this.attackTarget = target;
                    return;
                }
            }

            // Patrol logic
            if (this.patrolPoints && this.patrolPoints.length > 0) {
                const target = this.patrolPoints[this.patrolIndex];
                const dist = Math.hypot(
                    this.mesh.position.x - target.x,
                    this.mesh.position.z - target.z
                );

                if (dist < 5) {
                    this.patrolIndex = (this.patrolIndex + 1) % this.patrolPoints.length;
                } else {
                    this.moveToward(target.x, target.z, dt);
                }

                // Check for enemies while patrolling
                const enemy = this.findTarget();
                if (enemy) this.attackTarget = enemy;
                return;
            }

            // Normal movement
            this.updateMovement(dt);
        }
    }

    updateHarvester(dt) {
        if (this.isReturning) {
            // Return to refinery
            const refinery = this.findNearestRefinery();
            if (refinery) {
                const dist = this.distanceTo(refinery);
                if (dist < refinery.size + 5) {
                    // Deposit cargo (refinery stores it, command center just receives it)
                    if (this.cargoType === 'crystal') {
                        if (refinery.storedCrystals !== undefined) {
                            refinery.storedCrystals += this.cargo;
                        }
                        gameState.modifyResource(this.team, 'crystals', this.cargo);
                    } else {
                        if (refinery.storedOre !== undefined) {
                            refinery.storedOre += this.cargo;
                        }
                        gameState.modifyResource(this.team, 'ore', this.cargo);
                    }
                    this.cargo = 0;
                    this.cargoType = null;
                    this.isReturning = false;

                    // Return to harvest
                    if (this.harvestTarget && !this.harvestTarget.depleted) {
                        // Continue harvesting same target
                    } else {
                        const ore = this.findNearestOre();
                        if (ore) this.harvestTarget = ore;
                    }
                } else {
                    this.moveToward(refinery.mesh.position.x, refinery.mesh.position.z, dt);
                }
            }
        } else if (this.harvestTarget && !this.harvestTarget.depleted) {
            const dist = Math.hypot(
                this.mesh.position.x - this.harvestTarget.x,
                this.mesh.position.z - this.harvestTarget.z
            );

            if (dist < this.harvestTarget.size + 5) {
                // Harvest
                const harvestAmount = Math.min(
                    this.def.harvestRate * dt,
                    this.def.cargoCapacity - this.cargo,
                    this.harvestTarget.amount
                );

                this.harvestTarget.amount -= harvestAmount;
                this.cargo += harvestAmount;
                this.cargoType = this.harvestTarget.isCrystal ? 'crystal' : 'ore';

                // Update ore visual
                if (this.harvestTarget.mesh) {
                    const scale = 0.3 + 0.7 * (this.harvestTarget.amount / this.harvestTarget.maxAmount);
                    if (this.harvestTarget.mesh.scaling) {
                        this.harvestTarget.mesh.scaling.setAll(scale);
                    }
                }

                if (this.harvestTarget.amount <= 0) {
                    this.harvestTarget.depleted = true;
                    this.harvestTarget.regrowTimer = CONFIG.ORE_REGROW_DELAY;
                    if (this.harvestTarget.mesh) {
                        this.harvestTarget.mesh.setEnabled(false);
                    }

                    eventBus.emit(GameEvents.RESOURCE_DEPLETED, {
                        node: this.harvestTarget,
                        type: this.cargoType
                    });
                }

                if (this.cargo >= this.def.cargoCapacity) {
                    this.isReturning = true;
                }
            } else {
                this.moveToward(this.harvestTarget.x, this.harvestTarget.z, dt);
            }
        } else {
            // No harvest target, return if has cargo or find new ore
            if (this.cargo > 0) {
                this.isReturning = true;
            } else {
                this.updateMovement(dt);
            }
        }
    }

    updateMovement(dt) {
        const dx = this.targetX - this.mesh.position.x;
        const dz = this.targetZ - this.mesh.position.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 2) {
            this.moveToward(this.targetX, this.targetZ, dt);
        }
    }

    moveToward(tx, tz, dt) {
        const dx = tx - this.mesh.position.x;
        const dz = tz - this.mesh.position.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 0.1) {
            const moveSpeed = this.speed * dt;
            const moveDist = Math.min(moveSpeed, dist);

            // Calculate new position
            const newX = this.mesh.position.x + (dx / dist) * moveDist;
            const newZ = this.mesh.position.z + (dz / dist) * moveDist;

            // Check for force field collision
            const blocked = forceFieldSystem.checkUnitCollision(this, { x: newX, z: newZ });
            if (blocked) {
                // Stop at the field boundary - don't move
                return;
            }

            this.mesh.position.x = newX;
            this.mesh.position.z = newZ;

            // Face movement direction
            this.mesh.rotation.y = Math.atan2(dx, dz);

            // Update LOD manager with new position
            LODManager.updatePosition(this.id, this.mesh.position);
        }
    }

    // ===== Commands =====

    moveTo(x, z) {
        this.targetX = x;
        this.targetZ = z;
        this.attackTarget = null;
        this.isAttackMoving = false;
        this.patrolPoints = null;

        eventBus.emit(GameEvents.UNIT_COMMAND, {
            unit: this,
            command: 'move',
            target: { x, z }
        });
    }

    attack(target) {
        this.attackTarget = target;
        this.isAttackMoving = false;

        eventBus.emit(GameEvents.UNIT_COMMAND, {
            unit: this,
            command: 'attack',
            target
        });
    }

    attackMove(x, z) {
        this.targetX = x;
        this.targetZ = z;
        this.isAttackMoving = true;
        this.patrolPoints = null;

        eventBus.emit(GameEvents.UNIT_COMMAND, {
            unit: this,
            command: 'attackMove',
            target: { x, z }
        });
    }

    patrol(points) {
        this.patrolPoints = points;
        this.patrolIndex = 0;
        this.attackTarget = null;
        this.isAttackMoving = false;

        eventBus.emit(GameEvents.UNIT_COMMAND, {
            unit: this,
            command: 'patrol',
            points
        });
    }

    stop() {
        this.targetX = this.mesh.position.x;
        this.targetZ = this.mesh.position.z;
        this.attackTarget = null;
        this.isAttackMoving = false;
        this.patrolPoints = null;

        eventBus.emit(GameEvents.UNIT_COMMAND, {
            unit: this,
            command: 'stop'
        });
    }

    hold() {
        this.holdPosition = !this.holdPosition;
        if (this.holdPosition) {
            this.stop();
        }

        eventBus.emit(GameEvents.UNIT_COMMAND, {
            unit: this,
            command: 'hold',
            holding: this.holdPosition
        });
    }

    harvest(oreNode) {
        this.harvestTarget = oreNode;
        this.isReturning = false;

        eventBus.emit(GameEvents.UNIT_COMMAND, {
            unit: this,
            command: 'harvest',
            target: oreNode
        });
    }

    // ===== Target Finding =====

    findTarget() {
        let closest = null;
        let closestDist = this.def.range * 1.5;

        for (const ent of gameState.entities) {
            if (ent.dead || ent.team === this.team) continue;
            if (!gameState.isHostile(this.team, ent.team)) continue;

            const dist = this.distanceTo(ent);
            if (dist < closestDist) {
                closest = ent;
                closestDist = dist;
            }
        }
        return closest;
    }

    findNearestOre() {
        let closest = null;
        let closestDist = Infinity;

        const allNodes = [...gameState.oreNodes, ...gameState.crystalNodes];

        for (const ore of allNodes) {
            if (ore.depleted) continue;
            const dist = Math.hypot(
                this.mesh.position.x - ore.x,
                this.mesh.position.z - ore.z
            );
            if (dist < closestDist) {
                closest = ore;
                closestDist = dist;
            }
        }
        return closest;
    }

    findNearestRefinery() {
        let closest = null;
        let closestDist = Infinity;

        // Only refineries can process ore - no fallback to command center
        for (const ent of gameState.entities) {
            if (ent.dead || ent.team !== this.team) continue;
            if (ent.type !== 'refinery' || ent.isConstructing) continue;

            const dist = this.distanceTo(ent);
            if (dist < closestDist) {
                closest = ent;
                closestDist = dist;
            }
        }

        return closest;
    }

    // ===== Combat =====

    fireAt(target) {
        const startPos = this.mesh.position.clone();
        const hardpoints = this.def.hardpoints;

        if (hardpoints && hardpoints.length > 0) {
            // Fire from each hardpoint with slight delay for visual effect
            const damagePerHardpoint = this.def.damage / hardpoints.length;

            hardpoints.forEach((hp, index) => {
                // Stagger shots slightly (50ms between each hardpoint)
                setTimeout(() => {
                    if (this.dead || (target && target.dead)) return;

                    eventBus.emit(GameEvents.COMBAT_PROJECTILE_FIRED, {
                        shooter: this,
                        target,
                        startPos: this.mesh.position.clone(),
                        damage: damagePerHardpoint,
                        splash: this.def.splash ? this.def.splash / hardpoints.length : 0,
                        hardpointOffset: { x: hp.x * this.size * 0.5, y: hp.y * this.size * 0.5, z: hp.z * this.size * 0.5 },
                        hardpointWeapon: hp.weapon || this.def.weaponType
                    });
                }, index * 50);
            });
        } else {
            // Fallback to single shot from center
            eventBus.emit(GameEvents.COMBAT_PROJECTILE_FIRED, {
                shooter: this,
                target,
                startPos,
                damage: this.def.damage,
                splash: this.def.splash || 0
            });
        }
    }

    takeDamage(amount, attacker) {
        // Shield absorbs first
        if (this.shield > 0) {
            const shieldDamage = Math.min(this.shield, amount);
            this.shield -= shieldDamage;
            amount -= shieldDamage;
        }

        this.health -= amount;

        // Provoke neutrals
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

        // Unregister from LOD manager
        LODManager.unregister(this.id);

        // Update supply
        gameState.modifyResource(this.team, 'supply', -this.def.supply);
        gameState.recordUnitLost(this.team);

        if (killer) {
            gameState.recordKill(killer.team);
        }

        eventBus.emit(GameEvents.UNIT_KILLED, {
            unit: this,
            killer,
            position: this.mesh.position.clone()
        });

        // Death explosion
        eventBus.emit(GameEvents.COMBAT_EXPLOSION, {
            position: this.mesh.position.clone(),
            size: this.size
        });

        this.dispose();
    }
}

export default Unit;
