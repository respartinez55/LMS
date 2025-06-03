import { API_BASE_URL, showNotification, loadDashboardData } from './dashboard.js';

// Global variable to store current book ID being edited
let currentEditBookId = null;

const createEditModal = () => {
  // Check if modal already exists
  if (document.getElementById('editBookModal')) {
    return;
  }

  const modalHTML = `
    <div id="editBookModal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Edit Book</h2>
          <span class="close-modal">&times;</span>
        </div>
        <div class="modal-body">
          <form id="editBookForm" enctype="multipart/form-data">
            <div class="cover-preview">
              <img id="editBookCoverPreview" style="display: none; max-width: 200px; max-height: 250px; margin: 0 auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            </div>
            
            <div class="form-group">
              <label for="editBookCover">Book Cover</label>
              <input type="file" id="editBookCover" name="cover_image" accept="image/*" class="form-input">
              <small class="file-hint">Leave empty to keep current cover</small>
            </div>
            
            <div class="form-group">
              <label for="editBookTitle">Title *</label>
              <input type="text" id="editBookTitle" name="title" class="form-input" required>
            </div>
            
            <div class="form-group">
              <label for="editBookAuthor">Author *</label>
              <input type="text" id="editBookAuthor" name="author" class="form-input" required>
            </div>
            
            <div class="form-group">
              <label for="editBookCategory">Category *</label>
              <select id="editBookCategory" name="category" class="form-input" required>
                <option value="">Select Category</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="editBookISBN">ISBN</label>
              <input type="text" id="editBookISBN" name="isbn" class="form-input">
            </div>
            
            <div class="form-group">
              <label for="editBookQuantity">Quantity</label>
              <input type="number" id="editBookQuantity" name="quantity" min="0" value="1" class="form-input">
            </div>
            
            <div class="form-group">
              <label for="editBookDescription">Description</label>
              <textarea id="editBookDescription" name="description" rows="5" class="form-input description-textarea"></textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <div class="notification-actions">
            <button type="button" id="cancelEditModal" class="btn btn-outline">
              <i class="fas fa-times"></i> Cancel
            </button>
            <button type="submit" form="editBookForm" id="updateBookBtn" class="btn btn-primary">
              <i class="fas fa-save"></i> Update Book
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Create modal element
  const modalElement = document.createElement('div');
  modalElement.innerHTML = modalHTML;
  document.body.appendChild(modalElement.firstElementChild);

  // Add styles
  if (!document.getElementById('editModalStyles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'editModalStyles';
    styleElement.textContent = `
      #editBookModal.modal {
        display: none;
        position: fixed;
        z-index: 1000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        overflow: auto;
        background-color: rgba(0, 0, 0, 0.5);
        align-items: center;
        justify-content: center;
      }
      
      #editBookModal .modal-content {
        background-color: white;
        padding: 20px;
        border: 1px solid #ddd;
        border-radius: 5px;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        width: 500px;
        max-width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        animation: modalFadeIn 0.3s;
        position: relative;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
      
      @keyframes modalFadeIn {
        from {
          opacity: 0;
          transform: translate(-50%, -60%);
        }
        to {
          opacity: 1;
          transform: translate(-50%, -50%);
        }
      }
      
      #editBookModal .modal-header {
        text-align: center;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 1px dashed #ccc;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      #editBookModal .modal-header h2 {
        margin: 0;
        font-size: 1.3rem;
        color: #333;
      }
      
      #editBookModal .modal-body {
        margin-bottom: 20px;
      }
      
      #editBookModal .cover-preview {
        text-align: center;
        margin-bottom: 20px;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 8px;
        border: 2px dashed #e0e0e0;
        transition: all 0.3s ease;
      }
      
      #editBookModal .cover-preview:hover {
        border-color: #1a73e8;
        background: #f0f4ff;
      }
      
      #editBookModal .form-group {
        margin-bottom: 15px;
      }
      
      #editBookModal .form-group label {
        display: block;
        font-weight: bold;
        color: #555;
        margin-bottom: 5px;
        font-size: 0.9rem;
      }
      
      #editBookModal .form-input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #ddd;
        border-radius: 5px;
        font-size: 14px;
        transition: all 0.2s ease;
        box-sizing: border-box;
        font-family: inherit;
        background: white;
      }
      
      #editBookModal .form-input:focus {
        outline: none;
        border-color: #1a73e8;
        box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.1);
      }
      
      #editBookModal textarea.form-input {
        resize: none;
        overflow: hidden;
        min-height: 120px;
        font-family: inherit;
      }
      
      #editBookModal .description-textarea {
        height: 120px !important;
        resize: none;
        overflow: hidden;
      }
      
      #editBookModal select.form-input {
        cursor: pointer;
      }
      
      #editBookModal .file-hint {
        color: #666;
        font-size: 0.75rem;
        margin-top: 4px;
        display: block;
        font-style: italic;
      }
      
      #editBookModal .modal-footer {
        text-align: center;
        margin-top: 20px;
        padding-top: 15px;
        border-top: 1px dashed #ccc;
      }
      
      #editBookModal .close-modal {
        font-size: 24px;
        font-weight: bold;
        cursor: pointer;
        color: #777;
        line-height: 1;
        transition: color 0.2s ease;
      }
      
      #editBookModal .close-modal:hover {
        color: #333;
      }
      
      #editBookModal .notification-actions {
        display: flex;
        gap: 1rem;
        margin-top: 0.5rem;
        justify-content: center;
        width: 100%;
      }
      
      #editBookModal .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.2s ease;
        border: none;
        font-size: 0.85rem;
        text-decoration: none;
        min-width: 130px;
        height: 40px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      #editBookModal .btn-outline {
        background-color: transparent;
        border: 1px solid #ddd;
        color: #555;
      }
      
      #editBookModal .btn-outline:hover {
        background-color: #f5f5f5;
      }
      
      #editBookModal .btn-primary {
        background-color: #1a73e8;
        color: white;
      }
      
      #editBookModal .btn-primary:hover {
        background-color: #1565c0;
      }
      
      #editBookModal .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        pointer-events: none;
      }
      
      @media (max-width: 768px) {
        #editBookModal .modal-content {
          width: 95%;
          margin: 10px;
          max-height: 95vh;
        }
        
        #editBookModal .modal-body {
          padding: 15px;
        }
        
        #editBookModal .modal-header {
          padding: 15px 15px 10px;
        }
        
        #editBookModal .modal-footer {
          padding: 10px 15px 15px;
        }
        
        #editBookModal .notification-actions {
          flex-direction: column;
          gap: 0.8rem;
        }
        
        #editBookModal .btn {
          width: 100%;
          min-width: auto;
        }
        
        #editBookModal .modal-header h2 {
          font-size: 1.2rem;
          align-items: center;
        }
        
        #editBookModal .cover-preview {
          padding: 10px;
          margin-bottom: 15px;
        }
        
        #editBookModal #editBookCoverPreview {
          max-width: 150px;
          max-height: 200px;
        }
        
        #editBookModal .description-textarea {
          height: 100px !important;
        }
      }
      
      @media print {
        body * {
          visibility: hidden;
        }
        .modal-content, .modal-content * {
          visibility: visible;
        }
        .modal-content {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          border: none;
          box-shadow: none;
        }
        .modal-header, .modal-footer {
          display: none;
        }
      }
    `;
    document.head.appendChild(styleElement);
  }

  setupEditModalListeners();
};

const setupEditModalListeners = () => {
  const closeBtn = document.querySelector('#editBookModal .close-modal');
  const cancelBtn = document.getElementById('cancelEditModal');
  const form = document.getElementById('editBookForm');
  const coverInput = document.getElementById('editBookCover');
  const coverPreview = document.getElementById('editBookCoverPreview');
  const modal = document.getElementById('editBookModal');

  // Close modal events
  if (closeBtn) {
    closeBtn.addEventListener('click', closeEditModal);
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeEditModal);
  }

  // Close modal when clicking outside
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeEditModal();
    });
  }

  // Close modal on Escape key
  const handleEscapeKey = (e) => {
    if (e.key === 'Escape' && modal && modal.style.display === 'block') {
      closeEditModal();
    }
  };
  
  // Remove existing listener if any and add new one
  document.removeEventListener('keydown', handleEscapeKey);
  document.addEventListener('keydown', handleEscapeKey);

  // Cover image preview
  if (coverInput) {
    coverInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          showNotification('Please select a valid image file', 'error');
          this.value = '';
          return;
        }
        
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          showNotification('Image file must be less than 5MB', 'error');
          this.value = '';
          return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
          if (coverPreview) {
            coverPreview.src = e.target.result;
            coverPreview.style.display = 'block';
          }
        };
        reader.readAsDataURL(file);
      } else {
        if (coverPreview) {
          coverPreview.style.display = 'none';
        }
      }
    });
  }

  // Form submission
  if (form) {
    form.addEventListener('submit', handleEditFormSubmit);
  }
};

const closeEditModal = () => {
  const modal = document.getElementById('editBookModal');
  if (modal) {
    modal.style.display = 'none';
    
    // Reset form
    const form = document.getElementById('editBookForm');
    if (form) {
      form.reset();
      const preview = document.getElementById('editBookCoverPreview');
      if (preview) {
        preview.style.display = 'none';
        preview.src = '';
      }
    }
    
    // Clear current book ID
    currentEditBookId = null;
  }
};

const loadCategoriesForEditModal = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/categories`, {
      method: "GET",
      headers: { 
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    const categoryDropdown = document.getElementById('editBookCategory');
    
    if (!categoryDropdown) {
      console.error('Category dropdown not found');
      return;
    }
    
    if (data.success && data.categories && Array.isArray(data.categories)) {
      // Clear existing options except the first one
      categoryDropdown.innerHTML = '<option value="">Select Category</option>';
      
      data.categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.name || category;
        option.textContent = category.name || category;
        categoryDropdown.appendChild(option);
      });
    } else {
      console.warn('No categories found or invalid response format');
    }
  } catch (error) {
    console.error("Error loading categories:", error);
    showNotification("Failed to load categories. Please try again.", "error");
  }
};

