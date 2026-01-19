// ============================================================
// VOID SUPREMACY 3D - Combat System
// Handles projectiles, damage, explosions, and weapon effects
// Uses MaterialPool for memory efficiency and GPU particles
// ============================================================

import { TEAM_COLORS, WEAPON_TYPES, UNITS, BUILDINGS } from '../core/Config.js?v=20260119';
import { eventBus, GameEvents } from '../core/EventBus.js?v=20260119';
import { gameState } from '../core/GameState.js?v=20260119';
import { MaterialPool } from '../core/MaterialPool.js?v=20260119';
import { forceFieldSystem } from './ForceFieldSystem.js?v=20260119';

export class CombatSystem {
    constructor() {
        this.projectiles = [];
        this.particles = [];
        this.beams = [];
        this.muzzleFlashes = [];
        this.trails = [];
        this.scene = null;

        // GPU Particle Systems (reusable)
        this.explosionParticleSystem = null;
        this.smokeParticleSystem = null;
        this.impactParticleSystem = null;

        // Muzzle flash light pool (reduces light creation/destruction overhead)
        this.lightPool = [];
        this.lightPoolSize = 30;
    }

    init(scene) {
        this.scene = scene;
        this.projectiles = [];
        this.particles = [];
        this.beams = [];
        this.muzzleFlashes = [];
        this.trails = [];

        // Initialize GPU particle systems
        this.initGPUParticleSystems();

        // Initialize muzzle flash light pool
        this.initLightPool();

        // Listen for combat events - store unsubscribe functions for cleanup
        this._unsubs = [
            eventBus.on(GameEvents.COMBAT_PROJECTILE_FIRED, (data) => {
                this.createProjectile(data);
            }),

            eventBus.on(GameEvents.COMBAT_EXPLOSION, (data) => {
                this.createExplosion(data.position, data.size, data.weaponType);
            }),

            eventBus.on(GameEvents.COMBAT_PROJECTILE_HIT, (data) => {
                this.createImpactEffect(data.position, data.weaponType);
            })
        ];
    }

