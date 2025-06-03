const { pool } = require('../config/db');
const fs = require('fs');
const path = require('path');
const util = require('util');

const writeFile = util.promisify(fs.writeFile);
const mkdir = util.promisify(fs.mkdir);

const COVER_DIR = path.join(__dirname, '..', 'public', 'uploads', 'covers');
const QR_DIR = path.join(__dirname, '..', 'public', 'uploads', 'qrcodes');

const ensureDir = async (dir) => {
  try {
    await mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
};

// ---------- DASHBOARD STATS ----------
exports.getDashboardStats = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const [[{ total: totalBooks }]] = await conn.query('SELECT COUNT(*) as total FROM books');
    const [[{ total: issuedBooks }]] = await conn.query('SELECT COUNT(*) as total FROM books WHERE status = "Issued"');
    const [[{ total: pendingReservations }]] = await conn.query('SELECT COUNT(*) as total FROM reservations WHERE status = "Pending"');
    const [[{ total: totalFines }]] = await conn.query('SELECT SUM(fine_amount) as total FROM issue_records WHERE fine_paid = FALSE');

    return res.json({
      success: true,
      totalBooks,
      issuedBooks,
      pendingReservations,
      totalFines: totalFines || 0,
    });
  } catch (error) {
    console.error('❌ [getDashboardStats] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get dashboard statistics', error: error.message });
  } finally {
    if (conn) conn.release();
  }
};

// ---------- MANAGE BOOKS ----------
exports.getAllBooks = async (req, res) => {
  let conn;
  try {
    const { category, status, search, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const filters = [];
    const params = [];

    if (category) { filters.push('category = ?'); params.push(category); }
    if (status) { filters.push('status = ?'); params.push(status); }
    if (search) {
      filters.push('(title LIKE ? OR author LIKE ? OR isbn LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const query = `SELECT * FROM books ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const countQuery = `SELECT COUNT(*) as total FROM books ${whereClause}`;

    conn = await pool.getConnection();
    const [books] = await conn.query(query, [...params, parseInt(limit), offset]);
    const [[{ total }]] = await conn.query(countQuery, params);

    return res.json({
      success: true,
      books,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    console.error('❌ [getAllBooks] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get books', error: error.message });
  } finally {
    if (conn) conn.release();
  }
};

// ---------- GET BOOK BY ID ----------
exports.getBookById = async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    conn = await pool.getConnection();
    const [books] = await conn.query('SELECT * FROM books WHERE id = ?', [id]);

    if (books.length === 0) return res.status(404).json({ success: false, message: 'Book not found' });

    return res.json({ success: true, book: books[0] });
  } catch (error) {
    console.error('❌ [getBookById] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get book', error: error.message });
  } finally {
    if (conn) conn.release();
  }
};

// ---------- GET BOOK BY ISBN ----------
exports.getBookByISBN = async (req, res) => {
  let conn;
  try {
    const { isbn } = req.params;
    conn = await pool.getConnection();
    const [books] = await conn.query('SELECT * FROM books WHERE isbn = ?', [isbn]);

    if (books.length === 0) return res.status(404).json({ success: false, message: 'Book not found' });

    return res.json({ success: true, book: books[0] });
  } catch (error) {
    console.error('❌ [getBookByISBN] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get book by ISBN', error: error.message });
  } finally {
    if (conn) conn.release();
  }
};

