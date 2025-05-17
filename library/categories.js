// categories.js - Handles fetching and displaying categories in the Library Management System

// Make functions available globally without using export
window.categoriesModule = {};

document.addEventListener('DOMContentLoaded', function() {
  // Initialize categories module
  initCategories();
});

/**
 * Initialize the categories module functionality
 */
async function initCategories() {
  await loadCategories();
  setupCategorySearch();
  setupCategoryEventListeners();
}

/**
 * Fetch categories from the API and populate the categories grid and filter dropdown
 */
async function loadCategories() {
  try {
    const response = await fetch('http://localhost:5000/api/categories');
    
    if (!response.ok) {
      throw new Error('Failed to fetch categories');
    }
    
    const data = await response.json();
    
    if (data.success && data.categories) {
      populateCategoriesGrid(data.categories);
      populateCategoryFilter(data.categories);
      console.log('Categories loaded successfully');
    } else {
      console.error('Error in categories data format');
    }
  } catch (error) {
    console.error('Error loading categories:', error.message);
    showNotification('Error loading categories', 'error');
    
    // Fallback to static data if API fails
    const fallbackCategories = [
      'Fiction', 'Science', 'History', 'Biography', 
      'Technology', 'Travel', 'Mathematics', 'Art', 
      'Philosophy', 'Self-Help', 'Business', 'Poetry'
    ];
    populateCategoriesGrid(fallbackCategories);
    populateCategoryFilter(fallbackCategories);
  }
}

/**
 * Populate the categories grid with fetched categories
 * @param {Array} categories - Array of category objects from database
 */
function populateCategoriesGrid(categories) {
  const categoriesGrid = document.querySelector('#categories-page .grid');
  
  if (!categoriesGrid) {
    console.error('Categories grid element not found');
    return;
  }
  
  // Clear existing content
  categoriesGrid.innerHTML = '';
  
  // Define category icons mapping
  const categoryIcons = {
    'Fiction': 'psychology',
    'Science': 'science',
    'History': 'history_edu',
    'Biography': 'menu_book',
    'Technology': 'computer',
    'Travel': 'travel_explore',
    'Mathematics': 'calculate',
    'Art': 'palette',
    'Philosophy': 'lightbulb',
    'Self-Help': 'self_improvement',
    'Business': 'business',
    'Poetry': 'auto_stories',
    'Drama': 'theater_comedy',
    'Mystery': 'visibility',
    'Fantasy': 'forest',
    'Romance': 'favorite',
    'Horror': 'coronavirus',
    'Children': 'child_care'
  };
  
  // Get book counts for each category
  getBooksCountByCategory().then(categoryCounts => {
    // Create category boxes
    categories.forEach(category => {
      // Check if category is string or object
      const categoryName = typeof category === 'object' ? category.name : category;
      const categoryId = typeof category === 'object' ? category.id : null;
      const count = categoryCounts[categoryName] || 0;
      
      // Choose an icon for the category
      let icon = categoryIcons[categoryName] || 'category';
      
      // Create category box element
      const categoryBox = document.createElement('div');
      categoryBox.className = 'category-box';
      categoryBox.dataset.category = categoryName;
      if (categoryId) {
        categoryBox.dataset.categoryId = categoryId;
      }
      
      categoryBox.innerHTML = `
        <div class="category-icon">
          <span class="material-symbols-outlined">${icon}</span>
        </div>
        <h3 class="category-title">${categoryName}</h3>
        <p class="category-count">${count} Books</p>
      `;
      
      categoriesGrid.appendChild(categoryBox);
    });
  }).catch(error => {
    console.error('Error getting book counts:', error);
    
    // Create category boxes with unknown counts if counting fails
    categories.forEach(category => {
      const categoryName = typeof category === 'object' ? category.name : category;
      const categoryId = typeof category === 'object' ? category.id : null;
      
      // Choose an icon for the category
      let icon = categoryIcons[categoryName] || 'category';
      
      // Create category box element
      const categoryBox = document.createElement('div');
      categoryBox.className = 'category-box';
      categoryBox.dataset.category = categoryName;
      if (categoryId) {
        categoryBox.dataset.categoryId = categoryId;
      }
      
      categoryBox.innerHTML = `
        <div class="category-icon">
          <span class="material-symbols-outlined">${icon}</span>
        </div>
        <h3 class="category-title">${categoryName}</h3>
        <p class="category-count">0 Books</p>
      `;
      
      categoriesGrid.appendChild(categoryBox);
    });
  });
}

