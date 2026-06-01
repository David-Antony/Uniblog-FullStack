// ==================== Configuration & Constants ====================

// API Endpoints configuration
const API_ENDPOINTS = {
    POSTS: '/posts',
    DESIGN_ITEMS: '/design-items',
    STATIC_BLOG_ITEMS: '/static-blog-items',
    ACHIEVERS: '/achievers',
    LOGIN: '/api/login',
    HEALTH: '/api/health'
};

// Default categories for filtering
const DEFAULT_CATEGORIES = new Set(["Announcement", "Design", "News", "General"]);

// User roles
const USER_ROLES = {
    ADMIN: 'admin',
    STUDENT: 'student'
};

// Retry configuration for API calls
const RETRY_CONFIG = {
    maxRetries: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 10000 // 10 seconds
};

// ==================== Toast Notification System ====================

let toastContainer = null;

function getToastContainer() {
    if (!toastContainer || !document.body.contains(toastContainer)) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    return toastContainer;
}

/**
 * Show a toast notification.
 * @param {string} message - The message to display
 * @param {'success'|'error'|'warning'|'info'} type - Toast type
 * @param {number} [duration=3500] - Auto-dismiss in ms (0 = manual dismiss only)
 */
function showToast(message, type = 'info', duration = 3500) {
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${icons[type] || icons.info}" aria-hidden="true"></i>
        <span class="toast-msg">${sanitizeHTML(message)}</span>
        <button class="toast-close" aria-label="Dismiss">&times;</button>
    `;
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => dismissToast(toast));
    if (duration > 0) {
        const timer = setTimeout(() => dismissToast(toast), duration);
        toast._timer = timer;
        closeBtn.addEventListener('click', () => clearTimeout(timer));
    }
    getToastContainer().appendChild(toast);
    return toast;
}

function dismissToast(toast) {
    if (toast._dismissing) return;
    toast._dismissing = true;
    if (toast._timer) clearTimeout(toast._timer);
    toast.classList.add('toast-exit');
    toast.addEventListener('animationend', () => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    });
}

/**
 * Show a confirmation dialog as a toast with "Yes" / "No" buttons.
 * Returns a Promise that resolves to true (confirmed) or false (cancelled).
 */
function showConfirmToast(message) {
    return new Promise((resolve) => {
        const toast = document.createElement('div');
        toast.className = 'toast toast-warning';
        toast.style.minWidth = '320px';
        toast.innerHTML = `
            <i class="fas fa-question-circle" aria-hidden="true"></i>
            <span class="toast-msg">${sanitizeHTML(message)}</span>
            <button class="toast-confirm-yes" style="background:var(--exDark);color:#fff;border:none;padding:0.3rem 0.7rem;border-radius:4px;cursor:pointer;font-size:0.8rem;margin-left:0.4rem;">Yes</button>
            <button class="toast-confirm-no" style="background:transparent;color:inherit;border:1px solid;padding:0.3rem 0.7rem;border-radius:4px;cursor:pointer;font-size:0.8rem;">No</button>
        `;
        const yesBtn = toast.querySelector('.toast-confirm-yes');
        const noBtn = toast.querySelector('.toast-confirm-no');
        const cleanup = (result) => {
            resolve(result);
            dismissToast(toast);
        };
        yesBtn.addEventListener('click', () => cleanup(true));
        noBtn.addEventListener('click', () => cleanup(false));
        getToastContainer().appendChild(toast);
    });
}

// ==================== State Management ====================

let postsCache = [];
let designItemsCache = [];
let staticBlogItemsCache = [];
let achieversCache = [];
let selectedCategories = new Set(DEFAULT_CATEGORIES);
let currentPage = 1;
const POSTS_PER_PAGE = 6;

// ==================== Utility Functions ====================

// Debounce function to limit how often a function runs (e.g., search-as-you-type)
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

// Sanitize HTML to prevent XSS attacks when displaying user content
function sanitizeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<script\b[^>]*\/?>/gi, '')
        .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/\bon\w+\s*=\s*[^\s>]+/gi, '')
        .replace(/javascript\s*:/gi, '')
        .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '');
}

// Centralized error handler — logs to console and optionally shows an alert
function handleError(error, context = 'Operation', showAlert = true) {
    console.error(`❌ ${context} error:`, error);
    
    if (showAlert) {
        const userMessage = error.message || 'An unexpected error occurred. Please try again.';
        showToast(`${context} failed: ${userMessage}`, 'error');
    }
}

// Calculate estimated read time from content (HTML or plain text)
function calculateReadTime(content) {
    if (!content) return 1;
    // Strip HTML tags, count words, assume 200 words per minute
    const text = content.replace(/<[^>]*>/g, '');
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    return Math.max(1, Math.ceil(wordCount / 200));
}

// ==================== Shared Entity Helpers ====================

// Update a cache array's like data for the matching item (used by all toggle-like functions)
function updateCacheLike(cacheArr, itemIdStr, data) {
    return cacheArr.map(item => {
        const curId = idToString(item._id);
        return curId === itemIdStr
            ? { ...item, likeCount: data.likeCount || 0, likedBy: data.likedBy || [] }
            : item;
    });
}

// Generic delete: confirm → DELETE request → refresh callback
// Used by deletePost, deleteDesignItem, deleteStaticBlogItem, deleteAchiever
async function deleteEntity(endpoint, id, confirmMsg, label, onSuccess) {
    if (!await showConfirmModal(confirmMsg)) return;
    try {
        const res = await fetchWithRetry(`${endpoint}/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        const data = await res.json();
        if (data.success) {
            onSuccess();
        } else {
            handleError(new Error(data.message || 'Unknown error'), `Delete ${label}`);
        }
    } catch (err) {
        handleError(err, `Delete ${label}`);
    }
}

// Generic form submit: validate → POST/PUT → close modal → refresh → alert
// Used by handleDesignFormSubmit, handleStaticBlogFormSubmit, handleAchieverFormSubmit
async function submitEntityForm(formId, itemIdField, endpoint, bodyBuilder, validator, modalCloseFn, refreshFn, label) {
    const itemId = document.getElementById(itemIdField).value;
    
    const errorMsg = validator();
    if (errorMsg) { showToast(errorMsg, 'warning'); return; }
    
    try {
        const url = itemId ? `${endpoint}/${itemId}` : endpoint;
        const method = itemId ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
            method: method,
            headers: getAuthHeaders(),
            body: JSON.stringify(bodyBuilder())
        });
        const data = await res.json();
        
        if (data.success) {
            modalCloseFn();
            refreshFn();
            showToast(itemId ? `${label} updated successfully!` : `${label} added successfully!`, 'success');
            document.getElementById(formId).reset();
            document.getElementById(itemIdField).value = '';
        } else {
            showToast(`Failed: ${data.message || 'Unknown error'}`, 'error');
        }
    } catch (err) {
        console.error(`❌ Error saving ${label.toLowerCase()}:`, err);
        showToast(`Failed to save ${label.toLowerCase()}. Check server/console.`, 'error');
    }
}

