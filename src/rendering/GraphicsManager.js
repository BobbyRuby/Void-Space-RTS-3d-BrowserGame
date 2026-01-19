// ============================================================
// VOID SUPREMACY 3D - Graphics Manager
// Handles post-processing effects, quality settings, and visual enhancements
// ============================================================

import { GRAPHICS_SETTINGS, graphicsLevel, setGraphicsLevel } from '../core/Config.js?v=20260119';
import { eventBus, GameEvents } from '../core/EventBus.js?v=20260119';

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
     * Add a mesh to the shadow map (call for important meshes)
     */
    addShadowCaster(mesh) {
        if (this.shadowGenerator && mesh) {
            this.shadowGenerator.addShadowCaster(mesh, true);
        }
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
        this.initialized = false;
        console.log('GraphicsManager: Disposed');
    }
}

// Singleton export
export const graphicsManager = new GraphicsManagerClass();
export default GraphicsManagerClass;
