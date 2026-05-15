import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import * as XLSX from "xlsx";

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

const REQUIRED_COLUMNS = [
  "Data da NF",
  "Cód. Cliente",
  "Nome do Cliente",
  "Cód. Produto",
  "Nome do Produto",
  "Qtde. Sacos",
  "Preço por Saco",
  "Representante",
  "Município",
  "UF",
];

const OPTIONAL_COLUMNS = [
  "Data do Pedido",
  "Nota Fiscal",
  "Pedido",
  "Segmentação",
  "Categoria",
  "Preço por KG",
  "Desconto %",
  "Faturamento Realizado",
  "Linha",
];

export default function Importacoes() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  const importMutation = trpc.admin.importSales.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setIsImporting(false);
      setProgress(100);
      if (data.success) {
        toast.success(`Importação concluída! ${data.imported} registros importados.`);
      } else {
        toast.error(`Importação concluída com erros. ${data.errors} falhas.`);
      }
    },
    onError: (err) => {
      setIsImporting(false);
      toast.error(err.message || "Erro na importação");
    },
  });

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
      
      // Validar colunas obrigatórias
      const missingColumns = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
      if (missingColumns.length > 0) {
        toast.error(`Colunas obrigatórias ausentes: ${missingColumns.join(", ")}`);
        setIsAnalyzing(false);
        return;
      }

      // Criar preview das primeiras 10 linhas
      const previewRows: PreviewRow[] = rows.slice(0, 10).map((row, idx) => {
        const rowData: Record<string, any> = {};
        headers.forEach((header, i) => {
          rowData[header] = row[i];
        });

        const errors: string[] = [];
        const warnings: string[] = [];

        // Validações básicas
        if (!rowData["Cód. Cliente"]) errors.push("Código do cliente ausente");
        if (!rowData["Nome do Cliente"]) errors.push("Nome do cliente ausente");
        if (!rowData["Cód. Produto"]) errors.push("Código do produto ausente");
        if (!rowData["Representante"]) errors.push("Representante ausente");
        if (!rowData["Data da NF"]) errors.push("Data da NF ausente");

        // Verificar formato de data
        const dataNF = rowData["Data da NF"];
        if (dataNF && !(dataNF instanceof Date) && !String(dataNF).match(/^\d{4}-\d{2}-\d{2}/)) {
          warnings.push("Formato de data pode estar incorreto (esperado: YYYY-MM-DD)");
        }

        return { data: rowData, errors, warnings };
      });

      setPreview(previewRows);
      setFile(selectedFile);
      toast.success(`Arquivo analisado: ${rows.length} linhas encontradas`);
    } catch (err) {
      toast.error("Erro ao analisar arquivo: " + (err as Error).message);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

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

      // Converter para array de objetos
      const data = rows.map(row => {
        const obj: Record<string, any> = {};
        headers.forEach((header, i) => {
          obj[header] = row[i];
        });
        return obj;
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
        errorDetails: allErrorDetails.slice(0, 20), // Limitar a 20 erros
      });

      setIsImporting(false);
      toast.success(`Importação concluída! ${totalImported} registros importados.`);
    } catch (err) {
      setIsImporting(false);
      toast.error("Erro na importação: " + (err as Error).message);
    }
  };

  const downloadTemplate = () => {
    const template = [
      [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS],
      [
        "2026-05-13", // Data da NF
        "2026-04-28", // Data do Pedido
        "-1", // Cód Grupo
        "051819|NOME CLIENTE", // Grupo Cliente
        "272163", // Nota Fiscal
        "275886", // Pedido
        "51819", // Cód. Cliente
        "NOME DO CLIENTE", // Nome do Cliente
        "C", // Segmentação
        "PRODUTOR RURAL", // Categoria
        "1647660", // Cód. Produto
        "NOME DO PRODUTO", // Nome do Produto
        "15", // Qtde. Sacos
        "137.09", // Preço por Saco
        "4.57", // Preço por KG
        "50", // PMR
        "0", // Desconto %
        "CIDADE", // Município
        "MG", // UF
        "SUDESTE", // Região
        "1360", // Cód. RC
        "NOME REPRESENTANTE", // Representante
        "Vendas", // Tipo de Operação
        "10085", // Cód. Filial
        "GRUPO PRODUTO", // Grupo Produto
        "2056.28", // Faturamento Realizado
        "1996.39", // Faturamento S/ Encargos
        "0.41", // MB CB %
        "826.79", // MB CB Total
        "0.15", // ML CB %
        "303.42", // ML CB Total
        "450", // Volume
        "450", // Volume + Bon.
        "0", // Bonificação
        "0", // ICMS
        "33.93", // PIS
        "156.28", // Cofins
        "1169.60", // Custo
        "82.25", // Desp Comercial
        "86.41", // Frete
        "450", // Volume Convertido
        "LINHA", // Customizado
        "1318", // Cód Grupo Produto
        "SOLUÇÃO", // Solução
        "SUBSOLUÇÃO", // Subsolução
        "NUTRICAO RUMINANTES", // Linha
        "GRV", // GRV
        "GNV", // GNV
        "MAI/2026", // Mês/Ano
        "FILIAL", // Filial
        "5101", // CFOP
        "N", // FL_VEF
        "0.08", // Comissão %
        "164.50", // Comissão
        "R", // Moeda
        "2026", // Ano
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");
    XLSX.writeFile(wb, "modelo_importacao_vendas.xlsx");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Importações</h1>
        <p className="text-slate-600 mt-1">
          Importe vendas e pedidos em carteira a partir de arquivos Excel ou CSV.
          Representantes, clientes e produtos serão cadastrados automaticamente.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600" />
            Upload de Arquivo
          </CardTitle>
          <CardDescription>
            Selecione um arquivo Excel (.xlsx, .xls) ou CSV com os dados de vendas.
          </CardDescription>
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
            <Button
              variant="outline"
              onClick={downloadTemplate}
              disabled={isAnalyzing || isImporting}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Baixar Modelo
            </Button>
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

      {preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview dos Dados</CardTitle>
            <CardDescription>
              Primeiras 10 linhas do arquivo. Verifique se os dados estão corretos antes de importar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Representante</TableHead>
                    <TableHead>Data NF</TableHead>
                    <TableHead>Qtde</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>
                        {row.data["Nome do Cliente"] || "-"}
                        {row.errors.some(e => e.includes("cliente")) && (
                          <AlertCircle className="w-4 h-4 text-red-500 inline ml-1" />
                        )}
                      </TableCell>
                      <TableCell>{row.data["Nome do Produto"] || "-"}</TableCell>
                      <TableCell>{row.data["Representante"] || "-"}</TableCell>
                      <TableCell>
                        {row.data["Data da NF"]
                          ? new Date(row.data["Data da NF"]).toLocaleDateString("pt-BR")
                          : "-"}
                      </TableCell>
                      <TableCell>{row.data["Qtde. Sacos"] || "-"}</TableCell>
                      <TableCell>
                        {row.errors.length > 0 ? (
                          <span className="text-red-600 text-sm flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            {row.errors.length} erro(s)
                          </span>
                        ) : row.warnings.length > 0 ? (
                          <span className="text-yellow-600 text-sm flex items-center gap-1">
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
                    Importar Dados
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
                <p className="text-lg font-bold">
                  +{result.details.representantes.created} novos
                </p>
                <p className="text-xs text-slate-500">
                  {result.details.representantes.existing} existentes
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-sm text-slate-600">Clientes</p>
                <p className="text-lg font-bold">
                  +{result.details.clientes.created} novos
                </p>
                <p className="text-xs text-slate-500">
                  {result.details.clientes.existing} existentes
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-sm text-slate-600">Produtos</p>
                <p className="text-lg font-bold">
                  +{result.details.produtos.created} novos
                </p>
                <p className="text-xs text-slate-500">
                  {result.details.produtos.existing} existentes
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-sm text-slate-600">Vendas</p>
                <p className="text-2xl font-bold text-blue-600">
                  {result.details.vendas.created}
                </p>
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