// Fetch wrapper with exponential backoff retry for flaky connections
async function fetchWithRetry(url, options = {}, retries = RETRY_CONFIG.maxRetries) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }
        return response;
    } catch (error) {
        if (retries <= 0) {
            throw error;
        }
        
        const delay = Math.min(
            RETRY_CONFIG.initialDelay * Math.pow(2, RETRY_CONFIG.maxRetries - retries),
            RETRY_CONFIG.maxDelay
        );
        
        console.warn(`⚠️ Request failed, retrying in ${delay}ms... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return fetchWithRetry(url, options, retries - 1);
    }
}

// Show a loading spinner on a button (disable during async operations)
function setButtonLoading(button, isLoading, originalText) {
    if (isLoading) {
        button.disabled = true;
        button.dataset.originalText = originalText || button.textContent;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    } else {
        button.disabled = false;
        button.textContent = button.dataset.originalText || originalText;
    }
}

// Show a custom confirmation dialog (returns a promise that resolves to true/false)
function showConfirmModal(message) {
    return new Promise((resolve) => {
        let modal = document.getElementById('customConfirmModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'customConfirmModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 400px; text-align: center;">
                    <button class="close" onclick="closeConfirmModal(false)" aria-label="Close modal">
                        <span aria-hidden="true">&times;</span>
                    </button>
                    <h3 style="margin-bottom: 1rem;">Confirm Action</h3>
                    <p id="confirmMessage" style="margin-bottom: 1.5rem; color: var(--muted);">${message}</p>
                    <div style="display: flex; gap: 1rem; justify-content: center;">
                        <button id="confirmYes" class="btn-danger" style="padding: 0.6rem 1.5rem; border-radius: var(--border-radius-md); border: none; background: var(--danger); color: white; cursor: pointer;">Yes</button>
                        <button id="confirmNo" class="btn-secondary" style="padding: 0.6rem 1.5rem; border-radius: var(--border-radius-md); border: 1px solid #ddd; background: white; color: var(--dark); cursor: pointer;">No</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        } else {
            document.getElementById('confirmMessage').textContent = message;
        }
        
        modal.style.display = 'block';
        
        const yesBtn = document.getElementById('confirmYes');
        const noBtn = document.getElementById('confirmNo');
        
        const cleanup = () => {
            yesBtn.removeEventListener('click', onYes);
            noBtn.removeEventListener('click', onNo);
        };
        
        const onYes = () => {
            modal.style.display = 'none';
            cleanup();
            resolve(true);
        };
        
        const onNo = () => {
            modal.style.display = 'none';
            cleanup();
            resolve(false);
        };
        
        yesBtn.addEventListener('click', onYes);
        noBtn.addEventListener('click', onNo);
    });
}

// Close the custom confirm modal programmatically
function closeConfirmModal(result) {
    const modal = document.getElementById('customConfirmModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Create an empty-state placeholder element
function createEmptyState(message, icon = 'fas fa-inbox') {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.innerHTML = `
        <i class="${icon}" style="font-size: 3rem; color: var(--muted); margin-bottom: 1rem;"></i>
        <p style="color: var(--muted); font-size: 1.1rem;">${message}</p>
    `;
    return div;
}

// ==================== Authentication ====================

// Get current user role from localStorage
function getUserRole() {
    return localStorage.getItem('role');
}

// Get current username from localStorage
function getUsername() {
    return localStorage.getItem('username');
}

// Check if a user is currently logged in
function isAuthenticated() {
    return !!(localStorage.getItem('token'));
}

// Check if the current user has admin privileges
function isAdmin() {
    return getUserRole() === USER_ROLES.ADMIN;
}

// Decode JWT payload (client-side only — for display purposes)
function decodeToken() {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload;
    } catch {
        return null;
    }
}

// Redirect to login page if not authenticated
function checkAuth() {
    if (!isAuthenticated()) {
        // Only redirect if not already on the login page
        if (!window.location.pathname.includes('LOGIN_PAGE.html')) {
            window.location.href = 'LOGIN_PAGE.html';
        }
    }
}

// Show the current username and role in the navbar
function displayUsername() {
    const username = getUsername();
    const role = getUserRole();
    const usernameDisplay = document.getElementById('username-display');
    
    if (usernameDisplay && username) {
        usernameDisplay.textContent = `Welcome, ${username} (${role})`;
    }
}

// Control blog page link visibility based on user role
// Students see no "Add Post" link; admins see it; guests get redirected to login
function configureBlogLink() {
    const blogLink = document.getElementById('blogLink');
    if (!blogLink) return;

    const role = getUserRole();

    if (role === USER_ROLES.STUDENT) {
        blogLink.style.display = 'none';
    } else if (role === USER_ROLES.ADMIN) {
        blogLink.style.display = 'inline-block';
    } else {
        blogLink.addEventListener('click', function (event) {
            event.preventDefault();
            showToast("Please log in first.", 'warning');
            window.location.href = "LOGIN_PAGE.html";
        });
    }
}

// ==================== ID & Modal Helpers ====================

// Convert a MongoDB ObjectId (or string) to a plain string
function idToString(id) {
    if (!id) return '';
    return typeof id === 'string' ? id : (id.$oid || String(id));
}

// Open a modal overlay by its element ID
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = "block";
    }
}

// Close a modal overlay by its element ID
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = "none";
    }
}

// Close all currently open modals (useful for Escape key)
function closeAllModals() {
    const modals = document.querySelectorAll('.modal, .form-modal');
    modals.forEach(modal => {
        if (modal.style.display === 'block') {
            modal.style.display = 'none';
        }
    });
}

// Attach global modal behavior: ESC to close, click-outside to close
function setupModalEventListeners() {
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeAllModals();
        }
    });

    const modals = document.querySelectorAll('.modal, .form-modal');
    modals.forEach(modal => {
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
}

// Convert newlines to <br> tags for safe display (used in "Read More" modals)
function formatContent(text) {
    if (!text) return '';
    return sanitizeHTML(text).replace(/\n/g, '<br>');
}

// Build the headers object sent with every authenticated API request
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json'
    };
    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }
    // Keep legacy headers as fallback for backward compat
    const username = getUsername();
    const role = getUserRole();
    if (username) headers['x-username'] = username;
    if (role) headers['x-role'] = role;
    return headers;
}

// ==================== Blog Posts CRUD ====================

// Fetch all blog posts from the server and render them
async function fetchPosts(page = 1) {
    console.log(`🔄 Fetching posts (page ${page})...`);
    const postsContainer = document.getElementById('blogContainer');
    
    if (postsContainer && page === 1) {
        postsContainer.innerHTML = '<div class="loading">⏳ Loading latest posts...</div>';
    }
    
    try {
        const res = await fetch(`${API_ENDPOINTS.POSTS}?page=${page}&limit=${POSTS_PER_PAGE}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        
        const data = await res.json();
        
        // Handle both paginated response and raw array (backward compat)
        if (data.items) {
            postsCache = data.items;
            currentPage = data.page;
            renderPosts(postsCache);
            renderPaginationControls(data.totalPages, data.page);
            // Update stat counter if exists
            const stat = document.getElementById('stat-posts');
            if (stat) stat.textContent = data.totalItems;
            // Fetch comment counts for each visible post
            postsCache.forEach(async post => {
                const count = await fetchCommentCount(idToString(post._id));
                const badge = document.getElementById(`comment-count-${idToString(post._id)}`);
                if (badge) badge.innerHTML = `<i class="far fa-comment"></i> ${count} comments`;
            });
        } else if (Array.isArray(data)) {
            postsCache = data;
            renderPosts(postsCache);
            // Fetch comment counts for each visible post
            postsCache.forEach(async post => {
                const count = await fetchCommentCount(idToString(post._id));
                const badge = document.getElementById(`comment-count-${idToString(post._id)}`);
                if (badge) badge.innerHTML = `<i class="far fa-comment"></i> ${count} comments`;
            });
        }
        
        console.log(`✅ Fetched ${postsCache.length} posts`);
        setupFilters();
    } catch (err) {
        handleError(err, 'Fetch posts');
        handleFetchError(postsContainer, 'posts');
    }
}

