const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { pool } = require("../config/db");
const { isLibrarian } = require("../middleware/authMiddleware");

// Set up uploads directory
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Set up Multer storage for book covers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, fileName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Max file size 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif/;
    const isValid = allowed.test(file.mimetype) && allowed.test(path.extname(file.originalname).toLowerCase());
    cb(null, isValid || new Error("Only image files are allowed!"));
  },
});

/**
 * @route   POST /api/books
 * @desc    Add a new book
 */
router.post("/", isLibrarian, upload.single("bookCover"), async (req, res) => {
  try {
    const { title, author, category, isbn, description, qrCode } = req.body;

    // Validate required fields
    if (!title || !author || !category || !isbn || !description) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Handle cover image
    const coverImage = req.file ? req.file.filename : null;

    // Handle QR code if it's base64
    let qrCodeFileName = null;
    if (qrCode && qrCode.startsWith("data:image")) {
      try {
        const data = qrCode.replace(/^data:image\/png;base64,/, "");
        const qrFile = `qr-${Date.now()}.png`;
        fs.writeFileSync(path.join(uploadsDir, qrFile), data, "base64");
        qrCodeFileName = qrFile;
      } catch (error) {
        console.error("❌ Error saving QR code:", error.message);
      }
    } else {
      qrCodeFileName = qrCode; // If it's already a filename
    }

    const connection = await pool.getConnection();
    const [result] = await connection.query(
      `INSERT INTO books (title, author, category, isbn, description, cover_image, qr_code, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, author, category, isbn, description, coverImage, qrCodeFileName, "Available"]
    );
    connection.release();

    return res.status(201).json({
      success: true,
      message: "Book added successfully",
      bookId: result.insertId,
      book: {
        id: result.insertId,
        title,
        author,
        category,
        isbn,
        description,
        cover_image: coverImage,
        qr_code: qrCodeFileName,
        status: "Available",
      },
    });
  } catch (error) {
    console.error("❌ Error adding book:", error.message || error);
    return res.status(500).json({
      success: false,
      message: "Failed to add book: " + error.message,
    });
  }
});

/**
 * @route   GET /api/books
 * @desc    Get all books with optional search
 */
router.get("/", async (req, res) => {
  try {
    const { search, sortField, sortOrder } = req.query;
    const connection = await pool.getConnection();

    let query = `
      SELECT b.*, 
        CASE 
          WHEN br.status = 'Borrowed' AND br.due_date < CURDATE() THEN 'Overdue'
          WHEN br.status IS NOT NULL THEN br.status
          ELSE b.status
        END AS borrowing_status
      FROM books b
      LEFT JOIN (
        SELECT book_id, status, due_date
        FROM borrowings
        WHERE status = 'Borrowed' OR status = 'Overdue'
      ) br ON b.id = br.book_id
    `;
    
    const queryParams = [];

    // Add search filter if provided
    if (search) {
      query += " WHERE (b.title LIKE ? OR b.author LIKE ? OR b.category LIKE ? OR b.isbn LIKE ?)";
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Add sorting if provided
    if (sortField && sortOrder) {
      query += ` ORDER BY ${connection.escapeId(sortField)} ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
    } else {
      query += " ORDER BY b.created_at DESC";
    }

    const [books] = await connection.query(query, queryParams);
    connection.release();

    // Add full URL for cover image and QR code
    const booksWithUrls = books.map((book) => ({
      ...book,
      cover_image: book.cover_image ? `${req.protocol}://${req.get("host")}/uploads/${book.cover_image}` : null,
      qr_code: book.qr_code ? `${req.protocol}://${req.get("host")}/uploads/${book.qr_code}` : null,
    }));

    console.log(`✅ Retrieved ${books.length} books successfully`);
    res.status(200).json({
      success: true,
      books: booksWithUrls,
    });
  } catch (error) {
    console.error("❌ Error fetching books:", error.message || error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch books",
    });
  }
});

/**
 * @route   GET /api/books/status
 * @desc    Get all books with status and filters
 */
