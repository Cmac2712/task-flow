const express = require('express');
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const { pool } = require('../config/database');
const { adminOnly } = require('../middleware/auth');

const router = express.Router();

// Apply admin authentication to all routes
router.use(adminOnly);

// Get all users
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const result = await pool.query(`
      SELECT id, email, first_name, last_name, role, is_active, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const countResult = await pool.query('SELECT COUNT(*) FROM users');
    const total = parseInt(countResult.rows[0].count);

    res.json({
      users: result.rows.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        isActive: user.is_active,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({
      error: 'Unable to fetch users'
    });
  }
});

// Get user by ID
router.get('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({
        error: 'Invalid user ID'
      });
    }

    const result = await pool.query(`
      SELECT id, email, first_name, last_name, role, is_active, created_at, updated_at
      FROM users
      WHERE id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const user = result.rows[0];
    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        isActive: user.is_active,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });

  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({
      error: 'Unable to fetch user'
    });
  }
});

// Update user
router.put('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({
        error: 'Invalid user ID'
      });
    }

    const updateSchema = Joi.object({
      firstName: Joi.string().min(2).max(50),
      lastName: Joi.string().min(2).max(50),
      role: Joi.string().valid('admin', 'project_manager', 'team_member'),
      isActive: Joi.boolean()
    });

    const { error, value } = updateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details[0].message
      });
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (value.firstName !== undefined) {
      updates.push(`first_name = $${paramCount++}`);
      values.push(value.firstName);
    }
    if (value.lastName !== undefined) {
      updates.push(`last_name = $${paramCount++}`);
      values.push(value.lastName);
    }
    if (value.role !== undefined) {
      updates.push(`role = $${paramCount++}`);
      values.push(value.role);
    }
    if (value.isActive !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(value.isActive);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No valid fields to update'
      });
    }

    values.push(userId);
    const query = `
      UPDATE users
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING id, email, first_name, last_name, role, is_active, updated_at
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const user = result.rows[0];
    res.json({
      message: 'User updated successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        isActive: user.is_active,
        updatedAt: user.updated_at
      }
    });

  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({
      error: 'Unable to update user'
    });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({
        error: 'Invalid user ID'
      });
    }

    // Prevent admin from deleting themselves
    if (userId === req.user.id) {
      return res.status(400).json({
        error: 'Cannot delete your own account'
      });
    }

    const result = await pool.query(`
      DELETE FROM users
      WHERE id = $1
      RETURNING id, email
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({
      message: 'User deleted successfully',
      deletedUser: {
        id: result.rows[0].id,
        email: result.rows[0].email
      }
    });

  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({
      error: 'Unable to delete user'
    });
  }
});

// Reset user password
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({
        error: 'Invalid user ID'
      });
    }

    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters long'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const result = await pool.query(`
      UPDATE users
      SET password = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email
    `, [hashedPassword, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Clear all user sessions to force re-login
    await pool.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);

    res.json({
      message: 'Password reset successfully',
      user: {
        id: result.rows[0].id,
        email: result.rows[0].email
      }
    });

  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({
      error: 'Unable to reset password'
    });
  }
});

// Get system stats
router.get('/stats', async (req, res) => {
  try {
    const userStats = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE is_active = true) as active_users,
        COUNT(*) FILTER (WHERE role = 'admin') as admin_count,
        COUNT(*) FILTER (WHERE role = 'project_manager') as manager_count,
        COUNT(*) FILTER (WHERE role = 'team_member') as member_count
      FROM users
    `);

    const sessionStats = await pool.query(`
      SELECT COUNT(*) as active_sessions
      FROM user_sessions
      WHERE expires_at > CURRENT_TIMESTAMP
    `);

    res.json({
      users: userStats.rows[0],
      sessions: sessionStats.rows[0],
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({
      error: 'Unable to fetch system statistics'
    });
  }
});

module.exports = router;
