// ============================================================
// VOID SUPREMACY 3D - Alien Unit Class
// Neutral alien defensive units
// ============================================================

import { Unit } from './Unit.js';
import { ALIEN_UNITS, UNITS, TEAM_COLORS } from '../core/Config.js';
import { gameState } from '../core/GameState.js';

export class AlienUnit extends Unit {
    constructor(x, z, team, alienType, scene) {
        // Use alien unit definitions
        const alienDef = ALIEN_UNITS[alienType];

        // Temporarily add to UNITS for base constructor
        const tempKey = 'alien_' + alienType;
        UNITS[tempKey] = alienDef;
        super(x, z, team, tempKey, scene);
        delete UNITS[tempKey];

        this.alienType = alienType;
        this.homeX = x;
        this.homeZ = z;
        this.aggroRange = 100;
        this.returnRange = 200;
    }

    createMesh(scene) {
        const color = TEAM_COLORS[this.team];
        const parent = new BABYLON.TransformNode('alien_' + this.alienType + '_' + this.id, scene);

        // Alien ships have unique organic-looking designs
        if (this.alienType === 'guardian') {
            this.createGuardianMesh(color, parent, scene);
        } else if (this.alienType === 'sentinel') {
            this.createSentinelMesh(color, parent, scene);
        }

        this.mesh = parent;
    }

    createGuardianMesh(color, parent, scene) {
        // Hexagonal alien fighter
        const body = BABYLON.MeshBuilder.CreateCylinder('body', {
            height: this.size * 0.5,
            diameter: this.size * 1.5,
            tessellation: 6
        }, scene);
        body.parent = parent;

        const mat = new BABYLON.StandardMaterial('mat_' + this.id, scene);
        mat.diffuseColor = new BABYLON.Color3(color[0], color[1], color[2]);
        mat.emissiveColor = new BABYLON.Color3(color[0] * 0.4, color[1] * 0.4, color[2] * 0.4);
        body.material = mat;

        // Central eye/core
        const core = BABYLON.MeshBuilder.CreateSphere('core', { diameter: this.size * 0.5 }, scene);
        core.parent = parent;
        core.position.y = this.size * 0.3;

        const coreMat = new BABYLON.StandardMaterial('coreMat_' + this.id, scene);
        coreMat.emissiveColor = new BABYLON.Color3(1, 0.5, 1);
        core.material = coreMat;
    }

    createSentinelMesh(color, parent, scene) {
        // Large alien capital ship
        const body = BABYLON.MeshBuilder.CreatePolyhedron('body', {
            type: 1,
            size: this.size * 0.6
        }, scene);
        body.parent = parent;

        const mat = new BABYLON.StandardMaterial('mat_' + this.id, scene);
        mat.diffuseColor = new BABYLON.Color3(color[0], color[1], color[2]);
        mat.emissiveColor = new BABYLON.Color3(color[0] * 0.3, color[1] * 0.3, color[2] * 0.3);
        body.material = mat;

        // Orbiting rings
        for (let i = 0; i < 2; i++) {
            const ring = BABYLON.MeshBuilder.CreateTorus('ring' + i, {
                diameter: this.size * 1.5,
                thickness: 0.3,
                tessellation: 24
            }, scene);
            ring.parent = parent;
            ring.rotation.x = Math.PI / 2 + i * Math.PI / 4;

            const ringMat = new BABYLON.StandardMaterial('ringMat_' + this.id + '_' + i, scene);
            ringMat.emissiveColor = new BABYLON.Color3(color[0] * 0.5, color[1] * 0.5, color[2] * 0.5);
            ringMat.alpha = 0.7;
            ring.material = ringMat;
        }
    }

    update(dt) {
        if (this.dead) return;

        // Shield regen (faster than normal units)
        if (this.shield < this.maxShield) {
            this.shield = Math.min(this.maxShield, this.shield + dt * 10);
        }

        // Check if we should return home
        const distFromHome = Math.hypot(
            this.mesh.position.x - this.homeX,
            this.mesh.position.z - this.homeZ
        );

        if (this.attackTarget && !this.attackTarget.dead) {
            // Don't chase too far from home
            if (distFromHome > this.returnRange) {
                this.attackTarget = null;
                this.targetX = this.homeX;
                this.targetZ = this.homeZ;
            } else {
                const dist = this.distanceTo(this.attackTarget);

                if (dist > this.def.range) {
                    this.moveToward(this.attackTarget.mesh.position.x, this.attackTarget.mesh.position.z, dt);
                } else {
                    const now = performance.now();
                    if (now - this.lastFire > this.def.fireRate) {
                        this.fireAt(this.attackTarget);
                        this.lastFire = now;
                    }
                }
            }
        } else {
            this.attackTarget = null;

            // Only attack if hostile to someone (they were provoked)
            const hostileToSomeone = Object.values(gameState.hostility[this.team] || {}).some(h => h);

            if (hostileToSomeone) {
                const target = this.findTarget();
                if (target) {
                    const targetDist = Math.hypot(
                        target.mesh.position.x - this.homeX,
                        target.mesh.position.z - this.homeZ
                    );
                    if (targetDist < this.aggroRange) {
                        this.attackTarget = target;
                    }
                }
            }

            // Return to patrol near home
            if (distFromHome > 30) {
                this.moveToward(this.homeX, this.homeZ, dt);
            }
        }
    }
}

export default AlienUnit;
