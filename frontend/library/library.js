// DOM elements
const sidebarLinks = document.querySelectorAll('.sidebar-links a');
const pages = document.querySelectorAll('.page');
const logoutBtn = document.getElementById('logout-btn');
const usernameElement = document.getElementById('username');

// Initialize Firebase objects
let auth, database;
let currentUser = null;

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
  
  // Load books on page load
  loadBooks();
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
      // User is signed in, load their role-specific data
      loadUserData(user.uid, ref, get);
    } else {
      // User is signed out, redirect to login
      window.location.href = 'login.html';
    }
  });

  // Set up event listeners
  setupEventListeners(signOut);
}

// Load user data from Firebase based on role
async function loadUserData(uid, ref, get) {
  try {
    // Check if user is a student
    const studentRef = ref(database, 'students/' + uid);
    const studentSnapshot = await get(studentRef);
    
    if (studentSnapshot.exists()) {
      const userData = studentSnapshot.val();
      
      // Check user status
      if (userData.status === 'blocked') {
        alert("Your account has been blocked. Please contact admin for assistance.");
        auth.signOut();
        return;
      }
      
      if (userData.status === 'pending') {
        alert("Your account is pending approval. Please wait for admin approval.");
        auth.signOut();
        return;
      }
      
      // Set current user data
      currentUser = {
        uid: uid,
        role: 'student',
        ...userData
      };
      
      // Display user's name in sidebar
      const displayName = userData.firstName && userData.lastName 
        ? `${userData.firstName} ${userData.lastName}`
        : userData.username || 'Student';
      
      usernameElement.textContent = displayName;
      return;
    }
    
    // Check if user is a teacher
    const teacherRef = ref(database, 'teachers/' + uid);
    const teacherSnapshot = await get(teacherRef);
    
    if (teacherSnapshot.exists()) {
      const userData = teacherSnapshot.val();
      
      // Check user status
      if (userData.status === 'blocked') {
        alert("Your account has been blocked. Please contact admin for assistance.");
        auth.signOut();
        return;
      }
      
      if (userData.status === 'pending') {
        alert("Your account is pending approval. Please wait for admin approval.");
        auth.signOut();
        return;
      }
      
      // Set current user data
      currentUser = {
        uid: uid,
        role: 'teacher',
        ...userData
      };
      
      // Display user's name in sidebar
      const displayName = userData.firstName && userData.lastName 
        ? `${userData.firstName} ${userData.lastName}`
        : userData.username || 'Teacher';
      
      usernameElement.textContent = displayName;
      return;
    }
    
    // Check static users (admin/librarian)
    const staticUsersRef = ref(database, 'staticUsers');
    const staticSnapshot = await get(staticUsersRef);
    
    if (staticSnapshot.exists()) {
      const allRoles = staticSnapshot.val();
      let foundUser = null;
      
      // Search through all roles
      for (const role in allRoles) {
        const accounts = allRoles[role];
        for (const id in accounts) {
          const account = accounts[id];
          if (id === uid || account.email === auth.currentUser?.email) {
            foundUser = {
              uid: id,
              role: account.role,
              ...account
            };
            break;
          }
        }
        if (foundUser) break;
      }
      
      if (foundUser) {
        currentUser = foundUser;
        usernameElement.textContent = foundUser.username || foundUser.role;
        return;
      }
    }
    
    // If no user data found, redirect to complete registration
    console.error('User data not found in any collection');
    alert('Please complete your registration.');
    window.location.href = 'register.html';
    
  } catch (error) {
    console.error('Error loading user data:', error);
    usernameElement.textContent = 'User';
    alert('Error loading user data. Please try logging in again.');
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
      document.getElementById(`${targetPage}-page`).classList.add('active');
      
      // If books page is selected, refresh the books
      if (targetPage === 'books') {
        loadBooks();
      }
    });
  });
  
  // Logout functionality
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      signOut(auth).then(() => {
        // Clear current user data
        currentUser = null;
        // Sign-out successful, redirect to login page
        window.location.href = 'index.html';
      }).catch((error) => {
        console.error('Error signing out:', error);
      });
    });
  }
}

