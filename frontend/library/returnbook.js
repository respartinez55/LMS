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

const returnBookSearch = document.querySelector('#returnBookSearch');
const returnStatusFilter = document.querySelector('#returnStatusFilter');
const borrowedBooksGrid = document.querySelector('#borrowed-books-grid');

const returnBookModal = document.querySelector('#returnBookModal');
const closeReturnModal = returnBookModal?.querySelector('.close-modal');
const returnBookTitleInput = document.querySelector('#returnBookTitle');
const returnDateInput = document.querySelector('#returnDate');
const bookConditionSelect = document.querySelector('#bookCondition');
const returnCommentsInput = document.querySelector('#returnComments');
const cancelReturnBtn = document.querySelector('#cancelReturn');
const confirmReturnBtn = document.querySelector('#confirmReturn');

let currentUser = null;
let borrowedBooks = [];
let selectedBookForReturn = null;

window.addEventListener('bookBorrowed', (e) => {
  if (borrowedBooksGrid) {
    loadBorrowedBooks();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  initializePage();
  setupEventListeners();
  
  if (!returnBookModal) {
    createReturnBookModal();
  }
});

function initializePage() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      getUserData(user.uid)
        .then(userData => {
          currentUser = {
            uid: user.uid,
            ...userData
          };
          document.getElementById('username').textContent = userData.firstName 
            ? `${userData.firstName} ${userData.lastName}`
            : userData.username;
          
          loadBorrowedBooks();
        })
        .catch(error => {
          console.error('Error getting user data:', error);
          showNotification('Error loading user data', 'error');
        });
    } else {
      window.location.href = 'login.html';
    }
  });
}

async function getUserData(uid) {
  try {
    const userSnapshot = await get(ref(database, 'users/' + uid));
    if (userSnapshot.exists()) {
      return userSnapshot.val();
    }
    throw new Error('User data not found');
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw error;
  }
}

function setupEventListeners() {
  if (returnBookSearch) {
    returnBookSearch.addEventListener('input', filterBorrowedBooks);
  }
  
  if (returnStatusFilter) {
    returnStatusFilter.addEventListener('change', filterBorrowedBooks);
  }
  
  if (closeReturnModal) {
    closeReturnModal.addEventListener('click', () => {
      returnBookModal.style.display = 'none';
      selectedBookForReturn = null;
    });
  }
  
  if (cancelReturnBtn) {
    cancelReturnBtn.addEventListener('click', () => {
      returnBookModal.style.display = 'none';
      selectedBookForReturn = null;
    });
  }
  
  if (confirmReturnBtn) {
    confirmReturnBtn.addEventListener('click', confirmReturn);
  }
  
  window.addEventListener('click', (e) => {
    if (e.target === returnBookModal) {
      returnBookModal.style.display = 'none';
      selectedBookForReturn = null;
    }
  });
  
  window.addEventListener('bookBorrowed', (e) => {
    if (borrowedBooksGrid) {
      loadBorrowedBooks();
    }
  });
}