const fetchBookData = async (bookId) => {
  try {
    if (!bookId) {
      throw new Error('Book ID is required');
    }

    const response = await fetch(`${API_BASE_URL}/api/books/${bookId}`, {
      method: "GET",
      headers: { 
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch book data');
    }

    return data.book;
  } catch (error) {
    console.error('Error fetching book data:', error);
    showNotification(`Error loading book: ${error.message}`, 'error');
    return null;
  }
};

const populateEditForm = (book) => {
  if (!book) {
    console.error('No book data provided to populate form');
    return;
  }

  // Populate form fields
  const fields = {
    'editBookTitle': book.title || '',
    'editBookAuthor': book.author || '',
    'editBookISBN': book.isbn || '',
    'editBookQuantity': book.quantity || 1,
    'editBookDescription': book.description || ''
  };

  Object.entries(fields).forEach(([fieldId, value]) => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.value = value;
    }
  });
  
  // Set category
  const categoryDropdown = document.getElementById('editBookCategory');
  if (categoryDropdown && book.category) {
    // Check if category exists in dropdown
    let categoryExists = false;
    for (let i = 0; i < categoryDropdown.options.length; i++) {
      if (categoryDropdown.options[i].value === book.category) {
        categoryExists = true;
        break;
      }
    }
    
    // Add category if it doesn't exist
    if (!categoryExists) {
      const newOption = document.createElement("option");
      newOption.value = book.category;
      newOption.textContent = book.category;
      categoryDropdown.appendChild(newOption);
    }
    
    categoryDropdown.value = book.category;
  }
  
  // Set cover image preview
  const previewElement = document.getElementById('editBookCoverPreview');
  if (previewElement) {
    if (book.cover_image) {
      previewElement.src = book.cover_image;
      previewElement.style.display = "block";
    } else {
      previewElement.style.display = "none";
      previewElement.src = '';
    }
  }
  
  // Store book ID for form submission
  currentEditBookId = book.id;
  const form = document.getElementById('editBookForm');
  if (form) {
    form.setAttribute('data-book-id', book.id);
  }
};

