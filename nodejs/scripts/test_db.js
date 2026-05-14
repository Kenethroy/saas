import pool from '#shared/database/mysql.js';

async function test() {
  const [rows] = await pool.query('SELECT 1 as result');
  console.log('DB connected:', rows[0].result);
  process.exit(0);
}
test();
