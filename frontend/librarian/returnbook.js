// returnbook.js - Return Books Management

const API_BASE_URL = "http://localhost:5000";

class ReturnBookManager {
    constructor() {
        this.init();
        this.selectedBorrowing = null;
    }

    init() {
        this.bindEvents();
        this.setDefaultReturnDate();
        this.loadBooksNearDue();
        this.loadOverdueItems(); // Add this line
    }

    bindEvents() {
        // Search functionality
        const searchInput = document.getElementById('returnTransactionSearch');
        if (searchInput) {
            // Real-time search with debounce
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchBorrowing(e.target.value.trim());
                }, 300);
            });

            // Search on Enter key
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    clearTimeout(searchTimeout);
                    this.searchBorrowing(e.target.value.trim());
                }
            });
        }

        // Return book button
        const returnBtn = document.getElementById('returnBookBtn');
        if (returnBtn) {
            returnBtn.addEventListener('click', () => this.handleReturnBook());
        }

        // Auto-detect return status based on due date
        const returnDateInput = document.getElementById('returnDate');
        if (returnDateInput) {
            returnDateInput.addEventListener('change', () => this.updateReturnStatus());
        }
    }

    setDefaultReturnDate() {
        const returnDateInput = document.getElementById('returnDate');
        if (returnDateInput) {
            const today = new Date();
            returnDateInput.value = today.toISOString().split('T')[0];
        }
    }

    async searchBorrowing(searchTerm) {
        if (!searchTerm) {
            this.clearBookInfo();
            return;
        }

        try {
            this.showLoading();
            
            // Try to find by transaction ID first, then by borrower name
            let borrowing = await this.findByTransactionId(searchTerm);
            
            if (!borrowing) {
                borrowing = await this.findByBorrowerName(searchTerm);
            }

            if (borrowing) {
                this.populateBookInfo(borrowing);
                this.selectedBorrowing = borrowing;
            } else {
                this.clearBookInfo();
                this.selectedBorrowing = null;
            }

        } catch (error) {
            console.error('Error searching borrowing:', error);
        } finally {
            this.hideLoading();
        }
    }

    async findByTransactionId(transactionId) {
        try {
            // Search in borrowed books (active borrowings)
            const response = await fetch(`${API_BASE_URL}/api/borrow/status/Borrowed`);
            const data = await response.json();
            
            if (data.success && data.borrowings) {
                return data.borrowings.find(b => 
                    b.transaction_id && b.transaction_id.toLowerCase().includes(transactionId.toLowerCase())
                );
            }
        } catch (error) {
            console.error('Error finding by transaction ID:', error);
        }
        return null;
    }

    async findByBorrowerName(borrowerName) {
        try {
            // Search in borrowed books by borrower name
            const response = await fetch(`${API_BASE_URL}/api/borrow/status/Borrowed`);
            const data = await response.json();
            
            if (data.success && data.borrowings) {
                return data.borrowings.find(b => 
                    b.user_name && b.user_name.toLowerCase().includes(borrowerName.toLowerCase())
                );
            }
        } catch (error) {
            console.error('Error finding by borrower name:', error);
        }
        return null;
    }

    populateBookInfo(borrowing) {
        const bookInfo = document.getElementById('returnBookInfo');
        if (bookInfo) {
            bookInfo.style.display = 'block';
        }

        // Populate book details
        this.updateElement('returnBookTitle', borrowing.book?.title || borrowing.title || 'N/A');
        this.updateElement('returnBookBorrower', borrowing.user_name || 'N/A');
        this.updateElement('returnBookIssueDate', this.formatDate(borrowing.borrowDate || borrowing.borrow_date));
        this.updateElement('returnBookDueDate', this.formatDate(borrowing.dueDate || borrowing.due_date));

        // Auto-detect return status
        this.updateReturnStatus();
    }

    updateElement(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    updateReturnStatus() {
        if (!this.selectedBorrowing) return;

        const returnDate = document.getElementById('returnDate')?.value;
        const returnStatusSelect = document.getElementById('returnStatus');
        
        if (returnDate && returnStatusSelect && this.selectedBorrowing.dueDate) {
            const dueDate = new Date(this.selectedBorrowing.dueDate || this.selectedBorrowing.due_date);
            const returnDateObj = new Date(returnDate);
            
            if (returnDateObj > dueDate) {
                returnStatusSelect.value = 'Overdue';
            } else {
                returnStatusSelect.value = 'On Time';
            }
        }
    }

    async handleReturnBook() {
        if (!this.selectedBorrowing) {
            console.log('Please search and select a borrowing record first');
            return;
        }

        const returnDate = document.getElementById('returnDate')?.value;
        const bookCondition = document.getElementById('bookCondition')?.value;
        const returnStatus = document.getElementById('returnStatus')?.value;

        if (!returnDate) {
            console.log('Please select a return date');
            return;
        }

        try {
            this.showLoading('Processing return...');

            const response = await fetch(`${API_BASE_URL}/api/borrow/return/${this.selectedBorrowing.transaction_id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    returnDate: returnDate,
                    condition: bookCondition,
                    returnStatus: returnStatus
                })
            });

            const result = await response.json();

            if (result.success) {
                console.log('Book returned successfully!');
                this.clearForm();
                this.loadBooksNearDue(); // Refresh the table
                this.loadOverdueItems(); // Refresh overdue items
            } else {
                console.error(result.message || 'Failed to return book');
            }

        } catch (error) {
            console.error('Error returning book:', error);
        } finally {
            this.hideLoading();
        }
    }

    async loadBooksNearDue() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/borrow/status/Borrowed`);
            const data = await response.json();

            if (data.success && data.borrowings) {
                const booksNearDue = this.filterBooksNearDue(data.borrowings);
                this.renderBooksNearDue(booksNearDue);
            } else {
                this.renderNoBooksFound();
            }
        } catch (error) {
            console.error('Error loading books near due:', error);
            this.renderError();
        }
    }

    // NEW METHOD: Load overdue items
    async loadOverdueItems() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/borrow/status/Borrowed`);
            const data = await response.json();

            if (data.success && data.borrowings) {
                const overdueItems = this.filterOverdueItems(data.borrowings);
                this.renderOverdueItems(overdueItems);
            } else {
                this.hideOverdueSection();
            }
        } catch (error) {
            console.error('Error loading overdue items:', error);
            this.hideOverdueSection();
        }
    }

    // NEW METHOD: Filter overdue items
    filterOverdueItems(borrowings) {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time to start of day for accurate comparison

        return borrowings.filter(borrowing => {
            const dueDate = new Date(borrowing.dueDate || borrowing.due_date);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate < today;
        }).sort((a, b) => {
            const dateA = new Date(a.dueDate || a.due_date);
            const dateB = new Date(b.dueDate || b.due_date);
            return dateA - dateB; // Sort by oldest overdue first
        });
    }

    // NEW METHOD: Render overdue items
    renderOverdueItems(overdueItems) {
        const overdueList = document.getElementById('overdue-notifications-list');
        const overdueCard = overdueList?.closest('.card');
        
        if (!overdueList) return;

        if (overdueItems.length === 0) {
            this.hideOverdueSection();
            return;
        }

        // Show the overdue section
        if (overdueCard) {
            overdueCard.style.display = 'block';
        }

        overdueList.innerHTML = overdueItems.map(item => {
            const dueDate = new Date(item.dueDate || item.due_date);
            const today = new Date();
            const daysOverdue = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
            
            return `
                <div class="notification-item overdue-item">
                    <div class="notification-icon">
                        <i class="fas fa-exclamation-triangle text-danger"></i>
                    </div>
                    <div class="notification-content">
                        <div class="notification-title">
                            <strong>${item.book?.title || item.title || 'N/A'}</strong>
                        </div>
                        <div class="notification-details">
                            <div class="borrower-info">
                                <i class="fas fa-user"></i>
                                <span>${item.user_name || 'N/A'}</span>
                                ${item.lrn ? `<small>(LRN: ${item.lrn})</small>` : ''}
                                ${item.employee_id ? `<small>(ID: ${item.employee_id})</small>` : ''}
                            </div>
                            <div class="overdue-info">
                                <i class="fas fa-calendar-times"></i>
                                <span>Due: ${this.formatDate(item.dueDate || item.due_date)}</span>
                                <span class="overdue-badge">${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue</span>
                            </div>
                        </div>
                    </div>
                    <div class="notification-actions">
                        <button class="btn btn-sm btn-outline-primary" 
                                onclick="returnBookManager.selectBorrowingForReturn('${item.transaction_id}')"
                                title="Process Return">
                            <i class="fas fa-undo-alt"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // NEW METHOD: Hide overdue section
    hideOverdueSection() {
        const overdueList = document.getElementById('overdue-notifications-list');
        const overdueCard = overdueList?.closest('.card');
        
        if (overdueCard) {
            overdueCard.style.display = 'none';
        }
    }

    filterBooksNearDue(borrowings) {
        const today = new Date();
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(today.getDate() + 3);

        return borrowings.filter(borrowing => {
            const dueDate = new Date(borrowing.dueDate || borrowing.due_date);
            return dueDate <= threeDaysFromNow && dueDate >= today;
        }).sort((a, b) => {
            const dateA = new Date(a.dueDate || a.due_date);
            const dateB = new Date(b.dueDate || b.due_date);
            return dateA - dateB;
        });
    }

    renderBooksNearDue(books) {
        const tbody = document.getElementById('due-books-list');
        if (!tbody) return;

        if (books.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No books due for return in the next 3 days</td></tr>';
            return;
        }

        tbody.innerHTML = books.map(book => {
            const dueDate = new Date(book.dueDate || book.due_date);
            const today = new Date();
            const isOverdue = dueDate < today;
            const daysDiff = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
            
            let statusBadge = '';
            if (isOverdue) {
                statusBadge = '<span class="status-badge overdue">Overdue</span>';
            } else if (daysDiff === 0) {
                statusBadge = '<span class="status-badge due-today">Due Today</span>';
            } else if (daysDiff === 1) {
                statusBadge = '<span class="status-badge due-tomorrow">Due Tomorrow</span>';
            } else {
                statusBadge = `<span class="status-badge due-soon">Due in ${daysDiff} days</span>`;
            }

            return `
                <tr>
                    <td>
                        <div class="book-title-cell">
                            <strong>${book.book?.title || book.title || 'N/A'}</strong>
                            <small>by ${book.book?.author || book.author || 'Unknown'}</small>
                        </div>
                    </td>
                    <td>
                        <div class="borrower-info">
                            <strong>${book.user_name || 'N/A'}</strong>
                            <small>${book.borrower_type || 'Student'}</small>
                            ${book.lrn ? `<small>LRN: ${book.lrn}</small>` : ''}
                            ${book.employee_id ? `<small>ID: ${book.employee_id}</small>` : ''}
                        </div>
                    </td>
                    <td>${this.formatDate(book.borrowDate || book.borrow_date)}</td>
                    <td>${this.formatDate(book.dueDate || book.due_date)}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="returnBookManager.selectBorrowingForReturn('${book.transaction_id}')">
                            <i class="fas fa-undo-alt"></i> Select
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async selectBorrowingForReturn(transactionId) {
        const searchInput = document.getElementById('returnTransactionSearch');
        if (searchInput) {
            searchInput.value = transactionId;
            await this.searchBorrowing(transactionId);
        }
    }

    renderNoBooksFound() {
        const tbody = document.getElementById('due-books-list');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No books found</td></tr>';
        }
    }

    renderError() {
        const tbody = document.getElementById('due-books-list');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-error">Error loading books</td></tr>';
        }
    }

    clearForm() {
        // Clear search input
        const searchInput = document.getElementById('returnTransactionSearch');
        if (searchInput) {
            searchInput.value = '';
        }

        // Reset form fields
        const bookCondition = document.getElementById('bookCondition');
        if (bookCondition) {
            bookCondition.value = 'Good';
        }

        const returnStatus = document.getElementById('returnStatus');
        if (returnStatus) {
            returnStatus.value = 'On Time';
        }

        // Clear book info
        this.clearBookInfo();
        this.selectedBorrowing = null;
    }

    clearBookInfo() {
        const bookInfo = document.getElementById('returnBookInfo');
        if (bookInfo) {
            bookInfo.style.display = 'none';
        }

        // Reset book details
        this.updateElement('returnBookTitle', '-');
        this.updateElement('returnBookBorrower', '-');
        this.updateElement('returnBookIssueDate', '-');
        this.updateElement('returnBookDueDate', '-');
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            return 'Invalid Date';
        }
    }

    showLoading(message = 'Loading...') {
        // Show loading indicator
        const returnBtn = document.getElementById('returnBookBtn');
        if (returnBtn) {
            returnBtn.disabled = true;
            returnBtn.innerHTML = `<i class="fas fa-spinner fa-spin btn-icon"></i>${message}`;
        }
    }

    hideLoading() {
        // Hide loading indicator
        const returnBtn = document.getElementById('returnBookBtn');
        if (returnBtn) {
            returnBtn.disabled = false;
            returnBtn.innerHTML = '<i class="fas fa-undo-alt btn-icon"></i>Return Book';
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.returnBookManager = new ReturnBookManager();
});