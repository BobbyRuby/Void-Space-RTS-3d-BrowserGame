// Game Bootstrap (relocated from inline index.html <script type="module"> for CSP)
// Import debug logger FIRST to capture all errors
// Cache bust: v=20260119
import { debugLogger } from './core/DebugLogger.js?v=20260119';
import { game } from './core/Game.js?v=20260119';
import { preGameLobby } from './ui/PreGameLobby.js?v=20260119';
import { setGraphicsLevel, GRAPHICS_SETTINGS } from './core/Config.js?v=20260119';
import './ui/PauseMenu.js?v=20260119';
import './ui/SurvivalHUD.js?v=20260119';
import { combatFX } from './ui/CombatFX.js?v=20260119';

// Initialize and start the game with pre-game lobby
window.addEventListener('DOMContentLoaded', async () => {
    // #hud is static markup in index.html, so it exists here.
    combatFX.init();

    // Boot-read persisted graphics quality tier (voted default is HIGH).
    // Must run before the scene builds so GraphicsManager.init picks up the right tier.
    try {
        let saved = localStorage.getItem('voidspace.graphicsLevel');

        // One-time version-flagged migration (VOTE-024b): bump a saved level BELOW
        // HIGH up to HIGH exactly once, so returning players (who saved a level
        // before HIGH became the default) land on HIGH. Levels >= HIGH (e.g. ULTRA)
        // are left untouched - never downgrade anyone. After this runs, any level
        // the player sets sticks forever (the flag prevents a second bump).
        if (localStorage.getItem('voidspace.graphicsLevelMigrated') !== '1') {
            const order = Object.keys(GRAPHICS_SETTINGS); // [LOW, MEDIUM, HIGH, ULTRA]
            if (saved && GRAPHICS_SETTINGS[saved] &&
                order.indexOf(saved) < order.indexOf('HIGH')) {
                saved = 'HIGH';
                localStorage.setItem('voidspace.graphicsLevel', 'HIGH');
            }
            localStorage.setItem('voidspace.graphicsLevelMigrated', '1');
        }

        if (saved && GRAPHICS_SETTINGS[saved]) {
            setGraphicsLevel(saved);
        } else {
            setGraphicsLevel('HIGH');
        }
    } catch (error) {
        setGraphicsLevel('HIGH');
    }

    // Hide loading screen initially (lobby will show instead)
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }

    document.getElementById('playAgainBtn')?.addEventListener('click', () => location.reload());

    // Show pre-game lobby and wait for configuration
    preGameLobby.init(async (config) => {
        try {
            // Show loading screen during initialization
            if (loadingScreen) {
                loadingScreen.style.display = 'flex';
            }

            // Initialize game with lobby config
            await game.init('renderCanvas', 'minimapCanvas', config);
            game.start();
        } catch (error) {
            console.error('Failed to initialize game:', error);
            document.getElementById('loadingText').textContent = 'Error: ' + error.message;
        }
    });
});

// Instructions
console.log('=== DEBUG MODE ===');
console.log('Press Ctrl+Shift+L to download debug logs');
console.log('Or type: downloadLogs() in console');
