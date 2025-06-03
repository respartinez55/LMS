// ereceipt.js - E-Receipt modal functionality for book issuance
// Displays a receipt modal with QR code and transaction details

document.addEventListener('DOMContentLoaded', () => {
    let receiptModal = null;
    let currentReceiptData = null;

    // Initialize the receipt modal
    function initializeReceiptModal() {
        // Check if modal already exists
        receiptModal = document.getElementById('receiptModal');
        
       if (!receiptModal) {
    // Create modal HTML structure
     const modalHTML = `
        <div id="receiptModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>Book Issue E-Receipt</h2>
                <span class="close-modal" onclick="window.eReceiptModule.closeReceiptModal()">&times;</span>
            </div>
            <div class="modal-body">
                <div class="receipt">
                    <div class="receipt-header">
                        <h3> PNS LIBRARY MANAGEMENT SYSTEM </h3>
                        <p>Book Issue Receipt</p>
                        <p class="receipt-date">Date: <span id="receiptGeneratedDate"></span></p>
                        
                        <!-- QR Code moved to header section -->
                        <div class="receipt-qrcode">
                            <div id="qrcode"></div>
                            <p>LMS-2025-<span id="receiptBarcode"></span></p>
                        </div>
                    </div>
                    <div class="receipt-details">
                        <div class="receipt-row">
                            <span class="receipt-label">Transaction ID:</span>
                            <span class="receipt-value" id="receiptTransactionId"></span>
                        </div>
                        <div class="receipt-row">
                            <span class="receipt-label">Issue Date:</span>
                            <span class="receipt-value" id="receiptIssueDate"></span>
                        </div>
                        <div class="receipt-row">
                            <span class="receipt-label">Due Date:</span>
                            <span class="receipt-value" id="receiptDueDate"></span>
                        </div>
                        <div class="receipt-row">
                            <span class="receipt-label">Book Title:</span>
                            <span class="receipt-value" id="receiptBookTitle"></span>
                        </div>
                        <div class="receipt-row">
                            <span class="receipt-label">Author:</span>
                            <span class="receipt-value" id="receiptBookAuthor"></span>
                        </div>
                        <div class="receipt-row">
                            <span class="receipt-label">Book ID:</span>
                            <span class="receipt-value" id="receiptBookId"></span>
                        </div>
                        <div class="receipt-row">
                            <span class="receipt-label">Borrower:</span>
                            <span class="receipt-value" id="receiptBorrowerName"></span>
                        </div>
                        <div class="receipt-row">
                            <span class="receipt-label">Type:</span>
                            <span class="receipt-value" id="receiptBorrowerType"></span>
                        </div>
                        <!-- Dynamic LRN/Employee ID field -->
                        <div class="receipt-row" id="receiptIdRow">
                            <span class="receipt-label" id="receiptIdLabel">ID:</span>
                            <span class="receipt-value" id="receiptIdValue"></span>
                        </div>
                        <div class="receipt-row">
                            <span class="receipt-label">Status:</span>
                            <span class="receipt-value receipt-status">Issued</span>
                        </div>
                    </div>
                    
                    <img id="receiptBookCover" class="receipt-book-cover" src="" alt="Book Cover" style="display: none;">
                    
                    <div class="receipt-footer">
                        <p>Please keep this receipt for your records.</p>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button onclick="window.eReceiptModule.printReceipt()" class="btn btn-secondary">
                    <span class="material-symbols-outlined">print</span>
                    Print Receipt
                </button>
                <button onclick="window.eReceiptModule.downloadReceipt()" class="btn btn-primary">
                    <span class="material-symbols-outlined">download</span>
                    Download PDF
                </button>
            </div>
        </div>
    </div>
    `;
            // Add modal to body
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            receiptModal = document.getElementById('receiptModal');
            
            // Add click outside to close
            receiptModal.addEventListener('click', (e) => {
                if (e.target === receiptModal) {
                    closeReceiptModal();
                }
            });
            
            // Add escape key to close
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && receiptModal && receiptModal.classList.contains('show')) {
                    closeReceiptModal();
                }
            });
        }
    }

    // Show receipt modal with transaction data
    function showReceiptModal(receiptData) {
        if (!receiptModal) {
            initializeReceiptModal();
        }

        currentReceiptData = receiptData;
        populateReceiptData(receiptData);
        generateQRCode(receiptData);
        
        // Show modal
        receiptModal.classList.add('show');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    // Close receipt modal
    function closeReceiptModal() {
        if (receiptModal) {
            receiptModal.classList.remove('show');
            document.body.style.overflow = ''; // Restore scrolling
            
            // Clear QR code
            const qrCodeElement = document.getElementById('qrcode');
            if (qrCodeElement) {
                qrCodeElement.innerHTML = '';
            }
        }
    }

    // Populate receipt with data
    function populateReceiptData(data) {
        // Transaction details
        const transactionId = data.transactionId || 'N/A';
        const issueDate = formatDate(data.borrowDate || data.issueDate);
        const dueDate = formatDate(data.dueDate);
        
        document.getElementById('receiptTransactionId').textContent = transactionId;
        document.getElementById('receiptIssueDate').textContent = issueDate;
        document.getElementById('receiptDueDate').textContent = dueDate;
        
        // Book details
        document.getElementById('receiptBookTitle').textContent = data.book?.title || data.bookTitle || 'N/A';
        document.getElementById('receiptBookAuthor').textContent = data.book?.author || data.bookAuthor || 'N/A';
        document.getElementById('receiptBookId').textContent = data.book?.id || data.bookId || 'N/A';
        
        // Book cover (if available)
        const bookCover = document.getElementById('receiptBookCover');
        if (data.book?.coverImage || data.bookCover) {
            bookCover.src = data.book?.coverImage || data.bookCover;
            bookCover.style.display = 'block';
        } else {
            bookCover.style.display = 'none';
        }
        
        // Borrower details
        document.getElementById('receiptBorrowerName').textContent = data.userName || data.borrowerName || 'N/A';
        
        const borrowerType = data.borrowerType || 'N/A';
        document.getElementById('receiptBorrowerType').textContent = capitalizeFirst(borrowerType);
        
        // Dynamic LRN/Employee ID field based on borrower type
        populateIdField(data, borrowerType);
        
        // Barcode (using transaction ID)
        document.getElementById('receiptBarcode').textContent = transactionId;
        
        // Generated date
        document.getElementById('receiptGeneratedDate').textContent = formatDateTime(new Date());
    }

    // Populate ID field based on borrower type
    function populateIdField(data, borrowerType) {
        const idLabelElement = document.getElementById('receiptIdLabel');
        const idValueElement = document.getElementById('receiptIdValue');
        const idRowElement = document.getElementById('receiptIdRow');
        
        // Normalize borrower type for comparison
        const normalizedType = borrowerType.toLowerCase();
        
        let idLabel = 'ID:';
        let idValue = 'N/A';
        
        // Determine field label and value based on borrower type
        if (normalizedType.includes('student') || normalizedType.includes('learner')) {
            idLabel = 'LRN:';
            idValue = data.lrn || data.LRN || data.learnerReferenceNumber || 'N/A';
        } else if (normalizedType.includes('employee') || normalizedType.includes('staff') || 
                   normalizedType.includes('teacher') || normalizedType.includes('faculty')) {
            idLabel = 'Employee ID:';
            idValue = data.employeeId || data.employeeID || data.staffId || data.staffID || 'N/A';
        } else {
            // Generic ID field for other types
            idLabel = 'ID Number:';
            idValue = data.idNumber || data.id || data.userId || data.userID || 'N/A';
        }
        
        // Update the DOM elements
        idLabelElement.textContent = idLabel;
        idValueElement.textContent = idValue;
        
        // Hide the row if no ID is available
        if (idValue === 'N/A' || !idValue) {
            idRowElement.style.display = 'none';
        } else {
            idRowElement.style.display = 'flex';
        }
    }

    // Generate QR code for the receipt
    function generateQRCode(data) {
        const qrCodeElement = document.getElementById('qrcode');
        if (!qrCodeElement) return;

        // Clear previous QR code
        qrCodeElement.innerHTML = '';

        // Get the appropriate ID based on borrower type
        const borrowerType = (data.borrowerType || '').toLowerCase();
        let borrowerId = '';
        
        if (borrowerType.includes('student') || borrowerType.includes('learner')) {
            borrowerId = data.lrn || data.LRN || data.learnerReferenceNumber || '';
        } else if (borrowerType.includes('employee') || borrowerType.includes('staff') || 
                   borrowerType.includes('teacher') || borrowerType.includes('faculty')) {
            borrowerId = data.employeeId || data.employeeID || data.staffId || data.staffID || '';
        } else {
            borrowerId = data.idNumber || data.id || data.userId || data.userID || '';
        }

        // Create QR code data
        const qrData = {
            transactionId: data.transactionId,
            bookId: data.book?.id || data.bookId,
            bookTitle: data.book?.title || data.bookTitle,
            borrower: data.userName || data.borrowerName,
            borrowerType: data.borrowerType,
            borrowerId: borrowerId,
            issueDate: data.borrowDate || data.issueDate,
            dueDate: data.dueDate,
            type: 'LIBRARY_ISSUE_RECEIPT'
        };

        const qrString = JSON.stringify(qrData);

        // Check if QRCode library is available
        if (typeof QRCode !== 'undefined') {
            try {
                new QRCode(qrCodeElement, {
                    text: qrString,
                    width: 128,
                    height: 128,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M
                });
            } catch (error) {
                console.error('Error generating QR code:', error);
                qrCodeElement.innerHTML = '<p style="color: #666; font-size: 12px;">QR Code generation failed</p>';
            }
        } else {
            // Fallback: display transaction ID as text
            qrCodeElement.innerHTML = `
                <div style="border: 2px solid #007bff; padding: 10px; border-radius: 4px; background: #f8f9fa;">
                    <p style="margin: 0; font-size: 12px; color: #666;">Transaction ID:</p>
                    <p style="margin: 0; font-weight: bold; color: #007bff;">${data.transactionId}</p>
                </div>
            `;
        }
    }

    // Print receipt - modal stays open
    function printReceipt() {
        if (!currentReceiptData) return;

        // Create a new window for printing
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        const receiptContent = document.querySelector('.receipt').cloneNode(true);
        
        // Get the existing CSS from the current page
        const existingStyles = Array.from(document.styleSheets)
            .map(sheet => {
                try {
                    return Array.from(sheet.cssRules)
                        .map(rule => rule.cssText)
                        .join('\n');
                } catch (e) {
                    return '';
                }
            })
            .join('\n');
        
        // Create print-friendly HTML using existing styles
        const printHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>E-Receipt - ${currentReceiptData.transactionId}</title>
                <style>
                    ${existingStyles}
                    
                    /* Print-specific overrides */
                    body { 
                        margin: 0; 
                        padding: 20px; 
                        background: white !important;
                    }
                    .receipt { 
                        max-width: none !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                    }
                    .modal-header,
                    .modal-footer,
                    .close-modal {
                        display: none !important;
                    }
                </style>
            </head>
            <body>
                ${receiptContent.outerHTML}
            </body>
            </html>
        `;
        
        printWindow.document.write(printHTML);
        printWindow.document.close();
        
        // Wait for content to load, then print and close
        printWindow.onload = function() {
            setTimeout(() => {
                printWindow.focus();
                printWindow.print();
                
                // Close print window after printing
                setTimeout(() => {
                    printWindow.close();
                }, 500);
                
                // Modal stays open - removed closeReceiptModal() call
            }, 250);
        };
    }

    // Download receipt as HTML - closes modal after download
    function downloadReceipt() {
        if (!currentReceiptData) return;

        try {
            // Get the existing CSS from the current page
            const existingStyles = Array.from(document.styleSheets)
                .map(sheet => {
                    try {
                        return Array.from(sheet.cssRules)
                            .map(rule => rule.cssText)
                            .join('\n');
                    } catch (e) {
                        return '';
                    }
                })
                .join('\n');

            // Create a clean HTML version using existing styles
            const receiptContent = document.querySelector('.receipt').cloneNode(true);
            
            // Generate filename
            const transactionId = currentReceiptData.transactionId || 'receipt';
            const currentDate = new Date().toISOString().split('T')[0];
            const filename = `E-Receipt_${transactionId}_${currentDate}.html`;

            // Create downloadable HTML content using existing CSS
            const downloadHTML = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>E-Receipt - ${transactionId}</title>
                    <style>
                        ${existingStyles}
                        
                        /* Download-specific styling */
                        body { 
                            margin: 20px auto; 
                            background: #f5f5f5 !important;
                            max-width: 600px;
                        }
                        .receipt { 
                            background: white !important;
                            padding: 30px !important;
                            border-radius: 8px !important;
                            box-shadow: 0 0 10px rgba(0,0,0,0.1) !important;
                        }
                        .modal-header,
                        .modal-footer,
                        .close-modal {
                            display: none !important;
                        }
                    </style>
                </head>
                <body>
                    <div class="receipt-container">
                        ${receiptContent.outerHTML}
                    </div>
                </body>
                </html>
            `;

            // Create and download the file
            const blob = new Blob([downloadHTML], { type: 'text/html' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            
            // Cleanup
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            // Show success message (optional)
            console.log('E-Receipt downloaded successfully:', filename);
            
            // Close the modal after successful download
            setTimeout(() => {
                closeReceiptModal();
            }, 300);
            
        } catch (error) {
            console.error('Error downloading receipt:', error);
            alert('Error downloading receipt. Please try again.');
        }
    }

    // Utility function to format date
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (error) {
            return dateString;
        }
    }

    // Utility function to format date and time
    function formatDateTime(date) {
        try {
            return date.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return date.toString();
        }
    }

    // Utility function to capitalize first letter
    function capitalizeFirst(str) {
        if (!str) return str;
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // Initialize modal on load
    initializeReceiptModal();

    // Public API for external access
    window.eReceiptModule = {
        showReceiptModal,
        closeReceiptModal,
        printReceipt,
        downloadReceipt,
        initializeReceiptModal
    };

    // Also expose as receiptModule for compatibility
    window.receiptModule = window.eReceiptModule;
});

// Integration helper function for issuebook.js
// Call this function after successful book issuance
function showBookIssueReceipt(issueData) {
    if (window.eReceiptModule) {
        window.eReceiptModule.showReceiptModal(issueData);
    } else {
        console.warn('E-Receipt module not loaded');
    }
}