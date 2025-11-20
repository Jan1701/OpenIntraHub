require('dotenv').config();
const express = require('express');
const cors = require('cors');
const ModuleLoader = require('./moduleLoader');
const eventBus = require('./eventBus');
const auth = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Core Routes
app.get('/', (req, res) => res.send('OpenIntraHub Core is running'));
app.post('/api/auth/login', auth.login);
app.get('/api/core/status', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

// Module System starten
const loader = new ModuleLoader(app, eventBus);
loader.loadModules();

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint nicht gefunden' });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('[Error]', err.stack);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Interner Serverfehler'
            : err.message
    });
});

// Server Start
app.listen(PORT, () => {
    console.log(`
    ┌────────────────────────────────────────┐
    │  OpenIntraHub Core running on :${PORT}   │
    └────────────────────────────────────────┘
    `);
});
