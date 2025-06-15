// routes/users.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Middleware to protect routes
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Create user (admin only)
router.post('/', authenticate, (req, res) => {
  if (req.user.role !== 0) return res.sendStatus(403);

  const { username, password, user_role, full_name, email, phone, emp_id, address } = req.body;
  const hashed = bcrypt.hashSync(password, 10);

  const sql = `
    INSERT INTO users (username, password, user_role, full_name, email, phone, emp_id, address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [username, hashed, user_role, full_name, email, phone, emp_id, address];

  db.query(sql, values, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, userId: result.insertId });
  });
});

// Get all users
router.get('/', authenticate, (req, res) => {
  if (req.user.role !== 0) return res.sendStatus(403);

  db.query('SELECT id, username, user_role, full_name, email, phone, emp_id, address, is_active FROM users', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    else res.status(200).json(rows);
  });
});

// Activate/deactivate user
router.patch('/:id/status', authenticate, (req, res) => {
  if (req.user.role !== 0) return res.sendStatus(403);
  const sql = 'UPDATE users SET is_active = ? WHERE id = ?';
  db.query(sql, [req.body.is_active, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Update user by ID
router.put('/:id', authenticate, (req, res) => {
    if (req.user.role !== 0) return res.sendStatus(403);
  
    const { full_name, email, phone, emp_id, address, user_role, is_active } = req.body;
    const sql = `
      UPDATE users SET full_name = ?, email = ?, phone = ?, emp_id = ?, address = ?, user_role = ?, is_active = ?
      WHERE id = ?
    `;
    const values = [full_name, email, phone, emp_id, address, user_role, is_active, req.params.id];
  
    db.query(sql, values, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
  

module.exports = router;
