import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { FileText, Download } from "lucide-react";
import { toast } from "sonner";

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

  const exportExcel = () => {
    if (!sales || sales.length === 0) { toast.error("Nenhuma venda para exportar"); return; }
    const rows = [
      ["Data", "Cliente", "Valor (R$)", "Status Pagamento", "Número"],
      ...(sales as any[]).map((sale: any) => [
        new Date(sale.saleDate).toLocaleDateString("pt-BR"),
        clientMap[sale.clientId] || `Cliente #${sale.clientId}`,
        Number(sale.totalValue).toFixed(2),
        sale.paymentStatus || "-",
        sale.saleNumber || "-",
      ]),
      [],
      ["TOTAIS"],
      ["Total de Vendas", `R$ ${totalSales.toFixed(2)}`],
      ["Nº Transações", totalTransactions],
      ["Ticket Médio", `R$ ${averageSale.toFixed(2)}`],
    ];
    const csvContent = rows.map(r => r.join("\t")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-vendas-${dateRange.startDate}-${dateRange.endDate}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    if (!sales || sales.length === 0) { toast.error("Nenhuma venda para exportar"); return; }
    const linhas = (sales as any[]).map((sale: any) => `
      <tr>
        <td>${new Date(sale.saleDate).toLocaleDateString("pt-BR")}</td>
        <td>${clientMap[sale.clientId] || `#${sale.clientId}`}</td>
        <td style="text-align:right">R$ ${Number(sale.totalValue).toFixed(2)}</td>
        <td>${sale.paymentStatus || "-"}</td>
      </tr>
    `).join("");

    const html = `
      <html><head><title>Relatório de Vendas</title>
      <style>
        body { font-family: Arial; padding: 20px; color: #333; }
        h2 { color: #2d7a3a; border-bottom: 2px solid #2d7a3a; padding-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #2d7a3a; color: white; padding: 10px; text-align: left; }
        td { padding: 8px 10px; border-bottom: 1px solid #eee; }
        tr:nth-child(even) td { background: #f9f9f9; }
        .totais { margin-top: 24px; background: #f0fdf4; padding: 16px; border-radius: 8px; }
        .totais p { margin: 4px 0; font-size: 14px; }
        .totais .valor { font-size: 22px; font-weight: bold; color: #2d7a3a; }
      </style></head>
      <body>
        <h2>📊 Relatório de Vendas — NutriCRM</h2>
        <p style="color:#666;font-size:13px;">Período: ${dateRange.startDate} a ${dateRange.endDate}</p>
        <table>
          <thead><tr><th>Data</th><th>Cliente</th><th>Valor</th><th>Status</th></tr></thead>
          <tbody>${linhas}</tbody>
        </table>
        <div class="totais">
          <p>Total de transações: <strong>${totalTransactions}</strong></p>
          <p>Ticket médio: <strong>R$ ${averageSale.toFixed(2)}</strong></p>
          <p class="valor">Total: R$ ${totalSales.toFixed(2)}</p>
        </div>
      </body></html>
    `;

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="text-slate-600">Análise de vendas e performance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleExport} className="gap-2">
            <Download className="w-4 h-4" />
            Exportar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel} className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-green-600" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF} className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-red-500" /> PDF
          </Button>
        </div>
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

      {/* Top Clientes no Período */}
      {Array.isArray(sales) && sales.length > 0 && (() => {
        const byClient: Record<string, number> = {};
        (sales as any[]).forEach((s: any) => {
          const name = clientMap[s.clientId] || `Cliente #${s.clientId}`;
          byClient[name] = (byClient[name] || 0) + parseFloat(s.totalValue || "0");
        });
        const top = Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const max = top[0]?.[1] || 1;
        return (
          <Card>
            <CardHeader><CardTitle className="text-base">Top 5 Clientes no Período</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {top.map(([name, value], i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium truncate max-w-[60%]">{name}</span>
                    <span className="text-emerald-700 font-bold">{value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-2 bg-emerald-500 rounded-full" style={{ width: `${(value / max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })()}

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
                  {sales.map((sale: any, i: number) => (
                    <tr key={sale.id} className="border-b hover:bg-slate-50">
                      <td className="py-2 px-2">
                        {new Date(sale.saleDate).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-2 px-2 text-slate-500">#{i + 1}</td>
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
