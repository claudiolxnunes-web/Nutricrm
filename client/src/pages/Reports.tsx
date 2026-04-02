import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { FileText, Download } from "lucide-react";

export default function Reports() {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });

  const { data: sales, isLoading } = trpc.sales.list.useQuery({
    startDate: new Date(dateRange.startDate),
    endDate: new Date(dateRange.endDate),
    limit: 100,
  });

  const { data: allClients } = trpc.clients.list.useQuery({ limit: 2000 });
  const clientList = (allClients as any)?.data ?? (allClients as any) ?? [];
  const clientMap: Record<number, string> = {};
  if (Array.isArray(clientList)) {
    clientList.forEach((c: any) => {
      clientMap[c.id] = c.farmName || c.producerName || `Cliente #${c.id}`;
    });
  }

  // Prepare data for charts
  const salesByDate = sales?.reduce((acc: any, sale: any) => {
    const date = new Date(sale.saleDate).toLocaleDateString("pt-BR");
    const existing = acc.find((item: any) => item.date === date);
    if (existing) {
      existing.value += parseFloat(sale.totalValue);
      existing.count += 1;
    } else {
      acc.push({ date, value: parseFloat(sale.totalValue), count: 1 });
    }
    return acc;
  }, []) || [];

  const totalSales = sales?.reduce((sum: number, sale: any) => sum + parseFloat(sale.totalValue), 0) || 0;
  const totalTransactions = sales?.length || 0;
  const averageSale = totalTransactions > 0 ? totalSales / totalTransactions : 0;

  const paymentStatusData = [
    {
      name: "Pago",
      value: sales?.filter((s: any) => s.paymentStatus === "pago").length || 0,
    },
    {
      name: "Parcial",
      value: sales?.filter((s: any) => s.paymentStatus === "parcial").length || 0,
    },
    {
      name: "Pendente",
      value: sales?.filter((s: any) => s.paymentStatus === "pendente").length || 0,
    },
  ];

  const handleExport = () => {
    // Simple CSV export
    const headers = ["Data", "Número", "Cliente", "Valor", "Status Pagamento"];
    const rows = sales?.map((sale: any) => [
      new Date(sale.saleDate).toLocaleDateString("pt-BR"),
      sale.saleNumber,
      clientMap[sale.clientId] || `Cliente #${sale.clientId}`,
      parseFloat(sale.totalValue).toLocaleString("pt-BR"),
      sale.paymentStatus,
    ]) || [];

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-vendas-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="text-slate-600">Análise de vendas e performance</p>
        </div>
        <Button onClick={handleExport} className="gap-2">
          <Download className="w-4 h-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtrar por Período</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div>
            <label className="text-sm font-medium">Data Inicial</label>
            <Input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Data Final</label>
            <Input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {totalSales.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Número de Transações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTransactions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {averageSale.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales by Date */}
        <Card>
          <CardHeader>
            <CardTitle>Vendas por Data</CardTitle>
            <CardDescription>Evolução de vendas no período</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : salesByDate.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={salesByDate}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => `R$ ${value.toLocaleString("pt-BR")}`} />
                  <Legend />
                  <Line type="monotone" dataKey="value" stroke="#10b981" name="Valor (R$)" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-slate-600">
                Nenhuma venda no período
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Status */}
        <Card>
          <CardHeader>
            <CardTitle>Status de Pagamento</CardTitle>
            <CardDescription>Distribuição de pagamentos</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : paymentStatusData.some((item) => item.value > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={paymentStatusData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-slate-600">
                Nenhuma venda no período
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento de Vendas</CardTitle>
          <CardDescription>Lista completa de vendas no período</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : sales && sales.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-2 px-2 font-semibold">Data</th>
                    <th className="text-left py-2 px-2 font-semibold">Número</th>
                    <th className="text-left py-2 px-2 font-semibold">Cliente</th>
                    <th className="text-right py-2 px-2 font-semibold">Valor</th>
                    <th className="text-left py-2 px-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale: any) => (
                    <tr key={sale.id} className="border-b hover:bg-slate-50">
                      <td className="py-2 px-2">
                        {new Date(sale.saleDate).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-2 px-2">{sale.saleNumber}</td>
                      <td className="py-2 px-2">{clientMap[sale.clientId] || `Cliente #${sale.clientId}`}</td>
                      <td className="py-2 px-2 text-right font-semibold">
                        R$ {parseFloat(sale.totalValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          sale.paymentStatus === "pago" ? "bg-green-100 text-green-800" :
                          sale.paymentStatus === "parcial" ? "bg-yellow-100 text-yellow-800" :
                          "bg-red-100 text-red-800"
                        }`}>
                          {sale.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-600">
              Nenhuma venda encontrada no período
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
