// ============================================================
// VOID SUPREMACY 3D - Save/Load System
// Game state persistence using LocalStorage and IndexedDB
// ============================================================

import { CONFIG, TEAMS } from '../core/Config.js';
import { eventBus, GameEvents } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';

// Save format version for migration support
const SAVE_VERSION = 1;

// Storage keys
const STORAGE_PREFIX = 'voidSupremacy_';
const AUTOSAVE_KEY = `${STORAGE_PREFIX}autosave`;
const QUICKSAVE_KEY = `${STORAGE_PREFIX}quicksave`;
const SAVES_INDEX_KEY = `${STORAGE_PREFIX}savesIndex`;

export class SaveSystem {
    constructor() {
        this.db = null;
        this.useIndexedDB = true;
        this.autosaveInterval = null;
        this.autosaveFrequency = 60000; // 1 minute
        this.maxAutosaves = 3;

        // Compression
        this.useCompression = true;
    }

    async init() {
        // Try to open IndexedDB
        try {
            await this.openDatabase();
            console.log('Save System initialized with IndexedDB');
        } catch (error) {
            console.warn('IndexedDB not available, falling back to LocalStorage');
            this.useIndexedDB = false;
        }

        // Autosave disabled
        // this.setupAutosave();

        // Register hotkeys
        this.setupEventListeners();
    }

