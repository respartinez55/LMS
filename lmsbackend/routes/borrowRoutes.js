const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");

/**
 * @route   POST /api/borrow
 * @desc    Borrow a book (insert into borrowings table)
 * @body    { bookId, userId, userRole, ... } // userRole determines initial status
 */
router.post("/", async (req, res) => {
  try {
    const {
      bookId,
      userId,
      userEmail,
      userName,
      userRole, // 'borrower' or 'librarian'
      borrowDate,
      dueDate,
      returnDate = null,
      transactionId = null,
      borrowerType,
      lrn,
      employeeId,
      section,
      gradeLevel, // Changed from 'grade' to match DB schema
      department,
      status: requestedStatus
    } = req.body;

    // Determine status based on user role or explicit status
    // If librarian or explicitly approved: Borrowed (automatic approval - direct issue)
    // If borrower: Pending (needs librarian approval)
    const status = requestedStatus === 'approved' || userRole === 'librarian' ? 'Borrowed' : 'Pending';

    if (!bookId || !userId || !userName || !borrowDate || !dueDate) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: bookId, userId, userName, borrowDate, dueDate",
      });
    }

    const connection = await pool.getConnection();

    try {
      // Check if the book exists and get its availability
      const [bookCheck] = await connection.query(`
        SELECT 
          b.id,
          b.title,
          b.quantity,
          b.available_quantity,
          b.status as book_status,
          COUNT(br.id) as active_borrows
        FROM books b
        LEFT JOIN borrowings br ON b.id = br.book_id AND br.status IN ('Borrowed', 'Overdue')
        WHERE b.id = ?
        GROUP BY b.id
      `, [bookId]);

      if (bookCheck.length === 0) {
        connection.release();
        return res.status(404).json({
          success: false,
          message: "Book not found",
        });
      }

      const book = bookCheck[0];
      const totalQuantity = Number(book.quantity) || 1;
      const availableQuantity = Number(book.available_quantity) || 0;

      // Check availability using available_quantity
      if (availableQuantity <= 0) {
        connection.release();
        return res.status(400).json({
          success: false,
          message: `Book "${book.title}" is not available for borrowing. All ${totalQuantity} copies are currently borrowed.`,
        });
      }

      await connection.beginTransaction();

      const transaction_id =
        transactionId ||
        `TR-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`;

      // Insert borrowing record with fields that match the database schema
      const [borrowResult] = await connection.query(
        `INSERT INTO borrowings (
          transaction_id, book_id, user_id, user_email, user_name, borrow_date, due_date, return_date, status,
          borrower_type, lrn, employee_id, section, grade_level, department
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transaction_id,
          bookId,
          userId,
          userEmail,
          userName,
          borrowDate,
          dueDate,
          returnDate,
          status,
          borrowerType || 'Student',
          lrn,
          employeeId,
          section,
          gradeLevel, // Fixed field name
          department
        ]
      );

      // Update book's available_quantity (decrease by 1)
      const newAvailableQuantity = Math.max(0, availableQuantity - 1);
      await connection.query(
        "UPDATE books SET available_quantity = ? WHERE id = ?",
        [newAvailableQuantity, bookId]
      );

      await connection.commit();
      connection.release();

      return res.status(201).json({
        success: true,
        message: status === 'Borrowed' ? "Book issued successfully" : "Borrow request submitted successfully",
        transactionId: transaction_id,
        borrowingId: borrowResult.insertId,
        status: status,
        isDirectIssue: status === 'Borrowed',
        bookInfo: {
          title: book.title,
          availableAfter: newAvailableQuantity,
          totalQuantity: totalQuantity
        }
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error("❌ Error processing borrow request:", error.message || error);
    return res.status(500).json({
      success: false,
      message: "Failed to process borrow request: " + error.message,
    });
  }
});

/**
 * @route   POST /api/borrow/direct
 * @desc    Direct book issuance (for walk-in borrowers, automatically approved)
 * @body    { bookId, userId, userName, borrowDate, dueDate, borrowerType, ... }
 */
router.post("/direct", async (req, res) => {
  try {
    const {
      bookId,
      userId,
      userEmail,
      userName,
      borrowDate,
      dueDate,
      borrowerType,
      lrn,
      employeeId,
      section,
      gradeLevel, // Changed from 'grade' to match DB schema
      department,
      transactionId = null
    } = req.body;

    if (!bookId || !userId || !userName || !borrowDate || !dueDate) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: bookId, userId, userName, borrowDate, dueDate",
      });
    }

    const connection = await pool.getConnection();

    try {
      // Check if the book exists and get its availability
      const [bookCheck] = await connection.query(`
        SELECT 
          b.id,
          b.title,
          b.quantity,
          b.available_quantity
        FROM books b
        WHERE b.id = ?
      `, [bookId]);

      if (bookCheck.length === 0) {
        connection.release();
        return res.status(404).json({
          success: false,
          message: "Book not found",
        });
      }

      const book = bookCheck[0];
      const totalQuantity = Number(book.quantity) || 1;
      const availableQuantity = Number(book.available_quantity) || 0;

      // Check availability using available_quantity
      if (availableQuantity <= 0) {
        connection.release();
        return res.status(400).json({
          success: false,
          message: `Book "${book.title}" is not available for borrowing. All ${totalQuantity} copies are currently borrowed.`,
        });
      }

      await connection.beginTransaction();

      const transaction_id =
        transactionId ||
        `TR-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`;

      // Insert borrowing record with status 'Borrowed' (direct approval)
      const [borrowResult] = await connection.query(
        `INSERT INTO borrowings (
          transaction_id, book_id, user_id, user_email, user_name, borrow_date, due_date, status,
          borrower_type, lrn, employee_id, section, grade_level, department
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Borrowed', ?, ?, ?, ?, ?, ?)`,
        [
          transaction_id,
          bookId,
          userId,
          userEmail,
          userName,
          borrowDate,
          dueDate,
          borrowerType || 'Student',
          lrn,
          employeeId,
          section,
          gradeLevel, // Fixed field name
          department
        ]
      );

      // Update book's available_quantity (decrease by 1)
      const newAvailableQuantity = Math.max(0, availableQuantity - 1);
      await connection.query(
        "UPDATE books SET available_quantity = ? WHERE id = ?",
        [newAvailableQuantity, bookId]
      );

      await connection.commit();
      connection.release();

      return res.status(201).json({
        success: true,
        message: "Book issued successfully",
        transactionId: transaction_id,
        borrowingId: borrowResult.insertId,
        status: 'Borrowed',
        isDirectIssue: true,
        bookInfo: {
          title: book.title,
          availableAfter: newAvailableQuantity,
          totalQuantity: totalQuantity
        }
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error("❌ Error processing direct borrow request:", error.message || error);
    return res.status(500).json({
      success: false,
      message: "Failed to process direct borrow request: " + error.message,
    });
  }
});

/**
 * @route   GET /api/borrow/borrowed/:userId
 * @desc    Get all books borrowed by a user (from borrowings table)
 */
router.get("/borrowed/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const connection = await pool.getConnection();

    const [borrowedBooks] = await connection.query(
      `SELECT 
         b.id, 
         b.title, 
         b.author, 
         b.isbn, 
         br.transaction_id, 
         br.borrow_date AS borrowDate, 
         br.due_date AS dueDate, 
         br.return_date AS returnDate,
         br.status,
         b.cover_image
       FROM borrowings br
       JOIN books b ON br.book_id = b.id
       WHERE br.user_id = ?
       ORDER BY br.borrow_date DESC`,
      [userId]
    );
    connection.release();

    const booksWithUrls = borrowedBooks.map((book) => ({
      ...book,
      cover_image: book.cover_image ? `${req.protocol}://${req.get("host")}/uploads/${book.cover_image}` : null,
    }));

    res.status(200).json({
      success: true,
      borrowedBooks: booksWithUrls,
    });
  } catch (error) {
    console.error("❌ Error fetching borrowed books:", error.message || error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch borrowed books",
    });
  }
});

