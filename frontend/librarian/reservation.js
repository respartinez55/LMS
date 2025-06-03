const API_BASE_URL = 'http://localhost:5000/api';

class ReservationsReportsManager {
    constructor() {
        this.initializeEventListeners();
        this.loadjsPDF();
        this.loadChartJS();
    }

    initializeEventListeners() {
        const reservationsReportBtn = document.querySelector('#reservations-report .btn');
        if (reservationsReportBtn) {
            reservationsReportBtn.addEventListener('click', () => {
                this.generateReservationsReport();
            });
        }

        const customReservationsBtn = document.getElementById('generateCustomReservationsBtn');
        if (customReservationsBtn) {
            customReservationsBtn.addEventListener('click', () => {
                this.generateCustomReservationsReport();
            });
        }

        this.setDefaultDates();
    }

    setDefaultDates() {
        const today = new Date().toISOString().split('T')[0];
        const endDateInput = document.getElementById('reservationsEndDate');
        const startDateInput = document.getElementById('reservationsStartDate');
        
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

    async generateReservationsReport(startDate = null, endDate = null) {
        try {
            this.showLoading('Generating reservations report...');
            
            // Fetch all reservations data
            const reservationsResponse = await fetch(`${API_BASE_URL}/reservations`);
            
            if (!reservationsResponse.ok) {
                throw new Error(`Failed to fetch reservations data: ${reservationsResponse.status} ${reservationsResponse.statusText}`);
            }

            const reservationsData = await reservationsResponse.json();
            
            if (reservationsData.success && reservationsData.reservations) {
                // Fetch reservation statistics
                const statsResponse = await fetch(`${API_BASE_URL}/reservations/stats`);
                let stats = null;
                
                if (statsResponse.ok) {
                    const statsData = await statsResponse.json();
                    if (statsData.success) {
                        stats = statsData.stats;
                    }
                }

                // Transform reservations data
                const transformedReservations = reservationsData.reservations.map(reservation => ({
                    id: reservation.id,
                    reservation_id: reservation.reservation_id,
                    book_id: reservation.book_id,
                    book_title: reservation.book_title,
                    author: reservation.author,
                    isbn: reservation.isbn,
                    user_id: reservation.user_id,
                    user_name: reservation.user_name,
                    user_email: reservation.user_email,
                    user_role: reservation.user_role,
                    reserve_date: reservation.reserve_date,
                    return_date: reservation.return_date,
                    status: reservation.status,
                    request_date: reservation.request_date,
                    reserved_at: reservation.reserved_at
                }));

                await this.generateReservationsPDFReport(
                    transformedReservations,
                    stats,
                    startDate,
                    endDate
                );
            } else {
                throw new Error('No reservations data available');
            }

        } catch (error) {
            console.error('Error generating reservations report:', error);
            this.showError(`Failed to generate reservations report: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    generateCustomReservationsReport() {
        const startDate = document.getElementById('reservationsStartDate')?.value;
        const endDate = document.getElementById('reservationsEndDate')?.value;

        if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
            this.showError('Start date cannot be later than end date');
            return;
        }

        this.generateReservationsReport(startDate, endDate);
    }

    async generateReservationStatusChart(reservations, stats) {
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
                const statusCounts = this.calculateStatusCounts(reservations);

                const chart = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Pending', 'Approved', 'Expired', 'Cancelled'],
                        datasets: [{
                            data: [
                                statusCounts.pending || 0,
                                statusCounts.approved || 0,
                                statusCounts.expired || 0,
                                statusCounts.cancelled || 0
                            ],
                            backgroundColor: [
                                'rgba(255, 193, 7, 0.8)',   // Yellow for Pending
                                'rgba(40, 167, 69, 0.8)',   // Green for Approved
                                'rgba(220, 53, 69, 0.8)',   // Red for Expired
                                'rgba(108, 117, 125, 0.8)'  // Gray for Cancelled
                            ],
                            borderColor: [
                                'rgba(255, 193, 7, 1)',
                                'rgba(40, 167, 69, 1)',
                                'rgba(220, 53, 69, 1)',
                                'rgba(108, 117, 125, 1)'
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
                                text: 'Reservations by Status',
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
                console.error('Error generating status chart:', error);
                resolve(null);
            }
        });
    }

    async generateWaitingTimeChart(reservations) {
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
                const waitingTimeData = this.calculateWaitingTimeDistribution(reservations);

                const chart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: waitingTimeData.map(item => item.range),
                        datasets: [{
                            label: 'Number of Reservations',
                            data: waitingTimeData.map(item => item.count),
                            backgroundColor: 'rgba(54, 162, 235, 0.8)',
                            borderColor: 'rgba(54, 162, 235, 1)',
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: false,
                        maintainAspectRatio: false,
                        plugins: {
                            title: {
                                display: true,
                                text: 'Waiting Time Distribution',
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
                            y: { 
                                beginAtZero: true,
                                title: {
                                    display: true,
                                    text: 'Number of Reservations'
                                }
                            },
                            x: {
                                title: {
                                    display: true,
                                    text: 'Waiting Time (Days)'
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
                console.error('Error generating waiting time chart:', error);
                resolve(null);
            }
        });
    }

    async generateReservationsPDFReport(reservations, stats, startDate = null, endDate = null) {
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

            // Filter reservations by date range if specified
            let filteredReservations = reservations;
            if (startDate && endDate) {
                filteredReservations = reservations.filter(reservation => {
                    const reserveDate = new Date(reservation.request_date || reservation.reserved_at);
                    return reserveDate >= new Date(startDate) && reserveDate <= new Date(endDate);
                });
            }

            // Title and Header
            doc.setFontSize(22);
            doc.setFont(undefined, 'bold');
            doc.text('RESERVATIONS REPORT', 105, 30, { align: 'center' });

            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');
            doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 45);
            
            if (startDate && endDate) {
                doc.text(`Period: ${this.formatDate(startDate)} to ${this.formatDate(endDate)}`, 20, 55);
            }

            let yPos = 70;

            // Add section header for reservations summary
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            yPos -= 15;
            doc.text('RESERVATIONS SUMMARY:', 20, yPos);
            yPos += 15;

            // Generate charts
            const [statusChart, waitingTimeChart] = await Promise.all([
                this.generateReservationStatusChart(filteredReservations, stats),
                this.generateWaitingTimeChart(filteredReservations)
            ]);

            if (statusChart && waitingTimeChart) {
                try {
                    // Add status chart (centered)
                    doc.addImage(statusChart, 'PNG', 55, yPos, 100, 75);
                    yPos += 85;
                    
                    // Add waiting time analysis header
                    doc.setFontSize(14);
                    doc.setFont(undefined, 'bold');
                    doc.text('WAITING TIME ANALYSIS:', 20, yPos);
                    yPos += 15;
                    
                    // Add waiting time chart (centered)
                    doc.addImage(waitingTimeChart, 'PNG', 35, yPos, 140, 70);
                    yPos += 80;
                } catch (chartError) {
                    console.warn('Failed to add charts to PDF:', chartError);
                    this.addTextualSummary(doc, filteredReservations, stats, yPos);
                    yPos += 60;
                }
            } else {
                // Fallback to text summary
                yPos = this.addTextualSummary(doc, filteredReservations, stats, yPos);
            }

            // Check if we need a new page for the recent reservations section
            if (yPos > 200) {
                doc.addPage();
                yPos = 30;
            }

            // Recent reservations table  
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text('RECENT RESERVATIONS:', 20, yPos);
            yPos += 15;

            const recentReservations = this.getRecentReservations(filteredReservations, 15);

            if (recentReservations.length === 0) {
                doc.setFontSize(10);
                doc.setFont(undefined, 'normal');
                doc.text('No recent reservations found.', 20, yPos);
            } else {
                doc.setFontSize(8);
                doc.setFont(undefined, 'bold');
                doc.text('DATE', 20, yPos);
                doc.text('BOOK', 50, yPos);
                doc.text('USER', 110, yPos);
                doc.text('STATUS', 160, yPos);
                
                doc.line(20, yPos + 3, 190, yPos + 3);
                yPos += 10;
                doc.setFont(undefined, 'normal');

                recentReservations.forEach((reservation, index) => {
                    if (yPos > 260) {
                        doc.addPage();
                        yPos = 30;
                        
                        doc.setFont(undefined, 'bold');
                        doc.text('DATE', 20, yPos);
                        doc.text('BOOK', 50, yPos);
                        doc.text('USER', 110, yPos);
                        doc.text('STATUS', 160, yPos);
                        doc.line(20, yPos + 3, 190, yPos + 3);
                        yPos += 10;
                        doc.setFont(undefined, 'normal');
                    }

                    doc.text(this.formatDate(reservation.request_date || reservation.reserved_at), 20, yPos);
                    doc.text(this.truncateText(reservation.book_title || 'N/A', 30), 50, yPos);
                    doc.text(this.truncateText(reservation.user_name || 'N/A', 25), 110, yPos);
                    doc.text(reservation.status || 'Pending', 160, yPos);
                    
                    yPos += 8;
                });
            }

            // Add footer
            this.addFooter(doc, 'Reservations Report');

            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `reservations-report-${timestamp}.pdf`;
            doc.save(filename);

        } catch (error) {
            console.error('Error generating PDF:', error);
            this.showError(`Failed to generate PDF: ${error.message}`);
        }
    }

    addTextualSummary(doc, reservations, stats, yPos) {
        const reservationStats = this.calculateReservationStatistics(reservations, stats);
        
        doc.setFont(undefined, 'normal');
        doc.text(`• Total Reservations: ${reservationStats.totalReservations}`, 25, yPos);
        yPos += 10;
        doc.text(`• Pending Reservations: ${reservationStats.pendingReservations}`, 25, yPos);
        yPos += 10;
        doc.text(`• Approved Reservations: ${reservationStats.approvedReservations}`, 25, yPos);
        yPos += 10;
        doc.text(`• Expired Reservations: ${reservationStats.expiredReservations}`, 25, yPos);
        yPos += 10;
        doc.text(`• Average Waiting Time: ${reservationStats.avgWaitingTime} days`, 25, yPos);
        yPos += 10;
        doc.text(`• Most Reserved Book: ${reservationStats.mostReservedBook}`, 25, yPos);
        yPos += 20;
        
        return yPos;
    }

    calculateReservationStatistics(reservations, stats) {
        const totalReservations = reservations.length;
        const statusCounts = this.calculateStatusCounts(reservations);
        const avgWaitingTime = this.calculateAverageWaitingTime(reservations);
        const mostReservedBook = this.getMostReservedBook(reservations);

        return {
            totalReservations,
            pendingReservations: statusCounts.pending || 0,
            approvedReservations: statusCounts.approved || 0,
            expiredReservations: statusCounts.expired || 0,
            cancelledReservations: statusCounts.cancelled || 0,
            avgWaitingTime: avgWaitingTime.toFixed(1),
            mostReservedBook: mostReservedBook || 'N/A'
        };
    }

    calculateStatusCounts(reservations) {
        const counts = {};
        reservations.forEach(reservation => {
            const status = reservation.status.toLowerCase();
            counts[status] = (counts[status] || 0) + 1;
        });
        return counts;
    }

    calculateAverageWaitingTime(reservations) {
        const completedReservations = reservations.filter(r => 
            r.status === 'Approved' || r.status === 'Expired' || r.status === 'Cancelled'
        );

        if (completedReservations.length === 0) return 0;

        const totalWaitingTime = completedReservations.reduce((sum, reservation) => {
            const requestDate = new Date(reservation.request_date || reservation.reserved_at);
            const completionDate = new Date(reservation.reserved_at);
            const waitingDays = Math.max(0, (completionDate - requestDate) / (1000 * 60 * 60 * 24));
            return sum + waitingDays;
        }, 0);

        return totalWaitingTime / completedReservations.length;
    }

    calculateWaitingTimeDistribution(reservations) {
        const ranges = [
            { range: '0-1 days', min: 0, max: 1 },
            { range: '2-3 days', min: 2, max: 3 },
            { range: '4-7 days', min: 4, max: 7 },
            { range: '8-14 days', min: 8, max: 14 },
            { range: '15+ days', min: 15, max: Infinity }
        ];

        const distribution = ranges.map(range => ({ ...range, count: 0 }));

        reservations.forEach(reservation => {
            const requestDate = new Date(reservation.request_date || reservation.reserved_at);
            const now = new Date();
            const waitingDays = (now - requestDate) / (1000 * 60 * 60 * 24);

            const rangeIndex = distribution.findIndex(range => 
                waitingDays >= range.min && waitingDays <= range.max
            );
            
            if (rangeIndex !== -1) {
                distribution[rangeIndex].count++;
            }
        });

        return distribution;
    }

    getMostReservedBook(reservations) {
        const bookCounts = {};
        
        reservations.forEach(reservation => {
            const bookTitle = reservation.book_title;
            if (bookTitle) {
                bookCounts[bookTitle] = (bookCounts[bookTitle] || 0) + 1;
            }
        });

        let mostReserved = null;
        let maxCount = 0;

        Object.entries(bookCounts).forEach(([title, count]) => {
            if (count > maxCount) {
                maxCount = count;
                mostReserved = title;
            }
        });

        return mostReserved;
    }

    getRecentReservations(reservations, limit = 15) {
        return reservations
            .sort((a, b) => new Date(b.request_date || b.reserved_at) - new Date(a.request_date || a.reserved_at))
            .slice(0, limit);
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

// Initialize the reservations reports manager
document.addEventListener('DOMContentLoaded', () => {
    new ReservationsReportsManager();
});