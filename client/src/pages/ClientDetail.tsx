import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Phone, Mail, MessageCircle, MapPin, Star, Calendar, Clock, Plus, Activity, CheckCircle2, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const INTERACTION_TYPES = [
  { value: "visita", label: "Visita Técnica", color: "bg-green-100 text-green-700", icon: "🚗" },
  { value: "ligacao", label: "Ligação", color: "bg-blue-100 text-blue-700", icon: "📞" },
  { value: "reuniao", label: "Reunião", color: "bg-purple-100 text-purple-700", icon: "🤝" },
  { value: "email", label: "E-mail", color: "bg-yellow-100 text-yellow-700", icon: "✉️" },
  { value: "nota", label: "Nota", color: "bg-slate-100 text-slate-700", icon: "📝" },
];

function scoreColor(s: number) {
  if (s >= 70) return "text-green-600";
  if (s >= 40) return "text-yellow-600";
  return "text-red-500";
}
function scoreBadge(s: number) {
  if (s >= 70) return "Alto Potencial";
  if (s >= 40) return "Médio Potencial";
  return "Baixo Potencial";
}

function calcAutoScore(client: any, interactions: any[]) {
  let s = 0;
  if (client.status === "ativo") s += 30;
  else if (client.status === "prospect") s += 15;
  if ((client.animalQuantity ?? 0) > 500) s += 25;
  else if ((client.animalQuantity ?? 0) > 100) s += 15;
  else if ((client.animalQuantity ?? 0) > 0) s += 5;
  const intCount = interactions.length;
  s += Math.min(intCount * 5, 25);
  if (client.email) s += 5;
  if (client.phone || client.whatsapp) s += 5;
  if (client.city) s += 5;
  return Math.min(s, 100);
}

type Tab = "timeline" | "visitas" | "mapa" | "score";

