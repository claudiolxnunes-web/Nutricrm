import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Bell, BellOff, BellRing, ShieldAlert, Smartphone, Trash2, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";

type EntityKey =
  | "clients"
  | "users"
  | "products"
  | "quotes"
  | "quoteItems"
  | "sales"
  | "interactions"
  | "opportunities"
  | "monthlyGoals"
  | "pushSubscriptions"
  | "orcamentosSimples";

const ENTITY_OPTIONS: { key: EntityKey; label: string }[] = [
  { key: "clients", label: "Clientes" },
  { key: "users", label: "Representantes/Usuários (exceto você)" },
  { key: "products", label: "Produtos" },
  { key: "quotes", label: "Orçamentos" },
  { key: "quoteItems", label: "Itens de Orçamento" },
  { key: "sales", label: "Vendas" },
  { key: "interactions", label: "Interações" },
  { key: "opportunities", label: "Oportunidades" },
  { key: "monthlyGoals", label: "Metas Mensais" },
  { key: "pushSubscriptions", label: "Assinaturas Push" },
  { key: "orcamentosSimples", label: "Orçamentos Simples" },
];

export default function NotificationSettings() {
  const { isSupported, permission, isSubscribed, isLoading, subscribe, unsubscribe } =
    usePushNotifications();
  const { data: me } = trpc.auth.me.useQuery();

  const [selectedEntities, setSelectedEntities] = useState<Record<EntityKey, boolean>>({
    clients: false,
    users: false,
    products: false,
    quotes: false,
    quoteItems: false,
    sales: false,
    interactions: false,
    opportunities: false,
    monthlyGoals: false,
    pushSubscriptions: false,
    orcamentosSimples: false,
  });
  const [confirmText, setConfirmText] = useState("");
  const [showDialog, setShowDialog] = useState(false);

  const clearMutation = trpc.admin.clearData.useMutation({
    onSuccess: (data) => {
      const total = Object.values(data.deleted).reduce((a, b) => a + b, 0);
      toast.success(`Dados limpos com sucesso! ${total} registros removidos.`);
      setShowDialog(false);
      setConfirmText("");
      setSelectedEntities({
        clients: false,
        users: false,
        products: false,
        quotes: false,
        quoteItems: false,
        sales: false,
        interactions: false,
        opportunities: false,
        monthlyGoals: false,
        pushSubscriptions: false,
        orcamentosSimples: false,
      });
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao limpar dados");
    },
  });

  const handleToggle = () => {
    if (isSubscribed) {
      unsubscribe();
    } else {
      subscribe();
    }
  };

  const toggleEntity = (key: EntityKey) => {
    setSelectedEntities((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedCount = Object.values(selectedEntities).filter(Boolean).length;
  const canSubmit = confirmText === "LIMPAR" && selectedCount > 0 && !clearMutation.isPending;

  const handleOpenDialog = () => {
    if (selectedCount === 0) {
      toast.error("Selecione pelo menos uma entidade para limpar.");
      return;
    }
    setShowDialog(true);
  };

  const handleConfirmClear = () => {
    const entities = (Object.entries(selectedEntities)
      .filter(([, v]) => v)
      .map(([k]) => k) as EntityKey[]);
    clearMutation.mutate({ entities, confirmText });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuracoes de Notificacoes</h1>
        <p className="text-slate-600 mt-1">Gerencie como voce recebe alertas do NutriCRM no seu dispositivo.</p>
      </div>

      {/* Status do dispositivo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-blue-600" />
            Notificacoes Push
          </CardTitle>
          <CardDescription>
            Receba alertas instantaneos mesmo com o navegador fechado (requer instalacao como PWA ou suporte do navegador).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSupported ? (
            <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <ShieldAlert className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-yellow-800">Navegador nao suportado</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Seu navegador nao suporta notificacoes push. Tente no Chrome, Edge ou Firefox mais recentes.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  {isSubscribed ? (
                    <BellRing className="w-5 h-5 text-green-600" />
                  ) : (
                    <BellOff className="w-5 h-5 text-slate-400" />
                  )}
                  <div>
                    <p className="font-medium">
                      {isSubscribed ? "Notificacoes ativas" : "Notificacoes desativadas"}
                    </p>
                    <p className="text-sm text-slate-500">
                      {permission === "denied"
                        ? "Permissao bloqueada no navegador. Desbloqueie nas configuracoes do browser."
                        : isSubscribed
                        ? "Voce esta recebendo alertas em tempo real."
                        : "Ative para receber alertas no dispositivo."}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isSubscribed}
                  onCheckedChange={handleToggle}
                  disabled={isLoading || permission === "denied"}
                />
              </div>

              {permission === "denied" && (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                  <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-red-800">Permissao bloqueada</p>
                    <p className="text-sm text-red-700 mt-1">
                      Voce bloqueou as notificacoes neste site. Para reativar, clique no icone de cadeado
                      na barra de endereco do navegador e permita notificacoes.
                    </p>
                  </div>
                </div>
              )}

              {!isSubscribed && permission !== "denied" && (
                <Button
                  onClick={subscribe}
                  disabled={isLoading}
                  className="gap-2"
                >
                  <Bell className="w-4 h-4" />
                  {isLoading ? "Ativando..." : "Ativar Notificacoes"}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Tipos de notificação */}
      <Card>
        <CardHeader>
          <CardTitle>Tipos de Alertas</CardTitle>
          <CardDescription>Voce recebera notificacoes automaticas para os seguintes eventos:</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              {
                icon: "🎯",
                title: "Nova Oportunidade",
                desc: "Quando uma oportunidade de venda e criada para voce.",
              },
              {
                icon: "📋",
                title: "Follow-up Pendente",
                desc: "Lembretes de visitas e acompanhamentos agendados.",
              },
              {
                icon: "✅",
                title: "Orcamento Aprovado",
                desc: "Quando um orcamento que voce criou e aceito pelo cliente.",
              },
            ].map((item) => (
              <div key={item.title} className="flex items-center gap-3 py-2 border-b last:border-0">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <p className="font-medium text-sm">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Info para admins */}
      {(me?.role === "admin" || me?.role === "superadmin") && (
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader>
            <CardTitle className="text-purple-800 text-base">Para Administradores</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-purple-700">
              Como administrador, voce pode enviar notificacoes manuais para representantes
              diretamente pela pagina de <strong>Usuarios</strong>. Para isso, o representante
              precisa ter as notificacoes ativas no dispositivo dele.
            </p>
            <p className="text-sm text-purple-700 mt-2">
              As variaveis de ambiente necessarias para producao sao:
              <code className="block mt-1 bg-purple-100 rounded px-2 py-1 font-mono text-xs">
                VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL
              </code>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Zona de Perigo - Limpar Dados */}
      {(me?.role === "admin" || me?.role === "superadmin") && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Zona de Perigo — Limpar Dados da Empresa
            </CardTitle>
            <CardDescription className="text-red-700">
              Atenção: esta ação é irreversível. Selecione os dados que deseja apagar permanentemente.
              Sua conta e a empresa serão preservadas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ENTITY_OPTIONS.map((opt) => (
                <div key={opt.key} className="flex items-start gap-2">
                  <Checkbox
                    id={opt.key}
                    checked={selectedEntities[opt.key]}
                    onCheckedChange={() => toggleEntity(opt.key)}
                  />
                  <Label htmlFor={opt.key} className="text-sm text-red-900 cursor-pointer">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-red-200">
              <Label htmlFor="confirm" className="text-sm font-medium text-red-800">
                Digite LIMPAR para confirmar:
              </Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Digite LIMPAR"
                className="mt-1 bg-white border-red-300"
              />
            </div>

            <Button
              variant="destructive"
              className="gap-2"
              disabled={!canSubmit}
              onClick={handleOpenDialog}
            >
              <Trash2 className="w-4 h-4" />
              Limpar dados selecionados
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dialog de confirmação final */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              Confirmar exclusão permanente
            </DialogTitle>
            <DialogDescription>
              Você está prestes a apagar os seguintes dados da empresa:
              <ul className="mt-2 space-y-1 text-sm">
                {ENTITY_OPTIONS.filter((o) => selectedEntities[o.key]).map((o) => (
                  <li key={o.key}>• {o.label}</li>
                ))}
              </ul>
              <p className="mt-3 text-red-600 font-medium">
                Esta ação não pode ser desfeita. Tem certeza?
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmClear}
              disabled={clearMutation.isPending}
            >
              {clearMutation.isPending ? "Limpando..." : "Sim, limpar tudo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
