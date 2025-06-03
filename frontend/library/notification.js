const API_BASE_URL = 'http://localhost:5000/api';

let currentUser = null;
const notificationsList = document.querySelector('#recent-notifications-list');

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded - Starting notifications initialization');
  initializeNotifications();
});

function initializeNotifications() {
  console.log('Initializing notifications...');
  
  // Check if the notifications list element exists
  if (!notificationsList) {
    console.error('❌ Element with ID "recent-notifications-list" not found!');
    console.log('Available elements with similar IDs:', 
      Array.from(document.querySelectorAll('[id*="notification"]')).map(el => el.id)
    );
    return;
  } else {
    console.log('✅ Found notifications list element:', notificationsList);
  }

  // Since we're removing Firebase, we'll simulate a logged-in user
  // In a real app, you'd get this from your authentication system
  currentUser = {
    uid: 'user123', // This should come from your auth system
    role: 'student' // or 'teacher'
  };
  
  console.log('Current user set:', currentUser);
  
  if (currentUser) {
    loadNotifications();
    
    // Set up auto-refresh every 30 seconds
    setInterval(loadNotifications, 30000);
    console.log('Auto-refresh set up for every 30 seconds');
  } else {
    console.log('No current user, redirecting to index.html');
    window.location.href = 'index.html';
  }
}

