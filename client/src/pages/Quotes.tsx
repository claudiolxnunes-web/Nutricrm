import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, FileText, Trash2, CheckCircle, XCircle, Send, Clock, AlertCircle, Download, Pencil, X, Search } from "lucide-react";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  rascunho:  { label: "Rascunho",  color: "bg-slate-100 text-slate-600 border-slate-200",    icon: Clock },
  enviado:   { label: "Enviado",   color: "bg-blue-100 text-blue-700 border-blue-200",       icon: Send },
  aceito:    { label: "Aceito",    color: "bg-green-100 text-green-700 border-green-200",    icon: CheckCircle },
  rejeitado: { label: "Rejeitado", color: "bg-red-100 text-red-700 border-red-200",          icon: XCircle },
  expirado:  { label: "Expirado",  color: "bg-orange-100 text-orange-700 border-orange-200", icon: AlertCircle },
};

const UNITS = ["un", "saco", "kg", "ton", "litro", "caixa", "fardo", "pallet"];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

type Item = {
  productId?: number;
  productName: string;
  quantity: string;
  unitPrice: string;
  unit: string;
  totalPrice: string;
};

const emptyItem = (): Item => ({ productId: undefined, productName: "", quantity: "1", unitPrice: "0", unit: "un", totalPrice: "0" });

