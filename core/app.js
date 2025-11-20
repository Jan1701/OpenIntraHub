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
app.get('/', (req, res) => res.send('OpenIntraHub Core is running 🟢'));
app.post('/api/auth/login', auth.login);
app.get('/api/core/status', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

// Module System starten
const loader = new ModuleLoader(app, eventBus);
loader.loadModules();

// Server Start
app.listen(PORT, () => {
    console.log(`
    ┌────────────────────────────────────────┐
    │  OpenIntraHub Core running on :${PORT}   │
    └────────────────────────────────────────┘
    `);
});