// ---------- ADD BOOK ----------
exports.addBook = async (req, res) => {
  let conn;
  try {
    const { title, author, category, isbn, description, qrCode } = req.body;
    if (!title || !author || !category || !isbn) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    conn = await pool.getConnection();
    const [existing] = await conn.query('SELECT * FROM books WHERE isbn = ?', [isbn]);
    if (existing.length) return res.status(400).json({ success: false, message: 'Book with this ISBN already exists' });

    let coverImagePath = null;
    let qrCodePath = null;

    if (req.files?.bookCover) {
      await ensureDir(COVER_DIR);
      const cover = req.files.bookCover;
      const filename = `${Date.now()}-${isbn}-cover${path.extname(cover.name)}`;
      await cover.mv(path.join(COVER_DIR, filename));
      coverImagePath = `/uploads/covers/${filename}`;
    }

    if (qrCode?.startsWith('data:image/')) {
      await ensureDir(QR_DIR);
      const base64Data = qrCode.split(',')[1];
      const qrFileName = `${Date.now()}-${isbn}-qr.png`;
      await writeFile(path.join(QR_DIR, qrFileName), base64Data, 'base64');
      qrCodePath = `/uploads/qrcodes/${qrFileName}`;
    }

    const [result] = await conn.query(
      `INSERT INTO books (title, author, category, isbn, description, cover_image, qr_code, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, author, category, isbn, description, coverImagePath, qrCodePath, 'Available']
    );

    return res.status(201).json({
      success: true,
      message: 'Book added successfully',
      bookId: result.insertId
    });
  } catch (error) {
    console.error('❌ [addBook] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to add book', error: error.message });
  } finally {
    if (conn) conn.release();
  }
};

// ---------- BORROW BOOK ----------
exports.borrowBook = async (req, res) => {
  let conn;
  try {
    const {
      transaction_id,
      book_id,
      user_id,
      user_email,
      user_name,
      borrow_date,
      due_date,
      qr_code,
      image_path
    } = req.body;

    // Validate required fields
    if (!book_id || !user_id || !user_email || !user_name || !borrow_date || !due_date) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: book_id, user_id, user_email, user_name, borrow_date, due_date' 
      });
    }

    conn = await pool.getConnection();
    
    // Start transaction
    await conn.beginTransaction();

    try {
      // Check if book exists and get its current quantity
      const [bookRows] = await conn.query(
        'SELECT quantity, status FROM books WHERE id = ? FOR UPDATE',
        [book_id]
      );

      if (bookRows.length === 0) {
        await conn.rollback();
        return res.status(404).json({ success: false, message: 'Book not found' });
      }

      const currentQuantity = bookRows[0].quantity || 0;
      const currentStatus = bookRows[0].status;

      if (currentQuantity <= 0 || currentStatus === 'Not Available') {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Book is not available for borrowing' });
      }

      // Insert borrowing record
      const [borrowResult] = await conn.query(`
        INSERT INTO borrowings 
        (transaction_id, book_id, user_id, user_email, user_name, borrow_date, due_date, qr_code, image_path, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        transaction_id, book_id, user_id, user_email, user_name, 
        borrow_date, due_date, qr_code, image_path, 'Active'
      ]);

      // Update book quantity and status
      const newQuantity = currentQuantity - 1;
      let newStatus = newQuantity === 0 ? 'Not Available' : 'Available';

      await conn.query(`
        UPDATE books SET quantity = ?, status = ? WHERE id = ?
      `, [newQuantity, newStatus, book_id]);

      // Commit transaction
      await conn.commit();

      return res.status(200).json({ 
        success: true, 
        message: 'Book borrowed successfully',
        borrowingId: borrowResult.insertId,
        newQuantity,
        newStatus
      });

    } catch (transactionError) {
      await conn.rollback();
      throw transactionError;
    }

  } catch (error) {
    console.error('❌ [borrowBook] Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error borrowing book', 
      error: error.message 
    });
  } finally {
    if (conn) conn.release();
  }
};

// ---------- RETURN BOOK ----------
exports.returnBook = async (req, res) => {
  let conn;
  try {
    const { borrowing_id, return_date, condition, fine_amount = 0 } = req.body;

    if (!borrowing_id || !return_date) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: borrowing_id, return_date' 
      });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
      // Get borrowing record and book info
      const [borrowingRows] = await conn.query(`
        SELECT b.*, bk.quantity, bk.status 
        FROM borrowings b 
        JOIN books bk ON b.book_id = bk.id 
        WHERE b.id = ? AND b.status = 'Active'
      `, [borrowing_id]);

      if (borrowingRows.length === 0) {
        await conn.rollback();
        return res.status(404).json({ success: false, message: 'Active borrowing record not found' });
      }

      const borrowing = borrowingRows[0];
      const currentQuantity = borrowing.quantity || 0;

      // Update borrowing record
      await conn.query(`
        UPDATE borrowings 
        SET status = 'Returned', return_date = ?, condition_on_return = ?, fine_amount = ?
        WHERE id = ?
      `, [return_date, condition, fine_amount, borrowing_id]);

      // Update book quantity and status
      const newQuantity = currentQuantity + 1;
      const newStatus = 'Available';

      await conn.query(`
        UPDATE books SET quantity = ?, status = ? WHERE id = ?
      `, [newQuantity, newStatus, borrowing.book_id]);

      await conn.commit();

      return res.status(200).json({ 
        success: true, 
        message: 'Book returned successfully',
        newQuantity,
        fineAmount: fine_amount
      });

    } catch (transactionError) {
      await conn.rollback();
      throw transactionError;
    }

  } catch (error) {
    console.error('❌ [returnBook] Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error returning book', 
      error: error.message 
    });
  } finally {
    if (conn) conn.release();
  }
};

// ---------- GET BORROWING RECORDS ----------
exports.getBorrowingRecords = async (req, res) => {
  let conn;
  try {
    const { user_id, status, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const filters = [];
    const params = [];

    if (user_id) { filters.push('br.user_id = ?'); params.push(user_id); }
    if (status) { filters.push('br.status = ?'); params.push(status); }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const query = `
      SELECT br.*, b.title, b.author, b.isbn 
      FROM borrowings br
      JOIN books b ON br.book_id = b.id
      ${whereClause}
      ORDER BY br.borrow_date DESC 
      LIMIT ? OFFSET ?
    `;
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM borrowings br
      JOIN books b ON br.book_id = b.id
      ${whereClause}
    `;

    conn = await pool.getConnection();
    const [records] = await conn.query(query, [...params, parseInt(limit), offset]);
    const [[{ total }]] = await conn.query(countQuery, params);

    return res.json({
      success: true,
      records,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    console.error('❌ [getBorrowingRecords] Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to get borrowing records', 
      error: error.message 
    });
  } finally {
    if (conn) conn.release();
  }
};

// ---------- REPORT / EXPORT ----------
exports.getBooksReport = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [books] = await conn.query('SELECT id, title, author, category, isbn, status FROM books ORDER BY title ASC');

    return res.json({
      success: true,
      report: books
    });
  } catch (error) {
    console.error('❌ [getBooksReport] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate report', error: error.message });
  } finally {
    if (conn) conn.release();
  }
};