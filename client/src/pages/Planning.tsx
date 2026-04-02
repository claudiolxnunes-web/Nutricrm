import { useState } from "react";
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
  ChevronLeft,
  ChevronRight,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  X,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatDateBR(dateStr: string | null | undefined) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

function visitResultLabel(result: string | null | undefined) {
  const map: Record<string, string> = {
    positivo: "Positivo",
    neutro: "Neutro",
    negativo: "Negativo",
    sem_resposta: "Sem Resposta",
  };
  return result ? (map[result] ?? result) : "Sem classificação";
}

function visitResultColor(result: string | null | undefined) {
  if (result === "positivo") return "bg-green-100 text-green-700";
  if (result === "neutro") return "bg-slate-100 text-slate-600";
  if (result === "negativo") return "bg-red-100 text-red-600";
  if (result === "sem_resposta") return "bg-orange-100 text-orange-600";
  return "bg-slate-100 text-slate-400";
}

function typeLabel(type: string) {
  const map: Record<string, string> = {
    visita: "Visita",
    ligacao: "Ligação",
    email: "E-mail",
    nota: "Nota",
    reuniao: "Reunião",
  };
  return map[type] ?? type;
}

export default function Planning() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const [showNewVisit, setShowNewVisit] = useState(false);
  const [newVisit, setNewVisit] = useState({
    clientId: "", clientSearch: "", title: "", nextVisitDate: "",
    objetivo: "",
    fatosDescobrir: "",
    possivelInsatisfacao: "",
    consequencias: "",
    perguntasInsatisfacao: "",
    perguntasConsequencias: "",
    necessidadesPotenciais: "",
    perguntasValor: "",
  });
  const [clientSearchResults, setClientSearchResults] = useState<any[]>([]);

  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

  const { data: visits = [], refetch } = trpc.interactions.upcoming.useQuery({
    fromDate: startOfMonth.toISOString(),
    toDate: endOfMonth.toISOString(),
  });

  const { data: allClients } = trpc.clients.list.useQuery({ limit: 2000 });
  const clientList: any[] = (allClients as any)?.data ?? (Array.isArray(allClients) ? allClients : []);

  const createVisitMutation = trpc.interactions.create.useMutation({
    onSuccess: () => {
      toast.success("Visita agendada!");
      setShowNewVisit(false);
      setNewVisit({ clientId: "", clientSearch: "", title: "", nextVisitDate: selectedDay ? `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}` : "", objetivo: "", fatosDescobrir: "", possivelInsatisfacao: "", consequencias: "", perguntasInsatisfacao: "", perguntasConsequencias: "", necessidadesPotenciais: "", perguntasValor: "" });
      setClientSearchResults([]);
      refetch();
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function goToPrevMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDay(null);
  }

  function goToNextMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDay(null);
  }

  // Build calendar grid
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: { day: number; current: boolean }[] = [];

  // Days from previous month
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, current: false });
  }

  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, current: true });
  }

  // Days from next month to complete rows
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, current: false });
    }
  }

  // Group visits by day of month
  function visitsForDay(day: number) {
    return (visits as any[]).filter((v: any) => {
      if (!v.nextVisitDate) return false;
      const vd = new Date(v.nextVisitDate);
      return vd.getFullYear() === year && vd.getMonth() === month && vd.getDate() === day;
    });
  }

  // Overdue visits (nextVisitDate < today)
  const overdueVisits = (visits as any[]).filter((v: any) => {
    if (!v.nextVisitDate) return false;
    const vd = new Date(v.nextVisitDate);
    vd.setHours(0, 0, 0, 0);
    return vd < today;
  });

  // Selected day visits
  const selectedDayVisits = selectedDay !== null ? visitsForDay(selectedDay) : [];

  const isToday = (day: number) => {
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="h-6 w-6 text-blue-600" /> Planejamento
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Calendário mensal de visitas e interações agendadas
          </p>
        </div>
        <Button onClick={() => setShowNewVisit(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Agendar Visita
        </Button>
      </div>

      <div className="flex gap-6">
        {/* Calendário */}
        <div className="flex-1">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={goToPrevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="text-base">
                  {MONTH_NAMES[month]} {year}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={goToNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Header dias da semana */}
              <div className="grid grid-cols-7 mb-2">
                {WEEKDAYS.map((wd) => (
                  <div key={wd} className="text-center text-xs font-semibold text-slate-500 py-1">
                    {wd}
                  </div>
                ))}
              </div>

              {/* Grade de dias */}
              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((cell, idx) => {
                  const dayVisits = cell.current ? visitsForDay(cell.day) : [];
                  const hasVisits = dayVisits.length > 0;
                  const isSelected = cell.current && selectedDay === cell.day;
                  const isTodayCell = cell.current && isToday(cell.day);

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (cell.current) {
                          const newSelected = isSelected ? null : cell.day;
                          setSelectedDay(newSelected);
                          if (newSelected !== null) {
                            setNewVisit(v => ({
                              ...v,
                              nextVisitDate: `${year}-${String(month + 1).padStart(2, "0")}-${String(newSelected).padStart(2, "0")}`,
                            }));
                          }
                        }
                      }}
                      className={`min-h-[64px] rounded p-1 cursor-pointer transition-colors border ${
                        !cell.current
                          ? "bg-slate-50 border-transparent"
                          : isSelected
                          ? "bg-blue-100 border-blue-400"
                          : isTodayCell
                          ? "bg-blue-50 border-blue-200"
                          : "bg-white border-slate-100 hover:bg-slate-50"
                      }`}
                    >
                      <div
                        className={`text-xs font-medium mb-1 ${
                          !cell.current
                            ? "text-slate-300"
                            : isTodayCell
                            ? "text-blue-700 font-bold"
                            : "text-slate-700"
                        }`}
                      >
                        {cell.day}
                      </div>
                      {cell.current && hasVisits && (
                        <div className="space-y-0.5">
                          {dayVisits.slice(0, 3).map((v: any, vi: number) => {
                            const vd = new Date(v.nextVisitDate);
                            vd.setHours(0, 0, 0, 0);
                            const past = vd < today;
                            return (
                              <div
                                key={vi}
                                className={`text-xs truncate rounded px-1 py-0.5 leading-tight ${
                                  past
                                    ? "bg-red-100 text-red-700"
                                    : "bg-green-100 text-green-700"
                                }`}
                                title={v.clientName ?? v.client?.name ?? ""}
                              >
                                {v.clientName ?? v.client?.name ?? "Cliente"}
                              </div>
                            );
                          })}
                          {dayVisits.length > 3 && (
                            <div className="text-xs text-slate-400">+{dayVisits.length - 3}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Painel lateral */}
        {selectedDay !== null && (
          <div className="w-80 flex-shrink-0">
            <Card className="h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    Visitas — {selectedDay}/{month + 1}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDay(null)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedDayVisits.length === 0 && (
                  <p className="text-slate-400 text-sm text-center py-4">
                    Nenhuma visita neste dia
                  </p>
                )}
                {selectedDayVisits.map((v: any, i: number) => {
                  const vd = new Date(v.nextVisitDate);
                  vd.setHours(0, 0, 0, 0);
                  const past = vd < today;
                  return (
                    <div key={i} className="border rounded p-3 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm text-slate-800">
                          {v.clientName ?? v.client?.name ?? "—"}
                        </p>
                        {past && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold bg-red-500 text-white flex-shrink-0">
                            ATRASADO
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{typeLabel(v.type)}</p>
                      {v.title && <p className="text-xs text-slate-700">{v.title}</p>}
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${visitResultColor(v.visitResult)}`}
                      >
                        {visitResultLabel(v.visitResult)}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Visitas Atrasadas */}
      {overdueVisits.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" /> Visitas Atrasadas ({overdueVisits.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdueVisits.map((v: any, i: number) => (
              <div
                key={i}
                className="flex items-center justify-between bg-white border border-red-200 rounded p-3"
              >
                <div className="space-y-0.5">
                  <p className="font-semibold text-sm text-slate-800">
                    {v.clientName ?? v.client?.name ?? "—"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {typeLabel(v.type)} · Prevista: {formatDateBR(v.nextVisitDate)}
                  </p>
                  {v.title && <p className="text-xs text-slate-600">{v.title}</p>}
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-red-500 text-white">
                  ATRASADO
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {overdueVisits.length === 0 && (visits as any[]).length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-slate-400">
            <Clock className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            <p>Nenhuma visita agendada para este mês</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={showNewVisit} onOpenChange={setShowNewVisit}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Agendar Nova Visita</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="relative">
              <label className="text-sm font-medium">Cliente *</label>
              <input value={newVisit.clientSearch}
                onChange={(e) => {
                  const s = e.target.value;
                  setNewVisit({ ...newVisit, clientSearch: s, clientId: "" });
                  setClientSearchResults(s ? clientList.filter((c: any) => `${c.farmName} ${c.producerName}`.toLowerCase().includes(s.toLowerCase())).slice(0, 6) : []);
                }}
                placeholder="Nome da fazenda ou produtor..."
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              {clientSearchResults.length > 0 && !newVisit.clientId && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow max-h-40 overflow-y-auto">
                  {clientSearchResults.map((c: any) => (
                    <button key={c.id} type="button"
                      onMouseDown={() => { setNewVisit({ ...newVisit, clientId: String(c.id), clientSearch: c.farmName || c.producerName }); setClientSearchResults([]); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-0">
                      {c.farmName || c.producerName}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Título da Visita *</label>
              <input value={newVisit.title} onChange={(e) => setNewVisit({ ...newVisit, title: e.target.value })}
                placeholder="Ex: Visita técnica - apresentação produto"
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="text-sm font-medium">Data da Visita *</label>
              <input type="date" value={newVisit.nextVisitDate} onChange={(e) => setNewVisit({ ...newVisit, nextVisitDate: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none" />
            </div>
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Plano de Visita</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">1. Objetivo da Visita</label>
                  <p className="text-[11px] text-slate-400 mb-1">O que quero que o cliente se proponha a fazer ao fim da visita?</p>
                  <textarea value={newVisit.objetivo} onChange={(e) => setNewVisit({ ...newVisit, objetivo: e.target.value })}
                    rows={2} placeholder="Ex: Cliente se compromete a testar produto X em 30 dias"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600">2. Fatos a Descobrir</label>
                    <textarea value={newVisit.fatosDescobrir} onChange={(e) => setNewVisit({ ...newVisit, fatosDescobrir: e.target.value })}
                      rows={2} placeholder="Ex: Qual ração usa atualmente? Quantos animais?" 
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">3. Possíveis Insatisfações</label>
                    <textarea value={newVisit.possivelInsatisfacao} onChange={(e) => setNewVisit({ ...newVisit, possivelInsatisfacao: e.target.value })}
                      rows={2} placeholder="Ex: Alto índice de conversão alimentar, baixo ganho de peso"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">4. Consequências dos Problemas</label>
                    <textarea value={newVisit.consequencias} onChange={(e) => setNewVisit({ ...newVisit, consequencias: e.target.value })}
                      rows={2} placeholder="Ex: Custo alto por quilo produzido, menor margem"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">5. Perguntas de Insatisfação</label>
                    <textarea value={newVisit.perguntasInsatisfacao} onChange={(e) => setNewVisit({ ...newVisit, perguntasInsatisfacao: e.target.value })}
                      rows={2} placeholder="Ex: Como está seu índice de conversão atualmente?"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">6. Perguntas de Consequências</label>
                    <textarea value={newVisit.perguntasConsequencias} onChange={(e) => setNewVisit({ ...newVisit, perguntasConsequencias: e.target.value })}
                      rows={2} placeholder="Ex: Quanto isso impacta no custo final do seu produto?"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">7. Necessidades Potenciais</label>
                    <textarea value={newVisit.necessidadesPotenciais} onChange={(e) => setNewVisit({ ...newVisit, necessidadesPotenciais: e.target.value })}
                      rows={2} placeholder="Ex: Ração com melhor conversão, suplemento mineral"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">8. Perguntas de Valor da Solução</label>
                  <textarea value={newVisit.perguntasValor} onChange={(e) => setNewVisit({ ...newVisit, perguntasValor: e.target.value })}
                    rows={2} placeholder="Ex: Se conseguíssemos reduzir sua conversão em 10%, quanto isso significaria em lucro?"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNewVisit(false)}>Cancelar</Button>
            <Button onClick={() => {
              if (!newVisit.clientId || !newVisit.title || !newVisit.nextVisitDate) { toast.error("Preencha todos os campos obrigatórios"); return; }
              const plano = {
                objetivo: newVisit.objetivo,
                fatosDescobrir: newVisit.fatosDescobrir,
                possivelInsatisfacao: newVisit.possivelInsatisfacao,
                consequencias: newVisit.consequencias,
                perguntasInsatisfacao: newVisit.perguntasInsatisfacao,
                perguntasConsequencias: newVisit.perguntasConsequencias,
                necessidadesPotenciais: newVisit.necessidadesPotenciais,
                perguntasValor: newVisit.perguntasValor,
              };
              const hasPlano = Object.values(plano).some(v => v.trim());
              createVisitMutation.mutate({
                clientId: Number(newVisit.clientId),
                type: "visita",
                title: newVisit.title,
                visitResult: "neutro",
                nextVisitDate: new Date(newVisit.nextVisitDate),
                description: hasPlano ? `[PLANO]${JSON.stringify(plano)}` : undefined,
              });
            }} disabled={createVisitMutation.isPending}>
              {createVisitMutation.isPending ? "Agendando..." : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
