const API_BASE_URL = 'http://localhost:5000';

function getStatusClass(status) {
  const statusLower = status.toLowerCase();
  if (statusLower === 'available') return 'status-available';
  if (statusLower === 'unavailable' || statusLower === 'borrowed' || statusLower === 'issued') return 'status-unavailable';
  if (statusLower === 'reserved') return 'status-reserved';
  return 'status-info';
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function getFallbackImageUrl() {
  return 'assets/no-cover.png';
}

function showNotification(message, type = "info") {
  let container = document.querySelector(".notification-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "notification-container";
    document.body.appendChild(container);
  }

  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <span>${message}</span>
    <button class="close-btn">&times;</button>
  `;

  container.appendChild(notification);

  notification.querySelector(".close-btn").addEventListener("click", () => {
    notification.classList.add("fade-out");
    setTimeout(() => notification.remove(), 300);
  });

  setTimeout(() => {
    if (notification.parentNode) {
      notification.classList.add("fade-out");
      setTimeout(() => notification.remove(), 300);
    }
  }, 5000);
}

async function loadSavedBooks() {
  try {
    const savedBookIds = JSON.parse(localStorage.getItem('savedBooks') || '[]');
    
    const savedPage = document.getElementById("saved-page");
    
    if (savedBookIds.length === 0) {
      displayEmptySavedState();
      return;
    }

    savedPage.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Saved Books</h1>
        <div class="action-buttons">
          <button class="btn btn-accent" id="clear-saved-btn">
            <span class="material-symbols-outlined">delete</span>
            Clear All
          </button>
        </div>
      </div>
      <div class="card">
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Cover</th>
                <th>Title</th>
                <th>Author</th>
                <th>Category</th>
                <th>ISBN</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="saved-books-table">
              <tr>
                <td colspan="6">
                  <div class="loading-spinner">
                    <span class="material-symbols-outlined">refresh</span>
                    <span>Loading saved books...</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    const clearAllBtn = document.getElementById("clear-saved-btn");
    if (clearAllBtn) {
      clearAllBtn.addEventListener("click", () => {
        clearAllSavedBooks();
      });
    }

    const savedBooksTable = document.getElementById("saved-books-table");
    if (!savedBooksTable) {
      console.error("Saved books table not found");
      return;
    }
    
    savedBooksTable.innerHTML = '';

    // Track successful and failed fetches
    let successCount = 0;
    let failedIds = [];

    const fetchPromises = savedBookIds.map(async (bookId) => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/books/${bookId}`, {
          method: "GET",
          headers: { "Accept": "application/json" }
        });
        
        if (!response.ok) {
          console.warn(`Book with ID ${bookId} not found (${response.status})`);
          failedIds.push(bookId);
          return null;
        }
        
        const data = await response.json();
        
        if (data.success && data.book) {
          successCount++;
          return data.book;
        } else {
          console.warn(`Book with ID ${bookId} returned invalid data:`, data);
          failedIds.push(bookId);
          return null;
        }
      } catch (error) {
        console.error(`Error fetching book ${bookId}:`, error);
        failedIds.push(bookId);
        return null;
      }
    });

    const books = await Promise.all(fetchPromises);
    const validBooks = books.filter(book => book !== null);

    // Clean up localStorage by removing failed book IDs
    if (failedIds.length > 0) {
      const updatedSavedBooks = savedBookIds.filter(id => !failedIds.includes(id));
      localStorage.setItem('savedBooks', JSON.stringify(updatedSavedBooks));
      
      if (failedIds.length === 1) {
        showNotification(`⚠️ Removed 1 invalid book from saved list`, "warning");
      } else if (failedIds.length > 1) {
        showNotification(`⚠️ Removed ${failedIds.length} invalid books from saved list`, "warning");
      }
    }

    if (validBooks.length === 0) {
      displayEmptySavedState();
      return;
    }

    // Display the valid books
    validBooks.forEach(book => {
      const row = createSavedBookTableRow(book);
      savedBooksTable.appendChild(row);
    });

    console.log(`✅ Loaded ${validBooks.length} saved books successfully`);
    
    if (failedIds.length > 0) {
      console.log(`⚠️ Cleaned up ${failedIds.length} invalid book IDs from saved list`);
    }

  } catch (error) {
    console.error("❌ Error loading saved books:", error);
    showNotification(`❌ Failed to load saved books: ${error.message}`, "error");
    
    const savedBooksTable = document.getElementById("saved-books-table");
    if (savedBooksTable) {
      savedBooksTable.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-table-message">
              <span class="material-symbols-outlined">error</span>
              <p>Failed to load saved books. Please try again.</p>
              <button class="btn btn-primary" onclick="loadSavedBooks()">Retry</button>
            </div>
          </td>
        </tr>
      `;
    }
  }
}

function createSavedBookTableRow(book) {
  const row = document.createElement('tr');
  row.dataset.bookId = book.id;
  
  const statusLower = book.status ? book.status.toLowerCase() : '';
  const isAvailable = statusLower === 'available';
  const isReserved = statusLower === 'reserved';
  const isUnavailable = statusLower === 'unavailable' || statusLower === 'borrowed' || statusLower === 'issued';
  
  // Determine button properties based on status
  let buttonClass, buttonText, buttonDisabled = '';
  
  if (isAvailable) {
    buttonClass = 'btn-primary';
    buttonText = 'Borrow';
  } else {
    // For all non-available books (reserved, unavailable, borrowed, issued)
    buttonClass = 'btn-secondary';
    buttonText = 'Reserve';
  }
  
  const categoryName = typeof book.category === 'object' ? book.category.name : book.category;
  const fallbackImage = getFallbackImageUrl();
  
  row.innerHTML = `
    <td>
      <div class="book-cover-thumbnail">
        <img src="${book.cover_image || fallbackImage}" 
          alt="${book.title}" 
          onerror="this.src='${fallbackImage}';"
          class="book-cover-img"
          data-book-id="${book.id}">
      </div>
    </td>
    <td>${book.title}</td>
    <td>${book.author}</td>
    <td>${categoryName || 'Uncategorized'}</td>
    <td>${book.isbn || 'N/A'}</td>
    <td>
      <button class="btn btn-sm ${buttonClass}" ${buttonDisabled}>
        ${buttonText}
      </button>
      <button class="btn btn-sm btn-accent remove-btn">Remove</button>
    </td>
  `;
  
  const actionBtn = row.querySelector(`.${buttonClass}`);
  const removeBtn = row.querySelector('.remove-btn');
  const coverImg = row.querySelector('.book-cover-img');
  
  // Handle action button click based on book status
  if (actionBtn) {
    actionBtn.addEventListener('click', () => {
      if (isAvailable) {
        // Handle borrow action for available books
        if (window.booksModule && window.booksModule.handleBorrowBook) {
          window.booksModule.handleBorrowBook(book.id, book.title);
        } else {
          handleBorrowBookFallback(book.id, book.title);
        }
      } else {
        // Handle reserve action for all non-available books - pass the full book data
        handleReserveBook(book.id, book.title, book);
      }
    });
  }
  
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      removeFromSaved(book.id, book.title);
    });
  }
  
  if (coverImg) {
    coverImg.addEventListener('click', () => {
      showBookDetails(book);
    });
    
    coverImg.style.cursor = 'pointer';
  }
  
  return row;
}

function displayEmptySavedState() {
  const savedPage = document.getElementById("saved-page");
  if (!savedPage) {
    console.error("Saved page element not found");
    return;
  }
  
  savedPage.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Saved Books</h1>
    </div>
    <div class="card">
      <div class="empty-state">
        <span class="material-symbols-outlined">bookmark</span>
        <h3>No Saved Books</h3>
        <p>Books you save will appear here for quick access.</p>
        <a href="#" class="btn btn-primary" id="browse-books-btn">
          <span class="material-symbols-outlined">menu_book</span>
          Browse Books
        </a>
      </div>
    </div>
  `;
  
  const browseBtn = document.getElementById("browse-books-btn");
  if (browseBtn) {
    browseBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const booksLink = document.querySelector('a[data-page="books"]');
      if (booksLink) {
        booksLink.click();
      }
    });
  }
}

