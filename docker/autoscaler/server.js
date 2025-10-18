const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const Docker = require('dockerode');
const WebSocket = require('ws');
const axios = require('axios');

class GameServerAutoscaler {
    constructor() {
        this.docker = new Docker();
        this.app = express();
        this.wss = new WebSocket.Server({ port: 8090 });
        
        // Server management
        this.servers = new Map(); // serverId -> { container, lastActivity, port, status }
        this.nextPort = parseInt(process.env.SERVER_PORT_START) || 8081;
        this.persistentServer = process.env.PERSISTENT_SERVER_URL || 'http://procgen-server-1:80';
        
        // Configuration
        this.config = {
            minServers: parseInt(process.env.MIN_SERVERS) || 1,
            maxServers: parseInt(process.env.MAX_SERVERS) || 10,
            inactivityShutdown: parseInt(process.env.INACTIVITY_SHUTDOWN) || 10, // seconds
            cleanupDelete: parseInt(process.env.CLEANUP_DELETE) || 30, // seconds
            baseImage: process.env.BASE_IMAGE || 'procgen-phaser:latest'
        };
        
        this.setupRoutes();
        this.setupWebSocket();
        this.startMonitoring();
        
        console.log('🚀 Smart Load Balancer Started');
        console.log('📊 Config:', this.config);
    }

    setupRoutes() {
        this.app.use(express.json());
        
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                servers: this.servers.size,
                persistent: true 
            });
        });

        // Admin API
        this.app.get('/api/servers', (req, res) => {
            const serverList = Array.from(this.servers.entries()).map(([id, server]) => ({
                id,
                port: server.port,
                status: server.status,
                lastActivity: server.lastActivity,
                uptime: Date.now() - server.createdAt
            }));
            
            res.json({
                persistentServer: { id: 1, url: this.persistentServer, status: 'persistent' },
                autoScaledServers: serverList,
                totalServers: serverList.length + 1
            });
        });

        // Main game proxy - intelligent routing
        this.app.use('/', async (req, res, next) => {
            try {
                const targetServer = await this.getOptimalServer();
                this.recordActivity(targetServer);
                
                // Proxy to the selected server
                const proxy = createProxyMiddleware({
                    target: targetServer.url,
                    changeOrigin: true,
                    onError: (err, req, res) => {
                        console.error(`❌ Proxy error for ${targetServer.id}:`, err.message);
                        res.status(503).json({ error: 'Game server unavailable' });
                    }
                });
                
                proxy(req, res, next);
            } catch (error) {
                console.error('🚨 Routing error:', error);
                res.status(500).json({ error: 'Load balancer error' });
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

    async getOptimalServer() {
        // Check if we need to scale up
        const activeServers = Array.from(this.servers.values()).filter(s => s.status === 'running');
        
        // If no auto-scaled servers or all are busy, consider scaling
        if (activeServers.length === 0 || this.shouldScaleUp()) {
            if (this.servers.size < this.config.maxServers) {
                await this.createNewServer();
            }
        }
        
        // Always return persistent server for now (can be enhanced with real load balancing)
        return { 
            id: 1, 
            url: this.persistentServer,
            type: 'persistent'
        };
    }

    shouldScaleUp() {
        // Simple logic: scale up if we have demand (can be enhanced)
        // For demo, we'll create servers on demand
        return true;
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
                    NetworkMode: 'tsprocgentest_procgen-cluster'
                }
            });

            await container.start();
            
            this.servers.set(serverId, {
                container,
                port,
                status: 'starting',
                lastActivity: Date.now(),
                createdAt: Date.now(),
                url: `http://procgen-auto-${serverId}:80`
            });

            // Wait for server to be ready
            setTimeout(() => {
                if (this.servers.has(serverId)) {
                    this.servers.get(serverId).status = 'running';
                    console.log(`✅ Server ${serverId} is ready on port ${port}`);
                }
            }, 5000);

            return { id: serverId, port, url: `http://localhost:${port}` };
            
        } catch (error) {
            console.error(`❌ Failed to create server ${serverId}:`, error);
            throw error;
        }
    }

    recordActivity(server) {
        if (server.type !== 'persistent' && this.servers.has(server.id)) {
            this.servers.get(server.id).lastActivity = Date.now();
        }
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
            
            // Mark for shutdown after inactivity period
            if (server.status === 'running' && inactiveTime > this.config.inactivityShutdown * 1000) {
                console.log(`⏸️ Shutting down inactive server: ${serverId}`);
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
        return {
            persistent: { id: 1, url: this.persistentServer, status: 'running' },
            autoScaled: Array.from(this.servers.entries()).map(([id, server]) => ({
                id,
                port: server.port,
                status: server.status,
                lastActivity: server.lastActivity,
                uptime: Date.now() - server.createdAt,
                inactiveTime: Date.now() - server.lastActivity
            })),
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