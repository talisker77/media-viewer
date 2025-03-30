let currentPage = 1;
let isLoading = false;
let hasMore = true;
let filters = {};
let currentMediaIndex = 0;
let mediaItems = [];
let keyboardShortcutsTimeout;

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString();
}

function createMediaItem(item) {
    const mediaItem = document.createElement('div');
    mediaItem.className = 'media-item';
    mediaItem.dataset.type = item.type;
    mediaItem.dataset.date = item.date;
    mediaItem.dataset.size = item.size;
    mediaItem.dataset.hasLocation = item.hasLocation;

    // Get the folder name from the path
    const pathParts = item.path.split('/');
    // Get the second-to-last part of the path (the folder name)
    const folderName = pathParts.length > 1 ? pathParts[pathParts.length - 2] : 'Root';
    
    mediaItem.innerHTML = `
        <div class="media-info">
            <div class="media-name" data-path="${item.path}">${item.name}</div>
            <div class="media-folder">${folderName}</div>
            <div class="media-meta">
                <span class="media-date">${formatDate(item.date)}</span>
                <span class="media-size">${formatFileSize(item.size)}</span>
                ${item.hasLocation ? '<span class="media-location">📍</span>' : ''}
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
        ${item.directory} • ${formatFileSize(item.size)} • ${formatDate(item.date)}
        ${item.hasLocation ? ' • 📍' : ''}
    `;
    
    // Show loading spinner
    loadingSpinner.style.display = 'block';
    mediaContainer.innerHTML = '';
    
    // Create media element
    const mediaElement = item.type === 'image' 
        ? document.createElement('img')
        : document.createElement('video');
    
    mediaElement.className = `media-viewer ${item.type}`;
    if (item.type === 'video') {
        mediaElement.controls = true;
    }
    
    // Load media
    const mediaUrl = `/media/${encodeURIComponent(item.path)}`;
    console.log('Loading media from URL:', mediaUrl);
    
    mediaElement.onload = () => {
        console.log('Media loaded successfully');
        loadingSpinner.style.display = 'none';
        mediaContainer.appendChild(mediaElement);
    };

    mediaElement.onerror = (error) => {
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
    
    mediaElement.src = mediaUrl;
    
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
    nextButton.disabled = currentMediaIndex === mediaItems.length - 1;
}

function navigateMedia(direction) {
    const newIndex = currentMediaIndex + direction;
    if (newIndex >= 0 && newIndex < mediaItems.length) {
        currentMediaIndex = newIndex;
        showMediaViewer(mediaItems[currentMediaIndex]);
    }
}

function closeMediaViewer() {
    const modal = document.querySelector('.modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        const mediaContainer = document.getElementById('mediaContainer');
        mediaContainer.innerHTML = '';
    }
}

async function loadMediaItems() {
    if (isLoading || !hasMore) return;
    
    isLoading = true;
    document.getElementById('loading').style.display = 'block';

    try {
        const params = new URLSearchParams({
            page: currentPage,
            itemsPerPage: 20,
            ...filters
        });

        console.log('Fetching media items with params:', params.toString());
        const response = await fetch(`/api/media?${params}`);
        const data = await response.json();
        console.log('Received media data:', {
            totalItems: data.totalItems,
            currentPage: data.currentPage,
            totalPages: data.totalPages,
            itemsCount: data.items.length
        });

        const mediaList = document.getElementById('mediaList');
        // Append each media item directly to the list
        data.items.forEach(item => {
            const mediaItem = createMediaItem(item);
            mediaList.appendChild(mediaItem);
        });

        // Store the items in our global array
        mediaItems = [...mediaItems, ...data.items];
        console.log('Updated mediaItems array:', {
            totalItems: mediaItems.length,
            lastLoadedPage: currentPage
        });

        hasMore = currentPage < data.totalPages;
        currentPage++;
    } catch (error) {
        console.error('Error loading media items:', error);
    } finally {
        isLoading = false;
        document.getElementById('loading').style.display = 'none';
    }
}

function updateFilters() {
    filters = {
        search: document.getElementById('search').value,
        type: document.getElementById('type').value,
        dateFrom: document.getElementById('dateFrom').value,
        dateTo: document.getElementById('dateTo').value,
        hasLocation: document.getElementById('hasLocation').checked
    };

    // Reset pagination
    currentPage = 1;
    hasMore = true;
    document.getElementById('mediaList').innerHTML = '';
    loadMediaItems();
}

// Debounce helper
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

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Event listeners
    document.getElementById('search').addEventListener('input', debounce(updateFilters, 300));
    document.getElementById('type').addEventListener('change', updateFilters);
    document.getElementById('dateFrom').addEventListener('change', updateFilters);
    document.getElementById('dateTo').addEventListener('change', updateFilters);
    document.getElementById('hasLocation').addEventListener('change', updateFilters);

    // Media viewer event listeners
    document.addEventListener('click', (e) => {
        const mediaName = e.target.closest('.media-name');
        if (mediaName) {
            e.preventDefault();
            const path = mediaName.dataset.path;
            console.log('Media item clicked:', path);
            
            // Find the item in our global mediaItems array
            const mediaItem = mediaItems.find(item => item.path === path);
            if (mediaItem) {
                console.log('Found media item:', mediaItem);
                showMediaViewer(mediaItem);
            } else {
                console.error('Media item not found in array:', path);
                console.log('Available items:', mediaItems);
            }
        }
    });

    // Modal controls
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-close')) {
            closeMediaViewer();
        }
        if (e.target.id === 'prevButton') {
            navigateMedia(-1);
        }
        if (e.target.id === 'nextButton') {
            navigateMedia(1);
        }
    });

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

    // Infinite scroll
    window.addEventListener('scroll', () => {
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 1000) {
            loadMediaItems();
        }
    });

    // Initial load
    loadMediaItems();
}); 