const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { isLibrarian } = require('../middleware/authMiddleware');

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get dashboard statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    // Get total books count
    const [totalBooksResult] = await connection.query('SELECT COUNT(*) as total FROM books');
    const totalBooks = totalBooksResult[0].total;
    
    // Get issued books count
    const [issuedBooksResult] = await connection.query('SELECT COUNT(*) as total FROM books WHERE status = "Issued"');
    const issuedBooks = issuedBooksResult[0].total;
    
    // Get pending reservations count
    const [pendingReservationsResult] = await connection.query('SELECT COUNT(*) as total FROM reservations WHERE status = "Pending"');
    const pendingReservations = pendingReservationsResult[0].total || 0;
    
    // Get total fines
    const [totalFinesResult] = await connection.query('SELECT SUM(fine_amount) as total FROM issue_records WHERE fine_paid = FALSE');
    const totalFines = totalFinesResult[0].total || 0;
    
    connection.release();
    
    res.json({
      success: true,
      totalBooks,
      issuedBooks,
      pendingReservations,
      totalFines
    });
  } catch (error) {
    console.error('❌ Error fetching dashboard stats:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics'
    });
  }
});

module.exports = router;