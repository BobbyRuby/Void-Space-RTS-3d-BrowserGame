// ============================================================
// VOID SUPREMACY 3D - Resource System
// Handles ore/crystal nodes and resource regrowth
// ============================================================

import { CONFIG } from '../core/Config.js?v=20260119';
import { eventBus, GameEvents } from '../core/EventBus.js?v=20260119';
import { gameState } from '../core/GameState.js?v=20260119';
import { getSeededRandom } from '../core/SeededRandom.js?v=20260119';

// Debug: Log ore regrow rate on load
console.log('[ResourceSystem] ORE_REGROW_RATE:', CONFIG.ORE_REGROW_RATE);

export class ResourceSystem {
    constructor() {
        this.scene = null;
        this.enhancedOre = null;
        // Shared glow layers (performance optimization - one layer instead of per-entity)
        this.oreGlowLayer = null;
        this.crystalGlowLayer = null;
    }

    init(scene) {
        this.scene = scene;

        // Create shared HighlightLayers (MUCH more performant than per-entity layers)
        this.oreGlowLayer = new BABYLON.HighlightLayer('oreGlowShared', scene);
        this.oreGlowLayer.blurHorizontalSize = 0.5;
        this.oreGlowLayer.blurVerticalSize = 0.5;

        this.crystalGlowLayer = new BABYLON.HighlightLayer('crystalGlowShared', scene);
        this.crystalGlowLayer.blurHorizontalSize = 0.7;
        this.crystalGlowLayer.blurVerticalSize = 0.7;

        // Initialize enhanced ore visuals if available
        if (window.VoidOreEnhanced) {
            window.VoidOreEnhanced.init(scene);
            this.enhancedOre = window.VoidOreEnhanced;
            console.log('ResourceSystem: Enhanced ore visuals enabled');
        }
    }

    // ===== Ore Node Management =====

    createOreNode(x, z, amount) {
        const ore = {
            x, z,
            amount: amount,
            maxAmount: amount,
            originalAmount: amount,
            size: 4 + (amount / CONFIG.ORE_AMOUNT_MAX) * 4,
            depleted: false,
            regrowTimer: 0,
            mesh: null,
            glow: null,
            isCrystal: false,
            enhancedMats: null
        };

        // Create parent transform node for positioning
        const parentNode = new BABYLON.TransformNode('ore_' + gameState.oreNodes.length, this.scene);
        parentNode.position = new BABYLON.Vector3(x, 0, z);

        // Try to use enhanced visuals, fall back to simple if not available
        if (this.enhancedOre) {
            const result = this.enhancedOre.createOreDeposit(parentNode, ore.size, amount, ore.maxAmount);
            ore.mesh = parentNode;
            ore.enhancedMats = result.mats;

            // Add to shared glow layer (NOT creating new layer per ore)
            parentNode.getChildMeshes().forEach(m => {
                if (m.name.includes('mainRock') || m.name.includes('oreVein')) {
                    this.oreGlowLayer.addMesh(m, new BABYLON.Color3(1, 0.4, 0.1));
                }
            });
            ore.glow = this.oreGlowLayer; // Reference to shared layer
        } else {
            // Fallback: simple icosphere
            const oreMat = new BABYLON.StandardMaterial('oreMat_' + gameState.oreNodes.length, this.scene);
            oreMat.diffuseColor = new BABYLON.Color3(0.8, 0.5, 0.2);
            oreMat.emissiveColor = new BABYLON.Color3(0.3, 0.15, 0.05);
            oreMat.specularColor = new BABYLON.Color3(0.5, 0.3, 0.1);

            const oreMesh = BABYLON.MeshBuilder.CreateIcoSphere('oreSimple_' + gameState.oreNodes.length, {
                radius: ore.size,
                subdivisions: 1
            }, this.scene);
            oreMesh.parent = parentNode;
            oreMesh.material = oreMat;
            ore.mesh = parentNode;

            // Add to shared glow layer
            this.oreGlowLayer.addMesh(oreMesh, new BABYLON.Color3(1, 0.5, 0));
            ore.glow = this.oreGlowLayer;
        }

        gameState.oreNodes.push(ore);
        return ore;
    }

