const API_BASE = '/api/messages';

// Global state for winners
let allWinners = [];
let currentSort = { column: 'date', direction: 'desc' };

// Global state for bot control
let workerStatusInterval = null;

// Authentication
function getAuthToken() {
    return localStorage.getItem('adminToken');
}

function logout() {
    localStorage.removeItem('adminToken');
    // Clear the cookie
    document.cookie = 'admin_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    window.location.reload();
}

// API calls with authentication
async function apiCall(endpoint, options = {}) {
    const token = getAuthToken();
    const baseUrl = options.baseUrl || API_BASE;
    delete options.baseUrl;
    
    const response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        }
    });
    
    if (response.status === 401) {
        logout();
        return;
    }
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
    }
    
    return response.json();
}

// Tab switching
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    // Clear worker status interval if leaving bot control tab
    if (workerStatusInterval) {
        clearInterval(workerStatusInterval);
        workerStatusInterval = null;
    }
    
    // Load data based on tab
    if (tabName === 'winners' && allWinners.length === 0) {
        loadWinners();
    } else if (tabName === 'botControl') {
        loadBotControlData();
        // Auto-refresh worker status every 10 seconds
        workerStatusInterval = setInterval(loadWorkerStatus, 10000);
    }
}

// Load bot control data
async function loadBotControlData() {
    await loadWorkerStatus();
    await loadTwitchChannel();
}

// Load worker status
async function loadWorkerStatus() {
    try {
        const status = await apiCall('/worker/status', { baseUrl: '/api/heroku' });
        displayWorkerStatus(status);
    } catch (error) {
        console.error('Error loading worker status:', error);
        document.getElementById('workerStatus').innerHTML = 
            '<span class="status-indicator status-error"></span><span class="status-text">Error loading status</span>';
    }
}

// Display worker status
function displayWorkerStatus(status) {
    const statusEl = document.getElementById('workerStatus');
    const uptimeEl = document.getElementById('workerUptime');
    const startBtn = document.getElementById('startWorkerBtn');
    const stopBtn = document.getElementById('stopWorkerBtn');
    const restartBtn = document.getElementById('restartWorkerBtn');
    
    if (status.status === 'stopped') {
        statusEl.innerHTML = '<span class="status-indicator status-stopped"></span><span class="status-text">Stopped</span>';
        uptimeEl.style.display = 'none';
        startBtn.style.display = 'inline-block';
        stopBtn.style.display = 'none';
        restartBtn.style.display = 'none';
    } else if (status.status === 'running') {
        statusEl.innerHTML = '<span class="status-indicator status-running"></span><span class="status-text">Running</span>';
        
        // Display uptime
        const uptime = formatUptime(status.uptime_seconds);
        uptimeEl.textContent = `Started ${uptime} ago`;
        uptimeEl.style.display = 'block';
        
        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        restartBtn.style.display = 'inline-block';
    } else {
        statusEl.innerHTML = `<span class="status-indicator status-unknown"></span><span class="status-text">${status.status}</span>`;
        uptimeEl.style.display = 'none';
        startBtn.style.display = 'none';
        stopBtn.style.display = 'none';
        restartBtn.style.display = 'none';
    }
}

