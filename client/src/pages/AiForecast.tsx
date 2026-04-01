import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, AlertTriangle, Package, DollarSign, Target, BarChart3, Lightbulb, Users, ShoppingBag, Trophy } from "lucide-react";
import { toast } from "sonner";

const STAGES = ["prospeccao","visita_tecnica","orcamento_enviado","negociacao","venda_concluida","perdida"];
const STAGE_LABELS: Record<string,string> = { prospeccao:"Prospecção", visita_tecnica:"Visita Técnica", orcamento_enviado:"Orçamento Enviado", negociacao:"Negociação", venda_concluida:"Venda Concluída", perdida:"Perdida" };
const STAGE_PROB: Record<string,number> = { prospeccao:10, visita_tecnica:25, orcamento_enviado:45, negociacao:70, venda_concluida:100, perdida:0 };

function fmt(v: number) { return v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
function thisMonth() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function thisMonthLabel() { return new Date().toLocaleDateString("pt-BR",{month:"long",year:"numeric"}); }

function calcForecast(opps: any[]) {
  const weighted = opps.filter(o=>o.stage!=="perdida").reduce((s,o)=>{ const p=o.probability>0?o.probability:(STAGE_PROB[o.stage]??10); return s+parseFloat(o.value||"0")*(p/100); },0);
  const byStage = STAGES.map(id=>({ id, label:STAGE_LABELS[id], count:opps.filter(o=>o.stage===id).length, total:opps.filter(o=>o.stage===id).reduce((s,o)=>s+parseFloat(o.value||"0"),0) }));
  const closed = opps.filter(o=>o.stage==="venda_concluida").length;
  const convRate = opps.length>0?Math.round((closed/opps.length)*100):0;
  return { weighted, byStage, convRate, closed, totalOpps:opps.length };
}

function generateInsights(data: any) {
  const ins: {type:"success"|"warning"|"info"; text:string}[] = [];
  const {opportunities:opps,products:prods,clients,sales} = data;
  const fc = calcForecast(opps);
  if(fc.convRate<20) ins.push({type:"warning",text:`Taxa de conversão baixa (${fc.convRate}%). Foque nas oportunidades em Negociação.`});
  else if(fc.convRate>=40) ins.push({type:"success",text:`Excelente taxa de conversão: ${fc.convRate}%.`});
  const negC=opps.filter((o:any)=>o.stage==="negociacao").length;
  const negV=opps.filter((o:any)=>o.stage==="negociacao").reduce((s:number,o:any)=>s+parseFloat(o.value||"0"),0);
  if(negC>0) ins.push({type:"info",text:`${negC} oportunidade(s) em Negociação totalizando ${fmt(negV)}.`});
  const low=prods.filter((p:any)=>p.stock!==null&&p.stock<10&&p.active);
  if(low.length>0) ins.push({type:"warning",text:`${low.length} produto(s) com estoque crítico: ${low.slice(0,3).map((p:any)=>p.name).join(", ")}.`});
  const orc=opps.filter((o:any)=>o.stage==="orcamento_enviado").length;
  if(orc>3) ins.push({type:"warning",text:`${orc} orçamentos sem resposta. Faça follow-up.`});
  if(sales.length>0){ const l30=sales.filter((s:any)=>(Date.now()-new Date(s.createdAt).getTime())<30*86400000); const t=l30.reduce((s:number,v:any)=>s+parseFloat(v.totalValue||"0"),0); if(t>0) ins.push({type:"success",text:`Vendas nos últimos 30 dias: ${fmt(t)} (${l30.length} transações).`}); }
  return ins;
}

function byClient(opps: any[], clients: any[]) {
  const cm: Record<number,string>={};
  clients.forEach((c:any)=>{ cm[c.id]=c.farmName||c.producerName||`#${c.id}`; });
  const map: Record<number,{name:string;count:number;total:number;weighted:number;stages:string[]}> = {};
  opps.filter(o=>o.stage!=="perdida").forEach((o:any)=>{ if(!map[o.clientId]) map[o.clientId]={name:cm[o.clientId]??`#${o.clientId}`,count:0,total:0,weighted:0,stages:[]}; const p=o.probability>0?o.probability:(STAGE_PROB[o.stage]??10),v=parseFloat(o.value||"0"); map[o.clientId].count++;map[o.clientId].total+=v;map[o.clientId].weighted+=v*(p/100); if(!map[o.clientId].stages.includes(STAGE_LABELS[o.stage]??o.stage)) map[o.clientId].stages.push(STAGE_LABELS[o.stage]??o.stage); });
  return Object.values(map).sort((a,b)=>b.weighted-a.weighted);
}

type Tab = "pipeline"|"clientes"|"produtos"|"historico"|"abc";

export default function AiForecast() {
  const [tab, setTab] = useState<Tab>("pipeline");
  const [goalInput, setGoalInput] = useState("");
  const month = thisMonth();

  const { data, isLoading } = trpc.ai.forecast.useQuery();
  const { data: goalData, refetch: refetchGoal } = trpc.goals.get.useQuery({ month });
  const { data: progress } = trpc.goals.progress.useQuery({ month });
  const { data: abcData = [] } = trpc.goals.abc.useQuery();

  const setGoalMutation = trpc.goals.set.useMutation({
    onSuccess: () => { toast.success("Meta salva!"); refetchGoal(); },
    onError: (e:any) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div></div>;

  const { opportunities:opps=[], products:prods=[], clients=[], sales=[] } = data??{};
  const forecast = calcForecast(opps);
  const insights = generateInsights({ opportunities:opps, products:prods, clients, sales });
  const clientForecast = byClient(opps, clients);

  const goalValue = parseFloat(goalData?.goalValue ?? "0");
  const realized = progress?.realized ?? 0;
  const pipeline = progress?.pipeline ?? 0;
  const projection = progress?.projection ?? 0;
  const goalPct = goalValue > 0 ? Math.min((realized / goalValue) * 100, 100) : 0;
  const goalColor = goalPct >= 80 ? "bg-green-500" : goalPct >= 50 ? "bg-yellow-500" : "bg-red-400";
  const goalTextColor = goalPct >= 80 ? "text-green-600" : goalPct >= 50 ? "text-yellow-600" : "text-red-500";

  const salesByMonth: Record<string,number> = {};
  sales.forEach((s:any)=>{ const m=new Date(s.createdAt).toLocaleDateString("pt-BR",{month:"short",year:"2-digit"}); salesByMonth[m]=(salesByMonth[m]??0)+parseFloat(s.totalValue||"0"); });
  const salesEntries = Object.entries(salesByMonth).slice(-6);

  const abcSummary = { A: (abcData as any[]).filter(r=>r.cls==="A"), B: (abcData as any[]).filter(r=>r.cls==="B"), C: (abcData as any[]).filter(r=>r.cls==="C") };

  const tabs = [
    { id:"pipeline" as Tab, label:"Pipeline", icon:BarChart3 },
    { id:"clientes" as Tab, label:"Por Cliente", icon:Users },
    { id:"produtos" as Tab, label:"Por Produto", icon:ShoppingBag },
    { id:"historico" as Tab, label:"Histórico", icon:DollarSign },
    { id:"abc" as Tab, label:"Curva ABC", icon:Trophy },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Lightbulb className="w-8 h-8 text-yellow-500" />Previsão de Vendas com IA</h1>
        <p className="text-slate-600 mt-1">Pipeline, metas, curva ABC e tendências da carteira</p>
      </div>

      {/* META MENSAL */}
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg"><Target className="w-5 h-5 text-primary" />Meta de {thisMonthLabel()}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder={goalValue > 0 ? goalValue.toString() : "Ex: 80000"}
              value={goalInput}
              onChange={e => setGoalInput(e.target.value)}
              className="max-w-xs"
            />
            <Button onClick={() => { if(!goalInput){ toast.error("Digite um valor"); return; } setGoalMutation.mutate({ month, goalValue: goalInput }); setGoalInput(""); }} disabled={setGoalMutation.isPending}>
              {setGoalMutation.isPending ? "Salvando..." : "Definir Meta"}
            </Button>
          </div>

          {goalValue > 0 ? (
            <div className="space-y-3">
              <div className="flex justify-between text-sm font-medium">
                <span>Realizado: <span className={goalTextColor}>{fmt(realized)}</span></span>
                <span>Meta: {fmt(goalValue)}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-4">
                <div className={`h-4 rounded-full transition-all ${goalColor}`} style={{ width: `${goalPct}%` }}></div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white rounded-lg p-3 border">
                  <p className="text-xs text-slate-500">Realizado</p>
                  <p className={`font-bold ${goalTextColor}`}>{Math.round(goalPct)}%</p>
                  <p className="text-xs text-slate-600">{fmt(realized)}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border">
                  <p className="text-xs text-slate-500">Em negociação</p>
                  <p className="font-bold text-blue-600">+{fmt(pipeline)}</p>
                  <p className="text-xs text-slate-400">pipeline ponderado</p>
                </div>
                <div className="bg-white rounded-lg p-3 border">
                  <p className="text-xs text-slate-500">Projeção do mês</p>
                  <p className={`font-bold ${projection >= goalValue ? "text-green-600" : "text-orange-600"}`}>{fmt(projection)}</p>
                  <p className="text-xs text-slate-400">{projection >= goalValue ? "✅ Meta atingível" : "⚠️ Abaixo da meta"}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Defina sua meta mensal acima para acompanhar o progresso.</p>
          )}
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5"><p className="text-xs text-slate-500 uppercase tracking-wide">Pipeline Ponderado</p><p className="text-2xl font-bold text-blue-600 mt-1">{fmt(forecast.weighted)}</p><p className="text-xs text-slate-400 mt-1">Ajustado pela probabilidade</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-slate-500 uppercase tracking-wide">Oportunidades Ativas</p><p className="text-2xl font-bold mt-1">{forecast.totalOpps - forecast.totalOpps + (opps.filter((o:any)=>o.stage!=="perdida").length)}</p><p className="text-xs text-slate-400 mt-1">Excluindo perdidas</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-slate-500 uppercase tracking-wide">Taxa de Conversão</p><p className={`text-2xl font-bold mt-1 ${forecast.convRate>=30?"text-green-600":"text-orange-600"}`}>{forecast.convRate}%</p><p className="text-xs text-slate-400 mt-1">{forecast.closed} de {forecast.totalOpps}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-slate-500 uppercase tracking-wide">Clientes Classe A</p><p className="text-2xl font-bold text-green-600 mt-1">{abcSummary.A.length}</p><p className="text-xs text-slate-400 mt-1">Top clientes por faturamento</p></CardContent></Card>
      </div>

      {/* Insights */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Lightbulb className="w-5 h-5 text-yellow-500" />Insights & Recomendações</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {insights.length===0 && <p className="text-slate-400 text-sm">Cadastre oportunidades e produtos para gerar insights.</p>}
          {insights.map((ins,i)=>(
            <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${ins.type==="success"?"bg-green-50 border-green-200":ins.type==="warning"?"bg-yellow-50 border-yellow-200":"bg-blue-50 border-blue-200"}`}>
              {ins.type==="success"?<TrendingUp className="w-4 h-4 text-green-600 mt-0.5 shrink-0"/>:ins.type==="warning"?<AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0"/>:<Target className="w-4 h-4 text-blue-600 mt-0.5 shrink-0"/>}
              <p className="text-sm">{ins.text}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t=>(<Button key={t.id} variant={tab===t.id?"default":"outline"} size="sm" className="gap-1.5" onClick={()=>setTab(t.id)}><t.icon className="w-4 h-4"/>{t.label}</Button>))}
      </div>

      {/* PIPELINE */}
      {tab==="pipeline" && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><BarChart3 className="w-5 h-5"/>Funil por Etapa</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {forecast.byStage.filter(s=>s.count>0).length===0 && <p className="text-slate-400 text-sm">Nenhuma oportunidade cadastrada.</p>}
            {forecast.byStage.filter(s=>s.count>0).map(stage=>{
              const prob=STAGE_PROB[stage.id]??10;
              return (
                <div key={stage.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2"><div><p className="font-semibold">{stage.label}</p><p className="text-xs text-slate-500">{stage.count} oportunidade(s) · {fmt(stage.total)}</p></div><Badge variant="outline" className="text-primary border-primary">{prob}%</Badge></div>
                  <div className="w-full bg-slate-100 rounded-full h-3"><div className="bg-primary h-3 rounded-full" style={{width:`${prob}%`}}></div></div>
                  <p className="text-xs text-slate-500 mt-1">Receita estimada: <span className="font-semibold text-slate-700">{fmt(stage.total*(prob/100))}</span></p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* POR CLIENTE */}
      {tab==="clientes" && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Users className="w-5 h-5"/>Previsão por Cliente</CardTitle></CardHeader>
          <CardContent>
            {clientForecast.length===0 && <p className="text-slate-400 text-sm">Nenhuma oportunidade ativa com cliente associado.</p>}
            <div className="space-y-3">
              {clientForecast.map((c,i)=>{
                const max=clientForecast[0]?.weighted??1, pct=max>0?(c.weighted/max)*100:0;
                return (
                  <div key={i} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2"><div className="flex-1 min-w-0"><p className="font-semibold truncate">{c.name}</p><p className="text-xs text-slate-500">{c.count} oportunidade(s) · {c.stages.join(", ")}</p></div><div className="text-right ml-4 shrink-0"><p className="text-sm font-bold text-blue-600">{fmt(c.weighted)}</p><p className="text-xs text-slate-400">Pipeline: {fmt(c.total)}</p></div></div>
                    <div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-blue-500 h-2 rounded-full" style={{width:`${pct}%`}}></div></div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* POR PRODUTO */}
      {tab==="produtos" && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Package className="w-5 h-5"/>Controle de Estoque</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {prods.length===0 && <p className="text-slate-400 text-sm">Nenhum produto cadastrado.</p>}
              {[...prods].sort((a:any,b:any)=>(a.stock??999)-(b.stock??999)).slice(0,10).map((p:any)=>(
                <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border ${p.stock!==null&&p.stock<5?"bg-red-50 border-red-200":p.stock!==null&&p.stock<10?"bg-yellow-50 border-yellow-200":"bg-white border-slate-200"}`}>
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{p.name}</p><p className="text-xs text-slate-400">{p.category??"—"}</p></div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">{p.stock!==null?(<Badge variant={p.stock<5?"destructive":p.stock<10?"secondary":"outline"}>{p.stock} {p.unit??"un"}</Badge>):<Badge variant="outline">Sem controle</Badge>}{p.price&&<span className="text-xs text-slate-500">{fmt(parseFloat(p.price))}</span>}</div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ShoppingBag className="w-5 h-5"/>Vendas por Produto</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {sales.length===0 && <p className="text-slate-400 text-sm">Nenhuma venda registrada ainda.</p>}
              {(() => {
                const map: Record<string,{count:number;total:number}>={};
                sales.forEach((s:any)=>{ const k=s.title||"Venda direta"; if(!map[k]) map[k]={count:0,total:0}; map[k].count++;map[k].total+=parseFloat(s.totalValue||"0"); });
                const arr=Object.entries(map).map(([name,v])=>({name,...v})).sort((a,b)=>b.total-a.total).slice(0,8);
                const max=arr[0]?.total??1;
                return arr.map((p,i)=>(
                  <div key={i}><div className="flex justify-between text-sm mb-1"><span className="font-medium truncate flex-1">{p.name}</span><span className="text-slate-500 shrink-0 ml-2">{p.count}x · {fmt(p.total)}</span></div><div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-green-500 h-2 rounded-full" style={{width:`${(p.total/max)*100}%`}}></div></div></div>
                ));
              })()}
            </CardContent>
          </Card>
        </div>
      )}

      {/* HISTÓRICO */}
      {tab==="historico" && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><DollarSign className="w-5 h-5"/>Histórico — Últimos 6 meses</CardTitle></CardHeader>
          <CardContent>
            {salesEntries.length===0 && <p className="text-slate-400 text-sm">Nenhuma venda registrada ainda.</p>}
            <div className="space-y-3">
              {salesEntries.map(([month,total])=>{ const max=Math.max(...salesEntries.map(([,v])=>v)); const pct=max>0?(total/max)*100:0; return (<div key={month} className="flex items-center gap-3"><span className="text-sm text-slate-600 w-20 shrink-0">{month}</span><div className="flex-1 bg-slate-100 rounded-full h-5 relative"><div className="bg-primary h-5 rounded-full transition-all" style={{width:`${pct}%`}}></div></div><span className="text-sm font-medium w-28 text-right shrink-0">{fmt(total)}</span></div>); })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* CURVA ABC */}
      {tab==="abc" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-green-200 bg-green-50"><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-green-700">{abcSummary.A.length}</p><p className="font-semibold text-green-600">Classe A</p><p className="text-xs text-slate-500 mt-1">80% do faturamento</p><p className="text-xs font-medium text-green-600">{fmt(abcSummary.A.reduce((s,r:any)=>s+r.value,0))}</p></CardContent></Card>
            <Card className="border-yellow-200 bg-yellow-50"><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-yellow-700">{abcSummary.B.length}</p><p className="font-semibold text-yellow-600">Classe B</p><p className="text-xs text-slate-500 mt-1">15% do faturamento</p><p className="text-xs font-medium text-yellow-600">{fmt(abcSummary.B.reduce((s,r:any)=>s+r.value,0))}</p></CardContent></Card>
            <Card className="border-slate-200 bg-slate-50"><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-slate-700">{abcSummary.C.length}</p><p className="font-semibold text-slate-600">Classe C</p><p className="text-xs text-slate-500 mt-1">5% do faturamento</p><p className="text-xs font-medium text-slate-600">{fmt(abcSummary.C.reduce((s,r:any)=>s+r.value,0))}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Trophy className="w-5 h-5 text-yellow-500"/>Ranking de Clientes por Faturamento</CardTitle></CardHeader>
            <CardContent>
              {(abcData as any[]).length===0 && <p className="text-slate-400 text-sm text-center py-6">Nenhuma venda registrada ainda. Registre vendas para gerar a curva ABC.</p>}
              <div className="space-y-2">
                {(abcData as any[]).map((row:any)=>{
                  const max=(abcData as any[])[0]?.value??1;
                  return (
                    <div key={row.clientId} className={`flex items-center gap-3 p-3 rounded-lg border ${row.cls==="A"?"border-green-200 bg-green-50":row.cls==="B"?"border-yellow-200 bg-yellow-50":"border-slate-200 bg-white"}`}>
                      <span className="text-sm font-bold text-slate-400 w-6 shrink-0">#{row.rank}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{row.name}</p>
                        <div className="w-full bg-white/60 rounded-full h-1.5 mt-1"><div className={`h-1.5 rounded-full ${row.cls==="A"?"bg-green-500":row.cls==="B"?"bg-yellow-500":"bg-slate-400"}`} style={{width:`${(row.value/max)*100}%`}}></div></div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">{fmt(row.value)}</p>
                        <p className="text-xs text-slate-400">{row.pct.toFixed(1)}% · acum. {row.accPct.toFixed(1)}%</p>
                      </div>
                      <Badge className={`shrink-0 ${row.cls==="A"?"bg-green-600":row.cls==="B"?"bg-yellow-500":"bg-slate-500"}`}>{row.cls}</Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
