import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, Users, TrendingUp, Package, FileText, BarChart3, Target, UserCog, BookOpen, ChevronRight, Lightbulb, Star, ArrowRight } from "lucide-react";

const MODULES = [
  {
    id: "dashboard", icon: LayoutDashboard, label: "Dashboard", color: "text-blue-600", bg: "bg-blue-50 border-blue-200",
    what: "Visão geral executiva do seu negócio em tempo real. Mostra as principais métricas de um relance.",
    steps: ["Acesse o menu lateral → Dashboard","Veja o Total de Vendas, Oportunidades abertas, Clientes e Ticket Médio","Analise o gráfico de Oportunidades por Etapa — identifique gargalos","Verifique a Distribuição do Funil para saber onde estão suas negociações","Use diariamente pela manhã para priorizar o dia"],
    tip: "Se muitas oportunidades estão paradas em 'Orçamento Enviado', é sinal de que falta follow-up com os clientes.",
    link: "/dashboard",
  },
  {
    id: "clients", icon: Users, label: "Clientes", color: "text-green-600", bg: "bg-green-50 border-green-200",
    what: "Base completa de produtores rurais, revendas, distribuidores e agroindústrias. Com histórico, mapa, score e agenda de visitas.",
    steps: ["Menu lateral → Clientes","Clique em '+ Novo Cliente' para cadastrar","Preencha fazenda, produtor, espécie animal, contatos e localização","Importe uma lista de clientes via Excel (botão 'Importar Excel')","Clique no ícone 👁 em qualquer cliente para ver a timeline completa","Na aba 'Score' veja o potencial do cliente calculado automaticamente","Na aba 'Mapa' veja a localização geográfica da propriedade","Na aba 'Visitas' acompanhe o histórico de visitas técnicas"],
    tip: "Clientes com Score acima de 70 são Classe A — priorize eles nas visitas e promoções.",
    link: "/clients",
  },
  {
    id: "opportunities", icon: TrendingUp, label: "Oportunidades", color: "text-purple-600", bg: "bg-purple-50 border-purple-200",
    what: "Funil Kanban com 6 etapas para acompanhar cada negociação desde a prospecção até o fechamento.",
    steps: ["Menu lateral → Oportunidades","Clique em '+ Nova Oportunidade'","Selecione o cliente e preencha título, valor estimado e probabilidade (%)","A oportunidade aparece na coluna correspondente do funil","Use os botões '◀ ▶' para mover entre etapas conforme a negociação avança","Clique no card para editar detalhes a qualquer momento","Acompanhe o Pipeline Total e Taxa de Conversão nos cards do topo"],
    tip: "Mantenha a probabilidade % atualizada — ela alimenta a Previsão IA e o cálculo de Meta Mensal.",
    link: "/opportunities",
  },
  {
    id: "products", icon: Package, label: "Produtos", color: "text-orange-600", bg: "bg-orange-50 border-orange-200",
    what: "Catálogo completo de rações, suplementos, aditivos e medicamentos com controle de estoque por espécie e fase.",
    steps: ["Menu lateral → Produtos","Clique em '+ Novo Produto'","Preencha nome, categoria, espécie, fase, indicação, preço e estoque","Importe uma lista de produtos via Excel (modelo disponível para download)","Produtos com estoque < 10 aparecem em amarelo na Previsão IA","Produtos com estoque < 5 aparecem em vermelho — reposição urgente","Desative produtos descontinuados pelo toggle Ativo/Inativo"],
    tip: "Cadastre o código do produto (ex: código da fábrica) para evitar duplicatas na importação.",
    link: "/products",
  },
  {
    id: "quotes", icon: FileText, label: "Orçamentos", color: "text-cyan-600", bg: "bg-cyan-50 border-cyan-200",
    what: "Propostas comerciais profissionais vinculadas a clientes com controle de status e validade.",
    steps: ["Menu lateral → Orçamentos","Clique em '+ Novo Orçamento'","Selecione o cliente e defina o número, validade e observações","Mude o status conforme o andamento: Rascunho → Enviado → Aceito/Rejeitado","Orçamentos aceitos devem ser convertidos em Vendas manualmente","Orçamentos expirados aparecem destacados — crie um novo se necessário"],
    tip: "Use o campo 'Notas' para registrar as condições especiais negociadas com o cliente.",
    link: "/quotes",
  },
  {
    id: "forecast", icon: BarChart3, label: "Previsão IA", color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200",
    what: "Análise inteligente do pipeline com previsão de receita, insights automáticos e curva ABC de clientes.",
    steps: ["Menu lateral → Previsão IA","Veja o Pipeline Ponderado — receita esperada com base na probabilidade de cada negócio","Leia os Insights — o sistema detecta automaticamente riscos e oportunidades","Aba 'Pipeline' — previsão detalhada por etapa do funil","Aba 'Por Cliente' — quais clientes têm maior potencial de receita este mês","Aba 'Por Produto' — estoque crítico e ranking de vendas por produto","Aba 'Histórico' — evolução mensal das vendas nos últimos 6 meses","Aba 'Curva ABC' — classifica clientes por faturamento (A=top 80%, B=15%, C=5%)"],
    tip: "Foque 80% do seu tempo nos clientes Classe A — eles geram a maior parte do faturamento.",
    link: "/ai-forecast",
  },
  {
    id: "goals", icon: Target, label: "Meta Mensal", color: "text-red-600", bg: "bg-red-50 border-red-200",
    what: "Defina e acompanhe a meta de vendas do mês com projeção automática de resultado.",
    steps: ["Acesse Menu lateral → Previsão IA","No topo da página, digite o valor da meta (ex: 80000) e clique 'Definir Meta'","Acompanhe a barra de progresso: Verde ≥80% · Amarelo 50-79% · Vermelho <50%","'Realizado' = vendas já fechadas no mês","'Em negociação' = pipeline ponderado de oportunidades abertas","'Projeção' = estimativa de fechamento com base no ritmo atual","Atualize as oportunidades regularmente para manter a projeção precisa"],
    tip: "A meta é individual por empresa. Cada empresa que usa o NutriCRM define e acompanha sua própria meta.",
    link: "/ai-forecast",
  },
  {
    id: "users", icon: UserCog, label: "Usuários", color: "text-slate-600", bg: "bg-slate-50 border-slate-200",
    what: "Gerencie representantes e controle quais clientes cada um pode visualizar e editar.",
    steps: ["Menu lateral → Usuários","Clique em '+ Novo Representante'","Preencha nome, email e senha do representante","Clique 'Criar Usuário' — o representante receberá acesso imediato","Na lista de Clientes, use o dropdown 'Atribuir a:' para vincular clientes","O representante loga com o email/senha criados e vê apenas seus clientes","O Admin vê todos os clientes da empresa","Convide por email: botão 'Convidar por Email' na tela de Usuários"],
    tip: "O Admin sempre vê tudo. Representantes só veem os clientes atribuídos a eles — segurança total da carteira.",
    link: "/users",
  },
];

