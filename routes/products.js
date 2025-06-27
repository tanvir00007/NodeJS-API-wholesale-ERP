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
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const uploadImage = multer({ storage: imageStorage });

// ---------- Routes ----------

// GET /api/products - Fetch all products
router.get('/', (req, res) => {
  db.query('SELECT * FROM products', (err, results) => {
    if (err) {
      console.error('❌ Error fetching products:', err);
      return res.status(500).json({ error: 'Failed to fetch products' });
    }
    console.log('✅ Fetched products');
    return res.status(200).json(results);
  });
});

// POST /api/products - Add new product
router.post('/', uploadImage.single('newImage'), (req, res) => {
  const {
    name, price, cost, mpn, sku, packing, inventory_items, is_active
  } = req.body;

  const image = req.file ? req.file.filename : '';

  const sql = `
    INSERT INTO products
    (name, price, cost, mpn, sku, packing, inventory_items, is_active, image)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [
    name, price, cost, mpn, sku, packing,
    parseInt(inventory_items) || 0,
    is_active === 'true' || is_active === '1' ? 1 : 0,
    image
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('❌ Error inserting product:', err);
      return res.status(500).json({ error: 'Failed to add product' });
    }
    console.log(`✅ New product added: ${name} (ID: ${result.insertId})`);
    res.status(201).json({ message: 'Product added' });
  });
});

// PUT /api/products/:id - Update product
router.put('/:id', uploadImage.single('newImage'), (req, res) => {
  const { id } = req.params;
  const {
    name, price, cost, mpn, sku, packing, inventory_items, is_active, image
  } = req.body;
  const newImage = req.file ? req.file.filename : image;

  const sql = `
    UPDATE products SET
    name = ?, price = ?, cost = ?, mpn = ?, sku = ?, packing = ?,
    inventory_items = ?, is_active = ?, image = ?
    WHERE id = ?
  `;
  const values = [
    name, price, cost, mpn, sku, packing,
    parseInt(inventory_items) || 0,
    is_active === 'true' || is_active === '1' ? 1 : 0,
    newImage, id
  ];

  db.query(sql, values, (err) => {
    if (err) {
      console.error(`❌ Error updating product ID ${id}:`, err);
      return res.status(500).json({ error: 'Failed to update product' });
    }
    console.log(`✅ Product updated: ID ${id}`);
    res.json({ message: 'Product updated' });
  });
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
          const {
            id, name, price, cost, mpn, image, sku, packing,
            inventory_items, is_active
          } = row;

          const checkSql = 'SELECT * FROM products WHERE id = ?';
          db.query(checkSql, [id], (err, results) => {
            if (err) return reject(err);

            const productData = [
              name, price, cost, mpn, sku, packing,
              parseInt(inventory_items) || 0,
              is_active === 'true' || is_active === '1' ? 1 : 0,
              image
            ];

            if (results.length > 0) {
              // Update existing
              const updateSql = `
                UPDATE products SET
                name = ?, price = ?, cost = ?, mpn = ?, sku = ?, packing = ?,
                inventory_items = ?, is_active = ?, image = ?
                WHERE id = ?
              `;
              db.query(updateSql, [...productData, id], (err) =>
                err ? reject(err) : resolve(console.log(`🔁 Updated product ID ${id}`))
              );
            } else {
              // Insert new
              const insertSql = `
                INSERT INTO products
                (id, name, price, cost, mpn, sku, packing, inventory_items, is_active, image)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `;
              db.query(insertSql, [
                id, ...productData
              ], (err) =>
                err ? reject(err) : resolve(console.log(`➕ Inserted new product ID ${id}`))
              );
            }
          });
        });
      });

      Promise.all(tasks)
        .then(() => {
          fs.unlinkSync(filePath);
          console.log('✅ Bulk upload complete');
          res.json({ message: 'Bulk upload successful' });
        })
        .catch((err) => {
          fs.unlinkSync(filePath);
          console.error('❌ Bulk upload error:', err);
          res.status(500).json({ error: 'Bulk upload failed', details: err });
        });
    });
});

module.exports = router;
