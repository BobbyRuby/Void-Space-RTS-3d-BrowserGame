// ============================================================
// VOID SUPREMACY 3D - Scene Manager
// Handles Babylon.js scene setup, camera, and world rendering
// Optimized with thin instances for starfield (2000 -> 1 draw call)
// ============================================================

import { CONFIG, graphicsLevel } from '../core/Config.js?v=20260119';
import { eventBus, GameEvents } from '../core/EventBus.js?v=20260119';
import { MaterialPool } from '../core/MaterialPool.js?v=20260119';
import { graphicsManager } from './GraphicsManager.js?v=20260119';
import { LODManager } from './LODManager.js?v=20260119';

export class SceneManager {
    constructor() {
        this.canvas = null;
        this.engine = null;
        this.scene = null;
        this.camera = null;
        this.light = null;
        this.hemisphericLight = null;
        this.asteroids = [];
        this.enhancedOre = null;

        // Thin instance master meshes (for optimization)
        this.starfieldMasterMesh = null;
        this.asteroidMasterMesh = null;
        this.asteroidMatrices = null;  // Float32Array for thin instance transforms
        this.asteroidData = [];        // Orbital/rotation data for each asteroid
    }

    init(canvasElement) {
        this.canvas = canvasElement;

        // Create Babylon engine
        this.engine = new BABYLON.Engine(this.canvas, true, {
            preserveDrawingBuffer: true,
            stencil: true
        });

        // Create scene
        this.scene = new BABYLON.Scene(this.engine);
        this.scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.05, 1);

        // Setup camera
        this.setupCamera();

        // Setup lighting
        this.setupLighting();

        // Initialize MaterialPool for shared materials
        MaterialPool.init(this.scene);

        // Initialize graphics manager for post-processing effects
        graphicsManager.init(this.scene, this.engine, this.camera, this.light);

        // Initialize LOD manager for distance-based detail switching
        LODManager.init(this.scene, this.camera);

        // Initialize enhanced visuals if available
        if (window.VoidOreEnhanced) {
            window.VoidOreEnhanced.init(this.scene);
            this.enhancedOre = window.VoidOreEnhanced;
            console.log('SceneManager: Enhanced ore/asteroid visuals enabled');
        }

        // Create world elements
        this.createStarfield();
        this.createAsteroidBelt();

        // Handle window resize
        window.addEventListener('resize', () => {
            this.engine.resize();
        });

