const API_BASE_URL = 'http://localhost:5000/api';

class OverdueReportsManager {
    constructor() {
        this.initializeEventListeners();
        this.loadjsPDF();
        this.loadChartJS();
    }

    initializeEventListeners() {
        const overdueReportBtn = document.querySelector('#overdue-report .btn');
        if (overdueReportBtn) {
            overdueReportBtn.addEventListener('click', () => {
                this.generateOverdueReport();
            });
        }
    }

    loadjsPDF() {
        if (!this.getjsPDFConstructor()) {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = () => {
                console.log('jsPDF loaded successfully');
                this.jsPDFLoaded = true;
            };
            script.onerror = () => {
                console.error('Failed to load jsPDF');
                this.jsPDFLoaded = false;
                this.showError('Failed to load PDF library. Please refresh the page.');
            };
            document.head.appendChild(script);
        } else {
            this.jsPDFLoaded = true;
        }
    }

    loadChartJS() {
        if (!window.Chart) {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js';
            script.onload = () => {
                console.log('Chart.js loaded successfully');
                this.chartJSLoaded = true;
            };
            script.onerror = () => {
                console.error('Failed to load Chart.js');
                this.chartJSLoaded = false;
            };
            document.head.appendChild(script);
        } else {
            this.chartJSLoaded = true;
        }
    }

    getjsPDFConstructor() {
        if (typeof window.jsPDF === 'function') {
            return window.jsPDF;
        }
        if (typeof window.jsPDF === 'object' && typeof window.jsPDF.jsPDF === 'function') {
            return window.jsPDF.jsPDF;
        }
        if (typeof window.jspdf === 'object' && typeof window.jspdf.jsPDF === 'function') {
            return window.jspdf.jsPDF;
        }
        if (window.jsPDF && window.jsPDF.default && typeof window.jsPDF.default === 'function') {
            return window.jsPDF.default;
        }
        if (typeof jsPDF === 'function') {
            return jsPDF;
        }
        return null;
    }