router.get("/status", async (req, res) => {
  try {
    const { search, category, status, sortField, sortOrder, page, limit } = req.query;
    const connection = await pool.getConnection();

    // Pagination parameters
    const currentPage = parseInt(page) || 1;
    const itemsPerPage = parseInt(limit) || 10;
    const offset = (currentPage - 1) * itemsPerPage;

    // Building the base query with JOIN to get borrowing status
    let baseQuery = `
      SELECT b.*, 
        CASE 
          WHEN br.status = 'Borrowed' AND br.due_date < CURDATE() THEN 'Overdue'
          WHEN br.status IS NOT NULL THEN br.status
          ELSE b.status
        END AS borrowing_status
      FROM books b
      LEFT JOIN (
        SELECT book_id, status, due_date
        FROM borrowings
        WHERE status = 'Borrowed' OR status = 'Overdue'
        GROUP BY book_id
        HAVING MAX(id)
      ) br ON b.id = br.book_id
    `;

    // Building the WHERE clause for filtering
    const conditions = [];
    const queryParams = [];

    if (search) {
      conditions.push("(b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ?)");
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    if (category) {
      conditions.push("b.category = ?");
      queryParams.push(category);
    }

    // Modified status filter to check both book status and borrowing status
    if (status) {
      if (status.toLowerCase() === 'overdue') {
        conditions.push("(br.status = 'Borrowed' AND br.due_date < CURDATE())");
      } else if (status.toLowerCase() === 'borrowed') {
        conditions.push("(br.status = 'Borrowed' AND br.due_date >= CURDATE())");
      } else {
        conditions.push("(b.status = ? AND br.status IS NULL)");
        queryParams.push(status);
      }
    }

    let whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Counting total records for pagination
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM books b
      LEFT JOIN (
        SELECT book_id, status, due_date
        FROM borrowings
        WHERE status = 'Borrowed' OR status = 'Overdue'
        GROUP BY book_id
        HAVING MAX(id)
      ) br ON b.id = br.book_id
      ${whereClause}
    `;
    
    const [countResult] = await connection.query(countQuery, queryParams);
    const totalItems = countResult[0].total;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Building the query for fetching books
    let query = baseQuery + ' ' + whereClause;

    // Add sorting if provided
    if (sortField && sortOrder) {
      const sortPrefix = sortField.includes('.') ? '' : 'b.';
      query += ` ORDER BY ${sortPrefix}${connection.escapeId(sortField)} ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
    } else {
      query += " ORDER BY b.created_at DESC";
    }

    // Add pagination
    query += " LIMIT ? OFFSET ?";
    const paginationParams = [...queryParams, itemsPerPage, offset];

    const [books] = await connection.query(query, paginationParams);
    connection.release();

    // Add full URL for cover image and QR code
    const booksWithUrls = books.map((book) => ({
      ...book,
      cover_image: book.cover_image ? `${req.protocol}://${req.get("host")}/uploads/${book.cover_image}` : null,
      qr_code: book.qr_code ? `${req.protocol}://${req.get("host")}/uploads/${book.qr_code}` : null,
    }));

    res.status(200).json({
      success: true,
      books: booksWithUrls,
      pagination: {
        currentPage,
        totalPages,
        totalItems,
        itemsPerPage
      }
    });
  } catch (error) {
    console.error("❌ Error fetching books with status:", error.message || error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch books",
    });
  }
});

/**
 * @route   GET /api/books/sync-status
 * @desc    Synchronize book statuses with borrowings data
 */
router.get("/sync-status", isLibrarian, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // Update books that are borrowed but marked as available
      const [updateBorrowed] = await connection.query(`
        UPDATE books b 
        JOIN borrowings br ON b.id = br.book_id
        SET b.status = 'Borrowed'
        WHERE br.status = 'Borrowed' AND b.status = 'Available'
      `);
      
      // Update books that are returned but still marked as borrowed
      const [updateReturned] = await connection.query(`
        UPDATE books b
        LEFT JOIN (
          SELECT book_id FROM borrowings WHERE status = 'Borrowed' OR status = 'Overdue'
        ) br ON b.id = br.book_id
        SET b.status = 'Available'
        WHERE br.book_id IS NULL AND (b.status = 'Borrowed' OR b.status = 'Overdue')
      `);
      
      // Update books with overdue status
      const [updateOverdue] = await connection.query(`
        UPDATE books b
        JOIN borrowings br ON b.id = br.book_id
        SET b.status = 'Overdue'
        WHERE br.status = 'Borrowed' AND br.due_date < CURDATE() AND b.status != 'Overdue'
      `);
      
      await connection.commit();
      
      const updated = updateBorrowed.affectedRows > 0 || 
                      updateReturned.affectedRows > 0 || 
                      updateOverdue.affectedRows > 0;
      
      res.status(200).json({
        success: true,
        updated,
        message: "Book statuses synchronized successfully"
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("❌ Error synchronizing book statuses:", error.message || error);
    res.status(500).json({
      success: false,
      message: "Failed to synchronize book statuses",
    });
  }
});