export default function ClientDetail({ client, open, onClose, onRefresh }: {
  client: any;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState<Tab>("timeline");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "visita", title: "", description: "", date: new Date().toISOString().slice(0, 16), duration: "", result: "", nextAction: "", nextVisitDate: "", visitResult: "" });

  const { data: interactions = [], refetch: refetchInt } = trpc.interactions.list.useQuery(
    { clientId: client?.id, limit: 100 },
    { enabled: !!client?.id }
  );

  const { data: visits = [], refetch: refetchVisits } = trpc.interactions.visits.useQuery(
    { clientId: client?.id },
    { enabled: !!client?.id }
  );

  const createMutation = trpc.interactions.create.useMutation({
    onSuccess: () => { toast.success("Registrado!"); setShowForm(false); setForm({ type: "visita", title: "", description: "", date: new Date().toISOString().slice(0, 16), duration: "", result: "", nextAction: "", nextVisitDate: "", visitResult: "" }); refetchInt(); refetchVisits(); },
    onError: (e: any) => toast.error(e.message),
  });

  const scoreMutation = trpc.clients.updateScore.useMutation({
    onSuccess: () => { toast.success("Score atualizado!"); onRefresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!client) return null;

  const autoScore = calcAutoScore(client, interactions as any[]);
  const score = client.score ?? autoScore;

  const mapUrl = client.lat && client.lng
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(client.lng)-0.05},${parseFloat(client.lat)-0.05},${parseFloat(client.lng)+0.05},${parseFloat(client.lat)+0.05}&layer=mapnik&marker=${client.lat},${client.lng}`
    : client.city
    ? `https://www.openstreetmap.org/export/embed.html?query=${encodeURIComponent((client.address ?? "") + " " + client.city + " " + (client.state ?? "") + " Brasil")}&layer=mapnik`
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.date) { toast.error("Preencha título e data"); return; }
    createMutation.mutate({
      clientId: client.id,
      type: form.type as any,
      title: form.title,
      description: form.description || undefined,
      date: new Date(form.date),
      duration: form.duration ? parseInt(form.duration) : undefined,
      result: form.result || undefined,
      nextAction: form.nextAction || undefined,
    });
  };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "timeline", label: "Timeline", icon: Activity },
    { id: "visitas", label: "Visitas", icon: Calendar },
    { id: "mapa", label: "Mapa", icon: MapPin },
    { id: "score", label: "Score", icon: Star },
  ];

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-xl truncate">{client.farmName}</SheetTitle>
              <p className="text-sm text-slate-500 mt-0.5">{client.producerName}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant={client.status === "ativo" ? "default" : client.status === "inativo" ? "secondary" : "outline"}>
                  {client.status}
                </Badge>
                {client.animalType && <Badge variant="outline">{client.animalType}</Badge>}
                {client.city && <Badge variant="outline">{client.city}/{client.state}</Badge>}
              </div>
            </div>
            <div className="text-center shrink-0">
              <div className={`text-3xl font-bold ${scoreColor(score)}`}>{score}</div>
              <p className="text-xs text-slate-400">{scoreBadge(score)}</p>
            </div>
          </div>
          <div className="flex gap-3 mt-2 flex-wrap">
            {client.phone && <a href={`tel:${client.phone}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline"><Phone className="w-3 h-3" />{client.phone}</a>}
            {client.whatsapp && <a href={`https://wa.me/55${client.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-green-600 hover:underline"><MessageCircle className="w-3 h-3" />{client.whatsapp}</a>}
            {client.email && <a href={`mailto:${client.email}`} className="flex items-center gap-1 text-xs text-slate-600 hover:underline"><Mail className="w-3 h-3" />{client.email}</a>}
          </div>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex gap-1 my-4 flex-wrap">
          {tabs.map(t => (
            <Button key={t.id} variant={tab === t.id ? "default" : "ghost"} size="sm" className="gap-1.5" onClick={() => setTab(t.id)}>
              <t.icon className="w-3.5 h-3.5" />{t.label}
            </Button>
          ))}
          <Button size="sm" className="gap-1.5 ml-auto" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5" />Registrar
          </Button>
        </div>

        {/* TIMELINE */}
        {tab === "timeline" && (
          <div className="space-y-3">
            {(interactions as any[]).length === 0 && <p className="text-slate-400 text-sm text-center py-8">Nenhuma interação registrada ainda.</p>}
            {(interactions as any[]).map((int: any, i: number) => {
              const t = INTERACTION_TYPES.find(x => x.value === int.type) ?? INTERACTION_TYPES[4];
              return (
                <div key={int.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base ${t.color}`}>{t.icon}</div>
                    {i < (interactions as any[]).length - 1 && <div className="w-0.5 bg-slate-200 flex-1 mt-1"></div>}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm">{int.title}</p>
                      <span className="text-xs text-slate-400 shrink-0">{new Date(int.date).toLocaleDateString("pt-BR")}</span>
                    </div>
                    {int.description && <p className="text-xs text-slate-500 mt-0.5">{int.description}</p>}
                    {int.result && <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Resultado: {int.result}</p>}
                    {int.nextAction && <p className="text-xs text-blue-600 mt-0.5 flex items-center gap-1"><ChevronRight className="w-3 h-3" />Próximo passo: {int.nextAction}</p>}
                    {int.duration && <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3" />{int.duration} min</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* VISITAS */}
        {tab === "visitas" && (
          <div className="space-y-3">
            {(visits as any[]).length === 0 && <p className="text-slate-400 text-sm text-center py-8">Nenhuma visita técnica registrada.</p>}
            {(visits as any[]).map((v: any) => (
              <Card key={v.id}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{v.title}</p>
                      {v.description && <p className="text-xs text-slate-500 mt-0.5">{v.description}</p>}
                    </div>
                    <Badge variant="outline" className="shrink-0 ml-2">
                      {new Date(v.date).toLocaleDateString("pt-BR")}
                    </Badge>
                  </div>
                  {v.result && <p className="text-xs text-green-600 mt-2 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Resultado: {v.result}</p>}
                  {v.nextAction && <p className="text-xs text-blue-600 mt-1 flex items-center gap-1"><ChevronRight className="w-3 h-3" />Próximo passo: {v.nextAction}</p>}
                  {v.duration && <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><Clock className="w-3 h-3" />{v.duration} min</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* MAPA */}
        {tab === "mapa" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <MapPin className="w-4 h-4" />
              {[client.address, client.city, client.state, client.zipCode].filter(Boolean).join(", ") || "Endereço não informado"}
            </div>
            {mapUrl ? (
              <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                <iframe
                  src={mapUrl}
                  width="100%"
                  height="350"
                  style={{ border: 0 }}
                  loading="lazy"
                  title="Localização do cliente"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <MapPin className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-slate-400 text-sm">Cadastre a cidade/endereço do cliente</p>
                <p className="text-slate-400 text-xs">para exibir o mapa</p>
              </div>
            )}
            <p className="text-xs text-slate-400">Mapa via OpenStreetMap. Para precisão, cadastre endereço completo no cliente.</p>
          </div>
        )}

        {/* SCORE */}
        {tab === "score" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  Score de Potencial do Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-4">
                  <div className={`text-6xl font-bold ${scoreColor(score)}`}>{score}</div>
                  <p className={`text-lg font-medium mt-1 ${scoreColor(score)}`}>{scoreBadge(score)}</p>
                  <div className="w-full bg-slate-100 rounded-full h-3 mt-3">
                    <div className={`h-3 rounded-full transition-all ${score >= 70 ? "bg-green-500" : score >= 40 ? "bg-yellow-500" : "bg-red-400"}`} style={{ width: `${score}%` }}></div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <p className="font-medium text-slate-700">Composição do score automático:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className={`p-2 rounded-lg ${client.status === "ativo" ? "bg-green-50" : "bg-slate-50"}`}>
                      <p className="text-xs text-slate-500">Status</p>
                      <p className="font-medium">{client.status === "ativo" ? "+30 pts" : client.status === "prospect" ? "+15 pts" : "+0 pts"}</p>
                    </div>
                    <div className={`p-2 rounded-lg ${(client.animalQuantity ?? 0) > 100 ? "bg-green-50" : "bg-slate-50"}`}>
                      <p className="text-xs text-slate-500">Tamanho do rebanho</p>
                      <p className="font-medium">{(client.animalQuantity ?? 0) > 500 ? "+25 pts" : (client.animalQuantity ?? 0) > 100 ? "+15 pts" : (client.animalQuantity ?? 0) > 0 ? "+5 pts" : "+0 pts"}</p>
                    </div>
                    <div className={`p-2 rounded-lg ${(interactions as any[]).length > 0 ? "bg-green-50" : "bg-slate-50"}`}>
                      <p className="text-xs text-slate-500">Interações</p>
                      <p className="font-medium">+{Math.min((interactions as any[]).length * 5, 25)} pts ({(interactions as any[]).length}x)</p>
                    </div>
                    <div className={`p-2 rounded-lg ${client.city ? "bg-green-50" : "bg-slate-50"}`}>
                      <p className="text-xs text-slate-500">Dados cadastrais</p>
                      <p className="font-medium">+{(client.email ? 5 : 0) + (client.phone || client.whatsapp ? 5 : 0) + (client.city ? 5 : 0)} pts</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t">
                  <Button className="flex-1" variant="outline" onClick={() => scoreMutation.mutate({ id: client.id, score: autoScore })}>
                    Recalcular Automático ({autoScore} pts)
                  </Button>
                  <div className="flex gap-1 items-center">
                    <Input
                      type="number" min="0" max="100"
                      defaultValue={score}
                      className="w-20"
                      id="manual-score"
                    />
                    <Button onClick={() => {
                      const val = parseInt((document.getElementById("manual-score") as HTMLInputElement)?.value ?? "0");
                      scoreMutation.mutate({ id: client.id, score: Math.min(100, Math.max(0, val)) });
                    }} disabled={scoreMutation.isPending}>
                      Salvar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Dialog: Registrar interação */}
        <Dialog open={showForm} onOpenChange={(o) => !o && setShowForm(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar Interação</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3 py-2">
              <div>
                <label className="text-sm font-medium">Tipo</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm mt-1">
                  {INTERACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Título *</label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Visita de apresentação de produto" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Data/Hora *</label>
                  <Input type="datetime-local" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Duração (min)</label>
                  <Input type="number" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} placeholder="60" className="mt-1" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm mt-1" rows={2} placeholder="Detalhes da interação" />
              </div>
              <div>
                <label className="text-sm font-medium">Resultado</label>
                <Input value={form.result} onChange={e => setForm({ ...form, result: e.target.value })} placeholder="O que aconteceu?" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Próximo passo</label>
                <Input value={form.nextAction} onChange={e => setForm({ ...form, nextAction: e.target.value })} placeholder="O que fazer a seguir?" className="mt-1" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "Salvando..." : "Registrar"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
