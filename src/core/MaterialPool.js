// ============================================================
// VOID SUPREMACY 3D - Material Pool System
// Pre-creates and reuses materials to prevent memory leaks
// ============================================================

import { TEAM_COLORS, WEAPON_TYPES, GRAPHICS_SETTINGS, graphicsLevel, TESSELLATION_SETTINGS } from './Config.js';
import { eventBus, GameEvents } from './EventBus.js';

/**
 * MaterialPool - Singleton that manages all shared materials
 * This prevents creating 1000+ materials/second during combat
 * by reusing pre-created cached materials.
 *
 * Supports both Standard and PBR materials for different quality levels.
 */
class MaterialPoolClass {
    constructor() {
        this.scene = null;
        this.initialized = false;

        // Material caches
        this.teamMaterials = {};        // teamIndex -> { base, emissive, glow }
        this.teamPBRMaterials = {};     // teamIndex -> { base, emissive, glow } (PBR versions)
        this.weaponMaterials = {};      // weaponType -> { projectile, trail, muzzle }
        this.explosionMaterials = {};   // weaponType -> Color3[]
        this.effectMaterials = {};      // smoke, shockwave, impact

        // Shared singleton materials
        this.selectionMaterial = null;
        this.starMaterials = [];        // Array of 3 star color variants

        // Current material type based on graphics settings
        this.usePBR = false;

        // Procedural textures cache
        this.proceduralTextures = {};

        // Fresnel settings
        this.useFresnelRim = false;
    }

    /**
     * Initialize all materials - call once during scene setup
     */
    init(scene) {
        if (this.initialized) return;
        this.scene = scene;

        // Check initial graphics level for PBR and Fresnel
        const settings = GRAPHICS_SETTINGS[graphicsLevel];
        this.usePBR = settings?.materials === 'pbr';
        this.useFresnelRim = settings?.tessellation?.useFresnel || false;

        // Generate procedural textures (normal maps, hull details)
        this.createProceduralTextures();

        // Create standard materials (always available)
        this.createTeamMaterials();
        this.createWeaponMaterials();
        this.createExplosionMaterials();
        this.createEffectMaterials();
        this.createSelectionMaterial();
        this.createStarMaterials();

        // Create PBR materials (for HIGH/ULTRA)
        this.createTeamPBRMaterials();

        // Listen for graphics quality changes
        eventBus.on(GameEvents.GRAPHICS_QUALITY_CHANGED, (data) => {
            this.usePBR = data.settings?.materials === 'pbr';
            this.useFresnelRim = data.settings?.tessellation?.useFresnel || false;
            console.log(`MaterialPool: PBR materials ${this.usePBR ? 'enabled' : 'disabled'}, Fresnel ${this.useFresnelRim ? 'enabled' : 'disabled'}`);
        });

        this.initialized = true;
        console.log(`MaterialPool: Initialized with cached materials (PBR: ${this.usePBR}, Fresnel: ${this.useFresnelRim})`);
    }

    /**
     * Create procedural textures for hull details and normal maps
     */
    createProceduralTextures() {
        // Hull normal map - adds depth to flat surfaces
        this.proceduralTextures.hullNormal = this.generateHullNormalMap(512);

        // Panel lines normal map - for detailed panel seams
        this.proceduralTextures.panelNormal = this.generatePanelNormalMap(512);

        // Generic metal normal map
        this.proceduralTextures.metalNormal = this.generateMetalNormalMap(256);
    }

    /**
     * Generate a procedural normal map for hull plating
     * Creates the illusion of beveled panels without geometry cost
     */
    generateHullNormalMap(size) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Base neutral normal (pointing up)
        ctx.fillStyle = 'rgb(128, 128, 255)';
        ctx.fillRect(0, 0, size, size);

        // Panel grid settings
        const panelW = 64, panelH = 32;

