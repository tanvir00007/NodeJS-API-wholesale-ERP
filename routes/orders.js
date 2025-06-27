const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Middleware to verify JWT
const authenticate = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// ✅ Get All Orders with action_by full name
router.get('/', authenticate, (req, res) => {
  const sql = `
    SELECT 
      o.id,
      o.buyer_id,
      b.name AS buyer_name,
      o.username,
      o.total_items,
      o.total_price,
      o.discount,
      o.created_at,
      o.updated_at,
      o.status,
      o.payment_method,
      o.invoice_file,
      o.action_by,
      u2.full_name AS action_by_name
    FROM orders o
    LEFT JOIN buyers b ON o.buyer_id = b.id
    LEFT JOIN users u2 ON o.action_by = u2.id
    ORDER BY o.id DESC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// ✅ Get Single Order with Buyer + Items + Discounts
router.get('/:id', authenticate, (req, res) => {
  const orderId = req.params.id;

  const orderSql = `
    SELECT o.*, 
           b.name AS buyer_name, 
           b.phone AS buyer_phone, 
           b.email AS buyer_email, 
           b.address AS buyer_address,
           u.full_name AS salesman_name
    FROM orders o
    LEFT JOIN buyers b ON o.buyer_id = b.id
    LEFT JOIN users u ON o.user_id = u.id
    WHERE o.id = ?
  `;

  const itemsSql = `
    SELECT item_name, quantity, price, discount
    FROM order_items
    WHERE order_id = ?
  `;

  db.query(orderSql, [orderId], (err, orderResults) => {
    if (err) return res.status(500).json({ error: err.message });
    if (orderResults.length === 0) return res.status(404).json({ error: 'Order not found' });

    const order = orderResults[0];

    db.query(itemsSql, [orderId], (err, itemResults) => {
      if (err) return res.status(500).json({ error: err.message });

      order.items = itemResults;
      res.json(order);
    });
  });
});

// ✅ Update Order Items + Discounts
router.put('/:id/items', authenticate, (req, res) => {
  const orderId = req.params.id;
  const { items, user_id, order_discount } = req.body;

  if (!items?.length) {
    return res.status(400).json({ error: 'No items provided' });
  }

  const deleteSql = `DELETE FROM order_items WHERE order_id = ?`;
  const insertSql = `
    INSERT INTO order_items (order_id, item_name, quantity, price, discount)
    VALUES ?
  `;
  const itemValues = items.map(item => [
    orderId,
    item.item_name,
    item.quantity,
    item.price,
    item.discount || 0
  ]);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + (i.quantity * i.price - (i.discount || 0)), 0);
  const totalPrice = subtotal - (order_discount || 0);

  const updateOrderSql = `
    UPDATE orders 
    SET total_items = ?, 
        total_price = ?, 
        discount = ?, 
        updated_at = NOW(), 
        action_by = ?
    WHERE id = ?
  `;

  db.query(deleteSql, [orderId], (err) => {
    if (err) return res.status(500).json({ error: err.message });

    db.query(insertSql, [itemValues], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });

      db.query(updateOrderSql, [totalItems, totalPrice, order_discount || 0, user_id, orderId], (err3) => {
        if (err3) return res.status(500).json({ error: err3.message });

        res.json({
          message: 'Order items and discounts updated successfully',
          total_items: totalItems,
          total_price: totalPrice,
          order_discount: order_discount || 0
        });
      });
    });
  });
});

// ✅ Update Order Status
router.put('/:id/status', authenticate, (req, res) => {
  const { status } = req.body;
  const sql = 'UPDATE orders SET status = ? WHERE id = ?';
  db.query(sql, [status, req.params.id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Order status updated' });
  });
});

// ✅ Submit Payment + Upload Invoice
const upload = require('../routes/upload');

router.post('/:id/payment', authenticate, upload.single('invoice'), (req, res) => {
  const { payment_method } = req.body;
  const invoice_path = req.file ? req.file.path : null;

  if (!invoice_path || !payment_method) {
    return res.status(400).json({ error: 'Invoice and payment method are required' });
  }

  const sql = `
    UPDATE orders
    SET status = 3, payment_method = ?, invoice_file = ?
    WHERE id = ?
  `;
  db.query(sql, [payment_method, invoice_path, req.params.id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Payment completed and invoice uploaded' });
  });
});

// ✅ Place New Order (with optional discounts)
router.post('/place-order', (req, res) => {
  const {
    buyer_id,
    username,
    user_id,
    total_items,
    total_price,
    discount = 0,
    items
  } = req.body;

  if (!buyer_id || !username || !user_id || !total_items || !total_price || !items?.length) {
    return res.status(400).json({ error: 'Missing required order fields' });
  }

  const orderSql = `
    INSERT INTO orders (buyer_id, username, user_id, total_items, total_price, discount, status)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `;

  db.query(orderSql, [buyer_id, username, user_id, total_items, total_price, discount], (err, orderResult) => {
    if (err) {
      console.error('❌ INSERT ERROR:', err);
      return res.status(500).send('Error placing order');
    }

    const orderId = orderResult.insertId;
    const itemValues = items.map(item => [
      orderId,
      item.name,
      item.quantity,
      item.price,
      item.discount || 0
    ]);

    const itemsSql = `
      INSERT INTO order_items (order_id, item_name, quantity, price, discount)
      VALUES ?
    `;

    db.query(itemsSql, [itemValues], (err) => {
      if (err) {
        console.error('❌ ITEM INSERT ERROR:', err);
        return res.status(500).send('Error saving order items');
      }
      res.json({ success: true, orderId });
    });
  });
});

module.exports = router;
