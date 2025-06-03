// pending-requests.js - Handles pending borrow requests display and approval/rejection
// Manages both pending borrowers table and pending requests table with action buttons and pagination

document.addEventListener('DOMContentLoaded', () => {
    // Table elements for displaying pending data
    const pendingBorrowersTable = document.getElementById('pending-borrowers-list');
    const pendingRequestsList = document.getElementById('pending-requests-list');
    const borrowRequestsNotificationList = document.getElementById('borrow-requests-notification-list');

    // API base URL
    const API_BASE_URL = 'http://localhost:5000/api';

    // Pagination variables for pending borrowers
    let currentBorrowersPage = 1;
    const borrowersItemsPerPage = 10;
    let allPendingBorrowers = [];

    // Pagination variables for pending requests
    let currentRequestsPage = 1;
    const requestsItemsPerPage = 10;
    let allPendingRequests = [];

    // Initialize data loading
    loadPendingBorrowers();
    loadPendingRequests();

    // Load pending borrowers (for display only)
    async function loadPendingBorrowers() {
        try {
            const response = await fetch(`${API_BASE_URL}/borrow/books/pending-borrowers`);
            const data = await response.json();

            if (data.success && data.pendingBorrowers) {
                allPendingBorrowers = data.pendingBorrowers;
                currentBorrowersPage = 1; // Reset to first page
                displayPendingBorrowers();
                createBorrowersPaginationControls();
            } else {
                allPendingBorrowers = [];
                displayEmptyPendingBorrowers();
                hideBorrowersPaginationControls();
            }
        } catch (error) {
            console.error('Error loading pending borrowers:', error);
            allPendingBorrowers = [];
            displayEmptyPendingBorrowers();
            hideBorrowersPaginationControls();
            showNotification('Failed to load pending borrowers.', 'error');
        }
    }

    function displayPendingBorrowers() {
        if (!pendingBorrowersTable) return;

        if (!allPendingBorrowers || allPendingBorrowers.length === 0) {
            displayEmptyPendingBorrowers();
            return;
        }

        // Calculate pagination
        const totalPages = Math.ceil(allPendingBorrowers.length / borrowersItemsPerPage);
        const startIndex = (currentBorrowersPage - 1) * borrowersItemsPerPage;
        const endIndex = startIndex + borrowersItemsPerPage;
        const currentBorrowers = allPendingBorrowers.slice(startIndex, endIndex);

        pendingBorrowersTable.innerHTML = currentBorrowers.map(issue => `
            <tr>
                <td>${issue.title || issue.bookTitle || '-'}</td>
                <td>${issue.user_name || issue.borrower || issue.userName || '-'}</td>
                <td>${formatDate(new Date(issue.borrowDate || issue.borrow_date))}</td>
                <td>${formatDate(new Date(issue.dueDate || issue.due_date))}</td>
                <td>${issue.returnDate ? formatDate(new Date(issue.returnDate)) : '-'}</td>
                <td><span class="status-pill status-info">Pending Approval</span></td>
            </tr>
        `).join('');

        updateBorrowersPaginationInfo();
    }

    function displayEmptyPendingBorrowers() {
        if (pendingBorrowersTable) {
            pendingBorrowersTable.innerHTML = '<tr><td colspan="6" class="text-center">No pending borrowers found.</td></tr>';
        }
    }

    // Create pagination controls for pending borrowers
    function createBorrowersPaginationControls() {
        if (allPendingBorrowers.length <= borrowersItemsPerPage) {
            hideBorrowersPaginationControls();
            return;
        }

        const totalPages = Math.ceil(allPendingBorrowers.length / borrowersItemsPerPage);
        
        // Find or create pagination container
        let paginationContainer = document.getElementById('pending-borrowers-pagination');
        if (!paginationContainer) {
            paginationContainer = document.createElement('div');
            paginationContainer.id = 'pending-borrowers-pagination';
            paginationContainer.className = 'pagination-container';
            
            // Insert after the table
            const table = pendingBorrowersTable.closest('table');
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
                    <span>Showing ${(currentBorrowersPage - 1) * borrowersItemsPerPage + 1}-${Math.min(currentBorrowersPage * borrowersItemsPerPage, allPendingBorrowers.length)} of ${allPendingBorrowers.length}</span>
                </div>
                <div class="pagination-controls">
                    <button class="pagination-btn prev-btn" ${currentBorrowersPage === 1 ? 'disabled' : ''} onclick="changeBorrowersPage(${currentBorrowersPage - 1})">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <span class="page-info">Page ${currentBorrowersPage} of ${totalPages}</span>
                    <button class="pagination-btn next-btn" ${currentBorrowersPage === totalPages ? 'disabled' : ''} onclick="changeBorrowersPage(${currentBorrowersPage + 1})">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
    }

    function updateBorrowersPaginationInfo() {
        const paginationInfo = document.querySelector('#pending-borrowers-pagination .pagination-info span');
        if (paginationInfo) {
            paginationInfo.textContent = `Showing ${(currentBorrowersPage - 1) * borrowersItemsPerPage + 1}-${Math.min(currentBorrowersPage * borrowersItemsPerPage, allPendingBorrowers.length)} of ${allPendingBorrowers.length}`;
        }
        
        const pageInfo = document.querySelector('#pending-borrowers-pagination .page-info');
        if (pageInfo) {
            const totalPages = Math.ceil(allPendingBorrowers.length / borrowersItemsPerPage);
            pageInfo.textContent = `Page ${currentBorrowersPage} of ${totalPages}`;
        }
    }

    function hideBorrowersPaginationControls() {
        const paginationContainer = document.getElementById('pending-borrowers-pagination');
        if (paginationContainer) {
            paginationContainer.innerHTML = '';
        }
    }

    // Change page function for borrowers
    function changeBorrowersPage(page) {
        const totalPages = Math.ceil(allPendingBorrowers.length / borrowersItemsPerPage);
        if (page >= 1 && page <= totalPages && page !== currentBorrowersPage) {
            currentBorrowersPage = page;
            displayPendingBorrowers();
            createBorrowersPaginationControls();
        }
    }

    // Load pending requests for approval/rejection (with action buttons)
    async function loadPendingRequests() {
        try {
            const response = await fetch(`${API_BASE_URL}/borrow/books/pending-borrowers`);
            const data = await response.json();

            if (data.success && data.pendingBorrowers) {
                allPendingRequests = data.pendingBorrowers;
                currentRequestsPage = 1; // Reset to first page
                displayPendingRequests();
                displayPendingNotifications(); // Display in notification format
                createRequestsPaginationControls();
            } else {
                allPendingRequests = [];
                displayEmptyPendingRequests();
                displayEmptyPendingNotifications();
                hideRequestsPaginationControls();
            }
        } catch (error) {
            console.error('Error loading pending requests:', error);
            allPendingRequests = [];
            displayEmptyPendingRequests();
            displayEmptyPendingNotifications();
            hideRequestsPaginationControls();
            showNotification('Failed to load pending requests.', 'error');
        }
    }

    function displayPendingRequests() {
        if (!pendingRequestsList) return;

        if (!allPendingRequests || allPendingRequests.length === 0) {
            displayEmptyPendingRequests();
            return;
        }

        // Calculate pagination
        const totalPages = Math.ceil(allPendingRequests.length / requestsItemsPerPage);
        const startIndex = (currentRequestsPage - 1) * requestsItemsPerPage;
        const endIndex = startIndex + requestsItemsPerPage;
        const currentRequests = allPendingRequests.slice(startIndex, endIndex);

        pendingRequestsList.innerHTML = currentRequests.map(request => {
            const transactionId = request.transaction_id || request.id;
            const borrowDate = request.borrowDate || request.borrow_date;
            
            return `
                <tr>
                    <td style="padding: 8px; text-align: center;">${request.title || request.bookTitle || '-'}</td>
                    <td style="padding: 8px; text-align: center;">${request.user_name || request.borrower || request.userName || '-'}</td>
                    <td style="padding: 8px; text-align: center;">${formatDate(new Date(borrowDate))}</td>
                    <td style="padding: 8px; text-align: center;"><span class="status-pill status-pending">Pending</span></td>
                    <td style="padding: 8px; text-align: center;">
                        <button class="btn btn-success btn-sm" onclick="approveBorrowRequest('${transactionId}')" style="margin-right: 5px;">
                            <i class="fas fa-check"></i> Approve
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="rejectBorrowRequest('${transactionId}')">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        updateRequestsPaginationInfo();
    }

    // Display pending requests in notification format - ENHANCED VIEW BUTTON WITH EYE ICON
    function displayPendingNotifications() {
        if (!borrowRequestsNotificationList) return;

        if (!allPendingRequests || allPendingRequests.length === 0) {
            displayEmptyPendingNotifications();
            return;
        }

        // Show latest 5 requests in notification format
        const latestRequests = allPendingRequests.slice(0, 5);

        borrowRequestsNotificationList.innerHTML = latestRequests.map(request => {
            const transactionId = request.transaction_id || request.id;
            const borrowDate = request.borrowDate || request.borrow_date;
            const bookTitle = request.title || request.bookTitle || 'Unknown Book';
            const userName = request.user_name || request.borrower || request.userName || 'Unknown User';
            const timeAgo = getTimeAgo(new Date(borrowDate));
            
            return `
                <div class="notification-item">
                    <div class="notification-icon">
                        <span class="material-symbols-outlined">book</span>
                    </div>
                    <div class="notification-content">
                        <h3>New Borrow Request</h3>
                        <p><strong>${userName}</strong> requested to borrow <strong>"${bookTitle}"</strong></p>
                        <div class="notification-actions">
                            <a href="#" class="action-link primary" onclick="navigateToIssueBooks(); return false;" style="padding: 8px 16px; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; font-weight: 500;">
                                <i class="fas fa-eye"></i>
                                View Details
                            </a>
                        </div>
                    </div>
                    <div class="notification-time">
                        <span>${timeAgo}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function displayEmptyPendingRequests() {
        if (pendingRequestsList) {
            pendingRequestsList.innerHTML = '<tr><td colspan="5" style="padding: 8px; text-align: center;">No pending requests found.</td></tr>';
        }
    }

    function displayEmptyPendingNotifications() {
        if (borrowRequestsNotificationList) {
            borrowRequestsNotificationList.innerHTML = `
                <div class="notification-item" id="no-pending-requests">
                    <div class="notification-icon">
                        <span class="material-symbols-outlined">notifications_off</span>
                    </div>
                    <div class="notification-content">
                        <h3>No Pending Requests</h3>
                        <p>There are currently no pending borrow requests.</p>
                    </div>
                    <div class="notification-time">
                        <span>-</span>
                    </div>
                </div>
            `;
        }
    }

    // Navigate to Issue Books section - UPDATED TO PROPERLY HANDLE SIDEBAR
    function navigateToIssueBooks() {
        try {
            // First, remove active class from all sidebar links
            const sidebarLinks = document.querySelectorAll('.sidebar-links li a');
            sidebarLinks.forEach(link => {
                link.classList.remove('active');
            });

            // Hide all sections
            const allSections = document.querySelectorAll('.page-section');
            allSections.forEach(section => {
                section.classList.remove('active');
            });

            // Find and activate the Issue Books link in sidebar
            const issueBooksLink = document.querySelector('[data-page="issue-books"]');
            if (issueBooksLink) {
                issueBooksLink.classList.add('active');
            }

            // Show the Issue Books section
            const issueBooksSection = document.getElementById('issue-books-section');
            if (issueBooksSection) {
                issueBooksSection.classList.add('active');
                
                // Scroll to top of the section
                issueBooksSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                
                showNotification('Navigated to Issue Books section', 'success');
                return;
            }

            // Alternative method - try using data-target attribute
            const issueBooksTab = document.querySelector('[data-target="issue-books-section"]');
            if (issueBooksTab) {
                issueBooksTab.click();
                return;
            }

            // Alternative method - try href navigation
            const issueBooksHref = document.querySelector('[href="#issue-books-section"]');
            if (issueBooksHref) {
                issueBooksHref.click();
                return;
            }

            // Try using global navigation function if it exists
            if (window.showSection && typeof window.showSection === 'function') {
                window.showSection('issue-books-section');
                return;
            }

            // Fallback - set hash
            window.location.hash = '#issue-books-section';
            showNotification('Navigating to Issue Books section...', 'info');
            
        } catch (error) {
            console.error('Error navigating to Issue Books section:', error);
            showNotification('Unable to navigate to Issue Books section. Please navigate manually.', 'warning');
        }
    }

    // Create pagination controls for pending requests
    function createRequestsPaginationControls() {
        if (allPendingRequests.length <= requestsItemsPerPage) {
            hideRequestsPaginationControls();
            return;
        }

        const totalPages = Math.ceil(allPendingRequests.length / requestsItemsPerPage);
        
        // Find or create pagination container
        let paginationContainer = document.getElementById('pending-requests-pagination');
        if (!paginationContainer) {
            paginationContainer = document.createElement('div');
            paginationContainer.id = 'pending-requests-pagination';
            paginationContainer.className = 'pagination-container';
            
            // Insert after the table
            const table = pendingRequestsList.closest('table');
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
                    <span>Showing ${(currentRequestsPage - 1) * requestsItemsPerPage + 1}-${Math.min(currentRequestsPage * requestsItemsPerPage, allPendingRequests.length)} of ${allPendingRequests.length}</span>
                </div>
                <div class="pagination-controls">
                    <button class="pagination-btn prev-btn" ${currentRequestsPage === 1 ? 'disabled' : ''} onclick="changeRequestsPage(${currentRequestsPage - 1})">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <span class="page-info">Page ${currentRequestsPage} of ${totalPages}</span>
                    <button class="pagination-btn next-btn" ${currentRequestsPage === totalPages ? 'disabled' : ''} onclick="changeRequestsPage(${currentRequestsPage + 1})">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
    }

    function updateRequestsPaginationInfo() {
        const paginationInfo = document.querySelector('#pending-requests-pagination .pagination-info span');
        if (paginationInfo) {
            paginationInfo.textContent = `Showing ${(currentRequestsPage - 1) * requestsItemsPerPage + 1}-${Math.min(currentRequestsPage * requestsItemsPerPage, allPendingRequests.length)} of ${allPendingRequests.length}`;
        }
        
        const pageInfo = document.querySelector('#pending-requests-pagination .page-info');
        if (pageInfo) {
            const totalPages = Math.ceil(allPendingRequests.length / requestsItemsPerPage);
            pageInfo.textContent = `Page ${currentRequestsPage} of ${totalPages}`;
        }
    }

    function hideRequestsPaginationControls() {
        const paginationContainer = document.getElementById('pending-requests-pagination');
        if (paginationContainer) {
            paginationContainer.innerHTML = '';
        }
    }

    // Change page function for requests
    function changeRequestsPage(page) {
        const totalPages = Math.ceil(allPendingRequests.length / requestsItemsPerPage);
        if (page >= 1 && page <= totalPages && page !== currentRequestsPage) {
            currentRequestsPage = page;
            displayPendingRequests();
            createRequestsPaginationControls();
        }
    }

    // Approve borrow request
    async function approveBorrowRequest(transactionId) {
        try {
            const response = await fetch(`${API_BASE_URL}/borrow/approve/${transactionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                showNotification('Borrow request approved successfully!', 'success');
                // Refresh all tables and notifications
                loadPendingRequests();
                loadPendingBorrowers();
                
                // Trigger refresh of recently issued books if the module exists
                if (window.recentlyIssuedBooksModule) {
                    window.recentlyIssuedBooksModule.refreshRecentlyIssuedBooks();
                } else if (window.refreshRecentlyIssued) {
                    window.refreshRecentlyIssued();
                }
            } else {
                showNotification(data.message || 'Failed to approve request.', 'error');
            }
        } catch (error) {
            console.error('Error approving borrow request:', error);
            showNotification('Failed to approve request. Please try again.', 'error');
        }
    }

    // Reject borrow request
    async function rejectBorrowRequest(transactionId) {
        if (!confirm('Are you sure you want to reject this borrow request? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/borrow/reject/${transactionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                showNotification('Borrow request rejected successfully!', 'success');
                // Refresh all tables and notifications
                loadPendingRequests();
                loadPendingBorrowers();
                
                // Trigger refresh of recently issued books if the module exists
                if (window.recentlyIssuedBooksModule) {
                    window.recentlyIssuedBooksModule.refreshRecentlyIssuedBooks();
                } else if (window.refreshRecentlyIssued) {
                    window.refreshRecentlyIssued();
                }
            } else {
                showNotification(data.message || 'Failed to reject request.', 'error');
            }
        } catch (error) {
            console.error('Error rejecting borrow request:', error);
            showNotification('Failed to reject request. Please try again.', 'error');
        }
    }

    // Utility functions
    function formatDate(date) {
        if (!date || isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function getTimeAgo(date) {
        const now = new Date();
        const diffInMs = now - date;
        const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
        const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

        if (diffInMinutes < 1) {
            return 'Just now';
        } else if (diffInMinutes < 60) {
            return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
        } else if (diffInHours < 24) {
            return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
        } else {
            return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
        }
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
            <div style="display: flex; align-items: center;">
                <i class="fas ${getNotificationIcon(type)}" style="margin-right: 8px;"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close" style="background: none; border: none; color: white; cursor: pointer; font-size: 16px; margin-left: 10px;">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(notification);
        
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.remove();
        });
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    function getNotificationIcon(type) {
        switch (type) {
            case 'success': return 'fa-check-circle';
            case 'error': return 'fa-exclamation-circle';
            case 'warning': return 'fa-exclamation-triangle';
            default: return 'fa-info-circle';
        }
    }

    // Refresh functions for external calls
    function refreshPendingRequests() {
        loadPendingRequests();
        loadPendingBorrowers();
    }

    // Make functions globally available for onclick handlers
    window.approveBorrowRequest = approveBorrowRequest;
    window.rejectBorrowRequest = rejectBorrowRequest;
    window.changeBorrowersPage = changeBorrowersPage;
    window.changeRequestsPage = changeRequestsPage;
    window.navigateToIssueBooks = navigateToIssueBooks;

    // Public API for external access
    window.pendingRequestsModule = {
        loadPendingBorrowers,
        loadPendingRequests,
        refreshPendingRequests,
        approveBorrowRequest,
        rejectBorrowRequest,
        displayPendingBorrowers,
        displayPendingRequests,
        displayPendingNotifications,
        formatDate,
        getTimeAgo,
        changeBorrowersPage,
        changeRequestsPage,
        navigateToIssueBooks,
        getCurrentBorrowersPage: () => currentBorrowersPage,
        getCurrentRequestsPage: () => currentRequestsPage,
        getBorrowersItemsPerPage: () => borrowersItemsPerPage,
        getRequestsItemsPerPage: () => requestsItemsPerPage
    };

    // Global refresh function for backward compatibility
    window.refreshPendingRequests = refreshPendingRequests;
});