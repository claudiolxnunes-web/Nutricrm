import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

// Column mappings copied from Importacoes.tsx
const COLUMN_MAPPING_VENDAS = {
  dataNF: ["Data da NF", "Dt NF", "Data Fatura", "Dt Fatura", "Data da Nota"],
  codCliente: ["Cód. Cliente", "Cód Cliente", "Cod. Cliente", "Cod Cliente"],
  nomeCliente: ["Nome do Cliente", "Razão Social", "Nome Cliente", "Cliente"],
  codProduto: ["Cód. Produto", "Cód Produto", "Cod. Produto", "Cod Produto"],
  nomeProduto: ["Nome do Produto", "Descrição", "Nome Produto", "Produto"],
  qtdeSacos: ["Qtde. Sacos", "Qtde Sacos", "Quantidade", "Qtd", "Qtde", "Volume", "Pedido Val"],
  precoSaco: ["Preço por Saco", "Preco por Saco", "Valor Unitário", "Vl. Unit", "Preço Unit", "Pedido Vc"],
  representante: ["Representante", "ERC", "Vendedor", "RCA"],
  municipio: ["Município", "Municipio", "Cidade"],
  uf: ["UF", "Estado"],
  notaFiscal: ["Nota Fiscal", "NF"],
  pedido: ["Pedido", "OC"],
  segmentacao: ["Segmentação", "Segmentacao", "Seg."],
  categoria: ["Categoria"],
  linha: ["Linha"],
  descontoPct: ["Desconto %", "Desc %"],
};

const COLUMN_MAPPING_PEDIDOS = {
  dataPedido: ["Inclusão do Pedido", "Data do Pedido", "Dt Pedido"],
  codCliente: ["Cód Cliente", "Cód. Cliente", "Cod Cliente"],
  nomeCliente: ["Cliente", "Nome do Cliente"],
  codProduto: ["Cód. Produto", "Cód Produto", "Cod. Produto"],
  nomeProduto: ["Produto", "Nome do Produto"],
  qtdeSacos: ["Pedido Volume", "Qtde. Sacos", "Quantidade", "Volume"],
  pedidoValor: ["Pedido Valor", "Valor"],
  representante: ["GRV", "ERC", "Representante"],
  pedidoNumber: ["Pedido"],
  segmentacao: ["Seg.", "Segmentação"],
  categoria: ["Categoria"],
  linha: ["Linha"],
};

function findColumnName(headers, possibleNames) {
  for (const name of possibleNames) {
    const found = headers.find(h =>
      h.toLowerCase().trim() === name.toLowerCase().trim() ||
      h.toLowerCase().trim().includes(name.toLowerCase().trim())
    );
    if (found) return found;
  }
  return null;
}

function testFile(filePath, label, mapping, requiredKeys) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TESTING: ${label}`);
  console.log(`File: ${filePath}`);
  console.log('='.repeat(60));

  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const headers = data[0].map(h => String(h).trim());

  console.log(`\nHeaders (${headers.length}):`, headers.join(' | '));
  console.log(`Data rows: ${data.length - 1}`);

  console.log(`\n--- Column Mapping Results ---`);
  const matched = {};
  const missing = [];

  for (const [key, aliases] of Object.entries(mapping)) {
    const found = findColumnName(headers, aliases);
    if (found) {
      matched[key] = found;
      console.log(`  ✅ ${key} -> "${found}"`);
    } else {
      missing.push(key);
      console.log(`  ❌ ${key} -> NOT FOUND (tried: ${aliases.slice(0, 3).join(', ')}...)`);
    }
  }

  console.log(`\n--- Required Columns Check ---`);
  let allRequired = true;
  for (const req of requiredKeys) {
    if (matched[req]) {
      console.log(`  ✅ ${req}: OK`);
    } else {
      console.log(`  ❌ ${req}: MISSING - IMPORT WILL FAIL`);
      allRequired = false;
    }
  }

  console.log(`\n--- Sample Data (first 2 rows) ---`);
  for (let i = 1; i <= Math.min(2, data.length - 1); i++) {
    const row = data[i];
    const mapped = {};
    for (const [key, header] of Object.entries(matched)) {
      const idx = headers.indexOf(header);
      if (idx >= 0) mapped[key] = row[idx];
    }
    console.log(`  Row ${i}:`, JSON.stringify(mapped, null, 2).substring(0, 500));
  }

  if (label.includes('pedidos') && matched.pedidoValor && matched.qtdeSacos) {
    console.log(`\n--- PrecoSaco Calculation Test ---`);
    for (let i = 1; i <= Math.min(3, data.length - 1); i++) {
      const row = data[i];
      const valorIdx = headers.indexOf(matched.pedidoValor);
      const volIdx = headers.indexOf(matched.qtdeSacos);
      const valor = parseFloat(String(row[valorIdx]).replace(',', '.')) || 0;
      const vol = parseFloat(String(row[volIdx]).replace(',', '.')) || 0;
      const preco = vol > 0 ? (valor / vol).toFixed(2) : 'N/A';
      console.log(`  Row ${i}: Valor=${valor} / Volume=${vol} = PrecoSaco=${preco}`);
    }
  }

  console.log(`\n--- RESULT: ${allRequired ? '✅ IMPORT SHOULD WORK' : '❌ IMPORT WILL FAIL (missing required columns)'} ---`);
  return { matched: Object.keys(matched).length, missing, total: Object.keys(mapping).length, allRequired };
}

// Test vendas
const v = testFile(
  'C:\\Users\\clxn2\\Downloads\\data (90).xlsx',
  'VENDAS (data 90)',
  COLUMN_MAPPING_VENDAS,
  ['dataNF', 'codCliente', 'codProduto', 'qtdeSacos']
);

// Test pedidos
const p = testFile(
  'C:\\Users\\clxn2\\Downloads\\data (91).xlsx',
  'PEDIDOS EM CARTEIRA (data 91)',
  COLUMN_MAPPING_PEDIDOS,
  ['dataPedido', 'codCliente', 'codProduto', 'qtdeSacos']
);

console.log('\n' + '='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));
console.log(`Vendas:  ${v.matched}/${v.total} columns matched, required: ${v.allRequired ? 'ALL OK' : 'MISSING'}`);
console.log(`Pedidos: ${p.matched}/${p.total} columns matched, required: ${p.allRequired ? 'ALL OK' : 'MISSING'}`);
