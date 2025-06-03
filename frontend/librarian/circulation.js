const API_BASE_URL = 'http://localhost:5000/api';

class CirculationReportsManager {
    constructor() {
        this.initializeEventListeners();
        this.loadjsPDF();
        this.loadChartJS();
    }

    initializeEventListeners() {
        const circulationReportBtn = document.querySelector('#circulation-report .btn');
        if (circulationReportBtn) {
            circulationReportBtn.addEventListener('click', () => {
                this.generateCirculationReport();
            });
        }

        const customCirculationBtn = document.getElementById('generateCustomCirculationBtn');
        if (customCirculationBtn) {
            customCirculationBtn.addEventListener('click', () => {
                this.generateCustomCirculationReport();
            });
        }

        this.setDefaultDates();
    }

    setDefaultDates() {
        const today = new Date().toISOString().split('T')[0];
        const endDateInput = document.getElementById('circulationEndDate');
        const startDateInput = document.getElementById('circulationStartDate');
        
        if (endDateInput) {
            endDateInput.value = today;
        }
        
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        if (startDateInput) {
            startDateInput.value = threeMonthsAgo.toISOString().split('T')[0];
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

    async generateCirculationReport(startDate = null, endDate = null) {
        try {
            this.showLoading('Generating circulation report...');
            
            // Fetch all borrowings data from the correct endpoint
            const borrowingsResponse = await fetch(`${API_BASE_URL}/borrow/borrowings/recent`);
            
            if (!borrowingsResponse.ok) {
                throw new Error(`Failed to fetch borrowings data: ${borrowingsResponse.status} ${borrowingsResponse.statusText}`);
            }

            const borrowingsData = await borrowingsResponse.json();
            
            if (borrowingsData.success && borrowingsData.borrowings) {
                // Get additional data by fetching different status types to get complete picture
                const [pendingResponse, returnedResponse, overdueResponse] = await Promise.allSettled([
                    fetch(`${API_BASE_URL}/borrow/status/Pending`),
                    fetch(`${API_BASE_URL}/borrow/status/Returned`), 
                    fetch(`${API_BASE_URL}/borrow/status/Overdue`)
                ]);

                // Combine all borrowings data
                let allBorrowings = [...borrowingsData.borrowings];
                
                // Add pending borrowings if available
                if (pendingResponse.status === 'fulfilled' && pendingResponse.value.ok) {
                    const pendingData = await pendingResponse.value.json();
                    if (pendingData.success && pendingData.borrowings) {
                        allBorrowings = [...allBorrowings, ...pendingData.borrowings];
                    }
                }

                // Add returned borrowings if available
                if (returnedResponse.status === 'fulfilled' && returnedResponse.value.ok) {
                    const returnedData = await returnedResponse.value.json();
                    if (returnedData.success && returnedData.borrowings) {
                        allBorrowings = [...allBorrowings, ...returnedData.borrowings];
                    }
                }

                // Add overdue borrowings if available
                if (overdueResponse.status === 'fulfilled' && overdueResponse.value.ok) {
                    const overdueData = await overdueResponse.value.json();
                    if (overdueData.success && overdueData.borrowings) {
                        allBorrowings = [...allBorrowings, ...overdueData.borrowings];
                    }
                }

                // Remove duplicates based on transaction_id
                const uniqueBorrowings = allBorrowings.filter((borrowing, index, self) => 
                    index === self.findIndex(b => b.transaction_id === borrowing.transaction_id)
                );

                // Transform borrowings data to match expected format
                const transformedBorrowings = uniqueBorrowings.map(borrowing => ({
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

                uniqueBorrowings.forEach(borrowing => {
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

                await this.generateCirculationPDFReport(
                    transformedBorrowings,
                    books,
                    users,
                    startDate,
                    endDate
                );
            } else {
                throw new Error('No borrowings data available');
            }

        } catch (error) {
            console.error('Error generating circulation report:', error);
            this.showError(`Failed to generate circulation report: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    generateCustomCirculationReport() {
        const startDate = document.getElementById('circulationStartDate')?.value;
        const endDate = document.getElementById('circulationEndDate')?.value;

        if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
            this.showError('Start date cannot be later than end date');
            return;
        }

        this.generateCirculationReport(startDate, endDate);
    }

    async generateCirculationSummaryPieChart(borrowings) {
        return new Promise((resolve) => {
            if (!this.chartJSLoaded || !window.Chart) {
                resolve(null);
                return;
            }

            try {
                const canvas = document.createElement('canvas');
                canvas.width = 400;
                canvas.height = 300;
                canvas.style.display = 'none';
                document.body.appendChild(canvas);

                const ctx = canvas.getContext('2d');
                const stats = this.calculateStatistics(borrowings, [], []);

                const chart = new Chart(ctx, {
                    type: 'pie',
                    data: {
                        labels: ['Currently Borrowed', 'Returned', 'Overdue'],
                        datasets: [{
                            data: [stats.currentlyBorrowed, stats.totalReturned, stats.overdueBooks],
                            backgroundColor: [
                                'rgba(52, 152, 219, 0.8)',  // Blue for Currently Borrowed
                                'rgba(46, 204, 113, 0.8)',  // Green for Returned
                                'rgba(231, 76, 60, 0.8)'    // Red for Overdue
                            ],
                            borderColor: [
                                'rgba(52, 152, 219, 1)',
                                'rgba(46, 204, 113, 1)',
                                'rgba(231, 76, 60, 1)'
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
                                text: 'Circulation Summary',
                                font: { size: 16, weight: 'bold' },
                                padding: 20
                            },
                            legend: {
                                position: 'bottom',
                                labels: {
                                    padding: 15,
                                    font: { size: 12 }
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
                console.error('Error generating pie chart:', error);
                resolve(null);
            }
        });
    }

    async generateMonthlyChart(borrowings) {
        return new Promise((resolve) => {
            if (!this.chartJSLoaded || !window.Chart) {
                resolve(null);
                return;
            }

            try {
                const canvas = document.createElement('canvas');
                canvas.width = 600;
                canvas.height = 300;
                canvas.style.display = 'none';
                document.body.appendChild(canvas);

                const ctx = canvas.getContext('2d');
                const monthlyData = this.calculateMonthlyData(borrowings);

                const chart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: monthlyData.map(item => item.month),
                        datasets: [{
                            label: 'Books Issued',
                            data: monthlyData.map(item => item.issues),
                            backgroundColor: 'rgba(52, 152, 219, 0.8)',
                            borderColor: 'rgba(52, 152, 219, 1)',
                            borderWidth: 2
                        }, {
                            label: 'Books Returned',
                            data: monthlyData.map(item => item.returns),
                            backgroundColor: 'rgba(46, 204, 113, 0.8)',
                            borderColor: 'rgba(46, 204, 113, 1)',
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: false,
                        maintainAspectRatio: false,
                        plugins: {
                            title: {
                                display: true,
                                text: 'Monthly Book Issues vs Returns',
                                font: { size: 16, weight: 'bold' },
                                padding: 20
                            },
                            legend: {
                                position: 'top',
                                labels: {
                                    padding: 10,
                                    font: { size: 12 }
                                }
                            }
                        },
                        scales: {
                            y: { beginAtZero: true }
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
                console.error('Error generating chart:', error);
                resolve(null);
            }
        });
    }

    async generateCirculationPDFReport(borrowings, books, users, startDate = null, endDate = null) {
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

            // Filter borrowings by date range if specified
            let filteredBorrowings = borrowings;
            if (startDate && endDate) {
                filteredBorrowings = borrowings.filter(borrowing => {
                    const borrowDate = new Date(borrowing.borrow_date);
                    return borrowDate >= new Date(startDate) && borrowDate <= new Date(endDate);
                });
            }

            // Title and Header
            doc.setFontSize(22);
            doc.setFont(undefined, 'bold');
            doc.text('CIRCULATION REPORT', 105, 30, { align: 'center' });

            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');
            doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 45);
            
            if (startDate && endDate) {
                doc.text(`Period: ${this.formatDate(startDate)} to ${this.formatDate(endDate)}`, 20, 55);
            }

            let yPos = 70;

            // Add section header for circulation summary
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            yPos -= 15; // Move up by 20 units
            doc.text('CIRCULATION SUMMARY:', 20, yPos);
            yPos += 15;

            // Generate both charts
            const [pieChart, monthlyChart] = await Promise.all([
                this.generateCirculationSummaryPieChart(filteredBorrowings),
                this.generateMonthlyChart(filteredBorrowings)
            ]);

            if (pieChart && monthlyChart) {
                try {
                    // Add pie chart first (centered)
                    doc.addImage(pieChart, 'PNG', 55, yPos, 100, 75);
                    yPos += 85;
                    
                    // Add monthly trends header before the monthly chart
                    doc.setFontSize(14);
                    doc.setFont(undefined, 'bold');
                    doc.text('MONTHLY TRENDS:', 20, yPos);
                    yPos += 15;
                    
                    // Add monthly chart below header (centered)
                    doc.addImage(monthlyChart, 'PNG', 35, yPos, 140, 70);
                    yPos += 80;
                } catch (chartError) {
                    console.warn('Failed to add charts to PDF:', chartError);
                    // Fallback to text summary if charts fail
                    const stats = this.calculateStatistics(filteredBorrowings, books, users);
                    doc.setFont(undefined, 'normal');
                    doc.text(`• Total Borrowings: ${stats.totalBorrowings}`, 25, yPos);
                    yPos += 10;
                    doc.text(`• Currently Borrowed: ${stats.currentlyBorrowed}`, 25, yPos);
                    yPos += 10;
                    doc.text(`• Returned Books: ${stats.totalReturned}`, 25, yPos);
                    yPos += 10;
                    doc.text(`• Overdue Books: ${stats.overdueBooks}`, 25, yPos);
                    yPos += 10;
                    doc.text(`• Active Borrowers: ${stats.activeBorrowers}`, 25, yPos);
                    yPos += 20;
                }
            } else if (pieChart) {
                try {
                    // Add only pie chart (centered)
                    doc.addImage(pieChart, 'PNG', 55, yPos, 100, 75);
                    yPos += 85;
                } catch (chartError) {
                    console.warn('Failed to add pie chart to PDF:', chartError);
                }
            } else if (monthlyChart) {
                try {
                    // Add monthly trends header before the monthly chart
                    doc.setFontSize(14);
                    doc.setFont(undefined, 'bold');
                    doc.text('MONTHLY TRENDS:', 20, yPos);
                    yPos += 15;
                    
                    // Add only monthly chart (centered)
                    doc.addImage(monthlyChart, 'PNG', 35, yPos, 140, 70);
                    yPos += 80;
                } catch (chartError) {
                    console.warn('Failed to add monthly chart to PDF:', chartError);
                }
            } else {
                // Fallback to text summary if no charts are available
                const stats = this.calculateStatistics(filteredBorrowings, books, users);
                doc.setFont(undefined, 'normal');
                doc.text(`• Total Borrowings: ${stats.totalBorrowings}`, 25, yPos);
                yPos += 10;
                doc.text(`• Currently Borrowed: ${stats.currentlyBorrowed}`, 25, yPos);
                yPos += 10;
                doc.text(`• Returned Books: ${stats.totalReturned}`, 25, yPos);
                yPos += 10;
                doc.text(`• Overdue Books: ${stats.overdueBooks}`, 25, yPos);
                yPos += 10;
                doc.text(`• Active Borrowers: ${stats.activeBorrowers}`, 25, yPos);
                yPos += 20;
            }

            // Check if we need a new page for the recent activity section
            if (yPos > 200) {
                doc.addPage();
                yPos = 30;
            }

            // Recent borrowings table  
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text('RECENT ACTIVITY:', 20, yPos);
            yPos += 15;

            const recentBorrowings = this.getRecentBorrowings(filteredBorrowings, books, users, 15);

            if (recentBorrowings.length === 0) {
                doc.setFontSize(10);
                doc.setFont(undefined, 'normal');
                doc.text('No recent activity found.', 20, yPos);
            } else {
                doc.setFontSize(8);
                doc.setFont(undefined, 'bold');
                doc.text('DATE', 20, yPos);
                doc.text('BOOK', 50, yPos);
                doc.text('BORROWER', 110, yPos);
                doc.text('STATUS', 160, yPos);
                
                doc.line(20, yPos + 3, 190, yPos + 3);
                yPos += 10;
                doc.setFont(undefined, 'normal');

                recentBorrowings.forEach((borrowing, index) => {
                    if (yPos > 260) {
                        doc.addPage();
                        yPos = 30;
                        
                        doc.setFont(undefined, 'bold');
                        doc.text('DATE', 20, yPos);
                        doc.text('BOOK', 50, yPos);
                        doc.text('BORROWER', 110, yPos);
                        doc.text('STATUS', 160, yPos);
                        doc.line(20, yPos + 3, 190, yPos + 3);
                        yPos += 10;
                        doc.setFont(undefined, 'normal');
                    }

                    doc.text(this.formatDate(borrowing.borrow_date), 20, yPos);
                    doc.text(this.truncateText(borrowing.book_title || 'N/A', 30), 50, yPos);
                    doc.text(this.truncateText(borrowing.borrower_name || 'N/A', 25), 110, yPos);
                    doc.text(borrowing.status || 'Active', 160, yPos);
                    
                    yPos += 8;
                });
            }

            // Add footer
            this.addFooter(doc, 'Circulation Report');

            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `circulation-report-${timestamp}.pdf`;
            doc.save(filename);

        } catch (error) {
            console.error('Error generating PDF:', error);
            this.showError(`Failed to generate PDF: ${error.message}`);
        }
    }

    calculateStatistics(borrowings, books, users) {
        const totalBorrowings = borrowings.length;
        const currentlyBorrowed = borrowings.filter(b => b.status === 'Borrowed').length;
        const totalReturned = borrowings.filter(b => b.status === 'Returned').length;
        
        const today = new Date();
        const overdueBooks = borrowings.filter(b => {
            if (b.return_date || b.status === 'Returned') return false;
            const dueDate = new Date(b.due_date);
            return dueDate < today;
        }).length;

        const activeBorrowers = new Set(
            borrowings.filter(b => b.status === 'Borrowed').map(b => b.user_id)
        ).size;

        return {
            totalBorrowings,
            currentlyBorrowed,
            totalReturned,
            overdueBooks,
            activeBorrowers
        };
    }

    calculateMonthlyData(borrowings) {
        const monthlyData = [];
        const today = new Date();
        
        for (let i = 5; i >= 0; i--) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const monthName = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
            
            const monthBorrowings = borrowings.filter(b => {
                const borrowDate = new Date(b.borrow_date);
                return borrowDate >= date && borrowDate < nextMonth;
            });

            const monthReturns = borrowings.filter(b => {
                if (!b.return_date) return false;
                const returnDate = new Date(b.return_date);
                return returnDate >= date && returnDate < nextMonth;
            });

            monthlyData.push({
                month: monthName,
                issues: monthBorrowings.length,
                returns: monthReturns.length
            });
        }
        
        return monthlyData;
    }

    getRecentBorrowings(borrowings, books, users, limit = 15) {
        return borrowings
            .sort((a, b) => new Date(b.borrow_date) - new Date(a.borrow_date))
            .slice(0, limit)
            .map(borrowing => {
                const book = books.find(b => b.id == borrowing.book_id);
                const user = users.find(u => u.id == borrowing.user_id);
                
                return {
                    ...borrowing,
                    book_title: book ? book.title : 'Unknown Book',
                    borrower_name: user ? `${user.first_name} ${user.last_name}`.trim() : borrowing.user_name || 'Unknown User',
                    status: borrowing.return_date ? 'Returned' : 
                            (new Date(borrowing.due_date) < new Date() ? 'Overdue' : 'Active')
                };
            });
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
        // Removed alert notification
    }

    showError(message) {
        console.error(`Error: ${message}`);
        // Removed alert notification
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

// Initialize the circulation reports manager
document.addEventListener('DOMContentLoaded', () => {
    new CirculationReportsManager();
});