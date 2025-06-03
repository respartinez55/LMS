const API_BASE_URL = 'http://localhost:5000/api';

class BooksReportsManager {
    constructor() {
        this.initializeEventListeners();
        this.loadjsPDF();
        this.loadChartJS();
    }

    initializeEventListeners() {
        const booksReportBtn = document.querySelector('#books-report .btn');
        if (booksReportBtn) {
            booksReportBtn.addEventListener('click', () => {
                this.generateBooksReport();
            });
        }

        const categoryReportBtn = document.querySelector('#category-report .btn');
        if (categoryReportBtn) {
            categoryReportBtn.addEventListener('click', () => {
                this.generateCategoryDistributionReport();
            });
        }

        const popularBooksBtn = document.querySelector('#popular-books-report .btn');
        if (popularBooksBtn) {
            popularBooksBtn.addEventListener('click', () => {
                this.generatePopularBooksReport();
            });
        }

        const customReportBtn = document.getElementById('generateCustomReportBtn');
        if (customReportBtn) {
            customReportBtn.addEventListener('click', () => {
                this.generateCustomReport();
            });
        }

        this.setDefaultDates();
    }

    setDefaultDates() {
        const today = new Date().toISOString().split('T')[0];
        const endDateInput = document.getElementById('reportEndDate');
        const startDateInput = document.getElementById('reportStartDate');
        
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
                setTimeout(() => {
                    const constructor = this.getjsPDFConstructor();
                    if (constructor) {
                        this.jsPDFLoaded = true;
                        console.log('jsPDF constructor found:', constructor.name);
                    } else {
                        console.error('jsPDF constructor not found after loading');
                        this.jsPDFLoaded = false;
                        this.showError('Failed to initialize PDF library. Please refresh the page.');
                    }
                }, 100);
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

    async generateBooksReport() {
        try {
            this.showLoading('Generating books inventory report...');
            
            const response = await fetch(`${API_BASE_URL}/books`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                await this.generateBooksPDFReport(data.books);
                this.showSuccess('Books inventory report generated successfully!');
            } else {
                throw new Error(data.message || 'Failed to fetch books data');
            }

        } catch (error) {
            console.error('Error generating books report:', error);
            this.showError(`Failed to generate books report: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    async generateCategoryDistributionReport() {
        try {
            this.showLoading('Generating category distribution report...');
            
            const response = await fetch(`${API_BASE_URL}/books`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                await this.generateCategoryDistributionPDF(data.books);
                this.showSuccess('Category distribution report generated successfully!');
            } else {
                throw new Error(data.message || 'Failed to fetch books data');
            }

        } catch (error) {
            console.error('Error generating category distribution report:', error);
            this.showError(`Failed to generate category distribution report: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    async generatePopularBooksReport() {
        try {
            this.showLoading('Generating popular books report...');
            
            const borrowingsResponse = await fetch(`${API_BASE_URL}/borrowings`);
            const booksResponse = await fetch(`${API_BASE_URL}/books`);
            
            if (!borrowingsResponse.ok || !booksResponse.ok) {
                throw new Error('Failed to fetch data');
            }

            const borrowingsData = await borrowingsResponse.json();
            const booksData = await booksResponse.json();
            
            if (borrowingsData.success && booksData.success) {
                await this.generatePopularBooksPDF(borrowingsData.borrowings || [], booksData.books);
                this.showSuccess('Popular books report generated successfully!');
            } else {
                throw new Error('Failed to fetch data');
            }

        } catch (error) {
            console.error('Error generating popular books report:', error);
            this.showError(`Failed to generate popular books report: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    generateCustomReport() {
        const reportType = document.getElementById('reportType')?.value;
        const startDate = document.getElementById('reportStartDate')?.value;
        const endDate = document.getElementById('reportEndDate')?.value;

        if (!reportType) {
            this.showError('Please select a report type');
            return;
        }

        if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
            this.showError('Start date cannot be later than end date');
            return;
        }

        switch (reportType) {
            case 'books':
                this.generateBooksReport();
                break;
            case 'category-distribution':
                this.generateCategoryDistributionReport();
                break;
            case 'popular-books':
                this.generatePopularBooksReport();
                break;
            default:
                this.showError('Invalid report type selected');
        }
    }

    async generateCategoryChart(categoryStats) {
        return new Promise((resolve) => {
            if (!this.chartJSLoaded || !window.Chart) {
                console.warn('Chart.js not loaded, skipping chart generation');
                resolve(null);
                return;
            }

            try {
                // Create a temporary canvas element
                const canvas = document.createElement('canvas');
                canvas.width = 800;
                canvas.height = 600;
                canvas.style.display = 'none';
                document.body.appendChild(canvas);

                const ctx = canvas.getContext('2d');

                // Sort and get top 10 categories
                const topCategories = categoryStats
                    .sort((a, b) => b.bookCount - a.bookCount)
                    .slice(0, 10);

                // Generate colors for the chart
                const colors = [
                    '#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6',
                    '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#16a085'
                ];

                const chart = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: topCategories.map(cat => cat.name),
                        datasets: [{
                            data: topCategories.map(cat => cat.bookCount),
                            backgroundColor: colors.slice(0, topCategories.length),
                            borderWidth: 2,
                            borderColor: '#fff'
                        }]
                    },
                    options: {
                        responsive: false,
                        maintainAspectRatio: false,
                        plugins: {
                            title: {
                                display: true,
                                text: 'Top 10 Categories Distribution',
                                font: {
                                    size: 18,
                                    weight: 'bold'
                                },
                                padding: 20
                            },
                            legend: {
                                position: 'right',
                                labels: {
                                    font: {
                                        size: 12
                                    },
                                    generateLabels: function(chart) {
                                        const data = chart.data;
                                        return data.labels.map((label, i) => ({
                                            text: `${label} (${data.datasets[0].data[i]} books)`,
                                            fillStyle: data.datasets[0].backgroundColor[i],
                                            strokeStyle: data.datasets[0].borderColor,
                                            lineWidth: data.datasets[0].borderWidth,
                                            hidden: false,
                                            index: i
                                        }));
                                    }
                                }
                            }
                        },
                        animation: {
                            duration: 0
                        }
                    }
                });

                // Wait for chart to render
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

    async generateBooksPDFReport(books) {
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

            doc.setProperties({
                title: 'Books Inventory Report',
                subject: 'Library Management System Report',
                author: 'Library Management System',
                keywords: 'library, books, inventory, report',
                creator: 'Library Management System'
            });

            doc.setFontSize(22);
            doc.setFont(undefined, 'bold');
            doc.text('BOOKS INVENTORY REPORT', 105, 30, { align: 'center' });

            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');
            doc.text(`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 20, 45);

            const totalQuantity = books.reduce((sum, book) => sum + (book.quantity || 0), 0);
            const totalAvailable = books.reduce((sum, book) => sum + (book.available_quantity || 0), 0);
            const totalBorrowed = totalQuantity - totalAvailable;

            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('SUMMARY STATISTICS:', 20, 60);
            
            doc.setFont(undefined, 'normal');
            doc.text(`• Total Books: ${books.length}`, 25, 70);
            doc.text(`• Total Copies: ${totalQuantity}`, 25, 80);
            doc.text(`• Available Copies: ${totalAvailable}`, 25, 90);
            doc.text(`• Borrowed Copies: ${totalBorrowed}`, 25, 100);

            doc.setLineWidth(0.5);
            doc.line(20, 110, 190, 110);

            let yPosition = 125;
            const pageHeight = 297;
            const bottomMargin = 30;

            if (books.length === 0) {
                doc.setFontSize(12);
                doc.text('No books found in the inventory.', 20, yPosition);
            } else {
                doc.setFontSize(11);
                doc.setFont(undefined, 'bold');
                doc.text('BOOKS INVENTORY DETAILS:', 20, yPosition);
                yPosition += 15;

                doc.setFontSize(9);
                doc.text('#', 20, yPosition);
                doc.text('TITLE', 30, yPosition);
                doc.text('AUTHOR', 80, yPosition);
                doc.text('CATEGORY', 120, yPosition);
                doc.text('QTY', 150, yPosition);
                doc.text('AVAIL', 165, yPosition);
                doc.text('STATUS', 180, yPosition);
                
                doc.setLineWidth(0.3);
                doc.line(20, yPosition + 3, 200, yPosition + 3);
                
                yPosition += 10;
                doc.setFont(undefined, 'normal');

                books.forEach((book, index) => {
                    if (yPosition > pageHeight - bottomMargin) {
                        doc.addPage();
                        yPosition = 30;
                        
                        doc.setFont(undefined, 'bold');
                        doc.setFontSize(9);
                        doc.text('#', 20, yPosition);
                        doc.text('TITLE', 30, yPosition);
                        doc.text('AUTHOR', 80, yPosition);
                        doc.text('CATEGORY', 120, yPosition);
                        doc.text('QTY', 150, yPosition);
                        doc.text('AVAIL', 165, yPosition);
                        doc.text('STATUS', 180, yPosition);
                        doc.line(20, yPosition + 3, 200, yPosition + 3);
                        yPosition += 10;
                        doc.setFont(undefined, 'normal');
                    }

                    if (index % 2 === 0) {
                        doc.setFillColor(248, 249, 250);
                        doc.rect(18, yPosition - 6, 184, 8, 'F');
                    }

                    const title = this.truncateText(book.title || 'No Title', 25);
                    const author = this.truncateText(book.author || 'Unknown', 20);
                    const category = this.truncateText(book.category || 'N/A', 18);
                    const status = book.status || 'Available';

                    doc.setFontSize(8);
                    doc.text(`${index + 1}`, 20, yPosition);
                    doc.text(title, 30, yPosition);
                    doc.text(author, 80, yPosition);
                    doc.text(category, 120, yPosition);
                    doc.text(`${book.quantity || 0}`, 150, yPosition);
                    doc.text(`${book.available_quantity || 0}`, 165, yPosition);
                    doc.text(status, 180, yPosition);
                    
                    yPosition += 10;
                });
            }

            this.addFooter(doc, 'Books Inventory Report');

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
            const filename = `books-inventory-report-${timestamp}.pdf`;

            doc.save(filename);

        } catch (error) {
            console.error('Error generating PDF:', error);
            this.showError(`Failed to generate PDF: ${error.message}`);
        }
    }

    async generateCategoryDistributionPDF(books) {
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

            doc.setProperties({
                title: 'Category Distribution Report',
                subject: 'Library Management System Report',
                author: 'Library Management System',
                keywords: 'library, books, category, distribution, report',
                creator: 'Library Management System'
            });

            doc.setFontSize(22);
            doc.setFont(undefined, 'bold');
            doc.text('CATEGORY DISTRIBUTION REPORT', 105, 30, { align: 'center' });

            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');
            doc.text(`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 20, 45);

            const categoryStats = this.calculateCategoryDistribution(books);
            const totalBooks = books.length;

            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('SUMMARY:', 20, 60);
            
            doc.setFont(undefined, 'normal');
            doc.text(`• Total Books: ${totalBooks}`, 25, 70);
            doc.text(`• Total Categories: ${categoryStats.length}`, 25, 80);

            doc.setLineWidth(0.5);
            doc.line(20, 90, 190, 90);

            let yPosition = 105;

            // Generate and add chart if possible
            const chartImage = await this.generateCategoryChart(categoryStats);
            if (chartImage && categoryStats.length > 0) {
                doc.setFontSize(14);
                doc.setFont(undefined, 'bold');
                doc.text('CATEGORY DISTRIBUTION CHART:', 20, yPosition);
                yPosition += 15;

                try {
                    // Add chart image to PDF
                    doc.addImage(chartImage, 'PNG', 20, yPosition, 170, 120);
                    yPosition += 130;
                } catch (chartError) {
                    console.warn('Failed to add chart to PDF:', chartError);
                }

                if (yPosition > 220) {
                    doc.addPage();
                    yPosition = 30;
                }
            }

            if (categoryStats.length === 0) {
                doc.setFontSize(12);
                doc.text('No category data available.', 20, yPosition);
            } else {
                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text('CATEGORY DISTRIBUTION DETAILS:', 20, yPosition);
                yPosition += 15;

                doc.setFontSize(9);
                doc.text('CATEGORY', 20, yPosition);
                doc.text('BOOKS', 80, yPosition);
                doc.text('TOTAL COPIES', 110, yPosition);
                doc.text('AVAILABLE', 140, yPosition);
                doc.text('BORROWED', 170, yPosition);
                doc.text('PERCENTAGE', 190, yPosition);
                
                doc.setLineWidth(0.3);
                doc.line(20, yPosition + 3, 220, yPosition + 3);
                
                yPosition += 10;
                doc.setFont(undefined, 'normal');

                categoryStats.sort((a, b) => b.bookCount - a.bookCount);

                categoryStats.forEach((category, index) => {
                    if (yPosition > 250) {
                        doc.addPage();
                        yPosition = 30;
                        
                        doc.setFont(undefined, 'bold');
                        doc.setFontSize(9);
                        doc.text('CATEGORY', 20, yPosition);
                        doc.text('BOOKS', 80, yPosition);
                        doc.text('TOTAL COPIES', 110, yPosition);
                        doc.text('AVAILABLE', 140, yPosition);
                        doc.text('BORROWED', 170, yPosition);
                        doc.text('PERCENTAGE', 190, yPosition);
                        doc.line(20, yPosition + 3, 220, yPosition + 3);
                        yPosition += 10;
                        doc.setFont(undefined, 'normal');
                    }

                    if (index % 2 === 0) {
                        doc.setFillColor(248, 249, 250);
                        doc.rect(18, yPosition - 6, 202, 8, 'F');
                    }

                    const percentage = ((category.bookCount / totalBooks) * 100).toFixed(1);
                    const borrowedCopies = category.totalCopies - category.availableCopies;
                    
                    doc.setFontSize(8);
                    doc.text(this.truncateText(category.name, 30), 20, yPosition);
                    doc.text(`${category.bookCount}`, 80, yPosition);
                    doc.text(`${category.totalCopies}`, 110, yPosition);
                    doc.text(`${category.availableCopies}`, 140, yPosition);
                    doc.text(`${borrowedCopies}`, 170, yPosition);
                    doc.text(`${percentage}%`, 190, yPosition);
                    
                    yPosition += 10;
                });

                yPosition += 20;
                if (yPosition > 220) {
                    doc.addPage();
                    yPosition = 30;
                }

                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text('VISUAL DISTRIBUTION (Top 10 Categories):', 20, yPosition);
                yPosition += 15;

                const topCategories = categoryStats.slice(0, 10);
                const maxCount = Math.max(...topCategories.map(cat => cat.bookCount));

                topCategories.forEach((category, index) => {
                    if (yPosition > 250) {
                        doc.addPage();
                        yPosition = 30;
                    }

                    const barWidth = (category.bookCount / maxCount) * 120;
                    const barHeight = 8;

                    doc.setFillColor(52, 152, 219);
                    doc.rect(20, yPosition - 3, barWidth, barHeight, 'F');
                    
                    doc.setFontSize(8);
                    doc.setFont(undefined, 'normal');
                    doc.text(`${this.truncateText(category.name, 25)} (${category.bookCount} books)`, 145, yPosition + 2);
                    
                    yPosition += 15;
                });
            }

            this.addFooter(doc, 'Category Distribution Report');

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
            const filename = `category-distribution-report-${timestamp}.pdf`;

            doc.save(filename);

        } catch (error) {
            console.error('Error generating category distribution PDF:', error);
            this.showError(`Failed to generate PDF: ${error.message}`);
        }
    }

    async generatePopularBooksPDF(borrowings, books) {
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

            doc.setProperties({
                title: 'Popular Books Report',
                subject: 'Library Management System Report',
                author: 'Library Management System',
                keywords: 'library, books, popular, borrowing, report',
                creator: 'Library Management System'
            });

            doc.setFontSize(22);
            doc.setFont(undefined, 'bold');
            doc.text('POPULAR BOOKS REPORT', 105, 30, { align: 'center' });

            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');
            doc.text(`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 20, 45);

            const popularBooks = this.calculatePopularBooks(borrowings, books);

            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('SUMMARY:', 20, 60);
            
            doc.setFont(undefined, 'normal');
            doc.text(`• Total Borrowings: ${borrowings.length}`, 25, 70);
            doc.text(`• Unique Books Borrowed: ${popularBooks.length}`, 25, 80);
            if (popularBooks.length > 0) {
                const avgBorrowings = (borrowings.length / popularBooks.length).toFixed(2);
                doc.text(`• Average Borrowings per Book: ${avgBorrowings}`, 25, 90);
            }

            doc.setLineWidth(0.5);
            doc.line(20, 100, 190, 100);

            let yPosition = 115;

            if (popularBooks.length === 0) {
                doc.setFontSize(12);
                doc.text('No borrowing data available.', 20, yPosition);
            } else {
                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text('MOST POPULAR BOOKS (Top 20):', 20, yPosition);
                yPosition += 15;

                doc.setFontSize(9);
                doc.text('RANK', 20, yPosition);
                doc.text('TITLE', 40, yPosition);
                doc.text('AUTHOR', 100, yPosition);
                doc.text('CATEGORY', 140, yPosition);
                doc.text('TIMES BORROWED', 175, yPosition);
                
                doc.setLineWidth(0.3);
                doc.line(20, yPosition + 3, 210, yPosition + 3);
                
                yPosition += 10;
                doc.setFont(undefined, 'normal');

                const topBooks = popularBooks.slice(0, 20);

                topBooks.forEach((book, index) => {
                    if (yPosition > 250) {
                        doc.addPage();
                        yPosition = 30;
                        
                        doc.setFont(undefined, 'bold');
                        doc.setFontSize(9);
                        doc.text('RANK', 20, yPosition);
                        doc.text('TITLE', 40, yPosition);
                        doc.text('AUTHOR', 100, yPosition);
                        doc.text('CATEGORY', 140, yPosition);
                        doc.text('TIMES BORROWED', 175, yPosition);
                        doc.line(20, yPosition + 3, 210, yPosition + 3);
                        yPosition += 10;
                        doc.setFont(undefined, 'normal');
                    }

                    if (index % 2 === 0) {
                        doc.setFillColor(248, 249, 250);
                        doc.rect(18, yPosition - 6, 192, 8, 'F');
                    }

                    doc.setFontSize(8);
                    doc.text(`${index + 1}`, 20, yPosition);
                    doc.text(this.truncateText(book.title || 'No Title', 30), 40, yPosition);
                    doc.text(this.truncateText(book.author || 'Unknown', 20), 100, yPosition);
                    doc.text(this.truncateText(book.category || 'N/A', 18), 140, yPosition);
                    doc.text(`${book.borrowCount}`, 175, yPosition);
                    
                    yPosition += 10;
                });

                if (yPosition > 200) {
                    doc.addPage();
                    yPosition = 30;
                }

                yPosition += 20;
                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text('BORROWING STATISTICS:', 20, yPosition);
                yPosition += 15;

                doc.setFontSize(10);
                doc.setFont(undefined, 'normal');
                
                const totalBorrowings = borrowings.length;
                const uniqueBooks = popularBooks.length;
                const averageBorrowings = uniqueBooks > 0 ? (totalBorrowings / uniqueBooks).toFixed(2) : 0;
                const mostPopularBook = popularBooks[0];

                doc.text(`• Total Borrowings: ${totalBorrowings}`, 25, yPosition);
                yPosition += 10;
                doc.text(`• Unique Books Borrowed: ${uniqueBooks}`, 25, yPosition);
                yPosition += 10;
                doc.text(`• Average Borrowings per Book: ${averageBorrowings}`, 25, yPosition);
                yPosition += 10;
                
                if (mostPopularBook) {
                    doc.text(`• Most Popular Book: "${mostPopularBook.title}" (${mostPopularBook.borrowCount} times)`, 25, yPosition);
                }
            }

            this.addFooter(doc, 'Popular Books Report');

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
            const filename = `popular-books-report-${timestamp}.pdf`;

            doc.save(filename);

        } catch (error) {
            console.error('Error generating popular books PDF:', error);
            this.showError(`Failed to generate PDF: ${error.message}`);
        }
    }

    calculateCategoryDistribution(books) {
        const categoryMap = new Map();

        books.forEach(book => {
            const category = book.category || 'Uncategorized';
            
            if (!categoryMap.has(category)) {
                categoryMap.set(category, {
                    name: category,
                    bookCount: 0,
                    totalCopies: 0,
                    availableCopies: 0
                });
            }

            const categoryData = categoryMap.get(category);
            categoryData.bookCount++;
            categoryData.totalCopies += book.quantity || 0;
            categoryData.availableCopies += book.available_quantity || 0;
        });

        return Array.from(categoryMap.values());
    }

    calculatePopularBooks(borrowings, books) {
        const bookBorrowCounts = new Map();

        borrowings.forEach(borrowing => {
            const bookId = borrowing.book_id;
            bookBorrowCounts.set(bookId, (bookBorrowCounts.get(bookId) || 0) + 1);
        });

        const popularBooks = [];
        bookBorrowCounts.forEach((count, bookId) => {
            const book = books.find(b => b.id == bookId);
            if (book) {
                popularBooks.push({
                    ...book,
                    borrowCount: count
                });
            }
        });

        popularBooks.sort((a, b) => b.borrowCount - a.borrowCount);

        return popularBooks;
    }

    addFooter(doc, reportTitle) {
        const pageCount = doc.internal.getNumberOfPages();
        const pageHeight = 297;
        
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            doc.text(`Page ${i} of ${pageCount}`, 20, pageHeight - 10);
            doc.text(`Library Management System - ${reportTitle}`, 105, pageHeight - 10, { align: 'center' });
        }
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }

    showLoading(message) {
        this.hideLoading();
        
        const loader = document.createElement('div');
        loader.id = 'report-loader';
        loader.innerHTML = `
            <div class="loader-content">
                <div class="spinner"></div>
                <p>${message}</p>
            </div>
        `;
        
        loader.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            backdrop-filter: blur(5px);
        `;
        
        const loaderContent = loader.querySelector('.loader-content');
        loaderContent.style.cssText = `
            text-align: center;
            color: white;
            font-size: 16px;
            background: rgba(255,255,255,0.1);
            padding: 30px;
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.2);
        `;
        
        const spinner = loader.querySelector('.spinner');
        spinner.style.cssText = `
            border: 4px solid rgba(255,255,255,0.3);
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 15px;
        `;
        
        if (!document.querySelector('#spinner-style')) {
            const style = document.createElement('style');
            style.id = 'spinner-style';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(loader);
    }

    hideLoading() {
        const loader = document.getElementById('report-loader');
        if (loader) {
            document.body.removeChild(loader);
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        const existing = document.querySelector('.notification');
        if (existing) {
            existing.remove();
        }

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            max-width: 400px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
        `;
        
        if (type === 'success') {
            notification.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
        } else if (type === 'error') {
            notification.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
        }
        
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.transform = 'translateX(100%)';
                notification.style.opacity = '0';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
        
        // Remove on click
        notification.addEventListener('click', () => {
            notification.style.transform = 'translateX(100%)';
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        });
    }

    // Utility functions
    formatDate(dateString) {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString();
    }
}

// Initialize reports manager when DOM is loaded
let booksReportsManager;

document.addEventListener('DOMContentLoaded', function() {
    booksReportsManager = new BooksReportsManager();
    
    // Add styling for report cards and notifications
    const style = document.createElement('style');
    style.textContent = `
        .report-card {
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            border-radius: 10px;
            overflow: hidden;
        }
        
        .report-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        }
        
        .report-card .btn {
            transition: all 0.3s ease;
            font-weight: 500;
        }
        
        .report-card .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        
        .notification {
            animation: slideInRight 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            transition: all 0.3s ease;
        }
        
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        /* Custom scrollbar for better UX */
        ::-webkit-scrollbar {
            width: 8px;
        }
        
        ::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
            background: #a8a8a8;
        }
    `;
    document.head.appendChild(style);
});

// Export for potential external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BooksReportsManager;
}