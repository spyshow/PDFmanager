const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite', sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the SQLite database.');
});

db.all('SELECT * FROM tags', [], (err, rows) => {
  if (err) {
    throw err;
  }
  console.log(JSON.stringify(rows, null, 2));
});

db.close((err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Closed the database connection.');
});