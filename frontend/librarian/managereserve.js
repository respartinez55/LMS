function getNotificationActionButtons(reservationId, status, reservation) {
  return `
    <a href="#" class="action-link primary" onclick="handleViewReservation('${reservationId}'); return false;">View</a>
  `;
}

function setupNotificationActionButtons() {
  document.querySelectorAll('.approve-notification-btn, .reject-notification-btn').forEach(btn => {
    btn.remove();
  });
}

async function handleViewReservation(reservationId) {
  const reservationsSection = document.getElementById('reservations-section');
  if (reservationsSection) {
    reservationsSection.scrollIntoView({ behavior: 'smooth' });
    
    const searchInput = document.getElementById('reservationSearch');
    if (searchInput) {
      const reservation = allReservations.find(r => 
        (r.reservation_id || r.id) == reservationId
      );
      if (reservation) {
        searchInput.value = reservation.book_title || reservation.user_name || '';
        filterReservations();
      }
    }
  }
}

function displayReservationNotifications(reservations) {
  const notificationsList = document.getElementById("reservations-notifications-list");
  if (!notificationsList) return;
  
  const pendingReservations = reservations.filter(reservation => 
    reservation.status === 'Pending' || !reservation.status
  );
  
  if (!pendingReservations || pendingReservations.length === 0) {
    notificationsList.innerHTML = `
      <div class="notification-item">
        <div class="notification-icon">
          <span class="material-symbols-outlined">notifications_off</span>
        </div>
        <div class="notification-content">
          <h3>No Pending Reservations</h3>
          <p>There are currently no pending reservations requiring attention.</p>
        </div>
        <div class="notification-time">
          <span>-</span>
        </div>
      </div>
    `;
    return;
  }
  
  notificationsList.innerHTML = '';
  
  pendingReservations.forEach(reservation => {
    const reservationId = reservation.reservation_id || reservation.id;
    const bookTitle = reservation.book_title || 'Unknown Book';
    const userName = reservation.user_name || 'Unknown User';
    const author = reservation.author || 'Unknown Author';
    const timeAgo = formatRelativeTime(reservation.reserve_date);
    
    const notificationItem = document.createElement('div');
    notificationItem.className = 'notification-item';
    
    notificationItem.innerHTML = `
      <div class="notification-icon">
        <span class="material-symbols-outlined">book</span>
      </div>
      <div class="notification-content">
        <h3>New Reservation Request</h3>
        <p><strong>${escapeHtml(userName)}</strong> requested to reserve <strong>"${escapeHtml(bookTitle)}"</strong> by ${escapeHtml(author)}</p>
        <div class="notification-actions">
          ${getNotificationActionButtons(reservationId, reservation.status, reservation)}
        </div>
      </div>
      <div class="notification-time">
        <span>${timeAgo}</span>
      </div>
    `;
    
    notificationsList.appendChild(notificationItem);
  });
  
  setupNotificationActionButtons();
}

window.handleViewReservation = handleViewReservation;

const API_BASE_URL = "http://localhost:5000";
let allReservations = [];

async function loadReservations() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/reservations`);
    const data = await response.json();
    
    if (data.success) {
      allReservations = data.reservations || [];
      displayReservations(allReservations);
      displayReservationNotifications(allReservations);
      console.log("✅ Loaded", allReservations.length, "reservations");
    } else {
      throw new Error(data.message || 'Failed to load reservations');
    }
  } catch (error) {
    console.error("❌ Error loading reservations:", error);
    showNotification(`Failed to load reservations: ${error.message}`, "error");
  }
}

function displayReservations(reservations) {
  const tableBody = document.getElementById("reservations-list");
  if (!tableBody) return;
  
  const filteredReservations = reservations.filter(reservation => 
    reservation.status !== 'Rejected'
  );
  
  if (!filteredReservations || filteredReservations.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted">
          <i class="fas fa-inbox"></i> No reservations found
        </td>
      </tr>
    `;
    return;
  }
  
  tableBody.innerHTML = '';
  
  filteredReservations.forEach(reservation => {
    const row = document.createElement('tr');
    const reservationId = reservation.reservation_id || reservation.id;
    
    row.innerHTML = `
      <td>
        <strong>${escapeHtml(reservation.book_title || 'N/A')}</strong><br>
        <small class="text-muted">by ${escapeHtml(reservation.author || 'Unknown')}</small>
      </td>
      <td>
        <strong>${escapeHtml(reservation.user_name || 'Unknown')}</strong><br>
        <small class="text-muted">${escapeHtml(reservation.user_email || '')}</small>
      </td>
      <td>${formatDate(reservation.reserve_date)}</td>
      <td>${formatDate(reservation.return_date)}</td>
      <td>
        ${getStatusPill(reservation.status)}
      </td>
      <td>
        ${getActionButtons(reservationId, reservation.status, reservation)}
      </td>
    `;
    tableBody.appendChild(row);
  });
  
  setupActionButtons();
}

