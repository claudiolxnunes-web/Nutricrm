import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// Tipo para orçamento local
type OrcamentoLocal = {
  id: string; // ID temporário local
  clienteNome: string;
  clienteEmail: string;
  produtos: { nome: string; quantidade: number; preco: number; total: number }[];
  total: number;
  status: string;
  criadoEm: string;
  sincronizado: boolean;
};

export default function Quotes() {
  const [orcamentos, setOrcamentos] = useState<OrcamentoLocal[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [clienteNome, setClienteNome] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [produtos, setProdutos] = useState([{ nome: "", quantidade: 1, preco: 0, total: 0 }]);

  // Carrega do localStorage
  useEffect(() => {
    const salvos = localStorage.getItem("orcamentos");
    if (salvos) setOrcamentos(JSON.parse(salvos));
  }, []);

  // Salva no localStorage
  const salvarLocal = (lista: OrcamentoLocal[]) => {
    localStorage.setItem("orcamentos", JSON.stringify(lista));
    setOrcamentos(lista);
  };

  // Busca do banco (para superadmin ver tudo)
  const { data: orcamentosNuvem } = trpc.orcamentosSimples?.list?.useQuery() || {};

  // Mutation para criar no banco
  const createMutation = trpc.orcamentosSimples?.create?.useMutation({
    onSuccess: () => toast.success("Orçamento sincronizado!"),
    onError: () => toast.error("Erro ao sincronizar"),
  });

  const calcularTotal = () => {
    return produtos.reduce((s, p) => s + p.quantidade * p.preco, 0);
  };

  const atualizarProduto = (index: number, campo: string, valor: any) => {
    const novos = [...produtos];
    novos[index] = { ...novos[index], [campo]: valor };
    novos[index].total = novos[index].quantidade * novos[index].preco;
    setProdutos(novos);
  };

  const adicionarProduto = () => {
    setProdutos([...produtos, { nome: "", quantidade: 1, preco: 0, total: 0 }]);
  };

  const salvarOrcamento = () => {
    const novo: OrcamentoLocal = {
      id: Date.now().toString(),
      clienteNome,
      clienteEmail,
      produtos,
      total: calcularTotal(),
      status: "rascunho",
      criadoEm: new Date().toISOString(),
      sincronizado: false,
    };
    salvarLocal([novo, ...orcamentos]);
    setMostrarForm(false);
    setClienteNome("");
    setClienteEmail("");
    setProdutos([{ nome: "", quantidade: 1, preco: 0, total: 0 }]);
    toast.success("Orçamento salvo localmente!");
  };

  const sincronizar = (orc: OrcamentoLocal) => {
    if (!createMutation) {
      toast.error("Serviço indisponível");
      return;
    }
    createMutation.mutate({
      clienteNome: orc.clienteNome,
      clienteEmail: orc.clienteEmail,
      produtos: orc.produtos,
      total: orc.total,
      status: orc.status,
    });
    // Marca como sincronizado
    const atualizados = orcamentos.map(o => o.id === orc.id ? { ...o, sincronizado: true } : o);
    salvarLocal(atualizados);
  };

  // Combina local + nuvem
  const todosOrcamentos = [...(orcamentosNuvem || []), ...orcamentos.filter(o => !o.sincronizado)];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Orçamentos</h1>
        <Button onClick={() => setMostrarForm(true)}>+ Novo Orçamento</Button>
      </div>

      {mostrarForm && (
        <div className="bg-white p-6 rounded-lg shadow mb-6 border">
          <h2 className="text-lg font-semibold mb-4">Novo Orçamento</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Cliente</label>
              <Input value={clienteNome} onChange={e => setClienteNome(e.target.value)} placeholder="Nome do cliente" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <Input value={clienteEmail} onChange={e => setClienteEmail(e.target.value)} placeholder="email@cliente.com" />
            </div>
          </div>

          <h3 className="font-medium mb-2">Produtos</h3>
          {produtos.map((p, i) => (
            <div key={i} className="grid grid-cols-4 gap-2 mb-2">
              <Input placeholder="Produto" value={p.nome} onChange={e => atualizarProduto(i, "nome", e.target.value)} />
              <Input type="number" placeholder="Qtd" value={p.quantidade} onChange={e => atualizarProduto(i, "quantidade", Number(e.target.value))} />
              <Input type="number" placeholder="Preço" value={p.preco} onChange={e => atualizarProduto(i, "preco", Number(e.target.value))} />
              <div className="flex items-center text-sm">R$ {p.total.toFixed(2)}</div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={adicionarProduto} className="mb-4">+ Adicionar produto</Button>

          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-xl font-bold">Total: R$ {calcularTotal().toFixed(2)}</div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMostrarForm(false)}>Cancelar</Button>
              <Button onClick={salvarOrcamento} disabled={!clienteNome}>Salvar</Button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-3 text-left">Cliente</th>
              <th className="p-3 text-left">Total</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {todosOrcamentos.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-slate-500">Nenhum orçamento</td></tr>
            ) : (
              todosOrcamentos.map((orc: any) => (
                <tr key={orc.id} className="border-t">
                  <td className="p-3">
                    <div className="font-medium">{orc.clienteNome || orc.cliente_nome}</div>
                    <div className="text-sm text-slate-500">{orc.clienteEmail || orc.cliente_email}</div>
                  </td>
                  <td className="p-3">R$ {Number(orc.total).toFixed(2)}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs ${orc.sincronizado || orc.id > 1000000 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {orc.sincronizado || orc.id > 1000000 ? 'Sincronizado' : 'Local'}
                    </span>
                  </td>
                  <td className="p-3">
                    {(!orc.sincronizado && orc.id < 1000000) && (
                      <Button size="sm" variant="outline" onClick={() => sincronizar(orc)}>☁️ Sincronizar</Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
