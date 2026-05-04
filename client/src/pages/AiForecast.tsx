import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ComposedChart,
  Area,
} from "recharts";
import {
  TrendingUp,
  AlertTriangle,
  Package,
  DollarSign,
  Target,
  BarChart3,
  Lightbulb,
  Users,
  ShoppingBag,
  Trophy,
  TrendingDown,
  Brain,
  CheckCircle,
  Clock,
  ArrowRight,
  Percent,
  Receipt,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES = [
  "prospeccao",
  "visita_tecnica",
  "orcamento_enviado",
  "negociacao",
  "venda_concluida",
  "perdida",
];
const STAGE_LABELS: Record<string, string> = {
  prospeccao: "Prospecção",
  visita_tecnica: "Visita Técnica",
  orcamento_enviado: "Orçamento Enviado",
  negociacao: "Negociação",
  venda_concluida: "Venda Concluída",
  perdida: "Perdida",
};
const STAGE_PROB: Record<string, number> = {
  prospeccao: 10,
  visita_tecnica: 25,
  orcamento_enviado: 45,
  negociacao: 70,
  venda_concluida: 100,
  perdida: 0,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtShort(v: number) {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(0)}k`;
  return fmt(v);
}

function thisMonth() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Simple linear regression y = a + b*x over array of y values */
function linearRegression(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, v) => a + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  return { slope, intercept };
}

/** Simple moving average with window k */
function movingAvg(values: number[], k = 3): number[] {
  return values.map((_, i) => {
    const start = Math.max(0, i - k + 1);
    const slice = values.slice(start, i + 1);
    return slice.reduce((a, v) => a + v, 0) / slice.length;
  });
}

/** Build last N months data array */
function buildMonthlyData(sales: any[], n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (n - 1 - i));
    const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    const total = (sales as any[])
      .filter((s: any) => {
        const sd = new Date(s.saleDate || s.date || "");
        return sd.getFullYear() === d.getFullYear() && sd.getMonth() === d.getMonth();
      })
      .reduce((acc: number, s: any) => acc + parseFloat(s.totalValue || s.value || "0"), 0);
    return { label, total, month: d.getMonth(), year: d.getFullYear() };
  });
}

/** Generate enhanced AI insights */
function generateAIInsights(data: {
  opportunities: any[];
  sales: any[];
  clients: any[];
  salesThisMonth: number;
  salesLastMonth: number;
  avgTicket: number;
  conversionRate: number;
  last6: { label: string; total: number }[];
}) {
  const insights: { text: string; type: "success" | "warning" | "info" | "danger" } [] = [];
  const { opportunities, sales, clients, salesThisMonth, salesLastMonth, avgTicket, conversionRate, last6 } = data;

  // Growth vs last month
  if (salesLastMonth > 0) {
    const pct = ((salesThisMonth - salesLastMonth) / salesLastMonth) * 100;
    if (pct > 10) {
      insights.push({ text: `Vendas ${pct.toFixed(0)}% acima do mês passado. Excelente ritmo!`, type: "success" });
    } else if (pct < -10) {
      insights.push({ text: `Vendas ${Math.abs(pct).toFixed(0)}% abaixo do mês passado. Requer atenção.`, type: "danger" });
    }
  }

  // 6-month average comparison
  const avg6 = last6.slice(0, 5).reduce((a, m) => a + m.total, 0) / 5;
  if (avg6 > 0 && salesThisMonth > 0) {
    const pct = ((salesThisMonth - avg6) / avg6) * 100;
    if (Math.abs(pct) >= 10) {
      insights.push({
        text: `Vendas ${pct > 0 ? "+" : ""}${pct.toFixed(0)}% em relação à média dos últimos 5 meses (${fmtShort(avg6)}).`,
        type: pct > 0 ? "success" : "warning",
      });
    }
  }

  // Trend direction (linear regression)
  const vals = last6.map((m) => m.total);
  const { slope } = linearRegression(vals);
  if (slope > 1000) {
    insights.push({ text: `Tendência de alta: crescimento médio de ${fmtShort(slope)}/mês nos últimos 6 meses.`, type: "success" });
  } else if (slope < -1000) {
    insights.push({ text: `Tendência de queda: redução média de ${fmtShort(Math.abs(slope))}/mês. Revise a estratégia.`, type: "warning" });
  }

  // Conversion rate
  if (conversionRate < 20) {
    insights.push({ text: `Taxa de conversão de ${conversionRate.toFixed(1)}% está abaixo de 20%. Melhore o processo comercial.`, type: "warning" });
  } else if (conversionRate >= 40) {
    insights.push({ text: `Taxa de conversão de ${conversionRate.toFixed(1)}% está excelente!`, type: "success" });
  }

  // Average ticket
  if (avgTicket > 0) {
    insights.push({ text: `Ticket médio atual: ${fmt(avgTicket)}.`, type: "info" });
  }

  // Pending follow-up
  const pendingFollowUp = opportunities.filter((o) => {
    if (o.stage !== "orcamento_enviado") return false;
    const created = new Date(o.createdAt);
    const diffDays = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 7;
  });
  if (pendingFollowUp.length > 0) {
    insights.push({
      text: `${pendingFollowUp.length} orçamento(s) sem resposta há mais de 7 dias — faça follow-up urgente.`,
      type: "danger",
    });
  }

  // Top client
  const topPipeline = [...(clients || [])]
    .map((c) => {
      const clientOpps = opportunities.filter((o) => o.clientId === c.id && o.stage !== "perdida");
      const weighted = clientOpps.reduce(
        (s, o) => s + (Number(o.value) || 0) * (STAGE_PROB[o.stage] || 0) / 100,
        0
      );
      return { name: c.farmName || c.producerName || `#${c.id}`, weighted };
    })
    .sort((a, b) => b.weighted - a.weighted)
    .slice(0, 1);

  if (topPipeline.length > 0 && topPipeline[0].weighted > 0) {
    insights.push({
      text: `Foque em ${topPipeline[0].name} — maior pipeline ponderado (${fmt(topPipeline[0].weighted)}).`,
      type: "info",
    });
  }

  // Long stalled negotiations
  const negotiation = opportunities.filter((o) => {
    if (o.stage !== "negociacao") return false;
    const created = new Date(o.createdAt);
    const diffDays = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 15;
  });
  if (negotiation.length > 0) {
    insights.push({
      text: `${negotiation.length} oportunidade(s) em negociação há mais de 15 dias — risco de perda.`,
      type: "danger",
    });
  }

  if (insights.length === 0) {
    insights.push({ text: "Pipeline saudável. Mantenha o ritmo de prospecção.", type: "success" });
  }

  return insights;
}