    /**
     * Initialize GPU-based particle systems for effects
     * These are far more efficient than creating individual meshes
     */
    initGPUParticleSystems() {
        // Explosion particle system
        this.explosionParticleSystem = new BABYLON.ParticleSystem('explosions', 500, this.scene);
        this.explosionParticleSystem.particleTexture = this.createParticleTexture();
        this.explosionParticleSystem.emitter = BABYLON.Vector3.Zero();
        this.explosionParticleSystem.minEmitBox = new BABYLON.Vector3(-0.5, -0.5, -0.5);
        this.explosionParticleSystem.maxEmitBox = new BABYLON.Vector3(0.5, 0.5, 0.5);
        this.explosionParticleSystem.color1 = new BABYLON.Color4(1, 0.5, 0, 1);
        this.explosionParticleSystem.color2 = new BABYLON.Color4(1, 0.2, 0, 1);
        this.explosionParticleSystem.colorDead = new BABYLON.Color4(0.2, 0.1, 0, 0);
        this.explosionParticleSystem.minSize = 0.5;
        this.explosionParticleSystem.maxSize = 2;
        this.explosionParticleSystem.minLifeTime = 0.3;
        this.explosionParticleSystem.maxLifeTime = 0.8;
        this.explosionParticleSystem.emitRate = 0; // Manual bursts
        this.explosionParticleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
        this.explosionParticleSystem.gravity = new BABYLON.Vector3(0, -10, 0);
        this.explosionParticleSystem.direction1 = new BABYLON.Vector3(-1, 1, -1);
        this.explosionParticleSystem.direction2 = new BABYLON.Vector3(1, 2, 1);
        this.explosionParticleSystem.minAngularSpeed = 0;
        this.explosionParticleSystem.maxAngularSpeed = Math.PI;
        this.explosionParticleSystem.minEmitPower = 15;
        this.explosionParticleSystem.maxEmitPower = 30;
        this.explosionParticleSystem.updateSpeed = 0.01;
        this.explosionParticleSystem.start();

        // Smoke particle system for missile trails
        this.smokeParticleSystem = new BABYLON.ParticleSystem('smoke', 300, this.scene);
        this.smokeParticleSystem.particleTexture = this.createSmokeTexture();
        this.smokeParticleSystem.emitter = BABYLON.Vector3.Zero();
        this.smokeParticleSystem.minEmitBox = new BABYLON.Vector3(-0.1, -0.1, -0.1);
        this.smokeParticleSystem.maxEmitBox = new BABYLON.Vector3(0.1, 0.1, 0.1);
        this.smokeParticleSystem.color1 = new BABYLON.Color4(0.5, 0.5, 0.5, 0.8);
        this.smokeParticleSystem.color2 = new BABYLON.Color4(0.3, 0.3, 0.3, 0.6);
        this.smokeParticleSystem.colorDead = new BABYLON.Color4(0.1, 0.1, 0.1, 0);
        this.smokeParticleSystem.minSize = 0.3;
        this.smokeParticleSystem.maxSize = 0.8;
        this.smokeParticleSystem.minLifeTime = 0.3;
        this.smokeParticleSystem.maxLifeTime = 0.6;
        this.smokeParticleSystem.emitRate = 0;
        this.smokeParticleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
        this.smokeParticleSystem.gravity = new BABYLON.Vector3(0, 2, 0);
        this.smokeParticleSystem.direction1 = new BABYLON.Vector3(-0.5, 0, -0.5);
        this.smokeParticleSystem.direction2 = new BABYLON.Vector3(0.5, 1, 0.5);
        this.smokeParticleSystem.minEmitPower = 2;
        this.smokeParticleSystem.maxEmitPower = 4;
        this.smokeParticleSystem.updateSpeed = 0.01;
        this.smokeParticleSystem.start();

        // Impact particle system for hits
        this.impactParticleSystem = new BABYLON.ParticleSystem('impact', 200, this.scene);
        this.impactParticleSystem.particleTexture = this.createParticleTexture();
        this.impactParticleSystem.emitter = BABYLON.Vector3.Zero();
        this.impactParticleSystem.minEmitBox = new BABYLON.Vector3(-0.2, -0.2, -0.2);
        this.impactParticleSystem.maxEmitBox = new BABYLON.Vector3(0.2, 0.2, 0.2);
        this.impactParticleSystem.color1 = new BABYLON.Color4(1, 1, 0, 1);
        this.impactParticleSystem.color2 = new BABYLON.Color4(1, 0.5, 0, 1);
        this.impactParticleSystem.colorDead = new BABYLON.Color4(0.5, 0.2, 0, 0);
        this.impactParticleSystem.minSize = 0.2;
        this.impactParticleSystem.maxSize = 0.5;
        this.impactParticleSystem.minLifeTime = 0.15;
        this.impactParticleSystem.maxLifeTime = 0.3;
        this.impactParticleSystem.emitRate = 0;
        this.impactParticleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
        this.impactParticleSystem.gravity = new BABYLON.Vector3(0, -5, 0);
        this.impactParticleSystem.direction1 = new BABYLON.Vector3(-1, 0, -1);
        this.impactParticleSystem.direction2 = new BABYLON.Vector3(1, 1, 1);
        this.impactParticleSystem.minEmitPower = 8;
        this.impactParticleSystem.maxEmitPower = 15;
        this.impactParticleSystem.updateSpeed = 0.01;
        this.impactParticleSystem.start();
    }

    /**
     * Create a simple procedural texture for particles
     */
    createParticleTexture() {
        const size = 64;
        const dynamicTexture = new BABYLON.DynamicTexture('particleTex', size, this.scene, false);
        const ctx = dynamicTexture.getContext();

        // Create radial gradient (soft circle)
        const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.7, 'rgba(255, 200, 100, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 100, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        dynamicTexture.update();

        return dynamicTexture;
    }

    /**
     * Create smoke texture
     */
    createSmokeTexture() {
        const size = 64;
        const dynamicTexture = new BABYLON.DynamicTexture('smokeTex', size, this.scene, false);
        const ctx = dynamicTexture.getContext();

        const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, 'rgba(200, 200, 200, 0.8)');
        gradient.addColorStop(0.5, 'rgba(150, 150, 150, 0.4)');
        gradient.addColorStop(1, 'rgba(100, 100, 100, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        dynamicTexture.update();

        return dynamicTexture;
    }

