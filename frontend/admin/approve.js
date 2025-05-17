import {
  getAllUsers,
  updateUserStatus,
  deleteAccount
} from "../db.js";

// Inject CSS for round action buttons and table styling
(function injectApproveCSS() {
  const style = document.createElement('style');
  style.textContent = `
    .action-btn-group {
      display: flex;
      gap: 10px;
      justify-content: flex-start;
      padding-left: 16px; /* Align with header */
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
    .approve-btn { color: #2ecc40; }
    .reject-btn { color: #e74c3c; }
    
    /* Table consistency styling */
    #pendingStudentsTable, #pendingTeachersTable {
      width: 100%;
      table-layout: fixed;
    }
    
    /* Student table specific widths */
    #pendingStudentsTable th:nth-child(1), #pendingStudentsTable td:nth-child(1) { width: 18%; } /* Name */
    #pendingStudentsTable th:nth-child(2), #pendingStudentsTable td:nth-child(2) { width: 22%; } /* Email */
    #pendingStudentsTable th:nth-child(3), #pendingStudentsTable td:nth-child(3) { width: 15%; } /* LRN */
    #pendingStudentsTable th:nth-child(4), #pendingStudentsTable td:nth-child(4) { width: 10%; } /* Grade */
    #pendingStudentsTable th:nth-child(5), #pendingStudentsTable td:nth-child(5) { width: 15%; } /* Section */
    #pendingStudentsTable th:nth-child(6), #pendingStudentsTable td:nth-child(6) { width: 20%; text-align: left; } /* Actions - left-aligned */
    
    /* Teacher table specific widths */
    #pendingTeachersTable th:nth-child(1), #pendingTeachersTable td:nth-child(1) { width: 18%; } /* Name */
    #pendingTeachersTable th:nth-child(2), #pendingTeachersTable td:nth-child(2) { width: 22%; } /* Email */
    #pendingTeachersTable th:nth-child(3), #pendingTeachersTable td:nth-child(3) { width: 20%; } /* Employee ID */
    #pendingTeachersTable th:nth-child(4), #pendingTeachersTable td:nth-child(4) { width: 20%; } /* Department */
    #pendingTeachersTable th:nth-child(5), #pendingTeachersTable td:nth-child(5) { width: 20%; text-align: left; } /* Actions - left-aligned */
    
    /* Ensure text doesn't overflow */
    #pendingStudentsTable td, #pendingTeachersTable td {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding: 8px 12px;
    }
    
    /* Left align the table header for actions column to match buttons */
    #pendingStudentsTable th:last-child, #pendingTeachersTable th:last-child {
      text-align: left;
      padding-left: 25px; /* Align with buttons */
    }
  `;
  document.head.appendChild(style);
})();

// Elements
const pendingStudentsTable = document.getElementById("pendingStudentsTable");
const pendingTeachersTable = document.getElementById("pendingTeachersTable");

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

// Button HTML with icons and round style - removed block button
function actionButtons(uid, type) {
  return `
    <div class="action-btn-group">
      <button class="approve-btn round-btn" title="Approve" data-uid="${uid}" data-type="${type}">
        <i class="fas fa-check"></i>
      </button>
      <button class="reject-btn round-btn" title="Reject" data-uid="${uid}" data-type="${type}">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;
}

// Render pending students
function renderPendingStudents(students) {
  pendingStudentsTable.innerHTML = "";
  let hasPending = false;
  for (const uid in students) {
    const student = students[uid];
    if (student.status === "pending" || student.status === "blocked") {
      hasPending = true;
      const fullName = `${student.firstName || ""} ${student.lastName || ""}`;
      pendingStudentsTable.innerHTML += `
        <tr data-uid="${uid}">
          <td>${fullName}</td>
          <td>${student.email || ""}</td>
          <td>${student.lrn || ""}</td>
          <td>${student.grade || ""}</td>
          <td>${student.section || ""}</td>
          <td>
            ${actionButtons(uid, "student")}
          </td>
        </tr>
      `;
    }
  }
  if (!hasPending) {
    pendingStudentsTable.innerHTML = `<tr><td colspan="6">No students pending approval</td></tr>`;
  }
}

// Render pending teachers
function renderPendingTeachers(teachers) {
  pendingTeachersTable.innerHTML = "";
  let hasPending = false;
  for (const uid in teachers) {
    const teacher = teachers[uid];
    if (teacher.status === "pending" || teacher.status === "blocked") {
      hasPending = true;
      const fullName = `${teacher.firstName || ""} ${teacher.lastName || ""}`;
      pendingTeachersTable.innerHTML += `
        <tr data-uid="${uid}">
          <td>${fullName}</td>
          <td>${teacher.email || ""}</td>
          <td>${teacher.employeeId || ""}</td>
          <td>${teacher.department || ""}</td>
          <td>
            ${actionButtons(uid, "teacher")}
          </td>
        </tr>
      `;
    }
  }
  if (!hasPending) {
    pendingTeachersTable.innerHTML = `<tr><td colspan="5">No teachers pending approval</td></tr>`;
  }
}

// Approve/reject handler - removed block/unblock functionality
async function handleAction(event) {
  const target = event.target.closest("button");
  if (!target) return;

  const uid = target.getAttribute("data-uid");
  const userType = target.getAttribute("data-type");

  if (target.classList.contains("approve-btn")) {
    // Approve user
    const result = await updateUserStatus(uid, userType, "active");
    if (result.success) {
      showNotification("User approved successfully", "success");
      await refreshTables();
    } else {
      showNotification("Failed to approve user: " + (result.error || ""), "error");
    }
  } else if (target.classList.contains("reject-btn")) {
    // Reject (delete) user
    if (confirm("Are you sure you want to reject this user? This action cannot be undone.")) {
      const result = await deleteAccount(uid);
      if (result.success) {
        showNotification("User rejected", "success");
        await refreshTables();
      } else {
        showNotification("Failed to reject user: " + (result.error || ""), "error");
      }
    }
  }
}

// Refresh tables
async function refreshTables() {
  const { students, teachers } = await getAllUsers();
  renderPendingStudents(students);
  renderPendingTeachers(teachers);
}

// Attach event listeners
pendingStudentsTable.addEventListener("click", handleAction);
pendingTeachersTable.addEventListener("click", handleAction);

// Initial load
document.addEventListener("DOMContentLoaded", async () => {
  await refreshTables();
});