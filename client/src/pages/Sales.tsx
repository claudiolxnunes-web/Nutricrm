import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, DollarSign, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STATUS_COLORS: Record<string, string> = {
  pago: "bg-green-100 text-green-700",
  parcial: "bg-yellow-100 text-yellow-700",
  pendente: "bg-red-100 text-red-700",
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const emptyForm = {
  clientId: "",
  quoteId: "",
  totalValue: "",
  paymentStatus: "pendente" as "pago" | "parcial" | "pendente",
  saleDate: new Date().toISOString().split("T")[0],
  notes: "",
};

export default function Sales() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [clientSearch, setClientSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
  const lastDay = today.toISOString().split("T")[0];

  const [dateRange, setDateRange] = useState({ startDate: firstDay, endDate: lastDay });

  const { data: sales = [], isLoading, refetch } = trpc.sales.list.useQuery({
    startDate: new Date(dateRange.startDate),
    endDate: new Date(dateRange.endDate),
    limit: 200,
  });

  const { data: allClients } = trpc.clients.list.useQuery({ limit: 2000 });
  const { data: allQuotes } = trpc.quotes.list.useQuery({ limit: 500 });

  const clientList: any[] = (allClients as any)?.data ?? (Array.isArray(allClients) ? allClients : []);
  const quoteList: any[] = Array.isArray(allQuotes) ? allQuotes : [];

  const clientMap: Record<number, string> = {};
  clientList.forEach((c: any) => { clientMap[c.id] = c.farmName || c.producerName || `Cliente #${c.id}`; });

  const filteredClients = clientSearch
    ? clientList.filter((c: any) =>
        `${c.farmName} ${c.producerName}`.toLowerCase().includes(clientSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  const createMutation = trpc.sales.create.useMutation({
    onSuccess: () => {
      toast.success("Venda registrada com sucesso!");
      setShowForm(false);
      setFormData({ ...emptyForm });
      setClientSearch("");
      refetch();
    },
    onError: (e) => toast.error(e.message || "Erro ao registrar venda"),
  });

  const totalSales = Array.isArray(sales)
    ? sales.reduce((s: number, sale: any) => s + parseFloat(sale.totalValue || "0"), 0)
    : 0;
  const paidCount = Array.isArray(sales) ? sales.filter((s: any) => s.paymentStatus === "pago").length : 0;
  const pendingCount = Array.isArray(sales) ? sales.filter((s: any) => s.paymentStatus === "pendente").length : 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.clientId || !formData.totalValue) {
      toast.error("Preencha cliente e valor");
      return;
    }
    createMutation.mutate({
      clientId: Number(formData.clientId),
      quoteId: formData.quoteId ? Number(formData.quoteId) : undefined,
      totalValue: formData.totalValue,
      paymentStatus: formData.paymentStatus,
      saleDate: new Date(formData.saleDate),
      notes: formData.notes || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vendas</h1>
          <p className="text-slate-600">Registro e acompanhamento de vendas realizadas</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="w-4 h-4" /> Registrar Venda
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total no Período</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-emerald-600">{fmt(totalSales)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pagas</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{paidCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pendentes</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{pendingCount}</div></CardContent>
        </Card>
      </div>

      {/* Filtro de período */}
      <Card>
        <CardHeader><CardTitle className="text-base">Filtrar por Período</CardTitle></CardHeader>
        <CardContent className="flex gap-4 flex-wrap">
          <div>
            <label className="text-sm font-medium">Data Inicial</label>
            <Input type="date" value={dateRange.startDate} onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">Data Final</label>
            <Input type="date" value={dateRange.endDate} onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      {/* Formulário nova venda */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Registrar Nova Venda</CardTitle>
            <CardDescription>Registre uma venda concluída com cliente e valor</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Busca de cliente */}
              <div className="relative">
                <label className="text-sm font-medium">Cliente *</label>
                <Input
                  value={clientSearch}
                  onChange={(e) => { setClientSearch(e.target.value); setFormData({ ...formData, clientId: "" }); }}
                  placeholder="Digite o nome da fazenda ou produtor..."
                  className="mt-1"
                />
                {filteredClients.length > 0 && !formData.clientId && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredClients.map((c: any) => (
                      <button key={c.id} type="button"
                        onMouseDown={() => {
                          setFormData({ ...formData, clientId: String(c.id) });
                          setClientSearch(c.farmName || c.producerName);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-slate-50 last:border-0"
                      >
                        {c.farmName || c.producerName}
                        {c.city ? <span className="text-slate-400 ml-2 text-xs">{c.city}/{c.state}</span> : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Valor Total (R$) *</label>
                  <Input type="number" step="0.01" min="0" value={formData.totalValue}
                    onChange={(e) => setFormData({ ...formData, totalValue: e.target.value })}
                    placeholder="0,00" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Data da Venda</label>
                  <Input type="date" value={formData.saleDate}
                    onChange={(e) => setFormData({ ...formData, saleDate: e.target.value })}
                    className="mt-1" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Status de Pagamento</label>
                  <select value={formData.paymentStatus}
                    onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value as any })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md">
                    <option value="pendente">Pendente</option>
                    <option value="parcial">Parcial</option>
                    <option value="pago">Pago</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Orçamento vinculado (opcional)</label>
                  <select value={formData.quoteId}
                    onChange={(e) => setFormData({ ...formData, quoteId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md">
                    <option value="">Nenhum</option>
                    {quoteList.filter((q: any) => q.status === "aceito").map((q: any) => (
                      <option key={q.id} value={q.id}>{q.quoteNumber} — {clientMap[q.clientId] || `#${q.clientId}`}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Observações</label>
                <textarea value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2} placeholder="Condições de entrega, observações..."
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md text-sm resize-none" />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Salvando..." : "Registrar Venda"}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setFormData({ ...emptyForm }); setClientSearch(""); }}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Lista de vendas */}
      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : Array.isArray(sales) && sales.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Vendas no Período</CardTitle>
            <CardDescription>{sales.length} venda(s) · Total: {fmt(totalSales)}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-2 px-2 font-semibold">Data</th>
                    <th className="text-left py-2 px-2 font-semibold">Cliente</th>
                    <th className="text-right py-2 px-2 font-semibold">Valor</th>
                    <th className="text-left py-2 px-2 font-semibold">Pagamento</th>
                    <th className="py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {(sales as any[]).map((sale: any) => (
                    <tr key={sale.id} className="border-b hover:bg-slate-50">
                      <td className="py-2 px-2">{new Date(sale.saleDate).toLocaleDateString("pt-BR")}</td>
                      <td className="py-2 px-2 font-medium">{clientMap[sale.clientId] || `Cliente #${sale.clientId}`}</td>
                      <td className="py-2 px-2 text-right font-bold text-emerald-700">
                        {fmt(parseFloat(sale.totalValue))}
                      </td>
                      <td className="py-2 px-2">
                        <Badge className={STATUS_COLORS[sale.paymentStatus] || ""}>{sale.paymentStatus}</Badge>
                      </td>
                      <td className="py-2 px-2">
                        <button onClick={() => setDeleteId(sale.id)} className="text-red-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            <DollarSign className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>Nenhuma venda registrada no período.</p>
            <p className="text-sm mt-1">Clique em "Registrar Venda" para começar.</p>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir venda?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => setDeleteId(null)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