/**
 * @route   GET /api/borrow/borrowings/recent
 * @desc    Get all recent borrowings (for librarian dashboard) - Recently Issued Books
 */
router.get("/borrowings/recent", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    // FIXED: Include all borrower details from the borrowings table
    const [borrowings] = await connection.query(
      `SELECT 
         br.id AS borrowing_id,
         br.transaction_id, 
         br.book_id,
         br.user_id,
         br.user_email,
         br.user_name,
         br.borrower_type,
         br.lrn,
         br.section,
         br.grade_level,
         br.employee_id,
         br.department,
         br.borrow_date AS borrow_date, 
         br.due_date AS due_date, 
         br.return_date AS returnDate,
         br.status,
         br.qr_code,
         br.image_path,
         br.created_at,
         br.updated_at,
         b.id AS book_id_ref,
         b.title, 
         b.author, 
         b.category,
         b.isbn, 
         b.quantity,
         b.description,
         b.cover_image,
         b.status AS book_status
       FROM borrowings br
       JOIN books b ON br.book_id = b.id
       WHERE br.status = 'Borrowed'
       ORDER BY br.created_at DESC
       LIMIT 50`
    );
    connection.release();

    const borrowingsWithUrls = borrowings.map((b) => ({
      // Primary identifiers
      id: b.borrowing_id,
      borrowId: b.borrowing_id,
      transaction_id: b.transaction_id,
      
      // Book information
      title: b.title,
      author: b.author,
      isbn: b.isbn,
      bookTitle: b.title, // Alternative field name
      cover_image: b.cover_image ? `${req.protocol}://${req.get("host")}/uploads/${b.cover_image}` : null,
      
      // User/Borrower information
      user_id: b.user_id,
      user_email: b.user_email,
      user_name: b.user_name,
      userName: b.user_name, // Alternative field name
      borrower: b.user_name, // Alternative field name
      borrower_type: b.borrower_type,
      borrowerType: b.borrower_type, // Alternative field name
      
      // Student-specific fields
      lrn: b.lrn,
      section: b.section,
      grade_level: b.grade_level,
      gradeLevel: b.grade_level, // Alternative field name
      
      // Teacher-specific fields
      employee_id: b.employee_id,
      employeeId: b.employee_id, // Alternative field name
      department: b.department,
      
      // Date information
      borrow_date: b.borrow_date,
      borrowDate: b.borrow_date, // Alternative field name
      due_date: b.due_date,
      dueDate: b.due_date, // Alternative field name
      return_date: b.returnDate,
      returnDate: b.returnDate,
      
      // Status and metadata
      status: b.status,
      qr_code: b.qr_code,
      image_path: b.image_path,
      created_at: b.created_at,
      updated_at: b.updated_at,
      
      // Book details object (for compatibility)
      book: {
        id: b.book_id_ref,
        title: b.title,
        author: b.author,
        category: b.category,
        isbn: b.isbn,
        quantity: b.quantity,
        description: b.description,
        cover_image: b.cover_image ? `${req.protocol}://${req.get("host")}/uploads/${b.cover_image}` : null,
        status: b.book_status
      }
    }));

    res.status(200).json({ 
      success: true, 
      borrowings: borrowingsWithUrls,
      count: borrowingsWithUrls.length,
      message: "Recently issued books retrieved successfully"
    });
  } catch (error) {
    console.error("❌ Error fetching recent borrowings:", error.message || error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch recent borrowings",
    });
  }
});