    /**
     * Initialize the muzzle flash light pool for reuse
     * Pre-creates lights that can be borrowed and returned
     */
    initLightPool() {
        this.lightPool = [];
        for (let i = 0; i < this.lightPoolSize; i++) {
            const light = new BABYLON.PointLight(`pooledLight_${i}`, BABYLON.Vector3.Zero(), this.scene);
            light.intensity = 0;
            light.range = 15;
            light.setEnabled(false);
            this.lightPool.push(light);
        }
    }

    /**
     * Get a light from the pool (or create new if pool empty)
     * @param {BABYLON.Vector3} position - Light position
     * @param {BABYLON.Color3} color - Light color
     * @returns {BABYLON.PointLight}
     */
    getPooledLight(position, color) {
        let light;
        if (this.lightPool.length > 0) {
            light = this.lightPool.pop();
            light.position.copyFrom(position);
        } else {
            // Pool exhausted, create new light
            light = new BABYLON.PointLight('muzzleLight', position.clone(), this.scene);
            light.range = 15;
        }
        light.diffuse = color;
        light.intensity = 5;
        light.setEnabled(true);
        return light;
    }

    /**
     * Return a light to the pool for reuse
     * @param {BABYLON.PointLight} light
     */
    returnLightToPool(light) {
        light.intensity = 0;
        light.setEnabled(false);
        // Only add back to pool if we haven't exceeded max pool size
        if (this.lightPool.length < this.lightPoolSize) {
            this.lightPool.push(light);
        } else {
            light.dispose();
        }
    }

    getWeaponType(shooter, hardpointWeapon) {
        if (hardpointWeapon) {
            return WEAPON_TYPES[hardpointWeapon] || WEAPON_TYPES.laser;
        }

        const def = shooter.def || UNITS[shooter.type] || BUILDINGS[shooter.type];
        if (def && def.weaponType) {
            return WEAPON_TYPES[def.weaponType] || WEAPON_TYPES.laser;
        }

        return WEAPON_TYPES.laser;
    }

    getWeaponColor(weaponDef, teamColor) {
        if (weaponDef.color === 'team') {
            return new BABYLON.Color3(teamColor[0], teamColor[1], teamColor[2]);
        }
        return new BABYLON.Color3(weaponDef.color[0], weaponDef.color[1], weaponDef.color[2]);
    }

    createProjectile(data) {
        const { shooter, target, startPos, damage, splash = 0, hardpointWeapon, hardpointOffset } = data;

        // Guard: skip if shooter is invalid (dead, disposed, or undefined)
        if (!shooter || !shooter.mesh) {
            return;
        }

        // Guard: skip if target is invalid (dead, disposed, or undefined)
        if (!target || !target.mesh || !target.mesh.position) {
            return;
        }

        const weaponDef = this.getWeaponType(shooter, hardpointWeapon);
        const teamColor = TEAM_COLORS[shooter.team];
        const color = this.getWeaponColor(weaponDef, teamColor);
        const weaponType = hardpointWeapon || shooter.def?.weaponType || 'laser';

        // Apply hardpoint offset if provided
        let firePos = startPos.clone();
        if (hardpointOffset && shooter.mesh) {
            const rotation = shooter.mesh.rotation.y;
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            firePos.x += hardpointOffset.x * cos - hardpointOffset.z * sin;
            firePos.y += hardpointOffset.y;
            firePos.z += hardpointOffset.x * sin + hardpointOffset.z * cos;
        }

        // Create muzzle flash at fire position
        this.createMuzzleFlash(firePos, color, weaponDef, shooter.team, weaponType);

        // Handle beam weapons (instant hit)
        if (weaponDef.instant) {
            this.createBeam(firePos, target, damage, splash, shooter.team, color, weaponDef, weaponType);
            return;
        }

        const projectile = {
            start: firePos.clone(),
            target: target,
            targetPos: target.mesh.position.clone(),
            damage: damage,
            team: shooter.team,
            splash: splash,
            progress: 0,
            speed: weaponDef.projectileSpeed || 3,
            weaponType: weaponType,
            weaponDef: weaponDef,
            mesh: null,
            trail: null,
            homing: weaponDef.homing || false
        };

        // Create projectile mesh using pooled materials
        projectile.mesh = this.createProjectileMesh(weaponDef, weaponType, shooter.team);
        projectile.mesh.position = firePos.clone();

        // Create trail for projectile
        if (weaponDef.trailLength > 0) {
            projectile.trail = this.createTrail(weaponDef, weaponType, shooter.team, projectile);
        }

        this.projectiles.push(projectile);
    }

