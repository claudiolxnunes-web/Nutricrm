import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2, BarChart3 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import DashboardMetricas from "@/components/DashboardMetricas";

interface PreviewRow {
  data: Record<string, any>;
  errors: string[];
  warnings: string[];
}

interface ImportResult {
  success: boolean;
  imported: number;
  errors: number;
  details: {
    representantes: { created: number; existing: number };
    clientes: { created: number; existing: number };
    produtos: { created: number; existing: number };
    vendas: { created: number };
  };
  errorDetails?: string[];
}

// Mapeamento flexível de colunas - detecta vários nomes possíveis
const COLUMN_MAPPING_VENDAS: Record<string, string[]> = {
  dataNF: ["Data da NF", "Dt NF", "Data Fatura", "Dt Fatura", "Data da Nota", "dt Prev. Fat.", "Prev. Fat.", "PREV.FATUR.", "Data", "Dt Pedido", "Data Pedido", "Inclusão"],
  codCliente: ["Cód. Cliente", "Cód Cliente", "Cod. Cliente", "Cod Cliente", "Código Cliente", "Cód.Cli", "Cod.Cli", "CLIENTE"],
  nomeCliente: ["Nome do Cliente", "Razão Social", "Nome Cliente", "Cliente", "NOME", "Nome"],
  codProduto: ["Cód. Produto", "Cód Produto", "Cod. Produto", "Cod Produto", "Código Produto", "Cód.Prod", "Cod.Prod", "Codigo Produto", "PRODUTO"],
  nomeProduto: ["Nome do Produto", "Descrição", "Descricao", "Nome Produto", "Produto", "Descrição Produto"],
  qtdeSacos: ["Qtde. Sacos", "Qtde Sacos", "Quantidade", "Qtd", "Qtde", "QTD", "Quant.", "Quant", "Volume", "VOL", "Qtde Pedido", "Pedido Val"],
  precoSaco: ["Preço por Saco", "Preco por Saco", "Valor Unitário", "Vl. Unit", "Preço Unit", "Preço", "PREÇO", "Preco", "Valor", "Unitário", "Unit", "Pedido Vc"],
  precoKg: ["Preço por KG", "Preco por KG", "Preço/KG"],
  representante: ["Representante", "ERC", "Vendedor", "RCA", "RC", "Rep", "REPRESENTANTE", "VENDEDOR", "Nome Representante"],
  municipio: ["Município", "Municipio", "Cidade"],
  uf: ["UF", "Estado", "U.F."],
  notaFiscal: ["Nota Fiscal", "NF", "N.F.", "NFe", "Nota", "NF-e", "Número Pedido", "No Pedido"],
  pedido: ["Pedido", "OC", "Ordem de Compra", "Ordem", "PEDIDO", "Cod Pedido", "Código Pedido"],
  segmentacao: ["Segmentação", "Segmentacao", "Seg.", "Segmento", "SEGMENTAÇÃO", "SEG", "Seg", "Segmentação Cliente"],
  categoria: ["Categoria", "CAT", "Categ", "CATEGORIA", "Categoria Cliente"],
  linha: ["Linha", "LINE", "LINHA", "Linha Produto", "Linha de Produto"],
  descontoPct: ["Desconto %", "Desc %", "Desc. %", "Desconto", "DESC", "% Desc", "Percentual Desconto"],
  descontoValor: ["Desconto R$", "Valor Desconto", "Desc. R$", "Desc Valor", "Desconto Valor"],
  // "Bonificação" é coluna de volume numérico no arquivo real
  bonificacaoQtde: ["Bonificação", "Bonificacao", "Bonif Qtd", "Qtd Bonificação", "Quantidade Bonificada"],
  bonificacaoValor: ["Bonificação Valor", "Bonif Valor", "Valor Bonificação", "Boni Valor", "Vl Bonif"],
  faturamento: ["Faturamento Realizado", "Faturamento", "Faturamento S/ Encargos"],
  valorFinal: ["Valor Final", "Total Líquido", "Faturamento Líquido"],
  volumeSacos: ["Volume (Vendas)", "Volume (Vendas + Bon.)", "Volume Vendas"],
  custoTotal: ["Custo Brill Total", "Custo Total"],
  despesaComercial: ["Desp Comercial", "Despesa Comercial"],
  frete: ["Frete Carga Realizado", "Frete"],
  margemBrutaPercent: ["MB CB %", "Margem Bruta %"],
  margemBrutaValor: ["MB CB Total", "Margem Bruta Total"],
  margemLiquidaPercent: ["ML CB % (Estimada)", "Margem Líquida %"],
  margemLiquidaValor: ["ML CB Total (Estimada)", "Margem Líquida Total"],
  comissaoPercent: ["Comissão Realizado %", "Comissão %"],
  comissaoValor: ["Comissão Realizado", "Comissão Valor"],
  icms: ["ICMS Total", "ICMS"],
  pis: ["PIS Total", "PIS"],
  cofins: ["Cofins Total", "Cofins"],
  grupoProduto: ["Grupo Produto", "Cód Grupo Produto"],
  solucao: ["Solução", "Solucao"],
  subsolucao: ["Subsolução", "Subsolucao"],
  grv: ["GRV"],
  gnv: ["GNV"],
  filial: ["Filial"],
  codigoCFOP: ["Cód CFOP", "Cod CFOP", "CFOP"],
  mesAno: ["Mês/Ano", "Mes/Ano", "Mês Ano"],
  ano: ["Ano"],
};

