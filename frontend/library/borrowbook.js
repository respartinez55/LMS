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

// Import separated modules
import { displayBookChoices, setBookChoiceContainer, setSelectBookCallback } from './addbookchoices.js';
// Import modal functions
import { fillReceiptData, showReceiptModal, createQRCode, setupReceiptModalEvents } from './ereceiptmodal.js';

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

// Fixed selectors to match HTML structure
const borrowForm = document.querySelector('#borrowForm');
const bookIdInput = document.querySelector('#bookId');
const bookTitleInput = document.querySelector('#bookTitle');
const borrowDateInput = document.querySelector('#borrowDate');
const returnDateInput = document.querySelector('#returnDate');
const borrowButton = document.querySelector('#borrowBtn');
const recentlyBorrowedTable = document.querySelector('#borrow-page .table tbody');

const bookChoiceContainer = document.createElement('div');
bookChoiceContainer.className = 'book-choices-container';

if (bookIdInput && bookIdInput.parentNode) {
  bookIdInput.parentNode.insertBefore(bookChoiceContainer, bookIdInput.nextSibling);
}

// Connect to addbookchoices.js
setBookChoiceContainer(bookChoiceContainer);
setSelectBookCallback(selectBookFromChoices);

// Connect to ereceiptmodal.js
setupReceiptModalEvents();

let currentUser = null;
let selectedBook = null;
let debounceTimer = null;
let pendingBorrowData = null;

// Prevent form submission from refreshing the page
if (borrowForm) {
  borrowForm.addEventListener('submit', (e) => e.preventDefault());
}

