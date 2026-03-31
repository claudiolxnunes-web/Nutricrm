import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, AlertTriangle, Package, DollarSign, Target, BarChart3, Lightbulb, Users, ShoppingBag } from "lucide-react";

const STAGES = ["prospeccao", "visita_tecnica", "orcamento_enviado", "negociacao", "venda_concluida", "perdida"];
const STAGE_LABELS: Record<string, string> = {
  prospeccao: "Prospecção", visita_tecnica: "Visita Técnica", orcamento_enviado: "Orçamento Enviado",
  negociacao: "Negociação", venda_concluida: "Venda Concluída", perdida: "Perdida",
};
const STAGE_PROB: Record<string, number> = {
  prospeccao: 10, visita_tecnica: 25, orcamento_enviado: 45, negociacao: 70, venda_concluida: 100, perdida: 0,
};

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function calcForecast(opps: any[]) {
  const weighted = opps.filter(o => o.stage !== "perdida").reduce((s, o) => {
    const prob = o.probability > 0 ? o.probability : (STAGE_PROB[o.stage] ?? 10);
    return s + parseFloat(o.value || "0") * (prob / 100);
  }, 0);
  const byStage = STAGES.map(id => ({
    id, label: STAGE_LABELS[id],
    count: opps.filter(o => o.stage === id).length,
    total: opps.filter(o => o.stage === id).reduce((s, o) => s + parseFloat(o.value || "0"), 0),
  }));
  const active = opps.filter(o => o.stage !== "perdida").length;
  const closed = opps.filter(o => o.stage === "venda_concluida").length;
  const lost = opps.filter(o => o.stage === "perdida").length;
  const convRate = opps.length > 0 ? Math.round((closed / opps.length) * 100) : 0;
  const lostRate = opps.length > 0 ? Math.round((lost / opps.length) * 100) : 0;
  return { weighted, byStage, convRate, lostRate, active, closed, lost, totalOpps: opps.length };
}

function generateInsights(data: any) {
  const insights: { type: "success" | "warning" | "info"; text: string }[] = [];
  const { opportunities: opps, products: prods, clients, sales } = data;
  const forecast = calcForecast(opps);
  if (forecast.convRate < 20)
    insights.push({ type: "warning", text: `Taxa de conversão baixa (${forecast.convRate}%). Foque nas oportunidades em Negociação.` });
  else if (forecast.convRate >= 40)
    insights.push({ type: "success", text: `Excelente taxa de conversão: ${forecast.convRate}%. Continue o padrão de abordagem.` });
  const negCount = opps.filter((o: any) => o.stage === "negociacao").length;
  const negValue = opps.filter((o: any) => o.stage === "negociacao").reduce((s: number, o: any) => s + parseFloat(o.value || "0"), 0);
  if (negCount > 0)
    insights.push({ type: "info", text: `${negCount} oportunidade(s) em Negociação totalizando ${fmt(negValue)}. Alta prioridade.` });
  const lowStock = prods.filter((p: any) => p.stock !== null && p.stock < 10 && p.active);
  if (lowStock.length > 0)
    insights.push({ type: "warning", text: `${lowStock.length} produto(s) com estoque crítico: ${lowStock.slice(0, 3).map((p: any) => p.name).join(", ")}.` });
  const inactiveClients = clients.filter((c: any) => c.status === "inativo").length;
  if (inactiveClients > 0)
    insights.push({ type: "info", text: `${inactiveClients} cliente(s) inativos de ${clients.length}. Considere campanha de reativação.` });
  const orcCount = opps.filter((o: any) => o.stage === "orcamento_enviado").length;
  if (orcCount > 3)
    insights.push({ type: "warning", text: `${orcCount} orçamentos sem resposta. Faça follow-up para acelerar o fechamento.` });
  if (sales.length > 0) {
    const last30 = sales.filter((s: any) => (Date.now() - new Date(s.createdAt).getTime()) < 30 * 86400000);
    const totalLast30 = last30.reduce((s: number, v: any) => s + parseFloat(v.totalValue || "0"), 0);
    if (totalLast30 > 0)
      insights.push({ type: "success", text: `Vendas nos últimos 30 dias: ${fmt(totalLast30)} (${last30.length} transações).` });
  }
  return insights;
}