function removeFromSaved(bookId, bookTitle) {
  const savedBooks = JSON.parse(localStorage.getItem('savedBooks') || '[]');
  
  const updatedSavedBooks = savedBooks.filter(id => id !== bookId);
  
  localStorage.setItem('savedBooks', JSON.stringify(updatedSavedBooks));
  
  const row = document.querySelector(`tr[data-book-id="${bookId}"]`);
  if (row) {
    row.remove();
    
    const savedBooksTable = document.getElementById("saved-books-table");
    if (savedBooksTable && savedBooksTable.children.length === 0) {
      displayEmptySavedState();
    }
  } else {
    loadSavedBooks();
  }
  
  showNotification(`✅ Removed '${bookTitle}' from saved books`, "success");
}

function clearAllSavedBooks() {
  if (confirm("Are you sure you want to clear all saved books?")) {
    localStorage.setItem('savedBooks', JSON.stringify([]));
    
    displayEmptySavedState();
    
    showNotification("✅ All saved books have been cleared", "success");
  }
}

function handleBorrowBookFallback(bookId, bookTitle) {
  const borrowLink = document.querySelector('a[data-page="borrow"]');
  if (borrowLink) {
    borrowLink.click();
    
    setTimeout(() => {
      const bookIdInput = document.querySelector('#borrow-page input[placeholder="Enter Book ID or ISBN"]');
      const bookTitleInput = document.querySelector('#borrow-page input[placeholder="Enter Book Title"]');
      
      if (bookIdInput) bookIdInput.value = bookId;
      if (bookTitleInput) bookTitleInput.value = bookTitle;
      
      showNotification(`✅ Selected book: ${bookTitle}`, "success");
    }, 100);
  } else {
    showNotification("❌ Could not navigate to borrow page", "error");
  }
}

