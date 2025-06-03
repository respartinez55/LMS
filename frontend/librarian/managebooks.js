import { API_BASE_URL, showNotification } from './dashboard.js';
import { loadCategories, resetForm, formatDate } from './addbooks.js';
import { openQRModal } from './qrcode-modal.js';
import { openEditModal } from './editModal.js';

// Pagination configuration
const BOOKS_PER_PAGE = 10;
let currentPage = 1;
let totalPages = 1;
let totalBooks = 0;
let currentSearchTerm = "";
let currentCategoryFilter = "";
let currentStatusFilter = "";
let currentSortField = "";
let currentSortOrder = "";

function getStatusClass(status) {
  const statusLower = status.toLowerCase();
  if (statusLower === 'available') return 'status-available';
  if (statusLower === 'unavailable' || statusLower === 'not available') return 'status-unavailable';
  return 'status-info';
}

function normalizeStatus(book) {
  // Check available_quantity first, then fallback to other status fields
  const availableQty = parseInt(book.available_quantity) || 0;
  
  if (availableQty > 0) {
    return 'Available';
  } else {
    return 'Unavailable';
  }
}

async function loadAllBooks(searchTerm = "", sortField = "", sortOrder = "", page = 1, category = "", status = "") {
  try {
    // Update current filter states
    currentSearchTerm = searchTerm;
    currentSortField = sortField;
    currentSortOrder = sortOrder;
    currentPage = page;
    currentCategoryFilter = category;
    currentStatusFilter = status;

    // Show loading state
    const tableBody = document.getElementById("books-list");
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="7" class="text-center">Loading books...</td></tr>`;
    }

    const params = new URLSearchParams();
    if (searchTerm) params.append("search", searchTerm);
    if (sortField) params.append("sortField", sortField);
    if (sortOrder) params.append("sortOrder", sortOrder);
    if (category) params.append("category", category);
    params.append("page", page);
    params.append("limit", BOOKS_PER_PAGE);

    // Always fetch all books, filtering status on frontend for strict "Available"/"Unavailable"
    const response = await fetch(`${API_BASE_URL}/api/books/status?${params.toString()}`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) throw new Error(`Server error: ${response.status} ${response.statusText}`);

    const data = await response.json();
    if (!data.success) throw new Error(data.message);

    // Handle pagination data
    let books = data.books || [];
    // Normalize status for all books based on available_quantity
    books = books.map(book => {
      const bookStatus = normalizeStatus(book);
      return { ...book, _normalizedStatus: bookStatus };
    });

    // Filter by status if needed
    if (status === "Available" || status === "Unavailable") {
      books = books.filter(book => book._normalizedStatus === status);
    }

    totalBooks = books.length;
    totalPages = Math.ceil(totalBooks / BOOKS_PER_PAGE);

    // Paginate
    const startIndex = (page - 1) * BOOKS_PER_PAGE;
    const endIndex = startIndex + BOOKS_PER_PAGE;
    const booksToShow = books.slice(startIndex, endIndex);

    if (!tableBody) return;
    tableBody.innerHTML = "";

    if (booksToShow.length > 0) {
      booksToShow.forEach((book) => {
        const row = document.createElement("tr");
        const statusClass = getStatusClass(book._normalizedStatus);
        const statusHTML = `<span class="status-pill ${statusClass}">${book._normalizedStatus}</span>`;
        
        // Ensure quantities are numbers and handle undefined values
        const totalQuantity = typeof book.quantity !== "undefined" ? Number(book.quantity) : 0;
        const availableQuantity = typeof book.available_quantity !== "undefined" ? Number(book.available_quantity) : 0;
        
        row.innerHTML = `
          <td>${book.title || 'N/A'}</td>
          <td>${book.author || 'N/A'}</td>
          <td>${book.category || 'N/A'}</td>
          <td>${totalQuantity}</td>
          <td>${availableQuantity}</td>
          <td>${statusHTML}</td>
          <td>
            <button class="action-btn view-btn" data-id="${book.id}" title="View QR Code">
              <i class="fas fa-qrcode"></i>
            </button>
            <button class="action-btn edit-btn" data-id="${book.id}" title="Edit Book">
              <i class="fas fa-edit"></i>
            </button>
            <button class="action-btn delete-btn" data-id="${book.id}" title="Delete Book">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        `;
        tableBody.appendChild(row);
      });

      setupActionButtons();
      updatePagination();
    } else {
      tableBody.innerHTML = `<tr><td colspan="7" class="text-center">No books found</td></tr>`;
      updatePagination();
    }

    updatePaginationInfo();

  } catch (error) {
    console.error("Error loading books:", error);
    showNotification(`Error loading books: ${error.message}`, "error");
    const tableBody = document.getElementById("books-list");
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error loading books: ${error.message}</td></tr>`;
    }
  }
}

