import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, FileText, Search, Trash2, Package, CheckCircle, XCircle, Send, Clock, AlertCircle, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  rascunho:  { label: "Rascunho",  color: "bg-slate-100 text-slate-600 border-slate-200",  icon: Clock },
  enviado:   { label: "Enviado",   color: "bg-blue-100 text-blue-700 border-blue-200",     icon: Send },
  aceito:    { label: "Aceito",    color: "bg-green-100 text-green-700 border-green-200",  icon: CheckCircle },
  rejeitado: { label: "Rejeitado", color: "bg-red-100 text-red-700 border-red-200",        icon: XCircle },
  expirado:  { label: "Expirado",  color: "bg-orange-100 text-orange-700 border-orange-200", icon: AlertCircle },
};

const CLIENT_STATUS_COLOR: Record<string, string> = {
  ativo:    "bg-green-100 text-green-700",
  inativo:  "bg-slate-100 text-slate-500",
  prospect: "bg-blue-100 text-blue-600",
};

const UNITS = ["saco","kg","ton","litro","caixa","unidade","fardo","pallet"];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

function daysUntil(createdAt: any, validityDays: number): number {
  if (!createdAt) return 0;
  const expiry = new Date(createdAt).getTime() + validityDays * 86400000;
  return Math.ceil((expiry - Date.now()) / 86400000);
}

type Item = { productId?: number; productName: string; quantity: string; unitPrice: string; unit: string };

const emptyItem = (): Item => ({ productName: "", quantity: "1", unitPrice: "0", unit: "saco" });

