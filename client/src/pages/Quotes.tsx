import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, FileText } from "lucide-react";
import { toast } from "sonner";

export default function Quotes() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    clientId: 0,
    quoteNumber: "",
    validityDays: 30,
    notes: "",
  });

  const { data: quotes, isLoading, refetch } = trpc.quotes.list.useQuery({
    limit: 50,
  });

  const createMutation = trpc.quotes.create.useMutation({
    onSuccess: () => {
      toast.success("Orçamento criado com sucesso!");
      setShowForm(false);
      setFormData({ clientId: 0, quoteNumber: "", validityDays: 30, notes: "" });
      refetch();
    },
    onError: () => {
      toast.error("Erro ao criar orçamento");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientId || !formData.quoteNumber) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Orçamentos</h1>
          <p className="text-slate-600">Gestão de cotações e propostas</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Orçamento
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Novo Orçamento</CardTitle>
            <CardDescription>Crie um novo orçamento para um cliente</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Cliente *</label>
                <Input
                  type="number"
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: parseInt(e.target.value) })}
                  placeholder="ID do cliente"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Número do Orçamento *</label>
                <Input
                  value={formData.quoteNumber}
                  onChange={(e) => setFormData({ ...formData, quoteNumber: e.target.value })}
                  placeholder="Ex: ORC-2024-001"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Validade (dias)</label>
                <Input
                  type="number"
                  value={formData.validityDays}
                  onChange={(e) => setFormData({ ...formData, validityDays: parseInt(e.target.value) })}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Notas</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Observações do orçamento"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Salvando..." : "Salvar Orçamento"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
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
      ) : quotes && quotes.length > 0 ? (
        <div className="grid gap-4">
          {quotes.map((quote: any) => (
            <Card key={quote.id} className="hover:shadow-md transition">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <FileText className="w-8 h-8 text-blue-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-semibold">{quote.quoteNumber}</h3>
                      <p className="text-sm text-slate-600">Cliente ID: {quote.clientId}</p>
                      <p className="text-sm text-slate-600 mt-1">
                        Validade: {quote.validityDays} dias
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-emerald-600">
                      R$ {parseFloat(quote.finalValue || quote.totalValue || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </div>
                    <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${
                      quote.status === 'aceito' ? 'bg-green-100 text-green-800' :
                      quote.status === 'enviado' ? 'bg-blue-100 text-blue-800' :
                      quote.status === 'rascunho' ? 'bg-gray-100 text-gray-800' :
                      quote.status === 'rejeitado' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {quote.status}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center text-slate-600">
            Nenhum orçamento encontrado. Crie um novo orçamento para começar.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