// Enhanced function to handle reserve book action with auto-fill
function handleReserveBook(bookId, bookTitle, bookData = null) {
  const reserveLink = document.querySelector('a[data-page="reserve"]');
  if (reserveLink) {
    reserveLink.click();
    
    setTimeout(() => {
      // Try to populate reserve page inputs if they exist
      const bookIdInput = document.querySelector('#reserve-page input[placeholder*="Book ID"], #reserve-page input[placeholder*="ISBN"]');
      const bookTitleInput = document.querySelector('#reserve-page input[placeholder*="Book Title"], #reserve-page input[placeholder*="Title"]');
      
      if (bookIdInput) bookIdInput.value = bookId;
      if (bookTitleInput) bookTitleInput.value = bookTitle;
      
      // Auto-fill book information section if bookData is provided
      if (bookData) {
        populateReserveBookInfo(bookData);
      } else {
        // If no book data provided, try to fetch it
        fetchAndPopulateBookInfo(bookId);
      }
      
      showNotification(`✅ Navigated to reserve page for: ${bookTitle}`, "success");
    }, 100);
  } else {
    showNotification("❌ Could not navigate to reserve page", "error");
  }
}

// Function to populate the reserve book information section
function populateReserveBookInfo(book) {
  const bookInfoSection = document.getElementById('reserveBookInfo');
  if (!bookInfoSection) {
    console.warn('Reserve book info section not found');
    return;
  }
  
  // Update the book information display
  const titleElement = document.getElementById('issueBookTitle');
  const authorElement = document.getElementById('issueBookAuthor');
  const isbnElement = document.getElementById('issueBookISBN');
  const dueDateElement = document.getElementById('issueBookDueDate');
  
  if (titleElement) titleElement.textContent = book.title || '-';
  if (authorElement) authorElement.textContent = book.author || '-';
  if (isbnElement) isbnElement.textContent = book.isbn || '-';
  
  // For reserve, we might want to show expected availability date instead of due date
  // You can modify this logic based on your requirements
  if (dueDateElement) {
    // Calculate expected availability (you can customize this logic)
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() + 7); // Add 7 days as example
    dueDateElement.textContent = expectedDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  // Show the book info section
  bookInfoSection.style.display = 'block';
}

