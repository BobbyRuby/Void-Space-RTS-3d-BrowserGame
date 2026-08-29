// ============================================================
// VOID SUPREMACY 3D - Graphics Manager
// Handles post-processing effects, quality settings, and visual enhancements
// ============================================================

import { GRAPHICS_SETTINGS, graphicsLevel, setGraphicsLevel } from '../core/Config.js?v=20260119';
import { eventBus, GameEvents } from '../core/EventBus.js?v=20260119';

// Hull hit-flash tint (warm white), reused across all flashes to avoid per-hit allocation
const HIT_FLASH_COLOR = new BABYLON.Color3(1, 0.85, 0.8);
const HIT_FLASH_MS = 110;      // how long a flash lasts
const HIT_FLASH_ALPHA = 0.45;  // overlay strength

const MUZZLE_POOL_SIZE = 12;   // reused round-robin, bounds cost, no per-shot alloc
const MUZZLE_MS = 70;          // flash lifetime
const MUZZLE_COLOR = new BABYLON.Color3(1, 0.82, 0.45); // warm muzzle glow

/**
 * GraphicsManager - Manages post-processing and visual quality settings
 * Supports bloom, FXAA, SSAO, shadows, and motion blur
 */
class GraphicsManagerClass {
    constructor() {
        this.scene = null;
        this.engine = null;
        this.camera = null;
        this.mainLight = null;
        this.initialized = false;

        // Rendering pipelines
        this.defaultPipeline = null;
        this.ssaoPipeline = null;
        this.motionBlurEffect = null;
        this.shadowGenerator = null;

        // Current settings
        this.currentLevel = 'MEDIUM';

        this.unitTrails = new Map(); // entity -> TrailMesh, for engine-trail cleanup

        this.muzzlePool = [];        // reusable additive muzzle-flash planes
        this.muzzlePoolCursor = 0;
        this.muzzleMat = null;       // shared additive material for all muzzle flashes

        this.energyGlow = null; // selective GlowLayer for weapon/force-field energy
    }

    /**
     * Initialize the graphics manager
     * @param {BABYLON.Scene} scene - The Babylon scene
     * @param {BABYLON.Engine} engine - The Babylon engine
     * @param {BABYLON.Camera} camera - The main camera
     * @param {BABYLON.DirectionalLight} mainLight - The main directional light
     */
    init(scene, engine, camera, mainLight) {
        this.scene = scene;
        this.engine = engine;
        this.camera = camera;
        this.mainLight = mainLight;

        // Apply initial settings
        this.applySettings(graphicsLevel);
        this.initialized = true;

        // Hull hit-flash: flash any entity's mesh briefly when it takes damage
        eventBus.on(GameEvents.ENTITY_DAMAGED, (data) => this.flashEntity(data.entity));

        // Engine trails: attach a TrailMesh to each new unit (quality-gated), dispose on death
        eventBus.on(GameEvents.ENTITY_CREATED, (entity) => this.attachTrail(entity));
        eventBus.on(GameEvents.ENTITY_DESTROYED, (data) => this.detachTrail((data && data.entity) ? data.entity : data));

        // Muzzle flash: pop a brief additive glow sprite at the shooter on fire
        eventBus.on(GameEvents.COMBAT_PROJECTILE_FIRED, (data) => this.muzzleFlash(data));

        // Death FX burst: buildings do not self-explode on death (units already do
        // in Unit.die). Give a bigger burst on building death via the existing pathway.
        eventBus.on(GameEvents.BUILDING_DESTROYED, (data) => this.buildingDeathBurst(data && data.building));

        this.setupEnergyGlow();

        console.log(`GraphicsManager: Initialized with ${graphicsLevel} quality`);
    }

    /**
     * Apply graphics settings for a given quality level
     * @param {string} level - Quality level: 'LOW', 'MEDIUM', 'HIGH', 'ULTRA'
     */
    applySettings(level) {
        const settings = GRAPHICS_SETTINGS[level];
        if (!settings) {
            console.error(`GraphicsManager: Unknown quality level '${level}'`);
            return;
        }

        // Dispose existing effects first
        this.disposeEffects();

        // Update global setting
        setGraphicsLevel(level);
        this.currentLevel = level;

        // Setup post-processing pipeline
        if (settings.postProcessing) {
            this.setupDefaultPipeline(settings);
        }

        // Setup SSAO
        if (settings.ssao?.enabled) {
            this.setupSSAO(settings.ssao);
        }

        // Setup motion blur
        if (settings.motionBlur?.enabled) {
            this.setupMotionBlur(settings.motionBlur);
        }

        // Setup shadows
        if (settings.shadows?.enabled) {
            this.setupShadows(settings.shadows);
        }

        // Emit event for other systems (e.g., MaterialPool can switch to PBR)
        eventBus.emit(GameEvents.GRAPHICS_QUALITY_CHANGED, {
            level,
            settings
        });

        console.log(`GraphicsManager: Applied ${level} quality settings`);
    }