/**
 * @route   GET /api/books/search
 * @desc    Search books by title, id, or isbn
 */
router.get("/search", async (req, res) => {
  try {
    const { title, id, isbn } = req.query;
    const connection = await pool.getConnection();

    let query = `
      SELECT b.*, 
        CASE 
          WHEN br.status = 'Borrowed' AND br.due_date < CURDATE() THEN 'Overdue'
          WHEN br.status IS NOT NULL THEN br.status
          ELSE b.status
        END AS borrowing_status
      FROM books b
      LEFT JOIN (
        SELECT book_id, status, due_date
        FROM borrowings
        WHERE status = 'Borrowed' OR status = 'Overdue'
        GROUP BY book_id
        HAVING MAX(id)
      ) br ON b.id = br.book_id
      WHERE 1=0
    `; // Start with a false condition
    
    const queryParams = [];

    // Build query based on provided parameters
    if (title) {
      query += " OR b.title LIKE ?";
      queryParams.push(`%${title}%`);
    }
    
    if (id) {
      query += " OR b.id = ?";
      queryParams.push(id);
    }
    
    if (isbn) {
      query += " OR b.isbn LIKE ?";
      queryParams.push(`%${isbn}%`);
    }

    const [books] = await connection.query(query, queryParams);
    connection.release();

    // Add full URL for cover image and QR code
    const booksWithUrls = books.map((book) => ({
      ...book,
      cover_image: book.cover_image ? `${req.protocol}://${req.get("host")}/uploads/${book.cover_image}` : null,
      qr_code: book.qr_code ? `${req.protocol}://${req.get("host")}/uploads/${book.qr_code}` : null,
    }));

    res.status(200).json({
      success: true,
      books: booksWithUrls,
    });
  } catch (error) {
    console.error("❌ Error searching books:", error.message || error);
    res.status(500).json({
      success: false,
      message: "Failed to search books",
    });
  }
});

/**
 * @route   PUT /api/books/:id
 * @desc    Update a book
 */
router.put("/:id", isLibrarian, upload.single("bookCover"), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, author, category, isbn, description } = req.body;

    // Validate required fields
    if (!title || !author || !category || !isbn) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const connection = await pool.getConnection();
    
    // First get the existing book data
    const [existingBooks] = await connection.query("SELECT cover_image FROM books WHERE id = ?", [id]);
    
    if (existingBooks.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }
    
    const existingBook = existingBooks[0];
    
    // Handle cover image
    let coverImage = existingBook.cover_image;
    if (req.file) {
      coverImage = req.file.filename;
      
      // Delete old cover image if it exists
      if (existingBook.cover_image) {
        const oldCoverPath = path.join(uploadsDir, existingBook.cover_image);
        if (fs.existsSync(oldCoverPath)) {
          fs.unlinkSync(oldCoverPath);
        }
      }
    }

    // Update the book
    await connection.query(
      `UPDATE books SET 
         title = ?, 
         author = ?, 
         category = ?, 
         isbn = ?, 
         description = ?, 
         cover_image = ?
       WHERE id = ?`,
      [title, author, category, isbn, description, coverImage, id]
    );
    
    connection.release();

    return res.status(200).json({
      success: true,
      message: "Book updated successfully",
      book: {
        id,
        title,
        author,
        category,
        isbn,
        description,
        cover_image: coverImage,
      },
    });
  } catch (error) {
    console.error("❌ Error updating book:", error.message || error);
    return res.status(500).json({
      success: false,
      message: "Failed to update book: " + error.message,
    });
  }
});