const handleEditFormSubmit = async (e) => {
  e.preventDefault();
  
  const form = e.target;
  const bookId = currentEditBookId || form.getAttribute('data-book-id');
  
  if (!bookId) {
    showNotification('Error: Book ID not found', 'error');
    return;
  }
  
  const formData = new FormData(form);
  const updateBtn = document.getElementById('updateBookBtn');
  
  // Disable submit button to prevent double submission
  if (updateBtn) {
    updateBtn.disabled = true;
    updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/books/${bookId}`, {
      method: "PUT",
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      showNotification("Book updated successfully!", "success");
      closeEditModal();
      
      // Trigger custom event to notify other components
      const updateEvent = new CustomEvent('bookUpdated', { 
        detail: { 
          bookId: bookId, 
          bookData: data.book 
        },
        bubbles: true
      });
      document.dispatchEvent(updateEvent);
      
      // Refresh dashboard data if function is available
      if (typeof loadDashboardData === 'function') {
        try {
          await loadDashboardData();
        } catch (dashboardError) {
          console.warn('Error refreshing dashboard:', dashboardError);
        }
      }
    } else {
      throw new Error(data.message || "Error updating book");
    }
  } catch (error) {
    console.error("Error updating book:", error);
    showNotification(`Error updating book: ${error.message}`, "error");
  } finally {
    // Re-enable submit button
    if (updateBtn) {
      updateBtn.disabled = false;
      updateBtn.innerHTML = '<i class="fas fa-save"></i> Update Book';
    }
  }
};

const openEditModal = async (bookId) => {
  try {
    if (!bookId) {
      throw new Error('Book ID is required');
    }

    // Create modal if it doesn't exist
    createEditModal();
    
    const modal = document.getElementById('editBookModal');
    if (!modal) {
      throw new Error('Failed to create edit modal');
    }

    // Show modal
    modal.style.display = 'block';
    
    // Set loading state
    const titleField = document.getElementById('editBookTitle');
    if (titleField) {
      titleField.value = 'Loading...';
      titleField.disabled = true;
    }
    
    // Reset other fields
    const fields = ['editBookAuthor', 'editBookISBN', 'editBookDescription'];
    fields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.value = '';
        field.disabled = true;
      }
    });
    
    const quantityField = document.getElementById('editBookQuantity');
    if (quantityField) {
      quantityField.value = '1';
      quantityField.disabled = true;
    }
    
    const categoryField = document.getElementById('editBookCategory');
    if (categoryField) {
      categoryField.value = '';
      categoryField.disabled = true;
    }
    
    const coverPreview = document.getElementById('editBookCoverPreview');
    if (coverPreview) {
      coverPreview.style.display = 'none';
      coverPreview.src = '';
    }
    
    try {
      // Load categories first
      await loadCategoriesForEditModal();
      
      // Then load book data
      const bookData = await fetchBookData(bookId);
      
      if (bookData) {
        populateEditForm(bookData);
        
        // Re-enable fields
        [titleField, ...fields.map(id => document.getElementById(id)), quantityField, categoryField]
          .filter(Boolean)
          .forEach(field => {
            field.disabled = false;
          });
      } else {
        throw new Error('Failed to load book data');
      }
    } catch (error) {
      console.error('Error in openEditModal:', error);
      showNotification(`Failed to load book data: ${error.message}`, 'error');
      closeEditModal();
    }
  } catch (error) {
    console.error('Error opening edit modal:', error);
    showNotification(`Error: ${error.message}`, 'error');
  }
};

// Clean up function to remove modal and styles
const destroyEditModal = () => {
  const modal = document.getElementById('editBookModal');
  if (modal) {
    modal.remove();
  }
  
  const styles = document.getElementById('editModalStyles');
  if (styles) {
    styles.remove();
  }
  
  currentEditBookId = null;
};

// Export functions
export {
  createEditModal,
  openEditModal,
  closeEditModal,
  fetchBookData,
  populateEditForm,
  destroyEditModal,
  loadCategoriesForEditModal,
  handleEditFormSubmit
};