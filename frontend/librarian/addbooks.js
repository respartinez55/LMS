// add-book.js - Handles add book functionality

import { API_BASE_URL, showNotification, refreshDashboardDataOnly } from './dashboard.js';

// Load categories from server and populate dropdowns
async function loadCategories() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/categories`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) throw new Error(`Failed to fetch categories: ${response.statusText}`);

    const data = await response.json();
    if (data.success) {
      const categoryDropdown = document.getElementById("bookCategory");
      const categoryFilter = document.getElementById("categoryFilter");

      // Store existing selected values before clearing
      const selectedCategory = categoryDropdown ? categoryDropdown.value : "";
      const selectedFilter = categoryFilter ? categoryFilter.value : "";

      // Clear existing options but preserve selections
      if (categoryDropdown) categoryDropdown.innerHTML = `<option value="">Select Category</option>`;
      if (categoryFilter) categoryFilter.innerHTML = `<option value="">All Categories</option>`;

      // Add fetched categories
      data.categories.forEach((category) => {
        if (categoryDropdown) {
          const option = document.createElement("option");
          option.value = category;
          option.textContent = category;
          if (selectedCategory === category) option.selected = true;
          categoryDropdown.appendChild(option);
        }

        if (categoryFilter) {
          const filterOption = document.createElement("option");
          filterOption.value = category;
          filterOption.textContent = category;
          if (selectedFilter === category) filterOption.selected = true;
          categoryFilter.appendChild(filterOption);
        }
      });

      // Add "Add New Category" option only to the main dropdown
      if (categoryDropdown) {
        const addNewOption = document.createElement("option");
        addNewOption.value = "add-new";
        addNewOption.textContent = "+ Add New Category";
        categoryDropdown.appendChild(addNewOption);
        
        // Set up event listener for category dropdown
        setupCategoryDropdownListener(categoryDropdown);
        
        // Restore selection if it was "add-new"
        if (selectedCategory === "add-new") {
          categoryDropdown.value = "add-new";
          // Show the new category input
          toggleNewCategoryInput(true);
        }
      }
    }
  } catch (error) {
    console.error("❌ Error loading categories:", error);
    showNotification(`❌ ${error.message}`, "error");
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

// Setup event listener for category dropdown
function setupCategoryDropdownListener(dropdown) {
  if (!dropdown) return;
  
  // Remove existing listener to prevent duplicates
  dropdown.removeEventListener('change', handleCategoryChange);
  
  // Add new listener
  dropdown.addEventListener('change', handleCategoryChange);
}

// Handle category dropdown change
function handleCategoryChange(event) {
  const value = event.target.value;
  if (value === 'add-new') {
    toggleNewCategoryInput(true);
  } else {
    toggleNewCategoryInput(false);
  }
}

// Toggle new category input visibility
function toggleNewCategoryInput(show) {
  // Disable the old static HTML block if it exists
  const oldInput = document.getElementById('newCategoryInput');
  if (oldInput) {
    oldInput.style.display = 'none';
  }

  // Get or create the container for the new category input
  let newCategoryContainer = document.getElementById('newCategoryContainer');

  if (!newCategoryContainer) {
    const categoryDropdown = document.getElementById('bookCategory');
    newCategoryContainer = document.createElement('div');
    newCategoryContainer.id = 'newCategoryContainer';
    newCategoryContainer.style.marginTop = '10px';
    categoryDropdown.parentNode.insertBefore(newCategoryContainer, categoryDropdown.nextSibling);
  }
  
  if (show) {
    newCategoryContainer.innerHTML = `
      <div class="flex items-center w-full" style="display: flex; flex-direction: row; align-items: center;">
        <input type="text" id="newCategoryName" class="form-control h-10 px-3 border rounded flex-grow" 
          placeholder="Enter new category name" style="flex: 1; margin-right: 10px;">
        <button type="button" id="saveNewCategory" class="btn btn-sm btn-outline h-10 flex items-center px-3"
          style="white-space: nowrap;">
          <i class="fas fa-plus mr-1"></i> Add
        </button>
      </div>
    `;
  
    document.getElementById('saveNewCategory').addEventListener('click', saveNewCategory);
  } else {
    newCategoryContainer.innerHTML = '';
  }  
}

// Save new category
async function saveNewCategory() {
  const newCategoryInput = document.getElementById('newCategoryName');
  const categoryName = newCategoryInput.value.trim();
  
  if (!categoryName) {
    showNotification('❌ Category name cannot be empty', 'error');
    return;
  }
  
  try {
    // Show processing state
    const saveButton = document.getElementById('saveNewCategory');
    const originalButtonText = saveButton.innerHTML;
    saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
    saveButton.disabled = true;
    
    const success = await addCategoryToDatabase(categoryName);
    
    if (success) {
      // After adding, reset the dropdown to the default and reload categories
      const categoryDropdown = document.getElementById('bookCategory');
      if (categoryDropdown) {
        categoryDropdown.value = '';
      }
      
      // Hide the new category input
      toggleNewCategoryInput(false);
      
      // Reload categories list
      await loadCategories();
      
      // Select the newly added category after categories reload
      if (categoryDropdown) {
        // Find the option with our new category
        for (let i = 0; i < categoryDropdown.options.length; i++) {
          if (categoryDropdown.options[i].value === categoryName) {
            categoryDropdown.selectedIndex = i;
            break;
          }
        }
      }
    } else {
      // Reset the button if failed
      saveButton.innerHTML = originalButtonText;
      saveButton.disabled = false;
    }
  } catch (error) {
    console.error("❌ Error in saveNewCategory:", error);
    showNotification(`❌ ${error.message}`, "error");
    
    // Reset the button
    const saveButton = document.getElementById('saveNewCategory');
    if (saveButton) {
      saveButton.innerHTML = '<i class="fas fa-plus mr-1"></i> Add';
      saveButton.disabled = false;
    }
  }
}

// Add new category to the database
async function addCategoryToDatabase(category) {
  try {
    // Add logging to debug request
    console.log(`Sending category to server: ${category}`);
    
    const response = await fetch(`${API_BASE_URL}/api/categories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ category }),
    });

    // Log response status to debug
    console.log(`Server response status: ${response.status}`);
    
    const contentType = response.headers.get("content-type");
    let data;
    
    // Parse response data
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      throw new Error(`Invalid response content type: ${contentType}`);
    }
    
    // Log response data for debugging
    console.log("Server response data:", data);
    
    // Handle non-OK responses
    if (!response.ok) {
      throw new Error(data.message || `Server responded with status: ${response.status}`);
    }
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to add category');
    }

    showNotification("✅ Category added successfully", "success");
    return true;
  } catch (error) {
    console.error("❌ Error adding category:", error);
    showNotification(`❌ Failed to add category: ${error.message}`, "error");
    return false;
  }
}

