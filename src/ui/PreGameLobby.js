// ============================================================
// VOID SUPREMACY 3D - Pre-Game Configuration Lobby
// Configure map, resources, difficulty before starting game
// ============================================================

import { eventBus, GameEvents } from '../core/EventBus.js?v=20260119';
import { CONFIG } from '../core/Config.js?v=20260119';

/**
 * Pre-Game Lobby for game configuration
 * Shows before game starts, allows setting up match parameters
 */
export class PreGameLobby {
    constructor() {
        this.container = null;
        this.isVisible = false;
        this.onStartCallback = null;

        // Default configuration
        this.config = {
            // Map settings
            mapSize: 1200,
            mapSeed: '',
            numAIPlayers: 2,

            // Resource settings
            oreFields: 8,
            crystalFields: 4,
            resourceRegrowRate: 0.1,

            // Starting resources
            startingCredits: 1000,
            startingHarvesters: 1,

            // Game options
            fogOfWar: false,
            aiDifficulty: 'normal', // easy, normal, hard
            gameSpeed: 1.0
        };
    }

    /**
     * Initialize the lobby UI
     * @param {Function} onStart - Callback when game starts
     */
    init(onStart) {
        this.onStartCallback = onStart;
        this.createUI();
        this.show();
    }

    /**
     * Create the lobby UI elements
     */
    createUI() {
        // Create container
        this.container = document.createElement('div');
        this.container.id = 'pregame-lobby';
        this.container.innerHTML = `
            <div class="lobby-overlay">
                <div class="lobby-panel">
                    <h1 class="lobby-title">VOID SUPREMACY</h1>
                    <h2 class="lobby-subtitle">Game Configuration</h2>

                    <div class="lobby-sections">
                        <!-- Map Settings -->
                        <div class="lobby-section">
                            <h3>Map Settings</h3>
                            <div class="setting-row">
                                <label for="map-size">Map Size</label>
                                <select id="map-size">
                                    <option value="800">Small (800)</option>
                                    <option value="1200" selected>Medium (1200)</option>
                                    <option value="1600">Large (1600)</option>
                                    <option value="2000">Huge (2000)</option>
                                </select>
                            </div>
                            <div class="setting-row">
                                <label for="map-seed">Map Seed</label>
                                <input type="text" id="map-seed" placeholder="Random" maxlength="20">
                            </div>
                            <div class="setting-row">
                                <label for="num-ai">AI Opponents</label>
                                <select id="num-ai">
                                    <option value="0">None (Sandbox)</option>
                                    <option value="1">1 AI</option>
                                    <option value="2" selected>2 AI</option>
                                    <option value="3">3 AI</option>
                                </select>
                            </div>
                        </div>

                        <!-- Resource Settings -->
                        <div class="lobby-section">
                            <h3>Resources</h3>
                            <div class="setting-row">
                                <label for="ore-fields">Ore Fields</label>
                                <input type="range" id="ore-fields" min="2" max="16" value="8">
                                <span id="ore-fields-value">8</span>
                            </div>
                            <div class="setting-row">
                                <label for="crystal-fields">Crystal Fields</label>
                                <input type="range" id="crystal-fields" min="1" max="8" value="4">
                                <span id="crystal-fields-value">4</span>
                            </div>
                            <div class="setting-row">
                                <label for="regrow-rate">Regrow Rate</label>
                                <select id="regrow-rate">
                                    <option value="0">None</option>
                                    <option value="0.05">Slow</option>
                                    <option value="0.1" selected>Normal</option>
                                    <option value="0.2">Fast</option>
                                </select>
                            </div>
                        </div>

                        <!-- Starting Resources -->
                        <div class="lobby-section">
                            <h3>Starting</h3>
                            <div class="setting-row">
                                <label for="start-credits">Credits</label>
                                <select id="start-credits">
                                    <option value="500">500 (Scarce)</option>
                                    <option value="1000" selected>1000 (Normal)</option>
                                    <option value="2000">2000 (Rich)</option>
                                    <option value="5000">5000 (Wealthy)</option>
                                </select>
                            </div>
                            <div class="setting-row">
                                <label for="start-harvesters">Harvesters</label>
                                <select id="start-harvesters">
                                    <option value="0">0</option>
                                    <option value="1" selected>1</option>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                </select>
                            </div>
                        </div>

                        <!-- Game Options -->
                        <div class="lobby-section">
                            <h3>Options</h3>
                            <div class="setting-row">
                                <label for="ai-difficulty">AI Difficulty</label>
                                <select id="ai-difficulty">
                                    <option value="easy">Easy</option>
                                    <option value="normal" selected>Normal</option>
                                    <option value="hard">Hard</option>
                                </select>
                            </div>
                            <div class="setting-row">
                                <label for="game-speed">Game Speed</label>
                                <select id="game-speed">
                                    <option value="0.5">Slow (0.5x)</option>
                                    <option value="1" selected>Normal (1x)</option>
                                    <option value="1.5">Fast (1.5x)</option>
                                    <option value="2">Very Fast (2x)</option>
                                </select>
                            </div>
                            <div class="setting-row checkbox-row">
                                <label for="fog-of-war">Fog of War</label>
                                <input type="checkbox" id="fog-of-war">
                            </div>
                        </div>
                    </div>

                    <div class="lobby-buttons">
                        <button id="start-game-btn" class="btn-primary">Start Game</button>
                    </div>

                    <div class="lobby-footer">
                        <p>Seed: <span id="current-seed">Random</span></p>
                    </div>
                </div>
            </div>
        `;

        // Add styles
        this.addStyles();

        // Append to body
        document.body.appendChild(this.container);

        // Setup event listeners
        this.setupEventListeners();
    }