function getNotificationIcon(status) {
  const iconMap = {
    'Pending': 'schedule',
    'Approved': 'check_circle',
    'Fulfilled': 'library_books',
    'Rejected': 'cancel',
    'Returned': 'assignment_return'
  };
  
  return iconMap[status] || 'schedule';
}

function formatRelativeTime(dateString) {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffTime / (1000 * 60));
  
  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}

function getStatusPill(status) {
  if (!status) status = 'Pending';
  
  const statusClassMap = {
    'Pending': 'status-pending',
    'Approved': 'status-info',
    'Rejected': 'status-unavailable',
    'Fulfilled': 'status-available',
    'Available': 'status-available',
    'Unavailable': 'status-unavailable',
    'Reserved': 'status-reserved',
    'Borrowed': 'status-borrowed',
    'Returned': 'status-returned',
    'Overdue': 'status-overdue'
  };
  
  const cssClass = statusClassMap[status] || 'status-pending';
  
  return `<span class="status-pill ${cssClass}">${status}</span>`;
}

function getActionButtons(reservationId, status, reservation) {
  if (!status || status === 'Pending') {
    return `
      <button class="btn btn-sm btn-success approve-btn" data-id="${reservationId}">
        <i class="fas fa-check"></i> Approve
      </button>
      <button class="btn btn-sm btn-danger reject-btn" data-id="${reservationId}">
        <i class="fas fa-times"></i> Reject
      </button>
    `;
  }
  
  if (status === 'Approved') {
    return `
      <button class="btn btn-sm btn-primary fulfill-btn" 
              data-id="${reservationId}" 
              data-reservation='${JSON.stringify(reservation).replace(/'/g, "&apos;")}'>
        <i class="fas fa-book"></i> Fulfill
      </button>
    `;
  }
  
  if (status === 'Fulfilled') {
    return `
      <button class="btn btn-sm btn-info view-receipt-btn" 
              data-id="${reservationId}" 
              data-reservation='${JSON.stringify(reservation).replace(/'/g, "&apos;")}'
              title="View E-Receipt">
        <i class="fas fa-eye"></i> View Receipt
      </button>
    `;
  }
  
  return '<span class="text-muted">No actions available</span>';
}

function setupActionButtons() {
  document.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      const reservationId = this.getAttribute('data-id');
      await updateReservationStatus(reservationId, 'Approved');
    });
  });
  
  document.querySelectorAll('.reject-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      const reservationId = this.getAttribute('data-id');
      if (confirm('Are you sure you want to reject this reservation?')) {
        await updateReservationStatus(reservationId, 'Rejected');
      }
    });
  });
  
  document.querySelectorAll('.fulfill-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      const reservationId = this.getAttribute('data-id');
      const reservationData = JSON.parse(this.getAttribute('data-reservation'));
      
      const success = await updateReservationStatus(reservationId, 'Fulfilled');
      
      if (success) {
        setTimeout(() => {
          showFulfillmentReceipt(reservationData, reservationId);
        }, 500);
      }
    });
  });
  
  document.querySelectorAll('.view-receipt-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const reservationId = this.getAttribute('data-id');
      const reservationData = JSON.parse(this.getAttribute('data-reservation'));
      
      console.log('👁️ Viewing receipt for fulfilled reservation:', reservationId);
      showFulfillmentReceipt(reservationData, reservationId);
    });
  });
}

// Replace the existing updateReservationStatus function with this updated version:

