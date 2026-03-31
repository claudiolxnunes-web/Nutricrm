import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertTriangle, Package, DollarSign, Target, BarChart3, Lightbulb } from "lucide-react";

const STAGES = ["prospeccao", "visita_tecnica", "orcamento_enviado", "negociacao", "venda_concluida", "perdida"];
const STAGE_LABELS: Record<string, string> = {
  prospeccao: "Prospecção",
  visita_tecnica: "Visita Técnica",
  orcamento_enviado: "Orçamento Enviado",
  negociacao: "Negociação",
  venda_concluida: "Venda Concluída",
  perdida: "Perdida",
};
const STAGE_PROB: Record<string, number> = {
  prospeccao: 10, visita_tecnica: 25, orcamento_enviado: 45, negociacao: 70, venda_concluida: 100, perdida: 0,
};

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function calcForecast(opps: any[]) {
  // Pipeline ponderado: soma(valor * prob_etapa / 100)
  const weighted = opps.filter(o => o.stage !== "perdida").reduce((s, o) => {
    const prob = o.probability > 0 ? o.probability : (STAGE_PROB[o.stage] ?? 10);
    return s + parseFloat(o.value || "0") * (prob / 100);
  }, 0);

  // Por etapa
  const byStage = STAGES.map(id => ({
    id, label: STAGE_LABELS[id],
    count: opps.filter(o => o.stage === id).length,
    total: opps.filter(o => o.stage === id).reduce((s, o) => s + parseFloat(o.value || "0"), 0),
  }));

  // Taxa de conversao
  const active = opps.filter(o => o.stage !== "perdida").length;
  const closed = opps.filter(o => o.stage === "venda_concluida").length;
  const lost = opps.filter(o => o.stage === "perdida").length;
  const convRate = opps.length > 0 ? Math.round((closed / opps.length) * 100) : 0;
  const lostRate = opps.length > 0 ? Math.round((lost / opps.length) * 100) : 0;

  // Estoque baixo (produtos com stock < 10)
  return { weighted, byStage, convRate, lostRate, active, closed, lost, totalOpps: opps.length };
}

function generateInsights(data: any) {
  const insights: { type: "success" | "warning" | "info"; text: string }[] = [];
  const { opportunities: opps, products: prods, clients, sales } = data;

  const forecast = calcForecast(opps);

  if (forecast.convRate < 20) {
    insights.push({ type: "warning", text: `Taxa de conversão baixa (${forecast.convRate}%). Foque nas oportunidades em Negociação para melhorar o fechamento.` });
  } else if (forecast.convRate >= 40) {
    insights.push({ type: "success", text: `Excelente taxa de conversão: ${forecast.convRate}%. Continue o padrão de abordagem.` });
  }

  const negCount = opps.filter((o: any) => o.stage === "negociacao").length;
  const negValue = opps.filter((o: any) => o.stage === "negociacao").reduce((s: number, o: any) => s + parseFloat(o.value || "0"), 0);
  if (negCount > 0) {
    insights.push({ type: "info", text: `${negCount} oportunidade(s) em Negociação totalizando ${fmt(negValue)}. Alta prioridade de acompanhamento.` });
  }

  const lowStock = prods.filter((p: any) => p.stock !== null && p.stock < 10 && p.active);
  if (lowStock.length > 0) {
    insights.push({ type: "warning", text: `${lowStock.length} produto(s) com estoque crítico (< 10 unidades): ${lowStock.slice(0, 3).map((p: any) => p.name).join(", ")}.` });
  }

  const inactiveClients = clients.filter((c: any) => c.status === "inativo").length;
  if (inactiveClients > 0 && clients.length > 0) {
    insights.push({ type: "info", text: `${inactiveClients} cliente(s) inativos de ${clients.length} total. Considere campanha de reativação.` });
  }

  const orcCount = opps.filter((o: any) => o.stage === "orcamento_enviado").length;
  if (orcCount > 3) {
    insights.push({ type: "warning", text: `${orcCount} orçamentos aguardando resposta. Faça follow-up para acelerar o fechamento.` });
  }

  if (sales.length > 0) {
    const last30 = sales.filter((s: any) => {
      const d = new Date(s.createdAt);
      return (Date.now() - d.getTime()) < 30 * 24 * 3600 * 1000;
    });
    const totalLast30 = last30.reduce((s: number, v: any) => s + parseFloat(v.totalValue || "0"), 0);
    if (totalLast30 > 0) {
      insights.push({ type: "success", text: `Vendas nos últimos 30 dias: ${fmt(totalLast30)} (${last30.length} transações).` });
    }
  }

  return insights;
}

