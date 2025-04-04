const express = require('express');
const router = express.Router();
const mediaService = require('../services/mediaService');
const databaseService = require('../services/databaseService');
const path = require('path');
const config = require('../config/config');
const crypto = require('crypto');
const fs = require('fs');

// Generate a random nonce for CSP
function generateNonce() {
    return crypto.randomBytes(16).toString('base64');
}

// Route to serve media files
router.get('/media/:filePath(*)', async (req, res) => {
    const requestId = crypto.randomBytes(8).toString('hex');
    console.log(`[${requestId}] Starting media file request`);
    
    try {
        const filePath = decodeURIComponent(req.params.filePath);
        console.log(`[${requestId}] Requested media file:`, filePath);

        // Validate file path
        if (!filePath || filePath.trim() === '') {
            console.error(`[${requestId}] Invalid file path provided`);
            return res.status(400).json({
                error: 'Invalid file path',
                requestId
            });
        }

        // Query the database for the specific file
        const file = await new Promise((resolve, reject) => {
            databaseService.db.get(
                'SELECT * FROM media_files WHERE path = ?',
                [filePath],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!file) {
            console.error(`[${requestId}] File not found in database:`, filePath);
            return res.status(404).json({
                error: 'File not found in database',
                requestId
            });
        }

        // Parse metadata
        file.metadata = JSON.parse(file.metadata || '{}');

        console.log(`[${requestId}] Found file in database:`, {
            name: file.name,
            type: file.type,
            size: file.size
        });

        // Ensure we're using an absolute path
        const absolutePath = path.resolve(file.path);
        console.log(`[${requestId}] Resolved absolute path:`, absolutePath);
        
        // Basic security check to ensure the file is within allowed directories
        const isAllowedPath = config.mediaDirectories.some(dir => 
            absolutePath.startsWith(path.resolve(dir))
        );

        if (!isAllowedPath) {
            console.error(`[${requestId}] Access denied - File outside allowed directories:`, {
                path: absolutePath,
                allowedDirs: config.mediaDirectories
            });
            return res.status(403).json({
                error: 'Access denied - File outside allowed directories',
                requestId
            });
        }

        // Check if file exists on disk
        try {
            console.log(`[${requestId}] Checking file existence on disk`);
            await fs.promises.access(absolutePath);
            console.log(`[${requestId}] File exists on disk, serving:`, absolutePath);
            
            // Get file stats for additional validation
            const stats = await fs.promises.stat(absolutePath);
            console.log(`[${requestId}] File stats:`, {
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime
            });

            // Validate file size matches database
            if (stats.size !== file.size) {
                console.warn(`[${requestId}] File size mismatch:`, {
                    databaseSize: file.size,
                    actualSize: stats.size
                });
            }
            
            // Set appropriate content type
            const ext = path.extname(absolutePath).toLowerCase();
            const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                           ext === '.png' ? 'image/png' :
                           ext === '.gif' ? 'image/gif' :
                           ext === '.mp4' ? 'video/mp4' :
                           ext === '.webm' ? 'video/webm' :
                           'application/octet-stream';
            
            console.log(`[${requestId}] Setting content type:`, mimeType);
            res.setHeader('Content-Type', mimeType);
            
            // Add cache control headers
            res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
            res.setHeader('ETag', `"${stats.size}-${stats.mtime.getTime()}"`);

            // Handle range requests for video streaming
            const range = req.headers.range;
            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
                const chunksize = (end - start) + 1;

                // Validate range request
                if (start >= stats.size || end >= stats.size) {
                    return res.status(416).json({
                        error: 'Range not satisfiable',
                        requestId
                    });
                }

                // Set streaming headers
                const head = {
                    'Content-Range': `bytes ${start}-${end}/${stats.size}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': mimeType,
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                };
                
                res.writeHead(206, head);
                
                // Create read stream with optimized settings
                const file = fs.createReadStream(absolutePath, {
                    start,
                    end,
                    highWaterMark: 64 * 1024, // 64KB chunks for better memory management
                    autoClose: true
                });
                
                file.on('error', (error) => {
                    console.error(`[${requestId}] Error streaming file chunk:`, error);
                    if (!res.headersSent) {
                        res.status(500).json({
                            error: 'Error streaming file chunk',
                            requestId
                        });
                    }
                });

                // Handle client disconnect
                req.on('close', () => {
                    console.log(`[${requestId}] Client disconnected, cleaning up`);
                    file.destroy();
                });

                // Pipe with error handling
                file.pipe(res, { end: true });
            } else {
                // For non-range requests, stream the entire file with optimized settings
                const fileStream = fs.createReadStream(absolutePath, {
                    highWaterMark: 64 * 1024, // 64KB chunks
                    autoClose: true
                });
                
                fileStream.on('error', (error) => {
                    console.error(`[${requestId}] Error streaming file:`, error);
                    if (!res.headersSent) {
                        res.status(500).json({
                            error: 'Error streaming file',
                            requestId
                        });
                    }
                });

                // Handle client disconnect
                req.on('close', () => {
                    console.log(`[${requestId}] Client disconnected, cleaning up`);
                    fileStream.destroy();
                });

                // Pipe with error handling
                fileStream.pipe(res, { end: true });
            }
            
        } catch (error) {
            console.error(`[${requestId}] File not found on disk:`, {
                path: absolutePath,
                error: error.message,
                code: error.code
            });
            return res.status(404).json({
                error: 'File not found on disk',
                path: absolutePath,
                requestId
            });
        }
    } catch (error) {
        console.error(`[${requestId}] Error serving media file:`, {
            error: error.message,
            stack: error.stack
        });
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Failed to serve media file',
                message: error.message,
                requestId
            });
        }
    }
});

// API endpoint to get media items with pagination and filtering
router.get('/api/media', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const itemsPerPage = parseInt(req.query.itemsPerPage) || 20;
        const search = req.query.search || '';
        const type = req.query.type || '';
        const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;
        const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : null;
        const hasLocation = req.query.hasLocation === 'true';

        console.log('API request received:', {
            page,
            itemsPerPage,
            search,
            type,
            dateFrom,
            dateTo,
            hasLocation
        });

        // Pass all parameters to databaseService
        const mediaData = await databaseService.loadMediaFiles(page, itemsPerPage, {
            search,
            type,
            dateFrom,
            dateTo,
            hasLocation
        });

        // Add folder information to each item
        const itemsWithFolder = mediaData.items.map(item => {
            const dirPath = path.dirname(item.path);
            const folderName = path.basename(dirPath);
            
            return {
                ...item,
                folder: folderName || 'Root',
                directory: dirPath
            };
        });

        console.log('Sending response:', {
            totalItems: mediaData.totalItems,
            currentPage: mediaData.currentPage,
            totalPages: mediaData.totalPages,
            itemsCount: itemsWithFolder.length
        });

        res.json({
            totalItems: mediaData.totalItems,
            currentPage: mediaData.currentPage,
            totalPages: mediaData.totalPages,
            items: itemsWithFolder,
            hasMore: mediaData.hasMore
        });
    } catch (error) {
        console.error('Error in /api/media:', error);
        res.status(500).json({
            error: 'Failed to fetch media items',
            message: error.message
        });
    }
});

router.get('/', async (req, res) => {
    try {
        const overview = await databaseService.getMediaOverview();
        
        // Format dates for display
        if (overview.stats.oldestFile) {
            overview.stats.oldestFile = new Date(overview.stats.oldestFile).toISOString();
        }
        if (overview.stats.newestFile) {
            overview.stats.newestFile = new Date(overview.stats.newestFile).toISOString();
        }

        // Format file sizes
        overview.stats.totalSizeFormatted = formatFileSize(overview.stats.totalSize);
        overview.stats.averageFileSizeFormatted = formatFileSize(overview.stats.averageFileSize);

        // Generate nonce for CSP
        const nonce = generateNonce();

        // Generate HTML response
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Media Viewer</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="stylesheet" href="/css/media-viewer.css">
                <meta http-equiv="Content-Security-Policy" content="
                    default-src 'self';
                    script-src 'self' 'nonce-${nonce}';
                    style-src 'self' 'unsafe-inline';
                    img-src 'self' data: blob:;
                    media-src 'self' data: blob:;
                    connect-src 'self';
                    font-src 'self';
                ">
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Media Viewer</h1>
                        <div class="stats-grid">
                            <div class="stat-card">
                                <h3>Total Items</h3>
                                <p>${overview.totalItems}</p>
                            </div>
                            <div class="stat-card">
                                <h3>Total Storage</h3>
                                <p>${overview.stats.totalSizeFormatted}</p>
                            </div>
                            <div class="stat-card">
                                <h3>Average File Size</h3>
                                <p>${overview.stats.averageFileSizeFormatted}</p>
                            </div>
                            <div class="stat-card">
                                <h3>Date Range</h3>
                                <p>${new Date(overview.stats.oldestFile).toLocaleDateString()} - ${new Date(overview.stats.newestFile).toLocaleDateString()}</p>
                            </div>
                        </div>
                    </div>

                    <div class="filters">
                        <input type="text" id="search" class="filter-input" placeholder="Search files...">
                        <select id="type" class="filter-select">
                            <option value="">All Types</option>
                            <option value="image">Images</option>
                            <option value="video">Videos</option>
                        </select>
                        <input type="date" id="dateFrom" class="filter-input">
                        <input type="date" id="dateTo" class="filter-input">
                        <label class="filter-checkbox">
                            <input type="checkbox" id="hasLocation">
                            With Location
                        </label>
                    </div>

                    <div id="paginationInfo" class="pagination-info"></div>
                    <div class="media-list" id="mediaList">
                        <!-- Media items will be loaded here -->
                    </div>
                    <div class="loading" id="loading">Loading...</div>
                </div>

                <script nonce="${nonce}" src="/js/media-viewer.js"></script>
            </body>
            </html>
        `;

        res.send(html);
    } catch (error) {
        console.error('Error fetching media overview:', error);
        res.status(500).json({
            error: 'Failed to fetch media overview',
            message: error.message
        });
    }
});

// Helper function to format file sizes
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = router; 