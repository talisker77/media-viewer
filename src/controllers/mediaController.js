const mediaService = require('../services/mediaService');

class MediaController {
    async getAllMedia(req, res) {
        try {
            const media = await mediaService.getAllMedia();
            res.json(media);
        } catch (error) {
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
            const media = await mediaService.getAllMedia();
            const file = media.find(m => m.path === filePath);

            if (!file) {
                return res.status(404).json({
                    error: 'File not found'
                });
            }

            res.sendFile(file.path);
        } catch (error) {
            res.status(500).json({
                error: 'Failed to serve media file',
                message: error.message
            });
        }
    }
}

module.exports = new MediaController(); 