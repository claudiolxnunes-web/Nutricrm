import { Pool } from 'pg';

const pool = new Pool({ 
  connectionString: 'postgresql://neondb_owner:npg_O5BvQCWjFsS6@ep-polished-dew-aka12ar4.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function clearAllData() {
  const client = await pool.connect();
  try {
    console.log('🔍 Verificando todas as tabelas...\n');
    
    // Verificar contagens antes
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
      { name: 'orcamentos_simples', label: 'Orçamentos Simples' },
      { name: 'users', label: 'Usuários (exceto admin)' },
    ];
    
    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) as total FROM ${table.name}`);
        console.log(`${table.label}: ${result.rows[0].total}`);
      } catch (e: any) {
        console.log(`${table.label}: ERRO - ${e.message}`);
      }
    }
    
    console.log('\n🗑️ LIMPANDO TODAS AS BASES...\n');
    
    // Ordem segura para deleção (filhos antes dos pais)
    console.log('1. Limpando itens de orçamentos...');
    await client.query('DELETE FROM "quoteItems"');
    
    console.log('2. Limpando orçamentos...');
    await client.query('DELETE FROM quotes');
    
    console.log('3. Limpando vendas...');
    await client.query('DELETE FROM sales');
    
    console.log('4. Limpando interações...');
    await client.query('DELETE FROM interactions');
    
    console.log('5. Limpando oportunidades...');
    await client.query('DELETE FROM opportunities');
    
    console.log('6. Limpando orçamentos simples (se existir)...');
    try {
      await client.query('DELETE FROM orcamentos_simples');
    } catch (e) {
      console.log('   (tabela não existe, ignorando)');
    }
    
    console.log('7. Limpando clientes...');
    await client.query('DELETE FROM clients');
    
    console.log('8. Limpando produtos...');
    await client.query('DELETE FROM products');
    
    console.log('9. Limpando metas mensais...');
    await client.query('DELETE FROM monthly_goals');
    
    console.log('10. Limpando assinaturas push...');
    await client.query('DELETE FROM push_subscriptions');
    
    console.log('11. Limpando usuários (mantendo role=admin)...');
    await client.query("DELETE FROM users WHERE role != 'admin'");
    
    console.log('\n✅ VERIFICANDO APÓS LIMPEZA:\n');
    
    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) as total FROM ${table.name}`);
        console.log(`${table.label}: ${result.rows[0].total}`);
      } catch (e: any) {
        console.log(`${table.label}: ERRO`);
      }
    }
    
    console.log('\n🎉 BASE DE DADOS COMPLETAMENTE LIMPA!');
    console.log('Apenas empresa e admin principal foram preservados.');
    
  } catch (err: any) {
    console.error('❌ Erro:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

clearAllData();
