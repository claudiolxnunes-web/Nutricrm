import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Shield, User, Trash2, UserPlus, TrendingUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

function getStatus(user: any) {
  const now = new Date();
  if (user.paidUntil && new Date(user.paidUntil) > now) {
    return { label: `Ativo ate ${new Date(user.paidUntil).toLocaleDateString("pt-BR")}`, color: "green" };
  }
  if (user.trialEndsAt && new Date(user.trialEndsAt) > now) {
    const days = Math.ceil((new Date(user.trialEndsAt).getTime() - now.getTime()) / 86400000);
    return { label: `Trial: ${days} dias`, color: "yellow" };
  }
  return { label: "Expirado", color: "red" };
}

const statusBadgeClass: Record<string, string> = {
  green: "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700",
  red: "bg-red-100 text-red-600",
};

export default function Users() {
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "vendedor" as "admin" | "vendedor" });
  const { data: users, isLoading, refetch } = trpc.users.list.useQuery();
  const { data: me } = trpc.auth.me.useQuery();

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => { toast.success("Role atualizado!"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = trpc.users.delete.useMutation({
    onSuccess: () => { toast.success("Usuario removido!"); setDeleteId(null); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const createMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      toast.success("Usuario criado com sucesso!");
      setShowCreate(false);
      setForm({ name: "", email: "", password: "", role: "vendedor" });
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const activateMutation = trpc.users.activate.useMutation({
    onSuccess: (data) => {
      toast.success(`Acesso ativado ate ${new Date(data.paidUntil).toLocaleDateString("pt-BR")}!`);
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (me?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">Acesso restrito a administradores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Usuarios</h1>
          <p className="text-slate-600">Gerencie representantes e administradores do sistema</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <UserPlus className="w-4 h-4" />
          Novo Representante
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid gap-4">
          {(users ?? []).map((user: any) => {
            const status = getStatus(user);
            return (
              <Card key={user.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${user.role === "admin" ? "bg-purple-100" : "bg-blue-100"}`}>
                        {user.role === "admin" ? <Shield className="w-5 h-5 text-purple-600" /> : <User className="w-5 h-5 text-blue-600" />}
                      </div>
                      <div>
                        <p className="font-semibold">{user.name || "Sem nome"}</p>
                        <p className="text-sm text-slate-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusBadgeClass[status.color]}`}>
                        {status.label}
                      </span>
                      <span className="text-sm text-slate-500 bg-slate-100 px-2 py-1 rounded">{user.clientCount} clientes</span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={activateMutation.isPending}
                        onClick={() => activateMutation.mutate({ id: user.id, days: 30 })}
                        className="text-green-700 border-green-300 hover:bg-green-50"
                      >
                        Ativar 30 dias
                      </Button>
                      <select
                        value={user.role}
                        disabled={user.id === me?.id}
                        onChange={(e) => updateRoleMutation.mutate({ id: user.id, role: e.target.value as "admin" | "vendedor" })}
                        className="px-3 py-1.5 border border-slate-300 rounded-md text-sm disabled:opacity-50"
                      >
                        <option value="admin">Administrador</option>
                        <option value="vendedor">Representante</option>
                      </select>
                      <Button
                        variant="ghost" size="sm"
                        disabled={user.id === me?.id}
                        onClick={() => setDeleteId(user.id)}
                        className="text-red-500 hover:text-red-700 disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {(users ?? []).length === 0 && (
            <p className="text-center text-slate-400 py-8">Nenhum usuario cadastrado ainda.</p>
          )}
        </div>
      )}

      {/* Dialog: criar usuario */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Representante</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium mb-1">Nome</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nome completo"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@empresa.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Senha inicial</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Minimo 6 caracteres"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Perfil</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "vendedor" })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="vendedor">Representante (ve so seus clientes)</option>
                <option value="admin">Administrador (ve tudo)</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.name || !form.email || form.password.length < 6 || createMutation.isPending}
            >
              {createMutation.isPending ? "Criando..." : "Criar Usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: confirmar exclusao */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuario?</AlertDialogTitle>
            <AlertDialogDescription>Esta acao nao pode ser desfeita. Os clientes atribuidos a este usuario nao serao removidos.</AlertDialogDescription>
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

