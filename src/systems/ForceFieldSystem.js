// ============================================================
// VOID SUPREMACY 3D - Force Field System
// Manages force field generators and energy barriers between them
// ============================================================

import { BUILDINGS, TEAM_COLORS } from '../core/Config.js?v=20260119';
import { eventBus, GameEvents } from '../core/EventBus.js?v=20260119';
import { gameState } from '../core/GameState.js?v=20260119';
import { MaterialPool } from '../core/MaterialPool.js?v=20260119';

export class ForceFieldSystem {
    constructor() {
        this.scene = null;
        this.generators = [];      // All force field generators
        this.segments = [];        // Active field segments between generators
        this.segmentIdCounter = 0;
    }

    init(scene) {
        this.scene = scene;
        this.generators = [];
        this.segments = [];
        this.segmentIdCounter = 0;

        // Listen for building events - store unsubscribe functions for cleanup
        this._unsubs = [
            eventBus.on(GameEvents.BUILDING_COMPLETED, (data) => {
                if (data.building.type === 'forceFieldGenerator') {
                    this.registerGenerator(data.building);
                } else {
                    // Any building can block connections - recalculate
                    this.updateConnections();
                }
            }),

            eventBus.on(GameEvents.BUILDING_DESTROYED, (data) => {
                if (data.building.type === 'forceFieldGenerator') {
                    this.unregisterGenerator(data.building);
                } else {
                    // Building removed - may unblock connections
                    this.updateConnections();
                }
            })
        ];
    }

    /**
     * Register a new force field generator when building completes
     */
    registerGenerator(building) {
        if (!this.generators.includes(building)) {
            this.generators.push(building);
            this.updateConnections();
        }
    }

    /**
     * Unregister a generator when it's destroyed
     */
    unregisterGenerator(building) {
        const index = this.generators.indexOf(building);
        if (index !== -1) {
            this.generators.splice(index, 1);
            this.updateConnections();
        }
    }

    /**
     * Recalculate all connections between generators
     * Connects all generators within range, but skips connections obstructed by any building
     */
    updateConnections() {
        // Remove all existing segments
        for (const segment of this.segments) {
            this.removeFieldSegment(segment);
        }
        this.segments = [];

        const config = BUILDINGS.forceFieldGenerator;

        // Group generators by team
        const byTeam = {};
        for (const gen of this.generators) {
            if (gen.dead || gen.isConstructing) continue;
            if (!byTeam[gen.team]) byTeam[gen.team] = [];
            byTeam[gen.team].push(gen);
        }

        // For each team, connect all generators within range (no obstruction)
        for (const team in byTeam) {
            const gens = byTeam[team];
            if (gens.length < 2) continue;

            // Track existing connections to avoid duplicates
            const connectedPairs = new Set();

            // Check ALL pairs of generators
            for (let i = 0; i < gens.length; i++) {
                for (let j = i + 1; j < gens.length; j++) {
                    const genA = gens[i];
                    const genB = gens[j];

                    // Check if within range
                    const dist = this.distance(genA, genB);
                    if (dist > config.maxRange) continue;

                    // Skip if any building obstructs the path
                    if (this.isConnectionObstructed(genA, genB)) {
                        continue;
                    }

                    // Create the connection
                    const pairId = [genA.id, genB.id].sort().join('-');
                    if (!connectedPairs.has(pairId)) {
                        connectedPairs.add(pairId);
                        this.createFieldSegment(genA, genB);
                    }
                }
            }
        }
    }

    /**
     * Calculate distance between two generators
     */
    distance(genA, genB) {
        const dx = genA.mesh.position.x - genB.mesh.position.x;
        const dz = genA.mesh.position.z - genB.mesh.position.z;
        return Math.sqrt(dx * dx + dz * dz);
    }