// Load books from API
function loadBooks() {
  const booksContainer = document.querySelector('#books-page .books-container');
  if (!booksContainer) return;
  
  // Show loading state
  booksContainer.innerHTML = '<div class="loading-spinner">Loading books...</div>';
  
  // Base URL for the API (adjust as needed)
  const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:5000' 
    : ''; // Use relative path for production
  
  // Fetch books from API
  fetch(`${API_BASE_URL}/api/books`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to fetch books: ${response.status} ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.success && data.books) {
        displayBooks(data.books, booksContainer);
      } else {
        booksContainer.innerHTML = '<div class="no-books">No books available.</div>';
      }
    })
    .catch(error => {
      console.error('Error loading books:', error);
      booksContainer.innerHTML = `<div class="error-message">Failed to load books: ${error.message}</div>`;
    });
}

// Display books in the books container
function displayBooks(books, container) {
  // Clear any existing content
  container.innerHTML = '';
  
  if (books.length === 0) {
    container.innerHTML = '<div class="no-books">No books available.</div>';
    return;
  }
  
  // Create book cards for each book
  books.forEach(book => {
    const bookCard = document.createElement('div');
    bookCard.className = 'book-card';
    bookCard.dataset.bookId = book.id;
    
    // Default cover image if none is provided
    const coverImage = book.cover_image 
      ? book.cover_image 
      : 'assets/images/default-book-cover.png';
    
    // Status badge style based on book status
    let statusClass = 'badge-success';
    if (book.status === 'Issued') {
      statusClass = 'badge-warning';
    } else if (book.status === 'Reserved') {
      statusClass = 'badge-info';
    }
    
    bookCard.innerHTML = `
      <div class="book-cover">
        <img src="${coverImage}" alt="${book.title}" onerror="this.src='assets/images/default-book-cover.png'">
        <span class="badge ${statusClass}">${book.status}</span>
      </div>
      <div class="book-info">
        <h3 class="book-title">${book.title}</h3>
        <p class="book-author">by ${book.author}</p>
        <p class="book-category"><span class="category-label">${book.category}</span></p>
        <div class="book-actions">
          ${book.status === 'Available' ? 
            '<button class="btn btn-sm btn-primary issue-btn">Issue</button>' : 
            '<button class="btn btn-sm btn-outline reserve-btn">Reserve</button>'}
          <button class="btn btn-sm btn-outline save-btn">Save</button>
        </div>
      </div>
    `;
    
    container.appendChild(bookCard);
  });
  
  // Add event listeners to the new book cards
  addBookCardEventListeners();
  
  // Add search functionality to the books
  setupBookSearch();
  
  // Add category filter to the books
  setupCategoryFilter(books);
}

// Add event listeners to book cards
function addBookCardEventListeners() {
  // Issue button click
  document.querySelectorAll('.issue-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      // Check if user is logged in and has permission
      if (!currentUser) {
        alert('Please log in to issue books.');
        return;
      }
      
      if (currentUser.status === 'pending') {
        alert('Your account is pending approval. Please wait for admin approval.');
        return;
      }
      
      if (currentUser.status === 'blocked') {
        alert('Your account has been blocked. Please contact admin.');
        return;
      }
      
      const bookCard = e.target.closest('.book-card');
      const bookTitle = bookCard.querySelector('.book-title').textContent;
      const bookAuthor = bookCard.querySelector('.book-author').textContent;
      
      // Redirect to issue page and pre-fill form
      document.querySelector('[data-page="issue"]').click();
      setTimeout(() => {
        const issueForm = document.querySelector('#issue-page form');
        if (issueForm) {
          const titleInput = issueForm.querySelector('input[placeholder="Enter Book Title"]');
          if (titleInput) {
            titleInput.value = bookTitle;
          }
        }
      }, 100);
    });
  });
  
  // Reserve button click
  document.querySelectorAll('.reserve-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      // Check if user is logged in and has permission
      if (!currentUser) {
        alert('Please log in to reserve books.');
        return;
      }
      
      if (currentUser.status === 'pending') {
        alert('Your account is pending approval. Please wait for admin approval.');
        return;
      }
      
      if (currentUser.status === 'blocked') {
        alert('Your account has been blocked. Please contact admin.');
        return;
      }
      
      const bookCard = e.target.closest('.book-card');
      const bookTitle = bookCard.querySelector('.book-title').textContent;
      
      // Redirect to reserve page
      document.querySelector('[data-page="reserve"]').click();
      setTimeout(() => {
        const reserveForm = document.querySelector('#reserve-page form');
        if (reserveForm) {
          const titleInput = reserveForm.querySelector('input[placeholder="Enter Book Title"]');
          if (titleInput) {
            titleInput.value = bookTitle;
          }
        }
      }, 100);
    });
  });
  
  // Save button click
  document.querySelectorAll('.save-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      if (!currentUser) {
        alert('Please log in to save books.');
        return;
      }
      
      const bookCard = e.target.closest('.book-card');
      const bookTitle = bookCard.querySelector('.book-title').textContent;
      const bookAuthor = bookCard.querySelector('.book-author').textContent;
      
      // Here you could save to Firebase instead of just showing alert
      alert(`Book "${bookTitle}" by ${bookAuthor} has been saved to your collection.`);
      
      // TODO: Implement actual save functionality to Firebase
      // saveBookToCollection(currentUser.uid, bookCard.dataset.bookId);
    });
  });
  
  // Book card click for details
  document.querySelectorAll('.book-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Only trigger if the click was not on a button
      if (!e.target.closest('button')) {
        const bookId = card.dataset.bookId;
        showBookDetails(bookId);
      }
    });
  });
}

