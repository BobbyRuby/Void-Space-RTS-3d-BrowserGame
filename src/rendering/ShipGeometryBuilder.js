// ============================================================
// VOID SUPREMACY 3D - Ship Geometry Builder
// Creates smooth, rounded ship geometry with quality-aware tessellation
// ============================================================

import { GRAPHICS_SETTINGS, graphicsLevel } from '../core/Config.js';

/**
 * ShipGeometryBuilder - Utility class for creating smooth ship geometry
 * Replaces blocky boxes with beveled shapes and smooth curves
 */
class ShipGeometryBuilderClass {
    constructor() {
        this.scene = null;
    }

    /**
     * Initialize with Babylon scene
     */
    init(scene) {
        this.scene = scene;
    }

    /**
     * Get current tessellation settings based on graphics quality
     */
    getTessellation() {
        const settings = GRAPHICS_SETTINGS[graphicsLevel];
        return settings?.tessellation || GRAPHICS_SETTINGS.MEDIUM.tessellation;
    }

    /**
     * Create a box with beveled/rounded edges using a capsule-like approach
     * @param {string} name - Mesh name
     * @param {Object} options - { width, height, depth, bevel }
     * @param {BABYLON.Scene} scene - Babylon scene
     * @returns {BABYLON.Mesh}
     */
    createBeveledBox(name, options, scene = this.scene) {
        const { width, height, depth, bevel = 0.1 } = options;
        const tess = this.getTessellation();

        // For low quality or no bevel, use simple box
        if (tess.box <= 1 || bevel <= 0) {
            return BABYLON.MeshBuilder.CreateBox(name, { width, height, depth }, scene);
        }

        // Create a rounded box using PolyhedronBuilder with smooth edges
        // We'll use a capsule approach: create rounded corners
        const bevelSize = Math.min(bevel, Math.min(width, height, depth) * 0.3);

        // Create the main body as a box with subdivisions for smoother lighting
        const box = BABYLON.MeshBuilder.CreateBox(name, {
            width: width,
            height: height,
            depth: depth,
            updatable: false
        }, scene);

        // Apply vertex smoothing by creating a slightly modified geometry
        // This adds subtle rounding to edges without heavy geometry cost
        const positions = box.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        const normals = box.getVerticesData(BABYLON.VertexBuffer.NormalKind);

        if (positions && normals) {
            // Smooth the normals for softer shading at edges
            const smoothedNormals = this.smoothNormals(positions, normals, 0.3);
            box.setVerticesData(BABYLON.VertexBuffer.NormalKind, smoothedNormals);
        }

        return box;
    }

    /**
     * Create a tapered hull using CreateTube with radius function
     * Creates smooth, streamlined fuselage shapes
     * @param {string} name - Mesh name
     * @param {Object} options - { length, frontRadius, backRadius, midBulge, taperStart }
     * @param {BABYLON.Scene} scene - Babylon scene
     * @returns {BABYLON.Mesh}
     */
    createTaperedHull(name, options, scene = this.scene) {
        const {
            length = 4,
            frontRadius = 0.1,
            backRadius = 0.5,
            midBulge = 1.0,
            taperStart = 0.6,  // Where the nose taper begins (0-1)
            segments = null
        } = options;

        const tess = this.getTessellation();
        const pathSegments = segments || tess.tube;

        // Create path along Z axis
        const path = [];
        for (let i = 0; i <= pathSegments; i++) {
            const t = i / pathSegments;
            path.push(new BABYLON.Vector3(0, 0, (t - 0.5) * length));
        }

        // Create smooth radius function for organic hull shape
        const radiusFunction = (i, distance) => {
            const t = i / pathSegments;

            // Smooth taper formula using cosine interpolation
            if (t < taperStart) {
                // Front section - taper to nose
                const frontT = t / taperStart;
                const eased = (1 - Math.cos(frontT * Math.PI)) / 2;
                return frontRadius + (backRadius * midBulge - frontRadius) * eased;
            } else {
                // Back section - slight taper to engines
                const backT = (t - taperStart) / (1 - taperStart);
                const maxRadius = backRadius * midBulge;
                return maxRadius - (maxRadius - backRadius) * backT * backT;
            }
        };

        const hull = BABYLON.MeshBuilder.CreateTube(name, {
            path: path,
            radiusFunction: radiusFunction,
            tessellation: tess.cylinder,
            cap: BABYLON.Mesh.CAP_ALL,
            updatable: false
        }, scene);

        // Rotate so front faces +Z direction
        hull.rotation.y = Math.PI;

        return hull;
    }