    /**
     * Check if any building obstructs the line between two generators
     * @param {Building} genA - First generator
     * @param {Building} genC - Second generator
     * @returns {boolean} - True if obstructed
     */
    isConnectionObstructed(genA, genC) {
        const ax = genA.mesh.position.x, az = genA.mesh.position.z;
        const cx = genC.mesh.position.x, cz = genC.mesh.position.z;

        // Get ALL buildings (not just generators)
        const allBuildings = gameState.entities.filter(e =>
            e.isBuilding && !e.dead && !e.isConstructing
        );

        for (const building of allBuildings) {
            // Skip the two generators we're connecting
            if (building === genA || building === genC) continue;

            // Use building's size for threshold (larger buildings = larger block radius)
            const blockRadius = (building.def?.size || 6) / 2 + 2;

            const dist = this.pointToLineDistance(
                building.mesh.position.x, building.mesh.position.z,
                ax, az, cx, cz
            );

            if (dist < blockRadius) return true;
        }
        return false;
    }

    /**
     * Create a force field segment between two generators
     */
    createFieldSegment(genA, genB) {
        const config = BUILDINGS.forceFieldGenerator;
        const teamColor = TEAM_COLORS[genA.team];

        // Calculate segment position and rotation
        const posA = genA.mesh.position;
        const posB = genB.mesh.position;
        const midpoint = BABYLON.Vector3.Center(posA, posB);
        const length = BABYLON.Vector3.Distance(posA, posB);

        // Calculate angle in XZ plane for proper horizontal orientation
        const dx = posB.x - posA.x;
        const dz = posB.z - posA.z;
        const angle = Math.atan2(dx, dz);

        // Create the beam mesh
        const beam = BABYLON.MeshBuilder.CreateCylinder('forceField_' + this.segmentIdCounter, {
            height: length,
            diameter: config.fieldWidth,
            tessellation: 12
        }, this.scene);

        beam.position = midpoint.clone();
        beam.position.y = 5; // Elevate the field

        // Proper orientation: lay horizontal (rotate around X) then rotate to face direction
        beam.rotation.x = Math.PI / 2;
        beam.rotation.y = angle;

        // Create glowing material
        const mat = new BABYLON.StandardMaterial('forceFieldMat_' + this.segmentIdCounter, this.scene);
        mat.emissiveColor = new BABYLON.Color3(teamColor[0], teamColor[1], teamColor[2]);
        mat.diffuseColor = new BABYLON.Color3(teamColor[0] * 0.5, teamColor[1] * 0.5, teamColor[2] * 0.5);
        mat.alpha = 0.6;
        mat.backFaceCulling = false;
        beam.material = mat;

        // Create inner glow effect
        const innerBeam = BABYLON.MeshBuilder.CreateCylinder('forceFieldInner_' + this.segmentIdCounter, {
            height: length,
            diameter: config.fieldWidth * 0.5,
            tessellation: 8
        }, this.scene);
        innerBeam.position = beam.position.clone();
        innerBeam.rotation = beam.rotation.clone();

        const innerMat = new BABYLON.StandardMaterial('forceFieldInnerMat_' + this.segmentIdCounter, this.scene);
        innerMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
        innerMat.alpha = 0.3;
        innerMat.backFaceCulling = false;
        innerBeam.material = innerMat;

        const segment = {
            id: this.segmentIdCounter++,
            generatorA: genA,
            generatorB: genB,
            mesh: beam,
            innerMesh: innerBeam,
            material: mat,
            innerMaterial: innerMat,
            health: config.fieldHealth,
            maxHealth: config.fieldHealth,
            team: genA.team,
            lastDamageTime: 0,
            destroyed: false,
            regenDelayRemaining: 0
        };

        this.segments.push(segment);

        eventBus.emit(GameEvents.FORCE_FIELD_CREATED, {
            segment,
            generatorA: genA,
            generatorB: genB
        });

        return segment;
    }

    /**
     * Remove a force field segment
     */
    removeFieldSegment(segment) {
        if (segment.mesh) {
            segment.mesh.dispose();
        }
        if (segment.innerMesh) {
            segment.innerMesh.dispose();
        }
        if (segment.material) {
            segment.material.dispose();
        }
        if (segment.innerMaterial) {
            segment.innerMaterial.dispose();
        }

        eventBus.emit(GameEvents.FORCE_FIELD_DESTROYED, { segment });
    }

