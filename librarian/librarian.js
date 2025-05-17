// API Base URL
const API_BASE_URL = "http://localhost:5000";

// Load categories from server and populate dropdowns
async function loadCategories() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/categories`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) throw new Error(`Failed to fetch categories: ${response.statusText}`);

    const data = await response.json();
    if (data.success) {
      const categoryFilter = document.getElementById("categoryFilter");

      // Store existing selected value before clearing
      const selectedFilter = categoryFilter ? categoryFilter.value : "";

      // Clear existing options but preserve selections
      if (categoryFilter) categoryFilter.innerHTML = `<option value="">All Categories</option>`;

      // Add fetched categories
      data.categories.forEach((category) => {
        if (categoryFilter) {
          const filterOption = document.createElement("option");
          filterOption.value = category;
          filterOption.textContent = category;
          if (selectedFilter === category) filterOption.selected = true;
          categoryFilter.appendChild(filterOption);
        }
      });
    }
  } catch (error) {
    console.error("❌ Error loading categories:", error);
    showNotification(`❌ ${error.message}`, "error");
  }
}

// Get status class for styling
function getStatusClass(status) {
  switch (status.toLowerCase()) {
    case "available":
      return "status-available";
    case "issued":
      return "status-issued";
    case "reserved":
      return "status-reserved";
    default:
      return "status-available";
  }
}

// Format date for display
function formatDate(dateString) {
  if (!dateString || dateString === 'Not returned') return dateString;
  
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Sidebar handling
function setupSidebar() {
  const sidebarLinks = document.querySelectorAll(".sidebar-links li a");
  
  // Set username if available from localStorage
  const username = localStorage.getItem("username") || "Librarian";
  document.getElementById("username").textContent = username;

  sidebarLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();

      sidebarLinks.forEach((l) => l.classList.remove("active"));
      link.classList.add("active");

      const pageId = link.getAttribute("data-page");
      document.querySelectorAll(".page-section").forEach((section) => {
        section.classList.remove("active");
      });

      const targetSection = document.getElementById(`${pageId}-section`);
      if (targetSection) {
        targetSection.classList.add("active");
        
        // Load data appropriate for the active section
        if (pageId === "issue-books") {
          loadRecentlyIssuedBooks();
        } else if (pageId === "return-books") {
          loadBooksForReturn();
        } else if (pageId === "reservations") {
          loadReservations();
        } else if (pageId === "fines") {
          loadFines();
        }
      }
    });
  });
  
  // Handle logout
  document.getElementById("logout-btn").addEventListener("click", (e) => {
    e.preventDefault();
    if (confirm("Are you sure you want to logout?")) {
      // Clear any stored credentials
      localStorage.removeItem("username");
      localStorage.removeItem("authToken");
      
      // Redirect to login page
      window.location.href = "index.html";
    }
  });
}

// Generic placeholder function for sections 
function loadRecentlyIssuedBooks() {
  // This would load recently issued books
  console.log("Loading recently issued books...");
  
  try {
    fetch(`${API_BASE_URL}/api/books/issued`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    })
    .then(response => {
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      return response.json();
    })
    .then(data => {
      if (!data.success) throw new Error(data.message);
      
      const tableBody = document.getElementById("issued-books-list");
      if (!tableBody) {
        console.error("❌ Issued books list element not found");
        return;
      }
      
      if (data.issuedBooks && data.issuedBooks.length > 0) {
        tableBody.innerHTML = '';
        
        data.issuedBooks.forEach(book => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${book.title}</td>
            <td>${book.borrower}</td>
            <td>${formatDate(book.issueDate)}</td>
            <td>${formatDate(book.dueDate)}</td>
            <td><span class="status-pill status-issued">Issued</span></td>
          `;
          tableBody.appendChild(row);
        });
      } else {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No issued books found</td></tr>';
      }
    })
    .catch(error => {
      console.error("❌ Error loading issued books:", error);
      showNotification(`❌ ${error.message}`, "error");
      document.getElementById("issued-books-list").innerHTML = 
        '<tr><td colspan="5" class="text-center">Failed to load issued books</td></tr>';
    });
  } catch (error) {
    console.error("❌ Error initiating issued books fetch:", error);
    showNotification(`❌ ${error.message}`, "error");
  }
}

