const mediaService = require('../services/mediaService');
const databaseService = require('../services/databaseService');
const path = require('path');
const fs = require('fs').promises;
const config = require('../config/config');

class MediaController {
    async getAllMedia(req, res) {
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

            // Use databaseService for paginated results
            const mediaData = await databaseService.loadMediaFiles(page, itemsPerPage, {
                search,
                type,
                dateFrom,
                dateTo,
                hasLocation
            });

            res.json({
                totalItems: mediaData.totalItems,
                currentPage: mediaData.currentPage,
                totalPages: mediaData.totalPages,
                items: mediaData.items,
                hasMore: mediaData.hasMore
            });
        } catch (error) {
            console.error('Error in getAllMedia:', error);
            res.status(500).json({
                error: 'Failed to fetch media',
                message: error.message
            });
        }
    }

    async getMediaByType(req, res) {
        try {
            const { type } = req.params;
            const media = await mediaService.getMediaByType(type);
            res.json(media);
        } catch (error) {
            res.status(500).json({
                error: 'Failed to fetch media by type',
                message: error.message
            });
        }
    }

    async getMediaFile(req, res) {
        try {
            const { filePath } = req.params;
            const decodedPath = decodeURIComponent(filePath);
            
            // Get file info from database
            const mediaData = await databaseService.loadMediaFiles(1, 1, { path: decodedPath });
            const file = mediaData.items[0];

            if (!file) {
                return res.status(404).json({
                    error: 'File not found in database'
                });
            }

            // Check if file exists and is within allowed directories
            const absolutePath = path.resolve(file.path);
            const isAllowed = config.mediaDirectories.some(dir => 
                absolutePath.startsWith(path.resolve(dir))
            );

            if (!isAllowed) {
                return res.status(403).json({
                    error: 'Access to file not allowed'
                });
            }

            try {
                await fs.access(absolutePath);
                res.sendFile(absolutePath);
            } catch (error) {
                console.error('File access error:', error);
                return res.status(404).json({
                    error: 'File not found on disk'
                });
            }
        } catch (error) {
            console.error('Error in getMediaFile:', error);
            res.status(500).json({
                error: 'Failed to serve media file',
                message: error.message
            });
        }
    }
}

module.exports = new MediaController(); 