// Set up book search functionality
function setupBookSearch() {
  const searchInputs = document.querySelectorAll('.search-bar input');
  searchInputs.forEach(input => {
    input.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const parentPage = e.target.closest('.page');
      
      if (parentPage.id === 'books-page') {
        // Filter books
        const bookCards = parentPage.querySelectorAll('.book-card');
        bookCards.forEach(card => {
          const title = card.querySelector('.book-title').textContent.toLowerCase();
          const author = card.querySelector('.book-author').textContent.toLowerCase();
          
          if (title.includes(searchTerm) || author.includes(searchTerm)) {
            card.style.display = 'block';
          } else {
            card.style.display = 'none';
          }
        });
      } else if (parentPage.id === 'categories-page') {
        // Filter categories
        const categoryBoxes = parentPage.querySelectorAll('.category-box');
        categoryBoxes.forEach(box => {
          const categoryTitle = box.querySelector('.category-title').textContent.toLowerCase();
          
          if (categoryTitle.includes(searchTerm)) {
            box.style.display = 'block';
          } else {
            box.style.display = 'none';
          }
        });
      }
    });
  });
}

// Set up category filter for books
function setupCategoryFilter(books) {
  const categoryFilter = document.getElementById('categoryFilter');
  if (!categoryFilter) return;
  
  // Get unique categories from books
  const categories = [...new Set(books.map(book => book.category))];
  
  // Clear existing options
  categoryFilter.innerHTML = '<option value="">All Categories</option>';
  
  // Add category options
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });
  
  // Add filter change event
  categoryFilter.addEventListener('change', () => {
    const selectedCategory = categoryFilter.value;
    const bookCards = document.querySelectorAll('#books-page .book-card');
    
    bookCards.forEach(card => {
      const cardCategory = card.querySelector('.category-label').textContent;
      
      if (!selectedCategory || cardCategory === selectedCategory) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  });
}

// Show book details in a modal
function showBookDetails(bookId) {
  // Base URL for the API
  const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:5000' 
    : ''; // Use relative path for production
  
  // Fetch book details
  fetch(`${API_BASE_URL}/api/books/${bookId}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to fetch book details: ${response.status} ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.success && data.book) {
        displayBookDetailsModal(data.book);
      } else {
        alert('Book details not available.');
      }
    })
    .catch(error => {
      console.error('Error loading book details:', error);
      alert(`Failed to load book details: ${error.message}`);
    });
}

// Display book details in modal
function displayBookDetailsModal(book) {
  // Create modal if it doesn't exist
  let modal = document.getElementById('bookDetailsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'bookDetailsModal';
    modal.className = 'modal';
    document.body.appendChild(modal);
  }
  
  // Default cover image if none is provided
  const coverImage = book.cover_image 
    ? book.cover_image 
    : 'assets/images/default-book-cover.png';
  
  // Create the modal content
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close">&times;</span>
      <div class="book-details">
        <div class="book-details-header">
          <div class="book-cover-large">
            <img src="${coverImage}" alt="${book.title}" onerror="this.src='assets/images/default-book-cover.png'">
          </div>
          <div class="book-info-large">
            <h2>${book.title}</h2>
            <p class="author">by ${book.author}</p>
            <p class="category">${book.category}</p>
            <p class="isbn">ISBN: ${book.isbn}</p>
            <p class="status">Status: <span class="badge ${book.status === 'Available' ? 'badge-success' : 'badge-warning'}">${book.status}</span></p>
            <div class="book-actions">
              ${book.status === 'Available' ? 
                '<button class="btn btn-primary issue-modal-btn">Issue This Book</button>' : 
                '<button class="btn btn-outline reserve-modal-btn">Reserve This Book</button>'}
              <button class="btn btn-outline save-modal-btn">Save For Later</button>
            </div>
          </div>
        </div>
        <div class="book-description">
          <h3>Description</h3>
          <p>${book.description || 'No description available.'}</p>
        </div>
      </div>
    </div>
  `;
  
  // Show the modal
  modal.style.display = 'block';
  
  // Close button functionality
  const closeBtn = modal.querySelector('.close');
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  // Close when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
  
  // Issue button functionality
  const issueBtn = modal.querySelector('.issue-modal-btn');
  if (issueBtn) {
    issueBtn.addEventListener('click', () => {
      if (!currentUser) {
        alert('Please log in to issue books.');
        return;
      }
      
      if (currentUser.status === 'pending') {
        alert('Your account is pending approval. Please wait for admin approval.');
        return;
      }
      
      if (currentUser.status === 'blocked') {
        alert('Your account has been blocked. Please contact admin.');
        return;
      }
      
      modal.style.display = 'none';
      document.querySelector('[data-page="issue"]').click();
      setTimeout(() => {
        const issueForm = document.querySelector('#issue-page form');
        if (issueForm) {
          const titleInput = issueForm.querySelector('input[placeholder="Enter Book Title"]');
          if (titleInput) {
            titleInput.value = book.title;
          }
        }
      }, 100);
    });
  }
  
  // Reserve button functionality
  const reserveBtn = modal.querySelector('.reserve-modal-btn');
  if (reserveBtn) {
    reserveBtn.addEventListener('click', () => {
      if (!currentUser) {
        alert('Please log in to reserve books.');
        return;
      }
      
      if (currentUser.status === 'pending') {
        alert('Your account is pending approval. Please wait for admin approval.');
        return;
      }
      
      if (currentUser.status === 'blocked') {
        alert('Your account has been blocked. Please contact admin.');
        return;
      }
      
      modal.style.display = 'none';
      document.querySelector('[data-page="reserve"]').click();
      setTimeout(() => {
        const reserveForm = document.querySelector('#reserve-page form');
        if (reserveForm) {
          const titleInput = reserveForm.querySelector('input[placeholder="Enter Book Title"]');
          if (titleInput) {
            titleInput.value = book.title;
          }
        }
      }, 100);
    });
  }
  
  // Save button functionality
  const saveBtn = modal.querySelector('.save-modal-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      if (!currentUser) {
        alert('Please log in to save books.');
        return;
      }
      
      alert(`Book "${book.title}" by ${book.author} has been saved to your collection.`);
      // TODO: Implement actual save functionality to Firebase
    });
  }
}

