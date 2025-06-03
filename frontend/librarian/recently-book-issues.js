// recently-issued-books.js - Modern recently issued books display with simple pagination and view actions
// Displays non-pending borrowings with borrower type instead of status
// Updated to match database schema: only Student and Teacher borrower types
// Integrated with E-Receipt modal for viewing borrowing details
// UPDATED: Fixed book ID extraction to match API response structure
// UPDATED: Changed eye icon to "View Receipt" button to match reservation system style

document.addEventListener('DOMContentLoaded', () => {
    // Table element for displaying recently issued books
    const recentlyIssuedList = document.getElementById('recently-issued-list');
    const searchInput = document.getElementById('searchInput');

    // API base URL
    const API_BASE_URL = 'http://localhost:5000/api';

    // Pagination variables
    let currentPage = 1;
    const itemsPerPage = 10;
    let allBorrowings = [];
    let filteredBorrowings = [];

    // Initialize data loading
    loadRecentlyIssuedBooks();

    // Add search functionality
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }

    // Load recently issued books (non-pending)
    async function loadRecentlyIssuedBooks() {
        try {
            const response = await fetch(`${API_BASE_URL}/borrow/borrowings/recent`);
            const data = await response.json();

            if (data.success && data.borrowings) {
                // Filter out pending requests and normalize data
                allBorrowings = data.borrowings
                    .map(b => ({
                        ...b,
                        borrower_type: determineBorrowerType(b),
                        // Ensure book_id is properly set from the API response
                        book_id: b.book_id || b.book?.id || b.book_id_ref,
                        bookId: b.book_id || b.book?.id || b.book_id_ref
                    }))
                    .filter(b => normalizeStatus(b.status) !== 'Pending');

                filteredBorrowings = [...allBorrowings];
                currentPage = 1; // Reset to first page
                displayRecentlyIssuedBooks();
                createPaginationControls();
            } else {
                allBorrowings = [];
                filteredBorrowings = [];
                displayEmptyRecentlyIssued();
                hidePaginationControls();
            }
        } catch (error) {
            console.error('Error loading recently issued books:', error);
            allBorrowings = [];
            filteredBorrowings = [];
            displayEmptyRecentlyIssued();
            hidePaginationControls();
            showNotification('Failed to load recently issued books.', 'error');
        }
    }

    // Handle search functionality
    function handleSearch() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        
        if (searchTerm === '') {
            filteredBorrowings = [...allBorrowings];
        } else {
            filteredBorrowings = allBorrowings.filter(borrowing => {
                const title = (borrowing.title || borrowing.bookTitle || '').toLowerCase();
                const borrower = (borrowing.user_name || borrowing.borrower || borrowing.userName || '').toLowerCase();
                const borrowerType = (borrowing.borrower_type || '').toLowerCase();
                
                return title.includes(searchTerm) || 
                       borrower.includes(searchTerm) || 
                       borrowerType.includes(searchTerm);
            });
        }
        
        currentPage = 1; // Reset to first page when searching
        displayRecentlyIssuedBooks();
        createPaginationControls();
    }

    // Determine borrower type based on database schema (only Student and Teacher)
    function determineBorrowerType(borrowing) {
        // Check if borrower type is already provided
        if (borrowing.borrower_type || borrowing.borrowerType) {
            const type = (borrowing.borrower_type || borrowing.borrowerType).toLowerCase();
            // Normalize to match database schema
            if (type.includes('teacher') || type.includes('faculty') || type.includes('staff') || type.includes('employee')) {
                return 'Teacher';
            } else if (type.includes('student')) {
                return 'Student';
            }
            // Return original if it's already Student or Teacher
            const originalType = borrowing.borrower_type || borrowing.borrowerType;
            if (originalType === 'Student' || originalType === 'Teacher') {
                return originalType;
            }
        }
        
        // Check user type fields and normalize
        if (borrowing.user_type || borrowing.userType) {
            const type = (borrowing.user_type || borrowing.userType).toLowerCase();
            if (type.includes('teacher') || type.includes('faculty') || type.includes('staff') || type.includes('employee')) {
                return 'Teacher';
            } else if (type.includes('student')) {
                return 'Student';
            }
        }
        
        // Check member type fields and normalize
        if (borrowing.member_type || borrowing.memberType) {
            const type = (borrowing.member_type || borrowing.memberType).toLowerCase();
            if (type.includes('teacher') || type.includes('faculty') || type.includes('staff') || type.includes('employee')) {
                return 'Teacher';
            } else if (type.includes('student')) {
                return 'Student';
            }
        }
        
        // Check role fields and normalize
        if (borrowing.role) {
            const type = borrowing.role.toLowerCase();
            if (type.includes('teacher') || type.includes('faculty') || type.includes('staff') || type.includes('employee') || type === 'librarian') {
                return 'Teacher';
            } else if (type.includes('student')) {
                return 'Student';
            }
        }
        
        // Check if has employee_id (indicates Teacher) or lrn/grade_level (indicates Student)
        if (borrowing.employee_id || borrowing.employeeId) {
            return 'Teacher';
        }
        if (borrowing.lrn || borrowing.grade_level || borrowing.gradeLevel || borrowing.section) {
            return 'Student';
        }
        
        // Default to Student (as most library users are typically students)
        return 'Student';
    }

    // Display recently issued books with pagination
    function displayRecentlyIssuedBooks() {
        if (!recentlyIssuedList) return;

        if (!filteredBorrowings || filteredBorrowings.length === 0) {
            displayEmptyRecentlyIssued();
            return;
        }

        // Calculate pagination
        const totalPages = Math.ceil(filteredBorrowings.length / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const currentBorrowings = filteredBorrowings.slice(startIndex, endIndex);

        recentlyIssuedList.innerHTML = currentBorrowings.map(issue => {
            // Use the borrowing ID for the view receipt action
            const borrowingId = issue.id || issue.borrowId || issue.borrowing_id;
            
            return `
                <tr>
                    <td style="padding: 8px; text-align: center;">${issue.title || issue.bookTitle || '-'}</td>
                    <td style="padding: 8px; text-align: center;">${issue.user_name || issue.borrower || issue.userName || '-'}</td>
                    <td style="padding: 8px; text-align: center;"><span class="borrower-type-pill ${getBorrowerTypeClass(issue.borrower_type)}">${issue.borrower_type}</span></td>
                    <td style="padding: 8px; text-align: center;">${formatDate(new Date(issue.borrow_date || issue.borrowDate))}</td>
                    <td style="padding: 8px; text-align: center;">${formatDate(new Date(issue.due_date || issue.dueDate))}</td>
                    <td style="padding: 8px; text-align: center;">
                        <button class="btn btn-sm btn-info view-receipt-btn" 
                                onclick="viewEReceipt(${borrowingId})" 
                                title="View E-Receipt">
                            <i class="fas fa-eye"></i> View Receipt
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        updatePaginationInfo();
    }

    function displayEmptyRecentlyIssued() {
        if (recentlyIssuedList) {
            const searchTerm = searchInput ? searchInput.value.trim() : '';
            const message = searchTerm ? 'No books found matching your search criteria' : 'No recently issued books found';
            recentlyIssuedList.innerHTML = `<tr><td colspan="6" style="padding: 8px; text-align: center;">${message}</td></tr>`;
        }
    }

    // Get CSS class for borrower type (simplified for Student/Teacher only)
    function getBorrowerTypeClass(borrowerType) {
        if (!borrowerType) return 'borrower-type-student'; // Default to student
        
        const type = borrowerType.toLowerCase();
        switch (type) {
            case 'student':
                return 'borrower-type-student';
            case 'teacher':
            case 'faculty':
            case 'staff':
            case 'employee':
            case 'librarian':
                return 'borrower-type-teacher';
            default:
                // If type is exactly 'Student' or 'Teacher' (database values)
                if (borrowerType === 'Student') return 'borrower-type-student';
                if (borrowerType === 'Teacher') return 'borrower-type-teacher';
                return 'borrower-type-student'; // Default to student
        }
    }

    // Create simple, modern pagination controls
    function createPaginationControls() {
        if (filteredBorrowings.length <= itemsPerPage) {
            hidePaginationControls();
            return;
        }

        const totalPages = Math.ceil(filteredBorrowings.length / itemsPerPage);
        
        // Find or create pagination container
        let paginationContainer = document.getElementById('recently-issued-pagination');
        if (!paginationContainer) {
            paginationContainer = document.createElement('div');
            paginationContainer.id = 'recently-issued-pagination';
            paginationContainer.className = 'pagination-container';
            
            // Insert after the table
            const table = recentlyIssuedList.closest('table');
            if (table && table.parentNode) {
                table.parentNode.insertBefore(paginationContainer, table.nextSibling);
            } else {
                // Fallback: append to body or a parent container
                document.body.appendChild(paginationContainer);
            }
        }

        paginationContainer.innerHTML = `
            <div class="pagination-wrapper">
                <div class="pagination-info">
                    <span>Showing ${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredBorrowings.length)} of ${filteredBorrowings.length}</span>
                </div>
                <div class="pagination-controls">
                    <button class="pagination-btn prev-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <span class="page-info">Page ${currentPage} of ${totalPages}</span>
                    <button class="pagination-btn next-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
    }

    function updatePaginationInfo() {
        const paginationInfo = document.querySelector('.pagination-info span');
        if (paginationInfo) {
            paginationInfo.textContent = `Showing ${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredBorrowings.length)} of ${filteredBorrowings.length}`;
        }
        
        const pageInfo = document.querySelector('.page-info');
        if (pageInfo) {
            const totalPages = Math.ceil(filteredBorrowings.length / itemsPerPage);
            pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        }
    }

    function hidePaginationControls() {
        const paginationContainer = document.getElementById('recently-issued-pagination');
        if (paginationContainer) {
            paginationContainer.innerHTML = '';
        }
    }

    // Change page function
    function changePage(page) {
        const totalPages = Math.ceil(filteredBorrowings.length / itemsPerPage);
        if (page >= 1 && page <= totalPages && page !== currentPage) {
            currentPage = page;
            displayRecentlyIssuedBooks();
            createPaginationControls();
        }
    }

    // View E-Receipt function - UPDATED to properly find borrowing record
    function viewEReceipt(borrowingId) {
        console.log('viewEReceipt called with borrowingId:', borrowingId);
        
        // Find the borrowing record using multiple possible ID fields
        const borrowing = allBorrowings.find(b => {
            const matchesId = (b.id && b.id == borrowingId) || 
                             (b.borrowId && b.borrowId == borrowingId) || 
                             (b.borrowing_id && b.borrowing_id == borrowingId);
            return matchesId;
        });
        
        console.log('Found borrowing record:', borrowing);
        
        if (!borrowing) {
            console.error('Borrowing record not found for ID:', borrowingId);
            console.log('Available borrowings:', allBorrowings.map(b => ({
                id: b.id,
                borrowId: b.borrowId,
                borrowing_id: b.borrowing_id,
                title: b.title
            })));
            showNotification('Borrowing record not found.', 'error');
            return;
        }

        // Check if E-Receipt module is available
        if (typeof window.eReceiptModule === 'undefined' && typeof window.receiptModule === 'undefined') {
            showNotification('E-Receipt module is not available. Please ensure the E-Receipt script is loaded.', 'warning');
            return;
        }

        // Transform borrowing data to match E-Receipt expected format
        const receiptData = transformBorrowingToReceiptData(borrowing);
        
        console.log('Transformed receipt data:', receiptData);
        
        // Show E-Receipt modal
        const receiptModule = window.eReceiptModule || window.receiptModule;
        if (receiptModule && receiptModule.showReceiptModal) {
            try {
                receiptModule.showReceiptModal(receiptData);
            } catch (error) {
                console.error('Error showing E-Receipt modal:', error);
                showNotification('Failed to open E-Receipt. Please try again.', 'error');
            }
        } else {
            showNotification('E-Receipt functionality is not properly configured.', 'error');
        }
    }

    // Transform borrowing data to E-Receipt format - UPDATED with better book ID handling
    function transformBorrowingToReceiptData(borrowing) {
        const borrowerType = borrowing.borrower_type || determineBorrowerType(borrowing);
        
        // Get book ID with multiple fallback options - UPDATED to match API response
        const bookId = borrowing.book_id || 
                      borrowing.bookId || 
                      (borrowing.book && borrowing.book.id) || 
                      borrowing.book_id_ref ||
                      null;
        
        console.log('Book ID extraction:', {
            'borrowing.book_id': borrowing.book_id,
            'borrowing.bookId': borrowing.bookId,
            'borrowing.book?.id': borrowing.book?.id,
            'borrowing.book_id_ref': borrowing.book_id_ref,
            'final bookId': bookId
        });
        
        // Create receipt data structure matching E-Receipt expectations
        const receiptData = {
            // Transaction info
            transactionId: borrowing.transaction_id || borrowing.id || borrowing.borrowId || borrowing.borrowing_id || generateTransactionId(),
            borrowDate: borrowing.borrow_date || borrowing.borrowDate,
            issueDate: borrowing.borrow_date || borrowing.borrowDate,
            dueDate: borrowing.due_date || borrowing.dueDate,
            returnDate: borrowing.return_date || borrowing.returnDate,
            
            // Book info - includes bookId
            bookId: bookId,
            book_id: bookId, // Alternative field name
            book: {
                id: bookId,
                title: borrowing.title || borrowing.bookTitle,
                author: borrowing.author || borrowing.book_author || borrowing.bookAuthor,
                coverImage: borrowing.book_cover || borrowing.bookCover || borrowing.cover_image
            },
            bookTitle: borrowing.title || borrowing.bookTitle,
            bookAuthor: borrowing.author || borrowing.book_author || borrowing.bookAuthor,
            bookCover: borrowing.book_cover || borrowing.bookCover || borrowing.cover_image,
            
            // Borrower info
            userName: borrowing.user_name || borrowing.borrower || borrowing.userName,
            borrowerName: borrowing.user_name || borrowing.borrower || borrowing.userName,
            borrowerType: borrowerType,
            
            // ID fields based on borrower type
            lrn: borrowing.lrn || borrowing.LRN || borrowing.learner_reference_number,
            LRN: borrowing.lrn || borrowing.LRN || borrowing.learner_reference_number,
            learnerReferenceNumber: borrowing.lrn || borrowing.LRN || borrowing.learner_reference_number,
            employeeId: borrowing.employee_id || borrowing.employeeId || borrowing.staff_id,
            employeeID: borrowing.employee_id || borrowing.employeeId || borrowing.staff_id,
            staffId: borrowing.employee_id || borrowing.employeeId || borrowing.staff_id,
            staffID: borrowing.employee_id || borrowing.employeeId || borrowing.staff_id,
            idNumber: borrowing.id_number || borrowing.idNumber,
            id: borrowing.user_id || borrowing.userId,
            userId: borrowing.user_id || borrowing.userId,
            userID: borrowing.user_id || borrowing.userId,
            
            // Additional student info
            gradeLevel: borrowing.grade_level || borrowing.gradeLevel,
            section: borrowing.section,
            
            // Additional teacher info
            department: borrowing.department,
            
            // Status and notes
            status: normalizeStatus(borrowing.status) || 'Borrowed',
            notes: borrowing.notes || borrowing.comments
        };

        console.log('Final E-Receipt Data - Book ID:', receiptData.bookId);
        console.log('Full E-Receipt Data:', receiptData);

        return receiptData;
    }   

    // Generate a transaction ID if none exists
    function generateTransactionId() {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `TXN${timestamp}${random}`;
    }

    // Utility functions for status handling
    function normalizeStatus(status) {
        if (!status || status.trim() === '' || status === null || status === undefined) {
            return 'Pending';
        }
        const cleanStatus = status.toString().trim();
        switch (cleanStatus.toLowerCase()) {
            case 'borrowed': return 'Borrowed';
            case 'returned': return 'Returned';
            case 'overdue': return 'Overdue';
            case 'pending': return 'Pending';
            case 'available': return 'Available';
            case 'reserved': return 'Reserved';
            case 'unavailable': return 'Unavailable';
            default: return cleanStatus;
        }
    }

    function formatDate(date) {
        if (!date || isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function showNotification(message, type = 'info') {
        // Create notification container if it doesn't exist
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'notification-container';
            document.body.appendChild(container);
        }
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(notification);
        
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.remove();
        });
        
        // Auto-remove after 4 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 4000);
    }

    function getNotificationIcon(type) {
        switch (type) {
            case 'success': return 'fa-check-circle';
            case 'error': return 'fa-exclamation-circle';
            case 'warning': return 'fa-exclamation-triangle';
            default: return 'fa-info-circle';
        }
    }

    // Make functions globally accessible
    window.changePage = changePage;
    window.viewEReceipt = viewEReceipt;

    // Refresh function for external calls
    function refreshRecentlyIssuedBooks() {
        loadRecentlyIssuedBooks();
    }

    // Public API for external access
    window.recentlyIssuedBooksModule = {
        loadRecentlyIssuedBooks,
        refreshRecentlyIssuedBooks,
        displayRecentlyIssuedBooks,
        determineBorrowerType,
        getBorrowerTypeClass,
        formatDate,
        changePage,
        viewEReceipt,
        handleSearch,
        transformBorrowingToReceiptData,
        getCurrentPage: () => currentPage,
        getTotalPages: () => Math.ceil(filteredBorrowings.length / itemsPerPage),
        getItemsPerPage: () => itemsPerPage,
        getAllBorrowings: () => allBorrowings,
        getFilteredBorrowings: () => filteredBorrowings
    };

    // Global refresh function for backward compatibility
    window.refreshRecentlyIssued = refreshRecentlyIssuedBooks;
});