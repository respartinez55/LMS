import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

import {
  getDatabase,
  ref,
  get,
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";

// Import separated modules (updated to use reservebookchoices instead of addbookchoices)
import { displayBookChoices, setBookChoiceContainer, setSelectBookCallback } from './reservebookchoices.js';

const firebaseConfig = {
  apiKey: "AIzaSyAzwZfY3ypX_Dmh7EjaBsg1jjbDppnMTvs",
  authDomain: "lmsystem-c57c1.firebaseapp.com",
  databaseURL: "https://lmsystem-c57c1-default-rtdb.firebaseio.com/",
  projectId: "lmsystem-c57c1",
  storageBucket: "lmsystem-c57c1.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "1:101310858086:web:e8f6c7dfd41214ca263ea7",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

const API_BASE_URL = 'http://localhost:5000/api';

// Reserve form elements
const reserveForm = document.querySelector('#reserve-page form');
const bookIdInput = document.querySelector('#reserve-page form input[placeholder="Enter Book ID or ISBN"]');
const bookTitleInput = document.querySelector('#reserve-page form input[placeholder="Enter Book Title"]');
const reserveDateInput = document.querySelector('#reserve-page form input[type="date"]:first-of-type');
const returnDateInput = document.querySelector('#reserve-page form input[type="date"]:last-of-type');
const reserveButton = document.querySelector('#reserve-page form button[type="submit"]');
const recentlyReservedTable = document.querySelector('#reserve-page .table tbody');

// Create book choice container for search results
const bookChoiceContainer = document.createElement('div');
bookChoiceContainer.className = 'book-choices-container';

if (bookIdInput && bookIdInput.parentNode) {
  bookIdInput.parentNode.insertBefore(bookChoiceContainer, bookIdInput.nextSibling);
}

// Connect to reservebookchoices.js
setBookChoiceContainer(bookChoiceContainer);
setSelectBookCallback(selectBookFromChoices);

let currentUser = null;
let selectedBook = null;
let debounceTimer = null;

// Prevent form submission from refreshing the page
if (reserveForm) {
  reserveForm.addEventListener('submit', (e) => e.preventDefault());
}

document.addEventListener('DOMContentLoaded', () => {
  initializePage();
  setupEventListeners();
});

function initializePage() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      getUserData(user.uid)
        .then(userData => {
          if (!userData) {
            showNotification('User data not found. Please complete registration.', 'error');
            window.location.href = 'index.html';
            return;
          }

          // Check if user account is approved
          if (userData.status === 'pending') {
            showNotification('Your account is pending approval. Please wait for admin approval.', 'error');
            auth.signOut();
            window.location.href = 'index.html';
            return;
          }

          if (userData.status === 'blocked') {
            showNotification('Your account has been blocked. Please contact admin.', 'error');
            auth.signOut();
            window.location.href = 'index.html';
            return;
          }

          currentUser = {
            uid: user.uid,
            email: user.email,
            ...userData
          };

          // Update display name based on user data structure
          const displayName = userData.firstName && userData.lastName 
            ? `${userData.firstName} ${userData.lastName}`
            : userData.username || user.email;

          const usernameElement = document.getElementById('username');
          
          if (usernameElement) {
            usernameElement.textContent = displayName;
          }
          
          loadReservedBooks();
        })
        .catch(error => {
          console.error('Error getting user data:', error);
          showNotification('Error loading user data', 'error');
          window.location.href = 'index.html';
        });
    } else {
      window.location.href = 'index.html';
    }
  });
}

async function getUserData(uid) {
  try {
    // Check if user is a student
    const studentSnapshot = await get(ref(database, 'students/' + uid));
    if (studentSnapshot.exists()) {
      return {
        ...studentSnapshot.val(),
        role: 'student'
      };
    }

    // Check if user is a teacher
    const teacherSnapshot = await get(ref(database, 'teachers/' + uid));
    if (teacherSnapshot.exists()) {
      return {
        ...teacherSnapshot.val(),
        role: 'teacher'
      };
    }

    // If not found in specific collections, check allUsers
    const allUsersSnapshot = await get(ref(database, 'allUsers/' + uid));
    if (allUsersSnapshot.exists()) {
      return allUsersSnapshot.val();
    }

    throw new Error('User data not found');
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw error;
  }
}