function loadBooksForReturn() {
  // This would load books due for return
  console.log("Loading books for return...");
  
  try {
    fetch(`${API_BASE_URL}/api/books/due`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    })
    .then(response => {
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      return response.json();
    })
    .then(data => {
      if (!data.success) throw new Error(data.message);
      
      const tableBody = document.getElementById("return-books-list");
      if (!tableBody) {
        console.error("❌ Return books list element not found");
        return;
      }
      
      if (data.dueBooks && data.dueBooks.length > 0) {
        tableBody.innerHTML = '';
        
        data.dueBooks.forEach(book => {
          const row = document.createElement('tr');
          const isOverdue = new Date(book.dueDate) < new Date();
          
          row.innerHTML = `
            <td>${book.title}</td>
            <td>${book.borrower}</td>
            <td>${formatDate(book.issueDate)}</td>
            <td>${formatDate(book.dueDate)}</td>
            <td><span class="status-pill ${isOverdue ? 'status-reserved' : 'status-issued'}">
              ${isOverdue ? 'Overdue' : 'Due'}
            </span></td>
            <td>
              <button class="action-btn return-btn" data-id="${book.id}" title="Return Book">
                <i class="fas fa-undo-alt"></i>
              </button>
            </td>
          `;
          tableBody.appendChild(row);
        });
        
        // Setup return buttons
        setupReturnButtons();
      } else {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No books due for return</td></tr>';
      }
    })
    .catch(error => {
      console.error("❌ Error loading due books:", error);
      showNotification(`❌ ${error.message}`, "error");
      document.getElementById("return-books-list").innerHTML = 
        '<tr><td colspan="6" class="text-center">Failed to load books due for return</td></tr>';
    });
  } catch (error) {
    console.error("❌ Error initiating due books fetch:", error);
    showNotification(`❌ ${error.message}`, "error");
  }
}

// Setup return buttons
function setupReturnButtons() {
  document.querySelectorAll(".return-btn").forEach(btn => {
    btn.addEventListener("click", async function() {
      const bookId = this.getAttribute("data-id");
      if (confirm("Mark this book as returned?")) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/books/return`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookId })
          });
          
          const data = await response.json();
          if (data.success) {
            showNotification("✅ Book returned successfully", "success");
            
            // Show fine information if applicable
            if (data.fine && data.fine > 0) {
              showNotification(`ℹ️ Fine of ₱${data.fine} has been applied`, "info");
            }
            
            // Reload the books due for return
            loadBooksForReturn();
          } else {
            throw new Error(data.message);
          }
        } catch (error) {
          console.error("❌ Error returning book:", error);
          showNotification(`❌ ${error.message}`, "error");
        }
      }
    });
  });
}

function loadReservations() {
  // This would load book reservations
  console.log("Loading reservations...");
  
  try {
    fetch(`${API_BASE_URL}/api/reservations`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    })
    .then(response => {
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      return response.json();
    })
    .then(data => {
      if (!data.success) throw new Error(data.message);
      
      const tableBody = document.getElementById("reservations-list");
      if (!tableBody) {
        console.error("❌ Reservations list element not found");
        return;
      }
      
      if (data.reservations && data.reservations.length > 0) {
        tableBody.innerHTML = '';
        
        data.reservations.forEach(reservation => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${reservation.bookTitle}</td>
            <td>${reservation.borrower}</td>
            <td>${formatDate(reservation.reservationDate)}</td>
            <td>${formatDate(reservation.expiryDate)}</td>
            <td><span class="status-pill status-reserved">Reserved</span></td>
            <td>
              <button class="action-btn approve-btn" data-id="${reservation.id}" title="Approve Reservation">
                <i class="fas fa-check"></i>
              </button>
              <button class="action-btn cancel-btn" data-id="${reservation.id}" title="Cancel Reservation">
                <i class="fas fa-times"></i>
              </button>
            </td>
          `;
          tableBody.appendChild(row);
        });
        
        // Setup action buttons
        setupReservationActionButtons();
      } else {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No reservations found</td></tr>';
      }
    })
    .catch(error => {
      console.error("❌ Error loading reservations:", error);
      showNotification(`❌ ${error.message}`, "error");
      document.getElementById("reservations-list").innerHTML = 
        '<tr><td colspan="6" class="text-center">Failed to load reservations</td></tr>';
    });
  } catch (error) {
    console.error("❌ Error initiating reservations fetch:", error);
    showNotification(`❌ ${error.message}`, "error");
  }
}

