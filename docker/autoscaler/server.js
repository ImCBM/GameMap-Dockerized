    const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const Docker = require('dockerode');
const WebSocket = require('ws');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class GameServerAutoscaler {
    constructor() {
        this.docker = new Docker();
        this.app = express();
        this.wss = new WebSocket.Server({ port: 8090 });
        
        // Player and Server management
        this.servers = new Map(); // serverId -> { container, lastActivity, port, status, players, createdAt }
        this.playerSessions = new Map(); // sessionId -> { serverId, playerId, lastActivity }
        this.nextPort = parseInt(process.env.SERVER_PORT_START) || 8081;
        this.persistentServer = process.env.PERSISTENT_SERVER_URL || 'http://procgen-server-1:80';
        
        // Configuration
        this.config = {
            minServers: parseInt(process.env.MIN_SERVERS) || 0, // No minimum auto servers
            maxServers: parseInt(process.env.MAX_SERVERS) || 50, // Increased for more players
            maxPlayersPerServer: parseInt(process.env.MAX_PLAYERS_PER_SERVER) || 1, // 1 player per server by default
            inactivityShutdown: parseInt(process.env.INACTIVITY_SHUTDOWN) || 10, // seconds
            cleanupDelete: parseInt(process.env.CLEANUP_DELETE) || 30, // seconds
            baseImage: process.env.BASE_IMAGE || 'procgen-phaser:latest'
        };
        
        this.setupRoutes();
        this.setupWebSocket();
        this.startMonitoring();
        this.startPlayerSessionCleanup();
        
        console.log('🚀 Player-Dedicated Server Autoscaler Started');
        console.log('📊 Config:', this.config);
        console.log(`👥 Max players per server: ${this.config.maxPlayersPerServer}`);
    }

    setupRoutes() {
        this.app.use(express.json());
        
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                servers: this.servers.size,
                activePlayers: this.playerSessions.size,
                persistent: true 
            });
        });

        // Player session management
        this.app.post('/api/player/join', async (req, res) => {
            try {
                const playerId = req.body.playerId || uuidv4();
                const sessionId = uuidv4();
                
                // Find or create a server for this player
                const server = await this.assignServerToPlayer(playerId, sessionId);
                
                // Create player session
                this.playerSessions.set(sessionId, {
                    serverId: server.id,
                    playerId: playerId,
                    lastActivity: Date.now(),
                    createdAt: Date.now()
                });

                console.log(`👤 Player ${playerId} assigned to server ${server.id} (session: ${sessionId})`);
                
                res.json({
                    success: true,
                    sessionId: sessionId,
                    playerId: playerId,
                    serverUrl: server.url,
                    serverId: server.id
                });
                
            } catch (error) {
                console.error('❌ Error assigning player to server:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to assign server to player' 
                });
            }
        });

        // Player heartbeat/activity
        this.app.post('/api/player/heartbeat', (req, res) => {
            const { sessionId } = req.body;
            
            if (this.playerSessions.has(sessionId)) {
                const session = this.playerSessions.get(sessionId);
                session.lastActivity = Date.now();
                
                // Update server activity as well
                if (this.servers.has(session.serverId)) {
                    this.servers.get(session.serverId).lastActivity = Date.now();
                }
                
                res.json({ success: true });
            } else {
                res.status(404).json({ success: false, error: 'Session not found' });
            }
        });

        // Player disconnect
        this.app.post('/api/player/leave', (req, res) => {
            const { sessionId } = req.body;
            
            if (this.playerSessions.has(sessionId)) {
                const session = this.playerSessions.get(sessionId);
                const serverId = session.serverId;
                
                // Remove player session
                this.playerSessions.delete(sessionId);
                
                // Remove player from server
                if (this.servers.has(serverId)) {
                    const server = this.servers.get(serverId);
                    server.players = server.players.filter(p => p.sessionId !== sessionId);
                    console.log(`👋 Player left server ${serverId} (${server.players.length} players remaining)`);
                }
                
                res.json({ success: true });
            } else {
                res.status(404).json({ success: false, error: 'Session not found' });
            }
        });

        // Admin API - Enhanced with player info
        this.app.get('/api/servers', (req, res) => {
            const serverList = Array.from(this.servers.entries()).map(([id, server]) => ({
                id,
                port: server.port,
                status: server.status,
                lastActivity: server.lastActivity,
                uptime: Date.now() - server.createdAt,
                playerCount: server.players.length,
                players: server.players,
                maxPlayers: this.config.maxPlayersPerServer,
                inactiveTime: Date.now() - server.lastActivity
            }));
            
            res.json({
                persistentServer: { 
                    id: 1, 
                    url: this.persistentServer, 
                    status: 'persistent',
                    playerCount: 0,
                    maxPlayers: 'unlimited'
                },
                autoScaledServers: serverList,
                totalServers: serverList.length + 1,
                activePlayers: this.playerSessions.size,
                config: this.config
            });
        });

        // Player capacity monitor endpoint
        this.app.get('/api/capacity', (req, res) => {
            const totalCapacity = this.servers.size * this.config.maxPlayersPerServer;
            const usedCapacity = this.playerSessions.size;
            const availableCapacity = totalCapacity - usedCapacity;
            
            res.json({
                totalServers: this.servers.size + 1, // +1 for persistent
                autoScaledServers: this.servers.size,
                maxPlayersPerServer: this.config.maxPlayersPerServer,
                totalCapacity: totalCapacity,
                usedCapacity: usedCapacity,
                availableCapacity: availableCapacity,
                utilizationPercent: totalCapacity > 0 ? (usedCapacity / totalCapacity * 100).toFixed(2) : 0,
                activePlayers: this.playerSessions.size
            });
        });

        // Game entry point - Auto-assign and redirect to dedicated server
        this.app.get('/game', async (req, res) => {
            try {
                console.log('🎮 New player requesting game access...');
                
                // Create a new player session automatically
                const playerId = req.query.playerId || this.generatePlayerId();
                const sessionId = uuidv4();
                
                // Assign player to a dedicated server
                const server = await this.assignServerToPlayer(playerId, sessionId);
                
                // Create player session
                this.playerSessions.set(sessionId, {
                    serverId: server.id,
                    playerId: playerId,
                    lastActivity: Date.now(),
                    createdAt: Date.now()
                });

                console.log(`✅ Auto-assigned player ${playerId} to server ${server.id}`);
                
                // Redirect to the dedicated server with session info
                const redirectUrl = `${server.url}?sessionId=${sessionId}&playerId=${playerId}`;
                res.redirect(302, redirectUrl);
                
            } catch (error) {
                console.error('❌ Error assigning player to server:', error);
                // Fallback to persistent server
                res.redirect(302, `${this.persistentServer}?error=server_assignment_failed`);
            }
        });

        // Main landing page - Simple game entry
        this.app.get('/', (req, res) => {
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>🎮 Game Server Hub</title>
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            text-align: center; 
                            background: linear-gradient(135deg, #1e3c72, #2a5298);
                            color: white;
                            margin: 0;
                            padding: 50px;
                            min-height: 100vh;
                            display: flex;
                            flex-direction: column;
                            justify-content: center;
                        }
                        .container {
                            max-width: 600px;
                            margin: 0 auto;
                            background: rgba(255,255,255,0.1);
                            padding: 40px;
                            border-radius: 15px;
                            backdrop-filter: blur(10px);
                        }
                        h1 { color: #4CAF50; margin-bottom: 30px; }
                        .play-button {
                            display: inline-block;
                            background: linear-gradient(135deg, #4CAF50, #45a049);
                            color: white;
                            padding: 15px 30px;
                            text-decoration: none;
                            border-radius: 8px;
                            font-size: 18px;
                            font-weight: bold;
                            margin: 20px 10px;
                            transition: transform 0.3s;
                        }
                        .play-button:hover { transform: scale(1.05); }
                        .info { 
                            margin: 30px 0; 
                            opacity: 0.9; 
                            line-height: 1.6;
                        }
                        .stats {
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 20px;
                            margin: 30px 0;
                        }
                        .stat {
                            background: rgba(255,255,255,0.1);
                            padding: 15px;
                            border-radius: 8px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>🎮 Procedural Level Generator</h1>
                        <p class="info">
                            Welcome! Click below to join the game.<br>
                            <strong>You'll get your own dedicated server automatically!</strong>
                        </p>
                        
                        <a href="/game" class="play-button">🚀 Play Game</a>
                        <a href="/game?playerId=custom-${Date.now()}" class="play-button">🎯 Play with Custom ID</a>
                        
                        <div class="stats" id="stats">
                            <div class="stat">
                                <strong>Active Players</strong><br>
                                <span id="active-players">Loading...</span>
                            </div>
                            <div class="stat">
                                <strong>Available Servers</strong><br>
                                <span id="available-capacity">Loading...</span>
                            </div>
                        </div>
                        
                        <p class="info">
                            <small>
                                🔹 Each player gets their own server<br>
                                🔹 Servers auto-cleanup when not in use<br>
                                🔹 <a href="/api/servers" style="color: #4CAF50;">View Server Status</a> | 
                                <a href="http://localhost:3001" style="color: #4CAF50;" target="_blank">Monitoring Dashboard</a>
                            </small>
                        </p>
                    </div>
                    
                    <script>
                        // Update stats periodically
                        function updateStats() {
                            fetch('/api/capacity')
                                .then(r => r.json())
                                .then(data => {
                                    document.getElementById('active-players').textContent = data.activePlayers || 0;
                                    document.getElementById('available-capacity').textContent = 
                                        (data.totalCapacity - data.usedCapacity) + ' / ' + data.totalCapacity;
                                })
                                .catch(() => {
                                    document.getElementById('active-players').textContent = 'Unknown';
                                    document.getElementById('available-capacity').textContent = 'Unknown';
                                });
                        }
                        updateStats();
                        setInterval(updateStats, 5000);
                    </script>
                </body>
                </html>
            `);
        });

        // Session-aware proxy for game traffic
        this.app.use('/gameserver', async (req, res, next) => {
            try {
                const sessionId = req.headers['x-session-id'] || req.query.sessionId;
                
                if (sessionId && this.playerSessions.has(sessionId)) {
                    // Route to player's assigned server
                    const session = this.playerSessions.get(sessionId);
                    const server = this.servers.get(session.serverId);
                    
                    if (server && server.status === 'running') {
                        // Update activity
                        session.lastActivity = Date.now();
                        server.lastActivity = Date.now();
                        
                        // Proxy to the dedicated server
                        const proxy = createProxyMiddleware({
                            target: `http://procgen-auto-${session.serverId}:80`,
                            changeOrigin: true,
                            pathRewrite: { '^/gameserver': '' },
                            onError: (err, req, res) => {
                                console.error(`❌ Proxy error for server ${session.serverId}:`, err.message);
                                res.status(503).json({ error: 'Your dedicated server is unavailable' });
                            }
                        });
                        
                        proxy(req, res, next);
                        return;
                    }
                }
                
                // No valid session, redirect to get a new one
                res.redirect(302, '/game');
                
            } catch (error) {
                console.error('🚨 Game proxy error:', error);
                res.status(500).json({ error: 'Game server routing error' });
            }
        });
    }

    setupWebSocket() {
        this.wss.on('connection', (ws) => {
            console.log('📡 Admin dashboard connected');
            
            // Send initial data
            ws.send(JSON.stringify({
                type: 'initial',
                data: this.getServerStats()
            }));
            
            // Send updates every 2 seconds
            const interval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'update',
                        data: this.getServerStats()
                    }));
                }
            }, 2000);
            
            ws.on('close', () => {
                clearInterval(interval);
                console.log('📡 Admin dashboard disconnected');
            });
        });
    }

    generatePlayerId() {
        return `player-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    }

    async assignServerToPlayer(playerId, sessionId) {
        // Find a server with available capacity
        let availableServer = null;
        
        for (const [serverId, server] of this.servers.entries()) {
            if (server.status === 'running' && server.players.length < this.config.maxPlayersPerServer) {
                availableServer = server;
                availableServer.id = serverId;
                break;
            }
        }
        
        // If no available server or we want dedicated servers (maxPlayersPerServer = 1), create new one
        if (!availableServer || this.config.maxPlayersPerServer === 1) {
            if (this.servers.size >= this.config.maxServers) {
                throw new Error('Maximum server limit reached');
            }
            availableServer = await this.createNewServer();
        }
        
        // Add player to server
        availableServer.players.push({
            playerId: playerId,
            sessionId: sessionId,
            joinedAt: Date.now()
        });
        
        availableServer.lastActivity = Date.now();
        
        return {
            id: availableServer.id,
            url: `http://localhost:${availableServer.port}`
        };
    }

    async createNewServer() {
        const serverId = `auto-${Date.now()}`;
        const port = this.nextPort++;
        
        try {
            console.log(`🔄 Creating new server: ${serverId} on port ${port}`);
            
            const container = await this.docker.createContainer({
                Image: this.config.baseImage,
                name: `procgen-auto-${serverId}`,
                Env: [
                    `SERVER_ID=${serverId}`,
                    'SERVER_TYPE=auto-scaled',
                    'NODE_ENV=production'
                ],
                Labels: {
                    'autoscaler.managed': 'true',
                    'autoscaler.server_id': serverId,
                    'autoscaler.created_at': Date.now().toString()
                },
                HostConfig: {
                    PortBindings: {
                        '80/tcp': [{ HostPort: port.toString() }]
                    },
                    NetworkMode: 'gamemap-dockerized_procgen-cluster'
                }
            });

            await container.start();
            
            const serverData = {
                container,
                port,
                status: 'starting',
                lastActivity: Date.now(),
                createdAt: Date.now(),
                players: [],
                url: `http://procgen-auto-${serverId}:80`,
                id: serverId
            };
            
            this.servers.set(serverId, serverData);

            // Wait for server to be ready
            setTimeout(() => {
                if (this.servers.has(serverId)) {
                    this.servers.get(serverId).status = 'running';
                    console.log(`✅ Server ${serverId} is ready on port ${port}`);
                }
            }, 5000);

            return serverData;
            
        } catch (error) {
            console.error(`❌ Failed to create server ${serverId}:`, error);
            throw error;
        }
    }

    startPlayerSessionCleanup() {
        setInterval(() => {
            const now = Date.now();
            const sessionTimeout = 60000; // 1 minute timeout for inactive sessions
            
            for (const [sessionId, session] of this.playerSessions.entries()) {
                if (now - session.lastActivity > sessionTimeout) {
                    console.log(`🧹 Cleaning up inactive player session: ${sessionId}`);
                    
                    // Remove from server's player list
                    if (this.servers.has(session.serverId)) {
                        const server = this.servers.get(session.serverId);
                        server.players = server.players.filter(p => p.sessionId !== sessionId);
                    }
                    
                    // Remove session
                    this.playerSessions.delete(sessionId);
                }
            }
        }, 30000); // Check every 30 seconds
    }

    startMonitoring() {
        setInterval(() => {
            this.checkInactiveServers();
        }, 5000); // Check every 5 seconds
    }

    async checkInactiveServers() {
        const now = Date.now();
        
        for (const [serverId, server] of this.servers.entries()) {
            const inactiveTime = now - server.lastActivity;
            
            // Only shutdown servers with no active players
            if (server.status === 'running' && 
                server.players.length === 0 && 
                inactiveTime > this.config.inactivityShutdown * 1000) {
                
                console.log(`⏸️ Shutting down empty server: ${serverId} (inactive for ${Math.floor(inactiveTime/1000)}s)`);
                server.status = 'shutting-down';
                server.shutdownAt = now;
                
                try {
                    await server.container.stop();
                } catch (error) {
                    console.error(`❌ Error stopping ${serverId}:`, error);
                }
            }
            
            // Delete after cleanup period
            if (server.status === 'shutting-down' && 
                server.shutdownAt && 
                (now - server.shutdownAt) > this.config.cleanupDelete * 1000) {
                
                console.log(`🗑️ Deleting server container: ${serverId}`);
                
                try {
                    await server.container.remove({ force: true });
                    this.servers.delete(serverId);
                    console.log(`✅ Server ${serverId} cleaned up`);
                } catch (error) {
                    console.error(`❌ Error deleting ${serverId}:`, error);
                }
            }
        }
    }

    getServerStats() {
        const totalActivePlayers = this.playerSessions.size;
        const totalCapacity = this.servers.size * this.config.maxPlayersPerServer;
        
        return {
            persistent: { id: 1, url: this.persistentServer, status: 'running' },
            autoScaled: Array.from(this.servers.entries()).map(([id, server]) => ({
                id,
                port: server.port,
                status: server.status,
                lastActivity: server.lastActivity,
                uptime: Date.now() - server.createdAt,
                inactiveTime: Date.now() - server.lastActivity,
                playerCount: server.players.length,
                players: server.players,
                maxPlayers: this.config.maxPlayersPerServer
            })),
            playerMetrics: {
                totalActivePlayers: totalActivePlayers,
                totalServers: this.servers.size + 1, // +1 for persistent
                autoScaledServers: this.servers.size,
                totalCapacity: totalCapacity,
                availableCapacity: totalCapacity - totalActivePlayers,
                utilizationPercent: totalCapacity > 0 ? (totalActivePlayers / totalCapacity * 100).toFixed(2) : 0
            },
            config: this.config,
            timestamp: Date.now()
        };
    }
}

// Start the autoscaler
const autoscaler = new GameServerAutoscaler();

autoscaler.app.listen(3000, () => {
    console.log('🎯 Load Balancer running on port 3000');
    console.log('📊 Admin API running on port 8090');
    console.log('🎮 Game access: http://localhost:80');
    console.log('📈 Admin dashboard: ws://localhost:8090');
});