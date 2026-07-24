import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_O5BvQCWjFsS6@ep-polished-dew-aka12ar4.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

const targets = ['clxn2000@hotmail.com', 'claudiolx.nunes@gmail.com'];

async function main() {
  const client = await pool.connect();
  try {
    const countRes = await client.query('SELECT COUNT(*) as c FROM users');
    console.log('TOTAL USERS IN DB:', countRes.rows[0].c);
    const allEmails = await client.query('SELECT id, email, "companyId", role FROM users ORDER BY id LIMIT 50');
    console.log('ALL USERS (first 50):');
    for (const r of allEmails.rows) {
      console.log(r.id, r.email, r.companyId, r.role);
    }
    for (const email of targets) {
      const result = await client.query(
        `SELECT id, "companyId", "openId", name, email, "loginMethod", "passwordHash", role, "createdAt", "updatedAt", "lastSignedIn"
         FROM users WHERE email = $1`,
        [email]
      );
      console.log(`\n=== ${email} ===`);
      if (result.rows.length === 0) {
        console.log('NAO ENCONTRADO');
        continue;
      }
      for (const row of result.rows) {
        console.log('id:', row.id);
        console.log('companyId:', row.companyId);
        console.log('openId:', row.openId);
        console.log('name:', row.name);
        console.log('email:', row.email);
        console.log('loginMethod:', row.loginMethod);
        const hash = row.passwordHash;
        console.log('passwordHash present:', !!hash);
        console.log('passwordHash length:', hash ? hash.length : 0);
        console.log('passwordHash prefix (format only):', hash ? hash.substring(0, 4) : null);
        console.log('role:', row.role);
        console.log('createdAt:', row.createdAt);
        console.log('updatedAt:', row.updatedAt);
        console.log('lastSignedIn:', row.lastSignedIn);
      }
    }

    // Also check case-insensitive / trimmed variants
    console.log('\n=== Case-insensitive/trim check for clxn2000 ===');
    const ci = await client.query(
      `SELECT id, email, LENGTH(email) as email_len FROM users WHERE LOWER(TRIM(email)) LIKE '%clxn2000%'`
    );
    console.log(ci.rows);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
