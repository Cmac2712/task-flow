const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// JWT Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Access token required',
      message: 'Please provide a valid authentication token'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(403).json({
        error: 'Invalid or expired token',
        message: 'Please login again'
      });
    }

    try {
      // Verify user still exists and is active
      const result = await pool.query(`
        SELECT id, email, role, is_active
        FROM users
        WHERE id = $1
      `, [user.id]);

      if (result.rows.length === 0 || !result.rows[0].is_active) {
        return res.status(403).json({
          error: 'User account not found or deactivated',
          message: 'Please contact administrator'
        });
      }

      req.user = user;
      next();
    } catch (dbErr) {
      console.error('Auth middleware database error:', dbErr);
      return res.status(500).json({
        error: 'Authentication verification failed'
      });
    }
  });
};

// Role-based authorization middleware
const authorize = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please login to access this resource'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: `This action requires one of the following roles: ${roles.join(', ')}`
      });
    }

    next();
  };
};

// Admin only middleware
const adminOnly = authorize(['admin']);

// Project manager or admin middleware
const managerOrAdmin = authorize(['admin', 'project_manager']);

module.exports = {
  authenticateToken,
  authorize,
  adminOnly,
  managerOrAdmin
};