// Handle image preview
function handleImagePreview() {
  const fileInput = document.getElementById("bookCover");
  const previewElement = document.getElementById("bookCoverPreview");

  if (fileInput?.files?.[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      previewElement.src = e.target.result;
      previewElement.style.display = "block";
    };
    reader.readAsDataURL(fileInput.files[0]);
  } else {
    previewElement.style.display = "none";
  }
}

// QR Code Generator
async function generateQRCodeData(title, author, isbn) {
  return new Promise((resolve, reject) => {
    try {
      const qrData = JSON.stringify({ title, author, isbn });
      
      // Reference the QR code div already in the HTML
      const qrCodeElement = document.getElementById("qrCode");
      
      if (!qrCodeElement) {
        console.error("QR code element not found");
        reject(new Error("QR code element not found"));
        return;
      }
      
      // Clear any previous QR code
      qrCodeElement.innerHTML = '';

      if (typeof QRCode === "undefined") {
        console.error("QRCode library not loaded");
        reject(new Error("QRCode library not loaded"));
        return;
      }

      new QRCode(qrCodeElement, {
        text: qrData,
        width: 128,
        height: 128,
      });

      setTimeout(() => {
        const qrCanvas = qrCodeElement.querySelector("canvas");
        resolve(qrCanvas ? qrCanvas.toDataURL("image/png") : null);
      }, 500);
    } catch (error) {
      console.error("Error generating QR code:", error);
      reject(error);
    }
  });
}