export default function AiForecast() {
  const { data, isLoading } = trpc.ai.forecast.useQuery();

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  const { opportunities: opps = [], products: prods = [], clients = [], sales = [] } = data ?? {};
  const forecast = calcForecast(opps);
  const insights = generateInsights({ opportunities: opps, products: prods, clients, sales });

  const topProducts = [...prods]
    .sort((a: any, b: any) => (b.stock ?? 0) - (a.stock ?? 0))
    .slice(0, 5);

  const salesByMonth: Record<string, number> = {};
  sales.forEach((s: any) => {
    const m = new Date(s.createdAt).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    salesByMonth[m] = (salesByMonth[m] ?? 0) + parseFloat(s.totalValue || "0");
  });
  const salesEntries = Object.entries(salesByMonth).slice(-6);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Lightbulb className="w-8 h-8 text-yellow-500" />
          Previsão de Vendas com IA
        </h1>
        <p className="text-slate-600 mt-1">Análise inteligente do pipeline, estoque e tendências da carteira</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Pipeline Ponderado</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{fmt(forecast.weighted)}</p>
            <p className="text-xs text-slate-400 mt-1">Valor ajustado pela probabilidade</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Oportunidades Ativas</p>
            <p className="text-2xl font-bold mt-1">{forecast.active}</p>
            <p className="text-xs text-slate-400 mt-1">Excluindo perdidas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Taxa de Conversão</p>
            <p className={`text-2xl font-bold mt-1 ${forecast.convRate >= 30 ? "text-green-600" : "text-orange-600"}`}>
              {forecast.convRate}%
            </p>
            <p className="text-xs text-slate-400 mt-1">{forecast.closed} de {forecast.totalOpps} oportunidades</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Produtos no Catálogo</p>
            <p className="text-2xl font-bold mt-1">{prods.filter((p: any) => p.active).length}</p>
            <p className="text-xs text-slate-400 mt-1">{prods.filter((p: any) => p.stock !== null && p.stock < 10).length} com estoque crítico</p>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            Insights & Recomendações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.length === 0 && (
            <p className="text-slate-400 text-sm">Dados insuficientes para gerar insights. Cadastre oportunidades e produtos.</p>
          )}
          {insights.map((ins, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${ins.type === "success" ? "bg-green-50 border border-green-200" : ins.type === "warning" ? "bg-yellow-50 border border-yellow-200" : "bg-blue-50 border border-blue-200"}`}>
              {ins.type === "success" ? <TrendingUp className="w-4 h-4 text-green-600 mt-0.5 shrink-0" /> : ins.type === "warning" ? <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" /> : <Target className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />}
              <p className="text-sm">{ins.text}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Pipeline por etapa */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="w-5 h-5" />
              Funil de Vendas — Previsão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {forecast.byStage.filter(s => s.count > 0).map(stage => {
              const prob = STAGE_PROB[stage.id] ?? 10;
              const weighted = stage.total * (prob / 100);
              return (
                <div key={stage.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{stage.label}</span>
                    <span className="text-slate-500">{stage.count} opp · {fmt(stage.total)}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: `${prob}%` }}></div>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Receita estimada: {fmt(weighted)} ({prob}%)</p>
                </div>
              );
            })}
            {forecast.byStage.every(s => s.count === 0) && (
              <p className="text-slate-400 text-sm">Nenhuma oportunidade cadastrada.</p>
            )}
          </CardContent>
        </Card>

        {/* Estoque de produtos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="w-5 h-5" />
              Controle de Estoque
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topProducts.length === 0 && <p className="text-slate-400 text-sm">Nenhum produto cadastrado.</p>}
            {topProducts.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.category ?? "—"}</p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  {p.stock !== null ? (
                    <Badge variant={p.stock < 5 ? "destructive" : p.stock < 10 ? "secondary" : "outline"}>
                      {p.stock} {p.unit ?? "un"}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Sem controle</Badge>
                  )}
                  {p.price && <span className="text-xs text-slate-500">{fmt(parseFloat(p.price))}</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Histórico de vendas */}
      {salesEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="w-5 h-5" />
              Histórico de Vendas — Últimos 6 meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {salesEntries.map(([month, total]) => {
                const max = Math.max(...salesEntries.map(([, v]) => v));
                const pct = max > 0 ? (total / max) * 100 : 0;
                return (
                  <div key={month} className="flex items-center gap-3">
                    <span className="text-sm text-slate-600 w-20 shrink-0">{month}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-4 relative">
                      <div className="bg-primary h-4 rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                    </div>
                    <span className="text-sm font-medium w-28 text-right shrink-0">{fmt(total)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
