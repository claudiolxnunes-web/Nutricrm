import { useState } from "react";
import * as XLSX from "xlsx";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Search, Package, Pencil, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

const emptyForm = {
  name: "",
  category: "",
  description: "",
  price: "",
  stock: 0,
  unit: "kg",
};

export default function Products() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ ...emptyForm });

  const { data: products, isLoading, refetch } = trpc.products.list.useQuery({
    search,
    limit: 50,
  });

  const createMutation = trpc.products.create.useMutation({
    onSuccess: () => {
      toast.success("Produto criado com sucesso!");
      setShowForm(false);
      setFormData({ ...emptyForm });
      refetch();
    },
    onError: () => {
      toast.error("Erro ao criar produto");
    },
  });

  const updateMutation = trpc.products.update.useMutation({
    onSuccess: () => {
      toast.success("Produto atualizado com sucesso!");
      setEditingId(null);
      setShowForm(false);
      setFormData({ ...emptyForm });
      refetch();
    },
    onError: () => {
      toast.error("Erro ao atualizar produto");
    },
  });

  const deleteMutation = trpc.products.delete.useMutation({
    onSuccess: () => {
      toast.success("Produto excluido com sucesso!");
      setDeleteId(null);
      refetch();
    },
    onError: () => {
      toast.error("Erro ao excluir produto");
    },
  });

  const importMutation = trpc.products.import.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.imported} produtos importados, ${data.skipped} ignorados`);
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.category || !formData.price) {
      toast.error("Preencha os campos obrigatorios");
      return;
    }
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (product: any) => {
    setFormData({
      name: product.name || "",
      category: product.category || "",
      description: product.description || "",
      price: product.price || "",
      stock: product.stock || 0,
      unit: product.unit || "kg",
    });
    setEditingId(product.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ ...emptyForm });
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const rows = raw.map((r) => ({
        productCode: String(r["Codigo"] || r["Código"] || r["codigo"] || r["A"] || "").trim() || undefined,
        name: String(r["Nome"] || r["Produto"] || r["produto"] || r["nome"] || r["B"] || "").trim(),
        packaging: String(r["Embalagem"] || r["embalagem"] || r["Tipo"] || r["C"] || "saco").toLowerCase().includes("granel") ? "granel" : "saco",
        bagWeight: String(r["Peso"] || r["Peso do Saco"] || r["peso"] || r["D"] || "").trim() || undefined,
        indication: String(r["Indicacao"] || r["Indicação"] || r["indicacao"] || r["E"] || "").trim() || undefined,
        species: String(r["Especie"] || r["Espécie"] || r["especie"] || r["Especie e Fase"] || r["F"] || "").trim() || undefined,
        phase: String(r["Fase"] || r["fase"] || r["G"] || "").trim() || undefined,
        usageMode: String(r["Modo de Uso"] || r["Modo Usar"] || r["modo_uso"] || r["H"] || "").trim() || undefined,
      })).filter((r) => r.name);
      importMutation.mutate({ rows });
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Produtos</h1>
          <p className="text-slate-600">Catalogo de nutricao animal</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="cursor-pointer">
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} />
            <Button variant="outline" className="gap-2" asChild>
              <span>
                <Upload className="w-4 h-4" />
                Importar Excel
              </span>
            </Button>
          </label>
          <Button onClick={() => { setEditingId(null); setFormData({ ...emptyForm }); setShowForm(!showForm); }} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Produto
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Editar Produto" : "Novo Produto"}</CardTitle>
            <CardDescription>{editingId ? "Atualize os dados do produto" : "Adicione um novo produto ao catalogo"}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nome do Produto *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Racao Premium Bovinos"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Categoria *</label>
                  <Input
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Ex: Racao, Suplemento, Aditivo"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Unidade</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  >
                    <option value="kg">Kg</option>
                    <option value="ton">Ton</option>
                    <option value="l">Litro</option>
                    <option value="un">Unidade</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Descricao</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descricao detalhada do produto"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Preco (R$) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Estoque</label>
                  <Input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? "Salvando..." : editingId ? "Atualizar Produto" : "Salvar Produto"}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancelForm}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Buscar produtos por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : products && products.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product: any) => (
            <Card key={product.id} className="hover:shadow-md transition">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Package className="w-8 h-8 text-emerald-600 flex-shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{product.name}</h3>
                          {product.productCode && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-mono">
                              {product.productCode}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600">{product.category}</p>
                        {(product.species || product.phase) && (
                          <p className="text-sm text-slate-500 mt-0.5">
                            {[product.species, product.phase].filter(Boolean).join(" — ")}
                          </p>
                        )}
                        {(product.packaging || product.bagWeight) && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            {product.packaging === "granel" ? "Granel" : "Saco"}
                            {product.bagWeight ? ` · ${product.bagWeight}` : ""}
                          </p>
                        )}
                        {product.indication && (
                          <p className="text-xs text-slate-500 mt-1 italic">{product.indication}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(product)} title="Editar">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteId(product.id)} title="Excluir" className="text-red-500 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-lg font-bold text-emerald-600">
                        R$ {parseFloat(product.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-xs bg-slate-100 px-2 py-1 rounded">
                        {product.stock} {product.unit}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center text-slate-600">
            Nenhum produto encontrado. Crie um novo produto para comecar.
          </CardContent>
        </Card>
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>Esta acao nao pode ser desfeita. O produto sera removido permanentemente do catalogo.</AlertDialogDescription>
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
