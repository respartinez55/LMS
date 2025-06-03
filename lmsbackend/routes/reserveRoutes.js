const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Adjust path as needed

// Generate unique reservation ID
function generateReservationId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `RES-${timestamp}-${random}`.toUpperCase();
}

// Create a new reservation
router.post('/', async (req, res) => {
  try {
    const {
      bookId,
      userId,
      userEmail,
      userName,
      userRole,
      borrowDate,
      dueDate,
      borrowerType,
      lrn,
      section,
      gradeLevel,
      employeeId,
      department
    } = req.body;

    // Validate required fields
    if (!bookId || !userId || !userEmail || !userName || !borrowDate || !dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: bookId, userId, userEmail, userName, borrowDate, dueDate'
      });
    }

    // Check if book exists and get book details
    const bookQuery = 'SELECT * FROM books WHERE id = ? OR isbn = ?';
    const [bookResults] = await db.execute(bookQuery, [bookId, bookId]);

    if (bookResults.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    const book = bookResults[0];

    // Check if book is available
    if (book.quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Book is currently out of stock'
      });
    }

    // Check if user already has a pending or active reservation for this book
    const existingReservationQuery = `
      SELECT * FROM reservations 
      WHERE user_id = ? AND book_id = ? AND status IN ('Pending', 'Approved')
    `;
    const [existingReservations] = await db.execute(existingReservationQuery, [userId, book.id]);

    if (existingReservations.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active reservation for this book'
      });
    }

    // Check user's current active reservations limit
    const activeReservationsQuery = `
      SELECT COUNT(*) as active_count FROM reservations 
      WHERE user_id = ? AND status IN ('Pending', 'Approved')
    `;
    const [activeReservationsResult] = await db.execute(activeReservationsQuery, [userId]);
    const activeCount = activeReservationsResult[0].active_count;

    // Set reservation limits based on user type
    const maxReservationLimit = (userRole === 'teacher' || borrowerType === 'Teacher') ? 10 : 5;
    
    if (activeCount >= maxReservationLimit) {
      return res.status(400).json({
        success: false,
        message: `You have reached the maximum reservation limit (${maxReservationLimit} books)`
      });
    }

    // Generate unique reservation ID
    const reservationId = generateReservationId();

    // Create the reservation
    const insertQuery = `
      INSERT INTO reservations (
        reservation_id, book_id, user_id, user_email, user_name, user_role,
        reserve_date, return_date, book_title, cover_image, status,
        request_date, reserved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const [insertResult] = await db.execute(insertQuery, [
      reservationId,
      book.id,
      userId,
      userEmail,
      userName,
      userRole || 'student',
      borrowDate,
      dueDate,
      book.title,
      book.cover_image || null,
      'Pending'
    ]);

    // Log the reservation activity
    const logQuery = `
      INSERT INTO activity_logs (
        user_id, action, details, timestamp
      ) VALUES (?, ?, ?, NOW())
    `;
    
    await db.execute(logQuery, [
      userId,
      'BOOK_RESERVED',
      `Reserved book: ${book.title} (ID: ${book.id}) for ${borrowDate} to ${dueDate}`
    ]);

    res.json({
      success: true,
      message: 'Book reservation submitted successfully',
      reservationId: reservationId,
      data: {
        id: insertResult.insertId,
        reservationId: reservationId,
        bookId: book.id,
        bookTitle: book.title,
        userId: userId,
        userName: userName,
        reserveDate: borrowDate,
        returnDate: dueDate,
        status: 'Pending'
      }
    });

  } catch (error) {
    console.error('Error creating reservation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while creating reservation',
      error: error.message
    });
  }
});

// Get all reservations (admin view) - MOVED BEFORE STATS ROUTE
router.get('/', async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        r.*,
        b.author,
        b.isbn,
        b.category,
        b.quantity as available_quantity
      FROM reservations r
      LEFT JOIN books b ON r.book_id = b.id
    `;
    
    const queryParams = [];

    // Add status filter if provided
    if (status) {
      query += ' WHERE r.status = ?';
      queryParams.push(status);
    }

    query += ' ORDER BY r.reserved_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));

    const [reservations] = await db.execute(query, queryParams);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM reservations r';
    const countParams = [];
    
    if (status) {
      countQuery += ' WHERE r.status = ?';
      countParams.push(status);
    }

    const [countResult] = await db.execute(countQuery, countParams);
    const totalCount = countResult[0].total;

    // Transform reservations for consistent response format
    const transformedReservations = reservations.map(reservation => ({
      id: reservation.id,
      reservation_id: reservation.reservation_id,
      book_id: reservation.book_id,
      book_title: reservation.book_title,
      author: reservation.author,
      isbn: reservation.isbn,
      cover_image: reservation.cover_image,
      category: reservation.category,
      available_quantity: reservation.available_quantity,
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

    res.json({
      success: true,
      reservations: transformedReservations,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error fetching all reservations:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching reservations',
      error: error.message
    });
  }
});

