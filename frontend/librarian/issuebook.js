// issuebook.js - Core book issuance functionality with E-Receipt integration
// Handles book issuance with automatic book information display and receipt generation

document.addEventListener('DOMContentLoaded', () => {
    // Get form elements
    const issueScanIDInput = document.getElementById('issueScanID') || document.getElementById('issueScanISBN');
    const borrowerTypeSelect = document.getElementById('borrowerType');
    const borrowerNameInput = document.getElementById('borrowerName');
    const lrnInput = document.getElementById('lrn') || document.getElementById('borrowerLRN');
    const gradeLevelInput = document.getElementById('gradeLevel') || document.getElementById('borrowerGrade');
    const sectionInput = document.getElementById('section') || document.getElementById('borrowerSection');
    const issueDateInput = document.getElementById('issueDate');
    const dueDateInput = document.getElementById('dueDate');
    const issueBookBtn = document.getElementById('issueBookBtn');

    // Book information display elements
    const issueBookTitle = document.getElementById('issueBookTitle');
    const issueBookAuthor = document.getElementById('issueBookAuthor');
    const issueBookID = document.getElementById('issueBookID') || document.getElementById('issueBookISBN');
    const issueBookStatus = document.getElementById('issueBookStatus');

    // Set default dates
    const today = new Date();
    const twoWeeksLater = new Date(today);
    twoWeeksLater.setDate(today.getDate() + 14); // Default loan period: 2 weeks

    if (issueDateInput) issueDateInput.valueAsDate = today;
    if (dueDateInput) dueDateInput.valueAsDate = twoWeeksLater;

    // Current data holders
    let currentBook = null;
    let currentBorrower = null;

    // API base URL
    const API_BASE_URL = 'http://localhost:5000/api';

    // Event listeners with null checks
    if (issueScanIDInput) {
        issueScanIDInput.addEventListener('input', handleBookSearch);
        issueScanIDInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleBookSearch();
            }
        });
    }

    if (borrowerTypeSelect) {
        borrowerTypeSelect.addEventListener('change', handleBorrowerTypeChange);
    }

    if (issueBookBtn) {
        issueBookBtn.addEventListener('click', issueBook);
    }

    // Handle borrower type change to show/hide relevant fields and update labels
    function handleBorrowerTypeChange() {
        const borrowerType = borrowerTypeSelect?.value;
        const studentFields = document.querySelectorAll('.student-field');
        const teacherFields = document.querySelectorAll('.teacher-field');
        
        // Get labels for dynamic updates
        const lrnLabel = document.querySelector('label[for="borrowerLRN"], label[for="lrn"]');
        const gradeLevelLabel = document.querySelector('label[for="borrowerGrade"], label[for="gradeLevel"]');

        if (borrowerType === 'student') {
            studentFields.forEach(field => field.style.display = 'block');
            teacherFields.forEach(field => field.style.display = 'block');
            
            // Update labels for students
            if (lrnLabel) lrnLabel.textContent = 'LRN (Learner Reference Number)';
            if (gradeLevelLabel) gradeLevelLabel.textContent = 'Grade Level';
            
            // Enable all fields for students
            if (lrnInput) {
                lrnInput.setAttribute('required', 'required');
                lrnInput.placeholder = 'Enter LRN';
                lrnInput.disabled = false;
            }
            if (gradeLevelInput) {
                gradeLevelInput.placeholder = 'Grade Level';
                gradeLevelInput.disabled = false;
            }
            if (sectionInput) {
                sectionInput.placeholder = 'Section';
                sectionInput.disabled = false;
            }
            
        } else if (borrowerType === 'teacher') {
            studentFields.forEach(field => field.style.display = 'block');
            teacherFields.forEach(field => field.style.display = 'block');
            
            // Update labels for teachers
            if (lrnLabel) lrnLabel.textContent = 'Employee ID';
            if (gradeLevelLabel) gradeLevelLabel.textContent = 'Department';
            
            // Configure fields for teachers
            if (lrnInput) {
                lrnInput.setAttribute('required', 'required');
                lrnInput.placeholder = 'Enter Employee ID';
                lrnInput.disabled = false;
            }
            if (gradeLevelInput) {
                gradeLevelInput.placeholder = 'Department';
                gradeLevelInput.disabled = false;
            }
            if (sectionInput) {
                sectionInput.placeholder = 'Section (Disabled for Teachers)';
                sectionInput.disabled = true;
                sectionInput.value = ''; // Clear section for teachers
                sectionInput.removeAttribute('required');
            }
            
        } else {
            // Default: hide both
            studentFields.forEach(field => field.style.display = 'none');
            teacherFields.forEach(field => field.style.display = 'none');
            
            // Reset all fields
            if (lrnInput) {
                lrnInput.removeAttribute('required');
                lrnInput.disabled = false;
            }
            if (gradeLevelInput) {
                gradeLevelInput.disabled = false;
            }
            if (sectionInput) {
                sectionInput.disabled = false;
            }
        }
    }

    // Utility function to check if a string is a number
    function isNumeric(str) {
        return !isNaN(str) && !isNaN(parseFloat(str));
    }

    // Main book search function - searches by ID, ISBN, or title
    async function handleBookSearch() {
        const searchTerm = issueScanIDInput?.value?.trim();

        if (!searchTerm || searchTerm === '') {
            clearBookInfo();
            return;
        }

        // Show loading state
        showBookLoadingState();

        try {
            let bookFound = false;
            
            // Strategy 1: If the search term is numeric, try searching by ID first
            if (isNumeric(searchTerm)) {
                try {
                    const response = await fetch(`${API_BASE_URL}/books/${encodeURIComponent(searchTerm)}`);
                    const data = await response.json();

                    if (data.success && data.book) {
                        currentBook = data.book;
                        displayBookInfo(data.book);
                        bookFound = true;
                        return;
                    }
                } catch (error) {
                    console.log('Book not found by ID, trying other methods...');
                }
            }

            // Strategy 2: Try searching by another ID attempt (in case the search term could be an ID)
            if (!bookFound) {
                try {
                    const response = await fetch(`${API_BASE_URL}/books/${encodeURIComponent(searchTerm)}`);
                    const data = await response.json();

                    if (data.success && data.book) {
                        currentBook = data.book;
                        displayBookInfo(data.book);
                        bookFound = true;
                        return;
                    }
                } catch (error) {
                    console.log('Book not found by ID, trying search...');
                }
            }

            // Strategy 3: Use general search endpoint for title, ID, and ISBN
            if (!bookFound) {
                const searchParams = new URLSearchParams();
                
                // Add all possible search parameters
                searchParams.append('title', searchTerm);
                searchParams.append('id', searchTerm);
                searchParams.append('isbn', searchTerm);

                const response = await fetch(`${API_BASE_URL}/books/search?${searchParams.toString()}`);
                const data = await response.json();

                if (data.success && data.books && data.books.length > 0) {
                    // Prioritize exact matches
                    let book = data.books.find(b => 
                        b.id.toString() === searchTerm || 
                        b.isbn === searchTerm ||
                        b.title.toLowerCase() === searchTerm.toLowerCase()
                    );
                    
                    // If no exact match, take the first result
                    if (!book) {
                        book = data.books[0];
                    }
                    
                    currentBook = book;
                    displayBookInfo(book);
                    bookFound = true;
                }
            }

            // If still not found, show not found message
            if (!bookFound) {
                clearBookInfo();
                showBookNotFoundMessage();
            }

        } catch (error) {
            console.error('Error searching for book:', error);
            clearBookInfo();
            showBookErrorMessage();
        }
    }

    // Display book information in the form
    function displayBookInfo(book) {
        if (!book) {
            clearBookInfo();
            return;
        }

        // Update book info display
        if (issueBookTitle) issueBookTitle.textContent = book.title || '-';
        if (issueBookAuthor) issueBookAuthor.textContent = book.author || '-';
        if (issueBookID) issueBookID.textContent = book.id || '-';

        // Determine and display status based on available_quantity
        const status = determineBookStatus(book);
        if (issueBookStatus) {
            issueBookStatus.textContent = status;
            issueBookStatus.className = 'status-pill';

            // Add appropriate CSS class based on status
            if (status === 'Available') {
                issueBookStatus.classList.add('status-available');
            } else {
                issueBookStatus.classList.add('status-unavailable');
            }
        }

        // Enable/disable issue button based on availability
        if (issueBookBtn) {
            issueBookBtn.disabled = status !== 'Available';
        }

        console.log('Book found and displayed:', book);
    }

    // Determine book status based on available_quantity (aligned with backend)
    function determineBookStatus(book) {
        // Check available_quantity first - this is the source of truth
        const availableQuantity = Number(book.available_quantity) || 0;
        
        if (availableQuantity > 0) {
            return 'Available';
        } else {
            return 'Not Available';
        }
    }

    // Show loading state for book info
    function showBookLoadingState() {
        if (issueBookTitle) issueBookTitle.textContent = 'Loading...';
        if (issueBookAuthor) issueBookAuthor.textContent = 'Loading...';
        if (issueBookID) issueBookID.textContent = 'Loading...';
        if (issueBookStatus) {
            issueBookStatus.textContent = 'Loading...';
            issueBookStatus.className = 'status-pill status-info';
        }
        if (issueBookBtn) issueBookBtn.disabled = true;
    }

    // Show book not found message
    function showBookNotFoundMessage() {
        if (issueBookTitle) issueBookTitle.textContent = 'Book not found';
        if (issueBookAuthor) issueBookAuthor.textContent = '-';
        if (issueBookID) issueBookID.textContent = '-';
        if (issueBookStatus) {
            issueBookStatus.textContent = 'Not Found';
            issueBookStatus.className = 'status-pill status-unavailable';
        }
        if (issueBookBtn) issueBookBtn.disabled = true;
    }

    // Show book error message
    function showBookErrorMessage() {
        if (issueBookTitle) issueBookTitle.textContent = 'Error loading book';
        if (issueBookAuthor) issueBookAuthor.textContent = '-';
        if (issueBookID) issueBookID.textContent = '-';
        if (issueBookStatus) {
            issueBookStatus.textContent = 'Error';
            issueBookStatus.className = 'status-pill status-unavailable';
        }
        if (issueBookBtn) issueBookBtn.disabled = true;
    }

    // Clear book information display
    function clearBookInfo() {
        if (issueBookTitle) issueBookTitle.textContent = '-';
        if (issueBookAuthor) issueBookAuthor.textContent = '-';
        if (issueBookID) issueBookID.textContent = '-';
        if (issueBookStatus) {
            issueBookStatus.textContent = '-';
            issueBookStatus.className = '';
        }
        if (issueBookBtn) issueBookBtn.disabled = false;
        currentBook = null;
    }

    // Create borrower object from form inputs (manual entry only)
    function createBorrowerFromInputs() {
        const borrowerName = borrowerNameInput?.value?.trim();
        const borrowerType = borrowerTypeSelect?.value;
        
        if (!borrowerName || !borrowerType) {
            return null;
        }

        currentBorrower = {
            name: borrowerName,
            borrowerType: borrowerType, // Use borrowerType to match backend
            lrn: borrowerType === 'student' ? lrnInput?.value?.trim() : null,
            employeeId: borrowerType === 'teacher' ? lrnInput?.value?.trim() : null, // Use employeeId to match backend
            gradeLevel: borrowerType === 'student' ? gradeLevelInput?.value?.trim() : null, // Use gradeLevel to match backend
            department: borrowerType === 'teacher' ? gradeLevelInput?.value?.trim() : null,
            section: borrowerType === 'student' ? sectionInput?.value?.trim() : null
        };

        return currentBorrower;
    }

    // Validate form inputs
    function validateForm() {
        // Validate book selection
        if (!currentBook) {
            alert('Please search and select a book first.');
            return false;
        }

        const bookStatus = determineBookStatus(currentBook);
        if (bookStatus !== 'Available') {
            alert('This book is not available for issuing.');
            return false;
        }

        // Validate borrower information
        const borrowerName = borrowerNameInput?.value?.trim();
        const borrowerType = borrowerTypeSelect?.value;
        const issueDate = issueDateInput?.value;
        const dueDate = dueDateInput?.value;

        if (!borrowerName) {
            alert('Please enter borrower name.');
            borrowerNameInput?.focus();
            return false;
        }

        if (!borrowerType) {
            alert('Please select borrower type.');
            borrowerTypeSelect?.focus();
            return false;
        }

        // Additional validation based on borrower type
        if (borrowerType === 'student') {
            const lrn = lrnInput?.value?.trim();
            if (!lrn) {
                alert('Please enter LRN for student.');
                lrnInput?.focus();
                return false;
            }
        } else if (borrowerType === 'teacher') {
            const employeeId = lrnInput?.value?.trim();
            if (!employeeId) {
                alert('Please enter Employee ID for teacher.');
                lrnInput?.focus();
                return false;
            }
        }

        if (!issueDate || !dueDate) {
            alert('Please set both issue date and due date.');
            return false;
        }

        // Validate dates
        const issueDateObj = new Date(issueDate);
        const dueDateObj = new Date(dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (issueDateObj < today) {
            alert('Issue date cannot be in the past.');
            issueDateInput?.focus();
            return false;
        }

        if (dueDateObj <= issueDateObj) {
            alert('Due date must be after issue date.');
            dueDateInput?.focus();
            return false;
        }

        return true;
    }

    // Generate transaction ID
    function generateTransactionId() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        
        return `IS-${year}${month}${day}${hours}${minutes}${seconds}${random}`;
    }

    // Show success message with receipt option
    function showSuccessMessage(transactionData) {
        const message = `Book issued successfully!\n\nTransaction ID: ${transactionData.transactionId}\nBook: ${transactionData.book.title}\nBorrower: ${transactionData.userName}\nDue Date: ${transactionData.dueDate}\n\nWould you like to view the digital receipt?`;
        
        const showReceipt = confirm(message);
        
        if (showReceipt && window.eReceiptModule) {
            // Show the e-receipt modal
            window.eReceiptModule.showReceiptModal(transactionData);
        }
    }

    // Prepare receipt data from transaction response
    function prepareReceiptData(responseData, borrower) {
        return {
            transactionId: responseData.transactionId || generateTransactionId(),
            borrowDate: issueDateInput?.value,
            issueDate: issueDateInput?.value,
            dueDate: dueDateInput?.value,
            book: currentBook,
            bookId: currentBook.id,
            bookTitle: currentBook.title,
            bookAuthor: currentBook.author,
            bookCover: currentBook.coverImage || currentBook.cover_image,
            userName: borrower.name,
            borrowerName: borrower.name,
            borrowerType: borrower.borrowerType,
            lrn: borrower.lrn,
            employeeId: borrower.employeeId,
            gradeLevel: borrower.gradeLevel,
            department: borrower.department,
            section: borrower.section,
            userEmail: borrower.email || null
        };
    }

    // Main issue book function with E-Receipt integration
    async function issueBook() {
        // Validate form
        if (!validateForm()) {
            return;
        }

        // Create borrower from form inputs
        const borrower = createBorrowerFromInputs();
        if (!borrower) {
            alert('Please fill in all required borrower information.');
            return;
        }

        // Create borrower identifier based on type
        const borrowerId = borrower.borrowerType === 'student' ? 
            borrower.lrn : 
            borrower.employeeId;

        // Generate transaction ID
        const transactionId = generateTransactionId();

        // Create issue request payload - ALIGNED WITH BACKEND BORROW ROUTES
        const issuePayload = {
            bookId: currentBook.id,
            userId: borrowerId,
            userName: borrower.name,
            userEmail: borrower?.email || null,
            borrowDate: issueDateInput?.value, // Use borrowDate to match backend
            dueDate: dueDateInput?.value,
            userRole: 'librarian', // Direct issue as librarian (auto-approved)
            borrowerType: borrower.borrowerType, // Match backend field name
            lrn: borrower.lrn,
            employeeId: borrower.employeeId, // Match backend field name
            gradeLevel: borrower.gradeLevel, // Match backend field name
            department: borrower.department,
            section: borrower.section,
            transactionId: transactionId
        };

        // Disable button to prevent double submission
        if (issueBookBtn) {
            issueBookBtn.disabled = true;
            issueBookBtn.textContent = 'Processing...';
        }

        try {
            // Use the direct borrow endpoint for immediate issuance
            const response = await fetch(`${API_BASE_URL}/borrow/direct`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(issuePayload)
            });

            const data = await response.json();

            if (data.success) {
                // Prepare receipt data
                const receiptData = prepareReceiptData(data, borrower);
                
                // Show success message with receipt option
                showSuccessMessage(receiptData);
                
                // Clear form
                clearForm();
                
                // Trigger refresh of other modules if they exist
                if (window.recentlyIssuedBooksModule) {
                    window.recentlyIssuedBooksModule.refreshRecentlyIssuedBooks();
                }
                if (window.pendingRequestsModule) {
                    window.pendingRequestsModule.refreshPendingRequests();
                }
            } else {
                alert(`Failed to issue book: ${data.message || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error issuing book:', error);
            alert('Error issuing book. Please try again.');
        } finally {
            // Re-enable button
            if (issueBookBtn) {
                issueBookBtn.disabled = false;
                issueBookBtn.textContent = 'Issue Book';
            }
        }
    }

    function clearForm() {
        // Clear book search
        if (issueScanIDInput) issueScanIDInput.value = '';
        
        // Clear borrower information
        if (borrowerNameInput) borrowerNameInput.value = '';
        if (lrnInput) lrnInput.value = '';
        if (gradeLevelInput) gradeLevelInput.value = '';
        if (sectionInput) sectionInput.value = '';
        if (borrowerTypeSelect) borrowerTypeSelect.value = '';
        
        // Reset dates
        if (issueDateInput) issueDateInput.valueAsDate = new Date();
        if (dueDateInput) {
            const newDueDate = new Date();
            newDueDate.setDate(newDueDate.getDate() + 14);
            dueDateInput.valueAsDate = newDueDate;
        }
        
        // Clear book info and current data
        clearBookInfo();
        currentBorrower = null;
        
        // Reset borrower type display
        handleBorrowerTypeChange();
    }

    // Initialize borrower type change handler
    handleBorrowerTypeChange();

    // Public API for external access
    window.issueBookModule = {
        handleBookSearch,
        issueBook,
        clearForm,
        determineBookStatus,
        displayBookInfo,
        clearBookInfo,
        validateForm,
        showSuccessMessage,
        prepareReceiptData
    };
});

// E-Receipt integration helper function
// This can be called from other modules as well
function showBookIssueReceipt(issueData) {
    if (window.eReceiptModule) {
        window.eReceiptModule.showReceiptModal(issueData);
    } else {
        console.warn('E-Receipt module not loaded');
        // Fallback: show basic success message
        alert(`Book issued successfully!\nTransaction ID: ${issueData.transactionId}\nPlease load the e-receipt module for digital receipt functionality.`);
    }
}