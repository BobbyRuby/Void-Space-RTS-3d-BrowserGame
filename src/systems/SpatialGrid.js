// ============================================================
// VOID SUPREMACY 3D - Spatial Grid
// Efficient spatial partitioning for O(1) neighbor lookups
// Reduces splash damage checks from O(n) to O(k) where k << n
// ============================================================

export class SpatialGrid {
    /**
     * Create a spatial grid for efficient neighbor queries
     * @param {number} cellSize - Size of each grid cell (default 50 units)
     * @param {number} worldSize - Total world size (default 2000 units)
     */
    constructor(cellSize = 50, worldSize = 2000) {
        this.cellSize = cellSize;
        this.worldSize = worldSize;
        this.halfWorld = worldSize / 2;

        // Calculate grid dimensions
        this.gridWidth = Math.ceil(worldSize / cellSize);
        this.gridHeight = Math.ceil(worldSize / cellSize);

        // Grid storage: Map of cellKey -> Set of entities
        this.cells = new Map();

        // Entity tracking: Map of entityId -> cellKey
        this.entityCells = new Map();

        // Statistics for debugging
        this.stats = {
            inserts: 0,
            updates: 0,
            removes: 0,
            queries: 0,
            entitiesChecked: 0
        };
    }

    /**
     * Convert world position to cell key
     * @param {number} x - World X coordinate
     * @param {number} z - World Z coordinate
     * @returns {string} Cell key
     */
    getCellKey(x, z) {
        // Offset to handle negative coordinates (center world at 0,0)
        const cellX = Math.floor((x + this.halfWorld) / this.cellSize);
        const cellZ = Math.floor((z + this.halfWorld) / this.cellSize);
        return `${cellX},${cellZ}`;
    }

    /**
     * Get cell coordinates from key
     * @param {string} key - Cell key
     * @returns {{cellX: number, cellZ: number}}
     */
    getCellCoords(key) {
        const [cellX, cellZ] = key.split(',').map(Number);
        return { cellX, cellZ };
    }

    /**
     * Insert an entity into the grid
     * @param {Entity} entity - Entity with mesh.position.x/z and id
     */
    insert(entity) {
        if (!entity || !entity.mesh || !entity.mesh.position) return;

        const x = entity.mesh.position.x;
        const z = entity.mesh.position.z;
        const key = this.getCellKey(x, z);

        // Get or create the cell
        if (!this.cells.has(key)) {
            this.cells.set(key, new Set());
        }

        this.cells.get(key).add(entity);
        this.entityCells.set(entity.id, key);
        this.stats.inserts++;
    }

    /**
     * Update an entity's position in the grid
     * @param {Entity} entity - Entity to update
     */
    update(entity) {
        if (!entity || !entity.mesh || !entity.mesh.position) return;

        const x = entity.mesh.position.x;
        const z = entity.mesh.position.z;
        const newKey = this.getCellKey(x, z);
        const oldKey = this.entityCells.get(entity.id);

        // Skip if entity hasn't moved to a new cell
        if (oldKey === newKey) return;

        // Remove from old cell
        if (oldKey && this.cells.has(oldKey)) {
            this.cells.get(oldKey).delete(entity);
            // Clean up empty cells
            if (this.cells.get(oldKey).size === 0) {
                this.cells.delete(oldKey);
            }
        }

        // Add to new cell
        if (!this.cells.has(newKey)) {
            this.cells.set(newKey, new Set());
        }
        this.cells.get(newKey).add(entity);
        this.entityCells.set(entity.id, newKey);
        this.stats.updates++;
    }

    /**
     * Remove an entity from the grid
     * @param {Entity} entity - Entity to remove
     */
    remove(entity) {
        if (!entity) return;

        const key = this.entityCells.get(entity.id);
        if (key && this.cells.has(key)) {
            this.cells.get(key).delete(entity);
            // Clean up empty cells
            if (this.cells.get(key).size === 0) {
                this.cells.delete(key);
            }
        }
        this.entityCells.delete(entity.id);
        this.stats.removes++;
    }