function createReturnBookModal() {
  const modalHTML = `
    <div id="returnBookModal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Return Book</h2>
          <span class="close-modal">&times;</span>
        </div>
        <div class="modal-body">
          <div class="return-form">
            <div class="form-group">
              <label class="form-label">Book Title</label>
              <input type="text" class="form-control" id="returnBookTitle" readonly />
            </div>
            
            <div class="form-group">
              <label class="form-label">Return Date</label>
              <input type="date" class="form-control" id="returnDate" />
            </div>
            
            <div class="form-group">
              <label class="form-label">Condition</label>
              <select class="form-control" id="bookCondition">
                <option>Excellent</option>
                <option>Good</option>
                <option>Fair</option>
                <option>Poor</option>
                <option>Damaged</option>
              </select>
            </div>
            
            <div class="form-group">
              <label class="form-label">Comments</label>
              <textarea class="form-control" id="returnComments" rows="3" placeholder="Any additional comments about the book's condition"></textarea>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="cancelReturn">Cancel</button>
          <button class="btn btn-primary" id="confirmReturn">
            <span class="material-symbols-outlined">assignment_return</span>
            Confirm Return
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  returnBookModal = document.querySelector('#returnBookModal');
  closeReturnModal = returnBookModal.querySelector('.close-modal');
  returnBookTitleInput = document.querySelector('#returnBookTitle');
  returnDateInput = document.querySelector('#returnDate');
  bookConditionSelect = document.querySelector('#bookCondition');
  returnCommentsInput = document.querySelector('#returnComments');
  cancelReturnBtn = document.querySelector('#cancelReturn');
  confirmReturnBtn = document.querySelector('#confirmReturn');
  
  closeReturnModal.addEventListener('click', () => {
    returnBookModal.style.display = 'none';
    selectedBookForReturn = null;
  });
  
  cancelReturnBtn.addEventListener('click', () => {
    returnBookModal.style.display = 'none';
    selectedBookForReturn = null;
  });
  
  confirmReturnBtn.addEventListener('click', confirmReturn);
}

function getFallbackImageUrl() {
  return 'assets/no-cover.png';
}

async function loadBorrowedBooks() {
  if (!currentUser) return;
  
  try {
    showLoadingState(borrowedBooksGrid);
    
    const response = await fetch(`${API_BASE_URL}/books/borrowed/${currentUser.uid}`);
    const data = await response.json();
    
    if (data.success) {
      borrowedBooks = data.borrowedBooks || [];
      displayBorrowedBooks(borrowedBooks);
    } else {
      console.error('Failed to load borrowed books:', data.message);
      showNotification('Failed to load borrowed books', 'error');
      displayEmptyState(borrowedBooksGrid);
    }
  } catch (error) {
    console.error('Error loading borrowed books:', error);
    showNotification('Error loading borrowed books', 'error');
    displayEmptyState(borrowedBooksGrid);
  }
}

function showLoadingState(container) {
  if (!container) return;
  
  container.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading borrowed books...</p>
    </div>
  `;
  
  addLoadingStyles();
}

function displayEmptyState(container) {
  if (!container) return;
  
  container.innerHTML = `
    <div class="empty-state">
      <span class="material-symbols-outlined">menu_book</span>
      <h3>No borrowed books found</h3>
      <p>You don't have any books to return at the moment.</p>
      <a href="#" data-page="borrow" class="btn btn-secondary">Borrow Books</a>
    </div>
  `;
  
  addEmptyStateStyles();
  
  const borrowLink = container.querySelector('a[data-page="borrow"]');
  if (borrowLink) {
    borrowLink.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelector('.sidebar-links a[data-page="borrow"]').click();
    });
  }
}

function displayBorrowedBooks(books) {
  if (!borrowedBooksGrid) return;
  
  if (!books || books.length === 0) {
    displayEmptyState(borrowedBooksGrid);
    return;
  }
  
  borrowedBooksGrid.innerHTML = '';
  
  const fallbackImage = getFallbackImageUrl();
  
  books.forEach(book => {
    const isOverdue = isBookOverdue(book.dueDate);
    
    const bookElement = document.createElement('div');
    bookElement.className = 'book-card';
    bookElement.innerHTML = `
      <div class="book-cover">
        <img src="${book.coverImage || fallbackImage}" 
          alt="${book.title}" 
          onerror="this.src='${fallbackImage}';" />
        <div class="book-status ${isOverdue ? 'overdue' : ''}">${isOverdue ? 'Overdue' : 'On Time'}</div>
      </div>
      <div class="book-info">
        <h3 class="book-title">${book.title}</h3>
        <p class="book-author">${book.author || 'Unknown Author'}</p>
        <div class="book-meta">
          <span>Due: ${formatDate(book.dueDate)}</span>
        </div>
        <div class="book-actions">
          <button class="btn btn-primary return-book-btn" data-book-id="${book.id}" data-borrow-id="${book.borrowId || ''}">
            <span class="material-symbols-outlined">assignment_return</span>
            Return Book
          </button>
        </div>
      </div>
    `;
    
    const returnBtn = bookElement.querySelector('.return-book-btn');
    returnBtn.addEventListener('click', () => prepareReturn(book));
    
    borrowedBooksGrid.appendChild(bookElement);
  });
}

