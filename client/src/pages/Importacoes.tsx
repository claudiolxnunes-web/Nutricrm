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
  dataNF: ["Data da NF", "dt Prev. Fat.", "Data", "Dt NF", "Faturame", "Data Fatura", "Dt Fatura", "PREV.FATUR.", "Prev. Fat.", "Inclusão", "Dt Pedido", "Data Pedido", "Data da Nota"],
  codCliente: ["Cód. Cliente", "Cod Cliente", "Código Cliente", "Cod. Cliente", "Cod Cliente", "Cód Cliente", "CLIENTE", "Cliente", "Cód.Cli", "Cod.Cli"],
  nomeCliente: ["Nome do Cliente", "Cliente", "Razão Social", "Nome Cliente", "NOME", "Nome", "CLIENTE", "Nome Cliente"],
  codProduto: ["Cód. Produto", "Cod. Produto", "Código Produto", "Cod Produto", "Cód Produto", "PRODUTO", "Produto", "Codigo Produto", "Cód.Prod", "Cod.Prod"],
  nomeProduto: ["Nome do Produto", "Produto", "Descrição", "Descricao", "Nome Produto", "PRODUTO", "Produto", "Descrição Produto"],
  qtdeSacos: ["Qtde. Sacos", "Quantidade", "Qtd", "Qtde", "Pedido Val", "QTD", "Qtde", "Quant.", "Quant", "Volume", "VOL", "Qtde Pedido"],
  precoSaco: ["Preço por Saco", "Preço", "Valor Unitário", "Unitário", "Pedido Vc", "PREÇO", "Preco", "Valor", "Vl. Unit", "Unit", "Preço Unit"],
  representante: ["Representante", "ERC", "Vendedor", "RC", "Rep", "REPRESENTANTE", "VENDEDOR", "RCA", "Representante", "Nome Representante"],
  municipio: ["Município", "Cidade", "Mun", "MUNICIPIO", "CIDADE", "Cidade", "Município"],
  uf: ["UF", "Estado", "ESTADO", "U.F.", "Uf", "UF"],
  notaFiscal: ["Nota Fiscal", "Pedido", "OC", "Nota", "NF", "N.F.", "NFe", "Pedido", "ORDEM", "Ordem", "OC", "Número Pedido", "No Pedido"],
  pedido: ["Pedido", "OC", "Ordem", "PEDIDO", "Cod Pedido", "Código Pedido", "Pedido", "Ordem de Compra"],
  segmentacao: ["Segmentação", "Seg.", "Segmento", "SEGMENTAÇÃO", "SEG", "Seg", "Segmentação Cliente"],
  categoria: ["Categoria", "CAT", "Categ", "CATEGORIA", "Categoria Cliente"],
  linha: ["Linha", "LINE", "LINHA", "Linha Produto", "Linha de Produto"],
  descontoPct: ["Desconto %", "Desc %", "Desconto", "DESC", "% Desc", "Percentual Desconto", "Desc. %"],
  descontoValor: ["Desconto R$", "Valor Desconto", "Desc Valor", "Desc. R$", "Desconto Valor"],
  bonificacaoQtde: ["Bonificação Qtd", "Bonif Qtd", "Qtd Bonificação", "Boni Qtd", "Qtde Bonif", "Quantidade Bonificada"],
  bonificacaoValor: ["Bonificação Valor", "Bonif Valor", "Valor Bonificação", "Boni Valor", "Vl Bonif"],
  valorFinal: ["Valor Final", "Total Líquido", "Líquido", "Valor Líquido", "Total Final", "Faturamento Líquido"],
};

const COLUMN_MAPPING_PEDIDOS: Record<string, string[]> = {
  dataPedido: ["Data do Pedido", "Dt Pedido", "Data Pedido", "Dt. Pedido", "Pedido Data", "Inclusão", "Data Inclusão"],
  dataPrevFaturamento: ["dt Prev. Fat.", "Prev. Fat.", "Previsão Faturamento", "Data Prevista", "Prev Faturamento", "PREV.FATUR.", "Data Fatura"],
  codCliente: ["Cód. Cliente", "Cod Cliente", "Código Cliente", "Cod. Cliente", "Cod Cliente", "Cód Cliente", "CLIENTE", "Cliente", "Cód.Cli"],
  nomeCliente: ["Nome do Cliente", "Cliente", "Razão Social", "Nome Cliente", "NOME", "Nome", "CLIENTE"],
  codProduto: ["Cód. Produto", "Cod. Produto", "Código Produto", "Cod Produto", "Cód Produto", "PRODUTO", "Produto", "Codigo Produto"],
  nomeProduto: ["Nome do Produto", "Produto", "Descrição", "Descricao", "Nome Produto", "PRODUTO", "Produto"],
  qtdeSacos: ["Qtde. Sacos", "Quantidade", "Qtd", "Qtde", "Pedido Val", "QTD", "Qtde", "Quant.", "Quant", "Volume", "VOL", "Qtde Pedido"],
  precoSaco: ["Preço por Saco", "Preço", "Valor Unitário", "Unitário", "Pedido Vc", "PREÇO", "Preco", "Valor", "Vl. Unit", "Unit"],
  representante: ["Representante", "ERC", "Vendedor", "RC", "Rep", "REPRESENTANTE", "VENDEDOR", "RCA", "Representante"],
  municipio: ["Município", "Cidade", "Mun", "MUNICIPIO", "CIDADE", "Cidade"],
  uf: ["UF", "Estado", "ESTADO", "U.F.", "Uf"],
  pedidoNumber: ["Pedido", "Número Pedido", "No Pedido", "Cod Pedido", "Código Pedido", "PEDIDO", "Ordem", "OC", "Ordem de Compra"],
  notaFiscal: ["Nota Fiscal", "NF", "N.F.", "NFe", "Nota", "NF-e"],
  segmentacao: ["Segmentação", "Seg.", "Segmento", "SEGMENTAÇÃO", "SEG", "Seg"],
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
      const requiredKeys = tipo === 'vendas' 
        ? ['dataNF', 'codCliente', 'nomeCliente', 'codProduto', 'nomeProduto', 'qtdeSacos', 'precoSaco']
        : ['dataPedido', 'codCliente', 'nomeCliente', 'codProduto', 'nomeProduto', 'qtdeSacos', 'precoSaco', 'pedidoNumber'];
      
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
        if (!mappedData.nomeCliente) errors.push("Nome do cliente ausente");
        if (!mappedData.codProduto) errors.push("Código do produto ausente");
        if (!mappedData.qtdeSacos) errors.push("Quantidade ausente");
        if (!mappedData.precoSaco) errors.push("Preço ausente");
        if (tipo === 'pedidos' && !mappedData.pedidoNumber) errors.push("Número do pedido ausente");

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
        return mapRowData(rowData, headers, columnMapping);
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
