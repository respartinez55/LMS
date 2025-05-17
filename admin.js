import {
  getDatabase,
  ref,
  get,
  onValue
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";

const firebaseConfig = {
  apiKey: "AIzaSyAzwZfY3ypX_Dmh7EjaBsg1jjbDppnMTvs",
  authDomain: "lmsystem-c57c1.firebaseapp.com",
  databaseURL: "https://lmsystem-c57c1-default-rtdb.firebaseio.com/",
  projectId: "lmsystem-c57c1",
  storageBucket: "lmsystem-c57c1.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "1:101310858086:web:e8f6c7dfd41214ca263ea7",
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const studentsTable = document.getElementById('studentsTable');
const teachersTable = document.getElementById('teachersTable');
const totalUsersElement = document.getElementById('total-users');
const totalStudentsElement = document.getElementById('total-students');
const totalTeachersElement = document.getElementById('total-teachers');
const pendingUsersElement = document.getElementById('pending-users');

const notificationContainer = document.createElement('div');
notificationContainer.className = 'notification-container';
document.body.appendChild(notificationContainer);

let students = {};
let teachers = {};

document.addEventListener('DOMContentLoaded', () => {
  const navLinks = document.querySelectorAll('.sidebar-links a[data-page]');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.getAttribute('data-page');
      showPage(page);
    });
  });

  document.getElementById('logout-btn').addEventListener('click', (e) => {
    e.preventDefault();
    logout();
  });

  initializeData();
});

function initializeData() {
  const studentsRef = ref(database, 'students');
  onValue(studentsRef, (snapshot) => {
    if (snapshot.exists()) {
      students = snapshot.val();
      renderStudentsTable();
      updateDashboardCounts();
    } else {
      students = {};
      renderStudentsTable();
      updateDashboardCounts();
    }
  }, (error) => {
    showNotification('Failed to fetch students data', 'error');
  });

  const teachersRef = ref(database, 'teachers');
  onValue(teachersRef, (snapshot) => {
    if (snapshot.exists()) {
      teachers = snapshot.val();
      renderTeachersTable();
      updateDashboardCounts();
    } else {
      teachers = {};
      renderTeachersTable();
      updateDashboardCounts();
    }
  }, (error) => {
    showNotification('Failed to fetch teachers data', 'error');
  });

  showPage('dashboard');
}

function renderStudentsTable() {
  if (!studentsTable) return;
  studentsTable.innerHTML = '';
  if (Object.keys(students).length === 0) {
    studentsTable.innerHTML = '<tr><td colspan="7">No students found</td></tr>';
    return;
  }
  for (const uid in students) {
    const student = students[uid];
    const fullName = `${student.firstName || ''} ${student.lastName || ''}`;
    studentsTable.innerHTML += `
      <tr>
        <td>${fullName}</td>
        <td>${student.email || ''}</td>
        <td>${student.lrn || ''}</td>
        <td>${student.grade || ''}</td>
        <td>${student.section || ''}</td>
        <td><span class="status ${student.status || 'pending'}">${student.status || 'pending'}</span></td>
      </tr>
    `;
  }
}

function renderTeachersTable() {
  if (!teachersTable) return;
  teachersTable.innerHTML = '';
  if (Object.keys(teachers).length === 0) {
    teachersTable.innerHTML = '<tr><td colspan="6">No teachers found</td></tr>';
    return;
  }
  for (const uid in teachers) {
    const teacher = teachers[uid];
    const fullName = `${teacher.firstName || ''} ${teacher.lastName || ''}`;
    teachersTable.innerHTML += `
      <tr>
        <td>${fullName}</td>
        <td>${teacher.email || ''}</td>
        <td>${teacher.employeeId || ''}</td>
        <td>${teacher.department || ''}</td>
        <td><span class="status ${teacher.status || 'pending'}">${teacher.status || 'pending'}</span></td>
      </tr>
    `;
  }
}

function updateDashboardCounts() {
  const totalUsers = Object.keys(students).length + Object.keys(teachers).length;
  totalUsersElement.textContent = totalUsers;
  totalStudentsElement.textContent = Object.keys(students).length;
  totalTeachersElement.textContent = Object.keys(teachers).length;
  let pendingCount = 0;
  for (const uid in students) {
    if (students[uid].status === 'pending') {
      pendingCount++;
    }
  }
  for (const uid in teachers) {
    if (teachers[uid].status === 'pending') {
      pendingCount++;
    }
  }
  pendingUsersElement.textContent = pendingCount;
}

function showPage(pageId) {
  document.querySelectorAll('.content-section').forEach(section => {
    section.style.display = 'none';
  });
  const selectedPage = document.getElementById(pageId);
  if (selectedPage) {
    selectedPage.style.display = 'block';
  }
  document.querySelectorAll('.sidebar-links a').forEach(link => {
    link.classList.remove('active');
  });
  document.querySelector(`.sidebar-links a[data-page="${pageId}"]`).classList.add('active');
}

function logout() {
  window.location.href = 'index.html';
}

function showNotification(message, type = 'info') {
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