// Format uptime in human-readable format
function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
        return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} min${minutes !== 1 ? 's' : ''}`;
    } else if (minutes > 0) {
        return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
        return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    }
}

// Start worker
async function startWorker() {
    if (!confirm('Start the bot worker? It will connect to the configured Twitch channel.')) {
        return;
    }
    
    try {
        await apiCall('', { 
            baseUrl: '/api/heroku/worker/start',
            method: 'POST'
        });
        alert('Worker started successfully!');
        await loadWorkerStatus();
    } catch (error) {
        alert('Failed to start worker: ' + error.message);
    }
}

// Stop worker
async function stopWorker() {
    if (!confirm('Stop the bot worker? Any running raffle will be interrupted. Continue?')) {
        return;
    }
    
    try {
        await apiCall('', { 
            baseUrl: '/api/heroku/worker/stop',
            method: 'POST'
        });
        alert('Worker stopped successfully!');
        await loadWorkerStatus();
    } catch (error) {
        alert('Failed to stop worker: ' + error.message);
    }
}

// Restart worker
async function restartWorker() {
    if (!confirm('This will restart the bot. Any running raffle will be interrupted. Continue?')) {
        return;
    }
    
    try {
        await apiCall('', { 
            baseUrl: '/api/heroku/worker/restart',
            method: 'POST'
        });
        alert('Worker restarted successfully!');
        await loadWorkerStatus();
    } catch (error) {
        alert('Failed to restart worker: ' + error.message);
    }
}

// Load Twitch channel
async function loadTwitchChannel() {
    try {
        const data = await apiCall('', { baseUrl: '/api/heroku/config/channel' });
        document.getElementById('twitchChannel').value = data.channel || '';
    } catch (error) {
        console.error('Error loading Twitch channel:', error);
        alert('Failed to load Twitch channel: ' + error.message);
    }
}

// Save Twitch channel
async function saveTwitchChannel(event) {
    event.preventDefault();
    
    const channel = document.getElementById('twitchChannel').value.trim();
    
    if (!channel) {
        alert('Please enter a Twitch channel name');
        return;
    }
    
    if (!confirm('⚠️ This will restart the web server AND the worker bot if it\'s running. Any active raffle will be interrupted! Continue?')) {
        return;
    }
    
    try {
        await apiCall('', { 
            baseUrl: '/api/heroku/config/channel',
            method: 'PATCH',
            body: JSON.stringify({ channel })
        });
        
        alert('Twitch channel updated successfully! The server will restart briefly.');
        // Note: The web server will restart, so this page may reload
    } catch (error) {
        alert('Failed to update Twitch channel: ' + error.message);
    }
}

// Load winners from API
async function loadWinners() {
    try {
        const winners = await apiCall('', { baseUrl: '/api/winners' });
        allWinners = winners;
        displayWinners(winners);
        updateWinnersCount(winners.length, winners.length);
    } catch (error) {
        console.error('Error loading winners:', error);
        document.getElementById('winnersTableBody').innerHTML = 
            '<tr><td colspan="4" style="text-align: center; padding: 40px; color: #999;">Failed to load winners</td></tr>';
    }
}

// Display winners in table
function displayWinners(winners) {
    const tbody = document.getElementById('winnersTableBody');
    const empty = document.getElementById('winnersEmpty');
    
    if (winners.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    
    empty.style.display = 'none';
    tbody.innerHTML = winners.map(winner => `
        <tr data-character="${winner.charactername.toLowerCase()}" 
            data-realm="${winner.realm.toLowerCase()}" 
            data-twitch="${winner.twitchname.toLowerCase()}"
            data-date="${new Date(winner.windate).getTime()}">
            <td>${formatDate(winner.windate)}</td>
            <td>${escapeHtml(winner.charactername)}</td>
            <td>${escapeHtml(winner.realm)}</td>
            <td>${escapeHtml(winner.twitchname)}</td>
        </tr>
    `).join('');
}

// Filter winners based on search input
function filterWinners() {
    const searchTerm = document.getElementById('winnerSearch').value.toLowerCase();
    const rows = document.querySelectorAll('.winners-table tbody tr');
    let visibleCount = 0;
    
    rows.forEach(row => {
        const character = row.dataset.character || '';
        const realm = row.dataset.realm || '';
        const twitch = row.dataset.twitch || '';
        
        const matches = character.includes(searchTerm) || 
                       realm.includes(searchTerm) || 
                       twitch.includes(searchTerm);
        
        if (matches) {
            row.classList.remove('hidden');
            visibleCount++;
        } else {
            row.classList.add('hidden');
        }
    });
    
    updateWinnersCount(visibleCount, allWinners.length);
}

// Sort winners table
function sortWinners(column) {
    // Toggle direction if clicking same column, otherwise default to ascending
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = column === 'date' ? 'desc' : 'asc'; // Date defaults to newest first
    }
    
    // Update header indicators
    document.querySelectorAll('.winners-table th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });
    const activeHeader = document.querySelector(`th[data-sort="${column}"]`);
    activeHeader.classList.add(`sort-${currentSort.direction}`);
    
    // Sort the table rows
    const tbody = document.getElementById('winnersTableBody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    rows.sort((a, b) => {
        let aVal, bVal;
        
        switch(column) {
            case 'date':
                aVal = parseInt(a.dataset.date);
                bVal = parseInt(b.dataset.date);
                break;
            case 'character':
                aVal = a.dataset.character;
                bVal = b.dataset.character;
                break;
            case 'realm':
                aVal = a.dataset.realm;
                bVal = b.dataset.realm;
                break;
            case 'twitch':
                aVal = a.dataset.twitch;
                bVal = b.dataset.twitch;
                break;
        }
        
        if (aVal < bVal) return currentSort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });
    
    // Re-append rows in sorted order
    rows.forEach(row => tbody.appendChild(row));
}

// Update winners count display
function updateWinnersCount(visible, total) {
    const countEl = document.getElementById('winnersCount');
    if (visible === total) {
        countEl.textContent = `Showing ${total} winner${total !== 1 ? 's' : ''}`;
    } else {
        countEl.textContent = `Showing ${visible} of ${total} winners`;
    }
}

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Load and display messages
async function loadMessages() {
    try {
        const messages = await apiCall('');
        displayMessages(messages);
    } catch (error) {
        console.error('Error loading messages:', error);
        alert('Failed to load messages: ' + error.message);
    }
}

function displayMessages(messages) {
    const container = document.getElementById('messagesList');
    
    const enabledMessages = messages.filter(m => m.enabled);
    const disabledMessages = messages.filter(m => !m.enabled);
    
    if (messages.length === 0) {
        container.innerHTML = '<div class="empty-state">No messages yet. Add one above!</div>';
        return;
    }
    
    container.innerHTML = '';
    
    enabledMessages.forEach(msg => container.appendChild(createMessageElement(msg)));
    
    if (disabledMessages.length > 0) {
        const divider = document.createElement('h3');
        divider.textContent = 'Disabled Messages';
        divider.style.marginTop = '20px';
        divider.style.color = '#999';
        container.appendChild(divider);
        
        disabledMessages.forEach(msg => container.appendChild(createMessageElement(msg)));
    }
}

function createMessageElement(message) {
    const div = document.createElement('div');
    div.className = `message-item ${!message.enabled ? 'disabled' : ''}`;
    div.id = `message-${message.messageid}`;
    
    div.innerHTML = `
        <div class="message-header">
            <div class="message-meta">
                #${message.messageid} | Order: ${message.displayorder} | 
                ${message.messagetext.length} chars | 
                ${message.enabled ? 'Enabled' : 'Disabled'}
            </div>
        </div>
        <div class="message-text">${escapeHtml(message.messagetext)}</div>
        <div class="message-actions">
            <button class="btn btn-toggle ${!message.enabled ? 'disabled' : ''}" 
                    onclick="toggleMessage(${message.messageid}, ${message.enabled})">
                ${message.enabled ? 'Disable' : 'Enable'}
            </button>
            <button class="btn btn-edit" onclick="editMessage(${message.messageid})">Edit</button>
            <button class="btn btn-delete" onclick="deleteMessage(${message.messageid})">Delete</button>
        </div>
    `;
    
    return div;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add new message
document.getElementById('addForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const messagetext = document.getElementById('newMessage').value.trim();
    
    if (!messagetext) {
        alert('Please enter a message');
        return;
    }
    
    try {
        await apiCall('', {
            method: 'POST',
            body: JSON.stringify({ messagetext })
        });
        
        document.getElementById('newMessage').value = '';
        document.getElementById('charCount').textContent = '0 / 500';
        document.getElementById('preview').textContent = '';
        
        await loadMessages();
    } catch (error) {
        alert('Failed to add message: ' + error.message);
    }
});

// Character counter and preview
document.getElementById('newMessage').addEventListener('input', (e) => {
    const text = e.target.value;
    const length = text.length;
    const counter = document.getElementById('charCount');
    const preview = document.getElementById('preview');
    
    counter.textContent = `${length} / 500`;
    counter.className = 'char-count';
    
    if (length > 450) {
        counter.classList.add('warning');
    }
    if (length > 490) {
        counter.classList.add('danger');
    }
    
    preview.textContent = text || '';
});

// Toggle message enabled/disabled
async function toggleMessage(id, currentlyEnabled) {
    try {
        await apiCall(`/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ enabled: !currentlyEnabled })
        });
        await loadMessages();
    } catch (error) {
        alert('Failed to toggle message: ' + error.message);
    }
}

