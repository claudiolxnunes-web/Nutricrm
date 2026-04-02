import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard, Users, TrendingUp, Package, FileText, BarChart3,
  BrainCircuit, MessageSquare, CalendarDays, Shield, DollarSign,
  ChevronDown, ChevronUp, Star, Lightbulb, Target, BookOpen,
} from "lucide-react";

const MODULES = [
  {
    icon: LayoutDashboard,
    color: "bg-blue-500",
    title: "Dashboard",
    badge: "Visão Geral",
    badgeColor: "bg-blue-100 text-blue-700",
    steps: [
      "Acesse o Dashboard para ver um resumo executivo em tempo real.",
      "Use os campos 'De' e 'Até' no topo para filtrar o período — total de vendas e ticket médio atualizam automaticamente.",
      "O Ticket Médio é calculado sobre as vendas realmente concluídas, não sobre o número de oportunidades.",
      "Os gráficos mostram oportunidades por etapa do funil (barras) e distribuição percentual (pizza).",
      "A tabela 'Resumo do Funil' exibe contagem e valor por etapa com bolinhas coloridas.",
    ],
    tip: "Monitore o Dashboard toda manhã para priorizar as ações do dia.",
  },
  {
    icon: Users,
    color: "bg-emerald-500",
    title: "Clientes",
    badge: "Base de Dados",
    badgeColor: "bg-emerald-100 text-emerald-700",
    steps: [
      "Cadastre fazendas, revendas, distribuidores, agroindústrias e fábricas de rações.",
      "Preencha o tipo de atividade (aves de corte, suinocultura, gado de leite, etc.) e o regime (extensivo, semi-intensivo, intensivo).",
      "Use o campo Score (0–100) para classificar o potencial do cliente: verde ≥70, amarelo ≥40, vermelho <40.",
      "Importe clientes em massa via Excel — o sistema detecta duplicatas automaticamente pelo nome.",
      "Clique em um cliente para abrir a Visão 360°: próxima visita, última interação, barra de progresso do Ciclo de Atendimento.",
      "A aba Mapa exibe a localização da fazenda via OpenStreetMap.",
      "Pesquise por nome de fazenda ou produtor na barra de busca — suporta mais de 800 clientes com paginação.",
    ],
    tip: "Mantenha o Score atualizado para priorizar visitas aos clientes de maior potencial.",
  },
  {
    icon: TrendingUp,
    color: "bg-purple-500",
    title: "Oportunidades (Funil Kanban)",
    badge: "Pipeline",
    badgeColor: "bg-purple-100 text-purple-700",
    steps: [
      "O funil tem 6 etapas: Prospecção → Visita Técnica → Orçamento Enviado → Negociação → Venda Concluída → Perdida.",
      "NOVO: Arraste os cards entre colunas usando drag-and-drop — o estágio atualiza automaticamente.",
      "Use os botões ←/→ em cada card para mover etapas pelo celular.",
      "Ao criar uma oportunidade, busque o cliente pelo nome no campo de autocomplete.",
      "Preencha a Data Esperada de Fechamento para aparecer no card e acompanhar prazos.",
      "Vincule um orçamento aceito à oportunidade para rastrear a proposta comercial.",
      "Os KPIs no topo mostram: total do funil, valor do pipeline, vendas concluídas e taxa de conversão.",
    ],
    tip: "Mova oportunidades de etapa toda vez que houver um avanço na negociação.",
  },
  {
    icon: Package,
    color: "bg-amber-500",
    title: "Produtos",
    badge: "Catálogo",
    badgeColor: "bg-amber-100 text-amber-700",
    steps: [
      "Cadastre produtos com código, categoria, embalagem (saco/granel) e peso do saco.",
      "Selecione a Espécie Animal no dropdown: Aves de Corte, Suínos, Bovinos de Corte, Bovinos de Leite, Equinos, Cães, Gatos, Peixes e mais.",
      "Preencha a Fase (ex: Inicial, Crescimento, Acabamento) e a Indicação de uso.",
      "O campo Modo de Usar orienta o vendedor na apresentação ao cliente (ex: comedouros à vontade, 3 kg/dia).",
      "Importe o catálogo completo via Excel usando o modelo disponível.",
      "Ative ou desative produtos sem precisar excluí-los.",
    ],
    tip: "Produtos bem descritos facilitam a criação de orçamentos e a argumentação do vendedor.",
  },
  {
    icon: FileText,
    color: "bg-cyan-500",
    title: "Orçamentos",
    badge: "Propostas",
    badgeColor: "bg-cyan-100 text-cyan-700",
    steps: [
      "Crie orçamentos vinculados a um cliente específico com número único.",
      "NOVO: Edite orçamentos existentes — clique no ícone de lápis para alterar validade, desconto e notas.",
      "Controle o status: Rascunho → Enviado → Aceito → Rejeitado → Expirado.",
      "Exporte o orçamento como PDF usando o botão de impressão.",
      "Vincule o orçamento aceito a uma oportunidade no funil para fechar o ciclo comercial.",
    ],
    tip: "Mude o status para 'Aceito' assim que o cliente confirmar — isso alimenta o Dashboard corretamente.",
  },
  {
    icon: DollarSign,
    color: "bg-green-500",
    title: "Vendas",
    badge: "Novo",
    badgeColor: "bg-green-100 text-green-700",
    steps: [
      "Registre vendas realizadas com cliente (autocomplete), valor, data e status de pagamento.",
      "Status disponíveis: Pendente, Parcial e Pago.",
      "Vincule a venda a um orçamento aceito para rastrear a origem.",
      "Filtre por período (De/Até) para ver o faturamento de qualquer intervalo.",
      "Os KPIs mostram total no período, número de vendas pagas e pendentes.",
      "Os dados de vendas alimentam o Ticket Médio e o Total de Vendas do Dashboard.",
    ],
    tip: "Registre a venda no mesmo dia do fechamento para manter os relatórios precisos.",
  },
  {
    icon: BarChart3,
    color: "bg-rose-500",
    title: "Relatórios",
    badge: "Análise",
    badgeColor: "bg-rose-100 text-rose-700",
    steps: [
      "Filtre por período e visualize métricas de vendas: total, ticket médio e evolução.",
      "A tabela exibe nome do cliente (não apenas ID) em cada linha.",
      "Gráfico de evolução mostra tendência das vendas ao longo do período.",
      "Gráfico de status de pagamento mostra proporção entre pagas, parciais e pendentes.",
      "Exporte todos os dados em CSV — o arquivo inclui nome do cliente e está pronto para abrir no Excel.",
    ],
    tip: "Use os relatórios mensalmente para identificar sazonalidade e ajustar metas.",
  },
  {
    icon: MessageSquare,
    color: "bg-indigo-500",
    title: "Interações",
    badge: "Relacionamento",
    badgeColor: "bg-indigo-100 text-indigo-700",
    steps: [
      "NOVO: Crie interações diretamente nesta tela — clique em 'Nova Interação' no topo.",
      "Registre: Visita, Ligação, E-mail, Reunião ou Nota.",
      "NOVO: Selecione a Etapa do Ciclo de Atendimento: 📋 Planejamento → 🤝 Conexão → 🔍 Id. Necessidades → 💡 Soluções → ✅ Fechamento → 🔄 Pós Venda.",
      "A etapa aparece como badge colorido em cada card da lista.",
      "Use o campo 'Próxima Visita' para agendar o retorno — aparece no Calendário automaticamente.",
      "Filtre por tipo de interação e resultado (Positivo, Neutro, Negativo, Sem resposta).",
      "Paginação automática de 20 itens por página para listas grandes.",
    ],
    tip: "Sempre registre o resultado após uma visita — isso alimenta a Visão 360° do cliente.",
  },
  {
    icon: CalendarDays,
    color: "bg-teal-500",
    title: "Planejamento",
    badge: "Calendário",
    badgeColor: "bg-teal-100 text-teal-700",
    steps: [
      "NOVO: Alterne entre visão Mensal e Semanal com os botões no topo.",
      "Na visão semanal, veja as 7 colunas da semana com navegação −7/+7 dias.",
      "Clique em qualquer dia do calendário para ver as visitas do dia ou agendar nova.",
      "NOVO: Ao clicar em um dia, a data de visita é pré-preenchida automaticamente no formulário.",
      "NOVO: Preencha o Plano de Visita completo com 8 campos da metodologia SPIN antes de ir ao campo.",
      "Campos do Plano: Objetivo, Fatos a Descobrir, Possíveis Insatisfações, Consequências, Perguntas de Insatisfação, Perguntas de Consequências, Necessidades Potenciais e Perguntas de Valor.",
      "Visitas atrasadas aparecem em vermelho na seção inferior do calendário.",
    ],
    tip: "Preencha o Plano de Visita antes de sair — vendedores preparados convertem mais.",
  },
  {
    icon: BrainCircuit,
    color: "bg-violet-500",
    title: "Previsão IA",
    badge: "Inteligência",
    badgeColor: "bg-violet-100 text-violet-700",
    steps: [
      "A IA analisa o histórico de oportunidades e interações para prever vendas futuras.",
      "Visualize a previsão por produto e por cliente.",
      "A curva ABC classifica clientes por volume de compras: A (top 20%), B (30%), C (50%).",
      "Use as previsões para definir metas mensais realistas por representante.",
    ],
    tip: "Quanto mais dados registrados (interações + vendas), mais precisa a previsão.",
  },
  {
    icon: Shield,
    color: "bg-slate-500",
    title: "Usuários",
    badge: "Gestão de Acesso",
    badgeColor: "bg-slate-100 text-slate-700",
    steps: [
      "O admin cria representantes com nome, email, senha e perfil (Vendedor ou Admin).",
      "Representantes veem apenas os clientes atribuídos a eles.",
      "NOVO: Redefina a senha de qualquer representante clicando no ícone de chave 🔑 no card do usuário.",
      "Ative acessos por 30, 90, 180 dias ou 1 ano usando o botão 'Ativar'.",
      "Convide representantes enviando o link de acesso: https://nutricrm.onrender.com",
      "O superadmin tem acesso permanente a todos os dados da plataforma.",
    ],
    tip: "Crie o usuário do representante antes de atribuir clientes a ele.",
  },
];

