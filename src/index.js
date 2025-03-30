const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');
const https = require('https');
const fs = require('fs');
const config = require('./config/config');
const mediaRoutes = require('./routes/mediaRoutes');
const indexRoutes = require('./routes/index');
const databaseService = require('./services/databaseService');
const mediaService = require('./services/mediaService');

// Initialize express app
const app = express();

// Security headers configuration
app.use(helmet({
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            mediaSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"],
            frameAncestors: ["'none'"]
        }
    }
}));

// Middleware
app.use(compression()); // Compress responses
app.use(express.json()); // Parse JSON bodies
app.use(express.static(path.join(__dirname, '../public'))); // Serve static files

// CORS configuration
if (config.corsEnabled) {
    app.use(cors({
        origin: config.corsOrigins,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
        maxAge: 86400 // 24 hours
    }));
}

// Routes
app.use('/', indexRoutes);
app.use('/api/media', mediaRoutes); // Updated to use /api/media prefix

// Basic health check route
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Initialize services and start server
async function startServer() {
    try {
        // Initialize database
        await databaseService.initialize();
        console.log('Database initialized successfully');

        // Initialize media service (this will scan directories and populate the database)
        await mediaService.initialize();
        console.log('Media service initialized successfully');

        // SSL configuration
        const sslOptions = {
            key: fs.readFileSync(config.sslKeyPath),
            cert: fs.readFileSync(config.sslCertPath)
        };

        // Create HTTPS server
        const server = https.createServer(sslOptions, app);
        
        // Start server
        server.listen(config.port, config.host, () => {
            console.log(`HTTPS Server running at https://${config.host}:${config.port}`);
            console.log(`Media directories: ${config.mediaDirectories.join(', ')}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer(); 