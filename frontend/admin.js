import {
  getDatabase,
  ref,
  get,
  update,
  onValue,
  child,
  remove
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyAzwZfY3ypX_Dmh7EjaBsg1jjbDppnMTvs",
  authDomain: "lmsystem-c57c1.firebaseapp.com",
  databaseURL: "https://lmsystem-c57c1-default-rtdb.firebaseio.com/",
  projectId: "lmsystem-c57c1",
  storageBucket: "lmsystem-c57c1.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "1:101310858086:web:e8f6c7dfd41214ca263ea7",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// DOM Elements
const dashboardTable = document.getElementById('dashboardTable');
const pendingTable = document.getElementById('pendingTable');
const manageTable = document.getElementById('manageTable');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearch');

// Templates
const approveActionsTemplate = document.getElementById('approveActionsTemplate');
const blockButtonTemplate = document.getElementById('blockButtonTemplate');
const unblockButtonTemplate = document.getElementById('unblockButtonTemplate');
const editDeleteButtonsTemplate = document.getElementById('editDeleteButtonsTemplate');

// Modal Elements
const editUserModal = document.getElementById('editUserModal');
const editUserForm = document.getElementById('editUserForm');
const closeModalBtn = document.querySelector('.close-modal');

// Notification Element
let activeNotification = null;
let notificationTimeout = null;

// Global Variables
let users = {};
let currentEditingUserId = null;
let searchQuery = '';

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Navigation
  const navLinks = document.querySelectorAll('.sidebar-links a[data-page]');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.getAttribute('data-page');
      showPage(page);
    });
  });

  // Logout button
  document.getElementById('logout-btn').addEventListener('click', (e) => {
    e.preventDefault();
    logout();
  });

  // Edit user form submission
  document.getElementById('editUserForm').addEventListener('submit', (e) => {
    e.preventDefault();
    saveUserEdit();
  });

  // Close modal on X click
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      hideEditModal();
    });
  });

  // Close modal on cancel button click
  document.getElementById('cancelBtn').addEventListener('click', (e) => {
    e.preventDefault(); // Prevent form submission
    hideEditModal();
  });

  // Close modal on outside click
  window.addEventListener('click', (e) => {
    if (e.target === editUserModal) {
      hideEditModal();
    }
  });

  // Search functionality
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderManageTable(); // Re-render with search filter
    });
  }

  // Clear search button
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      renderManageTable(); // Re-render without filter
      searchInput.focus();
    });
  }

  // Create notification container
  createNotificationContainer();

  // Initialize data
  initializeData();
});

// Functions
function initializeData() {
  // Fetch users from Firebase
  const usersRef = ref(database, 'users');
  
  onValue(usersRef, (snapshot) => {
    if (snapshot.exists()) {
      users = snapshot.val();
      renderDashboardTable();
      renderPendingTable();
      renderManageTable();
    } else {
      console.log("No users found");
    }
  }, (error) => {
    console.error("Error fetching users:", error);
  });

  // Show dashboard as default page
  showPage('dashboard');
}

function renderDashboardTable() {
  if (!dashboardTable) return;
  
  dashboardTable.innerHTML = '';
  
  if (Object.keys(users).length === 0) {
    dashboardTable.innerHTML = '<tr><td colspan="6">No users found</td></tr>';
    return;
  }

  for (const uid in users) {
    const user = users[uid];
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${user.firstName || ''} ${user.lastName || ''}</td>
      <td>${user.email || ''}</td>
      <td>${user.lrn || ''}</td>
      <td>${user.grade || ''}</td>
      <td>${user.section || ''}</td>
      <td><span class="status ${user.status || 'pending'}">${user.status || 'pending'}</span></td>
    `;
    
    dashboardTable.appendChild(row);
  }
}

function renderPendingTable() {
  if (!pendingTable) return;
  
  pendingTable.innerHTML = '';
  
  const pendingUsers = Object.entries(users).filter(([_, user]) => user.status === 'pending');
  
  if (pendingUsers.length === 0) {
    pendingTable.innerHTML = '<tr><td colspan="6">No pending users</td></tr>';
    return;
  }

  for (const [uid, user] of pendingUsers) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${user.firstName || ''} ${user.lastName || ''}</td>
      <td>${user.email || ''}</td>
      <td>${user.lrn || ''}</td>
      <td>${user.grade || ''}</td>
      <td>${user.section || ''}</td>
      <td class="actions">
        <div class="action-buttons">
          <button class="action-btn approve" data-uid="${uid}" title="Approve User">
            <i class="fas fa-check"></i>
          </button>
          <button class="action-btn reject" data-uid="${uid}" title="Reject User">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </td>
    `;
    
    // Add event listeners to buttons
    const approveBtn = row.querySelector('.action-btn.approve');
    const rejectBtn = row.querySelector('.action-btn.reject');
    
    approveBtn.addEventListener('click', () => approveUser(uid));
    rejectBtn.addEventListener('click', () => rejectUser(uid));
    
    pendingTable.appendChild(row);
  }
}

