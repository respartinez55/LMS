// API Base URL
const API_BASE_URL = "http://localhost:5000";

// Load categories from server and populate dropdowns
async function loadCategories() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/categories`, {
      method: "GET",
      headers: { 
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
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
    case "pending":
      return "status-reserved";
    case "approved":
      return "status-approved";
    case "fulfilled":
      return "status-fulfilled";
    case "cancelled":
    case "rejected":
      return "status-cancelled";
    case "expired":
      return "status-expired";
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
  const usernameElement = document.getElementById("username");
  if (usernameElement) {
    usernameElement.textContent = username;
  }

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
      }
    });
  });
  
  // Handle logout
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
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
}

// Show/hide mobile sidebar
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.classList.toggle('sidebar-open');
  }
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
      headers: { 
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
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
  console.log("🚀 Initializing Library Management System...");
  
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
    console.log("✅ Server connection established");
  } else {
    console.log("❌ Server connection failed");
  }
  
  console.log("✅ Library Management System initialized");
});