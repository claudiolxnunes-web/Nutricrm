import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, TrendingUp, DollarSign, Package, Users, Filter } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// Componente de Card de Métrica
function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  color = "blue",
  visible = true 
}: { 
  title: string; 
  value: string; 
  subtitle?: string; 
  icon: any; 
  color?: "blue" | "green" | "yellow" | "red" | "purple";
  visible?: boolean;
}) {
  if (!visible) return null;
  
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    green: "bg-green-50 border-green-200 text-green-800",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-800",
    red: "bg-red-50 border-red-200 text-red-800",
    purple: "bg-purple-50 border-purple-200 text-purple-800",
  };

  return (
    <Card className={colorClasses[color]}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium opacity-80">{title}</p>
            <p className="text-3xl font-bold mt-2">{value}</p>
            {subtitle && <p className="text-sm mt-1 opacity-70">{subtitle}</p>}
          </div>
          <Icon className="w-8 h-8 opacity-60" />
        </div>
      </CardContent>
    </Card>
  );
}

// Componente do Dashboard de Métricas
function DashboardMetricas() {
  const [mesAno, setMesAno] = useState("MAI/2026");
  const [representante, setRepresentante] = useState("");
  const { data: user } = trpc.auth.me.useQuery();
  
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  
  const { data: metricas, isLoading } = trpc.admin.getMetricasVendas.useQuery(
    { mesAno },
    { enabled: isAdmin }
  );

  const { data: vendas } = trpc.admin.getVendasPorFiltro.useQuery(
    { filtros: { mesAno, representante: representante || undefined }, limit: 10 },
    { enabled: isAdmin }
  );

  if (!isAdmin) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="p-6">
          <p className="text-yellow-800">
            Você não tem permissão para visualizar o dashboard de métricas.
            Apenas administradores e gestores podem acessar esta área.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value || 0);
  };

  const formatPercent = (value: number) => {
    return `${(value || 0).toFixed(2)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Mês/Ano</Label>
              <Select value={mesAno} onValueChange={setMesAno}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MAI/2026">MAI/2026</SelectItem>
                  <SelectItem value="ABR/2026">ABR/2026</SelectItem>
                  <SelectItem value="MAR/2026">MAR/2026</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Representante</Label>
              <Input 
                placeholder="Nome do representante"
                value={representante}
                onChange={(e) => setRepresentante(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={() => toast.success("Filtros aplicados")}>
                Aplicar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Métricas */}
      {metricas && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Faturamento Total"
              value={formatCurrency(metricas.totalFaturamento)}
              subtitle={`${formatNumber(metricas.count)} vendas`}
              icon={DollarSign}
              color="green"
            />
            <MetricCard
              title="Volume (Sacos)"
              value={formatNumber(metricas.totalVolumeSacos)}
              subtitle={`${formatNumber(metricas.totalVolumeKg)} kg`}
              icon={Package}
              color="blue"
            />
            <MetricCard
              title="Margem Bruta"
              value={formatPercent(metricas.mediaMargemBrutaPercent)}
              subtitle={formatCurrency(metricas.totalMargemBrutaValor)}
              icon={TrendingUp}
              color="yellow"
            />
            <MetricCard
              title="Margem Líquida"
              value={formatPercent(metricas.mediaMargemLiquidaPercent)}
              subtitle={formatCurrency(metricas.totalMargemLiquidaValor)}
              icon={BarChart3}
              color="purple"
              visible={isAdmin}
            />
          </div>

          {/* Custos e Despesas (visível apenas para admin) */}
          {isAdmin && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-red-50 border-red-200">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-red-800">Custo Total</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(metricas.totalCusto)}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-orange-50 border-orange-200">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-orange-800">Despesa Comercial</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatCurrency(metricas.totalDespesaComercial)}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-gray-50 border-gray-200">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-gray-800">Frete</p>
                  <p className="text-2xl font-bold text-gray-600">
                    {formatCurrency(metricas.totalFrete)}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Tabela de Vendas */}
      {vendas && vendas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Últimas Vendas</CardTitle>
            <CardDescription>Top 10 vendas do período filtrado</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nota Fiscal</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Faturamento</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>MB %</TableHead>
                  {isAdmin && <TableHead>ML %</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendas.map((venda: any) => (
                  <TableRow key={venda.id}>
                    <TableCell>{venda.notaFiscal || "-"}</TableCell>
                    <TableCell>{venda.pedidoNumber || "-"}</TableCell>
                    <TableCell>{formatCurrency(parseFloat(venda.finalValue))}</TableCell>
                    <TableCell>{formatNumber(parseFloat(venda.volumeSacos))} sacos</TableCell>
                    <TableCell>{formatPercent(parseFloat(venda.margemBrutaPercent))}</TableCell>
                    {isAdmin && (
                      <TableCell>{formatPercent(parseFloat(venda.margemLiquidaPercent))}</TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default DashboardMetricas;