export default function Quotes() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterValidade, setFilterValidade] = useState("todos");
  const [showForm, setShowForm] = useState(false);
  const [formStep, setFormStep] = useState(0); // 0=cliente 1=produtos 2=dados
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [changingStatusId, setChangingStatusId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Form state
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [discount, setDiscount] = useState(0);
  const [productSearch, setProductSearch] = useState<string[]>([""]);
  const [quoteNumber, setQuoteNumber] = useState(() => `ORC-${new Date().getFullYear()}-${String(Math.floor(Math.random()*900)+100)}`);
  const [validityDays, setValidityDays] = useState(30);
  const [notes, setNotes] = useState("");

  const { data: quotes = [], isLoading, refetch } = trpc.quotes.list.useQuery({ search, status: filterStatus || undefined, limit: 100 });
  const { data: allClients = [] } = trpc.clients.list.useQuery({ limit: 1000 });
  const { data: allProducts = [] } = trpc.products.list.useQuery({ limit: 500 });
  const { data: expandedQuote } = trpc.quotes.getWithItems.useQuery({ id: expandedId! }, { enabled: expandedId !== null });

  const clientList = (allClients as any)?.data ?? allClients ?? [];
  const productList = (allProducts as any)?.data ?? allProducts ?? [];

  const createMutation = trpc.quotes.create.useMutation({
    onSuccess: () => { toast.success("Orçamento criado!"); resetForm(); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.quotes.delete.useMutation({
    onSuccess: () => { toast.success("Excluído."); setDeleteId(null); refetch(); },
    onError: () => toast.error("Erro ao excluir"),
  });

  const statusMutation = trpc.quotes.updateStatus.useMutation({
    onSuccess: () => { toast.success("Status atualizado!"); setChangingStatusId(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setShowForm(false); setFormStep(0); setSelectedClient(null); setClientSearch("");
    setItems([emptyItem()]); setDiscount(0); setProductSearch([""]); setNotes("");
    setValidityDays(30); setQuoteNumber(`ORC-${new Date().getFullYear()}-${String(Math.floor(Math.random()*900)+100)}`);
  }

  function updateItem(i: number, field: keyof Item, val: string) {
    const next = [...items];
    (next[i] as any)[field] = val;
    setItems(next);
  }

  function removeItem(i: number) { setItems(items.filter((_, idx) => idx !== i)); setProductSearch(productSearch.filter((_, idx) => idx !== i)); }
  function addItem() { setItems([...items, emptyItem()]); setProductSearch([...productSearch, ""]); }

  const subtotal = items.reduce((s, it) => s + (parseFloat(it.quantity)||0) * (parseFloat(it.unitPrice)||0), 0);
  const total = subtotal * (1 - discount / 100);

  function handleSubmit() {
    if (!selectedClient) { toast.error("Selecione um cliente"); setFormStep(0); return; }
    if (items.some(i => !i.productName && !i.productId)) { toast.error("Preencha o nome de todos os produtos"); setFormStep(1); return; }
    createMutation.mutate({
      clientId: selectedClient.id,
      quoteNumber,
      validityDays,
      notes: notes || undefined,
      discount,
      items: items.map(it => ({
        productId: it.productId,
        productName: it.productName,
        quantity: String(parseFloat(it.quantity)||1),
        unitPrice: String(parseFloat(it.unitPrice)||0),
        totalPrice: String((parseFloat(it.quantity)||1) * (parseFloat(it.unitPrice)||0)),
        unit: it.unit,
      })),
    });
  }

  const filtered = (quotes as any[]).filter(q => {
    if (filterValidade === "validos") return daysUntil(q.createdAt, q.validityDays) > 0;
    if (filterValidade === "vencidos") return daysUntil(q.createdAt, q.validityDays) <= 0;
    return true;
  });

  const STEPS = ["Cliente", "Produtos", "Dados & Salvar"];

  return (
    <div className="space-y-5 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Orçamentos</h1>
          <p className="text-sm text-slate-400">{(quotes as any[]).length} orçamento(s) encontrado(s)</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Orçamento
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por cliente ou número..." className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterValidade} onChange={e => setFilterValidade(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none">
          <option value="todos">Todas validades</option>
          <option value="validos">Válidos</option>
          <option value="vencidos">Vencidos</option>
        </select>
      </div>

      {/* Lista de cards */}
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <FileText className="w-14 h-14 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Nenhum orçamento encontrado</p>
          <p className="text-sm mt-1">Crie um novo orçamento para começar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((q: any) => {
            const days = daysUntil(q.createdAt, q.validityDays);
            const expired = days <= 0;
            const cfg = STATUS_CONFIG[q.status] || STATUS_CONFIG.rascunho;
            const StatusIcon = cfg.icon;
            const displayTotal = parseFloat(q.itemsTotal || q.finalValue || q.totalValue || "0");
            const isExpanded = expandedId === q.id;
            return (
              <div key={q.id} className={`bg-white rounded-xl border ${expired && q.status !== "aceito" ? "border-orange-200" : "border-slate-200"} shadow-sm hover:shadow-md transition`}>
                <div className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    {/* Left */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800">{q.quoteNumber}</span>
                        <Badge className={`text-xs border ${cfg.color} flex items-center gap-1`}>
                          <StatusIcon className="w-3 h-3" />{cfg.label}
                        </Badge>
                        {q.clientStatus && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CLIENT_STATUS_COLOR[q.clientStatus] || "bg-slate-100 text-slate-500"}`}>
                            {q.clientStatus}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-700 font-medium mt-0.5">{q.clientName || `Cliente #${q.clientId}`}</p>
                      <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-slate-400">
                        <span>Criado em {fmtDate(q.createdAt)}</span>
                        <span className={expired && q.status !== "aceito" ? "text-red-500 font-medium" : "text-slate-400"}>
                          {expired ? `Vencido há ${Math.abs(days)} dias` : `Válido por mais ${days} dias`}
                        </span>
                        <span className="flex items-center gap-1"><Package className="w-3 h-3" />{q.itemCount || 0} produto(s)</span>
                      </div>
                    </div>
                    {/* Right */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-xl font-bold text-emerald-600">{fmt(displayTotal)}</p>
                        {q.discount > 0 && <p className="text-xs text-slate-400">Desconto: {q.discount}%</p>}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setExpandedId(isExpanded ? null : q.id)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg" title="Ver itens">
                          <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </button>
                        <button onClick={() => setChangingStatusId(q.id)} className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Alterar status">
                          <Send className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteId(q.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Excluir">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Itens expandidos */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50 rounded-b-xl">
                    {!expandedQuote ? (
                      <p className="text-sm text-slate-400">Carregando itens...</p>
                    ) : expandedQuote.items?.length === 0 ? (
                      <p className="text-sm text-slate-400">Nenhum item neste orçamento.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead><tr className="text-xs text-slate-400 border-b border-slate-200">
                          <th className="text-left pb-1">Produto</th>
                          <th className="text-right pb-1">Qtd</th>
                          <th className="text-right pb-1">Und</th>
                          <th className="text-right pb-1">Unit.</th>
                          <th className="text-right pb-1">Total</th>
                        </tr></thead>
                        <tbody>
                          {expandedQuote.items.map((it: any, i: number) => (
                            <tr key={i} className="border-b border-slate-100 last:border-0">
                              <td className="py-1.5 font-medium text-slate-700">{it.productName || `Produto #${it.productId}`}</td>
                              <td className="text-right text-slate-600">{it.quantity}</td>
                              <td className="text-right text-slate-400">{it.unit || "—"}</td>
                              <td className="text-right text-slate-600">{fmt(parseFloat(it.unitPrice||"0"))}</td>
                              <td className="text-right font-semibold text-slate-800">{fmt(parseFloat(it.totalPrice||"0"))}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot><tr>
                          <td colSpan={4} className="text-right text-xs text-slate-400 pt-2">Total do orçamento:</td>
                          <td className="text-right font-bold text-emerald-600 pt-2">{fmt(displayTotal)}</td>
                        </tr></tfoot>
                      </table>
                    )}
                    {expandedQuote?.notes && <p className="text-xs text-slate-400 mt-2 border-t border-slate-100 pt-2">Obs: {expandedQuote.notes}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ========== MODAL NOVO ORÇAMENTO ========== */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" /> Novo Orçamento
            </DialogTitle>
          </DialogHeader>

          {/* Steps */}
          <div className="flex gap-1 mb-4">
            {STEPS.map((label, i) => (
              <button key={i} onClick={() => setFormStep(i)} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${formStep === i ? "bg-primary text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                {i + 1}. {label}
              </button>
            ))}
          </div>

          {/* STEP 0 — Cliente */}
          {formStep === 0 && (
            <div className="space-y-3">
              {selectedClient ? (
                <div className="flex items-center gap-3 p-3 border-2 border-green-300 bg-green-50 rounded-xl">
                  <div className="flex-1">
                    <p className="font-bold text-green-800">{selectedClient.farmName || selectedClient.producerName}</p>
                    {selectedClient.farmName && <p className="text-sm text-green-600">{selectedClient.producerName}</p>}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CLIENT_STATUS_COLOR[selectedClient.status] || "bg-slate-100 text-slate-500"}`}>{selectedClient.status}</span>
                  </div>
                  <button onClick={() => setSelectedClient(null)} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Buscar cliente *</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input type="text" value={clientSearch} onChange={e => setClientSearch(e.target.value)} placeholder="Digite o nome da fazenda ou produtor..." className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div className="border border-slate-200 rounded-lg bg-white max-h-52 overflow-y-auto">
                    {clientList.filter((c: any) => { const q = clientSearch.toLowerCase(); return !q || (c.farmName||"").toLowerCase().includes(q) || (c.producerName||"").toLowerCase().includes(q); }).slice(0, 30).map((c: any) => (
                      <button key={c.id} type="button" onMouseDown={e => { e.preventDefault(); setSelectedClient(c); setClientSearch(""); }} className="w-full text-left px-3 py-2.5 hover:bg-blue-50 flex items-center justify-between border-b border-slate-50 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{c.farmName || c.producerName}</p>
                          {c.farmName && <p className="text-xs text-slate-400">{c.producerName}</p>}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${CLIENT_STATUS_COLOR[c.status] || "bg-slate-100 text-slate-500"}`}>{c.status}</span>
                      </button>
                    ))}
                    {clientList.filter((c: any) => { const q = clientSearch.toLowerCase(); return !q || (c.farmName||"").toLowerCase().includes(q) || (c.producerName||"").toLowerCase().includes(q); }).length === 0 && <p className="px-3 py-3 text-sm text-slate-400 text-center">Nenhum cliente encontrado</p>}
                  </div>
                </div>
              )}
              <div className="flex justify-end pt-2">
                <Button disabled={!selectedClient} onClick={() => setFormStep(1)}>Próximo: Produtos →</Button>
              </div>
            </div>
          )}

          {/* STEP 1 — Produtos */}
          {formStep === 1 && (
            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Item {i + 1}</span>
                    {items.length > 1 && <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>}
                  </div>
                  {/* Product search / free text */}
                  <div className="relative">
                    <input
                      type="text"
                      value={productSearch[i] ?? item.productName}
                      onChange={e => {
                        const ps = [...productSearch]; ps[i] = e.target.value;
                        setProductSearch(ps);
                        updateItem(i, "productName", e.target.value);
                        updateItem(i, "productId" as any, "");
                      }}
                      placeholder="Nome do produto (catálogo ou digitar livremente)..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    {productSearch[i] && productList.filter((p: any) => (p.name||"").toLowerCase().includes((productSearch[i]||"").toLowerCase())).length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-36 overflow-y-auto">
                        {productList.filter((p: any) => (p.name||"").toLowerCase().includes((productSearch[i]||"").toLowerCase())).slice(0, 10).map((p: any) => (
                          <button key={p.id} type="button" onMouseDown={e => { e.preventDefault(); const ps = [...productSearch]; ps[i] = p.name; setProductSearch(ps); updateItem(i, "productName", p.name); updateItem(i, "productId" as any, String(p.id)); updateItem(i, "unitPrice", String(p.price || "0")); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 flex justify-between border-b border-slate-50 last:border-0">
                            <span>{p.name}</span><span className="text-slate-400 text-xs">{p.price ? fmt(parseFloat(p.price)) : ""}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="text-xs text-slate-400">Qtd</label>
                      <input type="number" min="0" step="0.01" value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Unidade</label>
                      <select value={item.unit} onChange={e => updateItem(i, "unit", e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none">
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Preço unit. (R$)</label>
                      <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(i, "unitPrice", e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Total</label>
                      <div className="px-2 py-1.5 bg-slate-100 rounded-md text-sm font-semibold text-emerald-700">
                        {fmt((parseFloat(item.quantity)||0) * (parseFloat(item.unitPrice)||0))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addItem} className="w-full gap-2 border-dashed">
                <Plus className="w-4 h-4" /> Adicionar produto
              </Button>
              {/* Totais */}
              <div className="border-t border-slate-200 pt-3 space-y-2">
                <div className="flex justify-between text-sm text-slate-600"><span>Subtotal:</span><span>{fmt(subtotal)}</span></div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Desconto (%):</span>
                  <input type="number" min="0" max="100" value={discount} onChange={e => setDiscount(parseFloat(e.target.value)||0)} className="w-20 px-2 py-1 border border-slate-300 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="flex justify-between font-bold text-lg"><span>Total Final:</span><span className="text-emerald-600">{fmt(total)}</span></div>
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setFormStep(0)}>← Voltar</Button>
                <Button onClick={() => setFormStep(2)}>Próximo: Dados →</Button>
              </div>
            </div>
          )}

          {/* STEP 2 — Dados & Salvar */}
          {formStep === 2 && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl text-sm space-y-1 border border-slate-200">
                <p><span className="text-slate-400">Cliente:</span> <strong>{selectedClient?.farmName || selectedClient?.producerName}</strong></p>
                <p><span className="text-slate-400">Itens:</span> {items.length} produto(s) · Total: <strong className="text-emerald-600">{fmt(total)}</strong></p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Número do Orçamento *</label>
                  <input value={quoteNumber} onChange={e => setQuoteNumber(e.target.value)} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-sm font-medium">Validade (dias)</label>
                  <input type="number" value={validityDays} onChange={e => setValidityDays(parseInt(e.target.value)||30)} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Notas / Condições de pagamento</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Ex: Pagamento em 30 dias, frete incluso, condições especiais..." className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setFormStep(1)}>← Voltar</Button>
                <Button onClick={handleSubmit} disabled={createMutation.isPending} className="gap-2">
                  <FileText className="w-4 h-4" />{createMutation.isPending ? "Salvando..." : "Salvar Orçamento"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal alterar status */}
      <Dialog open={changingStatusId !== null} onOpenChange={o => { if (!o) setChangingStatusId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Alterar Status do Orçamento</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-2 py-2">
            {Object.entries(STATUS_CONFIG).map(([k, v]) => {
              const Icon = v.icon;
              return (
                <button key={k} onClick={() => statusMutation.mutate({ id: changingStatusId!, status: k as any })} disabled={statusMutation.isPending}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all hover:scale-[1.02] ${v.color}`}>
                  <Icon className="w-4 h-4" />{v.label}
                </button>
              );
            })}
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setChangingStatusId(null)}>Cancelar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação excluir */}
      <AlertDialog open={deleteId !== null} onOpenChange={o => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir orçamento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate({ id: deleteId! })} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}