// Edit message
function editMessage(id) {
    const messageDiv = document.getElementById(`message-${id}`);
    const textDiv = messageDiv.querySelector('.message-text');
    const actionsDiv = messageDiv.querySelector('.message-actions');
    const currentText = textDiv.textContent;
    
    // Hide actions, show edit form
    actionsDiv.style.display = 'none';
    
    const editForm = document.createElement('div');
    editForm.className = 'edit-form';
    editForm.innerHTML = `
        <textarea id="edit-${id}" rows="3" maxlength="500">${escapeHtml(currentText)}</textarea>
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="char-count" id="edit-count-${id}">${currentText.length} / 500</span>
            <div class="edit-actions">
                <button class="btn btn-primary" onclick="saveEdit(${id})">Save</button>
                <button class="btn btn-cancel" onclick="cancelEdit(${id})">Cancel</button>
            </div>
        </div>
    `;
    
    messageDiv.appendChild(editForm);
    
    const textarea = document.getElementById(`edit-${id}`);
    textarea.focus();
    
    textarea.addEventListener('input', (e) => {
        const counter = document.getElementById(`edit-count-${id}`);
        counter.textContent = `${e.target.value.length} / 500`;
        counter.className = 'char-count';
        if (e.target.value.length > 450) counter.classList.add('warning');
        if (e.target.value.length > 490) counter.classList.add('danger');
    });
}

async function saveEdit(id) {
    const textarea = document.getElementById(`edit-${id}`);
    const messagetext = textarea.value.trim();
    
    if (!messagetext) {
        alert('Message cannot be empty');
        return;
    }
    
    try {
        await apiCall(`/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ messagetext })
        });
        await loadMessages();
    } catch (error) {
        alert('Failed to save message: ' + error.message);
    }
}

function cancelEdit(id) {
    loadMessages();
}

// Delete message
async function deleteMessage(id) {
    if (!confirm('Are you sure you want to delete this message?')) {
        return;
    }
    
    try {
        await apiCall(`/${id}`, {
            method: 'DELETE'
        });
        await loadMessages();
    } catch (error) {
        alert('Failed to delete message: ' + error.message);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadMessages();
});
