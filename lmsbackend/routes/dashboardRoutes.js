const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get dashboard statistics based on approved borrowings only
 */
router.get('/stats', async (req, res) => {
  try {
    const connection = await pool.getConnection();

    // Total books count
    const [totalBooksResult] = await connection.query('SELECT COUNT(*) as total FROM books');
    const totalBooks = totalBooksResult[0].total || 0;

    // Borrowed books count (approved and not yet returned)
    const [borrowedBooksResult] = await connection.query(
      `SELECT COUNT(*) as total FROM borrowings 
       WHERE return_date IS NULL AND status IN ('Borrowed', 'Overdue')`
    );
    const borrowedBooks = borrowedBooksResult[0].total || 0;

    // Overdue books count (approved, not yet returned and past due date)
    const [overdueBooksListResult] = await connection.query(
      `SELECT 
          b.id AS book_id,
          b.title,
          b.author,
          br.user_name,
          br.user_id,
          br.due_date
        FROM borrowings br
        JOIN books b ON br.book_id = b.id
        WHERE br.return_date IS NULL 
        AND br.due_date < CURDATE() 
        AND br.status IN ('Borrowed', 'Overdue')`
    );
    const overdueBooksList = overdueBooksListResult || [];
    const overdueBooksCount = overdueBooksList.length;

    // Pending reservations
    const [pendingReservationsResult] = await connection.query(
      `SELECT COUNT(*) as total FROM reservations WHERE status = 'Pending'`
    );
    const pendingReservations = pendingReservationsResult[0].total || 0;

    // --- Monthly Circulations (Only approved borrowings per month for the last 12 months) ---
    const [monthlyCirculations] = await connection.query(`
      SELECT 
        DATE_FORMAT(borrow_date, '%Y-%m') AS month,
        COUNT(*) AS borrow_count
      FROM borrowings
      WHERE borrow_date >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 11 MONTH), '%Y-%m-01')
      AND status IN ('Borrowed', 'Returned', 'Overdue')
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `);

    // --- Popular Categories (most borrowed categories from approved borrowings only) ---
    const [popularCategories] = await connection.query(`
      SELECT 
        b.category,
        COUNT(*) AS borrow_count
      FROM borrowings br
      JOIN books b ON br.book_id = b.id
      WHERE br.status IN ('Borrowed', 'Returned', 'Overdue')
      GROUP BY b.category
      ORDER BY borrow_count DESC, b.category ASC
    `);

    // --- Recent Borrowed Books (last 10 approved borrowings, most recent first) ---
    const [recentBorrowedBooks] = await connection.query(`
      SELECT 
        b.title,
        br.user_name,
        br.borrow_date,
        br.due_date,
        CASE 
          WHEN br.return_date IS NOT NULL THEN 'Returned'
          WHEN br.due_date < CURDATE() AND br.return_date IS NULL THEN 'Overdue'
          WHEN br.return_date IS NULL THEN 'Borrowed'
          ELSE br.status
        END AS status
      FROM borrowings br
      JOIN books b ON br.book_id = b.id
      WHERE br.status IN ('Borrowed', 'Returned', 'Overdue')
      ORDER BY br.borrow_date DESC
      LIMIT 10
    `);

    connection.release();

    res.json({
      success: true,
      totalBooks,
      borrowedBooks,
      overdueBooks: overdueBooksCount,
      pendingReservations,
      overdueBooksList, // Array of overdue book details
      monthlyCirculations, // Array: [{ month: 'YYYY-MM', borrow_count: N }, ...]
      popularCategories,   // Array: [{ category: 'Category Name', borrow_count: N }, ...]
      recentBorrowedBooks, // Array: [{ title, user_name, borrow_date, due_date, status }, ...]
    });
  } catch (error) {
    console.error('❌ Error fetching dashboard stats:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
    });
  }
});

module.exports = router;