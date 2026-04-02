import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MessageSquare,
  Phone,
  Mail,
  FileText,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  MinusCircle,
  XCircle,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import ClientDetail from "@/pages/ClientDetail";

const CICLO_ETAPAS = [
  { id: "planejamento", label: "Planejamento", color: "bg-slate-100 text-slate-700", icon: "📋" },
  { id: "conexao", label: "Conexão", color: "bg-blue-100 text-blue-700", icon: "🤝" },
  { id: "necessidades", label: "Id. Necessidades", color: "bg-purple-100 text-purple-700", icon: "🔍" },
  { id: "solucoes", label: "Soluções", color: "bg-amber-100 text-amber-700", icon: "💡" },
  { id: "fechamento", label: "Fechamento", color: "bg-green-100 text-green-700", icon: "✅" },
  { id: "posvenda", label: "Pós Venda", color: "bg-emerald-100 text-emerald-700", icon: "🔄" },
] as const;

function getCicloEtapa(description: string | null | undefined) {
  if (!description) return null;
  const match = description.match(/\[CICLO:(\w+)\]/);
  if (!match) return null;
  return CICLO_ETAPAS.find(e => e.id === match[1]) || null;
}

function getDescription(description: string | null | undefined) {
  if (!description) return "";
  return description.replace(/\[CICLO:\w+\]\s?/, "").replace(/\[PLANO\].*/s, "");
}

function formatDateBR(dateStr: string | null | undefined) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

function daysDiff(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case "visita": return <MessageSquare className="h-5 w-5 text-blue-500" />;
    case "ligacao": return <Phone className="h-5 w-5 text-green-500" />;
    case "email": return <Mail className="h-5 w-5 text-purple-500" />;
    case "nota": return <FileText className="h-5 w-5 text-slate-500" />;
    case "reuniao": return <Calendar className="h-5 w-5 text-orange-500" />;
    default: return <MessageSquare className="h-5 w-5 text-slate-400" />;
  }
}

function ResultBadge({ result }: { result: string | null | undefined }) {
  if (!result) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">
        Sem classificação
      </span>
    );
  }
  if (result === "positivo") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
        <CheckCircle className="h-3 w-3" /> Positivo
      </span>
    );
  }
  if (result === "neutro") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
        <MinusCircle className="h-3 w-3" /> Neutro
      </span>
    );
  }
  if (result === "negativo") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600">
        <XCircle className="h-3 w-3" /> Negativo
      </span>
    );
  }
  if (result === "sem_resposta") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-600">
        <AlertCircle className="h-3 w-3" /> Sem Resposta
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">
      {result}
    </span>
  );
}

