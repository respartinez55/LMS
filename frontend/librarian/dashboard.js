// dashboard.js - Handles dashboard functionality

// API Base URL
const API_BASE_URL = "http://localhost:5000";

// Variable to track current active page
let currentActivePage = null;

// Chart.js chart instances
let monthlyCirculationChart = null;
let popularCategoriesChart = null;

// Helper to safely set dashboard values
function setDashboardValue(elementId, value) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = (value !== null && value !== undefined && !isNaN(value)) ? value : 0;
  } else {
    console.warn(`⚠️ Element with id '${elementId}' not found.`);
  }
}

// Helper to get status class for dashboard (same logic as managebooks.js)
function getStatusClass(status) {
  if (!status) return 'status-info';
  const statusLower = status.toLowerCase();
  if (statusLower === 'available') return 'status-available';
  if (statusLower === 'unavailable' || statusLower === 'borrowed' || statusLower === 'issued') return 'status-unavailable';
  if (statusLower === 'reserved') return 'status-reserved';
  if (statusLower === 'overdue') return 'status-overdue';
  return 'status-info';
}

// Helper to check if book should be shown in borrowed books table
function shouldShowInBorrowedTable(status) {
  if (!status) return false;
  const statusLower = status.toLowerCase();
  // Only show books that are currently borrowed, issued, overdue, or reserved
  // Don't show returned, available, or unavailable books
  return ['borrowed', 'issued', 'overdue', 'reserved'].includes(statusLower);
}

// Render Monthly Circulation Chart
function renderMonthlyCirculationChart(data) {
  const ctx = document.getElementById('monthlyCirculationChart')?.getContext('2d');
  if (!ctx) return;

  // Support both per month and per day data
  const labels = data.map(item => item.month || item.day).reverse();
  const counts = data.map(item => item.borrow_count).reverse();

  if (monthlyCirculationChart) {
    monthlyCirculationChart.destroy();
  }

  monthlyCirculationChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Borrowings',
        data: counts,
        borderColor: '#007bff',
        backgroundColor: 'rgba(0,123,255,0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: '#007bff'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Circulations (Last 30 Days or Months)' }
      },
      scales: {
        x: { title: { display: true, text: 'Date' } },
        y: { title: { display: true, text: 'Borrow Count' }, beginAtZero: true }
      }
    }
  });
}

// Render Popular Categories Chart
function renderPopularCategoriesChart(data) {
  const ctx = document.getElementById('popularCategoriesChart')?.getContext('2d');
  if (!ctx) return;

  const categories = data.map(item => item.category);
  const counts = data.map(item => item.borrow_count);

  if (popularCategoriesChart) {
    popularCategoriesChart.destroy();
  }

  popularCategoriesChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: categories,
      datasets: [{
        label: 'Borrow Count',
        data: counts,
        backgroundColor: '#28a745'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Popular Categories (Most Borrowed)' }
      },
      scales: {
        x: { title: { display: true, text: 'Category' } },
        y: { title: { display: true, text: 'Borrow Count' }, beginAtZero: true }
      }
    }
  });
}

// Render Recent Borrowed Books Table
function renderRecentBorrowedBooksTable(data) {
  const tbody = document.getElementById('borrowed-books-list');
  if (!tbody) return;

  if (!Array.isArray(data) || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center">No recent borrowed books found.</td></tr>`;
    return;
  }

  // Filter out returned books and books that are no longer borrowed
  const activeBorrowedBooks = data.filter(item => shouldShowInBorrowedTable(item.status));

  if (activeBorrowedBooks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center">No active borrowed books found.</td></tr>`;
    return;
  }

  tbody.innerHTML = activeBorrowedBooks.map(item => {
    const statusClass = getStatusClass(item.status);
    const statusHTML = `<span class="status-pill ${statusClass}">${item.status || '-'}</span>`;
    return `
      <tr>
        <td>${item.title || '-'}</td>
        <td>${item.user_name || '-'}</td>
        <td>${item.borrow_date ? formatDate(item.borrow_date) : '-'}</td>
        <td>${item.due_date ? formatDate(item.due_date) : '-'}</td>
        <td>${statusHTML}</td>
      </tr>
    `;
  }).join('');
}

