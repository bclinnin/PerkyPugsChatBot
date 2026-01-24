const express = require('express');
const path = require('path');
const authMiddleware = require('./middleware/auth');
const messagesRouter = require('./routes/messages');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Authentication middleware for admin routes
app.use('/admin', authMiddleware);

// Serve static files
app.use('/admin', express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/messages', authMiddleware, messagesRouter);

// Health check for Heroku
app.get('/', (req, res) => {
    res.send('Perky Pugs Bot Admin - Running');
});

app.listen(PORT, () => {
    console.log(`Admin panel running on port ${PORT}`);
    console.log(`Access at: http://localhost:${PORT}/admin`);
});