const COLUMN_MAPPING_PEDIDOS: Record<string, string[]> = {
  dataPedido: ["Inclusão do Pedido", "Data do Pedido", "Dt Pedido", "Inclusão", "Data Inclusão", "Data Pedido", "Dt. Pedido", "Pedido Data"],
  dataPrevFaturamento: ["Prev. Fat. Solicitada", "Prev. Fat. Real", "dt Prev. Fat.", "Prev. Fat.", "Previsão Faturamento", "Data Prevista", "Prev Faturamento", "PREV.FATUR.", "Data Fatura"],
  codCliente: ["Cód Cliente", "Cód. Cliente", "Cod Cliente", "Código Cliente", "Cód.Cli", "CLIENTE", "Cliente"],
  nomeCliente: ["Cliente", "Nome do Cliente", "Razão Social", "Nome Cliente", "NOME", "Nome"],
  codProduto: ["Cód. Produto", "Cód Produto", "Cod. Produto", "Código Produto", "Cod Produto", "Codigo Produto", "PRODUTO"],
  nomeProduto: ["Produto", "Nome do Produto", "Descrição", "Descricao", "Nome Produto"],
  qtdeSacos: ["Pedido Volume", "Qtde. Sacos", "Quantidade", "Qtd", "Qtde", "Volume", "QTD", "Quant.", "Quant", "VOL", "Qtde Pedido", "Pedido Val"],
  // pedidoValor é lido separadamente para calcular precoSaco = pedidoValor / pedidoVolume
  pedidoValor: ["Pedido Valor", "Valor", "Pedido Vc"],
  precoSaco: ["Preço por Saco", "Preco por Saco", "Valor Unitário", "Vl. Unit", "Preço Unit", "Preço", "PREÇO", "Preco", "Unitário", "Unit"],
  representante: ["GRV", "ERC", "Representante", "Vendedor", "RCA", "RC", "Rep", "REPRESENTANTE", "VENDEDOR"],
  municipio: ["Município", "Municipio", "Cidade"],
  uf: ["UF", "Estado", "ESTADO", "U.F.", "Uf"],
  pedidoNumber: ["Pedido", "Número Pedido", "No Pedido", "Cod Pedido", "Código Pedido", "PEDIDO", "Ordem", "Ordem de Compra"],
  notaFiscal: ["Nota Fiscal", "NF", "N.F.", "NFe", "Nota", "NF-e", "OC"],
  segmentacao: ["Seg.", "Segmentação", "Segmentacao", "Segmento", "SEGMENTAÇÃO", "SEG", "Seg"],
  categoria: ["Categoria", "CAT", "Categ", "CATEGORIA"],
  linha: ["Linha", "LINE", "LINHA", "Linha Produto"],
};

// Função para encontrar o nome da coluna no arquivo
function findColumnName(headers: string[], possibleNames: string[]): string | null {
  for (const name of possibleNames) {
    const found = headers.find(h => 
      h.toLowerCase().trim() === name.toLowerCase().trim() ||
      h.toLowerCase().trim().includes(name.toLowerCase().trim())
    );
    if (found) return found;
  }
  return null;
}

