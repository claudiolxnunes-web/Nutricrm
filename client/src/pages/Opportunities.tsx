import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ChevronLeft, ChevronRight, DollarSign, TrendingUp, Search, X } from "lucide-react";
import { toast } from "sonner";

const STAGES = [
  { id: "prospeccao",       label: "Prospeccao",       color: "bg-blue-50 border-blue-200",    badge: "bg-blue-100 text-blue-700" },
  { id: "visita_tecnica",   label: "Visita Tecnica",   color: "bg-purple-50 border-purple-200", badge: "bg-purple-100 text-purple-700" },
  { id: "orcamento_enviado",label: "Orcamento Enviado",color: "bg-yellow-50 border-yellow-200", badge: "bg-yellow-100 text-yellow-700" },
  { id: "negociacao",       label: "Negociacao",       color: "bg-orange-50 border-orange-200", badge: "bg-orange-100 text-orange-700" },
  { id: "venda_concluida",  label: "Venda Concluida",  color: "bg-green-50 border-green-200",   badge: "bg-green-100 text-green-700" },
  { id: "perdida",          label: "Perdida",          color: "bg-red-50 border-red-200",       badge: "bg-red-100 text-red-700" },
];

const emptyForm = {
  clientId: 0,
  title: "",
  description: "",
  value: "",
  probability: 0,
  stage: "prospeccao",
  expectedCloseDate: "",
  quoteId: "",
};

