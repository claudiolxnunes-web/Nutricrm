import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Phone, Mail, Pencil, Trash2, Upload, UserCheck } from "lucide-react";
import { toast } from "sonner";
import ClientDetail from "./ClientDetail";

type ClientType = "fazenda" | "revendedor" | "distribuidor" | "agroindustria" | "fabrica_racoes";

const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  fazenda: "Fazenda / Produtor Rural",
  revendedor: "Revendedor",
  distribuidor: "Distribuidor",
  agroindustria: "Agroindustria",
  fabrica_racoes: "Fabrica de Racoes",
};

const CLIENT_TYPE_COLORS: Record<ClientType, string> = {
  fazenda: "bg-green-100 text-green-800",
  revendedor: "bg-blue-100 text-blue-800",
  distribuidor: "bg-purple-100 text-purple-800",
  agroindustria: "bg-orange-100 text-orange-800",
  fabrica_racoes: "bg-amber-100 text-amber-800",
};

const ACTIVITY_CATEGORIES: Record<string, { label: string; subtypes: Record<string, string> }> = {
  aves: {
    label: "Avicultura",
    subtypes: {
      granja_aves_corte: "Granja de Aves de Corte",
      granja_aves_postura: "Granja de Aves de Postura",
    },
  },
  suinocultura: {
    label: "Suinocultura",
    subtypes: {
      suinocultura_ciclo_completo: "Ciclo Completo",
      suinocultura_leitoes: "Produtor de Leitoes",
      suinocultura_terminacao: "Terminacao",
    },
  },
  gado_corte: {
    label: "Gado de Corte",
    subtypes: {
      gado_corte_ciclo_completo: "Ciclo Completo",
      gado_corte_cria: "Cria",
      gado_corte_recria: "Recria",
    },
  },
  gado_leite: {
    label: "Gado de Leite",
    subtypes: {
      gado_leite_intensivo: "Intensivo",
      gado_leite_semi_intensivo: "Semi-intensivo",
      gado_leite_extensivo: "Extensivo",
    },
  },
};

function getCategoryFromActivityType(activityType: string): string {
  for (const [cat, data] of Object.entries(ACTIVITY_CATEGORIES)) {
    if (Object.keys(data.subtypes).includes(activityType)) return cat;
  }
  return "";
}

function getActivityLabel(activityType: string): string {
  for (const data of Object.values(ACTIVITY_CATEGORIES)) {
    if (data.subtypes[activityType]) return `${data.label} - ${data.subtypes[activityType]}`;
  }
  return "";
}