// Agrupa oportunidades por cliente
function byClient(opps: any[], clients: any[]) {
  const clientMap: Record<number, string> = {};
  clients.forEach((c: any) => { clientMap[c.id] = c.farmName || c.producerName || `Cliente #${c.id}`; });
  const map: Record<number, { name: string; count: number; total: number; weighted: number; stages: string[] }> = {};
  opps.filter(o => o.stage !== "perdida").forEach((o: any) => {
    if (!map[o.clientId]) map[o.clientId] = { name: clientMap[o.clientId] ?? `#${o.clientId}`, count: 0, total: 0, weighted: 0, stages: [] };
    const prob = o.probability > 0 ? o.probability : (STAGE_PROB[o.stage] ?? 10);
    const val = parseFloat(o.value || "0");
    map[o.clientId].count++;
    map[o.clientId].total += val;
    map[o.clientId].weighted += val * (prob / 100);
    if (!map[o.clientId].stages.includes(STAGE_LABELS[o.stage] ?? o.stage)) map[o.clientId].stages.push(STAGE_LABELS[o.stage] ?? o.stage);
  });
  return Object.values(map).sort((a, b) => b.weighted - a.weighted);
}

// Agrupa vendas por produto (usando quoteItems via sales title heuristic — usa produto direto se disponível)
function byProduct(sales: any[], prods: any[]) {
  const prodMap: Record<number, string> = {};
  prods.forEach((p: any) => { prodMap[p.id] = p.name; });
  const map: Record<string, { name: string; count: number; total: number }> = {};
  sales.forEach((s: any) => {
    const key = s.productId ? (prodMap[s.productId] ?? `Produto #${s.productId}`) : (s.title || "Venda direta");
    if (!map[key]) map[key] = { name: key, count: 0, total: 0 };
    map[key].count++;
    map[key].total += parseFloat(s.totalValue || s.value || "0");
  });
  return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
}

type Tab = "pipeline" | "clientes" | "produtos" | "historico";

