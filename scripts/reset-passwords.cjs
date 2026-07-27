// Script temporario para reset de senha de contas especificas em producao.
// Uso (no Shell do Render, dentro do diretorio do projeto):
//   node scripts/reset-passwords.cjs
// Le DATABASE_URL do ambiente (ja configurado pelo Render). Nao expõe hashes/senhas no output.
// APAGAR este arquivo (e commitar a remocao) logo apos o uso.

const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const NEW_PASSWORD = "032461";
const BCRYPT_ROUNDS = 12;
const TARGET_EMAILS = ["claudiolx.nunes@gmail.com", "clxn2000@hotmail.com"];

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("[reset-passwords] DATABASE_URL nao definido no ambiente.");
    process.exit(1);
  }

  const isLocalhost = dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1");
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    const passwordHash = await bcrypt.hash(NEW_PASSWORD, BCRYPT_ROUNDS);

    for (const email of TARGET_EMAILS) {
      const result = await client.query(
        `UPDATE users SET "passwordHash" = $1, "updatedAt" = NOW() WHERE email = $2 RETURNING id, email`,
        [passwordHash, email]
      );
      if (result.rowCount === 0) {
        console.log(`[reset-passwords] NAO ENCONTRADO: ${email}`);
      } else {
        console.log(`[reset-passwords] OK: senha atualizada para ${email} (id=${result.rows[0].id})`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[reset-passwords] ERRO:", err.message);
  process.exit(1);
});