async function loadNotifications() {
  console.log('🔄 Loading notifications...');
  
  if (!currentUser) {
    console.error('❌ No current user available');
    return;
  }
  
  if (!notificationsList) {
    console.error('❌ Notifications list element not available');
    return;
  }

  // Show loading state
  notificationsList.innerHTML = `
    <div class="notification-item">
      <div class="notification-icon">
        <i class="fas fa-spinner fa-spin"></i>
      </div>
      <div class="notification-content">
        <h3>Loading notifications...</h3>
        <p>Please wait while we fetch your notifications.</p>
      </div>
    </div>
  `;
  
  try {
    console.log(`📡 Fetching from: ${API_BASE_URL}/borrow/borrowed/${currentUser.uid}`);
    
    // Fetch borrowed books for current user
    const response = await fetch(`${API_BASE_URL}/borrow/borrowed/${currentUser.uid}`);
    console.log('📡 Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('📋 Raw API response:', data);
    
    if (data.success) {
      console.log('✅ API call successful');
      console.log('📚 Borrowed books data:', data.borrowedBooks);
      console.log('📊 Number of borrowed books:', data.borrowedBooks ? data.borrowedBooks.length : 0);
      
      if (!data.borrowedBooks || data.borrowedBooks.length === 0) {
        console.log('ℹ️ No borrowed books found');
        displayNoNotifications();
        return;
      }
      
      // Normalize: treat missing status as 'Pending'
      const normalized = data.borrowedBooks.map(book => {
        const normalizedBook = {
          ...book,
          status: book.status ? book.status : 'Pending'
        };
        console.log('📖 Normalized book:', normalizedBook);
        return normalizedBook;
      });
      
      generateNotifications(normalized);
    } else {
      console.error('❌ API returned success: false');
      console.error('Error message:', data.message);
      displayErrorNotification(`Failed to load borrowed books: ${data.message}`);
    }
  } catch (error) {
    console.error('❌ Error loading notifications:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    });
    displayErrorNotification(`Network error: ${error.message}`);
  }
}

function generateNotifications(borrowedBooks) {
  console.log('🔧 Generating notifications for books:', borrowedBooks);
  
  if (!notificationsList) {
    console.error('❌ Notifications list element not found in generateNotifications');
    return;
  }
  
  const notifications = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  console.log('📅 Today date (normalized):', today);
  
  borrowedBooks.forEach((book, index) => {
    console.log(`\n🔍 Processing book ${index + 1}:`, book);
    
    const dueDate = book.dueDate ? new Date(book.dueDate) : null;
    const borrowDate = book.borrowDate ? new Date(book.borrowDate) : null;
    const returnDate = book.returnDate ? new Date(book.returnDate) : null;
    const status = book.status ? book.status.toLowerCase() : 'pending';
    
    console.log(`📊 Book details:`, {
      title: book.bookTitle || book.title,
      author: book.author || book.bookAuthor,
      status: status,
      dueDate: dueDate,
      borrowDate: borrowDate,
      returnDate: returnDate
    });
    
    const bookTitle = book.bookTitle || book.title || 'Unknown Book';
    const bookAuthor = book.author || book.bookAuthor || 'Unknown Author';
    const bookId = book.borrowing_id || book.transaction_id || book.id || `book-${index}`;
    
    console.log(`🏷️ Book identifiers:`, {
      bookTitle,
      bookAuthor,
      bookId,
      status
    });
    
    // Generate notifications based on book status and information
    switch (status) {
      case 'pending':
        console.log('📝 Creating pending notification');
        notifications.push({
          id: `pending-${bookId}`,
          type: 'pending',
          title: 'Borrow Request Pending',
          message: `Your request to borrow "${bookTitle}" by ${bookAuthor} is waiting for admin approval.`,
          timestamp: book.borrowDate || new Date().toISOString(),
          bookTitle: bookTitle,
          bookAuthor: bookAuthor,
          priority: 'medium'
        });
        break;
        
      case 'borrowed':
      case 'approved':
        console.log('✅ Creating approved notification');
        // Book request approved and borrowed
        notifications.push({
          id: `approved-${bookId}`,
          type: 'approved',
          title: 'Borrow Request Approved',
          message: `Your request to borrow "${bookTitle}" by ${bookAuthor} has been approved! ${dueDate ? `Due date: ${dueDate.toLocaleDateString()}.` : ''}`,
          timestamp: book.borrowDate || new Date().toISOString(),
          bookTitle: bookTitle,
          bookAuthor: bookAuthor,
          priority: 'high'
        });
        
        // Check if due soon or overdue
        if (dueDate) {
          const timeDiff = dueDate.getTime() - today.getTime();
          const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
          
          console.log(`📅 Due date analysis: timeDiff=${timeDiff}, daysDiff=${daysDiff}`);
          
          if (daysDiff < 0) {
            console.log('⚠️ Creating overdue notification');
            // Overdue
            notifications.push({
              id: `overdue-${bookId}`,
              type: 'overdue',
              title: 'Book Overdue',
              message: `"${bookTitle}" by ${bookAuthor} is ${Math.abs(daysDiff)} day(s) overdue. Please return it as soon as possible.`,
              timestamp: dueDate.toISOString(),
              bookTitle: bookTitle,
              bookAuthor: bookAuthor,
              priority: 'high'
            });
          } else if (daysDiff <= 3) {
            console.log('🔔 Creating due soon notification');
            // Due soon
            notifications.push({
              id: `due-soon-${bookId}`,
              type: 'due-soon',
              title: 'Book Due Soon',
              message: `"${bookTitle}" by ${bookAuthor} is due in ${daysDiff} day(s). Please prepare to return it.`,
              timestamp: dueDate.toISOString(),
              bookTitle: bookTitle,
              bookAuthor: bookAuthor,
              priority: 'medium'
            });
          }
        }
        break;
        
      case 'rejected':
      case 'declined':
        console.log('❌ Creating rejected notification');
        notifications.push({
          id: `rejected-${bookId}`,
          type: 'rejected',
          title: 'Borrow Request Rejected',
          message: `Your request to borrow "${bookTitle}" by ${bookAuthor} has been rejected by the admin.`,
          timestamp: book.borrowDate || new Date().toISOString(),
          bookTitle: bookTitle,
          bookAuthor: bookAuthor,
          priority: 'high'
        });
        break;
        
      case 'returned':
        console.log('📖 Processing returned book');
        // Show return confirmation for recently returned books (within last 7 days)
        if (returnDate) {
          const returnTimeDiff = today.getTime() - returnDate.getTime();
          const returnDaysDiff = Math.floor(returnTimeDiff / (1000 * 3600 * 24));
          
          console.log(`📅 Return date analysis: returnDaysDiff=${returnDaysDiff}`);
          
          if (returnDaysDiff <= 7) {
            console.log('✅ Creating returned notification');
            notifications.push({
              id: `returned-${bookId}`,
              type: 'returned',
              title: 'Book Returned Successfully',
              message: `"${bookTitle}" by ${bookAuthor} was successfully returned ${returnDaysDiff === 0 ? 'today' : returnDaysDiff + ' day(s) ago'}.`,
              timestamp: returnDate.toISOString(),
              bookTitle: bookTitle,
              bookAuthor: bookAuthor,
              priority: 'low'
            });
          }
        }
        break;
        
      case 'overdue':
        console.log('⚠️ Processing explicitly overdue book');
        // Handle overdue status explicitly
        if (dueDate) {
          const timeDiff = today.getTime() - dueDate.getTime();
          const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
          
          notifications.push({
            id: `overdue-${bookId}`,
            type: 'overdue',
            title: 'Book Overdue',
            message: `"${bookTitle}" by ${bookAuthor} is ${daysDiff} day(s) overdue. Please return it immediately.`,
            timestamp: dueDate.toISOString(),
            bookTitle: bookTitle,
            bookAuthor: bookAuthor,
            priority: 'high'
          });
        }
        break;
        
      default:
        console.log(`⚠️ Unknown status: ${status} - creating generic notification`);
        notifications.push({
          id: `generic-${bookId}`,
          type: 'info',
          title: 'Book Status Update',
          message: `"${bookTitle}" by ${bookAuthor} has status: ${status}`,
          timestamp: book.borrowDate || new Date().toISOString(),
          bookTitle: bookTitle,
          bookAuthor: bookAuthor,
          priority: 'low'
        });
    }
  });
  
  console.log(`🎯 Generated ${notifications.length} notifications:`, notifications);
  
  // Sort notifications by priority and timestamp
  notifications.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
  
  console.log('📋 Sorted notifications:', notifications);
  
  displayNotifications(notifications);
}

function displayNotifications(notifications) {
  console.log('🖥️ Displaying notifications:', notifications);
  
  if (!notificationsList) {
    console.error('❌ Notifications list element not found in displayNotifications');
    return;
  }
  
  notificationsList.innerHTML = '';
  
  if (notifications.length === 0) {
    console.log('ℹ️ No notifications to display');
    displayNoNotifications();
    return;
  }
  
  console.log(`📝 Creating ${notifications.length} notification elements`);
  
  notifications.forEach((notification, index) => {
    console.log(`🔧 Creating notification element ${index + 1}:`, notification);
    const notificationElement = createNotificationElement(notification);
    notificationsList.appendChild(notificationElement);
    console.log(`✅ Added notification element ${index + 1} to DOM`);
  });
  
  // Add notification styles if not already added
  addNotificationStyles();
  
  console.log('🎨 Notification styles added');
  console.log('✅ All notifications displayed successfully');
}

function createNotificationElement(notification) {
  console.log('🔧 Creating notification element for:', notification);
  
  const element = document.createElement('div');
  element.className = `notification-item notification-${notification.type}`;
  element.setAttribute('data-notification-id', notification.id);
  
  const timeAgo = getTimeAgo(new Date(notification.timestamp));
  const iconClass = getNotificationIcon(notification.type);
  
  console.log(`🎨 Element details: class=${element.className}, timeAgo=${timeAgo}, icon=${iconClass}`);
  
  element.innerHTML = `
    <div class="notification-icon">
      <i class="${iconClass}"></i>
    </div>
    <div class="notification-content">
      <h3>${notification.title}</h3>
      <p>${notification.message}</p>
      <div class="book-info">
        <small><strong>Book:</strong> ${notification.bookTitle}</small>
        <small><strong>Author:</strong> ${notification.bookAuthor}</small>
      </div>
      <div class="notification-actions">
        <button class="action-link secondary" onclick="dismissNotification('${notification.id}')" style="padding: 4px 8px; display: inline-flex; align-items: center; gap: 4px; text-decoration: none; font-weight: 500; font-size: 0.8rem;">
          <i class="fas fa-times"></i>
          Dismiss
        </button>
      </div>
    </div>
    <div class="notification-time">
      <span>${timeAgo}</span>
    </div>
  `;
  
  console.log('✅ Notification element created successfully');
  return element;
}

function getNotificationIcon(type) {
  const icons = {
    'pending': 'fas fa-clock',
    'approved': 'fas fa-check-circle',
    'rejected': 'fas fa-times-circle',
    'overdue': 'fas fa-exclamation-triangle',
    'due-soon': 'fas fa-calendar-alt',
    'due-week': 'fas fa-calendar',
    'borrowed': 'fas fa-book',
    'returned': 'fas fa-check-circle',
    'info': 'fas fa-info-circle'
  };
  
  return icons[type] || 'fas fa-bell';
}

function getTimeAgo(date) {
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

function displayNoNotifications() {
  console.log('📭 Displaying no notifications message');
  
  if (!notificationsList) {
    console.error('❌ Notifications list element not found in displayNoNotifications');
    return;
  }
  
  notificationsList.innerHTML = `
    <div class="notification-item" id="no-pending-requests">
      <div class="notification-icon">
        <span class="material-symbols-outlined">notifications_off</span>
      </div>
      <div class="notification-content">
        <h3>No new notifications</h3>
        <p>You're all caught up! Check back later for updates on your borrowed books.</p>
      </div>
      <div class="notification-time">
        <span>-</span>
      </div>
    </div>
  `;
  
  console.log('✅ No notifications message displayed');
}

function displayErrorNotification(errorMessage = 'Unknown error occurred') {
  console.log('❌ Displaying error notification:', errorMessage);
  
  if (!notificationsList) {
    console.error('❌ Notifications list element not found in displayErrorNotification');
    return;
  }
  
  notificationsList.innerHTML = `
    <div class="notification-item">
      <div class="notification-icon">
        <i class="fas fa-exclamation-circle"></i>
      </div>
      <div class="notification-content">
        <h3>Error loading notifications</h3>
        <p>${errorMessage}</p>
        <div class="notification-actions">
          <button onclick="loadNotifications()" class="action-link primary" style="padding: 8px 16px; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; font-weight: 500;">
            <i class="fas fa-refresh"></i>
            Retry
          </button>
        </div>
      </div>
      <div class="notification-time">
        <span>Error</span>
      </div>
    </div>
  `;
  
  console.log('✅ Error notification displayed');
}

function dismissNotification(notificationId) {
  console.log('🗑️ Dismissing notification:', notificationId);
  
  const notificationElement = document.querySelector(`[data-notification-id="${notificationId}"]`);
  if (notificationElement) {
    notificationElement.style.opacity = '0';
    notificationElement.style.transform = 'translateX(100%)';
    
    setTimeout(() => {
      notificationElement.remove();
      console.log('✅ Notification removed from DOM');
      
      // Check if no notifications left
      const remainingNotifications = document.querySelectorAll('.notification-item:not(#no-pending-requests)');
      if (remainingNotifications.length === 0) {
        console.log('📭 No notifications remaining, showing empty state');
        displayNoNotifications();
      }
    }, 300);
  } else {
    console.error('❌ Notification element not found for dismissal:', notificationId);
  }
}

function addNotificationStyles() {
  if (document.getElementById('notification-page-styles')) {
    console.log('🎨 Notification styles already exist');
    return;
  }
  
  console.log('🎨 Adding notification styles');
  
  const styleElement = document.createElement('style');
  styleElement.id = 'notification-page-styles';
  styleElement.textContent = `
    /* Notification List Styles - Consistent with Borrow Requests */
    .notification-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      max-height: 70vh;
      overflow-y: auto;
      padding: 0;
    }

    /* Individual Notification Item - Matching Borrow Requests Style */
    .notification-item {
      display: flex;
      align-items: flex-start;
      padding: 1rem;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;
      position: relative;
      gap: 1rem;
    }

    .notification-item:hover {
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
      transform: translateY(-1px);
      border-color: #d1d5db;
    }

    /* Notification Icon - Consistent with second code */
    .notification-icon {
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      background: #f3f4f6;
      color: #6b7280;
    }

    /* Notification type specific styling */
    .notification-pending .notification-icon {
      background: rgba(107, 114, 128, 0.1);
      color: #6b7280;
    }

    .notification-approved .notification-icon {
      background: rgba(16, 185, 129, 0.1);
      color: #10b981;
    }

    .notification-rejected .notification-icon {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
    }

    .notification-overdue .notification-icon {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
    }

    .notification-due-soon .notification-icon {
      background: rgba(245, 158, 11, 0.1);
      color: #f59e0b;
    }

    .notification-due-week .notification-icon {
      background: rgba(59, 130, 246, 0.1);
      color: #3b82f6;
    }

    .notification-borrowed .notification-icon {
      background: rgba(16, 185, 129, 0.1);
      color: #10b981;
    }

    .notification-returned .notification-icon {
      background: rgba(16, 185, 129, 0.1);
      color: #10b981;
    }

    .notification-info .notification-icon {
      background: rgba(59, 130, 246, 0.1);
      color: #3b82f6;
    }

    /* Notification Content - Matching second code structure */
    .notification-content {
      flex: 1;
      min-width: 0;
    }

    .notification-content h3 {
      font-size: 1rem;
      font-weight: 600;
      margin: 0 0 0.5rem 0;
      color: #1f2937;
      line-height: 1.4;
    }

    .notification-content p {
      font-size: 0.875rem;
      color: #4b5563;
      margin: 0 0 0.75rem 0;
      line-height: 1.5;
    }

    /* Book Info Section */
    .book-info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin-bottom: 0.75rem;
      padding: 0.5rem;
      background: rgba(249, 250, 251, 0.8);
      border-radius: 4px;
      border-left: 3px solid #e5e7eb;
    }

    .book-info small {
      font-size: 0.75rem;
      color: #6b7280;
      line-height: 1.4;
    }

    .book-info small strong {
      color: #374151;
      font-weight: 600;
    }

    /* Notification Actions - Consistent styling */
    .notification-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }

    .action-link {
      background: none;
      border: 1px solid #d1d5db;
      color: #374151;
      cursor: pointer;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 500;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.2s ease;
    }

    .action-link:hover {
      background: #f9fafb;
      border-color: #9ca3af;
      color: #1f2937;
    }

    .action-link.primary {
      background: #3b82f6;
      border-color: #3b82f6;
      color: white;
    }

    .action-link.primary:hover {
      background: #2563eb;
      border-color: #2563eb;
    }

    .action-link.secondary {
      background: #f3f4f6;
      border-color: #d1d5db;
      color: #6b7280;
    }

    .action-link.secondary:hover {
      background: #e5e7eb;
      color: #374151;
    }

    /* Notification Time - Positioned like second code */
    .notification-time {
      flex-shrink: 0;
      text-align: right;
    }

    .notification-time span {
      font-size: 0.75rem;
      color: #6b7280;
      white-space: nowrap;
    }

    /* Special styling for no notifications state */
    #no-pending-requests {
      text-align: center;
      padding: 2rem;
      border: 2px dashed #e5e7eb;
      background: #f9fafb;
    }

    #no-pending-requests .notification-icon {
      margin: 0 auto 1rem;
      background: #f3f4f6;
      color: #9ca3af;
    }

    #no-pending-requests .notification-content h3 {
      color: #6b7280;
      margin-bottom: 0.5rem;
    }

    #no-pending-requests .notification-content p {
      color: #9ca3af;
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .notification-item {
        padding: 0.75rem;
        flex-direction: column;
        gap: 0.75rem;
      }

      .notification-icon {
        width: 32px;
        height: 32px;
        font-size: 1rem;
        align-self: flex-start;
      }

      .notification-content h3 {
        font-size: 0.875rem;
      }

      .notification-content p {
        font-size: 0.8125rem;
      }

      .book-info {
        padding: 0.4rem;
      }

      .book-info small {
        font-size: 0.7rem;
      }

      .notification-time {
        align-self: flex-start;
        text-align: left;
      }

      .action-link {
        padding: 4px 8px;
        font-size: 0.75rem;
      }
    }

    /* Scrollbar Styling */
    .notification-list::-webkit-scrollbar {
      width: 6px;
    }

    .notification-list::-webkit-scrollbar-track {
      background: #f1f5f9;
      border-radius: 3px;
    }

    .notification-list::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 3px;
    }

    .notification-list::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }

    /* Material Icons fallback */
    .material-symbols-outlined {
      font-family: 'Material Icons', 'Font Awesome 5 Free';
      font-weight: 400;
      font-style: normal;
      font-size: 1.2rem;
      line-height: 1;
      letter-spacing: normal;
      text-transform: none;
      display: inline-block;
      white-space: nowrap;
      word-wrap: normal;
      direction: ltr;
      -webkit-font-feature-settings: 'liga';
      -webkit-font-smoothing: antialiased;
    }

    /* Fallback for Material Icons */
    .material-symbols-outlined:before {
      content: '\\f0f3'; /* FontAwesome bell icon as fallback */
      font-family: 'Font Awesome 5 Free';
      font-weight: 900;
    }
  `;
  document.head.appendChild(styleElement);
  console.log('✅ Notification styles added successfully');
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `toast-notification ${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
  
  
  if (!document.getElementById('toast-notification-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'toast-notification-styles';
    styleElement.textContent = `
      .toast-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 4px;
        color: white;
        font-weight: bold;
        opacity: 0;
        transform: translateY(-20px);
        transition: all 0.3s ease;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }
      .toast-notification.show {
        opacity: 1;
        transform: translateY(0);
      }
      .toast-notification.success {
        background-color: #28a745;
      }
      .toast-notification.error {
        background-color: #dc3545;
      }
      .toast-notification.info {
        background-color: #17a2b8;
      }
    `;
    document.head.appendChild(styleElement);
  }
}

// Make functions globally available
window.dismissNotification = dismissNotification;
window.loadNotifications = loadNotifications;

// Export functions for potential use by other modules
export {
  loadNotifications,
  dismissNotification
};