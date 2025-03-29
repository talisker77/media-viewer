const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');

// Get all media
router.get('/', mediaController.getAllMedia);

// Get media by type (image/video)
router.get('/type/:type', mediaController.getMediaByType);

// Get specific media file
router.get('/file/:filePath(*)', mediaController.getMediaFile);

module.exports = router; 