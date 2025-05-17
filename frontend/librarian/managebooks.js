import { API_BASE_URL, showNotification, loadDashboardData } from './dashboard.js';
import { loadCategories, resetForm, formatDate } from './addbooks.js';
// Fixed import path to match the actual file name
import { openQRModal } from './qrcode-modal.js';

function getStatusClass(status) {
  const statusLower = status.toLowerCase();
  if (statusLower === 'available') return 'status-available';
  if (statusLower === 'unavailable' || statusLower === 'borrowed' || statusLower === 'issued') return 'status-unavailable';
  if (statusLower === 'reserved') return 'status-reserved';
  if (statusLower === 'overdue') return 'status-overdue';
  return 'status-info';
}

async function loadAllBooks(searchTerm = "", sortField = "", sortOrder = "") {
  try {
    const params = new URLSearchParams();
    if (searchTerm) params.append("search", searchTerm);
    if (sortField) params.append("sortField", sortField);
    if (sortOrder) params.append("sortOrder", sortOrder);

    const response = await fetch(`${API_BASE_URL}/api/books/status?${params.toString()}`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) throw new Error(`Server error: ${response.status} ${response.statusText}`);

    const data = await response.json();
    if (!data.success) throw new Error(data.message);

    const tableBody = document.getElementById("books-list");
    if (!tableBody) return;

    tableBody.innerHTML = "";

    if (data.books && data.books.length > 0) {
      data.books.forEach((book) => {
        const row = document.createElement("tr");
        
        let bookStatus = 'Available';
        
        if (book.borrowing_status) {
          bookStatus = book.borrowing_status.charAt(0).toUpperCase() + book.borrowing_status.slice(1);
        } else if (book.status) {
          bookStatus = book.status;
        }
        
        const statusClass = getStatusClass(bookStatus);
        const statusHTML = `<span class="status-pill ${statusClass}">${bookStatus}</span>`;

        row.innerHTML = `
          <td>${book.title}</td>
          <td>${book.author}</td>
          <td>${book.category}</td>
          <td>${book.quantity || 0}</td>
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
      
      if (data.pagination) {
        updatePagination(data.pagination, data.books.length);
      }
    } else {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center">No books found</td></tr>`;
    }
  } catch (error) {
    console.error("Error loading books:", error);
    showNotification(`${error.message}`, "error");
  }
}

function setupActionButtons() {
  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", async function () {
      const bookId = this.getAttribute("data-id");
      openQRModal(bookId);
    });
  });

  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", async function () {
      const bookId = this.getAttribute("data-id");
      await loadBookForEditing(bookId);
    });
  });

  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async function () {
      const bookId = this.getAttribute("data-id");
      if (confirm("Are you sure you want to delete this book?")) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/books/${bookId}`, {
            method: "DELETE",
          });

          const data = await response.json();
          if (data.success) {
            showNotification("Book deleted successfully", "success");
            loadAllBooks();
            loadDashboardData();
          } else {
            throw new Error(data.message);
          }
        } catch (error) {
          console.error("Error deleting book:", error);
          showNotification(`${error.message}`, "error");
        }
      }
    });
  });
}

function setupSearchAndSort() {
  const searchInput = document.getElementById("bookSearch");
  const sortSelect = document.getElementById("sortBooks");

  if (searchInput) {
    searchInput.addEventListener("input", debounce(() => {
      const searchTerm = searchInput.value.trim();
      const [sortField, sortOrder] = sortSelect ? sortSelect.value.split(":") : ["", ""];
      loadAllBooks(searchTerm, sortField, sortOrder);
    }, 300));
  }

  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      const searchTerm = searchInput ? searchInput.value.trim() : "";
      const [sortField, sortOrder] = sortSelect.value.split(":");
      loadAllBooks(searchTerm, sortField, sortOrder);
    });
  }
}

async function loadBookForEditing(bookId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/books/${bookId}`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);

    document.querySelectorAll(".page-section").forEach(section => {
      section.classList.remove("active");
    });
    document.getElementById("add-book-section").classList.add("active");

    document.querySelectorAll(".sidebar-links li a").forEach(link => {
      link.classList.remove("active");
    });
    document.querySelector('a[data-page="add-book"]').classList.add("active");

    const form = document.getElementById("addBookForm");
    form.setAttribute("data-mode", "edit");
    form.setAttribute("data-book-id", bookId);

    document.getElementById("bookTitle").value = data.book.title;
    document.getElementById("bookAuthor").value = data.book.author;
    
    await loadCategories();
    const categoryDropdown = document.getElementById("bookCategory");
    
    let categoryExists = false;
    for (let i = 0; i < categoryDropdown.options.length; i++) {
      if (categoryDropdown.options[i].value === data.book.category) {
        categoryExists = true;
        break;
      }
    }
    
    if (!categoryExists && data.book.category) {
      const newOption = document.createElement("option");
      newOption.value = data.book.category;
      newOption.textContent = data.book.category;
      categoryDropdown.insertBefore(newOption, categoryDropdown.querySelector('[value="add-new"]'));
    }
    
    categoryDropdown.value = data.book.category;
    
    document.getElementById("bookISBN").value = data.book.isbn;
    document.getElementById("bookDescription").value = data.book.description || "";
    
    if (document.getElementById("bookQuantity")) {
      document.getElementById("bookQuantity").value = data.book.quantity || 0;
    }

    const previewElement = document.getElementById("bookCoverPreview");
    if (data.book.cover_image) {
      previewElement.src = data.book.cover_image;
      previewElement.style.display = "block";
    } else {
      previewElement.style.display = "none";
    }

    document.querySelector("#add-book-section .page-header h2").textContent = "Edit Book";
    document.getElementById("saveBookBtn").textContent = "Update Book";
    if (document.getElementById("saveButtonText")) {
      document.getElementById("saveButtonText").textContent = "Update Book";
    }

    if (!document.getElementById("cancelEditBtn")) {
      const cancelBtn = document.createElement("button");
      cancelBtn.id = "cancelEditBtn";
      cancelBtn.className = "btn btn-outline";
      cancelBtn.type = "button";
      cancelBtn.textContent = "Cancel";
      cancelBtn.onclick = resetForm;
      
      const saveButton = document.getElementById("saveBookBtn");
      if (saveButton && saveButton.parentNode) {
        saveButton.parentNode.appendChild(cancelBtn);
      }
    }

    showNotification("Book loaded for editing", "success");
  } catch (error) {
    console.error("Error loading book for edit:", error);
    showNotification(`${error.message}`, "error");
  }
}

