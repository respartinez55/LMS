import {
  getAllUsers,
  updateUserStatus,
  deleteAccount
} from "../db.js";

// Inject CSS for round action buttons and table styling (reuse from approve.js)
(function injectManageCSS() {
  const style = document.createElement('style');
  style.textContent = `
    .action-btn-group {
      display: flex;
      gap: 10px;
      justify-content: center;
      align-items: center;
      height: 100%;
    }
    .round-btn {
      background: #f7f7fa;
      border: none;
      border-radius: 50%;
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
      font-size: 18px;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    }
    .round-btn:hover {
      background: #e0e0e0;
    }
    .block-btn { color: #f39c12; }
    .delete-btn { color: #e74c3c; }
    .edit-btn { color: #3498db; }
    .actions-header, td.actions-cell {
      text-align: center !important;
      vertical-align: middle !important;
    }
  `;
  document.head.appendChild(style);
})();

// Elements
const manageStudentsTable = document.getElementById("manageStudentsTable");
const manageTeachersTable = document.getElementById("manageTeachersTable");
const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearch");
const userTypeFilter = document.getElementById("userTypeFilter");
const statusFilter = document.getElementById("statusFilter");

// Store all users for filtering/searching
let allStudents = {};
let allTeachers = {};

// Button HTML with icons and round style (edit, block, delete)
function actionButtons(uid, type) {
  return `
    <div class="action-btn-group">
      <button class="edit-btn round-btn" title="Edit" data-uid="${uid}" data-type="${type}">
        <i class="fas fa-pen"></i>
      </button>
      <button class="block-btn round-btn" title="Block" data-uid="${uid}" data-type="${type}">
        <i class="fas fa-ban"></i>
      </button>
      <button class="delete-btn round-btn" title="Delete" data-uid="${uid}" data-type="${type}">
        <span style="font-size:22px;line-height:1;display:inline-block;">&times;</span>
      </button>
    </div>
  `;
}