function formatDateForInput(date) {
  return date.toISOString().split('T')[0];
}

function setupEventListeners() {
  bookIdInput.addEventListener('input', debounceSearch);
  bookTitleInput.addEventListener('input', debounceSearch);
  
  reserveButton.addEventListener('click', async (e) => {
    e.preventDefault();
    await reserveBook();
  });
}

function debounceSearch(e) {
  clearTimeout(debounceTimer);
  
  const input = e.target;
  const value = input.value.trim();
  
  if (value.length > 0) {
    debounceTimer = setTimeout(() => {
      if (input === bookIdInput) {
        searchBookById(value);
      } else if (input === bookTitleInput) {
        searchBookByTitle(value);
      }
    }, 300);
  } else {
    bookChoiceContainer.innerHTML = '';
  }
}

async function searchBookById(bookId) {
  try {
    bookChoiceContainer.innerHTML = '';
    selectedBook = null;
    
    bookTitleInput.placeholder = "Searching...";
    
    let response = await fetch(`${API_BASE_URL}/books/search?id=${bookId}`);
    let data = await response.json();
    
    if (!data.success || data.books.length === 0) {
      response = await fetch(`${API_BASE_URL}/books/search?isbn=${bookId}`);
      data = await response.json();
    }
    
    bookTitleInput.placeholder = "Enter Book Title";
    
    if (data.success && data.books.length > 0) {
      if (data.books.length === 1) {
        const book = data.books[0];
        bookTitleInput.value = book.title;
        selectedBook = book;
        showNotification(`Book "${book.title}" found`, 'success');
        return book;
      } else {
        displayBookChoices(data.books);
        return data.books;
      }
    } else {
      try {
        const directResponse = await fetch(`${API_BASE_URL}/books/${bookId}`);
        const directData = await directResponse.json();
        
        if (directData.success && directData.book) {
          bookTitleInput.value = directData.book.title;
          selectedBook = directData.book;
          showNotification(`Book "${directData.book.title}" found`, 'success');
          return directData.book;
        } else {
          showNotification('No books found with this ID/ISBN', 'error');
          bookTitleInput.value = '';
          return null;
        }
      } catch (directError) {
        console.error('Error in direct book fetch:', directError);
        showNotification('No books found with this ID/ISBN', 'error');
        bookTitleInput.value = '';
        return null;
      }
    }
  } catch (error) {
    console.error('Error searching for book by ID:', error);
    showNotification('Error searching for book', 'error');
    bookTitleInput.placeholder = "Enter Book Title";
    return null;
  }
}

async function searchBookByTitle(title) {
  try {
    bookChoiceContainer.innerHTML = '';
    selectedBook = null;
    
    bookIdInput.placeholder = "Searching...";
    
    const response = await fetch(`${API_BASE_URL}/books/search?title=${encodeURIComponent(title)}`);
    const data = await response.json();
    
    bookIdInput.placeholder = "Enter Book ID or ISBN";
    
    if (data.success && data.books.length > 0) {
      if (data.books.length === 1) {
        const book = data.books[0];
        bookIdInput.value = book.id;
        selectedBook = book;
        showNotification(`Book "${book.title}" found`, 'success');
        return book;
      } else {
        displayBookChoices(data.books);
        return data.books;
      }
    } else {
      showNotification('No books found with this title', 'error');
      bookIdInput.value = '';
      return null;
    }
  } catch (error) {
    console.error('Error searching for book by title:', error);
    showNotification('Error searching for book', 'error');
    bookIdInput.placeholder = "Enter Book ID or ISBN";
    return null;
  }
}

function selectBookFromChoices(book) {
  selectedBook = book;
  bookIdInput.value = book.id;
  bookTitleInput.value = book.title;
  bookChoiceContainer.innerHTML = '';
  
  showNotification(`Book "${book.title}" selected`, 'success');
}

