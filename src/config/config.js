require('dotenv').config();

module.exports = {
    // Server configuration
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',

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
    corsOrigins: ['*'], // Allow all origins in development

    // Performance settings
    maxFileSize: 100 * 1024 * 1024, // 100MB
    thumbnailSize: {
        width: 200,
        height: 200
    },

    // Logging
    logLevel: process.env.LOG_LEVEL || 'info'
}; 