const express = require('express');
const router = express.Router();
const db = require('../db');

// =============================
// ✅ GET /api/buyers - ID + name list (used in dropdowns)
// =============================
router.get('/', (req, res) => {
  db.query('SELECT id, name FROM buyers', (err, result) => {
    if (err) {
      console.error('❌ DB error in GET /api/buyers:', err);
      return res.status(500).send('Error fetching buyers');
    }
    console.log(`✅ Buyers list fetched: ${result.length} records`);
    res.json(result);
  });
});

// =============================
// ✅ GET /api/buyers/:id - Single client by ID
// =============================
router.get('/:id', (req, res) => {
  const buyerId = req.params.id;
  db.query('SELECT * FROM buyers WHERE id = ?', [buyerId], (err, result) => {
    if (err) {
      console.error(`❌ DB error in GET /api/buyers/${buyerId}:`, err);
      return res.status(500).send('Error fetching buyer details');
    }
    if (result.length === 0) {
      console.warn(`⚠️ No buyer found with ID ${buyerId}`);
      return res.status(404).send('Buyer not found');
    }
    console.log(`✅ Buyer fetched: ID ${buyerId}`);
    res.json(result[0]);
  });
});

// =============================
// ✅ GET /api/buyers/full/list - Full data for client table
// =============================
router.get('/full/list', (req, res) => {
  db.query('SELECT * FROM buyers ORDER BY id DESC', (err, result) => {
    if (err) {
      console.error('❌ DB error in GET /api/buyers/full/list:', err);
      return res.status(500).send('Error fetching full client list');
    }
    console.log(`✅ Full buyer list fetched: ${result.length} records`);
    res.json(result);
  });
});

// =============================
// ✅ POST /api/buyers - Add new client
// =============================
router.post('/', (req, res) => {
  const {
    name, phone, address, email,
    city, state, zip_code,
    is_billing, contact, billing_address, is_active
  } = req.body;

  // Minimal required fields
  if (!name || !address) {
    console.warn('⚠️ Missing name or address in POST /api/buyers');
    return res.status(400).json({ error: 'Name and address are required' });
  }

  // If is_billing = 1, use address as billing address
  const billingAddr = parseInt(is_billing) === 1 ? address : billing_address;

  const sql = `
    INSERT INTO buyers 
    (name, phone, address, email, city, state, zip_code, is_billing, contact, billing_address, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [
    name, phone, address, email,
    city, state, zip_code,
    parseInt(is_billing) || 0,
    contact, billingAddr,
    parseInt(is_active) || 1
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('❌ Error adding buyer in POST /api/buyers:', err);
      return res.status(500).json({ error: 'Failed to add buyer' });
    }
    console.log(`✅ Buyer added: ${name} (ID: ${result.insertId})`);
    res.status(201).json({ message: 'Buyer added' });
  });
});

// =============================
// ✅ PUT /api/buyers/:id - Update existing client
// =============================
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const {
    name, phone, address, email,
    city, state, zip_code,
    is_billing, contact, billing_address, is_active
  } = req.body;

  if (!name || !address) {
    console.warn(`⚠️ Missing name or address in PUT /api/buyers/${id}`);
    return res.status(400).json({ error: 'Name and address are required' });
  }

  const billingAddr = parseInt(is_billing) === 1 ? address : billing_address;

  const sql = `
    UPDATE buyers SET 
      name = ?, phone = ?, address = ?, email = ?, city = ?, state = ?, zip_code = ?,
      is_billing = ?, contact = ?, billing_address = ?, is_active = ?
    WHERE id = ?
  `;
  const values = [
    name, phone, address, email,
    city, state, zip_code,
    parseInt(is_billing) || 0,
    contact, billingAddr,
    parseInt(is_active) || 1,
    id
  ];

  db.query(sql, values, (err) => {
    if (err) {
      console.error(`❌ Error updating buyer ID ${id} in PUT /api/buyers/:id:`, err);
      return res.status(500).json({ error: 'Failed to update buyer' });
    }
    console.log(`✅ Buyer updated successfully: ID ${id}`);
    res.json({ message: 'Buyer updated' });
  });
});

// ✅ PATCH /api/buyers/:id/status - Toggle active/inactive
router.patch('/:id/status', (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;

  if (typeof is_active === 'undefined') {
    return res.status(400).json({ error: 'Missing is_active value' });
  }

  const val = parseInt(is_active) === 1 ? 1 : 0;

  db.query(
    'UPDATE buyers SET is_active = ? WHERE id = ?',
    [val, id],
    (err, result) => {
      if (err) {
        console.error(`❌ Failed to toggle status for buyer ${id}:`, err);
        return res.status(500).json({ error: 'Toggle failed' });
      }
      console.log(`✅ is_active updated for buyer ${id} → ${val}`);
      res.json({ message: 'Status updated' });
    }
  );
});


module.exports = router;