    createProjectileMesh(weaponDef, weaponType, team) {
        const size = weaponDef.projectileSize || 1;
        let mesh;

        switch (weaponDef.sound) {
            case 'missile':
                mesh = BABYLON.MeshBuilder.CreateCylinder('projectile', {
                    height: size * 2,
                    diameter: size * 0.4,
                    tessellation: 8
                }, this.scene);
                mesh.rotation.x = Math.PI / 2;
                break;

            case 'plasma':
                mesh = BABYLON.MeshBuilder.CreateSphere('projectile', {
                    diameter: size,
                    segments: 8
                }, this.scene);
                break;

            case 'cannon':
                mesh = BABYLON.MeshBuilder.CreateSphere('projectile', {
                    diameter: size,
                    segments: 6
                }, this.scene);
                break;

            case 'laser':
            default:
                mesh = BABYLON.MeshBuilder.CreateSphere('projectile', {
                    diameter: size,
                    segments: 6
                }, this.scene);
                mesh.scaling = new BABYLON.Vector3(0.5, 0.5, 2);
                break;
        }

        // Use MaterialPool instead of creating new material
        mesh.material = MaterialPool.getProjectileMaterial(weaponType, team);
        return mesh;
    }

    createMuzzleFlash(position, color, weaponDef, team, weaponType) {
        const flashSize = (weaponDef.projectileSize || 1) * 2;
        const flash = BABYLON.MeshBuilder.CreateSphere('muzzleFlash', {
            diameter: flashSize,
            segments: 6
        }, this.scene);
        flash.position = position.clone();

        // Use MaterialPool
        flash.material = MaterialPool.getMuzzleMaterial(weaponType, team);

        // Get pooled light for muzzle flash (reduces light creation/disposal overhead)
        const light = this.getPooledLight(position, color);

        this.muzzleFlashes.push({
            mesh: flash,
            light: light,
            life: 0.1,
            startLife: 0.1
        });
    }

    createTrail(weaponDef, weaponType, team, projectile) {
        const trailLength = weaponDef.trailLength || 3;

        // For missiles, use GPU smoke particles instead of mesh
        if (weaponDef.sound === 'missile') {
            return {
                type: 'smoke',
                particles: [],
                spawnTimer: 0,
                projectile: projectile
            };
        }

        // For other weapons, create a line trail
        const trailMesh = BABYLON.MeshBuilder.CreateCylinder('trail', {
            height: trailLength,
            diameter: (weaponDef.projectileSize || 1) * 0.3,
            tessellation: 6
        }, this.scene);

        // Use MaterialPool
        trailMesh.material = MaterialPool.getTrailMaterial(weaponType, team);

        return {
            type: 'line',
            mesh: trailMesh,
            length: trailLength,
            projectile: projectile
        };
    }