// Show a helpful error message when data fails to load
function handleFetchError(container, itemType) {
    const section = document.getElementById(`dynamic-${itemType}`);
    
    if (container) {
        container.innerHTML = `
            <div class="error">
                <p>🚫 No ${itemType} loaded. Check console/server.</p>
                <p><strong>Troubleshoot:</strong></p>
                <ul>
                    <li>Server running? <code>node server.js</code></li>
                    <li>MongoDB connected?</li>
                    ${itemType === 'posts' ? `<li><a href="blog.html" ${!isAdmin() ? 'style="pointer-events:none;opacity:0.5"' : ''}>Add first post</a></li>` : ''}
                </ul>
            </div>
        `;
    }
    if (section) section.style.display = 'block';
}

// Render the array of posts into the blog posts grid
function renderPosts(posts) {
    const postsContainer = document.getElementById('blogContainer');
    const section = document.getElementById('dynamic-blog-posts');
    
    if (!postsContainer) return;
    postsContainer.innerHTML = '';

    // Clean up any existing show-more button from a previous render
    const existingBtn = document.getElementById('show-more-posts-btn');
    if (existingBtn) existingBtn.remove();

    if (!posts || !posts.length) {
        postsContainer.innerHTML = '<p class="empty-posts">📭 No posts yet. <a href="blog.html">Add the first post!</a></p>';
        if (section) section.style.display = 'block';
        return;
    }
    if (section) section.style.display = 'block';

    const VISIBLE_COUNT = 4;

    posts.forEach((post, index) => {
        const postElement = createPostElement(post);
        if (index >= VISIBLE_COUNT) {
            postElement.classList.add('post-hidden');
        }
        postsContainer.appendChild(postElement);
    });

    // Show More / Show Less toggle button
    if (posts.length > VISIBLE_COUNT) {
        const button = document.createElement('button');
        button.id = 'show-more-posts-btn';
        button.className = 'show-more-btn';
        button.textContent = `Show More (${posts.length - VISIBLE_COUNT} more)`;
        button.addEventListener('click', function () {
            const hiddenPosts = postsContainer.querySelectorAll('.blog-post.post-hidden');
            if (hiddenPosts.length > 0) {
                hiddenPosts.forEach(el => el.classList.remove('post-hidden'));
                button.textContent = 'Show Less';
            } else {
                const allPosts = postsContainer.querySelectorAll('.blog-post');
                allPosts.forEach((el, i) => {
                    if (i >= VISIBLE_COUNT) el.classList.add('post-hidden');
                });
                button.textContent = `Show More (${posts.length - VISIBLE_COUNT} more)`;
            }
        });
        postsContainer.insertAdjacentElement('afterend', button);
    }

    attachPostEventListeners();
    setupReveal();
}

// Build a single blog post card DOM element
function createPostElement(post) {
    const postElement = document.createElement('div');
    postElement.classList.add('blog-post');

    const postId = idToString(post._id);
    const username = getUsername();
    const liked = post.likedBy && username ? post.likedBy.includes(username) : false;
    const likeCount = post.likeCount || 0;
    const shareCount = post.shareCount || 0;
    const category = post.category || 'General';
    const viewCount = post.viewCount || 0;

    // Admin-only action buttons
    const deleteButton = isAdmin()
        ? `<button class="delete-btn" onclick="deletePost('${postId}')">Delete Post</button>`
        : '';
    const editButton = isAdmin()
        ? `<button class="edit-btn" onclick="editPost('${postId}')"><i class="fas fa-edit"></i> Edit</button>`
        : '';

    const postStats = `
        <div class="post-stats">
            <span class="post-stat"><i class="far fa-eye"></i> ${viewCount} views</span>
            <span class="post-stat"><i class="far fa-clock"></i> ${calculateReadTime(post.content)} min read</span>
            <span class="post-stat" id="comment-count-${postId}">
                <i class="far fa-comment"></i> <span>...</span> comments
            </span>
        </div>
    `;

    postElement.innerHTML = `
        <img src="${post.image}" alt="${sanitizeHTML(post.title)}" loading="lazy" />
        <div class="content">
            <span class="pill">${sanitizeHTML(category)}</span>
            <h3>${sanitizeHTML(post.title)}</h3>
            <p>${sanitizeHTML(post.description)}</p>
            ${postStats}
            <div class="post-actions">
                <button class="read-more-btn" onclick="openReadMoreModal('${postId}')">
                    <i class="fas fa-book-open"></i> Read More
                </button>
                <button class="like-btn ${liked ? 'liked' : ''}" data-id="${postId}">
                    <i class="fas fa-heart"></i>
                    <span class="like-count">${likeCount}</span>
                </button>
                <button class="share-btn" data-id="${postId}" data-title="${post.title.replace(/"/g, '"')}">
                    <i class="fas fa-share"></i> ${shareCount}
                </button>
                ${editButton}
                ${deleteButton}
            </div>
        </div>
    `;
    postElement.classList.add('reveal');

    return postElement;
}

// Bind click handlers to all like and share buttons after rendering
function attachPostEventListeners() {
    document.querySelectorAll('.like-btn').forEach(btn => {
        btn.addEventListener('click', () => toggleLike(btn.dataset.id));
    });
    document.querySelectorAll('.share-btn').forEach(btn => {
        btn.addEventListener('click', () => sharePost(btn.dataset.id, btn.dataset.title));
    });
}

// Delete a blog post with confirmation (admin only) — delegates to shared deleteEntity
async function deletePost(id) {
    await deleteEntity(API_ENDPOINTS.POSTS, id,
        'Are you sure you want to delete this post?', 'post',
        () => fetchPosts());
}

