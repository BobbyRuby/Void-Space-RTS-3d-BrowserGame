// ============================================================
// VOID SUPREMACY 3D - Event Bus
// Pub/Sub system for decoupled module communication
// ============================================================

class EventBus {
    constructor() {
        this.listeners = new Map();
        this.onceListeners = new Map();
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);

        // Return unsubscribe function
        return () => this.off(event, callback);
    }

    /**
     * Subscribe to an event once
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     */
    once(event, callback) {
        if (!this.onceListeners.has(event)) {
            this.onceListeners.set(event, new Set());
        }
        this.onceListeners.get(event).add(callback);
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     */
    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
        if (this.onceListeners.has(event)) {
            this.onceListeners.get(event).delete(callback);
        }
    }

    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data) {
        // Guard against undefined events
        if (event === undefined || event === null) {
            console.error('EventBus.emit called with undefined/null event!', new Error().stack);
            return;
        }

        // Regular listeners
        if (this.listeners.has(event)) {
            const listeners = Array.from(this.listeners.get(event));
            for (const callback of listeners) {
                if (typeof callback !== 'function') {
                    console.error(`Non-function callback registered for "${event}":`, callback);
                    continue;
                }
                try {
                    callback(data);
                } catch (err) {
                    console.error(`Error in event handler for "${event}":`, err);
                    console.error('Event data was:', data);
                    console.error('Stack trace:', err.stack);
                }
            }
        }

        // Once listeners
        if (this.onceListeners.has(event)) {
            const onceListeners = Array.from(this.onceListeners.get(event));
            this.onceListeners.delete(event);
            for (const callback of onceListeners) {
                if (typeof callback !== 'function') {
                    console.error(`Non-function once callback registered for "${event}":`, callback);
                    continue;
                }
                try {
                    callback(data);
                } catch (err) {
                    console.error(`Error in once handler for "${event}":`, err);
                    console.error('Event data was:', data);
                    console.error('Stack trace:', err.stack);
                }
            }
        }
    }

    /**
     * Remove all listeners for an event or all events
     * @param {string} [event] - Event name (optional, clears all if not provided)
     */
    clear(event) {
        if (event) {
            this.listeners.delete(event);
            this.onceListeners.delete(event);
        } else {
            this.listeners.clear();
            this.onceListeners.clear();
        }
    }

    /**
     * Get number of listeners for an event
     * @param {string} event - Event name
     * @returns {number}
     */
    listenerCount(event) {
        let count = 0;
        if (this.listeners.has(event)) {
            count += this.listeners.get(event).size;
        }
        if (this.onceListeners.has(event)) {
            count += this.onceListeners.get(event).size;
        }
        return count;
    }
}

// Game Events Constants
export const GameEvents = {
    // Game lifecycle
    GAME_INIT: 'game:init',
    GAME_START: 'game:start',
    GAME_PAUSE: 'game:pause',
    GAME_RESUME: 'game:resume',
    GAME_END: 'game:end',
    GAME_UPDATE: 'game:update',

    // Entity events
    ENTITY_CREATED: 'entity:created',
    ENTITY_DESTROYED: 'entity:destroyed',
    ENTITY_DAMAGED: 'entity:damaged',
    ENTITY_HEALED: 'entity:healed',
    ENTITY_SELECTED: 'entity:selected',
    ENTITY_DESELECTED: 'entity:deselected',

    // Unit events
    UNIT_SPAWNED: 'unit:spawned',
    UNIT_KILLED: 'unit:killed',
    UNIT_COMMAND: 'unit:command',
    UNIT_ARRIVED: 'unit:arrived',
    UNIT_ATTACK: 'unit:attack',

    // Building events
    BUILDING_PLACED: 'building:placed',
    BUILDING_COMPLETED: 'building:completed',
    BUILDING_DESTROYED: 'building:destroyed',
    BUILDING_QUEUE_START: 'building:queue:start',
    BUILDING_QUEUE_COMPLETE: 'building:queue:complete',

    // Resource events
    RESOURCE_CHANGED: 'resource:changed',
    RESOURCE_COLLECTED: 'resource:collected',
    RESOURCE_SPENT: 'resource:spent',
    RESOURCE_DEPLETED: 'resource:depleted',
    RESOURCE_REGROWN: 'resource:regrown',

    // Combat events
    COMBAT_PROJECTILE_FIRED: 'combat:projectile:fired',
    COMBAT_PROJECTILE_HIT: 'combat:projectile:hit',
    COMBAT_EXPLOSION: 'combat:explosion',

    // UI events
    UI_BUILD_MODE_ENTER: 'ui:buildmode:enter',
    UI_BUILD_MODE_EXIT: 'ui:buildmode:exit',
    UI_SELECTION_CHANGED: 'ui:selection:changed',
    UI_ALERT: 'ui:alert',
    UI_TOOLTIP_SHOW: 'ui:tooltip:show',
    UI_TOOLTIP_HIDE: 'ui:tooltip:hide',

    // Input events
    INPUT_CLICK: 'input:click',
    INPUT_RIGHT_CLICK: 'input:rightclick',
    INPUT_KEY: 'input:key',
    INPUT_DRAG_START: 'input:drag:start',
    INPUT_DRAG_END: 'input:drag:end',

    // Camera events
    CAMERA_MOVE: 'camera:move',
    CAMERA_ZOOM: 'camera:zoom',

    // AI events
    AI_DECISION: 'ai:decision',
    AI_ATTACK: 'ai:attack',

    // Diplomacy events
    DIPLOMACY_WAR: 'diplomacy:war',
    DIPLOMACY_PEACE: 'diplomacy:peace',
    DIPLOMACY_PROVOKED: 'diplomacy:provoked',

    // Save/Load events
    QUICKSAVE: 'save:quick',
    QUICKLOAD: 'load:quick',
    SAVE_COMPLETE: 'save:complete',
    SAVE_ERROR: 'save:error',
    LOAD_COMPLETE: 'load:complete',
    LOAD_ERROR: 'load:error',
    GAME_RESET: 'game:reset',
    RESTORE_ENTITY: 'restore:entity',
    RESTORE_FOG: 'restore:fog',
    STATE_RESTORED: 'state:restored',

    // Building placement events
    BUILDING_PLACEMENT_START: 'building:placement:start',
    BUILDING_PLACEMENT_CANCEL: 'building:placement:cancel',

    // Unit queue events
    UNIT_QUEUE_REQUEST: 'unit:queue:request',

    // Graphics events
    GRAPHICS_QUALITY_CHANGED: 'graphics:quality:changed',

    // Settings UI events
    SETTINGS_OPEN: 'settings:open',
    SETTINGS_CLOSE: 'settings:close',

    // Hotkey events
    HOTKEY_BUILD_MENU: 'hotkey:buildmenu',
    HOTKEY_SETTINGS: 'hotkey:settings',

    // Pre-game lobby events
    GAME_CONFIG_READY: 'game:config:ready'
};

// Create singleton instance
export const eventBus = new EventBus();

export default EventBus;
