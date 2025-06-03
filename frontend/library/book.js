// books.js - Handles books display and interaction

// API base URL for fetching books
const API_BASE_URL = 'http://localhost:5000'; // Updated to match the server port in server.js

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

// Get CSS class based on book status
function getStatusClass(status) {
  const statusLower = status.toLowerCase();
  if (statusLower === 'available') return 'status-available';
  if (statusLower === 'unavailable' || statusLower === 'borrowed' || statusLower === 'issued' || statusLower === 'not available') return 'status-unavailable';
  if (statusLower === 'reserved') return 'status-reserved';
  return 'status-info';
}

// Format date for display
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Get fallback image path
function getFallbackImageUrl() {
  // Using a local fallback image instead of via.placeholder.com
  return 'assets/no-cover.png';
}

// Remove duplicate books based on book ID and keep the most recent/relevant entry
function removeDuplicateBooks(books) {
  const uniqueBooks = {};
  
  books.forEach(book => {
    const bookId = book.id;
    
    // If we haven't seen this book ID before, add it
    if (!uniqueBooks[bookId]) {
      uniqueBooks[bookId] = book;
    } else {
      // If we have seen this book ID, keep the one with more complete information
      // or the one that was updated more recently
      const existingBook = uniqueBooks[bookId];
      
      // Prefer the book entry with more complete borrowing status information
      if (book.borrowing_status && !existingBook.borrowing_status) {
        uniqueBooks[bookId] = book;
      } else if (book.updated_at > existingBook.updated_at) {
        uniqueBooks[bookId] = book;
      }
    }
  });
  
  return Object.values(uniqueBooks);
}

// Load all books from the server
async function loadAllBooks() {
  try {
    // Show loading state
    const booksGrid = document.getElementById("books-grid");
    if (booksGrid) {
      booksGrid.innerHTML = '<div class="loading-spinner"><span class="material-symbols-outlined">refresh</span></div>';
    }

    // Fetch books from API
    const searchInput = document.querySelector('.search-bar input');
    const searchTerm = searchInput ? searchInput.value.trim() : '';
    
    // Add search parameter if provided
    let url = `${API_BASE_URL}/api/books`;
    if (searchTerm) {
      url += `?search=${encodeURIComponent(searchTerm)}`;
    }
    
    const response = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch books: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.success) {
      // Remove duplicate books before displaying
      const uniqueBooks = removeDuplicateBooks(data.books);
      displayBooks(uniqueBooks);
      console.log(`✅ Loaded ${uniqueBooks.length} unique books successfully (${data.books.length} total records)`);
    } else {
      throw new Error(data.message || "Failed to load books");
    }
  } catch (error) {
    console.error("❌ Error loading books:", error);
    showNotification(`❌ ${error.message}`, "error");
    
    // Show error in books grid
    const booksGrid = document.getElementById("books-grid");
    if (booksGrid) {
      booksGrid.innerHTML = `
        <div class="error-message">
          <span class="material-symbols-outlined">error</span>
          <p>Failed to load books. Please try again.</p>
        </div>
      `;
    }
  }
}

// Display books in the grid
function displayBooks(books) {
  const booksGrid = document.getElementById("books-grid");
  
  if (!booksGrid) {
    console.error("Books grid element not found");
    return;
  }
  
  // Clear existing books
  booksGrid.innerHTML = '';
  
  if (books.length === 0) {
    booksGrid.innerHTML = `
      <div class="empty-state">
        <span class="material-symbols-outlined">menu_book</span>
        <p>No books found. Try adjusting your search.</p>
      </div>
    `;
    return;
  }
  
  // Create book cards for each book
  books.forEach(book => {
    const bookCard = createBookCard(book);
    booksGrid.appendChild(bookCard);
  });
}

