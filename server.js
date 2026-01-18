// Simple HTTP server for Void Supremacy 3D
// Run with: node server.js

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const LOG_FILE = path.join(__dirname, 'debug.log');

// Clear log file on server start
fs.writeFileSync(LOG_FILE, `=== Void Supremacy 3D Debug Log ===\nServer started: ${new Date().toISOString()}\n\n`, 'utf8');

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg'
};

const server = http.createServer((req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }

    // Handle POST /log endpoint for real-time logging
    if (req.method === 'POST' && req.url === '/log') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const logEntry = JSON.parse(body);
                const formattedEntry = `[${logEntry.timestamp}] [${logEntry.level}] ${logEntry.message}\n`;
                fs.appendFile(LOG_FILE, formattedEntry, err => {
                    if (err) console.error('Failed to write log:', err);
                });
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end('{"status":"ok"}');
            } catch (e) {
                res.writeHead(400, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end('{"error":"Invalid JSON"}');
            }
        });
        return;
    }

    // Strip query string for file path lookup (cache busting support)
    let urlPath = req.url.split('?')[0];
    let filePath = urlPath === '/' ? '/index.html' : urlPath;

    // Serve from src/ directory as the web root
    let fullPath = path.join(__dirname, 'src', filePath);

    // Check if file exists in src/, if not check parent directory (for enhanced models)
    if (!fs.existsSync(fullPath)) {
        const parentPath = path.join(__dirname, filePath);
        if (fs.existsSync(parentPath)) {
            fullPath = parentPath;
        }
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(fullPath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                console.log('404:', req.url);
                res.writeHead(404);
                res.end('File not found: ' + req.url);
            } else {
                res.writeHead(500);
                res.end('Server error: ' + err.code);
            }
        } else {
            res.writeHead(200, {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║           VOID SUPREMACY 3D - Development Server             ║
╠══════════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}                    ║
║  Open this URL in your browser to play the game              ║
║                                                              ║
║  Debug logs: ${LOG_FILE.padEnd(45)}║
║  Press Ctrl+C to stop the server                             ║
╚══════════════════════════════════════════════════════════════╝
`);
});
