import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, Mail, Shield, Edit, Phone, FileText, DollarSign, Plus, UserPlus, Trash2, AlertTriangle } from "lucide-react";
import { formatDateBR } from "@/lib/dateUtils";

const ROLES: Record<string, { label: string; color: string }> = {
  admin: { label: "Administrador", color: "bg-purple-100 text-purple-700" },
  vendedor: { label: "Vendedor", color: "bg-blue-100 text-blue-700" },
  gerente: { label: "Gerente", color: "bg-green-100 text-green-700" },
  superadmin: { label: "Super Admin", color: "bg-red-100 text-red-700" },
};

export default function Representantes() {
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", role: "vendedor" });
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newUserData, setNewUserData] = useState({
    name: "",
    email: "",
    role: "vendedor",
    password: "",
  });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);

  const { data: users = [], refetch } = trpc.users.list.useQuery();

  const updateMutation = trpc.users.update.useMutation({
    onSuccess: () => {
      toast.success("Representante atualizado!");
      setShowEditDialog(false);
      setEditingUser(null);
      refetch();
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const createUserMutation = trpc.users?.create?.useMutation({
    onSuccess: () => {
      toast.success("Representante cadastrado com sucesso!");
      setShowNewDialog(false);
      setNewUserData({ name: "", email: "", role: "vendedor", password: "" });
      refetch?.();
    },
    onError: (err: any) => toast.error("Erro ao cadastrar: " + err.message),
  });

  const deleteUserMutation = trpc.users?.delete?.useMutation({
    onSuccess: () => {
      toast.success("Representante removido com sucesso!");
      setShowDeleteDialog(false);
      setUserToDelete(null);
      refetch?.();
    },
    onError: (err: any) => toast.error("Erro ao remover: " + err.message),
  });

  function openEditDialog(user: any) {
    setEditingUser(user);
    setFormData({
      name: user.name || "",
      email: user.email || "",
      role: user.role || "vendedor",
    });
    setShowEditDialog(true);
  }

  function handleSave() {
    if (!editingUser) return;
    updateMutation.mutate({
      id: editingUser.id,
      name: formData.name || undefined,
      email: formData.email || undefined,
      role: formData.role as "admin" | "vendedor" | "gerente",
    });
  }

  function handleCreateUser() {
    if (!newUserData.name || !newUserData.email || !newUserData.password) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    createUserMutation.mutate(newUserData);
  }

  function openDeleteDialog(user: any) {
    setUserToDelete(user);
    setShowDeleteDialog(true);
  }

  function handleDeleteUser() {
    if (!userToDelete) return;
    deleteUserMutation.mutate({ id: userToDelete.id });
  }

  // Calcular estatísticas por vendedor
  const { data: opportunities } = trpc.opportunities.list.useQuery({ limit: 500 });
  const { data: interactions } = trpc.interactions.all.useQuery({});

  const getUserStats = (userId: number) => {
    const userOpps = (opportunities as any[])?.filter((o: any) => o.createdBy === userId) || [];
    const userInteractions = (interactions as any[])?.filter((i: any) => i.createdBy === userId) || [];
    const vendasConcluidas = userOpps.filter((o: any) => o.stage === "venda_concluida");
    const totalVendas = vendasConcluidas.reduce((sum: number, o: any) => sum + parseFloat(o.value || 0), 0);

    return {
      totalOportunidades: userOpps.length,
      vendasConcluidas: vendasConcluidas.length,
      totalVendas,
      totalInteracoes: userInteractions.length,
      taxaConversao: userOpps.length > 0 ? Math.round((vendasConcluidas.length / userOpps.length) * 100) : 0,
    };
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="w-8 h-8" />
            Representantes
          </h1>
          <p className="text-slate-600">Gerencie sua equipe de vendas</p>
        </div>
        <Button onClick={() => setShowNewDialog(true)} className="gap-2">
          <UserPlus className="w-4 h-4" />
          Novo Representante
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-slate-500">Total Representantes</p>
            <p className="text-2xl font-bold">{users.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-slate-500">Vendedores Ativos</p>
            <p className="text-2xl font-bold text-blue-600">
              {users.filter((u: any) => u.role === "vendedor").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-slate-500">Gerentes</p>
            <p className="text-2xl font-bold text-green-600">
              {users.filter((u: any) => u.role === "gerente").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-slate-500">Administradores</p>
            <p className="text-2xl font-bold text-purple-600">
              {users.filter((u: any) => u.role === "admin").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Representantes */}
      <Card>
        <CardHeader>
          <CardTitle>Equipe de Vendas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-3 text-left">Nome</th>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-center">Funcao</th>
                  <th className="p-3 text-center">Oportunidades</th>
                  <th className="p-3 text-center">Vendas</th>
                  <th className="p-3 text-center">Taxa Conv.</th>
                  <th className="p-3 text-center">Interacoes</th>
                  <th className="p-3 text-center">Cadastro</th>
                  <th className="p-3 text-center">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">
                      Nenhum representante encontrado
                    </td>
                  </tr>
                ) : (
                  users.map((user: any) => {
                    const stats = getUserStats(user.id);
                    return (
                      <tr key={user.id} className="border-t hover:bg-slate-50">
                        <td className="p-3">
                          <div className="font-medium">{user.name || "Sem nome"}</div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1 text-sm text-slate-600">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <Badge className={ROLES[user.role]?.color || ROLES.vendedor.color}>
                            {ROLES[user.role]?.label || "Vendedor"}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-semibold">{stats.totalOportunidades}</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-semibold text-green-600">
                            {stats.vendasConcluidas}
                          </span>
                          <div className="text-xs text-slate-500">
                            R$ {stats.totalVendas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`font-semibold ${
                              stats.taxaConversao >= 30
                                ? "text-green-600"
                                : stats.taxaConversao >= 15
                                ? "text-yellow-600"
                                : "text-red-600"
                            }`}
                          >
                            {stats.taxaConversao}%
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {stats.totalInteracoes}
                          </div>
                        </td>
                        <td className="p-3 text-center text-sm text-slate-500">
                          {formatDateBR(user.createdAt)}
                        </td>
                        <td className="p-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(user)}
                            title="Remover representante"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Edicao */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Representante</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Nome</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do representante"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Funcao</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md text-sm"
              >
                <option value="vendedor">Vendedor</option>
                <option value="gerente">Gerente</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Novo Representante */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Novo Representante
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Nome completo *</label>
              <Input
                value={newUserData.name}
                onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                placeholder="Nome do representante"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Email *</label>
              <Input
                type="email"
                value={newUserData.email}
                onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                placeholder="email@exemplo.com"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Senha *</label>
              <Input
                type="password"
                value={newUserData.password}
                onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                placeholder="Mínimo 6 caracteres"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Função</label>
              <select
                value={newUserData.role}
                onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md text-sm"
              >
                <option value="vendedor">Vendedor</option>
                <option value="gerente">Gerente</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={createUserMutation.isPending}
            >
              {createUserMutation.isPending ? "Cadastrando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Remover Representante
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>
              Tem certeza que deseja remover o representante{" "}
              <strong>{userToDelete?.name}</strong>?
            </p>
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <strong>Atenção:</strong> Esta ação não pode ser desfeita!
              </p>
              <p className="text-sm text-red-600 mt-2">
                Todas as oportunidades, interações e vendas associadas a este 
                representante serão mantidas no sistema, mas ele não terá mais acesso.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? "Removendo..." : "Remover Representante"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