    async openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('VoidSupremacy3D', 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create saves store
                if (!db.objectStoreNames.contains('saves')) {
                    const store = db.createObjectStore('saves', { keyPath: 'id' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('name', 'name', { unique: false });
                }
            };
        });
    }

    setupEventListeners() {
        eventBus.on(GameEvents.QUICKSAVE, () => this.quickSave());
        eventBus.on(GameEvents.QUICKLOAD, () => this.quickLoad());
    }

    setupAutosave() {
        this.autosaveInterval = setInterval(() => {
            this.autoSave();
        }, this.autosaveFrequency);
    }

    // ===== Save/Load Core =====

    async save(name, slot = null) {
        try {
            const saveData = this.createSaveData(name);

            if (this.useIndexedDB) {
                await this.saveToIndexedDB(saveData, slot);
            } else {
                this.saveToLocalStorage(saveData, slot);
            }

            eventBus.emit(GameEvents.SAVE_COMPLETE, { name, slot });
            console.log(`Game saved: ${name}`);

            return true;
        } catch (error) {
            console.error('Failed to save game:', error);
            eventBus.emit(GameEvents.SAVE_ERROR, { error: error.message });
            return false;
        }
    }

    async load(slot) {
        try {
            let saveData;

            if (this.useIndexedDB) {
                saveData = await this.loadFromIndexedDB(slot);
            } else {
                saveData = this.loadFromLocalStorage(slot);
            }

            if (!saveData) {
                throw new Error('Save not found');
            }

            // Validate version
            if (saveData.version !== SAVE_VERSION) {
                saveData = this.migrateSave(saveData);
            }

            // Apply save data
            await this.applySaveData(saveData);

            eventBus.emit(GameEvents.LOAD_COMPLETE, { slot });
            console.log(`Game loaded from slot: ${slot}`);

            return true;
        } catch (error) {
            console.error('Failed to load game:', error);
            eventBus.emit(GameEvents.LOAD_ERROR, { error: error.message });
            return false;
        }
    }

    async quickSave() {
        return this.save('Quick Save', QUICKSAVE_KEY);
    }

    async quickLoad() {
        return this.load(QUICKSAVE_KEY);
    }

    async autoSave() {
        const name = `Autosave - ${new Date().toLocaleString()}`;
        return this.save(name, `${AUTOSAVE_KEY}_${Date.now()}`);
    }

    // ===== Save Data Creation =====

    createSaveData(name) {
        const saveData = {
            id: `save_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            version: SAVE_VERSION,
            name,
            timestamp: Date.now(),
            playTime: gameState.playTime || 0,

            // Game state
            gameTime: gameState.gameTime,
            isPaused: gameState.isPaused,
            gameSpeed: gameState.gameSpeed,

            // Resources per team
            resources: this.serializeResources(),

            // All entities
            entities: this.serializeEntities(),

            // Resource nodes
            oreNodes: this.serializeResourceNodes(gameState.oreNodes),
            crystalNodes: this.serializeResourceNodes(gameState.crystalNodes),

            // Fog of war explored state
            explored: this.serializeExplored(),

            // AI state
            aiState: this.serializeAIState(),

            // Statistics
            stats: this.serializeStats()
        };

        // Compress if enabled
        if (this.useCompression) {
            saveData.compressed = true;
            saveData.data = this.compress(JSON.stringify(saveData));
        }

        return saveData;
    }

    serializeResources() {
        const resources = {};

        for (const [team, res] of Object.entries(gameState.resources)) {
            resources[team] = {
                credits: res.credits,
                ore: res.ore,
                crystals: res.crystals,
                energy: res.energy,
                energyMax: res.energyMax,
                supplyUsed: res.supplyUsed,
                supplyMax: res.supplyMax
            };
        }

        return resources;
    }

    serializeEntities() {
        const entities = [];

        for (const entity of gameState.entities) {
            if (entity.dead) continue;

            const serialized = {
                type: entity.type,
                team: entity.team,
                health: entity.health,
                maxHealth: entity.maxHealth,
                isBuilding: entity.isBuilding,

                // Position
                position: entity.mesh ? {
                    x: entity.mesh.position.x,
                    y: entity.mesh.position.y,
                    z: entity.mesh.position.z
                } : null,
                rotation: entity.mesh?.rotation.y || 0
            };

            // Building-specific
            if (entity.isBuilding) {
                serialized.isConstructing = entity.isConstructing;
                serialized.constructionProgress = entity.constructionProgress;
                serialized.productionQueue = entity.productionQueue?.map(item => ({
                    type: item.type,
                    timeRemaining: item.timeRemaining
                })) || [];
            }

            // Unit-specific
            if (!entity.isBuilding) {
                serialized.command = entity.command;
                serialized.targetPosition = entity.targetPosition;

                // Harvester cargo
                if (entity.type === 'harvester') {
                    serialized.cargo = entity.cargo || 0;
                    serialized.cargoType = entity.cargoType;
                }
            }

            entities.push(serialized);
        }

        return entities;
    }

    serializeResourceNodes(nodes) {
        if (!nodes) return [];

        return nodes.map(node => ({
            x: node.x,
            z: node.z,
            amount: node.amount,
            maxAmount: node.maxAmount,
            depleted: node.depleted
        }));
    }

    serializeExplored() {
        // Only save player's explored state (fog of war data)
        const explored = {};

        // This would need access to fogOfWar system
        // For now, return empty - actual implementation needs fogOfWar integration

        return explored;
    }

    serializeAIState() {
        // Serialize AI decision state
        return {
            // AI state data would go here
        };
    }

    serializeStats() {
        return {
            unitsBuilt: gameState.stats?.unitsBuilt || 0,
            unitsLost: gameState.stats?.unitsLost || 0,
            unitsKilled: gameState.stats?.unitsKilled || 0,
            buildingsBuilt: gameState.stats?.buildingsBuilt || 0,
            resourcesGathered: gameState.stats?.resourcesGathered || 0
        };
    }

    // ===== Save Data Application =====

    async applySaveData(saveData) {
        // Decompress if needed
        if (saveData.compressed) {
            const decompressed = this.decompress(saveData.data);
            saveData = JSON.parse(decompressed);
        }

        // Clear existing state
        eventBus.emit(GameEvents.GAME_RESET);

        // Restore game time
        gameState.gameTime = saveData.gameTime;
        gameState.isPaused = saveData.isPaused;
        gameState.gameSpeed = saveData.gameSpeed;
        gameState.playTime = saveData.playTime;

        // Restore resources
        for (const [teamStr, res] of Object.entries(saveData.resources)) {
            const team = parseInt(teamStr);
            gameState.resources.set(team, { ...res });
        }

        // Restore resource nodes
        await this.restoreResourceNodes(saveData.oreNodes, 'ore');
        await this.restoreResourceNodes(saveData.crystalNodes, 'crystal');

        // Restore entities
        for (const entityData of saveData.entities) {
            eventBus.emit(GameEvents.RESTORE_ENTITY, entityData);
        }

        // Restore stats
        gameState.stats = saveData.stats;

        // Restore explored fog
        if (saveData.explored) {
            eventBus.emit(GameEvents.RESTORE_FOG, saveData.explored);
        }

        // Signal load complete
        eventBus.emit(GameEvents.STATE_RESTORED);
    }

    async restoreResourceNodes(nodes, type) {
        if (type === 'ore') {
            gameState.oreNodes = nodes.map(n => ({ ...n }));
        } else {
            gameState.crystalNodes = nodes.map(n => ({ ...n }));
        }
    }

    // ===== Storage Backend: IndexedDB =====

    async saveToIndexedDB(saveData, slot) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['saves'], 'readwrite');
            const store = transaction.objectStore('saves');

            // Use slot as ID if provided
            if (slot) {
                saveData.id = slot;
            }

            const request = store.put(saveData);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async loadFromIndexedDB(slot) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['saves'], 'readonly');
            const store = transaction.objectStore('saves');
            const request = store.get(slot);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteSaveFromIndexedDB(slot) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['saves'], 'readwrite');
            const store = transaction.objectStore('saves');
            const request = store.delete(slot);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async listSavesFromIndexedDB() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['saves'], 'readonly');
            const store = transaction.objectStore('saves');
            const index = store.index('timestamp');
            const request = index.openCursor(null, 'prev'); // Newest first

            const saves = [];

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    saves.push({
                        id: cursor.value.id,
                        name: cursor.value.name,
                        timestamp: cursor.value.timestamp,
                        playTime: cursor.value.playTime
                    });
                    cursor.continue();
                } else {
                    resolve(saves);
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    // ===== Storage Backend: LocalStorage =====

    saveToLocalStorage(saveData, slot) {
        const key = slot || saveData.id;

        // Store save data
        localStorage.setItem(key, JSON.stringify(saveData));

        // Update saves index
        const index = this.getSavesIndex();
        index[key] = {
            name: saveData.name,
            timestamp: saveData.timestamp
        };
        localStorage.setItem(SAVES_INDEX_KEY, JSON.stringify(index));
    }

    loadFromLocalStorage(slot) {
        const data = localStorage.getItem(slot);
        return data ? JSON.parse(data) : null;
    }

    deleteSaveFromLocalStorage(slot) {
        localStorage.removeItem(slot);

        const index = this.getSavesIndex();
        delete index[slot];
        localStorage.setItem(SAVES_INDEX_KEY, JSON.stringify(index));
    }

    getSavesIndex() {
        const data = localStorage.getItem(SAVES_INDEX_KEY);
        return data ? JSON.parse(data) : {};
    }

    listSavesFromLocalStorage() {
        const index = this.getSavesIndex();
        return Object.entries(index)
            .map(([id, data]) => ({
                id,
                name: data.name,
                timestamp: data.timestamp
            }))
            .sort((a, b) => b.timestamp - a.timestamp);
    }

    // ===== Public API =====

    async listSaves() {
        if (this.useIndexedDB) {
            return this.listSavesFromIndexedDB();
        }
        return this.listSavesFromLocalStorage();
    }

    async deleteSave(slot) {
        if (this.useIndexedDB) {
            await this.deleteSaveFromIndexedDB(slot);
        } else {
            this.deleteSaveFromLocalStorage(slot);
        }
    }

    async clearAllSaves() {
        if (this.useIndexedDB) {
            const saves = await this.listSavesFromIndexedDB();
            for (const save of saves) {
                await this.deleteSaveFromIndexedDB(save.id);
            }
        } else {
            const index = this.getSavesIndex();
            for (const key of Object.keys(index)) {
                localStorage.removeItem(key);
            }
            localStorage.removeItem(SAVES_INDEX_KEY);
        }
    }

    // ===== Compression =====

    compress(data) {
        // Simple RLE-style compression for save data
        // In production, use pako or similar library
        try {
            return btoa(encodeURIComponent(data));
        } catch {
            return data;
        }
    }

    decompress(data) {
        try {
            return decodeURIComponent(atob(data));
        } catch {
            return data;
        }
    }

    // ===== Migration =====

    migrateSave(saveData) {
        // Handle save format migrations
        const version = saveData.version || 0;

        if (version < 1) {
            // Migrate from v0 to v1
            saveData.version = 1;
            saveData.stats = saveData.stats || {};
        }

        return saveData;
    }

    // ===== Export/Import =====

    exportSave(saveData) {
        const blob = new Blob([JSON.stringify(saveData)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `void-supremacy-${saveData.name.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.json`;
        a.click();

        URL.revokeObjectURL(url);
    }

    async importSave(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const saveData = JSON.parse(e.target.result);

                    // Validate save data
                    if (!saveData.version || !saveData.entities) {
                        throw new Error('Invalid save file');
                    }

                    // Generate new ID
                    saveData.id = `import_${Date.now()}`;

                    await this.save(saveData.name, saveData.id);
                    resolve(saveData);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    // ===== Cleanup =====

    dispose() {
        if (this.autosaveInterval) {
            clearInterval(this.autosaveInterval);
        }

        if (this.db) {
            this.db.close();
        }
    }
}

export const saveSystem = new SaveSystem();

export default SaveSystem;