    createBeam(startPos, target, damage, splash, team, color, weaponDef, weaponType) {
        // Guard: skip if target is invalid (dead, disposed, or undefined)
        if (!target || !target.mesh || !target.mesh.position) {
            return;
        }

        let targetPos = target.mesh.position.clone();
        let actualTarget = target;
        let hitForceField = false;

        // Check for force field collision
        const fieldHit = forceFieldSystem.checkProjectileCollision(
            { team },
            startPos,
            targetPos
        );

        if (fieldHit) {
            // Beam hits force field instead of target
            targetPos = fieldHit.intersection;
            actualTarget = null;
            hitForceField = true;
            forceFieldSystem.damageSegment(fieldHit.segment, damage, { team });
        }

        const distance = BABYLON.Vector3.Distance(startPos, targetPos);

        const beam = BABYLON.MeshBuilder.CreateCylinder('beam', {
            height: distance,
            diameter: 0.5,
            tessellation: 6
        }, this.scene);

        const midpoint = BABYLON.Vector3.Center(startPos, targetPos);
        beam.position = midpoint;
        beam.lookAt(targetPos);
        beam.rotation.x += Math.PI / 2;

        // Use MaterialPool
        beam.material = MaterialPool.getBeamMaterial(weaponType, team);

        // Apply damage immediately (only if not blocked by force field)
        if (!hitForceField && actualTarget && !actualTarget.dead) {
            if (splash > 0) {
                // Use spatial grid for efficient splash damage lookup (O(k) vs O(n))
                const nearbyEntities = gameState.queryNearbyEntities(
                    actualTarget.mesh.position.x, actualTarget.mesh.position.z, splash,
                    ent => !ent.dead && ent.team !== team
                );
                for (const ent of nearbyEntities) {
                    const dist = Math.hypot(
                        ent.mesh.position.x - actualTarget.mesh.position.x,
                        ent.mesh.position.z - actualTarget.mesh.position.z
                    );
                    const falloff = 1 - (dist / splash);
                    ent.takeDamage(damage * falloff, { team: team });
                }
            } else {
                actualTarget.takeDamage(damage, { team: team });
            }
        }

        this.beams.push({
            mesh: beam,
            life: weaponDef.duration || 0.2,
            startLife: weaponDef.duration || 0.2
        });

        this.createImpactEffect(targetPos, weaponType);
    }

    /**
     * Create explosion using GPU particle system
     */
    createExplosion(position, size, weaponType = 'default') {
        // Set explosion colors based on weapon type
        const colors = this.getExplosionColors(weaponType);
        this.explosionParticleSystem.color1 = new BABYLON.Color4(colors[0].r, colors[0].g, colors[0].b, 1);
        this.explosionParticleSystem.color2 = new BABYLON.Color4(colors[1].r, colors[1].g, colors[1].b, 1);

        // Emit burst at position
        this.explosionParticleSystem.emitter = position.clone();
        this.explosionParticleSystem.minSize = 0.3 + size * 0.1;
        this.explosionParticleSystem.maxSize = 1 + size * 0.3;
        this.explosionParticleSystem.minEmitPower = 10 + size * 2;
        this.explosionParticleSystem.maxEmitPower = 20 + size * 4;

        // Manual burst emit
        const particleCount = Math.min(50, Math.max(15, Math.floor(size * 5)));
        this.explosionParticleSystem.manualEmitCount = particleCount;

        // Create shockwave ring for larger explosions
        if (size > 3) {
            this.createShockwave(position, size);
        }
    }

    getExplosionColors(weaponType) {
        const palettes = {
            plasma: [
                new BABYLON.Color3(0, 1, 0.5),
                new BABYLON.Color3(0, 0.8, 0.3)
            ],
            missile: [
                new BABYLON.Color3(1, 0.5, 0),
                new BABYLON.Color3(1, 0.3, 0)
            ],
            beam: [
                new BABYLON.Color3(1, 0, 0),
                new BABYLON.Color3(1, 0.3, 0.1)
            ],
            cannon: [
                new BABYLON.Color3(1, 1, 0),
                new BABYLON.Color3(1, 0.8, 0.2)
            ],
            default: [
                new BABYLON.Color3(1, 0.5, 0),
                new BABYLON.Color3(1, 0.3, 0)
            ]
        };
        return palettes[weaponType] || palettes.default;
    }

    createShockwave(position, size) {
        const ring = BABYLON.MeshBuilder.CreateTorus('shockwave', {
            diameter: 1,
            thickness: 0.3,
            tessellation: 24
        }, this.scene);
        ring.position = position.clone();
        ring.rotation.x = Math.PI / 2;

        // Use MaterialPool
        ring.material = MaterialPool.getShockwaveMaterial();

        this.particles.push({
            mesh: ring,
            vx: 0, vy: 0, vz: 0,
            life: 0.5,
            startLife: 0.5,
            isShockwave: true,
            maxSize: size * 3
        });
    }

