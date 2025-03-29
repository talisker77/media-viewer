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
        const mediaData = await databaseService.loadMediaFiles();
        const file = mediaData.items.find(f => f.path === filePath);

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
        const page = parseInt(req.query.page) || 1;
        const itemsPerPage = parseInt(req.query.itemsPerPage) || 20;
        const filters = {
            search: req.query.search,
            dateFrom: req.query.dateFrom,
            dateTo: req.query.dateTo,
            type: req.query.type,
            hasLocation: req.query.hasLocation === 'true'
        };
        
        const mediaData = await databaseService.loadMediaFiles(page, itemsPerPage, filters);
        
        // Group files by type
        const groupedFiles = {
            images: mediaData.items.filter(file => file.type === 'image'),
            videos: mediaData.items.filter(file => file.type === 'video')
        };

        // Generate pagination controls
        const paginationControls = generatePaginationControls(
            mediaData.currentPage,
            mediaData.totalPages,
            itemsPerPage,
            filters
        );

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
                    .metadata {
                        font-size: 0.8em;
                        color: #666;
                        margin-top: 5px;
                    }
                    .metadata-item {
                        margin-right: 15px;
                    }
                    .geo-data {
                        color: #0066cc;
                    }
                    .device-info {
                        color: #666;
                        font-style: italic;
                    }
                    .pagination {
                        display: flex;
                        justify-content: center;
                        gap: 10px;
                        margin: 20px 0;
                    }
                    .pagination a {
                        padding: 8px 12px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        text-decoration: none;
                        color: #0066cc;
                    }
                    .pagination a:hover {
                        background-color: #f5f5f5;
                    }
                    .pagination .active {
                        background-color: #0066cc;
                        color: white;
                        border-color: #0066cc;
                    }
                    .pagination .disabled {
                        color: #ccc;
                        pointer-events: none;
                    }
                    .page-info {
                        text-align: center;
                        color: #666;
                        margin: 10px 0;
                    }
                    .filters {
                        background-color: #f8f9fa;
                        padding: 20px;
                        border-radius: 5px;
                        margin-bottom: 20px;
                    }
                    .filter-group {
                        margin-bottom: 15px;
                    }
                    .filter-group label {
                        display: block;
                        margin-bottom: 5px;
                        font-weight: bold;
                    }
                    .filter-group input,
                    .filter-group select {
                        width: 100%;
                        padding: 8px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                    }
                    .filter-row {
                        display: flex;
                        gap: 15px;
                        margin-bottom: 15px;
                    }
                    .filter-row > div {
                        flex: 1;
                    }
                    .search-box {
                        display: flex;
                        gap: 10px;
                    }
                    .search-box input {
                        flex: 1;
                    }
                    .search-box button {
                        padding: 8px 16px;
                        background-color: #0066cc;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    }
                    .search-box button:hover {
                        background-color: #0052a3;
                    }
                    .active-filters {
                        margin-top: 10px;
                        display: flex;
                        flex-wrap: wrap;
                        gap: 8px;
                    }
                    .filter-tag {
                        background-color: #e9ecef;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 0.9em;
                        display: flex;
                        align-items: center;
                        gap: 5px;
                    }
                    .filter-tag button {
                        background: none;
                        border: none;
                        color: #666;
                        cursor: pointer;
                        padding: 0 4px;
                    }
                    .filter-tag button:hover {
                        color: #dc3545;
                    }
                </style>
            </head>
            <body>
                <h1>Media Viewer</h1>
                
                <div class="filters">
                    <form method="GET" action="/">
                        <div class="search-box">
                            <input type="text" 
                                   name="search" 
                                   placeholder="Search files..." 
                                   value="${filters.search || ''}"
                                   autocomplete="off">
                            <button type="submit">Search</button>
                        </div>
                        
                        <div class="filter-row">
                            <div class="filter-group">
                                <label>Type</label>
                                <select name="type">
                                    <option value="">All Types</option>
                                    <option value="image" ${filters.type === 'image' ? 'selected' : ''}>Images</option>
                                    <option value="video" ${filters.type === 'video' ? 'selected' : ''}>Videos</option>
                                </select>
                            </div>
                            <div class="filter-group">
                                <label>Date Range</label>
                                <input type="date" 
                                       name="dateFrom" 
                                       value="${filters.dateFrom || ''}"
                                       placeholder="From">
                                <input type="date" 
                                       name="dateTo" 
                                       value="${filters.dateTo || ''}"
                                       placeholder="To">
                            </div>
                        </div>
                        
                        <div class="filter-group">
                            <label>
                                <input type="checkbox" 
                                       name="hasLocation" 
                                       value="true"
                                       ${filters.hasLocation ? 'checked' : ''}>
                                Only show items with location data
                            </label>
                        </div>
                        
                        <button type="submit">Apply Filters</button>
                    </form>

                    ${generateActiveFilters(filters)}
                </div>

                <div class="stats">
                    <h2>Statistics</h2>
                    <p>Total Files: ${mediaData.totalItems}</p>
                    <p>Images: ${groupedFiles.images.length}</p>
                    <p>Videos: ${groupedFiles.videos.length}</p>
                </div>

                <div class="page-info">
                    Page ${mediaData.currentPage} of ${mediaData.totalPages}
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
                                            ${file.metadata?.title || file.name}
                                        </a>
                                        <div class="file-info">
                                            ${path.basename(file.directory)}
                                        </div>
                                        ${file.metadata ? `
                                            <div class="metadata">
                                                ${file.metadata.description ? `
                                                    <div class="metadata-item">${file.metadata.description}</div>
                                                ` : ''}
                                                ${file.metadata.photoTakenTime ? `
                                                    <div class="metadata-item">
                                                        Taken: ${file.metadata.photoTakenTime.formatted}
                                                    </div>
                                                ` : ''}
                                                ${file.metadata.geoData ? `
                                                    <div class="metadata-item geo-data">
                                                        📍 ${file.metadata.geoData.latitude.toFixed(6)}, ${file.metadata.geoData.longitude.toFixed(6)}
                                                    </div>
                                                ` : ''}
                                                ${file.metadata.deviceType ? `
                                                    <div class="metadata-item device-info">
                                                        📱 ${file.metadata.deviceType}
                                                    </div>
                                                ` : ''}
                                            </div>
                                        ` : ''}
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
                                            ${file.metadata?.title || file.name}
                                        </a>
                                        <div class="file-info">
                                            ${path.basename(file.directory)}
                                        </div>
                                        ${file.metadata ? `
                                            <div class="metadata">
                                                ${file.metadata.description ? `
                                                    <div class="metadata-item">${file.metadata.description}</div>
                                                ` : ''}
                                                ${file.metadata.photoTakenTime ? `
                                                    <div class="metadata-item">
                                                        Taken: ${file.metadata.photoTakenTime.formatted}
                                                    </div>
                                                ` : ''}
                                                ${file.metadata.geoData ? `
                                                    <div class="metadata-item geo-data">
                                                        📍 ${file.metadata.geoData.latitude.toFixed(6)}, ${file.metadata.geoData.longitude.toFixed(6)}
                                                    </div>
                                                ` : ''}
                                                ${file.metadata.deviceType ? `
                                                    <div class="metadata-item device-info">
                                                        📱 ${file.metadata.deviceType}
                                                    </div>
                                                ` : ''}
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                                <div class="file-date">
                                    ${new Date(file.modified).toLocaleString()}
                                </div>
                            </li>
                        `).join('')}
                    </ul>
                </div>

                ${paginationControls}
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

