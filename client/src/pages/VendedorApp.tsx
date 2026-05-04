import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  MapPin, Clock, Users, Target, TrendingUp, CheckCircle, 
  Phone, Navigation, Calendar, DollarSign, AlertCircle,
  Play, Square, Camera, Mic, Send, RefreshCw, UserPlus, Trash2, 
  Building2, MapPinned, User
} from "lucide-react";
import { formatDateBR, formatCurrencyBR } from "@/lib/dateUtils";

// Tipos
interface VisitaDia {
  id: string;
  clientId: number;
  clientName: string;
  startTime: string;
  endTime?: string;
  status: "pendente" | "em_andamento" | "concluida" | "cancelada";
  notes: string;
  location?: { lat: number; lng: number };
  photos: string[];
  audioNotes: string[];
  pedido?: { produtos: any[]; total: number };
}

interface ClienteRota {
  id: number;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  ultimaVisita?: string;
  proximaVisita?: string;
  status: "visitar" | "visitado" | "pendente";
}

// Badge inline para evitar importação extra
function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className ?? ""}`}>
      {children}
    </span>
  );
}

export default function VendedorApp() {
  const [activeTab, setActiveTab] = useState("inicio");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [visitaAtual, setVisitaAtual] = useState<VisitaDia | null>(null);
  const [visitasHoje, setVisitasHoje] = useState<VisitaDia[]>([]);
  const [clientesRota, setClientesRota] = useState<ClienteRota[]>([]);
  const [metaDia, setMetaDia] = useState({ visitas: 8, vendas: 5000 });
  const [realizado, setRealizado] = useState({ visitas: 0, vendas: 0 });
  const [horaInicio, setHoraInicio] = useState<string | null>(null);
  const [notaVisita, setNotaVisita] = useState("");
  const [valorVenda, setValorVenda] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [rcs, setRcs] = useState<any[]>([]);
  const [showNewRcDialog, setShowNewRcDialog] = useState(false);
  const [showRcDetail, setShowRcDetail] = useState(false);
  const [selectedRc, setSelectedRc] = useState<any>(null);
  const [newRcData, setNewRcData] = useState({
    nome: "",
    cnpj: "",
    core: "",
    telefone: "",
    endereco: "",
    cidade: "",
    observacao: "",
  });

  // Verificar conexão
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Carregar dados do localStorage (offline)
  useEffect(() => {
    const saved = localStorage.getItem("vendedorApp_data");
    if (saved) {
      const data = JSON.parse(saved);
      setVisitasHoje(data.visitasHoje || []);
      setClientesRota(data.clientesRota || []);
      setRealizado(data.realizado || { visitas: 0, vendas: 0 });
      setHoraInicio(data.horaInicio || null);
    }
  }, []);

  // Salvar no localStorage
  useEffect(() => {
    localStorage.setItem("vendedorApp_data", JSON.stringify({
      visitasHoje,
      clientesRota,
      realizado,
      horaInicio,
    }));
  }, [visitasHoje, clientesRota, realizado, horaInicio]);

  // Buscar clientes da API
  const { data: clientesAPI } = trpc.clients.list.useQuery({ limit: 200 });
  const syncMutation = trpc.sync.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.sincronizados} visita(s) sincronizada(s) com sucesso!`);
    },
    onError: () => {
      toast.error("Erro ao sincronizar. Tente novamente.");
    },
  });
  
  useEffect(() => {
    if (clientesAPI && clientesRota.length === 0) {
      const lista = (clientesAPI as any)?.data || clientesAPI || [];
      setClientesRota(lista.map((c: any) => ({
        id: c.id,
        name: c.farmName || c.producerName,
        address: `${c.city ?? ""}, ${c.state ?? ""}`,
        status: "visitar",
      })));
    }
  }, [clientesAPI]);

  // Iniciar jornada de trabalho
  const iniciarJornada = () => {
    const agora = new Date().toISOString();
    setHoraInicio(agora);
    toast.success("Jornada iniciada! Boa vendas!");
  };

  const encerrarJornada = () => {
    if (horaInicio) {
      const inicio = new Date(horaInicio);
      const fim = new Date();
      const horas = ((fim.getTime() - inicio.getTime()) / 3600000).toFixed(1);
      toast.success(`Jornada encerrada! ${horas}h trabalhadas`);
      sincronizarDados();
    }
    setHoraInicio(null);
  };

  // Iniciar visita
  const iniciarVisita = (cliente: ClienteRota) => {
    if (visitaAtual) {
      toast.error("Finalize a visita atual primeiro!");
      return;
    }

    const novaVisita: VisitaDia = {
      id: Date.now().toString(),
      clientId: cliente.id,
      clientName: cliente.name,
      startTime: new Date().toISOString(),
      status: "em_andamento",
      notes: "",
      photos: [],
      audioNotes: [],
    };

    setVisitaAtual(novaVisita);
    
    setClientesRota(prev => prev.map(c => 
      c.id === cliente.id ? { ...c, status: "visitado" } : c
    ));

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setVisitaAtual(prev => prev ? {
          ...prev,
          location: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        } : prev);
      });
    }

    toast.success(`Visita iniciada: ${cliente.name}`);
  };

  // Finalizar visita
  const finalizarVisita = (resultado: "sucesso" | "perdido" | "retornar") => {
    if (!visitaAtual) return;

    const valorNumerico = resultado === "sucesso" ? parseFloat(valorVenda.replace(",", ".")) || 0 : 0;

    const visitaFinalizada: VisitaDia = {
      ...visitaAtual,
      endTime: new Date().toISOString(),
      status: resultado === "sucesso" ? "concluida" : resultado === "perdido" ? "cancelada" : "pendente",
      notes: notaVisita,
      pedido: resultado === "sucesso" ? { produtos: [], total: valorNumerico } : undefined,
    };

    setVisitasHoje(prev => [...prev, visitaFinalizada]);
    setVisitaAtual(null);
    setNotaVisita("");
    setValorVenda("");

    setRealizado(prev => ({
      visitas: prev.visitas + 1,
      vendas: resultado === "sucesso" ? prev.vendas + valorNumerico : prev.vendas,
    }));

    toast.success("Visita finalizada!");
  };

  // Sincronizar dados
  const sincronizarDados = () => {
    if (!isOnline) {
      toast.warning("Sem conexão. Dados salvos localmente.");
      return;
    }

    const visitasParaSync = visitasHoje.filter(v => v.status !== "pendente");
    if (visitasParaSync.length === 0 && !horaInicio) {
      toast.info("Nenhum dado novo para sincronizar.");
      return;
    }

    toast.info("Sincronizando...");
    syncMutation.mutate({
      visitas: visitasParaSync,
      jornada: horaInicio
        ? { inicio: horaInicio, fim: new Date().toISOString() }
        : undefined,
    });
  };

  // Sincronizar automaticamente ao recuperar conexão
  useEffect(() => {
    if (isOnline) {
      sincronizarDados();
    }
  }, [isOnline]);

  // Carregar RCs do localStorage
  useEffect(() => {
    const savedRcs = localStorage.getItem("vendedorApp_rcs");
    if (savedRcs) {
      setRcs(JSON.parse(savedRcs));
    }
  }, []);

  // Salvar RCs no localStorage
  useEffect(() => {
    localStorage.setItem("vendedorApp_rcs", JSON.stringify(rcs));
  }, [rcs]);

  function adicionarRc() {
    if (!newRcData.nome || !newRcData.telefone) {
      toast.error("Nome e telefone são obrigatórios");
      return;
    }

    const novoRc = {
      id: Date.now().toString(),
      ...newRcData,
      criadoEm: new Date().toISOString(),
      status: "novo",
      criadoPor: "vendedor",
    };

    setRcs(prev => [novoRc, ...prev]);
    setNewRcData({ nome: "", cnpj: "", core: "", telefone: "", endereco: "", cidade: "", observacao: "" });
    setShowNewRcDialog(false);
    toast.success("RC adicionado com sucesso!");
  }

  function deletarRc(rcId: string) {
    setRcs(prev => prev.filter(rc => rc.id !== rcId));
    toast.success("RC removido!");
    setShowRcDetail(false);
    setSelectedRc(null);
  }

  function openRcDetail(rc: any) {
    setSelectedRc(rc);
    setShowRcDetail(true);
  }

  // Renderizar tabs
  const renderInicio = () => (
    <div className="space-y-4 p-4">
      {/* Status Online/Offline */}
      <div className={`flex items-center justify-center gap-2 p-2 rounded-lg ${isOnline ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
        <div className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-500" : "bg-yellow-500"}`} />
        {isOnline ? "Online" : "Offline - dados salvos localmente"}
      </div>

      {/* Botão Jornada */}
      {!horaInicio ? (
        <Button onClick={iniciarJornada} className="w-full h-16 text-lg bg-green-600 hover:bg-green-700">
          <Play className="w-6 h-6 mr-2" /> Iniciar Jornada
        </Button>
      ) : (
        <Button onClick={encerrarJornada} variant="destructive" className="w-full h-16 text-lg">
          <Square className="w-6 h-6 mr-2" /> Encerrar Jornada
        </Button>
      )}

      {/* Resumo do Dia */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-bold text-lg mb-3">Resumo do Dia</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <Clock className="w-6 h-6 mx-auto mb-1 text-blue-600" />
              <p className="text-2xl font-bold">{realizado.visitas}/{metaDia.visitas}</p>
              <p className="text-xs text-slate-500">Visitas</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <DollarSign className="w-6 h-6 mx-auto mb-1 text-green-600" />
              <p className="text-2xl font-bold">{formatCurrencyBR(realizado.vendas)}</p>
              <p className="text-xs text-slate-500">de {formatCurrencyBR(metaDia.vendas)}</p>
            </div>
          </div>
          
          {/* Progresso */}
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Progresso</span>
              <span className="font-bold">{Math.round((realizado.visitas / metaDia.visitas) * 100)}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all" 
                style={{ width: `${Math.min((realizado.visitas / metaDia.visitas) * 100, 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visita em Andamento */}
      {visitaAtual && (
        <Card className="border-orange-300 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-orange-600 animate-pulse" />
              <span className="font-bold text-orange-800">Visita em Andamento</span>
            </div>
            <p className="text-lg font-semibold">{visitaAtual.clientName}</p>
            <p className="text-sm text-slate-500">
              Início: {new Date(visitaAtual.startTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
            
            <textarea
              value={notaVisita}
              onChange={(e) => setNotaVisita(e.target.value)}
              placeholder="Anotações da visita..."
              className="w-full mt-2 p-2 border rounded text-sm"
              rows={2}
            />

            <div className="flex items-center gap-2 mt-2">
              <DollarSign className="w-4 h-4 text-green-600 flex-shrink-0" />
              <Input
                type="number"
                min="0"
                step="0.01"
                value={valorVenda}
                onChange={(e) => setValorVenda(e.target.value)}
                placeholder="Valor da venda (R$)"
                className="text-sm"
              />
            </div>
            
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={() => setShowCamera(true)}>
                <Camera className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline">
                <Mic className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex gap-2 mt-3">
              <Button size="sm" className="flex-1 bg-green-600" onClick={() => finalizarVisita("sucesso")}>
                <CheckCircle className="w-4 h-4 mr-1" /> Venda
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => finalizarVisita("retornar")}>
                Retornar
              </Button>
              <Button size="sm" variant="destructive" onClick={() => finalizarVisita("perdido")}>
                Perdido
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Botão Sincronizar */}
      <Button onClick={sincronizarDados} variant="outline" className="w-full">
        <RefreshCw className="w-4 h-4 mr-2" /> Sincronizar Dados
      </Button>
    </div>
  );

  const renderRota = () => (
    <div className="p-4 space-y-3">
      <h3 className="font-bold text-lg">Rota do Dia ({clientesRota.length} clientes)</h3>
      
      {clientesRota.map((cliente) => (
        <Card key={cliente.id} className={cliente.status === "visitado" ? "bg-green-50" : ""}>
          <CardContent className="p-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">{cliente.name}</p>
                <p className="text-sm text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {cliente.address}
                </p>
                {cliente.ultimaVisita && (
                  <p className="text-xs text-slate-400">
                    Última visita: {formatDateBR(cliente.ultimaVisita)}
                  </p>
                )}
              </div>
              
              <div className="flex gap-1">
                <Button 
                  size="sm" 
                  variant={cliente.status === "visitado" ? "ghost" : "default"}
                  disabled={cliente.status === "visitado" || !!visitaAtual}
                  onClick={() => iniciarVisita(cliente)}
                >
                  {cliente.status === "visitado" ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Play className="w-4 h-4" />}
                </Button>
                <Button size="sm" variant="outline">
                  <Navigation className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderHistorico = () => (
    <div className="p-4 space-y-3">
      <h3 className="font-bold text-lg">Visitas de Hoje ({visitasHoje.length})</h3>
      
      {visitasHoje.length === 0 ? (
        <p className="text-center text-slate-500 py-8">Nenhuma visita realizada hoje</p>
      ) : (
        visitasHoje.map((visita) => (
          <Card key={visita.id}>
            <CardContent className="p-3">
              <div className="flex justify-between">
                <div>
                  <p className="font-semibold">{visita.clientName}</p>
                  <p className="text-sm text-slate-500">
                    {new Date(visita.startTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    {" - "}
                    {visita.endTime && new Date(visita.endTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  {visita.notes && <p className="text-xs text-slate-600 mt-1">{visita.notes}</p>}
                </div>
                <Badge className={
                  visita.status === "concluida" ? "bg-green-100 text-green-700" :
                  visita.status === "cancelada" ? "bg-red-100 text-red-700" :
                  "bg-yellow-100 text-yellow-700"
                }>
                  {visita.status === "concluida" ? "Concluída" :
                   visita.status === "cancelada" ? "Perdida" : "Pendente"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  const renderRcs = () => (
    <div className="p-4 space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg">Registros de Contato ({rcs.length})</h3>
        <Button size="sm" onClick={() => setShowNewRcDialog(true)} className="gap-1">
          <UserPlus className="w-4 h-4" /> Novo
        </Button>
      </div>

      {rcs.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="text-slate-500">Nenhum RC cadastrado</p>
            <Button 
              variant="outline" 
              className="mt-3" 
              onClick={() => setShowNewRcDialog(true)}
            >
              Adicionar primeiro RC
            </Button>
          </CardContent>
        </Card>
      ) : (
        rcs.map((rc) => (
          <Card key={rc.id} className="cursor-pointer" onClick={() => openRcDetail(rc)}>
            <CardContent className="p-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{rc.nome}</p>
                  {rc.core && (
                    <p className="text-xs text-slate-500">Resp.: {rc.core}</p>
                  )}
                  <p className="text-sm text-slate-500 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {rc.telefone}
                  </p>
                  {rc.cidade && (
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <MapPinned className="w-3 h-3" /> {rc.cidade}
                    </p>
                  )}
                </div>
                <Badge className={
                  rc.status === "novo" ? "bg-blue-100 text-blue-700" :
                  rc.status === "visitado" ? "bg-green-100 text-green-700" :
                  "bg-slate-100 text-slate-700"
                }>
                  {rc.status === "novo" ? "Novo" : rc.status === "visitado" ? "Visitado" : "Pendente"}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Cadastrado em: {formatDateBR(rc.criadoEm)}
              </p>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 sticky top-0 z-10">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">NutriCRM Mobile</h1>
          <div className="flex items-center gap-2">
            {!isOnline && <AlertCircle className="w-5 h-5 text-yellow-300" />}
            <span className="text-sm">{formatDateBR(new Date())}</span>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="mt-2">
        {activeTab === "inicio" && renderInicio()}
        {activeTab === "rota" && renderRota()}
        {activeTab === "rcs" && renderRcs()}
        {activeTab === "historico" && renderHistorico()}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around p-2">
        <button 
          onClick={() => setActiveTab("inicio")}
          className={`flex flex-col items-center p-2 ${activeTab === "inicio" ? "text-blue-600" : "text-slate-400"}`}
        >
          <TrendingUp className="w-6 h-6" />
          <span className="text-xs">Início</span>
        </button>
        <button 
          onClick={() => setActiveTab("rota")}
          className={`flex flex-col items-center p-2 ${activeTab === "rota" ? "text-blue-600" : "text-slate-400"}`}
        >
          <MapPin className="w-6 h-6" />
          <span className="text-xs">Rota</span>
        </button>
        <button 
          onClick={() => setActiveTab("rcs")}
          className={`flex flex-col items-center p-2 ${activeTab === "rcs" ? "text-blue-600" : "text-slate-400"}`}
        >
          <Building2 className="w-6 h-6" />
          <span className="text-xs">RCs</span>
        </button>
        <button 
          onClick={() => setActiveTab("historico")}
          className={`flex flex-col items-center p-2 ${activeTab === "historico" ? "text-blue-600" : "text-slate-400"}`}
        >
          <Calendar className="w-6 h-6" />
          <span className="text-xs">Histórico</span>
        </button>
      </div>

      {/* Dialog de Novo RC */}
      <Dialog open={showNewRcDialog} onOpenChange={setShowNewRcDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Novo Registro de Contato
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium">Nome *</label>
              <Input
                value={newRcData.nome}
                onChange={(e) => setNewRcData({ ...newRcData, nome: e.target.value })}
                placeholder="Nome do cliente"
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">CNPJ</label>
              <Input
                value={newRcData.cnpj}
                onChange={(e) => setNewRcData({ ...newRcData, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Core (Conselho Regional de Representantes Comerciais)</label>
              <Input
                value={newRcData.core}
                onChange={(e) => setNewRcData({ ...newRcData, core: e.target.value })}
                placeholder="Nome do responsável/contato"
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Telefone *</label>
              <Input
                value={newRcData.telefone}
                onChange={(e) => setNewRcData({ ...newRcData, telefone: e.target.value })}
                placeholder="(00) 00000-0000"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Endereço</label>
              <Input
                value={newRcData.endereco}
                onChange={(e) => setNewRcData({ ...newRcData, endereco: e.target.value })}
                placeholder="Rua, número, bairro"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Cidade</label>
              <Input
                value={newRcData.cidade}
                onChange={(e) => setNewRcData({ ...newRcData, cidade: e.target.value })}
                placeholder="Cidade/UF"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Observação</label>
              <textarea
                value={newRcData.observacao}
                onChange={(e) => setNewRcData({ ...newRcData, observacao: e.target.value })}
                placeholder="Informações adicionais..."
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md text-sm"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewRcDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={adicionarRc}>Salvar RC</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Detalhes do RC */}
      <Dialog open={showRcDetail} onOpenChange={setShowRcDetail}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedRc?.nome}</DialogTitle>
          </DialogHeader>
          
          {selectedRc && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" />
                <span>{selectedRc.telefone}</span>
              </div>
              
              {selectedRc.cnpj && (
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span className="text-sm">CNPJ: {selectedRc.cnpj}</span>
                </div>
              )}
              
              {selectedRc.core && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-sm">Core/Resp.: {selectedRc.core}</span>
                </div>
              )}
              
              {selectedRc.endereco && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>{selectedRc.endereco}</span>
                </div>
              )}
              
              {selectedRc.cidade && (
                <div className="flex items-center gap-2">
                  <MapPinned className="w-4 h-4 text-slate-400" />
                  <span>{selectedRc.cidade}</span>
                </div>
              )}
              
              {selectedRc.observacao && (
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-sm text-slate-600">{selectedRc.observacao}</p>
                </div>
              )}
              
              <p className="text-xs text-slate-400">
                Cadastrado em: {formatDateBR(selectedRc.criadoEm)}
              </p>
            </div>
          )}
          
          <DialogFooter className="flex justify-between">
            <Button 
              variant="destructive" 
              onClick={() => deletarRc(selectedRc?.id)}
              className="gap-1"
            >
              <Trash2 className="w-4 h-4" /> Deletar
            </Button>
            <Button variant="outline" onClick={() => setShowRcDetail(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