// Toggle the like state on a blog post (like if not liked, unlike if already liked)
function toggleLike(id) {
    const username = getUsername();
    if (!username) { showToast('Please log in to like posts.', 'warning'); return; }
    
    console.log(`❤️ Toggling like for post ${id} (user: ${username})`);
    const pid = idToString(id);
    
    const likeButton = document.querySelector(`.like-btn[data-id="${id}"]`);
    if (likeButton) setButtonLoading(likeButton, true);
    
    fetchWithRetry(`${API_ENDPOINTS.POSTS}/${id}/like`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({})
    })
    .then(res => res.json())
    .then(data => {
        console.log('✅ Like response:', data);
        if (data.success) {
            postsCache = updateCacheLike(postsCache, pid, data);
            renderPosts(postsCache);
        } else {
            handleError(new Error(data.message || 'Unknown error'), 'Like post');
        }
    })
    .catch(err => handleError(err, 'Like post'))
    .finally(() => {
        if (likeButton) setButtonLoading(likeButton, false);
    });
}

// Share a blog post (uses Web Share API with clipboard fallback)
async function sharePost(id, title) {
    const shareButton = document.querySelector(`.share-btn[data-id="${id}"]`);
    if (shareButton) {
        setButtonLoading(shareButton, true);
    }
    
    // Increment server-side share count (fire-and-forget)
    try {
        await fetchWithRetry(`${API_ENDPOINTS.POSTS}/${id}/share`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
    } catch (err) {
        console.warn('Failed to increment share count:', err);
    }

    const shareData = {
        title: title || 'Blog post',
        text: title || 'Check this post',
        url: window.location.origin + '/homepage.html'
    };
    
    try {
        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.warn('Share cancelled', err);
            }
        } else {
            try {
                await navigator.clipboard.writeText(shareData.url);
                showToast('Link copied to clipboard!', 'success');
            } catch (err) {
                showToast('Failed to copy link. Please try again.', 'error');
            }
        }
    } finally {
        if (shareButton) {
            setButtonLoading(shareButton, false);
        }
    }
}

// Redirect to the blog editor page, pre-filling form fields with the post's current data
function editPost(postId) {
    const post = postsCache.find(p => idToString(p._id) === postId);
    if (post) {
        sessionStorage.setItem('editPostId', postId);
        sessionStorage.setItem('editPostTitle', post.title);
        sessionStorage.setItem('editPostCategory', post.category);
        sessionStorage.setItem('editPostDescription', post.description);
        sessionStorage.setItem('editPostContent', post.content || '');
        sessionStorage.setItem('editPostImage', post.image);
        window.location.href = 'blog.html?edit=true';
    }
}