    createCrystalNode(x, z, amount) {
        const crystal = {
            x, z,
            amount: amount,
            maxAmount: amount,
            size: 5 + (amount / CONFIG.CRYSTAL_AMOUNT_MAX) * 3,
            depleted: false,
            regrowTimer: 0,
            mesh: null,
            glow: null,
            isCrystal: true,
            enhancedMats: null
        };

        // Create parent transform node for positioning
        const parent = new BABYLON.TransformNode('crystal_' + gameState.crystalNodes.length, this.scene);
        parent.position = new BABYLON.Vector3(x, 0, z);

        // Try to use enhanced visuals, fall back to simple if not available
        if (this.enhancedOre) {
            const result = this.enhancedOre.createCrystalCluster(parent, crystal.size, amount, crystal.maxAmount);
            crystal.mesh = parent;
            crystal.enhancedMats = result.mats;

            // Add to shared glow layer (NOT creating new layer per crystal)
            parent.getChildMeshes().forEach(m => {
                if (m.name.includes('crystal') || m.name.includes('shard')) {
                    this.crystalGlowLayer.addMesh(m, new BABYLON.Color3(0.8, 0.3, 1));
                }
            });
            crystal.glow = this.crystalGlowLayer; // Reference to shared layer
        } else {
            // Fallback: simple crystal spikes
            const crystalMat = new BABYLON.StandardMaterial('crystalMat_' + gameState.crystalNodes.length, this.scene);
            crystalMat.diffuseColor = new BABYLON.Color3(0.8, 0.2, 1.0);
            crystalMat.emissiveColor = new BABYLON.Color3(0.5, 0.1, 0.8);
            crystalMat.specularColor = new BABYLON.Color3(1, 0.5, 1);
            crystalMat.alpha = 0.9;

            for (let i = 0; i < 5; i++) {
                const spike = BABYLON.MeshBuilder.CreateCylinder('spike_' + i, {
                    height: crystal.size * (0.8 + Math.random() * 0.6),
                    diameterTop: 0,
                    diameterBottom: crystal.size * 0.4,
                    tessellation: 6
                }, this.scene);
                spike.position.x = (Math.random() - 0.5) * crystal.size;
                spike.position.z = (Math.random() - 0.5) * crystal.size;
                spike.rotation.x = (Math.random() - 0.5) * 0.3;
                spike.rotation.z = (Math.random() - 0.5) * 0.3;
                spike.material = crystalMat;
                spike.parent = parent;
            }

            crystal.mesh = parent;

            // Add to shared glow layer
            parent.getChildMeshes().forEach(m => this.crystalGlowLayer.addMesh(m, new BABYLON.Color3(1, 0, 1)));
            crystal.glow = this.crystalGlowLayer;
        }

        gameState.crystalNodes.push(crystal);
        return crystal;
    }

    // ===== Field Generation =====

    generateOreFields() {
        const rng = getSeededRandom();
        const usedPositions = [];
        // Scale max distance with map size
        const maxDist = CONFIG.MAP_SIZE * 0.3;

        for (let f = 0; f < CONFIG.ORE_FIELDS; f++) {
            // Find a valid position not in asteroid belt or too close to others
            let fieldX, fieldZ;
            let attempts = 0;
            do {
                const angle = rng.angle();
                const dist = 100 + rng.next() * maxDist;
                fieldX = Math.cos(angle) * dist;
                fieldZ = Math.sin(angle) * dist;
                attempts++;
            } while (attempts < 50 && (
                this.isInAsteroidBelt(fieldX, fieldZ) ||
                usedPositions.some(p => Math.hypot(p.x - fieldX, p.z - fieldZ) < 80)
            ));

            usedPositions.push({ x: fieldX, z: fieldZ });

            // Create ore nodes in this field
            const nodesInField = rng.int(CONFIG.ORE_PER_FIELD_MIN, CONFIG.ORE_PER_FIELD_MAX);

            for (let n = 0; n < nodesInField; n++) {
                const offsetAngle = rng.angle();
                const offsetDist = rng.next() * 30;
                const x = fieldX + Math.cos(offsetAngle) * offsetDist;
                const z = fieldZ + Math.sin(offsetAngle) * offsetDist;
                const amount = rng.range(CONFIG.ORE_AMOUNT_MIN, CONFIG.ORE_AMOUNT_MAX);

                this.createOreNode(x, z, amount);
            }
        }
    }

    generateCrystalFields() {
        const rng = getSeededRandom();
        // Scale crystal distance with map size
        const baseDist = CONFIG.MAP_SIZE * 0.2;
        const distVariance = CONFIG.MAP_SIZE * 0.1;

        for (let f = 0; f < CONFIG.CRYSTAL_FIELDS; f++) {
            // Place crystals in harder to reach areas
            const angle = rng.angle();
            const dist = baseDist + rng.next() * distVariance;
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;

            if (!this.isInAsteroidBelt(x, z)) {
                const amount = rng.range(CONFIG.CRYSTAL_AMOUNT_MIN, CONFIG.CRYSTAL_AMOUNT_MAX);
                this.createCrystalNode(x, z, amount);
            }
        }
    }

    generateStartingOreForBase(baseX, baseZ, baseAngle) {
        const rng = getSeededRandom();
        // Put some starting ore near each base
        for (let i = 0; i < 3; i++) {
            const oreAngle = baseAngle + rng.range(-0.25, 0.25);
            const oreDist = rng.range(50, 80);
            this.createOreNode(
                baseX + Math.cos(oreAngle) * oreDist,
                baseZ + Math.sin(oreAngle) * oreDist,
                rng.range(2000, 3000)
            );
        }
    }