    /**
     * Create impact effect using GPU particles
     */
    createImpactEffect(position, weaponType = 'laser') {
        const colors = this.getExplosionColors(weaponType);
        this.impactParticleSystem.color1 = new BABYLON.Color4(colors[0].r, colors[0].g, colors[0].b, 1);
        this.impactParticleSystem.color2 = new BABYLON.Color4(colors[1].r, colors[1].g, colors[1].b, 1);
        this.impactParticleSystem.emitter = position.clone();
        this.impactParticleSystem.manualEmitCount = 8;
    }

    update(dt) {
        this.updateProjectiles(dt);
        this.updateParticles(dt);
        this.updateBeams(dt);
        this.updateMuzzleFlashes(dt);
        this.updateTrails(dt);
    }

    updateProjectiles(dt) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            const prevProgress = proj.progress;
            proj.progress += dt * proj.speed;

            let targetPos = proj.targetPos;
            if (proj.homing && proj.target && proj.target.mesh && !proj.target.dead) {
                targetPos = proj.target.mesh.position.clone();
                proj.targetPos = targetPos;
            }

            const prevPos = BABYLON.Vector3.Lerp(proj.start, targetPos, prevProgress);
            proj.mesh.position = BABYLON.Vector3.Lerp(proj.start, targetPos, proj.progress);

            // Check for force field collision
            const fieldHit = forceFieldSystem.checkProjectileCollision(
                proj,
                prevPos,
                proj.mesh.position
            );

            if (fieldHit) {
                // Projectile hit a force field - damage the field and destroy projectile
                forceFieldSystem.damageSegment(fieldHit.segment, proj.damage, { team: proj.team });

                eventBus.emit(GameEvents.COMBAT_PROJECTILE_HIT, {
                    projectile: proj,
                    position: fieldHit.intersection,
                    weaponType: proj.weaponType
                });

                // Cleanup
                proj.mesh.dispose();
                if (proj.trail && proj.trail.mesh) {
                    proj.trail.mesh.dispose();
                }
                this.projectiles.splice(i, 1);
                continue;
            }

            if (proj.weaponDef.sound === 'missile') {
                const direction = targetPos.subtract(proj.start).normalize();
                proj.mesh.lookAt(proj.mesh.position.add(direction));
                proj.mesh.rotation.x += Math.PI / 2;
            }

            if (proj.trail && proj.trail.type === 'line' && proj.trail.mesh) {
                const trailStart = proj.mesh.position.clone();
                const direction = proj.mesh.position.subtract(proj.start).normalize();
                const trailEnd = trailStart.subtract(direction.scale(proj.trail.length));
                const trailMid = BABYLON.Vector3.Center(trailStart, trailEnd);
                proj.trail.mesh.position = trailMid;
                proj.trail.mesh.lookAt(trailStart);
                proj.trail.mesh.rotation.x += Math.PI / 2;
            }