async function reserveBook() {
  if (!currentUser) {
    showNotification('Please log in to reserve books', 'error');
    return;
  }
  
  const bookId = bookIdInput.value.trim();
  const bookTitle = bookTitleInput.value.trim();
  const reserveDate = reserveDateInput.value;
  const returnDate = returnDateInput.value;
  
  if (!bookId || !bookTitle) {
    showNotification('Please enter book details', 'error');
    return;
  }
  
  if (!reserveDate || !returnDate) {
    showNotification('Please select reservation and return dates', 'error');
    return;
  }
  
  try {
    let book;
    
    if (selectedBook) {
      book = selectedBook;
    } else {
      // Try to fetch book details if not already selected
      let bookResponse = await fetch(`${API_BASE_URL}/books/${bookId}`);
      let bookData = await bookResponse.json();
      
      if (!bookData.success) {
        bookResponse = await fetch(`${API_BASE_URL}/books/search?isbn=${bookId}`);
        bookData = await bookResponse.json();
        
        if (bookData.success && bookData.books.length > 0) {
          book = bookData.books[0];
        }
      } else {
        book = bookData.book;
      }
      
      if (!book) {
        showNotification('Book not found', 'error');
        return;
      }
    }

    // Get user name
    const userName = currentUser.firstName && currentUser.lastName
      ? `${currentUser.firstName} ${currentUser.lastName}`
      : currentUser.username || currentUser.email;

    // ALIGNED: Prepare reservation data to match backend expectations
    const reservationData = {
      // REQUIRED FIELDS
      bookId: book.id.toString(), // Ensure string format
      userId: currentUser.uid,
      userEmail: currentUser.email,
      userName: userName,
      userRole: currentUser.role || 'student', // Default to student if not specified
      borrowDate: reserveDate, // Backend expects borrowDate field
      dueDate: returnDate, // Backend expects dueDate field
      
      // OPTIONAL FIELDS based on user type
      borrowerType: currentUser.role === 'teacher' ? 'Teacher' : 'Student',
      
      // Student-specific fields (only include if role is student)
      lrn: currentUser.role === 'student' ? (currentUser.lrn || null) : null,
      section: currentUser.role === 'student' ? (currentUser.section || null) : null,
      gradeLevel: currentUser.role === 'student' ? (currentUser.gradeLevel || currentUser.grade || null) : null,
      
      // Teacher-specific fields (only include if role is teacher)
      employeeId: currentUser.role === 'teacher' ? (currentUser.employeeId || currentUser.employee_id || null) : null,
      department: currentUser.role === 'teacher' ? (currentUser.department || null) : null
    };

    showNotification('Submitting reservation request...', 'info');
    
    // ALIGNED: Use the correct reservations endpoint
    const response = await fetch(`${API_BASE_URL}/reservations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reservationData),
    });
    
    const data = await response.json();
    
    if (data.success) {
      showNotification('Book reservation submitted successfully! Waiting for admin approval.', 'success');
      resetForm();
      loadReservedBooks();
    } else {
      // Handle specific error messages from backend
      if (data.message.includes('maximum reservation limit')) {
        showNotification(data.message, 'error');
      } else if (data.message.includes('already have an active reservation')) {
        showNotification('You already have a reservation for this book', 'error');
      } else if (data.message.includes('out of stock')) {
        showNotification('This book is currently not available', 'error');
      } else {
        showNotification(data.message || 'Failed to submit reservation request', 'error');
      }
    }
  } catch (error) {
    console.error('Error submitting reservation request:', error);
    if (error.message.includes('Failed to fetch')) {
      showNotification('Connection error. Please check your internet connection.', 'error');
    } else {
      showNotification('Error submitting reservation request', 'error');
    }
  }
}

async function loadReservedBooks() {
  if (!currentUser) return;
  
  try {
    console.log('Loading reservations for user:', currentUser.uid);
    
    // ALIGNED: Use the correct reservations endpoint for user
    const response = await fetch(`${API_BASE_URL}/reservations/user/${currentUser.uid}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Reservations response:', data);
    
    if (data.success) {
      // ALIGNED: Handle the response structure from reservations API
      const reservations = data.reservations || data.borrowedBooks || [];
      
      // Transform data to match frontend display expectations
      const transformedReservations = reservations.map(reservation => ({
        // Primary identifiers
        id: reservation.id,
        reservationId: reservation.reservation_id,
        transaction_id: reservation.reservation_id,
        
        // Book information
        bookId: reservation.book_id,
        bookTitle: reservation.title || reservation.book_title,
        title: reservation.title || reservation.book_title,
        author: reservation.author || 'Unknown Author',
        coverImage: reservation.cover_image,
        
        // User information
        user_id: currentUser.uid,
        user_name: reservation.user_name,
        user_email: reservation.user_email,
        user_role: reservation.user_role,
        
        // Date information - ALIGNED with backend field names
        reserveDate: reservation.borrowDate || reservation.reserve_date,
        returnDate: reservation.dueDate || reservation.return_date,
        borrow_date: reservation.borrowDate || reservation.reserve_date,
        due_date: reservation.dueDate || reservation.return_date,
        
        // Status and metadata
        status: reservation.status || 'Pending',
        requestDate: reservation.request_date || reservation.reserved_at,
        created_at: reservation.reserved_at
      }));
      
      displayReservedBooks(transformedReservations);
    } else {
      console.error('Failed to load reserved books:', data.message);
      showNotification(data.message || 'Failed to load reservations', 'error');
      displayReservedBooks([]);
    }
  } catch (error) {
    console.error('Error loading reserved books:', error);
    if (error.message.includes('Failed to fetch')) {
      showNotification('Connection error while loading reservations. Please refresh the page.', 'error');
    } else {
      showNotification('Error loading reservations. Please try again.', 'error');
    }
    displayReservedBooks([]);
  }
}

function displayReservedBooks(reservations) {
  if (!recentlyReservedTable) return;
  
  recentlyReservedTable.innerHTML = '';
  
  if (!reservations || reservations.length === 0) {
    const noDataRow = document.createElement('tr');
    noDataRow.innerHTML = '<td colspan="5">No books reserved yet</td>';
    recentlyReservedTable.appendChild(noDataRow);
    return;
  }
  
  reservations.forEach(reservation => {
    const row = document.createElement('tr');
    
    const reserveDate = reservation.reserveDate ? new Date(reservation.reserveDate).toLocaleDateString() : '-';
    const returnDate = reservation.returnDate ? new Date(reservation.returnDate).toLocaleDateString() : '-';
    
    // Updated status pill styling to match the provided CSS
    let statusPill = '';
    let statusClass = '';
    
    const status = reservation.status ? reservation.status.toLowerCase() : 'pending';
    
    switch(status) {
      case 'pending':
        statusPill = '<span class="status-pill status-pending">Pending</span>';
        statusClass = 'status-pending';
        break;
      case 'approved':
        statusPill = '<span class="status-pill status-reserved">Approved</span>';
        statusClass = 'status-approved';
        break;
      case 'fulfilled':
        statusPill = '<span class="status-pill status-borrowed">Fulfilled</span>';
        statusClass = 'status-fulfilled';
        break;
      case 'rejected':
        statusPill = '<span class="status-pill status-unavailable">Rejected</span>';
        statusClass = 'status-rejected';
        break;
      case 'cancelled':
        statusPill = '<span class="status-pill status-unavailable">Cancelled</span>';
        statusClass = 'status-cancelled';
        break;
      case 'expired':
        statusPill = '<span class="status-pill status-overdue">Expired</span>';
        statusClass = 'status-expired';
        break;
      default:
        statusPill = '<span class="status-pill status-pending">Pending</span>';
        statusClass = 'status-pending';
    }
    
    row.className = statusClass;
    row.innerHTML = `
      <td>
        <span class="book-title">${reservation.bookTitle || reservation.title}</span>
      </td>
      <td>
        <span class="book-author">${reservation.author}</span>
      </td>
      <td>${reserveDate}</td>
      <td>${returnDate}</td>
      <td>
        ${statusPill}
      </td>
    `;
    
    recentlyReservedTable.appendChild(row);
  });
  
  // Add updated styles with the new status pill design
  if (!document.getElementById('reserved-books-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'reserved-books-styles';
    styleElement.textContent = `
      :root {
        --success: #10b981;
        --danger: #ef4444;
        --warning: #fb923c;
        --secondary: #6366f1;
        --primary: #3b82f6;
        --muted: #6b7280;
      }
      
      .book-title {
        font-weight: 500;
        color: #333;
      }
      
      .book-author {
        color: #666;
        font-style: italic;
      }
      
      /* Status pill base styling */
      .status-pill {
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        display: inline-block;
      }
      
      /* Status pill dot indicator styling */
      .status-pill::before {
        content: '';
        display: inline-block;
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 50%;
        margin-right: 0.5rem;
      }
      
      /* Available status pill styling - Green */
      .status-available {
        background-color: rgba(16, 185, 129, 0.1);
        color: var(--success);
      }
      
      /* Available status pill dot styling */
      .status-available::before {
        background-color: var(--success);
      }
      
      /* Unavailable status pill styling - Red */
      .status-unavailable {
        background-color: rgba(239, 68, 68, 0.1);
        color: var(--danger);
      }
      
      /* Unavailable status pill dot styling */
      .status-unavailable::before {
        background-color: var(--danger);
      }
      
      /* Reserved status pill styling - Blue */
      .status-reserved {
        background-color: rgba(99, 102, 241, 0.1);
        color: var(--secondary);
      }
      
      /* Reserved status pill dot styling */
      .status-reserved::before {
        background-color: var(--secondary);
      }
      
      /* Overdue status pill styling - Red */
      .status-overdue {
        background-color: rgba(239, 68, 68, 0.1);
        color: var(--danger);
      }
      
      /* Overdue status pill dot styling */
      .status-overdue::before {
        background-color: var(--danger);
      }
      
      /* Borrowed status pill styling - Orange */
      .status-borrowed {
        background-color: rgba(251, 146, 60, 0.1);
        color: var(--warning);
      }
      
      /* Borrowed status pill dot styling */
      .status-borrowed::before {
        background-color: var(--warning);
      }
      
      /* Returned status pill styling - Green */
      .status-returned {
        background-color: rgba(16, 185, 129, 0.1);
        color: var(--success);
      }
      
      /* Returned status pill dot styling */
      .status-returned::before {
        background-color: var(--success);
      }
      
      /* Pending status pill styling - Gray */
      .status-pending {
        background-color: rgba(107, 114, 128, 0.1);
        color: var(--muted);
      }
      
      /* Pending status pill dot styling */
      .status-pending::before {
        background-color: var(--muted);
      }
      
      /* Info status pill styling - Blue */
      .status-info {
        background-color: rgba(59, 130, 246, 0.1);
        color: var(--primary);
      }
      
      /* Info status pill dot styling */
      .status-info::before {
        background-color: var(--primary);
      }
    `;
    document.head.appendChild(styleElement);
  }
}

function resetForm() {
  bookIdInput.value = '';
  bookTitleInput.value = '';
  selectedBook = null;
  bookChoiceContainer.innerHTML = '';
  // Clear date inputs instead of setting default dates
  if (reserveDateInput) reserveDateInput.value = '';
  if (returnDateInput) returnDateInput.value = '';
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
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
  
  if (!document.getElementById('notification-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'notification-styles';
    styleElement.textContent = `
      .notification {
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
      .notification.show {
        opacity: 1;
        transform: translateY(0);
      }
      .notification.success {
        background-color: #28a745;
      }
      .notification.error {
        background-color: #dc3545;
      }
      .notification.info {
        background-color: #17a2b8;
      }
      .notification.warning {
        background-color: #ffc107;
        color: #856404;
      }
    `;
    document.head.appendChild(styleElement);
  }
}

// Export functions that might be needed by other modules
export {
  reserveBook,
  loadReservedBooks
};