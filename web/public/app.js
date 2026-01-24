const API_BASE = '/api/messages';

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
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
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
