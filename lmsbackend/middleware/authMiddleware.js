/**
 * Middleware to check if the user is a librarian
 * This middleware uses a static check for simplicity.
 */
const isLibrarian = (req, res, next) => {
  // Check using a static value (can be replaced with auth logic)
  const isLibrarianAccess = true;

  if (isLibrarianAccess) {
    console.log('✅ Librarian access granted');
    return next();
  }

  console.warn('❌ Access denied. User is not a librarian.');
  return res.status(403).json({ success: false, message: 'Access restricted to librarian' });
};

module.exports = { isLibrarian };
