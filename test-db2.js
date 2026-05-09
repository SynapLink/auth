const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL || "postgres://auth:demidovmatwey29102010mdf@localhost:5432/auth" });

async function test() {
  try {
    // 1. Create a fake user
    const userRes = await pool.query(`INSERT INTO users (public_id, first_name, username, email, password_hash) VALUES ('u1', 'Test', 'test', 'test@test.com', 'hash') RETURNING id`);
    const userId = userRes.rows[0].id;

    // 2. Create a session
    const token = crypto.randomBytes(32).toString('base64url');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const sessRes = await pool.query(`INSERT INTO sessions (user_id, session_hash, ip, user_agent, expires_at) VALUES ($1, $2, '127.0.0.1', 'test', now() + interval '1 day') RETURNING *`, [userId, hash]);
    console.log("Session created:", sessRes.rows[0]);

    // 3. Update query (findSessionByToken)
    const updateQuery = `
      update sessions s
         set last_seen_at = now()
        from users u
       where s.user_id = u.id
         and s.session_hash = $1
         and s.revoked_at is null
         and s.expires_at > now()
       returning s.id, s.last_seen_at
    `;
    const res1 = await pool.query(updateQuery, [hash]);
    console.log("First find:", res1.rows[0]);

    const res2 = await pool.query(updateQuery, [hash]);
    console.log("Second find:", res2.rows[0]);

    // Cleanup
    await pool.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
    
  } catch(e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
test();