        for (let x = 0; x < size; x += panelW) {
            for (let y = 0; y < size; y += panelH) {
                // Panel edge bevels - create slight slope
                const bevelSize = 4;

                // Left edge bevel (normal points right)
                const gradLeft = ctx.createLinearGradient(x, y, x + bevelSize, y);
                gradLeft.addColorStop(0, 'rgb(100, 128, 255)');
                gradLeft.addColorStop(1, 'rgb(128, 128, 255)');
                ctx.fillStyle = gradLeft;
                ctx.fillRect(x, y, bevelSize, panelH);

                // Right edge bevel (normal points left)
                const gradRight = ctx.createLinearGradient(x + panelW - bevelSize, y, x + panelW, y);
                gradRight.addColorStop(0, 'rgb(128, 128, 255)');
                gradRight.addColorStop(1, 'rgb(156, 128, 255)');
                ctx.fillStyle = gradRight;
                ctx.fillRect(x + panelW - bevelSize, y, bevelSize, panelH);

                // Top edge bevel (normal points down)
                const gradTop = ctx.createLinearGradient(x, y, x, y + bevelSize);
                gradTop.addColorStop(0, 'rgb(128, 100, 255)');
                gradTop.addColorStop(1, 'rgb(128, 128, 255)');
                ctx.fillStyle = gradTop;
                ctx.fillRect(x, y, panelW, bevelSize);

                // Bottom edge bevel (normal points up)
                const gradBottom = ctx.createLinearGradient(x, y + panelH - bevelSize, x, y + panelH);
                gradBottom.addColorStop(0, 'rgb(128, 128, 255)');
                gradBottom.addColorStop(1, 'rgb(128, 156, 255)');
                ctx.fillStyle = gradBottom;
                ctx.fillRect(x, y + panelH - bevelSize, panelW, bevelSize);

                // Random rivets (subtle bumps)
                if (Math.random() > 0.6) {
                    const rx = x + 8 + Math.random() * (panelW - 16);
                    const ry = y + 8 + Math.random() * (panelH - 16);
                    const grad = ctx.createRadialGradient(rx, ry, 0, rx, ry, 3);
                    grad.addColorStop(0, 'rgb(128, 128, 230)');
                    grad.addColorStop(1, 'rgb(128, 128, 255)');
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(rx, ry, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // Create Babylon texture from canvas
        const texture = new BABYLON.DynamicTexture('hullNormalTex', canvas, this.scene, true);
        texture.update();
        return texture;
    }

    /**
     * Generate a procedural normal map for fine panel lines
     */
    generatePanelNormalMap(size) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Base neutral normal
        ctx.fillStyle = 'rgb(128, 128, 255)';
        ctx.fillRect(0, 0, size, size);

        // Horizontal panel lines
        ctx.strokeStyle = 'rgb(128, 115, 245)';
        ctx.lineWidth = 2;
        for (let y = 16; y < size; y += 16) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(size, y);
            ctx.stroke();
        }

        // Vertical panel lines
        ctx.strokeStyle = 'rgb(115, 128, 245)';
        for (let x = 32; x < size; x += 32) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, size);
            ctx.stroke();
        }