const emptyForm = {
  clientType: "fazenda" as ClientType,
  activityType: "",
  activityCategory: "",
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
  const [detailClient, setDetailClient] = useState<any | null>(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkUserId, setBulkUserId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: me } = trpc.auth.me.useQuery();
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 100;
  const { data: clients, isLoading, refetch } = trpc.clients.list.useQuery({ search, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const { data: allUsers } = trpc.users.list.useQuery(undefined, { enabled: me?.role === "admin" });

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

  const assignMutation = trpc.clients.assign.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.assigned} cliente(s) atribuido(s)!`);
      setSelectedIds([]);
      setBulkUserId("");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.farmName || !formData.producerName) { toast.error("Preencha os campos obrigatorios"); return; }
    const { activityCategory, ...rest } = formData;
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, ...rest, activityType: rest.activityType as any });
    } else {
      createMutation.mutate({ ...rest, activityType: rest.activityType as any });
    }
  };

  const handleEdit = (client: any) => {
    const activityCategory = getCategoryFromActivityType(client.activityType || "");
    setFormData({
      clientType: client.clientType || "fazenda",
      activityType: client.activityType || "",
      activityCategory,
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

  const excelDateToStr = (val: any): string => {
    if (!val) return "";
    const n = Number(val);
    if (!isNaN(n) && n > 40000 && n < 60000) {
      // Excel serial: days since 1900-01-01 (with Lotus 1-2-3 bug offset)
      const date = new Date((n - 25569) * 86400 * 1000);
      return date.toLocaleDateString("pt-BR");
    }
    // Already a string date — try to parse
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
    return String(val);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isInativo = file.name.toLowerCase().includes("inativ");
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws);
        if (rows.length === 0) { toast.error("Planilha vazia"); return; }

        // Column mapping helper
        const col = (row: any, ...keys: string[]) => {
          for (const k of keys) if (row[k] !== undefined && row[k] !== null && row[k] !== "") return String(row[k]).trim();
          return undefined;
        };

        // Detect animal type from "Linha" column
        const mapLinha = (linha: string): any => {
          const l = (linha || "").toUpperCase();
          if (l.includes("SUINO")) return "suinos";
          if (l.includes("AVE") || l.includes("AVES")) return "aves";
          if (l.includes("EQUINO")) return "equinos";
          if (l.includes("RUMINANTE") || l.includes("BOVINO")) return "bovinos";
          return "outros";
        };

        // Detect client type from name
        const mapClientType = (nome: string): ClientType => {
          const n = (nome || "").toUpperCase();
          if (n.includes("LTDA") || n.includes("S.A") || n.includes("INDUSTRIA") || n.includes("IND.") || n.includes("COM.")) return "revendedor";
          if (n.includes("COOPERATIVA") || n.includes("COOP")) return "distribuidor";
          return "fazenda";
        };

        let ok = 0, fail = 0;
        toast.info(`Importando ${rows.length} registros...`);

        for (const row of rows) {
          try {
            const nome = col(row, "Cliente") || "Sem nome";
            const ddd = col(row, "DDD") ? String(col(row, "DDD")).replace(".0","").trim() : "";
            const tel = col(row, "Telefone") || "";
            const phone = ddd && tel ? `(${ddd}) ${tel}` : tel || undefined;
            const linha = col(row, "Linha") || "";
            const segmento = col(row, "Segmento") || "";
            const fat = col(row, "Faturamento Realizado Ano") || "";
            const ultimaCompra = col(row, "Ãšltima compra") || "";
            const erc = col(row, "ERC") || "";
            const codCliente = col(row, "Cod. Cliente") || "";

            const notesParts = [
              codCliente ? `Cod: ${codCliente}` : "",
              segmento ? `Segmento: ${segmento}` : "",
              fat ? `Fat. Ano: R$ ${parseFloat(fat).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "",
              ultimaCompra ? `Ultima compra: ${excelDateToStr(ultimaCompra)}` : "",
              erc ? `ERC: ${erc}` : "",
            ].filter(Boolean).join(" | ");

            await createMutation.mutateAsync({
              clientType: mapClientType(nome),
              farmName: nome,
              producerName: nome,
              animalType: mapLinha(linha),
              animalQuantity: 0,
              email: col(row, "E-mail", "Email"),
              phone,
              city: col(row, "Municipio", "MunicÃ­pio", "Cidade"),
              state: col(row, "Estado"),
              notes: notesParts || undefined,
            });
            ok++;
          } catch { fail++; }
        }
        toast.success(`${ok} clientes importados${fail > 0 ? `, ${fail} com erro` : ""}!`);
        refetch();
      } catch (err) {
        console.error(err);
        toast.error("Erro ao ler planilha");
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleBulkAssign = () => {
    if (!bulkUserId || selectedIds.length === 0) { toast.error("Selecione clientes e um representante"); return; }
    assignMutation.mutate({ clientIds: selectedIds, userId: Number(bulkUserId) });
  };

  const getUserName = (userId: number | null | undefined) => {
    if (!userId || !allUsers) return null;
    const u = (allUsers as any[]).find((u: any) => u.id === userId);
    return u ? (u.name || u.email || `#${u.id}`) : null;
  };

  const responsavelLabel = CLIENT_TYPE_LABELS[formData.clientType] === "Fazenda / Produtor Rural"
    ? "Nome do Produtor *"
    : "Nome do Responsavel *";

  const clientData: any[] = (clients as any)?.data ?? [];
  const clientTotal: number = (clients as any)?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(clientTotal / PAGE_SIZE));
  const filteredClients = filterClientType
    ? clientData.filter((c: any) => (c.clientType || "fazenda") === filterClientType)
    : clientData;

  const currentSubtypes = formData.activityCategory
    ? ACTIVITY_CATEGORIES[formData.activityCategory]?.subtypes ?? {}
    : {};

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
            <select value={formData.clientType} onChange={(e) => setFormData({ ...formData, clientType: e.target.value as ClientType })} className="w-full px-3 py-2 border border-slate-300 rounded-md">
              {(Object.entries(CLIENT_TYPE_LABELS) as [ClientType, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Atividade de Criacao</label>
              <select
                value={formData.activityCategory}
                onChange={(e) => setFormData({ ...formData, activityCategory: e.target.value, activityType: "" })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              >
                <option value="">Selecione a atividade</option>
                {Object.entries(ACTIVITY_CATEGORIES).map(([key, data]) => (
                  <option key={key} value={key}>{data.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Sistema de Producao</label>
              <select
                value={formData.activityType}
                onChange={(e) => setFormData({ ...formData, activityType: e.target.value })}
                disabled={!formData.activityCategory}
                className="w-full px-3 py-2 border border-slate-300 rounded-md disabled:opacity-50"
              >
                <option value="">Selecione o sistema</option>
                {Object.entries(currentSubtypes).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
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

      {me?.role === "admin" && selectedIds.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-sm font-medium text-blue-800">{selectedIds.length} cliente(s) selecionado(s)</span>
          <select
            value={bulkUserId}
            onChange={(e) => setBulkUserId(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-md text-sm"
          >
            <option value="">Selecione representante</option>
            {(allUsers ?? []).map((u: any) => (
              <option key={u.id} value={u.id}>{u.name || u.email}</option>
            ))}
          </select>
          <Button size="sm" onClick={handleBulkAssign} disabled={assignMutation.isPending} className="gap-2">
            <UserCheck className="w-4 h-4" />
            Atribuir selecionados
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>Cancelar</Button>
        </div>
      )}

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <Input placeholder="Buscar clientes por nome ou fazenda..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-10" />
        </div>
        <select value={filterClientType} onChange={(e) => setFilterClientType(e.target.value as ClientType | "")} className="px-3 py-2 border border-slate-300 rounded-md text-sm min-w-[200px]">
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
            const responsavelCardLabel = ct === "fazenda" ? "Produtor" : "Responsavel";
            const activityLabel = getActivityLabel(client.activityType || "");
            const assignedName = getUserName(client.assignedTo);
            const isSelected = selectedIds.includes(client.id);
            return (
              <Card key={client.id} className={`hover:shadow-md transition cursor-pointer ${isSelected ? "ring-2 ring-blue-400" : ""}`} onClick={() => setDetailClient(client)}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {me?.role === "admin" && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(client.id)}
                          className="mt-1.5 w-4 h-4 cursor-pointer"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-lg">{client.farmName}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CLIENT_TYPE_COLORS[ct]}`}>
                            {CLIENT_TYPE_LABELS[ct]}
                          </span>
                          {activityLabel && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                              {activityLabel}
                            </span>
                          )}
                          {assignedName && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 flex items-center gap-1">
                              <UserCheck className="w-3 h-3" />
                              {assignedName}
                            </span>
                          )}
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
                        {me?.role === "admin" && allUsers && (
                          <div className="mt-3 flex items-center gap-2">
                            <label className="text-xs text-slate-500">Atribuir a:</label>
                            <select
                              value={client.assignedTo ?? ""}
                              onChange={(e) => {
                                if (e.target.value) {
                                  assignMutation.mutate({ clientIds: [client.id], userId: Number(e.target.value) });
                                }
                              }}
                              className="px-2 py-1 border border-slate-300 rounded text-xs"
                            >
                              <option value="">Selecione...</option>
                              {(allUsers as any[]).map((u: any) => (
                                <option key={u.id} value={u.id}>{u.name || u.email}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        client.status === "ativo" ? "bg-green-100 text-green-800" :
                        client.status === "inativo" ? "bg-red-100 text-red-800" :
                        "bg-yellow-100 text-yellow-800"
                      }`}>{client.status}</span>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDetailClient(client); }} title="Ver detalhes" className="text-blue-500 hover:text-blue-700">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(client); }} title="Editar">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDeleteId(client.id); }} title="Excluir" className="text-red-500 hover:text-red-700">
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

      {/* Paginação */}
      {clientTotal > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-slate-500">
            Mostrando {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, clientTotal)} de <strong>{clientTotal}</strong> clientes
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Anterior
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2).map((p, idx, arr) => (
              <span key={p}>
                {idx > 0 && arr[idx - 1] !== p - 1 && <span className="text-slate-400 px-1">…</span>}
                <button
                  onClick={() => setPage(p)}
                  className={`px-3 py-1.5 text-sm rounded-md border ${page === p ? "bg-primary text-white border-primary" : "border-slate-300 hover:bg-slate-50"}`}
                >
                  {p}
                </button>
              </span>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Próximo →
            </button>
          </div>
        </div>
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
      <ClientDetail
        client={detailClient}
        open={!!detailClient}
        onClose={() => setDetailClient(null)}
        onRefresh={refetch}
      />
    </div>
  );
}