function fmt(v: any) {
  const n = parseFloat(v || "0");
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Opportunities() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clientSearchRef.current && !clientSearchRef.current.contains(e.target as Node))
        setShowClientDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: opportunities, isLoading, refetch } = trpc.opportunities.list.useQuery({ limit: 200 });
  const { data: clientsResult, isLoading: clientsLoading } = trpc.clients.list.useQuery({ limit: 500 });
  const clients: any[] = (clientsResult as any)?.data ?? (clientsResult as any) ?? [];

  const { data: allQuotes } = trpc.quotes.list.useQuery({ limit: 500 });
  const quoteList: any[] = Array.isArray(allQuotes) ? allQuotes : [];

  const createMutation = trpc.opportunities.create.useMutation({
    onSuccess: () => { toast.success("Oportunidade criada!"); setShowForm(false); setFormData({ ...emptyForm }); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = trpc.opportunities.update.useMutation({
    onSuccess: () => { toast.success("Atualizado!"); setEditingId(null); setShowForm(false); setFormData({ ...emptyForm }); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = trpc.opportunities.delete.useMutation({
    onSuccess: () => { toast.success("Removida!"); setDeleteId(null); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const moveStage = (opp: any, dir: number) => {
    const idx = STAGES.findIndex(s => s.id === opp.stage);
    const next = STAGES[idx + dir];
    if (!next) return;
    updateMutation.mutate({ id: opp.id, stage: next.id as any });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientId || !formData.title) { toast.error("Preencha cliente e titulo"); return; }
    if (editingId !== null) {
      updateMutation.mutate({
        id: editingId,
        title: formData.title,
        description: formData.description,
        value: formData.value,
        probability: formData.probability,
        stage: formData.stage as any,
        expectedCloseDate: formData.expectedCloseDate ? new Date(formData.expectedCloseDate) : undefined,
        quoteId: formData.quoteId ? Number(formData.quoteId) : undefined,
      });
    } else {
      createMutation.mutate({
        clientId: formData.clientId,
        title: formData.title,
        description: formData.description,
        value: formData.value,
        probability: formData.probability,
        expectedCloseDate: formData.expectedCloseDate ? new Date(formData.expectedCloseDate) : undefined,
        quoteId: formData.quoteId ? Number(formData.quoteId) : undefined,
      });
    }
  };

  const handleEdit = (opp: any) => {
    const name = clientMap[opp.clientId] ?? "";
    setClientSearch(name);
    setFormData({
      clientId: opp.clientId || 0,
      title: opp.title || "",
      description: opp.description || "",
      value: opp.value || "",
      probability: opp.probability || 0,
      stage: opp.stage || "prospeccao",
      expectedCloseDate: opp.expectedCloseDate ? new Date(opp.expectedCloseDate).toISOString().split("T")[0] : "",
      quoteId: opp.quoteId ? String(opp.quoteId) : "",
    });
    setEditingId(opp.id);
    setShowForm(true);
  };

  const clientMap = Object.fromEntries((clients ?? []).map((c: any) => [c.id, c.farmName || c.producerName]));

  const opportunitiesByStage = STAGES.map(stage => ({
    ...stage,
    items: (opportunities ?? []).filter((o: any) => o.stage === stage.id),
    total: (opportunities ?? []).filter((o: any) => o.stage === stage.id).reduce((s: number, o: any) => s + parseFloat(o.value || "0"), 0),
  }));

  const totalPipeline = (opportunities ?? []).reduce((s: number, o: any) => s + parseFloat(o.value || "0"), 0);
  const totalConcluidas = (opportunities ?? []).filter((o: any) => o.stage === "venda_concluida").reduce((s: number, o: any) => s + parseFloat(o.value || "0"), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Funil de Vendas</h1>
          <p className="text-slate-600">Acompanhe e gerencie suas oportunidades</p>
        </div>
        <Button onClick={() => { setEditingId(null); setFormData({ ...emptyForm }); setClientSearch(""); setShowClientDropdown(false); setShowForm(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Oportunidade
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><p className="text-sm text-slate-500">Total no Funil</p><p className="text-2xl font-bold">{opportunities?.length ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-slate-500">Pipeline Total</p><p className="text-2xl font-bold text-blue-600">{fmt(totalPipeline)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-slate-500">Vendas Concluidas</p><p className="text-2xl font-bold text-green-600">{fmt(totalConcluidas)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-slate-500">Taxa de Conversao</p><p className="text-2xl font-bold text-purple-600">{opportunities?.length ? Math.round(((opportunities as any[]).filter((o: any) => o.stage === "venda_concluida").length / (opportunities as any[]).length) * 100) : 0}%</p></CardContent></Card>
      </div>

      {/* Kanban */}
      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {opportunitiesByStage.map((stage, stageIdx) => (
            <div key={stage.id} className={`rounded-xl border-2 p-3 ${stage.color}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">{stage.label}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stage.badge}`}>{stage.items.length}</span>
              </div>
              {stage.total > 0 && (
                <p className="text-xs text-slate-500 mb-2 flex items-center gap-1"><DollarSign className="w-3 h-3" />{fmt(stage.total)}</p>
              )}
              <div className="space-y-2">
                {stage.items.length === 0 && <p className="text-xs text-slate-400 text-center py-3">Nenhuma</p>}
                {stage.items.map((opp: any) => (
                  <div key={opp.id} className="bg-white rounded-lg p-3 shadow-sm border border-white/80 hover:shadow-md transition cursor-pointer" onClick={() => handleEdit(opp)}>
                    <p className="font-medium text-sm leading-tight">{opp.title}</p>
                    {clientMap[opp.clientId] && <p className="text-xs text-slate-400 mt-0.5 truncate">{clientMap[opp.clientId]}</p>}
                    {opp.value && <p className="text-sm font-semibold text-slate-700 mt-1">{fmt(opp.value)}</p>}
                    {opp.expectedCloseDate && (
                      <p className="text-xs text-slate-400 mt-1">
                        Fechamento: {new Date(opp.expectedCloseDate).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                    {opp.quoteId && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded mt-1 inline-block">
                        ORC vinculado
                      </span>
                    )}
                    {opp.probability > 0 && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-slate-400 mb-0.5"><span>Prob.</span><span>{opp.probability}%</span></div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5"><div className="bg-primary h-1.5 rounded-full" style={{ width: `${opp.probability}%` }}></div></div>
                      </div>
                    )}
                    <div className="flex justify-between mt-2" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={stageIdx === 0} onClick={() => moveStage(opp, -1)} title="Etapa anterior"><ChevronLeft className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 hover:text-red-600" onClick={() => setDeleteId(opp.id)} title="Excluir"><Trash2 className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={stageIdx === STAGES.length - 1} onClick={() => moveStage(opp, 1)} title="Proxima etapa"><ChevronRight className="w-3 h-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog: criar/editar */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingId(null); setFormData({ ...emptyForm }); setClientSearch(""); setShowClientDropdown(false); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Oportunidade" : "Nova Oportunidade"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Cliente *</label>
              {formData.clientId > 0 && !editingId ? (
                <div className="flex items-center gap-2 mt-1 p-2 border border-green-300 rounded-md bg-green-50">
                  <span className="flex-1 text-sm font-medium text-green-800">{clientSearch}</span>
                  <button type="button" className="text-xs text-slate-500 hover:text-red-500 underline" onClick={() => { setClientSearch(""); setFormData({ ...formData, clientId: 0 }); }}>Trocar</button>
                </div>
              ) : (
                <div className="mt-1 space-y-1">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      placeholder="Digite o nome da fazenda ou produtor..."
                      className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      readOnly={!!editingId}
                      autoComplete="off"
                    />
                  </div>
                  {!editingId && (
                    <div className="border border-slate-200 rounded-md bg-white max-h-48 overflow-y-auto">
                      {clientsLoading ? (
                        <div className="flex items-center justify-center gap-2 py-4 text-slate-400 text-sm">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                          Carregando clientes...
                        </div>
                      ) : (() => {
                        const q = clientSearch.trim().toLowerCase();
                        const filtered = (clients ?? []).filter((c: any) =>
                          !q || (c.farmName ?? "").toLowerCase().includes(q) || (c.producerName ?? "").toLowerCase().includes(q)
                        ).slice(0, 30);
                        if (filtered.length === 0) return (
                          <p className="px-3 py-4 text-sm text-slate-400 text-center">
                            {q ? `Nenhum cliente encontrado para "${q}"` : "Nenhum cliente cadastrado"}
                          </p>
                        );
                        return filtered.map((c: any) => (
                          <button
                            key={c.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setFormData({ ...formData, clientId: c.id });
                              setClientSearch(c.farmName || c.producerName || "");
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 active:bg-blue-100 flex justify-between items-center border-b border-slate-100 last:border-0"
                          >
                            <span className="font-medium text-slate-800">{c.farmName || c.producerName}</span>
                            {c.farmName && c.producerName && <span className="text-slate-400 text-xs ml-2 truncate max-w-[120px]">{c.producerName}</span>}
                          </button>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Titulo *</label>
              <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Ex: Venda de racao para engorda" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Valor (R$)</label>
                <Input value={formData.value} onChange={(e) => setFormData({ ...formData, value: e.target.value })} placeholder="0.00" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Probabilidade (%)</label>
                <Input type="number" min="0" max="100" value={formData.probability} onChange={(e) => setFormData({ ...formData, probability: parseInt(e.target.value) || 0 })} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Etapa</label>
              <select value={formData.stage} onChange={(e) => setFormData({ ...formData, stage: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm mt-1">
                {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Descricao</label>
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Detalhes da oportunidade" className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm mt-1" rows={3} />
            </div>
            <div>
              <label className="text-sm font-medium">Data Esperada de Fechamento</label>
              <Input type="date" value={formData.expectedCloseDate || ""}
                onChange={(e) => setFormData({ ...formData, expectedCloseDate: e.target.value })}
                className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Orçamento Vinculado (opcional)</label>
              <select value={formData.quoteId || ""}
                onChange={(e) => setFormData({ ...formData, quoteId: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md text-sm">
                <option value="">Nenhum</option>
                {quoteList.map((q: any) => (
                  <option key={q.id} value={q.id}>{q.quoteNumber} — {q.status}</option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingId(null); setFormData({ ...emptyForm }); setClientSearch(""); setShowClientDropdown(false); }}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? "Salvando..." : editingId ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: excluir */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir oportunidade?</AlertDialogTitle>
            <AlertDialogDescription>Esta acao nao pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
