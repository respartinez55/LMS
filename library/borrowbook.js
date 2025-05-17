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

const borrowForm = document.querySelector('#borrow-page form');
const bookIdInput = document.querySelector('#borrow-page form #bookId');
const bookTitleInput = document.querySelector('#borrow-page form #bookTitle');
const borrowDateInput = document.querySelector('#borrow-page form #borrowDate');
const returnDateInput = document.querySelector('#borrow-page form #returnDate');
const borrowButton = document.querySelector('#borrow-page form #borrowBtn');
const recentlyBorrowedTable = document.querySelector('#borrow-page .table tbody');

const modal = document.querySelector('#receiptModal');
const closeModal = document.querySelector('.close-modal');
const downloadReceiptBtn = document.querySelector('#downloadReceipt');
const printReceiptBtn = document.querySelector('#printReceipt');

const bookChoiceContainer = document.createElement('div');
bookChoiceContainer.className = 'book-choices-container';

if (bookIdInput && bookIdInput.parentNode) {
  bookIdInput.parentNode.insertBefore(bookChoiceContainer, bookIdInput.nextSibling);
}

let currentUser = null;
let selectedBook = null;
let debounceTimer = null;
let pendingBorrowData = null;

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
          currentUser = {
            uid: user.uid,
            ...userData
          };
          document.getElementById('username').textContent = userData.firstName 
            ? `${userData.firstName} ${userData.lastName}`
            : userData.username;
          
          document.getElementById('borrowerName').textContent = userData.firstName 
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

function setDefaultDates() {
  const today = new Date();
  const twoWeeksLater = new Date();
  twoWeeksLater.setDate(today.getDate() + 14);
  
  borrowDateInput.value = formatDateForInput(today);
  returnDateInput.value = formatDateForInput(twoWeeksLater);
}

function formatDateForInput(date) {
  return date.toISOString().split('T')[0];
}

function setupEventListeners() {
  bookIdInput.addEventListener('input', debounceSearch);
  bookTitleInput.addEventListener('input', debounceSearch);
  
  borrowButton.addEventListener('click', async (e) => {
    e.preventDefault();
    await prepareBorrow();
  });
  
  closeModal.addEventListener('click', () => {
    modal.style.display = 'none';
    pendingBorrowData = null;
  });
  
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      pendingBorrowData = null;
    }
  });
  
  if (downloadReceiptBtn) {
    downloadReceiptBtn.addEventListener('click', confirmBorrow);
  }
  
  if (printReceiptBtn) {
    printReceiptBtn.addEventListener('click', downloadReceiptAsPDF);
  }
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

function displayBookChoices(books) {
  bookChoiceContainer.innerHTML = '';
  
  const heading = document.createElement('h4');
  heading.className = 'book-choices-heading';
  heading.textContent = `Found ${books.length} matching books:`;
  bookChoiceContainer.appendChild(heading);
  
  const choiceList = document.createElement('ul');
  choiceList.className = 'book-choices-list';
  
  books.forEach(book => {
    const choiceItem = document.createElement('li');
    choiceItem.className = 'book-choice-item';
    
    const coverImage = book.cover_image || '/images/default-book-cover.jpg';
    
    choiceItem.innerHTML = `
      <div class="book-choice-info">
        <img src="${coverImage}" alt="${book.title}" class="book-choice-cover">
        <div class="book-choice-details">
          <span class="book-choice-title">${book.title}</span>
          <span class="book-choice-author">by ${book.author}</span>
          <span class="book-choice-id">ID: ${book.id} | ISBN: ${book.isbn || 'N/A'}</span>
          <span class="book-choice-status ${book.status.toLowerCase() === 'available' ? 'available' : 'unavailable'}">
            ${book.status}
          </span>
        </div>
      </div>
      <button class="book-choice-select" data-book-id="${book.id}" 
        ${book.status.toLowerCase() !== 'available' ? 'disabled' : ''}>
        Select
      </button>
    `;
    
    choiceList.appendChild(choiceItem);
    
    const selectBtn = choiceItem.querySelector('.book-choice-select');
    selectBtn.addEventListener('click', (e) => {
      e.preventDefault();
      selectBookFromChoices(book);
    });
    
    choiceItem.addEventListener('click', (e) => {
      if (!e.target.closest('.book-choice-select')) {
        if (book.status.toLowerCase() === 'available') {
          selectBookFromChoices(book);
        } else {
          showNotification(`Book "${book.title}" is not available for borrowing`, 'error');
        }
      }
    });
  });
  
  bookChoiceContainer.appendChild(choiceList);
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'book-choices-close';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    bookChoiceContainer.innerHTML = '';
  });
  
  bookChoiceContainer.appendChild(closeBtn);
  
  addBookChoicesStyles();
}

