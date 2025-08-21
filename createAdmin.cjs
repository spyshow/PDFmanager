const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('database.sqlite');

const username = 'admin';
const email = 'admin@example.com';
const password = 'admin123';
const level = 'admin';

bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Error hashing password:', err);
    return;
  }
  
  db.run(
    'INSERT OR IGNORE INTO users (username, email, password, level) VALUES (?, ?, ?, ?)',
    [username, email, hash, level],
    function(err) {
      if (err) {
        console.error('Error inserting user:', err);
      } else {
        console.log('Admin user created successfully');
      }
      db.close();
    }
  );
});