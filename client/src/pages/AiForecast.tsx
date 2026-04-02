import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TrendingUp, AlertTriangle, Package, DollarSign, Target,
  BarChart3, Lightbulb, Users, ShoppingBag, Trophy,
  TrendingDown, Brain, CheckCircle, Clock, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

const STAGES = ["prospeccao","visita_tecnica","orcamento_enviado","negociacao","venda_concluida","perdida"];
const STAGE_LABELS: Record<string,string> = {
  prospeccao:"Prospecção",
  visita_tecnica:"Visita Técnica",
  orcamento_enviado:"Orçamento Enviado",
  negociacao:"Negociação",
  venda_concluida:"Venda Concluída",
  perdida:"Perdida",
};
const STAGE_PROB: Record<string,number> = {
  prospeccao:10,
  visita_tecnica:25,
  orcamento_enviado:45,
  negociacao:70,
  venda_concluida:100,
  perdida:0,
};

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function thisMonth() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function calcForecast(opps: any[]) {
  return opps
    .filter((o) => o.stage !== "perdida" && o.stage !== "venda_concluida")
    .reduce((acc, o) => acc + (Number(o.value) || 0) * (STAGE_PROB[o.stage] || 0) / 100, 0);
}

function generateAIInsights(data: { opportunities: any[]; sales: any[]; clients: any[] }) {
  const insights: string[] = [];
  const { opportunities, sales, clients } = data;

  const pendingFollowUp = opportunities.filter((o) => {
    if (o.stage !== "orcamento_enviado") return false;
    const created = new Date(o.createdAt);
    const diffDays = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 7;
  });
  if (pendingFollowUp.length > 0) {
    insights.push(`${pendingFollowUp.length} orçamento(s) sem resposta precisam de follow-up urgente.`);
  }

  const topPipeline = [...(clients || [])]
    .map((c) => {
      const clientOpps = opportunities.filter((o) => o.clientId === c.id && o.stage !== "perdida");
      const weighted = clientOpps.reduce((s, o) => s + (Number(o.value) || 0) * (STAGE_PROB[o.stage] || 0) / 100, 0);
      return { name: c.name, weighted };
    })
    .sort((a, b) => b.weighted - a.weighted)
    .slice(0, 3);

  if (topPipeline.length > 0) {
    insights.push(`Foque em ${topPipeline[0].name} — maior pipeline ponderado (${fmt(topPipeline[0].weighted)}).`);
  }

  const negotiation = opportunities.filter((o) => {
    if (o.stage !== "negociacao") return false;
    const created = new Date(o.createdAt);
    const diffDays = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 15;
  });
  if (negotiation.length > 0) {
    insights.push(`${negotiation.length} oportunidade(s) em negociação há mais de 15 dias — risco de perda.`);
  }

  if (insights.length === 0) {
    insights.push("Pipeline saudável. Mantenha o ritmo de prospecção.");
  }

  return insights;
}

