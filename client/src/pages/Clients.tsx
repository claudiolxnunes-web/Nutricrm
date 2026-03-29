import { useState, useRef } from "react";
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
import { Plus, Search, Phone, Mail, Pencil, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

type ClientType = "fazenda" | "revendedor" | "distribuidor" | "agroindustria" | "fabrica_racoes";

const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  fazenda: "Fazenda / Produtor Rural",
  revendedor: "Revendedor",
  distribuidor: "Distribuidor",
  agroindustria: "Agroindústria",
  fabrica_racoes: "Fábrica de Rações",
};

const CLIENT_TYPE_COLORS: Record<ClientType, string> = {
  fazenda: "bg-green-100 text-green-800",
  revendedor: "bg-blue-100 text-blue-800",
  distribuidor: "bg-purple-100 text-purple-800",
  agroindustria: "bg-orange-100 text-orange-800",
  fabrica_racoes: "bg-amber-100 text-amber-800",
};

const emptyForm = {
  clientType: "fazenda" as ClientType,
  farmName: "",
  producerName: "",
  email: "",
  phone: "",
  whatsapp: "",
  animalType: "bovinos" as const,
  animalQuantity: 0,
  address: "",
  city: "",
  state: "",
  zipCode: "",
  notes: "",
};

export default function Clients() {
  const [search, setSearch] = useState("");
  const [filterClientType, setFilterClientType] = useState<ClientType | "">("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: clients, isLoading, refetch } = trpc.clients.list.useQuery({ search, limit: 50 });

  const createMutation = trpc.clients.create.useMutation({
    onSuccess: () => { toast.success("Cliente criado!"); setShowForm(false); setFormData({ ...emptyForm }); refetch(); },
    onError: () => toast.error("Erro ao criar cliente"),
  });

  const updateMutation = trpc.clients.update.useMutation({
    onSuccess: () => { toast.success("Cliente atualizado!"); setEditingId(null); setShowForm(false); setFormData({ ...emptyForm }); refetch(); },
    onError: () => toast.error("Erro ao atualizar cliente"),
  });

  const deleteMutation = trpc.clients.delete.useMutation({
    onSuccess: () => { toast.success("Cliente excluido!"); setDeleteId(null); refetch(); },
    onError: () => toast.error("Erro ao excluir cliente"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.farmName || !formData.producerName) { toast.error("Preencha os campos obrigatorios"); return; }
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (client: any) => {
    setFormData({
      clientType: client.clientType || "fazenda",
      farmName: client.farmName || "",
      producerName: client.producerName || "",
      email: client.email || "",
      phone: client.phone || "",
      whatsapp: client.whatsapp || "",
      animalType: client.animalType || "bovinos",
      animalQuantity: client.animalQuantity || 0,
      address: client.address || "",
      city: client.city || "",
      state: client.state || "",
      zipCode: client.zipCode || "",
      notes: client.notes || "",
    });
    setEditingId(client.id);
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
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws);
        if (rows.length === 0) { toast.error("Planilha vazia"); return; }

        let ok = 0, fail = 0;
        for (const row of rows) {
          try {
            const animalRaw = (row["Tipo de Animal"] || row["animalType"] || "outros").toLowerCase();
            const animalMap: Record<string, string> = { "suinos": "suinos", "bovinos": "bovinos", "aves": "aves", "equinos": "equinos" };
            const animalType = (animalMap[animalRaw] || "outros") as any;
            const clientTypeRaw = (row["Tipo de Cliente"] || row["clientType"] || "fazenda").toLowerCase();
            const validTypes = ["fazenda", "revendedor", "distribuidor", "agroindustria", "fabrica_racoes"];
            const clientType = (validTypes.includes(clientTypeRaw) ? clientTypeRaw : "fazenda") as ClientType;
            await createMutation.mutateAsync({
              clientType,
              farmName: row["Nome da Fazenda"] || row["farmName"] || "Sem nome",
              producerName: row["Nome do Responsavel"] || row["Nome do Produtor"] || row["producerName"] || "Sem nome",
              animalType,
              animalQuantity: parseInt(row["Quantidade"] || row["animalQuantity"] || "0") || 0,
              email: row["Email"] || row["email"] || undefined,
              phone: row["Telefone"] || row["phone"] || undefined,
              whatsapp: row["WhatsApp"] || row["whatsapp"] || undefined,
              city: row["Cidade"] || row["city"] || undefined,
              state: row["Estado"] || row["state"] || undefined,
            });
            ok++;
          } catch { fail++; }
        }
        toast.success(`${ok} clientes importados${fail > 0 ? `, ${fail} com erro` : ""}!`);
        refetch();
      } catch {
        toast.error("Erro ao ler planilha");
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const responsavelLabel = CLIENT_TYPE_LABELS[formData.clientType] === "Fazenda / Produtor Rural"
    ? "Nome do Produtor *"
    : "Nome do Responsável *";

  const filteredClients = filterClientType
    ? (clients ?? []).filter((c: any) => (c.clientType || "fazenda") === filterClientType)
    : (clients ?? []);

  const ClientForm = (
    <Card>
      <CardHeader>
        <CardTitle>{editingId ? "Editar Cliente" : "Novo Cliente"}</CardTitle>
        <CardDescription>{editingId ? "Atualize os dados do cliente" : "Adicione um novo cliente ao sistema"}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Tipo de Cliente *</label>
            <select
              value={formData.clientType}
              onChange={(e) => setFormData({ ...formData, clientType: e.target.value as ClientType })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            >
              {(Object.entries(CLIENT_TYPE_LABELS) as [ClientType, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Nome da Fazenda / Empresa *</label>
              <Input value={formData.farmName} onChange={(e) => setFormData({ ...formData, farmName: e.target.value })} placeholder="Ex: Fazenda Sao Joao" />
            </div>
            <div>
              <label className="text-sm font-medium">{responsavelLabel}</label>
              <Input value={formData.producerName} onChange={(e) => setFormData({ ...formData, producerName: e.target.value })} placeholder="Ex: Joao Silva" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Tipo de Animal</label>
              <select value={formData.animalType} onChange={(e) => setFormData({ ...formData, animalType: e.target.value as any })} className="w-full px-3 py-2 border border-slate-300 rounded-md">
                <option value="bovinos">Bovinos</option>
                <option value="suinos">Suinos</option>
                <option value="aves">Aves</option>
                <option value="equinos">Equinos</option>
                <option value="outros">Outros</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Quantidade de Animais</label>
              <Input type="number" value={formData.animalQuantity} onChange={(e) => setFormData({ ...formData, animalQuantity: parseInt(e.target.value) || 0 })} placeholder="0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">E-mail</label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="email@example.com" />
            </div>
            <div>
              <label className="text-sm font-medium">Telefone</label>
              <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="(00) 0000-0000" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">WhatsApp</label>
            <Input value={formData.whatsapp} onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })} placeholder="(00) 99999-9999" />
          </div>
          <div>
            <label className="text-sm font-medium">Endereco</label>
            <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Rua, numero, complemento" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Cidade</label>
              <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} placeholder="Cidade" />
            </div>
            <div>
              <label className="text-sm font-medium">Estado</label>
              <Input value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} placeholder="UF" maxLength={2} />
            </div>
            <div>
              <label className="text-sm font-medium">CEP</label>
              <Input value={formData.zipCode} onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })} placeholder="00000-000" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Notas</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Observacoes adicionais" className="w-full px-3 py-2 border border-slate-300 rounded-md" rows={3} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "Salvando..." : editingId ? "Atualizar Cliente" : "Salvar Cliente"}
            </Button>
            <Button type="button" variant="outline" onClick={handleCancelForm}>Cancelar</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clientes</h1>
          <p className="text-slate-600">Gestao de clientes: fazendas, revendedores, distribuidores e mais</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportExcel} />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
            <Upload className="w-4 h-4" />
            Importar Excel
          </Button>
          <Button onClick={() => { setEditingId(null); setFormData({ ...emptyForm }); setShowForm(!showForm); }} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Cliente
          </Button>
        </div>
      </div>

      {showForm && ClientForm}

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <Input placeholder="Buscar clientes por nome ou fazenda..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <select
          value={filterClientType}
          onChange={(e) => setFilterClientType(e.target.value as ClientType | "")}
          className="px-3 py-2 border border-slate-300 rounded-md text-sm min-w-[200px]"
        >
          <option value="">Todos os tipos</option>
          {(Object.entries(CLIENT_TYPE_LABELS) as [ClientType, string][]).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredClients && filteredClients.length > 0 ? (
        <div className="grid gap-4">
          {filteredClients.map((client: any) => {
            const ct: ClientType = client.clientType || "fazenda";
            const responsavelCardLabel = ct === "fazenda" ? "Produtor" : "Responsável";
            return (
              <Card key={client.id} className="hover:shadow-md transition">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">{client.farmName}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CLIENT_TYPE_COLORS[ct]}`}>
                          {CLIENT_TYPE_LABELS[ct]}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">{responsavelCardLabel}: {client.producerName}</p>
                      <div className="flex gap-4 mt-2 text-sm text-slate-600">
                        <span>{client.animalType} &mdash; {client.animalQuantity} animais</span>
                        {client.city && <span>{client.city}, {client.state}</span>}
                      </div>
                      <div className="flex gap-4 mt-3">
                        {client.email && (
                          <a href={`mailto:${client.email}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                            <Mail className="w-4 h-4" />{client.email}
                          </a>
                        )}
                        {client.phone && (
                          <a href={`tel:${client.phone}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                            <Phone className="w-4 h-4" />{client.phone}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        client.status === "ativo" ? "bg-green-100 text-green-800" :
                        client.status === "inativo" ? "bg-red-100 text-red-800" :
                        "bg-yellow-100 text-yellow-800"
                      }`}>{client.status}</span>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(client)} title="Editar">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(client.id)} title="Excluir" className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center text-slate-600">
            Nenhum cliente encontrado. Crie um novo cliente ou importe uma planilha Excel.
          </CardContent>
        </Card>
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>Esta acao nao pode ser desfeita. O cliente sera removido permanentemente.</AlertDialogDescription>
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
