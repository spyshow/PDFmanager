import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/db.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user.level !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Middleware to check if user can manage other users (admin or self)
const canManageUser = (req, res, next) => {
  const targetUserId = parseInt(req.params.id);
  if (req.user.level === 'admin' || req.user.id === targetUserId) {
    next();
  } else {
    res.status(403).json({ message: 'Insufficient permissions' });
  }
};

// @route   GET /api/users
// @desc    Get all users (admin only)
// @access  Private/Admin
router.get('/', auth, isAdmin, (req, res) => {
  try {
    db.all(
      'SELECT id, username, email, level, created_at FROM users ORDER BY created_at DESC',
      [],
      (err, users) => {
        if (err) {
          console.error(err.message);
          return res.status(500).json({ message: 'Server error' });
        }
        res.json(users);
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', auth, canManageUser, (req, res) => {
  try {
    db.get(
      'SELECT id, username, email, level, created_at FROM users WHERE id = ?',
      [req.params.id],
      (err, user) => {
        if (err) {
          console.error(err.message);
          return res.status(500).json({ message: 'Server error' });
        }
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users
// @desc    Create new user (admin only)
// @access  Private/Admin
router.post('/', auth, isAdmin, async (req, res) => {
  try {
    const { username, email, password, level = 'user' } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Please provide username, email, and password' });
    }

    if (!['admin', 'user', 'viewer'].includes(level)) {
      return res.status(400).json({ message: 'Invalid user level' });
    }

    // Check if user already exists
    db.get(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email],
      async (err, existingUser) => {
        if (err) {
          console.error(err.message);
          return res.status(500).json({ message: 'Server error' });
        }

        if (existingUser) {
          return res.status(400).json({ message: 'Username or email already exists' });
        }

        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insert new user
        db.run(
          'INSERT INTO users (username, email, password, level) VALUES (?, ?, ?, ?)',
          [username, email, hashedPassword, level],
          function(err) {
            if (err) {
              console.error(err.message);
              return res.status(500).json({ message: 'Server error' });
            }

            // Return the created user (without password)
            db.get(
              'SELECT id, username, email, level, created_at FROM users WHERE id = ?',
              [this.lastID],
              (err, newUser) => {
                if (err) {
                  console.error(err.message);
                  return res.status(500).json({ message: 'Server error' });
                }
                res.status(201).json(newUser);
              }
            );
          }
        );
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private
router.put('/:id', auth, canManageUser, async (req, res) => {
  try {
    const { username, email, level } = req.body;
    const userId = req.params.id;

    // Check if user exists
    db.get(
      'SELECT * FROM users WHERE id = ?',
      [userId],
      async (err, user) => {
        if (err) {
          console.error(err.message);
          return res.status(500).json({ message: 'Server error' });
        }

        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }

        // Validate level if provided
        if (level && !['admin', 'user', 'viewer'].includes(level)) {
          return res.status(400).json({ message: 'Invalid user level' });
        }

        // Check for username/email conflicts
        const checkQuery = 'SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?';
        db.get(checkQuery, [username, email, userId], (err, existingUser) => {
          if (err) {
            console.error(err.message);
            return res.status(500).json({ message: 'Server error' });
          }

          if (existingUser) {
            return res.status(400).json({ message: 'Username or email already exists' });
          }

          // Build update query
          const updates = [];
          const params = [];

          if (username) {
            updates.push('username = ?');
            params.push(username);
          }

          if (email) {
            updates.push('email = ?');
            params.push(email);
          }

          if (level && req.user.level === 'admin') {
            updates.push('level = ?');
            params.push(level);
          }

          if (updates.length === 0) {
            return res.status(400).json({ message: 'No valid fields to update' });
          }

          params.push(userId);

          const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

          db.run(query, params, function(err) {
            if (err) {
              console.error(err.message);
              return res.status(500).json({ message: 'Server error' });
            }

            // Return updated user
            db.get(
              'SELECT id, username, email, level, created_at FROM users WHERE id = ?',
              [userId],
              (err, updatedUser) => {
                if (err) {
                  console.error(err.message);
                  return res.status(500).json({ message: 'Server error' });
                }
                res.json(updatedUser);
              }
            );
          });
        });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user
// @access  Private/Admin
router.delete('/:id', auth, isAdmin, (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent admin from deleting themselves
    if (req.user.id === parseInt(userId)) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    // Check if user exists
    db.get(
      'SELECT * FROM users WHERE id = ?',
      [userId],
      (err, user) => {
        if (err) {
          console.error(err.message);
          return res.status(500).json({ message: 'Server error' });
        }

        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }

        // Delete user (cascade will handle related files)
        db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
          if (err) {
            console.error(err.message);
            return res.status(500).json({ message: 'Server error' });
          }

          res.json({ message: 'User deleted successfully' });
        });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;