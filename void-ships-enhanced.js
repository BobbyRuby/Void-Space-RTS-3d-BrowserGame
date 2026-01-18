// ============================================================
// VOID SUPREMACY 3D - Enhanced Ship Models & Textures
// Place this file in the same directory as the main game HTML
// Ships will automatically use enhanced models when this file is loaded
// ============================================================
// Now with quality-aware tessellation, smooth geometry, and normal maps

(function(window) {
    'use strict';

    // Quality settings cache (updated when graphics change)
    let currentTessellation = {
        sphere: 8,
        cylinder: 10,
        box: 1,
        tube: 12,
        torus: 18,
        useNormalMaps: true,
        useFresnel: false,
        mergeMeshes: true
    };

    const VoidShipsEnhanced = {
        initialized: false,
        scene: null,
        textures: {},
        normalMaps: {},

        // Initialize with Babylon scene
        init: function(babylonScene) {
            if (this.initialized) return;
            this.scene = babylonScene;
            this.createProceduralTextures();
            this.createNormalMaps();
            this.updateQualitySettings();
            this.initialized = true;
            console.log('VoidShips Enhanced: Detailed ship models loaded with smooth geometry');
        },

        // Update quality settings from game config
        updateQualitySettings: function() {
            // Try to get settings from global config if available
            if (window.GRAPHICS_SETTINGS && window.graphicsLevel) {
                const settings = window.GRAPHICS_SETTINGS[window.graphicsLevel];
                if (settings && settings.tessellation) {
                    currentTessellation = { ...currentTessellation, ...settings.tessellation };
                }
            }
        },

        // ===== PROCEDURAL TEXTURE GENERATION =====
        createProceduralTextures: function() {
            this.textures.hullPlating = this.generateHullTexture(512);
            this.textures.panelLines = this.generatePanelTexture(512);
            this.textures.engineGlow = this.generateEngineTexture(128);
        },

        // ===== NORMAL MAP GENERATION =====
        createNormalMaps: function() {
            this.normalMaps.hull = this.generateHullNormalMap(512);
            this.normalMaps.panel = this.generatePanelNormalMap(256);
            this.normalMaps.armor = this.generateArmorNormalMap(256);
        },

        generateHullTexture: function(size) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');

            // Base metallic color
            ctx.fillStyle = '#2a3a4a';
            ctx.fillRect(0, 0, size, size);

            // Panel grid
            ctx.strokeStyle = '#1a2a3a';
            ctx.lineWidth = 2;
            const panelW = 64, panelH = 32;

            for (let x = 0; x < size; x += panelW) {
                for (let y = 0; y < size; y += panelH) {
                    const v = Math.random() * 20 - 10;
                    ctx.fillStyle = `rgb(${42 + v}, ${58 + v}, ${74 + v})`;
                    ctx.fillRect(x + 2, y + 2, panelW - 4, panelH - 4);
                    ctx.strokeRect(x, y, panelW, panelH);

                    // Rivets
                    if (Math.random() > 0.7) {
                        ctx.fillStyle = '#1a2a3a';
                        ctx.beginPath();
                        ctx.arc(x + 8 + Math.random() * (panelW - 16), y + 8 + Math.random() * (panelH - 16), 2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }

            // Scratches
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 30; i++) {
                ctx.beginPath();
                const sx = Math.random() * size;
                const sy = Math.random() * size;
                ctx.moveTo(sx, sy);
                ctx.lineTo(sx + (Math.random() - 0.5) * 60, sy + (Math.random() - 0.5) * 60);
                ctx.stroke();
            }

            const texture = new BABYLON.DynamicTexture('hullTex', canvas, this.scene, true);
            texture.update();
            return texture;
        },

        generatePanelTexture: function(size) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#1a1a2a';
            ctx.fillRect(0, 0, size, size);

            ctx.strokeStyle = '#3a4a5a';
            ctx.lineWidth = 1;

            for (let y = 0; y < size; y += 16) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(size, y);
                ctx.stroke();
            }

            for (let x = 0; x < size; x += 32) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, size);
                ctx.stroke();

                if (Math.random() > 0.5) {
                    ctx.fillStyle = '#2a3a4a';
                    ctx.fillRect(x + 4, Math.random() * size, 24, 8);
                }
            }

            // Accent lights
            ctx.fillStyle = '#00aaff';
            for (let i = 0; i < 20; i++) {
                ctx.fillRect(Math.random() * size, Math.random() * size, 4, 2);
            }

            const texture = new BABYLON.DynamicTexture('panelTex', canvas, this.scene, true);
            texture.update();
            return texture;
        },

        generateEngineTexture: function(size) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');

            const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
            gradient.addColorStop(0.2, 'rgba(100, 200, 255, 1)');
            gradient.addColorStop(0.5, 'rgba(0, 150, 255, 0.8)');
            gradient.addColorStop(1, 'rgba(0, 50, 100, 0)');

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size);

            const texture = new BABYLON.DynamicTexture('engineTex', canvas, this.scene, true);
            texture.update();
            return texture;
        },

        // ===== NORMAL MAP GENERATION =====
        generateHullNormalMap: function(size) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');

            // Base neutral normal
            ctx.fillStyle = 'rgb(128, 128, 255)';
            ctx.fillRect(0, 0, size, size);

            const panelW = 64, panelH = 32;

            for (let x = 0; x < size; x += panelW) {
                for (let y = 0; y < size; y += panelH) {
                    const bevelSize = 4;

                    // Edge bevels for depth
                    const gradLeft = ctx.createLinearGradient(x, y, x + bevelSize, y);
                    gradLeft.addColorStop(0, 'rgb(100, 128, 255)');
                    gradLeft.addColorStop(1, 'rgb(128, 128, 255)');
                    ctx.fillStyle = gradLeft;
                    ctx.fillRect(x, y, bevelSize, panelH);

                    const gradRight = ctx.createLinearGradient(x + panelW - bevelSize, y, x + panelW, y);
                    gradRight.addColorStop(0, 'rgb(128, 128, 255)');
                    gradRight.addColorStop(1, 'rgb(156, 128, 255)');
                    ctx.fillStyle = gradRight;
                    ctx.fillRect(x + panelW - bevelSize, y, bevelSize, panelH);

                    const gradTop = ctx.createLinearGradient(x, y, x, y + bevelSize);
                    gradTop.addColorStop(0, 'rgb(128, 100, 255)');
                    gradTop.addColorStop(1, 'rgb(128, 128, 255)');
                    ctx.fillStyle = gradTop;
                    ctx.fillRect(x, y, panelW, bevelSize);

                    const gradBottom = ctx.createLinearGradient(x, y + panelH - bevelSize, x, y + panelH);
                    gradBottom.addColorStop(0, 'rgb(128, 128, 255)');
                    gradBottom.addColorStop(1, 'rgb(128, 156, 255)');
                    ctx.fillStyle = gradBottom;
                    ctx.fillRect(x, y + panelH - bevelSize, panelW, bevelSize);

                    // Rivets
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

            const texture = new BABYLON.DynamicTexture('hullNormal', canvas, this.scene, true);
            texture.update();
            return texture;
        },

        generatePanelNormalMap: function(size) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = 'rgb(128, 128, 255)';
            ctx.fillRect(0, 0, size, size);

            ctx.strokeStyle = 'rgb(128, 115, 245)';
            ctx.lineWidth = 2;
            for (let y = 16; y < size; y += 16) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(size, y);
                ctx.stroke();
            }

            ctx.strokeStyle = 'rgb(115, 128, 245)';
            for (let x = 32; x < size; x += 32) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, size);
                ctx.stroke();
            }

            const texture = new BABYLON.DynamicTexture('panelNormal', canvas, this.scene, true);
            texture.update();
            return texture;
        },

        generateArmorNormalMap: function(size) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = 'rgb(128, 128, 255)';
            ctx.fillRect(0, 0, size, size);

            // Hexagonal armor pattern
            const hexSize = 24;
            const rows = Math.ceil(size / (hexSize * 1.5));
            const cols = Math.ceil(size / (hexSize * Math.sqrt(3)));

            ctx.strokeStyle = 'rgb(100, 100, 230)';
            ctx.lineWidth = 2;

            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const x = col * hexSize * Math.sqrt(3) + (row % 2) * hexSize * Math.sqrt(3) / 2;
                    const y = row * hexSize * 1.5;
                    this.drawHexagon(ctx, x, y, hexSize * 0.9);
                }
            }

            const texture = new BABYLON.DynamicTexture('armorNormal', canvas, this.scene, true);
            texture.update();
            return texture;
        },

        drawHexagon: function(ctx, x, y, size) {
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = Math.PI / 3 * i - Math.PI / 6;
                const px = x + size * Math.cos(angle);
                const py = y + size * Math.sin(angle);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();
        },

        // ===== SMOOTH GEOMETRY HELPERS =====

        // Create a tapered tube hull using CreateTube
        createTaperedHull: function(name, options) {
            const {
                length = 4,
                frontRadius = 0.1,
                backRadius = 0.5,
                midBulge = 1.0,
                taperStart = 0.6
            } = options;

            const pathSegments = currentTessellation.tube;
            const path = [];

            for (let i = 0; i <= pathSegments; i++) {
                const t = i / pathSegments;
                path.push(new BABYLON.Vector3(0, 0, (t - 0.5) * length));
            }

            const radiusFunction = (i, distance) => {
                const t = i / pathSegments;
                if (t < taperStart) {
                    const frontT = t / taperStart;
                    const eased = (1 - Math.cos(frontT * Math.PI)) / 2;
                    return frontRadius + (backRadius * midBulge - frontRadius) * eased;
                } else {
                    const backT = (t - taperStart) / (1 - taperStart);
                    const maxRadius = backRadius * midBulge;
                    return maxRadius - (maxRadius - backRadius) * backT * backT;
                }
            };

            const hull = BABYLON.MeshBuilder.CreateTube(name, {
                path: path,
                radiusFunction: radiusFunction,
                tessellation: currentTessellation.cylinder,
                cap: BABYLON.Mesh.CAP_ALL
            }, this.scene);

            hull.rotation.y = Math.PI;
            return hull;
        },

        // Create smooth cylinder with quality-aware tessellation
        createSmoothCylinder: function(name, options) {
            return BABYLON.MeshBuilder.CreateCylinder(name, {
                ...options,
                tessellation: options.tessellation || currentTessellation.cylinder
            }, this.scene);
        },

        // Create smooth sphere with quality-aware tessellation
        createSmoothSphere: function(name, options) {
            return BABYLON.MeshBuilder.CreateSphere(name, {
                ...options,
                segments: options.segments || currentTessellation.sphere
            }, this.scene);
        },

        // Create engine nacelle with smooth shape
        createEngineNacelle: function(name, length, radius, nozzleRadius) {
            const pathSegments = currentTessellation.tube;
            const path = [];

            for (let i = 0; i <= pathSegments; i++) {
                const t = i / pathSegments;
                path.push(new BABYLON.Vector3(0, 0, (t - 0.5) * length));
            }

            const radiusFunction = (i, distance) => {
                const t = i / pathSegments;
                if (t < 0.2) {
                    const localT = t / 0.2;
                    return radius * 0.8 + radius * 0.2 * (1 - Math.cos(localT * Math.PI)) / 2;
                } else if (t > 0.75) {
                    const localT = (t - 0.75) / 0.25;
                    return radius + (nozzleRadius - radius) * localT * localT;
                }
                return radius;
            };

            return BABYLON.MeshBuilder.CreateTube(name, {
                path: path,
                radiusFunction: radiusFunction,
                tessellation: currentTessellation.cylinder,
                cap: BABYLON.Mesh.CAP_ALL
            }, this.scene);
        },

        // ===== MATERIAL CREATION =====
        createShipMaterials: function(r, g, b, team) {
            const id = Math.random().toString(36).substr(2, 6);

            const hullMat = new BABYLON.StandardMaterial('hull_' + id, this.scene);
            hullMat.diffuseTexture = this.textures.hullPlating;
            hullMat.diffuseColor = new BABYLON.Color3(r * 0.6, g * 0.6, b * 0.6);
            hullMat.emissiveColor = new BABYLON.Color3(r * 0.15, g * 0.15, b * 0.15);
            hullMat.specularColor = new BABYLON.Color3(0.4, 0.4, 0.5);

            // Apply normal map if enabled
            if (currentTessellation.useNormalMaps && this.normalMaps.hull) {
                hullMat.bumpTexture = this.normalMaps.hull;
            }

            const armorMat = new BABYLON.StandardMaterial('armor_' + id, this.scene);
            armorMat.diffuseColor = new BABYLON.Color3(0.35, 0.35, 0.4);
            armorMat.specularColor = new BABYLON.Color3(0.6, 0.6, 0.6);

            if (currentTessellation.useNormalMaps && this.normalMaps.armor) {
                armorMat.bumpTexture = this.normalMaps.armor;
            }

            const glassMat = new BABYLON.StandardMaterial('glass_' + id, this.scene);
            glassMat.diffuseColor = new BABYLON.Color3(0.1, 0.2, 0.3);
            glassMat.specularColor = new BABYLON.Color3(1, 1, 1);
            glassMat.alpha = 0.7;

            // Try to use animated engine glow shader from MaterialPool if available
            let engineMat;
            if (window.MaterialPool && typeof window.MaterialPool.getEngineGlowMaterial === 'function') {
                engineMat = window.MaterialPool.getEngineGlowMaterial(team);
            } else {
                // Fallback to standard emissive material
                engineMat = new BABYLON.StandardMaterial('engine_' + id, this.scene);
                engineMat.emissiveColor = team === 0 ? new BABYLON.Color3(0, 0.8, 1) : new BABYLON.Color3(1, 0.5, 0);
                engineMat.alpha = 0.9;
                engineMat.disableLighting = true;
            }

            const weaponMat = new BABYLON.StandardMaterial('weapon_' + id, this.scene);
            weaponMat.emissiveColor = new BABYLON.Color3(1, 0.3, 0.1);
            weaponMat.alpha = 0.8;
            weaponMat.disableLighting = true;

            return { hullMat, armorMat, glassMat, engineMat, weaponMat };
        },

        // ===== SHIP MODEL CREATORS (Updated with smooth geometry) =====

        createScout: function(parent, s, mats) {
            // Sleek needle fuselage using tapered tube
            const fuselage = this.createTaperedHull('f', {
                length: 4 * s,
                frontRadius: 0.1 * s,
                backRadius: 0.75 * s,
                midBulge: 1.1,
                taperStart: 0.7
            });
            fuselage.parent = parent;
            fuselage.material = mats.hullMat;

            // Cockpit (smooth sphere)
            const cockpit = this.createSmoothSphere('c', { diameter: 1.2 * s, slice: 0.5 });
            cockpit.position.set(0, 0.3 * s, 0.5 * s);
            cockpit.rotation.x = -Math.PI / 2;
            cockpit.parent = parent;
            cockpit.material = mats.glassMat;

            // Wings (keep boxes but with improved detail)
            for (let i = 0; i < 2; i++) {
                const wing = BABYLON.MeshBuilder.CreateBox('w' + i, { width: 2.5 * s, height: 0.1 * s, depth: 1 * s }, this.scene);
                wing.position.set((i === 0 ? -1.2 : 1.2) * s, 0, -0.3 * s);
                wing.rotation.z = (i === 0 ? 0.3 : -0.3);
                wing.parent = parent;
                wing.material = mats.hullMat;

                const tip = this.createSmoothSphere('t' + i, { diameter: 0.25 * s });
                tip.position.set((i === 0 ? -2.4 : 2.4) * s, 0, -0.3 * s);
                tip.parent = parent;
                tip.material = mats.engineMat;
            }

            // Engine nacelle
            const engine = this.createEngineNacelle('e', 0.8 * s, 0.3 * s, 0.35 * s);
            engine.rotation.x = Math.PI / 2;
            engine.position.z = -2.2 * s;
            engine.parent = parent;
            engine.material = mats.hullMat;

            const glow = this.createSmoothSphere('g', { diameter: 0.7 * s });
            glow.position.z = -2.5 * s;
            glow.parent = parent;
            glow.material = mats.engineMat;
        },

        createInterceptor: function(parent, s, mats) {
            // Angular body with tapered hull
            const body = this.createTaperedHull('b', {
                length: 5 * s,
                frontRadius: 0.1 * s,
                backRadius: 0.6 * s,
                midBulge: 1.2,
                taperStart: 0.6
            });
            body.parent = parent;
            body.material = mats.hullMat;

            // Cockpit
            const cockpit = BABYLON.MeshBuilder.CreateBox('c', { width: 0.8 * s, height: 0.5 * s, depth: 1.5 * s }, this.scene);
            cockpit.position.set(0, 0.4 * s, 1 * s);
            cockpit.parent = parent;
            cockpit.material = mats.glassMat;

            // Delta wings with weapons
            for (let i = 0; i < 2; i++) {
                const side = i === 0 ? -1 : 1;
                const wing = BABYLON.MeshBuilder.CreateBox('w' + i, { width: 3 * s, height: 0.15 * s, depth: 2.5 * s }, this.scene);
                wing.position.set(side * 2 * s, 0, -0.5 * s);
                wing.parent = parent;
                wing.material = mats.hullMat;

                const pod = this.createSmoothCylinder('p' + i, { height: 2 * s, diameter: 0.4 * s });
                pod.rotation.x = Math.PI / 2;
                pod.position.set(side * 2.5 * s, 0, 0);
                pod.parent = parent;
                pod.material = mats.armorMat;

                const muzzle = this.createSmoothSphere('m' + i, { diameter: 0.3 * s });
                muzzle.position.set(side * 2.5 * s, 0, 1 * s);
                muzzle.parent = parent;
                muzzle.material = mats.weaponMat;
            }

            // Twin engines
            for (let i = 0; i < 2; i++) {
                const side = i === 0 ? -0.5 : 0.5;
                const engine = this.createEngineNacelle('e' + i, 2 * s, 0.25 * s, 0.35 * s);
                engine.rotation.x = Math.PI / 2;
                engine.position.set(side * s, 0, -3 * s);
                engine.parent = parent;
                engine.material = mats.hullMat;

                const glow = this.createSmoothSphere('g' + i, { diameter: 0.6 * s });
                glow.position.set(side * s, 0, -3.8 * s);
                glow.parent = parent;
                glow.material = mats.engineMat;
            }

            // Stabilizers
            for (let i = 0; i < 2; i++) {
                const stab = BABYLON.MeshBuilder.CreateBox('s' + i, { width: 0.1 * s, height: 1.2 * s, depth: 1.5 * s }, this.scene);
                stab.position.set((i === 0 ? -0.6 : 0.6) * s, 0.6 * s, -2 * s);
                stab.rotation.z = (i === 0 ? 0.3 : -0.3);
                stab.parent = parent;
                stab.material = mats.hullMat;
            }
        },

        createStriker: function(parent, s, mats) {
            // Central fuselage with smooth taper
            const fuselage = this.createTaperedHull('f', {
                length: 6 * s,
                frontRadius: 0.15 * s,
                backRadius: 0.9 * s,
                midBulge: 1.1,
                taperStart: 0.65
            });
            fuselage.parent = parent;
            fuselage.material = mats.hullMat;

            // Cockpit canopy
            const canopy = BABYLON.MeshBuilder.CreateBox('c', { width: 1.2 * s, height: 0.6 * s, depth: 2 * s }, this.scene);
            canopy.position.set(0, 0.6 * s, 1.5 * s);
            canopy.parent = parent;
            canopy.material = mats.glassMat;

            // Forward-swept wings
            for (let i = 0; i < 2; i++) {
                const side = i === 0 ? -1 : 1;
                const wing = BABYLON.MeshBuilder.CreateBox('w' + i, { width: 4 * s, height: 0.2 * s, depth: 2 * s }, this.scene);
                wing.position.set(side * 2.8 * s, 0, 1 * s);
                wing.rotation.y = side * 0.2;
                wing.parent = parent;
                wing.material = mats.hullMat;

                // Hardpoints
                for (let j = 0; j < 2; j++) {
                    const hp = this.createSmoothCylinder('hp' + i + j, { height: 1.5 * s, diameter: 0.35 * s });
                    hp.rotation.x = Math.PI / 2;
                    hp.position.set(side * (2 + j * 1.5) * s, -0.3 * s, 1 * s);
                    hp.parent = parent;
                    hp.material = mats.armorMat;
                }

                const thruster = this.createSmoothSphere('th' + i, { diameter: 0.4 * s });
                thruster.position.set(side * 4.5 * s, 0, 1.5 * s);
                thruster.parent = parent;
                thruster.material = mats.engineMat;
            }

            // Triple engines
            [-0.7, 0, 0.7].forEach((xOff, idx) => {
                const engine = this.createEngineNacelle('e' + idx, 2 * s, 0.3 * s, 0.4 * s);
                engine.rotation.x = Math.PI / 2;
                engine.position.set(xOff * s, 0, -3.5 * s);
                engine.parent = parent;
                engine.material = mats.hullMat;

                const glow = this.createSmoothSphere('g' + idx, { diameter: 0.7 * s });
                glow.position.set(xOff * s, 0, -4.2 * s);
                glow.parent = parent;
                glow.material = mats.engineMat;
            });

            // Tail fin
            const tail = BABYLON.MeshBuilder.CreateBox('t', { width: 0.15 * s, height: 1.8 * s, depth: 2 * s }, this.scene);
            tail.position.set(0, 0.9 * s, -2 * s);
            tail.parent = parent;
            tail.material = mats.hullMat;
        },

        createHeavy: function(parent, s, mats) {
            // Thick armored body
            const body = BABYLON.MeshBuilder.CreateBox('b', { width: 3 * s, height: 1.5 * s, depth: 7 * s }, this.scene);
            body.parent = parent;
            body.material = mats.hullMat;

            // Side armor plates
            for (let i = 0; i < 2; i++) {
                const side = i === 0 ? -1 : 1;
                const plate = BABYLON.MeshBuilder.CreateBox('pl' + i, { width: 0.3 * s, height: 1.8 * s, depth: 5 * s }, this.scene);
                plate.position.set(side * 1.6 * s, 0, -0.5 * s);
                plate.parent = parent;
                plate.material = mats.armorMat;
            }

            // Heavy nose with chin cannon
            const nose = BABYLON.MeshBuilder.CreateBox('n', { width: 2.5 * s, height: 1.2 * s, depth: 3 * s }, this.scene);
            nose.position.z = 4.5 * s;
            nose.parent = parent;
            nose.material = mats.hullMat;

            const cannon = this.createSmoothCylinder('cn', { height: 4 * s, diameter: 0.5 * s });
            cannon.rotation.x = Math.PI / 2;
            cannon.position.set(0, -0.7 * s, 5 * s);
            cannon.parent = parent;
            cannon.material = mats.armorMat;

            const muzzle = this.createSmoothSphere('mz', { diameter: 0.5 * s });
            muzzle.position.set(0, -0.7 * s, 7 * s);
            muzzle.parent = parent;
            muzzle.material = mats.weaponMat;

            // Cockpit
            const cockpit = BABYLON.MeshBuilder.CreateBox('c', { width: 1.5 * s, height: 0.8 * s, depth: 2 * s }, this.scene);
            cockpit.position.set(0, 1 * s, 2 * s);
            cockpit.parent = parent;
            cockpit.material = mats.glassMat;

            // Stub wings with missile pods
            for (let i = 0; i < 2; i++) {
                const side = i === 0 ? -1 : 1;
                const wing = BABYLON.MeshBuilder.CreateBox('w' + i, { width: 2.5 * s, height: 0.4 * s, depth: 3 * s }, this.scene);
                wing.position.set(side * 2.5 * s, 0, 0);
                wing.parent = parent;
                wing.material = mats.hullMat;

                const pod = BABYLON.MeshBuilder.CreateBox('pd' + i, { width: 1 * s, height: 0.8 * s, depth: 2.5 * s }, this.scene);
                pod.position.set(side * 3.2 * s, -0.4 * s, 0);
                pod.parent = parent;
                pod.material = mats.armorMat;

                for (let j = 0; j < 3; j++) {
                    const tube = this.createSmoothCylinder('tb' + i + j, { height: 0.3 * s, diameter: 0.25 * s });
                    tube.rotation.x = Math.PI / 2;
                    tube.position.set(side * 3.2 * s, (-0.2 + j * -0.3) * s, 1.3 * s);
                    tube.parent = parent;
                    tube.material = mats.weaponMat;
                }
            }

            // Quad engines
            [{x: -1, y: 0.3}, {x: 1, y: 0.3}, {x: -1, y: -0.3}, {x: 1, y: -0.3}].forEach((offset, idx) => {
                const engine = this.createEngineNacelle('e' + idx, 2.5 * s, 0.35 * s, 0.45 * s);
                engine.rotation.x = Math.PI / 2;
                engine.position.set(offset.x * s, offset.y * s, -4.5 * s);
                engine.parent = parent;
                engine.material = mats.hullMat;

                const glow = this.createSmoothSphere('g' + idx, { diameter: 0.8 * s });
                glow.position.set(offset.x * s, offset.y * s, -5.5 * s);
                glow.parent = parent;
                glow.material = mats.engineMat;
            });
        },

        createBomber: function(parent, s, mats) {
            // Wide flat body
            const body = BABYLON.MeshBuilder.CreateBox('b', { width: 4 * s, height: 1.5 * s, depth: 8 * s }, this.scene);
            body.parent = parent;
            body.material = mats.hullMat;

            // Bomb bay with torpedoes
            const bayDoors = BABYLON.MeshBuilder.CreateBox('bd', { width: 3 * s, height: 0.2 * s, depth: 4 * s }, this.scene);
            bayDoors.position.y = -0.8 * s;
            bayDoors.parent = parent;
            bayDoors.material = mats.armorMat;

            for (let i = 0; i < 4; i++) {
                const torpedo = this.createSmoothCylinder('tp' + i, { height: 3 * s, diameterTop: 0.2 * s, diameterBottom: 0.4 * s });
                torpedo.rotation.x = Math.PI / 2;
                torpedo.position.set((-1.2 + i * 0.8) * s, -1 * s, 0.5 * s);
                torpedo.parent = parent;
                torpedo.material = mats.weaponMat;
            }

            // Nose sensor array
            const nose = this.createSmoothSphere('n', { diameter: 2.5 * s, slice: 0.5 });
            nose.position.z = 4.5 * s;
            nose.rotation.x = -Math.PI / 2;
            nose.parent = parent;
            nose.material = mats.armorMat;

            // Cockpit
            const cockpit = BABYLON.MeshBuilder.CreateBox('c', { width: 2 * s, height: 1 * s, depth: 2.5 * s }, this.scene);
            cockpit.position.set(0, 1 * s, 2 * s);
            cockpit.parent = parent;
            cockpit.material = mats.glassMat;

            // Heavy swept wings with nacelles
            for (let i = 0; i < 2; i++) {
                const side = i === 0 ? -1 : 1;
                const wing = BABYLON.MeshBuilder.CreateBox('w' + i, { width: 5 * s, height: 0.3 * s, depth: 4 * s }, this.scene);
                wing.position.set(side * 4 * s, 0, -1 * s);
                wing.rotation.y = side * -0.15;
                wing.parent = parent;
                wing.material = mats.hullMat;

                const nacelle = this.createEngineNacelle('nc' + i, 3.5 * s, 0.6 * s, 0.5 * s);
                nacelle.rotation.x = Math.PI / 2;
                nacelle.position.set(side * 4 * s, 0, -2 * s);
                nacelle.parent = parent;
                nacelle.material = mats.hullMat;

                const glow = this.createSmoothSphere('g' + i, { diameter: 1 * s });
                glow.position.set(side * 4 * s, 0, -3.8 * s);
                glow.parent = parent;
                glow.material = mats.engineMat;
            }

            // Central engines
            for (let i = 0; i < 2; i++) {
                const engine = this.createEngineNacelle('ce' + i, 2.5 * s, 0.4 * s, 0.5 * s);
                engine.rotation.x = Math.PI / 2;
                engine.position.set((i === 0 ? -1 : 1) * s, 0, -5 * s);
                engine.parent = parent;
                engine.material = mats.hullMat;

                const glow = this.createSmoothSphere('cg' + i, { diameter: 0.9 * s });
                glow.position.set((i === 0 ? -1 : 1) * s, 0, -6 * s);
                glow.parent = parent;
                glow.material = mats.engineMat;
            }

            // Tail
            const tail = BABYLON.MeshBuilder.CreateBox('t', { width: 0.2 * s, height: 2.5 * s, depth: 2.5 * s }, this.scene);
            tail.position.set(0, 1.2 * s, -3.5 * s);
            tail.parent = parent;
            tail.material = mats.hullMat;
        },

        createGunship: function(parent, s, mats) {
            // Bulky main hull
            const hull = BABYLON.MeshBuilder.CreateBox('h', { width: 5 * s, height: 2.5 * s, depth: 10 * s }, this.scene);
            hull.parent = parent;
            hull.material = mats.hullMat;

            // Superstructure with turret
            const superstructure = BABYLON.MeshBuilder.CreateBox('ss', { width: 3.5 * s, height: 1.5 * s, depth: 6 * s }, this.scene);
            superstructure.position.set(0, 1.8 * s, 0.5 * s);
            superstructure.parent = parent;
            superstructure.material = mats.hullMat;

            // Main turret
            const turretBase = this.createSmoothCylinder('tb', { height: 0.8 * s, diameter: 2 * s });
            turretBase.position.set(0, 3 * s, 1 * s);
            turretBase.parent = parent;
            turretBase.material = mats.armorMat;

            const turretHead = this.createSmoothSphere('th', { diameter: 1.8 * s, slice: 0.6 });
            turretHead.position.set(0, 3.4 * s, 1 * s);
            turretHead.rotation.x = Math.PI;
            turretHead.parent = parent;
            turretHead.material = mats.armorMat;

            // Twin barrels
            for (let i = 0; i < 2; i++) {
                const barrel = this.createSmoothCylinder('br' + i, { height: 5 * s, diameter: 0.4 * s });
                barrel.rotation.x = Math.PI / 2;
                barrel.position.set((i === 0 ? -0.4 : 0.4) * s, 3.4 * s, 4 * s);
                barrel.parent = parent;
                barrel.material = mats.armorMat;

                const muzzle = this.createSmoothSphere('mz' + i, { diameter: 0.4 * s });
                muzzle.position.set((i === 0 ? -0.4 : 0.4) * s, 3.4 * s, 6.5 * s);
                muzzle.parent = parent;
                muzzle.material = mats.weaponMat;
            }

            // Side sponsons
            for (let i = 0; i < 2; i++) {
                const side = i === 0 ? -1 : 1;
                const sponson = BABYLON.MeshBuilder.CreateBox('sp' + i, { width: 1.5 * s, height: 1.2 * s, depth: 4 * s }, this.scene);
                sponson.position.set(side * 3 * s, 0, 2 * s);
                sponson.parent = parent;
                sponson.material = mats.hullMat;

                const gun = this.createSmoothCylinder('sg' + i, { height: 3 * s, diameter: 0.35 * s });
                gun.rotation.x = Math.PI / 2;
                gun.position.set(side * 3.5 * s, 0, 4 * s);
                gun.parent = parent;
                gun.material = mats.armorMat;
            }

            // Cockpit
            const cockpit = BABYLON.MeshBuilder.CreateBox('c', { width: 2.5 * s, height: 1.2 * s, depth: 3 * s }, this.scene);
            cockpit.position.set(0, 0.6 * s, 4 * s);
            cockpit.parent = parent;
            cockpit.material = mats.glassMat;

            // Heavy engine array
            [{x: -1.5, y: 0.5}, {x: 1.5, y: 0.5}, {x: -1.5, y: -0.5}, {x: 1.5, y: -0.5}, {x: 0, y: 0}].forEach((offset, idx) => {
                const engine = this.createEngineNacelle('e' + idx, 3 * s, 0.45 * s, 0.55 * s);
                engine.rotation.x = Math.PI / 2;
                engine.position.set(offset.x * s, offset.y * s, -6 * s);
                engine.parent = parent;
                engine.material = mats.hullMat;

                const glow = this.createSmoothSphere('g' + idx, { diameter: 1 * s });
                glow.position.set(offset.x * s, offset.y * s, -7.2 * s);
                glow.parent = parent;
                glow.material = mats.engineMat;
            });
        },

        createFrigate: function(parent, s, mats) {
            // Wedge hull using tapered hull
            const hull = this.createTaperedHull('h', {
                length: 16 * s,
                frontRadius: 0.5 * s,
                backRadius: 2.75 * s,
                midBulge: 1.2,
                taperStart: 0.7
            });
            hull.parent = parent;
            hull.material = mats.hullMat;

            // Bridge
            const bridge = BABYLON.MeshBuilder.CreateBox('br', { width: 4 * s, height: 2.5 * s, depth: 5 * s }, this.scene);
            bridge.position.set(0, 2.5 * s, 2 * s);
            bridge.parent = parent;
            bridge.material = mats.hullMat;

            const windows = BABYLON.MeshBuilder.CreateBox('win', { width: 3.5 * s, height: 1 * s, depth: 3 * s }, this.scene);
            windows.position.set(0, 3 * s, 3.5 * s);
            windows.parent = parent;
            windows.material = mats.glassMat;

            // Twin turrets
            [{z: 6}, {z: -2}].forEach((pos, idx) => {
                const base = this.createSmoothCylinder('tbs' + idx, { height: 1 * s, diameter: 2.5 * s });
                base.position.set(0, 2 * s, pos.z * s);
                base.parent = parent;
                base.material = mats.armorMat;

                const turret = BABYLON.MeshBuilder.CreateBox('trt' + idx, { width: 2 * s, height: 1.5 * s, depth: 3 * s }, this.scene);
                turret.position.set(0, 3 * s, (pos.z + 1.5) * s);
                turret.parent = parent;
                turret.material = mats.armorMat;

                for (let j = 0; j < 2; j++) {
                    const barrel = this.createSmoothCylinder('brl' + idx + j, { height: 5 * s, diameter: 0.4 * s });
                    barrel.rotation.x = Math.PI / 2;
                    barrel.position.set((j === 0 ? -0.5 : 0.5) * s, 3 * s, (pos.z + 4) * s);
                    barrel.parent = parent;
                    barrel.material = mats.armorMat;
                }
            });

            // Broadside guns
            for (let i = 0; i < 2; i++) {
                const side = i === 0 ? -1 : 1;
                for (let j = 0; j < 3; j++) {
                    const gun = this.createSmoothCylinder('sg' + i + j, { height: 3 * s, diameter: 0.5 * s });
                    gun.rotation.z = side * Math.PI / 2;
                    gun.position.set(side * 4.5 * s, 0, (4 - j * 4) * s);
                    gun.parent = parent;
                    gun.material = mats.armorMat;
                }
            }

            // Engine array
            [{x: -2, y: 0.5}, {x: 2, y: 0.5}, {x: -2, y: -0.5}, {x: 2, y: -0.5}, {x: 0, y: 0.8}, {x: 0, y: -0.8}].forEach((pos, idx) => {
                const engine = this.createEngineNacelle('e' + idx, 4 * s, 0.5 * s, 0.65 * s);
                engine.rotation.x = Math.PI / 2;
                engine.position.set(pos.x * s, pos.y * s, -9 * s);
                engine.parent = parent;
                engine.material = mats.hullMat;

                const glow = this.createSmoothSphere('g' + idx, { diameter: 1.2 * s });
                glow.position.set(pos.x * s, pos.y * s, -10.5 * s);
                glow.parent = parent;
                glow.material = mats.engineMat;
            });
        },

        createCruiser: function(parent, s, mats) {
            // Elongated hull
            const hull = this.createTaperedHull('h', {
                length: 22 * s,
                frontRadius: 1 * s,
                backRadius: 3.25 * s,
                midBulge: 1.15,
                taperStart: 0.65
            });
            hull.parent = parent;
            hull.material = mats.hullMat;

            // Command tower
            const tower = BABYLON.MeshBuilder.CreateBox('tw', { width: 4 * s, height: 4 * s, depth: 6 * s }, this.scene);
            tower.position.set(0, 3.5 * s, 4 * s);
            tower.parent = parent;
            tower.material = mats.hullMat;

            // Sensor dish
            const dish = BABYLON.MeshBuilder.CreateTorus('ds', { diameter: 3 * s, thickness: 0.3 * s, tessellation: currentTessellation.torus }, this.scene);
            dish.position.set(0, 6 * s, 5 * s);
            dish.rotation.x = Math.PI / 4;
            dish.parent = parent;
            dish.material = mats.armorMat;

            // VLS batteries
            for (let i = 0; i < 2; i++) {
                const side = i === 0 ? -1 : 1;
                const vls = BABYLON.MeshBuilder.CreateBox('vls' + i, { width: 2.5 * s, height: 1 * s, depth: 8 * s }, this.scene);
                vls.position.set(side * 2.5 * s, 2.5 * s, -3 * s);
                vls.parent = parent;
                vls.material = mats.armorMat;

                for (let j = 0; j < 8; j++) {
                    const cell = this.createSmoothCylinder('cl' + i + j, { height: 0.5 * s, diameter: 0.8 * s });
                    cell.position.set(side * 2.5 * s, 3 * s, (-6.5 + j * 0.9) * s);
                    cell.parent = parent;
                    cell.material = mats.weaponMat;
                }
            }

            // Heavy engines
            [{x: -2.5, y: 0}, {x: 2.5, y: 0}, {x: -1.2, y: 1}, {x: 1.2, y: 1}, {x: -1.2, y: -1}, {x: 1.2, y: -1}].forEach((pos, idx) => {
                const engine = this.createEngineNacelle('e' + idx, 5 * s, 0.6 * s, 0.75 * s);
                engine.rotation.x = Math.PI / 2;
                engine.position.set(pos.x * s, pos.y * s, -13 * s);
                engine.parent = parent;
                engine.material = mats.hullMat;

                const glow = this.createSmoothSphere('g' + idx, { diameter: 1.4 * s });
                glow.position.set(pos.x * s, pos.y * s, -15 * s);
                glow.parent = parent;
                glow.material = mats.engineMat;
            });
        },

        createBattlecruiser: function(parent, s, mats) {
            // Massive hull
            const hull = this.createTaperedHull('h', {
                length: 28 * s,
                frontRadius: 1.5 * s,
                backRadius: 4.5 * s,
                midBulge: 1.2,
                taperStart: 0.6
            });
            hull.parent = parent;
            hull.material = mats.hullMat;

            // Command citadel
            const citadel = BABYLON.MeshBuilder.CreateBox('ct', { width: 6 * s, height: 5 * s, depth: 8 * s }, this.scene);
            citadel.position.set(0, 4.5 * s, 4 * s);
            citadel.parent = parent;
            citadel.material = mats.hullMat;

            const bridge = BABYLON.MeshBuilder.CreateBox('br', { width: 4.5 * s, height: 2 * s, depth: 4 * s }, this.scene);
            bridge.position.set(0, 5.5 * s, 6 * s);
            bridge.parent = parent;
            bridge.material = mats.glassMat;

            // Triple turrets (3)
            [{z: 12, y: 3}, {z: 2, y: 5}, {z: -6, y: 3}].forEach((pos, idx) => {
                const base = this.createSmoothCylinder('tbs' + idx, { height: 1.5 * s, diameter: 4 * s });
                base.position.set(0, pos.y * s, pos.z * s);
                base.parent = parent;
                base.material = mats.armorMat;

                const turret = BABYLON.MeshBuilder.CreateBox('trt' + idx, { width: 3.5 * s, height: 2.5 * s, depth: 5 * s }, this.scene);
                turret.position.set(0, (pos.y + 1.5) * s, (pos.z + 1.5) * s);
                turret.parent = parent;
                turret.material = mats.armorMat;

                for (let j = 0; j < 2; j++) {
                    const barrel = this.createSmoothCylinder('brl' + idx + j, { height: 8 * s, diameter: 0.7 * s });
                    barrel.rotation.x = Math.PI / 2;
                    barrel.position.set((j === 0 ? -0.8 : 0.8) * s, (pos.y + 1.5) * s, (pos.z + 6) * s);
                    barrel.parent = parent;
                    barrel.material = mats.armorMat;

                    const muzzle = this.createSmoothSphere('mz' + idx + j, { diameter: 0.7 * s });
                    muzzle.position.set((j === 0 ? -0.8 : 0.8) * s, (pos.y + 1.5) * s, (pos.z + 10) * s);
                    muzzle.parent = parent;
                    muzzle.material = mats.weaponMat;
                }
            });

            // Broadside batteries
            for (let i = 0; i < 2; i++) {
                const side = i === 0 ? -1 : 1;
                for (let j = 0; j < 5; j++) {
                    const gun = this.createSmoothCylinder('bg' + i + j, { height: 4 * s, diameter: 0.6 * s });
                    gun.rotation.z = side * Math.PI / 2;
                    gun.position.set(side * 7 * s, 0, (8 - j * 4) * s);
                    gun.parent = parent;
                    gun.material = mats.armorMat;
                }
            }

            // Engine cluster
            const engineGrid = [];
            for (let x = -2; x <= 2; x++) {
                for (let y = -1; y <= 1; y++) {
                    if (Math.abs(x) === 2 && Math.abs(y) === 1) continue;
                    engineGrid.push({x: x * 1.8, y: y * 1.2});
                }
            }
            engineGrid.forEach((pos, idx) => {
                const engine = this.createEngineNacelle('e' + idx, 5 * s, 0.65 * s, 0.8 * s);
                engine.rotation.x = Math.PI / 2;
                engine.position.set(pos.x * s, pos.y * s, -17 * s);
                engine.parent = parent;
                engine.material = mats.hullMat;

                const glow = this.createSmoothSphere('g' + idx, { diameter: 1.5 * s });
                glow.position.set(pos.x * s, pos.y * s, -19 * s);
                glow.parent = parent;
                glow.material = mats.engineMat;
            });
        },

        createDreadnought: function(parent, s, mats) {
            // Colossal hull
            const hull = this.createTaperedHull('h', {
                length: 38 * s,
                frontRadius: 2 * s,
                backRadius: 6.5 * s,
                midBulge: 1.15,
                taperStart: 0.55
            });
            hull.parent = parent;
            hull.material = mats.hullMat;

            // Command fortress
            const fortress = BABYLON.MeshBuilder.CreateBox('ft', { width: 8 * s, height: 8 * s, depth: 12 * s }, this.scene);
            fortress.position.set(0, 7 * s, 6 * s);
            fortress.parent = parent;
            fortress.material = mats.hullMat;

            // Bridge
            const bridge = BABYLON.MeshBuilder.CreateBox('br', { width: 5 * s, height: 3 * s, depth: 6 * s }, this.scene);
            bridge.position.set(0, 12 * s, 8 * s);
            bridge.parent = parent;
            bridge.material = mats.glassMat;

            // Sensor spires
            for (let i = 0; i < 2; i++) {
                const spire = this.createSmoothCylinder('sp' + i, { height: 8 * s, diameterTop: 0.5 * s, diameterBottom: 1.5 * s });
                spire.position.set((i === 0 ? -3 : 3) * s, 15 * s, 5 * s);
                spire.parent = parent;
                spire.material = mats.armorMat;

                const beacon = this.createSmoothSphere('bc' + i, { diameter: 1 * s });
                beacon.position.set((i === 0 ? -3 : 3) * s, 19 * s, 5 * s);
                beacon.parent = parent;
                beacon.material = mats.engineMat;
            }

            // Super-heavy turrets (4 with triple barrels)
            [{z: 18, y: 4}, {z: 10, y: 8}, {z: -4, y: 4}, {z: -12, y: 4}].forEach((pos, idx) => {
                const base = this.createSmoothCylinder('tbs' + idx, { height: 2 * s, diameter: 6 * s });
                base.position.set(0, pos.y * s, pos.z * s);
                base.parent = parent;
                base.material = mats.armorMat;

                const turret = BABYLON.MeshBuilder.CreateBox('trt' + idx, { width: 5 * s, height: 3.5 * s, depth: 7 * s }, this.scene);
                turret.position.set(0, (pos.y + 2.5) * s, (pos.z + 2) * s);
                turret.parent = parent;
                turret.material = mats.armorMat;

                for (let j = 0; j < 3; j++) {
                    const barrel = this.createSmoothCylinder('brl' + idx + j, { height: 12 * s, diameter: 0.9 * s });
                    barrel.rotation.x = Math.PI / 2;
                    barrel.position.set((j - 1) * 1.2 * s, (pos.y + 2.5) * s, (pos.z + 9) * s);
                    barrel.parent = parent;
                    barrel.material = mats.armorMat;

                    const muzzle = this.createSmoothSphere('mz' + idx + j, { diameter: 0.9 * s });
                    muzzle.position.set((j - 1) * 1.2 * s, (pos.y + 2.5) * s, (pos.z + 15) * s);
                    muzzle.parent = parent;
                    muzzle.material = mats.weaponMat;
                }
            });

            // Massive broadside batteries
            for (let i = 0; i < 2; i++) {
                const side = i === 0 ? -1 : 1;
                for (let j = 0; j < 8; j++) {
                    const gun = this.createSmoothCylinder('hg' + i + j, { height: 6 * s, diameter: 0.8 * s });
                    gun.rotation.z = side * Math.PI / 2;
                    gun.position.set(side * 10 * s, 1 * s, (14 - j * 4) * s);
                    gun.parent = parent;
                    gun.material = mats.armorMat;
                }

                const sponson = BABYLON.MeshBuilder.CreateBox('sps' + i, { width: 3 * s, height: 4 * s, depth: 20 * s }, this.scene);
                sponson.position.set(side * 7.5 * s, -1 * s, 0);
                sponson.parent = parent;
                sponson.material = mats.hullMat;
            }

            // Launch bays
            for (let i = 0; i < 2; i++) {
                const bay = BABYLON.MeshBuilder.CreateBox('by' + i, { width: 6 * s, height: 3 * s, depth: 10 * s }, this.scene);
                bay.position.set((i === 0 ? -4 : 4) * s, -3 * s, -8 * s);
                bay.parent = parent;
                bay.material = mats.hullMat;
            }

            // Colossal engine cluster (5x3)
            for (let x = -2; x <= 2; x++) {
                for (let y = -1; y <= 1; y++) {
                    const idx = (x + 2) * 3 + (y + 1);
                    const engine = this.createEngineNacelle('e' + idx, 7 * s, 0.8 * s, 1 * s);
                    engine.rotation.x = Math.PI / 2;
                    engine.position.set(x * 2.3 * s, y * 1.8 * s, -26 * s);
                    engine.parent = parent;
                    engine.material = mats.hullMat;

                    const glow = this.createSmoothSphere('g' + idx, { diameter: 1.8 * s });
                    glow.position.set(x * 2.3 * s, y * 1.8 * s, -29 * s);
                    glow.parent = parent;
                    glow.material = mats.engineMat;
                }
            }
        },

        createHarvester: function(parent, s, mats) {
            // Cargo body
            const cargo = BABYLON.MeshBuilder.CreateBox('cg', { width: 4 * s, height: 2.5 * s, depth: 6 * s }, this.scene);
            cargo.parent = parent;
            cargo.material = mats.hullMat;

            // Mining drill mount
            const drillMount = this.createSmoothCylinder('dm', { height: 1.5 * s, diameter: 2 * s });
            drillMount.rotation.x = Math.PI / 2;
            drillMount.position.z = 3.5 * s;
            drillMount.parent = parent;
            drillMount.material = mats.armorMat;

            // Mining drill (smooth cone)
            const drill = this.createSmoothCylinder('dr', { height: 3 * s, diameterTop: 0.3 * s, diameterBottom: 1.5 * s });
            drill.rotation.x = Math.PI / 2;
            drill.position.z = 5.5 * s;
            drill.parent = parent;
            drill.material = mats.armorMat;

            const drillGlow = this.createSmoothSphere('dg', { diameter: 0.6 * s });
            drillGlow.position.z = 7 * s;
            drillGlow.parent = parent;
            drillGlow.material = mats.weaponMat;

            // Cargo bay doors
            for (let i = 0; i < 2; i++) {
                const door = BABYLON.MeshBuilder.CreateBox('dr' + i, { width: 1.8 * s, height: 0.2 * s, depth: 4 * s }, this.scene);
                door.position.set((i === 0 ? -1.1 : 1.1) * s, -1.3 * s, 0);
                door.parent = parent;
                door.material = mats.armorMat;
            }

            // Cockpit
            const cockpit = this.createSmoothSphere('ck', { diameter: 2 * s, slice: 0.5 });
            cockpit.position.set(0, 1.5 * s, 1 * s);
            cockpit.rotation.x = Math.PI;
            cockpit.parent = parent;
            cockpit.material = mats.glassMat;

            // Side engine pods
            for (let i = 0; i < 2; i++) {
                const side = i === 0 ? -1 : 1;
                const pod = BABYLON.MeshBuilder.CreateBox('pd' + i, { width: 1.5 * s, height: 1.5 * s, depth: 3 * s }, this.scene);
                pod.position.set(side * 2.5 * s, 0, -1 * s);
                pod.parent = parent;
                pod.material = mats.hullMat;

                const engine = this.createEngineNacelle('e' + i, 1.5 * s, 0.4 * s, 0.5 * s);
                engine.rotation.x = Math.PI / 2;
                engine.position.set(side * 2.5 * s, 0, -3 * s);
                engine.parent = parent;
                engine.material = mats.hullMat;

                const glow = this.createSmoothSphere('g' + i, { diameter: 0.9 * s });
                glow.position.set(side * 2.5 * s, 0, -3.6 * s);
                glow.parent = parent;
                glow.material = mats.engineMat;
            }
        },

        // ===== MAIN CREATION METHOD =====
        createShipMesh: function(unitType, size, color, team, parentMesh) {
            // Update quality settings before creating ship
            this.updateQualitySettings();

            const [r, g, b] = color;
            const mats = this.createShipMaterials(r, g, b, team);

            // Scale factor based on unit type
            const scaleFactors = {
                scout: size / 2,
                interceptor: size / 2.5,
                striker: size / 3,
                heavy: size / 4,
                bomber: size / 5,
                gunship: size / 6,
                frigate: size / 8,
                cruiser: size / 10,
                battlecruiser: size / 12,
                dreadnought: size / 15,
                harvester: size / 3
            };

            const s = scaleFactors[unitType] || size / 5;

            switch(unitType) {
                case 'scout': this.createScout(parentMesh, s, mats); break;
                case 'interceptor': this.createInterceptor(parentMesh, s, mats); break;
                case 'striker': this.createStriker(parentMesh, s, mats); break;
                case 'heavy': this.createHeavy(parentMesh, s, mats); break;
                case 'bomber': this.createBomber(parentMesh, s, mats); break;
                case 'gunship': this.createGunship(parentMesh, s, mats); break;
                case 'frigate': this.createFrigate(parentMesh, s, mats); break;
                case 'cruiser': this.createCruiser(parentMesh, s, mats); break;
                case 'battlecruiser': this.createBattlecruiser(parentMesh, s, mats); break;
                case 'dreadnought': this.createDreadnought(parentMesh, s, mats); break;
                case 'harvester': this.createHarvester(parentMesh, s, mats); break;
                default:
                    console.warn('Unknown ship type:', unitType);
                    return false;
            }
            return true;
        }
    };

    // Export to window
    window.VoidShipsEnhanced = VoidShipsEnhanced;

})(window);

console.log('VoidShips Enhanced module loaded - smooth geometry and normal maps ready');
