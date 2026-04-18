import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import { 
  Users, Calendar, DollarSign, TrendingUp, Phone, MapPin, 
  FileText, AlertCircle, CheckCircle, Clock, Activity, Eye, User
} from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const COLORS = ["#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899", "#06b6d4"];

export default function ManagerDashboard() {
  const [dateRange, setDateRange] = useState({
    fromDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    toDate: format(new Date(), "yyyy-MM-dd"),
  });
  const [activeTab, setActiveTab] = useState("resumo");
  const [selectedVendedor, setSelectedVendedor] = useState<any>(null);
  const [showVendedorDetail, setShowVendedorDetail] = useState(false);

  const { data: stats, isLoading } = trpc.interactions.managerStats.useQuery({
    fromDate: dateRange.fromDate,
    toDate: dateRange.toDate,
  });

  const { data: allClients } = trpc.clients.list.useQuery({ limit: 2000 });
  const clientsList = (allClients as any)?.data ?? (allClients as any) ?? [];

  const { data: allInteractions } = trpc.interactions?.all?.useQuery({}) || { data: [] };

  // Calcular métricas por vendedor
  const vendedorStats = useMemo(() => {
    if (!stats) return [];
    
    const userMap = new Map();
    
    stats.users.forEach((user: any) => {
      userMap.set(user.id, {
        id: user.id,
        name: user.name || user.email || `Vendedor ${user.id}`,
        email: user.email,
        totalInteractions: 0,
        visitas: 0,
        ligacoes: 0,
        reunioes: 0,
        visitasConcluidas: 0,
        visitasPerdidas: 0,
        oportunidades: 0,
        orcamentos: 0,
        valorOrcamentos: 0,
        tempoTotal: 0,
      });
    });
    
    // Contar interações
    stats.interactions.forEach((int: any) => {
      const user = userMap.get(int.createdBy);
      if (user) {
        user.totalInteractions++;
        user.tempoTotal += int.duration || 0;
        
        if (int.type === "visita") user.visitas++;
        else if (int.type === "ligacao") user.ligacoes++;
        else if (int.type === "reuniao") user.reunioes++;
        
        if (int.visitResult === "sucesso") user.visitasConcluidas++;
        else if (int.visitResult === "perdido") user.visitasPerdidas++;
      }
    });
    
    // Contar oportunidades
    stats.opportunities.forEach((opp: any) => {
      const user = userMap.get(opp.createdBy);
      if (user) user.oportunidades++;
    });
    
    // Contar orçamentos
    stats.orcamentos.forEach((orc: any) => {
      const user = userMap.get(orc.userId);
      if (user) {
        user.orcamentos++;
        user.valorOrcamentos += parseFloat(orc.total || 0);
      }
    });
    
    return Array.from(userMap.values()).sort((a, b) => b.totalInteractions - a.totalInteractions);
  }, [stats]);

  // Timeline de atividades
  const timeline = useMemo(() => {
    if (!stats) return [];
    return stats.interactions.slice(0, 50).map((int: any) => ({
      ...int,
      vendedor: stats.users.find((u: any) => u.id === int.createdBy)?.name || `ID ${int.createdBy}`,
    }));
  }, [stats]);

  // Clientes sem visita há mais de 15 dias
  const clientesSemVisita = useMemo(() => {
    if (!stats || !clientsList) return [];
    const clientesVisitados = new Set(stats.interactions.map((i: any) => i.clientId));
    return clientsList
      .filter((c: any) => !clientesVisitados.has(c.id))
      .slice(0, 20);
  }, [stats, clientsList]);

  // Dados para gráficos
  const chartData = vendedorStats.map(v => ({
    name: v.name.split(" ")[0],
    Visitas: v.visitas,
    Ligações: v.ligacoes,
    Reuniões: v.reunioes,
    Oportunidades: v.oportunidades,
    Orçamentos: v.orcamentos,
  }));

  const resultadoVisitas = [
    { name: "Concluídas", value: vendedorStats.reduce((s, v) => s + v.visitasConcluidas, 0) },
    { name: "Perdidas", value: vendedorStats.reduce((s, v) => s + v.visitasPerdidas, 0) },
    { name: "Pendentes", value: vendedorStats.reduce((s, v) => s + v.visitas - v.visitasConcluidas - v.visitasPerdidas, 0) },
  ];

  function formatDateBR(dateStr: string) {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  }

  function openVendedorDetail(vendedor: any) {
    setSelectedVendedor(vendedor);
    setShowVendedorDetail(true);
  }

  function getVendedorActivities(vendedorId: number) {
    return (allInteractions as any[] || [])
      .filter((i: any) => i.createdBy === vendedorId)
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 50);
  }

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard do Gestor</h1>
          <p className="text-slate-600">Acompanhe a performance da sua equipe</p>
        </div>
        <div className="flex gap-2">
          <Input
            type="date"
            value={dateRange.fromDate}
            onChange={(e) => setDateRange({ ...dateRange, fromDate: e.target.value })}
            className="w-auto"
          />
          <Input
            type="date"
            value={dateRange.toDate}
            onChange={(e) => setDateRange({ ...dateRange, toDate: e.target.value })}
            className="w-auto"
          />
        </div>
      </div>

      {/* Cards Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              <p className="text-sm text-slate-500">Total Interações</p>
            </div>
            <p className="text-2xl font-bold">{stats?.interactions?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-500" />
              <p className="text-sm text-slate-500">Visitas Realizadas</p>
            </div>
            <p className="text-2xl font-bold">
              {stats?.interactions?.filter((i: any) => i.type === "visita").length || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-500" />
              <p className="text-sm text-slate-500">Orçamentos</p>
            </div>
            <p className="text-2xl font-bold">{stats?.orcamentos?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <p className="text-sm text-slate-500">Valor Orçamentos</p>
            </div>
            <p className="text-2xl font-bold">
              R$ {stats?.orcamentos?.reduce((s: number, o: any) => s + parseFloat(o.total || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="resumo">Resumo por Vendedor</TabsTrigger>
          <TabsTrigger value="atividades">Atividades Recentes</TabsTrigger>
          <TabsTrigger value="graficos">Gráficos</TabsTrigger>
          <TabsTrigger value="alertas">
            Alertas
            {clientesSemVisita.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{clientesSemVisita.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance por Vendedor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-3 text-left">Vendedor</th>
                      <th className="p-3 text-center">Visitas</th>
                      <th className="p-3 text-center">Ligações</th>
                      <th className="p-3 text-center">Reuniões</th>
                      <th className="p-3 text-center">Oportunidades</th>
                      <th className="p-3 text-center">Orçamentos</th>
                      <th className="p-3 text-right">Valor Total</th>
                      <th className="p-3 text-center">Taxa Sucesso</th>
                      <th className="p-3 text-center">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendedorStats.map((v: any) => (
                      <tr key={v.id} className="border-t hover:bg-slate-50">
                        <td className="p-3">
                          <div className="font-medium">{v.name}</div>
                          <div className="text-xs text-slate-500">{v.email}</div>
                        </td>
                        <td className="p-3 text-center">{v.visitas}</td>
                        <td className="p-3 text-center">{v.ligacoes}</td>
                        <td className="p-3 text-center">{v.reunioes}</td>
                        <td className="p-3 text-center">{v.oportunidades}</td>
                        <td className="p-3 text-center">{v.orcamentos}</td>
                        <td className="p-3 text-right font-medium">
                          R$ {v.valorOrcamentos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-center">
                          {v.visitas > 0 ? (
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              (v.visitasConcluidas / v.visitas) > 0.5 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                            }`}>
                              {Math.round((v.visitasConcluidas / v.visitas) * 100)}%
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openVendedorDetail(v)}
                            title="Ver atividades"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="atividades" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Timeline de Atividades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {timeline.map((item: any) => (
                  <div key={item.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      item.type === "visita" ? "bg-green-500" :
                      item.type === "ligacao" ? "bg-blue-500" : "bg-purple-500"
                    }`} />
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-medium">{item.vendedor}</span>
                          <span className="text-slate-500 mx-2">•</span>
                          <span className="text-slate-600 capitalize">{item.type}</span>
                        </div>
                        <span className="text-xs text-slate-400">
                          {format(new Date(item.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-sm font-medium mt-1">{item.title}</p>
                      {item.clientName && (
                        <p className="text-xs text-slate-500">Cliente: {item.clientName}</p>
                      )}
                      {item.visitResult && (
                        <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded ${
                          item.visitResult === "sucesso" ? "bg-green-100 text-green-700" :
                          item.visitResult === "perdido" ? "bg-red-100 text-red-700" :
                          "bg-slate-100 text-slate-700"
                        }`}>
                          {item.visitResult}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="graficos" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Atividades por Vendedor</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Visitas" fill="#10b981" />
                    <Bar dataKey="Ligações" fill="#3b82f6" />
                    <Bar dataKey="Reuniões" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resultado das Visitas</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={resultadoVisitas}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {resultadoVisitas.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alertas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                Clientes sem Visita
              </CardTitle>
            </CardHeader>
            <CardContent>
              {clientesSemVisita.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-2" />
                  <p>Todos os clientes foram visitados no período!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {clientesSemVisita.map((client: any) => (
                    <div key={client.id} className="p-3 border rounded-lg bg-yellow-50">
                      <p className="font-medium">{client.farmName || client.producerName}</p>
                      <p className="text-sm text-slate-500">{client.city}, {client.state}</p>
                      {client.lastVisit && (
                        <p className="text-xs text-red-500 mt-1">
                          Última visita: {format(new Date(client.lastVisit), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Detalhes do Vendedor */}
      <Dialog open={showVendedorDetail} onOpenChange={setShowVendedorDetail}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Atividades: {selectedVendedor?.name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedVendedor && (
            <div className="space-y-4">
              {/* Resumo do Vendedor */}
              <div className="grid grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <Phone className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                    <p className="text-xl font-bold">{selectedVendedor.totalInteractions}</p>
                    <p className="text-xs text-slate-500">Interações</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <MapPin className="w-5 h-5 mx-auto mb-1 text-green-500" />
                    <p className="text-xl font-bold">{selectedVendedor.visitas}</p>
                    <p className="text-xs text-slate-500">Visitas</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <TrendingUp className="w-5 h-5 mx-auto mb-1 text-orange-500" />
                    <p className="text-xl font-bold">{selectedVendedor.oportunidades}</p>
                    <p className="text-xs text-slate-500">Oportunidades</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <DollarSign className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
                    <p className="text-xl font-bold">
                      R$ {selectedVendedor.valorOrcamentos.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-slate-500">Valor</p>
                  </CardContent>
                </Card>
              </div>

              {/* Lista de Atividades */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Histórico de Atividades
                  </CardTitle>
                </CardHeader>
                <CardContent className="max-h-[400px] overflow-y-auto">
                  {getVendedorActivities(selectedVendedor.id).length === 0 ? (
                    <p className="text-center text-slate-500 py-4">Nenhuma atividade registrada</p>
                  ) : (
                    <div className="space-y-2">
                      {getVendedorActivities(selectedVendedor.id).map((activity: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                          <div className={`w-2 h-2 rounded-full mt-2 ${
                            activity.type === "visita" ? "bg-green-500" :
                            activity.type === "ligacao" ? "bg-blue-500" :
                            activity.type === "reuniao" ? "bg-purple-500" :
                            "bg-slate-400"
                          }`} />
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-medium capitalize">{activity.type}</span>
                                <span className="text-slate-400 mx-2">•</span>
                                <span className="text-slate-600">{activity.title}</span>
                              </div>
                              <span className="text-xs text-slate-400">
                                {formatDateBR(activity.date)}
                              </span>
                            </div>                            
                            {activity.description && (
                              <p className="text-sm text-slate-600 mt-1">{activity.description}</p>
                            )}                            
                            <div className="flex gap-2 mt-2">
                              {activity.visitResult && (
                                <Badge className={
                                  activity.visitResult === "sucesso" ? "bg-green-100 text-green-700" :
                                  activity.visitResult === "perdido" ? "bg-red-100 text-red-700" :
                                  "bg-slate-100 text-slate-700"
                                }>
                                  {activity.visitResult}
                                </Badge>
                              )}                              
                              {activity.clientName && (
                                <span className="text-xs text-slate-500">
                                  Cliente: {activity.clientName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setShowVendedorDetail(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
