import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Send, Eye, Pencil, Trash2, CheckCircle, XCircle, FileText, RotateCcw, Filter, Copy, FileDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { jsPDF } from "jspdf";

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
  const [statusFilter, setStatusFilter] = useState<string>("todos");

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

  const updateStatusMutation = trpc.orcamentosSimples?.update?.useMutation({
    onSuccess: () => { toast.success("Status atualizado!"); refetch?.(); },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  const sendEmailMutation = trpc.orcamentosSimples?.sendEmail?.useMutation({
    onSuccess: (data) => { 
      toast.success(`Email enviado para ${data.sentTo}!`); 
      setShowSendDialog(false);
      setEmailTo("");
      setCustomMessage("");
      refetch?.();
    },
    onError: (err: any) => toast.error("Erro ao enviar: " + err.message),
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
  function duplicarOrcamento(orcamento: any) {
    setEditingId(null);
    setClienteNome(orcamento.clienteNome + " (Cópia)");
    setClienteEmail(orcamento.clienteEmail || "");
    setProdutos(orcamento.produtos?.map((p: any) => ({ ...p })) || [{ nome: "", quantidade: 1, unidade: "KG", preco: 0, total: 0 }]);
    setMostrarForm(true);
    toast.info("Orçamento duplicado! Revise e salve.");
  }

  function gerarPDF(orcamento: any) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 20;

    // Cabeçalho
    doc.setFontSize(20);
    doc.setTextColor(33, 37, 41);
    doc.text("ORÇAMENTO", pageWidth / 2, y, { align: "center" });
    
    y += 15;
    doc.setFontSize(10);
    doc.setTextColor(108, 117, 125);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, pageWidth / 2, y, { align: "center" });

    // Linha separadora
    y += 10;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);

    // Dados do Cliente
    y += 15;
    doc.setFontSize(12);
    doc.setTextColor(33, 37, 41);
    doc.setFont("helvetica", "bold");
    doc.text("DADOS DO CLIENTE", margin, y);
    
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Cliente: ${orcamento.clienteNome}`, margin, y);
    
    if (orcamento.clienteEmail) {
      y += 7;
      doc.text(`Email: ${orcamento.clienteEmail}`, margin, y);
    }

    // Produtos
    y += 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("PRODUTOS", margin, y);

    // Cabeçalho da tabela
    y += 12;
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 5, pageWidth - (margin * 2), 10, "F");
    doc.setFontSize(9);
    doc.setTextColor(33, 37, 41);
    doc.text("Produto", margin + 2, y + 2);
    doc.text("Qtd", margin + 80, y + 2);
    doc.text("Un", margin + 95, y + 2);
    doc.text("Preço", margin + 110, y + 2);
    doc.text("Total", margin + 140, y + 2);

    // Linhas dos produtos
    y += 10;
    doc.setFont("helvetica", "normal");
    orcamento.produtos?.forEach((prod: any, idx: number) => {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      
      // Cor alternada
      if (idx % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, y - 5, pageWidth - (margin * 2), 8, "F");
      }
      
      doc.text(prod.nome.substring(0, 35), margin + 2, y);
      doc.text(String(prod.quantidade), margin + 80, y);
      doc.text(prod.unidade || "KG", margin + 95, y);
      doc.text(`R$ ${Number(prod.preco).toFixed(2)}`, margin + 110, y);
      doc.text(`R$ ${Number(prod.total).toFixed(2)}`, margin + 140, y);
      y += 8;
    });

    // Linha separadora
    y += 5;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);

    // Total
    y += 15;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 100, 0);
    doc.text(`TOTAL: R$ ${Number(orcamento.total).toFixed(2)}`, pageWidth - margin, y, { align: "right" });

    // Rodapé
    y = doc.internal.pageSize.getHeight() - 30;
    doc.setFontSize(9);
    doc.setTextColor(108, 117, 125);
    doc.setFont("helvetica", "normal");
    doc.text("Este orçamento é válido por 15 dias.", pageWidth / 2, y, { align: "center" });
    y += 5;
    doc.text("NutriCRM - Sistema de Gestão Comercial", pageWidth / 2, y, { align: "center" });

    // Salvar
    doc.save(`orcamento-${orcamento.clienteNome.replace(/\s+/g, "_")}-${orcamento.id}.pdf`);
    toast.success("PDF gerado com sucesso!");
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

  function changeStatus(id: number, novoStatus: string) {
    updateStatusMutation.mutate({ id, status: novoStatus });
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "aceito": return "bg-green-100 text-green-700 border-green-300";
      case "rejeitado": return "bg-red-100 text-red-700 border-red-300";
      case "enviado": return "bg-blue-100 text-blue-700 border-blue-300";
      default: return "bg-slate-100 text-slate-700 border-slate-300";
    }
  }
  function getStatusLabel(status: string) {
    switch (status) {
      case "aceito": return "Aceito";
      case "rejeitado": return "Rejeitado";
      case "enviado": return "Enviado";
      default: return "Rascunho";
    }
  }

  function handleSendEmail() {
    if (!selectedOrcamento || !emailTo) { 
      toast.error("Informe o email do destinatário"); 
      return; 
    }
    sendEmailMutation.mutate({
      id: selectedOrcamento.id,
      toEmail: emailTo,
      customMessage: customMessage || undefined,
    });
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

      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <Button 
          variant={statusFilter === "todos" ? "default" : "outline"} 
          size="sm"
          onClick={() => setStatusFilter("todos")}
        >
          <Filter className="w-4 h-4 mr-1" /> Todos
        </Button>
        <Button 
          variant={statusFilter === "rascunho" ? "default" : "outline"} 
          size="sm"
          onClick={() => setStatusFilter("rascunho")}
          className="bg-slate-100 text-slate-700 hover:bg-slate-200"
        >
          <FileText className="w-4 h-4 mr-1" /> Rascunho
        </Button>
        <Button 
          variant={statusFilter === "enviado" ? "default" : "outline"} 
          size="sm"
          onClick={() => setStatusFilter("enviado")}
          className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-300"
        >
          <Send className="w-4 h-4 mr-1" /> Enviado
        </Button>
        <Button 
          variant={statusFilter === "aceito" ? "default" : "outline"} 
          size="sm"
          onClick={() => setStatusFilter("aceito")}
          className="bg-green-100 text-green-700 hover:bg-green-200 border-green-300"
        >
          <CheckCircle className="w-4 h-4 mr-1" /> Aceito
        </Button>
        <Button 
          variant={statusFilter === "rejeitado" ? "default" : "outline"} 
          size="sm"
          onClick={() => setStatusFilter("rejeitado")}
          className="bg-red-100 text-red-700 hover:bg-red-200 border-red-300"
        >
          <XCircle className="w-4 h-4 mr-1" /> Rejeitado
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <table className="w-full">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-3 text-left">Cliente</th>
              <th className="p-3 text-left">Produtos</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-left">Data</th>
              <th className="p-3 text-center">Status / Ações</th>
            </tr>
          </thead>
          <tbody>
            {orcamentosNuvem.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-slate-500">Nenhum orçamento</td></tr>
            ) : (
              (() => {
                const orcamentosFiltrados = statusFilter === "todos" 
                  ? orcamentosNuvem 
                  : orcamentosNuvem.filter((o: any) => o.status === statusFilter);
                return orcamentosFiltrados.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-500">Nenhum orçamento com este status</td></tr>
                ) : (
                  orcamentosFiltrados.map((o: any) => (
                    <tr key={o.id} className="border-t hover:bg-slate-50">
                      <td className="p-3"><div className="font-medium">{o.clienteNome}</div>{o.clienteEmail && <div className="text-sm text-slate-500">{o.clienteEmail}</div>}</td>
                      <td className="p-3">{o.produtos?.length || 0} itens</td>
                      <td className="p-3 text-right font-bold">R$ {Number(o.total).toFixed(2)}</td>
                      <td className="p-3 text-sm text-slate-500">{new Date(o.criadoEm).toLocaleDateString("pt-BR")}</td>
                      <td className="p-3 text-center">
                        <div className="flex flex-col items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Badge de Status */}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(o.status)}`}
                          >
                            {getStatusLabel(o.status)}
                          </span>
                          
                          {/* Botões de Ação */}
                          <div className="flex justify-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openViewDialog(o)} title="Visualizar">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(o)} title="Editar">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            
                            {/* Workflow de Status */}
                            {o.status === "rascunho" && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => changeStatus(o.id, "enviado")}
                                title="Marcar como Enviado"
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <Send className="w-4 h-4" />
                              </Button>
                            )}
                            {o.status === "enviado" && (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => changeStatus(o.id, "aceito")}
                                  title="Marcar como Aceito"
                                  className="text-green-600 hover:text-green-800"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => changeStatus(o.id, "rejeitado")}
                                  title="Marcar como Rejeitado"
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            {(o.status === "aceito" || o.status === "rejeitado") && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => changeStatus(o.id, "rascunho")}
                                title="Voltar para Rascunho"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </Button>
                            )}
                            
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => openSendDialog(o)} 
                              disabled={!o.clienteEmail} 
                              title={o.clienteEmail ? "Enviar por email" : "Sem email"}
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => gerarPDF(o)}
                              title="Baixar PDF"
                              className="text-purple-600 hover:text-purple-800"
                            >
                              <FileDown className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => duplicarOrcamento(o)}
                              title="Duplicar Orçamento"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-500 hover:text-red-700" 
                              onClick={() => openDeleteDialog(o)} 
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                );
              })()
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
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-slate-500">Cliente</p>
                    <p className="font-semibold text-lg">{selectedOrcamento.clienteNome}</p>
                    {selectedOrcamento.clienteEmail && <p className="text-sm text-slate-600">{selectedOrcamento.clienteEmail}</p>}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedOrcamento.status)}`}
                  >
                    {getStatusLabel(selectedOrcamento.status)}
                  </span>
                </div>
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
          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={() => gerarPDF(selectedOrcamento)} className="gap-2">
              <FileDown className="w-4 h-4" /> Baixar PDF
            </Button>
            <Button onClick={() => setShowViewDialog(false)}>Fechar</Button>
          </DialogFooter>
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
              <Button onClick={handleSendEmail} disabled={!emailTo || sendEmailMutation.isPending}>
                {sendEmailMutation.isPending ? (
                  <>Enviando...</>
                ) : (
                  <><Send className="w-3 h-3 mr-1" /> Enviar Email</>
                )}
              </Button>
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