/**
 * @route   GET /api/borrow/status/:status
 * @desc    Get all borrowings by status (Pending, Borrowed, Returned, Overdue)
 */
router.get("/status/:status", async (req, res) => {
  try {
    const { status } = req.params;
    const { limit = 50 } = req.query;

    // Validate status
    const validStatuses = ['Pending', 'Borrowed', 'Returned', 'Overdue'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Valid statuses are: ${validStatuses.join(', ')}`,
      });
    }

    const connection = await pool.getConnection();
    const [borrowings] = await connection.query(
      `SELECT 
         br.id AS borrowing_id,
         br.transaction_id,
         br.book_id,
         br.user_id,
         br.user_email,
         br.user_name,
         br.borrower_type,
         br.lrn,
         br.section,
         br.grade_level, -- Fixed field name from 'grade' to 'grade_level'
         br.employee_id,
         br.department,
         br.borrow_date AS borrowDate,
         br.due_date AS dueDate,
         br.return_date AS returnDate,
         br.status,
         br.qr_code,
         br.image_path,
         br.created_at AS borrowing_created_at,
         br.updated_at AS borrowing_updated_at,
         b.id AS book_id_ref,
         b.title,
         b.author,
         b.category,
         b.isbn,
         b.quantity,
         b.description,
         b.cover_image,
         b.status AS book_status,
         b.created_at AS book_created_at,
         b.updated_at AS book_updated_at,
         DATEDIFF(br.due_date, br.borrow_date) AS borrow_duration_days,
         DATEDIFF(CURDATE(), br.borrow_date) AS days_since_request,
         CASE 
           WHEN br.due_date < CURDATE() AND br.status = 'Borrowed' THEN 'Overdue'
           WHEN br.due_date < CURDATE() AND br.status != 'Returned' THEN 'Was overdue'
           ELSE 'Within due date'
         END AS due_status,
         CASE 
           WHEN br.status = 'Borrowed' AND br.due_date < CURDATE() THEN DATEDIFF(CURDATE(), br.due_date)
           ELSE 0
         END AS days_overdue
       FROM borrowings br
       JOIN books b ON br.book_id = b.id
       WHERE br.status = ?
       ORDER BY br.created_at DESC
       LIMIT ?`,
      [status, parseInt(limit)]
    );
    connection.release();

    const borrowingsWithUrls = borrowings.map((b) => ({
      // Borrowing details
      borrowing_id: b.borrowing_id,
      transaction_id: b.transaction_id,
      user_id: b.user_id,
      user_email: b.user_email,
      user_name: b.user_name,
      borrower_type: b.borrower_type,
      lrn: b.lrn,
      section: b.section,
      grade_level: b.grade_level, // Fixed field name
      employee_id: b.employee_id,
      department: b.department,
      borrowDate: b.borrowDate,
      dueDate: b.dueDate,
      returnDate: b.returnDate,
      status: b.status,
      qr_code: b.qr_code,
      image_path: b.image_path,
      borrowing_created_at: b.borrowing_created_at,
      borrowing_updated_at: b.borrowing_updated_at,
      borrow_duration_days: b.borrow_duration_days,
      days_since_request: b.days_since_request,
      due_status: b.due_status,
      days_overdue: b.days_overdue,
      
      // Book details
      book: {
        id: b.book_id_ref,
        book_id: b.book_id,
        title: b.title,
        author: b.author,
        category: b.category,
        isbn: b.isbn,
        quantity: b.quantity,
        description: b.description,
        cover_image: b.cover_image ? `${req.protocol}://${req.get("host")}/uploads/${b.cover_image}` : null,
        book_status: b.book_status,
        book_created_at: b.book_created_at,
        book_updated_at: b.book_updated_at
      },
      
      // Legacy fields for backward compatibility
      id: b.book_id_ref,
      title: b.title,
      author: b.author,
      isbn: b.isbn,
      cover_image: b.cover_image ? `${req.protocol}://${req.get("host")}/uploads/${b.cover_image}` : null
    }));

    res.status(200).json({ 
      success: true, 
      borrowings: borrowingsWithUrls,
      count: borrowingsWithUrls.length,
      status: status,
      message: `Found ${borrowingsWithUrls.length} borrowing(s) with status: ${status}`
    });
  } catch (error) {
    console.error(`❌ Error fetching borrowings by status:`, error.message || error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch borrowings by status",
    });
  }
});