    /**
     * Apply damage to a force field segment
     */
    damageSegment(segment, amount, attacker = null) {
        if (segment.destroyed) return;

        segment.health -= amount;
        segment.lastDamageTime = performance.now();
        segment.regenDelayRemaining = BUILDINGS.forceFieldGenerator.fieldRegenDelay;

        // Visual feedback - flash brighter
        if (segment.material) {
            segment.material.alpha = Math.min(1, segment.material.alpha + 0.3);
        }

        eventBus.emit(GameEvents.FORCE_FIELD_DAMAGED, {
            segment,
            damage: amount,
            remainingHealth: segment.health,
            attacker
        });

        if (segment.health <= 0) {
            this.destroySegment(segment);
        }
    }

    /**
     * Destroy a force field segment (visual collapse)
     */
    destroySegment(segment) {
        segment.destroyed = true;

        // Create collapse visual effect
        if (segment.mesh) {
            // Quick fade-out animation
            const startAlpha = segment.material.alpha;
            let progress = 0;
            const fadeInterval = setInterval(() => {
                progress += 0.1;
                if (progress >= 1) {
                    clearInterval(fadeInterval);
                    segment.mesh.isVisible = false;
                    if (segment.innerMesh) segment.innerMesh.isVisible = false;
                } else {
                    segment.material.alpha = startAlpha * (1 - progress);
                    if (segment.innerMaterial) {
                        segment.innerMaterial.alpha = 0.3 * (1 - progress);
                    }
                    // Shrink effect
                    const scale = 1 - progress * 0.5;
                    segment.mesh.scaling.x = scale;
                    segment.mesh.scaling.z = scale;
                }
            }, 50);
        }

        // Create explosion effect at midpoint
        const midpoint = segment.mesh.position.clone();
        eventBus.emit(GameEvents.COMBAT_EXPLOSION, {
            position: midpoint,
            size: 3,
            weaponType: 'plasma'
        });

        eventBus.emit(GameEvents.FORCE_FIELD_DESTROYED, { segment });
    }

    /**
     * Check if a unit would collide with any force field when moving
     * @param {Unit} unit - The unit trying to move
     * @param {Object} newPos - The new position {x, z}
     * @returns {Object|null} - The blocking segment, or null if not blocked
     */
    checkUnitCollision(unit, newPos) {
        for (const segment of this.segments) {
            // Skip destroyed or power-disabled segments
            if (segment.destroyed || segment.powerDisabled) continue;

            // Skip friendly fields
            if (segment.team === unit.team) continue;

            // Get field line endpoints
            const p1 = segment.generatorA.mesh.position;
            const p2 = segment.generatorB.mesh.position;

            // Check if unit's new position would be within the field
            if (this.circleIntersectsLine(newPos.x, newPos.z, unit.size, p1.x, p1.z, p2.x, p2.z, BUILDINGS.forceFieldGenerator.fieldWidth)) {
                return segment;  // Blocked
            }
        }
        return null;  // Not blocked
    }

    /**
     * Check if a projectile path intersects any force field
     * @param {Object} projectile - The projectile
     * @param {BABYLON.Vector3} startPos - Start position
     * @param {BABYLON.Vector3} endPos - End position
     * @returns {Object|null} - { segment, intersection } or null
     */
    checkProjectileCollision(projectile, startPos, endPos) {
        for (const segment of this.segments) {
            // Skip destroyed or power-disabled segments
            if (segment.destroyed || segment.powerDisabled) continue;

            // Skip friendly fields
            if (segment.team === projectile.team) continue;

            // Get field line endpoints
            const p1 = segment.generatorA.mesh.position;
            const p2 = segment.generatorB.mesh.position;

            // Check line-line intersection (2D, ignoring Y)
            const intersection = this.lineLineIntersection(
                startPos.x, startPos.z,
                endPos.x, endPos.z,
                p1.x, p1.z,
                p2.x, p2.z
            );

            if (intersection) {
                return {
                    segment,
                    intersection: new BABYLON.Vector3(intersection.x, 5, intersection.z)
                };
            }
        }
        return null;
    }

