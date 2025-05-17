// dashboard.js - Handles dashboard functionality

// API Base URL
const API_BASE_URL = "http://localhost:5000";

// Load Dashboard Data
async function loadDashboardData() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/dashboard/stats`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) throw new Error(`Server error: ${response.status} ${response.statusText}`);

    const data = await response.json();
    if (data.success) {
      document.getElementById("total-books").textContent = data.totalBooks;
      document.getElementById("issued-books").textContent = data.issuedBooks;
      document.getElementById("pending-reservations").textContent = data.pendingReservations;
      document.getElementById("total-fines").textContent = `₱${data.totalFines}`;
    } else {
      showNotification("❌ Failed to load dashboard data.", "error");
    }
  } catch (error) {
    console.error("❌ Error loading dashboard stats:", error);
    showNotification(`❌ ${error.message}`, "error");
  }
}

// Show notification
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

// Initialize dashboard
document.addEventListener("DOMContentLoaded", async () => {
  setupThemeSwitcher();
  
  // Check server connection and load dashboard data
  const serverIsUp = await checkServerConnection();
  if (serverIsUp) {
    loadDashboardData();
  }
});

// Export functions for other modules
export {
  API_BASE_URL,
  loadDashboardData,
  showNotification,
  checkServerConnection
};