// Book card action buttons (legacy support)
document.addEventListener('click', (e) => {
  if (e.target.closest('.book-actions')) {
    const button = e.target.closest('button');
    if (!button) return;
    
    const bookCard = button.closest('.book-card');
    const bookTitle = bookCard.querySelector('.book-title').textContent;
    const bookAuthor = bookCard.querySelector('.book-author').textContent;
    
    if (button.textContent.trim() === 'Issue') {
      if (!currentUser) {
        alert('Please log in to issue books.');
        return;
      }
      
      if (currentUser.status === 'pending') {
        alert('Your account is pending approval. Please wait for admin approval.');
        return;
      }
      
      if (currentUser.status === 'blocked') {
        alert('Your account has been blocked. Please contact admin.');
        return;
      }
      
      // Redirect to issue page and pre-fill form
      document.querySelector('[data-page="issue"]').click();
      setTimeout(() => {
        const issueForm = document.querySelector('#issue-page form');
        if (issueForm) {
          const titleInput = issueForm.querySelector('input[placeholder="Enter Book Title"]');
          if (titleInput) {
            titleInput.value = bookTitle;
          }
        }
      }, 100);
    } else if (button.textContent.trim() === 'Save') {
      if (!currentUser) {
        alert('Please log in to save books.');
        return;
      }
      
      // Functionality to save for later
      alert(`Book "${bookTitle}" by ${bookAuthor} has been saved to your collection.`);
      // TODO: Implement actual save functionality to Firebase
    }
  }
});