/**
 * @route   GET /api/borrow/books/pending-borrowers
 * @desc    Get all borrowings with complete details for pending status
 */
router.get("/books/pending-borrowers", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [pendingBorrowers] = await connection.query(
      `SELECT 
         br.id AS borrowing_id,
         br.transaction_id,
         br.book_id,
         br.user_id,
         br.user_email,
         br.user_name,
         br.borrower_type,
         br.lrn,
         br.section,
         br.grade_level, -- Fixed field name from 'grade' to 'grade_level'
         br.employee_id,
         br.department,
         br.borrow_date AS borrowDate,
         br.due_date AS dueDate,
         br.return_date AS returnDate,
         br.status,
         br.qr_code,
         br.image_path,
         br.created_at AS borrowing_created_at,
         br.updated_at AS borrowing_updated_at,
         b.id AS book_id_ref,
         b.title,
         b.author,
         b.category,
         b.isbn,
         b.quantity,
         b.description,
         b.cover_image,
         b.status AS book_status,
         b.created_at AS book_created_at,
         b.updated_at AS book_updated_at,
         DATEDIFF(br.due_date, br.borrow_date) AS borrow_duration_days,
         DATEDIFF(CURDATE(), br.borrow_date) AS days_since_request,
         CASE 
           WHEN br.due_date < CURDATE() THEN 'Will be overdue'
           ELSE 'Within due date'
         END AS due_status
       FROM borrowings br
       JOIN books b ON br.book_id = b.id
       WHERE br.status = 'Pending'
       ORDER BY br.created_at DESC`
    );
    connection.release();

    const pendingWithUrls = pendingBorrowers.map((b) => ({
      // Borrowing details
      borrowing_id: b.borrowing_id,
      transaction_id: b.transaction_id,
      user_id: b.user_id,
      user_email: b.user_email,
      user_name: b.user_name,
      borrower_type: b.borrower_type,
      lrn: b.lrn,
      section: b.section,
      grade_level: b.grade_level, // Fixed field name
      employee_id: b.employee_id,
      department: b.department,
      borrowDate: b.borrowDate,
      dueDate: b.dueDate,
      returnDate: b.returnDate,
      status: b.status,
      qr_code: b.qr_code,
      image_path: b.image_path,
      borrowing_created_at: b.borrowing_created_at,
      borrowing_updated_at: b.borrowing_updated_at,
      borrow_duration_days: b.borrow_duration_days,
      days_since_request: b.days_since_request,
      due_status: b.due_status,
      
      // Book details
      book: {
        id: b.book_id_ref,
        book_id: b.book_id,
        title: b.title,
        author: b.author,
        category: b.category,
        isbn: b.isbn,
        quantity: b.quantity,
        description: b.description,
        cover_image: b.cover_image ? `${req.protocol}://${req.get("host")}/uploads/${b.cover_image}` : null,
        book_status: b.book_status,
        book_created_at: b.book_created_at,
        book_updated_at: b.book_updated_at
      },
      
      // Legacy fields for backward compatibility
      id: b.book_id_ref,
      title: b.title,
      author: b.author,
      isbn: b.isbn,
      cover_image: b.cover_image ? `${req.protocol}://${req.get("host")}/uploads/${b.cover_image}` : null
    }));

    res.status(200).json({ 
      success: true, 
      pendingBorrowers: pendingWithUrls,
      count: pendingWithUrls.length,
      message: `Found ${pendingWithUrls.length} pending borrowing request(s)`
    });
  } catch (error) {
    console.error("❌ Error fetching pending borrowers:", error.message || error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending borrowers",
    });
  }
});

