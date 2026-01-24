const express = require('express');
const router = express.Router();
const axios = require('axios');

const HEROKU_API_BASE = 'https://api.heroku.com';

// Middleware to check Heroku API configuration
function checkHerokuConfig(req, res, next) {
    const HEROKU_API_TOKEN = process.env.HEROKU_API_TOKEN;
    const HEROKU_APP_NAME = process.env.HEROKU_APP_NAME;
    
    if (!HEROKU_API_TOKEN || !HEROKU_APP_NAME) {
        return res.status(503).json({ 
            error: 'Heroku API not configured',
            message: 'HEROKU_API_TOKEN and HEROKU_APP_NAME must be set'
        });
    }
    next();
}

router.use(checkHerokuConfig);

// Helper function to make Heroku API calls
async function herokuApiCall(method, path, data = null) {
    try {
        const config = {
            method,
            url: `${HEROKU_API_BASE}${path}`,
            headers: {
                'Authorization': `Bearer ${process.env.HEROKU_API_TOKEN}`,
                'Accept': 'application/vnd.heroku+json; version=3'
            }
        };
        
        // Only add Content-Type and data for methods that expect a body
        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            config.headers['Content-Type'] = 'application/json';
            config.data = data;
        }
        
        const response = await axios(config);
        return response.data;
    } catch (error) {
        console.error('Heroku API Error:', error.response?.data || error.message);
        throw error;
    }
}

// GET /api/heroku/worker/status - Check worker dyno status
router.get('/worker/status', async (req, res) => {
    try {
        // Get all dynos for the app
        const dynos = await herokuApiCall('GET', `/apps/${process.env.HEROKU_APP_NAME}/dynos`);
        
        // Find worker dyno
        const worker = dynos.find(d => d.type === 'worker');
        
        if (!worker) {
            // Worker is scaled to 0 (stopped)
            return res.json({
                status: 'stopped',
                type: 'worker',
                message: 'Worker is not running'
            });
        }
        
        // Calculate uptime
        const createdAt = new Date(worker.created_at);
        const now = new Date();
        const uptimeSeconds = Math.floor((now - createdAt) / 1000);
        
        res.json({
            status: worker.state === 'up' ? 'running' : worker.state,
            type: worker.type,
            size: worker.size,
            created_at: worker.created_at,
            uptime_seconds: uptimeSeconds
        });
    } catch (error) {
        console.error('Error fetching worker status:', error);
        res.status(500).json({ 
            error: 'Failed to fetch worker status',
            message: error.response?.data?.message || error.message
        });
    }
});

// POST /api/heroku/worker/start - Start worker dyno
router.post('/worker/start', async (req, res) => {
    try {
        // Scale worker to 1
        await herokuApiCall('PATCH', `/apps/${process.env.HEROKU_APP_NAME}/formation/worker`, {
            quantity: 1
        });
        
        res.json({
            success: true,
            message: 'Worker started successfully'
        });
    } catch (error) {
        console.error('Error starting worker:', error);
        res.status(500).json({ 
            error: 'Failed to start worker',
            message: error.response?.data?.message || error.message
        });
    }
});

// POST /api/heroku/worker/restart - Restart worker dyno
router.post('/worker/restart', async (req, res) => {
    try {
        // Get current dynos to find worker
        const dynos = await herokuApiCall('GET', `/apps/${process.env.HEROKU_APP_NAME}/dynos`);
        const worker = dynos.find(d => d.type === 'worker');
        
        if (!worker) {
            return res.status(400).json({ 
                error: 'Worker is not running',
                message: 'Cannot restart a stopped worker. Use start instead.'
            });
        }
        
        // Delete the worker dyno to restart it
        await herokuApiCall('DELETE', `/apps/${process.env.HEROKU_APP_NAME}/dynos/${worker.name}`);
        
        res.json({
            success: true,
            message: 'Worker restarted successfully'
        });
    } catch (error) {
        console.error('Error restarting worker:', error);
        res.status(500).json({ 
            error: 'Failed to restart worker',
            message: error.response?.data?.message || error.message
        });
    }
});

// GET /api/heroku/config/channel - Get TWITCH_CHANNEL_NAME config var
router.get('/config/channel', async (req, res) => {
    try {
        const config = await herokuApiCall('GET', `/apps/${process.env.HEROKU_APP_NAME}/config-vars`);
        
        res.json({
            channel: config.TWITCH_CHANNEL_NAME || config.TWITCH_CHANNEL || ''
        });
    } catch (error) {
        console.error('Error fetching Twitch channel:', error);
        res.status(500).json({ 
            error: 'Failed to fetch Twitch channel',
            message: error.response?.data?.message || error.message
        });
    }
});

// PATCH /api/heroku/config/channel - Update TWITCH_CHANNEL_NAME config var
router.patch('/config/channel', async (req, res) => {
    try {
        const { channel } = req.body;
        
        if (!channel || typeof channel !== 'string') {
            return res.status(400).json({ 
                error: 'Invalid channel name',
                message: 'Channel name is required and must be a string'
            });
        }
        
        // Validate channel name (basic validation)
        const trimmedChannel = channel.trim();
        if (trimmedChannel.length === 0) {
            return res.status(400).json({ 
                error: 'Invalid channel name',
                message: 'Channel name cannot be empty'
            });
        }
        
        // Update config var (use TWITCH_CHANNEL_NAME to match bot's expected variable)
        await herokuApiCall('PATCH', `/apps/${process.env.HEROKU_APP_NAME}/config-vars`, {
            TWITCH_CHANNEL_NAME: trimmedChannel
        });
        
        res.json({
            success: true,
            message: 'Twitch channel updated successfully',
            channel: trimmedChannel,
            warning: 'Web server and running worker will restart'
        });
    } catch (error) {
        console.error('Error updating Twitch channel:', error);
        res.status(500).json({ 
            error: 'Failed to update Twitch channel',
            message: error.response?.data?.message || error.message
        });
    }
});

module.exports = router;
