// ============================================================
// VOID SUPREMACY 3D - Network Manager
// WebSocket-based multiplayer networking
// ============================================================

import { CONFIG, TEAMS } from '../core/Config.js';
import { eventBus, GameEvents } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';

// Network message types
export const NetMessageType = {
    // Connection
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    PING: 'ping',
    PONG: 'pong',

    // Lobby
    JOIN_LOBBY: 'joinLobby',
    LEAVE_LOBBY: 'leaveLobby',
    LOBBY_STATE: 'lobbyState',
    PLAYER_JOINED: 'playerJoined',
    PLAYER_LEFT: 'playerLeft',
    CHAT_MESSAGE: 'chatMessage',
    READY_STATE: 'readyState',
    START_GAME: 'startGame',

    // Game State
    GAME_INIT: 'gameInit',
    GAME_STATE_SYNC: 'gameStateSync',
    GAME_TICK: 'gameTick',

    // Commands
    UNIT_COMMAND: 'unitCommand',
    BUILD_COMMAND: 'buildCommand',
    PRODUCTION_COMMAND: 'productionCommand',

    // Entities
    ENTITY_CREATED: 'entityCreated',
    ENTITY_DESTROYED: 'entityDestroyed',
    ENTITY_UPDATE: 'entityUpdate',

    // Combat
    ATTACK_EVENT: 'attackEvent',
    DAMAGE_EVENT: 'damageEvent',

    // Resources
    RESOURCE_UPDATE: 'resourceUpdate'
};

// Network states
export const NetworkState = {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    IN_LOBBY: 'inLobby',
    IN_GAME: 'inGame'
};

export class NetworkManager {
    constructor() {
        this.socket = null;
        this.state = NetworkState.DISCONNECTED;
        this.playerId = null;
        this.playerTeam = null;
        this.lobby = null;

        // Server config
        this.serverUrl = 'ws://localhost:8080';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;

        // Latency tracking
        this.ping = 0;
        this.pingInterval = null;
        this.lastPingTime = 0;

        // Command buffer for lockstep
        this.commandBuffer = [];
        this.pendingCommands = new Map(); // tick -> commands
        this.currentTick = 0;
        this.inputDelay = 2; // Ticks ahead to schedule commands

        // Interpolation
        this.entitySnapshots = new Map(); // entityId -> snapshots[]
        this.interpolationDelay = 100; // ms

        // Message handlers
        this.messageHandlers = new Map();
        this.setupMessageHandlers();
    }

    // ===== Connection Management =====

    async connect(serverUrl = this.serverUrl) {
        if (this.state !== NetworkState.DISCONNECTED) {
            console.warn('Already connected or connecting');
            return;
        }

        this.serverUrl = serverUrl;
        this.state = NetworkState.CONNECTING;

        return new Promise((resolve, reject) => {
            try {
                this.socket = new WebSocket(serverUrl);

                this.socket.onopen = () => {
                    console.log('Connected to server');
                    this.state = NetworkState.CONNECTED;
                    this.reconnectAttempts = 0;
                    this.startPingInterval();
                    eventBus.emit(GameEvents.NETWORK_CONNECTED);
                    resolve();
                };

                this.socket.onmessage = (event) => {
                    this.handleMessage(event.data);
                };

                this.socket.onclose = (event) => {
                    console.log('Disconnected from server:', event.reason);
                    this.handleDisconnect();
                };

                this.socket.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    reject(error);
                };

            } catch (error) {
                console.error('Failed to connect:', error);
                this.state = NetworkState.DISCONNECTED;
                reject(error);
            }
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.close(1000, 'Client disconnect');
        }
        this.handleDisconnect();
    }