        return this.scene;
    }

    setupCamera() {
        // Arc rotate camera for RTS-style view
        this.camera = new BABYLON.ArcRotateCamera(
            'camera',
            -Math.PI / 2,  // Alpha (horizontal rotation)
            Math.PI / 4,   // Beta (vertical angle)
            200,           // Radius (zoom distance)
            new BABYLON.Vector3(0, 0, 0), // Target
            this.scene
        );

        // Camera limits
        this.camera.lowerBetaLimit = 0.1;
        this.camera.upperBetaLimit = Math.PI / 2.5;
        this.camera.lowerRadiusLimit = 50;
        this.camera.upperRadiusLimit = 500;

        // Disable default mouse camera controls - mouse is for unit selection only
        // Camera movement is handled via WASD (camera-relative) and arrow keys
        this.camera.attachControl(this.canvas, true);
        this.camera.inputs.removeByType('ArcRotateCameraPointersInput');
        this.camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');

        // Disable mouse wheel zoom - zoom controlled via other means
        this.camera.inputs.removeByType('ArcRotateCameraMouseWheelInput');

        // Set initial position
        this.camera.target = new BABYLON.Vector3(0, 0, 0);
    }

    setupLighting() {
        // Main directional light (like sun)
        this.light = new BABYLON.DirectionalLight(
            'mainLight',
            new BABYLON.Vector3(-1, -2, -1),
            this.scene
        );
        this.light.intensity = 0.8;

        // Ambient lighting
        this.hemisphericLight = new BABYLON.HemisphericLight(
            'ambientLight',
            new BABYLON.Vector3(0, 1, 0),
            this.scene
        );
        this.hemisphericLight.intensity = 0.4;
        this.hemisphericLight.groundColor = new BABYLON.Color3(0.1, 0.1, 0.2);
    }

    /**
     * Create starfield using thin instances for massive performance improvement
     * Old: 2000 meshes, 2000 materials, 2000 draw calls
     * New: 1 mesh, 1 material, 1 draw call with thin instances
     */
    createStarfield() {
        const starCount = 2000;

        // Create ONE master star mesh
        const masterStar = BABYLON.MeshBuilder.CreateSphere('starMaster', {
            diameter: 1,
            segments: 4  // Low poly for performance
        }, this.scene);

        // Use a simple emissive material with vertex colors for variety
        const starMat = new BABYLON.StandardMaterial('starMat', this.scene);
        starMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
        starMat.disableLighting = true;
        starMat.freeze();  // Optimize: prevent material changes
        masterStar.material = starMat;
        masterStar.isPickable = false;

        // Create transformation matrices for all stars
        // Each matrix is 16 floats (4x4 transformation matrix)
        const matrices = new Float32Array(starCount * 16);

        // Optional: Create color buffer for per-instance colors
        // Each instance has 4 floats (RGBA)
        const colors = new Float32Array(starCount * 4);

        for (let i = 0; i < starCount; i++) {
            // Random position on a large sphere
            const radius = 800 + Math.random() * 200;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);

            // Random scale for variety (0.5 - 2.0)
            const scale = 0.5 + Math.random() * 1.5;

            // Create transformation matrix
            const matrix = BABYLON.Matrix.Compose(
                new BABYLON.Vector3(scale, scale, scale),  // Scale
                BABYLON.Quaternion.Identity(),              // Rotation
                new BABYLON.Vector3(x, y, z)                // Position
            );

            // Copy matrix to buffer
            matrix.copyToArray(matrices, i * 16);

            // Set color based on star type
            const brightness = 0.5 + Math.random() * 0.5;
            const colorChoice = Math.random();
            let r, g, b;

            if (colorChoice < 0.7) {
                // White stars (most common)
                r = brightness;
                g = brightness;
                b = brightness;
            } else if (colorChoice < 0.85) {
                // Warm stars (orange-ish)
                r = brightness;
                g = brightness * 0.8;
                b = brightness * 0.6;
            } else {
                // Cool stars (blue-ish)
                r = brightness * 0.7;
                g = brightness * 0.8;
                b = brightness;
            }

            colors[i * 4] = r;
            colors[i * 4 + 1] = g;
            colors[i * 4 + 2] = b;
            colors[i * 4 + 3] = 1.0;
        }

        // Set the thin instance buffers
        masterStar.thinInstanceSetBuffer('matrix', matrices, 16);
        masterStar.thinInstanceSetBuffer('color', colors, 4);

        // Store reference for disposal
        this.starfieldMasterMesh = masterStar;

        console.log(`SceneManager: Created starfield with ${starCount} thin instances (1 draw call)`);
    }

    /**
     * Create asteroid belt using thin instances for performance
     * Old: 200 meshes = 200 draw calls
     * New: 1 mesh with thin instances = 1 draw call
     */
    createAsteroidBelt() {
        const asteroidCount = CONFIG.NUM_ASTEROIDS || 200;

        // Check if enhanced asteroids are available (they can't use thin instances)
        if (this.enhancedOre) {
            // Use enhanced asteroids (individual meshes - more detailed)
            this.createEnhancedAsteroids();
            return;
        }

        // Create ONE master asteroid mesh with thin instances
        const masterAsteroid = BABYLON.MeshBuilder.CreateIcoSphere('asteroidMaster', {
            radius: 1,  // Unit size, scale via matrix
            subdivisions: 1
        }, this.scene);

        // Create optimized material
        const asteroidMat = new BABYLON.StandardMaterial('asteroidMat', this.scene);
        asteroidMat.diffuseColor = new BABYLON.Color3(0.3, 0.25, 0.2);
        asteroidMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        asteroidMat.freeze();  // Optimize: prevent material changes
        masterAsteroid.material = asteroidMat;
        masterAsteroid.isPickable = false;

        // Create transformation matrices for all asteroids
        this.asteroidMatrices = new Float32Array(asteroidCount * 16);
        this.asteroidData = [];

        for (let i = 0; i < asteroidCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = CONFIG.ASTEROID_BELT_INNER +
                Math.random() * (CONFIG.ASTEROID_BELT_OUTER - CONFIG.ASTEROID_BELT_INNER);

            const size = 2 + Math.random() * 6;

            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const y = (Math.random() - 0.5) * 40;

            const rotX = Math.random() * Math.PI;
            const rotY = Math.random() * Math.PI;
            const rotZ = Math.random() * Math.PI;

            // Store asteroid data for animation
            this.asteroidData.push({
                angle: angle,
                radius: radius,
                y: y,
                size: size,
                rotX: rotX,
                rotY: rotY,
                rotZ: rotZ,
                rotSpeedX: (Math.random() - 0.5) * 0.01,
                rotSpeedY: (Math.random() - 0.5) * 0.01,
                rotSpeedZ: (Math.random() - 0.5) * 0.01,
                orbitSpeed: (Math.random() - 0.5) * 0.0001
            });

            // Create initial transformation matrix
            const quaternion = BABYLON.Quaternion.FromEulerAngles(rotX, rotY, rotZ);
            const matrix = BABYLON.Matrix.Compose(
                new BABYLON.Vector3(size, size, size),  // Scale
                quaternion,                              // Rotation
                new BABYLON.Vector3(x, y, z)             // Position
            );

            // Copy matrix to buffer
            matrix.copyToArray(this.asteroidMatrices, i * 16);
        }

        // Set the thin instance buffer
        masterAsteroid.thinInstanceSetBuffer('matrix', this.asteroidMatrices, 16);

        // Store reference
        this.asteroidMasterMesh = masterAsteroid;

        console.log(`SceneManager: Created asteroid belt with ${asteroidCount} thin instances (1 draw call)`);
    }

    /**
     * Create enhanced asteroids (individual meshes for detailed visuals)
     * Used when VoidOreEnhanced is available
     */
    createEnhancedAsteroids() {
        const asteroidCount = CONFIG.NUM_ASTEROIDS || 200;

        for (let i = 0; i < asteroidCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = CONFIG.ASTEROID_BELT_INNER +
                Math.random() * (CONFIG.ASTEROID_BELT_OUTER - CONFIG.ASTEROID_BELT_INNER);

            const size = 2 + Math.random() * 6;

            const asteroidMesh = this.enhancedOre.createAsteroid(size, i);
            asteroidMesh.position.x = Math.cos(angle) * radius;
            asteroidMesh.position.z = Math.sin(angle) * radius;
            asteroidMesh.position.y = (Math.random() - 0.5) * 40;

            asteroidMesh.rotation = new BABYLON.Vector3(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );

            // Mark child meshes as not pickable
            asteroidMesh.getChildMeshes().forEach(m => m.isPickable = false);

            this.asteroids.push({
                mesh: asteroidMesh,
                size: size,
                rotSpeed: new BABYLON.Vector3(
                    (Math.random() - 0.5) * 0.01,
                    (Math.random() - 0.5) * 0.01,
                    (Math.random() - 0.5) * 0.01
                ),
                orbitSpeed: (Math.random() - 0.5) * 0.0001
            });
        }
    }

    updateAsteroids(dt) {
        // Update thin instance asteroids (if using them)
        if (this.asteroidMasterMesh && this.asteroidData.length > 0) {
            let needsUpdate = false;

            for (let i = 0; i < this.asteroidData.length; i++) {
                const data = this.asteroidData[i];

                // Update rotation
                data.rotX += data.rotSpeedX;
                data.rotY += data.rotSpeedY;
                data.rotZ += data.rotSpeedZ;

                // Update orbital position
                data.angle += data.orbitSpeed;

                const x = Math.cos(data.angle) * data.radius;
                const z = Math.sin(data.angle) * data.radius;

                // Create updated transformation matrix
                const quaternion = BABYLON.Quaternion.FromEulerAngles(data.rotX, data.rotY, data.rotZ);
                const matrix = BABYLON.Matrix.Compose(
                    new BABYLON.Vector3(data.size, data.size, data.size),
                    quaternion,
                    new BABYLON.Vector3(x, data.y, z)
                );

                // Copy to buffer
                matrix.copyToArray(this.asteroidMatrices, i * 16);
                needsUpdate = true;
            }

            // Update the thin instance buffer
            if (needsUpdate) {
                this.asteroidMasterMesh.thinInstanceSetBuffer('matrix', this.asteroidMatrices, 16);
            }
            return;
        }

        // Update enhanced asteroids (individual meshes)
        for (const asteroid of this.asteroids) {
            // Rotation
            asteroid.mesh.rotation.x += asteroid.rotSpeed.x;
            asteroid.mesh.rotation.y += asteroid.rotSpeed.y;
            asteroid.mesh.rotation.z += asteroid.rotSpeed.z;

            // Orbital movement (very slow)
            const currentAngle = Math.atan2(asteroid.mesh.position.z, asteroid.mesh.position.x);
            const radius = Math.hypot(asteroid.mesh.position.x, asteroid.mesh.position.z);
            const newAngle = currentAngle + asteroid.orbitSpeed;

            asteroid.mesh.position.x = Math.cos(newAngle) * radius;
            asteroid.mesh.position.z = Math.sin(newAngle) * radius;
        }
    }

    // ===== Camera Controls =====

    moveCameraTo(x, z) {
        this.camera.target.x = x;
        this.camera.target.z = z;

        eventBus.emit(GameEvents.CAMERA_MOVE, {
            x, z
        });
    }

    panCamera(dx, dz) {
        this.camera.target.x += dx;
        this.camera.target.z += dz;

        // Clamp to map bounds
        const halfMap = CONFIG.MAP_SIZE / 2;
        this.camera.target.x = Math.max(-halfMap, Math.min(halfMap, this.camera.target.x));
        this.camera.target.z = Math.max(-halfMap, Math.min(halfMap, this.camera.target.z));
    }

    panCameraRelative(forward, right) {
        // Get camera's horizontal direction (alpha is rotation around Y axis)
        const alpha = this.camera.alpha;

        // Forward direction (screen up - perpendicular to viewing direction)
        const forwardX = Math.cos(alpha);
        const forwardZ = -Math.sin(alpha);

        // Right direction (screen right - same as old forward)
        const rightX = -Math.sin(alpha);
        const rightZ = -Math.cos(alpha);

        // Calculate world-space movement
        const dx = forward * forwardX + right * rightX;
        const dz = forward * forwardZ + right * rightZ;

        this.panCamera(dx, dz);
    }

    rotateCamera(deltaAlpha) {
        this.camera.alpha += deltaAlpha;
    }

    zoomCamera(delta) {
        this.camera.radius += delta;

        eventBus.emit(GameEvents.CAMERA_ZOOM, {
            radius: this.camera.radius
        });
    }

    getCameraPosition() {
        return {
            x: this.camera.target.x,
            z: this.camera.target.z,
            radius: this.camera.radius
        };
    }

    // ===== Picking (Raycasting) =====

    pickEntity(pointerX, pointerY, entities) {
        const pickResult = this.scene.pick(pointerX, pointerY);

        if (pickResult.hit && pickResult.pickedMesh) {
            // Find entity that owns this mesh
            for (const entity of entities) {
                if (entity.dead) continue;

                // Check if picked mesh belongs to this entity
                if (this.meshBelongsToEntity(pickResult.pickedMesh, entity)) {
                    return entity;
                }
            }
        }

        return null;
    }

    meshBelongsToEntity(mesh, entity) {
        if (!entity.mesh) return false;

        // Check if it's the entity's root mesh
        if (mesh === entity.mesh) return true;

        // Check if it's a child mesh
        let parent = mesh.parent;
        while (parent) {
            if (parent === entity.mesh) return true;
            parent = parent.parent;
        }

        return false;
    }

    getWorldPosition(pointerX, pointerY) {
        // Pick a point on the ground plane (y = 0)
        const ray = this.scene.createPickingRay(pointerX, pointerY, BABYLON.Matrix.Identity(), this.camera);
        const groundPlane = BABYLON.Plane.FromPositionAndNormal(BABYLON.Vector3.Zero(), BABYLON.Vector3.Up());

        const distance = ray.intersectsPlane(groundPlane);
        if (distance !== null) {
            const worldPos = ray.origin.add(ray.direction.scale(distance));
            return { x: worldPos.x, z: worldPos.z };
        }

        return null;
    }

    // ===== Render Loop =====

    startRenderLoop(updateCallback) {
        this.engine.runRenderLoop(() => {
            const dt = this.engine.getDeltaTime() / 1000;

            // Update asteroids
            this.updateAsteroids(dt);

            // Update LOD manager (distance-based detail switching)
            LODManager.update();

            // Update animated engine glow shaders
            MaterialPool.updateEngineGlow(dt, this.camera.position);

            // Call game update
            if (updateCallback) {
                updateCallback(dt);
            }

            // Render
            this.scene.render();
        });
    }

    stopRenderLoop() {
        this.engine.stopRenderLoop();
    }

    dispose() {
        this.stopRenderLoop();

        // Dispose starfield thin instances
        if (this.starfieldMasterMesh) {
            this.starfieldMasterMesh.dispose();
            this.starfieldMasterMesh = null;
        }

        // Dispose asteroid thin instances
        if (this.asteroidMasterMesh) {
            this.asteroidMasterMesh.dispose();
            this.asteroidMasterMesh = null;
            this.asteroidMatrices = null;
            this.asteroidData = [];
        }

        // Dispose LOD manager
        LODManager.dispose();

        // Dispose graphics manager (post-processing)
        graphicsManager.dispose();

        // Dispose material pool
        MaterialPool.dispose();

        this.scene.dispose();
        this.engine.dispose();
    }
}

export const sceneManager = new SceneManager();

export default SceneManager;