            if (proj.progress >= 1) {
                if (proj.target && !proj.target.dead) {
                    if (proj.splash > 0) {
                        // Use spatial grid for efficient splash damage lookup (O(k) vs O(n))
                        const nearbyEntities = gameState.queryNearbyEntities(
                            targetPos.x, targetPos.z, proj.splash,
                            ent => !ent.dead && ent.team !== proj.team
                        );
                        for (const ent of nearbyEntities) {
                            const dist = Math.hypot(
                                ent.mesh.position.x - targetPos.x,
                                ent.mesh.position.z - targetPos.z
                            );
                            const falloff = 1 - (dist / proj.splash);
                            ent.takeDamage(proj.damage * falloff, { team: proj.team });
                        }
                    } else {
                        proj.target.takeDamage(proj.damage, { team: proj.team });
                    }
                }

                eventBus.emit(GameEvents.COMBAT_PROJECTILE_HIT, {
                    projectile: proj,
                    position: targetPos.clone(),
                    weaponType: proj.weaponType
                });

                // Cleanup - don't dispose shared materials!
                proj.mesh.dispose();
                if (proj.trail && proj.trail.mesh) {
                    proj.trail.mesh.dispose();
                }
                this.projectiles.splice(i, 1);
            }
        }
    }

    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            if (p.isShockwave) {
                const progress = 1 - (p.life / p.startLife);
                const scale = 1 + progress * p.maxSize;
                p.mesh.scaling = new BABYLON.Vector3(scale, scale, 1);
                p.mesh.material.alpha = (1 - progress) * 0.7;
            } else {
                p.mesh.position.x += p.vx * dt;
                p.mesh.position.y += p.vy * dt;
                p.mesh.position.z += p.vz * dt;
                p.vy -= 20 * dt;
            }

            p.life -= dt;
            if (!p.isShockwave && p.mesh.material) {
                p.mesh.material.alpha = Math.max(0, p.life / p.startLife);
            }

            if (p.life <= 0) {
                p.mesh.dispose();
                this.particles.splice(i, 1);
            }
        }
    }

    updateBeams(dt) {
        for (let i = this.beams.length - 1; i >= 0; i--) {
            const beam = this.beams[i];
            beam.life -= dt;

            const alpha = beam.life / beam.startLife;
            if (beam.mesh.material) {
                beam.mesh.material.alpha = alpha * 0.8;
            }

            if (beam.life <= 0) {
                beam.mesh.dispose();
                this.beams.splice(i, 1);
            }
        }
    }

    updateMuzzleFlashes(dt) {
        for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
            const flash = this.muzzleFlashes[i];
            flash.life -= dt;

            const alpha = flash.life / flash.startLife;
            if (flash.mesh.material) {
                flash.mesh.material.alpha = alpha * 0.8;
            }
            flash.light.intensity = alpha * 5;

            const scale = 0.5 + alpha * 0.5;
            flash.mesh.scaling = new BABYLON.Vector3(scale, scale, scale);

            if (flash.life <= 0) {
                flash.mesh.dispose();
                // Return light to pool instead of disposing
                this.returnLightToPool(flash.light);
                this.muzzleFlashes.splice(i, 1);
            }
        }
    }

    updateTrails(dt) {
        // Update smoke trails for missiles using GPU particles
        for (const proj of this.projectiles) {
            if (proj.trail && proj.trail.type === 'smoke') {
                proj.trail.spawnTimer += dt;
                if (proj.trail.spawnTimer >= 0.02) {
                    proj.trail.spawnTimer = 0;
                    // Use GPU particle system instead of creating mesh
                    this.spawnSmokeParticle(proj.mesh.position.clone());
                }
            }
        }
    }

    /**
     * Spawn smoke using GPU particle system
     */
    spawnSmokeParticle(position) {
        this.smokeParticleSystem.emitter = position;
        this.smokeParticleSystem.manualEmitCount = 2;
    }

    dispose() {
        // Unsubscribe from event bus listeners
        this._unsubs?.forEach(unsub => unsub?.());
        this._unsubs = null;

        for (const proj of this.projectiles) {
            proj.mesh.dispose();
            if (proj.trail && proj.trail.mesh) {
                proj.trail.mesh.dispose();
            }
        }
        for (const p of this.particles) {
            p.mesh.dispose();
        }
        for (const beam of this.beams) {
            beam.mesh.dispose();
        }
        for (const flash of this.muzzleFlashes) {
            flash.mesh.dispose();
            this.returnLightToPool(flash.light);
        }

        // Dispose GPU particle systems
        if (this.explosionParticleSystem) this.explosionParticleSystem.dispose();
        if (this.smokeParticleSystem) this.smokeParticleSystem.dispose();
        if (this.impactParticleSystem) this.impactParticleSystem.dispose();

        // Dispose light pool
        for (const light of this.lightPool) {
            light.dispose();
        }
        this.lightPool = [];

        this.projectiles = [];
        this.particles = [];
        this.beams = [];
        this.muzzleFlashes = [];
        this.trails = [];
    }
}

export const combatSystem = new CombatSystem();

export default CombatSystem;