    /**
     * Setup the default rendering pipeline (bloom, FXAA, etc.)
     */
    setupDefaultPipeline(settings) {
        this.defaultPipeline = new BABYLON.DefaultRenderingPipeline(
            'defaultPipeline',
            true, // HDR
            this.scene,
            [this.camera]
        );

        // Bloom settings
        if (settings.bloom?.enabled) {
            this.defaultPipeline.bloomEnabled = true;
            this.defaultPipeline.bloomThreshold = settings.bloom.threshold;
            this.defaultPipeline.bloomWeight = settings.bloom.intensity;
            this.defaultPipeline.bloomKernel = settings.bloom.kernel || 32;
            this.defaultPipeline.bloomScale = 0.5;
        }

        // FXAA anti-aliasing
        if (settings.fxaa) {
            this.defaultPipeline.fxaaEnabled = true;
        }

        // Image processing (tone mapping, contrast, etc.)
        this.defaultPipeline.imageProcessingEnabled = true;
        this.defaultPipeline.imageProcessing.toneMappingEnabled = true;
        this.defaultPipeline.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
        this.defaultPipeline.imageProcessing.exposure = 1.0;
        this.defaultPipeline.imageProcessing.contrast = 1.1;

        // Chromatic aberration (subtle for space effect)
        if (settings.materials === 'pbr') {
            this.defaultPipeline.chromaticAberrationEnabled = true;
            this.defaultPipeline.chromaticAberration.aberrationAmount = 15;
            this.defaultPipeline.chromaticAberration.radialIntensity = 0.5;
        }
    }

    /**
     * Setup Screen Space Ambient Occlusion (SSAO)
     */
    setupSSAO(ssaoSettings) {
        this.ssaoPipeline = new BABYLON.SSAO2RenderingPipeline(
            'ssaoPipeline',
            this.scene,
            {
                ssaoRatio: 0.5,
                blurRatio: 0.5
            },
            [this.camera]
        );

        this.ssaoPipeline.radius = ssaoSettings.radius || 2;
        this.ssaoPipeline.totalStrength = ssaoSettings.strength || 1;
        this.ssaoPipeline.expensiveBlur = true;
        this.ssaoPipeline.samples = ssaoSettings.samples || 16;
        this.ssaoPipeline.maxZ = 250;
    }

    /**
     * Setup motion blur effect
     */
    setupMotionBlur(motionBlurSettings) {
        this.motionBlurEffect = new BABYLON.MotionBlurPostProcess(
            'motionBlur',
            this.scene,
            1.0,
            this.camera
        );

        this.motionBlurEffect.motionStrength = motionBlurSettings.strength || 0.5;
        this.motionBlurEffect.motionBlurSamples = 16;
    }

    /**
     * Setup shadow generator
     */
    setupShadows(shadowSettings) {
        if (!this.mainLight) {
            console.warn('GraphicsManager: No main light available for shadows');
            return;
        }

        this.shadowGenerator = new BABYLON.ShadowGenerator(
            shadowSettings.mapSize || 1024,
            this.mainLight
        );

        // Shadow quality settings
        if (shadowSettings.soft) {
            this.shadowGenerator.usePoissonSampling = true;
            this.shadowGenerator.blurKernel = 32;
        } else {
            this.shadowGenerator.useExponentialShadowMap = true;
        }

        this.shadowGenerator.bias = 0.001;
        this.shadowGenerator.normalBias = 0.02;
        this.shadowGenerator.darkness = 0.3;

        // Enable shadows on the scene
        this.scene.shadowsEnabled = true;
    }

    /**
     * Selective energy GlowLayer: glows ONLY weapon projectiles and force-field
     * beams, using each mesh's own emissive color, so ships/stars/other emissive
     * meshes are not washed out. Runs at every quality tier (the DefaultRendering
     * Pipeline bloom only runs at HIGH/ULTRA, so this gives energy glow at LOW/MED).
     * It is a separate effect layer, coexisting with that bloom pipeline and the
     * ResourceSystem HighlightLayer. Guarded so a creation failure never breaks the
     * scene.
     */
    setupEnergyGlow() {
        if (!this.scene || typeof BABYLON.GlowLayer !== 'function') return;
        if (this.energyGlow) return;
        try {
            const gl = new BABYLON.GlowLayer('energyGlow', this.scene, { blurKernelSize: 16 });
            gl.intensity = 0.7;
            gl.customEmissiveColorSelector = (mesh, subMesh, material, result) => {
                const n = (mesh && mesh.name) || '';
                if ((n === 'projectile' || n.indexOf('forceField') === 0) && material && material.emissiveColor) {
                    const e = material.emissiveColor;
                    result.set(e.r, e.g, e.b, 1);
                } else {
                    result.set(0, 0, 0, 0);
                }
            };
            this.energyGlow = gl;
        } catch (e) {
            console.warn('GraphicsManager: energy GlowLayer disabled -', e && e.message);
            this.energyGlow = null;
        }
    }

