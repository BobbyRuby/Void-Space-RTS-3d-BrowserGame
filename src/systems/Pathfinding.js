// ============================================================
// VOID SUPREMACY 3D - A* Pathfinding System
// Grid-based navigation with obstacle avoidance
// ============================================================

import { CONFIG } from '../core/Config.js?v=20260119';
import { gameState } from '../core/GameState.js?v=20260119';

// Priority Queue for A* (min-heap)
class PriorityQueue {
    constructor() {
        this.heap = [];
    }

    push(node, priority) {
        this.heap.push({ node, priority });
        this.bubbleUp(this.heap.length - 1);
    }

    pop() {
        if (this.heap.length === 0) return null;
        const min = this.heap[0];
        const last = this.heap.pop();
        if (this.heap.length > 0) {
            this.heap[0] = last;
            this.bubbleDown(0);
        }
        return min.node;
    }

    isEmpty() {
        return this.heap.length === 0;
    }

    bubbleUp(index) {
        while (index > 0) {
            const parent = Math.floor((index - 1) / 2);
            if (this.heap[parent].priority <= this.heap[index].priority) break;
            [this.heap[parent], this.heap[index]] = [this.heap[index], this.heap[parent]];
            index = parent;
        }
    }

    bubbleDown(index) {
        const length = this.heap.length;
        while (true) {
            const left = 2 * index + 1;
            const right = 2 * index + 2;
            let smallest = index;

            if (left < length && this.heap[left].priority < this.heap[smallest].priority) {
                smallest = left;
            }
            if (right < length && this.heap[right].priority < this.heap[smallest].priority) {
                smallest = right;
            }
            if (smallest === index) break;

            [this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]];
            index = smallest;
        }
    }
}

export class Pathfinding {
    constructor() {
        this.gridSize = 15; // Size of each nav cell in world units
        this.gridWidth = 0;
        this.gridHeight = 0;
        this.grid = null; // Navigation grid (walkability)
        this.staticObstacles = null; // Buildings, etc.

        // Path caching
        this.pathCache = new Map();
        this.cacheTimeout = 500; // ms before cache invalidation

        // Directions for 8-way movement
        this.directions = [
            { dx: 0, dz: -1, cost: 1 },      // N
            { dx: 1, dz: -1, cost: 1.414 },  // NE
            { dx: 1, dz: 0, cost: 1 },       // E
            { dx: 1, dz: 1, cost: 1.414 },   // SE
            { dx: 0, dz: 1, cost: 1 },       // S
            { dx: -1, dz: 1, cost: 1.414 },  // SW
            { dx: -1, dz: 0, cost: 1 },      // W
            { dx: -1, dz: -1, cost: 1.414 }  // NW
        ];
    }

    init() {
        // Calculate grid dimensions
        this.gridWidth = Math.ceil(CONFIG.MAP_SIZE / this.gridSize);
        this.gridHeight = Math.ceil(CONFIG.MAP_SIZE / this.gridSize);

        // Initialize grids
        const totalCells = this.gridWidth * this.gridHeight;
        this.grid = new Uint8Array(totalCells); // 0 = walkable, 1+ = blocked
        this.staticObstacles = new Uint8Array(totalCells);

        console.log(`Pathfinding initialized: ${this.gridWidth}x${this.gridHeight} grid`);
    }

    // ===== Coordinate Conversion =====

    worldToGrid(x, z) {
        const gx = Math.floor((x + CONFIG.MAP_SIZE / 2) / this.gridSize);
        const gz = Math.floor((z + CONFIG.MAP_SIZE / 2) / this.gridSize);
        return {
            x: Math.max(0, Math.min(this.gridWidth - 1, gx)),
            z: Math.max(0, Math.min(this.gridHeight - 1, gz))
        };
    }

    gridToWorld(gx, gz) {
        return {
            x: (gx * this.gridSize) - CONFIG.MAP_SIZE / 2 + this.gridSize / 2,
            z: (gz * this.gridSize) - CONFIG.MAP_SIZE / 2 + this.gridSize / 2
        };
    }

    getIndex(gx, gz) {
        return gz * this.gridWidth + gx;
    }

    isInBounds(gx, gz) {
        return gx >= 0 && gx < this.gridWidth && gz >= 0 && gz < this.gridHeight;
    }

