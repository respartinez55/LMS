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
