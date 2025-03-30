let currentPage = 1;
let isLoading = false;
let hasMore = true;
let filters = {};
let currentMediaIndex = 0;
let mediaItems = [];
let keyboardShortcutsTimeout;
let currentMediaElement = null;
let retryCount = 0;
const MAX_RETRIES = 3;
const ITEMS_PER_PAGE = 20;
const SCROLL_THRESHOLD = 1000; // pixels from bottom to trigger load

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(timestamp) {
    if (!timestamp || isNaN(timestamp)) {
        console.warn('Invalid date timestamp:', timestamp);
        return 'Unknown date';
    }
    
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            console.warn('Invalid date object:', date);
            return 'Unknown date';
        }
        
        return date.toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Unknown date';
    }
}

function createMediaItem(item) {
    const mediaItem = document.createElement('div');
    mediaItem.className = 'media-item';
    mediaItem.dataset.type = item.type;
    mediaItem.dataset.date = item.modified;
    mediaItem.dataset.size = item.size;
    mediaItem.dataset.hasLocation = item.metadata?.geoData ? true : false;

    // Use the folder information from the server
    const folderName = item.folder || 'Root';
    
    mediaItem.innerHTML = `
        <div class="media-info">
            <div class="media-name" data-path="${item.path}">${item.name}</div>
            <div class="media-folder" title="${item.directory}">${folderName}</div>
            <div class="media-meta">
                <span class="media-date">${formatDate(item.modified)}</span>
                <span class="media-size">${formatFileSize(item.size)}</span>
                ${item.metadata?.geoData ? '<span class="media-location">📍</span>' : ''}
            </div>
        </div>
    `;

    // Add click handler for media name
    const mediaName = mediaItem.querySelector('.media-name');
    mediaName.addEventListener('click', (e) => {
        e.preventDefault();
        showMediaViewer(item);
    });

    return mediaItem;
}

function createModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="modalTitle"></h2>
                <span class="modal-close">&times;</span>
            </div>
            <div class="modal-body">
                <div id="mediaContainer"></div>
            </div>
            <div class="modal-footer">
                <div class="media-meta" id="modalMeta"></div>
            </div>
        </div>
        <div class="nav-controls">
            <button class="nav-button" id="prevButton">❮</button>
            <button class="nav-button" id="nextButton">❯</button>
        </div>
        <div class="loading-spinner">Loading...</div>
        <div class="keyboard-shortcuts">Press ESC to close • ← → to navigate</div>
    `;
    document.body.appendChild(modal);
    return modal;
}

function showMediaViewer(item) {
    console.log('Opening media viewer for item:', {
        name: item.name,
        path: item.path,
        type: item.type,
        size: formatFileSize(item.size)
    });

    const modal = document.querySelector('.modal') || createModal();
    const mediaContainer = document.getElementById('mediaContainer');
    const modalTitle = document.getElementById('modalTitle');
    const modalMeta = document.getElementById('modalMeta');
    const loadingSpinner = document.querySelector('.loading-spinner');
    const keyboardShortcuts = document.querySelector('.keyboard-shortcuts');
    
    // Store current items and index
    currentMediaIndex = mediaItems.findIndex(i => i.path === item.path);
    console.log('Current media index:', currentMediaIndex);
    
    // Update UI
    modalTitle.textContent = item.name;
    modalMeta.innerHTML = `
        ${item.folder} • ${formatFileSize(item.size)} • ${formatDate(item.modified)}
        ${item.metadata?.geoData ? ' • 📍' : ''}
    `;
    
    // Clear container and show loading spinner
    mediaContainer.innerHTML = '';
    loadingSpinner.style.display = 'block';
    
    // Clean up previous media element if it exists
    if (currentMediaElement) {
        if (currentMediaElement instanceof HTMLVideoElement) {
            currentMediaElement.pause();
            currentMediaElement.src = '';
        }
        currentMediaElement.remove();
        currentMediaElement = null;
    }
    
    // Create new media element
    if (item.type === 'video') {
        // Create video container
        const videoContainer = document.createElement('div');
        videoContainer.className = 'video-container';
        
        // Create video element
        currentMediaElement = document.createElement('video');
        currentMediaElement.className = 'media-viewer video';
        currentMediaElement.controls = true;
        currentMediaElement.playsInline = true;
        
        // Add video controls
        const controls = document.createElement('div');
        controls.className = 'video-controls';
        controls.innerHTML = `
            <button class="play-pause">▶</button>
            <div class="progress-bar">
                <div class="progress"></div>
            </div>
            <div class="time">
                <span class="current-time">0:00</span>
                <span>/</span>
                <span class="duration">0:00</span>
            </div>
            <button class="mute">🔊</button>
            <button class="fullscreen">⛶</button>
        `;
        
        // Add event listeners for video controls
        currentMediaElement.addEventListener('play', () => {
            controls.querySelector('.play-pause').textContent = '⏸';
        });
        
        currentMediaElement.addEventListener('pause', () => {
            controls.querySelector('.play-pause').textContent = '▶';
        });
        
        currentMediaElement.addEventListener('timeupdate', () => {
            const progress = (currentMediaElement.currentTime / currentMediaElement.duration) * 100;
            controls.querySelector('.progress').style.width = `${progress}%`;
            controls.querySelector('.current-time').textContent = formatTime(currentMediaElement.currentTime);
        });
        
        currentMediaElement.addEventListener('loadedmetadata', () => {
            controls.querySelector('.duration').textContent = formatTime(currentMediaElement.duration);
        });
        
        // Add control button event listeners
        controls.querySelector('.play-pause').addEventListener('click', () => {
            if (currentMediaElement.paused) {
                currentMediaElement.play();
            } else {
                currentMediaElement.pause();
            }
        });
        
        controls.querySelector('.mute').addEventListener('click', () => {
            currentMediaElement.muted = !currentMediaElement.muted;
            controls.querySelector('.mute').textContent = currentMediaElement.muted ? '🔇' : '🔊';
        });
        
        controls.querySelector('.fullscreen').addEventListener('click', () => {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                videoContainer.requestFullscreen();
            }
        });
        
        // Add progress bar click handler
        const progressBar = controls.querySelector('.progress-bar');
        progressBar.addEventListener('click', (e) => {
            const rect = progressBar.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            currentMediaElement.currentTime = pos * currentMediaElement.duration;
        });
        
        // Assemble video container
        videoContainer.appendChild(currentMediaElement);
        videoContainer.appendChild(controls);
        mediaContainer.appendChild(videoContainer);
    } else {
        // Create image element
        currentMediaElement = document.createElement('img');
        currentMediaElement.className = 'media-viewer image';
        mediaContainer.appendChild(currentMediaElement);
    }
    
    // Load media
    const mediaUrl = `/api/media/file/${encodeURIComponent(item.path)}`;
    console.log('Loading media from URL:', mediaUrl);
    
    currentMediaElement.onload = () => {
        console.log('Media loaded successfully');
        loadingSpinner.style.display = 'none';
    };

    currentMediaElement.onerror = (error) => {
        console.error('Error loading media:', error);
        loadingSpinner.style.display = 'none';
        mediaContainer.innerHTML = `
            <div style="color: white; text-align: center;">
                <p>Error loading media file</p>
                <p>Path: ${item.path}</p>
                <p>Please check if the file exists and is accessible</p>
            </div>
        `;
    };
    
    currentMediaElement.src = mediaUrl;
    
    // Show modal
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    // Show keyboard shortcuts
    keyboardShortcuts.classList.add('show');
    clearTimeout(keyboardShortcutsTimeout);
    keyboardShortcutsTimeout = setTimeout(() => {
        keyboardShortcuts.classList.remove('show');
    }, 3000);
    
    // Update navigation buttons
    updateNavigationButtons();
}

function updateNavigationButtons() {
    const prevButton = document.getElementById('prevButton');
    const nextButton = document.getElementById('nextButton');
    
    prevButton.disabled = currentMediaIndex === 0;
    nextButton.disabled = currentMediaIndex === mediaItems.length - 1 && !hasMore;
}

function navigateMedia(direction) {
    const newIndex = currentMediaIndex + direction;
    if (newIndex >= 0 && newIndex < mediaItems.length) {
        currentMediaIndex = newIndex;
        showMediaViewer(mediaItems[currentMediaIndex]);
    } else if (direction > 0 && hasMore) {
        // If we're at the end and there are more items, load them
        loadMediaItems().then(() => {
            // After loading, try to navigate again
            if (newIndex < mediaItems.length) {
                currentMediaIndex = newIndex;
                showMediaViewer(mediaItems[currentMediaIndex]);
            }
        });
    }
}

function closeMediaViewer() {
    const modal = document.querySelector('.modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        
        // Clean up media element
        if (currentMediaElement) {
            currentMediaElement.remove();
            currentMediaElement = null;
        }
        
        const mediaContainer = document.getElementById('mediaContainer');
        mediaContainer.innerHTML = '';
    }
}

// Add pagination info display
function updatePaginationInfo(data) {
    const paginationInfo = document.getElementById('paginationInfo');
    if (paginationInfo) {
        const start = ((data.currentPage - 1) * data.itemsPerPage) + 1;
        const end = Math.min(data.currentPage * data.itemsPerPage, data.totalItems);
        paginationInfo.textContent = `Showing ${start} to ${end} of ${data.totalItems} items`;
    }
}

function updateFilters() {
    // Only include non-empty filters
    filters = {};
    const search = document.getElementById('search').value;
    const type = document.getElementById('type').value;
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const hasLocation = document.getElementById('hasLocation').checked;

    if (search) filters.search = search;
    if (type) filters.type = type;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (hasLocation) filters.hasLocation = hasLocation;

    console.log('Updating filters:', filters);

    // Reset pagination
    currentPage = 1;
    hasMore = true;
    retryCount = 0;
    mediaItems = [];
    document.getElementById('mediaList').innerHTML = '';
    loadMediaItems();
}

async function loadMediaItems() {
    if (isLoading || !hasMore) return;
    
    isLoading = true;
    document.getElementById('loading').style.display = 'block';

    try {
        // Build query parameters
        const params = new URLSearchParams();
        params.append('page', currentPage);
        params.append('itemsPerPage', ITEMS_PER_PAGE);

        // Add filters
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== '') {
                params.append(key, value);
            }
        });

        console.log('Fetching media items with params:', params.toString());
        const response = await fetch(`/api/media?${params}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Received media data:', {
            totalItems: data.totalItems,
            currentPage: data.currentPage,
            totalPages: data.totalPages,
            itemsCount: data.items.length,
            hasMore: data.hasMore
        });

        const mediaList = document.getElementById('mediaList');
        
        // Create a document fragment for better performance
        const fragment = document.createDocumentFragment();
        
        // Append each media item to the fragment
        data.items.forEach(item => {
            const mediaItem = createMediaItem(item);
            fragment.appendChild(mediaItem);
        });
        
        // Append the fragment to the list
        mediaList.appendChild(fragment);

        // Store the items in our global array
        if (currentPage === 1) {
            mediaItems = data.items;
        } else {
            mediaItems = [...mediaItems, ...data.items];
        }

        // Update pagination info
        updatePaginationInfo(data);

        // Update hasMore flag based on whether there are more pages
        hasMore = data.hasMore;
        currentPage = data.currentPage + 1;
        retryCount = 0; // Reset retry count on successful load

        console.log('Updated state:', {
            currentPage,
            hasMore,
            totalItems: mediaItems.length
        });
    } catch (error) {
        console.error('Error loading media items:', error);
        
        // Implement retry logic
        if (retryCount < MAX_RETRIES) {
            retryCount++;
            console.log(`Retrying load (attempt ${retryCount}/${MAX_RETRIES})...`);
            setTimeout(loadMediaItems, 1000 * retryCount); // Exponential backoff
        } else {
            // Show error message to user
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = 'Failed to load more items. Please try refreshing the page.';
            document.getElementById('mediaList').appendChild(errorDiv);
        }
    } finally {
        isLoading = false;
        document.getElementById('loading').style.display = 'none';
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Create modal elements first
    const modal = createModal();
    
    // Filter event listeners
    const searchInput = document.getElementById('search');
    const typeSelect = document.getElementById('type');
    const dateFromInput = document.getElementById('dateFrom');
    const dateToInput = document.getElementById('dateTo');
    const hasLocationCheckbox = document.getElementById('hasLocation');
    const prevButton = document.getElementById('prevButton');
    const nextButton = document.getElementById('nextButton');

    if (searchInput) {
        searchInput.addEventListener('input', debounce(updateFilters, 300));
    }
    if (typeSelect) {
        typeSelect.addEventListener('change', updateFilters);
    }
    if (dateFromInput) {
        dateFromInput.addEventListener('change', updateFilters);
    }
    if (dateToInput) {
        dateToInput.addEventListener('change', updateFilters);
    }
    if (hasLocationCheckbox) {
        hasLocationCheckbox.addEventListener('change', updateFilters);
    }

    // Modal close button
    const modalClose = modal.querySelector('.modal-close');
    if (modalClose) {
        modalClose.addEventListener('click', closeMediaViewer);
    }

    // Modal background click
    modal.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeMediaViewer();
        }
    });

    // Navigation buttons
    if (prevButton) {
        prevButton.addEventListener('click', () => navigateMedia(-1));
    }
    if (nextButton) {
        nextButton.addEventListener('click', () => navigateMedia(1));
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        const modal = document.querySelector('.modal');
        if (modal && modal.style.display === 'block') {
            switch (e.key) {
                case 'Escape':
                    closeMediaViewer();
                    break;
                case 'ArrowLeft':
                    navigateMedia(-1);
                    break;
                case 'ArrowRight':
                    navigateMedia(1);
                    break;
            }
        }
    });

    // Infinite scroll with improved detection
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        
        scrollTimeout = setTimeout(() => {
            const scrollPosition = window.innerHeight + window.scrollY;
            const documentHeight = document.body.offsetHeight;
            const scrollThreshold = 500; // Reduced threshold for earlier loading
            
            if (documentHeight - scrollPosition <= scrollThreshold && !isLoading && hasMore) {
                console.log('Scroll threshold reached, loading more items');
                loadMediaItems();
            }
        }, 100);
    });

    // Initial load
    loadMediaItems();
});

// Debounce helper function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Helper function to format time
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
} 