function setupActionButtons() {
  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", async function (e) {
      e.preventDefault();
      e.stopPropagation();
      const bookId = this.getAttribute("data-id");
      openQRModal(bookId);
    });
  });

  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", async function (e) {
      e.preventDefault();
      e.stopPropagation();
      const bookId = this.getAttribute("data-id");
      openEditModal(bookId);
    });
  });

  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async function (e) {
      e.preventDefault();
      e.stopPropagation();

      const bookId = this.getAttribute("data-id");
      const bookTitle = this.closest('tr').querySelector('td:first-child').textContent;

      if (confirm(`Are you sure you want to delete "${bookTitle}"? This action cannot be undone.`)) {
        const deleteBtn = this;
        const originalHTML = deleteBtn.innerHTML;
        deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        deleteBtn.disabled = true;

        try {
          const response = await fetch(`${API_BASE_URL}/api/books/${bookId}`, {
            method: "DELETE",
            headers: { "Accept": "application/json" },
          });

          const data = await response.json();

          if (response.ok && data.success) {
            showNotification(`"${bookTitle}" has been deleted successfully`, "success");
            
            // Ensure we stay on manage books section
            forceStayOnManageBooks();
            
            // Adjust page if necessary
            if (currentPage > 1 && ((currentPage - 1) * BOOKS_PER_PAGE >= totalBooks - 1)) {
              currentPage = Math.max(1, currentPage - 1);
            }
            
            // Reload books and force stay on manage books
            await loadAllBooks(currentSearchTerm, currentSortField, currentSortOrder, currentPage, currentCategoryFilter, currentStatusFilter);
            
            // Double check we're still on manage books
            setTimeout(() => {
              forceStayOnManageBooks();
            }, 100);
            
          } else {
            throw new Error(data.message || `Failed to delete book: ${response.status}`);
          }
        } catch (error) {
          showNotification(`Failed to delete "${bookTitle}": ${error.message}`, "error");
          deleteBtn.innerHTML = originalHTML;
          deleteBtn.disabled = false;
        }
      }
    });
  });
}

function setupBookSearch() {
  const searchInput = document.getElementById("bookSearch");
  const categoryFilter = document.getElementById("categoryFilter");
  const statusFilter = document.getElementById("statusFilter");
  const refreshButton = document.getElementById("refreshBooksBtn");
  const sortSelect = document.getElementById("sortBooks");

  // Search input with debounce
  if (searchInput) {
    searchInput.addEventListener("input", debounce(() => {
      currentPage = 1;
      filterBooks();
    }, 300));
  }

  // Category filter
  if (categoryFilter) {
    categoryFilter.addEventListener("change", () => {
      currentCategoryFilter = categoryFilter.value;
      currentPage = 1;
      filterBooks();
    });
  }

  // Status filter
  if (statusFilter) {
    statusFilter.addEventListener("change", () => {
      currentStatusFilter = statusFilter.value;
      currentPage = 1;
      filterBooks();
    });
  }

  // Sort dropdown
  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      const [sortField, sortOrder] = sortSelect.value.split(":");
      currentSortField = sortField || "";
      currentSortOrder = sortOrder || "";
      currentPage = 1;
      filterBooks();
    });
  }

  // Refresh button
  if (refreshButton) {
    refreshButton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Reset all filters
      if (searchInput) searchInput.value = "";
      if (categoryFilter) categoryFilter.value = "";
      if (statusFilter) statusFilter.value = "";
      if (sortSelect) sortSelect.value = "";

      // Reset current state
      currentPage = 1;
      currentSearchTerm = "";
      currentCategoryFilter = "";
      currentStatusFilter = "";
      currentSortField = "";
      currentSortOrder = "";

      // Load all books without filters
      loadAllBooks("", "", "", 1, "", "").then(() => {
        showNotification("Books list refreshed", "success");
        forceStayOnManageBooks();
      }).catch((error) => {
        showNotification("Error refreshing books list", "error");
      });
    });
  }
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