// Notification utility
function showNotification(message, type = 'info') {
  let notificationContainer = document.querySelector('.notification-container');
  if (!notificationContainer) {
    notificationContainer = document.createElement('div');
    notificationContainer.className = 'notification-container';
    document.body.appendChild(notificationContainer);
  }
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <div>${message}</div>
    <button class="close-btn">&times;</button>
  `;
  notificationContainer.innerHTML = '';
  notificationContainer.appendChild(notification);
  notification.querySelector('.close-btn').addEventListener('click', () => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  });
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300);
  }, 5000);
}

// Helper: filter and search users
function filterAndSearchUsers(users, type) {
  const search = (searchInput.value || "").toLowerCase();
  const status = (statusFilter.value || "").toLowerCase();
  let filtered = [];
  for (const uid in users) {
    const user = users[uid];
    // User type filter
    if (userTypeFilter.value && userTypeFilter.value.toLowerCase() !== type && userTypeFilter.value !== "all") continue;
    // Status filter
    if (status && (user.status || "").toLowerCase() !== status) continue;
    // Search filter
    const fullName = `${user.firstName || ""} ${user.lastName || ""}`.toLowerCase();
    const email = (user.email || "").toLowerCase();
    const lrn = (user.lrn || "").toLowerCase();
    const grade = (user.grade || "").toLowerCase();
    const section = (user.section || "").toLowerCase();
    const empId = (user.employeeId || "").toLowerCase();
    const dept = (user.department || "").toLowerCase();
    let match = false;
    if (type === "student") {
      match =
        fullName.includes(search) ||
        email.includes(search) ||
        lrn.includes(search) ||
        grade.includes(search) ||
        section.includes(search);
    } else {
      match =
        fullName.includes(search) ||
        email.includes(search) ||
        empId.includes(search) ||
        dept.includes(search);
    }
    if (!search || match) {
      filtered.push({ ...user, uid });
    }
  }
  return filtered;
}

// Render students (all statuses, but filtered)
function renderManageStudents(students) {
  manageStudentsTable.innerHTML = "";
  const filtered = filterAndSearchUsers(students, "student");
  if (filtered.length === 0) {
    manageStudentsTable.innerHTML = `<tr><td colspan="7" style="text-align:center;">No students found</td></tr>`;
    return;
  }
  for (const student of filtered) {
    const fullName = `${student.firstName || ""} ${student.lastName || ""}`;
    manageStudentsTable.innerHTML += `
      <tr data-uid="${student.uid}">
        <td>${fullName}</td>
        <td>${student.email || ""}</td>
        <td>${student.lrn || ""}</td>
        <td>${student.grade || ""}</td>
        <td>${student.section || ""}</td>
        <td><span class="status-badge status-${(student.status || "").toLowerCase()}">${capitalize(student.status)}</span></td>
        <td class="actions-cell">
          ${actionButtons(student.uid, "student")}
        </td>
      </tr>
    `;
  }
}

// Render teachers (all statuses, but filtered)
function renderManageTeachers(teachers) {
  manageTeachersTable.innerHTML = "";
  const filtered = filterAndSearchUsers(teachers, "teacher");
  if (filtered.length === 0) {
    manageTeachersTable.innerHTML = `<tr><td colspan="6" style="text-align:center;">No teachers found</td></tr>`;
    return;
  }
  for (const teacher of filtered) {
    const fullName = `${teacher.firstName || ""} ${teacher.lastName || ""}`;
    manageTeachersTable.innerHTML += `
      <tr data-uid="${teacher.uid}">
        <td>${fullName}</td>
        <td>${teacher.email || ""}</td>
        <td>${teacher.employeeId || ""}</td>
        <td>${teacher.department || ""}</td>
        <td><span class="status-badge status-${(teacher.status || "").toLowerCase()}">${capitalize(teacher.status)}</span></td>
        <td class="actions-cell">
          ${actionButtons(teacher.uid, "teacher")}
        </td>
      </tr>
    `;
  }
}

// Capitalize helper
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Block/delete/edit handler
async function handleManageAction(event) {
  const target = event.target.closest("button");
  if (!target) return;

  const uid = target.getAttribute("data-uid");
  const userType = target.getAttribute("data-type");

  if (target.classList.contains("block-btn")) {
    // Block user
    if (confirm("Are you sure you want to block this user?")) {
      const result = await updateUserStatus(uid, userType, "blocked");
      if (result.success) {
        showNotification("User blocked", "warning");
        await refreshTables();
      } else {
        showNotification("Failed to block user: " + (result.error || ""), "error");
      }
    }
  } else if (target.classList.contains("delete-btn")) {
    // Delete user
    if (confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      const result = await deleteAccount(uid);
      if (result.success) {
        showNotification("User deleted", "success");
        await refreshTables();
      } else {
        showNotification("Failed to delete user: " + (result.error || ""), "error");
      }
    }
  } else if (target.classList.contains("edit-btn")) {
    // Open edit modal (trigger custom event or your modal logic here)
    // Example: window.openEditUserModal(uid, userType);
    showNotification("Edit user functionality not implemented in this file.", "info");
  }
}

// Refresh tables and store all users for filtering/searching
async function refreshTables() {
  const { students, teachers } = await getAllUsers();
  allStudents = students;
  allTeachers = teachers;
  renderManageStudents(allStudents);
  renderManageTeachers(allTeachers);
  updateTableVisibility();
}

// Filtering and search event listeners
function setupFilters() {
  // Search
  searchInput.addEventListener("input", () => {
    renderManageStudents(allStudents);
    renderManageTeachers(allTeachers);
    updateTableVisibility();
  });
  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    renderManageStudents(allStudents);
    renderManageTeachers(allTeachers);
    updateTableVisibility();
  });
  // User type filter
  userTypeFilter.addEventListener("change", () => {
    renderManageStudents(allStudents);
    renderManageTeachers(allTeachers);
    updateTableVisibility();
  });
  // Status filter
  statusFilter.addEventListener("change", () => {
    renderManageStudents(allStudents);
    renderManageTeachers(allTeachers);
    updateTableVisibility();
  });
}

// Show/hide tables based on userTypeFilter
function updateTableVisibility() {
  const type = userTypeFilter.value.toLowerCase();
  if (type === "student") {
    manageStudentsTable.style.display = "";
    manageTeachersTable.style.display = "none";
    if (manageStudentsTable.innerHTML.trim() === "") {
      manageStudentsTable.style.display = "none";
    }
  } else if (type === "teacher") {
    manageStudentsTable.style.display = "none";
    manageTeachersTable.style.display = "";
    if (manageTeachersTable.innerHTML.trim() === "") {
      manageTeachersTable.style.display = "none";
    }
  } else {
    // all
    if (manageStudentsTable.innerHTML.trim() === "") {
      manageStudentsTable.style.display = "none";
    } else {
      manageStudentsTable.style.display = "";
    }
    if (manageTeachersTable.innerHTML.trim() === "") {
      manageTeachersTable.style.display = "none";
    } else {
      manageTeachersTable.style.display = "";
    }
  }
}

// Attach event listeners (delegated to tbody for dynamic rows)
document.addEventListener("DOMContentLoaded", async () => {
  await refreshTables();

  // Attach listeners after tables are rendered
  manageStudentsTable.addEventListener("click", function (event) {
    if (event.target.closest("button")) {
      handleManageAction(event);
    }
  });
  manageTeachersTable.addEventListener("click", function (event) {
    if (event.target.closest("button")) {
      handleManageAction(event);
    }
  });

  setupFilters();
});