function generateActiveFilters(filters) {
    const activeFilters = [];
    
    if (filters.search) {
        activeFilters.push(`
            <div class="filter-tag">
                Search: ${filters.search}
                <button onclick="removeFilter('search')">×</button>
            </div>
        `);
    }
    
    if (filters.type) {
        activeFilters.push(`
            <div class="filter-tag">
                Type: ${filters.type}
                <button onclick="removeFilter('type')">×</button>
            </div>
        `);
    }
    
    if (filters.dateFrom) {
        activeFilters.push(`
            <div class="filter-tag">
                From: ${new Date(filters.dateFrom).toLocaleDateString()}
                <button onclick="removeFilter('dateFrom')">×</button>
            </div>
        `);
    }
    
    if (filters.dateTo) {
        activeFilters.push(`
            <div class="filter-tag">
                To: ${new Date(filters.dateTo).toLocaleDateString()}
                <button onclick="removeFilter('dateTo')">×</button>
            </div>
        `);
    }
    
    if (filters.hasLocation) {
        activeFilters.push(`
            <div class="filter-tag">
                With Location
                <button onclick="removeFilter('hasLocation')">×</button>
            </div>
        `);
    }

    if (activeFilters.length === 0) {
        return '';
    }

    return `
        <div class="active-filters">
            <strong>Active Filters:</strong>
            ${activeFilters.join('')}
        </div>
        <script>
            function removeFilter(filter) {
                const url = new URL(window.location.href);
                url.searchParams.delete(filter);
                window.location.href = url.toString();
            }
        </script>
    `;
}

function generatePaginationControls(currentPage, totalPages, itemsPerPage, filters) {
    const controls = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // Build query string with current filters
    const queryString = Object.entries(filters)
        .filter(([_, value]) => value)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');

    // Previous page
    controls.push(`
        <a href="/?page=${currentPage - 1}&itemsPerPage=${itemsPerPage}${queryString ? '&' + queryString : ''}" 
           class="${currentPage === 1 ? 'disabled' : ''}">
            Previous
        </a>
    `);

    // First page
    if (startPage > 1) {
        controls.push(`
            <a href="/?page=1&itemsPerPage=${itemsPerPage}${queryString ? '&' + queryString : ''}">1</a>
            ${startPage > 2 ? '<span>...</span>' : ''}
        `);
    }

    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        controls.push(`
            <a href="/?page=${i}&itemsPerPage=${itemsPerPage}${queryString ? '&' + queryString : ''}" 
               class="${i === currentPage ? 'active' : ''}">
                ${i}
            </a>
        `);
    }

    // Last page
    if (endPage < totalPages) {
        controls.push(`
            ${endPage < totalPages - 1 ? '<span>...</span>' : ''}
            <a href="/?page=${totalPages}&itemsPerPage=${itemsPerPage}${queryString ? '&' + queryString : ''}">${totalPages}</a>
        `);
    }

    // Next page
    controls.push(`
        <a href="/?page=${currentPage + 1}&itemsPerPage=${itemsPerPage}${queryString ? '&' + queryString : ''}" 
           class="${currentPage === totalPages ? 'disabled' : ''}">
            Next
        </a>
    `);

    return `
        <div class="pagination">
            ${controls.join('')}
        </div>
    `;
}

module.exports = router; 