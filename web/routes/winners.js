const express = require('express');
const router = express.Router();
const { connectDatabase } = require('../database/db');

// Get all winners
router.get('/', async (req, res) => {
    let client;
    try {
        client = await connectDatabase();
        const result = await client.query(`
            SELECT 
                winid,
                twitchname,
                realm,
                charactername,
                realmcharactercombo,
                windate
            FROM dimensiuswinners
            ORDER BY windate DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching winners:', error);
        res.status(500).json({ error: 'Failed to fetch winners' });
    } finally {
        if (client) await client.end();
    }
});

module.exports = router;
