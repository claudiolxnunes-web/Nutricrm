import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Send, Eye, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type Produto = { nome: string; quantidade: number; unidade: string; preco: number; total: number };

export default function Quotes() {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [clienteNome, setClienteNome] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([{ nome: "", quantidade: 1, unidade: "KG", preco: 0, total: 0 }]);
  
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedOrcamento, setSelectedOrcamento] = useState<any>(null);
  const [emailTo, setEmailTo] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: orcamentosNuvem = [], refetch } = trpc.orcamentosSimples?.list?.useQuery() || {};
  const { data: clientes = [] } = trpc.clients?.list?.useQuery({ limit: 500 }) || {};
  const { data: produtosDb = [] } = trpc.products?.list?.useQuery({ limit: 200 }) || {};
  
  const createMutation = trpc.orcamentosSimples?.create?.useMutation({
    onSuccess: () => { toast.success("Orçamento salvo!"); refetch?.(); setMostrarForm(false); resetForm(); },
    onError: () => toast.error("Erro ao salvar"),
  });
  const updateMutation = trpc.orcamentosSimples?.update?.useMutation({
    onSuccess: () => { toast.success("Orçamento atualizado!"); refetch?.(); setMostrarForm(false); setEditingId(null); resetForm(); },
    onError: () => toast.error("Erro ao atualizar"),
  });
  const deleteMutation = trpc.orcamentosSimples?.delete?.useMutation({
    onSuccess: () => { toast.success("Orçamento excluído!"); refetch?.(); setShowDeleteDialog(false); },
    onError: () => toast.error("Erro ao excluir"),
  });

  const listaClientes = (clientes as any)?.data || clientes || [];
  const listaProdutos = (produtosDb as any)?.data || produtosDb || [];

  function resetForm() {
    setClienteNome("");
    setClienteEmail("");
    setProdutos([{ nome: "", quantidade: 1, unidade: "KG", preco: 0, total: 0 }]);
  }

  function atualizarProduto(idx: number, campo: keyof Produto, valor: any) {
    const novos = [...produtos];
    novos[idx] = { ...novos[idx], [campo]: valor };
    novos[idx].total = novos[idx].quantidade * novos[idx].preco;
    setProdutos(novos);
  }

  function selecionarProduto(idx: number, produtoId: number) {
    const prod = listaProdutos.find((x: any) => x.id === produtoId);
    if (prod) {
      const novos = [...produtos];
      novos[idx] = { ...novos[idx], nome: prod.name, unidade: prod.unit || "KG", preco: Number(prod.price) || 0, total: novos[idx].quantidade * (Number(prod.price) || 0) };
      setProdutos(novos);
    }
  }

  function toggleUnidade(idx: number) {
    const novos = [...produtos];
    const unidades = ["KG", "SC", "UN", "LT"];
    const atualIdx = unidades.indexOf(novos[idx].unidade || "KG");
    novos[idx].unidade = unidades[(atualIdx + 1) % unidades.length];
    setProdutos(novos);
  }

  const total = produtos.reduce((s, p) => s + p.total, 0);

  function salvar() {
    if (!clienteNome) { toast.error("Informe o cliente"); return; }
    if (editingId) {
      updateMutation.mutate({ id: editingId, clienteNome, clienteEmail: clienteEmail || undefined, produtos, total });
    } else {
      createMutation.mutate({ clienteNome, clienteEmail: clienteEmail || undefined, produtos, total });
    }
  }

  function openViewDialog(orcamento: any) {
    setSelectedOrcamento(orcamento);
    setShowViewDialog(true);
  }

  function openSendDialog(orcamento: any) {
    setSelectedOrcamento(orcamento);
    setEmailTo(orcamento.clienteEmail || "");
    setShowSendDialog(true);
  }
  function openEditDialog(orcamento: any) {
    setEditingId(orcamento.id);
    setClienteNome(orcamento.clienteNome);
    setClienteEmail(orcamento.clienteEmail || "");
    setProdutos(orcamento.produtos || [{ nome: "", quantidade: 1, unidade: "KG", preco: 0, total: 0 }]);
    setMostrarForm(true);
  }
  function openDeleteDialog(orcamento: any) {
    setSelectedOrcamento(orcamento);
    setShowDeleteDialog(true);
  }
  function handleDelete() {
    if (selectedOrcamento?.id) {
      deleteMutation.mutate({ id: selectedOrcamento.id });
    }
  }

  function handleSendEmail() {
    if (!selectedOrcamento || !emailTo) { toast.error("Informe o email"); return; }
    const subject = encodeURIComponent(`Orçamento NutriCRM - ${selectedOrcamento.clienteNome}`);
    const body = encodeURIComponent(`Prezado(a) ${selectedOrcamento.clienteNome},\n\nSegue orçamento:\n\n${selectedOrcamento.produtos?.map((p: any) => `- ${p.nome}: ${p.quantidade} ${p.unidade} x R$ ${Number(p.preco).toFixed(2)} = R$ ${Number(p.total).toFixed(2)}`).join("\n")}\n\nTOTAL: R$ ${Number(selectedOrcamento.total).toFixed(2)}\n\n${customMessage || ""}\n\nAtenciosamente,\nNutriCRM`);
    window.open(`mailto:${emailTo}?subject=${subject}&body=${body}`);
    toast.success("Email aberto! Envie o orçamento.");
    setShowSendDialog(false);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Orçamentos</h1>
        <Button onClick={() => setMostrarForm(true)}>+ Novo Orçamento</Button>
      </div>

      {mostrarForm && (
        <div className="bg-white p-6 rounded-lg shadow mb-6 border">
          <h2 className="text-lg font-semibold mb-4">{editingId ? "Editar Orçamento" : "Novo Orçamento"}</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Cliente *</label>
              <select className="w-full border rounded px-3 py-2" onChange={(e) => { const c = listaClientes.find((x: any) => x.id === Number(e.target.value)); if (c) { setClienteNome(c.farmName || c.producerName); setClienteEmail(c.email || ""); } }}>
                <option value="">Selecione...</option>
                {listaClientes.map((c: any) => (<option key={c.id} value={c.id}>{c.farmName || c.producerName}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <Input value={clienteEmail} onChange={(e) => setClienteEmail(e.target.value)} />
            </div>
          </div>

          <h3 className="font-medium mb-2">Produtos</h3>
          <div className="grid grid-cols-6 gap-2 mb-2 text-sm font-medium text-slate-600 bg-slate-100 p-2 rounded">
            <div>Produto</div><div>Nome</div><div>Quantidade</div><div className="text-center">Unidade</div><div>Preço Unit.</div><div>Total</div>
          </div>
          {produtos.map((p, i) => (
            <div key={i} className="grid grid-cols-6 gap-2 mb-2 items-center">
              <select className="border rounded px-2 py-1" onChange={(e) => selecionarProduto(i, Number(e.target.value))}>
                <option value="">Selecione...</option>
                {listaProdutos.map((prod: any) => (<option key={prod.id} value={prod.id}>{prod.name}</option>))}
              </select>
              <Input value={p.nome} onChange={(e) => atualizarProduto(i, "nome", e.target.value)} />
              <Input type="number" min="0.01" step="0.01" value={p.quantidade} onChange={(e) => atualizarProduto(i, "quantidade", Number(e.target.value))} />
              <Button type="button" variant="outline" size="sm" onClick={() => toggleUnidade(i)} className="w-full">{p.unidade || "KG"}</Button>
              <Input type="number" min="0" step="0.01" value={p.preco} onChange={(e) => atualizarProduto(i, "preco", Number(e.target.value))} />
              <div className="text-right font-medium">R$ {p.total.toFixed(2)}</div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setProdutos([...produtos, { nome: "", quantidade: 1, unidade: "KG", preco: 0, total: 0 }])} className="mb-4">+ Adicionar produto</Button>

          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-xl font-bold">Total: R$ {total.toFixed(2)}</div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setMostrarForm(false); setEditingId(null); resetForm(); }}>Cancelar</Button>
              <Button onClick={salvar} disabled={!clienteNome || createMutation?.isPending}>{createMutation?.isPending ? "Salvando..." : "Salvar"}</Button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <table className="w-full">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-3 text-left">Cliente</th>
              <th className="p-3 text-left">Produtos</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-left">Data</th>
              <th className="p-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {orcamentosNuvem.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-slate-500">Nenhum orçamento</td></tr>
            ) : (
              orcamentosNuvem.map((o: any) => (
                <tr key={o.id} className="border-t hover:bg-slate-50">
                  <td className="p-3"><div className="font-medium">{o.clienteNome}</div>{o.clienteEmail && <div className="text-sm text-slate-500">{o.clienteEmail}</div>}</td>
                  <td className="p-3">{o.produtos?.length || 0} itens</td>
                  <td className="p-3 text-right font-bold">R$ {Number(o.total).toFixed(2)}</td>
                  <td className="p-3 text-sm text-slate-500">{new Date(o.criadoEm).toLocaleDateString("pt-BR")}</td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openViewDialog(o)} title="Visualizar"><Eye className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(o)} title="Editar"><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => openSendDialog(o)} disabled={!o.clienteEmail} title={o.clienteEmail ? "Enviar por email" : "Sem email"}><Send className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => openDeleteDialog(o)} title="Excluir"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Dialog Visualizar */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Visualizar Orçamento</DialogTitle></DialogHeader>
          {selectedOrcamento && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-sm text-slate-500">Cliente</p>
                <p className="font-semibold text-lg">{selectedOrcamento.clienteNome}</p>
                {selectedOrcamento.clienteEmail && <p className="text-sm text-slate-600">{selectedOrcamento.clienteEmail}</p>}
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Produtos:</p>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr><th className="p-2 text-left">Produto</th><th className="p-2 text-center">Qtd</th><th className="p-2 text-center">Un</th><th className="p-2 text-right">Preço</th><th className="p-2 text-right">Total</th></tr>
                    </thead>
                    <tbody>
                      {selectedOrcamento.produtos?.map((p: any, i: number) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{p.nome}</td>
                          <td className="p-2 text-center">{p.quantidade}</td>
                          <td className="p-2 text-center">{p.unidade}</td>
                          <td className="p-2 text-right">R$ {Number(p.preco).toFixed(2)}</td>
                          <td className="p-2 text-right">R$ {Number(p.total).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-sm text-slate-500">Data: {new Date(selectedOrcamento.criadoEm).toLocaleDateString("pt-BR")}</div>
                <div className="text-2xl font-bold">Total: R$ {Number(selectedOrcamento.total).toFixed(2)}</div>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={() => setShowViewDialog(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Enviar */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Enviar Orçamento por Email</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {selectedOrcamento && (
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="font-medium">{selectedOrcamento.clienteNome}</p>
                <p className="text-sm text-slate-600">Total: R$ {Number(selectedOrcamento.total).toFixed(2)}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Email do Destinatário *</label>
              <Input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="cliente@email.com" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Mensagem (opcional)</label>
              <textarea value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} placeholder="Digite uma mensagem..." className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm mt-1" rows={3} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSendDialog(false)}>Cancelar</Button>
              <Button onClick={handleSendEmail} disabled={!emailTo}><Send className="w-3 h-3 mr-1" /> Abrir Email</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Exclusão */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Confirmar Exclusão</DialogTitle></DialogHeader>
          <div className="py-4">
            <p>Tem certeza que deseja excluir o orçamento de <strong>{selectedOrcamento?.clienteNome}</strong>?</p>
            <p className="text-sm text-slate-500 mt-2">Esta ação não pode ser desfeita.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation?.isPending}>
              {deleteMutation?.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