    /**
     * Query all entities within a radius of a point
     * @param {number} x - Center X coordinate
     * @param {number} z - Center Z coordinate
     * @param {number} radius - Search radius
     * @param {Function} [filter] - Optional filter function (entity) => boolean
     * @returns {Entity[]} Array of entities within radius
     */
    queryRadius(x, z, radius, filter = null) {
        this.stats.queries++;
        const results = [];
        const radiusSq = radius * radius;

        // Calculate which cells to check
        const minCellX = Math.floor((x - radius + this.halfWorld) / this.cellSize);
        const maxCellX = Math.floor((x + radius + this.halfWorld) / this.cellSize);
        const minCellZ = Math.floor((z - radius + this.halfWorld) / this.cellSize);
        const maxCellZ = Math.floor((z + radius + this.halfWorld) / this.cellSize);

        // Check all potentially overlapping cells
        for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
            for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ++) {
                const key = `${cellX},${cellZ}`;
                const cell = this.cells.get(key);

                if (!cell) continue;

                for (const entity of cell) {
                    this.stats.entitiesChecked++;

                    // Skip dead entities
                    if (entity.dead) continue;

                    // Apply optional filter
                    if (filter && !filter(entity)) continue;

                    // Distance check
                    const dx = entity.mesh.position.x - x;
                    const dz = entity.mesh.position.z - z;
                    const distSq = dx * dx + dz * dz;

                    if (distSq <= radiusSq) {
                        results.push(entity);
                    }
                }
            }
        }

        return results;
    }

    /**
     * Query all entities within a radius, sorted by distance
     * @param {number} x - Center X coordinate
     * @param {number} z - Center Z coordinate
     * @param {number} radius - Search radius
     * @param {Function} [filter] - Optional filter function
     * @returns {{entity: Entity, distance: number}[]} Sorted array
     */
    queryRadiusSorted(x, z, radius, filter = null) {
        const results = [];
        const radiusSq = radius * radius;

        const minCellX = Math.floor((x - radius + this.halfWorld) / this.cellSize);
        const maxCellX = Math.floor((x + radius + this.halfWorld) / this.cellSize);
        const minCellZ = Math.floor((z - radius + this.halfWorld) / this.cellSize);
        const maxCellZ = Math.floor((z + radius + this.halfWorld) / this.cellSize);

        for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
            for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ++) {
                const key = `${cellX},${cellZ}`;
                const cell = this.cells.get(key);

                if (!cell) continue;

                for (const entity of cell) {
                    if (entity.dead) continue;
                    if (filter && !filter(entity)) continue;

                    const dx = entity.mesh.position.x - x;
                    const dz = entity.mesh.position.z - z;
                    const distSq = dx * dx + dz * dz;

                    if (distSq <= radiusSq) {
                        results.push({
                            entity,
                            distance: Math.sqrt(distSq)
                        });
                    }
                }
            }
        }

        // Sort by distance
        results.sort((a, b) => a.distance - b.distance);
        return results;
    }

    /**
     * Find the nearest entity to a point
     * @param {number} x - Center X coordinate
     * @param {number} z - Center Z coordinate
     * @param {number} maxRadius - Maximum search radius
     * @param {Function} [filter] - Optional filter function
     * @returns {Entity|null} Nearest entity or null
     */
    findNearest(x, z, maxRadius, filter = null) {
        let nearest = null;
        let nearestDistSq = maxRadius * maxRadius;

        const minCellX = Math.floor((x - maxRadius + this.halfWorld) / this.cellSize);
        const maxCellX = Math.floor((x + maxRadius + this.halfWorld) / this.cellSize);
        const minCellZ = Math.floor((z - maxRadius + this.halfWorld) / this.cellSize);
        const maxCellZ = Math.floor((z + maxRadius + this.halfWorld) / this.cellSize);

        for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
            for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ++) {
                const key = `${cellX},${cellZ}`;
                const cell = this.cells.get(key);

                if (!cell) continue;

                for (const entity of cell) {
                    if (entity.dead) continue;
                    if (filter && !filter(entity)) continue;

                    const dx = entity.mesh.position.x - x;
                    const dz = entity.mesh.position.z - z;
                    const distSq = dx * dx + dz * dz;

                    if (distSq < nearestDistSq) {
                        nearest = entity;
                        nearestDistSq = distSq;
                    }
                }
            }
        }

        return nearest;
    }

    /**
     * Get all entities in a specific cell
     * @param {number} x - World X coordinate
     * @param {number} z - World Z coordinate
     * @returns {Set<Entity>} Set of entities in the cell
     */
    getEntitiesInCell(x, z) {
        const key = this.getCellKey(x, z);
        return this.cells.get(key) || new Set();
    }

    /**
     * Clear all entities from the grid
     */
    clear() {
        this.cells.clear();
        this.entityCells.clear();
    }

    /**
     * Get statistics about the grid
     * @returns {Object} Grid statistics
     */
    getStats() {
        let totalEntities = 0;
        let maxCellSize = 0;
        let nonEmptyCells = 0;

        for (const cell of this.cells.values()) {
            const size = cell.size;
            totalEntities += size;
            maxCellSize = Math.max(maxCellSize, size);
            if (size > 0) nonEmptyCells++;
        }

        return {
            ...this.stats,
            totalEntities,
            totalCells: this.cells.size,
            nonEmptyCells,
            maxCellSize,
            avgCellSize: nonEmptyCells > 0 ? totalEntities / nonEmptyCells : 0,
            cellSize: this.cellSize,
            gridWidth: this.gridWidth,
            gridHeight: this.gridHeight
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            inserts: 0,
            updates: 0,
            removes: 0,
            queries: 0,
            entitiesChecked: 0
        };
    }
}

// Singleton instance for game use
let spatialGridInstance = null;

/**
 * Get or create the spatial grid singleton
 * @param {number} [cellSize] - Cell size (only used on first call)
 * @param {number} [worldSize] - World size (only used on first call)
 * @returns {SpatialGrid}
 */
export function getSpatialGrid(cellSize = 50, worldSize = 2000) {
    if (!spatialGridInstance) {
        spatialGridInstance = new SpatialGrid(cellSize, worldSize);
    }
    return spatialGridInstance;
}

/**
 * Reset the spatial grid singleton (for game restart)
 */
export function resetSpatialGrid() {
    if (spatialGridInstance) {
        spatialGridInstance.clear();
    }
    spatialGridInstance = null;
}

export default SpatialGrid;
