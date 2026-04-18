import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ChevronLeft, ChevronRight, DollarSign, TrendingUp, Search, X, Mail, FileText, Send } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

function DraggableCard({ opp, children }: { opp: any; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: opp.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      {...listeners}
      {...attributes}
      className="cursor-grab active:cursor-grabbing"
    >
      {children}
    </div>
  );
}

function DroppableColumn({ stageId, children }: { stageId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stageId });
  return (
    <div ref={setNodeRef} className={`min-h-[120px] transition-colors rounded-lg ${isOver ? "bg-primary/5 ring-2 ring-primary/20" : ""}`}>
      {children}
    </div>
  );
}

export default function Opportunities() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [clientSearch, setClientSearch] = useState("");
  const [activeOpp, setActiveOpp] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("oportunidades");
  const [showSendQuoteDialog, setShowSendQuoteDialog] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<any>(null);
  const [emailTo, setEmailTo] = useState("");
  const [customMessage, setCustomMessage] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const { data: opportunities, isLoading, refetch } = trpc.opportunities.list.useQuery({ limit: 200 });
  const { data: clientsResult, isLoading: clientsLoading } = trpc.clients.list.useQuery({ limit: 500 });
  const clients: any[] = (clientsResult as any)?.data ?? (clientsResult as any) ?? [];

  const { data: allQuotes, refetch: refetchQuotes } = trpc.quotes.list.useQuery({ limit: 500 });
  const quoteList: any[] = Array.isArray(allQuotes) ? allQuotes : [];

  const { data: orcamentosSimples = [] } = trpc.orcamentosSimples?.list?.useQuery() || {};

  const createMutation = trpc.opportunities.create.useMutation({ onSuccess: () => { toast.success("Oportunidade criada!"); refetch(); setShowForm(false); setFormData({ ...emptyForm }); setClientSearch(""); }, });
  const updateMutation = trpc.opportunities.update.useMutation({ onSuccess: () => { toast.success("Oportunidade atualizada!"); refetch(); setShowForm(false); setEditingId(null); setFormData({ ...emptyForm }); setClientSearch(""); }, });
  const deleteMutation = trpc.opportunities.delete.useMutation({ onSuccess: () => { toast.success("Oportunidade excluida!"); refetch(); setDeleteId(null); }, });
  const moveStageMutation = trpc.opportunities.update.useMutation({ onSuccess: () => refetch() });
  const sendEmailMutation = trpc.quotes.sendEmail.useMutation({
    onSuccess: () => {
      toast.success("Orcamento enviado por email!");
      setShowSendQuoteDialog(false);
      setSelectedQuote(null);
      setEmailTo("");
      setCustomMessage("");
      refetchQuotes();
    },
    onError: (err: any) => toast.error("Erro ao enviar: " + err.message),
  });

  const clientMap = Object.fromEntries(clients.map((c: any) => [c.id, c.farmName || c.producerName || `Cliente ${c.id}`]));

  const opportunitiesByStage = STAGES.map(stage => ({
    ...stage,
    items: (opportunities as any[] || []).filter((o: any) => o.stage === stage.id),
    total: (opportunities as any[] || []).filter((o: any) => o.stage === stage.id).reduce((sum, o) => sum + parseFloat(o.value || "0"), 0),
  }));

  const totalPipeline = (opportunities as any[] || []).reduce((sum, o) => sum + parseFloat(o.value || "0"), 0);
  const totalConcluidas = (opportunities as any[] || []).filter((o: any) => o.stage === "venda_concluida").reduce((sum, o) => sum + parseFloat(o.value || "0"), 0);

  function handleEdit(opp: any) {
    setEditingId(opp.id);
    setFormData({
      clientId: opp.clientId,
      title: opp.title,
      description: opp.description || "",
      value: opp.value || "",
      probability: opp.probability || 0,
      stage: opp.stage,
      expectedCloseDate: opp.expectedCloseDate ? new Date(opp.expectedCloseDate).toISOString().split("T")[0] : "",
      quoteId: opp.quoteId ? String(opp.quoteId) : "",
    });
    setClientSearch(clientMap[opp.clientId] || "");
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.clientId || !formData.title) { toast.error("Preencha cliente e titulo"); return; }
    const payload = { 
      ...formData, 
      clientId: Number(formData.clientId), 
      value: String(formData.value || "0"), 
      probability: Number(formData.probability || 0), 
      quoteId: formData.quoteId ? Number(formData.quoteId) : undefined,
      expectedCloseDate: formData.expectedCloseDate ? new Date(formData.expectedCloseDate) : undefined,
      stage: formData.stage as any
    };
    if (editingId) updateMutation.mutate({ id: editingId, ...payload });
    else createMutation.mutate(payload);
  }

  function handleDragStart(event: DragStartEvent) {
    const opp = (opportunities as any[] || []).find((o: any) => o.id === event.active.id);
    setActiveOpp(opp || null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveOpp(null);
    if (!over) return;
    const newStage = over.id as string;
    const opp = (opportunities as any[] || []).find((o: any) => o.id === active.id);
    if (opp && newStage !== opp.stage) moveStageMutation.mutate({ id: opp.id, stage: newStage as any });
  }

  function moveStage(opp: any, direction: number) {
    const idx = STAGES.findIndex(s => s.id === opp.stage);
    const newIdx = idx + direction;
    if (newIdx >= 0 && newIdx < STAGES.length) moveStageMutation.mutate({ id: opp.id, stage: STAGES[newIdx].id as any });
  }

  function openSendQuoteDialog(quote: any) {
    setSelectedQuote(quote);
    const client = clients.find((c: any) => c.id === quote.clientId);
    setEmailTo(client?.email || "");
    setShowSendQuoteDialog(true);
  }

  function handleSendQuote() {
    if (!selectedQuote || !emailTo) { toast.error("Selecione o orcamento e informe o email"); return; }
    sendEmailMutation.mutate({ quoteId: selectedQuote.id, toEmail: emailTo, customMessage: customMessage || undefined });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="oportunidades">Oportunidades</TabsTrigger>
          <TabsTrigger value="orcamentos">Orcamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="oportunidades" className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Funil de Vendas</h1>
              <p className="text-slate-600">Acompanhe e gerencie suas oportunidades</p>
            </div>
            <Button onClick={() => { setEditingId(null); setFormData({ ...emptyForm }); setClientSearch(""); setShowForm(true); }} className="gap-2">
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
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
                    <DroppableColumn stageId={stage.id}>
                      <div className="space-y-2">
                        {stage.items.length === 0 && <p className="text-xs text-slate-400 text-center py-3">Nenhuma</p>}
                        {stage.items.map((opp: any) => (
                          <DraggableCard key={opp.id} opp={opp}>
                            <div className="bg-white rounded-lg p-3 shadow-sm border border-white/80 hover:shadow-md transition" onClick={() => handleEdit(opp)}>
                              <p className="font-medium text-sm leading-tight">{opp.title}</p>
                              {(() => {
                                const diasNaEtapa = Math.floor((Date.now() - new Date(opp.updatedAt).getTime()) / 86400000);
                                const alertaParada = diasNaEtapa >= 15 && opp.stage === "negociacao";
                                const alertaAtencao = diasNaEtapa >= 7 && ["visita_tecnica", "orcamento_enviado"].includes(opp.stage);
                                return (
                                  <>
                                    {opp.updatedAt && (
                                      <p className="text-[10px] text-slate-400">
                                        {Math.ceil((Date.now() - new Date(opp.updatedAt).getTime()) / 86400000)} dia(s) nesta etapa
                                      </p>
                                    )}
                                    {(alertaParada || alertaAtencao) && (
                                      <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${
                                        alertaParada ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                                      }`}>
                                        {alertaParada ? "🔴" : "🟡"} {diasNaEtapa}d parado
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
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
                          </DraggableCard>
                        ))}
                      </div>
                    </DroppableColumn>
                  </div>
                ))}
              </div>
              <DragOverlay>
                {activeOpp ? (
                  <div className="bg-white rounded-lg shadow-2xl border-2 border-primary p-3 opacity-95 rotate-1 w-64">
                    <p className="font-semibold text-sm truncate">{activeOpp.title}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      R$ {parseFloat(activeOpp.value || "0").toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </TabsContent>

        <TabsContent value="orcamentos" className="space-y-6">
          {/* Lista de Orcamentos */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Orcamentos</h1>
              <p className="text-slate-600">Gerencie e envie orcamentos para clientes</p>
            </div>
          </div>

          {/* Orcamentos do Sistema Antigo (quotes) */}
          {quoteList.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h3 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4" /> Orcamentos do Sistema</h3>
              </div>
              <table className="w-full">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-3 text-left">Numero</th>
                    <th className="p-3 text-left">Cliente</th>
                    <th className="p-3 text-right">Valor</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Data</th>
                    <th className="p-3 text-center">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {quoteList.map((q: any) => (
                    <tr key={q.id} className="border-t hover:bg-slate-50">
                      <td className="p-3 font-medium">{q.quoteNumber}</td>
                      <td className="p-3">{clientMap[q.clientId] || `Cliente ${q.clientId}`}</td>
                      <td className="p-3 text-right font-bold">{fmt(q.totalValue)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          q.status === "enviado" ? "bg-blue-100 text-blue-700" :
                          q.status === "aceito" ? "bg-green-100 text-green-700" :
                          q.status === "rejeitado" ? "bg-red-100 text-red-700" :
                          "bg-slate-100 text-slate-700"
                        }`}>
                          {q.status}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-slate-500">{new Date(q.createdAt).toLocaleDateString("pt-BR")}</td>
                      <td className="p-3 text-center">
                        <Button variant="outline" size="sm" onClick={() => openSendQuoteDialog(q)} disabled={sendEmailMutation.isPending}>
                          <Send className="w-3 h-3 mr-1" /> Enviar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Orcamentos Simples */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h3 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4" /> Orcamentos Rapidos</h3>
            </div>
            <table className="w-full">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-3 text-left">Cliente</th>
                  <th className="p-3 text-left">Produtos</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-left">Data</th>
                </tr>
              </thead>
              <tbody>
                {orcamentosSimples.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-500">Nenhum orcamento rapido</td></tr>
                ) : (
                  orcamentosSimples.map((o: any) => (
                    <tr key={o.id} className="border-t hover:bg-slate-50">
                      <td className="p-3">{o.clienteNome}</td>
                      <td className="p-3">{o.produtos?.length || 0} itens</td>
                      <td className="p-3 text-right font-bold">R$ {Number(o.total).toFixed(2)}</td>
                      <td className="p-3 text-sm text-slate-500">{new Date(o.criadoEm).toLocaleDateString("pt-BR")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog: criar/editar oportunidade */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingId(null); setFormData({ ...emptyForm }); setClientSearch(""); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Oportunidade" : "Nova Oportunidade"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Cliente *</label>
              <select 
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={formData.clientId || ""}
                onChange={(e) => {
                  const clientId = Number(e.target.value);
                  const c = clients.find((x: any) => x.id === clientId);
                  if (c) {
                    setFormData({ ...formData, clientId: c.id });
                    setClientSearch(c.farmName || c.producerName || "");
                  }
                }}
                disabled={!!editingId}
              >
                <option value="">Selecione o cliente...</option>
                {clientsLoading ? (
                  <option disabled>Carregando clientes...</option>
                ) : (
                  clients.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.farmName || c.producerName} {c.producerName && c.farmName ? `- ${c.producerName}` : ""}
                    </option>
                  ))
                )}
              </select>
              {formData.clientId > 0 && (
                <p className="mt-1 text-sm text-green-600">
                  Cliente selecionado: {clientSearch}
                </p>
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
              <label className="text-sm font-medium">Orcamento Vinculado (opcional)</label>
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
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingId(null); setFormData({ ...emptyForm }); setClientSearch(""); }}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? "Salvando..." : editingId ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: enviar orcamento por email */}
      <Dialog open={showSendQuoteDialog} onOpenChange={setShowSendQuoteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Orcamento por Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedQuote && (
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="font-medium">{selectedQuote.quoteNumber}</p>
                <p className="text-sm text-slate-600">Cliente: {clientMap[selectedQuote.clientId] || `Cliente ${selectedQuote.clientId}`}</p>
                <p className="text-sm text-slate-600">Valor: {fmt(selectedQuote.totalValue)}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Email do Destinatário *</label>
              <Input 
                type="email" 
                value={emailTo} 
                onChange={(e) => setEmailTo(e.target.value)} 
                placeholder="cliente@email.com" 
                className="mt-1" 
              />
            </div>
            <div>
              <label className="text-sm font-medium">Mensagem (opcional)</label>
              <textarea 
                value={customMessage} 
                onChange={(e) => setCustomMessage(e.target.value)} 
                placeholder="Digite uma mensagem para o cliente..." 
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm mt-1" 
                rows={3} 
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSendQuoteDialog(false)}>Cancelar</Button>
              <Button onClick={handleSendQuote} disabled={!emailTo || sendEmailMutation.isPending}>
                {sendEmailMutation.isPending ? "Enviando..." : "Enviar Email"}
              </Button>
            </DialogFooter>
          </div>
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
}import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ChevronLeft, ChevronRight, DollarSign, TrendingUp, Search, X, Mail, FileText, Send } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

function DraggableCard({ opp, children }: { opp: any; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: opp.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      {...listeners}
      {...attributes}
      className="cursor-grab active:cursor-grabbing"
    >
      {children}
    </div>
  );
}

function DroppableColumn({ stageId, children }: { stageId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stageId });
  return (
    <div ref={setNodeRef} className={`min-h-[120px] transition-colors rounded-lg ${isOver ? "bg-primary/5 ring-2 ring-primary/20" : ""}`}>
      {children}
    </div>
  );
}

export default function Opportunities() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [clientSearch, setClientSearch] = useState("");
  const [activeOpp, setActiveOpp] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("oportunidades");
  const [showSendQuoteDialog, setShowSendQuoteDialog] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<any>(null);
  const [emailTo, setEmailTo] = useState("");
  const [customMessage, setCustomMessage] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const { data: opportunities, isLoading, refetch } = trpc.opportunities.list.useQuery({ limit: 200 });
  const { data: clientsResult, isLoading: clientsLoading } = trpc.clients.list.useQuery({ limit: 500 });
  const clients: any[] = (clientsResult as any)?.data ?? (clientsResult as any) ?? [];

  const { data: allQuotes, refetch: refetchQuotes } = trpc.quotes.list.useQuery({ limit: 500 });
  const quoteList: any[] = Array.isArray(allQuotes) ? allQuotes : [];

  const { data: orcamentosSimples = [] } = trpc.orcamentosSimples?.list?.useQuery() || {};

  const createMutation = trpc.opportunities.create.useMutation({ onSuccess: () => { toast.success("Oportunidade criada!"); refetch(); setShowForm(false); setFormData({ ...emptyForm }); setClientSearch(""); }, });
  const updateMutation = trpc.opportunities.update.useMutation({ onSuccess: () => { toast.success("Oportunidade atualizada!"); refetch(); setShowForm(false); setEditingId(null); setFormData({ ...emptyForm }); setClientSearch(""); }, });
  const deleteMutation = trpc.opportunities.delete.useMutation({ onSuccess: () => { toast.success("Oportunidade excluida!"); refetch(); setDeleteId(null); }, });
  const moveStageMutation = trpc.opportunities.update.useMutation({ onSuccess: () => refetch() });
  const sendEmailMutation = trpc.quotes.sendEmail.useMutation({
    onSuccess: () => {
      toast.success("Orcamento enviado por email!");
      setShowSendQuoteDialog(false);
      setSelectedQuote(null);
      setEmailTo("");
      setCustomMessage("");
      refetchQuotes();
    },
    onError: (err: any) => toast.error("Erro ao enviar: " + err.message),
  });

  const clientMap = Object.fromEntries(clients.map((c: any) => [c.id, c.farmName || c.producerName || `Cliente ${c.id}`]));

  const opportunitiesByStage = STAGES.map(stage => ({
    ...stage,
    items: (opportunities as any[] || []).filter((o: any) => o.stage === stage.id),
    total: (opportunities as any[] || []).filter((o: any) => o.stage === stage.id).reduce((sum, o) => sum + parseFloat(o.value || "0"), 0),
  }));

  const totalPipeline = (opportunities as any[] || []).reduce((sum, o) => sum + parseFloat(o.value || "0"), 0);
  const totalConcluidas = (opportunities as any[] || []).filter((o: any) => o.stage === "venda_concluida").reduce((sum, o) => sum + parseFloat(o.value || "0"), 0);

  function handleEdit(opp: any) {
    setEditingId(opp.id);
    setFormData({
      clientId: opp.clientId,
      title: opp.title,
      description: opp.description || "",
      value: opp.value || "",
      probability: opp.probability || 0,
      stage: opp.stage,
      expectedCloseDate: opp.expectedCloseDate ? new Date(opp.expectedCloseDate).toISOString().split("T")[0] : "",
      quoteId: opp.quoteId ? String(opp.quoteId) : "",
    });
    setClientSearch(clientMap[opp.clientId] || "");
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.clientId || !formData.title) { toast.error("Preencha cliente e titulo"); return; }
    const payload = { 
      ...formData, 
      clientId: Number(formData.clientId), 
      value: String(formData.value || "0"), 
      probability: Number(formData.probability || 0), 
      quoteId: formData.quoteId ? Number(formData.quoteId) : undefined,
      expectedCloseDate: formData.expectedCloseDate ? new Date(formData.expectedCloseDate) : undefined,
      stage: formData.stage as any
    };
    if (editingId) updateMutation.mutate({ id: editingId, ...payload });
    else createMutation.mutate(payload);
  }

  function handleDragStart(event: DragStartEvent) {
    const opp = (opportunities as any[] || []).find((o: any) => o.id === event.active.id);
    setActiveOpp(opp || null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveOpp(null);
    if (!over) return;
    const newStage = over.id as string;
    const opp = (opportunities as any[] || []).find((o: any) => o.id === active.id);
    if (opp && newStage !== opp.stage) moveStageMutation.mutate({ id: opp.id, stage: newStage as any });
  }

  function moveStage(opp: any, direction: number) {
    const idx = STAGES.findIndex(s => s.id === opp.stage);
    const newIdx = idx + direction;
    if (newIdx >= 0 && newIdx < STAGES.length) moveStageMutation.mutate({ id: opp.id, stage: STAGES[newIdx].id as any });
  }

  function openSendQuoteDialog(quote: any) {
    setSelectedQuote(quote);
    const client = clients.find((c: any) => c.id === quote.clientId);
    setEmailTo(client?.email || "");
    setShowSendQuoteDialog(true);
  }

  function handleSendQuote() {
    if (!selectedQuote || !emailTo) { toast.error("Selecione o orcamento e informe o email"); return; }
    sendEmailMutation.mutate({ quoteId: selectedQuote.id, toEmail: emailTo, customMessage: customMessage || undefined });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="oportunidades">Oportunidades</TabsTrigger>
          <TabsTrigger value="orcamentos">Orcamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="oportunidades" className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Funil de Vendas</h1>
              <p className="text-slate-600">Acompanhe e gerencie suas oportunidades</p>
            </div>
            <Button onClick={() => { setEditingId(null); setFormData({ ...emptyForm }); setClientSearch(""); setShowForm(true); }} className="gap-2">
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
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
                    <DroppableColumn stageId={stage.id}>
                      <div className="space-y-2">
                        {stage.items.length === 0 && <p className="text-xs text-slate-400 text-center py-3">Nenhuma</p>}
                        {stage.items.map((opp: any) => (
                          <DraggableCard key={opp.id} opp={opp}>
                            <div className="bg-white rounded-lg p-3 shadow-sm border border-white/80 hover:shadow-md transition" onClick={() => handleEdit(opp)}>
                              <p className="font-medium text-sm leading-tight">{opp.title}</p>
                              {(() => {
                                const diasNaEtapa = Math.floor((Date.now() - new Date(opp.updatedAt).getTime()) / 86400000);
                                const alertaParada = diasNaEtapa >= 15 && opp.stage === "negociacao";
                                const alertaAtencao = diasNaEtapa >= 7 && ["visita_tecnica", "orcamento_enviado"].includes(opp.stage);
                                return (
                                  <>
                                    {opp.updatedAt && (
                                      <p className="text-[10px] text-slate-400">
                                        {Math.ceil((Date.now() - new Date(opp.updatedAt).getTime()) / 86400000)} dia(s) nesta etapa
                                      </p>
                                    )}
                                    {(alertaParada || alertaAtencao) && (
                                      <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${
                                        alertaParada ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                                      }`}>
                                        {alertaParada ? "🔴" : "🟡"} {diasNaEtapa}d parado
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
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
                          </DraggableCard>
                        ))}
                      </div>
                    </DroppableColumn>
                  </div>
                ))}
              </div>
              <DragOverlay>
                {activeOpp ? (
                  <div className="bg-white rounded-lg shadow-2xl border-2 border-primary p-3 opacity-95 rotate-1 w-64">
                    <p className="font-semibold text-sm truncate">{activeOpp.title}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      R$ {parseFloat(activeOpp.value || "0").toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </TabsContent>

        <TabsContent value="orcamentos" className="space-y-6">
          {/* Lista de Orcamentos */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Orcamentos</h1>
              <p className="text-slate-600">Gerencie e envie orcamentos para clientes</p>
            </div>
          </div>

          {/* Orcamentos do Sistema Antigo (quotes) */}
          {quoteList.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h3 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4" /> Orcamentos do Sistema</h3>
              </div>
              <table className="w-full">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-3 text-left">Numero</th>
                    <th className="p-3 text-left">Cliente</th>
                    <th className="p-3 text-right">Valor</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Data</th>
                    <th className="p-3 text-center">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {quoteList.map((q: any) => (
                    <tr key={q.id} className="border-t hover:bg-slate-50">
                      <td className="p-3 font-medium">{q.quoteNumber}</td>
                      <td className="p-3">{clientMap[q.clientId] || `Cliente ${q.clientId}`}</td>
                      <td className="p-3 text-right font-bold">{fmt(q.totalValue)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          q.status === "enviado" ? "bg-blue-100 text-blue-700" :
                          q.status === "aceito" ? "bg-green-100 text-green-700" :
                          q.status === "rejeitado" ? "bg-red-100 text-red-700" :
                          "bg-slate-100 text-slate-700"
                        }`}>
                          {q.status}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-slate-500">{new Date(q.createdAt).toLocaleDateString("pt-BR")}</td>
                      <td className="p-3 text-center">
                        <Button variant="outline" size="sm" onClick={() => openSendQuoteDialog(q)} disabled={sendEmailMutation.isPending}>
                          <Send className="w-3 h-3 mr-1" /> Enviar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Orcamentos Simples */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h3 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4" /> Orcamentos Rapidos</h3>
            </div>
            <table className="w-full">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-3 text-left">Cliente</th>
                  <th className="p-3 text-left">Produtos</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-left">Data</th>
                </tr>
              </thead>
              <tbody>
                {orcamentosSimples.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-500">Nenhum orcamento rapido</td></tr>
                ) : (
                  orcamentosSimples.map((o: any) => (
                    <tr key={o.id} className="border-t hover:bg-slate-50">
                      <td className="p-3">{o.clienteNome}</td>
                      <td className="p-3">{o.produtos?.length || 0} itens</td>
                      <td className="p-3 text-right font-bold">R$ {Number(o.total).toFixed(2)}</td>
                      <td className="p-3 text-sm text-slate-500">{new Date(o.criadoEm).toLocaleDateString("pt-BR")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog: criar/editar oportunidade */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingId(null); setFormData({ ...emptyForm }); setClientSearch(""); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Oportunidade" : "Nova Oportunidade"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Cliente *</label>
              <select 
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={formData.clientId || ""}
                onChange={(e) => {
                  const clientId = Number(e.target.value);
                  const c = clients.find((x: any) => x.id === clientId);
                  if (c) {
                    setFormData({ ...formData, clientId: c.id });
                    setClientSearch(c.farmName || c.producerName || "");
                  }
                }}
                disabled={!!editingId}
              >
                <option value="">Selecione o cliente...</option>
                {clientsLoading ? (
                  <option disabled>Carregando clientes...</option>
                ) : (
                  clients.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.farmName || c.producerName} {c.producerName && c.farmName ? `- ${c.producerName}` : ""}
                    </option>
                  ))
                )}
              </select>
              {formData.clientId > 0 && (
                <p className="mt-1 text-sm text-green-600">
                  Cliente selecionado: {clientSearch}
                </p>
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
              <label className="text-sm font-medium">Orcamento Vinculado (opcional)</label>
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
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingId(null); setFormData({ ...emptyForm }); setClientSearch(""); }}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? "Salvando..." : editingId ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: enviar orcamento por email */}
      <Dialog open={showSendQuoteDialog} onOpenChange={setShowSendQuoteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Orcamento por Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedQuote && (
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="font-medium">{selectedQuote.quoteNumber}</p>
                <p className="text-sm text-slate-600">Cliente: {clientMap[selectedQuote.clientId] || `Cliente ${selectedQuote.clientId}`}</p>
                <p className="text-sm text-slate-600">Valor: {fmt(selectedQuote.totalValue)}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Email do Destinatário *</label>
              <Input 
                type="email" 
                value={emailTo} 
                onChange={(e) => setEmailTo(e.target.value)} 
                placeholder="cliente@email.com" 
                className="mt-1" 
              />
            </div>
            <div>
              <label className="text-sm font-medium">Mensagem (opcional)</label>
              <textarea 
                value={customMessage} 
                onChange={(e) => setCustomMessage(e.target.value)} 
                placeholder="Digite uma mensagem para o cliente..." 
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm mt-1" 
                rows={3} 
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSendQuoteDialog(false)}>Cancelar</Button>
              <Button onClick={handleSendQuote} disabled={!emailTo || sendEmailMutation.isPending}>
                {sendEmailMutation.isPending ? "Enviando..." : "Enviar Email"}
              </Button>
            </DialogFooter>
          </div>
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