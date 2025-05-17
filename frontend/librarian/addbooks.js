// add-book.js - Handles add book functionality

import { API_BASE_URL, showNotification, loadDashboardData } from './dashboard.js';

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

// Get status class for styling
function getStatusClass(status) {
  switch (status.toLowerCase()) {
    case "available":
      return "status-available";
    case "issued":
      return "status-issued";
    case "reserved":
      return "status-reserved";
    default:
      return "status-available";
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

// Save/Update Book
async function saveBook(event) {
  event.preventDefault();

  const title = document.getElementById("bookTitle").value.trim();
  const author = document.getElementById("bookAuthor").value.trim();
  const category = document.getElementById("bookCategory").value.trim();
  const isbn = document.getElementById("bookISBN").value.trim();
  const description = document.getElementById("bookDescription").value.trim();
  const coverImageEl = document.getElementById("bookCover");
  const coverImage = coverImageEl?.files?.[0] || null;

  if (!title || !author || !category || !isbn) {
    showNotification("❌ Please fill in all required fields.", "error");
    return;
  }
  
  // Additional validation for category
  if (category === "add-new") {
    showNotification("❌ Please either select an existing category or add a new one.", "error");
    return;
  }

  try {
    const form = document.getElementById("addBookForm");
    const isEdit = form.getAttribute("data-mode") === "edit";
    const bookId = form.getAttribute("data-book-id");
    
    // Update button to show processing state
    const saveButton = document.getElementById("saveBookBtn");
    const saveButtonText = document.getElementById("saveButtonText");
    const saveButtonSpinner = document.getElementById("saveButtonSpinner");
    
    saveButtonText.style.display = "none";
    saveButtonSpinner.style.display = "inline-block";
    saveButton.disabled = true;

    const formData = new FormData();
    formData.append("title", title);
    formData.append("author", author);
    formData.append("category", category);
    formData.append("isbn", isbn);
    formData.append("description", description);
    
    // Only generate QR for new books
    if (!isEdit) {
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
    }
    
    if (coverImage) formData.append("bookCover", coverImage);

    const url = isEdit 
      ? `${API_BASE_URL}/api/books/${bookId}`
      : `${API_BASE_URL}/api/books`;

    console.log(`Sending ${isEdit ? 'PUT' : 'POST'} request to: ${url}`);
    
    const response = await fetch(url, {
      method: isEdit ? "PUT" : "POST",
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

    showNotification(
      isEdit 
        ? "✅ Book updated successfully!" 
        : "✅ Book added successfully with QR Code!",
      "success"
    );

    if (isEdit) {
      // Switch back to manage books view
      document.querySelector('a[data-page="manage-books"]').click();
    } else {
      resetForm();
    }
    
    loadDashboardData();
    // Reload book list if we're on the manage-books page
    if (document.getElementById("manage-books-section").classList.contains("active")) {
      // Check if loadAllBooks is defined before calling
      if (typeof loadAllBooks === 'function') {
        loadAllBooks();
      } else {
        console.warn("loadAllBooks function not found");
      }
    }
  } catch (error) {
    console.error("❌ Error saving book:", error);
    showNotification(`❌ ${error.message}`, "error");
  } finally {
    // Reset button state
    const saveButton = document.getElementById("saveBookBtn");
    const saveButtonText = document.getElementById("saveButtonText");
    const saveButtonSpinner = document.getElementById("saveButtonSpinner");
    
    if (saveButtonText) saveButtonText.style.display = "inline";
    if (saveButtonSpinner) saveButtonSpinner.style.display = "none";
    
    if (saveButtonText) {
      saveButtonText.textContent = document.getElementById("addBookForm").getAttribute("data-mode") === "edit"
        ? "Update Book"
        : "Save Book";
    }
    
    if (saveButton) saveButton.disabled = false;
  }
}

// Reset form and form state
function resetForm() {
  const form = document.getElementById("addBookForm");
  if (form) {
    form.reset();
    form.removeAttribute("data-mode");
    form.removeAttribute("data-book-id");
    
    // Reset form title
    const header = document.querySelector("#add-book-section .page-header h2");
    if (header) header.textContent = "Add New Book";
    
    // Reset button text
    const saveButtonText = document.getElementById("saveButtonText");
    if (saveButtonText) saveButtonText.textContent = "Save Book";
    
    // Remove cancel button if exists
    const cancelBtn = document.getElementById("cancelEditBtn");
    if (cancelBtn) {
      cancelBtn.remove();
    }
    
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
  }
}

// Load book for editing
async function loadBookForEditing(bookId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/books/${bookId}`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);

    // Switch to Add Book section and update form
    document.querySelectorAll(".page-section").forEach(section => {
      section.classList.remove("active");
    });
    document.getElementById("add-book-section").classList.add("active");

    // Update sidebar active state
    document.querySelectorAll(".sidebar-links li a").forEach(link => {
      link.classList.remove("active");
    });
    document.querySelector('a[data-page="add-book"]').classList.add("active");

    // Fill form with book data
    const form = document.getElementById("addBookForm");
    form.setAttribute("data-mode", "edit");
    form.setAttribute("data-book-id", bookId);

    document.getElementById("bookTitle").value = data.book.title;
    document.getElementById("bookAuthor").value = data.book.author;
    
    // First ensure categories are loaded before setting the value
    await loadCategories();
    const categoryDropdown = document.getElementById("bookCategory");
    
    // Check if the category exists in the dropdown
    let categoryExists = false;
    for (let i = 0; i < categoryDropdown.options.length; i++) {
      if (categoryDropdown.options[i].value === data.book.category) {
        categoryExists = true;
        break;
      }
    }
    
    // If the category doesn't exist in the dropdown, add it
    if (!categoryExists && data.book.category) {
      const newOption = document.createElement("option");
      newOption.value = data.book.category;
      newOption.textContent = data.book.category;
      categoryDropdown.insertBefore(newOption, categoryDropdown.querySelector('[value="add-new"]'));
    }
    
    // Now set the value
    categoryDropdown.value = data.book.category;
    
    document.getElementById("bookISBN").value = data.book.isbn;
    document.getElementById("bookDescription").value = data.book.description || "";

    // Update image preview if exists
    const previewElement = document.getElementById("bookCoverPreview");
    if (data.book.cover_image) {
      previewElement.src = `${API_BASE_URL}${data.book.cover_image}`;
      previewElement.style.display = "block";
    } else {
      previewElement.style.display = "none";
    }

    // Update form title and button
    const header = document.querySelector("#add-book-section .page-header h2");
    if (header) header.textContent = "Edit Book";
    
    const saveButtonText = document.getElementById("saveButtonText");
    if (saveButtonText) saveButtonText.textContent = "Update Book";

    // Add cancel button if not exists
    if (!document.getElementById("cancelEditBtn")) {
      const cancelBtn = document.createElement("button");
      cancelBtn.id = "cancelEditBtn";
      cancelBtn.className = "btn btn-outline";
      cancelBtn.type = "button";
      cancelBtn.textContent = "Cancel";
      cancelBtn.onclick = function() {
        // Redirect to manage books page
        document.querySelector('a[data-page="manage-books"]').click();
        // Reset the form as well
        resetForm();
      };
      
      const saveButton = document.getElementById("saveBookBtn");
      if (saveButton && saveButton.parentNode) {
        saveButton.parentNode.appendChild(cancelBtn);
      }
    }

    showNotification("✅ Book loaded for editing", "success");
  } catch (error) {
    console.error("❌ Error loading book for edit:", error);
    showNotification(`❌ ${error.message}`, "error");
  }
}

// Document ready function
document.addEventListener("DOMContentLoaded", () => {
  initAddBook();
});

// Initialize add book functionality
function initAddBook() {
  // Set up event listeners
  const addBookForm = document.getElementById("addBookForm");
  if (addBookForm) {
    // Remove any existing event listeners to avoid duplicates
    const oldForm = addBookForm.cloneNode(true);
    addBookForm.parentNode.replaceChild(oldForm, addBookForm);
    
    // Add new event listener
    oldForm.addEventListener("submit", saveBook);
  }
  
  const bookCoverInput = document.getElementById("bookCover");
  if (bookCoverInput) {
    // Remove any existing event listeners
    const oldInput = bookCoverInput.cloneNode(true);
    bookCoverInput.parentNode.replaceChild(oldInput, bookCoverInput);
    
    // Add new event listener
    oldInput.addEventListener("change", handleImagePreview);
  }
  
  // Load categories
  loadCategories();
}

// Export functions for other modules
export {
  loadCategories,
  saveBook,
  resetForm,
  loadBookForEditing,
  getStatusClass,
  formatDate,
  addCategoryToDatabase
};