function selectBookFromChoices(book) {
  selectedBook = book;
  bookIdInput.value = book.id;
  bookTitleInput.value = book.title;
  bookChoiceContainer.innerHTML = '';
  
  showNotification(`Book "${book.title}" selected`, 'success');
}

function addBookChoicesStyles() {
  if (!document.getElementById('book-choices-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'book-choices-styles';
    styleElement.textContent = `
      .book-choices-container {
        margin: 10px 0;
        padding: 0;
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid #ddd;
        border-radius: 5px;
        background-color: #f9f9f9;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 1000;
        position: relative;
      }
      .book-choices-heading {
        padding: 10px;
        margin: 0;
        background-color: #eee;
        border-bottom: 1px solid #ddd;
        font-size: 16px;
        color: #333;
      }
      .book-choices-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .book-choice-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 10px;
        border-bottom: 1px solid #eee;
        transition: background-color 0.2s;
        cursor: pointer;
      }
      .book-choice-item:hover {
        background-color: #f0f0f0;
      }
      .book-choice-info {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
      }
      .book-choice-cover {
        width: 60px;
        height: 80px;
        object-fit: cover;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        border-radius: 3px;
      }
      .book-choice-details {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .book-choice-title {
        font-weight: bold;
        font-size: 15px;
      }
      .book-choice-author {
        font-style: italic;
        color: #666;
      }
      .book-choice-id {
        font-size: 12px;
        color: #777;
      }
      .book-choice-status {
        font-size: 12px;
        font-weight: bold;
        padding: 2px 5px;
        border-radius: 3px;
        display: inline-block;
        margin-top: 3px;
      }
      .book-choice-status.available {
        background-color: #d4edda;
        color: #155724;
      }
      .book-choice-status.unavailable {
        background-color: #f8d7da;
        color: #721c24;
      }
      .book-choice-select {
        background-color: #007bff;
        color: white;
        border: none;
        padding: 5px 10px;
        border-radius: 3px;
        cursor: pointer;
        transition: background-color 0.2s;
        min-width: 70px;
      }
      .book-choice-select:hover {
        background-color: #0069d9;
      }
      .book-choice-select:disabled {
        background-color: #6c757d;
        cursor: not-allowed;
      }
      .book-choices-close {
        display: block;
        width: 100%;
        padding: 8px;
        background-color: #f8f9fa;
        border: none;
        border-top: 1px solid #ddd;
        cursor: pointer;
        font-weight: bold;
        color: #495057;
      }
      .book-choices-close:hover {
        background-color: #e2e6ea;
      }
    `;
    document.head.appendChild(styleElement);
  }
}

async function prepareBorrow() {
  if (!currentUser) {
    showNotification('Please log in to borrow books', 'error');
    return;
  }
  
  const bookId = bookIdInput.value.trim();
  const bookTitle = bookTitleInput.value.trim();
  const borrowDate = borrowDateInput.value;
  const returnDate = returnDateInput.value;
  
  if (!bookId || !bookTitle) {
    showNotification('Please enter book details', 'error');
    return;
  }
  
  try {
    let book;
    
    if (selectedBook) {
      book = selectedBook;
      
      if (book.status.toLowerCase() !== 'available') {
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
      
      if (book.status.toLowerCase() !== 'available') {
        showNotification('Book is not available for borrowing', 'error');
        return;
      }
    }
    
    const transactionId = generateTransactionId();
    const qrCodeData = `LMSBORROWID:${transactionId}`;
    const qrCodeUrl = await generateQRCodeURL(qrCodeData);
    const coverImagePath = book.cover_image || '/images/default-book-cover.jpg';
    
    pendingBorrowData = {
      bookId: book.id,
      userId: currentUser.uid,
      userEmail: currentUser.email,
      userName: currentUser.firstName 
        ? `${currentUser.firstName} ${currentUser.lastName}`
        : currentUser.username,
      borrowDate: borrowDate,
      dueDate: returnDate,
      returnDate: null,
      status: 'Borrowed',
      bookTitle: bookTitle,
      transactionId: transactionId,
      qr_code: qrCodeUrl,
      coverImage: coverImagePath
    };
    
    fillReceiptData({
      transactionId: transactionId,
      bookId: book.id,
      bookTitle: bookTitle,
      borrowDate: borrowDate,
      returnDate: returnDate,
      coverImage: coverImagePath
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
  
  try {
    const response = await fetch(`${API_BASE_URL}/books/borrow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pendingBorrowData),
    });
    
    const data = await response.json();
    
    if (data.success) {
      showNotification('Book borrowed successfully', 'success');
      modal.style.display = 'none';
      resetForm();
      loadBorrowedBooks();
    } else {
      showNotification(data.message || 'Failed to borrow book', 'error');
    }
  } catch (error) {
    console.error('Error borrowing book:', error);
    showNotification('Error borrowing book', 'error');
  }
}

function generateTransactionId() {
  const timestamp = new Date().getTime().toString().slice(-6);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `TR-${timestamp}-${random}`;
}

function fillReceiptData(data) {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  document.getElementById('receiptDate').textContent = currentDate;
  document.getElementById('transactionId').textContent = data.transactionId;
  document.getElementById('receiptBookId').textContent = data.bookId;
  document.getElementById('receiptBookTitle').textContent = data.bookTitle;
  document.getElementById('receiptBorrowDate').textContent = formatDateForDisplay(data.borrowDate);
  document.getElementById('receiptReturnDate').textContent = formatDateForDisplay(data.returnDate);
  
  const receiptBarcode = document.getElementById('receiptBarcode');
  if (receiptBarcode) {
    receiptBarcode.textContent = data.transactionId.replace('TR-', '');
  }
  
  const bookCoverElem = document.getElementById('receiptBookCover');
  if (bookCoverElem) {
    bookCoverElem.src = data.coverImage;
    bookCoverElem.alt = data.bookTitle;
  }
}

function formatDateForDisplay(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

async function generateQRCodeURL(data) {
  try {
    const response = await fetch(`${API_BASE_URL}/generate-qrcode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data }),
    });
    
    if (response.ok) {
      const result = await response.json();
      return result.qrCodeUrl;
    } else {
      console.error('Failed to generate QR code URL');
      return null;
    }
  } catch (error) {
    console.error('Error generating QR code URL:', error);
    return null;
  }
}

function createQRCode(transactionId) {
  const qrContainer = document.querySelector('#qrcode');
  if (qrContainer) {
    qrContainer.innerHTML = '';
    
    new QRCode(qrContainer, {
      text: `LMSBORROWID:${transactionId}`,
      width: 128,
      height: 128,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
  }
}

function showReceiptModal() {
  modal.style.display = 'block';
}

function downloadReceiptAsPDF() {
  if (typeof html2canvas === 'undefined' || typeof jsPDF === 'undefined') {
    loadPDFLibraries(() => generatePDF());
  } else {
    generatePDF();
  }
}

function loadPDFLibraries(callback) {
  const jspdfScript = document.createElement('script');
  jspdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  
  const html2canvasScript = document.createElement('script');
  html2canvasScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  
  jspdfScript.onload = function() {
    document.head.appendChild(html2canvasScript);
  };
  
  html2canvasScript.onload = callback;
  
  document.head.appendChild(jspdfScript);
}

function generatePDF() {
  const receiptElement = document.querySelector('.receipt');
  
  html2canvas(receiptElement).then(canvas => {
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, width, height);
    pdf.save(`book-receipt-${pendingBorrowData.transactionId}.pdf`);
  });
}

async function loadBorrowedBooks() {
  if (!currentUser) return;
  
  try {
    const response = await fetch(`${API_BASE_URL}/books/borrowed/${currentUser.uid}`);
    const data = await response.json();
    
    if (data.success) {
      displayBorrowedBooks(data.borrowedBooks);
    } else {
      console.error('Failed to load borrowed books:', data.message);
    }
  } catch (error) {
    console.error('Error loading borrowed books:', error);
  }
}

function displayBorrowedBooks(books) {
  recentlyBorrowedTable.innerHTML = '';
  
  if (!books || books.length === 0) {
    const noDataRow = document.createElement('tr');
    noDataRow.innerHTML = '<td colspan="3">No books borrowed yet</td>';
    recentlyBorrowedTable.appendChild(noDataRow);
    return;
  }
  
  books.forEach(book => {
    const row = document.createElement('tr');
    
    const borrowDate = new Date(book.borrowDate).toLocaleDateString();
    const dueDate = new Date(book.dueDate).toLocaleDateString();
    const coverImage = book.coverImage || '/images/default-book-cover.jpg';
    
    row.innerHTML = `
      <td>
        <div class="borrowed-book-info">
          <img src="${coverImage}" alt="${book.title}" class="borrowed-book-cover">
          <span>${book.bookTitle}</span>
        </div>
      </td>
      <td>${borrowDate}</td>
      <td>${dueDate}</td>
    `;
    
    recentlyBorrowedTable.appendChild(row);
  });
  
  if (!document.getElementById('borrowed-books-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'borrowed-books-styles';
    styleElement.textContent = `
      .borrowed-book-info {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .borrowed-book-cover {
        width: 40px;
        height: 50px;
        object-fit: cover;
        border-radius: 3px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
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

export {
  prepareBorrow,
  loadBorrowedBooks
};