// Save Book (for new books only)
async function saveBook(event) {
  event.preventDefault();

  const title = document.getElementById("bookTitle").value.trim();
  const author = document.getElementById("bookAuthor").value.trim();
  const category = document.getElementById("bookCategory").value.trim();
  const isbn = document.getElementById("bookISBN").value.trim();
  const description = document.getElementById("bookDescription").value.trim();
  const quantity = document.getElementById("bookQuantity") ? document.getElementById("bookQuantity").value.trim() : "1";
  const coverImageEl = document.getElementById("bookCover");
  const coverImage = coverImageEl?.files?.[0] || null;

  if (!title || !author || !category || !isbn || !quantity) {
    showNotification("❌ Please fill in all required fields.", "error");
    return;
  }
  
  // Additional validation for category
  if (category === "add-new") {
    showNotification("❌ Please either select an existing category or add a new one.", "error");
    return;
  }

  if (isNaN(quantity) || Number(quantity) < 1) {
    showNotification("❌ Quantity must be a positive number.", "error");
    return;
  }

  try {
    // Update button to show processing state
    const saveButton = document.getElementById("saveBookBtn");
    const saveButtonText = document.getElementById("saveButtonText");
    const saveButtonSpinner = document.getElementById("saveButtonSpinner");
    
    // Check if elements exist before modifying them
    if (saveButtonText) saveButtonText.style.display = "none";
    if (saveButtonSpinner) saveButtonSpinner.style.display = "inline-block";
    if (saveButton) saveButton.disabled = true;

    const formData = new FormData();
    formData.append("title", title);
    formData.append("author", author);
    formData.append("category", category);
    formData.append("isbn", isbn);
    formData.append("description", description);
    formData.append("quantity", quantity);
    
    // Generate QR for new books
    try {
      const qrImage = await generateQRCodeData(title, author, isbn);
      if (!qrImage) {
        console.warn("QR Code generation returned null");
      } else {
        formData.append("qrCode", qrImage);
      }
    } catch (qrError) {
      console.error("❌ QR Code generation error:", qrError);
      // Continue even if QR generation fails
    }
    
    if (coverImage) formData.append("bookCover", coverImage);

    const url = `${API_BASE_URL}/api/books`;

    console.log(`Sending POST request to: ${url}`);
    
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    const contentType = response.headers.get("content-type");
    let data;
    
    // Parse response data
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } 
    
    // Check response status first
    if (!response.ok) {
      if (data && data.message) {
        throw new Error(data.message);
      } else {
        throw new Error(`Server responded with status: ${response.status} - ${response.statusText}`);
      }
    }
    
    if (!data || !data.success) {
      throw new Error((data && data.message) || "Failed to save book");
    }

    showNotification("✅ Book added successfully with QR Code!", "success");

    // Reset the form for new book additions - stay on the same page
    resetForm();
    
    // Refresh dashboard data in the background WITHOUT navigating
    console.log("📚 Book added successfully, updating dashboard data...");
    await refreshDashboardDataOnly();
    
    // Dispatch a custom event to notify other parts of the app
    const bookAddedEvent = new CustomEvent('bookAdded', {
      detail: { title, author, category, isbn }
    });
    document.dispatchEvent(bookAddedEvent);
    
    // User stays on the add book page - no navigation
    
  } catch (error) {
    console.error("❌ Error saving book:", error);
    showNotification(`❌ ${error.message}`, "error");
  } finally {
    // Reset button state - Check if elements exist before modifying them
    const saveButton = document.getElementById("saveBookBtn");
    const saveButtonText = document.getElementById("saveButtonText");
    const saveButtonSpinner = document.getElementById("saveButtonSpinner");
    
    if (saveButtonText) {
      saveButtonText.style.display = "inline";
      saveButtonText.textContent = "Save Book";
    }
    if (saveButtonSpinner) saveButtonSpinner.style.display = "none";
    if (saveButton) saveButton.disabled = false;
  }
}

// Reset form
function resetForm() {
  const form = document.getElementById("addBookForm");
  if (form) {
    form.reset();
    
    // Reset image preview
    const previewElement = document.getElementById("bookCoverPreview");
    if (previewElement) {
      previewElement.src = "";
      previewElement.style.display = "none";
    }
    
    // Clear QR code
    const qrCodeElement = document.getElementById("qrCode");
    if (qrCodeElement) {
      qrCodeElement.innerHTML = "";
    }
    
    // Hide new category input if visible
    toggleNewCategoryInput(false);
    
    // Reset category dropdown to default option
    const categoryDropdown = document.getElementById("bookCategory");
    if (categoryDropdown) {
      categoryDropdown.value = "";
    }
    
    // Focus back to the first input for better UX
    const titleInput = document.getElementById("bookTitle");
    if (titleInput) {
      titleInput.focus();
    }
  }
}

// Ensure form has proper submit handler
function ensureFormSubmitHandler() {
  const form = document.getElementById("addBookForm");
  if (form) {
    // Remove all existing submit handlers to prevent duplicates
    form.removeEventListener("submit", saveBook);
    
    // Add the submit handler
    form.addEventListener("submit", saveBook);
  }
}

// Document ready function
document.addEventListener("DOMContentLoaded", () => {
  initAddBook();
});

// Initialize add book functionality
function initAddBook() {
  // Set up event listeners
  ensureFormSubmitHandler();
  
  const bookCoverInput = document.getElementById("bookCover");
  if (bookCoverInput) {
    // Remove any existing event listeners
    bookCoverInput.removeEventListener("change", handleImagePreview);
    
    // Add new event listener
    bookCoverInput.addEventListener("change", handleImagePreview);
  }
  
  // Load categories
  loadCategories();
}

// Export functions for other modules
export {
  loadCategories,
  saveBook,
  resetForm,
  formatDate,
  addCategoryToDatabase,
  ensureFormSubmitHandler
};