// Helper to format date as YYYY-MM-DD or your preferred format
function formatDate(dateString) {
  const date = new Date(dateString);
  if (isNaN(date)) return '-';
  return date.toISOString().split('T')[0];
}

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
      setDashboardValue("total-books", data.totalBooks);
      setDashboardValue("issued-books", data.borrowedBooks);
      setDashboardValue("overdue-books", data.overdueBooks);
      setDashboardValue("pending-reservations", data.pendingReservations);

      if (Array.isArray(data.monthlyCirculations)) {
        renderMonthlyCirculationChart(data.monthlyCirculations);
      }
      if (Array.isArray(data.popularCategories)) {
        renderPopularCategoriesChart(data.popularCategories);
      }
      if (Array.isArray(data.recentBorrowedBooks)) {
        renderRecentBorrowedBooksTable(data.recentBorrowedBooks);
      }

      console.log("✅ Dashboard data loaded successfully:", data);
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

  const currentTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", currentTheme);
  themeToggle.checked = currentTheme === "dark";

  themeToggle.addEventListener("change", () => {
    const newTheme = themeToggle.checked ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
  });
}

// Track current active page
function trackCurrentPage() {
  const sidebarLinks = document.querySelectorAll(".sidebar-links li a");

  sidebarLinks.forEach(link => {
    link.addEventListener("click", function () {
      currentActivePage = this.getAttribute("data-page");
      console.log("Current active page:", currentActivePage);
    });
  });

  const dashboardSection = document.getElementById("dashboard-section");
  if (dashboardSection && dashboardSection.classList.contains("active")) {
    currentActivePage = "dashboard";
  }
}

// Refresh dashboard data without page reload
async function refreshDashboardDataOnly() {
  try {
    console.log("🔄 Refreshing dashboard data only...");

    const totalBooksElement = document.getElementById("total-books");
    if (!totalBooksElement) {
      console.log("Dashboard elements not found, skipping update");
      return;
    }

    const response = await fetch(`${API_BASE_URL}/api/dashboard/stats`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) throw new Error(`Server error: ${response.status} ${response.statusText}`);

    const data = await response.json();
    if (data.success) {
      setDashboardValue("total-books", data.totalBooks);
      setDashboardValue("issued-books", data.borrowedBooks);
      setDashboardValue("overdue-books", data.overdueBooks);
      setDashboardValue("pending-reservations", data.pendingReservations);

      if (Array.isArray(data.monthlyCirculations)) {
        renderMonthlyCirculationChart(data.monthlyCirculations);
      }
      if (Array.isArray(data.popularCategories)) {
        renderPopularCategoriesChart(data.popularCategories);
      }
      if (Array.isArray(data.recentBorrowedBooks)) {
        renderRecentBorrowedBooksTable(data.recentBorrowedBooks);
      }

      console.log("✅ Dashboard data refreshed successfully");
    } else {
      console.warn("⚠️ Failed to refresh dashboard data:", data.message);
    }
  } catch (error) {
    console.error("❌ Error refreshing dashboard data:", error);
  }
}

// Event listeners for operations affecting dashboard
function setupBookOperationListeners() {
  const events = [
    'bookAdded',
    'bookUpdated',
    'bookDeleted',
    'borrowStatusChanged',
    'reservationStatusChanged',
    'finePaid',
    'bookReturned',
    'bookIssued',
  ];

  events.forEach(evt => {
    document.addEventListener(evt, async function () {
      console.log(`📚 ${evt} event received, refreshing dashboard...`);
      await refreshDashboardDataOnly();
    });
  });
}

// Get and set current page
function getCurrentActivePage() {
  return currentActivePage;
}

function setCurrentActivePage(page) {
  currentActivePage = page;
  console.log("Current active page set to:", currentActivePage);
}

// Initialize dashboard
document.addEventListener("DOMContentLoaded", async () => {
  setupThemeSwitcher();
  trackCurrentPage();
  setupBookOperationListeners();

  const serverIsUp = await checkServerConnection();
  if (serverIsUp) {
    loadDashboardData();
  }

  const refreshBtn = document.getElementById("refreshDashboard");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", refreshDashboardDataOnly);
  }
});

// Export
export {
  API_BASE_URL,
  loadDashboardData,
  showNotification,
  checkServerConnection,
  refreshDashboardDataOnly,
  getCurrentActivePage,
  setCurrentActivePage
};