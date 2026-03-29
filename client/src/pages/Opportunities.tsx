import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const STAGES = [
  { id: "prospeccao", label: "Prospeccao", color: "bg-blue-50 border-blue-200" },
  { id: "visita_tecnica", label: "Visita Tecnica", color: "bg-purple-50 border-purple-200" },
  { id: "orcamento_enviado", label: "Orcamento Enviado", color: "bg-yellow-50 border-yellow-200" },
  { id: "negociacao", label: "Negociacao", color: "bg-orange-50 border-orange-200" },
  { id: "venda_concluida", label: "Venda Concluida", color: "bg-green-50 border-green-200" },
  { id: "perdida", label: "Perdida", color: "bg-red-50 border-red-200" },
];

const emptyForm = {
  clientId: 0,
  title: "",
  description: "",
  value: "",
  probability: 0,
  stage: "prospeccao",
};

export default function Opportunities() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ ...emptyForm });

  const { data: opportunities, isLoading, refetch } = trpc.opportunities.list.useQuery({
    limit: 100,
  });

  const createMutation = trpc.opportunities.create.useMutation({
    onSuccess: () => {
      toast.success("Oportunidade criada com sucesso!");
      setShowForm(false);
      setFormData({ ...emptyForm });
      refetch();
    },
    onError: () => {
      toast.error("Erro ao criar oportunidade");
    },
  });

  const updateMutation = trpc.opportunities.update.useMutation({
    onSuccess: () => {
      toast.success("Oportunidade atualizada com sucesso!");
      setEditingId(null);
      setShowForm(false);
      setFormData({ ...emptyForm });
      refetch();
    },
    onError: () => {
      toast.error("Erro ao atualizar oportunidade");
    },
  });

  const deleteMutation = trpc.opportunities.delete.useMutation({
    onSuccess: () => {
      toast.success("Oportunidade excluida com sucesso!");
      setDeleteId(null);
      refetch();
    },
    onError: () => {
      toast.error("Erro ao excluir oportunidade");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientId || !formData.title) {
      toast.error("Preencha os campos obrigatorios");
      return;
    }
    if (editingId !== null) {
      updateMutation.mutate({
        id: editingId,
        title: formData.title,
        description: formData.description,
        value: formData.value,
        probability: formData.probability,
        stage: formData.stage,
      });
    } else {
      createMutation.mutate({
        clientId: formData.clientId,
        title: formData.title,
        description: formData.description,
        value: formData.value,
        probability: formData.probability,
      });
    }
  };

  const handleEdit = (opp: any) => {
    setFormData({
      clientId: opp.clientId || 0,
      title: opp.title || "",
      description: opp.description || "",
      value: opp.value || "",
      probability: opp.probability || 0,
      stage: opp.stage || "prospeccao",
    });
    setEditingId(opp.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ ...emptyForm });
  };

  const opportunitiesByStage = STAGES.map((stage) => ({
    ...stage,
    opportunities: opportunities?.filter((opp: any) => opp.stage === stage.id) || [],
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Funil de Vendas</h1>
          <p className="text-slate-600">Acompanhe suas oportunidades em cada etapa</p>
        </div>
        <Button onClick={() => { setEditingId(null); setFormData({ ...emptyForm }); setShowForm(!showForm); }} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Oportunidade
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Editar Oportunidade" : "Nova Oportunidade"}</CardTitle>
            <CardDescription>{editingId ? "Atualize os dados da oportunidade" : "Adicione uma nova oportunidade ao funil"}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingId && (
                <div>
                  <label className="text-sm font-medium">Cliente *</label>
                  <input
                    type="number"
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: parseInt(e.target.value) })}
                    placeholder="ID do cliente"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
              )}
              <div>
                <label className="text-sm font-medium">Titulo *</label>
                <input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Descricao da oportunidade"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Descricao</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detalhes da oportunidade"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Valor</label>
                  <input
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Probabilidade (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.probability}
                    onChange={(e) => setFormData({ ...formData, probability: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
              </div>
              {editingId && (
                <div>
                  <label className="text-sm font-medium">Etapa</label>
                  <select
                    value={formData.stage}
                    onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  >
                    {STAGES.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? "Salvando..." : editingId ? "Atualizar" : "Salvar"}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancelForm}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-6 gap-4 overflow-x-auto pb-4">
          {opportunitiesByStage.map((stage) => (
            <div key={stage.id} className="flex-shrink-0 w-full lg:w-auto">
              <div className={`rounded-lg border-2 p-4 ${stage.color}`}>
                <h3 className="font-semibold text-sm mb-4">{stage.label}</h3>
                <div className="space-y-3">
                  {stage.opportunities.length > 0 ? (
                    stage.opportunities.map((opp: any) => (
                      <Card key={opp.id} className="cursor-move hover:shadow-md transition">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-1">
                            <h4 className="font-medium text-sm flex-1">{opp.title}</h4>
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleEdit(opp)} title="Editar">
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-700" onClick={() => setDeleteId(opp.id)} title="Excluir">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          {opp.value && (
                            <p className="text-sm text-slate-600 mt-1">
                              R$ {parseFloat(opp.value).toLocaleString("pt-BR")}
                            </p>
                          )}
                          {opp.probability && (
                            <p className="text-xs text-slate-500 mt-1">
                              Probabilidade: {opp.probability}%
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 text-center py-4">Nenhuma oportunidade</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir oportunidade?</AlertDialogTitle>
            <AlertDialogDescription>Esta acao nao pode ser desfeita. A oportunidade sera removida permanentemente do funil.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