// Open the "Read More" modal with the full content of a blog post
function openReadMoreModal(postId) {
    const post = postsCache.find(p => idToString(p._id) === postId);
    if (!post) return;

    window._currentPostId = postId;

    // Use the content field if available, otherwise fall back to description
    const content = post.content || post.description;
    
    let modal = document.getElementById('readMoreModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'readMoreModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close" onclick="closeModal('readMoreModal')">&times;</span>
                <h2 id="readMoreTitle"></h2>
                <div id="readMoreContent"></div>
                <div class="comments-section">
                    <h4><i class="fas fa-comments"></i> Comments</h4>
                    <div id="comments-list"></div>
                    <input type="hidden" id="comment-parent-id" value="">
                    <div id="reply-indicator" style="display: none; padding: 0.3rem 0; color: var(--muted); font-size: var(--font-size-sm);"></div>
                    <div class="comment-form">
                        <textarea id="comment-body" placeholder="Write a comment..." rows="3"></textarea>
                        <button class="btn-primary" onclick="submitComment(window._currentPostId)">Post Comment</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    document.getElementById('readMoreTitle').textContent = post.title;
    const contentDiv = document.getElementById('readMoreContent');
    contentDiv.innerHTML = formatContent(content);
    
    modal.style.display = 'block';
    
    // Load comments section
    loadComments(postId);
}

// ==================== Pagination Controls ====================

function renderPaginationControls(totalPages, currentPage) {
    let container = document.getElementById('pagination-controls');
    if (!container) {
        container = document.createElement('div');
        container.id = 'pagination-controls';
        container.className = 'pagination-container';
        const blogContainer = document.getElementById('blogContainer');
        if (blogContainer && blogContainer.parentNode) {
            blogContainer.parentNode.insertBefore(container, blogContainer.nextSibling);
        }
    }
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '<div class="pagination">';
    
    // Previous button
    html += `<button class="page-btn ${currentPage === 1 ? 'disabled' : ''}" 
        onclick="fetchPosts(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
        <i class="fas fa-chevron-left"></i> Prev</button>`;
    
    // Page numbers
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);
    
    if (start > 1) {
        html += `<button class="page-btn" onclick="fetchPosts(1)">1</button>`;
        if (start > 2) html += '<span class="page-ellipsis">...</span>';
    }
    
    for (let i = start; i <= end; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" 
            onclick="fetchPosts(${i})">${i}</button>`;
    }
    
    if (end < totalPages) {
        if (end < totalPages - 1) html += '<span class="page-ellipsis">...</span>';
        html += `<button class="page-btn" onclick="fetchPosts(${totalPages})">${totalPages}</button>`;
    }
    
    // Next button
    html += `<button class="page-btn ${currentPage === totalPages ? 'disabled' : ''}" 
        onclick="fetchPosts(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
        Next <i class="fas fa-chevron-right"></i></button>`;
    
    html += '</div>';
    container.innerHTML = html;
    
    // Scroll to top of posts
    document.getElementById('blog')?.scrollIntoView({ behavior: 'smooth' });
}

// ==================== Design Items (Announcements) CRUD ====================

// Fetch all design/announcement items from the server
async function fetchDesignItems() {
    console.log('🔄 Fetching design items from /design-items...');
    const designContainer = document.getElementById('designContainer');
    
    if (designContainer) {
        designContainer.innerHTML = '<div class="loading">⏳ Loading announcements...</div>';
    }
    
    try {
        const res = await fetch(API_ENDPOINTS.DESIGN_ITEMS);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        
        const data = await res.json();
        designItemsCache = data.items || (Array.isArray(data) ? data : []);
        console.log(`✅ Fetched ${designItemsCache.length} design items`);
        
        renderDesignItems(designItemsCache);
    } catch (err) {
        console.error("❌ Error fetching design items:", err);
        handleFetchError(designContainer, 'design items');
    }
}

// Render design/announcement items into the grid
function renderDesignItems(items) {
    const designContainer = document.getElementById('designContainer');
    if (!designContainer) return;
    
    designContainer.innerHTML = '';

    if (!items || !items.length) {
        designContainer.innerHTML = '<p class="empty-posts">📭 No announcements yet.</p>';
        return;
    }

    items.forEach((item, index) => {
        const itemElement = createDesignItemElement(item);
        designContainer.appendChild(itemElement);
    });

    setupReveal();
}

// Build a single design/announcement card
function createDesignItemElement(item) {
    const itemId = idToString(item._id);
    const username = getUsername();
    const liked = item.likedBy && username ? item.likedBy.includes(username) : false;
    const likeCount = item.likeCount || 0;
    const category = item.category || 'Announcement';

    const deleteButton = isAdmin()
        ? `<button class="delete-design-btn" onclick="deleteDesignItem('${itemId}')"><i class="fas fa-trash"></i></button>`
        : '';
    const editButton = isAdmin()
        ? `<button class="edit-design-btn" onclick="editDesignItem('${itemId}')"><i class="fas fa-edit"></i></button>`
        : '';

    const itemElement = document.createElement('div');
    itemElement.classList.add('design-item');
    itemElement.innerHTML = `
        <div class="design-img">
            <img src="${item.imageUrl}" alt="${sanitizeHTML(item.title)}" loading="lazy">
            <span class="heart ${liked ? 'liked' : ''}" onclick="toggleDesignLike('${itemId}')">
                <i class="${liked ? 'fas' : 'far'} fa-heart"></i>
                <span class="count">${likeCount}</span>
            </span>
            <span>${sanitizeHTML(category)}</span>
        </div>
        <div class="design-title">
            <p>${sanitizeHTML(item.title)}</p>
            <div class="design-actions">
                ${editButton}
                ${deleteButton}
            </div>
        </div>
    `;
    itemElement.classList.add('reveal');

    return itemElement;
}

// Open the design/announcement modal in "add" mode
function openDesignModal() {
    document.getElementById('designModalTitle').textContent = 'Add New Announcement';
    document.getElementById('designItemId').value = '';
    document.getElementById('designTitle').value = '';
    document.getElementById('designImageUrl').value = '';
    document.getElementById('designCategory').value = '';
    document.getElementById('designLikeCount').value = '0';
    openModal('designModal');
}

// Close the design/announcement modal
function closeDesignModal() {
    closeModal('designModal');
}

// Handle form submission for adding or editing a design item — delegates to shared submitEntityForm
async function handleDesignFormSubmit(event) {
    event.preventDefault();
    await submitEntityForm(
        'designForm', 'designItemId', API_ENDPOINTS.DESIGN_ITEMS,
        () => ({
            title: document.getElementById('designTitle').value.trim(),
            imageUrl: document.getElementById('designImageUrl').value.trim(),
            category: document.getElementById('designCategory').value,
            likeCount: parseInt(document.getElementById('designLikeCount').value) || 0
        }),
        () => {
            const t = document.getElementById('designTitle').value.trim();
            if (!t || t.length < 3) return 'Title must be at least 3 characters long.';
            const img = document.getElementById('designImageUrl').value.trim();
            if (!img || !isValidUrl(img)) return 'Please enter a valid image URL.';
            if (!document.getElementById('designCategory').value) return 'Please select a category.';
            if ((parseInt(document.getElementById('designLikeCount').value) || 0) < 0) return 'Like count cannot be negative.';
            return null;
        },
        closeDesignModal, fetchDesignItems, 'Announcement'
    );
}

// Open the design/announcement modal pre-filled for editing
function editDesignItem(id) {
    const item = designItemsCache.find(i => idToString(i._id) === id);
    if (!item) return;

    document.getElementById('designModalTitle').textContent = 'Edit Announcement';
    document.getElementById('designItemId').value = id;
    document.getElementById('designTitle').value = item.title || '';
    document.getElementById('designImageUrl').value = item.imageUrl || '';
    document.getElementById('designCategory').value = item.category || '';
    document.getElementById('designLikeCount').value = item.likeCount || 0;
    openModal('designModal');
}

// Delete a design item with confirmation — delegates to shared deleteEntity
async function deleteDesignItem(id) {
    await deleteEntity(API_ENDPOINTS.DESIGN_ITEMS, id,
        'Are you sure you want to delete this announcement?', 'announcement',
        () => { fetchDesignItems(); showToast('Announcement deleted successfully!', 'success'); });
}

// Toggle like/unlike on a design/announcement item
function toggleDesignLike(id) {
    const username = getUsername();
    if (!username) { showToast('Please log in to like announcements.', 'warning'); return; }
    
    console.log(`❤️ Toggling like for design item ${id} (user: ${username})`);
    
    fetchWithRetry(`${API_ENDPOINTS.DESIGN_ITEMS}/${id}/like`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({})
    })
    .then(res => res.json())
    .then(data => {
        console.log('✅ Like response:', data);
        if (data.success) {
            designItemsCache = updateCacheLike(designItemsCache, id, data);
            renderDesignItems(designItemsCache);
        } else {
            showToast(`Like failed: ${data.message || 'Unknown error'}`, 'error');
        }
    })
    .catch(err => handleError(err, 'Like design item'));
}

// ==================== Static Blog Items ====================

// Fetch all static blog items from the server
function fetchStaticBlogItems() {
    fetch(API_ENDPOINTS.STATIC_BLOG_ITEMS)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(items => {
            staticBlogItemsCache = items?.items || (Array.isArray(items) ? items : []);
            renderStaticBlogItems(staticBlogItemsCache);
        })
        .catch(err => {
            console.error('❌ Error fetching static blog items:', err);
            const container = document.getElementById('staticBlogContainer');
            if (container) {
                container.innerHTML = '<p class="error">Failed to load blog items. Please try again later.</p>';
            }
        });
}

// Render static blog items into the "Latest Blog" section
function renderStaticBlogItems(items) {
    const container = document.getElementById('staticBlogContainer');
    if (!container) return;
    
    container.innerHTML = '';

    if (!items || !items.length) {
        container.innerHTML = '<p class="empty-posts">📭 No blog items yet.</p>';
        return;
    }

    items.forEach((item) => {
        const itemElement = createStaticBlogItemElement(item);
        container.appendChild(itemElement);
    });

    setupReveal();
}

// Build a single static blog item card
function createStaticBlogItemElement(item) {
    const itemElement = document.createElement('article');
    itemElement.className = 'blog-item';
    
    const itemId = idToString(item._id);
    const isAdminUser = isAdmin();
    
    const adminButtons = isAdminUser ? `
        <div class="admin-controls">
            <button class="edit-btn" onclick="editStaticBlogItem('${itemId}')" aria-label="Edit this blog item">
                <i class="fas fa-edit"></i>
            </button>
            <button class="delete-btn" onclick="deleteStaticBlogItem('${itemId}')" aria-label="Delete this blog item">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    ` : '';

    itemElement.innerHTML = `
        <div class="blog-img">
            <img src="${item.imageUrl}" alt="${sanitizeHTML(item.title)}" loading="lazy">
            ${adminButtons}
        </div>
        <div class="blog-text">
            <time>${sanitizeHTML(item.date)}</time>
            <h3>${sanitizeHTML(item.title)}</h3>
            <p>${sanitizeHTML(item.description)}</p>
            <button class="read-more-btn" onclick="openStaticBlogReadMore('${itemId}')" aria-label="Read more about ${item.title}">
                <i class="fas fa-book-open" aria-hidden="true"></i> Read More
            </button>
        </div>
    `;
    itemElement.classList.add('reveal');

    return itemElement;
}

// Open the static blog modal in "add" mode
function addStaticBlogItem() {
    document.getElementById('staticBlogModalTitle').textContent = 'Add New Blog';
    document.getElementById('staticBlogItemId').value = '';
    document.getElementById('staticBlogTitle').value = '';
    document.getElementById('staticBlogDescription').value = '';
    document.getElementById('staticBlogContent').value = '';
    document.getElementById('staticBlogImageUrl').value = '';
    document.getElementById('staticBlogDate').value = '';
    openModal('staticBlogModal');
}

// Close the static blog modal
function closeStaticBlogModal() {
    closeModal('staticBlogModal');
}

// Handle form submission for adding or editing a static blog item — delegates to shared submitEntityForm
async function handleStaticBlogFormSubmit(event) {
    event.preventDefault();
    await submitEntityForm(
        'staticBlogForm', 'staticBlogItemId', API_ENDPOINTS.STATIC_BLOG_ITEMS,
        () => ({
            title: document.getElementById('staticBlogTitle').value.trim(),
            description: document.getElementById('staticBlogDescription').value.trim(),
            content: document.getElementById('staticBlogContent').value.trim(),
            imageUrl: document.getElementById('staticBlogImageUrl').value.trim(),
            date: document.getElementById('staticBlogDate').value.trim()
        }),
        () => {
            const t = document.getElementById('staticBlogTitle').value.trim();
            if (!t || t.length < 3) return 'Title must be at least 3 characters long.';
            const d = document.getElementById('staticBlogDescription').value.trim();
            if (!d || d.length < 10) return 'Description must be at least 10 characters long.';
            const c = document.getElementById('staticBlogContent').value.trim();
            if (!c || c.length < 20) return 'Content must be at least 20 characters long.';
            const img = document.getElementById('staticBlogImageUrl').value.trim();
            if (!img || !isValidUrl(img)) return 'Please enter a valid image URL.';
            if (!document.getElementById('staticBlogDate').value.trim()) return 'Please enter a date.';
            return null;
        },
        closeStaticBlogModal, fetchStaticBlogItems, 'Blog item'
    );
}

// Open the static blog modal pre-filled for editing
function editStaticBlogItem(id) {
    const item = staticBlogItemsCache.find(i => idToString(i._id) === id);
    if (!item) return;

    document.getElementById('staticBlogModalTitle').textContent = 'Edit Blog';
    document.getElementById('staticBlogItemId').value = id;
    document.getElementById('staticBlogTitle').value = item.title || '';
    document.getElementById('staticBlogDescription').value = item.description || '';
    document.getElementById('staticBlogContent').value = item.content || '';
    document.getElementById('staticBlogImageUrl').value = item.imageUrl || '';
    document.getElementById('staticBlogDate').value = item.date || '';
    openModal('staticBlogModal');
}

// Delete a static blog item with confirmation — delegates to shared deleteEntity
async function deleteStaticBlogItem(id) {
    await deleteEntity(API_ENDPOINTS.STATIC_BLOG_ITEMS, id,
        'Are you sure you want to delete this blog item?', 'blog item',
        () => { fetchStaticBlogItems(); showToast('Blog item deleted successfully!', 'success'); });
}

// Open the "Read More" modal for a static blog item
function openStaticBlogReadMore(id) {
    const item = staticBlogItemsCache.find(i => idToString(i._id) === id);
    if (!item) return;

    document.getElementById('readMoreTitle').textContent = item.title;
    document.getElementById('readMoreDate').textContent = item.date;
    document.getElementById('readMoreContent').innerHTML = item.content;
    openModal('readMoreModal');
}

// ==================== Comments ====================

// Fetch all comments for a post
async function fetchComments(postId) {
    try {
        const res = await fetch(`${API_ENDPOINTS.POSTS}/${postId}/comments`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error('❌ Error fetching comments:', err);
        return [];
    }
}

// Fetch comment count for a post (used on post cards)
async function fetchCommentCount(postId) {
    try {
        const res = await fetch(`${API_ENDPOINTS.POSTS}/${postId}/comments/count`);
        if (!res.ok) return 0;
        const data = await res.json();
        return data.count || 0;
    } catch {
        return 0;
    }
}

// Render comments in a container
function renderComments(comments, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!comments || comments.length === 0) {
        container.innerHTML = '<p class="no-comments">No comments yet. Be the first to comment!</p>';
        return;
    }
    
    // Build a map of comments by _id for nesting
    const commentMap = {};
    const topLevel = [];
    
    comments.forEach(c => {
        const idStr = idToString(c._id);
        commentMap[idStr] = { ...c, replies: [] };
    });
    
    comments.forEach(c => {
        const idStr = idToString(c._id);
        if (c.parentId) {
            const parentIdStr = idToString(c.parentId);
            if (commentMap[parentIdStr]) {
                commentMap[parentIdStr].replies.push(commentMap[idStr]);
            } else {
                topLevel.push(commentMap[idStr]);
            }
        } else {
            topLevel.push(commentMap[idStr]);
        }
    });
    
    function renderComment(comment, level) {
        const time = new Date(comment.createdAt).toLocaleString();
        const isOwn = comment.author === getUsername();
        const isAdminUser = isAdmin();
        const canDelete = isOwn || isAdminUser;
        
        const indentClass = level > 0 ? 'comment-reply' : '';
        const indentStyle = level > 0 ? `style="margin-left: ${Math.min(level, 3) * 2}rem;"` : '';
        
        return `
            <div class="comment-item ${indentClass}" ${indentStyle}>
                <div class="comment-header">
                    <strong class="comment-author">${sanitizeHTML(comment.author)}</strong>
                    <span class="comment-time">${time}</span>
                    ${canDelete ? `<button class="comment-delete-btn" onclick="deleteComment('${idToString(comment._id)}', '${comment.postId}')" title="Delete comment"><i class="fas fa-trash-alt"></i></button>` : ''}
                </div>
                <div class="comment-body">${sanitizeHTML(comment.body)}</div>
                <button class="comment-reply-btn" onclick="showReplyForm('${idToString(comment._id)}', '${comment.postId}')">
                    <i class="fas fa-reply"></i> Reply
                </button>
                ${comment.replies && comment.replies.length > 0
                    ? comment.replies.map(r => renderComment(r, level + 1)).join('')
                    : ''}
            </div>
        `;
    }
    
    container.innerHTML = topLevel.map(c => renderComment(c, 0)).join('');
}

// Submit a new comment
async function submitComment(postId) {
    const bodyInput = document.getElementById('comment-body');
    const body = bodyInput ? bodyInput.value.trim() : '';
    if (!body) {
        showToast('Please enter a comment.', 'warning');
        return;
    }
    
    const replyTo = document.getElementById('comment-parent-id')?.value || null;
    
    try {
        const res = await fetchWithRetry(`${API_ENDPOINTS.POSTS}/${postId}/comments`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ body, parentId: replyTo })
        });
        const data = await res.json();
        
        if (data.success) {
            bodyInput.value = '';
            // Clear reply state
            if (replyTo) {
                document.getElementById('comment-parent-id').value = '';
                document.getElementById('reply-indicator').style.display = 'none';
            }
            await loadComments(postId);
        } else {
            showToast(`Failed: ${data.message || 'Unknown error'}`, 'error');
        }
    } catch (err) {
        handleError(err, 'Submit comment');
    }
}

// Show reply form for a specific comment
function showReplyForm(commentId, postId) {
    document.getElementById('comment-parent-id').value = commentId;
    const indicator = document.getElementById('reply-indicator');
    if (indicator) {
        indicator.style.display = 'block';
        indicator.innerHTML = `<i class="fas fa-reply"></i> Replying to comment <button onclick="cancelReply()" style="margin-left: 0.5rem; background: none; border: none; color: var(--danger); cursor: pointer;">✕ Cancel</button>`;
    }
    document.getElementById('comment-body')?.focus();
}

// Cancel reply
function cancelReply() {
    document.getElementById('comment-parent-id').value = '';
    const indicator = document.getElementById('reply-indicator');
    if (indicator) indicator.style.display = 'none';
}

// Delete a comment
async function deleteComment(commentId, postId) {
    if (!await showConfirmModal('Are you sure you want to delete this comment?')) return;
    
    try {
        const res = await fetchWithRetry(`${API_ENDPOINTS.POSTS}/${postId}/comments/${commentId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        const data = await res.json();
        
        if (data.success) {
            await loadComments(postId);
        } else {
            showToast(`Failed: ${data.message || 'Unknown error'}`, 'error');
        }
    } catch (err) {
        handleError(err, 'Delete comment');
    }
}

// Load comments for a post (fetch + render)
async function loadComments(postId) {
    const comments = await fetchComments(postId);
    renderComments(comments, 'comments-list');
}

// ==================== Search & Filter ====================

// Filter posts by search query and selected category checkboxes
function handleSearch(query) {
    const q = query.trim().toLowerCase();
    const filtered = postsCache.filter(p => {
        const catOk = selectedCategories.has(p.category || 'General');
        const textOk = !q || 
            (p.title && p.title.toLowerCase().includes(q)) || 
            (p.description && p.description.toLowerCase().includes(q));
        return catOk && textOk;
    });
    renderPosts(filtered);
}

// Wire up the filter panel toggle, checkboxes, and search input with debounce
function setupFilters() {
    const filterBtn = document.querySelector('.filter-btn');
    const filterPanel = document.getElementById('filterPanel');
    const searchInput = document.querySelector('.search-input');
    const searchForm = document.querySelector('.banner form');
    
    if (filterBtn && filterPanel) {
        filterPanel.classList.add('hidden');
        filterBtn.addEventListener('click', () => {
            filterPanel.classList.toggle('hidden');
        });
    }

    document.querySelectorAll('.filter-check').forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.checked) {
                selectedCategories.add(cb.value);
            } else {
                selectedCategories.delete(cb.value);
            }
            handleSearch(searchInput ? searchInput.value : '');
        });
    });

    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleSearch(searchInput ? searchInput.value : '');
        });
    }

    if (searchInput) {
        const debouncedSearch = debounce((value) => handleSearch(value), 300);
        searchInput.addEventListener('input', () => debouncedSearch(searchInput.value));
    }
}