export default function Quotes() {
  const [filterStatus, setFilterStatus] = useState("");

  // Modal de criação
  const [showForm, setShowForm] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [validityDays, setValidityDays] = useState(30);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [showClientList, setShowClientList] = useState(false);

  // Modal alterar status
  const [changingStatusId, setChangingStatusId] = useState<number | null>(null);

  // Modal editar
  const [editingQuote, setEditingQuote] = useState<any | null>(null);
  const [editValidityDays, setEditValidityDays] = useState(30);
  const [editDiscount, setEditDiscount] = useState(0);
  const [editNotes, setEditNotes] = useState("");

  // Envio de email
  const [sendingEmail, setSendingEmail] = useState<{ quoteId: number; toEmail: string; message: string } | null>(null);

  // Excluir
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Dados
  const { data: quotes = [], isLoading, refetch } = trpc.quotes.list.useQuery({ limit: 100 });
  const { data: allClients = [] } = trpc.clients.list.useQuery({ limit: 500 });
  const { data: allProducts = [] } = trpc.products.list.useQuery({ limit: 200 });
  const utils = trpc.useUtils();

  const clientList: any[] = (allClients as any)?.data ?? (allClients as any[]) ?? [];
  const productList: any[] = (allProducts as any)?.data ?? (allProducts as any[]) ?? [];
  const quoteList: any[] = Array.isArray((quotes as any)?.data) 
    ? (quotes as any).data 
    : Array.isArray(quotes) ? quotes as any[] : [];

  const selectedClient = clientList.find((c: any) => c.id === selectedClientId) ?? null;

  // Mutations
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

  const updateMutation = trpc.quotes.update.useMutation({
    onSuccess: () => { toast.success("Orçamento atualizado!"); setEditingQuote(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const sendEmailMutation = trpc.quotes.sendEmail.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Orçamento enviado para ${data.sentTo}`);
      setSendingEmail(null);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  // Helpers de formulário
  function resetForm() {
    setShowForm(false);
    setClientSearch("");
    setSelectedClientId(null);
    setShowClientList(false);
    setValidityDays(30);
    setDiscount(0);
    setNotes("");
    setItems([emptyItem()]);
  }

  function updateItem(idx: number, field: keyof Item, val: string) {
    const next = [...items];
    (next[idx] as any)[field] = val;
    setItems(next);
  }

  function addItem() {
    setItems(prev => [...prev, { productId: undefined, productName: "", quantity: "1", unitPrice: "0", unit: "un", totalPrice: "0" }]);
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  const total = items.reduce((s, i) => s + Number(i.quantity || 1) * Number(i.unitPrice || 0), 0);
  const totalWithDiscount = total * (1 - discount / 100);

  function handleSubmit() {
    if (!selectedClientId) { toast.error("Selecione um cliente"); return; }
    if (items.some(i => !i.productName.trim())) { toast.error("Preencha o nome de todos os produtos"); return; }
    createMutation.mutate({
      clientId: Number(selectedClientId),
      quoteNumber: `ORC-${Date.now()}`,
      validityDays: Number(validityDays) || 30,
      discount: Number(discount) || 0,
      notes: notes || undefined,
      items: items.map(i => ({
        productId: i.productId ? Number(i.productId) : undefined,
        productName: String(i.productName || ""),
        quantity: String(i.quantity || "1"),
        unitPrice: String(i.unitPrice || "0"),
        totalPrice: String(Number(i.quantity || 1) * Number(i.unitPrice || 0)),
        unit: String(i.unit || "un"),
      })),
    });
  }

  // PDF
  function buildPdfHtml(q: any, itens: any[]): string {
    const fmtR = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const fmtD = (d: any) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
    const statusLabel: Record<string, string> = { rascunho: "Rascunho", enviado: "Enviado", aceito: "Aceito", rejeitado: "Rejeitado", expirado: "Expirado" };
    const statusColor: Record<string, string> = { rascunho: "#64748b", enviado: "#2563eb", aceito: "#16a34a", rejeitado: "#dc2626", expirado: "#ea580c" };
    const subtotalVal = itens.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice || "0")), 0);
    const discountPct = parseFloat(q.discount || "0");
    const totalVal = subtotalVal * (1 - discountPct / 100);
    const expiryDate = q.createdAt ? new Date(new Date(q.createdAt).getTime() + (q.validityDays || 30) * 86400000).toLocaleDateString("pt-BR") : "—";
    const rowsHtml = itens.map((it, i) => `
      <tr style="background:${i % 2 === 0 ? "#f8fafc" : "#ffffff"}">
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0">${it.productName || `Produto #${it.productId}`}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right">${parseFloat(it.quantity).toLocaleString("pt-BR")}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center">${it.unit || "—"}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right">${fmtR(parseFloat(it.unitPrice || "0"))}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600">${fmtR(parseFloat(it.totalPrice || "0"))}</td>
      </tr>`).join("");
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
    <title>Orçamento ${q.quoteNumber}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:13px;color:#1e293b;background:#fff;padding:32px}@media print{body{padding:16px}.no-print{display:none}@page{margin:15mm}}</style>
    </head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #16a34a;padding-bottom:16px;margin-bottom:20px">
      <div><div style="font-size:22px;font-weight:800;color:#16a34a">NutriCRM</div><div style="font-size:11px;color:#64748b;margin-top:2px">Nutrição Animal — Sistema de Gestão</div></div>
      <div style="text-align:right"><div style="font-size:18px;font-weight:700;color:#1e293b">${q.quoteNumber}</div><div style="margin-top:4px"><span style="background:${statusColor[q.status] || "#64748b"};color:#fff;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600">${statusLabel[q.status] || q.status}</span></div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px">
        <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Cliente</div>
        <div style="font-size:15px;font-weight:700;color:#1e293b">${q.clientName || `Cliente #${q.clientId}`}</div>
        ${q.clientPhone ? `<div style="font-size:12px;color:#475569;margin-top:3px">Tel: ${q.clientPhone}</div>` : ""}
        ${q.clientEmail ? `<div style="font-size:12px;color:#475569;margin-top:2px">Email: ${q.clientEmail}</div>` : ""}
        ${q.clientCity ? `<div style="font-size:12px;color:#475569;margin-top:2px">${q.clientCity}${q.clientState ? "/" + q.clientState : ""}</div>` : ""}
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px">
        <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Validade</div>
        <div style="font-size:13px;color:#1e293b">Emitido em: <strong>${fmtD(q.createdAt)}</strong></div>
        <div style="font-size:13px;color:#1e293b;margin-top:3px">Válido até: <strong>${expiryDate}</strong></div>
        <div style="font-size:12px;color:#64748b;margin-top:3px">${q.validityDays || 30} dias de validade</div>
      </div>
    </div>
    <div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Produtos / Serviços</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <thead><tr style="background:#16a34a;color:#fff">
          <th style="padding:10px;text-align:left;font-size:12px">Produto</th>
          <th style="padding:10px;text-align:right;font-size:12px">Qtd</th>
          <th style="padding:10px;text-align:center;font-size:12px">Und</th>
          <th style="padding:10px;text-align:right;font-size:12px">Preço Unit.</th>
          <th style="padding:10px;text-align:right;font-size:12px">Total</th>
        </tr></thead>
        <tbody>${rowsHtml || '<tr><td colspan="5" style="padding:12px;text-align:center;color:#94a3b8">Nenhum item</td></tr>'}</tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:20px">
      <div style="min-width:260px">
        <div style="display:flex;justify-content:space-between;padding:6px 0;color:#64748b;font-size:13px"><span>Subtotal:</span><span>${fmtR(subtotalVal)}</span></div>
        ${discountPct > 0 ? `<div style="display:flex;justify-content:space-between;padding:6px 0;color:#dc2626;font-size:13px"><span>Desconto (${discountPct}%):</span><span>- ${fmtR(subtotalVal * discountPct / 100)}</span></div>` : ""}
        <div style="display:flex;justify-content:space-between;padding:10px 12px;background:#f0fdf4;border-radius:6px;border:2px solid #16a34a;margin-top:6px">
          <span style="font-size:16px;font-weight:800;color:#16a34a">TOTAL FINAL</span>
          <span style="font-size:16px;font-weight:800;color:#16a34a">${fmtR(totalVal)}</span>
        </div>
      </div>
    </div>
    ${q.notes ? `<div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px;margin-bottom:16px"><div style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;margin-bottom:4px">Observações / Condições</div><div style="font-size:13px;color:#1e293b">${q.notes}</div></div>` : ""}
    <div style="border-top:1px solid #e2e8f0;padding-top:12px;text-align:center;color:#94a3b8;font-size:11px">Este orçamento tem validade de ${q.validityDays || 30} dias a partir da data de emissão. · Gerado pelo NutriCRM</div>
    <div class="no-print" style="margin-top:24px;text-align:center">
      <button onclick="window.print()" style="background:#16a34a;color:#fff;border:none;padding:10px 28px;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer">Imprimir / Salvar como PDF</button>
    </div>
    </body></html>`;
  }

  async function exportPdf(q: any) {
    const clientData = clientList.find((c: any) => c.id === q.clientId);
    const qWithClient = {
      ...q,
      clientName: clientData?.farmName || clientData?.producerName || q.clientName,
      clientPhone: clientData?.phone || clientData?.whatsapp || "",
      clientEmail: clientData?.email || "",
      clientCity: clientData?.city || "",
      clientState: clientData?.state || "",
    };
    let itens: any[] = [];
    try {
      const data = await utils.quotes.getWithItems.fetch({ id: q.id });
      itens = data?.items ?? [];
    } catch {
      itens = [];
    }
    const html = buildPdfHtml(qWithClient, itens);
    const win = window.open("", "_blank", "width=850,height=950,scrollbars=yes");
    if (!win) { toast.error("Permita popups no navegador para exportar PDF"); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 600);
  }

  // Filtragem
  const filtered = quoteList.filter((q: any) => !filterStatus || q.status === filterStatus);

  return (
    <div className="space-y-5 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Orçamentos</h1>
          <p className="text-sm text-slate-400">{filtered.length} orçamento(s)</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Orçamento
        </Button>
      </div>

      {/* Filtro de status */}
      <div className="flex gap-2">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <FileText className="w-14 h-14 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Nenhum orçamento encontrado</p>
          <p className="text-sm mt-1">Crie um novo orçamento para começar</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Número</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Cliente</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Total</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Status</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Data</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((q: any) => {
                const cfg = STATUS_CONFIG[q.status] || STATUS_CONFIG.rascunho;
                const StatusIcon = cfg.icon;
                const displayTotal = parseFloat(q.itemsTotal || q.finalValue || q.totalValue || "0");
                return (
                  <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-800">{q.quoteNumber}</td>
                    <td className="px-4 py-3 text-slate-700">{q.clientName || `Cliente #${q.clientId}`}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">{fmt(displayTotal)}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge className={`text-xs border ${cfg.color} inline-flex items-center gap-1`}>
                        <StatusIcon className="w-3 h-3" />{cfg.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-400">{fmtDate(q.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {/* Alterar status */}
                        <button
                          onClick={() => setChangingStatusId(q.id)}
                          className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Alterar status"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                        {/* Editar */}
                        <button
                          onClick={() => {
                            setEditingQuote(q);
                            setEditValidityDays(q.validityDays || 30);
                            setEditDiscount(parseFloat(q.discount || "0"));
                            setEditNotes(q.notes || "");
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {/* Exportar PDF */}
                        <button
                          onClick={() => exportPdf(q)}
                          className="p-1.5 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
                          title="Exportar PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {/* Enviar email */}
                        <button
                          onClick={() => setSendingEmail({ quoteId: q.id, toEmail: q.clientEmail || "", message: "" })}
                          className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Enviar por Email"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                        </button>
                        {/* Excluir */}
                        <button
                          onClick={() => setDeleteId(q.id)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ========== MODAL NOVO ORÇAMENTO (formulário único) ========== */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" /> Novo Orçamento
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Cliente */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Cliente *</label>
              {selectedClient ? (
                <div className="flex items-center gap-3 p-3 border-2 border-green-300 bg-green-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-semibold text-green-800">{selectedClient.farmName || selectedClient.producerName}</p>
                    {selectedClient.farmName && <p className="text-xs text-green-600">{selectedClient.producerName}</p>}
                  </div>
                  <button
                    onClick={() => { setSelectedClientId(null); setClientSearch(""); setShowClientList(false); }}
                    className="text-slate-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={e => { setClientSearch(e.target.value); setShowClientList(true); }}
                      onFocus={() => setShowClientList(true)}
                      placeholder="Buscar cliente por nome..."
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  {showClientList && (
                    <div className="absolute z-30 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {clientList
                        .filter((c: any) => {
                          const q = clientSearch.toLowerCase();
                          return !q || (c.farmName || "").toLowerCase().includes(q) || (c.producerName || "").toLowerCase().includes(q);
                        })
                        .slice(0, 30)
                        .map((c: any) => (
                          <button
                            key={c.id}
                            type="button"
                            onMouseDown={e => { e.preventDefault(); setSelectedClientId(c.id); setClientSearch(""); setShowClientList(false); }}
                            className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-slate-50 last:border-0"
                          >
                            <p className="text-sm font-medium text-slate-800">{c.farmName || c.producerName}</p>
                            {c.farmName && <p className="text-xs text-slate-400">{c.producerName}</p>}
                          </button>
                        ))}
                      {clientList.filter((c: any) => {
                        const q = clientSearch.toLowerCase();
                        return !q || (c.farmName || "").toLowerCase().includes(q) || (c.producerName || "").toLowerCase().includes(q);
                      }).length === 0 && (
                        <p className="px-3 py-3 text-sm text-slate-400 text-center">Nenhum cliente encontrado</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Validade + Desconto */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Validade (dias)</label>
                <input
                  type="number"
                  min="1"
                  value={validityDays}
                  onChange={e => setValidityDays(parseInt(e.target.value) || 30)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Desconto (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={discount}
                  onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Notas */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Notas</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Condições de pagamento, frete, observações..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            {/* Produtos */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Produtos</p>

              {/* Cabeçalho colunas */}
              <div className="grid grid-cols-12 gap-2 px-1">
                <div className="col-span-4 text-xs text-slate-400 font-medium">Produto</div>
                <div className="col-span-2 text-xs text-slate-400 font-medium">Qtd</div>
                <div className="col-span-2 text-xs text-slate-400 font-medium">Und</div>
                <div className="col-span-2 text-xs text-slate-400 font-medium">Preço unit.</div>
                <div className="col-span-1 text-xs text-slate-400 font-medium text-right">Total</div>
                <div className="col-span-1" />
              </div>

              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-start">
                  {/* Produto */}
                  <div className="col-span-4">
                    <select
                      value={item.productId || ""}
                      onChange={(e) => {
                        const prod = productList.find((p: any) => p.id === Number(e.target.value));
                        setItems(prev => prev.map((it, i) => i === index ? {
                          ...it,
                          productId: prod ? prod.id : undefined,
                          productName: prod ? prod.name : it.productName,
                          unitPrice: prod ? String(prod.price || "0") : it.unitPrice,
                          unit: prod ? (prod.unit || "un") : it.unit,
                          totalPrice: String(Number(it.quantity) * Number(prod ? prod.price : it.unitPrice)),
                        } : it));
                      }}
                      className="border border-slate-300 rounded px-2 py-1 text-sm w-full"
                    >
                      <option value="">— Selecione ou digite —</option>
                      {productList.map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name} {p.productCode ? `(${p.productCode})` : ""}</option>
                      ))}
                    </select>
                    {!item.productId && (
                      <input
                        type="text"
                        placeholder="Ou digite o nome do produto"
                        value={item.productName || ""}
                        onChange={(e) => setItems(prev => prev.map((it, i) => i === index ? { ...it, productName: e.target.value } : it))}
                        className="border border-slate-300 rounded px-2 py-1 text-sm w-full mt-1"
                      />
                    )}
                  </div>
                  {/* Qtd */}
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.quantity}
                      onChange={e => updateItem(index, "quantity", e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  {/* Und */}
                  <div className="col-span-2">
                    <select
                      value={item.unit}
                      onChange={e => updateItem(index, "unit", e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none"
                    >
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  {/* Preço unit */}
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={e => updateItem(index, "unitPrice", e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  {/* Total */}
                  <div className="col-span-1 py-1.5 text-right text-sm font-semibold text-emerald-700">
                    {fmt(Number(item.quantity || 0) * Number(item.unitPrice || 0))}
                  </div>
                  {/* Remover */}
                  <div className="col-span-1 flex justify-center">
                    {items.length > 1 && (
                      <button onClick={() => removeItem(index)} className="p-1 text-red-400 hover:text-red-600">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addItem}
                className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1"
              >
                <Plus className="w-4 h-4" /> Adicionar produto
              </button>
            </div>

            {/* Total */}
            <div className="border-t border-slate-200 pt-3 space-y-1">
              {discount > 0 && (
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Subtotal:</span>
                  <span>{fmt(total)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-sm text-red-500">
                  <span>Desconto ({discount}%):</span>
                  <span>- {fmt(total * discount / 100)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg">
                <span>TOTAL:</span>
                <span className="text-emerald-600">{fmt(totalWithDiscount)}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending} className="gap-2">
              <FileText className="w-4 h-4" />
              {createMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== MODAL ALTERAR STATUS ========== */}
      <Dialog open={changingStatusId !== null} onOpenChange={o => { if (!o) setChangingStatusId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Alterar Status</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-2 py-2">
            {Object.entries(STATUS_CONFIG).map(([k, v]) => {
              const Icon = v.icon;
              return (
                <button
                  key={k}
                  onClick={() => statusMutation.mutate({ id: changingStatusId!, status: k as any })}
                  disabled={statusMutation.isPending}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all hover:scale-[1.01] ${v.color}`}
                >
                  <Icon className="w-4 h-4" />{v.label}
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setChangingStatusId(null)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== MODAL EDITAR ========== */}
      <Dialog open={editingQuote !== null} onOpenChange={o => { if (!o) setEditingQuote(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar {editingQuote?.quoteNumber}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Validade (dias)</label>
              <input
                type="number"
                value={editValidityDays}
                onChange={e => setEditValidityDays(parseInt(e.target.value) || 30)}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Desconto (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={editDiscount}
                onChange={e => setEditDiscount(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Notas / Condições</label>
              <textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                rows={3}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingQuote(null)}>Cancelar</Button>
            <Button
              onClick={() => updateMutation.mutate({ id: editingQuote.id, validityDays: editValidityDays, discount: String(editDiscount), notes: editNotes })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== CONFIRMAÇÃO EXCLUIR ========== */}
      <AlertDialog open={deleteId !== null} onOpenChange={o => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir orçamento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate({ id: deleteId! })} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ========== MODAL ENVIAR EMAIL ========== */}
      {sendingEmail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-1">Enviar Orçamento por Email</h3>
            <p className="text-sm text-slate-500 mb-4">O email será enviado com reply-to para o seu email.</p>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Para:</label>
                <input
                  type="email"
                  value={sendingEmail.toEmail}
                  onChange={e => setSendingEmail(prev => prev ? { ...prev, toEmail: e.target.value } : null)}
                  placeholder="cliente@email.com"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Mensagem personalizada <span className="text-slate-400">(opcional)</span>
                </label>
                <textarea
                  value={sendingEmail.message}
                  onChange={e => setSendingEmail(prev => prev ? { ...prev, message: e.target.value } : null)}
                  placeholder="Ex: Olá, conforme combinado segue o orçamento..."
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setSendingEmail(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => sendEmailMutation.mutate({
                  quoteId: sendingEmail.quoteId,
                  toEmail: sendingEmail.toEmail || undefined,
                  customMessage: sendingEmail.message || undefined,
                })}
                disabled={sendEmailMutation.isPending || !sendingEmail.toEmail}
                className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {sendEmailMutation.isPending ? "Enviando..." : "Enviar Orçamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