function renderManageTable() {
  if (!manageTable) return;
  
  manageTable.innerHTML = '';
  
  if (Object.keys(users).length === 0) {
    manageTable.innerHTML = '<tr><td colspan="6">No users found</td></tr>';
    return;
  }

  // Filter users based on search query
  const filteredUsers = Object.entries(users).filter(([uid, user]) => {
    if (!searchQuery) return true; // If no search query, show all users
    
    // Search in various fields
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
    const email = (user.email || '').toLowerCase();
    const lrn = (user.lrn || '').toLowerCase();
    const grade = (user.grade || '').toLowerCase();
    const section = (user.section || '').toLowerCase();
    
    return fullName.includes(searchQuery) || 
           email.includes(searchQuery) || 
           lrn.includes(searchQuery) || 
           grade.includes(searchQuery) || 
           section.includes(searchQuery);
  });

  if (filteredUsers.length === 0) {
    manageTable.innerHTML = searchQuery 
      ? `<tr><td colspan="6">No users found matching "${searchQuery}"</td></tr>`
      : '<tr><td colspan="6">No users found</td></tr>';
    return;
  }

  for (const [uid, user] of filteredUsers) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${user.firstName || ''} ${user.lastName || ''}</td>
      <td>${user.email || ''}</td>
      <td>${user.lrn || ''}</td>
      <td>${user.grade || ''}</td>
      <td>${user.section || ''}</td>
      <td class="actions">
        <div class="action-buttons">
          <button class="action-btn edit" data-uid="${uid}" title="Edit User">
            <i class="fas fa-edit"></i>
          </button>
          <button class="action-btn delete" data-uid="${uid}" title="Delete User">
            <i class="fas fa-trash-alt"></i>
          </button>
          ${user.status === 'blocked' ? 
            `<button class="action-btn unblock" data-uid="${uid}" title="Unblock User">
              <i class="fas fa-unlock"></i>
            </button>` : 
            `<button class="action-btn block" data-uid="${uid}" title="Block User">
              <i class="fas fa-ban"></i>
            </button>`
          }
        </div>
      </td>
    `;
    
    // Add event listeners to buttons
    const editBtn = row.querySelector('.action-btn.edit');
    const deleteBtn = row.querySelector('.action-btn.delete');
    const blockOrUnblockBtn = row.querySelector('.action-btn.block, .action-btn.unblock');
    
    editBtn.addEventListener('click', () => showEditModal(uid));
    deleteBtn.addEventListener('click', () => confirmDeleteUser(uid));
    
    if (blockOrUnblockBtn.classList.contains('block')) {
      blockOrUnblockBtn.addEventListener('click', () => blockUser(uid));
    } else {
      blockOrUnblockBtn.addEventListener('click', () => unblockUser(uid));
    }
    
    manageTable.appendChild(row);
  }
}

function highlightSearchText(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

function showPage(pageId) {
  // Hide all sections
  document.querySelectorAll('.content-section').forEach(section => {
    section.style.display = 'none';
  });
  
  // Show selected section
  const selectedPage = document.getElementById(pageId);
  if (selectedPage) {
    selectedPage.style.display = 'block';
  }
  
  // Update active link
  document.querySelectorAll('.sidebar-links a').forEach(link => {
    link.classList.remove('active');
  });
  
  document.querySelector(`.sidebar-links a[data-page="${pageId}"]`).classList.add('active');
}

async function approveUser(uid) {
  try {
    await update(ref(database, `users/${uid}`), {
      status: 'approved'
    });
    
    // Update local data
    users[uid].status = 'approved';
    
    // Show success message
    showNotification('User approved successfully', 'success');
    
    // Refresh tables
    renderPendingTable();
    renderDashboardTable();
    renderManageTable();
  } catch (error) {
    console.error('Error approving user:', error);
    showNotification('Failed to approve user: ' + error.message, 'error');
  }
}

async function rejectUser(uid) {
  try {
    // Instead of updating the status to 'rejected', remove the user completely
    await remove(ref(database, `users/${uid}`));
    
    // Remove from local data
    delete users[uid];
    
    // Show success message
    showNotification('User rejected', 'warning');
    
    // Refresh tables
    renderPendingTable();
    renderDashboardTable();
    renderManageTable();
  } catch (error) {
    console.error('Error rejecting user:', error);
    showNotification('Failed to reject user: ' + error.message, 'error');
  }
}

async function blockUser(uid) {
  try {
    await update(ref(database, `users/${uid}`), {
      status: 'blocked'
    });
    
    // Update local data
    users[uid].status = 'blocked';
    
    // Show success message
    showNotification('User blocked successfully', 'warning');
    
    // Refresh tables
    renderDashboardTable();
    renderManageTable();
  } catch (error) {
    console.error('Error blocking user:', error);
    showNotification('Failed to block user: ' + error.message, 'error');
  }
}

async function unblockUser(uid) {
  try {
    await update(ref(database, `users/${uid}`), {
      status: 'approved'
    });
    
    // Update local data
    users[uid].status = 'approved';
    
    // Show success message
    showNotification('User unblocked successfully', 'success');
    
    // Refresh tables
    renderDashboardTable();
    renderManageTable();
  } catch (error) {
    console.error('Error unblocking user:', error);
    showNotification('Failed to unblock user: ' + error.message, 'error');
  }
}

function showEditModal(uid) {
  const user = users[uid];
  if (!user) return;
  
  // Store current user ID being edited
  currentEditingUserId = uid;
  
  // Fill form with user data
  document.getElementById('editFirstName').value = user.firstName || '';
  document.getElementById('editLastName').value = user.lastName || '';
  document.getElementById('editEmail').value = user.email || '';
  document.getElementById('editLRN').value = user.lrn || '';
  document.getElementById('editGrade').value = user.grade || '';
  document.getElementById('editSection').value = user.section || '';
  
  // Show modal with animation
  editUserModal.style.display = 'flex';
  
  // Add a slight delay before adding the active class for the animation to work properly
  setTimeout(() => {
    editUserModal.classList.add('active');
  }, 10);
}

function hideEditModal() {
  // Remove active class to trigger animation
  editUserModal.classList.remove('active');
  
  // Wait for animation to complete before hiding the modal
  setTimeout(() => {
    editUserModal.style.display = 'none';
  }, 300); // Match this to your transition duration
  
  // Clear current user ID
  currentEditingUserId = null;
}

async function saveUserEdit() {
  if (!currentEditingUserId) return;
  
  const firstName = document.getElementById('editFirstName').value.trim();
  const lastName = document.getElementById('editLastName').value.trim();
  const email = document.getElementById('editEmail').value.trim();
  const lrn = document.getElementById('editLRN').value.trim();
  const grade = document.getElementById('editGrade').value.trim();
  const section = document.getElementById('editSection').value.trim();
  
  // Validate form
  if (!firstName || !lastName || !email) {
    showNotification('Please fill in all required fields', 'error');
    return;
  }
  
  try {
    // Show loading state
    const saveBtn = document.querySelector('.save-btn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
    
    // Update user in Firebase
    await update(ref(database, `users/${currentEditingUserId}`), {
      firstName,
      lastName,
      email,
      lrn,
      grade,
      section
    });
    
    // Update local data
    users[currentEditingUserId] = {
      ...users[currentEditingUserId],
      firstName,
      lastName,
      email,
      lrn,
      grade,
      section
    };
    
    // Reset button
    saveBtn.textContent = originalText;
    saveBtn.disabled = false;
    
    // Show success message
    showNotification('User updated successfully', 'success');
    
    // Hide modal
    hideEditModal();
    
    // Refresh tables
    renderDashboardTable();
    renderPendingTable();
    renderManageTable();
  } catch (error) {
    console.error('Error updating user:', error);
    showNotification('Failed to update user: ' + error.message, 'error');
    
    // Reset button
    const saveBtn = document.querySelector('.save-btn');
    saveBtn.textContent = 'Save Changes';
    saveBtn.disabled = false;
  }
}

function confirmDeleteUser(uid) {
  if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
    deleteUser(uid);
  }
}

async function deleteUser(uid) {
  try {
    // Delete user from Firebase
    await remove(ref(database, `users/${uid}`));
    
    // Remove from local data
    delete users[uid];
    
    // Show success message
    showNotification('User deleted successfully', 'warning');
    
    // Refresh tables
    renderDashboardTable();
    renderPendingTable();
    renderManageTable();
  } catch (error) {
    console.error('Error deleting user:', error);
    showNotification('Failed to delete user: ' + error.message, 'error');
  }
}

function logout() {
  window.location.href = 'index.html';
}

// Single Notification System
function createNotificationContainer() {
  let container = document.querySelector('.notification-container');
  
  if (!container) {
    container = document.createElement('div');
    container.className = 'notification-container';
    document.body.appendChild(container);
  }
}

function showNotification(message, type = 'info') {
  // Get container
  const container = document.querySelector('.notification-container');
  
  // If there's already an active notification, remove it
  if (activeNotification) {
    activeNotification.classList.remove('show');
    activeNotification.classList.add('hiding');
    
    // Clear any pending timeout
    if (notificationTimeout) {
      clearTimeout(notificationTimeout);
    }
  }
  
  // Create new notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  
  // Create content
  notification.innerHTML = `
    <div>${message}</div>
    <button class="close-btn">&times;</button>
  `;
  
  // Clear container and add the new notification
  container.innerHTML = '';
  container.appendChild(notification);
  
  // Set as active notification
  activeNotification = notification;
  
  // Add event listener to close button
  notification.querySelector('.close-btn').addEventListener('click', () => {
    hideNotification(notification);
  });
  
  // Add entry animation
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  // Auto remove after 5 seconds
  notificationTimeout = setTimeout(() => {
    hideNotification(notification);
  }, 5000);
}

function hideNotification(notification) {
  if (!notification) return;
  
  notification.classList.remove('show');
  notification.classList.add('hiding');
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
    
    // If this was the active notification, clear the reference
    if (notification === activeNotification) {
      activeNotification = null;
    }
  }, 300);
}