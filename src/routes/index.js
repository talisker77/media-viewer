const express = require('express');
const router = express.Router();
const mediaService = require('../services/mediaService');
const databaseService = require('../services/databaseService');
const path = require('path');
const config = require('../config/config');

// Route to serve media files
router.get('/media/:filePath(*)', async (req, res) => {
    try {
        const filePath = decodeURIComponent(req.params.filePath);
        const mediaFiles = await databaseService.loadMediaFiles();
        const file = mediaFiles.find(f => f.path === filePath);

        if (!file) {
            return res.status(404).json({
                error: 'File not found'
            });
        }

        // Ensure we're using an absolute path
        const absolutePath = path.resolve(file.path);
        
        // Basic security check to ensure the file is within allowed directories
        const isAllowedPath = config.mediaDirectories.some(dir => 
            absolutePath.startsWith(path.resolve(dir))
        );

        if (!isAllowedPath) {
            return res.status(403).json({
                error: 'Access denied'
            });
        }

        res.sendFile(absolutePath);
    } catch (error) {
        console.error('Error serving media file:', error);
        res.status(500).json({
            error: 'Failed to serve media file',
            message: error.message
        });
    }
});

router.get('/', async (req, res) => {
    try {
        const mediaFiles = await databaseService.loadMediaFiles();
        
        // Group files by type
        const groupedFiles = {
            images: mediaFiles.filter(file => file.type === 'image'),
            videos: mediaFiles.filter(file => file.type === 'video')
        };

        // Generate HTML response
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Media Viewer</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        max-width: 1200px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .section {
                        margin-bottom: 30px;
                    }
                    h1, h2 {
                        color: #333;
                    }
                    .file-list {
                        list-style: none;
                        padding: 0;
                    }
                    .file-item {
                        padding: 10px;
                        border-bottom: 1px solid #eee;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .file-item:hover {
                        background-color: #f5f5f5;
                    }
                    .file-info {
                        color: #666;
                        font-size: 0.9em;
                    }
                    .stats {
                        background-color: #f8f9fa;
                        padding: 15px;
                        border-radius: 5px;
                        margin-bottom: 20px;
                    }
                    .file-link {
                        color: #0066cc;
                        text-decoration: none;
                        font-weight: bold;
                    }
                    .file-link:hover {
                        text-decoration: underline;
                    }
                    .file-date {
                        color: #666;
                        font-size: 0.9em;
                    }
                    .file-preview {
                        max-width: 200px;
                        max-height: 150px;
                        margin-right: 15px;
                    }
                    .video-preview {
                        width: 200px;
                        height: 150px;
                        background-color: #000;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        margin-right: 15px;
                    }
                </style>
            </head>
            <body>
                <h1>Media Viewer</h1>
                
                <div class="stats">
                    <h2>Statistics</h2>
                    <p>Total Files: ${mediaFiles.length}</p>
                    <p>Images: ${groupedFiles.images.length}</p>
                    <p>Videos: ${groupedFiles.videos.length}</p>
                </div>

                <div class="section">
                    <h2>Images</h2>
                    <ul class="file-list">
                        ${groupedFiles.images.map(file => `
                            <li class="file-item">
                                <div style="display: flex; align-items: center;">
                                    <img src="/media/${encodeURIComponent(file.path)}" 
                                         class="file-preview" 
                                         alt="${file.name}"
                                         onerror="this.style.display='none'">
                                    <div>
                                        <a href="/media/${encodeURIComponent(file.path)}" 
                                           class="file-link" 
                                           target="_blank">
                                            ${file.name}
                                        </a>
                                        <div class="file-info">
                                            ${path.basename(file.directory)}
                                        </div>
                                    </div>
                                </div>
                                <div class="file-date">
                                    ${new Date(file.modified).toLocaleString()}
                                </div>
                            </li>
                        `).join('')}
                    </ul>
                </div>

                <div class="section">
                    <h2>Videos</h2>
                    <ul class="file-list">
                        ${groupedFiles.videos.map(file => `
                            <li class="file-item">
                                <div style="display: flex; align-items: center;">
                                    <div class="video-preview">
                                        <span>🎥</span>
                                    </div>
                                    <div>
                                        <a href="/media/${encodeURIComponent(file.path)}" 
                                           class="file-link" 
                                           target="_blank">
                                            ${file.name}
                                        </a>
                                        <div class="file-info">
                                            ${path.basename(file.directory)}
                                        </div>
                                    </div>
                                </div>
                                <div class="file-date">
                                    ${new Date(file.modified).toLocaleString()}
                                </div>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </body>
            </html>
        `;

        res.send(html);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to load media files',
            message: error.message
        });
    }
});

module.exports = router; 