// Função para mapear dados do arquivo para o formato esperado
function mapRowData(rowData: Record<string, any>, headers: string[], columnMapping: Record<string, string[]>): Record<string, any> {
  const mapped: Record<string, any> = {};
  
  for (const [key, possibleNames] of Object.entries(columnMapping)) {
    const columnName = findColumnName(headers, possibleNames);
    if (columnName && rowData[columnName] !== undefined) {
      mapped[key] = rowData[columnName];
    }
  }
  
  return mapped;
}

function ImportSection({ 
  title, 
  description, 
  columnMapping,
  importMutation,
  tipo 
}: { 
  title: string; 
  description: string;
  columnMapping: Record<string, string[]>;
  importMutation: any;
  tipo: 'vendas' | 'pedidos';
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [detectedColumns, setDetectedColumns] = useState<Record<string, string>>({});

  const analyzeFile = useCallback(async (selectedFile: File) => {
    setIsAnalyzing(true);
    setResult(null);
    
    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
      
      if (jsonData.length < 2) {
        toast.error("Arquivo vazio ou sem dados");
        setIsAnalyzing(false);
        return;
      }

      const headers = jsonData[0].map((h: any) => String(h).trim());
      const rows = jsonData.slice(1);
      
      // Detectar colunas
      const detected: Record<string, string> = {};
      for (const [key, possibleNames] of Object.entries(columnMapping)) {
        const found = findColumnName(headers, possibleNames);
        if (found) detected[key] = found;
      }
      setDetectedColumns(detected);
      
      // Validar colunas obrigatórias mínimas
      // nomeCliente/nomeProduto são opcionais — código pode ser usado como fallback
      const requiredKeys = tipo === 'vendas' 
        ? ['dataNF', 'codCliente', 'codProduto', 'qtdeSacos']
        : ['dataPedido', 'codCliente', 'codProduto', 'qtdeSacos'];
      
      const missingColumns = requiredKeys.filter(key => !detected[key]);
      
      if (missingColumns.length > 0) {
        toast.error(`Colunas obrigatórias não encontradas: ${missingColumns.join(", ")}. Verifique se o arquivo tem os cabeçalhos corretos.`);
        setIsAnalyzing(false);
        return;
      }

      // Criar preview das primeiras 10 linhas
      const previewRows: PreviewRow[] = rows.slice(0, 10).map((row, idx) => {
        const rowData: Record<string, any> = {};
        headers.forEach((header, i) => {
          rowData[header] = row[i];
        });

        const mappedData = mapRowData(rowData, headers, columnMapping);
        const errors: string[] = [];
        const warnings: string[] = [];

        // Validações básicas
        if (!mappedData.codCliente) errors.push("Código do cliente ausente");
        if (!mappedData.codProduto) errors.push("Código do produto ausente");
        if (!mappedData.qtdeSacos) errors.push("Quantidade ausente");
        // Fallbacks de nome para ambos os tipos
        if (!mappedData.nomeCliente && mappedData.codCliente) {
          mappedData.nomeCliente = String(mappedData.codCliente);
          warnings.push("Nome do cliente não encontrado, usando código como nome");
        }
        if (!mappedData.nomeProduto && mappedData.codProduto) {
          mappedData.nomeProduto = String(mappedData.codProduto);
          warnings.push("Nome do produto não encontrado, usando código como nome");
        }
        // Para pedidos, calcular precoSaco = pedidoValor / qtdeSacos
        if (tipo === 'pedidos' && !mappedData.precoSaco && mappedData.pedidoValor && mappedData.qtdeSacos) {
          const valor = parseFloat(String(mappedData.pedidoValor).replace(',', '.')) || 0;
          const vol = parseFloat(String(mappedData.qtdeSacos).replace(',', '.')) || 0;
          mappedData.precoSaco = vol > 0 ? valor / vol : 0;
          delete mappedData.pedidoValor;
        }
        // precoSaco é opcional — bonificações têm preço 0 ou vazio
        if (mappedData.precoSaco === undefined || mappedData.precoSaco === null || mappedData.precoSaco === '') {
          warnings.push("Preço ausente (será tratado como bonificação com preço 0)");
        }
        if (tipo === 'pedidos' && !mappedData.pedidoNumber) warnings.push("Número do pedido ausente (será gerado automaticamente)");

        return { data: mappedData, errors, warnings };
      });

      setPreview(previewRows);
      setFile(selectedFile);
      toast.success(`Arquivo analisado: ${rows.length} linhas encontradas. Colunas detectadas: ${Object.keys(detected).length}`);
    } catch (err) {
      toast.error("Erro ao analisar arquivo: " + (err as Error).message);
    } finally {
      setIsAnalyzing(false);
    }
  }, [columnMapping, tipo]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    
    if (!allowedTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.csv')) {
      toast.error("Formato não suportado. Use Excel (.xlsx, .xls) ou CSV");
      return;
    }

    analyzeFile(selectedFile);
  };

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    setProgress(10);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
      
      const headers = jsonData[0].map((h: any) => String(h).trim());
      const rows = jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== null && cell !== ""));

      setProgress(30);

      // Converter para array de objetos mapeados
      const data = rows.map(row => {
        const rowData: Record<string, any> = {};
        headers.forEach((header, i) => {
          rowData[header] = row[i];
        });
        const mapped = mapRowData(rowData, headers, columnMapping);
        // Fallbacks de nome para ambos os tipos
        if (!mapped.nomeCliente && mapped.codCliente) mapped.nomeCliente = String(mapped.codCliente);
        if (!mapped.nomeProduto && mapped.codProduto) mapped.nomeProduto = String(mapped.codProduto);
        // Para pedidos, calcular precoSaco = pedidoValor / qtdeSacos e remover helper
        if (tipo === 'pedidos') {
          if (!mapped.precoSaco && mapped.pedidoValor && mapped.qtdeSacos) {
            const valor = parseFloat(String(mapped.pedidoValor).replace(',', '.')) || 0;
            const vol = parseFloat(String(mapped.qtdeSacos).replace(',', '.')) || 0;
            mapped.precoSaco = vol > 0 ? valor / vol : 0;
          }
          delete mapped.pedidoValor;
        }
        return mapped;
      });

      setProgress(50);

      // Enviar para o backend em chunks
      const CHUNK_SIZE = 100;
      let totalImported = 0;
      let totalErrors = 0;
      const allErrorDetails: string[] = [];
      const aggregatedDetails = {
        representantes: { created: 0, existing: 0 },
        clientes: { created: 0, existing: 0 },
        produtos: { created: 0, existing: 0 },
        vendas: { created: 0 },
      };

      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        const chunkResult = await importMutation.mutateAsync({ data: chunk });
        
        totalImported += chunkResult.imported;
        totalErrors += chunkResult.errors;
        
        aggregatedDetails.representantes.created += chunkResult.details.representantes.created;
        aggregatedDetails.representantes.existing += chunkResult.details.representantes.existing;
        aggregatedDetails.clientes.created += chunkResult.details.clientes.created;
        aggregatedDetails.clientes.existing += chunkResult.details.clientes.existing;
        aggregatedDetails.produtos.created += chunkResult.details.produtos.created;
        aggregatedDetails.produtos.existing += chunkResult.details.produtos.existing;
        aggregatedDetails.vendas.created += chunkResult.details.vendas.created;
        
        if (chunkResult.errorDetails) {
          allErrorDetails.push(...chunkResult.errorDetails);
        }

        setProgress(50 + Math.round(((i + chunk.length) / data.length) * 50));
      }

      setResult({
        success: totalErrors === 0,
        imported: totalImported,
        errors: totalErrors,
        details: aggregatedDetails,
        errorDetails: allErrorDetails.slice(0, 20),
      });

      setIsImporting(false);
      toast.success(`Importação concluída! ${totalImported} registros importados.`);
    } catch (err) {
      setIsImporting(false);
      toast.error("Erro na importação: " + (err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              disabled={isAnalyzing || isImporting}
              className="flex-1"
            />
          </div>

          {isAnalyzing && (
            <div className="flex items-center gap-2 text-slate-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Analisando arquivo...
            </div>
          )}

          {isImporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Importando dados...</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
        </CardContent>
      </Card>

      {Object.keys(detectedColumns).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Colunas Detectadas</CardTitle>
            <CardDescription>Mapeamento automático das colunas do arquivo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              {Object.entries(detectedColumns).map(([key, value]) => (
                <div key={key} className="flex justify-between bg-slate-50 p-2 rounded">
                  <span className="font-medium">{key}:</span>
                  <span className="text-slate-600">{value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview dos Dados</CardTitle>
            <CardDescription>Primeiras 10 linhas do arquivo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Qtde</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>
                        {row.data.nomeCliente || "-"}
                        {row.errors.some(e => e.includes("cliente")) && (
                          <AlertCircle className="w-4 h-4 text-red-500 inline ml-1" />
                        )}
                      </TableCell>
                      <TableCell>{row.data.nomeProduto || "-"}</TableCell>
                      <TableCell>{row.data.qtdeSacos || "-"}</TableCell>
                      <TableCell>{row.data.precoSaco || "-"}</TableCell>
                      <TableCell>
                        {row.errors.length > 0 ? (
                          <span className="text-red-600 text-sm flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            {row.errors.length} erro(s)
                          </span>
                        ) : row.warnings.length > 0 ? (
                          <span className="text-yellow-600 text-sm flex items-center gap-1" title={row.warnings.join("; ")}>
                            <AlertCircle className="w-4 h-4" />
                            {row.warnings.length} aviso(s)
                          </span>
                        ) : (
                          <span className="text-green-600 text-sm flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            OK
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                onClick={handleImport}
                disabled={isImporting || preview.some(r => r.errors.length > 0)}
                className="gap-2"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Importar {tipo === 'vendas' ? 'Vendas' : 'Pedidos'}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className={result.success ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}>
          <CardHeader>
            <CardTitle className={result.success ? "text-green-800" : "text-yellow-800"}>
              {result.success ? "Importação Concluída" : "Importação Concluída com Avisos"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-sm text-slate-600">Registros Importados</p>
                <p className="text-2xl font-bold text-green-600">{result.imported}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-sm text-slate-600">Erros</p>
                <p className="text-2xl font-bold text-red-600">{result.errors}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-sm text-slate-600">Representantes</p>
                <p className="text-lg font-bold">+{result.details.representantes.created} novos</p>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-sm text-slate-600">Clientes</p>
                <p className="text-lg font-bold">+{result.details.clientes.created} novos</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-sm text-slate-600">Produtos</p>
                <p className="text-lg font-bold">+{result.details.produtos.created} novos</p>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-sm text-slate-600">{tipo === 'vendas' ? 'Vendas' : 'Pedidos'}</p>
                <p className="text-2xl font-bold text-blue-600">{result.details.vendas.created}</p>
              </div>
            </div>

            {result.errorDetails && result.errorDetails.length > 0 && (
              <div className="bg-red-100 p-4 rounded-lg">
                <p className="font-medium text-red-800 mb-2">Erros encontrados:</p>
                <ul className="text-sm text-red-700 space-y-1 max-h-40 overflow-y-auto">
                  {result.errorDetails.map((err, idx) => (
                    <li key={idx}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function Importacoes() {
  const importVendasMutation = trpc.admin.importSales.useMutation();
  const importPedidosMutation = trpc.admin.importPedidos.useMutation();
  const { data: user } = trpc.auth.me.useQuery();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Importações</h1>
        <p className="text-slate-600 mt-1">
          Importe vendas faturadas e pedidos em carteira a partir de arquivos Excel ou CSV.
          Representantes, clientes e produtos serão cadastrados automaticamente.
        </p>
      </div>

      <Tabs defaultValue="vendas" className="w-full">
        <TabsList className={isAdmin ? "grid w-full grid-cols-3" : "grid w-full grid-cols-2"}>
          <TabsTrigger value="vendas">Vendas Faturadas</TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos em Carteira</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Dashboard Métricas
            </TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value="vendas">
          <ImportSection
            title="Importar Vendas Faturadas"
            description="Selecione um arquivo Excel ou CSV com dados de vendas já faturadas (Notas Fiscais emitidas)."
            columnMapping={COLUMN_MAPPING_VENDAS}
            importMutation={importVendasMutation}
            tipo="vendas"
          />
        </TabsContent>
        
        <TabsContent value="pedidos">
          <ImportSection
            title="Importar Pedidos em Carteira"
            description="Selecione um arquivo Excel ou CSV com pedidos em carteira (pendentes de faturamento)."
            columnMapping={COLUMN_MAPPING_PEDIDOS}
            importMutation={importPedidosMutation}
            tipo="pedidos"
          />
        </TabsContent>
        
        {isAdmin && (
          <TabsContent value="dashboard">
            <DashboardMetricas />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