document.addEventListener('DOMContentLoaded', () => {
  initializePage();
  setDefaultDates();
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
            ...userData
          };

          // Update display name based on user data structure
          const displayName = userData.firstName && userData.lastName 
            ? `${userData.firstName} ${userData.lastName}`
            : userData.username || user.email;

          const usernameElement = document.getElementById('username');
          const borrowerNameElement = document.getElementById('borrowerName');
          
          if (usernameElement) {
            usernameElement.textContent = displayName;
          }
          if (borrowerNameElement) {
            borrowerNameElement.textContent = displayName;
          }
          
          loadBorrowedBooks();
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

function setDefaultDates() {
  if (borrowDateInput && returnDateInput) {
    const today = new Date();
    const twoWeeksLater = new Date();
    twoWeeksLater.setDate(today.getDate() + 14);
    
    borrowDateInput.value = formatDateForInput(today);
    returnDateInput.value = formatDateForInput(twoWeeksLater);
  }
}

function formatDateForInput(date) {
  return date.toISOString().split('T')[0];
}

function setupEventListeners() {
  // Check if elements exist before adding event listeners
  if (bookIdInput) {
    bookIdInput.addEventListener('input', debounceSearch);
  } else {
    console.warn('bookIdInput element not found');
  }
  
  if (bookTitleInput) {
    bookTitleInput.addEventListener('input', debounceSearch);
  } else {
    console.warn('bookTitleInput element not found');
  }
  
  if (borrowButton) {
    borrowButton.addEventListener('click', async (e) => {
      e.preventDefault();
      await prepareBorrow();
    });
  } else {
    console.warn('borrowButton element not found');
  }

  // Listen for confirm borrow event from the modal
  document.addEventListener('confirm-borrow', async (e) => {
    // Always set status to Pending and assign qr_code from event.detail
    if (pendingBorrowData) {
      pendingBorrowData.status = 'Pending';
      if (e && e.detail && e.detail.qr_code) {
        pendingBorrowData.qr_code = e.detail.qr_code;
      }
    }
    await confirmBorrow();
  });

  // Listen for modal close event to reset form if needed
  document.addEventListener('modal-closed', () => {
    // Optional: Reset form when modal is closed without confirming
    // resetForm();
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
    
    if (bookTitleInput) {
      bookTitleInput.placeholder = "Searching...";
    }
    
    let response = await fetch(`${API_BASE_URL}/books/search?id=${bookId}`);
    let data = await response.json();
    
    if (!data.success || data.books.length === 0) {
      response = await fetch(`${API_BASE_URL}/books/search?isbn=${bookId}`);
      data = await response.json();
    }
    
    if (bookTitleInput) {
      bookTitleInput.placeholder = "Enter Book Title";
    }
    
    if (data.success && data.books.length > 0) {
      if (data.books.length === 1) {
        const book = data.books[0];
        if (bookTitleInput) {
          bookTitleInput.value = book.title;
        }
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
          if (bookTitleInput) {
            bookTitleInput.value = directData.book.title;
          }
          selectedBook = directData.book;
          showNotification(`Book "${directData.book.title}" found`, 'success');
          return directData.book;
        } else {
          showNotification('No books found with this ID/ISBN', 'error');
          if (bookTitleInput) {
            bookTitleInput.value = '';
          }
          return null;
        }
      } catch (directError) {
        console.error('Error in direct book fetch:', directError);
        showNotification('No books found with this ID/ISBN', 'error');
        if (bookTitleInput) {
          bookTitleInput.value = '';
        }
        return null;
      }
    }
  } catch (error) {
    console.error('Error searching for book by ID:', error);
    showNotification('Error searching for book', 'error');
    if (bookTitleInput) {
      bookTitleInput.placeholder = "Enter Book Title";
    }
    return null;
  }
}

async function searchBookByTitle(title) {
  try {
    bookChoiceContainer.innerHTML = '';
    selectedBook = null;
    
    if (bookIdInput) {
      bookIdInput.placeholder = "Searching...";
    }
    
    const response = await fetch(`${API_BASE_URL}/books/search?title=${encodeURIComponent(title)}`);
    const data = await response.json();
    
    if (bookIdInput) {
      bookIdInput.placeholder = "Enter Book ID or ISBN";
    }
    
    if (data.success && data.books.length > 0) {
      if (data.books.length === 1) {
        const book = data.books[0];
        if (bookIdInput) {
          bookIdInput.value = book.id;
        }
        selectedBook = book;
        showNotification(`Book "${book.title}" found`, 'success');
        return book;
      } else {
        displayBookChoices(data.books);
        return data.books;
      }
    } else {
      showNotification('No books found with this title', 'error');
      if (bookIdInput) {
        bookIdInput.value = '';
      }
      return null;
    }
  } catch (error) {
    console.error('Error searching for book by title:', error);
    showNotification('Error searching for book', 'error');
    if (bookIdInput) {
      bookIdInput.placeholder = "Enter Book ID or ISBN";
    }
    return null;
  }
}

function selectBookFromChoices(book) {
  selectedBook = book;
  if (bookIdInput) {
    bookIdInput.value = book.id;
  }
  if (bookTitleInput) {
    bookTitleInput.value = book.title;
  }
  bookChoiceContainer.innerHTML = '';
  
  showNotification(`Book "${book.title}" selected`, 'success');
}

async function prepareBorrow() {
  if (!currentUser) {
    showNotification('Please log in to borrow books', 'error');
    return;
  }
  
  const bookId = bookIdInput ? bookIdInput.value.trim() : '';
  const bookTitle = bookTitleInput ? bookTitleInput.value.trim() : '';
  const borrowDate = borrowDateInput ? borrowDateInput.value : '';
  const returnDate = returnDateInput ? returnDateInput.value : '';
  
  if (!bookId || !bookTitle) {
    showNotification('Please enter book details', 'error');
    return;
  }
  
  try {
    let book;
    
    if (selectedBook) {
      book = selectedBook;
      
      if (book.status && book.status.toLowerCase() !== 'available') {
        showNotification('Book is not available for borrowing', 'error');
        return;
      }
    } else {
      let bookResponse = await fetch(`${API_BASE_URL}/books/${bookId}`);
      let bookData = await bookResponse.json();
      
      if (!bookData.success) {
        bookResponse = await fetch(`${API_BASE_URL}/books/isbn/${bookId}`);
        bookData = await bookResponse.json();
      }
      
      if (!bookData.success) {
        showNotification('Book not found', 'error');
        return;
      }
      
      book = bookData.book;
      
      if (book.status && book.status.toLowerCase() !== 'available') {
        showNotification('Book is not available for borrowing', 'error');
        return;
      }
    }

    // Generate a transaction ID with the updated format matching the second code
    const transactionId = generateTransactionId();
    const coverImage = book.cover_image || '/images/default-book-cover.jpg';
    const userName = currentUser.firstName && currentUser.lastName
      ? `${currentUser.firstName} ${currentUser.lastName}`
      : currentUser.username || currentUser.email;

    // Prepare borrow data but don't save to database yet
    pendingBorrowData = {
      bookId: book.id,
      userId: currentUser.uid,
      userEmail: currentUser.email,
      userName: userName,
      userRole: currentUser.role || 'student',
      borrowDate: borrowDate,
      dueDate: returnDate,
      returnDate: null,
      status: 'Pending', // Always set as pending
      bookTitle: bookTitle,
      transactionId: transactionId,
      coverImage: coverImage,
      requestDate: new Date().toISOString() // Add request date
      // qr_code will be added after QR upload
    };

    // Show the e-receipt modal with data
    fillReceiptData({
      transactionId: transactionId,
      bookId: book.id,
      bookTitle: bookTitle,
      borrowDate: borrowDate,
      returnDate: returnDate,
      coverImage: coverImage,
      userName: userName,
      userEmail: currentUser.email
    });

    createQRCode(transactionId);

    showReceiptModal();

  } catch (error) {
    console.error('Error preparing to borrow book:', error);
    showNotification('Error preparing to borrow book', 'error');
  }
}

async function confirmBorrow() {
  if (!pendingBorrowData) {
    showNotification('Borrowing data not found', 'error');
    return;
  }

  // Always set status to Pending before sending to backend
  pendingBorrowData.status = 'Pending';

  try {
    showNotification('Submitting borrow request...', 'info');
    
    const response = await fetch(`${API_BASE_URL}/borrow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pendingBorrowData),
    });
    
    const data = await response.json();
    
    if (data.success) {
      showNotification('Borrow request submitted successfully! Waiting for admin approval.', 'success');
      // Close modal after successful borrow
      const modal = document.querySelector('#receiptModal');
      if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
        document.body.style.overflow = '';
      }
      resetForm();
      loadBorrowedBooks();
      pendingBorrowData = null;
    } else {
      showNotification(data.message || 'Failed to submit borrow request', 'error');
    }
  } catch (error) {
    console.error('Error submitting borrow request:', error);
    showNotification('Error submitting borrow request', 'error');
  }
}

function generateTransactionId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  return `IS-${year}${month}${day}${hours}${minutes}${seconds}${random}`;
}

async function loadBorrowedBooks() {
  if (!currentUser) return;
  
  try {
    const response = await fetch(`${API_BASE_URL}/borrow/borrowed/${currentUser.uid}`);
    const data = await response.json();
    
    if (data.success) {
      // Normalize: treat missing status as 'Pending'
      const normalized = data.borrowedBooks.map(b => ({
        ...b,
        status: b.status ? b.status : 'Pending'
      }));
      displayBorrowedBooks(normalized);
    } else {
      console.error('Failed to load borrowed books:', data.message);
    }
  } catch (error) {
    console.error('Error loading borrowed books:', error);
  }
}

function displayBorrowedBooks(books) {
  if (!recentlyBorrowedTable) {
    console.warn('Recently borrowed table not found');
    return;
  }
  
  recentlyBorrowedTable.innerHTML = '';
  
  if (!books || books.length === 0) {
    const noDataRow = document.createElement('tr');
    noDataRow.innerHTML = '<td colspan="4">No books borrowed yet</td>'; // Updated colspan to 4 (removed image column)
    recentlyBorrowedTable.appendChild(noDataRow);
    return;
  }
  
  books.forEach(book => {
    const row = document.createElement('tr');
    
    const borrowDate = book.borrowDate ? new Date(book.borrowDate).toLocaleDateString() : '-';
    const dueDate = book.dueDate ? new Date(book.dueDate).toLocaleDateString() : '-';
    const author = book.author || book.bookAuthor || '-'; // Handle different author field names
    
    // Create status pill with dot indicator
    let statusPill = '';
    let statusClass = '';
    
    switch(book.status && book.status.toLowerCase()) {
      case 'pending':
        statusPill = '<span class="status-pill status-pending">Pending</span>';
        statusClass = 'row-status-pending';
        break;
      case 'borrowed':
        statusPill = '<span class="status-pill status-borrowed">Borrowed</span>';
        statusClass = 'row-status-borrowed';
        break;
      case 'returned':
        statusPill = '<span class="status-pill status-returned">Returned</span>';
        statusClass = 'row-status-returned';
        break;
      case 'overdue':
        statusPill = '<span class="status-pill status-overdue">Overdue</span>';
        statusClass = 'row-status-overdue';
        break;
      default:
        statusPill = '<span class="status-pill status-pending">Pending</span>';
        statusClass = 'row-status-pending';
    }
    
    row.className = statusClass;
    row.innerHTML = `
      <td>${book.bookTitle || book.title}</td>
      <td>${author}</td>
      <td>${borrowDate}</td>
      <td>${dueDate}</td>
      <td>${statusPill}</td>
    `;
    
    recentlyBorrowedTable.appendChild(row);
  });
  
  // Add styles if not already added
  if (!document.getElementById('borrowed-books-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'borrowed-books-styles';
    styleElement.textContent = `
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

      /* Pending status pill styling */
      .status-pending {
        background-color: rgba(107, 114, 128, 0.1);
        color: #6b7280;
      }

      .status-pending::before {
        background-color: #6b7280;
      }

      /* Borrowed status pill styling */
      .status-borrowed {
        background-color: rgba(251, 146, 60, 0.1);
        color: #f59e0b;
      }

      .status-borrowed::before {
        background-color: #f59e0b;
      }

      /* Returned status pill styling */
      .status-returned {
        background-color: rgba(16, 185, 129, 0.1);
        color: #10b981;
      }

      .status-returned::before {
        background-color: #10b981;
      }

      /* Overdue status pill styling */
      .status-overdue {
        background-color: rgba(239, 68, 68, 0.1);
        color: #ef4444;
      }

      .status-overdue::before {
        background-color: #ef4444;
      }

      /* Row background colors for different statuses */
      .row-status-pending {
        background-color: rgba(107, 114, 128, 0.05);
      }

      .row-status-overdue {
        background-color: rgba(239, 68, 68, 0.05);
      }

      .row-status-borrowed {
        background-color: rgba(251, 146, 60, 0.05);
      }

      .row-status-returned {
        background-color: rgba(16, 185, 129, 0.05);
      }
    `;
    document.head.appendChild(styleElement);
  }
}

function resetForm() {
  if (bookIdInput) {
    bookIdInput.value = '';
  }
  if (bookTitleInput) {
    bookTitleInput.value = '';
  }
  selectedBook = null;
  bookChoiceContainer.innerHTML = '';
  pendingBorrowData = null;
  setDefaultDates();
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
    `;
    document.head.appendChild(styleElement);
  }
}

// Export functions that might be needed by other modules
export {
  prepareBorrow,
  loadBorrowedBooks,
  confirmBorrow
};