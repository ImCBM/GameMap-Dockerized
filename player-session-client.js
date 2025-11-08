/**
 * Player Session Client - Integration example for Player-Dedicated Servers
 * 
 * This module demonstrates how to integrate with the player-dedicated server system.
 * Include this in your game client to automatically get assigned to a dedicated server.
 */

class PlayerSessionClient {
    constructor(loadBalancerUrl = 'http://localhost') {
        this.loadBalancerUrl = loadBalancerUrl;
        this.sessionId = null;
        this.playerId = null;
        this.serverUrl = null;
        this.serverId = null;
        this.heartbeatInterval = null;
        this.connected = false;
    }

    /**
     * Join the game and get assigned to a dedicated server
     * @param {string} [playerId] - Optional player ID (will generate one if not provided)
     * @returns {Promise<object>} Server assignment result
     */
    async joinGame(playerId = null) {
        try {
            console.log('🎮 Requesting dedicated server assignment...');
            
            const response = await fetch(`${this.loadBalancerUrl}/api/player/join`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    playerId: playerId
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to join game: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.success) {
                this.sessionId = result.sessionId;
                this.playerId = result.playerId;
                this.serverUrl = result.serverUrl;
                this.serverId = result.serverId;
                this.connected = true;

                console.log(`✅ Assigned to dedicated server ${this.serverId}`);
                console.log(`🔗 Server URL: ${this.serverUrl}`);
                console.log(`👤 Player ID: ${this.playerId}`);
                console.log(`🎫 Session ID: ${this.sessionId}`);

                // Start sending heartbeats
                this.startHeartbeat();

                return result;
            } else {
                throw new Error(result.error || 'Failed to join game');
            }
        } catch (error) {
            console.error('❌ Error joining game:', error);
            throw error;
        }
    }

    /**
     * Leave the game and clean up server resources
     */
    async leaveGame() {
        if (!this.connected || !this.sessionId) {
            console.log('⚠️ Not connected to any server');
            return;
        }

        try {
            console.log('👋 Leaving game and cleaning up server resources...');
            
            // Stop heartbeat
            this.stopHeartbeat();

            // Notify server of departure
            const response = await fetch(`${this.loadBalancerUrl}/api/player/leave`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.sessionId
                })
            });

            if (response.ok) {
                console.log(`✅ Successfully left server ${this.serverId}`);
            } else {
                console.warn('⚠️ Error notifying server of departure');
            }

        } catch (error) {
            console.error('❌ Error leaving game:', error);
        } finally {
            // Clean up local state
            this.sessionId = null;
            this.playerId = null;
            this.serverUrl = null;
            this.serverId = null;
            this.connected = false;
        }
    }

    /**
     * Get the dedicated server URL for game connections
     * @returns {string|null} Server URL or null if not connected
     */
    getServerUrl() {
        return this.serverUrl;
    }

    /**
     * Get session headers for HTTP requests to your dedicated server
     * @returns {object} Headers object with session information
     */
    getSessionHeaders() {
        return {
            'X-Session-ID': this.sessionId,
            'X-Player-ID': this.playerId
        };
    }

    /**
     * Start sending heartbeats to keep the server alive
     * @private
     */
    startHeartbeat() {
        // Send heartbeat every 5 seconds
        this.heartbeatInterval = setInterval(async () => {
            try {
                await fetch(`${this.loadBalancerUrl}/api/player/heartbeat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        sessionId: this.sessionId
                    })
                });
            } catch (error) {
                console.warn('⚠️ Heartbeat failed:', error);
            }
        }, 5000);

        console.log('💓 Started heartbeat (5s interval)');
    }

    /**
     * Stop sending heartbeats
     * @private
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            console.log('💓 Stopped heartbeat');
        }
    }

    /**
     * Get current session information
     * @returns {object|null} Session info or null if not connected
     */
    getSessionInfo() {
        if (!this.connected) {
            return null;
        }

        return {
            sessionId: this.sessionId,
            playerId: this.playerId,
            serverUrl: this.serverUrl,
            serverId: this.serverId,
            connected: this.connected
        };
    }

    /**
     * Check if currently connected to a dedicated server
     * @returns {boolean} Connection status
     */
    isConnected() {
        return this.connected;
    }
}

// Example usage:
/*
// Initialize the client
const playerSession = new PlayerSessionClient('http://localhost');

// Join the game (gets assigned to a dedicated server)
playerSession.joinGame().then(result => {
    console.log('Joined game:', result);
    
    // Now you can use the dedicated server
    const serverUrl = playerSession.getServerUrl();
    const headers = playerSession.getSessionHeaders();
    
    // Example: Load game content from your dedicated server
    fetch(`${serverUrl}/game-data`, { headers })
        .then(response => response.json())
        .then(data => console.log('Game data:', data));
        
}).catch(error => {
    console.error('Failed to join game:', error);
});

// When player closes the game/tab, clean up
window.addEventListener('beforeunload', () => {
    playerSession.leaveGame();
});

// For manual disconnect
document.getElementById('leave-button').addEventListener('click', () => {
    playerSession.leaveGame();
});
*/

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlayerSessionClient;
}

// Also make available globally
if (typeof window !== 'undefined') {
    window.PlayerSessionClient = PlayerSessionClient;
}