// Create a book card element
function createBookCard(book) {
  // Determine availability based on available_quantity
  const isAvailable = book.available_quantity > 0;
  const displayStatus = isAvailable ? 'Available' : 'Not Available';
  const statusClass = getStatusClass(displayStatus);
  const fallbackImage = getFallbackImageUrl();
  
  // Create the book card container
  const card = document.createElement('div');
  card.className = 'card book-card';
  card.dataset.bookId = book.id;
  
  // Store category information in the card's data attributes for filtering
  const categoryName = typeof book.category === 'object' ? book.category.name : book.category;
  const categoryId = typeof book.category === 'object' ? book.category.id : categoryName;
  
  card.dataset.category = categoryName;
  card.dataset.categoryId = categoryId;
  
  // Set the HTML content with modernized UI elements - Updated status indicator to show words only
  card.innerHTML = `
    <div class="book-cover">
      <img src="${book.cover_image || fallbackImage}" 
        alt="${book.title}" onerror="this.src='${fallbackImage}';" />
      <div class="book-status-indicator ${statusClass}">
        <span class="status-text">${displayStatus}</span>
      </div>
      ${book.available_quantity !== undefined ? `
        <div class="quantity-indicator">
          <span class="quantity-text">${book.available_quantity}/${book.quantity || book.available_quantity} available</span>
        </div>
      ` : ''}
    </div>
    <div class="book-info">
      <h3 class="book-title">${book.title}</h3>
      <p class="book-author">${book.author}</p>
      <p class="book-category">${categoryName}</p>
      <div class="book-actions">
        <button class="action-btn ${isAvailable ? 'borrow-btn' : 'disabled'}" data-action="borrow" ${!isAvailable ? 'disabled' : ''}>
          <span class="material-symbols-outlined">book</span>
          <span class="btn-text">Borrow</span>
        </button>
        <button class="action-btn save-btn" data-action="save">
          <span class="material-symbols-outlined">bookmark</span>
          <span class="btn-text">Save</span>
        </button>
        <button class="action-btn details-btn" data-action="details">
          <span class="material-symbols-outlined">visibility</span>
          <span class="btn-text">View</span>
        </button>
      </div>
    </div>
  `;
  
  // Add event listeners to the buttons
  const borrowBtn = card.querySelector('[data-action="borrow"]');
  const saveBtn = card.querySelector('[data-action="save"]');
  const detailsBtn = card.querySelector('[data-action="details"]');
  
  if (borrowBtn) {
    borrowBtn.addEventListener('click', () => handleBorrowBook(book.id, book.title, book.isbn));
  }
  
  if (saveBtn) {
    saveBtn.addEventListener('click', () => handleSaveBook(book.id, book.title));
  }
  
  if (detailsBtn) {
    detailsBtn.addEventListener('click', () => showBookDetails(book));
  }
  
  return card;
}

// Handle book borrow action
function handleBorrowBook(bookId, bookTitle, bookIsbn) {
  // Navigate to borrow book page
  const borrowLink = document.querySelector('a[data-page="borrow"]');
  if (borrowLink) {
    borrowLink.click();
    
    // Wait a short time to ensure the borrow page is active before filling the form
    setTimeout(() => {
      // Fill in the form with the book ID, ISBN, and title
      const bookIdInput = document.querySelector('#borrow-page #bookId');
      const bookIsbnInput = document.querySelector('#borrow-page #bookIsbn');
      const bookTitleInput = document.querySelector('#borrow-page #bookTitle');
      
      if (bookIdInput) bookIdInput.value = bookId;
      if (bookIsbnInput && bookIsbn) bookIsbnInput.value = bookIsbn;
      if (bookTitleInput) bookTitleInput.value = bookTitle;
      
      showNotification(`✅ Selected book: ${bookTitle}`, "success");
      
      // Create and dispatch a custom event to notify borrowbook.js
      const event = new CustomEvent('bookSelected', {
        detail: {
          bookId: bookId,
          bookTitle: bookTitle,
          bookIsbn: bookIsbn
        }
      });
      document.dispatchEvent(event);
      
      // Trigger any additional functions in borrowbook.js if available
      if (window.borrowModule && typeof window.borrowModule.populateBookDetails === 'function') {
        window.borrowModule.populateBookDetails(bookId, bookIsbn, bookTitle);
      }
    }, 300);
  } else {
    console.error("Borrow page link not found");
    showNotification("❌ Navigation error", "error");
  }
}

// Handle save book action
function handleSaveBook(bookId, bookTitle) {
  // In a real application, you would save this to local storage or user account
  console.log(`Saving book ID: ${bookId}`);
  showNotification(`✅ Book '${bookTitle}' saved to your list`, "success");
  
  // Add it to local storage
  const savedBooks = JSON.parse(localStorage.getItem('savedBooks') || '[]');
  if (!savedBooks.includes(bookId)) {
    savedBooks.push(bookId);
    localStorage.setItem('savedBooks', JSON.stringify(savedBooks));
  }
}

