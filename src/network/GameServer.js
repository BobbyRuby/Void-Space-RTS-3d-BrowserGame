// ============================================================
// VOID SUPREMACY 3D - Game Server
// Node.js WebSocket server for multiplayer games
// Run with: node GameServer.js
// ============================================================

// NOTE: This file is meant to be run with Node.js, not in browser
// Install dependency: npm install ws

import { WebSocketServer } from 'ws';

const NetMessageType = {
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    PING: 'ping',
    PONG: 'pong',
    JOIN_LOBBY: 'joinLobby',
    LEAVE_LOBBY: 'leaveLobby',
    LOBBY_STATE: 'lobbyState',
    PLAYER_JOINED: 'playerJoined',
    PLAYER_LEFT: 'playerLeft',
    CHAT_MESSAGE: 'chatMessage',
    READY_STATE: 'readyState',
    START_GAME: 'startGame',
    GAME_INIT: 'gameInit',
    GAME_STATE_SYNC: 'gameStateSync',
    GAME_TICK: 'gameTick',
    UNIT_COMMAND: 'unitCommand',
    BUILD_COMMAND: 'buildCommand',
    PRODUCTION_COMMAND: 'productionCommand',
    ENTITY_CREATED: 'entityCreated',
    ENTITY_DESTROYED: 'entityDestroyed',
    ENTITY_UPDATE: 'entityUpdate',
    RESOURCE_UPDATE: 'resourceUpdate'
};

class Player {
    constructor(id, socket) {
        this.id = id;
        this.socket = socket;
        this.name = `Player ${id}`;
        this.team = -1;
        this.isReady = false;
        this.lobbyId = null;
        this.ping = 0;
    }

    send(type, data) {
        if (this.socket.readyState === 1) { // OPEN
            this.socket.send(JSON.stringify({ type, data }));
        }
    }
}

class Lobby {
    constructor(id, hostPlayer) {
        this.id = id;
        this.host = hostPlayer;
        this.players = new Map();
        this.maxPlayers = 4;
        this.isStarted = false;
        this.settings = {
            mapSize: 2000,
            startingResources: 'normal',
            fogOfWar: true
        };

        this.addPlayer(hostPlayer);
    }

    addPlayer(player) {
        if (this.players.size >= this.maxPlayers) {
            return false;
        }

        // Assign team
        player.team = this.players.size;
        player.lobbyId = this.id;
        this.players.set(player.id, player);

        return true;
    }

    removePlayer(playerId) {
        const player = this.players.get(playerId);
        if (player) {
            player.lobbyId = null;
            this.players.delete(playerId);

            // Reassign host if needed
            if (this.host.id === playerId && this.players.size > 0) {
                this.host = this.players.values().next().value;
            }
        }
        return this.players.size;
    }

    allReady() {
        for (const player of this.players.values()) {
            if (!player.isReady) return false;
        }
        return this.players.size >= 2;
    }

    getState() {
        return {
            id: this.id,
            host: this.host.id,
            players: Array.from(this.players.values()).map(p => ({
                id: p.id,
                name: p.name,
                team: p.team,
                isReady: p.isReady
            })),
            settings: this.settings,
            isStarted: this.isStarted
        };
    }

    broadcast(type, data, excludeId = null) {
        for (const player of this.players.values()) {
            if (player.id !== excludeId) {
                player.send(type, data);
            }
        }
    }
}

class GameSession {
    constructor(lobby) {
        this.id = lobby.id;
        this.players = new Map(lobby.players);
        this.tick = 0;
        this.tickRate = 20; // Ticks per second
        this.tickInterval = null;
        this.commandBuffer = new Map(); // tick -> commands[]

        this.entities = new Map();
        this.nextEntityId = 1;
    }

    start() {
        console.log(`Game ${this.id} started with ${this.players.size} players`);

        // Generate initial game state
        const initData = this.generateInitialState();

        // Send init to all players
        for (const player of this.players.values()) {
            player.send(NetMessageType.GAME_INIT, {
                ...initData,
                yourTeam: player.team
            });
        }

        // Start tick loop
        this.tickInterval = setInterval(() => this.processTick(), 1000 / this.tickRate);
    }

