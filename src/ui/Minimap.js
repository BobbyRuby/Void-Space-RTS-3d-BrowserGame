// ============================================================
// VOID SUPREMACY 3D - Minimap
// Tactical overview map with click navigation
// ============================================================

import { CONFIG, TEAMS, TEAM_COLORS } from '../core/Config.js?v=20260119';
import { eventBus, GameEvents } from '../core/EventBus.js?v=20260119';
import { gameState } from '../core/GameState.js?v=20260119';
import { selectionSystem } from '../systems/SelectionSystem.js?v=20260119';
import { sceneManager } from '../rendering/SceneManager.js?v=20260119';

export class Minimap {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.width = 250;
        this.height = 250;
    }

    init(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        // Setup click handlers
        this.canvas.addEventListener('click', (e) => this.onClick(e));
        this.canvas.addEventListener('contextmenu', (e) => this.onRightClick(e));
    }

    onClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        // Convert to world coordinates
        const worldX = (x - 0.5) * CONFIG.MAP_SIZE;
        const worldZ = (y - 0.5) * CONFIG.MAP_SIZE;

        // Left-click always moves camera to that location
        // Use right-click to command units
        sceneManager.moveCameraTo(worldX, worldZ);
    }

    onRightClick(e) {
        e.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        const worldX = (x - 0.5) * CONFIG.MAP_SIZE;
        const worldZ = (y - 0.5) * CONFIG.MAP_SIZE;

        // Right-click commands selected units
        // Shift+right-click for attack-move, regular right-click for move
        if (gameState.selectedEntities.length > 0) {
            if (e.shiftKey) {
                selectionSystem.commandAttackMove(worldX, worldZ);
            } else {
                selectionSystem.commandMove(worldX, worldZ);
            }
        }
    }

    render() {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;
        const mapScale = w / CONFIG.MAP_SIZE;

        // Clear
        ctx.fillStyle = '#0a0a15';
        ctx.fillRect(0, 0, w, h);

        // Draw asteroid belt ring
        ctx.strokeStyle = 'rgba(100, 80, 60, 0.3)';
        ctx.lineWidth = (CONFIG.ASTEROID_BELT_OUTER - CONFIG.ASTEROID_BELT_INNER) * mapScale;
        ctx.beginPath();
        const beltRadius = (CONFIG.ASTEROID_BELT_INNER + CONFIG.ASTEROID_BELT_OUTER) / 2 * mapScale;
        ctx.arc(w / 2, h / 2, beltRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Draw ore nodes
        ctx.fillStyle = '#ff8844';
        for (const ore of gameState.oreNodes) {
            if (ore.depleted) continue;
            const x = (ore.x / CONFIG.MAP_SIZE + 0.5) * w;
            const y = (ore.z / CONFIG.MAP_SIZE + 0.5) * h;
            const size = 2 + (ore.amount / ore.maxAmount) * 2;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw crystal nodes
        ctx.fillStyle = '#ff00ff';
        for (const crystal of gameState.crystalNodes) {
            if (crystal.depleted) continue;
            const x = (crystal.x / CONFIG.MAP_SIZE + 0.5) * w;
            const y = (crystal.z / CONFIG.MAP_SIZE + 0.5) * h;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw entities
        for (const entity of gameState.entities) {
            if (entity.dead || !entity.mesh) continue;

            const pos = entity.mesh.position;
            const x = (pos.x / CONFIG.MAP_SIZE + 0.5) * w;
            const y = (pos.z / CONFIG.MAP_SIZE + 0.5) * h;

            const color = TEAM_COLORS[entity.team];
            ctx.fillStyle = `rgb(${color[0] * 255}, ${color[1] * 255}, ${color[2] * 255})`;

            if (entity.isBuilding) {
                // Buildings as squares
                const size = Math.max(4, entity.size * mapScale * 0.5);
                ctx.fillRect(x - size / 2, y - size / 2, size, size);
            } else {
                // Units as circles
                const size = Math.max(2, entity.size * mapScale * 0.3);
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
            }

            // Highlight selected units
            if (entity.selected) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        // Draw camera viewport
        const camPos = sceneManager.getCameraPosition();
        const viewSize = camPos.radius * 0.5 * mapScale;
        const camX = (camPos.x / CONFIG.MAP_SIZE + 0.5) * w;
        const camY = (camPos.z / CONFIG.MAP_SIZE + 0.5) * h;

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(camX - viewSize, camY - viewSize, viewSize * 2, viewSize * 2);
    }

    dispose() {
        this.canvas = null;
        this.ctx = null;
    }
}

export const minimap = new Minimap();

export default Minimap;
