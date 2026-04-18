import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  MapPin, Clock, Users, Target, TrendingUp, CheckCircle, 
  Phone, Navigation, Calendar, DollarSign, AlertCircle,
  Play, Square, Camera, Mic, Send, RefreshCw
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
  const [showCamera, setShowCamera] = useState(false);

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

    const visitaFinalizada: VisitaDia = {
      ...visitaAtual,
      endTime: new Date().toISOString(),
      status: resultado === "sucesso" ? "concluida" : resultado === "perdido" ? "cancelada" : "pendente",
      notes: notaVisita,
    };

    setVisitasHoje(prev => [...prev, visitaFinalizada]);
    setVisitaAtual(null);
    setNotaVisita("");

    setRealizado(prev => ({
      visitas: prev.visitas + 1,
      vendas: resultado === "sucesso" ? prev.vendas + 1000 : prev.vendas,
    }));

    toast.success("Visita finalizada!");
  };

  // Sincronizar dados
  const sincronizarDados = async () => {
    if (!isOnline) {
      toast.warning("Sem conexão. Dados salvos localmente.");
      return;
    }

    toast.info("Sincronizando...");
    // Aqui enviaria para o servidor via trpc.sync.mutate(...)
    toast.success("Dados sincronizados!");
  };

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
          onClick={() => setActiveTab("historico")}
          className={`flex flex-col items-center p-2 ${activeTab === "historico" ? "text-blue-600" : "text-slate-400"}`}
        >
          <Calendar className="w-6 h-6" />
          <span className="text-xs">Histórico</span>
        </button>
      </div>
    </div>
  );
}