    generateInitialState() {
        const teams = [];

        for (const player of this.players.values()) {
            // Calculate spawn position based on team
            const angle = (player.team / this.players.size) * Math.PI * 2;
            const radius = 800;

            teams.push({
                team: player.team,
                playerId: player.id,
                playerName: player.name,
                spawnX: Math.cos(angle) * radius,
                spawnZ: Math.sin(angle) * radius
            });
        }

        return {
            mapSize: 2000,
            teams,
            resourceNodes: this.generateResourceNodes()
        };
    }

    generateResourceNodes() {
        const nodes = [];
        const nodeCount = 30;

        for (let i = 0; i < nodeCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 200 + Math.random() * 700;

            nodes.push({
                type: Math.random() > 0.3 ? 'ore' : 'crystal',
                x: Math.cos(angle) * radius,
                z: Math.sin(angle) * radius,
                amount: 2000 + Math.random() * 3000
            });
        }

        return nodes;
    }

    queueCommand(command) {
        const targetTick = command.tick || this.tick + 2;

        if (!this.commandBuffer.has(targetTick)) {
            this.commandBuffer.set(targetTick, []);
        }

        this.commandBuffer.get(targetTick).push(command);
    }

    processTick() {
        this.tick++;

        // Get commands for this tick
        const commands = this.commandBuffer.get(this.tick) || [];
        this.commandBuffer.delete(this.tick);

        // Broadcast tick to all players
        for (const player of this.players.values()) {
            player.send(NetMessageType.GAME_TICK, {
                tick: this.tick,
                commands
            });
        }
    }

    handleCommand(playerId, command) {
        // Validate command is from correct player
        const player = this.players.get(playerId);
        if (!player) return;

        // Add player team info
        command.team = player.team;

        // Queue command
        this.queueCommand(command);

        // Broadcast to other players
        for (const p of this.players.values()) {
            if (p.id !== playerId) {
                p.send(command.type, command);
            }
        }
    }

    removePlayer(playerId) {
        this.players.delete(playerId);

        // Notify remaining players
        for (const player of this.players.values()) {
            player.send(NetMessageType.PLAYER_LEFT, { playerId });
        }

        // End game if too few players
        if (this.players.size < 2) {
            this.stop();
        }
    }

    stop() {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
        console.log(`Game ${this.id} ended`);
    }
}

class GameServer {
    constructor(port = 8080) {
        this.port = port;
        this.wss = null;
        this.players = new Map();
        this.lobbies = new Map();
        this.games = new Map();
        this.nextPlayerId = 1;
        this.nextLobbyId = 1;
    }

    start() {
        this.wss = new WebSocketServer({ port: this.port });

        this.wss.on('connection', (socket) => {
            this.handleConnection(socket);
        });

        console.log(`Void Supremacy 3D Server running on port ${this.port}`);
    }

