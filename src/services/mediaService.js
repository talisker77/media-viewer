const fs = require('fs').promises;
const path = require('path');
const chokidar = require('chokidar');
const config = require('../config/config');
const databaseService = require('./databaseService');

class MediaService {
    constructor() {
        this.mediaCache = new Map();
        this.watchers = [];
        this.initialize();
    }

    async initialize() {
        await this.scanDirectories();
        this.initializeWatchers();
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
        await this.saveToDatabase();
        console.log('Initial media scan completed');
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
        for (const dir of config.mediaDirectories) {
            try {
                await fs.access(dir);
                this.watchDirectory(dir);
            } catch (error) {
                console.error(`Directory not accessible: ${dir}`, error);
            }
        }
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
                return {
                    path: filePath,
                    name: path.basename(filePath),
                    type: this.getFileType(ext),
                    size: stats.size,
                    modified: stats.mtime,
                    created: stats.birthtime,
                    directory: path.dirname(filePath)
                };
            }
            return null;
        } catch (error) {
            console.error(`Error getting file info for ${filePath}:`, error);
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