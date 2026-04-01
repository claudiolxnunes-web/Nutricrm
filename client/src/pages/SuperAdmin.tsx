import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ShieldCheck, UserCheck, UserX, Clock, Search, CalendarDays, Trash2 } from "lucide-react";
import { toast } from "sonner";

const PERIODS = [
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
  { label: "180 dias", days: 180 },
  { label: "1 ano", days: 365 },
  { label: "2 anos", days: 730 },
  { label: "Vitalício (até 2099)", days: 27394 },
];

function daysLeft(date?: string | Date | null): number | null {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function fmtDate(date?: string | Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
}

export default function SuperAdmin() {
  const { data: me } = trpc.auth.me.useQuery();
  const { data: users = [], refetch } = trpc.superadmin.listUsers.useQuery(undefined, { enabled: me?.role === "superadmin" });

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [customDate, setCustomDate] = useState("");
  const [showModal, setShowModal] = useState(false);

  const grantMutation = trpc.superadmin.grantAccess.useMutation({
    onSuccess: (data) => {
      toast.success(`Acesso liberado até ${fmtDate(data.paidUntil)}`);
      refetch(); setShowModal(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const revokeMutation = trpc.superadmin.revokeAccess.useMutation({
    onSuccess: () => { toast.success("Acesso revogado."); refetch(); setShowModal(false); },
    onError: (e) => toast.error(e.message),
  });

  const setUntilMutation = trpc.superadmin.setUntil.useMutation({
    onSuccess: () => { toast.success("Data definida com sucesso."); refetch(); setShowModal(false); },
    onError: (e) => toast.error(e.message),
  });

  if (me?.role !== "superadmin") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">Acesso restrito ao superadministrador.</p>
      </div>
    );
  }

  const filtered = users.filter((u: any) => {
    const q = search.toLowerCase();
    return !q || (u.name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q) || (u.companyName ?? "").toLowerCase().includes(q);
  });

  const active = users.filter((u: any) => { const d = daysLeft(u.paidUntil); return d !== null && d > 0; }).length;
  const expired = users.filter((u: any) => { const d = daysLeft(u.paidUntil); return d !== null && d <= 0; }).length;
  const trial = users.filter((u: any) => !u.paidUntil && u.trialEndsAt && daysLeft(u.trialEndsAt) !== null && (daysLeft(u.trialEndsAt) ?? 0) > 0).length;

  return (
    <div className="space-y-6 p-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Painel Superadmin</h1>
          <p className="text-sm text-slate-400">Gerencie o acesso de todos os usuários</p>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total usuários", value: users.length, color: "text-slate-700" },
          { label: "Acessos ativos", value: active, color: "text-green-600" },
          { label: "Em trial", value: trial, color: "text-blue-600" },
          { label: "Expirados", value: expired, color: "text-red-500" },
        ].map(({ label, value, color }) => (
          <Card key={label} className="text-center p-4">
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-400 mt-1">{label}</p>
          </Card>
        ))}
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, e-mail ou empresa..."
          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Lista de usuários */}
      <div className="space-y-2">
        {filtered.map((u: any) => {
          const days = daysLeft(u.paidUntil);
          const trialDays = daysLeft(u.trialEndsAt);
          const isActive = days !== null && days > 0;
          const isExpired = days !== null && days <= 0;
          const inTrial = !u.paidUntil && trialDays !== null && trialDays > 0;
          return (
            <div
              key={u.id}
              className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-white rounded-xl border transition-all cursor-pointer hover:border-primary/40 hover:shadow-sm ${isExpired ? "border-red-200 bg-red-50/30" : "border-slate-200"}`}
              onClick={() => { setSelected(u); setCustomDate(""); setShowModal(true); }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800 truncate">{u.name || "Sem nome"}</span>
                  <Badge variant="outline" className="text-xs">{u.role}</Badge>
                  {u.role === "superadmin" && <Badge className="text-xs bg-purple-100 text-purple-700">superadmin</Badge>}
                </div>
                <p className="text-sm text-slate-400 truncate">{u.email} · {u.companyName || `Empresa #${u.companyId}`}</p>
                <p className="text-xs text-slate-300">Criado em {fmtDate(u.createdAt)} · Último acesso {fmtDate(u.lastSignedIn)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                {isActive && (
                  <div className="text-center">
                    <Badge className="bg-green-100 text-green-700 border-green-200">
                      <UserCheck className="w-3 h-3 mr-1" /> Ativo até {fmtDate(u.paidUntil)}
                    </Badge>
                    <p className="text-xs text-green-600 mt-0.5">{days} dias restantes</p>
                  </div>
                )}
                {isExpired && (
                  <Badge className="bg-red-100 text-red-600 border-red-200">
                    <UserX className="w-3 h-3 mr-1" /> Expirado em {fmtDate(u.paidUntil)}
                  </Badge>
                )}
                {inTrial && (
                  <Badge className="bg-blue-100 text-blue-600 border-blue-200">
                    <Clock className="w-3 h-3 mr-1" /> Trial: {trialDays}d restantes
                  </Badge>
                )}
                {!u.paidUntil && !inTrial && (
                  <Badge className="bg-slate-100 text-slate-500">Sem acesso definido</Badge>
                )}
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setSelected(u); setCustomDate(""); setShowModal(true); }}>
                  Gerenciar
                </Button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-slate-400 py-10">Nenhum usuário encontrado</p>
        )}
      </div>

      {/* Modal de gerenciamento */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Gerenciar acesso
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg text-sm space-y-1">
                <p><span className="text-slate-400">Usuário:</span> <strong>{selected.name || selected.email}</strong></p>
                <p><span className="text-slate-400">E-mail:</span> {selected.email}</p>
                <p><span className="text-slate-400">Empresa:</span> {selected.companyName || `#${selected.companyId}`}</p>
                <p><span className="text-slate-400">Acesso atual:</span> {selected.paidUntil ? `até ${fmtDate(selected.paidUntil)} (${daysLeft(selected.paidUntil)} dias)` : "Sem acesso pago"}</p>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Liberar acesso por:</p>
                <div className="grid grid-cols-3 gap-2">
                  {PERIODS.map(({ label, days }) => (
                    <Button
                      key={days}
                      size="sm"
                      variant="outline"
                      className="text-xs hover:bg-green-50 hover:border-green-400 hover:text-green-700"
                      disabled={grantMutation.isPending}
                      onClick={() => grantMutation.mutate({ userId: selected.id, days })}
                    >
                      <UserCheck className="w-3 h-3 mr-1" />{label}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-1"><CalendarDays className="w-4 h-4" /> Definir data específica:</p>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <Button
                    size="sm"
                    disabled={!customDate || setUntilMutation.isPending}
                    onClick={() => setUntilMutation.mutate({ userId: selected.id, until: new Date(customDate + "T23:59:59").toISOString() })}
                  >
                    Definir
                  </Button>
                </div>
              </div>

              <div className="pt-2 border-t">
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full gap-2"
                  disabled={revokeMutation.isPending}
                  onClick={() => { if (confirm(`Revogar acesso de ${selected.name || selected.email}?`)) revokeMutation.mutate({ userId: selected.id }); }}
                >
                  <Trash2 className="w-4 h-4" /> Revogar acesso imediatamente
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}