export default function Interactions() {
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroResultado, setFiltroResultado] = useState("");
  const [buscaInput, setBuscaInput] = useState("");
  const [busca, setBusca] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedInteraction, setSelectedInteraction] = useState<any>(null);
  const [nextVisitDate, setNextVisitDate] = useState("");
  const [visitResult, setVisitResult] = useState("");
  const [detailClient, setDetailClient] = useState<any>(null);

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState({
    clientId: "",
    clientSearch: "",
    type: "visita" as "visita" | "ligacao" | "email" | "nota" | "reuniao",
    title: "",
    description: "",
    visitResult: "neutro" as "positivo" | "neutro" | "negativo" | "sem_resposta",
    nextVisitDate: "",
    cicloEtapa: "conexao",
  });

  const { data: interactions = [], isLoading, refetch } = trpc.interactions.all.useQuery({
    type: filtroTipo || undefined,
    visitResult: filtroResultado || undefined,
  });

  useEffect(() => {
    const t = setTimeout(() => setBusca(buscaInput), 400);
    return () => clearTimeout(t);
  }, [buscaInput]);

  const scheduleMutation = trpc.interactions.schedule.useMutation({
    onSuccess: () => {
      toast.success("Visita agendada com sucesso!");
      setModalOpen(false);
      setNextVisitDate("");
      setVisitResult("");
      refetch();
    },
    onError: () => toast.error("Erro ao agendar visita."),
  });

  const { data: allClients } = trpc.clients.list.useQuery({ limit: 2000 });
  const clientList: any[] = (allClients as any)?.data ?? (Array.isArray(allClients) ? allClients : []);
  const filteredNewClients = newForm.clientSearch
    ? clientList.filter((c: any) => `${c.farmName} ${c.producerName}`.toLowerCase().includes(newForm.clientSearch.toLowerCase())).slice(0, 6)
    : [];

  const createInteractionMutation = trpc.interactions.create.useMutation({
    onSuccess: () => {
      toast.success("Interação registrada!");
      setShowNewForm(false);
      setNewForm({ clientId: "", clientSearch: "", type: "visita", title: "", description: "", visitResult: "neutro", nextVisitDate: "", cicloEtapa: "conexao" });
      refetch();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao criar interação"),
  });

  const filtered = (interactions as any[]).filter((i: any) => {
    if (!busca) return true;
    const clientName = i.clientName ?? i.client?.name ?? "";
    return clientName.toLowerCase().includes(busca.toLowerCase());
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openModal(interaction: any) {
    setSelectedInteraction(interaction);
    setNextVisitDate(
      interaction.nextVisitDate
        ? new Date(interaction.nextVisitDate).toISOString().slice(0, 10)
        : ""
    );
    setVisitResult(interaction.visitResult ?? "");
    setModalOpen(true);
  }

  function handleSaveSchedule() {
    if (!selectedInteraction) return;
    if (!nextVisitDate) { toast.error("Selecione uma data."); return; }
    scheduleMutation.mutate({
      interactionId: selectedInteraction.id,
      nextVisitDate: new Date(nextVisitDate).toISOString(),
      visitResult: visitResult || "sem_resposta",
    });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-blue-600" /> Interações
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Todas as interações registradas com clientes
          </p>
        </div>
        <Button onClick={() => setShowNewForm(!showNewForm)} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Interação
        </Button>
      </div>

      {showNewForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Registrar Nova Interação</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Busca cliente */}
              <div className="relative">
                <label className="text-sm font-medium">Cliente *</label>
                <input value={newForm.clientSearch}
                  onChange={(e) => { setNewForm({ ...newForm, clientSearch: e.target.value, clientId: "" }); }}
                  placeholder="Nome da fazenda ou produtor..."
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                {filteredNewClients.length > 0 && !newForm.clientId && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow max-h-40 overflow-y-auto">
                    {filteredNewClients.map((c: any) => (
                      <button key={c.id} type="button"
                        onMouseDown={() => setNewForm({ ...newForm, clientId: String(c.id), clientSearch: c.farmName || c.producerName })}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-0">
                        {c.farmName || c.producerName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Tipo</label>
                  <select value={newForm.type} onChange={(e) => setNewForm({ ...newForm, type: e.target.value as any })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    <option value="visita">Visita</option>
                    <option value="ligacao">Ligação</option>
                    <option value="email">E-mail</option>
                    <option value="reuniao">Reunião</option>
                    <option value="nota">Nota</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Resultado</label>
                  <select value={newForm.visitResult} onChange={(e) => setNewForm({ ...newForm, visitResult: e.target.value as any })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    <option value="positivo">Positivo</option>
                    <option value="neutro">Neutro</option>
                    <option value="negativo">Negativo</option>
                    <option value="sem_resposta">Sem resposta</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Etapa do Ciclo de Atendimento</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {CICLO_ETAPAS.map((etapa) => (
                    <button
                      key={etapa.id}
                      type="button"
                      onClick={() => setNewForm({ ...newForm, cicloEtapa: etapa.id })}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${
                        (newForm as any).cicloEtapa === etapa.id
                          ? etapa.color + " border-current scale-105 shadow-sm"
                          : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {etapa.icon} {etapa.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Título *</label>
                <input value={newForm.title} onChange={(e) => setNewForm({ ...newForm, title: e.target.value })}
                  placeholder="Ex: Visita técnica para apresentação do produto X"
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <textarea value={newForm.description} onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
                  rows={2} placeholder="Detalhes da interação..."
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="text-sm font-medium">Próxima Visita</label>
                <input type="date" value={newForm.nextVisitDate} onChange={(e) => setNewForm({ ...newForm, nextVisitDate: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none" />
              </div>
              <div className="flex gap-2 pt-1">
                <Button onClick={() => {
                  if (!newForm.clientId || !newForm.title) { toast.error("Preencha cliente e título"); return; }
                  const cicloInfo = `[CICLO:${(newForm as any).cicloEtapa}]`;
                  const descBase = newForm.description || "";
                  createInteractionMutation.mutate({
                    clientId: Number(newForm.clientId),
                    type: newForm.type,
                    title: newForm.title,
                    description: cicloInfo + (descBase ? " " + descBase : ""),
                    visitResult: newForm.visitResult,
                    nextVisitDate: newForm.nextVisitDate ? new Date(newForm.nextVisitDate) : undefined,
                  });
                }} disabled={createInteractionMutation.isPending}>
                  {createInteractionMutation.isPending ? "Salvando..." : "Salvar Interação"}
                </Button>
                <Button variant="outline" onClick={() => setShowNewForm(false)}>Cancelar</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filtroTipo}
          onChange={(e) => { setFiltroTipo(e.target.value); setPage(1); }}
          className="border rounded px-3 py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">Todos os Tipos</option>
          <option value="visita">Visita</option>
          <option value="ligacao">Ligação</option>
          <option value="email">E-mail</option>
          <option value="nota">Nota</option>
          <option value="reuniao">Reunião</option>
        </select>

        <select
          value={filtroResultado}
          onChange={(e) => { setFiltroResultado(e.target.value); setPage(1); }}
          className="border rounded px-3 py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">Todos os Resultados</option>
          <option value="positivo">Positivo</option>
          <option value="neutro">Neutro</option>
          <option value="negativo">Negativo</option>
          <option value="sem_resposta">Sem Resposta</option>
        </select>

        <input
          type="text"
          placeholder="Buscar por cliente..."
          value={buscaInput}
          onChange={(e) => { setBuscaInput(e.target.value); setPage(1); }}
          className="border rounded px-3 py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-[180px]"
        />
      </div>

      <p className="text-sm text-slate-500">
        <span className="font-medium text-slate-700">{filtered.length}</span> interações encontradas
      </p>

      {/* Lista */}
      <div className="space-y-3">
        {paginated.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-slate-400">
              Nenhuma interação encontrada
            </CardContent>
          </Card>
        )}
        {paginated.map((interaction: any) => {
          const clientName = interaction.clientName ?? interaction.client?.name ?? "—";
          const clientId = interaction.clientId ?? interaction.client?.id;
          const nvd = interaction.nextVisitDate;
          const diff = nvd ? daysDiff(nvd) : null;
          const desc = interaction.description ?? interaction.notes ?? "";
          const truncatedDesc = desc.length > 100 ? desc.slice(0, 100) + "…" : desc;
          const dateFormatted = formatDateBR(interaction.date ?? interaction.createdAt);
          const typeLabel: Record<string, string> = {
            visita: "Visita",
            ligacao: "Ligação",
            email: "E-mail",
            nota: "Nota",
            reuniao: "Reunião",
          };

          return (
            <Card key={interaction.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <TypeIcon type={interaction.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <button
                        onClick={() => {
                          const c = clientList.find((cl: any) => cl.id === interaction.clientId);
                          if (c) setDetailClient(c);
                        }}
                        className="font-semibold text-primary hover:underline text-sm"
                      >
                        {clientName}
                      </button>
                      <span className="text-xs text-slate-400">
                        {typeLabel[interaction.type] ?? interaction.type} · {dateFormatted}
                      </span>
                    </div>

                    {interaction.title && (
                      <p className="text-sm font-medium text-slate-700 mb-1">{interaction.title}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <ResultBadge result={interaction.visitResult} />
                      {(() => {
                        const etapa = getCicloEtapa(interaction.description);
                        return etapa ? (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${etapa.color}`}>
                            {etapa.icon} {etapa.label}
                          </span>
                        ) : null;
                      })()}

                      {nvd && diff !== null && (
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium ${
                            diff >= 0
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          <Clock className="h-3 w-3" />
                          Próxima visita: {formatDateBR(nvd)}{" "}
                          ({diff >= 0 ? `em ${diff}d` : `${Math.abs(diff)}d atrasado`})
                        </span>
                      )}
                    </div>

                    {truncatedDesc && (
                      <p className="text-xs text-slate-500 mb-2">{truncatedDesc}</p>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 gap-1"
                      onClick={() => openModal(interaction)}
                    >
                      <Calendar className="h-3 w-3" />
                      <Plus className="h-3 w-3" />
                      Agendar visita
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-slate-600">Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" /> Agendar Próxima Visita
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Data da próxima visita
              </label>
              <input
                type="date"
                value={nextVisitDate}
                onChange={(e) => setNextVisitDate(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Resultado da interação atual
              </label>
              <select
                value={visitResult}
                onChange={(e) => setVisitResult(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">Sem classificação</option>
                <option value="positivo">Positivo</option>
                <option value="neutro">Neutro</option>
                <option value="negativo">Negativo</option>
                <option value="sem_resposta">Sem Resposta</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveSchedule} disabled={scheduleMutation.isPending}>
              {scheduleMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {detailClient && (
        <ClientDetail
          client={detailClient}
          open={!!detailClient}
          onClose={() => setDetailClient(null)}
          onRefresh={() => {}}
        />
      )}
    </div>
  );
}