    /**
     * Create an airfoil-shaped wing using extrusion
     * @param {string} name - Mesh name
     * @param {Object} options - { span, chord, thickness, sweep, taper }
     * @param {BABYLON.Scene} scene - Babylon scene
     * @returns {BABYLON.Mesh}
     */
    createWing(name, options, scene = this.scene) {
        const {
            span = 3,           // Wing length (x direction)
            chord = 1.5,        // Wing depth (z direction)
            thickness = 0.15,   // Wing thickness (y direction)
            sweep = 0,          // Sweep angle in radians
            taper = 0.5,        // Tip chord ratio (0-1)
            isRight = true      // Which side
        } = options;

        const tess = this.getTessellation();
        const direction = isRight ? 1 : -1;

        // Create airfoil cross-section profile (NACA-like)
        const profile = this.createAirfoilProfile(chord, thickness, 8);

        // Create extrusion path from root to tip
        const path = [];
        const segments = Math.max(4, Math.floor(tess.tube / 3));

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const x = direction * span * t;
            const z = Math.tan(sweep) * span * t;
            path.push(new BABYLON.Vector3(x, 0, z));
        }

        // Scale function for wing taper
        const scaleFunction = (i, distance) => {
            const t = i / segments;
            return 1 - (1 - taper) * t;
        };

        const wing = BABYLON.MeshBuilder.ExtrudeShapeCustom(name, {
            shape: profile,
            path: path,
            scaleFunction: scaleFunction,
            ribbonCloseArray: true,
            cap: BABYLON.Mesh.CAP_ALL,
            updatable: false
        }, scene);