    /**
     * Add CSS styles for the lobby
     */
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #pregame-lobby {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
            }

            #pregame-lobby.visible {
                display: block;
            }

            .lobby-overlay {
                width: 100%;
                height: 100%;
                background: radial-gradient(ellipse at center, #0a1628 0%, #020508 100%);
                display: flex;
                justify-content: center;
                align-items: center;
            }

            .lobby-panel {
                background: rgba(10, 20, 40, 0.95);
                border: 2px solid #00aaff;
                border-radius: 10px;
                padding: 30px;
                max-width: 700px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 0 40px rgba(0, 170, 255, 0.3);
            }

            .lobby-title {
                text-align: center;
                color: #00aaff;
                font-size: 2.5em;
                margin: 0 0 5px 0;
                text-shadow: 0 0 20px rgba(0, 170, 255, 0.5);
                letter-spacing: 3px;
            }

            .lobby-subtitle {
                text-align: center;
                color: #88ccff;
                font-size: 1.2em;
                margin: 0 0 25px 0;
                font-weight: normal;
            }

            .lobby-sections {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
            }

            @media (max-width: 600px) {
                .lobby-sections {
                    grid-template-columns: 1fr;
                }
            }

            .lobby-section {
                background: rgba(0, 50, 80, 0.3);
                border: 1px solid rgba(0, 170, 255, 0.3);
                border-radius: 5px;
                padding: 15px;
            }

            .lobby-section h3 {
                color: #00aaff;
                margin: 0 0 15px 0;
                font-size: 1.1em;
                border-bottom: 1px solid rgba(0, 170, 255, 0.3);
                padding-bottom: 8px;
            }

            .setting-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }

            .setting-row:last-child {
                margin-bottom: 0;
            }

            .setting-row label {
                color: #aaccee;
                font-size: 0.9em;
                flex: 1;
            }

            .setting-row select,
            .setting-row input[type="text"],
            .setting-row input[type="range"] {
                background: rgba(0, 30, 60, 0.8);
                border: 1px solid #00aaff;
                color: #fff;
                padding: 6px 10px;
                border-radius: 3px;
                width: 140px;
            }

            .setting-row input[type="range"] {
                width: 100px;
                margin-right: 10px;
            }

            .setting-row span {
                color: #00aaff;
                min-width: 25px;
                text-align: right;
            }

            .checkbox-row input[type="checkbox"] {
                width: 20px;
                height: 20px;
                cursor: pointer;
            }

            .lobby-buttons {
                margin-top: 25px;
                text-align: center;
            }

            .btn-primary {
                background: linear-gradient(180deg, #0066aa 0%, #004477 100%);
                border: 2px solid #00aaff;
                color: #fff;
                padding: 15px 50px;
                font-size: 1.2em;
                border-radius: 5px;
                cursor: pointer;
                text-transform: uppercase;
                letter-spacing: 2px;
                transition: all 0.2s;
            }

            .btn-primary:hover {
                background: linear-gradient(180deg, #0088cc 0%, #0066aa 100%);
                box-shadow: 0 0 20px rgba(0, 170, 255, 0.5);
            }

            .btn-primary:active {
                transform: scale(0.98);
            }

            .lobby-footer {
                margin-top: 20px;
                text-align: center;
                color: #668899;
                font-size: 0.85em;
            }

            .lobby-footer span {
                color: #00aaff;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Setup event listeners for UI elements
     */
    setupEventListeners() {
        // Range sliders with value display
        const oreFields = this.container.querySelector('#ore-fields');
        const oreValue = this.container.querySelector('#ore-fields-value');
        oreFields.addEventListener('input', () => {
            oreValue.textContent = oreFields.value;
        });

        const crystalFields = this.container.querySelector('#crystal-fields');
        const crystalValue = this.container.querySelector('#crystal-fields-value');
        crystalFields.addEventListener('input', () => {
            crystalValue.textContent = crystalFields.value;
        });

        // Seed input
        const seedInput = this.container.querySelector('#map-seed');
        const seedDisplay = this.container.querySelector('#current-seed');
        seedInput.addEventListener('input', () => {
            seedDisplay.textContent = seedInput.value || 'Random';
        });

        // Start button
        const startBtn = this.container.querySelector('#start-game-btn');
        startBtn.addEventListener('click', () => {
            this.startGame();
        });
    }

    /**
     * Read configuration from UI and start game
     */
    startGame() {
        // Read all settings from UI
        this.config.mapSize = parseInt(this.container.querySelector('#map-size').value);
        this.config.mapSeed = this.container.querySelector('#map-seed').value || String(Date.now());
        this.config.numAIPlayers = parseInt(this.container.querySelector('#num-ai').value);

        this.config.oreFields = parseInt(this.container.querySelector('#ore-fields').value);
        this.config.crystalFields = parseInt(this.container.querySelector('#crystal-fields').value);
        this.config.resourceRegrowRate = parseFloat(this.container.querySelector('#regrow-rate').value);

        this.config.startingCredits = parseInt(this.container.querySelector('#start-credits').value);
        this.config.startingHarvesters = parseInt(this.container.querySelector('#start-harvesters').value);

        this.config.aiDifficulty = this.container.querySelector('#ai-difficulty').value;
        this.config.gameSpeed = parseFloat(this.container.querySelector('#game-speed').value);
        this.config.fogOfWar = this.container.querySelector('#fog-of-war').checked;

        // Emit config ready event
        eventBus.emit(GameEvents.GAME_CONFIG_READY, this.config);

        // Hide lobby
        this.hide();

        // Call start callback
        if (this.onStartCallback) {
            this.onStartCallback(this.config);
        }
    }

    /**
     * Get the current configuration
     * @returns {Object}
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Show the lobby
     */
    show() {
        if (this.container) {
            this.container.classList.add('visible');
            this.isVisible = true;
        }
    }

    /**
     * Hide the lobby
     */
    hide() {
        if (this.container) {
            this.container.classList.remove('visible');
            this.isVisible = false;
        }
    }

    /**
     * Dispose of the lobby
     */
    dispose() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
    }
}

// Singleton instance
export const preGameLobby = new PreGameLobby();

export default PreGameLobby;