        // Accent detail lines
        ctx.strokeStyle = 'rgb(140, 128, 255)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 15; i++) {
            const y = Math.random() * size;
            const x1 = Math.random() * size * 0.3;
            const x2 = x1 + Math.random() * size * 0.4;
            ctx.beginPath();
            ctx.moveTo(x1, y);
            ctx.lineTo(x2, y);
            ctx.stroke();
        }

        const texture = new BABYLON.DynamicTexture('panelNormalTex', canvas, this.scene, true);
        texture.update();
        return texture;
    }

    /**
     * Generate a generic metallic surface normal map
     */
    generateMetalNormalMap(size) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Base neutral normal
        ctx.fillStyle = 'rgb(128, 128, 255)';
        ctx.fillRect(0, 0, size, size);

        // Subtle noise for brushed metal effect
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * 10;
            data[i] = Math.max(0, Math.min(255, 128 + noise));     // R
            data[i + 1] = Math.max(0, Math.min(255, 128 + noise)); // G
            // data[i + 2] stays at 255 for Z component
        }

        ctx.putImageData(imageData, 0, 0);

        const texture = new BABYLON.DynamicTexture('metalNormalTex', canvas, this.scene, true);
        texture.update();
        return texture;
    }

    /**
     * Create materials for each team color (6 teams x 3 variants = 18 materials)
     */
    createTeamMaterials() {
        TEAM_COLORS.forEach((color, teamIndex) => {
            const baseColor = new BABYLON.Color3(color[0], color[1], color[2]);

            // Base team material (for unit/building bodies)
            const baseMat = new BABYLON.StandardMaterial(`team_${teamIndex}_base`, this.scene);
            baseMat.diffuseColor = baseColor;
            baseMat.emissiveColor = baseColor.scale(0.2);
            baseMat.freeze(); // Optimize: prevent further changes

            // Emissive team material (for engine glows, rings)
            const emissiveMat = new BABYLON.StandardMaterial(`team_${teamIndex}_emissive`, this.scene);
            emissiveMat.emissiveColor = baseColor;
            emissiveMat.alpha = 0.7;
            emissiveMat.freeze();

            // Glow team material (for bright effects)
            const glowMat = new BABYLON.StandardMaterial(`team_${teamIndex}_glow`, this.scene);
            glowMat.emissiveColor = baseColor.scale(1.5);
            glowMat.diffuseColor = baseColor;
            glowMat.freeze();

            // Ring material (for team identification rings under buildings)
            const ringMat = new BABYLON.StandardMaterial(`team_${teamIndex}_ring`, this.scene);
            ringMat.emissiveColor = baseColor;
            ringMat.alpha = 0.6;
            ringMat.freeze();

            // Hull material (for ship bodies - darker, more metallic look)
            const hullMat = new BABYLON.StandardMaterial(`team_${teamIndex}_hull`, this.scene);
            hullMat.diffuseColor = baseColor.scale(0.6);
            hullMat.emissiveColor = baseColor.scale(0.15);
            hullMat.specularColor = new BABYLON.Color3(0.4, 0.4, 0.4);
            hullMat.freeze();

            // Metallic material (for armor plates, machinery)
            const metallicMat = new BABYLON.StandardMaterial(`team_${teamIndex}_metallic`, this.scene);
            metallicMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.55);
            metallicMat.emissiveColor = baseColor.scale(0.1);
            metallicMat.specularColor = new BABYLON.Color3(0.6, 0.6, 0.6);
            metallicMat.specularPower = 64;
            metallicMat.freeze();

            // Accent material (for details, trim)
            const accentMat = new BABYLON.StandardMaterial(`team_${teamIndex}_accent`, this.scene);
            accentMat.diffuseColor = baseColor;
            accentMat.emissiveColor = baseColor.scale(0.3);
            accentMat.freeze();

            this.teamMaterials[teamIndex] = {
                base: baseMat,
                emissive: emissiveMat,
                glow: glowMat,
                ring: ringMat,
                hull: hullMat,
                metallic: metallicMat,
                accent: accentMat,
                color: baseColor
            };
        });
    }

    /**
     * Create PBR materials for each team color (for HIGH/ULTRA quality)
     * PBR materials provide more realistic metallic/roughness-based rendering
     * Includes Fresnel rim lighting for edge highlights and normal maps for detail
     */
    createTeamPBRMaterials() {
        // Check if Fresnel should be enabled
        const tessSettings = GRAPHICS_SETTINGS[graphicsLevel]?.tessellation;
        const enableFresnel = tessSettings?.useFresnel || false;
        const enableNormalMaps = tessSettings?.useNormalMaps || false;

        TEAM_COLORS.forEach((color, teamIndex) => {
            const baseColor = new BABYLON.Color3(color[0], color[1], color[2]);

            // Base PBR team material (metallic hull)
            const baseMat = new BABYLON.PBRMaterial(`team_${teamIndex}_pbr_base`, this.scene);
            baseMat.albedoColor = baseColor;
            baseMat.metallic = 0.7;
            baseMat.roughness = 0.3;
            baseMat.emissiveColor = baseColor.scale(0.15);
            baseMat.emissiveIntensity = 0.5;

            // Add normal map for surface detail
            if (enableNormalMaps && this.proceduralTextures.hullNormal) {
                baseMat.bumpTexture = this.proceduralTextures.hullNormal;
                baseMat.invertNormalMapX = true;
                baseMat.invertNormalMapY = true;
            }

            // Add Fresnel rim lighting for edge highlights
            if (enableFresnel) {
                this.applyFresnelToMaterial(baseMat, baseColor);
            }

            baseMat.freeze();

            // Emissive PBR material (engine glows)
            const emissiveMat = new BABYLON.PBRMaterial(`team_${teamIndex}_pbr_emissive`, this.scene);
            emissiveMat.albedoColor = baseColor;
            emissiveMat.emissiveColor = baseColor;
            emissiveMat.emissiveIntensity = 2.0;
            emissiveMat.metallic = 0.2;
            emissiveMat.roughness = 0.8;
            emissiveMat.alpha = 0.8;
            emissiveMat.freeze();

            // Glow PBR material (bright effects)
            const glowMat = new BABYLON.PBRMaterial(`team_${teamIndex}_pbr_glow`, this.scene);
            glowMat.albedoColor = baseColor;
            glowMat.emissiveColor = baseColor.scale(1.5);
            glowMat.emissiveIntensity = 3.0;
            glowMat.metallic = 0.1;
            glowMat.roughness = 0.9;
            glowMat.unlit = true;  // Pure emissive for glow
            glowMat.freeze();

            // Ring PBR material
            const ringMat = new BABYLON.PBRMaterial(`team_${teamIndex}_pbr_ring`, this.scene);
            ringMat.albedoColor = baseColor;
            ringMat.emissiveColor = baseColor;
            ringMat.emissiveIntensity = 1.5;
            ringMat.alpha = 0.6;
            ringMat.metallic = 0.0;
            ringMat.roughness = 1.0;
            ringMat.freeze();

            // Hull PBR material (main ship body)
            const hullMat = new BABYLON.PBRMaterial(`team_${teamIndex}_pbr_hull`, this.scene);
            hullMat.albedoColor = baseColor.scale(0.6);
            hullMat.metallic = 0.8;
            hullMat.roughness = 0.25;
            hullMat.emissiveColor = baseColor.scale(0.1);
            hullMat.emissiveIntensity = 0.3;

            // Add normal map for hull detail
            if (enableNormalMaps && this.proceduralTextures.hullNormal) {
                hullMat.bumpTexture = this.proceduralTextures.hullNormal;
                hullMat.invertNormalMapX = true;
                hullMat.invertNormalMapY = true;
            }

            // Add Fresnel rim lighting
            if (enableFresnel) {
                this.applyFresnelToMaterial(hullMat, baseColor.scale(0.8));
            }

            hullMat.freeze();

            // Metallic PBR material (armor plates, machinery)
            const metallicPBRMat = new BABYLON.PBRMaterial(`team_${teamIndex}_pbr_metallic`, this.scene);
            metallicPBRMat.albedoColor = new BABYLON.Color3(0.5, 0.5, 0.55);
            metallicPBRMat.metallic = 0.9;
            metallicPBRMat.roughness = 0.2;
            metallicPBRMat.emissiveColor = baseColor.scale(0.05);
            metallicPBRMat.emissiveIntensity = 0.2;

            // Add metal normal map
            if (enableNormalMaps && this.proceduralTextures.metalNormal) {
                metallicPBRMat.bumpTexture = this.proceduralTextures.metalNormal;
            }

            if (enableFresnel) {
                this.applyFresnelToMaterial(metallicPBRMat, new BABYLON.Color3(0.7, 0.7, 0.8));
            }

            metallicPBRMat.freeze();

            // Accent PBR material (trim, details)
            const accentMat = new BABYLON.PBRMaterial(`team_${teamIndex}_pbr_accent`, this.scene);
            accentMat.albedoColor = baseColor;
            accentMat.metallic = 0.5;
            accentMat.roughness = 0.4;
            accentMat.emissiveColor = baseColor.scale(0.2);
            accentMat.emissiveIntensity = 0.8;

            if (enableNormalMaps && this.proceduralTextures.panelNormal) {
                accentMat.bumpTexture = this.proceduralTextures.panelNormal;
            }

            accentMat.freeze();

            // Glass material for cockpits and windows
            const glassMat = new BABYLON.PBRMaterial(`team_${teamIndex}_pbr_glass`, this.scene);
            glassMat.albedoColor = new BABYLON.Color3(0.1, 0.15, 0.2);
            glassMat.metallic = 0.1;
            glassMat.roughness = 0.05;
            glassMat.alpha = 0.6;
            glassMat.subSurface.isRefractionEnabled = true;
            glassMat.subSurface.refractionIntensity = 0.6;
            glassMat.subSurface.indexOfRefraction = 1.5;

            if (enableFresnel) {
                // Strong Fresnel for glass
                this.applyFresnelToMaterial(glassMat, new BABYLON.Color3(0.5, 0.6, 0.8), 3.0);
            }

            glassMat.freeze();

            this.teamPBRMaterials[teamIndex] = {
                base: baseMat,
                emissive: emissiveMat,
                glow: glowMat,
                ring: ringMat,
                hull: hullMat,
                metallic: metallicPBRMat,
                accent: accentMat,
                glass: glassMat,
                color: baseColor
            };
        });
    }

    /**
     * Apply Fresnel rim lighting effect to a PBR material
     * Creates a subtle glow at edges where the surface faces away from camera
     * @param {BABYLON.PBRMaterial} material - The PBR material to modify
     * @param {BABYLON.Color3} rimColor - Color for the rim lighting
     * @param {number} power - Fresnel power (higher = tighter rim, default 2)
     */
    applyFresnelToMaterial(material, rimColor, power = 2.0) {
        // PBR materials use sheen for Fresnel-like rim effects
        material.sheen.isEnabled = true;
        material.sheen.intensity = 0.8;
        material.sheen.color = rimColor;

        // Also enable clear coat for extra rim reflection
        material.clearCoat.isEnabled = true;
        material.clearCoat.intensity = 0.3;
        material.clearCoat.indexOfRefraction = 1.5;
    }

    /**
     * Create materials for each weapon type (5 types x 3 variants = 15 materials)
     */
    createWeaponMaterials() {
        Object.entries(WEAPON_TYPES).forEach(([weaponType, def]) => {
            let color;
            if (def.color === 'team') {
                // Team-colored weapons use a default blue, actual color set at runtime
                color = new BABYLON.Color3(0.5, 0.5, 1.0);
            } else {
                color = new BABYLON.Color3(def.color[0], def.color[1], def.color[2]);
            }

            // Projectile material
            const projectileMat = new BABYLON.StandardMaterial(`weapon_${weaponType}_proj`, this.scene);
            projectileMat.emissiveColor = def.glow ? color.scale(1.5) : color;
            projectileMat.diffuseColor = color;
            // Don't freeze - we may need to clone for team colors

            // Trail material
            const trailMat = new BABYLON.StandardMaterial(`weapon_${weaponType}_trail`, this.scene);
            trailMat.emissiveColor = color.scale(0.7);
            trailMat.alpha = 0.5;

            // Muzzle flash material
            const muzzleMat = new BABYLON.StandardMaterial(`weapon_${weaponType}_muzzle`, this.scene);
            muzzleMat.emissiveColor = color.scale(2);
            muzzleMat.diffuseColor = color;
            muzzleMat.alpha = 0.8;

            // Beam material (for instant hit weapons)
            const beamMat = new BABYLON.StandardMaterial(`weapon_${weaponType}_beam`, this.scene);
            beamMat.emissiveColor = color.scale(1.5);
            beamMat.diffuseColor = color;
            beamMat.alpha = 0.8;

            this.weaponMaterials[weaponType] = {
                projectile: projectileMat,
                trail: trailMat,
                muzzle: muzzleMat,
                beam: beamMat,
                color: color,
                isTeamColored: def.color === 'team'
            };
        });
    }

    /**
     * Create explosion color palettes for each weapon type
     */
    createExplosionMaterials() {
        // Pre-create explosion materials for each weapon type
        const explosionPalettes = {
            plasma: [
                new BABYLON.Color3(0, 1, 0.5),
                new BABYLON.Color3(0, 0.8, 0.3),
                new BABYLON.Color3(0.2, 1, 0.7)
            ],
            missile: [
                new BABYLON.Color3(1, 0.5, 0),
                new BABYLON.Color3(1, 0.3, 0),
                new BABYLON.Color3(1, 0.7, 0.2),
                new BABYLON.Color3(0.8, 0.2, 0)
            ],
            beam: [
                new BABYLON.Color3(1, 0, 0),
                new BABYLON.Color3(1, 0.3, 0.1),
                new BABYLON.Color3(0.8, 0, 0)
            ],
            cannon: [
                new BABYLON.Color3(1, 1, 0),
                new BABYLON.Color3(1, 0.8, 0.2),
                new BABYLON.Color3(1, 0.6, 0)
            ],
            default: [
                new BABYLON.Color3(1, 0.5, 0),
                new BABYLON.Color3(1, 0.3, 0),
                new BABYLON.Color3(1, 0.7, 0)
            ]
        };

        // Create actual materials for each palette
        Object.entries(explosionPalettes).forEach(([type, colors]) => {
            this.explosionMaterials[type] = colors.map((color, i) => {
                const mat = new BABYLON.StandardMaterial(`explosion_${type}_${i}`, this.scene);
                mat.emissiveColor = color;
                mat.alpha = 1;
                return mat;
            });
        });
    }

    /**
     * Create shared effect materials (smoke, shockwave)
     */
    createEffectMaterials() {
        // Smoke material
        const smokeMat = new BABYLON.StandardMaterial('effect_smoke', this.scene);
        smokeMat.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.4);
        smokeMat.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        smokeMat.alpha = 0.6;

        // Shockwave material
        const shockwaveMat = new BABYLON.StandardMaterial('effect_shockwave', this.scene);
        shockwaveMat.emissiveColor = new BABYLON.Color3(1, 0.8, 0.3);
        shockwaveMat.alpha = 0.7;

        this.effectMaterials = {
            smoke: smokeMat,
            shockwave: shockwaveMat
        };
    }

    /**
     * Create the shared green selection ring material
     */
    createSelectionMaterial() {
        this.selectionMaterial = new BABYLON.StandardMaterial('selection_ring', this.scene);
        this.selectionMaterial.emissiveColor = new BABYLON.Color3(0, 1, 0);
        this.selectionMaterial.diffuseColor = new BABYLON.Color3(0, 1, 0);
        this.selectionMaterial.alpha = 0.8;
        this.selectionMaterial.freeze();
    }

    /**
     * Create star materials (3 color variants for variety)
     */
    createStarMaterials() {
        // White stars (most common)
        const whiteMat = new BABYLON.StandardMaterial('star_white', this.scene);
        whiteMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
        whiteMat.freeze();

        // Warm stars (orange-ish)
        const warmMat = new BABYLON.StandardMaterial('star_warm', this.scene);
        warmMat.emissiveColor = new BABYLON.Color3(1, 0.8, 0.6);
        warmMat.freeze();

        // Cool stars (blue-ish)
        const coolMat = new BABYLON.StandardMaterial('star_cool', this.scene);
        coolMat.emissiveColor = new BABYLON.Color3(0.7, 0.8, 1);
        coolMat.freeze();

        this.starMaterials = [whiteMat, warmMat, coolMat];

        // Create engine glow shader materials
        this.createEngineGlowMaterials();
    }

    /**
     * Create animated engine glow shader materials for each team
     * These materials pulse and flicker to simulate thruster output
     */
    createEngineGlowMaterials() {
        this.engineGlowMaterials = {};
        this.engineGlowTime = 0;

        // Vertex shader - simple pass-through
        const vertexShader = `
            precision highp float;
            attribute vec3 position;
            attribute vec3 normal;
            attribute vec2 uv;

            uniform mat4 worldViewProjection;
            uniform mat4 world;

            varying vec3 vNormal;
            varying vec2 vUV;
            varying vec3 vPosition;

            void main() {
                vNormal = normalize((world * vec4(normal, 0.0)).xyz);
                vUV = uv;
                vPosition = (world * vec4(position, 1.0)).xyz;
                gl_Position = worldViewProjection * vec4(position, 1.0);
            }
        `;

        // Fragment shader - animated glow with pulsing and noise
        const fragmentShader = `
            precision highp float;

            uniform vec3 glowColor;
            uniform float time;
            uniform float intensity;
            uniform vec3 cameraPosition;

            varying vec3 vNormal;
            varying vec2 vUV;
            varying vec3 vPosition;

            // Simple noise function
            float noise(float x) {
                return fract(sin(x * 12.9898) * 43758.5453);
            }

            void main() {
                // Base glow intensity with pulsing
                float pulse = 0.8 + 0.2 * sin(time * 8.0);

                // Add subtle flicker
                float flicker = 0.95 + 0.05 * noise(time * 20.0);

                // Fresnel effect for edge glow
                vec3 viewDir = normalize(cameraPosition - vPosition);
                float fresnel = 1.0 - max(dot(vNormal, viewDir), 0.0);
                fresnel = pow(fresnel, 1.5);

                // Center-to-edge falloff (radial gradient using UV)
                float radialFalloff = 1.0 - length(vUV - vec2(0.5)) * 1.5;
                radialFalloff = clamp(radialFalloff, 0.0, 1.0);
                radialFalloff = pow(radialFalloff, 0.8);

                // Combine effects
                float finalIntensity = intensity * pulse * flicker;
                finalIntensity *= (radialFalloff + fresnel * 0.5);

                // Core color (bright white-ish center)
                vec3 coreColor = mix(glowColor, vec3(1.0, 1.0, 1.0), 0.4);

                // Blend between core and edge color
                vec3 finalColor = mix(glowColor * 1.5, coreColor, radialFalloff);

                // Add slight chromatic variation at edges
                finalColor.r += fresnel * 0.2;
                finalColor.g += fresnel * 0.1;

                gl_FragColor = vec4(finalColor * finalIntensity, min(finalIntensity, 0.95));
            }
        `;

        // Create shader materials for each team
        TEAM_COLORS.forEach((color, teamIndex) => {
            const teamColor = new BABYLON.Color3(color[0], color[1], color[2]);

            const shaderMat = new BABYLON.ShaderMaterial(
                `engineGlow_team${teamIndex}`,
                this.scene,
                {
                    vertexSource: vertexShader,
                    fragmentSource: fragmentShader
                },
                {
                    attributes: ['position', 'normal', 'uv'],
                    uniforms: ['worldViewProjection', 'world', 'glowColor', 'time', 'intensity', 'cameraPosition'],
                    needAlphaBlending: true
                }
            );

            shaderMat.setColor3('glowColor', teamColor);
            shaderMat.setFloat('time', 0);
            shaderMat.setFloat('intensity', 1.5);
            shaderMat.setVector3('cameraPosition', BABYLON.Vector3.Zero());

            // Enable alpha blending
            shaderMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
            shaderMat.backFaceCulling = false;

            this.engineGlowMaterials[teamIndex] = shaderMat;
        });

        console.log('MaterialPool: Created animated engine glow shaders');
    }

    /**
     * Update engine glow materials (call from render loop)
     * @param {number} dt - Delta time in seconds
     * @param {BABYLON.Vector3} cameraPosition - Current camera position
     */
    updateEngineGlow(dt, cameraPosition) {
        this.engineGlowTime += dt;

        // Update all engine glow shader uniforms
        Object.values(this.engineGlowMaterials).forEach(mat => {
            mat.setFloat('time', this.engineGlowTime);
            if (cameraPosition) {
                mat.setVector3('cameraPosition', cameraPosition);
            }
        });
    }

    /**
     * Get animated engine glow material for a team
     * @param {number} teamIndex - Team index
     * @returns {BABYLON.ShaderMaterial}
     */
    getEngineGlowMaterial(teamIndex) {
        return this.engineGlowMaterials[teamIndex] || this.engineGlowMaterials[0];
    }

    // ===== Getter Methods =====

    /**
     * Get material for team-based entities
     * @param {number} teamIndex - Team index (0-5)
     * @param {string} variant - 'base', 'emissive', 'glow', or 'ring'
     * @param {boolean} forcePBR - Force PBR material even if not in PBR mode
     */
    getTeamMaterial(teamIndex, variant = 'base', forcePBR = false) {
        // Use PBR materials if enabled or forced
        if (this.usePBR || forcePBR) {
            const team = this.teamPBRMaterials[teamIndex] || this.teamPBRMaterials[0];
            if (team) {
                return team[variant] || team.base;
            }
        }
        // Fallback to standard materials
        const team = this.teamMaterials[teamIndex] || this.teamMaterials[0];
        return team[variant] || team.base;
    }

    /**
     * Check if PBR materials are currently in use
     */
    isPBREnabled() {
        return this.usePBR;
    }

    /**
     * Check if Fresnel rim lighting is enabled
     */
    isFresnelEnabled() {
        return this.useFresnelRim;
    }

    /**
     * Get procedural normal map texture
     * @param {string} type - 'hull', 'panel', or 'metal'
     * @returns {BABYLON.Texture|null}
     */
    getNormalMap(type = 'hull') {
        switch (type) {
            case 'hull':
                return this.proceduralTextures.hullNormal || null;
            case 'panel':
                return this.proceduralTextures.panelNormal || null;
            case 'metal':
                return this.proceduralTextures.metalNormal || null;
            default:
                return this.proceduralTextures.hullNormal || null;
        }
    }

    /**
     * Get the raw team color as Color3
     */
    getTeamColor(teamIndex) {
        const team = this.teamMaterials[teamIndex] || this.teamMaterials[0];
        return team.color;
    }

    /**
     * Get projectile material for a weapon type
     * @param {string} weaponType - laser, plasma, missile, cannon, beam
     * @param {number} teamIndex - Team index for team-colored weapons
     */
    getProjectileMaterial(weaponType, teamIndex = 0) {
        const weapon = this.weaponMaterials[weaponType] || this.weaponMaterials.laser;

        if (weapon.isTeamColored) {
            // For team-colored weapons, we need to return a material with the team color
            // Create a cached team-weapon combo if not exists
            const cacheKey = `${weaponType}_team${teamIndex}`;
            if (!this.weaponMaterials[cacheKey]) {
                const teamColor = this.getTeamColor(teamIndex);
                const mat = weapon.projectile.clone(cacheKey);
                mat.emissiveColor = teamColor;
                mat.diffuseColor = teamColor;
                this.weaponMaterials[cacheKey] = { projectile: mat, isCache: true };
            }
            return this.weaponMaterials[cacheKey].projectile;
        }

        return weapon.projectile;
    }

    /**
     * Get trail material for a weapon type
     */
    getTrailMaterial(weaponType, teamIndex = 0) {
        const weapon = this.weaponMaterials[weaponType] || this.weaponMaterials.laser;

        if (weapon.isTeamColored) {
            const cacheKey = `${weaponType}_team${teamIndex}_trail`;
            if (!this.weaponMaterials[cacheKey]) {
                const teamColor = this.getTeamColor(teamIndex);
                const mat = weapon.trail.clone(cacheKey);
                mat.emissiveColor = teamColor.scale(0.7);
                this.weaponMaterials[cacheKey] = mat;
            }
            return this.weaponMaterials[cacheKey];
        }

        return weapon.trail;
    }

    /**
     * Get muzzle flash material for a weapon type
     */
    getMuzzleMaterial(weaponType, teamIndex = 0) {
        const weapon = this.weaponMaterials[weaponType] || this.weaponMaterials.laser;

        if (weapon.isTeamColored) {
            const cacheKey = `${weaponType}_team${teamIndex}_muzzle`;
            if (!this.weaponMaterials[cacheKey]) {
                const teamColor = this.getTeamColor(teamIndex);
                const mat = weapon.muzzle.clone(cacheKey);
                mat.emissiveColor = teamColor.scale(2);
                mat.diffuseColor = teamColor;
                this.weaponMaterials[cacheKey] = mat;
            }
            return this.weaponMaterials[cacheKey];
        }

        return weapon.muzzle;
    }

    /**
     * Get beam material
     */
    getBeamMaterial(weaponType, teamIndex = 0) {
        const weapon = this.weaponMaterials[weaponType] || this.weaponMaterials.laser;

        if (weapon.isTeamColored) {
            const cacheKey = `${weaponType}_team${teamIndex}_beam`;
            if (!this.weaponMaterials[cacheKey]) {
                const teamColor = this.getTeamColor(teamIndex);
                const mat = weapon.beam.clone(cacheKey);
                mat.emissiveColor = teamColor.scale(1.5);
                mat.diffuseColor = teamColor;
                this.weaponMaterials[cacheKey] = mat;
            }
            return this.weaponMaterials[cacheKey];
        }

        return weapon.beam;
    }

    /**
     * Get explosion materials array for a weapon type
     * @returns {BABYLON.StandardMaterial[]} Array of materials to randomly choose from
     */
    getExplosionMaterials(weaponType = 'default') {
        return this.explosionMaterials[weaponType] || this.explosionMaterials.default;
    }

    /**
     * Get a random explosion material for a weapon type
     */
    getRandomExplosionMaterial(weaponType = 'default') {
        const materials = this.getExplosionMaterials(weaponType);
        return materials[Math.floor(Math.random() * materials.length)];
    }

    /**
     * Get smoke effect material
     */
    getSmokeMaterial() {
        return this.effectMaterials.smoke;
    }

    /**
     * Get shockwave effect material
     */
    getShockwaveMaterial() {
        return this.effectMaterials.shockwave;
    }

    /**
     * Get selection ring material (shared singleton)
     */
    getSelectionMaterial() {
        return this.selectionMaterial;
    }

    /**
     * Get star material based on random variation
     * @param {number} variation - 0-1 random value
     */
    getStarMaterial(variation) {
        if (variation < 0.7) return this.starMaterials[0];  // White (70%)
        if (variation < 0.85) return this.starMaterials[1]; // Warm (15%)
        return this.starMaterials[2];                        // Cool (15%)
    }

    /**
     * Dispose all materials - call on scene dispose
     */
    dispose() {
        // Dispose team materials (standard)
        Object.values(this.teamMaterials).forEach(team => {
            if (team.base) team.base.dispose();
            if (team.emissive) team.emissive.dispose();
            if (team.glow) team.glow.dispose();
            if (team.ring) team.ring.dispose();
            if (team.hull) team.hull.dispose();
            if (team.metallic) team.metallic.dispose();
            if (team.accent) team.accent.dispose();
        });

        // Dispose team materials (PBR)
        Object.values(this.teamPBRMaterials).forEach(team => {
            if (team.base) team.base.dispose();
            if (team.emissive) team.emissive.dispose();
            if (team.glow) team.glow.dispose();
            if (team.ring) team.ring.dispose();
            if (team.hull) team.hull.dispose();
            if (team.metallic) team.metallic.dispose();
            if (team.accent) team.accent.dispose();
        });

        // Dispose weapon materials
        Object.values(this.weaponMaterials).forEach(weapon => {
            if (weapon.projectile) weapon.projectile.dispose();
            if (weapon.trail) weapon.trail.dispose();
            if (weapon.muzzle) weapon.muzzle.dispose();
            if (weapon.beam) weapon.beam.dispose();
        });

        // Dispose explosion materials
        Object.values(this.explosionMaterials).forEach(materials => {
            materials.forEach(mat => mat.dispose());
        });

        // Dispose effect materials
        Object.values(this.effectMaterials).forEach(mat => mat.dispose());

        // Dispose selection material
        if (this.selectionMaterial) this.selectionMaterial.dispose();

        // Dispose star materials
        this.starMaterials.forEach(mat => mat.dispose());

        // Dispose engine glow shader materials
        if (this.engineGlowMaterials) {
            Object.values(this.engineGlowMaterials).forEach(mat => mat.dispose());
        }

        // Dispose procedural textures
        if (this.proceduralTextures) {
            Object.values(this.proceduralTextures).forEach(tex => {
                if (tex && tex.dispose) tex.dispose();
            });
        }

        this.initialized = false;
        console.log('MaterialPool: Disposed all materials');
    }
}

// Singleton export
export const MaterialPool = new MaterialPoolClass();

// Expose to window for external scripts (void-ships-enhanced.js)
if (typeof window !== 'undefined') {
    window.MaterialPool = MaterialPool;
}

export default MaterialPool;
