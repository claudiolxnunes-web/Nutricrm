import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShoppingCart, Search, RefreshCw, Package } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  faturado: "Faturado",
  cancelado: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-800 border-yellow-200",
  faturado: "bg-green-100 text-green-800 border-green-200",
  cancelado: "bg-red-100 text-red-800 border-red-200",
};

const fmt = (v: number | string) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("pt-BR");
};

export default function PedidosEmAberto() {
  const [search, setSearch] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("pendente");

  const { data, isLoading, refetch } = trpc.pedidos.list.useQuery({
    status: statusFiltro,
    limit: 200,
  });

  const pedidos: any[] = data?.data ?? [];
  const total = data?.total ?? 0;

  const pedidosFiltrados = search.trim()
    ? pedidos.filter((p) => {
        const q = search.toLowerCase();
        return (
          (p.pedidoNumber || "").toLowerCase().includes(q) ||
          (p.clienteNome || "").toLowerCase().includes(q) ||
          (p.representante || "").toLowerCase().includes(q) ||
          (p.observacoes || "").toLowerCase().includes(q)
        );
      })
    : pedidos;

  const totalValor = pedidosFiltrados.reduce(
    (sum, p) => sum + parseFloat(p.totalValue || "0"),
    0
  );
  const totalSacos = pedidosFiltrados.reduce(
    (sum, p) => sum + (p.qtdeSacos || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-8 h-8 text-primary" />
            Pedidos em Aberto
          </h1>
          <p className="text-slate-600 mt-1">
            Pedidos em carteira aguardando faturamento
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Pedidos em Aberto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{pedidosFiltrados.length}</div>
            <p className="text-xs text-slate-500 mt-1">de {total} total filtrado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Valor Total em Carteira</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{fmt(totalValor)}</div>
            <p className="text-xs text-slate-500 mt-1">soma dos pedidos exibidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total de Sacos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {totalSacos.toLocaleString("pt-BR")}
            </div>
            <p className="text-xs text-slate-500 mt-1">sacos em aberto</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por pedido, cliente ou representante..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              {["pendente", "faturado", "cancelado", "todos"].map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={statusFiltro === s ? "default" : "outline"}
                  onClick={() => setStatusFiltro(s)}
                  className="capitalize"
                >
                  {s === "todos" ? "Todos" : STATUS_LABELS[s] ?? s}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : pedidosFiltrados.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Pedidos</CardTitle>
            <CardDescription>
              {pedidosFiltrados.length} pedido(s) · Valor total: {fmt(totalValor)}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">Nº Pedido</TableHead>
                    <TableHead className="font-semibold">Data Pedido</TableHead>
                    <TableHead className="font-semibold">Prev. Faturamento</TableHead>
                    <TableHead className="font-semibold">Cliente</TableHead>
                    <TableHead className="font-semibold">Produto / Obs</TableHead>
                    <TableHead className="font-semibold text-right">Qtde Sacos</TableHead>
                    <TableHead className="font-semibold text-right">Valor Total</TableHead>
                    <TableHead className="font-semibold">Representante</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedidosFiltrados.map((p) => (
                    <TableRow key={p.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="font-mono text-sm font-medium">
                        {p.pedidoNumber || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {fmtDate(p.dataPedido)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {fmtDate(p.dataPrevFaturamento)}
                      </TableCell>
                      <TableCell className="font-medium max-w-[180px] truncate">
                        {p.clienteNome || `Cliente #${p.clientId}`}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 max-w-[220px]">
                        <span className="truncate block" title={p.observacoes || undefined}>
                          {p.observacoes || "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {(p.qtdeSacos || 0).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-700">
                        {fmt(p.totalValue || 0)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {p.representante || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`text-xs border ${STATUS_COLORS[p.status] ?? "bg-slate-100 text-slate-700"}`}
                        >
                          {STATUS_LABELS[p.status] ?? p.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-16 text-center text-slate-500">
            <Package className="w-14 h-14 mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-medium">Nenhum pedido encontrado</p>
            <p className="text-sm mt-1">
              {statusFiltro === "pendente"
                ? "Não há pedidos pendentes em carteira."
                : `Nenhum pedido com status "${STATUS_LABELS[statusFiltro] ?? statusFiltro}".`}
            </p>
            <p className="text-xs mt-2 text-slate-400">
              Importe pedidos em Importações → Pedidos em Carteira.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
