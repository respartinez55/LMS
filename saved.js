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

    const fetchPromises = savedBookIds.map(bookId => 
      fetch(`${API_BASE_URL}/api/books/${bookId}`, {
        method: "GET",
        headers: { "Accept": "application/json" }
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to fetch book with ID ${bookId}`);
        }
        return response.json();
      })
      .then(data => {
        if (data.success) {
          return data.book;
        }
        throw new Error(`Book with ID ${bookId} not found`);
      })
      .catch(error => {
        console.error(error);
        return null;
      })
    );

    const books = await Promise.all(fetchPromises);
    const validBooks = books.filter(book => book !== null);

    if (validBooks.length === 0) {
      savedBooksTable.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-table-message">
              <span class="material-symbols-outlined">error</span>
              <p>Failed to load saved books. Please try again later.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    validBooks.forEach(book => {
      const row = createSavedBookTableRow(book);
      savedBooksTable.appendChild(row);
    });

    console.log(`✅ Loaded ${validBooks.length} saved books successfully`);
  } catch (error) {
    console.error("❌ Error loading saved books:", error);
    showNotification(`❌ ${error.message}`, "error");
    
    const savedBooksTable = document.getElementById("saved-books-table");
    if (savedBooksTable) {
      savedBooksTable.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-table-message">
              <span class="material-symbols-outlined">error</span>
              <p>Failed to load saved books. Please try again.</p>
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
  
  const isAvailable = book.status && book.status.toLowerCase() === 'available';
  const buttonClass = isAvailable ? 'btn-primary' : 'btn-secondary';
  const buttonText = isAvailable ? 'Borrow' : 'Reserve';
  const buttonDisabled = !isAvailable ? 'disabled' : '';
  
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
  
  if (actionBtn && isAvailable) {
    actionBtn.addEventListener('click', () => {
      if (window.booksModule && window.booksModule.handleBorrowBook) {
        window.booksModule.handleBorrowBook(book.id, book.title);
      } else {
        handleBorrowBookFallback(book.id, book.title);
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
    browseBtn.addEventListener("click", () => {
      document.querySelector('a[data-page="books"]').click();
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
  document.querySelector('a[data-page="borrow"]').click();
  
  setTimeout(() => {
    const bookIdInput = document.querySelector('#borrow-page input[placeholder="Enter Book ID or ISBN"]');
    const bookTitleInput = document.querySelector('#borrow-page input[placeholder="Enter Book Title"]');
    
    if (bookIdInput) bookIdInput.value = bookId;
    if (bookTitleInput) bookTitleInput.value = bookTitle;
    
    showNotification(`✅ Selected book: ${bookTitle}`, "success");
  }, 100);
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
            <p><strong>Category:</strong> ${categoryName}</p>
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
        <button class="modal-btn confirm-btn ${book.status.toLowerCase() !== 'available' ? 'disabled' : ''}" 
          id="borrow-from-modal-btn" ${book.status.toLowerCase() !== 'available' ? 'disabled' : ''}>
          Borrow Book
        </button>
      </div>
    </div>
  `;
  
  modal.style.display = 'flex';
  
  const closeBtn = modal.querySelector('.close-modal');
  const closeBtnFooter = modal.querySelector('#close-details-btn');
  const borrowBtn = modal.querySelector('#borrow-from-modal-btn');
  
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  closeBtnFooter.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  borrowBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    handleBorrowBookFallback(book.id, book.title);
  });
  
  window.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  });
}

function initSavedBooks() {
  const savedLink = document.querySelector('a[data-page="saved"]');
  if (savedLink) {
    savedLink.addEventListener('click', () => {
      loadSavedBooks();
    });
  }
  
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
      }
      
      .book-cover-img:hover {
        transform: scale(1.05);
      }
    `;
    document.head.appendChild(styleElement);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initSavedBooks();
  
  const currentPage = document.querySelector('.page.active');
  if (currentPage && currentPage.id === 'saved-page') {
    loadSavedBooks();
  }
});

window.savedBooksModule = {
  loadSavedBooks,
  removeFromSaved,
  clearAllSavedBooks,
  showBookDetails
};

export {
  loadSavedBooks,
  removeFromSaved,
  clearAllSavedBooks,
  showBookDetails
};