// Setup reservation action buttons
function setupReservationActionButtons() {
  // Approve reservation
  document.querySelectorAll(".approve-btn").forEach(btn => {
    btn.addEventListener("click", async function() {
      const reservationId = this.getAttribute("data-id");
      if (confirm("Approve this reservation and issue the book?")) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/reservations/${reservationId}/approve`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" }
          });
          
          const data = await response.json();
          if (data.success) {
            showNotification("✅ Reservation approved and book issued", "success");
            loadReservations();
          } else {
            throw new Error(data.message);
          }
        } catch (error) {
          console.error("❌ Error approving reservation:", error);
          showNotification(`❌ ${error.message}`, "error");
        }
      }
    });
  });
  
  // Cancel reservation
  document.querySelectorAll(".cancel-btn").forEach(btn => {
    btn.addEventListener("click", async function() {
      const reservationId = this.getAttribute("data-id");
      if (confirm("Cancel this reservation?")) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/reservations/${reservationId}`, {
            method: "DELETE"
          });
          
          const data = await response.json();
          if (data.success) {
            showNotification("✅ Reservation cancelled", "success");
            loadReservations();
          } else {
            throw new Error(data.message);
          }
        } catch (error) {
          console.error("❌ Error cancelling reservation:", error);
          showNotification(`❌ ${error.message}`, "error");
        }
      }
    });
  });
}

function loadFines() {
  // This would load fines data
  console.log("Loading fines data...");
  
  try {
    fetch(`${API_BASE_URL}/api/fines`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    })
    .then(response => {
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      return response.json();
    })
    .then(data => {
      if (!data.success) throw new Error(data.message);
      
      const tableBody = document.getElementById("fines-list");
      if (!tableBody) {
        console.error("❌ Fines list element not found");
        return;
      }
      
      if (data.fines && data.fines.length > 0) {
        tableBody.innerHTML = '';
        
        data.fines.forEach(fine => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${fine.borrower}</td>
            <td>${fine.bookTitle}</td>
            <td>${formatDate(fine.dueDate)}</td>
            <td>${formatDate(fine.returnDate || 'Not returned')}</td>
            <td>₱${fine.amount.toFixed(2)}</td>
            <td><span class="status-pill ${fine.paid ? 'status-available' : 'status-issued'}">${fine.paid ? 'Paid' : 'Unpaid'}</span></td>
            <td>
              ${!fine.paid ? `<button class="action-btn pay-btn" data-id="${fine.id}" title="Mark as Paid">
                <i class="fas fa-money-bill"></i>
              </button>` : ''}
            </td>
          `;
          tableBody.appendChild(row);
        });
        
        // Setup pay buttons if any
        setupPayFineButtons();
      } else {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No fines found</td></tr>';
      }
    })
    .catch(error => {
      console.error("❌ Error loading fines:", error);
      showNotification(`❌ ${error.message}`, "error");
      document.getElementById("fines-list").innerHTML = 
        '<tr><td colspan="7" class="text-center">Failed to load fines</td></tr>';
    });
  } catch (error) {
    console.error("❌ Error initiating fines fetch:", error);
    showNotification(`❌ ${error.message}`, "error");
  }
}

// Setup pay fine buttons
function setupPayFineButtons() {
  document.querySelectorAll(".pay-btn").forEach(btn => {
    btn.addEventListener("click", async function() {
      const fineId = this.getAttribute("data-id");
      if (confirm("Mark this fine as paid?")) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/fines/${fineId}/pay`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paid: true })
          });
          
          const data = await response.json();
          if (data.success) {
            showNotification("✅ Fine marked as paid", "success");
            loadFines();
          } else {
            throw new Error(data.message);
          }
        } catch (error) {
          console.error("❌ Error updating fine:", error);
          showNotification(`❌ ${error.message}`, "error");
        }
      }
    });
  });
}

// Show/hide mobile sidebar
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  sidebar.classList.toggle('sidebar-open');
}

// Notification system
function showNotification(message, type) {
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

// Server health check
async function checkServerConnection() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) throw new Error(`Status: ${response.status}`);
    const data = await response.json();
    console.log("✅ Server status:", data);
    return true;
  } catch (error) {
    console.error("❌ Cannot connect to server:", error);
    showNotification("❌ Cannot connect to server. Please check if the backend is running.", "error");
    return false;
  }
}