function filterBorrowedBooks() {
  if (!borrowedBooks || borrowedBooks.length === 0) return;
  
  const searchTerm = returnBookSearch?.value.toLowerCase() || '';
  const statusFilter = returnStatusFilter?.value || '';
  
  const filteredBooks = borrowedBooks.filter(book => {
    const matchesSearch = searchTerm === '' || 
      book.title.toLowerCase().includes(searchTerm) || 
      (book.author && book.author.toLowerCase().includes(searchTerm));
    
    let matchesStatus = true;
    if (statusFilter === 'ontime') {
      matchesStatus = !isBookOverdue(book.dueDate);
    } else if (statusFilter === 'overdue') {
      matchesStatus = isBookOverdue(book.dueDate);
    }
    
    return matchesSearch && matchesStatus;
  });
  
  displayBorrowedBooks(filteredBooks);
}

function isBookOverdue(dueDate) {
  const today = new Date();
  const due = new Date(dueDate);
  return today > due;
}

function formatDate(dateString) {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('en-US', options);
}

function prepareReturn(book) {
  selectedBookForReturn = book;
  
  const today = new Date();
  returnDateInput.value = today.toISOString().split('T')[0];
  
  returnBookTitleInput.value = book.title;
  
  bookConditionSelect.value = 'Good';
  
  if (returnCommentsInput) {
    returnCommentsInput.value = '';
  }
  
  returnBookModal.style.display = 'block';
}

async function confirmReturn() {
  if (!selectedBookForReturn) {
    showNotification('No book selected for return', 'error');
    return;
  }
  
  try {
    const returnData = {
      borrowId: selectedBookForReturn.borrowId,
      bookId: selectedBookForReturn.id,
      userId: currentUser.uid,
      returnDate: returnDateInput.value,
      condition: bookConditionSelect.value,
      comments: returnCommentsInput ? returnCommentsInput.value : ''
    };
    
    const response = await fetch(`${API_BASE_URL}/books/return`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(returnData),
    });
    
    const data = await response.json();
    
    if (data.success) {
      showNotification(`${selectedBookForReturn.title} returned successfully`, 'success');
      returnBookModal.style.display = 'none';
      
      loadBorrowedBooks();
      
      window.dispatchEvent(new CustomEvent('bookReturned', { 
        detail: { bookId: selectedBookForReturn.id } 
      }));
      
      selectedBookForReturn = null;
    } else {
      showNotification(data.message || 'Failed to return book', 'error');
    }
  } catch (error) {
    console.error('Error returning book:', error);
    showNotification('Error returning book', 'error');
  }
}

function addLoadingStyles() {
  if (!document.getElementById('loading-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'loading-styles';
    styleElement.textContent = `
      .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px;
        width: 100%;
        text-align: center;
      }
      
      .loading-spinner {
        border: 4px solid rgba(0, 0, 0, 0.1);
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border-left-color: #007bff;
        animation: spin 1s linear infinite;
        margin-bottom: 16px;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(styleElement);
  }
}

function addEmptyStateStyles() {
  if (!document.getElementById('empty-state-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'empty-state-styles';
    styleElement.textContent = `
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px;
        width: 100%;
        text-align: center;
        background-color: #f9f9f9;
        border-radius: 8px;
        margin: 20px 0;
      }
      
      .empty-state .material-symbols-outlined {
        font-size: 48px;
        margin-bottom: 16px;
        color: #6c757d;
      }
      
      .empty-state h3 {
        margin-bottom: 8px;
        color: #343a40;
      }
      
      .empty-state p {
        margin-bottom: 16px;
        color: #6c757d;
      }
    `;
    document.head.appendChild(styleElement);
  }
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

export {
  loadBorrowedBooks,
  filterBorrowedBooks
};