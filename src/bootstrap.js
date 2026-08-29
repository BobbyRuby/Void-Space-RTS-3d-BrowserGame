// Game Bootstrap (relocated from inline index.html <script type="module"> for CSP)
// Import debug logger FIRST to capture all errors
// Cache bust: v=20260119
import { debugLogger } from './core/DebugLogger.js?v=20260119';
import { game } from './core/Game.js?v=20260119';
import { preGameLobby } from './ui/PreGameLobby.js?v=20260119';
import './ui/PauseMenu.js?v=20260119';
import './ui/SurvivalHUD.js?v=20260119';

// Initialize and start the game with pre-game lobby
window.addEventListener('DOMContentLoaded', async () => {
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