    async generateOverdueReport() {
        try {
            this.showLoading('Generating overdue report...');
            
            // Fetch overdue borrowings data
            const overdueResponse = await fetch(`${API_BASE_URL}/borrow/status/Overdue`);
            
            if (!overdueResponse.ok) {
                throw new Error(`Failed to fetch overdue data: ${overdueResponse.status} ${overdueResponse.statusText}`);
            }

            const overdueData = await overdueResponse.json();
            
            if (overdueData.success && overdueData.borrowings) {
                // Also fetch all borrowings to get additional context
                const allBorrowingsResponse = await fetch(`${API_BASE_URL}/borrow/borrowings/recent`);
                let allBorrowings = [];
                
                if (allBorrowingsResponse.ok) {
                    const allBorrowingsData = await allBorrowingsResponse.json();
                    if (allBorrowingsData.success && allBorrowingsData.borrowings) {
                        allBorrowings = allBorrowingsData.borrowings;
                    }
                }

                // Combine and filter overdue books
                const combinedBorrowings = [...overdueData.borrowings, ...allBorrowings];
                const overdueBorrowings = this.getOverdueBorrowings(combinedBorrowings);

                // Transform borrowings data
                const transformedBorrowings = overdueBorrowings.map(borrowing => ({
                    id: borrowing.borrowing_id || borrowing.id,
                    transaction_id: borrowing.transaction_id,
                    book_id: borrowing.book_id || borrowing.book?.id,
                    user_id: borrowing.user_id,
                    user_name: borrowing.user_name || borrowing.userName,
                    borrow_date: borrowing.borrow_date || borrowing.borrowDate,
                    due_date: borrowing.due_date || borrowing.dueDate,
                    return_date: borrowing.return_date || borrowing.returnDate,
                    status: borrowing.status
                }));

                // Extract unique books and users from borrowings data
                const booksMap = new Map();
                const usersMap = new Map();

                overdueBorrowings.forEach(borrowing => {
                    // Extract book info
                    if (borrowing.book) {
                        booksMap.set(borrowing.book.id, {
                            id: borrowing.book.id,
                            title: borrowing.book.title || borrowing.title,
                            author: borrowing.book.author || borrowing.author,
                            isbn: borrowing.book.isbn || borrowing.isbn
                        });
                    } else if (borrowing.title) {
                        booksMap.set(borrowing.book_id, {
                            id: borrowing.book_id,
                            title: borrowing.title,
                            author: borrowing.author,
                            isbn: borrowing.isbn
                        });
                    }

                    // Extract user info
                    if (borrowing.user_name) {
                        const nameParts = borrowing.user_name.split(' ');
                        usersMap.set(borrowing.user_id, {
                            id: borrowing.user_id,
                            first_name: nameParts[0] || '',
                            last_name: nameParts.slice(1).join(' ') || '',
                            email: borrowing.user_email
                        });
                    }
                });

                const books = Array.from(booksMap.values());
                const users = Array.from(usersMap.values());

                await this.generateOverduePDFReport(transformedBorrowings, books, users);
                
            } else {
                // No overdue books found
                await this.generateOverduePDFReport([], [], []);
            }

        } catch (error) {
            console.error('Error generating overdue report:', error);
            this.showError(`Failed to generate overdue report: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    getOverdueBorrowings(borrowings) {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
        
        return borrowings.filter(borrowing => {
            // Skip if already returned
            if (borrowing.return_date || borrowing.status === 'Returned') {
                return false;
            }
            
            // Check if due date has passed
            const dueDate = new Date(borrowing.due_date);
            dueDate.setHours(0, 0, 0, 0);
            
            return dueDate < today;
        });
    }

    async generateOverdueChart(overdueBorrowings) {
        return new Promise((resolve) => {
            if (!this.chartJSLoaded || !window.Chart || overdueBorrowings.length === 0) {
                resolve(null);
                return;
            }

            try {
                const canvas = document.createElement('canvas');
                canvas.width = 500;
                canvas.height = 300;
                canvas.style.display = 'none';
                document.body.appendChild(canvas);

                const ctx = canvas.getContext('2d');
                const overdueRanges = this.calculateOverdueRanges(overdueBorrowings);

                const chart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ['1-7 Days', '8-14 Days', '15-30 Days', '31+ Days'],
                        datasets: [{
                            label: 'Overdue Books',
                            data: [
                                overdueRanges.range1to7,
                                overdueRanges.range8to14,
                                overdueRanges.range15to30,
                                overdueRanges.range31plus
                            ],
                            backgroundColor: [
                                'rgba(255, 206, 84, 0.8)',   // Yellow for 1-7 days
                                'rgba(255, 159, 64, 0.8)',   // Orange for 8-14 days
                                'rgba(255, 99, 132, 0.8)',   // Red for 15-30 days
                                'rgba(139, 69, 19, 0.8)'     // Dark red for 31+ days
                            ],
                            borderColor: [
                                'rgba(255, 206, 84, 1)',
                                'rgba(255, 159, 64, 1)',
                                'rgba(255, 99, 132, 1)',
                                'rgba(139, 69, 19, 1)'
                            ],
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: false,
                        maintainAspectRatio: false,
                        plugins: {
                            title: {
                                display: true,
                                text: 'Overdue Books by Time Range',
                                font: { size: 16, weight: 'bold' },
                                padding: 20
                            },
                            legend: {
                                display: false
                            }
                        },
                        scales: {
                            y: { 
                                beginAtZero: true,
                                ticks: {
                                    stepSize: 1
                                }
                            }
                        },
                        animation: { duration: 0 }
                    }
                });

                setTimeout(() => {
                    const imageData = canvas.toDataURL('image/png');
                    document.body.removeChild(canvas);
                    chart.destroy();
                    resolve(imageData);
                }, 500);

            } catch (error) {
                console.error('Error generating overdue chart:', error);
                resolve(null);
            }
        });
    }

    calculateOverdueRanges(overdueBorrowings) {
        const today = new Date();
        const ranges = {
            range1to7: 0,
            range8to14: 0,
            range15to30: 0,
            range31plus: 0
        };

        overdueBorrowings.forEach(borrowing => {
            const dueDate = new Date(borrowing.due_date);
            const daysPastDue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

            if (daysPastDue >= 1 && daysPastDue <= 7) {
                ranges.range1to7++;
            } else if (daysPastDue >= 8 && daysPastDue <= 14) {
                ranges.range8to14++;
            } else if (daysPastDue >= 15 && daysPastDue <= 30) {
                ranges.range15to30++;
            } else if (daysPastDue >= 31) {
                ranges.range31plus++;
            }
        });

        return ranges;
    }

    async generateOverduePDFReport(overdueBorrowings, books, users) {
        if (!this.jsPDFLoaded) {
            this.showError('PDF library not loaded. Please refresh the page and try again.');
            return;
        }

        try {
            const jsPDFConstructor = this.getjsPDFConstructor();
            if (!jsPDFConstructor) {
                throw new Error('jsPDF constructor not found');
            }

            const doc = new jsPDFConstructor();

            // Title and Header
            doc.setFontSize(22);
            doc.setFont(undefined, 'bold');
            doc.text('OVERDUE BOOKS REPORT', 105, 30, { align: 'center' });

            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');
            doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 45);
            doc.text(`Total Overdue Books: ${overdueBorrowings.length}`, 20, 55);

            let yPos = 70;

            if (overdueBorrowings.length === 0) {
                // No overdue books
                doc.setFontSize(14);
                doc.setFont(undefined, 'bold');
                doc.text('🎉 GREAT NEWS!', 105, yPos, { align: 'center' });
                yPos += 20;
                
                doc.setFontSize(12);
                doc.setFont(undefined, 'normal');  
                doc.text('No overdue books found. All books are returned on time!', 105, yPos, { align: 'center' });
                
            } else {
                // Add overdue summary section
                doc.setFontSize(14);
                doc.setFont(undefined, 'bold');
                doc.text('OVERDUE SUMMARY:', 20, yPos);
                yPos += 15;

                // Generate and add chart
                const overdueChart = await this.generateOverdueChart(overdueBorrowings);
                
                if (overdueChart) {
                    try {
                        doc.addImage(overdueChart, 'PNG', 30, yPos, 150, 90);
                        yPos += 100;
                    } catch (chartError) {
                        console.warn('Failed to add chart to PDF:', chartError);
                        // Fallback to text summary
                        const ranges = this.calculateOverdueRanges(overdueBorrowings);
                        doc.setFont(undefined, 'normal');
                        doc.text(`• 1-7 days overdue: ${ranges.range1to7} books`, 25, yPos);
                        yPos += 10;
                        doc.text(`• 8-14 days overdue: ${ranges.range8to14} books`, 25, yPos);
                        yPos += 10;
                        doc.text(`• 15-30 days overdue: ${ranges.range15to30} books`, 25, yPos);
                        yPos += 10;
                        doc.text(`• 31+ days overdue: ${ranges.range31plus} books`, 25, yPos);
                        yPos += 20;
                    }
                } else {
                    // Text summary fallback
                    const ranges = this.calculateOverdueRanges(overdueBorrowings);
                    doc.setFont(undefined, 'normal');
                    doc.text(`• 1-7 days overdue: ${ranges.range1to7} books`, 25, yPos);
                    yPos += 10;
                    doc.text(`• 8-14 days overdue: ${ranges.range8to14} books`, 25, yPos);
                    yPos += 10;
                    doc.text(`• 15-30 days overdue: ${ranges.range15to30} books`, 25, yPos);
                    yPos += 10;
                    doc.text(`• 31+ days overdue: ${ranges.range31plus} books`, 25, yPos);
                    yPos += 20;
                }

                // Check if we need a new page for the detailed list
                if (yPos > 200) {
                    doc.addPage();
                    yPos = 30;
                }

                // Detailed overdue books list
                doc.setFontSize(14);
                doc.setFont(undefined, 'bold');
                doc.text('DETAILED OVERDUE LIST:', 20, yPos);
                yPos += 15;

                // Sort by days overdue (most overdue first)
                const sortedOverdue = this.getSortedOverdueBooks(overdueBorrowings, books, users);

                if (sortedOverdue.length > 0) {
                    // Table headers
                    doc.setFontSize(8);
                    doc.setFont(undefined, 'bold');
                    doc.text('BOOK TITLE', 20, yPos);
                    doc.text('BORROWER', 80, yPos);
                    doc.text('DUE DATE', 130, yPos);
                    doc.text('DAYS LATE', 160, yPos);
                    
                    doc.line(20, yPos + 3, 190, yPos + 3);
                    yPos += 10;
                    doc.setFont(undefined, 'normal');

                    sortedOverdue.forEach((item, index) => {
                        if (yPos > 260) {
                            doc.addPage();
                            yPos = 30;
                            
                            // Repeat headers on new page
                            doc.setFont(undefined, 'bold');
                            doc.text('BOOK TITLE', 20, yPos);
                            doc.text('BORROWER', 80, yPos);
                            doc.text('DUE DATE', 130, yPos);
                            doc.text('DAYS LATE', 160, yPos);
                            doc.line(20, yPos + 3, 190, yPos + 3);
                            yPos += 10;
                            doc.setFont(undefined, 'normal');
                        }

                        // Color code based on days overdue
                        if (item.daysOverdue >= 31) {
                            doc.setTextColor(139, 69, 19); // Dark red for 31+ days
                        } else if (item.daysOverdue >= 15) {
                            doc.setTextColor(255, 99, 132); // Red for 15-30 days
                        } else if (item.daysOverdue >= 8) {
                            doc.setTextColor(255, 159, 64); // Orange for 8-14 days
                        } else {
                            doc.setTextColor(255, 206, 84); // Yellow for 1-7 days
                        }

                        doc.text(this.truncateText(item.bookTitle, 25), 20, yPos);
                        doc.text(this.truncateText(item.borrowerName, 20), 80, yPos);
                        doc.text(this.formatDate(item.dueDate), 130, yPos);
                        doc.text(`${item.daysOverdue} days`, 160, yPos);
                        
                        yPos += 8;
                        
                        // Reset text color
                        doc.setTextColor(0, 0, 0);
                    });
                }
            }

            // Add footer
            this.addFooter(doc, 'Overdue Books Report');

            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `overdue-report-${timestamp}.pdf`;
            doc.save(filename);

            this.showSuccess('Overdue report generated successfully!');

        } catch (error) {
            console.error('Error generating PDF:', error);
            this.showError(`Failed to generate PDF: ${error.message}`);
        }
    }

    getSortedOverdueBooks(overdueBorrowings, books, users) {
        const today = new Date();
        
        return overdueBorrowings
            .map(borrowing => {
                const book = books.find(b => b.id == borrowing.book_id);
                const user = users.find(u => u.id == borrowing.user_id);
                const dueDate = new Date(borrowing.due_date);
                const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
                
                return {
                    ...borrowing,
                    bookTitle: book ? book.title : 'Unknown Book',
                    borrowerName: user ? `${user.first_name} ${user.last_name}`.trim() : borrowing.user_name || 'Unknown User',
                    dueDate: borrowing.due_date,
                    daysOverdue
                };
            })
            .sort((a, b) => b.daysOverdue - a.daysOverdue); // Sort by most overdue first
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString();
    }

    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }

    showLoading(message) {
        console.log(`Loading: ${message}`);
        // You can implement actual loading UI here
    }

    hideLoading() {
        console.log('Loading complete');
        // You can implement actual loading UI here
    }

    showSuccess(message) {
        console.log(`Success: ${message}`);
        // You can implement actual success notification here
    }

    showError(message) {
        console.error(`Error: ${message}`);
        // You can implement actual error notification here
    }

    addFooter(doc, reportType) {
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            doc.text(`${reportType} - Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
        }
    }
}

// Initialize the overdue reports manager
document.addEventListener('DOMContentLoaded', () => {
    new OverdueReportsManager();
});