// Handle book issue functionality
async function issueBook() {
  const bookId = document.getElementById("issueBookId").value.trim();
  const borrowerId = document.getElementById("issueBorrowerId").value.trim();
  const dueDate = document.getElementById("issueDueDate").value;
  
  if (!bookId || !borrowerId || !dueDate) {
    showNotification("❌ Please fill in all required fields", "error");
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/books/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookId,
        borrowerId,
        dueDate
      })
    });
    
    const data = await response.json();
    if (data.success) {
      showNotification("✅ Book issued successfully", "success");
      document.getElementById("issueBookForm").reset();
      loadRecentlyIssuedBooks();
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error("❌ Error issuing book:", error);
    showNotification(`❌ ${error.message}`, "error");
  }
}

// Book return functionality
async function returnBook() {
  const bookId = document.getElementById("returnBookId").value.trim();
  
  if (!bookId) {
    showNotification("❌ Please enter a Book ID or scan QR code", "error");
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/books/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId })
    });
    
    const data = await response.json();
    if (data.success) {
      showNotification("✅ Book returned successfully", "success");
      document.getElementById("returnBookForm").reset();
      
      // Show fine information if applicable
      if (data.fine && data.fine > 0) {
        showNotification(`ℹ️ Fine of ₱${data.fine} has been applied`, "info");
      }
      
      if (document.getElementById("return-books-section").classList.contains("active")) {
        loadBooksForReturn();
      }
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error("❌ Error returning book:", error);
    showNotification(`❌ ${error.message}`, "error");
  }
}

// Handle QR scanner for book issue and return
function setupQRScanner(targetInputId) {
  const scannerContainer = document.getElementById("qrScanner");
  if (!scannerContainer) return;
  
  let scanner = null;
  
  document.getElementById("openScannerBtn").addEventListener("click", () => {
    scannerContainer.style.display = "block";
    
    // Initialize QR scanner if not already
    if (!scanner) {
      scanner = new Html5QrcodeScanner("qrScannerView", { fps: 10, qrbox: 250 });
      
      scanner.render((decodedText) => {
        try {
          const bookData = JSON.parse(decodedText);
          document.getElementById(targetInputId).value = bookData.isbn || decodedText;
          
          // Close scanner
          scanner.clear();
          scannerContainer.style.display = "none";
          
          showNotification("✅ QR code scanned successfully", "success");
        } catch (error) {
          console.error("❌ Error processing QR data:", error);
          document.getElementById(targetInputId).value = decodedText;
          scanner.clear();
          scannerContainer.style.display = "none";
        }
      });
    }
  });
  
  document.getElementById("closeScannerBtn").addEventListener("click", () => {
    if (scanner) {
      scanner.clear();
    }
    scannerContainer.style.display = "none";
  });
}

// Theme switcher functionality
function setupThemeSwitcher() {
  const themeToggle = document.getElementById("themeToggle");
  if (!themeToggle) return;
  
  // Check for saved theme preference or default to 'light'
  const currentTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", currentTheme);
  
  // Update toggle state based on current theme
  themeToggle.checked = currentTheme === "dark";
  
  // Handle theme toggle change
  themeToggle.addEventListener("change", () => {
    const newTheme = themeToggle.checked ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
  });
}

// Initialize app
document.addEventListener("DOMContentLoaded", async () => {
  // Set up event listeners
  const issueBookForm = document.getElementById("issueBookForm");
  if (issueBookForm) {
    issueBookForm.addEventListener("submit", (e) => {
      e.preventDefault();
      issueBook();
    });
  }
  
  const returnBookForm = document.getElementById("returnBookForm");
  if (returnBookForm) {
    returnBookForm.addEventListener("submit", (e) => {
      e.preventDefault();
      returnBook();
    });
  }
  
  const mobileSidebarToggle = document.getElementById("mobileSidebarToggle");
  if (mobileSidebarToggle) {
    mobileSidebarToggle.addEventListener("click", toggleSidebar);
  }
  
  // Set up UI components
  setupSidebar();
  setupThemeSwitcher();
  
  // Initial data loading
  const serverIsUp = await checkServerConnection();
  if (serverIsUp) {
    // Check if we should load specific section data
    const activeSection = document.querySelector(".page-section.active");
    if (activeSection) {
      const pageId = activeSection.id.replace("-section", "");
      
      if (pageId === "issue-books") {
        loadRecentlyIssuedBooks();
      } else if (pageId === "return-books") {
        loadBooksForReturn();
      } else if (pageId === "reservations") {
        loadReservations();
      } else if (pageId === "fines") {
        loadFines();
      }
    }
  }
  
  // Set up QR scanner if needed
  if (document.getElementById("issueBookId")) {
    setupQRScanner("issueBookId");
  }
  if (document.getElementById("returnBookId")) {
    setupQRScanner("returnBookId");
  }
});