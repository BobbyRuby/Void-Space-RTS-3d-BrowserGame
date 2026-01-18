// ============================================================
// VOID SUPREMACY 3D - Enhanced Ore & Crystal Models & Textures
// Place this file in the same directory as the main game HTML
// Ore deposits and crystals will automatically use enhanced models when loaded
// ============================================================

(function(window) {
    'use strict';

    const VoidOreEnhanced = {
        initialized: false,
        scene: null,
        textures: {},
        materials: {},
        // Shared materials for performance (created once, reused)
        sharedAsteroidMatLight: null,
        sharedAsteroidMatDark: null,
        sharedCraterMat: null,
        sharedOreMats: null,
        sharedCrystalMats: null,
        sharedCrystalBaseGlowMat: null,

        // Initialize with Babylon scene
        init: function(babylonScene) {
            if (this.initialized) return;
            this.scene = babylonScene;
            this.createProceduralTextures();
            this.createSharedMaterials();
            this.initialized = true;
            console.log('VoidOre Enhanced: Detailed ore and crystal models loaded (with shared materials)');
        },

        // Pre-create shared materials for performance
        createSharedMaterials: function() {
            // Shared asteroid materials (2 instead of 200+)
            this.sharedAsteroidMatLight = this.createAsteroidMaterialInternal(false);
            this.sharedAsteroidMatDark = this.createAsteroidMaterialInternal(true);

            // Shared crater material for large asteroids
            this.sharedCraterMat = new BABYLON.StandardMaterial('craterMatShared', this.scene);
            this.sharedCraterMat.diffuseColor = new BABYLON.Color3(0.15, 0.12, 0.1);
            this.sharedCraterMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);

            // Shared ore materials
            this.sharedOreMats = this.createOreMaterialsInternal();

            // Shared crystal materials
            this.sharedCrystalMats = this.createCrystalMaterialsInternal();

            // Shared crystal base glow material
            this.sharedCrystalBaseGlowMat = new BABYLON.StandardMaterial('crystalBaseGlowShared', this.scene);
            this.sharedCrystalBaseGlowMat.emissiveColor = new BABYLON.Color3(0.6, 0.2, 0.9);
            this.sharedCrystalBaseGlowMat.alpha = 0.4;
            this.sharedCrystalBaseGlowMat.disableLighting = true;

            console.log('VoidOre Enhanced: Shared materials created');
        },

        // ===== PROCEDURAL TEXTURE GENERATION =====
        createProceduralTextures: function() {
            this.textures.rockSurface = this.generateRockTexture(512);
            this.textures.oreVein = this.generateOreVeinTexture(512);
            this.textures.crystalSurface = this.generateCrystalTexture(512);
            this.textures.crystalGlow = this.generateCrystalGlowTexture(256);
            this.textures.rockDetail = this.generateRockDetailTexture(256);
            this.textures.asteroidSurface = this.generateAsteroidTexture(512);
            this.textures.asteroidDark = this.generateAsteroidDarkTexture(512);
        },

        generateRockTexture: function(size) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');

            // Base rocky brown/gray
            ctx.fillStyle = '#4a4035';
            ctx.fillRect(0, 0, size, size);

            // Multi-layered noise for rocky surface
            for (let pass = 0; pass < 3; pass++) {
                const noiseScale = [8, 4, 2][pass];
                const alpha = [0.3, 0.2, 0.15][pass];

                for (let x = 0; x < size; x += noiseScale) {
                    for (let y = 0; y < size; y += noiseScale) {
                        const v = Math.random() * 40 - 20;
                        ctx.fillStyle = `rgba(${74 + v}, ${64 + v}, ${53 + v}, ${alpha})`;
                        ctx.fillRect(x, y, noiseScale, noiseScale);
                    }
                }
            }

            // Cracks and fissures
            ctx.strokeStyle = 'rgba(30, 25, 20, 0.6)';
            ctx.lineWidth = 2;
            for (let i = 0; i < 15; i++) {
                ctx.beginPath();
                let px = Math.random() * size;
                let py = Math.random() * size;
                ctx.moveTo(px, py);
                for (let j = 0; j < 4 + Math.random() * 4; j++) {
                    px += (Math.random() - 0.5) * 50;
                    py += (Math.random() - 0.5) * 50;
                    ctx.lineTo(px, py);
                }
                ctx.stroke();
            }

            // Light edge highlights on cracks
            ctx.strokeStyle = 'rgba(150, 130, 110, 0.15)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 10; i++) {
                ctx.beginPath();
                const sx = Math.random() * size;
                const sy = Math.random() * size;
                ctx.moveTo(sx, sy);
                ctx.lineTo(sx + (Math.random() - 0.5) * 30, sy + (Math.random() - 0.5) * 30);
                ctx.stroke();
            }

            // Embedded mineral flecks
            ctx.fillStyle = 'rgba(180, 140, 80, 0.4)';
            for (let i = 0; i < 40; i++) {
                ctx.beginPath();
                ctx.arc(Math.random() * size, Math.random() * size, 1 + Math.random() * 3, 0, Math.PI * 2);
                ctx.fill();
            }

            const texture = new BABYLON.DynamicTexture('rockTex', canvas, this.scene, true);
            texture.update();
            return texture;
        },

        generateOreVeinTexture: function(size) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');

            // Dark rock base
            ctx.fillStyle = '#3a3028';
            ctx.fillRect(0, 0, size, size);

            // Ore vein networks
            ctx.lineCap = 'round';

            // Primary veins (copper/orange)
            for (let v = 0; v < 8; v++) {
                ctx.beginPath();
                ctx.strokeStyle = `rgba(${180 + Math.random() * 50}, ${100 + Math.random() * 40}, ${40 + Math.random() * 30}, 0.9)`;
                ctx.lineWidth = 4 + Math.random() * 6;

                let px = Math.random() * size;
                let py = Math.random() * size;
                ctx.moveTo(px, py);

                for (let seg = 0; seg < 5 + Math.random() * 5; seg++) {
                    px += (Math.random() - 0.5) * 80;
                    py += (Math.random() - 0.5) * 80;
                    ctx.lineTo(px, py);
                }
                ctx.stroke();

                // Glow around veins
                ctx.strokeStyle = 'rgba(255, 150, 50, 0.3)';
                ctx.lineWidth = 10 + Math.random() * 8;
                ctx.stroke();
            }

            // Metallic shimmer spots
            for (let i = 0; i < 60; i++) {
                const gradient = ctx.createRadialGradient(
                    Math.random() * size, Math.random() * size, 0,
                    Math.random() * size, Math.random() * size, 3 + Math.random() * 5
                );
                gradient.addColorStop(0, 'rgba(255, 200, 100, 0.8)');
                gradient.addColorStop(0.5, 'rgba(200, 120, 50, 0.4)');
                gradient.addColorStop(1, 'rgba(100, 60, 30, 0)');

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(Math.random() * size, Math.random() * size, 5 + Math.random() * 8, 0, Math.PI * 2);
                ctx.fill();
            }

            // Rock texture overlay
            for (let x = 0; x < size; x += 4) {
                for (let y = 0; y < size; y += 4) {
                    if (Math.random() > 0.7) {
                        ctx.fillStyle = `rgba(${40 + Math.random() * 20}, ${35 + Math.random() * 15}, ${25 + Math.random() * 15}, 0.3)`;
                        ctx.fillRect(x, y, 4, 4);
                    }
                }
            }

            const texture = new BABYLON.DynamicTexture('oreVeinTex', canvas, this.scene, true);
            texture.update();
            return texture;
        },

        generateCrystalTexture: function(size) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');

            // Deep purple base
            const baseGradient = ctx.createLinearGradient(0, 0, size, size);
            baseGradient.addColorStop(0, '#3a1050');
            baseGradient.addColorStop(0.5, '#5a2080');
            baseGradient.addColorStop(1, '#2a0840');
            ctx.fillStyle = baseGradient;
            ctx.fillRect(0, 0, size, size);

            // Internal facet lines (crystal structure)
            ctx.strokeStyle = 'rgba(150, 100, 200, 0.4)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 30; i++) {
                ctx.beginPath();
                const sx = Math.random() * size;
                const sy = Math.random() * size;
                ctx.moveTo(sx, sy);
                // Straight facet-like lines
                const angle = Math.floor(Math.random() * 6) * (Math.PI / 3);
                const len = 30 + Math.random() * 80;
                ctx.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len);
                ctx.stroke();
            }

            // Light refraction spots
            for (let i = 0; i < 25; i++) {
                const x = Math.random() * size;
                const y = Math.random() * size;
                const r = 5 + Math.random() * 15;

                const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
                gradient.addColorStop(0, 'rgba(200, 150, 255, 0.7)');
                gradient.addColorStop(0.5, 'rgba(150, 80, 200, 0.3)');
                gradient.addColorStop(1, 'rgba(100, 50, 150, 0)');

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }

            // Specular highlights (bright spots)
            ctx.fillStyle = 'rgba(255, 220, 255, 0.9)';
            for (let i = 0; i < 15; i++) {
                ctx.beginPath();
                ctx.arc(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 0, Math.PI * 2);
                ctx.fill();
            }

            // Edge darkening for depth
            const edgeGradient = ctx.createRadialGradient(size/2, size/2, size * 0.2, size/2, size/2, size * 0.7);
            edgeGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
            edgeGradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
            ctx.fillStyle = edgeGradient;
            ctx.fillRect(0, 0, size, size);

            const texture = new BABYLON.DynamicTexture('crystalTex', canvas, this.scene, true);
            texture.update();
            return texture;
        },

        generateCrystalGlowTexture: function(size) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');

            // Radial glow gradient
            const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
            gradient.addColorStop(0, 'rgba(255, 200, 255, 1)');
            gradient.addColorStop(0.2, 'rgba(200, 100, 255, 0.9)');
            gradient.addColorStop(0.5, 'rgba(150, 50, 200, 0.5)');
            gradient.addColorStop(0.8, 'rgba(100, 20, 150, 0.2)');
            gradient.addColorStop(1, 'rgba(50, 0, 100, 0)');

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size);

            // Pulsing energy veins
            ctx.strokeStyle = 'rgba(255, 180, 255, 0.5)';
            ctx.lineWidth = 2;
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(size/2, size/2);
                ctx.lineTo(
                    size/2 + Math.cos(angle) * size * 0.4,
                    size/2 + Math.sin(angle) * size * 0.4
                );
                ctx.stroke();
            }

            const texture = new BABYLON.DynamicTexture('crystalGlowTex', canvas, this.scene, true);
            texture.update();
            return texture;
        },

        generateRockDetailTexture: function(size) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');

            // Neutral gray for bump-map-like detail
            ctx.fillStyle = '#808080';
            ctx.fillRect(0, 0, size, size);

            // Random rocky bumps
            for (let i = 0; i < 200; i++) {
                const x = Math.random() * size;
                const y = Math.random() * size;
                const r = 2 + Math.random() * 8;
                const bright = 100 + Math.random() * 50;

                const gradient = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
                gradient.addColorStop(0, `rgb(${bright + 30}, ${bright + 30}, ${bright + 30})`);
                gradient.addColorStop(0.7, `rgb(${bright}, ${bright}, ${bright})`);
                gradient.addColorStop(1, `rgb(${bright - 30}, ${bright - 30}, ${bright - 30})`);

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }

            const texture = new BABYLON.DynamicTexture('rockDetailTex', canvas, this.scene, true);
            texture.update();
            return texture;
        },

        generateAsteroidTexture: function(size) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');

            // Base asteroid gray-brown
            ctx.fillStyle = '#3a3530';
            ctx.fillRect(0, 0, size, size);

            // Multi-scale noise for rocky surface
            for (let pass = 0; pass < 4; pass++) {
                const noiseScale = [16, 8, 4, 2][pass];
                const alpha = [0.4, 0.3, 0.2, 0.15][pass];

                for (let x = 0; x < size; x += noiseScale) {
                    for (let y = 0; y < size; y += noiseScale) {
                        const v = Math.random() * 30 - 15;
                        ctx.fillStyle = `rgba(${58 + v}, ${53 + v}, ${48 + v}, ${alpha})`;
                        ctx.fillRect(x, y, noiseScale, noiseScale);
                    }
                }
            }

            // Impact craters
            for (let i = 0; i < 8 + Math.random() * 6; i++) {
                const cx = Math.random() * size;
                const cy = Math.random() * size;
                const craterSize = 10 + Math.random() * 40;

                // Crater rim (lighter)
                const rimGradient = ctx.createRadialGradient(cx, cy, craterSize * 0.6, cx, cy, craterSize);
                rimGradient.addColorStop(0, 'rgba(80, 75, 70, 0)');
                rimGradient.addColorStop(0.7, 'rgba(90, 85, 80, 0.4)');
                rimGradient.addColorStop(1, 'rgba(70, 65, 60, 0)');
                ctx.fillStyle = rimGradient;
                ctx.beginPath();
                ctx.arc(cx, cy, craterSize, 0, Math.PI * 2);
                ctx.fill();

                // Crater interior (darker)
                const innerGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, craterSize * 0.6);
                innerGradient.addColorStop(0, 'rgba(25, 22, 20, 0.6)');
                innerGradient.addColorStop(0.5, 'rgba(35, 32, 28, 0.4)');
                innerGradient.addColorStop(1, 'rgba(45, 42, 38, 0)');
                ctx.fillStyle = innerGradient;
                ctx.beginPath();
                ctx.arc(cx, cy, craterSize * 0.7, 0, Math.PI * 2);
                ctx.fill();
            }

            // Deep cracks and fissures
            ctx.strokeStyle = 'rgba(20, 18, 15, 0.7)';
            ctx.lineWidth = 2;
            for (let i = 0; i < 12; i++) {
                ctx.beginPath();
                let px = Math.random() * size;
                let py = Math.random() * size;
                ctx.moveTo(px, py);
                for (let j = 0; j < 3 + Math.random() * 4; j++) {
                    px += (Math.random() - 0.5) * 60;
                    py += (Math.random() - 0.5) * 60;
                    ctx.lineTo(px, py);
                }
                ctx.stroke();
            }

            // Highlight edges on cracks
            ctx.strokeStyle = 'rgba(100, 95, 90, 0.2)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 8; i++) {
                ctx.beginPath();
                const sx = Math.random() * size;
                const sy = Math.random() * size;
                ctx.moveTo(sx, sy);
                ctx.lineTo(sx + (Math.random() - 0.5) * 40, sy + (Math.random() - 0.5) * 40);
                ctx.stroke();
            }

            // Small pockmarks
            ctx.fillStyle = 'rgba(30, 28, 25, 0.5)';
            for (let i = 0; i < 60; i++) {
                ctx.beginPath();
                ctx.arc(Math.random() * size, Math.random() * size, 1 + Math.random() * 3, 0, Math.PI * 2);
                ctx.fill();
            }

            // Occasional lighter mineral deposits
            ctx.fillStyle = 'rgba(120, 110, 100, 0.3)';
            for (let i = 0; i < 15; i++) {
                ctx.beginPath();
                ctx.arc(Math.random() * size, Math.random() * size, 2 + Math.random() * 5, 0, Math.PI * 2);
                ctx.fill();
            }

            const texture = new BABYLON.DynamicTexture('asteroidTex', canvas, this.scene, true);
            texture.update();
            return texture;
        },

        generateAsteroidDarkTexture: function(size) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');

            // Darker carbonaceous asteroid
            ctx.fillStyle = '#252220';
            ctx.fillRect(0, 0, size, size);

            // Subtle noise
            for (let pass = 0; pass < 3; pass++) {
                const noiseScale = [8, 4, 2][pass];
                const alpha = [0.3, 0.2, 0.15][pass];

                for (let x = 0; x < size; x += noiseScale) {
                    for (let y = 0; y < size; y += noiseScale) {
                        const v = Math.random() * 20 - 10;
                        ctx.fillStyle = `rgba(${37 + v}, ${34 + v}, ${32 + v}, ${alpha})`;
                        ctx.fillRect(x, y, noiseScale, noiseScale);
                    }
                }
            }

            // Shallow craters
            for (let i = 0; i < 6; i++) {
                const cx = Math.random() * size;
                const cy = Math.random() * size;
                const craterSize = 15 + Math.random() * 30;

                const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, craterSize);
                gradient.addColorStop(0, 'rgba(15, 13, 12, 0.5)');
                gradient.addColorStop(0.7, 'rgba(20, 18, 16, 0.3)');
                gradient.addColorStop(1, 'rgba(30, 27, 25, 0)');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(cx, cy, craterSize, 0, Math.PI * 2);
                ctx.fill();
            }

            // Fine cracks
            ctx.strokeStyle = 'rgba(10, 8, 6, 0.6)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 15; i++) {
                ctx.beginPath();
                let px = Math.random() * size;
                let py = Math.random() * size;
                ctx.moveTo(px, py);
                for (let j = 0; j < 2 + Math.random() * 3; j++) {
                    px += (Math.random() - 0.5) * 40;
                    py += (Math.random() - 0.5) * 40;
                    ctx.lineTo(px, py);
                }
                ctx.stroke();
            }

            const texture = new BABYLON.DynamicTexture('asteroidDarkTex', canvas, this.scene, true);
            texture.update();
            return texture;
        },

        // ===== MATERIAL CREATION (Internal - called once at init) =====
        createOreMaterialsInternal: function() {
            // Rocky base material
            const rockMat = new BABYLON.StandardMaterial('rockShared', this.scene);
            rockMat.diffuseTexture = this.textures.rockSurface;
            rockMat.diffuseColor = new BABYLON.Color3(0.5, 0.45, 0.4);
            rockMat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);

            // Ore vein material (metallic with emissive)
            const oreVeinMat = new BABYLON.StandardMaterial('oreVeinShared', this.scene);
            oreVeinMat.diffuseTexture = this.textures.oreVein;
            oreVeinMat.diffuseColor = new BABYLON.Color3(0.8, 0.5, 0.2);
            oreVeinMat.emissiveColor = new BABYLON.Color3(0.25, 0.12, 0.03);
            oreVeinMat.specularColor = new BABYLON.Color3(0.6, 0.4, 0.2);
            oreVeinMat.specularPower = 32;

            // Exposed ore material (bright metallic)
            const exposedOreMat = new BABYLON.StandardMaterial('exposedOreShared', this.scene);
            exposedOreMat.diffuseColor = new BABYLON.Color3(0.9, 0.6, 0.3);
            exposedOreMat.emissiveColor = new BABYLON.Color3(0.35, 0.18, 0.05);
            exposedOreMat.specularColor = new BABYLON.Color3(0.8, 0.6, 0.3);
            exposedOreMat.specularPower = 64;

            // Small debris material
            const debrisMat = new BABYLON.StandardMaterial('debrisShared', this.scene);
            debrisMat.diffuseTexture = this.textures.rockSurface;
            debrisMat.diffuseColor = new BABYLON.Color3(0.4, 0.35, 0.3);
            debrisMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);

            // Ore glow material
            const oreGlowMat = new BABYLON.StandardMaterial('oreGlowShared', this.scene);
            oreGlowMat.emissiveColor = new BABYLON.Color3(1, 0.5, 0.1);
            oreGlowMat.alpha = 0.6;
            oreGlowMat.disableLighting = true;

            return { rockMat, oreVeinMat, exposedOreMat, debrisMat, oreGlowMat };
        },

        createCrystalMaterialsInternal: function() {
            // Crystal body material
            const crystalMat = new BABYLON.StandardMaterial('crystalShared', this.scene);
            crystalMat.diffuseTexture = this.textures.crystalSurface;
            crystalMat.diffuseColor = new BABYLON.Color3(0.6, 0.2, 0.9);
            crystalMat.emissiveColor = new BABYLON.Color3(0.3, 0.1, 0.5);
            crystalMat.specularColor = new BABYLON.Color3(1, 0.8, 1);
            crystalMat.specularPower = 128;
            crystalMat.alpha = 0.92;

            // Inner glow material
            const innerGlowMat = new BABYLON.StandardMaterial('crystalInnerShared', this.scene);
            innerGlowMat.emissiveColor = new BABYLON.Color3(0.8, 0.4, 1);
            innerGlowMat.alpha = 0.7;
            innerGlowMat.disableLighting = true;

            // Crystal tip material (brighter)
            const tipMat = new BABYLON.StandardMaterial('crystalTipShared', this.scene);
            tipMat.diffuseColor = new BABYLON.Color3(0.8, 0.5, 1);
            tipMat.emissiveColor = new BABYLON.Color3(0.5, 0.25, 0.7);
            tipMat.specularColor = new BABYLON.Color3(1, 1, 1);
            tipMat.specularPower = 256;
            tipMat.alpha = 0.85;

            // Base rock material for crystal cluster
            const baseMat = new BABYLON.StandardMaterial('crystalBaseShared', this.scene);
            baseMat.diffuseTexture = this.textures.rockSurface;
            baseMat.diffuseColor = new BABYLON.Color3(0.35, 0.3, 0.4);
            baseMat.emissiveColor = new BABYLON.Color3(0.1, 0.05, 0.15);
            baseMat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.25);

            return { crystalMat, innerGlowMat, tipMat, baseMat };
        },

        // Internal material creation (used once at init for shared materials)
        createAsteroidMaterialInternal: function(isDark) {
            const type = isDark ? 'dark' : 'light';
            const asteroidMat = new BABYLON.StandardMaterial('asteroidShared_' + type, this.scene);
            asteroidMat.diffuseTexture = isDark ? this.textures.asteroidDark : this.textures.asteroidSurface;

            if (isDark) {
                asteroidMat.diffuseColor = new BABYLON.Color3(0.25, 0.22, 0.2);
                asteroidMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
            } else {
                asteroidMat.diffuseColor = new BABYLON.Color3(0.4, 0.35, 0.3);
                asteroidMat.specularColor = new BABYLON.Color3(0.15, 0.15, 0.15);
            }

            return asteroidMat;
        },

        // ===== ASTEROID GEOMETRY =====
        createAsteroid: function(size, index) {
            const isDark = Math.random() > 0.7; // 30% dark carbonaceous asteroids
            // Use SHARED materials (2 total instead of 200+)
            const mat = isDark ? this.sharedAsteroidMatDark : this.sharedAsteroidMatLight;

            // Create parent for the asteroid
            const parent = new BABYLON.TransformNode('asteroid_' + index, this.scene);

            // Determine asteroid type based on size
            const isLarge = size > 5;
            const isMedium = size > 3 && size <= 5;

            if (isLarge) {
                // Large asteroid: irregular merged rocks
                this.createLargeAsteroid(parent, size, mat);
            } else if (isMedium) {
                // Medium asteroid: deformed icosphere with details
                this.createMediumAsteroid(parent, size, mat);
            } else {
                // Small asteroid: simple deformed rock
                this.createSmallAsteroid(parent, size, mat);
            }

            return parent;
        },

        createLargeAsteroid: function(parent, size, mat) {
            // Main body - heavily deformed icosphere
            const mainBody = BABYLON.MeshBuilder.CreateIcoSphere('mainBody', {
                radius: size * 0.8,
                subdivisions: 2
            }, this.scene);
            mainBody.parent = parent;
            mainBody.material = mat;

            // Deform main body
            const positions = mainBody.getVerticesData(BABYLON.VertexBuffer.PositionKind);
            for (let i = 0; i < positions.length; i += 3) {
                const noise = 0.6 + Math.random() * 0.8;
                positions[i] *= noise;
                positions[i + 1] *= noise * (0.5 + Math.random() * 0.5);
                positions[i + 2] *= noise;
            }
            mainBody.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions);

            // Add 2-4 secondary masses merged into main body
            const numMasses = 2 + Math.floor(Math.random() * 3);
            for (let i = 0; i < numMasses; i++) {
                const angle = Math.random() * Math.PI * 2;
                const elev = (Math.random() - 0.5) * Math.PI * 0.6;
                const dist = size * 0.5;

                const mass = BABYLON.MeshBuilder.CreateIcoSphere('mass' + i, {
                    radius: size * (0.3 + Math.random() * 0.3),
                    subdivisions: 1
                }, this.scene);

                mass.position.x = Math.cos(angle) * Math.cos(elev) * dist;
                mass.position.y = Math.sin(elev) * dist;
                mass.position.z = Math.sin(angle) * Math.cos(elev) * dist;
                mass.parent = parent;
                mass.material = mat;

                // Deform secondary mass
                const massPos = mass.getVerticesData(BABYLON.VertexBuffer.PositionKind);
                for (let j = 0; j < massPos.length; j += 3) {
                    const n = 0.7 + Math.random() * 0.6;
                    massPos[j] *= n;
                    massPos[j + 1] *= n;
                    massPos[j + 2] *= n;
                }
                mass.setVerticesData(BABYLON.VertexBuffer.PositionKind, massPos);
            }

            // Add crater-like indentations (darker spots)
            for (let i = 0; i < 2; i++) {
                const craterAngle = Math.random() * Math.PI * 2;
                const craterElev = (Math.random() - 0.5) * Math.PI * 0.5;
                const craterDist = size * 0.85;

                const crater = BABYLON.MeshBuilder.CreateDisc('crater' + i, {
                    radius: size * (0.15 + Math.random() * 0.1),
                    tessellation: 8
                }, this.scene);

                crater.position.x = Math.cos(craterAngle) * Math.cos(craterElev) * craterDist;
                crater.position.y = Math.sin(craterElev) * craterDist;
                crater.position.z = Math.sin(craterAngle) * Math.cos(craterElev) * craterDist;

                // Orient to face outward
                crater.lookAt(crater.position.scale(2));
                crater.parent = parent;

                // Use shared crater material
                crater.material = this.sharedCraterMat;
            }
        },

        createMediumAsteroid: function(parent, size, mat) {
            // Single deformed icosphere
            const body = BABYLON.MeshBuilder.CreateIcoSphere('body', {
                radius: size,
                subdivisions: 2
            }, this.scene);
            body.parent = parent;
            body.material = mat;

            // Deform for irregular potato shape
            const positions = body.getVerticesData(BABYLON.VertexBuffer.PositionKind);
            for (let i = 0; i < positions.length; i += 3) {
                const noise = 0.65 + Math.random() * 0.7;
                // Elongate in one direction
                positions[i] *= noise * 1.2;
                positions[i + 1] *= noise * 0.8;
                positions[i + 2] *= noise;
            }
            body.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions);

            // Add one bump
            if (Math.random() > 0.5) {
                const bump = BABYLON.MeshBuilder.CreateIcoSphere('bump', {
                    radius: size * 0.35,
                    subdivisions: 1
                }, this.scene);
                const angle = Math.random() * Math.PI * 2;
                bump.position.x = Math.cos(angle) * size * 0.6;
                bump.position.z = Math.sin(angle) * size * 0.6;
                bump.parent = parent;
                bump.material = mat;
            }
        },

        createSmallAsteroid: function(parent, size, mat) {
            // Simple deformed icosphere
            const body = BABYLON.MeshBuilder.CreateIcoSphere('body', {
                radius: size,
                subdivisions: 1
            }, this.scene);
            body.parent = parent;
            body.material = mat;

            // Slight deformation
            const positions = body.getVerticesData(BABYLON.VertexBuffer.PositionKind);
            for (let i = 0; i < positions.length; i += 3) {
                const noise = 0.75 + Math.random() * 0.5;
                positions[i] *= noise;
                positions[i + 1] *= noise;
                positions[i + 2] *= noise;
            }
            body.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
        },

        // ===== ORE DEPOSIT GEOMETRY =====
        createOreDeposit: function(parent, oreSize, oreAmount, maxAmount) {
            // Use SHARED materials (created once at init)
            const mats = this.sharedOreMats;
            const scale = oreSize / 6; // Normalize to expected size

            // Main rocky base (deformed icosphere)
            const mainRock = BABYLON.MeshBuilder.CreateIcoSphere('mainRock', {
                radius: 3.5 * scale,
                subdivisions: 2
            }, this.scene);
            mainRock.parent = parent;
            mainRock.material = mats.rockMat;

            // Deform vertices for irregular shape
            const positions = mainRock.getVerticesData(BABYLON.VertexBuffer.PositionKind);
            for (let i = 0; i < positions.length; i += 3) {
                const noise = 0.7 + Math.random() * 0.6;
                positions[i] *= noise;
                positions[i + 1] *= noise * (0.6 + Math.random() * 0.4); // Flatten slightly
                positions[i + 2] *= noise;
            }
            mainRock.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
            mainRock.position.y = 1.5 * scale;

            // Secondary rock formations
            for (let i = 0; i < 3; i++) {
                const angle = (i / 3) * Math.PI * 2 + Math.random() * 0.5;
                const dist = 2 + Math.random() * 1.5;

                const rock = BABYLON.MeshBuilder.CreateIcoSphere('sideRock' + i, {
                    radius: (1.5 + Math.random() * 1) * scale,
                    subdivisions: 1
                }, this.scene);
                rock.position.x = Math.cos(angle) * dist * scale;
                rock.position.z = Math.sin(angle) * dist * scale;
                rock.position.y = (0.5 + Math.random() * 1) * scale;
                rock.parent = parent;
                rock.material = mats.rockMat;

                // Deform secondary rocks too
                const pos = rock.getVerticesData(BABYLON.VertexBuffer.PositionKind);
                for (let j = 0; j < pos.length; j += 3) {
                    pos[j] *= 0.8 + Math.random() * 0.4;
                    pos[j + 1] *= 0.6 + Math.random() * 0.4;
                    pos[j + 2] *= 0.8 + Math.random() * 0.4;
                }
                rock.setVerticesData(BABYLON.VertexBuffer.PositionKind, pos);
            }

            // Exposed ore vein patches on surface
            const richness = oreAmount / maxAmount;
            const veinCount = 2 + Math.floor(richness * 4);

            for (let i = 0; i < veinCount; i++) {
                const veinAngle = Math.random() * Math.PI * 2;
                const veinElev = Math.random() * Math.PI * 0.4 + 0.2;

                const vein = BABYLON.MeshBuilder.CreateDisc('oreVein' + i, {
                    radius: (0.8 + Math.random() * 0.6) * scale,
                    tessellation: 6
                }, this.scene);

                // Position on surface of main rock
                const veinDist = 3.2 * scale;
                vein.position.x = Math.cos(veinAngle) * Math.cos(veinElev) * veinDist;
                vein.position.y = Math.sin(veinElev) * veinDist + 1.5 * scale;
                vein.position.z = Math.sin(veinAngle) * Math.cos(veinElev) * veinDist;

                // Orient to face outward
                vein.lookAt(new BABYLON.Vector3(
                    vein.position.x * 2,
                    vein.position.y * 2,
                    vein.position.z * 2
                ));

                vein.parent = parent;
                vein.material = mats.exposedOreMat;
            }

            // Small rock debris around base
            for (let i = 0; i < 6 + Math.floor(Math.random() * 4); i++) {
                const debrisAngle = Math.random() * Math.PI * 2;
                const debrisDist = 3.5 + Math.random() * 2;

                const debris = BABYLON.MeshBuilder.CreateIcoSphere('debris' + i, {
                    radius: (0.3 + Math.random() * 0.4) * scale,
                    subdivisions: 0
                }, this.scene);
                debris.position.x = Math.cos(debrisAngle) * debrisDist * scale;
                debris.position.z = Math.sin(debrisAngle) * debrisDist * scale;
                debris.position.y = 0.15 * scale;
                debris.rotation.set(Math.random(), Math.random(), Math.random());
                debris.parent = parent;
                debris.material = mats.debrisMat;
            }

            // Glowing ore seams (emissive for richness indication)
            if (richness > 0.5) {
                const glowSeam = BABYLON.MeshBuilder.CreateTorus('oreGlow', {
                    diameter: 5 * scale,
                    thickness: 0.3 * scale * richness,
                    tessellation: 16
                }, this.scene);
                glowSeam.position.y = 1 * scale;
                glowSeam.rotation.x = Math.PI / 2;
                glowSeam.parent = parent;
                glowSeam.material = mats.oreGlowMat;
            }

            return { mats };
        },

        // ===== CRYSTAL CLUSTER GEOMETRY =====
        createCrystalCluster: function(parent, crystalSize, crystalAmount, maxAmount) {
            // Use SHARED materials (created once at init)
            const mats = this.sharedCrystalMats;
            const scale = crystalSize / 8; // Normalize to expected size
            const richness = crystalAmount / maxAmount;

            // Rocky base for crystal cluster
            const base = BABYLON.MeshBuilder.CreateCylinder('crystalBase', {
                height: 1.5 * scale,
                diameterTop: 3 * scale,
                diameterBottom: 4 * scale,
                tessellation: 8
            }, this.scene);
            base.position.y = 0.75 * scale;
            base.parent = parent;
            base.material = mats.baseMat;

            // Add rocky texture to base
            const basePositions = base.getVerticesData(BABYLON.VertexBuffer.PositionKind);
            for (let i = 0; i < basePositions.length; i += 3) {
                basePositions[i] *= 0.9 + Math.random() * 0.2;
                basePositions[i + 2] *= 0.9 + Math.random() * 0.2;
            }
            base.setVerticesData(BABYLON.VertexBuffer.PositionKind, basePositions);

            // Create hexagonal crystal prisms
            const crystalCount = 5 + Math.floor(richness * 4);

            for (let i = 0; i < crystalCount; i++) {
                const isPrimary = i < 3;
                const crystalHeight = isPrimary ?
                    (4 + Math.random() * 3) * scale :
                    (2 + Math.random() * 2) * scale;
                const crystalRadius = isPrimary ?
                    (0.6 + Math.random() * 0.3) * scale :
                    (0.3 + Math.random() * 0.25) * scale;

                // Hexagonal prism crystal
                const crystal = BABYLON.MeshBuilder.CreateCylinder('crystal' + i, {
                    height: crystalHeight,
                    diameterTop: crystalRadius * 0.3,
                    diameterBottom: crystalRadius,
                    tessellation: 6
                }, this.scene);

                // Position crystals in cluster
                const angle = (i / crystalCount) * Math.PI * 2 + Math.random() * 0.5;
                const dist = isPrimary ? Math.random() * 1 : 0.8 + Math.random() * 1.2;

                crystal.position.x = Math.cos(angle) * dist * scale;
                crystal.position.z = Math.sin(angle) * dist * scale;
                crystal.position.y = crystalHeight / 2 + 1 * scale;

                // Angled orientations for natural look
                crystal.rotation.x = (Math.random() - 0.5) * 0.4;
                crystal.rotation.z = (Math.random() - 0.5) * 0.4;

                crystal.parent = parent;
                crystal.material = isPrimary ? mats.crystalMat : mats.tipMat;

                // Inner glow core for primary crystals
                if (isPrimary && richness > 0.3) {
                    const innerCore = BABYLON.MeshBuilder.CreateCylinder('innerCore' + i, {
                        height: crystalHeight * 0.8,
                        diameterTop: crystalRadius * 0.15,
                        diameterBottom: crystalRadius * 0.5,
                        tessellation: 6
                    }, this.scene);
                    innerCore.position = crystal.position.clone();
                    innerCore.rotation = crystal.rotation.clone();
                    innerCore.parent = parent;
                    innerCore.material = mats.innerGlowMat;
                }
            }

            // Small crystal shards around base
            for (let i = 0; i < 4 + Math.floor(Math.random() * 3); i++) {
                const shardAngle = Math.random() * Math.PI * 2;
                const shardDist = 2.5 + Math.random() * 1.5;

                const shard = BABYLON.MeshBuilder.CreateCylinder('shard' + i, {
                    height: (1 + Math.random() * 0.8) * scale,
                    diameterTop: 0,
                    diameterBottom: 0.25 * scale,
                    tessellation: 6
                }, this.scene);
                shard.position.x = Math.cos(shardAngle) * shardDist * scale;
                shard.position.z = Math.sin(shardAngle) * shardDist * scale;
                shard.position.y = 0.5 * scale;
                shard.rotation.x = (Math.random() - 0.5) * 0.8;
                shard.rotation.z = (Math.random() - 0.5) * 0.8;
                shard.parent = parent;
                shard.material = mats.tipMat;
            }

            // Energy glow at base for rich crystals
            if (richness > 0.4) {
                const baseGlow = BABYLON.MeshBuilder.CreateDisc('baseGlow', {
                    radius: 3.5 * scale * richness,
                    tessellation: 24
                }, this.scene);
                baseGlow.position.y = 0.1 * scale;
                baseGlow.rotation.x = Math.PI / 2;
                baseGlow.parent = parent;

                // Use shared glow material
                baseGlow.material = this.sharedCrystalBaseGlowMat;
            }

            return { mats };
        },

        // ===== UPDATE METHODS FOR VISUAL FEEDBACK =====
        updateOreVisual: function(oreNode, currentAmount, maxAmount) {
            if (!oreNode.mesh) return;

            const ratio = currentAmount / maxAmount;
            const scale = 0.3 + 0.7 * ratio;
            oreNode.mesh.scaling.setAll(scale);

            // Update glow intensity based on remaining ore
            if (oreNode.enhancedMats && oreNode.enhancedMats.oreGlowMat) {
                oreNode.enhancedMats.oreGlowMat.alpha = 0.3 + 0.4 * ratio;
            }
        },

        updateCrystalVisual: function(crystalNode, currentAmount, maxAmount) {
            if (!crystalNode.mesh) return;

            const ratio = currentAmount / maxAmount;
            const scale = 0.3 + 0.7 * ratio;
            crystalNode.mesh.scaling.setAll(scale);

            // Update inner glow based on remaining crystal
            if (crystalNode.enhancedMats && crystalNode.enhancedMats.innerGlowMat) {
                crystalNode.enhancedMats.innerGlowMat.alpha = 0.4 + 0.4 * ratio;
            }
        }
    };

    // Export to window
    window.VoidOreEnhanced = VoidOreEnhanced;

})(window);

console.log('VoidOre Enhanced module loaded - detailed ore and crystal models ready');