async function filterBooks() {
  const searchTerm = document.getElementById("bookSearch")?.value.trim() || "";
  const categoryFilter = document.getElementById("categoryFilter")?.value || "";
  const statusFilter = document.getElementById("statusFilter")?.value || "";

  currentSearchTerm = searchTerm;
  currentCategoryFilter = categoryFilter;
  currentStatusFilter = statusFilter;
  currentPage = 1;

  await loadAllBooks(searchTerm, currentSortField, currentSortOrder, 1, categoryFilter, statusFilter);
  forceStayOnManageBooks();
}

function setupPagination() {
  const paginationContainer = document.getElementById("books-pagination");
  if (!paginationContainer) return;

  paginationContainer.innerHTML = "";

  paginationContainer.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.target.classList.contains("pagination-btn")) {
      const page = parseInt(e.target.getAttribute("data-page"));
      if (!isNaN(page) && page !== currentPage && page >= 1 && page <= totalPages) {
        loadBooksPage(page);
      }
    }
  });
}

async function loadBooksPage(page) {
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  await loadAllBooks(currentSearchTerm, currentSortField, currentSortOrder, page, currentCategoryFilter, currentStatusFilter);
  forceStayOnManageBooks();
}

function updatePagination() {
  const paginationContainer = document.getElementById("books-pagination");
  if (!paginationContainer) return;

  paginationContainer.innerHTML = "";

  if (totalPages <= 1) return;

  // Create pagination button
  const createBtn = (page, text, isActive = false, isDisabled = false) => {
    const btn = document.createElement("button");
    btn.className = `pagination-btn${isActive ? " active" : ""}${isDisabled ? " disabled" : ""}`;
    btn.setAttribute("data-page", page);
    btn.textContent = text;
    btn.disabled = isDisabled;
    return btn;
  };

  // First & Previous buttons
  if (currentPage > 1) {
    paginationContainer.appendChild(createBtn(1, "First"));
    paginationContainer.appendChild(createBtn(currentPage - 1, "Previous"));
  }

  // Page numbers (show max 5 pages around current)
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, currentPage + 2);

  if (currentPage <= 3) {
    endPage = Math.min(5, totalPages);
  }
  if (currentPage >= totalPages - 2) {
    startPage = Math.max(1, totalPages - 4);
  }

  if (startPage > 1) {
    paginationContainer.appendChild(createBtn(1, "1"));
    if (startPage > 2) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className = "pagination-ellipsis";
      paginationContainer.appendChild(ellipsis);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    paginationContainer.appendChild(createBtn(i, i.toString(), i === currentPage));
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className = "pagination-ellipsis";
      paginationContainer.appendChild(ellipsis);
    }
    paginationContainer.appendChild(createBtn(totalPages, totalPages.toString()));
  }

  if (currentPage < totalPages) {
    paginationContainer.appendChild(createBtn(currentPage + 1, "Next"));
    paginationContainer.appendChild(createBtn(totalPages, "Last"));
  }
}

function updatePaginationInfo() {
  const paginationInfo = document.getElementById("pagination-info");
  if (!paginationInfo) return;

  if (totalBooks > 0) {
    const startItem = ((currentPage - 1) * BOOKS_PER_PAGE) + 1;
    const endItem = Math.min(currentPage * BOOKS_PER_PAGE, totalBooks);
    paginationInfo.textContent = `Showing ${startItem}-${endItem} of ${totalBooks} books`;
  } else {
    paginationInfo.textContent = "No books found";
  }
}

// Initialize category dropdown with dynamic options
async function initializeCategoryFilter() {
  try {
    const categoryFilter = document.getElementById("categoryFilter");
    if (!categoryFilter) return;

    const response = await fetch(`${API_BASE_URL}/api/categories`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.categories) {
        categoryFilter.innerHTML = '<option value="">All Categories</option>';
        data.categories.forEach(category => {
          const option = document.createElement("option");
          option.value = category.name || category;
          option.textContent = category.name || category;
          categoryFilter.appendChild(option);
        });
      }
    }
  } catch (error) {
    console.error("Error loading categories:", error);
  }
}

// Periodic refresh function - only refreshes when user is not actively interacting
function setupPeriodicRefresh() {
  const refreshInterval = 60000; // 60 seconds - increased from 30 seconds
  setInterval(async () => {
    const manageSection = document.getElementById("manage-books-section");
    if (manageSection && manageSection.classList.contains("active")) {
      const activeElement = document.activeElement;
      const isUserInteracting = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'SELECT' || 
        activeElement.tagName === 'BUTTON' ||
        activeElement.isContentEditable
      );
      
      // Also check if any modals are open
      const isModalOpen = document.querySelector('.modal.show') || 
                         document.querySelector('.modal:not([style*="display: none"])');
      
      if (!isUserInteracting && !isModalOpen) {
        try {
          await loadAllBooks(currentSearchTerm, currentSortField, currentSortOrder, currentPage, currentCategoryFilter, currentStatusFilter);
          forceStayOnManageBooks();
        } catch (error) {
          // Silent fail for background refresh
          console.warn("Background refresh failed:", error);
        }
      }
    }
  }, refreshInterval);
}