    isInAsteroidBelt(x, z) {
        const dist = Math.hypot(x, z);
        return dist > CONFIG.ASTEROID_BELT_INNER - 30 && dist < CONFIG.ASTEROID_BELT_OUTER + 30;
    }

    // ===== Regrowth System (C&C Style) =====

    update(dt) {
        this.updateOreRegrowth(dt);
        this.updateCrystalRegrowth(dt);
    }

    updateOreRegrowth(dt) {
        for (const ore of gameState.oreNodes) {
            if (ore.depleted) {
                ore.regrowTimer -= dt;
                if (ore.regrowTimer <= 0) {
                    // Start regrowing
                    ore.amount += CONFIG.ORE_REGROW_RATE * dt;

                    if (ore.amount >= ore.maxAmount * 0.3) {
                        // Ore visible again
                        ore.depleted = false;
                        if (ore.mesh) {
                            ore.mesh.setEnabled(true);
                            ore.mesh.scaling.setAll(0.3);
                        }

                        eventBus.emit(GameEvents.RESOURCE_REGROWN, {
                            node: ore,
                            type: 'ore'
                        });
                    }
                }
            } else if (ore.amount < ore.maxAmount) {
                // Slowly regrow
                ore.amount = Math.min(ore.maxAmount, ore.amount + CONFIG.ORE_REGROW_RATE * dt * 0.5);

                // Update visual scale
                if (ore.mesh) {
                    const scale = 0.3 + 0.7 * (ore.amount / ore.maxAmount);
                    ore.mesh.scaling.setAll(scale);

                    // Update enhanced visual if available
                    if (this.enhancedOre && ore.enhancedMats) {
                        this.enhancedOre.updateOreVisual(ore, ore.amount, ore.maxAmount);
                    }
                }
            }

            // Spread chance - time-based (per second), disabled when regrow is 0
            if (CONFIG.ORE_REGROW_RATE > 0 && !ore.depleted && ore.amount > ore.maxAmount * 0.8
                && Math.random() < CONFIG.ORE_SPREAD_CHANCE * dt) {
                this.trySpreadOre(ore);
            }
        }
    }

    trySpreadOre(ore) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 15 + Math.random() * 10;
        const newX = ore.x + Math.cos(angle) * dist;
        const newZ = ore.z + Math.sin(angle) * dist;

        // Check if not too close to existing ore
        const tooClose = gameState.oreNodes.some(o =>
            Math.hypot(o.x - newX, o.z - newZ) < 12
        );

        // Cap ore nodes at ~15 per original field to prevent infinite growth
        const maxOreNodes = CONFIG.ORE_FIELDS * 15;
        if (!tooClose && !this.isInAsteroidBelt(newX, newZ) && gameState.oreNodes.length < maxOreNodes) {
            this.createOreNode(newX, newZ, CONFIG.ORE_AMOUNT_MIN);
        }
    }

    updateCrystalRegrowth(dt) {
        for (const crystal of gameState.crystalNodes) {
            if (crystal.depleted) {
                crystal.regrowTimer -= dt;
                if (crystal.regrowTimer <= 0) {
                    crystal.amount += CONFIG.CRYSTAL_REGROW_RATE * dt;

                    if (crystal.amount >= crystal.maxAmount * 0.3) {
                        crystal.depleted = false;
                        if (crystal.mesh) {
                            crystal.mesh.setEnabled(true);
                        }

                        eventBus.emit(GameEvents.RESOURCE_REGROWN, {
                            node: crystal,
                            type: 'crystal'
                        });
                    }
                }
            } else if (crystal.amount < crystal.maxAmount) {
                crystal.amount = Math.min(crystal.maxAmount, crystal.amount + CONFIG.CRYSTAL_REGROW_RATE * dt * 0.3);

                // Update visual scale
                if (crystal.mesh) {
                    const scale = 0.3 + 0.7 * (crystal.amount / crystal.maxAmount);
                    crystal.mesh.scaling.setAll(scale);

                    // Update enhanced visual if available
                    if (this.enhancedOre && crystal.enhancedMats) {
                        this.enhancedOre.updateCrystalVisual(crystal, crystal.amount, crystal.maxAmount);
                    }
                }
            }
        }
    }

    dispose() {
        // Clean up all ore nodes (meshes only, not glow - that's shared)
        for (const ore of gameState.oreNodes) {
            if (ore.mesh) ore.mesh.dispose();
        }
        for (const crystal of gameState.crystalNodes) {
            if (crystal.mesh) crystal.mesh.dispose();
        }

        // Dispose shared glow layers once
        if (this.oreGlowLayer) {
            this.oreGlowLayer.dispose();
            this.oreGlowLayer = null;
        }
        if (this.crystalGlowLayer) {
            this.crystalGlowLayer.dispose();
            this.crystalGlowLayer = null;
        }
    }
}

export const resourceSystem = new ResourceSystem();

export default ResourceSystem;