/**
 * @route   PUT /api/borrow/approve/:transactionId
 * @desc    Approve a pending borrowing request
 */
router.put("/approve/:transactionId", async (req, res) => {
  try {
    const { transactionId } = req.params;
    const connection = await pool.getConnection();

    // Check if the borrowing exists and is pending
    const [borrowingCheck] = await connection.query(
      `SELECT book_id FROM borrowings WHERE transaction_id = ? AND status = 'Pending'`,
      [transactionId]
    );

    if (borrowingCheck.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: "Pending borrowing not found",
      });
    }

    await connection.beginTransaction();

    try {
      // Update the borrowing status to 'Borrowed'
      await connection.query(
        `UPDATE borrowings SET status = 'Borrowed', updated_at = NOW() WHERE transaction_id = ?`,
        [transactionId]
      );

      // Decrease available_quantity by 1
      await connection.query(
        `UPDATE books SET available_quantity = GREATEST(0, available_quantity - 1) WHERE id = ?`,
        [borrowingCheck[0].book_id]
      );

      await connection.commit();
      connection.release();

      res.status(200).json({
        success: true,
        message: "Borrowing approved successfully",
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error("❌ Error approving borrowing:", error.message || error);
    res.status(500).json({
      success: false,
      message: "Failed to approve borrowing",
    });
  }
});

/**
 * @route   PUT /api/borrow/reject/:transactionId
 * @desc    Reject a pending borrowing request
 */
router.put("/reject/:transactionId", async (req, res) => {
  try {
    const { transactionId } = req.params;
    const connection = await pool.getConnection();

    // Check if the borrowing exists and is pending
    const [borrowingCheck] = await connection.query(
      `SELECT book_id FROM borrowings WHERE transaction_id = ? AND status = 'Pending'`,
      [transactionId]
    );

    if (borrowingCheck.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: "Pending borrowing not found",
      });
    }

    await connection.beginTransaction();

    try {
      // Delete the borrowing record
      await connection.query(
        `DELETE FROM borrowings WHERE transaction_id = ?`,
        [transactionId]
      );

      await connection.commit();
      connection.release();

      res.status(200).json({
        success: true,
        message: "Borrowing rejected successfully",
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error("❌ Error rejecting borrowing:", error.message || error);
    res.status(500).json({
      success: false,
      message: "Failed to reject borrowing",
    });
  }
});

/**
 * @route   PUT /api/borrow/return/:transactionId
 * @desc    Return a borrowed book
 */
router.put("/return/:transactionId", async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { returnDate } = req.body;
    const connection = await pool.getConnection();

    // Check if the borrowing exists and is borrowed or overdue
    const [borrowingCheck] = await connection.query(
      `SELECT book_id FROM borrowings WHERE transaction_id = ? AND (status = 'Borrowed' OR status = 'Overdue')`,
      [transactionId]
    );

    if (borrowingCheck.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: "Active borrowing not found",
      });
    }

    await connection.beginTransaction();

    try {
      // Update the borrowing with return date and status
      await connection.query(
        `UPDATE borrowings SET return_date = ?, status = 'Returned', updated_at = NOW() WHERE transaction_id = ?`,
        [returnDate || new Date().toISOString().split('T')[0], transactionId]
      );

      // Increase available_quantity by 1
      await connection.query(
        `UPDATE books SET available_quantity = available_quantity + 1 WHERE id = ?`,
        [borrowingCheck[0].book_id]
      );

      await connection.commit();
      connection.release();

      res.status(200).json({
        success: true,
        message: "Book returned successfully",
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error("❌ Error returning book:", error.message || error);
    res.status(500).json({
      success: false,
      message: "Failed to return book",
    });
  }
});

/**
 * @route   GET /api/borrow/:bookId
 * @desc    Get all borrowings for a specific book
 */
router.get("/:bookId", async (req, res) => {
  try {
    const { bookId } = req.params;
    const { status, limit = 50 } = req.query;
    
    // Validate bookId is a number
    if (!bookId || isNaN(bookId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID provided",
      });
    }

    const connection = await pool.getConnection();

    // First check if the book exists
    const [bookCheck] = await connection.query(
      `SELECT id, title, author, isbn, quantity, available_quantity FROM books WHERE id = ?`,
      [bookId]
    );

    if (bookCheck.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    // Build the query with optional status filter
    let query = `
      SELECT 
        br.id AS borrowing_id,
        br.transaction_id,
        br.book_id,
        br.user_id,
        br.user_email,
        br.user_name,
        br.borrower_type,
        br.lrn,
        br.section,
        br.grade_level,
        br.employee_id,
        br.department,
        br.borrow_date AS borrowDate,
        br.due_date AS dueDate,
        br.return_date AS returnDate,
        br.status,
        br.qr_code,
        br.image_path,
        br.created_at AS borrowing_created_at,
        br.updated_at AS borrowing_updated_at,
        b.id AS book_id_ref,
        b.title,
        b.author,
        b.category,
        b.isbn,
        b.quantity,
        b.available_quantity,
        b.description,
        b.cover_image,
        b.status AS book_status,
        DATEDIFF(CURDATE(), br.borrow_date) AS days_since_borrow,
        CASE 
          WHEN br.due_date < CURDATE() AND br.status = 'Borrowed' THEN 'Overdue'
          WHEN br.due_date < CURDATE() AND br.status != 'Returned' THEN 'Was overdue'
          WHEN br.status = 'Returned' THEN 'Returned on time'
          ELSE 'Within due date'
        END AS due_status,
        CASE 
          WHEN br.status = 'Borrowed' AND br.due_date < CURDATE() THEN DATEDIFF(CURDATE(), br.due_date)
          WHEN br.status = 'Returned' AND br.return_date > br.due_date THEN DATEDIFF(br.return_date, br.due_date)
          ELSE 0
        END AS days_overdue
      FROM borrowings br
      JOIN books b ON br.book_id = b.id
      WHERE br.book_id = ?`;

    const queryParams = [bookId];

    // Add status filter if provided
    if (status) {
      const validStatuses = ['Pending', 'Borrowed', 'Returned', 'Overdue'];
      if (!validStatuses.includes(status)) {
        connection.release();
        return res.status(400).json({
          success: false,
          message: `Invalid status. Valid statuses are: ${validStatuses.join(', ')}`,
        });
      }
      query += ` AND br.status = ?`;
      queryParams.push(status);
    }

    query += ` ORDER BY br.created_at DESC LIMIT ?`;
    queryParams.push(parseInt(limit));

    const [borrowings] = await connection.query(query, queryParams);
    connection.release();

    const borrowingsWithUrls = borrowings.map((b) => ({
      // Borrowing details
      borrowing_id: b.borrowing_id,
      transaction_id: b.transaction_id,
      user_id: b.user_id,
      user_email: b.user_email,
      user_name: b.user_name,
      borrower_type: b.borrower_type,
      lrn: b.lrn,
      section: b.section,
      grade_level: b.grade_level,
      employee_id: b.employee_id,
      department: b.department,
      borrowDate: b.borrowDate,
      dueDate: b.dueDate,
      returnDate: b.returnDate,
      status: b.status,
      qr_code: b.qr_code,
      image_path: b.image_path,
      borrowing_created_at: b.borrowing_created_at,
      borrowing_updated_at: b.borrowing_updated_at,
      days_since_borrow: b.days_since_borrow,
      due_status: b.due_status,
      days_overdue: b.days_overdue,
      
      // Book details
      book: {
        id: b.book_id_ref,
        title: b.title,
        author: b.author,
        category: b.category,
        isbn: b.isbn,
        quantity: b.quantity,
        available_quantity: b.available_quantity,
        description: b.description,
        cover_image: b.cover_image ? `${req.protocol}://${req.get("host")}/uploads/${b.cover_image}` : null,
        book_status: b.book_status
      },
      
      // Legacy fields for backward compatibility
      id: b.book_id_ref,
      title: b.title,
      author: b.author,
      isbn: b.isbn,
      cover_image: b.cover_image ? `${req.protocol}://${req.get("host")}/uploads/${b.cover_image}` : null
    }));

    // Get borrowing statistics for this book
    const bookInfo = bookCheck[0];
    const totalBorrowings = borrowings.length;
    const currentlyBorrowed = borrowings.filter(b => b.status === 'Borrowed').length;
    const overdue = borrowings.filter(b => b.status === 'Overdue').length;
    const pending = borrowings.filter(b => b.status === 'Pending').length;

    res.status(200).json({ 
      success: true, 
      borrowings: borrowingsWithUrls,
      bookInfo: {
        id: bookInfo.id,
        title: bookInfo.title,
        author: bookInfo.author,
        isbn: bookInfo.isbn,
        totalQuantity: bookInfo.quantity,
        availableQuantity: bookInfo.available_quantity,
        currentlyBorrowed: currentlyBorrowed
      },
      statistics: {
        totalBorrowings: totalBorrowings,
        currentlyBorrowed: currentlyBorrowed,
        overdue: overdue,
        pending: pending,
        returned: borrowings.filter(b => b.status === 'Returned').length
      },
      filters: {
        status: status || 'all',
        limit: parseInt(limit)
      },
      message: `Found ${totalBorrowings} borrowing record(s) for book: ${bookInfo.title}`
    });
  } catch (error) {
    console.error("❌ Error fetching borrowings by book ID:", error.message || error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch borrowings for this book",
    });
  }
});