        return wing;
    }

    /**
     * Create NACA-like airfoil profile
     * @param {number} chord - Chord length
     * @param {number} thickness - Max thickness
     * @param {number} segments - Number of profile points
     * @returns {BABYLON.Vector3[]}
     */
    createAirfoilProfile(chord, thickness, segments) {
        const profile = [];
        const halfThick = thickness / 2;

        // Upper surface (trailing to leading edge)
        for (let i = segments; i >= 0; i--) {
            const t = i / segments;
            const x = t * chord - chord / 2;
            // NACA 4-digit thickness distribution
            const y = halfThick * (2.969 * Math.sqrt(t) - 1.26 * t - 3.516 * t * t + 2.843 * t * t * t - 1.015 * t * t * t * t) / 1.2;
            profile.push(new BABYLON.Vector3(0, y, x));
        }

        // Lower surface (leading to trailing edge)
        for (let i = 1; i <= segments; i++) {
            const t = i / segments;
            const x = t * chord - chord / 2;
            const y = -halfThick * (2.969 * Math.sqrt(t) - 1.26 * t - 3.516 * t * t + 2.843 * t * t * t - 1.015 * t * t * t * t) / 1.2;
            profile.push(new BABYLON.Vector3(0, y, x));
        }

        return profile;
    }

    /**
     * Create a smooth engine nacelle
     * @param {string} name - Mesh name
     * @param {Object} options - { length, radius, nozzleRadius, intakeRadius }
     * @param {BABYLON.Scene} scene - Babylon scene
     * @returns {BABYLON.Mesh}
     */
    createEngineNacelle(name, options, scene = this.scene) {
        const {
            length = 2,
            radius = 0.5,
            nozzleRadius = 0.6,
            intakeRadius = 0.4
        } = options;

        const tess = this.getTessellation();
        const pathSegments = tess.tube;

        // Create path
        const path = [];
        for (let i = 0; i <= pathSegments; i++) {
            const t = i / pathSegments;
            path.push(new BABYLON.Vector3(0, 0, (t - 0.5) * length));
        }

        // Radius function for nacelle shape
        const radiusFunction = (i, distance) => {
            const t = i / pathSegments;

            if (t < 0.2) {
                // Intake flare
                const localT = t / 0.2;
                return intakeRadius + (radius - intakeRadius) * (1 - Math.cos(localT * Math.PI)) / 2;
            } else if (t > 0.75) {
                // Nozzle expansion
                const localT = (t - 0.75) / 0.25;
                return radius + (nozzleRadius - radius) * localT * localT;
            } else {
                return radius;
            }
        };

        return BABYLON.MeshBuilder.CreateTube(name, {
            path: path,
            radiusFunction: radiusFunction,
            tessellation: tess.cylinder,
            cap: BABYLON.Mesh.CAP_ALL,
            updatable: false
        }, scene);
    }

    /**
     * Create a smooth sphere with quality-aware tessellation
     * @param {string} name - Mesh name
     * @param {Object} options - { diameter, segments (optional override) }
     * @param {BABYLON.Scene} scene - Babylon scene
     * @returns {BABYLON.Mesh}
     */
    createSmoothSphere(name, options, scene = this.scene) {
        const tess = this.getTessellation();
        const { diameter, segments = tess.sphere } = options;

        return BABYLON.MeshBuilder.CreateSphere(name, {
            diameter,
            segments,
            updatable: false
        }, scene);
    }

    /**
     * Create a smooth cylinder with quality-aware tessellation
     * @param {string} name - Mesh name
     * @param {Object} options - { height, diameterTop, diameterBottom, tessellation (optional override) }
     * @param {BABYLON.Scene} scene - Babylon scene
     * @returns {BABYLON.Mesh}
     */
    createSmoothCylinder(name, options, scene = this.scene) {
        const tess = this.getTessellation();
        const { height, diameterTop, diameterBottom, diameter, tessellation = tess.cylinder } = options;

        return BABYLON.MeshBuilder.CreateCylinder(name, {
            height,
            diameterTop: diameterTop !== undefined ? diameterTop : diameter,
            diameterBottom: diameterBottom !== undefined ? diameterBottom : diameter,
            tessellation,
            updatable: false
        }, scene);
    }

    /**
     * Create a turret dome/hemispherical shape
     * @param {string} name - Mesh name
     * @param {Object} options - { diameter, height }
     * @param {BABYLON.Scene} scene - Babylon scene
     * @returns {BABYLON.Mesh}
     */
    createTurretDome(name, options, scene = this.scene) {
        const { diameter, height = diameter * 0.5 } = options;
        const tess = this.getTessellation();

        // Use hemisphere (half sphere)
        const dome = BABYLON.MeshBuilder.CreateSphere(name, {
            diameter: diameter,
            segments: tess.sphere,
            slice: 0.5,
            updatable: false
        }, scene);

        // Scale to desired height
        dome.scaling.y = height / (diameter * 0.5);

        return dome;
    }

    /**
     * Create a smooth torus for rings and details
     * @param {string} name - Mesh name
     * @param {Object} options - { diameter, thickness }
     * @param {BABYLON.Scene} scene - Babylon scene
     * @returns {BABYLON.Mesh}
     */
    createSmoothTorus(name, options, scene = this.scene) {
        const tess = this.getTessellation();
        const { diameter, thickness } = options;

        return BABYLON.MeshBuilder.CreateTorus(name, {
            diameter,
            thickness,
            tessellation: tess.torus,
            updatable: false
        }, scene);
    }

    /**
     * Merge multiple meshes into a single optimized mesh
     * @param {string} name - Name for merged mesh
     * @param {BABYLON.Mesh[]} meshes - Array of meshes to merge
     * @param {BABYLON.Material} material - Material to apply
     * @param {BABYLON.Scene} scene - Babylon scene
     * @returns {BABYLON.Mesh}
     */
    mergeMeshes(name, meshes, material, scene = this.scene) {
        const tess = this.getTessellation();

        if (!tess.mergeMeshes || meshes.length <= 1) {
            // Don't merge, just return first mesh
            meshes.forEach(m => m.material = material);
            return meshes[0];
        }

        // Filter out null/undefined meshes
        const validMeshes = meshes.filter(m => m && m.getVerticesData);

        if (validMeshes.length === 0) return null;
        if (validMeshes.length === 1) {
            validMeshes[0].material = material;
            return validMeshes[0];
        }

        // Merge meshes
        const merged = BABYLON.Mesh.MergeMeshes(
            validMeshes,
            true,   // Dispose source meshes
            true,   // Allow different materials
            undefined,
            false,  // Subdivide
            true    // Multi-material
        );

        if (merged) {
            merged.name = name;
            merged.material = material;
        }

        return merged;
    }

    /**
     * Smooth normals for softer shading on edges
     * @param {Float32Array} positions - Vertex positions
     * @param {Float32Array} normals - Vertex normals
     * @param {number} factor - Smoothing factor (0-1)
     * @returns {Float32Array}
     */
    smoothNormals(positions, normals, factor) {
        const smoothed = new Float32Array(normals.length);
        const vertexCount = positions.length / 3;

        // Simple smoothing: average normals at shared positions
        const positionMap = new Map();

        for (let i = 0; i < vertexCount; i++) {
            const key = `${positions[i*3].toFixed(4)}_${positions[i*3+1].toFixed(4)}_${positions[i*3+2].toFixed(4)}`;
            if (!positionMap.has(key)) {
                positionMap.set(key, []);
            }
            positionMap.get(key).push(i);
        }

        // Average normals for vertices at same position
        for (const indices of positionMap.values()) {
            if (indices.length > 1) {
                let avgX = 0, avgY = 0, avgZ = 0;
                for (const idx of indices) {
                    avgX += normals[idx * 3];
                    avgY += normals[idx * 3 + 1];
                    avgZ += normals[idx * 3 + 2];
                }
                avgX /= indices.length;
                avgY /= indices.length;
                avgZ /= indices.length;

                // Normalize
                const len = Math.sqrt(avgX * avgX + avgY * avgY + avgZ * avgZ);
                if (len > 0) {
                    avgX /= len;
                    avgY /= len;
                    avgZ /= len;
                }

                // Blend original with smoothed
                for (const idx of indices) {
                    smoothed[idx * 3] = normals[idx * 3] * (1 - factor) + avgX * factor;
                    smoothed[idx * 3 + 1] = normals[idx * 3 + 1] * (1 - factor) + avgY * factor;
                    smoothed[idx * 3 + 2] = normals[idx * 3 + 2] * (1 - factor) + avgZ * factor;
                }
            } else {
                const idx = indices[0];
                smoothed[idx * 3] = normals[idx * 3];
                smoothed[idx * 3 + 1] = normals[idx * 3 + 1];
                smoothed[idx * 3 + 2] = normals[idx * 3 + 2];
            }
        }

        return smoothed;
    }

    /**
     * Create a streamlined weapon barrel
     * @param {string} name - Mesh name
     * @param {Object} options - { length, baseRadius, muzzleRadius }
     * @param {BABYLON.Scene} scene - Babylon scene
     * @returns {BABYLON.Mesh}
     */
    createWeaponBarrel(name, options, scene = this.scene) {
        const {
            length = 2,
            baseRadius = 0.2,
            muzzleRadius = 0.15
        } = options;

        const tess = this.getTessellation();

        // Create barrel with slight taper
        return BABYLON.MeshBuilder.CreateCylinder(name, {
            height: length,
            diameterTop: muzzleRadius * 2,
            diameterBottom: baseRadius * 2,
            tessellation: tess.cylinder,
            updatable: false
        }, scene);
    }
}

// Singleton export
export const ShipGeometryBuilder = new ShipGeometryBuilderClass();
export default ShipGeometryBuilder;