// Show book details in a modal
function showBookDetails(book) {
  // Create modal container if it doesn't exist
  let modal = document.getElementById('book-details-modal');
  const fallbackImage = getFallbackImageUrl();
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'book-details-modal';
    modal.className = 'modal';
    document.body.appendChild(modal);
  }
  
  // Convert category if it's an object
  const categoryName = typeof book.category === 'object' ? book.category.name : book.category;
  
  // Determine availability based on available_quantity
  const isAvailable = book.available_quantity > 0;
  const displayStatus = isAvailable ? 'Available' : 'Not Available';
  
  // Set modal content with simplified structure
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
            <p><strong>Status:</strong> ${displayStatus}</p>
            ${book.quantity !== undefined ? `<p><strong>Total Quantity:</strong> ${book.quantity}</p>` : ''}
            ${book.available_quantity !== undefined ? `<p><strong>Available Quantity:</strong> ${book.available_quantity}</p>` : ''}
            <div class="book-description">
              <h3>Description</h3>
              <p>${book.description || 'No description available.'}</p>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="modal-btn cancel-btn" id="close-details-btn">Close</button>
        <button class="modal-btn confirm-btn ${!isAvailable ? 'disabled' : ''}" 
          id="borrow-from-modal-btn" ${!isAvailable ? 'disabled' : ''}>
          Borrow Book
        </button>
      </div>
    </div>
  `;
  
  // Show the modal
  modal.style.display = 'flex';
  
  // Add event listeners for modal buttons
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
    handleBorrowBook(book.id, book.title, book.isbn);
  });
  
  // Close modal when clicking outside
  window.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  });
}

// Filter books by category - Updated to work with categories.js
function filterBooksByCategory(categoryId) {
  const searchInput = document.querySelector('.search-bar input');
  if (searchInput) {
    // Clear any existing search
    searchInput.value = '';
  }
  
  // Get the category name for display
  let categoryName = categoryId;
  const categoryFilter = document.getElementById('categoryFilter');
  if (categoryFilter) {
    const selectedOption = categoryFilter.querySelector(`option[value="${categoryId}"]`);
    if (selectedOption) {
      categoryName = selectedOption.textContent;
    }
  }
  
  // Update the section heading
  const sectionHeading = document.querySelector('#books-page .section-heading');
  if (sectionHeading) {
    sectionHeading.textContent = categoryId ? `Books - ${categoryName}` : 'All Books';
  }
  
  // Load books filtered by category
  loadBooksWithFilter({ category: categoryId });
  
  console.log(`Filtered books by category: ${categoryName}`);
}

// Load books with filter parameters
async function loadBooksWithFilter(filters = {}) {
  try {
    // Show loading state
    const booksGrid = document.getElementById("books-grid");
    if (booksGrid) {
      booksGrid.innerHTML = '<div class="loading-spinner"><span class="material-symbols-outlined">refresh</span></div>';
    }
    
    // Build URL with query parameters
    let url = new URL(`${API_BASE_URL}/api/books`);
    
    // Add search parameter if provided
    if (filters.search) {
      url.searchParams.append('search', filters.search);
    }
    
    // Add category parameter if provided
    if (filters.category) {
      url.searchParams.append('category', filters.category);
    }
    
    const response = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch books: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.success) {
      // Remove duplicate books before displaying
      const uniqueBooks = removeDuplicateBooks(data.books);
      displayBooks(uniqueBooks);
      console.log(`✅ Loaded ${uniqueBooks.length} unique books with filters (${data.books.length} total records)`);
    } else {
      throw new Error(data.message || "Failed to load books");
    }
  } catch (error) {
    console.error("❌ Error loading filtered books:", error);
    showNotification(`❌ ${error.message}`, "error");
    
    // Display empty state or error
    const booksGrid = document.getElementById("books-grid");
    if (booksGrid) {
      booksGrid.innerHTML = `
        <div class="error-message">
          <span class="material-symbols-outlined">error</span>
          <p>Failed to load books. Please try again.</p>
        </div>
      `;
    }
  }
}

// Handle search functionality
function setupSearchFunction() {
  const searchInput = document.querySelector('.search-bar input');
  if (searchInput) {
    // Add debounce to avoid too many requests when typing quickly
    let searchTimeout;
    
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const searchTerm = searchInput.value.trim();
        
        // Reset category filter when searching
        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter) {
          categoryFilter.value = '';
        }
        
        // Update section heading
        const sectionHeading = document.querySelector('#books-page .section-heading');
        if (sectionHeading) {
          sectionHeading.textContent = searchTerm ? `Search Results: "${searchTerm}"` : 'All Books';
        }
        
        if (searchTerm.length > 0) {
          loadBooksWithFilter({ search: searchTerm });
        } else {
          loadAllBooks(); // Load all books if search is cleared
        }
      }, 500); // 500ms delay
    });
  }
}

// Load categories for filter dropdown - Modified to work with categories.js
async function loadCategories() {
  try {
    // Check if categoriesModule is available (from categories.js)
    if (window.categoriesModule && window.categoriesModule.loadCategories) {
      // Use the loadCategories function from categories.js
      await window.categoriesModule.loadCategories();
    } else {
      // Fallback to direct API call if categories.js module is not available
      const response = await fetch(`${API_BASE_URL}/api/categories`, {
        method: "GET",
        headers: { "Accept": "application/json" }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch categories: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Populate category dropdown
        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter) {
          // Clear existing options except the first one (All Categories)
          while (categoryFilter.options.length > 1) {
            categoryFilter.remove(1);
          }
          
          // Add each category
          data.categories.forEach(category => {
            const categoryName = typeof category === 'object' ? category.name : category;
            const categoryId = typeof category === 'object' ? category.id : categoryName;
            
            const option = document.createElement('option');
            option.value = categoryId;
            option.textContent = categoryName;
            categoryFilter.appendChild(option);
          });
        }
      }
    }
  } catch (error) {
    console.error("❌ Error loading categories:", error);
    showNotification("Failed to load categories", "error");
  }
}

// Initialize books functionality - Set up integration with categories.js
function initBooks() {
  // Load all books
  loadAllBooks();
  
  // Setup search functionality
  setupSearchFunction();
  
  // Setup category filter in books page
  const categoryFilter = document.getElementById('categoryFilter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => {
      const selectedCategory = categoryFilter.value;
      if (selectedCategory) {
        filterBooksByCategory(selectedCategory);
      } else {
        loadAllBooks(); // Load all books if "All Categories" is selected
      }
    });
  }
}

// Create the assets directory and the no-cover image if needed
function ensureAssets() {
  // This function would typically run on the server side
  // For client-side implementation, we'll just log a message
  console.log("✅ Checking for assets directory and fallback images");
  
  // In a real implementation, you would check if the assets directory exists
  // and create the necessary fallback images if they don't exist
}

// Function to handle direct category filtering from category page
function handleCategorySelection(categoryId, categoryName) {
  // Navigate to books page
  const booksLink = document.querySelector('[data-page="books"]');
  if (booksLink) {
    // Switch to books page
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.querySelectorAll('.sidebar-links a').forEach(link => link.classList.remove('active'));
    
    document.getElementById('books-page').classList.add('active');
    booksLink.classList.add('active');
    
    // Apply category filter
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
      categoryFilter.value = categoryId;
    }
    
    // Filter books by selected category
    filterBooksByCategory(categoryId);
    
    // Show notification
    showNotification(`✅ Showing books in '${categoryName}' category`, "success");
  }
}

// Document ready function
document.addEventListener("DOMContentLoaded", () => {
  // Ensure assets exist
  ensureAssets();
  
  // Initialize books functionality
  initBooks();
  
  // Load categories for filter dropdown
  loadCategories();
  
  // Add event listener for category page integration
  // This listens for custom events from categories.js
  document.addEventListener('categorySelected', function(event) {
    if (event.detail && event.detail.categoryId) {
      handleCategorySelection(event.detail.categoryId, event.detail.categoryName);
    }
  });
});

// Export functions to be used in other modules - Make available globally as well
window.booksModule = {
  loadAllBooks,
  filterBooksByCategory,
  handleBorrowBook,
  handleSaveBook,
  showBookDetails,
  handleCategorySelection
};

// Also export using ES modules for module compatibility
export {
  loadAllBooks,
  filterBooksByCategory,
  handleBorrowBook,
  handleSaveBook,
  showBookDetails,
  handleCategorySelection
};