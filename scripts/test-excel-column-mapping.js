const XLSX = require('xlsx')

const workbook = XLSX.utils.book_new()

const rows = [
  ['Cliente', 'Fazenda', 'Cidade', 'UF', 'Telefone', 'Consultor'],
  ['João Silva', 'Fazenda Boa Vista', 'Ribeirão Preto', 'SP', '(16) 99999-0000', 'Maria'],
  ['Ana Souza', 'Sítio Esperança', 'Uberlândia', 'MG', '(34) 98888-1111', 'Carlos'],
]

const worksheet = XLSX.utils.aoa_to_sheet(rows)
XLSX.utils.book_append_sheet(workbook, worksheet, 'Clientes')

const headerAliases = {
  cliente: 'name',
  nome: 'name',
  fazenda: 'farm',
  propriedade: 'farm',
  cidade: 'city',
  uf: 'state',
  estado: 'state',
  telefone: 'phone',
  celular: 'phone',
  consultor: 'consultant',
}

function normalizeHeader(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function mapColumns(headers) {
  return headers.reduce((accumulator, header, index) => {
    const normalized = normalizeHeader(header)
    const mappedField = headerAliases[normalized]

    if (mappedField) {
      accumulator[mappedField] = index
    }

    return accumulator
  }, {})
}

const sheet = workbook.Sheets.Clientes
const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false })
const headers = matrix[0]
const columnMap = mapColumns(headers)

const mappedRows = matrix.slice(1).map((row) => ({
  name: row[columnMap.name] || null,
  farm: row[columnMap.farm] || null,
  city: row[columnMap.city] || null,
  state: row[columnMap.state] || null,
  phone: row[columnMap.phone] || null,
  consultant: row[columnMap.consultant] || null,
}))

console.log(JSON.stringify({ headers, columnMap, mappedRows }, null, 2))