// ==================== UI Interactions ====================

// Setup scroll-reveal animations using IntersectionObserver
function setupReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('show');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    document.querySelectorAll('.reveal').forEach((el, idx) => {
        el.style.transitionDelay = `${idx * 60}ms`;
        observer.observe(el);
    });
    document.querySelectorAll('.design-item').forEach(el => {
        el.classList.add('reveal');
        observer.observe(el);
    });

    // Bind 3D tilt effect on hover
    document.querySelectorAll('.blog-post').forEach(card => bindTilt(card));
    document.querySelectorAll('.design-item').forEach(card => bindTilt(card));
}

// Add a subtle 3D perspective tilt effect when hovering over a card
function bindTilt(el) {
    const strength = 8;
    el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        const rotateY = (x - 0.5) * strength;
        const rotateX = (0.5 - y) * strength;
        el.style.transform = `perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`;
    });
    el.addEventListener('mouseleave', () => {
        el.style.transform = 'perspective(700px) rotateX(0deg) rotateY(0deg)';
    });
}

// ==================== Achievers Carousel ====================

let currentAchieverIndex = 0;

// Fetch all achievers from the API
async function fetchAchievers() {
    try {
        const res = await fetch(API_ENDPOINTS.ACHIEVERS);
        const items = await res.json();
        
        achieversCache = items?.items || (Array.isArray(items) ? items : []);
        updateAchieverDisplay();
    } catch (err) {
        console.error('❌ Error fetching achievers:', err);
    }
}

