// ============================================================
// VOID SUPREMACY 3D - Entity Base Class
// Base class for all game entities (units, buildings)
// ============================================================

import { eventBus, GameEvents } from '../core/EventBus.js';
import { TEAM_COLORS } from '../core/Config.js';

let entityIdCounter = 0;

export class Entity {
    constructor(x, z, team) {
        this.id = ++entityIdCounter;
        this.entityType = 'entity';
        this.team = team;

        this.x = x;
        this.z = z;
        this.size = 1;

        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.dead = false;
        this.selected = false;

        this.mesh = null;
        this.isUnit = false;
        this.isBuilding = false;
    }

    get position() {
        return this.mesh?.position || { x: this.x, y: 0, z: this.z };
    }

    getTeamColor() {
        return TEAM_COLORS[this.team] || TEAM_COLORS[0];
    }

    distanceTo(other) {
        const otherPos = other.mesh?.position || { x: other.x, z: other.z };
        const thisPos = this.mesh?.position || { x: this.x, z: this.z };
        return Math.hypot(
            thisPos.x - otherPos.x,
            thisPos.z - otherPos.z
        );
    }

    takeDamage(amount, attacker) {
        this.health -= amount;

        eventBus.emit(GameEvents.ENTITY_DAMAGED, {
            entity: this,
            amount,
            attacker,
            remainingHealth: this.health
        });

        if (this.health <= 0) {
            this.die(attacker);
        }
    }

    heal(amount) {
        const oldHealth = this.health;
        this.health = Math.min(this.maxHealth, this.health + amount);

        eventBus.emit(GameEvents.ENTITY_HEALED, {
            entity: this,
            amount: this.health - oldHealth,
            newHealth: this.health
        });
    }

    die(killer) {
        this.dead = true;

        eventBus.emit(GameEvents.ENTITY_DESTROYED, {
            entity: this,
            killer
        });

        this.dispose();
    }

    /**
     * Dispose entity and all child meshes/materials
     * Properly cleans up to prevent memory leaks
     */
    dispose() {
        if (this.mesh) {
            // Recursively dispose all child meshes first
            const children = this.mesh.getChildMeshes(false);
            for (const child of children) {
                // Don't dispose shared materials from MaterialPool
                // Only dispose materials that were created uniquely for this mesh
                if (child.material && !child.material.name.startsWith('team_') &&
                    !child.material.name.startsWith('weapon_') &&
                    !child.material.name.startsWith('selection_') &&
                    !child.material.name.startsWith('effect_') &&
                    !child.material.name.startsWith('explosion_') &&
                    !child.material.name.startsWith('star_')) {
                    child.material.dispose();
                }
                child.dispose();
            }

            // Dispose the parent mesh itself
            if (this.mesh.material && !this.mesh.material.name.startsWith('team_') &&
                !this.mesh.material.name.startsWith('weapon_') &&
                !this.mesh.material.name.startsWith('selection_')) {
                this.mesh.material.dispose();
            }
            this.mesh.dispose();
            this.mesh = null;
        }
    }

    update(dt) {
        // Override in subclasses
    }

    // Abstract method - override in subclasses
    createMesh(scene) {
        throw new Error('createMesh must be implemented by subclass');
    }
}

export default Entity;