    /**
     * Add a mesh to the shadow map (call for important meshes)
     */
    addShadowCaster(mesh) {
        if (this.shadowGenerator && mesh) {
            this.shadowGenerator.addShadowCaster(mesh, true);
        }
    }

    /**
     * Briefly flash an entity's meshes when it takes damage (hull hit-flash).
     * Uses per-mesh renderOverlay so shared MaterialPool materials are untouched.
     * Debounced per entity: repeated hits extend the flash instead of stacking timers.
     */
    flashEntity(entity) {
        if (!entity || !entity.mesh || typeof entity.mesh.getChildMeshes !== 'function') return;

        // Extend the flash deadline on every hit
        entity._hitFlashUntil = performance.now() + HIT_FLASH_MS;

        // Already flashing -> the running timer chain will honor the extended deadline
        if (entity._hitFlashing) return;
        entity._hitFlashing = true;

        const setOverlay = (on) => {
            if (!entity.mesh || typeof entity.mesh.getChildMeshes !== 'function') return;
            const meshes = entity.mesh.getChildMeshes(false);
            for (const m of meshes) {
                m.renderOverlay = on;
                if (on) {
                    m.overlayColor = HIT_FLASH_COLOR;
                    m.overlayAlpha = HIT_FLASH_ALPHA;
                }
            }
        };

        setOverlay(true);

        const tick = () => {
            // Entity disposed mid-flash -> stop cleanly
            if (!entity.mesh) { entity._hitFlashing = false; return; }
            if (performance.now() >= entity._hitFlashUntil) {
                setOverlay(false);
                entity._hitFlashing = false;
            } else {
                setTimeout(tick, 40);
            }
        };
        setTimeout(tick, 40);
    }

    /**
     * Attach a fading engine TrailMesh behind a unit. Quality-gated to HIGH/ULTRA
     * to bound per-frame trail cost. Buildings are not trailed.
     */
    attachTrail(entity) {
        if (!entity || !entity.isUnit || !entity.mesh) return;
        // Quality gate: trails only on HIGH / ULTRA
        if (this.currentLevel !== 'HIGH' && this.currentLevel !== 'ULTRA') return;
        if (this.unitTrails.has(entity)) return;
        if (typeof BABYLON.TrailMesh !== 'function') return;

        const size = entity.size || 1;
        const trail = new BABYLON.TrailMesh('trail_' + entity.id, entity.mesh, this.scene, Math.max(0.3, size * 0.35), 30, true);

        const tc = entity.teamColor || new BABYLON.Color3(0.5, 0.7, 1);
        const mat = new BABYLON.StandardMaterial('trailMat_' + entity.id, this.scene);
        mat.emissiveColor = new BABYLON.Color3(tc.r, tc.g, tc.b);
        mat.diffuseColor = new BABYLON.Color3(0, 0, 0);
        mat.specularColor = new BABYLON.Color3(0, 0, 0);
        mat.alpha = 0.5;
        mat.disableLighting = true;
        mat.alphaMode = BABYLON.Engine.ALPHA_ADD; // additive glow
        mat.backFaceCulling = false;
        trail.material = mat;

        this.unitTrails.set(entity, trail);
    }

    /**
     * Dispose a unit's trail on death. Idempotent (safe if called twice, since
     * ENTITY_DESTROYED is emitted from two sites).
     */
    detachTrail(entity) {
        if (!entity) return;
        const trail = this.unitTrails.get(entity);
        if (!trail) return;
        this.unitTrails.delete(entity);
        if (trail.material) trail.material.dispose();
        trail.dispose();
    }