type Tab = "overview" | "bycliente" | "abc";

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

  // Diagnóstico do mês
  const now = new Date();
  const curMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  const salesThisMonth = sales
    .filter((s) => s.date && String(s.date).startsWith(curMonthStr))
    .reduce((a, s) => a + (Number(s.value) || 0), 0);
  const salesLastMonth = sales
    .filter((s) => s.date && String(s.date).startsWith(prevMonthStr))
    .reduce((a, s) => a + (Number(s.value) || 0), 0);

  const growthPct = salesLastMonth > 0
    ? ((salesThisMonth - salesLastMonth) / salesLastMonth) * 100
    : salesThisMonth > 0 ? 100 : 0;

  // Projeção até fim do mês
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - dayOfMonth;
  const last30Sales = sales
    .filter((s) => {
      if (!s.date) return false;
      const d = new Date(s.date);
      return (Date.now() - d.getTime()) <= 30 * 24 * 60 * 60 * 1000;
    })
    .reduce((a, s) => a + (Number(s.value) || 0), 0);
  const dailyRate = dayOfMonth > 0 ? last30Sales / dayOfMonth : 0;
  const endOfMonthProjection = salesThisMonth + dailyRate * daysRemaining;

  // Alertas
  const alertsLong = opportunities.filter((o) => {
    if (o.stage === "venda_concluida" || o.stage === "perdida") return false;
    const diffDays = (Date.now() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 15;
  });
  const alertsOrcamento = opportunities.filter((o) => o.stage === "orcamento_enviado");
  const clientsNoOpps = clients.filter((c) => {
    return !opportunities.some((o) => o.clientId === c.id && o.stage !== "perdida" && o.stage !== "venda_concluida");
  });

  // Funil
  const funnelData = STAGES.map((stage) => {
    const stageOpps = opportunities.filter((o) => o.stage === stage);
    const total = stageOpps.reduce((s, o) => s + (Number(o.value) || 0), 0);
    return { stage, label: STAGE_LABELS[stage], count: stageOpps.length, total };
  });
  const maxFunnelTotal = Math.max(...funnelData.map((f) => f.total), 1);

  // Top 5 oportunidades ponderadas
  const top5Opps = [...opportunities]
    .map((o) => ({
      ...o,
      weighted: (Number(o.value) || 0) * (STAGE_PROB[o.stage] || 0) / 100,
    }))
    .filter((o) => o.stage !== "perdida")
    .sort((a, b) => b.weighted - a.weighted)
    .slice(0, 5);

  // Últimos 6 meses de vendas
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    const total = (sales as any[])?.filter((s: any) => {
      const sd = new Date(s.saleDate || s.date || "");
      return sd.getFullYear() === d.getFullYear() && sd.getMonth() === d.getMonth();
    }).reduce((acc: number, s: any) => acc + parseFloat(s.totalValue || s.value || "0"), 0) ?? 0;
    return { label, total };
  });
  const maxBarValue = Math.max(...last6Months.map((m) => m.total), 1);

  // Por Cliente
  const byClient = clients.map((c) => {
    const clientOpps = opportunities.filter((o) => o.clientId === c.id && o.stage !== "perdida");
    const gross = clientOpps.reduce((s, o) => s + (Number(o.value) || 0), 0);
    const weighted = clientOpps.reduce((s, o) => s + (Number(o.value) || 0) * (STAGE_PROB[o.stage] || 0) / 100, 0);
    const stages = Array.from(new Set(clientOpps.map((o: any) => STAGE_LABELS[o.stage] || o.stage))).join(", ");
    return { id: c.id, name: c.name, count: clientOpps.length, gross, weighted, stages };
  })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.weighted - a.weighted);

  // AI insights
  const aiInsights = generateAIInsights({ opportunities, sales, clients });

  const handleSetGoal = () => {
    const val = parseFloat(goalInput.replace(",", "."));
    if (isNaN(val) || val <= 0) { toast.error("Insira um valor válido."); return; }
    setGoalMutation.mutate({ month, goalValue: String(val) });
    setGoalInput("");
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Visão Geral" },
    { id: "bycliente", label: "Por Cliente" },
    { id: "abc", label: "Curva ABC" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Meta Mensal */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Brain className="h-6 w-6 text-purple-600" /> Forecast com IA
        </h1>
        <p className="text-slate-500 text-sm mt-1">Análise inteligente do seu pipeline e previsão de vendas</p>
      </div>

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

      {/* Abas */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
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

      {/* Aba Visão Geral */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Coluna Esquerda */}
          <div className="space-y-4">
            {/* Diagnóstico do Mês */}
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
                  <span className={`font-bold flex items-center gap-1 ${growthPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {growthPct >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {growthPct >= 0 ? "+" : ""}{growthPct.toFixed(1)}%
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Projeção até fim do mês */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-500" /> Projeção até Fim do Mês
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Dia atual</span>
                  <span>{dayOfMonth}/{daysInMonth}</span>
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

            {/* Alertas Críticos */}
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
                {alertsLong.length === 0 && alertsOrcamento.length === 0 && clientsNoOpps.length === 0 && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>Nenhum alerta crítico no momento</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recomendações IA */}
            <Card className="border-purple-100 bg-purple-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-purple-700">
                  <Lightbulb className="h-4 w-4" /> Recomendações IA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {aiInsights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-2 text-purple-800">
                    <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-purple-500" />
                    <span>{insight}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Coluna Direita */}
          <div className="space-y-4">
            {/* Funil por Etapa */}
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
                      <span>{f.count} · {fmt(f.total)}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          f.stage === "perdida" ? "bg-red-400" :
                          f.stage === "venda_concluida" ? "bg-green-500" :
                          "bg-blue-500"
                        }`}
                        style={{ width: `${(f.total / maxFunnelTotal) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Top 5 Oportunidades */}
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
                      <Badge variant="outline" className="text-xs">{STAGE_LABELS[o.stage] || o.stage}</Badge>
                      <span className="font-medium text-blue-700">{fmt(o.weighted)}</span>
                    </div>
                  </div>
                ))}
                {top5Opps.length === 0 && (
                  <p className="text-slate-400 text-xs">Nenhuma oportunidade ativa</p>
                )}
              </CardContent>
            </Card>

            {/* Mini Gráfico Últimos 6 Meses */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" /> Vendas — Últimos 6 Meses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2 h-24">
                  {last6Months.map((m, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-blue-500 rounded-t"
                        style={{ height: `${Math.max(4, (m.total / maxBarValue) * 80)}px` }}
                        title={fmt(m.total)}
                      />
                      <span className="text-xs text-slate-500 capitalize">{m.label}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>0</span>
                  <span>{fmt(maxBarValue)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Aba Por Cliente */}
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

      {/* Aba Curva ABC */}
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
                      {abcData.map((item: any, i: number) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                          <td className="py-2 pr-4">
                            <Badge
                              className={
                                item.class === "A"
                                  ? "bg-green-100 text-green-700"
                                  : item.class === "B"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                              }
                            >
                              {item.class}
                            </Badge>
                          </td>
                          <td className="py-2 pr-4 font-medium">{item.name}</td>
                          <td className="py-2 pr-4 text-right">{fmt(item.revenue ?? 0)}</td>
                          <td className="py-2 pr-4 text-right">{(item.pct ?? 0).toFixed(1)}%</td>
                          <td className="py-2 text-right">{(item.cumPct ?? 0).toFixed(1)}%</td>
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
