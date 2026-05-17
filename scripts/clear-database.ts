import { Pool } from 'pg';

const pool = new Pool({ 
  connectionString: 'postgresql://neondb_owner:npg_O5BvQCWjFsS6@ep-polished-dew-aka12ar4.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function clearDatabase() {
  const client = await pool.connect();
  try {
    console.log('🔍 Verificando dados...');
    
    const clientsCount = await client.query('SELECT COUNT(*) as total FROM clients');
    const productsCount = await client.query('SELECT COUNT(*) as total FROM products');
    
    console.log(`Clientes: ${clientsCount.rows[0].total}`);
    console.log(`Produtos: ${productsCount.rows[0].total}`);
    
    console.log('\n🗑️ Limpando CLIENTES...');
    await client.query('DELETE FROM clients');
    
    console.log('🗑️ Limpando PRODUTOS...');
    await client.query('DELETE FROM products');
    
    const afterClients = await client.query('SELECT COUNT(*) as total FROM clients');
    const afterProducts = await client.query('SELECT COUNT(*) as total FROM products');
    
    console.log('\n✅ BASE LIMPA!');
    console.log(`Clientes restantes: ${afterClients.rows[0].total}`);
    console.log(`Produtos restantes: ${afterProducts.rows[0].total}`);
    
  } catch (err: any) {
    console.error('❌ Erro:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

clearDatabase();
