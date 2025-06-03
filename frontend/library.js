// DOM elements
const sidebarLinks = document.querySelectorAll('.sidebar-links a');
const pages = document.querySelectorAll('.page');
const logoutBtn = document.getElementById('logout-btn');
const usernameElement = document.getElementById('username');

// Initialize Firebase objects
let auth, database;

// Check if user is logged in
document.addEventListener('DOMContentLoaded', () => {
  // Import Firebase modules
  import("https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js").then((firebaseApp) => {
    import("https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js").then((firebaseAuth) => {
      import("https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js").then((firebaseDB) => {
        initializeApp(firebaseApp, firebaseAuth, firebaseDB);
      });
    });
  });
});

// Initialize Firebase
function initializeApp(firebaseApp, firebaseAuth, firebaseDB) {
  const { initializeApp } = firebaseApp;
  const { getAuth, onAuthStateChanged, signOut } = firebaseAuth;
  const { getDatabase, ref, get } = firebaseDB;
  
  // Firebase Config
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
  auth = getAuth(app);
  database = getDatabase(app);
  
  // Check user authentication state
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // User is signed in
      loadUserData(user.uid, ref, get);
      
      // Set up event listeners after user is confirmed to be logged in
      setupEventListeners(signOut);
      
      // Show the user's content by default (if available)
      showDefaultPage();
    } else {
      // User is signed out, redirect to login
      window.location.href = 'login.html';
    }
  });
}

// Load user data from Firebase
function loadUserData(uid, ref, get) {
  const userRef = ref(database, 'users/' + uid);
  
  get(userRef).then((snapshot) => {
    if (snapshot.exists()) {
      const userData = snapshot.val();
      
      // Display user's name in sidebar
      const displayName = userData.firstName && userData.lastName
        ? `${userData.firstName} ${userData.lastName}`
        : userData.username || 'User';
      
      // Update all user display elements
      const userDisplayElements = document.querySelectorAll('.user-display');
      userDisplayElements.forEach(element => {
        element.textContent = displayName;
      });
      
      // Update the username element specifically
      if (usernameElement) {
        usernameElement.textContent = displayName;
      }
      
      // Store user data in session storage for easy access
      sessionStorage.setItem('currentUser', JSON.stringify({
        uid: uid,
        displayName: displayName,
        email: userData.email || '',
        role: userData.role || 'student'
      }));
      
      // Update UI based on user role if needed
      if (userData.role) {
        updateUIForRole(userData.role);
      }
    } else {
      console.error('User data not found');
      if (usernameElement) {
        usernameElement.textContent = 'User';
      }
    }
  }).catch((error) => {
    console.error('Error loading user data:', error);
    if (usernameElement) {
      usernameElement.textContent = 'User';
    }
  });
}

// Update UI elements based on user role
function updateUIForRole(role) {
  // You can customize this function to show/hide elements based on user role
  document.body.setAttribute('data-user-role', role);
  
  // Example: Show/hide specific menu items based on role
  const adminElements = document.querySelectorAll('.admin-only');
  const teacherElements = document.querySelectorAll('.teacher-only');
  const studentElements = document.querySelectorAll('.student-only');
  
  adminElements.forEach(el => el.style.display = (role === 'admin') ? 'block' : 'none');
  teacherElements.forEach(el => el.style.display = (role === 'admin' || role === 'teacher') ? 'block' : 'none');
  studentElements.forEach(el => el.style.display = (role === 'student') ? 'block' : 'none');
}

// Show default page when user logs in
function showDefaultPage() {
  // Get the default page (first link in sidebar or a specific one)
  const defaultLink = document.querySelector('.sidebar-links a[data-default="true"]') || 
                      document.querySelector('.sidebar-links a');
  
  if (defaultLink) {
    // Simulate a click on the default link
    defaultLink.click();
  } else {
    // If no links found, just show the first page
    const firstPage = document.querySelector('.page');
    if (firstPage) {
      firstPage.classList.add('active');
    }
  }
}

// Set up event listeners for sidebar and logout
function setupEventListeners(signOut) {
  // Sidebar navigation
  sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetPage = link.getAttribute('data-page');
      
      // Remove active class from all links and pages
      sidebarLinks.forEach(item => item.classList.remove('active'));
      pages.forEach(page => page.classList.remove('active'));
      
      // Add active class to clicked link and corresponding page
      link.classList.add('active');
      const targetPageElement = document.getElementById(`${targetPage}-page`);
      if (targetPageElement) {
        targetPageElement.classList.add('active');
      } else {
        console.error(`Page element with ID "${targetPage}-page" not found`);
      }
    });
  });
  
  // Logout functionality
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Clear any session data
      sessionStorage.removeItem('currentUser');
      
      signOut(auth).then(() => {
        // Sign-out successful, redirect to login page
        window.location.href = 'index.html';
      }).catch((error) => {
        console.error('Error signing out:', error);
      });
    });
  }
}