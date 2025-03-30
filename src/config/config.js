require('dotenv').config();

module.exports = {
    // Server configuration
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',

    // SSL configuration
    sslKeyPath: process.env.SSL_KEY_PATH || '/etc/ssl/media-viewer/privkey.pem',
    sslCertPath: process.env.SSL_CERT_PATH || '/etc/ssl/media-viewer/fullchain.pem',

    // Media directories to scan
    mediaDirectories: [
        process.env.MEDIA_DIR || '/home/pi/Media'
    ],

    // File type filters
    allowedImageTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    allowedVideoTypes: ['mp4', 'webm', 'mov'],

    // Cache settings
    cacheEnabled: true,
    cacheDuration: 3600, // 1 hour in seconds

    // Security settings
    corsEnabled: true,
    corsOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'https://localhost:3000'],

    // Performance settings
    maxFileSize: 100 * 1024 * 1024, // 100MB
    thumbnailSize: {
        width: 200,
        height: 200
    },

    // Logging
    logLevel: process.env.LOG_LEVEL || 'info'
}; 