/**
 * Populate the category filter dropdown in the books page
 * @param {Array} categories - Array of category objects from database
 */
function populateCategoryFilter(categories) {
  const categoryFilter = document.getElementById('categoryFilter');
  
  if (!categoryFilter) {
    console.error('Category filter element not found');
    return;
  }
  
  // Keep the "All Categories" option
  categoryFilter.innerHTML = '<option value="">All Categories</option>';
  
  // Add each category as an option
  categories.forEach(category => {
    const categoryName = typeof category === 'object' ? category.name : category;
    const categoryId = typeof category === 'object' ? category.id : categoryName;
    
    const option = document.createElement('option');
    option.value = categoryId;
    option.textContent = categoryName;
    categoryFilter.appendChild(option);
  });
}

/**
 * Fetch book counts by category from the API
 * @returns {Promise<Object>} - Object mapping category names to book counts
 */
async function getBooksCountByCategory() {
  try {
    // Fetch all books to calculate category counts
    const response = await fetch('http://localhost:5000/api/books');
    
    if (!response.ok) {
      throw new Error('Failed to fetch books');
    }
    
    const data = await response.json();
    
    if (data.success && data.books) {
      // Count books by category
      const categoryCounts = {};
      
      data.books.forEach(book => {
        // Handle if book.category is an object or string
        const category = typeof book.category === 'object' ? book.category.name : book.category;
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      });
      
      return categoryCounts;
    } else {
      console.error('Error in books data format');
      return {};
    }
  } catch (error) {
    console.error('Error counting books by category:', error.message);
    
    // Generate random counts for demo purposes if API fails
    const fallbackCategories = [
      'Fiction', 'Science', 'History', 'Biography', 
      'Technology', 'Travel', 'Mathematics', 'Art', 
      'Philosophy', 'Self-Help', 'Business', 'Poetry',
      'Drama', 'Mystery', 'Fantasy', 'Romance', 'Horror', 'Children'
    ];
    
    const fallbackCounts = {};
    fallbackCategories.forEach(cat => {
      fallbackCounts[cat] = Math.floor(Math.random() * 200) + 20; // Random between 20 and 220
    });
    
    return fallbackCounts;
  }
}

/**
 * Set up search functionality for categories page
 */
function setupCategorySearch() {
  const searchInput = document.querySelector('#categories-page .search-bar input');
  
  if (!searchInput) {
    console.error('Category search input not found');
    return;
  }
  
  searchInput.addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase();
    const categoryBoxes = document.querySelectorAll('.category-box');
    
    categoryBoxes.forEach(box => {
      const categoryName = box.querySelector('.category-title').textContent.toLowerCase();
      
      if (categoryName.includes(searchTerm)) {
        box.style.display = '';
      } else {
        box.style.display = 'none';
      }
    });
  });
}

/**
 * Set up event listeners for category-related interactions
 */
function setupCategoryEventListeners() {
  // Listen for clicks on category boxes
  document.addEventListener('click', function(event) {
    const categoryBox = event.target.closest('.category-box');
    
    if (categoryBox) {
      const category = categoryBox.dataset.category;
      const categoryId = categoryBox.dataset.categoryId || category;
      
      // Navigate to books page with this category selected
      const booksLink = document.querySelector('[data-page="books"]');
      if (booksLink) {
        // Switch to books page
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        document.querySelectorAll('.sidebar-links a').forEach(link => link.classList.remove('active'));
        
        document.getElementById('books-page').classList.add('active');
        booksLink.classList.add('active');
        
        // Apply category filter
        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter) {
          categoryFilter.value = categoryId;
          
          // Explicitly filter books by the selected category
          filterBooksByCategory(categoryId);
          
          // Also trigger change event for any other event listeners
          const event = new Event('change');
          categoryFilter.dispatchEvent(event);
        }
      }
    }
  });
  
  // Listen for category filter changes
  const categoryFilter = document.getElementById('categoryFilter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', function() {
      filterBooksByCategory(this.value);
    });
  }
}

/**
 * Filter books in the books grid by category
 * @param {string} categoryId - Category ID to filter by (empty for all)
 */
