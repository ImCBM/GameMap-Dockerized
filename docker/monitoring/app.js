const express = require('express');
const WebSocket = require('ws');
const axios = require('axios');
const path = require('path');

const app = express();
const port = 3000;

// Serve static files
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

// API endpoint for server stats
app.get('/api/stats', async (req, res) => {
    try {
        const loadbalancerUrl = process.env.LOADBALANCER_URL || 'http://smart-loadbalancer:8090';
        const response = await axios.get(`${loadbalancerUrl.replace(':8090', ':3000')}/api/servers`);
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching stats:', error.message);
        res.status(500).json({ error: 'Unable to fetch server stats' });
    }
});

// Serve the dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`📊 Monitoring Dashboard running on port ${port}`);
    console.log(`🔗 Dashboard: http://localhost:${port}`);
});