async function updateReservationStatus(reservationId, newStatus) {
  if (!reservationId) {
    showNotification('Invalid reservation ID', 'error');
    return false;
  }
  
  try {
    console.log(`Updating reservation ${reservationId} to ${newStatus}`);
    
    const response = await fetch(`${API_BASE_URL}/api/reservations/${reservationId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: newStatus
      })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      showNotification(`Reservation ${newStatus.toLowerCase()} successfully!`, 'success');
      await loadReservations();
      
      // Dispatch events to notify other modules
      const eventData = {
        reservationId: reservationId,
        oldStatus: null, // You might want to track this
        newStatus: newStatus,
        timestamp: new Date()
      };
      
      // Dispatch custom event for reservation status change
      document.dispatchEvent(new CustomEvent('reservationStatusChanged', {
        detail: eventData
      }));
      
      // Specifically dispatch for fulfilled reservations
      if (newStatus === 'Fulfilled') {
        window.dispatchEvent(new CustomEvent('reservationFulfilled', {
          detail: eventData
        }));
        console.log('📚 Dispatched reservationFulfilled event');
      }
      
      return true;
    } else {
      console.error('Update failed:', data);
      showNotification(data.message || `Failed to ${newStatus.toLowerCase()} reservation`, 'error');
      return false;
    }
    
  } catch (error) {
    console.error('Error updating reservation:', error);
    showNotification(`Error: ${error.message}`, 'error');
    return false;
  }
}

function showFulfillmentReceipt(reservationData, reservationId) {
  if (!window.eReceiptModule && !window.receiptModule) {
    console.warn('E-Receipt module not loaded. Loading receipt module...');
    
    if (typeof initializeReceiptModal === 'function') {
      initializeReceiptModal();
    } else {
      showNotification('E-Receipt system not available', 'warning');
      return;
    }
  }
  
  const transactionId = generateTransactionId(reservationId);
  
  const receiptData = {
    transactionId: transactionId,
    
    book: {
      id: reservationData.book_id || reservationData.bookId || 'N/A',
      title: reservationData.book_title || reservationData.bookTitle || 'N/A',
      author: reservationData.author || reservationData.bookAuthor || 'N/A',
      coverImage: reservationData.book_cover || reservationData.coverImage || null
    },
    
    bookId: reservationData.book_id || reservationData.bookId || 'N/A',
    bookTitle: reservationData.book_title || reservationData.bookTitle || 'N/A',
    bookAuthor: reservationData.author || reservationData.bookAuthor || 'N/A',
    bookCover: reservationData.book_cover || reservationData.coverImage || null,
    
    userName: reservationData.user_name || reservationData.userName || 'N/A',
    borrowerName: reservationData.user_name || reservationData.userName || 'N/A',
    borrowerType: determineBorrowerType(reservationData),
    
    lrn: reservationData.lrn || reservationData.LRN || reservationData.learner_reference_number,
    employeeId: reservationData.employee_id || reservationData.employeeId || reservationData.staff_id,
    idNumber: reservationData.id_number || reservationData.user_id || reservationData.userId,
    
    borrowDate: new Date().toISOString(),
    issueDate: new Date().toISOString(),
    dueDate: calculateDueDate(),
    
    status: 'Issued',
    
    reservationId: reservationData.reservation_id || reservationData.id,
    reserveDate: reservationData.reserve_date,
    returnDate: reservationData.return_date
  };
  
  console.log('📄 Showing fulfillment receipt for reservation:', reservationId);
  console.log('Receipt data:', receiptData);
  
  const receiptModule = window.eReceiptModule || window.receiptModule;
  if (receiptModule && receiptModule.showReceiptModal) {
    receiptModule.showReceiptModal(receiptData);
  } else if (typeof showBookIssueReceipt === 'function') {
    showBookIssueReceipt(receiptData);
  } else {
    console.error('No receipt display method available');
    showNotification('Unable to display receipt', 'error');
  }
}

function generateTransactionId(reservationId) {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const time = String(date.getHours()).padStart(2, '0') + String(date.getMinutes()).padStart(2, '0');
  
  return `LMS-${year}${month}${day}-${time}-${reservationId}`;
}

function determineBorrowerType(reservationData) {
  if (reservationData.user_type) {
    return reservationData.user_type;
  }
  
  if (reservationData.lrn || reservationData.LRN || reservationData.learner_reference_number) {
    return 'Student';
  }
  
  if (reservationData.employee_id || reservationData.employeeId || reservationData.staff_id) {
    return 'Employee';
  }
  
  return 'Library User';
}

function calculateDueDate(days = 14) {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + days);
  return dueDate.toISOString();
}

function filterReservations() {
  const searchTerm = document.getElementById('reservationSearch')?.value?.toLowerCase() || '';
  const statusFilter = document.getElementById('reservationStatusFilter')?.value || '';
  
  let filtered = allReservations.filter(reservation => {
    if (reservation.status === 'Rejected') return false;
    
    const matchesSearch = !searchTerm || 
      reservation.book_title?.toLowerCase().includes(searchTerm) ||
      reservation.user_name?.toLowerCase().includes(searchTerm) ||
      reservation.author?.toLowerCase().includes(searchTerm);
    
    const matchesStatus = !statusFilter || reservation.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });
  
  displayReservations(filtered);
  displayReservationNotifications(allReservations);
}

function filterNotifications() {
  const searchTerm = document.getElementById('notificationSearch')?.value?.toLowerCase() || '';
  const typeFilter = document.getElementById('notificationTypeFilter')?.value || '';
  
  if (typeFilter === 'Reservations' || typeFilter === '') {
    let filtered = allReservations.filter(reservation => {
      if (reservation.status !== 'Pending' && reservation.status) return false;
      
      const matchesSearch = !searchTerm || 
        reservation.book_title?.toLowerCase().includes(searchTerm) ||
        reservation.user_name?.toLowerCase().includes(searchTerm) ||
        reservation.author?.toLowerCase().includes(searchTerm);
      
      return matchesSearch;
    });
    
    displayReservationNotifications(filtered);
  } else if (typeFilter !== 'Reservations') {
    const notificationsList = document.getElementById("reservations-notifications-list");
    if (notificationsList) {
      notificationsList.innerHTML = `
        <div class="notification-item">
          <div class="notification-icon">
            <span class="material-symbols-outlined">filter_alt</span>
          </div>
          <div class="notification-content">
            <h3>Filtered Out</h3>
            <p>Reservations are hidden due to current filter selection.</p>
          </div>
          <div class="notification-time">
            <span>-</span>
          </div>
        </div>
      `;
    }
  }
}

function setupFilters() {
  const searchInput = document.getElementById('reservationSearch');
  const statusFilter = document.getElementById('reservationStatusFilter');
  
  if (searchInput) {
    searchInput.addEventListener('input', filterReservations);
  }
  
  if (statusFilter) {
    statusFilter.addEventListener('change', filterReservations);
  }
  
  const notificationSearch = document.getElementById('notificationSearch');
  const notificationTypeFilter = document.getElementById('notificationTypeFilter');
  
  if (notificationSearch) {
    notificationSearch.addEventListener('input', filterNotifications);
  }
  
  if (notificationTypeFilter) {
    notificationTypeFilter.addEventListener('change', filterNotifications);
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  if (!dateString || dateString === 'Not returned') return dateString || 'N/A';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    min-width: 300px;
  `;
  
  notification.innerHTML = `
    ${escapeHtml(message)}
    <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 5000);
}

function initializeReservationManager() {
  console.log('🚀 Initializing Reservation Manager...');
  
  setupFilters();
  loadReservations();
  
  if (window.eReceiptModule || window.receiptModule) {
    console.log('✅ E-Receipt module detected and ready');
  } else {
    console.warn('⚠️ E-Receipt module not found - will attempt to load when needed');
  }
  
  console.log('✅ Reservation Manager initialized');
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('reservations-list')) {
    initializeReservationManager();
  }
});

window.loadReservations = loadReservations;
window.updateReservationStatus = updateReservationStatus;
window.showFulfillmentReceipt = showFulfillmentReceipt;
window.displayReservationNotifications = displayReservationNotifications;

function ensureEReceiptModule() {
  return new Promise((resolve) => {
    if (window.eReceiptModule || window.receiptModule) {
      resolve(true);
      return;
    }
    
    setTimeout(() => {
      if (window.eReceiptModule || window.receiptModule) {
        resolve(true);
      } else {
        console.warn('E-Receipt module still not available');
        resolve(false);
      }
    }, 1000);
  });
}

function showBasicReceiptInfo(reservationData, transactionId) {
  const receiptInfo = `
    📄 Book Fulfillment Receipt
    
    Transaction ID: ${transactionId}
    Book: ${reservationData.book_title || 'N/A'}
    Author: ${reservationData.author || 'N/A'}
    Borrower: ${reservationData.user_name || 'N/A'}
    Issue Date: ${new Date().toLocaleDateString()}
    Due Date: ${new Date(calculateDueDate()).toLocaleDateString()}
    
    Status: Fulfilled ✅
  `;
  
  alert(receiptInfo);
}