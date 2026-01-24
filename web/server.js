const express = require('express');
const path = require('path');
const authMiddleware = require('./middleware/auth');
const messagesRouter = require('./routes/messages');
const winnersRouter = require('./routes/winners');
const herokuRouter = require('./routes/heroku');

// Load .env from parent directory
const envPath = path.join(__dirname, '..', '.env');
require('dotenv').config({ path: envPath });

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
app.use('/api/winners', authMiddleware, winnersRouter);
app.use('/api/heroku', authMiddleware, herokuRouter);

// Health check for Heroku
app.get('/', (req, res) => {
    res.send('Perky Pugs Bot Admin - Running');
});

app.listen(PORT, () => {
    console.log(`Admin panel running on port ${PORT}`);
    console.log(`Access at: http://localhost:${PORT}/admin`);
});