/**
 * @route   GET /api/books/:id
 * @desc    Get book by ID
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    
    const [books] = await connection.query(`
      SELECT b.*, 
        CASE 
          WHEN br.status = 'Borrowed' AND br.due_date < CURDATE() THEN 'Overdue'
          WHEN br.status IS NOT NULL THEN br.status
          ELSE b.status
        END AS borrowing_status
      FROM books b
      LEFT JOIN (
        SELECT book_id, status, due_date 
        FROM borrowings
        WHERE status = 'Borrowed' OR status = 'Overdue'
        GROUP BY book_id
        HAVING MAX(id)
      ) br ON b.id = br.book_id
      WHERE b.id = ?
    `, [id]);
    
    connection.release();

    if (books.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    const book = books[0];
    book.cover_image = book.cover_image ? `${req.protocol}://${req.get("host")}/uploads/${book.cover_image}` : null;
    book.qr_code = book.qr_code ? `${req.protocol}://${req.get("host")}/uploads/${book.qr_code}` : null;

    res.status(200).json({
      success: true,
      book,
    });
  } catch (error) {
    console.error("❌ Error fetching book:", error.message || error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch book",
    });
  }
});

/**
 * @route   GET /api/books/isbn/:isbn
 * @desc    Get book by ISBN
 */
router.get("/isbn/:isbn", async (req, res) => {
  try {
    const { isbn } = req.params;
    const connection = await pool.getConnection();
    
    const [books] = await connection.query(`
      SELECT b.*, 
        CASE 
          WHEN br.status = 'Borrowed' AND br.due_date < CURDATE() THEN 'Overdue'
          WHEN br.status IS NOT NULL THEN br.status
          ELSE b.status
        END AS borrowing_status
      FROM books b
      LEFT JOIN (
        SELECT book_id, status, due_date 
        FROM borrowings
        WHERE status = 'Borrowed' OR status = 'Overdue'
        GROUP BY book_id
        HAVING MAX(id)
      ) br ON b.id = br.book_id
      WHERE b.isbn = ?
    `, [isbn]);
    
    connection.release();

    if (books.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    const book = books[0];
    book.cover_image = book.cover_image ? `${req.protocol}://${req.get("host")}/uploads/${book.cover_image}` : null;
    book.qr_code = book.qr_code ? `${req.protocol}://${req.get("host")}/uploads/${book.qr_code}` : null;

    res.status(200).json({
      success: true,
      book,
    });
  } catch (error) {
    console.error("❌ Error fetching book by ISBN:", error.message || error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch book by ISBN",
    });
  }
});

/**
 * @route   POST /api/books/borrow
 * @desc    Borrow a book
 */
router.post("/borrow", async (req, res) => {
  try {
    const { bookId, userId, userEmail, userName, borrowDate, dueDate, status } = req.body;

    // Validate required fields
    if (!bookId || !userId || !userName || !borrowDate || !dueDate) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const connection = await pool.getConnection();
    
    // Check if the book is available
    const [bookCheck] = await connection.query(`
      SELECT b.status,
        CASE 
          WHEN br.status = 'Borrowed' AND br.due_date < CURDATE() THEN 'Overdue'
          WHEN br.status IS NOT NULL THEN br.status
          ELSE b.status
        END AS borrowing_status
      FROM books b
      LEFT JOIN (
        SELECT book_id, status, due_date 
        FROM borrowings
        WHERE status = 'Borrowed' OR status = 'Overdue'
      ) br ON b.id = br.book_id
      WHERE b.id = ?
    `, [bookId]);
    
    if (bookCheck.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }
    
    // Check if book is already borrowed
    if (bookCheck[0].borrowing_status && 
        (bookCheck[0].borrowing_status.toLowerCase() === 'borrowed' || 
         bookCheck[0].borrowing_status.toLowerCase() === 'overdue')) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: "Book is not available for borrowing",
      });
    }

    // Start a transaction
    await connection.beginTransaction();

    try {
      // Generate transaction ID
      const transactionId = `TR-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

      // Insert into borrowing table
      const [borrowResult] = await connection.query(
        `INSERT INTO borrowings (transaction_id, book_id, user_id, user_email, user_name, borrow_date, due_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [transactionId, bookId, userId, userEmail, userName, borrowDate, dueDate, status]
      );

      // Update book status
      await connection.query(
        "UPDATE books SET status = ? WHERE id = ?",
        ["Borrowed", bookId]
      );

      // Commit the transaction
      await connection.commit();
      connection.release();

      return res.status(201).json({
        success: true,
        message: "Book borrowed successfully",
        transactionId: transactionId,
        borrowingId: borrowResult.insertId
      });
    } catch (error) {
      // Rollback in case of error
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error("❌ Error borrowing book:", error.message || error);
    return res.status(500).json({
      success: false,
      message: "Failed to borrow book: " + error.message,
    });
  }
});

