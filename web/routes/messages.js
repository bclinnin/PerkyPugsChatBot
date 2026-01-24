const express = require('express');
const router = express.Router();
const { connectDatabase } = require('../database/db');

// Get all messages
router.get('/', async (req, res) => {
    let client;
    try {
        client = await connectDatabase();
        const result = await client.query(
            'SELECT * FROM cannedmessages ORDER BY displayorder ASC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    } finally {
        if (client) await client.end();
    }
});

// Add new message
router.post('/', async (req, res) => {
    const { messagetext } = req.body;
    
    if (!messagetext || messagetext.trim().length === 0) {
        return res.status(400).json({ error: 'Message text is required' });
    }
    
    if (messagetext.length > 500) {
        return res.status(400).json({ 
            error: `Message too long (${messagetext.length} chars). Max 500 characters.` 
        });
    }
    
    let client;
    try {
        client = await connectDatabase();
        
        // Get next order number
        const maxResult = await client.query(
            'SELECT COALESCE(MAX(displayorder), 0) + 1 as nextorder FROM cannedmessages'
        );
        const displayorder = maxResult.rows[0].nextorder;
        
        const result = await client.query(
            'INSERT INTO cannedmessages (messagetext, displayorder) VALUES ($1, $2) RETURNING *',
            [messagetext, displayorder]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error adding message:', error);
        res.status(500).json({ error: 'Failed to add message' });
    } finally {
        if (client) await client.end();
    }
});

// Update message
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { messagetext, enabled } = req.body;
    
    if (messagetext !== undefined && messagetext.length > 500) {
        return res.status(400).json({ 
            error: `Message too long (${messagetext.length} chars). Max 500 characters.` 
        });
    }
    
    let client;
    try {
        client = await connectDatabase();
        
        const updates = [];
        const values = [];
        let paramCount = 1;
        
        if (messagetext !== undefined) {
            updates.push(`messagetext = $${paramCount++}`);
            values.push(messagetext);
        }
        
        if (enabled !== undefined) {
            updates.push(`enabled = $${paramCount++}`);
            values.push(enabled);
        }
        
        updates.push(`updatedat = CURRENT_TIMESTAMP`);
        values.push(id);
        
        const query = `
            UPDATE cannedmessages 
            SET ${updates.join(', ')}
            WHERE messageid = $${paramCount}
            RETURNING *
        `;
        
        const result = await client.query(query, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating message:', error);
        res.status(500).json({ error: 'Failed to update message' });
    } finally {
        if (client) await client.end();
    }
});

// Delete message (soft delete by setting enabled = false)
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    
    let client;
    try {
        client = await connectDatabase();
        const result = await client.query(
            'UPDATE cannedmessages SET enabled = false WHERE messageid = $1 RETURNING *',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    } finally {
        if (client) await client.end();
    }
});

module.exports = router;