    // ===== Obstacle Management =====

    updateFromGameState() {
        // Reset grid to static obstacles only
        this.grid.set(this.staticObstacles);

        // Add buildings as obstacles
        for (const entity of gameState.entities) {
            if (entity.isBuilding && !entity.dead && entity.mesh) {
                const pos = entity.mesh.position;
                const radius = entity.collisionRadius || 30;
                this.markObstacle(pos.x, pos.z, radius, false); // Don't modify static
            }
        }

        // Add asteroid obstacles (from resource nodes)
        for (const ore of gameState.oreNodes) {
            if (!ore.depleted) {
                this.markObstacle(ore.x, ore.z, 15, false);
            }
        }

        for (const crystal of gameState.crystalNodes) {
            if (!crystal.depleted) {
                this.markObstacle(crystal.x, crystal.z, 10, false);
            }
        }
    }

    markObstacle(worldX, worldZ, radius, isStatic = false) {
        const center = this.worldToGrid(worldX, worldZ);
        const gridRadius = Math.ceil(radius / this.gridSize);

        for (let dz = -gridRadius; dz <= gridRadius; dz++) {
            for (let dx = -gridRadius; dx <= gridRadius; dx++) {
                const gx = center.x + dx;
                const gz = center.z + dz;
                if (!this.isInBounds(gx, gz)) continue;

                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist <= gridRadius) {
                    const idx = this.getIndex(gx, gz);
                    this.grid[idx] = 1;
                    if (isStatic) {
                        this.staticObstacles[idx] = 1;
                    }
                }
            }
        }
    }

    isWalkable(gx, gz) {
        if (!this.isInBounds(gx, gz)) return false;
        return this.grid[this.getIndex(gx, gz)] === 0;
    }

    // ===== A* Pathfinding =====

    findPath(startX, startZ, endX, endZ, options = {}) {
        const {
            maxIterations = 5000,
            avoidUnits = false,
            unitRadius = 10
        } = options;

        // Convert to grid coordinates
        const start = this.worldToGrid(startX, startZ);
        const end = this.worldToGrid(endX, endZ);

        // Check cache first
        const cacheKey = `${start.x},${start.z}-${end.x},${end.z}`;
        const cached = this.pathCache.get(cacheKey);
        if (cached && Date.now() - cached.time < this.cacheTimeout) {
            return cached.path;
        }

        // If end is blocked, find nearest walkable cell
        let adjustedEnd = end;
        if (!this.isWalkable(end.x, end.z)) {
            adjustedEnd = this.findNearestWalkable(end.x, end.z);
            if (!adjustedEnd) return null; // No path possible
        }

        // A* algorithm
        const openSet = new PriorityQueue();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();

        const startKey = `${start.x},${start.z}`;
        const endKey = `${adjustedEnd.x},${adjustedEnd.z}`;

        gScore.set(startKey, 0);
        fScore.set(startKey, this.heuristic(start, adjustedEnd));
        openSet.push(start, fScore.get(startKey));

        const closedSet = new Set();
        let iterations = 0;

        while (!openSet.isEmpty() && iterations < maxIterations) {
            iterations++;
            const current = openSet.pop();
            const currentKey = `${current.x},${current.z}`;

            // Check if we've reached the goal
            if (current.x === adjustedEnd.x && current.z === adjustedEnd.z) {
                const path = this.reconstructPath(cameFrom, current);
                const worldPath = this.gridPathToWorld(path);
                const smoothedPath = this.smoothPath(worldPath);

                // Cache the result
                this.pathCache.set(cacheKey, {
                    path: smoothedPath,
                    time: Date.now()
                });

                return smoothedPath;
            }

            closedSet.add(currentKey);

            // Explore neighbors
            for (const dir of this.directions) {
                const nx = current.x + dir.dx;
                const nz = current.z + dir.dz;
                const neighborKey = `${nx},${nz}`;

                if (closedSet.has(neighborKey)) continue;
                if (!this.isWalkable(nx, nz)) continue;

                // Check diagonal movement validity
                if (dir.dx !== 0 && dir.dz !== 0) {
                    // Don't allow diagonal movement through corners
                    if (!this.isWalkable(current.x + dir.dx, current.z) ||
                        !this.isWalkable(current.x, current.z + dir.dz)) {
                        continue;
                    }
                }

                const tentativeG = gScore.get(currentKey) + dir.cost;

                if (!gScore.has(neighborKey) || tentativeG < gScore.get(neighborKey)) {
                    cameFrom.set(neighborKey, current);
                    gScore.set(neighborKey, tentativeG);
                    const f = tentativeG + this.heuristic({ x: nx, z: nz }, adjustedEnd);
                    fScore.set(neighborKey, f);
                    openSet.push({ x: nx, z: nz }, f);
                }
            }
        }

        // No path found
        return null;
    }

    heuristic(a, b) {
        // Octile distance (better for 8-way movement)
        const dx = Math.abs(a.x - b.x);
        const dz = Math.abs(a.z - b.z);
        return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
    }

    reconstructPath(cameFrom, current) {
        const path = [current];
        let key = `${current.x},${current.z}`;

        while (cameFrom.has(key)) {
            current = cameFrom.get(key);
            path.unshift(current);
            key = `${current.x},${current.z}`;
        }

        return path;
    }

    gridPathToWorld(gridPath) {
        return gridPath.map(node => this.gridToWorld(node.x, node.z));
    }

    findNearestWalkable(gx, gz) {
        // Spiral search for nearest walkable cell
        for (let radius = 1; radius < 20; radius++) {
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    if (Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;

                    const nx = gx + dx;
                    const nz = gz + dz;

                    if (this.isWalkable(nx, nz)) {
                        return { x: nx, z: nz };
                    }
                }
            }
        }
        return null;
    }

    // ===== Path Smoothing =====

    smoothPath(path) {
        if (path.length <= 2) return path;

        const smoothed = [path[0]];
        let current = 0;

        while (current < path.length - 1) {
            let furthest = current + 1;

            // Find the furthest point we can reach in a straight line
            for (let i = path.length - 1; i > current + 1; i--) {
                if (this.hasLineOfSight(path[current], path[i])) {
                    furthest = i;
                    break;
                }
            }

            smoothed.push(path[furthest]);
            current = furthest;
        }

        return smoothed;
    }

    hasLineOfSight(start, end) {
        // Bresenham's line algorithm to check for obstacles
        const startGrid = this.worldToGrid(start.x, start.z);
        const endGrid = this.worldToGrid(end.x, end.z);

        let x0 = startGrid.x;
        let z0 = startGrid.z;
        const x1 = endGrid.x;
        const z1 = endGrid.z;

        const dx = Math.abs(x1 - x0);
        const dz = Math.abs(z1 - z0);
        const sx = x0 < x1 ? 1 : -1;
        const sz = z0 < z1 ? 1 : -1;
        let err = dx - dz;

        while (true) {
            if (!this.isWalkable(x0, z0)) return false;

            if (x0 === x1 && z0 === z1) break;

            const e2 = 2 * err;
            if (e2 > -dz) {
                err -= dz;
                x0 += sx;
            }
            if (e2 < dx) {
                err += dx;
                z0 += sz;
            }
        }

        return true;
    }

    // ===== Steering Behaviors =====

    getSteeringForce(entity, path, maxSpeed = 50) {
        if (!path || path.length === 0) return null;

        const pos = entity.mesh.position;
        const currentTarget = path[0];

        // Calculate distance to current waypoint
        const dx = currentTarget.x - pos.x;
        const dz = currentTarget.z - pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // If close enough to waypoint, move to next
        if (dist < this.gridSize && path.length > 1) {
            path.shift();
            return this.getSteeringForce(entity, path, maxSpeed);
        }

        // Calculate desired velocity
        const desiredVelocity = {
            x: (dx / dist) * maxSpeed,
            z: (dz / dist) * maxSpeed
        };

        // Calculate steering force (desired - current)
        const currentVelocity = entity.velocity || { x: 0, z: 0 };

        return {
            x: desiredVelocity.x - currentVelocity.x,
            z: desiredVelocity.z - currentVelocity.z
        };
    }

    // ===== Utility =====

    clearPathCache() {
        this.pathCache.clear();
    }

    dispose() {
        this.grid = null;
        this.staticObstacles = null;
        this.pathCache.clear();
    }
}

export const pathfinding = new Pathfinding();

export default Pathfinding;