// Function to fetch book data and populate info if not already available
async function fetchAndPopulateBookInfo(bookId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/books/${bookId}`, {
      method: "GET",
      headers: { "Accept": "application/json" }
    });
    
    if (!response.ok) {
      console.warn(`Could not fetch book details for ID ${bookId}`);
      return;
    }
    
    const data = await response.json();
    
    if (data.success && data.book) {
      populateReserveBookInfo(data.book);
    }
  } catch (error) {
    console.error(`Error fetching book details for reservation:`, error);
  }
}

function showBookDetails(book) {
  let modal = document.getElementById('book-details-modal');
  const fallbackImage = getFallbackImageUrl();
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'book-details-modal';
    modal.className = 'modal';
    document.body.appendChild(modal);
  }
  
  let qrCodeHtml = '';
  if (book.qr_code) {
    qrCodeHtml = `
      <div class="qr-code">
        <img src="${book.qr_code}" alt="QR Code" />
      </div>
    `;
  }
  
  const categoryName = typeof book.category === 'object' ? book.category.name : book.category;
  const statusLower = book.status ? book.status.toLowerCase() : '';
  const isAvailable = statusLower === 'available';
  const isReserved = statusLower === 'reserved';
  
  // Determine modal button properties
  let modalButtonClass, modalButtonText, modalButtonDisabled = '';
  
  if (isAvailable) {
    modalButtonClass = 'confirm-btn';
    modalButtonText = 'Borrow Book';
  } else if (isReserved) {
    modalButtonClass = 'confirm-btn';
    modalButtonText = 'Reserve Book';
  } else {
    modalButtonClass = 'confirm-btn disabled';
    modalButtonText = 'Not Available';
    modalButtonDisabled = 'disabled';
  }
  
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>${book.title}</h2>
        <button class="close-modal">&times;</button>
      </div>
      <div class="modal-body">
        <div class="book-details-grid">
          <div class="book-cover-large">
            <img src="${book.cover_image || fallbackImage}" 
              alt="${book.title}" onerror="this.src='${fallbackImage}';" />
          </div>
          <div class="book-details-info">
            <p><strong>Author:</strong> ${book.author}</p>
            <p><strong>Category:</strong> ${categoryName || 'Uncategorized'}</p>
            <p><strong>ISBN:</strong> ${book.isbn || 'N/A'}</p>
            <p>
              <strong>Status:</strong> 
              <span class="status-indicator ${getStatusClass(book.status)}">
                <span class="status-dot"></span>
                <span class="status-text">${book.status}</span>
              </span>
            </p>
            <p><strong>Added:</strong> ${book.created_at ? formatDate(book.created_at) : 'N/A'}</p>
            <div class="book-description">
              <h3>Description</h3>
              <p>${book.description || 'No description available.'}</p>
            </div>
            ${qrCodeHtml}
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="modal-btn cancel-btn" id="close-details-btn">Close</button>
        <button class="modal-btn ${modalButtonClass}" 
          id="action-from-modal-btn" ${modalButtonDisabled}>
          ${modalButtonText}
        </button>
      </div>
    </div>
  `;
  
  modal.style.display = 'flex';

  // Add event listeners
  const closeBtn = modal.querySelector('.close-modal');
  const closeBtnFooter = modal.querySelector('#close-details-btn');
  const actionBtn = modal.querySelector('#action-from-modal-btn');
  
  const closeModal = () => {
    modal.style.display = 'none';
  };
  
  closeBtn.addEventListener('click', closeModal);
  closeBtnFooter.addEventListener('click', closeModal);
  
  if (actionBtn && !modalButtonDisabled) {
    actionBtn.addEventListener('click', () => {
      closeModal();
      if (isAvailable) {
        handleBorrowBookFallback(book.id, book.title);
      } else if (isReserved) {
        // Pass the full book data for auto-fill
        handleReserveBook(book.id, book.title, book);
      }
    });
  }
  
  // Close modal when clicking outside
  const handleOutsideClick = (event) => {
    if (event.target === modal) {
      closeModal();
      window.removeEventListener('click', handleOutsideClick);
    }
  };
  
  setTimeout(() => {
    window.addEventListener('click', handleOutsideClick);
  }, 100);
}

function initSavedBooks() {
  const savedLink = document.querySelector('a[data-page="saved"]');
  if (savedLink) {
    savedLink.addEventListener('click', () => {
      loadSavedBooks();
    });
  }
  
  // Add styles for book covers if not already present
  if (!document.getElementById('book-cover-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'book-cover-styles';
    styleElement.textContent = `
      .book-cover-thumbnail {
        width: 50px;
        height: 75px;
        overflow: hidden;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }
      
      .book-cover-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.2s;
        cursor: pointer;
      }
      
      .book-cover-img:hover {
        transform: scale(1.05);
      }
      
      .loading-spinner {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 20px;
        color: #666;
      }
      
      .loading-spinner .material-symbols-outlined {
        font-size: 2rem;
        animation: spin 1s linear infinite;
      }
      
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      
      .empty-table-message {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 15px;
        padding: 40px;
        color: #666;
      }
      
      .empty-table-message .material-symbols-outlined {
        font-size: 3rem;
        color: #ccc;
      }
    `;
    document.head.appendChild(styleElement);
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  initSavedBooks();
  
  // Load saved books if we're currently on the saved page
  const currentPage = document.querySelector('.page.active');
  if (currentPage && currentPage.id === 'saved-page') {
    loadSavedBooks();
  }
});

// Export functions for global access
window.savedBooksModule = {
  loadSavedBooks,
  removeFromSaved,
  clearAllSavedBooks,
  showBookDetails,
  handleReserveBook
};

// ES6 exports (if using modules)
export {
  loadSavedBooks,
  removeFromSaved,
  clearAllSavedBooks,
  showBookDetails,
  handleReserveBook
};