    handleDisconnect() {
        this.state = NetworkState.DISCONNECTED;
        this.stopPingInterval();

        eventBus.emit(GameEvents.NETWORK_DISCONNECTED);

        // Attempt reconnect if in game
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

            setTimeout(() => {
                this.connect(this.serverUrl).catch(() => { });
            }, this.reconnectDelay * this.reconnectAttempts);
        }
    }

    // ===== Message Handling =====

    setupMessageHandlers() {
        this.messageHandlers.set(NetMessageType.PONG, (data) => {
            this.ping = Date.now() - this.lastPingTime;
        });

        this.messageHandlers.set(NetMessageType.LOBBY_STATE, (data) => {
            this.lobby = data.lobby;
            eventBus.emit(GameEvents.LOBBY_UPDATE, data.lobby);
        });

        this.messageHandlers.set(NetMessageType.PLAYER_JOINED, (data) => {
            eventBus.emit(GameEvents.PLAYER_JOINED, data.player);
        });

        this.messageHandlers.set(NetMessageType.PLAYER_LEFT, (data) => {
            eventBus.emit(GameEvents.PLAYER_LEFT, data.playerId);
        });

        this.messageHandlers.set(NetMessageType.CHAT_MESSAGE, (data) => {
            eventBus.emit(GameEvents.CHAT_MESSAGE, data);
        });

        this.messageHandlers.set(NetMessageType.START_GAME, (data) => {
            this.state = NetworkState.IN_GAME;
            this.playerTeam = data.team;
            eventBus.emit(GameEvents.GAME_START, data);
        });

        this.messageHandlers.set(NetMessageType.GAME_INIT, (data) => {
            eventBus.emit(GameEvents.GAME_INIT_SYNC, data);
        });

        this.messageHandlers.set(NetMessageType.GAME_TICK, (data) => {
            this.handleGameTick(data);
        });

        this.messageHandlers.set(NetMessageType.ENTITY_CREATED, (data) => {
            eventBus.emit(GameEvents.NET_ENTITY_CREATED, data);
        });

        this.messageHandlers.set(NetMessageType.ENTITY_DESTROYED, (data) => {
            eventBus.emit(GameEvents.NET_ENTITY_DESTROYED, data);
        });

        this.messageHandlers.set(NetMessageType.ENTITY_UPDATE, (data) => {
            this.handleEntityUpdate(data);
        });

        this.messageHandlers.set(NetMessageType.RESOURCE_UPDATE, (data) => {
            eventBus.emit(GameEvents.NET_RESOURCE_UPDATE, data);
        });
    }

    handleMessage(rawData) {
        try {
            const message = JSON.parse(rawData);
            const handler = this.messageHandlers.get(message.type);

            if (handler) {
                handler(message.data);
            } else {
                console.warn('Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Failed to parse message:', error);
        }
    }

    send(type, data = {}) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.warn('Cannot send: not connected');
            return false;
        }

        const message = JSON.stringify({
            type,
            data,
            timestamp: Date.now(),
            playerId: this.playerId
        });

        this.socket.send(message);
        return true;
    }

    // ===== Ping/Latency =====

    startPingInterval() {
        this.pingInterval = setInterval(() => {
            this.lastPingTime = Date.now();
            this.send(NetMessageType.PING);
        }, 1000);
    }

    stopPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    // ===== Lobby =====

    joinLobby(lobbyId, playerName) {
        return this.send(NetMessageType.JOIN_LOBBY, {
            lobbyId,
            playerName
        });
    }

    leaveLobby() {
        return this.send(NetMessageType.LEAVE_LOBBY);
    }

    setReady(isReady) {
        return this.send(NetMessageType.READY_STATE, { isReady });
    }

    sendChatMessage(message) {
        return this.send(NetMessageType.CHAT_MESSAGE, { message });
    }

    requestStartGame() {
        return this.send(NetMessageType.START_GAME);
    }

    // ===== Game Commands =====

    sendUnitCommand(command) {
        // Schedule command for future tick (lockstep)
        const scheduledTick = this.currentTick + this.inputDelay;

        const netCommand = {
            ...command,
            tick: scheduledTick,
            playerId: this.playerId
        };

        // Add to local pending commands
        if (!this.pendingCommands.has(scheduledTick)) {
            this.pendingCommands.set(scheduledTick, []);
        }
        this.pendingCommands.get(scheduledTick).push(netCommand);

        // Send to server
        return this.send(NetMessageType.UNIT_COMMAND, netCommand);
    }

    sendBuildCommand(buildingType, position) {
        const scheduledTick = this.currentTick + this.inputDelay;

        return this.send(NetMessageType.BUILD_COMMAND, {
            buildingType,
            position,
            tick: scheduledTick,
            playerId: this.playerId
        });
    }

    sendProductionCommand(buildingId, unitType) {
        const scheduledTick = this.currentTick + this.inputDelay;

        return this.send(NetMessageType.PRODUCTION_COMMAND, {
            buildingId,
            unitType,
            tick: scheduledTick,
            playerId: this.playerId
        });
    }

    // ===== Lockstep Synchronization =====

    handleGameTick(data) {
        const { tick, commands } = data;
        this.currentTick = tick;

        // Merge server commands with local pending
        const allCommands = [
            ...(commands || []),
            ...(this.pendingCommands.get(tick) || [])
        ];

        // Clear processed commands
        this.pendingCommands.delete(tick);

        // Execute all commands for this tick
        for (const command of allCommands) {
            eventBus.emit(GameEvents.NET_COMMAND, command);
        }

        eventBus.emit(GameEvents.GAME_TICK, tick);
    }

    // ===== Entity Interpolation =====

    handleEntityUpdate(data) {
        const { entityId, state, timestamp } = data;

        if (!this.entitySnapshots.has(entityId)) {
            this.entitySnapshots.set(entityId, []);
        }

        const snapshots = this.entitySnapshots.get(entityId);
        snapshots.push({ state, timestamp });

        // Keep only recent snapshots
        while (snapshots.length > 10) {
            snapshots.shift();
        }
    }

    getInterpolatedState(entityId, currentTime) {
        const snapshots = this.entitySnapshots.get(entityId);
        if (!snapshots || snapshots.length < 2) return null;

        const renderTime = currentTime - this.interpolationDelay;

        // Find surrounding snapshots
        let older = null, newer = null;

        for (let i = 0; i < snapshots.length - 1; i++) {
            if (snapshots[i].timestamp <= renderTime &&
                snapshots[i + 1].timestamp >= renderTime) {
                older = snapshots[i];
                newer = snapshots[i + 1];
                break;
            }
        }

        if (!older || !newer) {
            // Use latest snapshot
            return snapshots[snapshots.length - 1]?.state || null;
        }

        // Interpolate
        const t = (renderTime - older.timestamp) / (newer.timestamp - older.timestamp);

        return {
            x: older.state.x + (newer.state.x - older.state.x) * t,
            z: older.state.z + (newer.state.z - older.state.z) * t,
            rotation: this.lerpAngle(older.state.rotation, newer.state.rotation, t),
            health: newer.state.health
        };
    }

    lerpAngle(a, b, t) {
        let diff = b - a;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        return a + diff * t;
    }

    // ===== State Serialization =====

    serializeEntity(entity) {
        if (!entity || !entity.mesh) return null;

        return {
            id: entity.id,
            type: entity.type,
            team: entity.team,
            health: entity.health,
            x: entity.mesh.position.x,
            z: entity.mesh.position.z,
            rotation: entity.mesh.rotation.y,
            isBuilding: entity.isBuilding,
            isConstructing: entity.isConstructing
        };
    }

    serializeCommand(command) {
        return {
            type: command.type,
            entityIds: command.entityIds,
            targetX: command.targetX,
            targetZ: command.targetZ,
            targetId: command.targetId
        };
    }

    // ===== Utility =====

    isConnected() {
        return this.state === NetworkState.CONNECTED ||
            this.state === NetworkState.IN_LOBBY ||
            this.state === NetworkState.IN_GAME;
    }

    isInGame() {
        return this.state === NetworkState.IN_GAME;
    }

    getPing() {
        return this.ping;
    }

    getState() {
        return this.state;
    }

    dispose() {
        this.disconnect();
        this.messageHandlers.clear();
        this.pendingCommands.clear();
        this.entitySnapshots.clear();
    }
}

export const networkManager = new NetworkManager();

export default NetworkManager;
