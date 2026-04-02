import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, TrendingUp, DollarSign, Target } from "lucide-react";

const COLORS = ["#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899"];

export default function Dashboard() {
  const hoje = new Date();
  const [dateRange, setDateRange] = useState({
    startDate: new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0],
    endDate: hoje.toISOString().split("T")[0],
  });

  const { data: metrics, isLoading } = trpc.dashboard.metrics.useQuery();

  const { data: salesInPeriod } = trpc.sales.list.useQuery({
    startDate: new Date(dateRange.startDate),
    endDate: new Date(dateRange.endDate),
    limit: 5000,
  });
  const totalSalesPeriod = (salesInPeriod as any[])?.reduce((s: number, v: any) => s + parseFloat(v.totalValue || "0"), 0) ?? 0;
  const salesCountPeriod = (salesInPeriod as any[])?.length ?? 0;
  const ticketMedioPeriod = salesCountPeriod > 0 ? totalSalesPeriod / salesCountPeriod : 0;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const totalOpportunities = metrics?.totalOpportunities || 0;
  const totalClients = metrics?.totalClients || 0;

  const opportunitiesData = metrics?.opportunitiesByStage?.map((item: any) => ({
    name: item.stage.replace(/_/g, " ").toUpperCase(),
    value: item.count,
  })) || [];

  const stageLabels: Record<string, string> = {
    prospeccao: "Prospecção",
    visita_tecnica: "Visita Técnica",
    orcamento_enviado: "Orçamento Enviado",
    negociacao: "Negociação",
    venda_concluida: "Venda Concluída",
    perdida: "Perdida",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-slate-600">Visão geral do seu CRM</p>
        </div>
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="text-xs font-medium text-slate-500">De</label>
            <Input type="date" value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="h-8 text-sm w-36" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Até</label>
            <Input type="date" value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="h-8 text-sm w-36" />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {totalSalesPeriod.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-600">Vendas no período selecionado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Oportunidades</CardTitle>
            <Target className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOpportunities}</div>
            <p className="text-xs text-slate-600">No funil de vendas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClients}</div>
            <p className="text-xs text-slate-600">Produtores cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {ticketMedioPeriod.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-600">Por venda no período ({salesCountPeriod})</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Opportunities by Stage */}
        <Card>
          <CardHeader>
            <CardTitle>Oportunidades por Etapa</CardTitle>
            <CardDescription>Distribuição do funil de vendas</CardDescription>
          </CardHeader>
          <CardContent>
            {opportunitiesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={opportunitiesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-slate-600">
                Nenhuma oportunidade registrada
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição do Funil</CardTitle>
            <CardDescription>Proporção de oportunidades por etapa</CardDescription>
          </CardHeader>
          <CardContent>
            {opportunitiesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={opportunitiesData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {opportunitiesData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-slate-600">
                Nenhuma oportunidade registrada
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo do Funil</CardTitle>
          <CardDescription>Detalhamento de oportunidades por etapa</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {opportunitiesData.length > 0 ? (
              opportunitiesData.map((item: any, index: number) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    ></div>
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  <span className="text-sm font-semibold">{item.value}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">Nenhuma oportunidade registrada</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
