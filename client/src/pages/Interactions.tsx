import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
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
} from "lucide-react";
import { toast } from "sonner";

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
  const [, setLocation] = useLocation();
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroResultado, setFiltroResultado] = useState("");
  const [busca, setBusca] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedInteraction, setSelectedInteraction] = useState<any>(null);
  const [nextVisitDate, setNextVisitDate] = useState("");
  const [visitResult, setVisitResult] = useState("");

  const { data: interactions = [], refetch } = trpc.interactions.all.useQuery({
    type: filtroTipo || undefined,
    visitResult: filtroResultado || undefined,
  });

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

  const filtered = interactions.filter((i: any) => {
    if (!busca) return true;
    const clientName = i.clientName ?? i.client?.name ?? "";
    return clientName.toLowerCase().includes(busca.toLowerCase());
  });

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
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-blue-600" /> Interações
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Todas as interações registradas com clientes
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
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
          onChange={(e) => setFiltroResultado(e.target.value)}
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
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-[180px]"
        />
      </div>

      <p className="text-sm text-slate-500">
        <span className="font-medium text-slate-700">{filtered.length}</span> interações encontradas
      </p>

      {/* Lista */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-slate-400">
              Nenhuma interação encontrada
            </CardContent>
          </Card>
        )}
        {filtered.map((interaction: any) => {
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
                        onClick={() => clientId && setLocation(`/clients/${clientId}`)}
                        className="font-semibold text-slate-800 hover:text-blue-600 hover:underline text-sm leading-tight"
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
    </div>
  );
}
