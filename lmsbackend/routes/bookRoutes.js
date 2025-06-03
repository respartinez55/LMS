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
    const { title, author, category, isbn, description, qrCode, quantity } = req.body;

    // Validate required fields
    if (!title || !author || !category || !isbn || !description || !quantity) {
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

    // Set initial available_quantity same as quantity and determine status
    const availableQuantity = Number(quantity);
    const status = availableQuantity > 0 ? "Available" : "Not Available";

    const connection = await pool.getConnection();
    const [result] = await connection.query(
      `INSERT INTO books (title, author, category, isbn, quantity, available_quantity, description, cover_image, qr_code, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, author, category, isbn, quantity, availableQuantity, description, coverImage, qrCodeFileName, status]
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
        quantity: Number(quantity),
        available_quantity: availableQuantity,
        description,
        cover_image: coverImage,
        qr_code: qrCodeFileName,
        status: status,
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
          WHEN b.available_quantity > 0 THEN 'Available'
          ELSE 'Not Available'
        END AS current_status,
        CASE 
          WHEN br.status = 'Borrowed' AND br.due_date < CURDATE() THEN 'Overdue'
          WHEN br.status IS NOT NULL THEN br.status
          WHEN b.available_quantity > 0 THEN 'Available'
          ELSE 'Not Available'
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

    // Add full URL for cover image and QR code, and ensure quantity is a number
    const booksWithUrls = books.map((book) => ({
      ...book,
      // Update status based on available_quantity
      status: book.available_quantity > 0 ? "Available" : "Not Available",
      cover_image: book.cover_image ? `${req.protocol}://${req.get("host")}/uploads/${book.cover_image}` : null,
      qr_code: book.qr_code ? `${req.protocol}://${req.get("host")}/uploads/${book.qr_code}` : null,
      quantity: typeof book.quantity !== "undefined" ? Number(book.quantity) : undefined,
      available_quantity: typeof book.available_quantity !== "undefined" ? Number(book.available_quantity) : undefined
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
          WHEN b.available_quantity > 0 THEN 'Available'
          ELSE 'Not Available'
        END AS current_status,
        CASE 
          WHEN br.status = 'Borrowed' AND br.due_date < CURDATE() THEN 'Overdue'
          WHEN br.status IS NOT NULL THEN br.status
          WHEN b.available_quantity > 0 THEN 'Available'
          ELSE 'Not Available'
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

    // Modified status filter to check available_quantity and borrowing status
    if (status) {
      if (status.toLowerCase() === 'overdue') {
        conditions.push("(br.status = 'Borrowed' AND br.due_date < CURDATE())");
      } else if (status.toLowerCase() === 'borrowed') {
        conditions.push("(br.status = 'Borrowed' AND br.due_date >= CURDATE())");
      } else if (status.toLowerCase() === 'available') {
        conditions.push("(b.available_quantity > 0 AND (br.status IS NULL OR br.status NOT IN ('Borrowed', 'Overdue')))");
      } else if (status.toLowerCase() === 'not available') {
        conditions.push("b.available_quantity = 0");
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

    // Get total quantity of all books (regardless of filters)
    const [quantityResult] = await connection.query(`SELECT SUM(quantity) as total_quantity FROM books`);
    const totalQuantity = quantityResult[0].total_quantity || 0;

    // Get available quantity of all books
    const [availableQuantityResult] = await connection.query(`SELECT SUM(available_quantity) as total_available FROM books`);
    const totalAvailable = availableQuantityResult[0].total_available || 0;

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

    // Add full URL for cover image and QR code, and ensure quantity is a number
    const booksWithUrls = books.map((book) => ({
      ...book,
      // Update status based on available_quantity
      status: book.available_quantity > 0 ? "Available" : "Not Available",
      cover_image: book.cover_image ? `${req.protocol}://${req.get("host")}/uploads/${book.cover_image}` : null,
      qr_code: book.qr_code ? `${req.protocol}://${req.get("host")}/uploads/${book.qr_code}` : null,
      quantity: typeof book.quantity !== "undefined" ? Number(book.quantity) : undefined,
      available_quantity: typeof book.available_quantity !== "undefined" ? Number(book.available_quantity) : undefined
    }));

    res.status(200).json({
      success: true,
      books: booksWithUrls,
      totalQuantity,
      totalAvailable,
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
          WHEN b.available_quantity > 0 THEN 'Available'
          ELSE 'Not Available'
        END AS current_status,
        CASE 
          WHEN br.status = 'Borrowed' AND br.due_date < CURDATE() THEN 'Overdue'
          WHEN br.status IS NOT NULL THEN br.status
          WHEN b.available_quantity > 0 THEN 'Available'
          ELSE 'Not Available'
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
      // Update status based on available_quantity
      status: book.available_quantity > 0 ? "Available" : "Not Available",
      cover_image: book.cover_image ? `${req.protocol}://${req.get("host")}/uploads/${book.cover_image}` : null,
      qr_code: book.qr_code ? `${req.protocol}://${req.get("host")}/uploads/${book.qr_code}` : null,
      available_quantity: typeof book.available_quantity !== "undefined" ? Number(book.available_quantity) : undefined
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
          WHEN b.available_quantity > 0 THEN 'Available'
          ELSE 'Not Available'
        END AS current_status,
        CASE 
          WHEN br.status = 'Borrowed' AND br.due_date < CURDATE() THEN 'Overdue'
          WHEN br.status IS NOT NULL THEN br.status
          WHEN b.available_quantity > 0 THEN 'Available'
          ELSE 'Not Available'
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
    // Update status based on available_quantity
    book.status = book.available_quantity > 0 ? "Available" : "Not Available";
    book.cover_image = book.cover_image ? `${req.protocol}://${req.get("host")}/uploads/${book.cover_image}` : null;
    book.qr_code = book.qr_code ? `${req.protocol}://${req.get("host")}/uploads/${book.qr_code}` : null;
    book.available_quantity = typeof book.available_quantity !== "undefined" ? Number(book.available_quantity) : undefined;

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
 * @route   PUT /api/books/:id
 * @desc    Update a book
 */
router.put("/:id", isLibrarian, upload.single("bookCover"), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, author, category, isbn, description, quantity, available_quantity } = req.body;

    const connection = await pool.getConnection();

    // First, get the current book data
    const [currentBooks] = await connection.query("SELECT * FROM books WHERE id = ?", [id]);
    
    if (currentBooks.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    const currentBook = currentBooks[0];

    // Handle cover image update
    let coverImage = currentBook.cover_image;
    if (req.file) {
      // Delete old cover image if it exists
      if (currentBook.cover_image) {
        const oldImagePath = path.join(uploadsDir, currentBook.cover_image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      coverImage = req.file.filename;
    }

    // Calculate new available quantity and status
    const newQuantity = Number(quantity) || currentBook.quantity;
    const newAvailableQuantity = typeof available_quantity !== 'undefined' ? Number(available_quantity) : currentBook.available_quantity;
    const status = newAvailableQuantity > 0 ? "Available" : "Not Available";

    // Update the book
    await connection.query(
      `UPDATE books SET 
        title = ?, author = ?, category = ?, isbn = ?, 
        description = ?, quantity = ?, available_quantity = ?, 
        cover_image = ?, status = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        title || currentBook.title,
        author || currentBook.author,
        category || currentBook.category,
        isbn || currentBook.isbn,
        description || currentBook.description,
        newQuantity,
        newAvailableQuantity,
        coverImage,
        status,
        id
      ]
    );

    connection.release();

    res.status(200).json({
      success: true,
      message: "Book updated successfully",
      book: {
        id: Number(id),
        title: title || currentBook.title,
        author: author || currentBook.author,
        category: category || currentBook.category,
        isbn: isbn || currentBook.isbn,
        description: description || currentBook.description,
        quantity: newQuantity,
        available_quantity: newAvailableQuantity,
        cover_image: coverImage,
        status: status,
      },
    });
  } catch (error) {
    console.error("❌ Error updating book:", error.message || error);
    res.status(500).json({
      success: false,
      message: "Failed to update book: " + error.message,
    });
  }
});

/**
 * @route   DELETE /api/books/:id
 * @desc    Delete a book
 */
router.delete("/:id", isLibrarian, async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    // First, get the book to check if it exists and get file paths
    const [books] = await connection.query("SELECT * FROM books WHERE id = ?", [id]);
    
    if (books.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    const book = books[0];

    // Check if book has any active borrowings
    const [borrowings] = await connection.query(
      "SELECT COUNT(*) as count FROM borrowings WHERE book_id = ? AND status IN ('Borrowed', 'Overdue')", 
      [id]
    );

    if (borrowings[0].count > 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: "Cannot delete book with active borrowings. Please return all borrowed copies first.",
      });
    }

    // Begin transaction
    await connection.beginTransaction();

    try {
      // Delete all borrowing records for this book (historical records)
      await connection.query("DELETE FROM borrowings WHERE book_id = ?", [id]);
      
      // Delete the book
      const [result] = await connection.query("DELETE FROM books WHERE id = ?", [id]);
      
      if (result.affectedRows === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          success: false,
          message: "Book not found",
        });
      }

      // Commit transaction
      await connection.commit();
      connection.release();

      // Delete associated files after successful database deletion
      if (book.cover_image) {
        const coverImagePath = path.join(uploadsDir, book.cover_image);
        if (fs.existsSync(coverImagePath)) {
          try {
            fs.unlinkSync(coverImagePath);
            console.log(`✅ Deleted cover image: ${book.cover_image}`);
          } catch (fileError) {
            console.warn(`⚠️ Failed to delete cover image: ${fileError.message}`);
          }
        }
      }

      if (book.qr_code) {
        const qrCodePath = path.join(uploadsDir, book.qr_code);
        if (fs.existsSync(qrCodePath)) {
          try {
            fs.unlinkSync(qrCodePath);
            console.log(`✅ Deleted QR code: ${book.qr_code}`);
          } catch (fileError) {
            console.warn(`⚠️ Failed to delete QR code: ${fileError.message}`);
          }
        }
      }

      console.log(`✅ Book deleted successfully: ${book.title} (ID: ${id})`);
      
      res.status(200).json({
        success: true,
        message: "Book deleted successfully",
        deletedBook: {
          id: book.id,
          title: book.title,
          author: book.author,
        },
      });

    } catch (transactionError) {
      await connection.rollback();
      connection.release();
      throw transactionError;
    }

  } catch (error) {
    console.error("❌ Error deleting book:", error.message || error);
    res.status(500).json({
      success: false,
      message: "Failed to delete book: " + error.message,
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
          WHEN b.available_quantity > 0 THEN 'Available'
          ELSE 'Not Available'
        END AS current_status,
        CASE 
          WHEN br.status = 'Borrowed' AND br.due_date < CURDATE() THEN 'Overdue'
          WHEN br.status IS NOT NULL THEN br.status
          WHEN b.available_quantity > 0 THEN 'Available'
          ELSE 'Not Available'
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
    // Update status based on available_quantity
    book.status = book.available_quantity > 0 ? "Available" : "Not Available";
    book.cover_image = book.cover_image ? `${req.protocol}://${req.get("host")}/uploads/${book.cover_image}` : null;
    book.qr_code = book.qr_code ? `${req.protocol}://${req.get("host")}/uploads/${book.qr_code}` : null;
    book.available_quantity = typeof book.available_quantity !== "undefined" ? Number(book.available_quantity) : undefined;

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
 * @route   GET /api/categories
 * @desc    Get all categories
 */
router.get("/categories", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [categories] = await connection.query("SELECT DISTINCT category as name FROM books WHERE category IS NOT NULL AND category != '' ORDER BY category");
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
 * @route   POST /api/categories
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
    
    // Check if category table exists, if not, create it
    await connection.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Insert the new category
    await connection.query("INSERT IGNORE INTO categories (name) VALUES (?)", [category]);
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