    /**
     * Pop a brief additive muzzle-flash sprite at the shooter. Pooled billboard
     * planes reused round-robin (no per-shot allocation, no dynamic light).
     */
    muzzleFlash(data) {
        if (!data || !data.shooter || !data.shooter.mesh || !this.scene) return;

        // Lazy-build the shared additive material + plane pool
        if (!this.muzzleMat) {
            const mat = new BABYLON.StandardMaterial('muzzleFlashMat', this.scene);
            mat.emissiveColor = MUZZLE_COLOR;
            mat.diffuseColor = new BABYLON.Color3(0, 0, 0);
            mat.specularColor = new BABYLON.Color3(0, 0, 0);
            mat.disableLighting = true;
            mat.alphaMode = BABYLON.Engine.ALPHA_ADD;
            mat.backFaceCulling = false;
            this.muzzleMat = mat;
        }
        if (this.muzzlePool.length === 0) {
            for (let i = 0; i < MUZZLE_POOL_SIZE; i++) {
                const p = BABYLON.MeshBuilder.CreatePlane('muzzle_' + i, { size: 1 }, this.scene);
                p.material = this.muzzleMat;
                p.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
                p.isPickable = false;
                p.setEnabled(false);
                this.muzzlePool.push(p);
            }
        }

        const plane = this.muzzlePool[this.muzzlePoolCursor];
        this.muzzlePoolCursor = (this.muzzlePoolCursor + 1) % this.muzzlePool.length;

        const pos = data.shooter.mesh.position;
        const scale = 1 + (data.shooter.size || 1) * 0.4;
        plane.position.set(pos.x, pos.y, pos.z);
        plane.scaling.set(scale, scale, scale);
        plane.rotation.z = Math.random() * Math.PI; // slight variety
        plane.visibility = 1;
        plane.setEnabled(true);

        const start = performance.now();
        const fade = () => {
            // Scene/plane may be disposed between frames
            if (!this.scene || plane.isDisposed()) return;
            const t = (performance.now() - start) / MUZZLE_MS;
            if (t >= 1) {
                plane.visibility = 0;
                plane.setEnabled(false);
            } else {
                plane.visibility = 1 - t; // fade out over the flash lifetime
                setTimeout(fade, 16);
            }
        };
        setTimeout(fade, 16);
    }

    /**
     * Spawn a scaled explosion burst when a building is destroyed. Reuses the
     * existing pooled explosion ParticleSystem (and death sound) via the
     * COMBAT_EXPLOSION event handled in CombatSystem.createExplosion, so nothing
     * new is allocated here. Fired from BUILDING_DESTROYED, which Building.die
     * emits BEFORE dispose, so the mesh position is still valid. Buildings are
     * larger than units, so the burst is scaled up for a satisfying blow-up.
     */
    buildingDeathBurst(building) {
        if (!building || !building.mesh) return;
        eventBus.emit(GameEvents.COMBAT_EXPLOSION, {
            position: building.mesh.position.clone(),
            size: (building.size || 4) * 1.8,
            weaponType: 'default'
        });
    }

    /**
     * Enable shadow receiving on a mesh
     */
    enableShadowReceiver(mesh) {
        if (mesh && this.shadowGenerator) {
            mesh.receiveShadows = true;
        }
    }

    /**
     * Dispose all post-processing effects
     */
    disposeEffects() {
        if (this.defaultPipeline) {
            this.defaultPipeline.dispose();
            this.defaultPipeline = null;
        }

        if (this.ssaoPipeline) {
            this.ssaoPipeline.dispose();
            this.ssaoPipeline = null;
        }

        if (this.motionBlurEffect) {
            this.motionBlurEffect.dispose();
            this.motionBlurEffect = null;
        }

        if (this.shadowGenerator) {
            this.shadowGenerator.dispose();
            this.shadowGenerator = null;
            if (this.scene) {
                this.scene.shadowsEnabled = false;
            }
        }
    }

    /**
     * Get current quality level
     */
    getCurrentLevel() {
        return this.currentLevel;
    }

    /**
     * Get available quality levels
     */
    getAvailableLevels() {
        return Object.keys(GRAPHICS_SETTINGS);
    }

    /**
     * Cycle to next quality level
     */
    cycleQuality() {
        const levels = this.getAvailableLevels();
        const currentIndex = levels.indexOf(this.currentLevel);
        const nextIndex = (currentIndex + 1) % levels.length;
        this.applySettings(levels[nextIndex]);
        return levels[nextIndex];
    }

    /**
     * Get performance stats
     */
    getPerformanceInfo() {
        return {
            fps: this.engine.getFps().toFixed(0),
            drawCalls: this.scene.getEngine().drawCalls,
            activeParticles: this.scene.particlesEnabled ? this.scene.particleSystems.reduce((sum, ps) => sum + ps.getActiveCount(), 0) : 0,
            activeMeshes: this.scene.getActiveMeshes().length,
            currentLevel: this.currentLevel
        };
    }

    /**
     * Dispose the graphics manager
     */
    dispose() {
        this.disposeEffects();

        for (const p of this.muzzlePool) { if (p && !p.isDisposed()) p.dispose(); }
        this.muzzlePool = [];
        if (this.muzzleMat) { this.muzzleMat.dispose(); this.muzzleMat = null; }

        if (this.energyGlow) { this.energyGlow.dispose(); this.energyGlow = null; }

        this.initialized = false;
        console.log('GraphicsManager: Disposed');
    }
}

// Singleton export
export const graphicsManager = new GraphicsManagerClass();
export default GraphicsManagerClass;