    handleConnection(socket) {
        const playerId = this.nextPlayerId++;
        const player = new Player(playerId, socket);
        this.players.set(playerId, player);

        console.log(`Player ${playerId} connected`);

        // Send connection confirmation
        player.send(NetMessageType.CONNECT, { playerId });

        socket.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                this.handleMessage(player, message);
            } catch (e) {
                console.error('Invalid message:', e);
            }
        });

        socket.on('close', () => {
            this.handleDisconnect(player);
        });

        socket.on('error', (error) => {
            console.error(`Player ${playerId} error:`, error);
        });
    }

    handleMessage(player, message) {
        const { type, data } = message;

        switch (type) {
            case NetMessageType.PING:
                player.send(NetMessageType.PONG, { timestamp: Date.now() });
                break;

            case NetMessageType.JOIN_LOBBY:
                this.handleJoinLobby(player, data);
                break;

            case NetMessageType.LEAVE_LOBBY:
                this.handleLeaveLobby(player);
                break;

            case NetMessageType.CHAT_MESSAGE:
                this.handleChat(player, data);
                break;

            case NetMessageType.READY_STATE:
                this.handleReadyState(player, data);
                break;

            case NetMessageType.START_GAME:
                this.handleStartGame(player);
                break;

            case NetMessageType.UNIT_COMMAND:
            case NetMessageType.BUILD_COMMAND:
            case NetMessageType.PRODUCTION_COMMAND:
                this.handleGameCommand(player, type, data);
                break;

            default:
                console.warn(`Unknown message type: ${type}`);
        }
    }

    handleJoinLobby(player, data) {
        const { lobbyId, playerName } = data;

        player.name = playerName || player.name;

        let lobby;

        if (lobbyId && this.lobbies.has(lobbyId)) {
            // Join existing lobby
            lobby = this.lobbies.get(lobbyId);
            if (!lobby.addPlayer(player)) {
                player.send('error', { message: 'Lobby is full' });
                return;
            }
        } else {
            // Create new lobby
            lobby = new Lobby(this.nextLobbyId++, player);
            this.lobbies.set(lobby.id, lobby);
        }

        // Send lobby state to joining player
        player.send(NetMessageType.LOBBY_STATE, { lobby: lobby.getState() });

        // Notify other players
        lobby.broadcast(NetMessageType.PLAYER_JOINED, {
            player: {
                id: player.id,
                name: player.name,
                team: player.team,
                isReady: false
            }
        }, player.id);
    }

    handleLeaveLobby(player) {
        if (!player.lobbyId) return;

        const lobby = this.lobbies.get(player.lobbyId);
        if (!lobby) return;

        const remaining = lobby.removePlayer(player.id);

        // Notify others
        lobby.broadcast(NetMessageType.PLAYER_LEFT, { playerId: player.id });

        // Delete empty lobby
        if (remaining === 0) {
            this.lobbies.delete(lobby.id);
        } else {
            // Send updated state
            lobby.broadcast(NetMessageType.LOBBY_STATE, { lobby: lobby.getState() });
        }
    }

    handleChat(player, data) {
        if (!player.lobbyId) return;

        const lobby = this.lobbies.get(player.lobbyId);
        if (!lobby) return;

        lobby.broadcast(NetMessageType.CHAT_MESSAGE, {
            playerId: player.id,
            playerName: player.name,
            message: data.message,
            timestamp: Date.now()
        });
    }

    handleReadyState(player, data) {
        player.isReady = data.isReady;

        const lobby = this.lobbies.get(player.lobbyId);
        if (lobby) {
            lobby.broadcast(NetMessageType.LOBBY_STATE, { lobby: lobby.getState() });
        }
    }

    handleStartGame(player) {
        const lobby = this.lobbies.get(player.lobbyId);
        if (!lobby) return;

        // Only host can start
        if (lobby.host.id !== player.id) {
            player.send('error', { message: 'Only host can start the game' });
            return;
        }

        // Check all ready
        if (!lobby.allReady()) {
            player.send('error', { message: 'Not all players are ready' });
            return;
        }

        // Create game session
        lobby.isStarted = true;
        const game = new GameSession(lobby);
        this.games.set(game.id, game);

        // Notify all players
        lobby.broadcast(NetMessageType.START_GAME, {
            gameId: game.id
        });

        // Start the game
        game.start();

        // Remove lobby
        this.lobbies.delete(lobby.id);
    }

    handleGameCommand(player, type, data) {
        // Find player's game
        let game = null;
        for (const g of this.games.values()) {
            if (g.players.has(player.id)) {
                game = g;
                break;
            }
        }

        if (!game) return;

        game.handleCommand(player.id, { type, ...data });
    }

    handleDisconnect(player) {
        console.log(`Player ${player.id} disconnected`);

        // Remove from lobby
        if (player.lobbyId) {
            this.handleLeaveLobby(player);
        }

        // Remove from game
        for (const game of this.games.values()) {
            if (game.players.has(player.id)) {
                game.removePlayer(player.id);
                break;
            }
        }

        this.players.delete(player.id);
    }

    stop() {
        // Stop all games
        for (const game of this.games.values()) {
            game.stop();
        }

        // Close all connections
        if (this.wss) {
            this.wss.close();
        }

        console.log('Server stopped');
    }
}

// Run server if this is the main module
const server = new GameServer(8080);
server.start();

export { GameServer, Player, Lobby, GameSession };
