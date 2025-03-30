const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;
const config = require('../config/config');

class DatabaseService {
    constructor() {
        this.dbPath = path.join(__dirname, '../../data/media.db');
        this.db = null;
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

    async initialize() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                this.createTables().then(resolve).catch(reject);
            });
        });
    }

    async createTables() {
        return new Promise((resolve, reject) => {
            this.db.run(`
                CREATE TABLE IF NOT EXISTS media_files (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    path TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL,
                    directory TEXT NOT NULL,
                    size INTEGER NOT NULL,
                    modified INTEGER NOT NULL,
                    created INTEGER NOT NULL,
                    metadata TEXT,
                    created_at INTEGER DEFAULT (unixepoch())
                )
            `, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async saveMediaFiles(mediaFiles) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');

                const stmt = this.db.prepare(`
                    INSERT OR REPLACE INTO media_files 
                    (path, name, type, directory, size, modified, created, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `);

                mediaFiles.forEach(file => {
                    stmt.run(
                        file.path,
                        file.name,
                        file.type,
                        file.directory,
                        file.size,
                        file.modified,
                        file.created,
                        JSON.stringify(file.metadata || {})
                    );
                });

                stmt.finalize();

                this.db.run('COMMIT', (err) => {
                    if (err) reject(err);
                    else resolve(true);
                });
            });
        });
    }

    async loadMediaFiles(page = 1, itemsPerPage = 20, filters = {}) {
        const offset = (page - 1) * itemsPerPage;
        let query = 'SELECT * FROM media_files WHERE 1=1';
        const params = [];

        // Apply filters
        if (filters.search) {
            query += ` AND (
                name LIKE ? OR 
                directory LIKE ? OR 
                metadata LIKE ?
            )`;
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        if (filters.type) {
            query += ' AND type = ?';
            params.push(filters.type);
        }

        if (filters.dateFrom) {
            query += ' AND modified >= ?';
            params.push(new Date(filters.dateFrom).getTime());
        }

        if (filters.dateTo) {
            query += ' AND modified <= ?';
            params.push(new Date(filters.dateTo).getTime());
        }

        if (filters.hasLocation) {
            query += ' AND metadata LIKE ?';
            params.push('%"geoData":%');
        }

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
        const total = await new Promise((resolve, reject) => {
            this.db.get(countQuery, params, (err, row) => {
                if (err) reject(err);
                else resolve(row.total);
            });
        });

        // Get paginated results
        query += ' ORDER BY modified DESC LIMIT ? OFFSET ?';
        params.push(itemsPerPage, offset);

        const items = await new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else {
                    resolve(rows.map(row => ({
                        ...row,
                        metadata: JSON.parse(row.metadata || '{}')
                    })));
                }
            });
        });

        return {
            items,
            totalItems: total,
            totalPages: Math.ceil(total / itemsPerPage),
            currentPage: page,
            itemsPerPage
        };
    }

    async deleteDatabase() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) reject(err);
                    else {
                        fs.unlink(this.dbPath)
                            .then(resolve)
                            .catch(reject);
                    }
                });
            } else {
                resolve();
            }
        });
    }

    async getMediaOverview() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                const overview = {
                    totalItems: 0,
                    byType: {},
                    byDirectory: {},
                    recentItems: [],
                    stats: {
                        totalSize: 0,
                        averageFileSize: 0,
                        oldestFile: null,
                        newestFile: null
                    }
                };

                // Get total items and size
                this.db.get(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(size) as totalSize,
                        MIN(modified) as oldestFile,
                        MAX(modified) as newestFile
                    FROM media_files
                `, (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    overview.totalItems = row.total;
                    overview.stats.totalSize = row.totalSize || 0;
                    overview.stats.averageFileSize = row.total ? Math.round(row.totalSize / row.total) : 0;
                    overview.stats.oldestFile = row.oldestFile;
                    overview.stats.newestFile = row.newestFile;
                });

                // Get items by type
                this.db.all(`
                    SELECT type, COUNT(*) as count
                    FROM media_files
                    GROUP BY type
                `, (err, rows) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    rows.forEach(row => {
                        overview.byType[row.type] = row.count;
                    });
                });

                // Get items by directory
                this.db.all(`
                    SELECT directory, COUNT(*) as count
                    FROM media_files
                    GROUP BY directory
                    ORDER BY count DESC
                    LIMIT 10
                `, (err, rows) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    rows.forEach(row => {
                        overview.byDirectory[row.directory] = row.count;
                    });
                });

                // Get recent items
                this.db.all(`
                    SELECT id, name, type, directory, modified, metadata
                    FROM media_files
                    ORDER BY modified DESC
                    LIMIT 10
                `, (err, rows) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    overview.recentItems = rows.map(row => ({
                        id: row.id,
                        name: row.name,
                        type: row.type,
                        directory: row.directory,
                        modified: row.modified,
                        metadata: JSON.parse(row.metadata || '{}')
                    }));
                });

                // Wait for all queries to complete
                this.db.run('SELECT 1', (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(overview);
                });
            });
        });
    }
}

module.exports = new DatabaseService(); 