function initManageBooks() {
  setupBookSearch();
  setupPagination();
  initializeCategoryFilter();

  currentPage = 1;
  currentSearchTerm = "";
  currentCategoryFilter = "";
  currentStatusFilter = "";
  currentSortField = "";
  currentSortOrder = "";

  loadAllBooks();

  // Setup periodic refresh instead of the problematic sync
  setupPeriodicRefresh();
  
  // Ensure we stay on manage books
  forceStayOnManageBooks();
}

function preventNavigationFromManageBooks() {
  const manageSection = document.getElementById("manage-books-section");
  if (!manageSection) return;

  // Prevent any form submissions
  manageSection.addEventListener("submit", function(e) {
    e.preventDefault();
    e.stopPropagation();
  });

  // Prevent default link behavior
  manageSection.addEventListener("click", function(e) {
    if (e.target.tagName === 'A' && e.target.getAttribute('href') === '#') {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  // Ensure action buttons don't cause navigation
  manageSection.addEventListener("click", function(e) {
    if (e.target.classList.contains('action-btn') || e.target.closest('.action-btn')) {
      e.stopPropagation();
    }
  });
}

function forceStayOnManageBooks() {
  const manageBooksSection = document.getElementById("manage-books-section");
  if (!manageBooksSection) return;

  // Force activate manage books section
  document.querySelectorAll(".page-section").forEach(section => {
    section.classList.remove("active");
  });
  manageBooksSection.classList.add("active");
  
  // Update sidebar navigation
  document.querySelectorAll(".sidebar-links li a").forEach(link => {
    link.classList.remove("active");
    if (link.getAttribute("data-page") === "manage-books") {
      link.classList.add("active");
    }
  });

  // Prevent browser back button from interfering
  if (window.history && window.history.pushState) {
    try {
      window.history.pushState({ page: 'manage-books' }, 'Manage Books', window.location.pathname + '#manage-books');
    } catch (error) {
      // Ignore history manipulation errors
    }
  }
}

// Handle browser navigation
window.addEventListener('popstate', function(event) {
  const manageSection = document.getElementById("manage-books-section");
  if (manageSection && manageSection.classList.contains("active")) {
    event.preventDefault();
    forceStayOnManageBooks();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const manageSection = document.getElementById("manage-books-section");
  if (manageSection) {
    preventNavigationFromManageBooks();

    document.querySelectorAll(".sidebar-links li a").forEach(link => {
      link.addEventListener("click", function() {
        const pageId = this.getAttribute("data-page");
        if (pageId === "manage-books") {
          setTimeout(() => {
            initManageBooks();
          }, 100);
        }
      });
    });

    if (manageSection.classList.contains("active")) {
      initManageBooks();
    }

    // Event listeners for real-time updates
    document.addEventListener('borrowStatusChanged', async function(event) {
      if (manageSection.classList.contains("active")) {
        await loadAllBooks(currentSearchTerm, currentSortField, currentSortOrder, currentPage, currentCategoryFilter, currentStatusFilter);
        forceStayOnManageBooks();
      }
    });

    document.addEventListener('bookUpdated', async function(event) {
      if (manageSection.classList.contains("active")) {
        await loadAllBooks(currentSearchTerm, currentSortField, currentSortOrder, currentPage, currentCategoryFilter, currentStatusFilter);
        forceStayOnManageBooks();
      }
    });

    document.addEventListener('bookDeleted', async function(event) {
      event.preventDefault();
      event.stopPropagation();
      forceStayOnManageBooks();
      return false;
    });

    document.addEventListener('bookAdded', async function(event) {
      if (manageSection.classList.contains("active")) {
        currentPage = 1;
        await loadAllBooks(currentSearchTerm, currentSortField, currentSortOrder, 1, currentCategoryFilter, currentStatusFilter);
        forceStayOnManageBooks();
      }
    });
  }
});

export {
  loadAllBooks,
  setupBookSearch,
  setupPagination,
  filterBooks,
  setupActionButtons,
  initManageBooks,
  getStatusClass,
  normalizeStatus,
  forceStayOnManageBooks
};