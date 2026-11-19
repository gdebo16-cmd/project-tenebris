import pool from './src/db.js';
const r = await pool.query("select current_database() db, (select count(*) from users) users");
console.log(r.rows[0]); await pool.end();