/**
 * @route   GET /api/borrow/overdue
 * @desc    Get all overdue books
 */
router.get("/overdue", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    // First update overdue status
    await connection.query(
      `UPDATE borrowings SET status = 'Overdue' WHERE status = 'Borrowed' AND due_date < CURDATE()`
    );

    const [overdueBooks] = await connection.query(
      `SELECT 
         b.id, 
         b.title, 
         b.author, 
         b.isbn, 
         br.transaction_id, 
         br.borrow_date AS borrowDate, 
         br.due_date AS dueDate, 
         br.return_date AS returnDate,
         br.status,
         b.cover_image,
         br.user_name,
         DATEDIFF(CURDATE(), br.due_date) AS days_overdue
       FROM borrowings br
       JOIN books b ON br.book_id = b.id
       WHERE br.status = 'Overdue'
       ORDER BY br.due_date ASC`
    );
    connection.release();

    const overdueWithUrls = overdueBooks.map((b) => ({
      ...b,
      cover_image: b.cover_image ? `${req.protocol}://${req.get("host")}/uploads/${b.cover_image}` : null,
    }));

    res.status(200).json({ 
      success: true, 
      overdueBooks: overdueWithUrls,
      count: overdueWithUrls.length,
      message: `Found ${overdueWithUrls.length} overdue book(s)`
    });
  } catch (error) {
    console.error("❌ Error fetching overdue books:", error.message || error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch overdue books",
    });
  }
});

module.exports = router;