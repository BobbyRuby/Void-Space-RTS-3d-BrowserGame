// ============================================================
// VOID SUPREMACY 3D - Debug Logger
// Captures all console output for debugging
// ============================================================

class DebugLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 5000;
        this.originalConsole = {};
        this.serverLoggingEnabled = false; // Disabled - no server on static hosting
        this.logEndpoint = '/log';

        // Intercept console methods
        this.intercept();

        // Add keyboard shortcut to download logs (Ctrl+Shift+L)
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'L') {
                this.downloadLogs();
            }
        });

        // Add error handler for uncaught errors
        window.addEventListener('error', (e) => {
            this.log('UNCAUGHT_ERROR', `${e.message} at ${e.filename}:${e.lineno}:${e.colno}`, e.error?.stack);
        });

        window.addEventListener('unhandledrejection', (e) => {
            this.log('UNHANDLED_REJECTION', e.reason?.message || String(e.reason), e.reason?.stack);
        });

        console.log('DebugLogger initialized - Logs saved to debug.log (Press Ctrl+Shift+L to download)');
    }

    intercept() {
        const methods = ['log', 'warn', 'error', 'info', 'debug'];

        methods.forEach(method => {
            this.originalConsole[method] = console[method].bind(console);

            console[method] = (...args) => {
                this.log(method.toUpperCase(), ...args);
                this.originalConsole[method](...args);
            };
        });
    }

    log(level, ...args) {
        const timestamp = new Date().toISOString();
        const message = args.map(arg => {
            if (arg === undefined) return 'undefined';
            if (arg === null) return 'null';
            if (typeof arg === 'object') {
                try {
                    if (arg instanceof Error) {
                        return `${arg.name}: ${arg.message}\n${arg.stack}`;
                    }
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');

        const logEntry = {
            timestamp,
            level,
            message
        };

        this.logs.push(logEntry);

        // Send to server in real-time
        this.sendToServer(logEntry);

        // Trim old logs
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
    }

    sendToServer(logEntry) {
        if (!this.serverLoggingEnabled) return;

        try {
            fetch(this.logEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(logEntry)
            }).catch(() => {
                // Silently fail - don't spam console if server is down
            });
        } catch (e) {
            // Ignore fetch errors
        }
    }

    getFormattedLogs() {
        return this.logs.map(entry =>
            `[${entry.timestamp}] [${entry.level}] ${entry.message}`
        ).join('\n');
    }

    downloadLogs() {
        const content = this.getFormattedLogs();
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `void-supremacy-debug-${Date.now()}.log`;
        a.click();

        URL.revokeObjectURL(url);

        this.originalConsole.log('Debug logs downloaded');
    }

    clear() {
        this.logs = [];
    }

    // Get recent logs for display
    getRecentLogs(count = 50) {
        return this.logs.slice(-count);
    }
}

// Create singleton and export
export const debugLogger = new DebugLogger();

// Also attach to window for easy access from console
window.debugLogger = debugLogger;
window.downloadLogs = () => debugLogger.downloadLogs();

export default DebugLogger;
