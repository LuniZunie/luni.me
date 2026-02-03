/**
 * Minecraft Server Module for luni.me
 * Provides API endpoints and WebSocket interface for Minecraft server control
 */

import MinecraftServerController from '../minecraft/mcctl.js';
import express from 'express';

const router = express.Router();
const mcController = new MinecraftServerController();

// Middleware to check authentication (adapt to your auth system)
function requireAuth(req, res, next) {
    // TODO: Integrate with your existing auth system
    // For now, allow all requests - CHANGE THIS IN PRODUCTION!
    if (true) { // Replace with: if (req.isAuthenticated() && req.user.isAdmin)
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
}

// API Routes
router.get('/api/mc/status', requireAuth, (req, res) => {
    const status = {
        running: mcController.serverProcess !== null,
        currentProfile: mcController.config.currentProfile,
        profiles: mcController.config.profiles,
        whitelist: mcController.whitelist
    };
    res.json(status);
});

router.post('/api/mc/start', requireAuth, async (req, res) => {
    try {
        await mcController.startServer();
        res.json({ success: true, message: 'Server starting...' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/api/mc/stop', requireAuth, async (req, res) => {
    try {
        await mcController.stopServer();
        res.json({ success: true, message: 'Server stopped' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/api/mc/restart', requireAuth, async (req, res) => {
    try {
        await mcController.restartServer();
        res.json({ success: true, message: 'Server restarting...' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/api/mc/switch', requireAuth, (req, res) => {
    const { profile } = req.body;

    if (!profile) {
        return res.status(400).json({ error: 'Profile name required' });
    }

    const success = mcController.switchProfile(profile);
    if (success) {
        res.json({ success: true, message: `Switched to ${profile}` });
    } else {
        res.status(400).json({ error: 'Failed to switch profile' });
    }
});

router.post('/api/mc/whitelist/add', requireAuth, (req, res) => {
    const { playerName } = req.body;

    if (!playerName) {
        return res.status(400).json({ error: 'Player name required' });
    }

    mcController.whitelistAdd(playerName);
    res.json({ success: true, whitelist: mcController.whitelist });
});

router.post('/api/mc/whitelist/remove', requireAuth, (req, res) => {
    const { playerName } = req.body;

    if (!playerName) {
        return res.status(400).json({ error: 'Player name required' });
    }

    mcController.whitelistRemove(playerName);
    res.json({ success: true, whitelist: mcController.whitelist });
});

router.get('/api/mc/whitelist', requireAuth, (req, res) => {
    res.json({ whitelist: mcController.whitelist });
});

router.post('/api/mc/regen', requireAuth, async (req, res) => {
    const { profile, seed } = req.body;

    if (!profile) {
        return res.status(400).json({ error: 'Profile name required' });
    }

    try {
        await mcController.regenerateWorld(profile, seed);
        res.json({ success: true, message: 'World will be regenerated on next start' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/api/mc/command', requireAuth, (req, res) => {
    const { command } = req.body;

    if (!command) {
        return res.status(400).json({ error: 'Command required' });
    }

    if (!mcController.serverProcess) {
        return res.status(400).json({ error: 'Server is not running' });
    }

    mcController.sendCommand(command);
    res.json({ success: true, message: 'Command sent' });
});

// WebSocket handler for real-time console output
function setupWebSocket(wss) {
    // Store original console output handlers
    const originalStdoutWrite = process.stdout.write;
    const originalStderrWrite = process.stderr.write;

    // Broadcast function
    function broadcast(data) {
        wss.clients.forEach(client => {
            if (client.readyState === 1) { // WebSocket.OPEN
                try {
                    client.send(JSON.stringify({ type: 'console', data: data.toString() }));
                } catch (e) {
                    console.error('WebSocket send error:', e);
                }
            }
        });
    }

    // Intercept Minecraft console output
    if (mcController.serverProcess) {
        mcController.serverProcess.stdout.on('data', (data) => {
            broadcast(data);
        });

        mcController.serverProcess.stderr.on('data', (data) => {
            broadcast(data);
        });
    }

    // Handle WebSocket messages
    wss.on('connection', (ws) => {
        console.log('MC Control WebSocket client connected');

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);

                if (data.type === 'command' && data.command) {
                    mcController.sendCommand(data.command);
                }
            } catch (e) {
                console.error('WebSocket message error:', e);
            }
        });

        ws.on('close', () => {
            console.log('MC Control WebSocket client disconnected');
        });

        // Send current status
        ws.send(JSON.stringify({
            type: 'status',
            data: {
                running: mcController.serverProcess !== null,
                profile: mcController.config.currentProfile
            }
        }));
    });
}

export { router as minecraftRouter, setupWebSocket as setupMinecraftWebSocket };
export default mcController;
