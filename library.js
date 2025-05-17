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
    } else {
      // User is signed out, redirect to login
      window.location.href = 'login.html';
    }
  });

  // Set up event listeners
  setupEventListeners(signOut);
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
        : userData.username;
      
      usernameElement.textContent = displayName;
    } else {
      console.error('User data not found');
      usernameElement.textContent = 'User';
    }
  }).catch((error) => {
    console.error('Error loading user data:', error);
    usernameElement.textContent = 'User';
  });
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
      document.getElementById(`${targetPage}-page`).classList.add('active');
    });
  });
  
  // Logout functionality
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      signOut(auth).then(() => {
        // Sign-out successful, redirect to login page
        window.location.href = 'index.html';
      }).catch((error) => {
        console.error('Error signing out:', error);
      });
    });
  }
}