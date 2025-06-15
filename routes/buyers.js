const express = require('express');
const router = express.Router();
const db = require('../db');

// ✅ GET /api/buyers - list of buyers
router.get('/', (req, res) => {
  db.query('SELECT id, name FROM buyers', (err, result) => {
    if (err) return res.status(500).send('Error fetching buyers');
    res.json(result);
  });
});

// ✅ GET /api/buyers/:id - buyer detail
router.get('/:id', (req, res) => {
  const buyerId = req.params.id;
  db.query('SELECT * FROM buyers WHERE id = ?', [buyerId], (err, result) => {
    if (err) return res.status(500).send('Error fetching buyer details');
    if (result.length === 0) return res.status(404).send('Buyer not found');
    res.json(result[0]);
  });
});

module.exports = router;
