import { Pool } from 'pg';

const pool = new Pool({ 
  connectionString: 'postgresql://neondb_owner:npg_O5BvQCWjFsS6@ep-polished-dew-aka12ar4.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function checkDatabase() {
  const client = await pool.connect();
  try {
    console.log('🔍 VERIFICANDO BANCO DE PRODUÇÃO:\n');
    
    const tables = [
      { name: 'sales', label: 'Vendas' },
      { name: 'interactions', label: 'Interações' },
      { name: 'opportunities', label: 'Oportunidades' },
      { name: 'quotes', label: 'Orçamentos' },
      { name: '"quoteItems"', label: 'Itens de Orçamento' },
      { name: 'clients', label: 'Clientes' },
      { name: 'products', label: 'Produtos' },
      { name: 'monthly_goals', label: 'Metas Mensais' },
      { name: 'push_subscriptions', label: 'Assinaturas Push' },
      { name: 'users', label: 'Usuários' },
    ];
    
    let totalRecords = 0;
    
    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) as total FROM ${table.name}`);
        const count = parseInt(result.rows[0].total);
        totalRecords += count;
        console.log(`${table.label}: ${count}`);
      } catch (e: any) {
        console.log(`${table.label}: ERRO - ${e.message}`);
      }
    }
    
    console.log(`\n📊 Total de registros: ${totalRecords}`);
    
    if (totalRecords === 0) {
      console.log('\n✅ BASE ESTÁ COMPLETAMENTE LIMPA!');
    } else {
      console.log('\n⚠️ AINDA EXISTEM REGISTROS NO BANCO');
    }
    
  } catch (err: any) {
    console.error('❌ Erro:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkDatabase();