// Update the achiever section with the currently selected achiever's data
function updateAchieverDisplay() {
    if (achieversCache.length === 0) return;
    
    const achiever = achieversCache[currentAchieverIndex];
    const achieverNameEl = document.getElementById('about-heading');
    if (achieverNameEl) achieverNameEl.textContent = achiever.name;
    document.getElementById('achiever-years').textContent = achiever.years;
    document.getElementById('achiever-image').src = achiever.image;
    document.getElementById('achiever-desc-1').textContent = achiever.desc1;
    document.getElementById('achiever-desc-2').textContent = achiever.desc2;
    document.getElementById('achiever-quote').textContent = `"${achiever.quote}"`;
}

// Navigate to the next achiever (carousel forward)
function nextAchiever() {
    if (achieversCache.length === 0) return;
    currentAchieverIndex = (currentAchieverIndex + 1) % achieversCache.length;
    updateAchieverDisplay();
}

// Navigate to the previous achiever (carousel backward)
function prevAchiever() {
    if (achieversCache.length === 0) return;
    currentAchieverIndex = (currentAchieverIndex - 1 + achieversCache.length) % achieversCache.length;
    updateAchieverDisplay();
}

// Open the achiever modal in "add" mode
function addAchiever() {
    document.getElementById('achieverModalTitle').textContent = 'Add Achiever';
    document.getElementById('achieverId').value = '';
    document.getElementById('achieverName').value = '';
    document.getElementById('achieverYears').value = '';
    document.getElementById('achieverImage').value = '';
    document.getElementById('achieverDesc1').value = '';
    document.getElementById('achieverDesc2').value = '';
    document.getElementById('achieverQuote').value = '';
    openModal('achieverModal');
}

