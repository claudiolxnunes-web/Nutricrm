import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { FileText, FileSpreadsheet, Download } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

const EMPRESA = "NutriCRM";
const VERDE = "#2d7a3a";

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

  // ── CSV legado ──────────────────────────────────────────────
  const handleExport = () => {
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
    URL.revokeObjectURL(url);
  };

  // ── Exportar Excel (.xlsx real) ──────────────────────────────
  const exportExcel = () => {
    if (!sales || sales.length === 0) {
      toast.error("Nenhuma venda para exportar");
      return;
    }

    const wb = XLSX.utils.book_new();

    // ---- Aba de Resumo ----
    const resumoData = [
      [EMPRESA + " — Relatório de Vendas"],
      [`Período: ${dateRange.startDate} a ${dateRange.endDate}`],
      [`Gerado em: ${new Date().toLocaleString("pt-BR")}`],
      [],
      ["Resumo"],
      ["Total de Vendas (R$)", totalSales],
      ["Número de Transações", totalTransactions],
      ["Ticket Médio (R$)", averageSale],
      [],
      ["Status de Pagamento", "Quantidade"],
      ...paymentStatusData.map((p) => [p.name, p.value]),
    ];
    const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
    wsResumo["!cols"] = [{ wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

    // ---- Aba de Vendas ----
    const vendasHeader = [
      "Data",
      "Número",
      "Cliente",
      "Valor (R$)",
      "Status Pagamento",
    ];
    const vendasRows = (sales as any[]).map((sale: any, i: number) => [
      new Date(sale.saleDate).toLocaleDateString("pt-BR"),
      sale.saleNumber || `#${i + 1}`,
      clientMap[sale.clientId] || `Cliente #${sale.clientId}`,
      Number(sale.totalValue),
      sale.paymentStatus || "-",
    ]);
    const wsVendas = XLSX.utils.aoa_to_sheet([vendasHeader, ...vendasRows]);
    wsVendas["!cols"] = [
      { wch: 12 },
      { wch: 14 },
      { wch: 30 },
      { wch: 14 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, wsVendas, "Vendas");

    // ---- Aba de Top Clientes ----
    const byClient: Record<string, number> = {};
    (sales as any[]).forEach((s: any) => {
      const name = clientMap[s.clientId] || `Cliente #${s.clientId}`;
      byClient[name] = (byClient[name] || 0) + parseFloat(s.totalValue || "0");
    });
    const topClients = Object.entries(byClient)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
    const wsClientes = XLSX.utils.aoa_to_sheet([
      ["Cliente", "Total (R$)"],
      ...topClients.map(([name, val]) => [name, val]),
    ]);
    wsClientes["!cols"] = [{ wch: 35 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsClientes, "Top Clientes");

    XLSX.writeFile(
      wb,
      `${EMPRESA}-relatorio-${dateRange.startDate}-${dateRange.endDate}.xlsx`
    );
    toast.success("Excel exportado com sucesso!");
  };

  // ── Exportar PDF (jsPDF) ─────────────────────────────────────
  const exportPDF = () => {
    if (!sales || sales.length === 0) {
      toast.error("Nenhuma venda para exportar");
      return;
    }

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginL = 14;
    const marginR = pageW - 14;
    let y = 0;

    // ---- Cabeçalho ----
    doc.setFillColor(45, 122, 58); // verde
    doc.rect(0, 0, pageW, 28, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(EMPRESA, marginL, 12);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Relatório de Vendas", marginL, 20);

    doc.setFontSize(9);
    doc.text(
      `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
      marginR,
      12,
      { align: "right" }
    );
    doc.text(
      `Período: ${dateRange.startDate} a ${dateRange.endDate}`,
      marginR,
      20,
      { align: "right" }
    );

    y = 36;

    // ---- KPIs ----
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Resumo do Período", marginL, y);
    y += 6;

    const kpis = [
      ["Total de Vendas", `R$ ${totalSales.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
      ["Número de Transações", String(totalTransactions)],
      ["Ticket Médio", `R$ ${averageSale.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
    ];

    const kpiW = (pageW - marginL * 2) / 3;
    kpis.forEach(([label, value], i) => {
      const x = marginL + i * kpiW;
      doc.setFillColor(240, 253, 244);
      doc.roundedRect(x, y, kpiW - 3, 16, 2, 2, "F");
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(label, x + 3, y + 6);
      doc.setTextColor(45, 122, 58);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(value, x + 3, y + 13);
    });
    y += 22;

    // ---- Status de Pagamento ----
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Status de Pagamento", marginL, y);
    y += 5;

    const statusColors: Record<string, [number, number, number]> = {
      Pago: [34, 197, 94],
      Parcial: [234, 179, 8],
      Pendente: [239, 68, 68],
    };
    paymentStatusData.forEach((item) => {
      const [r, g, b] = statusColors[item.name] ?? [150, 150, 150];
      doc.setFillColor(r, g, b);
      doc.circle(marginL + 3, y + 1.5, 2, "F");
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`${item.name}: ${item.value} pedido(s)`, marginL + 8, y + 3);
      y += 7;
    });
    y += 4;

    // ---- Tabela de Vendas ----
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text("Detalhamento de Vendas", marginL, y);
    y += 5;

    // cabeçalho da tabela
    const cols = [
      { label: "Data", x: marginL, w: 22 },
      { label: "Número", x: marginL + 22, w: 22 },
      { label: "Cliente", x: marginL + 44, w: 72 },
      { label: "Valor (R$)", x: marginL + 116, w: 32 },
      { label: "Status", x: marginL + 148, w: 28 },
    ];

    doc.setFillColor(45, 122, 58);
    doc.rect(marginL, y, pageW - marginL * 2, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    cols.forEach((col) => doc.text(col.label, col.x + 1, y + 5));
    y += 7;

    // linhas da tabela
    (sales as any[]).forEach((sale: any, i: number) => {
      if (y > pageH - 20) {
        doc.addPage();
        y = 14;
        // re-cabeçalho
        doc.setFillColor(45, 122, 58);
        doc.rect(marginL, y, pageW - marginL * 2, 7, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        cols.forEach((col) => doc.text(col.label, col.x + 1, y + 5));
        y += 7;
      }

      const rowH = 6;
      if (i % 2 === 0) {
        doc.setFillColor(245, 250, 245);
        doc.rect(marginL, y, pageW - marginL * 2, rowH, "F");
      }

      doc.setTextColor(50, 50, 50);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");

      const clientName = clientMap[sale.clientId] || `#${sale.clientId}`;
      const truncClient = doc.getStringUnitWidth(clientName) * 8 / doc.internal.scaleFactor > cols[2].w - 2
        ? clientName.substring(0, 28) + "…"
        : clientName;

      doc.text(new Date(sale.saleDate).toLocaleDateString("pt-BR"), cols[0].x + 1, y + 4);
      doc.text(sale.saleNumber || `#${i + 1}`, cols[1].x + 1, y + 4);
      doc.text(truncClient, cols[2].x + 1, y + 4);
      doc.text(
        Number(sale.totalValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        cols[3].x + cols[3].w - 1,
        y + 4,
        { align: "right" }
      );

      const statusLabel =
        sale.paymentStatus === "pago" ? "Pago" :
        sale.paymentStatus === "parcial" ? "Parcial" : "Pendente";
      const [sr, sg, sb] = statusColors[statusLabel] ?? [150, 150, 150];
      doc.setTextColor(sr, sg, sb);
      doc.setFont("helvetica", "bold");
      doc.text(statusLabel, cols[4].x + 1, y + 4);

      y += rowH;
    });

    // ---- Rodapé ----
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.setFont("helvetica", "normal");
      doc.text(
        `${EMPRESA} — Relatório gerado em ${new Date().toLocaleString("pt-BR")} — Página ${p}/${totalPages}`,
        pageW / 2,
        pageH - 6,
        { align: "center" }
      );
    }

    doc.save(
      `${EMPRESA}-relatorio-${dateRange.startDate}-${dateRange.endDate}.pdf`
    );
    toast.success("PDF exportado com sucesso!");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="text-slate-600">Análise de vendas e performance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <Download className="w-4 h-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportExcel}
            className="flex items-center gap-2 border-green-600 text-green-700 hover:bg-green-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exportar Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportPDF}
            className="flex items-center gap-2 border-red-500 text-red-600 hover:bg-red-50"
          >
            <FileText className="h-4 w-4" />
            Exportar PDF
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
