// ============================================================
// VOID SUPREMACY 3D - Enhanced Building Models & Textures
// Place this file in the same directory as the main game HTML
// Buildings will automatically use enhanced models when this file is loaded
// ============================================================

(function(window) {
    'use strict';

    const VoidBuildingsEnhanced = {
        initialized: false,
        scene: null,
        textures: {},
        
        // Initialize with Babylon scene
        init: function(babylonScene) {
            if (this.initialized) return;
            this.scene = babylonScene;
            this.createProceduralTextures();
            this.initialized = true;
            console.log('VoidBuildings Enhanced: Detailed building models loaded');
        },

        // ===== PROCEDURAL TEXTURE GENERATION =====
        createProceduralTextures: function() {
            this.textures.industrialPlating = this.generateIndustrialTexture(512);
            this.textures.metalGrating = this.generateGratingTexture(512);
            this.textures.concretePanels = this.generateConcreteTexture(512);
            this.textures.techPanels = this.generateTechPanelTexture(512);
            this.textures.hazardStripes = this.generateHazardTexture(256);
            this.textures.glowCircuit = this.generateCircuitTexture(256);
            this.textures.windowGrid = this.generateWindowTexture(256);
            this.textures.tankRusty = this.generateTankTexture(512);
        },

        generateIndustrialTexture: function(size) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');

            // Base industrial gray
            ctx.fillStyle = '#3a4048';
            ctx.fillRect(0, 0, size, size);

            // Large panels with riveted seams
            const panelW = 128, panelH = 64;
            ctx.strokeStyle = '#1e2428';
            ctx.lineWidth = 4;
            
            for (let x = 0; x < size; x += panelW) {
                for (let y = 0; y < size; y += panelH) {
                    const v = Math.random() * 15 - 7;
                    ctx.fillStyle = `rgb(${58 + v}, ${64 + v}, ${72 + v})`;
                    ctx.fillRect(x + 4, y + 4, panelW - 8, panelH - 8);
                    ctx.strokeRect(x, y, panelW, panelH);
                    
                    // Corner rivets
                    ctx.fillStyle = '#2a2e32';
                    [
                        [x + 8, y + 8], [x + panelW - 8, y + 8],
                        [x + 8, y + panelH - 8], [x + panelW - 8, y + panelH - 8]
                    ].forEach(([rx, ry]) => {
                        ctx.beginPath();
                        ctx.arc(rx, ry, 4, 0, Math.PI * 2);
                        ctx.fill();
                    });
                    
                    // Random vent grills
                    if (Math.random() > 0.7) {
                        ctx.fillStyle = '#1a1e22';
                        const vx = x + 20 + Math.random() * (panelW - 60);
                        const vy = y + 15 + Math.random() * (panelH - 30);
                        for (let i = 0; i < 5; i++) {
                            ctx.fillRect(vx, vy + i * 4, 30, 2);
                        }
                    }
                }
            }

            // Rust stains
            ctx.fillStyle = 'rgba(120, 70, 40, 0.15)';
            for (let i = 0; i < 8; i++) {
                ctx.beginPath();
                ctx.ellipse(
                    Math.random() * size, Math.random() * size,
                    30 + Math.random() * 40, 10 + Math.random() * 20,
                    Math.random() * Math.PI, 0, Math.PI * 2
                );
                ctx.fill();
            }

            // Scratches and wear
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 40; i++) {
                ctx.beginPath();
                const sx = Math.random() * size;
                const sy = Math.random() * size;
                ctx.moveTo(sx, sy);
                ctx.lineTo(sx + (Math.random() - 0.5) * 80, sy + (Math.random() - 0.5) * 80);
                ctx.stroke();
            }

            const texture = new BABYLON.DynamicTexture('industrialTex', canvas, this.scene, true);
            texture.update();
            return texture;
        },

        generateGratingTexture: function(size) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');

            // Dark background (holes)
            ctx.fillStyle = '#0a0c0e';
            ctx.fillRect(0, 0, size, size);

            // Metal grid pattern
            ctx.strokeStyle = '#4a5058';
            ctx.lineWidth = 6;
            
            const gridSize = 24;
            for (let x = 0; x < size; x += gridSize) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, size);
                ctx.stroke();
            }
            for (let y = 0; y < size; y += gridSize) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(size, y);
                ctx.stroke();
            }

            // Highlight edges
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 1;
            for (let x = 0; x < size; x += gridSize) {
                ctx.beginPath();
                ctx.moveTo(x + 1, 0);
                ctx.lineTo(x + 1, size);
                ctx.stroke();
            }

            const texture = new BABYLON.DynamicTexture('gratingTex', canvas, this.scene, true);
            texture.update();
            return texture;
        },

        generateConcreteTexture: function(size) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');

            // Base concrete
            ctx.fillStyle = '#4a4d52';
            ctx.fillRect(0, 0, size, size);

            // Noise pattern
            for (let x = 0; x < size; x += 2) {
                for (let y = 0; y < size; y += 2) {
                    const v = Math.random() * 20 - 10;
                    ctx.fillStyle = `rgb(${74 + v}, ${77 + v}, ${82 + v})`;
                    ctx.fillRect(x, y, 2, 2);
                }
            }

            // Panel lines
            ctx.strokeStyle = '#2a2d32';
            ctx.lineWidth = 3;
            const panelSize = 128;
            for (let x = 0; x < size; x += panelSize) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, size);
                ctx.stroke();
            }
            for (let y = 0; y < size; y += panelSize) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(size, y);
                ctx.stroke();
            }

            // Cracks
            ctx.strokeStyle = 'rgba(30, 30, 30, 0.4)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 10; i++) {
                ctx.beginPath();
                let px = Math.random() * size;
                let py = Math.random() * size;
                ctx.moveTo(px, py);
                for (let j = 0; j < 5; j++) {
                    px += (Math.random() - 0.5) * 40;
                    py += Math.random() * 30;
                    ctx.lineTo(px, py);
                }
                ctx.stroke();
            }

            const texture = new BABYLON.DynamicTexture('concreteTex', canvas, this.scene, true);
            texture.update();
            return texture;
        },

        generateTechPanelTexture: function(size) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');

            // Dark tech base
            ctx.fillStyle = '#1a1e24';
            ctx.fillRect(0, 0, size, size);

            // Tech panel grid
            const panelW = 64, panelH = 48;
            for (let x = 0; x < size; x += panelW) {
                for (let y = 0; y < size; y += panelH) {
                    const v = Math.random() * 10;
                    ctx.fillStyle = `rgb(${30 + v}, ${35 + v}, ${42 + v})`;
                    ctx.fillRect(x + 2, y + 2, panelW - 4, panelH - 4);
                    
                    // Panel border glow
                    ctx.strokeStyle = 'rgba(0, 150, 200, 0.3)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x + 2, y + 2, panelW - 4, panelH - 4);
                    
                    // Random tech details
                    if (Math.random() > 0.6) {
                        ctx.fillStyle = 'rgba(0, 180, 255, 0.4)';
                        ctx.fillRect(x + 8, y + panelH - 10, panelW - 16, 3);
                    }
                    if (Math.random() > 0.7) {
                        ctx.fillStyle = 'rgba(0, 255, 180, 0.3)';
                        ctx.beginPath();
                        ctx.arc(x + 12, y + 12, 4, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }

            // Circuit traces
            ctx.strokeStyle = 'rgba(0, 200, 255, 0.15)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 20; i++) {
                ctx.beginPath();
                let px = Math.random() * size;
                let py = Math.random() * size;
                ctx.moveTo(px, py);
                for (let j = 0; j < 4; j++) {
                    if (Math.random() > 0.5) {
                        px += (Math.random() > 0.5 ? 1 : -1) * (20 + Math.random() * 40);
                    } else {
                        py += (Math.random() > 0.5 ? 1 : -1) * (20 + Math.random() * 40);
                    }
                    ctx.lineTo(px, py);
                }
                ctx.stroke();
            }

            const texture = new BABYLON.DynamicTexture('techPanelTex', canvas, this.scene, true);
            texture.update();
            return texture;
        },

        generateHazardTexture: function(size) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');

            // Yellow and black hazard stripes
            const stripeWidth = 32;
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, size, size);

            ctx.fillStyle = '#d4a012';
            for (let i = 0; i < size * 2; i += stripeWidth * 2) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i + stripeWidth, 0);
                ctx.lineTo(i + stripeWidth - size, size);
                ctx.lineTo(i - size, size);
                ctx.closePath();
                ctx.fill();
            }

            // Wear and scratches
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            for (let i = 0; i < 30; i++) {
                ctx.fillRect(
                    Math.random() * size, Math.random() * size,
                    2 + Math.random() * 8, 2 + Math.random() * 8
                );
            }

            const texture = new BABYLON.DynamicTexture('hazardTex', canvas, this.scene, true);
            texture.update();
            return texture;
        },

        generateCircuitTexture: function(size) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');

            // Dark base
            ctx.fillStyle = '#0a0e12';
            ctx.fillRect(0, 0, size, size);

            // Circuit traces
            ctx.strokeStyle = '#00a8ff';
            ctx.lineWidth = 2;
            
            for (let i = 0; i < 15; i++) {
                ctx.beginPath();
                let px = Math.random() * size;
                let py = Math.random() * size;
                ctx.moveTo(px, py);
                
                for (let j = 0; j < 6; j++) {
                    if (Math.random() > 0.5) {
                        px += (Math.random() > 0.5 ? 1 : -1) * (15 + Math.random() * 30);
                    } else {
                        py += (Math.random() > 0.5 ? 1 : -1) * (15 + Math.random() * 30);
                    }
                    ctx.lineTo(px, py);
                }
                ctx.stroke();
                
                // Nodes at intersections
                ctx.fillStyle = '#00ffff';
                ctx.beginPath();
                ctx.arc(px, py, 3, 0, Math.PI * 2);
                ctx.fill();
            }

            // Glow effect
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00a8ff';
            ctx.strokeStyle = 'rgba(0, 168, 255, 0.5)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 8; i++) {
                ctx.beginPath();
                ctx.arc(
                    Math.random() * size, Math.random() * size,
                    5 + Math.random() * 10, 0, Math.PI * 2
                );
                ctx.stroke();
            }

            const texture = new BABYLON.DynamicTexture('circuitTex', canvas, this.scene, true);
            texture.update();
            return texture;
        },

        generateWindowTexture: function(size) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');

            // Frame color
            ctx.fillStyle = '#2a3038';
            ctx.fillRect(0, 0, size, size);

            // Window grid
            const cols = 4, rows = 6;
            const winW = (size - 20) / cols;
            const winH = (size - 20) / rows;
            
            for (let x = 0; x < cols; x++) {
                for (let y = 0; y < rows; y++) {
                    // Window pane
                    const lit = Math.random() > 0.3;
                    const gradient = ctx.createLinearGradient(
                        10 + x * winW, 10 + y * winH,
                        10 + x * winW + winW, 10 + y * winH + winH
                    );
                    if (lit) {
                        gradient.addColorStop(0, 'rgba(200, 220, 255, 0.8)');
                        gradient.addColorStop(1, 'rgba(150, 180, 220, 0.6)');
                    } else {
                        gradient.addColorStop(0, 'rgba(20, 30, 40, 0.9)');
                        gradient.addColorStop(1, 'rgba(10, 15, 25, 0.9)');
                    }
                    ctx.fillStyle = gradient;
                    ctx.fillRect(10 + x * winW + 2, 10 + y * winH + 2, winW - 4, winH - 4);
                    
                    // Window frame
                    ctx.strokeStyle = '#1a2028';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(10 + x * winW, 10 + y * winH, winW, winH);
                }
            }

            const texture = new BABYLON.DynamicTexture('windowTex', canvas, this.scene, true);
            texture.update();
            return texture;
        },

        generateTankTexture: function(size) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');

            // Rusty metal base
            ctx.fillStyle = '#4a4038';
            ctx.fillRect(0, 0, size, size);

            // Noise
            for (let x = 0; x < size; x += 3) {
                for (let y = 0; y < size; y += 3) {
                    const v = Math.random() * 20 - 10;
                    ctx.fillStyle = `rgb(${74 + v}, ${64 + v}, ${56 + v})`;
                    ctx.fillRect(x, y, 3, 3);
                }
            }

            // Horizontal bands
            ctx.strokeStyle = '#2a2420';
            ctx.lineWidth = 8;
            for (let y = 64; y < size; y += 128) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(size, y);
                ctx.stroke();
            }

            // Rust patches
            ctx.fillStyle = 'rgba(140, 80, 40, 0.35)';
            for (let i = 0; i < 12; i++) {
                ctx.beginPath();
                ctx.ellipse(
                    Math.random() * size, Math.random() * size,
                    20 + Math.random() * 50, 15 + Math.random() * 30,
                    Math.random() * Math.PI, 0, Math.PI * 2
                );
                ctx.fill();
            }

            // Drip stains
            ctx.fillStyle = 'rgba(60, 40, 30, 0.4)';
            for (let i = 0; i < 8; i++) {
                const sx = Math.random() * size;
                const sy = Math.random() * size * 0.3;
                ctx.beginPath();
                ctx.moveTo(sx - 3, sy);
                ctx.lineTo(sx + 3, sy);
                ctx.lineTo(sx + 1, sy + 50 + Math.random() * 100);
                ctx.lineTo(sx - 1, sy + 50 + Math.random() * 100);
                ctx.closePath();
                ctx.fill();
            }

            const texture = new BABYLON.DynamicTexture('tankTex', canvas, this.scene, true);
            texture.update();
            return texture;
        },

        // ===== MATERIAL CREATION =====
        createBuildingMaterials: function(r, g, b, team) {
            const id = Math.random().toString(36).substr(2, 6);
            const teamColor = team === 0 ? new BABYLON.Color3(0, 0.5, 1) : new BABYLON.Color3(1, 0.2, 0);
            
            // Primary structure material
            const structureMat = new BABYLON.StandardMaterial('struct_' + id, this.scene);
            structureMat.diffuseTexture = this.textures.industrialPlating;
            structureMat.diffuseColor = new BABYLON.Color3(r * 0.5, g * 0.5, b * 0.5);
            structureMat.emissiveColor = new BABYLON.Color3(r * 0.1, g * 0.1, b * 0.1);
            structureMat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.35);
            
            // Concrete/foundation material
            const concreteMat = new BABYLON.StandardMaterial('concrete_' + id, this.scene);
            concreteMat.diffuseTexture = this.textures.concretePanels;
            concreteMat.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.42);
            concreteMat.specularColor = new BABYLON.Color3(0.15, 0.15, 0.15);
            
            // Tech panel material
            const techMat = new BABYLON.StandardMaterial('tech_' + id, this.scene);
            techMat.diffuseTexture = this.textures.techPanels;
            techMat.diffuseColor = new BABYLON.Color3(0.3, 0.35, 0.4);
            techMat.emissiveColor = teamColor.scale(0.1);
            techMat.specularColor = new BABYLON.Color3(0.4, 0.4, 0.5);
            
            // Metal grating
            const gratingMat = new BABYLON.StandardMaterial('grating_' + id, this.scene);
            gratingMat.diffuseTexture = this.textures.metalGrating;
            gratingMat.diffuseColor = new BABYLON.Color3(0.35, 0.35, 0.38);
            gratingMat.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
            
            // Window material
            const windowMat = new BABYLON.StandardMaterial('window_' + id, this.scene);
            windowMat.diffuseTexture = this.textures.windowGrid;
            windowMat.diffuseColor = new BABYLON.Color3(0.2, 0.25, 0.35);
            windowMat.specularColor = new BABYLON.Color3(0.8, 0.8, 0.9);
            windowMat.alpha = 0.85;
            
            // Hazard stripe material
            const hazardMat = new BABYLON.StandardMaterial('hazard_' + id, this.scene);
            hazardMat.diffuseTexture = this.textures.hazardStripes;
            hazardMat.emissiveColor = new BABYLON.Color3(0.15, 0.12, 0);
            
            // Glow/energy material
            const glowMat = new BABYLON.StandardMaterial('glow_' + id, this.scene);
            glowMat.emissiveColor = teamColor;
            glowMat.alpha = 0.9;
            glowMat.disableLighting = true;
            
            // Energy core material
            const energyMat = new BABYLON.StandardMaterial('energy_' + id, this.scene);
            energyMat.emissiveColor = new BABYLON.Color3(1, 0.9, 0.3);
            energyMat.alpha = 0.95;
            energyMat.disableLighting = true;
            
            // Rusty tank material
            const tankMat = new BABYLON.StandardMaterial('tank_' + id, this.scene);
            tankMat.diffuseTexture = this.textures.tankRusty;
            tankMat.diffuseColor = new BABYLON.Color3(0.45, 0.38, 0.32);
            tankMat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
            
            // Pipe material
            const pipeMat = new BABYLON.StandardMaterial('pipe_' + id, this.scene);
            pipeMat.diffuseColor = new BABYLON.Color3(0.5, 0.45, 0.35);
            pipeMat.specularColor = new BABYLON.Color3(0.4, 0.4, 0.4);
            
            // Weapon/turret material
            const weaponMat = new BABYLON.StandardMaterial('weapon_' + id, this.scene);
            weaponMat.diffuseColor = new BABYLON.Color3(0.25, 0.25, 0.3);
            weaponMat.specularColor = new BABYLON.Color3(0.6, 0.6, 0.65);
            
            // Muzzle glow
            const muzzleMat = new BABYLON.StandardMaterial('muzzle_' + id, this.scene);
            muzzleMat.emissiveColor = new BABYLON.Color3(1, 0.4, 0.1);
            muzzleMat.alpha = 0.85;
            muzzleMat.disableLighting = true;
            
            return {
                structureMat, concreteMat, techMat, gratingMat, windowMat,
                hazardMat, glowMat, energyMat, tankMat, pipeMat, weaponMat, muzzleMat,
                teamColor
            };
        },

        // ===== BUILDING MODEL CREATORS =====
        
        createCommandCenter: function(parent, s, mats) {
            // Hexagonal reinforced foundation
            const foundation = BABYLON.MeshBuilder.CreateCylinder('ccFound', {
                height: 1.5 * s, diameter: 16 * s, tessellation: 6
            }, this.scene);
            foundation.position.y = 0.75 * s;
            foundation.parent = parent;
            foundation.material = mats.concreteMat;
            
            // Main hexagonal base structure
            const base = BABYLON.MeshBuilder.CreateCylinder('ccBase', {
                height: 5 * s, diameterTop: 13 * s, diameterBottom: 14 * s, tessellation: 6
            }, this.scene);
            base.position.y = 4 * s;
            base.parent = parent;
            base.material = mats.structureMat;
            
            // Base armor plating
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                const plate = BABYLON.MeshBuilder.CreateBox('basePlate' + i, {
                    width: 6 * s, height: 4 * s, depth: 0.5 * s
                }, this.scene);
                plate.position.x = Math.cos(angle) * 6.5 * s;
                plate.position.z = Math.sin(angle) * 6.5 * s;
                plate.position.y = 4 * s;
                plate.rotation.y = -angle + Math.PI / 2;
                plate.parent = parent;
                plate.material = mats.techMat;
            }
            
            // Central command tower
            const tower = BABYLON.MeshBuilder.CreateCylinder('ccTower', {
                height: 12 * s, diameterTop: 4 * s, diameterBottom: 6 * s, tessellation: 8
            }, this.scene);
            tower.position.y = 12.5 * s;
            tower.parent = parent;
            tower.material = mats.structureMat;
            
            // Tower windows
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const window = BABYLON.MeshBuilder.CreateBox('towerWin' + i, {
                    width: 1.5 * s, height: 6 * s, depth: 0.3 * s
                }, this.scene);
                window.position.x = Math.cos(angle) * 4.8 * s;
                window.position.z = Math.sin(angle) * 4.8 * s;
                window.position.y = 14 * s;
                window.rotation.y = -angle + Math.PI / 2;
                window.parent = parent;
                window.material = mats.windowMat;
            }
            
            // Observation deck
            const deck = BABYLON.MeshBuilder.CreateCylinder('ccDeck', {
                height: 2 * s, diameterTop: 8 * s, diameterBottom: 5 * s, tessellation: 12
            }, this.scene);
            deck.position.y = 19.5 * s;
            deck.parent = parent;
            deck.material = mats.techMat;
            
            // Communication arrays (3 dishes)
            for (let i = 0; i < 3; i++) {
                const angle = (i / 3) * Math.PI * 2 + Math.PI / 6;
                
                const dishArm = BABYLON.MeshBuilder.CreateCylinder('dishArm' + i, {
                    height: 4 * s, diameter: 0.4 * s, tessellation: 8
                }, this.scene);
                dishArm.position.x = Math.cos(angle) * 3 * s;
                dishArm.position.z = Math.sin(angle) * 3 * s;
                dishArm.position.y = 22 * s;
                dishArm.rotation.z = angle > Math.PI ? 0.3 : -0.3;
                dishArm.parent = parent;
                dishArm.material = mats.pipeMat;
                
                const dish = BABYLON.MeshBuilder.CreateCylinder('dish' + i, {
                    height: 0.5 * s, diameterTop: 2.5 * s, diameterBottom: 0.5 * s, tessellation: 16
                }, this.scene);
                dish.position.x = Math.cos(angle) * 4.5 * s;
                dish.position.z = Math.sin(angle) * 4.5 * s;
                dish.position.y = 23.5 * s;
                dish.rotation.x = 0.4;
                dish.rotation.y = angle;
                dish.parent = parent;
                dish.material = mats.techMat;
            }
            
            // Central antenna spire
            const spire = BABYLON.MeshBuilder.CreateCylinder('spire', {
                height: 6 * s, diameterTop: 0.2 * s, diameterBottom: 0.8 * s, tessellation: 8
            }, this.scene);
            spire.position.y = 24 * s;
            spire.parent = parent;
            spire.material = mats.pipeMat;
            
            // Antenna tip beacon
            const beacon = BABYLON.MeshBuilder.CreateSphere('beacon', { diameter: 0.8 * s }, this.scene);
            beacon.position.y = 27.5 * s;
            beacon.parent = parent;
            beacon.material = mats.glowMat;
            
            // Support pylons with energy conduits
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
                
                const pylon = BABYLON.MeshBuilder.CreateBox('pylon' + i, {
                    width: 1.5 * s, height: 8 * s, depth: 1.5 * s
                }, this.scene);
                pylon.position.x = Math.cos(angle) * 5.5 * s;
                pylon.position.z = Math.sin(angle) * 5.5 * s;
                pylon.position.y = 5.5 * s;
                pylon.parent = parent;
                pylon.material = mats.structureMat;
                
                // Energy conduit
                const conduit = BABYLON.MeshBuilder.CreateCylinder('conduit' + i, {
                    height: 6 * s, diameter: 0.4 * s, tessellation: 8
                }, this.scene);
                conduit.position.x = Math.cos(angle) * 5.5 * s;
                conduit.position.z = Math.sin(angle) * 5.5 * s;
                conduit.position.y = 5.5 * s;
                conduit.parent = parent;
                conduit.material = mats.glowMat;
                
                // Pylon top light
                const light = BABYLON.MeshBuilder.CreateSphere('pylonLight' + i, {
                    diameter: 1.2 * s
                }, this.scene);
                light.position.x = Math.cos(angle) * 5.5 * s;
                light.position.z = Math.sin(angle) * 5.5 * s;
                light.position.y = 10 * s;
                light.parent = parent;
                light.material = mats.glowMat;
            }
            
            // Rotating holographic ring
            const holoRing = BABYLON.MeshBuilder.CreateTorus('holoRing', {
                diameter: 10 * s, thickness: 0.4 * s, tessellation: 48
            }, this.scene);
            holoRing.position.y = 8 * s;
            holoRing.parent = parent;
            const holoMat = mats.glowMat.clone('holoRingMat');
            holoMat.alpha = 0.6;
            holoRing.material = holoMat;
            
            // Landing pad markings
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
                const marking = BABYLON.MeshBuilder.CreateBox('padMark' + i, {
                    width: 3 * s, height: 0.1 * s, depth: 0.5 * s
                }, this.scene);
                marking.position.x = Math.cos(angle) * 9 * s;
                marking.position.z = Math.sin(angle) * 9 * s;
                marking.position.y = 0.05 * s;
                marking.rotation.y = angle;
                marking.parent = parent;
                marking.material = mats.hazardMat;
            }
        },

        createPowerPlant: function(parent, s, mats) {
            // Reinforced foundation platform
            const foundation = BABYLON.MeshBuilder.CreateCylinder('ppFound', {
                height: 1 * s, diameter: 12 * s, tessellation: 12
            }, this.scene);
            foundation.position.y = 0.5 * s;
            foundation.parent = parent;
            foundation.material = mats.concreteMat;
            
            // Main reactor housing
            const housing = BABYLON.MeshBuilder.CreateCylinder('ppHousing', {
                height: 4 * s, diameter: 8 * s, tessellation: 16
            }, this.scene);
            housing.position.y = 3 * s;
            housing.parent = parent;
            housing.material = mats.structureMat;
            
            // Reactor housing panels
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const panel = BABYLON.MeshBuilder.CreateBox('housingPanel' + i, {
                    width: 2.5 * s, height: 3 * s, depth: 0.4 * s
                }, this.scene);
                panel.position.x = Math.cos(angle) * 3.7 * s;
                panel.position.z = Math.sin(angle) * 3.7 * s;
                panel.position.y = 3 * s;
                panel.rotation.y = -angle + Math.PI / 2;
                panel.parent = parent;
                panel.material = mats.techMat;
            }
            
            // Energy containment sphere (inner core)
            const coreShell = BABYLON.MeshBuilder.CreateSphere('coreShell', {
                diameter: 5 * s, segments: 24
            }, this.scene);
            coreShell.position.y = 8 * s;
            coreShell.parent = parent;
            const shellMat = mats.windowMat.clone('shellMat');
            shellMat.alpha = 0.4;
            coreShell.material = shellMat;
            
            // Energy core (pulsing)
            const core = BABYLON.MeshBuilder.CreateSphere('ppCore', {
                diameter: 3.5 * s, segments: 20
            }, this.scene);
            core.position.y = 8 * s;
            core.parent = parent;
            core.material = mats.energyMat;
            
            // Orbiting energy rings
            for (let i = 0; i < 3; i++) {
                const ring = BABYLON.MeshBuilder.CreateTorus('energyRing' + i, {
                    diameter: (3.5 + i * 1.2) * s,
                    thickness: 0.25 * s,
                    tessellation: 32
                }, this.scene);
                ring.position.y = 8 * s;
                ring.rotation.x = Math.PI / 2;
                ring.rotation.y = i * 0.7;
                ring.rotation.z = i * 0.3;
                ring.parent = parent;
                const ringMat = mats.energyMat.clone('ringMat' + i);
                ringMat.alpha = 0.7;
                ring.material = ringMat;
            }
            
            // Support pillars with energy conduits
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
                
                // Main pillar
                const pillar = BABYLON.MeshBuilder.CreateBox('pillar' + i, {
                    width: 1.2 * s, height: 8 * s, depth: 1.2 * s
                }, this.scene);
                pillar.position.x = Math.cos(angle) * 4 * s;
                pillar.position.z = Math.sin(angle) * 4 * s;
                pillar.position.y = 5 * s;
                pillar.parent = parent;
                pillar.material = mats.structureMat;
                
                // Energy conduit on pillar
                const conduit = BABYLON.MeshBuilder.CreateCylinder('pillarConduit' + i, {
                    height: 6 * s, diameter: 0.4 * s, tessellation: 8
                }, this.scene);
                conduit.position.x = Math.cos(angle) * 4 * s;
                conduit.position.z = Math.sin(angle) * 4 * s;
                conduit.position.y = 5 * s;
                conduit.parent = parent;
                const conduitMat = mats.glowMat.clone('conduitMat' + i);
                conduitMat.emissiveColor = new BABYLON.Color3(1, 0.8, 0.2);
                conduit.material = conduitMat;
                
                // Pillar cap
                const cap = BABYLON.MeshBuilder.CreateSphere('pillarCap' + i, {
                    diameter: 1.4 * s
                }, this.scene);
                cap.position.x = Math.cos(angle) * 4 * s;
                cap.position.z = Math.sin(angle) * 4 * s;
                cap.position.y = 9.5 * s;
                cap.parent = parent;
                cap.material = conduitMat;
            }
            
            // Top collector dish
            const collector = BABYLON.MeshBuilder.CreateCylinder('collector', {
                height: 1.5 * s, diameterTop: 7 * s, diameterBottom: 5 * s, tessellation: 16
            }, this.scene);
            collector.position.y = 12 * s;
            collector.parent = parent;
            collector.material = mats.techMat;
            
            // Collector antenna
            const antenna = BABYLON.MeshBuilder.CreateCylinder('ppAntenna', {
                height: 3 * s, diameterTop: 0.15 * s, diameterBottom: 0.5 * s, tessellation: 8
            }, this.scene);
            antenna.position.y = 14 * s;
            antenna.parent = parent;
            antenna.material = mats.pipeMat;
            
            // Power distribution cables
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2;
                const cable = BABYLON.MeshBuilder.CreateCylinder('cable' + i, {
                    height: 6 * s, diameter: 0.3 * s, tessellation: 8
                }, this.scene);
                cable.position.x = Math.cos(angle) * 5.5 * s;
                cable.position.z = Math.sin(angle) * 5.5 * s;
                cable.position.y = 1.5 * s;
                cable.rotation.z = 0.3;
                cable.rotation.y = angle;
                cable.parent = parent;
                cable.material = mats.pipeMat;
            }
            
            // Warning lights
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
                const warning = BABYLON.MeshBuilder.CreateCylinder('warning' + i, {
                    height: 0.3 * s, diameter: 1 * s, tessellation: 12
                }, this.scene);
                warning.position.x = Math.cos(angle) * 5 * s;
                warning.position.z = Math.sin(angle) * 5 * s;
                warning.position.y = 0.65 * s;
                warning.parent = parent;
                const warnMat = mats.energyMat.clone('warnMat' + i);
                warnMat.emissiveColor = new BABYLON.Color3(1, 0.8, 0);
                warning.material = warnMat;
            }
        },

        createRefinery: function(parent, s, mats) {
            // Large foundation slab
            const foundation = BABYLON.MeshBuilder.CreateBox('refFound', {
                width: 18 * s, height: 1 * s, depth: 16 * s
            }, this.scene);
            foundation.position.y = 0.5 * s;
            foundation.parent = parent;
            foundation.material = mats.concreteMat;
            
            // Main processing building
            const mainBuilding = BABYLON.MeshBuilder.CreateBox('refMain', {
                width: 10 * s, height: 8 * s, depth: 12 * s
            }, this.scene);
            mainBuilding.position.set(0, 5 * s, 0);
            mainBuilding.parent = parent;
            mainBuilding.material = mats.structureMat;
            
            // Building roof details
            const roof = BABYLON.MeshBuilder.CreateBox('refRoof', {
                width: 11 * s, height: 1 * s, depth: 13 * s
            }, this.scene);
            roof.position.set(0, 9.5 * s, 0);
            roof.parent = parent;
            roof.material = mats.techMat;
            
            // Roof vents
            for (let i = 0; i < 4; i++) {
                const vent = BABYLON.MeshBuilder.CreateBox('vent' + i, {
                    width: 2 * s, height: 1.5 * s, depth: 2 * s
                }, this.scene);
                vent.position.set((-3 + i * 2) * s, 10.5 * s, 0);
                vent.parent = parent;
                vent.material = mats.gratingMat;
            }
            
            // Storage tanks (large cylindrical)
            for (let i = 0; i < 3; i++) {
                const tank = BABYLON.MeshBuilder.CreateCylinder('tank' + i, {
                    height: 9 * s, diameter: 4 * s, tessellation: 20
                }, this.scene);
                tank.position.set(-7 * s, 5.5 * s, (-3 + i * 3) * s);
                tank.parent = parent;
                tank.material = mats.tankMat;
                
                // Tank dome
                const dome = BABYLON.MeshBuilder.CreateSphere('tankDome' + i, {
                    diameter: 4 * s, slice: 0.5, segments: 16
                }, this.scene);
                dome.position.set(-7 * s, 10 * s, (-3 + i * 3) * s);
                dome.parent = parent;
                dome.material = mats.tankMat;
                
                // Tank bands
                for (let j = 0; j < 3; j++) {
                    const band = BABYLON.MeshBuilder.CreateTorus('tankBand' + i + j, {
                        diameter: 4.2 * s, thickness: 0.2 * s, tessellation: 24
                    }, this.scene);
                    band.position.set(-7 * s, (2 + j * 3) * s, (-3 + i * 3) * s);
                    band.rotation.x = Math.PI / 2;
                    band.parent = parent;
                    band.material = mats.pipeMat;
                }
                
                // Pressure gauge
                const gauge = BABYLON.MeshBuilder.CreateCylinder('gauge' + i, {
                    height: 0.3 * s, diameter: 0.8 * s, tessellation: 12
                }, this.scene);
                gauge.position.set(-5.2 * s, 6 * s, (-3 + i * 3) * s);
                gauge.rotation.z = Math.PI / 2;
                gauge.parent = parent;
                gauge.material = mats.techMat;
            }
            
            // Smokestacks
            for (let i = 0; i < 2; i++) {
                const stack = BABYLON.MeshBuilder.CreateCylinder('stack' + i, {
                    height: 14 * s, diameterTop: 1.5 * s, diameterBottom: 2.2 * s, tessellation: 16
                }, this.scene);
                stack.position.set((3 + i * 3) * s, 8 * s, -5 * s);
                stack.parent = parent;
                stack.material = mats.structureMat;
                
                // Stack bands
                for (let j = 0; j < 4; j++) {
                    const stackBand = BABYLON.MeshBuilder.CreateTorus('stackBand' + i + j, {
                        diameter: 2 * s, thickness: 0.15 * s, tessellation: 16
                    }, this.scene);
                    stackBand.position.set((3 + i * 3) * s, (3 + j * 3) * s, -5 * s);
                    stackBand.rotation.x = Math.PI / 2;
                    stackBand.parent = parent;
                    stackBand.material = mats.hazardMat;
                }
                
                // Orange glow at top
                const glow = BABYLON.MeshBuilder.CreateCylinder('stackGlow' + i, {
                    height: 0.8 * s, diameter: 1.2 * s, tessellation: 12
                }, this.scene);
                glow.position.set((3 + i * 3) * s, 15.4 * s, -5 * s);
                glow.parent = parent;
                const stackGlowMat = mats.muzzleMat.clone('stackGlow' + i);
                glow.material = stackGlowMat;
            }
            
            // Pipe network
            const pipePositions = [
                { start: [-5, 4, -3], end: [-5, 4, 3], d: 0.5 },
                { start: [-5, 4, -3], end: [0, 4, -3], d: 0.5 },
                { start: [-5, 4, 0], end: [0, 4, 0], d: 0.5 },
                { start: [-5, 4, 3], end: [0, 4, 3], d: 0.5 },
                { start: [5, 2, 0], end: [5, 2, 6], d: 0.6 },
            ];
            
            pipePositions.forEach((p, idx) => {
                const length = Math.sqrt(
                    Math.pow(p.end[0] - p.start[0], 2) +
                    Math.pow(p.end[1] - p.start[1], 2) +
                    Math.pow(p.end[2] - p.start[2], 2)
                );
                const pipe = BABYLON.MeshBuilder.CreateCylinder('pipe' + idx, {
                    height: length * s, diameter: p.d * s, tessellation: 12
                }, this.scene);
                
                pipe.position.set(
                    ((p.start[0] + p.end[0]) / 2) * s,
                    ((p.start[1] + p.end[1]) / 2) * s,
                    ((p.start[2] + p.end[2]) / 2) * s
                );
                
                // Calculate rotation
                if (p.end[0] !== p.start[0]) {
                    pipe.rotation.z = Math.PI / 2;
                } else if (p.end[2] !== p.start[2]) {
                    pipe.rotation.x = Math.PI / 2;
                }
                
                pipe.parent = parent;
                pipe.material = mats.pipeMat;
            });
            
            // Ore input hopper
            const hopper = BABYLON.MeshBuilder.CreateCylinder('hopper', {
                height: 4 * s, diameterTop: 5 * s, diameterBottom: 2 * s, tessellation: 8
            }, this.scene);
            hopper.position.set(6 * s, 6 * s, 5 * s);
            hopper.parent = parent;
            hopper.material = mats.structureMat;
            
            // Hopper glow (active processing)
            const hopperGlow = BABYLON.MeshBuilder.CreateCylinder('hopperGlow', {
                height: 0.5 * s, diameter: 4 * s, tessellation: 12
            }, this.scene);
            hopperGlow.position.set(6 * s, 8.25 * s, 5 * s);
            hopperGlow.parent = parent;
            const hopperMat = mats.energyMat.clone('hopperMat');
            hopperMat.emissiveColor = new BABYLON.Color3(1, 0.6, 0.2);
            hopperGlow.material = hopperMat;
            
            // Conveyor ramp
            const conveyor = BABYLON.MeshBuilder.CreateBox('conveyor', {
                width: 2 * s, height: 0.3 * s, depth: 8 * s
            }, this.scene);
            conveyor.position.set(6 * s, 2.5 * s, 9 * s);
            conveyor.rotation.x = -0.3;
            conveyor.parent = parent;
            conveyor.material = mats.gratingMat;
            
            // Conveyor sides
            for (let i = 0; i < 2; i++) {
                const side = BABYLON.MeshBuilder.CreateBox('convSide' + i, {
                    width: 0.2 * s, height: 0.8 * s, depth: 8 * s
                }, this.scene);
                side.position.set((5 + i * 2) * s, 2.7 * s, 9 * s);
                side.rotation.x = -0.3;
                side.parent = parent;
                side.material = mats.hazardMat;
            }
            
            // Control booth
            const booth = BABYLON.MeshBuilder.CreateBox('booth', {
                width: 4 * s, height: 4 * s, depth: 3 * s
            }, this.scene);
            booth.position.set(6 * s, 3 * s, -6 * s);
            booth.parent = parent;
            booth.material = mats.structureMat;
            
            // Booth windows
            const boothWindow = BABYLON.MeshBuilder.CreateBox('boothWin', {
                width: 3 * s, height: 2 * s, depth: 0.2 * s
            }, this.scene);
            boothWindow.position.set(6 * s, 3.5 * s, -4.4 * s);
            boothWindow.parent = parent;
            boothWindow.material = mats.windowMat;
        },

        createShipyard: function(parent, s, mats, advanced) {
            const scale = advanced ? 1.4 : 1;
            s = s * scale;
            
            // Large foundation platform
            const foundation = BABYLON.MeshBuilder.CreateBox('syFound', {
                width: 20 * s, height: 1.5 * s, depth: 24 * s
            }, this.scene);
            foundation.position.y = 0.75 * s;
            foundation.parent = parent;
            foundation.material = mats.concreteMat;
            
            // Main hangar structure
            const hangar = BABYLON.MeshBuilder.CreateBox('syHangar', {
                width: 16 * s, height: 8 * s, depth: 20 * s
            }, this.scene);
            hangar.position.y = 5 * s;
            hangar.parent = parent;
            hangar.material = mats.structureMat;
            
            // Hangar roof (curved)
            const roofPath = [];
            for (let i = 0; i <= 20; i++) {
                const t = i / 20;
                roofPath.push(new BABYLON.Vector3(
                    (t - 0.5) * 18 * s,
                    Math.sin(t * Math.PI) * 3 * s,
                    0
                ));
            }
            const roofShape = [
                new BABYLON.Vector3(0, 0, -10 * s),
                new BABYLON.Vector3(0, 0, 10 * s)
            ];
            
            // Hangar bay doors (front and back)
            for (let side = 0; side < 2; side++) {
                const doorZ = side === 0 ? 10 : -10;
                
                // Door frame
                const frame = BABYLON.MeshBuilder.CreateBox('doorFrame' + side, {
                    width: 12 * s, height: 7 * s, depth: 0.5 * s
                }, this.scene);
                frame.position.set(0, 4.5 * s, doorZ * s);
                frame.parent = parent;
                frame.material = mats.techMat;
                
                // Door opening (darker)
                const opening = BABYLON.MeshBuilder.CreateBox('doorOpen' + side, {
                    width: 10 * s, height: 6 * s, depth: 0.3 * s
                }, this.scene);
                opening.position.set(0, 4 * s, (doorZ + (side === 0 ? 0.3 : -0.3)) * s);
                opening.parent = parent;
                const openMat = new BABYLON.StandardMaterial('openMat' + side, this.scene);
                openMat.diffuseColor = new BABYLON.Color3(0.05, 0.08, 0.12);
                openMat.emissiveColor = new BABYLON.Color3(0.02, 0.03, 0.05);
                opening.material = openMat;
                
                // Hazard stripes on door frame
                for (let i = 0; i < 2; i++) {
                    const stripe = BABYLON.MeshBuilder.CreateBox('stripe' + side + i, {
                        width: 0.8 * s, height: 7 * s, depth: 0.6 * s
                    }, this.scene);
                    stripe.position.set((i === 0 ? -5.5 : 5.5) * s, 4.5 * s, doorZ * s);
                    stripe.parent = parent;
                    stripe.material = mats.hazardMat;
                }
            }
            
            // Construction gantry (overhead crane)
            const gantryHeight = 12 * s;
            
            // Gantry supports
            for (let i = 0; i < 4; i++) {
                const gx = (i < 2 ? -8 : 8) * s;
                const gz = (i % 2 === 0 ? -8 : 8) * s;
                
                const support = BABYLON.MeshBuilder.CreateBox('gantrySupport' + i, {
                    width: 1.2 * s, height: gantryHeight, depth: 1.2 * s
                }, this.scene);
                support.position.set(gx, gantryHeight / 2 + 1 * s, gz);
                support.parent = parent;
                support.material = mats.structureMat;
            }
            
            // Gantry rails
            for (let i = 0; i < 2; i++) {
                const rail = BABYLON.MeshBuilder.CreateBox('gantryRail' + i, {
                    width: 1 * s, height: 1.5 * s, depth: 18 * s
                }, this.scene);
                rail.position.set((i === 0 ? -8 : 8) * s, gantryHeight + 1.5 * s, 0);
                rail.parent = parent;
                rail.material = mats.techMat;
            }
            
            // Gantry cross beam
            const crossBeam = BABYLON.MeshBuilder.CreateBox('crossBeam', {
                width: 18 * s, height: 1.5 * s, depth: 1 * s
            }, this.scene);
            crossBeam.position.set(0, gantryHeight + 1.5 * s, 0);
            crossBeam.parent = parent;
            crossBeam.material = mats.structureMat;
            
            // Crane trolley
            const trolley = BABYLON.MeshBuilder.CreateBox('trolley', {
                width: 3 * s, height: 2 * s, depth: 2 * s
            }, this.scene);
            trolley.position.set(0, gantryHeight + 0.5 * s, 0);
            trolley.parent = parent;
            trolley.material = mats.techMat;
            
            // Crane hook
            const hookCable = BABYLON.MeshBuilder.CreateCylinder('hookCable', {
                height: 5 * s, diameter: 0.15 * s, tessellation: 8
            }, this.scene);
            hookCable.position.set(0, gantryHeight - 2 * s, 0);
            hookCable.parent = parent;
            hookCable.material = mats.pipeMat;
            
            const hook = BABYLON.MeshBuilder.CreateTorus('hook', {
                diameter: 1.5 * s, thickness: 0.2 * s, tessellation: 16
            }, this.scene);
            hook.position.set(0, gantryHeight - 5 * s, 0);
            hook.rotation.x = Math.PI / 2;
            hook.parent = parent;
            hook.material = mats.hazardMat;
            
            // Docking arms (4 extending arms with clamps)
            for (let i = 0; i < 4; i++) {
                const side = i < 2 ? -1 : 1;
                const front = i % 2 === 0 ? -1 : 1;
                
                // Arm base
                const armBase = BABYLON.MeshBuilder.CreateBox('armBase' + i, {
                    width: 2.5 * s, height: 2 * s, depth: 2.5 * s
                }, this.scene);
                armBase.position.set(side * 8.5 * s, 6 * s, front * 6 * s);
                armBase.parent = parent;
                armBase.material = mats.structureMat;
                
                // Arm extension
                const arm = BABYLON.MeshBuilder.CreateBox('arm' + i, {
                    width: 2 * s, height: 1.5 * s, depth: 8 * s
                }, this.scene);
                arm.position.set(side * 8.5 * s, 6 * s, front * 10 * s);
                arm.parent = parent;
                arm.material = mats.techMat;
                
                // Arm clamp
                const clamp = BABYLON.MeshBuilder.CreateCylinder('clamp' + i, {
                    height: 2 * s, diameterTop: 1.5 * s, diameterBottom: 2 * s, tessellation: 8
                }, this.scene);
                clamp.position.set(side * 8.5 * s, 6 * s, front * 14 * s);
                clamp.rotation.x = Math.PI / 2;
                clamp.parent = parent;
                clamp.material = mats.weaponMat;
                
                // Arm tip light
                const tipLight = BABYLON.MeshBuilder.CreateSphere('armTip' + i, {
                    diameter: 1 * s
                }, this.scene);
                tipLight.position.set(side * 8.5 * s, 6 * s, front * 15 * s);
                tipLight.parent = parent;
                const tipMat = mats.glowMat.clone('tipMat' + i);
                tipMat.emissiveColor = new BABYLON.Color3(0, 1, 0.5);
                tipLight.material = tipMat;
            }
            
            // Landing pad lights
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
                const light = BABYLON.MeshBuilder.CreateCylinder('padLight' + i, {
                    height: 0.4 * s, diameter: 1.2 * s, tessellation: 12
                }, this.scene);
                light.position.x = Math.cos(angle) * 11 * s;
                light.position.z = Math.sin(angle) * 11 * s;
                light.position.y = 0.2 * s;
                light.parent = parent;
                light.material = mats.glowMat;
            }
            
            // Control tower
            const tower = BABYLON.MeshBuilder.CreateBox('syTower', {
                width: 4 * s, height: 10 * s, depth: 4 * s
            }, this.scene);
            tower.position.set(10 * s, 6 * s, -10 * s);
            tower.parent = parent;
            tower.material = mats.structureMat;
            
            // Tower windows
            const towerWindow = BABYLON.MeshBuilder.CreateBox('towerWin', {
                width: 3 * s, height: 4 * s, depth: 0.3 * s
            }, this.scene);
            towerWindow.position.set(10 * s, 9 * s, -7.8 * s);
            towerWindow.parent = parent;
            towerWindow.material = mats.windowMat;
            
            // Advanced shipyard additions
            if (advanced) {
                // Energy field emitters
                for (let i = 0; i < 2; i++) {
                    const emitter = BABYLON.MeshBuilder.CreateCylinder('emitter' + i, {
                        height: 8 * s, diameter: 1.5 * s, tessellation: 12
                    }, this.scene);
                    emitter.position.set((i === 0 ? -6 : 6) * s, 5 * s, 0);
                    emitter.parent = parent;
                    emitter.material = mats.techMat;
                    
                    // Emitter glow
                    const emitterGlow = BABYLON.MeshBuilder.CreateCylinder('emitterGlow' + i, {
                        height: 6 * s, diameter: 0.8 * s, tessellation: 8
                    }, this.scene);
                    emitterGlow.position.set((i === 0 ? -6 : 6) * s, 5 * s, 0);
                    emitterGlow.parent = parent;
                    const emitMat = mats.glowMat.clone('emitMat' + i);
                    emitMat.emissiveColor = new BABYLON.Color3(0.3, 0.5, 1);
                    emitMat.alpha = 0.7;
                    emitterGlow.material = emitMat;
                }
                
                // Construction energy beam (horizontal)
                const beam = BABYLON.MeshBuilder.CreateCylinder('constructBeam', {
                    height: 14 * s, diameter: 0.6 * s, tessellation: 8
                }, this.scene);
                beam.position.set(0, 5 * s, 0);
                beam.rotation.z = Math.PI / 2;
                beam.parent = parent;
                const beamMat = mats.glowMat.clone('beamMat');
                beamMat.emissiveColor = new BABYLON.Color3(0.4, 0.6, 1);
                beamMat.alpha = 0.5;
                beam.material = beamMat;
                
                // Extra gantry
                const extraGantry = BABYLON.MeshBuilder.CreateBox('extraGantry', {
                    width: 20 * s, height: 1 * s, depth: 1 * s
                }, this.scene);
                extraGantry.position.set(0, gantryHeight - 3 * s, 0);
                extraGantry.parent = parent;
                extraGantry.material = mats.techMat;
            }
        },

        createTurret: function(parent, s, mats) {
            // Reinforced base platform
            const basePlatform = BABYLON.MeshBuilder.CreateCylinder('turretPlatform', {
                height: 1 * s, diameter: 8 * s, tessellation: 12
            }, this.scene);
            basePlatform.position.y = 0.5 * s;
            basePlatform.parent = parent;
            basePlatform.material = mats.concreteMat;
            
            // Armored base pedestal
            const pedestal = BABYLON.MeshBuilder.CreateCylinder('turretPedestal', {
                height: 2.5 * s, diameterTop: 5 * s, diameterBottom: 6 * s, tessellation: 10
            }, this.scene);
            pedestal.position.y = 2.25 * s;
            pedestal.parent = parent;
            pedestal.material = mats.structureMat;
            
            // Base armor plates
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                const plate = BABYLON.MeshBuilder.CreateBox('basePlate' + i, {
                    width: 2 * s, height: 2 * s, depth: 0.4 * s
                }, this.scene);
                plate.position.x = Math.cos(angle) * 2.8 * s;
                plate.position.z = Math.sin(angle) * 2.8 * s;
                plate.position.y = 2.5 * s;
                plate.rotation.y = -angle + Math.PI / 2;
                plate.parent = parent;
                plate.material = mats.techMat;
            }
            
            // Rotating turret assembly (parent node for rotation)
            const turretHead = new BABYLON.TransformNode('turretHeadNode', this.scene);
            turretHead.position.y = 4 * s;
            turretHead.parent = parent;
            
            // Turret body (main housing)
            const turretBody = BABYLON.MeshBuilder.CreateCylinder('turretBody', {
                height: 3 * s, diameterTop: 3.5 * s, diameterBottom: 4.5 * s, tessellation: 10
            }, this.scene);
            turretBody.parent = turretHead;
            turretBody.material = mats.structureMat;
            
            // Turret armor cowling
            const cowling = BABYLON.MeshBuilder.CreateSphere('cowling', {
                diameter: 4 * s, segments: 12, slice: 0.5
            }, this.scene);
            cowling.position.y = 1 * s;
            cowling.rotation.x = Math.PI;
            cowling.parent = turretHead;
            cowling.material = mats.techMat;
            
            // Gun mantlet (front armor where barrels emerge)
            const mantlet = BABYLON.MeshBuilder.CreateBox('mantlet', {
                width: 3 * s, height: 2 * s, depth: 1 * s
            }, this.scene);
            mantlet.position.set(0, 0.5 * s, 2 * s);
            mantlet.parent = turretHead;
            mantlet.material = mats.weaponMat;
            
            // Dual gun barrels
            for (let i = 0; i < 2; i++) {
                const xOff = (i === 0 ? -0.7 : 0.7) * s;
                
                // Barrel base
                const barrelBase = BABYLON.MeshBuilder.CreateCylinder('barrelBase' + i, {
                    height: 1 * s, diameter: 0.8 * s, tessellation: 12
                }, this.scene);
                barrelBase.rotation.x = Math.PI / 2;
                barrelBase.position.set(xOff, 0.5 * s, 2.5 * s);
                barrelBase.parent = turretHead;
                barrelBase.material = mats.weaponMat;
                
                // Main barrel
                const barrel = BABYLON.MeshBuilder.CreateCylinder('barrel' + i, {
                    height: 6 * s, diameterTop: 0.5 * s, diameterBottom: 0.6 * s, tessellation: 12
                }, this.scene);
                barrel.rotation.x = Math.PI / 2;
                barrel.position.set(xOff, 0.5 * s, 5.5 * s);
                barrel.parent = turretHead;
                barrel.material = mats.weaponMat;
                
                // Barrel cooling vents
                for (let j = 0; j < 3; j++) {
                    const vent = BABYLON.MeshBuilder.CreateTorus('barrelVent' + i + j, {
                        diameter: 0.7 * s, thickness: 0.08 * s, tessellation: 16
                    }, this.scene);
                    vent.position.set(xOff, 0.5 * s, (4 + j * 1.2) * s);
                    vent.rotation.x = Math.PI / 2;
                    vent.parent = turretHead;
                    vent.material = mats.pipeMat;
                }
                
                // Muzzle brake
                const muzzle = BABYLON.MeshBuilder.CreateCylinder('muzzle' + i, {
                    height: 0.8 * s, diameterTop: 0.7 * s, diameterBottom: 0.5 * s, tessellation: 8
                }, this.scene);
                muzzle.rotation.x = Math.PI / 2;
                muzzle.position.set(xOff, 0.5 * s, 8.7 * s);
                muzzle.parent = turretHead;
                muzzle.material = mats.weaponMat;
                
                // Muzzle glow
                const muzzleGlow = BABYLON.MeshBuilder.CreateSphere('muzzleGlow' + i, {
                    diameter: 0.6 * s
                }, this.scene);
                muzzleGlow.position.set(xOff, 0.5 * s, 9.2 * s);
                muzzleGlow.parent = turretHead;
                muzzleGlow.material = mats.muzzleMat;
            }
            
            // Sensor/targeting array
            const sensorMount = BABYLON.MeshBuilder.CreateCylinder('sensorMount', {
                height: 1 * s, diameter: 1.2 * s, tessellation: 8
            }, this.scene);
            sensorMount.position.y = 2.5 * s;
            sensorMount.parent = turretHead;
            sensorMount.material = mats.techMat;
            
            const sensor = BABYLON.MeshBuilder.CreateSphere('sensor', {
                diameter: 1 * s, segments: 12
            }, this.scene);
            sensor.position.y = 3.2 * s;
            sensor.parent = turretHead;
            sensor.material = mats.glowMat;
            
            // Side sensor pods
            for (let i = 0; i < 2; i++) {
                const pod = BABYLON.MeshBuilder.CreateBox('sensorPod' + i, {
                    width: 0.8 * s, height: 0.8 * s, depth: 1.5 * s
                }, this.scene);
                pod.position.set((i === 0 ? -2 : 2) * s, 0.5 * s, 0.5 * s);
                pod.parent = turretHead;
                pod.material = mats.techMat;
                
                const podLens = BABYLON.MeshBuilder.CreateCylinder('podLens' + i, {
                    height: 0.2 * s, diameter: 0.5 * s, tessellation: 12
                }, this.scene);
                podLens.rotation.x = Math.PI / 2;
                podLens.position.set((i === 0 ? -2 : 2) * s, 0.5 * s, 1.3 * s);
                podLens.parent = turretHead;
                podLens.material = mats.glowMat;
            }
            
            // Ammo feed system (visible on back)
            const ammoFeed = BABYLON.MeshBuilder.CreateBox('ammoFeed', {
                width: 2 * s, height: 1.5 * s, depth: 2 * s
            }, this.scene);
            ammoFeed.position.set(0, 0, -2 * s);
            ammoFeed.parent = turretHead;
            ammoFeed.material = mats.structureMat;
            
            // Store turret head reference for rotation
            parent.turretHead = turretHead;
        },

        createSupplyDepot: function(parent, s, mats) {
            // Landing pad foundation
            const pad = BABYLON.MeshBuilder.CreateBox('sdPad', {
                width: 12 * s, height: 0.5 * s, depth: 12 * s
            }, this.scene);
            pad.position.y = 0.25 * s;
            pad.parent = parent;
            pad.material = mats.concreteMat;
            
            // Pad markings (H pattern for landing)
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2;
                const marking = BABYLON.MeshBuilder.CreateBox('padMark' + i, {
                    width: 4 * s, height: 0.1 * s, depth: 0.6 * s
                }, this.scene);
                marking.position.x = Math.cos(angle) * 4 * s;
                marking.position.z = Math.sin(angle) * 4 * s;
                marking.position.y = 0.55 * s;
                marking.rotation.y = angle;
                marking.parent = parent;
                marking.material = mats.hazardMat;
            }
            
            // Main storage building
            const mainStorage = BABYLON.MeshBuilder.CreateBox('mainStorage', {
                width: 6 * s, height: 4 * s, depth: 8 * s
            }, this.scene);
            mainStorage.position.set(-2 * s, 2.5 * s, 0);
            mainStorage.parent = parent;
            mainStorage.material = mats.structureMat;
            
            // Storage building roof
            const roof = BABYLON.MeshBuilder.CreateBox('sdRoof', {
                width: 7 * s, height: 0.5 * s, depth: 9 * s
            }, this.scene);
            roof.position.set(-2 * s, 4.75 * s, 0);
            roof.parent = parent;
            roof.material = mats.techMat;
            
            // Loading bay door
            const bayDoor = BABYLON.MeshBuilder.CreateBox('bayDoor', {
                width: 4 * s, height: 3 * s, depth: 0.3 * s
            }, this.scene);
            bayDoor.position.set(-2 * s, 2 * s, 4.15 * s);
            bayDoor.parent = parent;
            bayDoor.material = mats.gratingMat;
            
            // Hazard stripes around door
            for (let i = 0; i < 2; i++) {
                const stripe = BABYLON.MeshBuilder.CreateBox('doorStripe' + i, {
                    width: 0.5 * s, height: 3.5 * s, depth: 0.4 * s
                }, this.scene);
                stripe.position.set((-4 + i * 4) * s, 2.25 * s, 4.2 * s);
                stripe.parent = parent;
                stripe.material = mats.hazardMat;
            }
            
            // Stacked cargo containers
            const containerConfigs = [
                { x: 3, z: -2, w: 2.5, h: 2.5, d: 4, rot: 0 },
                { x: 3, z: 2, w: 3, h: 2, d: 3.5, rot: 0.1 },
                { x: 3.5, z: -2, w: 2, h: 2, d: 3, rot: -0.05, y: 2.5 },
                { x: -2, z: -3.5, w: 2, h: 1.5, d: 2, rot: 0.2 }
            ];
            
            containerConfigs.forEach((c, idx) => {
                const container = BABYLON.MeshBuilder.CreateBox('container' + idx, {
                    width: c.w * s, height: c.h * s, depth: c.d * s
                }, this.scene);
                container.position.set(c.x * s, (c.y || c.h / 2 + 0.5) * s, c.z * s);
                container.rotation.y = c.rot;
                container.parent = parent;
                
                // Vary container colors
                const contMat = mats.structureMat.clone('contMat' + idx);
                const hue = 0.3 + (idx * 0.15);
                contMat.diffuseColor = new BABYLON.Color3(0.4 * hue, 0.5 * hue, 0.3);
                container.material = contMat;
                
                // Container ribs
                for (let j = 0; j < 3; j++) {
                    const rib = BABYLON.MeshBuilder.CreateBox('rib' + idx + j, {
                        width: 0.15 * s, height: c.h * 0.9 * s, depth: c.d * 0.95 * s
                    }, this.scene);
                    rib.position.set(
                        (c.x + (j - 1) * c.w * 0.35) * s,
                        (c.y || c.h / 2 + 0.5) * s,
                        c.z * s
                    );
                    rib.rotation.y = c.rot;
                    rib.parent = parent;
                    rib.material = mats.pipeMat;
                }
            });
            
            // Supply beacon tower
            const beaconBase = BABYLON.MeshBuilder.CreateCylinder('beaconBase', {
                height: 1.5 * s, diameterTop: 1 * s, diameterBottom: 1.5 * s, tessellation: 8
            }, this.scene);
            beaconBase.position.set(4 * s, 1.25 * s, -4 * s);
            beaconBase.parent = parent;
            beaconBase.material = mats.structureMat;
            
            const beaconPole = BABYLON.MeshBuilder.CreateCylinder('beaconPole', {
                height: 7 * s, diameterTop: 0.3 * s, diameterBottom: 0.6 * s, tessellation: 8
            }, this.scene);
            beaconPole.position.set(4 * s, 5.5 * s, -4 * s);
            beaconPole.parent = parent;
            beaconPole.material = mats.pipeMat;
            
            // Beacon light (pulsing)
            const beaconLight = BABYLON.MeshBuilder.CreateSphere('beaconLight', {
                diameter: 1.2 * s, segments: 12
            }, this.scene);
            beaconLight.position.set(4 * s, 9.5 * s, -4 * s);
            beaconLight.parent = parent;
            beaconLight.material = mats.glowMat;
            
            // Beacon arms
            for (let i = 0; i < 3; i++) {
                const angle = (i / 3) * Math.PI * 2;
                const arm = BABYLON.MeshBuilder.CreateCylinder('beaconArm' + i, {
                    height: 1.5 * s, diameter: 0.2 * s, tessellation: 8
                }, this.scene);
                arm.position.set(
                    (4 + Math.cos(angle) * 0.7) * s,
                    8.8 * s,
                    (-4 + Math.sin(angle) * 0.7) * s
                );
                arm.rotation.z = Math.PI / 4;
                arm.rotation.y = angle;
                arm.parent = parent;
                arm.material = mats.techMat;
            }
            
            // Fuel/power cells
            for (let i = 0; i < 3; i++) {
                const cell = BABYLON.MeshBuilder.CreateCylinder('fuelCell' + i, {
                    height: 2 * s, diameter: 0.8 * s, tessellation: 12
                }, this.scene);
                cell.position.set(-5 * s, 1.5 * s, (-2 + i * 2) * s);
                cell.parent = parent;
                cell.material = mats.tankMat;
                
                // Cell cap
                const cap = BABYLON.MeshBuilder.CreateSphere('cellCap' + i, {
                    diameter: 0.8 * s, slice: 0.5
                }, this.scene);
                cap.position.set(-5 * s, 2.5 * s, (-2 + i * 2) * s);
                cap.parent = parent;
                cap.material = mats.techMat;
            }
            
            // Small control panel
            const panel = BABYLON.MeshBuilder.CreateBox('controlPanel', {
                width: 1 * s, height: 1.5 * s, depth: 0.3 * s
            }, this.scene);
            panel.position.set(1 * s, 1.25 * s, 4 * s);
            panel.rotation.y = Math.PI;
            panel.parent = parent;
            panel.material = mats.techMat;
            
            // Panel screen
            const screen = BABYLON.MeshBuilder.CreateBox('panelScreen', {
                width: 0.7 * s, height: 0.5 * s, depth: 0.1 * s
            }, this.scene);
            screen.position.set(1 * s, 1.5 * s, 3.8 * s);
            screen.parent = parent;
            const screenMat = mats.glowMat.clone('screenMat');
            screenMat.emissiveColor = new BABYLON.Color3(0.2, 0.8, 0.3);
            screen.material = screenMat;
        },

        // ===== MAIN CREATION METHOD =====
        createBuildingMesh: function(buildingType, size, color, team, parentMesh) {
            const [r, g, b] = color;
            const mats = this.createBuildingMaterials(r, g, b, team);
            
            // Scale factor based on building type
            const scaleFactors = {
                commandCenter: size / 14,
                powerPlant: size / 8,
                refinery: size / 10,
                shipyard: size / 14,
                advancedShipyard: size / 18,
                turret: size / 5,
                supplyDepot: size / 6
            };
            
            const s = scaleFactors[buildingType] || size / 8;
            
            switch(buildingType) {
                case 'commandCenter':
                    this.createCommandCenter(parentMesh, s, mats);
                    break;
                case 'powerPlant':
                    this.createPowerPlant(parentMesh, s, mats);
                    break;
                case 'refinery':
                    this.createRefinery(parentMesh, s, mats);
                    break;
                case 'shipyard':
                    this.createShipyard(parentMesh, s, mats, false);
                    break;
                case 'advancedShipyard':
                    this.createShipyard(parentMesh, s, mats, true);
                    break;
                case 'turret':
                    this.createTurret(parentMesh, s, mats);
                    break;
                case 'supplyDepot':
                    this.createSupplyDepot(parentMesh, s, mats);
                    break;
                default:
                    console.warn('Unknown building type:', buildingType);
                    return false;
            }
            return true;
        }
    };

    // Export to window
    window.VoidBuildingsEnhanced = VoidBuildingsEnhanced;

})(window);

console.log('VoidBuildings Enhanced module loaded - detailed building models ready');