/**
 * @route   GET /api/books/borrowed/:userId
 * @desc    Get all books borrowed by a user
 */
router.get("/borrowed/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const connection = await pool.getConnection();
    
    const [borrowedBooks] = await connection.query(
      `SELECT b.id, b.title, b.author, b.isbn, br.transaction_id, 
       br.borrow_date AS borrowDate, br.due_date AS dueDate, 
       CASE 
         WHEN br.status = 'Borrowed' AND br.due_date < CURDATE() THEN 'Overdue'
         ELSE br.status
       END AS status,
       b.cover_image
       FROM borrowings br
       JOIN books b ON br.book_id = b.id
       WHERE br.user_id = ?
       ORDER BY br.borrow_date DESC`,
      [userId]
    );
    connection.release();

    // Add full URL for cover image
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
 * @route   DELETE /api/books/:id
 * @desc    Delete a book by ID
 */
router.delete("/:id", isLibrarian, async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    // Fetch the book to get associated files
    const [books] = await connection.query("SELECT cover_image, qr_code FROM books WHERE id = ?", [id]);

    if (books.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, message: "Book not found" });
    }

    // Check if book is currently borrowed
    const [borrowCheck] = await connection.query(
      "SELECT id FROM borrowings WHERE book_id = ? AND (status = 'Borrowed' OR status = 'Overdue')",
      [id]
    );
    
    if (borrowCheck.length > 0) {
      connection.release();
      return res.status(400).json({ 
        success: false, 
        message: "Cannot delete book that is currently borrowed" 
      });
    }

    // Delete the book from the database
    await connection.query("DELETE FROM books WHERE id = ?", [id]);
    connection.release();

    // Delete associated files (cover image and QR code)
    const book = books[0];
    if (book.cover_image) {
      const coverPath = path.join(uploadsDir, book.cover_image);
      if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
    }
    if (book.qr_code) {
      const qrPath = path.join(uploadsDir, book.qr_code);
      if (fs.existsSync(qrPath)) fs.unlinkSync(qrPath);
    }

    res.json({ success: true, message: "Book deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting book:", error.message || error);
    res.status(500).json({ success: false, message: "Failed to delete book" });
  }
});

/**
 * @route   GET /api/books/categories
 * @desc    Get all categories
 */
router.get("/categories", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [categories] = await connection.query("SELECT name FROM categories");
    connection.release();

    res.status(200).json({
      success: true,
      categories: categories.map((cat) => cat.name),
    });
  } catch (error) {
    console.error("❌ Error fetching categories:", error.message || error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
    });
  }
});

/**
 * @route   POST /api/books/categories
 * @desc    Add a new category
 */
router.post("/categories", isLibrarian, async (req, res) => {
  const { category } = req.body;

  if (!category) {
    return res.status(400).json({
      success: false,
      message: "Category name is required",
    });
  }

  try {
    const connection = await pool.getConnection();
    await connection.query("INSERT INTO categories (name) VALUES (?)", [category]);
    connection.release();

    res.status(201).json({
      success: true,
      message: "Category added successfully",
    });
  } catch (error) {
    console.error("❌ Error adding category:", error.message || error);
    res.status(500).json({
      success: false,
      message: "Failed to add category",
    });
  }
});

module.exports = router;