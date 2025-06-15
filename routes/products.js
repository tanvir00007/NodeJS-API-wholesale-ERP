// backend/routes/products.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const csv = require('csv-parser');
const fs = require('fs');
const db = require('../db');

// ---------- Storage Setup ----------

// CSV upload
const uploadCSV = multer({ dest: 'uploads/' });

// Image upload
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = Date.now() + ext;
    cb(null, filename);
  }
});
const uploadImage = multer({ storage: imageStorage });

// ---------- Routes ----------

// GET /api/products - Fetch all products
router.get('/', (req, res) => {
  db.query('SELECT * FROM products', (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch products' });
    else return res.status(200).json(results);
  });
});

// PUT /api/products/:id - Update a single product with optional image
router.put('/:id', uploadImage.single('newImage'), (req, res) => {
  const { id } = req.params;
  const { name, price, cost, mpn, image } = req.body;
  const newImage = req.file ? req.file.filename : image;

  db.query(
    'UPDATE products SET name = ?, price = ?, cost = ?, mpn = ?, image = ? WHERE id = ?',
    [name, price, cost, mpn, newImage, id],
    (err) => {
      if (err) return res.status(500).json({ error: 'Failed to update product' });
      res.json({ message: 'Product updated' });
    }
  );
});

// POST /api/products/bulk - Bulk upload from CSV
router.post('/bulk', uploadCSV.single('csv'), (req, res) => {
  const filePath = req.file.path;
  const rows = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => rows.push(row))
    .on('end', () => {
      const tasks = rows.map(row => {
        return new Promise((resolve, reject) => {
          const { id, name, price, cost, mpn, image } = row;

          db.query('SELECT * FROM products WHERE id = ?', [id], (err, results) => {
            if (err) return reject(err);
            if (results.length > 0) {
              // Update existing
              db.query(
                'UPDATE products SET name = ?, price = ?, cost = ?, mpn = ?, image = ? WHERE id = ?',
                [name, price, cost, mpn, image, id],
                (err) => err ? reject(err) : resolve()
              );
            } else {
              // Insert new
              db.query(
                'INSERT INTO products (id, name, price, cost, mpn, image) VALUES (?, ?, ?, ?, ?, ?)',
                [id, name, price, cost, mpn, image],
                (err) => err ? reject(err) : resolve()
              );
            }
          });
        });
      });

      Promise.all(tasks)
        .then(() => {
          fs.unlinkSync(filePath); // Delete CSV after processing
          res.json({ message: 'Bulk upload successful' });
        })
        .catch((err) => {
          fs.unlinkSync(filePath);
          res.status(500).json({ error: 'Bulk upload failed', details: err });
        });
    });
});

module.exports = router;
