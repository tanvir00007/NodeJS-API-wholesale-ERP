// ✅ Full Updated server.js for mobile + web (with JWT + modular routes and safe CORS)
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Safe CORS setup with dynamic origin check
const allowedOrigins = [
  'http://localhost:3000',       // Expo Web (localhost)
  'http://192.168.1.121:3000',   // Expo Web (LAN IP)
];

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://192.168.1.121:8081',
      'http://localhost:8081',
      'http://localhost:5173', // ✅ Include your actual frontend dev port!
    ];

    if (!origin) {
      console.log('🌐 [CORS] No origin - allowing');
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      console.log('✅ [CORS] Allowed origin:', origin);
      return callback(null, true);
    }

    console.warn('⛔ [CORS] Blocked origin:', origin);
    return callback(null, false); // ✅ Return false instead of throwing
  },
  credentials: true,
};


app.use(cors(corsOptions));
app.use(express.json());

// ✅ Serve static images from 'uploads' folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ Modular Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const orderRoutes = require('./routes/orders');
const productRoutes = require('./routes/products');

app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// ✅ Direct MySQL connection for legacy endpoints
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'shop_easy',
});

db.connect((err) => {
  if (err) throw err;
  console.log('✅ Connected to MySQL database');
});

// ✅ Products route (legacy fallback)
app.get('/products', (req, res) => {
  const sql = 'SELECT * FROM products';
  db.query(sql, (err, result) => {
    if (err) return res.status(500).send('Error fetching products');
    res.json(result);
  });
});

// ✅ Buyers list
app.get('/buyers', (req, res) => {
  const sql = 'SELECT id, name FROM buyers';
  db.query(sql, (err, result) => {
    if (err) return res.status(500).send('Error fetching buyers');
    res.json(result);
  });
});

app.get('/buyers/:id', (req, res) => {
  const buyerId = req.params.id;
  const sql = 'SELECT * FROM buyers WHERE id = ?';
  db.query(sql, [buyerId], (err, result) => {
    if (err) return res.status(500).send('Error fetching buyer details');
    if (result.length === 0) return res.status(404).send('Buyer not found');
    res.json(result[0]);
  });
});

// ✅ Order submission
app.post('/place-order', (req, res) => {
  const { buyer_id, username, user_id, total_items, total_price, items } = req.body;

  const orderSql = `
    INSERT INTO orders (buyer_id, username, user_id, total_items, total_price, status)
    VALUES (?, ?, ?, ?, ?, 1)
  `;

  db.query(orderSql, [buyer_id, username, user_id, total_items, total_price], (err, orderResult) => {
    if (err) {
      console.error('INSERT ERROR:', err);
      return res.status(500).send('Error placing order');
    }

    const orderId = orderResult.insertId;
    const itemValues = items.map(item => [orderId, item.name, item.quantity, item.price]);

    const itemsSql = `
      INSERT INTO order_items (order_id, item_name, quantity, price)
      VALUES ?
    `;

    db.query(itemsSql, [itemValues], (err) => {
      if (err) {
        console.error('ITEM INSERT ERROR:', err);
        return res.status(500).send('Error saving order items');
      }
      res.json({ success: true, orderId });
    });
  });
});

// ✅ Global Error Handler (optional)
app.use((err, req, res, next) => {
  console.error('🔥 Unhandled Error:', err.message);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// ✅ Server Start
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
