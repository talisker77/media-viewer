const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');

class DatabaseService {
    constructor() {
        this.dbPath = path.join(__dirname, '../../data/media.db');
        this.ensureDataDirectory();
        this.chunkSize = 100; // Number of items per chunk
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
            // Save in chunks to handle large datasets
            const chunks = this.chunkArray(mediaFiles, this.chunkSize);
            for (let i = 0; i < chunks.length; i++) {
                const chunkPath = `${this.dbPath}.${i}`;
                await fs.writeFile(chunkPath, JSON.stringify(chunks[i], null, 2));
            }
            // Save metadata about chunks
            await fs.writeFile(
                `${this.dbPath}.meta`,
                JSON.stringify({
                    totalItems: mediaFiles.length,
                    totalChunks: chunks.length,
                    chunkSize: this.chunkSize
                })
            );
            return true;
        } catch (error) {
            console.error('Error saving media database:', error);
            return false;
        }
    }

    async loadMediaFiles(page = 1, itemsPerPage = 20, filters = {}) {
        try {
            // Read metadata first
            const metaData = JSON.parse(await fs.readFile(`${this.dbPath}.meta`, 'utf8'));
            
            // Calculate which chunks we need
            const startIndex = (page - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const startChunk = Math.floor(startIndex / this.chunkSize);
            const endChunk = Math.ceil(endIndex / this.chunkSize);

            // Load required chunks
            const items = [];
            for (let i = startChunk; i <= endChunk; i++) {
                const chunkPath = `${this.dbPath}.${i}`;
                try {
                    const chunkData = JSON.parse(await fs.readFile(chunkPath, 'utf8'));
                    items.push(...chunkData);
                } catch (error) {
                    console.error(`Error reading chunk ${i}:`, error);
                }
            }

            // Apply filters
            let filteredItems = this.applyFilters(items, filters);

            // Slice the items to get the requested page
            const start = startIndex % this.chunkSize;
            const end = start + itemsPerPage;
            const pageItems = filteredItems.slice(start, end);

            return {
                items: pageItems,
                totalItems: filteredItems.length,
                totalPages: Math.ceil(filteredItems.length / itemsPerPage),
                currentPage: page,
                itemsPerPage
            };
        } catch (error) {
            if (error.code === 'ENOENT') {
                return {
                    items: [],
                    totalItems: 0,
                    totalPages: 0,
                    currentPage: 1,
                    itemsPerPage
                };
            }
            console.error('Error loading media database:', error);
            throw error;
        }
    }

    applyFilters(items, filters) {
        return items.filter(item => {
            // Search filter
            if (filters.search) {
                const searchTerm = filters.search.toLowerCase();
                const searchableFields = [
                    item.name,
                    item.metadata?.title,
                    item.metadata?.description,
                    path.basename(item.directory)
                ].filter(Boolean);
                
                if (!searchableFields.some(field => 
                    field.toLowerCase().includes(searchTerm)
                )) {
                    return false;
                }
            }

            // Date range filter
            if (filters.dateFrom || filters.dateTo) {
                const itemDate = item.metadata?.photoTakenTime?.timestamp 
                    ? new Date(parseInt(item.metadata.photoTakenTime.timestamp) * 1000)
                    : new Date(item.modified);

                if (filters.dateFrom && itemDate < new Date(filters.dateFrom)) {
                    return false;
                }
                if (filters.dateTo && itemDate > new Date(filters.dateTo)) {
                    return false;
                }
            }

            // Type filter
            if (filters.type && item.type !== filters.type) {
                return false;
            }

            // Location filter
            if (filters.hasLocation && (!item.metadata?.geoData?.latitude || !item.metadata?.geoData?.longitude)) {
                return false;
            }

            return true;
        });
    }

    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
}

module.exports = new DatabaseService(); 