export default function Tutorial() {
  const [active, setActive] = useState("dashboard");
  const [, navigate] = useLocation();
  const mod = MODULES.find(m => m.id === active)!;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><BookOpen className="w-8 h-8 text-primary" />Tutorial do NutriCRM</h1>
        <p className="text-slate-600 mt-1">Aprenda a usar cada funcionalidade do sistema</p>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        {/* Menu de módulos */}
        <div className="space-y-2">
          {MODULES.map(m => (
            <button
              key={m.id}
              onClick={() => setActive(m.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${active === m.id ? `${m.bg} border-current font-semibold` : "bg-white border-slate-200 hover:bg-slate-50"}`}
            >
              <m.icon className={`w-5 h-5 shrink-0 ${active === m.id ? m.color : "text-slate-400"}`} />
              <span className={`text-sm ${active === m.id ? m.color : "text-slate-700"}`}>{m.label}</span>
              {active === m.id && <ChevronRight className={`w-4 h-4 ml-auto ${m.color}`} />}
            </button>
          ))}
        </div>

        {/* Conteúdo do módulo */}
        <div className="md:col-span-3 space-y-4">
          <Card className={`border-2 ${mod.bg}`}>
            <CardHeader className="pb-3">
              <CardTitle className={`flex items-center gap-3 text-xl ${mod.color}`}>
                <mod.icon className="w-6 h-6" />
                {mod.label}
                <Badge variant="outline" className={`ml-auto ${mod.color} border-current`}>Módulo</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">{mod.what}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><span className="text-lg">📋</span> Passo a Passo</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {mod.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5 ${mod.color.replace("text-","bg-")}`}>{i+1}</span>
                    <p className="text-sm text-slate-700">{step}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-yellow-800 text-sm mb-1">Dica Profissional</p>
                  <p className="text-sm text-yellow-700">{mod.tip}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button onClick={() => navigate(mod.link)} className={`gap-2 w-full`}>
            <ArrowRight className="w-4 h-4" />
            Ir para {mod.label}
          </Button>

          {/* Navegação entre módulos */}
          <div className="flex justify-between pt-2">
            <Button variant="ghost" size="sm" onClick={() => { const i=MODULES.findIndex(m=>m.id===active); if(i>0) setActive(MODULES[i-1].id); }} disabled={MODULES.findIndex(m=>m.id===active)===0}>
              ← Anterior
            </Button>
            <span className="text-xs text-slate-400 self-center">{MODULES.findIndex(m=>m.id===active)+1} de {MODULES.length}</span>
            <Button variant="ghost" size="sm" onClick={() => { const i=MODULES.findIndex(m=>m.id===active); if(i<MODULES.length-1) setActive(MODULES[i+1].id); }} disabled={MODULES.findIndex(m=>m.id===active)===MODULES.length-1}>
              Próximo →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
