const bcrypt = require('bcryptjs');

const password = 'admin'; // your plain text password
const hash = bcrypt.hashSync(password, 10);

console.log('🔐 Hashed Password:', hash);