const CICLO = [
  { emoji: "📋", label: "Planejamento", desc: "Agenda, dados do cliente, objetivo, Plano B" },
  { emoji: "🤝", label: "Conexão", desc: "Cumprimentar, quebra-gelo, declarar objetivo" },
  { emoji: "🔍", label: "Id. Necessidades", desc: "Entender a 'dor', perguntas estratégicas, escuta ativa" },
  { emoji: "💡", label: "Soluções", desc: "Personalizar benefícios, manejo de objeções" },
  { emoji: "✅", label: "Fechamento", desc: "Observar sinal de compra, declarar e anotar o combinado" },
  { emoji: "🔄", label: "Pós Venda", desc: "Acompanhamento, resultado, cumprir prometido" },
];

export default function Tutorial() {
  const [openModule, setOpenModule] = useState<number | null>(null);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center py-6">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-semibold mb-3">
          <BookOpen className="w-4 h-4" /> Tutorial NutriCRM
        </div>
        <h1 className="text-3xl font-bold text-slate-800">Como usar o NutriCRM</h1>
        <p className="text-slate-500 mt-2">Guia completo de todas as funcionalidades — clique em cada módulo para expandir</p>
      </div>

      {/* Ciclo de Atendimento */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-emerald-50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="w-5 h-5 text-primary" />
            Ciclo de Atendimento Excelente
          </CardTitle>
          <p className="text-sm text-slate-500">Siga estas 6 etapas em cada visita para maximizar resultados</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {CICLO.map((etapa, i) => (
              <div key={i} className="flex flex-col items-center text-center p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                <span className="text-2xl mb-1">{etapa.emoji}</span>
                <p className="text-xs font-bold text-slate-700">{etapa.label}</p>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight">{etapa.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Plano de Visita */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            Plano de Visita (Metodologia SPIN)
          </CardTitle>
          <p className="text-sm text-slate-500">Preencha antes de ir ao campo — disponível em Planejamento ao agendar uma visita</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              ["1. Objetivo da Visita", "O que quero que o cliente se comprometa a fazer ao final?"],
              ["2. Fatos a Descobrir", "Informações que preciso coletar além do que já sei"],
              ["3. Possíveis Insatisfações", "Problemas que meu produto pode resolver"],
              ["4. Consequências", "Impacto real dos problemas do cliente"],
              ["5. Perguntas de Insatisfação", "Como descobrir as dores do cliente"],
              ["6. Perguntas de Consequências", "Como dimensionar o problema em $ ou resultado"],
              ["7. Necessidades Potenciais", "O que o cliente provavelmente precisa"],
              ["8. Perguntas de Valor", "Como mostrar o valor da solução para o cliente"],
            ].map(([title, desc], i) => (
              <div key={i} className="flex gap-2 p-2 bg-white rounded-lg border border-amber-100">
                <span className="text-amber-500 font-bold text-xs w-4 shrink-0 mt-0.5">{i + 1}.</span>
                <div>
                  <p className="text-xs font-semibold text-slate-700">{title.replace(/^\d+\. /, "")}</p>
                  <p className="text-[11px] text-slate-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Módulos */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
          <Star className="w-5 h-5 text-primary" /> Guia por Módulo
        </h2>
        {MODULES.map((mod, i) => {
          const isOpen = openModule === i;
          return (
            <Card key={i} className={`cursor-pointer transition-all ${isOpen ? "border-primary/40 shadow-md" : "hover:border-slate-300"}`}>
              <CardHeader
                className="pb-0 pt-4 px-4"
                onClick={() => setOpenModule(isOpen ? null : i)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl ${mod.color} flex items-center justify-center shrink-0`}>
                      <mod.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{mod.title}</CardTitle>
                        <Badge className={`text-[10px] ${mod.badgeColor} border-0`}>{mod.badge}</Badge>
                      </div>
                      <p className="text-xs text-slate-400">{mod.steps.length} passos</p>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </CardHeader>
              {isOpen && (
                <CardContent className="pt-4 px-4 pb-4">
                  <ol className="space-y-2 mb-4">
                    {mod.steps.map((step, j) => (
                      <li key={j} className="flex gap-2 text-sm">
                        <span className={`w-5 h-5 rounded-full ${mod.color} text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5`}>
                          {j + 1}
                        </span>
                        <span className="text-slate-600">{step}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 font-medium">{mod.tip}</p>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Fluxo típico do dia */}
      <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-0">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400" /> Fluxo Típico do Dia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { period: "☀️ Manhã", items: ["Dashboard → ver métricas do período", "Planejamento → verificar visitas do dia", "Preencher Plano de Visita para cada cliente"] },
              { period: "🌤️ Tarde", items: ["Realizar visitas com o Plano em mãos", "Registrar Interação ao final de cada visita", "Marcar etapa do Ciclo de Atendimento"] },
              { period: "🌙 Final do Dia", items: ["Registrar vendas fechadas", "Agendar próximas visitas no Calendário", "Atualizar oportunidades no Kanban"] },
            ].map((block, i) => (
              <div key={i} className="bg-white/10 rounded-xl p-3">
                <p className="font-bold text-sm mb-2">{block.period}</p>
                <ul className="space-y-1">
                  {block.items.map((item, j) => (
                    <li key={j} className="text-xs text-slate-300 flex gap-1.5">
                      <span className="text-emerald-400 mt-0.5">→</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