function setupBookSearch() {
  const searchInput = document.getElementById("bookSearch");
  const categoryFilter = document.getElementById("categoryFilter");
  const statusFilter = document.getElementById("statusFilter");
  const refreshButton = document.getElementById("refreshBooksBtn");
  
  if (searchInput) {
    searchInput.addEventListener("input", debounce(() => filterBooks(), 300));
  }
  
  if (categoryFilter) {
    categoryFilter.addEventListener("change", () => filterBooks());
  }
  
  if (statusFilter) {
    statusFilter.addEventListener("change", () => filterBooks());
  }
  
  if (refreshButton) {
    refreshButton.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (categoryFilter) categoryFilter.value = "";
      if (statusFilter) statusFilter.value = "";
      
      loadAllBooks();
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
  
  try {
    const params = new URLSearchParams();
    if (searchTerm) params.append("search", searchTerm);
    if (categoryFilter) params.append("category", categoryFilter);
    if (statusFilter) params.append("status", statusFilter);
    
    const queryString = params.toString() ? `?${params.toString()}` : "";
    const response = await fetch(`${API_BASE_URL}/api/books/status${queryString}`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    
    const tableBody = document.getElementById("books-list");
    if (!tableBody) return;
    
    tableBody.innerHTML = "";
    
    if (data.books && data.books.length > 0) {
      data.books.forEach((book) => {
        const row = document.createElement("tr");
        
        let bookStatus = 'Available';
        
        if (book.borrowing_status) {
          bookStatus = book.borrowing_status.charAt(0).toUpperCase() + book.borrowing_status.slice(1);
        } else if (book.status) {
          bookStatus = book.status;
        }
        
        const statusClass = getStatusClass(bookStatus);
        const statusHTML = `<span class="status-pill ${statusClass}">${bookStatus}</span>`;

        row.innerHTML = `
          <td>${book.title}</td>
          <td>${book.author}</td>
          <td>${book.category}</td>
          <td>${book.quantity || 0}</td>
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
      
      if (data.pagination) {
        updatePagination(data.pagination, data.books.length);
      }
    } else {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center">No books found</td></tr>`;
    }
  } catch (error) {
    console.error("Error filtering books:", error);
    showNotification(`${error.message}`, "error");
  }
}

function setupPagination() {
  const paginationContainer = document.getElementById("books-pagination");
  if (!paginationContainer) return;
  
  paginationContainer.addEventListener("click", (e) => {
    if (e.target.classList.contains("pagination-btn")) {
      const page = e.target.getAttribute("data-page");
      loadBooksPage(page);
      
      document.querySelectorAll(".pagination-btn").forEach(btn => {
        btn.classList.remove("active");
      });
      e.target.classList.add("active");
    }
  });
}

async function loadBooksPage(page) {
  try {
    const searchTerm = document.getElementById("bookSearch")?.value.trim() || "";
    const categoryFilter = document.getElementById("categoryFilter")?.value || "";
    const statusFilter = document.getElementById("statusFilter")?.value || "";
    
    const params = new URLSearchParams();
    params.append("page", page);
    if (searchTerm) params.append("search", searchTerm);
    if (categoryFilter) params.append("category", categoryFilter);
    if (statusFilter) params.append("status", statusFilter);
    
    const response = await fetch(`${API_BASE_URL}/api/books/status?${params.toString()}`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    
    const tableBody = document.getElementById("books-list");
    if (!tableBody) return;
    
    tableBody.innerHTML = "";
    
    if (data.books && data.books.length > 0) {
      data.books.forEach((book) => {
        const row = document.createElement("tr");
        
        let bookStatus = 'Available';
        
        if (book.borrowing_status) {
          bookStatus = book.borrowing_status.charAt(0).toUpperCase() + book.borrowing_status.slice(1);
        } else if (book.status) {
          bookStatus = book.status;
        }
        
        const statusClass = getStatusClass(bookStatus);
        const statusHTML = `<span class="status-pill ${statusClass}">${bookStatus}</span>`;

        row.innerHTML = `
          <td>${book.title}</td>
          <td>${book.author}</td>
          <td>${book.category}</td>
          <td>${book.quantity || 0}</td>
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
    } else {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center">No books found</td></tr>`;
    }
    
    if (data.pagination) {
      updatePagination(data.pagination, data.books.length);
    }
  } catch (error) {
    console.error("Error loading books page:", error);
    showNotification(`${error.message}`, "error");
  }
}

function updatePagination(pagination, booksCount) {
  const paginationContainer = document.getElementById("books-pagination");
  if (!paginationContainer) return;
  
  paginationContainer.innerHTML = "";
  
  const { currentPage, totalPages } = pagination;
  
  if (booksCount > 50) {
    addPaginationButton(paginationContainer, 1, "1", currentPage === 1);
    
    if (totalPages > 1) {
      addPaginationButton(paginationContainer, 2, "2", currentPage === 2);
    }
    
    if (currentPage > 2) {
      addPaginationButton(paginationContainer, currentPage, currentPage.toString(), true);
    }
    
    if (currentPage < totalPages) {
      addPaginationButton(paginationContainer, currentPage + 1, "Next");
    }
  } else {
    addPaginationButton(paginationContainer, 1, "1", true);
  }
}

function addPaginationButton(container, page, text, isActive = false) {
  const button = document.createElement("button");
  button.className = `pagination-btn ${isActive ? 'active' : ''}`;
  button.setAttribute("data-page", page);
  button.textContent = text;
  container.appendChild(button);
}

function synchronizeBookStatus() {
  const syncInterval = 10000;
  setInterval(async () => {
    const manageSection = document.getElementById("manage-books-section");
    if (manageSection && manageSection.classList.contains("active")) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/books/sync-status`, {
          method: "GET",
          headers: { "Accept": "application/json" },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.updated) {
            loadAllBooks();
          }
        }
      } catch (error) {
        console.error("Error syncing book statuses:", error);
      }
    }
  }, syncInterval);
}

function refreshBookStatus() {
  const refreshInterval = 15000;
  setInterval(() => {
    const manageSection = document.getElementById("manage-books-section");
    if (manageSection && manageSection.classList.contains("active")) {
      loadAllBooks();
    }
  }, refreshInterval);
}

function initManageBooks() {
  setupBookSearch();
  setupPagination();
  setupSearchAndSort();
  
  loadCategories();
  loadAllBooks();
  
  synchronizeBookStatus();
  refreshBookStatus();
}

document.addEventListener("DOMContentLoaded", () => {
  const manageSection = document.getElementById("manage-books-section");
  if (manageSection) {
    document.querySelectorAll(".sidebar-links li a").forEach(link => {
      link.addEventListener("click", function() {
        const pageId = this.getAttribute("data-page");
        if (pageId === "manage-books") {
          initManageBooks();
        }
      });
    });
    
    if (manageSection.classList.contains("active")) {
      initManageBooks();
    }
    
    document.addEventListener('borrowStatusChanged', function(event) {
      if (manageSection.classList.contains("active")) {
        loadAllBooks();
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
  setupSearchAndSort,
  initManageBooks,
  getStatusClass
};