// Table action buttons
document.addEventListener('click', (e) => {
  if (e.target.closest('table')) {
    const button = e.target.closest('button');
    if (!button) return;
    
    const row = button.closest('tr');
    const bookTitle = row.cells[0].textContent;
    
    if (button.textContent.trim() === 'Return') {
      // Redirect to return page
      document.querySelector('[data-page="return"]').click();
      setTimeout(() => {
        const returnForm = document.querySelector('#return-page form');
        if (returnForm) {
          const returnInput = returnForm.querySelector('input[placeholder="Enter Book ID or ISBN"]');
          if (returnInput) {
            returnInput.focus();
          }
        }
      }, 100);
    } else if (button.textContent.trim() === 'Renew') {
      alert(`Book "${bookTitle}" has been renewed for 14 more days.`);
      // TODO: Implement actual renew functionality
    } else if (button.textContent.trim() === 'Pay Fine') {
      // Redirect to pay page
      document.querySelector('[data-page="pay"]').click();
    } else if (button.textContent.trim() === 'Remove') {
      alert(`Book "${bookTitle}" has been removed from your saved collection.`);
      row.remove();
      // TODO: Implement actual remove functionality from Firebase
    }
  }
});

// Form submissions
document.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  const formId = form.closest('.page').id;
  
  if (!currentUser) {
    alert('Please log in to perform this action.');
    return;
  }
  
  if (currentUser.status === 'pending') {
    alert('Your account is pending approval. Please wait for admin approval.');
    return;
  }
  
  if (currentUser.status === 'blocked') {
    alert('Your account has been blocked. Please contact admin.');
    return;
  }
  
  if (formId === 'issue-page') {
    alert('Book has been issued successfully!');
    form.reset();
    // TODO: Implement actual issue functionality with Firebase
  } else if (formId === 'reserve-page') {
    alert('Book has been reserved successfully!');
    form.reset();
    // TODO: Implement actual reserve functionality with Firebase
  } else if (formId === 'return-page') {
    alert('Book has been returned successfully!');
    form.reset();
    // TODO: Implement actual return functionality with Firebase
  }
});

// Pay all fines button
const payAllFinesBtn = document.querySelector('.fine-summary .btn');
if (payAllFinesBtn) {
  payAllFinesBtn.addEventListener('click', () => {
    if (!currentUser) {
      alert('Please log in to pay fines.');
      return;
    }
    
    alert('All fines have been paid successfully!');
    // Update UI to reflect paid fines
    const fineRows = document.querySelectorAll('#pay-page .table tbody tr');
    fineRows.forEach(row => {
      const statusCell = row.cells[5];
      statusCell.innerHTML = '<span class="badge badge-success">Paid</span>';
      
      const actionCell = row.cells[6];
      actionCell.innerHTML = '<button class="btn btn-sm btn-outline" disabled>Paid</button>';
    });
    
    const fineSummary = document.querySelector('.fine-summary h3');
    if (fineSummary) {
      fineSummary.textContent = 'Total Fine: $0.00';
    }
    
    // TODO: Implement actual payment functionality with Firebase
  });
}

// Helper function to save book to user's collection (TODO: implement)
async function saveBookToCollection(userId, bookId) {
  try {
    // Implementation would save to Firebase under user's saved books
    console.log(`Saving book ${bookId} for user ${userId}`);
    // const savedBooksRef = ref(database, `savedBooks/${userId}/${bookId}`);
    // await set(savedBooksRef, { savedAt: serverTimestamp(), bookId: bookId });
  } catch (error) {
    console.error('Error saving book:', error);
  }
}

// Helper function to get current user info
function getCurrentUser() {
  return currentUser;
}