function filterBooksByCategory(categoryId) {
  const bookCards = document.querySelectorAll('#books-grid .book-card');
  
  // If no books are found, try again after a short delay
  // This helps if books are still being loaded
  if (bookCards.length === 0) {
    setTimeout(() => filterBooksByCategory(categoryId), 100);
    return;
  }
  
  bookCards.forEach(card => {
    // Get category from data attribute
    const cardCategory = card.dataset.category;
    const cardCategoryId = card.dataset.categoryId || cardCategory;
    
    // Check if the card matches the selected category
    if (!categoryId || categoryId === '' || cardCategoryId === categoryId || cardCategory === categoryId) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
  
  // Update UI to show which category is active
  const activeCategoryName = categoryId ? (
    document.querySelector(`#categoryFilter option[value="${categoryId}"]`)?.textContent || categoryId
  ) : 'All Categories';
  
  const categoryHeading = document.querySelector('#books-page .section-heading');
  if (categoryHeading) {
    categoryHeading.textContent = categoryId ? `Books - ${activeCategoryName}` : 'All Books';
  }
  
  console.log(`Filtered books by category: ${activeCategoryName}`);
}

/**
 * Add a new category to the database
 * @param {Object} categoryData - Data for the new category
 * @returns {Promise<Object>} - Created category object
 */
async function addCategory(categoryData) {
  try {
    const response = await fetch('http://localhost:5000/api/categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(categoryData)
    });
    
    if (!response.ok) {
      throw new Error('Failed to add category');
    }
    
    const data = await response.json();
    
    if (data.success && data.category) {
      showNotification('Category added successfully', 'success');
      await loadCategories(); // Reload categories
      return data.category;
    } else {
      throw new Error(data.message || 'Error adding category');
    }
  } catch (error) {
    console.error('Error adding category:', error.message);
    showNotification('Error adding category: ' + error.message, 'error');
    throw error;
  }
}

/**
 * Update an existing category
 * @param {string} categoryId - ID of the category to update
 * @param {Object} categoryData - New data for the category
 * @returns {Promise<Object>} - Updated category object
 */
async function updateCategory(categoryId, categoryData) {
  try {
    const response = await fetch(`http://localhost:5000/api/categories/${categoryId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(categoryData)
    });
    
    if (!response.ok) {
      throw new Error('Failed to update category');
    }
    
    const data = await response.json();
    
    if (data.success && data.category) {
      showNotification('Category updated successfully', 'success');
      await loadCategories(); // Reload categories
      return data.category;
    } else {
      throw new Error(data.message || 'Error updating category');
    }
  } catch (error) {
    console.error('Error updating category:', error.message);
    showNotification('Error updating category: ' + error.message, 'error');
    throw error;
  }
}

/**
 * Delete a category
 * @param {string} categoryId - ID of the category to delete
 * @returns {Promise<boolean>} - Success status
 */
async function deleteCategory(categoryId) {
  try {
    const response = await fetch(`http://localhost:5000/api/categories/${categoryId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete category');
    }
    
    const data = await response.json();
    
    if (data.success) {
      showNotification('Category deleted successfully', 'success');
      await loadCategories(); // Reload categories
      return true;
    } else {
      throw new Error(data.message || 'Error deleting category');
    }
  } catch (error) {
    console.error('Error deleting category:', error.message);
    showNotification('Error deleting category: ' + error.message, 'error');
    throw error;
  }
}

/**
 * Display a notification message to the user
 * @param {string} message - Message to display
 * @param {string} type - Type of notification (success, error, warning)
 */
function showNotification(message, type = 'info') {
  // Check if notification container exists, create if not
  let notifContainer = document.querySelector('.notification-container');
  
  if (!notifContainer) {
    notifContainer = document.createElement('div');
    notifContainer.className = 'notification-container';
    document.body.appendChild(notifContainer);
  }
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <span class="notification-message">${message}</span>
    <button class="notification-close">
      <span class="material-symbols-outlined">close</span>
    </button>
  `;
  
  // Add to container
  notifContainer.appendChild(notification);
  
  // Add close button functionality
  notification.querySelector('.notification-close').addEventListener('click', () => {
    notification.remove();
  });
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 500);
  }, 5000);
}

// Make functionality available for other modules
window.categoriesModule = {
  loadCategories,
  populateCategoryFilter,
  addCategory,
  updateCategory,
  deleteCategory,
  getBooksCountByCategory
};