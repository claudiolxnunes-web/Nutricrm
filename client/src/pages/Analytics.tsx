import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Activity,
  BarChart3,
  DollarSign,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

const COLORS = ["#2d7a3a", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numberFormatter = new Intl.NumberFormat("pt-BR");

export default function Analytics() {
  const today = new Date();
  const [dateRange, setDateRange] = useState({
    startDate: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0],
    endDate: today.toISOString().split("T")[0],
  });

  const { data: dashboardMetrics, isLoading: dashboardLoading } = trpc.dashboard.metrics.useQuery();
  const { data: salesResponse, isLoading: salesLoading } = trpc.sales.list.useQuery({
    startDate: new Date(dateRange.startDate),
    endDate: new Date(dateRange.endDate),
    limit: 5000,
  });
  const { data: quotes } = trpc.quotes.list.useQuery({ limit: 500 });
  const { data: opportunities } = trpc.opportunities.list.useQuery({ limit: 500 });
  const { data: clientsResponse } = trpc.clients.list.useQuery({ limit: 2000 });

  const sales = (salesResponse as any)?.data ?? [];
  const salesSummary = (salesResponse as any)?.summary ?? {};
  const clients = (clientsResponse as any)?.data ?? (clientsResponse as any) ?? [];

  const analytics = useMemo(() => {
    const salesByDayMap = new Map<string, { date: string; revenue: number; orders: number }>();
    const revenueByClientMap = new Map<string, number>();
    const paymentStatusMap = new Map<string, number>();

    for (const sale of sales as any[]) {
      const date = new Date(sale.saleDate).toLocaleDateString("pt-BR");
      const value = Number(sale.totalValue || 0);
      const clientName = sale.clientId
        ? clients.find((client: any) => client.id === sale.clientId)?.farmName ||
          clients.find((client: any) => client.id === sale.clientId)?.producerName ||
          `Cliente #${sale.clientId}`
        : "Sem cliente";

      const currentDay = salesByDayMap.get(date) ?? { date, revenue: 0, orders: 0 };
      currentDay.revenue += value;
      currentDay.orders += 1;
      salesByDayMap.set(date, currentDay);

      revenueByClientMap.set(clientName, (revenueByClientMap.get(clientName) ?? 0) + value);

      const paymentStatus = sale.paymentStatus || "pendente";
      paymentStatusMap.set(paymentStatus, (paymentStatusMap.get(paymentStatus) ?? 0) + 1);
    }

    const salesByDay = Array.from(salesByDayMap.values()).sort((left, right) => {
      const [leftDay, leftMonth, leftYear] = left.date.split("/");
      const [rightDay, rightMonth, rightYear] = right.date.split("/");
      return (
        new Date(`${leftYear}-${leftMonth}-${leftDay}`).getTime() -
        new Date(`${rightYear}-${rightMonth}-${rightDay}`).getTime()
      );
    });

    const topClients = Array.from(revenueByClientMap.entries())
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((left, right) => right.revenue - left.revenue)
      .slice(0, 5);

    const paymentStatus = Array.from(paymentStatusMap.entries()).map(([name, value]) => ({
      name,
      value,
    }));

    const quotesList = Array.isArray(quotes) ? quotes : [];
    const opportunitiesList = Array.isArray(opportunities) ? opportunities : [];

    const quoteConversionRate =
      quotesList.length > 0
        ? (quotesList.filter((quote: any) => quote.status === "aceito").length / quotesList.length) * 100
        : 0;

    const pipelineByStage = (dashboardMetrics?.opportunitiesByStage ?? []).map((item: any) => ({
      name: String(item.stage).replace(/_/g, " "),
      total: item.count,
    }));

    const openOpportunities = opportunitiesList.filter((item: any) => item.stage !== "perdida").length;
    const wonOpportunities = opportunitiesList.filter((item: any) => item.stage === "venda_concluida").length;

    return {
      salesByDay,
      topClients,
      paymentStatus,
      quoteConversionRate,
      pipelineByStage,
      openOpportunities,
      wonOpportunities,
    };
  }, [clients, dashboardMetrics?.opportunitiesByStage, opportunities, quotes, sales]);

  const isLoading = dashboardLoading || salesLoading;
  const totalRevenue = Number(salesSummary.totalSales ?? 0);
  const totalOrders = Number(salesSummary.totalTransactions ?? 0);
  const averageTicket = Number(salesSummary.averageSale ?? 0);
  const totalClients = Number(dashboardMetrics?.totalClients ?? clients.length ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-slate-600">Painel consolidado com receita, conversão e performance comercial</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500">De</label>
            <Input
              type="date"
              value={dateRange.startDate}
              onChange={(event) => setDateRange({ ...dateRange, startDate: event.target.value })}
              className="h-9 w-40"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Até</label>
            <Input
              type="date"
              value={dateRange.endDate}
              onChange={(event) => setDateRange({ ...dateRange, endDate: event.target.value })}
              className="h-9 w-40"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Receita no período</CardDescription>
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              Faturamento
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currencyFormatter.format(totalRevenue)}</div>
            <p className="mt-1 text-xs text-slate-500">{numberFormatter.format(totalOrders)} venda(s) registradas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Eficiência comercial</CardDescription>
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              Conversão de orçamentos
              <Target className="h-4 w-4 text-blue-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quoteConversionRateLabel(analytics.quoteConversionRate)}</div>
            <p className="mt-1 text-xs text-slate-500">Percentual de orçamentos aceitos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Base ativa</CardDescription>
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              Clientes monitorados
              <Users className="h-4 w-4 text-violet-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{numberFormatter.format(totalClients)}</div>
            <p className="mt-1 text-xs text-slate-500">Clientes cadastrados no CRM</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Valor médio por pedido</CardDescription>
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              Ticket médio
              <TrendingUp className="h-4 w-4 text-amber-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currencyFormatter.format(averageTicket)}</div>
            <p className="mt-1 text-xs text-slate-500">Média calculada no intervalo selecionado</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Evolução de receita
            </CardTitle>
            <CardDescription>Receita diária e volume de pedidos no período</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingState />
            ) : analytics.salesByDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={analytics.salesByDay}>
                  <defs>
                    <linearGradient id="analyticsRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2d7a3a" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#2d7a3a" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => currencyFormatter.format(value)} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#2d7a3a"
                    fillOpacity={1}
                    fill="url(#analyticsRevenue)"
                    name="Receita"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="Nenhuma venda encontrada para montar a série temporal." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Status de pagamento
            </CardTitle>
            <CardDescription>Distribuição dos pedidos por situação financeira</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingState />
            ) : analytics.paymentStatus.length > 0 ? (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={analytics.paymentStatus}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {analytics.paymentStatus.map((entry, index) => (
                        <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2">
                  {analytics.paymentStatus.map((item, index) => (
                    <Badge key={item.name} variant="secondary" className="gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      {item.name}: {item.value}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState message="Sem dados de pagamento no período selecionado." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top clientes por receita</CardTitle>
            <CardDescription>Clientes com maior faturamento acumulado no período</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingState />
            ) : analytics.topClients.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.topClients} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={140} />
                  <Tooltip formatter={(value: number) => currencyFormatter.format(value)} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 6, 6, 0]} name="Receita" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="Ainda não há clientes com vendas suficientes para ranking." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline comercial</CardTitle>
            <CardDescription>Volume de oportunidades por etapa do funil</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboardLoading ? (
              <LoadingState />
            ) : analytics.pipelineByStage.length > 0 ? (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={analytics.pipelineByStage}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-20} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="total" fill="#8b5cf6" radius={[6, 6, 0, 0]} name="Oportunidades" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-3">
                  <MetricMiniCard
                    label="Oportunidades abertas"
                    value={numberFormatter.format(analytics.openOpportunities)}
                  />
                  <MetricMiniCard
                    label="Oportunidades ganhas"
                    value={numberFormatter.format(analytics.wonOpportunities)}
                  />
                </div>
              </div>
            ) : (
              <EmptyState message="Nenhuma oportunidade encontrada para análise do pipeline." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function quoteConversionRateLabel(value: number) {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function LoadingState() {
  return (
    <div className="flex h-[260px] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="flex h-[260px] items-center justify-center text-center text-sm text-slate-500">{message}</div>;
}

function MetricMiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}