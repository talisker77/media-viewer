const fs = require('fs').promises;
const path = require('path');
const chokidar = require('chokidar');
const config = require('../config/config');
const databaseService = require('./databaseService');

class MediaService {
    constructor() {
        this.mediaCache = new Map();
        this.watchers = [];
        this.metadataStats = {
            total: 0,
            found: 0,
            errors: 0
        };
        this.initialize();
    }

    async initialize() {
        console.log('\n=== Starting Media Service Initialization ===');
        await this.scanDirectories();
        console.log('\n=== Directory Scanning Complete ===');
        this.initializeWatchers();
        console.log('=== File Watchers Initialized ===\n');
    }

    async scanDirectories() {
        console.log('Starting initial media scan...');
        for (const dir of config.mediaDirectories) {
            try {
                await this.scanDirectory(dir);
            } catch (error) {
                console.error(`Error scanning directory ${dir}:`, error);
            }
        }
        console.log('\nSaving media files to database...');
        await this.saveToDatabase();
        console.log('Database save complete');
        
        // Calculate statistics
        const mediaFiles = Array.from(this.mediaCache.values());
        const images = mediaFiles.filter(f => f.type === 'image');
        const videos = mediaFiles.filter(f => f.type === 'video');
        
        console.log('\nMedia scan completed successfully:');
        console.log(`Total files found: ${mediaFiles.length}`);
        console.log(`Images: ${images.length}`);
        console.log(`Videos: ${videos.length}`);
        console.log(`Files with metadata: ${mediaFiles.filter(f => f.metadata).length}`);
        console.log(`Files with location data: ${mediaFiles.filter(f => f.metadata?.geoData).length}`);
        console.log('----------------------------------------');

        // Log metadata scanning statistics
        console.log('\nMetadata scanning summary:');
        console.log(`Total files scanned for metadata: ${this.metadataStats.total}`);
        console.log(`Files with metadata found: ${this.metadataStats.found}`);
        console.log(`Files without metadata: ${this.metadataStats.total - this.metadataStats.found}`);
        console.log(`Metadata scanning errors: ${this.metadataStats.errors}`);
        console.log('----------------------------------------\n');

        // Reset metadata stats for next scan
        this.metadataStats = {
            total: 0,
            found: 0,
            errors: 0
        };
    }

    async scanDirectory(dir) {
        try {
            const files = await fs.readdir(dir, { withFileTypes: true });
            
            for (const file of files) {
                const fullPath = path.join(dir, file.name);
                
                if (file.isDirectory()) {
                    await this.scanDirectory(fullPath);
                } else {
                    const fileInfo = await this.getFileInfo(fullPath);
                    if (fileInfo) {
                        this.mediaCache.set(fullPath, fileInfo);
                    }
                }
            }
        } catch (error) {
            console.error(`Error scanning directory ${dir}:`, error);
        }
    }

    async saveToDatabase() {
        const mediaFiles = Array.from(this.mediaCache.values());
        await databaseService.saveMediaFiles(mediaFiles);
    }

    async initializeWatchers() {
        console.log('\nInitializing file watchers...');
        for (const dir of config.mediaDirectories) {
            try {
                await fs.access(dir);
                this.watchDirectory(dir);
                console.log(`✓ Watching directory: ${dir}`);
            } catch (error) {
                console.error(`✗ Directory not accessible: ${dir}`, error);
            }
        }
        console.log('File watchers initialization complete');
    }

    watchDirectory(dir) {
        const watcher = chokidar.watch(dir, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: false
        });

        watcher
            .on('add', path => this.handleFileAdd(path))
            .on('change', path => this.handleFileChange(path))
            .on('unlink', path => this.handleFileDelete(path));

        this.watchers.push(watcher);
    }

    async handleFileAdd(filePath) {
        const fileInfo = await this.getFileInfo(filePath);
        if (fileInfo) {
            this.mediaCache.set(filePath, fileInfo);
            await this.saveToDatabase();
        }
    }

    async handleFileChange(filePath) {
        await this.handleFileAdd(filePath);
    }

    async handleFileDelete(filePath) {
        this.mediaCache.delete(filePath);
        await this.saveToDatabase();
    }

    async getFileInfo(filePath) {
        try {
            const stats = await fs.stat(filePath);
            const ext = path.extname(filePath).toLowerCase().slice(1);
            
            if (this.isAllowedFileType(ext)) {
                this.metadataStats.total++;
                const fileInfo = {
                    path: filePath,
                    name: path.basename(filePath),
                    type: this.getFileType(ext),
                    size: stats.size,
                    modified: stats.mtime,
                    created: stats.birthtime,
                    directory: path.dirname(filePath)
                };

                // Look for associated metadata JSON file with the correct pattern
                const metadataPath = `${filePath}.supplemental-metadata.json`;
                try {
                    const jsonData = await fs.readFile(metadataPath, 'utf8');
                    const metadata = JSON.parse(jsonData);
                    
                    // Add relevant metadata to fileInfo
                    fileInfo.metadata = {
                        title: metadata.title,
                        description: metadata.description,
                        imageViews: metadata.imageViews,
                        creationTime: metadata.creationTime,
                        photoTakenTime: metadata.photoTakenTime,
                        geoData: metadata.geoData,
                        deviceType: metadata.googlePhotosOrigin?.mobileUpload?.deviceType
                    };
                    this.metadataStats.found++;
                    console.log(`✓ Processed ${filePath} (with metadata)`);
                } catch (error) {
                    // If JSON file doesn't exist or is invalid, continue without metadata
                    this.metadataStats.errors++;
                    console.log(`! Processed ${filePath} (no metadata)`);
                }

                return fileInfo;
            }
            return null;
        } catch (error) {
            console.error(`✗ Error processing ${filePath}:`, error);
            return null;
        }
    }

    isAllowedFileType(ext) {
        return config.allowedImageTypes.includes(ext) || 
               config.allowedVideoTypes.includes(ext);
    }

    getFileType(ext) {
        if (config.allowedImageTypes.includes(ext)) return 'image';
        if (config.allowedVideoTypes.includes(ext)) return 'video';
        return 'unknown';
    }

    async getAllMedia() {
        return Array.from(this.mediaCache.values());
    }

    async getMediaByType(type) {
        return Array.from(this.mediaCache.values())
            .filter(media => media.type === type);
    }

    stopWatching() {
        for (const watcher of this.watchers) {
            watcher.close();
        }
        this.watchers = [];
    }
}

module.exports = new MediaService(); 