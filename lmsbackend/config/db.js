const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'lms_database',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Add execute method to pool for compatibility with routes
pool.execute = async function(sql, params = []) {
  const connection = await this.getConnection();
  try {
    const result = await connection.execute(sql, params);
    return result;
  } finally {
    connection.release();
  }
};

// Add query method to pool for compatibility
pool.query = async function(sql, params = []) {
  const connection = await this.getConnection();
  try {
    const result = await connection.query(sql, params);
    return result;
  } finally {
    connection.release();
  }
};

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connection established successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message || error);
    return false;
  }
}

async function initDatabase() {
  try {
    const connection = await pool.getConnection();

    // Create tables
    await connection.query(`
      CREATE TABLE IF NOT EXISTS books (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        author VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        isbn VARCHAR(20) NOT NULL UNIQUE,
        quantity INT NOT NULL DEFAULT 1,
        available_copies INT NOT NULL DEFAULT 1,
        description TEXT,
        cover_image VARCHAR(255),
        qr_code TEXT,
        status ENUM('Available', 'Not Available') DEFAULT 'Available',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS borrowers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(20),
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS issue_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        book_id INT NOT NULL,
        borrower_id INT NOT NULL,
        issue_date DATE NOT NULL,
        due_date DATE NOT NULL,
        return_date DATE,
        fine_amount DECIMAL(10,2) DEFAULT 0.00,
        fine_paid BOOLEAN DEFAULT FALSE,
        book_condition ENUM('Good', 'Damaged', 'Lost') DEFAULT 'Good',
        status ENUM('Issued', 'Returned', 'Overdue') DEFAULT 'Issued',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (borrower_id) REFERENCES borrowers(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
    CREATE TABLE IF NOT EXISTS reservations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      reservation_id VARCHAR(30) NOT NULL UNIQUE,
      book_id INT NOT NULL,
      user_id VARCHAR(100) NOT NULL,
      user_email VARCHAR(255) NOT NULL,
      user_name VARCHAR(255) NOT NULL,
      user_role ENUM('student', 'teacher') DEFAULT 'student',
      reserve_date DATE NOT NULL,
      return_date DATE NOT NULL,
      book_title VARCHAR(255) NOT NULL,
      cover_image VARCHAR(255),
      status ENUM('Pending', 'Approved', 'Rejected', 'Fulfilled', 'Cancelled', 'Expired') DEFAULT 'Pending',
      request_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      reserved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_book_id (book_id),
      INDEX idx_status (status),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );
  `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        reservation_id VARCHAR(30) NOT NULL UNIQUE,
        book_id INT NOT NULL,
        user_id VARCHAR(100) NOT NULL,
        user_email VARCHAR(255) NOT NULL,
        user_name VARCHAR(255) NOT NULL,
        user_role ENUM('student', 'teacher') DEFAULT 'student',
        reserve_date DATE NOT NULL,
        return_date DATE NOT NULL,
        book_title VARCHAR(255) NOT NULL,
        cover_image VARCHAR(255),
        status ENUM('Pending', 'Approved', 'Rejected', 'Fulfilled', 'Cancelled', 'Expired') DEFAULT 'Pending',
        request_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        reserved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_book_id (book_id),
        INDEX idx_status (status)
      )
    `);

    // Create activity_logs table for logging user actions
    await connection.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        action VARCHAR(100) NOT NULL,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_action (action),
        INDEX idx_timestamp (timestamp)
      )
    `);

    connection.release();
    console.log('✅ Database tables initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize database tables:', error.message || error);
    return false;
  }
}

const STATIC_USERNAME = 'librarian';
const STATIC_PASSWORD = 'librarian123';

async function verifyLibrarianCredentials(username, password) {
  if (username === STATIC_USERNAME && password === STATIC_PASSWORD) {
    console.log('✅ Librarian credentials verified successfully');
    return { success: true, message: 'Login successful' };
  } else {
    console.warn('❌ Incorrect librarian credentials');
    return { success: false, message: 'Incorrect username or password' };
  }
}

async function getStats() {
  try {
    const connection = await pool.getConnection();

    const [totalBooks] = await connection.query('SELECT COUNT(*) AS total FROM books');
    const [issuedBooks] = await connection.query('SELECT COUNT(*) AS total FROM issue_records WHERE return_date IS NULL');
    const [pendingReservations] = await connection.query('SELECT COUNT(*) AS total FROM reservations WHERE status = "Pending"');
    const [totalFines] = await connection.query('SELECT SUM(fine_amount) AS total FROM issue_records WHERE fine_paid = FALSE');

    connection.release();

    return {
      totalBooks: totalBooks[0].total,
      issuedBooks: issuedBooks[0].total,
      pendingReservations: pendingReservations[0].total,
      totalFines: totalFines[0].total || 0,
    };
  } catch (error) {
    console.error('❌ Error fetching stats:', error.message || error);
    throw error;
  }
}

async function addCategory(name) {
  try {
    const connection = await pool.getConnection();
    await connection.query('INSERT INTO categories (name) VALUES (?)', [name]);
    connection.release();
    return { success: true, message: 'Category added successfully' };
  } catch (error) {
    console.error('❌ Error adding category:', error.message || error);
    return { success: false, message: 'Failed to add category' };
  }
}

async function getCategories() {
  try {
    const connection = await pool.getConnection();
    const [categories] = await connection.query('SELECT name FROM categories');
    connection.release();
    return categories.map((category) => category.name);
  } catch (error) {
    console.error('❌ Error fetching categories:', error.message || error);
    throw error;
  }
}

// Utility function to safely execute queries with proper error handling
async function safeExecute(sql, params = []) {
  try {
    return await pool.execute(sql, params);
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Utility function to safely execute queries with proper error handling (using query method)
async function safeQuery(sql, params = []) {
  try {
    return await pool.query(sql, params);
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

module.exports = {
  pool,
  testConnection,
  initDatabase,
  getStats,
  verifyLibrarianCredentials,
  addCategory,
  getCategories,
  safeExecute,
  safeQuery,
  // Export the pool directly as db for backward compatibility
  execute: pool.execute.bind(pool),
  query: pool.query.bind(pool)
};