// ─── Subcomponents ─────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  title,
  value,
  sub,
  delta,
  color = "blue",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  sub?: string;
  delta?: number;
  color?: "blue" | "green" | "purple" | "orange" | "red";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    orange: "bg-orange-50 text-orange-600",
    red: "bg-red-50 text-red-600",
  };
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-xs text-slate-500 font-medium truncate">{title}</p>
            <p className="text-xl font-bold text-slate-800 truncate">{value}</p>
            {sub && <p className="text-xs text-slate-400 truncate">{sub}</p>}
          </div>
          <div className={`rounded-xl p-2.5 shrink-0 ${colors[color]}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        {delta !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${delta >= 0 ? "text-green-600" : "text-red-600"}`}>
            {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : delta < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {delta >= 0 ? "+" : ""}{delta.toFixed(1)}% vs mês anterior
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Tab type ─────────────────────────────────────────────────────────────────

type Tab = "overview" | "trends" | "bycliente" | "abc";

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AiForecast() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [goalInput, setGoalInput] = useState("");
  const month = thisMonth();

  const { data: forecastData } = trpc.ai.forecast.useQuery();
  const { data: goalData, refetch: refetchGoal } = trpc.goals.get.useQuery({ month });
  const { data: progressData } = trpc.goals.progress.useQuery({ month });
  const { data: abcData = [] } = trpc.goals.abc.useQuery();
  const setGoalMutation = trpc.goals.set.useMutation({
    onSuccess: () => {
      toast.success("Meta atualizada!");
      refetchGoal();
    },
    onError: () => toast.error("Erro ao salvar meta."),
  });

  const opportunities: any[] = forecastData?.opportunities ?? [];
  const sales: any[] = forecastData?.sales ?? [];
  const clients: any[] = forecastData?.clients ?? [];

  const goalValue = goalData?.goalValue ?? 0;
  const realized = progressData?.realized ?? 0;
  const pipeline = progressData?.pipeline ?? 0;
  const projection = progressData?.projection ?? 0;
  const goalValueNum = Number(goalValue) || 0;
  const goalPct = goalValueNum > 0 ? Math.min(100, (Number(realized) / goalValueNum) * 100) : 0;
  const projPct = goalValueNum > 0 ? Math.min(100, (Number(projection) / goalValueNum) * 100) : 0;

  // Month calculations
  const now = new Date();
  const curMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  const salesThisMonth = sales
    .filter((s) => s.saleDate && String(s.saleDate).startsWith(curMonthStr))
    .reduce((a, s) => a + (Number(s.totalValue) || 0), 0);
  const salesLastMonth = sales
    .filter((s) => s.saleDate && String(s.saleDate).startsWith(prevMonthStr))
    .reduce((a, s) => a + (Number(s.totalValue) || 0), 0);

  const growthPct =
    salesLastMonth > 0
      ? ((salesThisMonth - salesLastMonth) / salesLastMonth) * 100
      : salesThisMonth > 0
      ? 100
      : 0;

  // Conversion rate: won / (won + lost) among closed
  const wonOpps = opportunities.filter((o) => o.stage === "venda_concluida").length;
  const lostOpps = opportunities.filter((o) => o.stage === "perdida").length;
  const conversionRate = wonOpps + lostOpps > 0 ? (wonOpps / (wonOpps + lostOpps)) * 100 : 0;

  // Average ticket
  const closedSalesValues = sales.map((s) => Number(s.totalValue) || 0).filter((v) => v > 0);
  const avgTicket = closedSalesValues.length > 0
    ? closedSalesValues.reduce((a, v) => a + v, 0) / closedSalesValues.length
    : 0;

  // Average ticket this month vs last month
  const ticketThisMonthValues = sales
    .filter((s) => s.saleDate && String(s.saleDate).startsWith(curMonthStr))
    .map((s) => Number(s.totalValue) || 0)
    .filter((v) => v > 0);
  const ticketLastMonthValues = sales
    .filter((s) => s.saleDate && String(s.saleDate).startsWith(prevMonthStr))
    .map((s) => Number(s.totalValue) || 0)
    .filter((v) => v > 0);
  const avgTicketThis = ticketThisMonthValues.length > 0
    ? ticketThisMonthValues.reduce((a, v) => a + v, 0) / ticketThisMonthValues.length
    : 0;
  const avgTicketLast = ticketLastMonthValues.length > 0
    ? ticketLastMonthValues.reduce((a, v) => a + v, 0) / ticketLastMonthValues.length
    : 0;
  const avgTicketDelta =
    avgTicketLast > 0 ? ((avgTicketThis - avgTicketLast) / avgTicketLast) * 100 : 0;

  // End-of-month projection
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - dayOfMonth;
  const last30Sales = sales
    .filter((s) => {
      if (!s.saleDate) return false;
      const d = new Date(s.saleDate);
      return Date.now() - d.getTime() <= 30 * 24 * 60 * 60 * 1000;
    })
    .reduce((a, s) => a + (Number(s.totalValue) || 0), 0);
  const dailyRate = dayOfMonth > 0 ? last30Sales / dayOfMonth : 0;
  const endOfMonthProjection = salesThisMonth + dailyRate * daysRemaining;

  // Alerts
  const alertsLong = opportunities.filter((o) => {
    if (o.stage === "venda_concluida" || o.stage === "perdida") return false;
    const diffDays = (Date.now() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 15;
  });
  const alertsOrcamento = opportunities.filter((o) => o.stage === "orcamento_enviado");
  const clientsNoOpps = clients.filter(
    (c) => !opportunities.some((o) => o.clientId === c.id && o.stage !== "perdida" && o.stage !== "venda_concluida")
  );

  // Funnel
  const funnelData = STAGES.map((stage) => {
    const stageOpps = opportunities.filter((o) => o.stage === stage);
    const total = stageOpps.reduce((s, o) => s + (Number(o.value) || 0), 0);
    return { stage, label: STAGE_LABELS[stage], count: stageOpps.length, total };
  });
  const maxFunnelTotal = Math.max(...funnelData.map((f) => f.total), 1);

  // Top 5 opportunities
  const top5Opps = [...opportunities]
    .map((o) => ({
      ...o,
      weighted: ((Number(o.value) || 0) * (STAGE_PROB[o.stage] || 0)) / 100,
    }))
    .filter((o) => o.stage !== "perdida")
    .sort((a, b) => b.weighted - a.weighted)
    .slice(0, 5);

  // Last 6 months data
  const last6Months = buildMonthlyData(sales, 6);
  const last6Values = last6Months.map((m) => m.total);

  // Linear regression on last 6 months
  const { slope, intercept } = linearRegression(last6Values);

  // Moving average on last 6 months
  const movAvg = movingAvg(last6Values, 3);

  // Forecast next 3 months using regression
  const forecastMonths = Array.from({ length: 3 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + i + 1);
    const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    const idx = 6 + i;
    const projected = Math.max(0, intercept + slope * idx);
    return { label, total: null, projected, movAvg: null };
  });

  // Combine for trend chart (6 history + 3 forecast)
  const trendChartData = [
    ...last6Months.map((m, i) => ({
      label: m.label,
      total: m.total,
      projected: parseFloat((intercept + slope * i).toFixed(2)),
      movAvg: parseFloat(movAvg[i].toFixed(2)),
    })),
    ...forecastMonths,
  ];

  // Monthly comparison chart
  const comparisonChartData = last6Months.map((m) => ({
    label: m.label,
    vendas: m.total,
  }));

  // By client
  const byClient = clients
    .map((c) => {
      const clientOpps = opportunities.filter((o) => o.clientId === c.id && o.stage !== "perdida");
      const gross = clientOpps.reduce((s, o) => s + (Number(o.value) || 0), 0);
      const weighted = clientOpps.reduce(
        (s, o) => s + (Number(o.value) || 0) * (STAGE_PROB[o.stage] || 0) / 100,
        0
      );
      const stages = Array.from(new Set(clientOpps.map((o: any) => STAGE_LABELS[o.stage] || o.stage))).join(", ");
      return { id: c.id, name: c.farmName || c.producerName || `#${c.id}`, count: clientOpps.length, gross, weighted, stages };
    })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.weighted - a.weighted);

  // AI insights
  const aiInsights = generateAIInsights({
    opportunities,
    sales,
    clients,
    salesThisMonth,
    salesLastMonth,
    avgTicket,
    conversionRate,
    last6: last6Months,
  });

  const handleSetGoal = () => {
    const val = parseFloat(goalInput.replace(",", "."));
    if (isNaN(val) || val <= 0) {
      toast.error("Insira um valor válido.");
      return;
    }
    setGoalMutation.mutate({ month, goalValue: String(val) });
    setGoalInput("");
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Visão Geral" },
    { id: "trends", label: "Tendências" },
    { id: "bycliente", label: "Por Cliente" },
    { id: "abc", label: "Curva ABC" },
  ];

  const chartConfig = {
    total: { label: "Vendas", color: "#3b82f6" },
    projected: { label: "Tendência (Regressão)", color: "#8b5cf6" },
    movAvg: { label: "Média Móvel (3m)", color: "#f59e0b" },
    vendas: { label: "Vendas", color: "#3b82f6" },
  };

  const insightColors = {
    success: "bg-green-50 text-green-800 border-green-200",
    warning: "bg-yellow-50 text-yellow-800 border-yellow-200",
    info: "bg-blue-50 text-blue-800 border-blue-200",
    danger: "bg-red-50 text-red-800 border-red-200",
  };
  const insightIcons = {
    success: <TrendingUp className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />,
    info: <Lightbulb className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />,
    danger: <Zap className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />,
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Brain className="h-6 w-6 text-purple-600" /> Forecast com IA
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Análise inteligente do pipeline, tendências de vendas e projeções futuras
        </p>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={DollarSign}
          title="Vendas este mês"
          value={fmtShort(salesThisMonth)}
          sub={fmt(salesThisMonth)}
          delta={growthPct}
          color="green"
        />
        <KpiCard
          icon={Percent}
          title="Taxa de Conversão"
          value={`${conversionRate.toFixed(1)}%`}
          sub={`${wonOpps} ganhas / ${lostOpps} perdidas`}
          color={conversionRate >= 40 ? "green" : conversionRate >= 20 ? "blue" : "red"}
        />
        <KpiCard
          icon={Receipt}
          title="Ticket Médio"
          value={fmtShort(avgTicketThis || avgTicket)}
          sub={`Geral: ${fmtShort(avgTicket)}`}
          delta={avgTicketLast > 0 ? avgTicketDelta : undefined}
          color="purple"
        />
        <KpiCard
          icon={Target}
          title="Previsão Fim do Mês"
          value={fmtShort(endOfMonthProjection)}
          sub={`Taxa: ${fmtShort(dailyRate)}/dia`}
          color="orange"
        />
      </div>

      {/* Meta Mensal */}
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-purple-600" /> Meta Mensal —{" "}
            {new Date().toLocaleString("pt-BR", { month: "long", year: "numeric" })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Meta</p>
              <p className="text-lg font-bold text-purple-700">{fmt(Number(goalValue) || 0)}</p>
            </div>
            <div>
              <p className="text-slate-500">Realizado</p>
              <p className="text-lg font-bold text-green-700">{fmt(Number(realized) || 0)}</p>
            </div>
            <div>
              <p className="text-slate-500">Pipeline</p>
              <p className="text-lg font-bold text-blue-700">{fmt(Number(pipeline) || 0)}</p>
            </div>
            <div>
              <p className="text-slate-500">Projeção</p>
              <p className="text-lg font-bold text-orange-700">{fmt(Number(projection) || 0)}</p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Realizado {goalPct.toFixed(1)}%</span>
              <span>Projetado {projPct.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3 relative overflow-hidden">
              <div
                className="h-3 rounded-full bg-green-500 absolute"
                style={{ width: `${goalPct}%` }}
              />
              <div
                className="h-3 rounded-full bg-orange-400 absolute opacity-60"
                style={{ width: `${projPct}%` }}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Nova meta (R$)"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              className="max-w-xs"
            />
            <Button size="sm" onClick={handleSetGoal} disabled={setGoalMutation.isPending}>
              Definir Meta
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI Insights Cards */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-500" /> Insights Automáticos da IA
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {aiInsights.map((insight, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${insightColors[insight.type]}`}
            >
              {insightIcons[insight.type]}
              <span>{insight.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Comparativo mês atual vs anterior */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 font-medium mb-1">Mês Atual</p>
            <p className="text-2xl font-bold text-green-700">{fmt(salesThisMonth)}</p>
            <p className="text-xs text-slate-400 mt-1">
              {new Date().toLocaleString("pt-BR", { month: "long" })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 font-medium mb-1">Mês Anterior</p>
            <p className="text-2xl font-bold text-blue-700">{fmt(salesLastMonth)}</p>
            <p className="text-xs text-slate-400 mt-1">
              {prevDate.toLocaleString("pt-BR", { month: "long" })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 font-medium mb-1">Variação</p>
            <p className={`text-2xl font-bold flex items-center gap-1 ${growthPct >= 0 ? "text-green-600" : "text-red-600"}`}>
              {growthPct >= 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
              {growthPct >= 0 ? "+" : ""}{growthPct.toFixed(1)}%
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {growthPct >= 0 ? "Crescimento" : "Queda"} vs mês anterior
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.id
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Visão Geral */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-4">
            {/* Monthly diagnosis */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-600" /> Diagnóstico do Mês
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Vendas este mês</span>
                  <span className="font-bold">{fmt(salesThisMonth)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Vendas mês passado</span>
                  <span className="font-bold">{fmt(salesLastMonth)}</span>
                </div>
                <div className="flex justify-between items-center border-t pt-2">
                  <span className="text-slate-500">Variação</span>
                  <span
                    className={`font-bold flex items-center gap-1 ${growthPct >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {growthPct >= 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    {growthPct >= 0 ? "+" : ""}
                    {growthPct.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center border-t pt-2">
                  <span className="text-slate-500">Taxa de conversão</span>
                  <span className="font-bold text-blue-700">{conversionRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Ticket médio</span>
                  <span className="font-bold">{fmt(avgTicketThis || avgTicket)}</span>
                </div>
              </CardContent>
            </Card>

            {/* End-of-month projection */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-500" /> Projeção até Fim do Mês
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Dia atual</span>
                  <span>
                    {dayOfMonth}/{daysInMonth}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Taxa diária (30d)</span>
                  <span>{fmt(dailyRate)}/dia</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-slate-500 font-medium">Projeção fim do mês</span>
                  <span className="font-bold text-orange-600">{fmt(endOfMonthProjection)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Critical alerts */}
            <Card className="border-red-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-4 w-4" /> Alertas Críticos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {alertsLong.length > 0 && (
                  <div className="flex items-start gap-2 text-red-700 bg-red-50 rounded p-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{alertsLong.length} oportunidade(s) em negociação há mais de 15 dias</span>
                  </div>
                )}
                {alertsOrcamento.length > 0 && (
                  <div className="flex items-start gap-2 text-orange-700 bg-orange-50 rounded p-2">
                    <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{alertsOrcamento.length} orçamento(s) enviado(s) aguardando resposta</span>
                  </div>
                )}
                {clientsNoOpps.length > 0 && (
                  <div className="flex items-start gap-2 text-slate-600 bg-slate-50 rounded p-2">
                    <Users className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{clientsNoOpps.length} cliente(s) sem oportunidades ativas</span>
                  </div>
                )}
                {alertsLong.length === 0 &&
                  alertsOrcamento.length === 0 &&
                  clientsNoOpps.length === 0 && (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span>Nenhum alerta crítico no momento</span>
                    </div>
                  )}
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Sales funnel */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-600" /> Funil de Vendas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {funnelData.map((f) => (
                  <div key={f.stage} className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>{f.label}</span>
                      <span>
                        {f.count} · {fmt(f.total)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          f.stage === "perdida"
                            ? "bg-red-400"
                            : f.stage === "venda_concluida"
                            ? "bg-green-500"
                            : "bg-blue-500"
                        }`}
                        style={{ width: `${(f.total / maxFunnelTotal) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Top 5 opportunities */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-500" /> Top 5 Oportunidades
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {top5Opps.map((o, i) => (
                  <div key={o.id ?? i} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-slate-400 text-xs w-4 flex-shrink-0">#{i + 1}</span>
                      <span className="truncate text-slate-700">{o.title || o.name || "Sem título"}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="outline" className="text-xs">
                        {STAGE_LABELS[o.stage] || o.stage}
                      </Badge>
                      <span className="font-medium text-blue-700">{fmt(o.weighted)}</span>
                    </div>
                  </div>
                ))}
                {top5Opps.length === 0 && (
                  <p className="text-slate-400 text-xs">Nenhuma oportunidade ativa</p>
                )}
              </CardContent>
            </Card>

            {/* Bar chart last 6 months */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-600" /> Vendas — Últimos 6 Meses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-40 w-full">
                  <BarChart data={comparisonChartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis
                      tickFormatter={(v) => fmtShort(v)}
                      tick={{ fontSize: 10 }}
                      width={52}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => [fmt(Number(value)), "Vendas"]}
                        />
                      }
                    />
                    <Bar dataKey="vendas" fill="var(--color-vendas)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tab: Tendências */}
      {activeTab === "trends" && (
        <div className="space-y-6">
          {/* Trend chart with regression + moving avg + forecast */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-600" /> Tendência de Vendas (6 meses + 3 meses projetados)
              </CardTitle>
              <p className="text-xs text-slate-400 mt-1">
                Linha roxa = regressão linear · Linha âmbar = média móvel (3m) · Área tracejada = projeção futura
              </p>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <ComposedChart data={trendChartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(v) => fmtShort(v)} tick={{ fontSize: 10 }} width={56} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => {
                          if (value === null || value === undefined) return ["-", name];
                          return [fmt(Number(value)), name];
                        }}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  {/* Separator between history and forecast */}
                  <ReferenceLine
                    x={last6Months[last6Months.length - 1]?.label}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    label={{ value: "Hoje", position: "top", fontSize: 10, fill: "#94a3b8" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    fill="#dbeafe"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#3b82f6" }}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="projected"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="movAvg"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                </ComposedChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Summary statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 font-medium mb-1">Tendência (slope)</p>
                <p className={`text-lg font-bold ${slope >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {slope >= 0 ? "+" : ""}{fmtShort(slope)}/mês
                </p>
                <p className="text-xs text-slate-400 mt-1">Regressão linear 6m</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 font-medium mb-1">Projeção Próx. Mês</p>
                <p className="text-lg font-bold text-purple-700">
                  {fmtShort(Math.max(0, intercept + slope * 6))}
                </p>
                <p className="text-xs text-slate-400 mt-1">Regressão linear</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 font-medium mb-1">Média 6 Meses</p>
                <p className="text-lg font-bold text-blue-700">
                  {fmtShort(last6Values.reduce((a, v) => a + v, 0) / (last6Values.filter((v) => v > 0).length || 1))}
                </p>
                <p className="text-xs text-slate-400 mt-1">Média simples</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 font-medium mb-1">Melhor Mês (6m)</p>
                <p className="text-lg font-bold text-green-700">
                  {fmtShort(Math.max(...last6Values))}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {last6Months[last6Values.indexOf(Math.max(...last6Values))]?.label || "-"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Forecast table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-600" /> Projeção Próximos 3 Meses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-slate-500 text-left">
                      <th className="pb-2 pr-4">Mês</th>
                      <th className="pb-2 pr-4 text-right">Projeção (Regressão)</th>
                      <th className="pb-2 text-right">Variação vs. Atual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecastMonths.map((m, i) => {
                      const proj = m.projected;
                      const delta = salesThisMonth > 0 ? ((proj - salesThisMonth) / salesThisMonth) * 100 : 0;
                      return (
                        <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                          <td className="py-2 pr-4 font-medium text-slate-700 capitalize">{m.label}</td>
                          <td className="py-2 pr-4 text-right font-bold text-purple-700">{fmt(proj)}</td>
                          <td className={`py-2 text-right font-medium ${delta >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {delta >= 0 ? "+" : ""}{delta.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Por Cliente */}
      {activeTab === "bycliente" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" /> Ranking por Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-slate-500 text-left">
                    <th className="pb-2 pr-4">#</th>
                    <th className="pb-2 pr-4">Cliente</th>
                    <th className="pb-2 pr-4 text-center">Opps</th>
                    <th className="pb-2 pr-4 text-right">Total Bruto</th>
                    <th className="pb-2 pr-4 text-right">Ponderado</th>
                    <th className="pb-2">Etapas</th>
                  </tr>
                </thead>
                <tbody>
                  {byClient.map((c, i) => (
                    <tr key={c.id ?? i} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="py-2 pr-4 text-slate-400">#{i + 1}</td>
                      <td className="py-2 pr-4 font-medium text-slate-800">{c.name}</td>
                      <td className="py-2 pr-4 text-center">{c.count}</td>
                      <td className="py-2 pr-4 text-right">{fmt(c.gross)}</td>
                      <td className="py-2 pr-4 text-right font-semibold text-blue-700">{fmt(c.weighted)}</td>
                      <td className="py-2 text-xs text-slate-500">{c.stages}</td>
                    </tr>
                  ))}
                  {byClient.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Nenhum cliente com oportunidades ativas
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab: Curva ABC */}
      {activeTab === "abc" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-purple-600" /> Curva ABC de Produtos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {abcData.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">Nenhum dado disponível</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-slate-500 text-left">
                        <th className="pb-2 pr-4">Classe</th>
                        <th className="pb-2 pr-4">Produto</th>
                        <th className="pb-2 pr-4 text-right">Receita</th>
                        <th className="pb-2 pr-4 text-right">% do Total</th>
                        <th className="pb-2 text-right">% Acumulado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(abcData as any[]).map((item: any, i: number) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                          <td className="py-2 pr-4">
                            <Badge
                              className={
                                item.cls === "A"
                                  ? "bg-green-100 text-green-700"
                                  : item.cls === "B"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                              }
                            >
                              {item.cls}
                            </Badge>
                          </td>
                          <td className="py-2 pr-4 font-medium">{item.name}</td>
                          <td className="py-2 pr-4 text-right">{fmt(item.value ?? 0)}</td>
                          <td className="py-2 pr-4 text-right">{(item.pct ?? 0).toFixed(1)}%</td>
                          <td className="py-2 text-right">{(item.accPct ?? 0).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
