import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import db from '../config/db.js';
import { auth } from '../middleware/auth.js';

dotenv.config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// @route   POST /api/auth/register
// @desc    Register a user
// @access  Public
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  // Simple validation
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Please enter all fields' });
  }

  try {
    // Check if user already exists
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        console.error(err.message);
        return res.status(500).json({ message: 'Server error' });
      }

      if (user) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Create salt & hash
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Insert user into database
        db.run(
          'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
          [username, email, hashedPassword],
          function (err) {
            if (err) {
              console.error(err.message);
              return res.status(500).json({ message: 'Server error' });
            }

            // Create JWT payload
            const payload = {
              user: {
                id: this.lastID,
                level: 'user'
              }
            };

          // Sign token
          jwt.sign(
            payload,
            JWT_SECRET,
            { expiresIn: '1h' },
            (err, token) => {
              if (err) throw err;
              res.json({
                token,
                user: {
                  id: this.lastID,
                  username,
                  email
                }
              });
            }
          );
        }
      );
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Simple validation
  if (!email || !password) {
    return res.status(400).json({ message: 'Please enter all fields' });
  }

  // Check for existing user
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ message: 'Server error' });
    }

    if (!user) {
      return res.status(400).json({ message: 'User does not exist' });
    }

    // Validate password
    bcrypt.compare(password, user.password)
      .then(isMatch => {
        if (!isMatch) {
          return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Create JWT payload
        const payload = {
          user: {
            id: user.id,
            level: user.level
          }
        };

        // Sign token
        jwt.sign(
          payload,
          JWT_SECRET,
          { expiresIn: '1h' },
          (err, token) => {
            if (err) {
              console.error(err.message);
              return res.status(500).json({ message: 'Server error' });
            }
            res.json({
              token,
              user: {
                id: user.id,
                username: user.username,
                email: user.email,
                level: user.level
              }
            });
          }
        );
      })
      .catch(err => {
        console.error(err.message);
        res.status(500).json({ message: 'Server error' });
      });
  });
});

// @route   GET /api/auth/user
// @desc    Get user data
// @access  Private
router.get('/user', auth, (req, res) => {
  db.get('SELECT id, username, email, level FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ message: 'Server error' });
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  });
});

export default router;