// Open the achiever modal pre-filled for editing the current achiever
function editAchiever() {
    if (achieversCache.length === 0) return;
    
    const achiever = achieversCache[currentAchieverIndex];
    document.getElementById('achieverModalTitle').textContent = 'Edit Achiever';
    document.getElementById('achieverId').value = idToString(achiever._id);
    document.getElementById('achieverName').value = achiever.name || '';
    document.getElementById('achieverYears').value = achiever.years || '';
    document.getElementById('achieverImage').value = achiever.image || '';
    document.getElementById('achieverDesc1').value = achiever.desc1 || '';
    document.getElementById('achieverDesc2').value = achiever.desc2 || '';
    document.getElementById('achieverQuote').value = achiever.quote || '';
    openModal('achieverModal');
}

// Delete the currently displayed achiever with confirmation — delegates to shared deleteEntity
async function deleteAchiever() {
    if (achieversCache.length === 0) return;
    const achiever = achieversCache[currentAchieverIndex];
    await deleteEntity(API_ENDPOINTS.ACHIEVERS, idToString(achiever._id),
        `Are you sure you want to delete "${achiever.name}"?`, 'achiever',
        () => { fetchAchievers(); showToast('Achiever deleted successfully!', 'success'); });
}

// Handle form submission for adding or editing an achiever — delegates to shared submitEntityForm
async function handleAchieverFormSubmit(event) {
    event.preventDefault();
    await submitEntityForm(
        'achieverForm', 'achieverId', API_ENDPOINTS.ACHIEVERS,
        () => ({
            name: document.getElementById('achieverName').value.trim(),
            years: document.getElementById('achieverYears').value.trim(),
            image: document.getElementById('achieverImage').value.trim(),
            desc1: document.getElementById('achieverDesc1').value.trim(),
            desc2: document.getElementById('achieverDesc2').value.trim(),
            quote: document.getElementById('achieverQuote').value.trim()
        }),
        () => {
            const n = document.getElementById('achieverName').value.trim();
            if (!n || n.length < 2) return 'Name must be at least 2 characters long.';
            const y = document.getElementById('achieverYears').value.trim();
            if (!y || y.length < 2) return 'Years/Period must be at least 2 characters long.';
            const img = document.getElementById('achieverImage').value.trim();
            if (!img || !isValidUrl(img)) return 'Please enter a valid image URL.';
            const d1 = document.getElementById('achieverDesc1').value.trim();
            if (!d1 || d1.length < 10) return 'First description must be at least 10 characters long.';
            const d2 = document.getElementById('achieverDesc2').value.trim();
            if (!d2 || d2.length < 10) return 'Second description must be at least 10 characters long.';
            const q = document.getElementById('achieverQuote').value.trim();
            if (!q || q.length < 5) return 'Quote must be at least 5 characters long.';
            return null;
        },
        closeAchieverModal, fetchAchievers, 'Achiever'
    );
}

// Close the achiever modal
function closeAchieverModal() {
    closeModal('achieverModal');
}

// ==================== Image Input Helpers ====================

// Check if a string is a valid URL, a base64 data URL, or a local image path
function isValidUrl(urlString) {
    if (!urlString) return false;
    // Accept base64 data URLs (from local file uploads)
    if (urlString.startsWith('data:image/')) return true;
    // Accept relative local image paths
    if (urlString.startsWith('images/') || urlString.startsWith('./images/') || urlString.startsWith('/images/')) return true;
    // Standard URL validation
    try {
        new URL(urlString);
        return true;
    } catch (e) {
        return false;
    }
}

// Wire up an "image input group": a URL text field, a hidden file input, and a Browse button
// When a file is selected, it is converted to base64 and placed into the URL text field
function setupImageInputGroup(textInputId, fileInputId, browseBtnId) {
    const textInput = document.getElementById(textInputId);
    const fileInput = document.getElementById(fileInputId);
    const browseBtn = document.getElementById(browseBtnId);

    if (!textInput || !fileInput || !browseBtn) return;

    browseBtn.addEventListener('click', function(e) {
        e.preventDefault();
        fileInput.click();
    });

    fileInput.addEventListener('change', function() {
        const file = this.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showToast('Please select a valid image file.', 'warning');
            this.value = '';
            return;
        }

        // Limit file size to 5MB
        const MAX_SIZE = 5 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            showToast('Image size must be less than 5MB. Please choose a smaller image.', 'warning');
            this.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            textInput.value = e.target.result;
            textInput.dispatchEvent(new Event('input', { bubbles: true }));
        };
        reader.onerror = function() {
            showToast('Failed to read the image file. Please try again.', 'error');
        };
        reader.readAsDataURL(file);
    });
}

// Get the current value from an image URL text input
function getImageInputValue(textInputId) {
    const val = document.getElementById(textInputId).value.trim();
    return val;
}

// ==================== Navbar: Frosted Glass Scholar Scroll Effect ====================

// Toggle .scrolled class on the navbar when page scrolls past 60px.
// Uses requestAnimationFrame for performance and { passive: true } for smooth scrolling.
function initNavbarScroll() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    const scrollThreshold = 60;
    let ticking = false;

    const updateNavbar = () => {
        if (window.scrollY > scrollThreshold) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        ticking = false;
    };

    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(updateNavbar);
            ticking = true;
        }
    }, { passive: true });

    // Initial check in case the page loads already scrolled
    updateNavbar();
}

// ==================== Event Listeners ====================

// Hide the page loader overlay after a brief delay
document.addEventListener('DOMContentLoaded', () => {
    const pageLoader = document.getElementById('pageLoader');
    if (pageLoader) {
        setTimeout(() => {
            pageLoader.classList.add('hidden');
        }, 500);
    }
});

// Hamburger menu toggle for mobile navigation
const hamburgerBtn = document.getElementById('hamburgerBtn');
const navbarNav = document.getElementById('navbarNav');

if (hamburgerBtn && navbarNav) {
    hamburgerBtn.addEventListener('click', () => {
        hamburgerBtn.classList.toggle('active');
        navbarNav.classList.toggle('active');
        const isExpanded = hamburgerBtn.classList.contains('active');
        hamburgerBtn.setAttribute('aria-expanded', isExpanded);
    });
}

// Main initialization when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    displayUsername();
    fetchAchievers();
    configureBlogLink();
    
    fetchPosts();
    fetchDesignItems();
    fetchStaticBlogItems();
    
    // Initialize Frosted Glass Scholar navbar scroll effect
    initNavbarScroll();
    
    // Setup combined image inputs (URL text + Browse button)
    setupImageInputGroup('designImageUrl', 'designImageFile', 'browseDesignImage');
    setupImageInputGroup('staticBlogImageUrl', 'staticBlogImageFile', 'browseStaticBlogImage');
    setupImageInputGroup('achieverImage', 'achieverImageFile', 'browseAchieverImage');
    
    setupReveal();
    setupFilters();
    setupModalEventListeners();
    
    updateAchieverDisplay();
    
    // Reveal admin-only UI elements if the user is an admin
    if (isAdmin()) {
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'inline-block';
        });
    }
});