// Get reservation statistics - MOVED BEFORE PARAMETERIZED ROUTES
router.get('/stats', async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        status,
        COUNT(*) as count
      FROM reservations
      GROUP BY status
    `;
    
    const [stats] = await db.execute(statsQuery);
    
    // Get expired reservations (past return date and still pending/approved)
    const expiredQuery = `
      SELECT COUNT(*) as expired_count
      FROM reservations
      WHERE status IN ('Pending', 'Approved') AND return_date < CURDATE()
    `;
    
    const [expiredResult] = await db.execute(expiredQuery);
    
    // Transform stats into a more usable format
    const statusStats = {};
    stats.forEach(stat => {
      statusStats[stat.status.toLowerCase()] = stat.count;
    });

    res.json({
      success: true,
      stats: {
        ...statusStats,
        expired: expiredResult[0].expired_count,
        total: stats.reduce((sum, stat) => sum + stat.count, 0)
      }
    });

  } catch (error) {
    console.error('Error fetching reservation statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching statistics',
      error: error.message
    });
  }
});

// Mark expired reservations (utility endpoint) - MOVED BEFORE PARAMETERIZED ROUTES
router.post('/mark-expired', async (req, res) => {
  try {
    // Find reservations that are past their return date and still pending/approved
    const expiredQuery = `
      UPDATE reservations 
      SET status = 'Expired', reserved_at = NOW()
      WHERE status IN ('Pending', 'Approved') AND return_date < CURDATE()
    `;
    
    const [result] = await db.execute(expiredQuery);
    
    // Restore book quantities for expired approved reservations
    const restoreQuantityQuery = `
      UPDATE books b
      JOIN reservations r ON b.id = r.book_id
      SET b.quantity = b.quantity + 1
      WHERE r.status = 'Expired' AND r.reserved_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)
    `;
    
    await db.execute(restoreQuantityQuery);

    res.json({
      success: true,
      message: `Marked ${result.affectedRows} reservations as expired`,
      expiredCount: result.affectedRows
    });

  } catch (error) {
    console.error('Error marking expired reservations:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while marking expired reservations',
      error: error.message
    });
  }
});

// SIMPLE STATUS UPDATE - FIXED VERSION
router.post('/:reservationId/status', async (req, res) => {
  try {
    const { reservationId } = req.params;
    const { status } = req.body;

    console.log('Updating reservation:', reservationId, 'to status:', status);

    // Simple validation
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    // Check if reservation exists using reservation_id
    const checkQuery = 'SELECT * FROM reservations WHERE reservation_id = ?';
    const [existingReservation] = await db.execute(checkQuery, [reservationId]);

    if (existingReservation.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    // Simple update - just change the status
    const updateQuery = 'UPDATE reservations SET status = ? WHERE reservation_id = ?';
    const [result] = await db.execute(updateQuery, [status, reservationId]);

    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: 'Failed to update reservation status'
      });
    }

    res.json({
      success: true,
      message: `Reservation ${status.toLowerCase()} successfully!`
    });

  } catch (error) {
    console.error('Error updating reservation status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating reservation status',
      error: error.message
    });
  }
});

// Get all reservations for a specific user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query; // Optional status filter

    let query = `
      SELECT 
        r.*,
        b.author,
        b.isbn,
        b.category,
        b.description,
        b.quantity as available_quantity
      FROM reservations r
      LEFT JOIN books b ON r.book_id = b.id
      WHERE r.user_id = ?
    `;
    
    const queryParams = [userId];

    // Add status filter if provided
    if (status) {
      query += ' AND r.status = ?';
      queryParams.push(status);
    }

    query += ' ORDER BY r.reserved_at DESC';

    const [reservations] = await db.execute(query, queryParams);

    // Transform the data to match frontend expectations
    const transformedReservations = reservations.map(reservation => ({
      // Reservation info
      id: reservation.id,
      reservation_id: reservation.reservation_id,
      book_id: reservation.book_id,
      
      // Book info
      title: reservation.book_title,
      author: reservation.author,
      isbn: reservation.isbn,
      cover_image: reservation.cover_image,
      category: reservation.category,
      description: reservation.description,
      available_quantity: reservation.available_quantity,
      
      // Dates
      borrowDate: reservation.reserve_date,
      dueDate: reservation.return_date,
      reserveDate: reservation.reserve_date,
      returnDate: reservation.return_date,
      
      // Status and metadata
      status: reservation.status,
      request_date: reservation.request_date,
      reserved_at: reservation.reserved_at,
      
      // User info
      user_id: reservation.user_id,
      user_name: reservation.user_name,
      user_email: reservation.user_email,
      user_role: reservation.user_role
    }));

    res.json({
      success: true,
      reservations: transformedReservations,
      borrowedBooks: transformedReservations, // For backward compatibility
      count: transformedReservations.length
    });

  } catch (error) {
    console.error('Error fetching user reservations:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching reservations',
      error: error.message
    });
  }
});

// Cancel a reservation (user action)
router.delete('/:reservationId', async (req, res) => {
  try {
    const { reservationId } = req.params;
    const { userId } = req.body;

    // Check if reservation exists and belongs to user
    const checkQuery = `
      SELECT r.*, b.title as book_title
      FROM reservations r
      LEFT JOIN books b ON r.book_id = b.id
      WHERE (r.id = ? OR r.reservation_id = ?) AND r.user_id = ?
    `;
    const [reservation] = await db.execute(checkQuery, [reservationId, reservationId, userId]);

    if (reservation.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found or you do not have permission to cancel it'
      });
    }

    const reservationData = reservation[0];

    // Only allow cancellation of pending or approved reservations
    if (!['Pending', 'Approved'].includes(reservationData.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel reservation with current status'
      });
    }

    // Update status to cancelled
    await db.execute(
      'UPDATE reservations SET status = ?, reserved_at = NOW() WHERE id = ?',
      ['Cancelled', reservationData.id]
    );

    // If it was approved, restore book quantity
    if (reservationData.status === 'Approved') {
      await db.execute(
        'UPDATE books SET quantity = quantity + 1 WHERE id = ?',
        [reservationData.book_id]
      );
    }

    // Log the cancellation
    const logQuery = `
      INSERT INTO activity_logs (
        user_id, action, details, timestamp
      ) VALUES (?, ?, ?, NOW())
    `;
    
    await db.execute(logQuery, [
      userId,
      'RESERVATION_CANCELLED',
      `Cancelled reservation ${reservationData.reservation_id} for "${reservationData.book_title}"`
    ]);

    res.json({
      success: true,
      message: 'Reservation cancelled successfully',
      data: {
        id: reservationData.id,
        reservationId: reservationData.reservation_id,
        bookTitle: reservationData.book_title
      }
    });

  } catch (error) {
    console.error('Error cancelling reservation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while cancelling reservation',
      error: error.message
    });
  }
});

// Get reservation by ID or reservation_id
router.get('/:reservationId', async (req, res) => {
  try {
    const { reservationId } = req.params;

    const query = `
      SELECT 
        r.*,
        b.author,
        b.isbn,
        b.category,
        b.description,
        b.quantity as available_quantity
      FROM reservations r
      LEFT JOIN books b ON r.book_id = b.id
      WHERE r.id = ? OR r.reservation_id = ?
    `;

    const [reservations] = await db.execute(query, [reservationId, reservationId]);

    if (reservations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    const reservation = reservations[0];

    const transformedReservation = {
      id: reservation.id,
      reservation_id: reservation.reservation_id,
      book_id: reservation.book_id,
      book_title: reservation.book_title,
      author: reservation.author,
      isbn: reservation.isbn,
      cover_image: reservation.cover_image,
      category: reservation.category,
      description: reservation.description,
      available_quantity: reservation.available_quantity,
      user_id: reservation.user_id,
      user_name: reservation.user_name,
      user_email: reservation.user_email,
      user_role: reservation.user_role,
      reserve_date: reservation.reserve_date,
      return_date: reservation.return_date,
      status: reservation.status,
      request_date: reservation.request_date,
      reserved_at: reservation.reserved_at
    };

    res.json({
      success: true,
      reservation: transformedReservation
    });

  } catch (error) {
    console.error('Error fetching reservation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching reservation',
      error: error.message
    });
  }
});

module.exports = router;