export default function AiForecast() {
  const [tab, setTab] = useState<Tab>("pipeline");
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

  // Por produto — estoque
  const prodsSorted = [...prods].sort((a: any, b: any) => {
    const aLow = a.stock !== null && a.stock < 10 ? 0 : 1;
    const bLow = b.stock !== null && b.stock < 10 ? 0 : 1;
    return aLow - bLow || (a.name ?? "").localeCompare(b.name ?? "");
  });

  // Por cliente — pipeline
  const clientForecast = byClient(opps, clients);

  // Por produto nas vendas
  const salesByProduct = byProduct(sales, prods);

  // Histórico mensal
  const salesByMonth: Record<string, number> = {};
  sales.forEach((s: any) => {
    const m = new Date(s.createdAt).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    salesByMonth[m] = (salesByMonth[m] ?? 0) + parseFloat(s.totalValue || "0");
  });
  const salesEntries = Object.entries(salesByMonth).slice(-6);

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "pipeline", label: "Pipeline", icon: BarChart3 },
    { id: "clientes", label: "Por Cliente", icon: Users },
    { id: "produtos", label: "Por Produto", icon: ShoppingBag },
    { id: "historico", label: "Histórico", icon: DollarSign },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Lightbulb className="w-8 h-8 text-yellow-500" />
          Previsão de Vendas com IA
        </h1>
        <p className="text-slate-600 mt-1">Análise do pipeline, estoque, clientes e produtos</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Pipeline Ponderado</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{fmt(forecast.weighted)}</p>
          <p className="text-xs text-slate-400 mt-1">Ajustado pela probabilidade</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Oportunidades Ativas</p>
          <p className="text-2xl font-bold mt-1">{forecast.active}</p>
          <p className="text-xs text-slate-400 mt-1">Excluindo perdidas</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Taxa de Conversão</p>
          <p className={`text-2xl font-bold mt-1 ${forecast.convRate >= 30 ? "text-green-600" : "text-orange-600"}`}>{forecast.convRate}%</p>
          <p className="text-xs text-slate-400 mt-1">{forecast.closed} de {forecast.totalOpps}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Clientes com Pipeline</p>
          <p className="text-2xl font-bold mt-1">{clientForecast.length}</p>
          <p className="text-xs text-slate-400 mt-1">Com oportunidades ativas</p>
        </CardContent></Card>
      </div>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="w-5 h-5 text-yellow-500" /> Insights & Recomendações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.length === 0 && <p className="text-slate-400 text-sm">Cadastre oportunidades e produtos para gerar insights.</p>}
          {insights.map((ins, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${ins.type === "success" ? "bg-green-50 border-green-200" : ins.type === "warning" ? "bg-yellow-50 border-yellow-200" : "bg-blue-50 border-blue-200"}`}>
              {ins.type === "success" ? <TrendingUp className="w-4 h-4 text-green-600 mt-0.5 shrink-0" /> : ins.type === "warning" ? <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" /> : <Target className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />}
              <p className="text-sm">{ins.text}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <Button key={t.id} variant={tab === t.id ? "default" : "outline"} size="sm" className="gap-2" onClick={() => setTab(t.id)}>
            <t.icon className="w-4 h-4" /> {t.label}
          </Button>
        ))}
      </div>

      {/* Tab: Pipeline por etapa */}
      {tab === "pipeline" && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><BarChart3 className="w-5 h-5" /> Funil de Vendas — Previsão por Etapa</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {forecast.byStage.filter(s => s.count > 0).length === 0 && <p className="text-slate-400 text-sm">Nenhuma oportunidade cadastrada.</p>}
            {forecast.byStage.filter(s => s.count > 0).map(stage => {
              const prob = STAGE_PROB[stage.id] ?? 10;
              const weighted = stage.total * (prob / 100);
              return (
                <div key={stage.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold">{stage.label}</p>
                      <p className="text-xs text-slate-500">{stage.count} oportunidade(s) · Pipeline: {fmt(stage.total)}</p>
                    </div>
                    <Badge variant="outline" className="text-primary border-primary">{prob}% prob.</Badge>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3">
                    <div className="bg-primary h-3 rounded-full" style={{ width: `${prob}%` }}></div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Receita estimada: <span className="font-semibold text-slate-700">{fmt(weighted)}</span></p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Tab: Por Cliente */}
      {tab === "clientes" && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Users className="w-5 h-5" /> Previsão por Cliente</CardTitle></CardHeader>
          <CardContent>
            {clientForecast.length === 0 && <p className="text-slate-400 text-sm">Nenhuma oportunidade ativa com cliente associado.</p>}
            <div className="space-y-3">
              {clientForecast.map((c, i) => {
                const max = clientForecast[0]?.weighted ?? 1;
                const pct = max > 0 ? (c.weighted / max) * 100 : 0;
                return (
                  <div key={i} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{c.name}</p>
                        <p className="text-xs text-slate-500">{c.count} oportunidade(s) · {c.stages.join(", ")}</p>
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        <p className="text-sm font-bold text-blue-600">{fmt(c.weighted)}</p>
                        <p className="text-xs text-slate-400">Pipeline: {fmt(c.total)}</p>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab: Por Produto */}
      {tab === "produtos" && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Estoque */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Package className="w-5 h-5" /> Controle de Estoque</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {prodsSorted.length === 0 && <p className="text-slate-400 text-sm">Nenhum produto cadastrado.</p>}
              {prodsSorted.map((p: any) => (
                <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border ${p.stock !== null && p.stock < 5 ? "bg-red-50 border-red-200" : p.stock !== null && p.stock < 10 ? "bg-yellow-50 border-yellow-200" : "bg-white border-slate-200"}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.category ?? "—"} {p.species ? `· ${p.species}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    {p.stock !== null ? (
                      <Badge variant={p.stock < 5 ? "destructive" : p.stock < 10 ? "secondary" : "outline"}>
                        {p.stock} {p.unit ?? "un"}
                      </Badge>
                    ) : <Badge variant="outline">Sem controle</Badge>}
                    {p.price && <span className="text-xs text-slate-500 w-20 text-right">{fmt(parseFloat(p.price))}</span>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Vendas por produto */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ShoppingBag className="w-5 h-5" /> Vendas por Produto</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {salesByProduct.length === 0 && <p className="text-slate-400 text-sm">Nenhuma venda registrada ainda.</p>}
              {salesByProduct.map((p, i) => {
                const max = salesByProduct[0]?.total ?? 1;
                const pct = max > 0 ? (p.total / max) * 100 : 0;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium truncate flex-1">{p.name}</span>
                      <span className="text-slate-500 shrink-0 ml-2">{p.count}x · {fmt(p.total)}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Histórico mensal */}
      {tab === "historico" && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><DollarSign className="w-5 h-5" /> Histórico de Vendas — Últimos 6 meses</CardTitle></CardHeader>
          <CardContent>
            {salesEntries.length === 0 && <p className="text-slate-400 text-sm">Nenhuma venda registrada ainda.</p>}
            <div className="space-y-3">
              {salesEntries.map(([month, total]) => {
                const max = Math.max(...salesEntries.map(([, v]) => v));
                const pct = max > 0 ? (total / max) * 100 : 0;
                return (
                  <div key={month} className="flex items-center gap-3">
                    <span className="text-sm text-slate-600 w-20 shrink-0">{month}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-5 relative">
                      <div className="bg-primary h-5 rounded-full transition-all" style={{ width: `${pct}%` }}></div>
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
