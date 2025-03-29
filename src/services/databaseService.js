const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');

class DatabaseService {
    constructor() {
        this.dbPath = path.join(__dirname, '../../data/media.db');
        this.ensureDataDirectory();
    }

    async ensureDataDirectory() {
        const dataDir = path.dirname(this.dbPath);
        try {
            await fs.access(dataDir);
        } catch {
            await fs.mkdir(dataDir, { recursive: true });
        }
    }

    async saveMediaFiles(mediaFiles) {
        try {
            await fs.writeFile(
                this.dbPath,
                JSON.stringify(mediaFiles, null, 2)
            );
            return true;
        } catch (error) {
            console.error('Error saving media database:', error);
            return false;
        }
    }

    async loadMediaFiles() {
        try {
            const data = await fs.readFile(this.dbPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return [];
            }
            console.error('Error loading media database:', error);
            return [];
        }
    }
}

module.exports = new DatabaseService(); 