    /**
     * Check if a circle intersects a line segment (with thickness)
     */
    circleIntersectsLine(cx, cz, radius, x1, z1, x2, z2, lineWidth) {
        // Calculate distance from point to line segment
        const dist = this.pointToLineDistance(cx, cz, x1, z1, x2, z2);
        return dist < (radius + lineWidth / 2);
    }

    /**
     * Calculate distance from point to line segment
     */
    pointToLineDistance(px, pz, x1, z1, x2, z2) {
        const dx = x2 - x1;
        const dz = z2 - z1;
        const lenSq = dx * dx + dz * dz;

        if (lenSq === 0) {
            // Line is a point
            return Math.sqrt((px - x1) * (px - x1) + (pz - z1) * (pz - z1));
        }

        // Calculate projection parameter
        let t = ((px - x1) * dx + (pz - z1) * dz) / lenSq;
        t = Math.max(0, Math.min(1, t));

        // Closest point on line segment
        const closestX = x1 + t * dx;
        const closestZ = z1 + t * dz;

        return Math.sqrt((px - closestX) * (px - closestX) + (pz - closestZ) * (pz - closestZ));
    }

    /**
     * Line-line intersection test
     */
    lineLineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(denom) < 0.0001) return null; // Lines are parallel

        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                x: x1 + t * (x2 - x1),
                z: y1 + t * (y2 - y1)
            };
        }

        return null;
    }

    /**
     * Update force field system each frame
     */
    update(dt) {
        const config = BUILDINGS.forceFieldGenerator;
        const now = performance.now();

        // Check power status for each team (negative energy = power shortage)
        const teamPowered = {};
        for (let t = 0; t <= 5; t++) {
            const res = gameState.getResources(t);
            teamPowered[t] = res && res.energy >= 0;
        }

        for (const segment of this.segments) {
            if (segment.destroyed) {
                // Check if we should regenerate
                segment.regenDelayRemaining -= dt;
                if (segment.regenDelayRemaining <= 0) {
                    // Regenerate the segment
                    this.regenerateSegment(segment);
                }
                continue;
            }

            // Power check - disable field if team has power shortage
            const hasPower = teamPowered[segment.team];
            segment.powerDisabled = !hasPower;

            if (segment.powerDisabled) {
                // Visual: dim and flicker when unpowered
                if (segment.material) {
                    segment.material.alpha = 0.1 + 0.05 * Math.sin(now * 0.01);
                }
                if (segment.innerMesh) {
                    segment.innerMesh.isVisible = false;
                }
                continue;
            }

            // Restore inner mesh visibility when powered
            if (segment.innerMesh && !segment.innerMesh.isVisible) {
                segment.innerMesh.isVisible = true;
            }

            // Pulse animation
            if (segment.innerMaterial) {
                const pulse = 0.2 + 0.1 * Math.sin(now * 0.003 + segment.id);
                segment.innerMaterial.alpha = pulse;
            }

            // Regeneration when not taking damage
            segment.regenDelayRemaining -= dt;
            if (segment.regenDelayRemaining <= 0 && segment.health < segment.maxHealth) {
                segment.health = Math.min(segment.maxHealth, segment.health + config.fieldRegen * dt);

                // Visual feedback - restore alpha based on health
                const healthPercent = segment.health / segment.maxHealth;
                if (segment.material) {
                    segment.material.alpha = 0.3 + 0.3 * healthPercent;
                }
            }

            // Fade back to normal alpha after damage flash
            if (segment.material && segment.material.alpha > 0.6) {
                segment.material.alpha = Math.max(0.6, segment.material.alpha - dt * 2);
            }

            // Update position if generators moved (shouldn't happen but safety check)
            this.updateSegmentPosition(segment);
        }

        // Clean up destroyed segments that have been regenerated
        this.segments = this.segments.filter(s => !s.destroyed || s.regenDelayRemaining > 0);
    }

    /**
     * Regenerate a destroyed segment
     */
    regenerateSegment(segment) {
        if (!segment.generatorA || !segment.generatorB) return;
        if (segment.generatorA.dead || segment.generatorB.dead) return;

        // Recreate the segment
        segment.destroyed = false;
        segment.health = segment.maxHealth * 0.5; // Start at 50% health
        segment.mesh.isVisible = true;
        segment.mesh.scaling.x = 1;
        segment.mesh.scaling.z = 1;
        if (segment.innerMesh) {
            segment.innerMesh.isVisible = true;
        }
        if (segment.material) {
            segment.material.alpha = 0.4;
        }
        if (segment.innerMaterial) {
            segment.innerMaterial.alpha = 0.2;
        }

        eventBus.emit(GameEvents.FORCE_FIELD_REGENERATED, { segment });
    }

    /**
     * Update segment position to match generators
     */
    updateSegmentPosition(segment) {
        if (!segment.mesh || !segment.generatorA || !segment.generatorB) return;

        const posA = segment.generatorA.mesh.position;
        const posB = segment.generatorB.mesh.position;
        const midpoint = BABYLON.Vector3.Center(posA, posB);
        const length = BABYLON.Vector3.Distance(posA, posB);

        // Calculate direction angle in XZ plane
        const dx = posB.x - posA.x;
        const dz = posB.z - posA.z;
        const angle = Math.atan2(dx, dz);

        segment.mesh.position.x = midpoint.x;
        segment.mesh.position.z = midpoint.z;

        // Update cylinder height via scaling
        // The cylinder was created with height=length, so scale relative to that
        const boundingInfo = segment.mesh.getBoundingInfo();
        const baseHeight = boundingInfo.boundingBox.extendSizeWorld.y * 2 / segment.mesh.scaling.y;
        segment.mesh.scaling.y = length / baseHeight;

        // Proper orientation: horizontal then rotate to direction
        segment.mesh.rotation.x = Math.PI / 2;
        segment.mesh.rotation.y = angle;

        if (segment.innerMesh) {
            segment.innerMesh.position = segment.mesh.position.clone();
            segment.innerMesh.rotation = segment.mesh.rotation.clone();
            segment.innerMesh.scaling = segment.mesh.scaling.clone();
        }
    }

    /**
     * Get preview connections for a potential generator placement
     * @param {number} x - World X position
     * @param {number} z - World Z position
     * @param {number} team - Team ID
     * @returns {Array} - Array of {generator, position, dist} for all non-obstructed generators in range
     */
    getPreviewConnections(x, z, team) {
        const config = BUILDINGS.forceFieldGenerator;

        const validGens = this.generators.filter(
            g => g.team === team && !g.dead && !g.isConstructing
        );

        // Get ALL buildings for obstruction check
        const allBuildings = gameState.entities.filter(e =>
            e.isBuilding && !e.dead && !e.isConstructing
        );

        return validGens
            .map(g => ({
                generator: g,
                position: g.mesh.position.clone(),
                dist: Math.hypot(g.mesh.position.x - x, g.mesh.position.z - z)
            }))
            .filter(c => c.dist <= config.maxRange)
            .filter(c => {
                // Check if any building obstructs this preview connection
                for (const building of allBuildings) {
                    // Skip the generator we're connecting to
                    if (building === c.generator) continue;

                    // Use building's size for threshold
                    const blockRadius = (building.def?.size || 6) / 2 + 2;

                    const dist = this.pointToLineDistance(
                        building.mesh.position.x, building.mesh.position.z,
                        x, z,
                        c.generator.mesh.position.x, c.generator.mesh.position.z
                    );
                    if (dist < blockRadius) return false;
                }
                return true;
            });
    }

    /**
     * Get all segments for a specific team
     */
    getSegmentsForTeam(team) {
        return this.segments.filter(s => s.team === team && !s.destroyed);
    }

    /**
     * Get all active (non-destroyed) segments
     */
    getActiveSegments() {
        return this.segments.filter(s => !s.destroyed);
    }

    dispose() {
        // Unsubscribe from event bus listeners
        this._unsubs?.forEach(unsub => unsub?.());
        this._unsubs = null;

        for (const segment of this.segments) {
            this.removeFieldSegment(segment);
        }
        this.generators = [];
        this.segments = [];
    }
}

export const forceFieldSystem = new ForceFieldSystem();

export default ForceFieldSystem;
