// const mysql = require('mysql2');
// require('dotenv').config();

// const db = mysql.createConnection({
//   host: 'localhost',
//   user: 'root',
//   password: '',
//   database: 'shop_easy',
// });

// db.connect((err) => {
//   if (err) throw err;
//   console.log('✅ MySQL Connected');
// });

// module.exports = db;

// ✅ Import mysql2 package to connect to MySQL database
const mysql = require('mysql2');

// ✅ Load environment variables from .env file into process.env
require('dotenv').config();

// ✅ Create a connection pool — recommended over single connection for stability and scalability
const db = mysql.createPool({
  host: process.env.DB_HOST,         // MySQL host, e.g., 'localhost'
  user: process.env.DB_USER,         // MySQL username, e.g., 'root'
  password: process.env.DB_PASSWORD, // MySQL password (can be blank)
  database: process.env.DB_NAME,     // MySQL database name, e.g., 'shop_easy'
  port: process.env.DB_PORT || 3306, // MySQL port, defaults to 3306 if not set in .env

  // ✅ Connection pool options
  waitForConnections: true,  // Wait if all connections are in use (instead of throwing error)
  connectionLimit: 10,       // Maximum number of active connections
  queueLimit: 0              // Unlimited request queue (set to > 0 if you want to limit queued queries)
});

// ✅ Optional: Immediately test if the connection works
db.getConnection((err, connection) => {
  if (err) {
    // ❌ Log error if connection fails
    console.error('❌ MySQL Connection Error:', err.message);
  } else {
    // ✅ Log success if connected
    console.log('✅ MySQL Pool Connected');
    connection.release(); // Important: Release the connection back to pool after testing
  }
});

// ✅ Export the db pool so it can be used in routes (e.g., db.query(...))
module.exports = db;


