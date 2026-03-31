import { useState } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Lock, Check, Zap } from "lucide-react";

export default function TrialExpired() {
  const [loading, setLoading] = useState<string | null>(null);
  const { data: plans } = trpc.payments.plans.useQuery();
  const checkoutMutation = trpc.payments.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (e: any) => {
      alert("Erro ao criar sessao de pagamento: " + e.message);
      setLoading(null);
    },
  });

  const handlePlan = (planId: string) => {
    setLoading(planId);
    checkoutMutation.mutate({ planId: planId as any });
  };

  const features = [
    "Clientes ilimitados",
    "Multiplos representantes",
    "Funil de oportunidades",
    "Relatorios e metricas",
    "Suporte via WhatsApp",
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-3xl w-full space-y-8">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="p-4 bg-orange-100 rounded-full">
              <Lock className="w-10 h-10 text-orange-500" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-slate-800">Periodo de teste encerrado</h1>
          <p className="text-slate-500 max-w-md mx-auto">
            Seu trial gratuito de 7 dias encerrou. Escolha um plano para continuar usando o NutriCRM.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(plans ?? [
            { id: "mensal", name: "Mensal", label: "R$ 97/mes", badge: null, description: "Acesso por 30 dias", days: 30 },
            { id: "semestral", name: "Semestral", label: "R$ 497", badge: "14% off", description: "Acesso por 6 meses", days: 180 },
            { id: "anual", name: "Anual", label: "R$ 897", badge: "23% off", description: "Acesso por 12 meses", days: 365 },
          ]).map((plan: any, i: number) => (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl border-2 p-6 space-y-4 ${i === 2 ? "border-green-500 shadow-lg" : "border-slate-200"}`}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  {plan.badge}
                </span>
              )}
              {i === 2 && (
                <span className="absolute -top-3 right-4 bg-slate-800 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Mais popular
                </span>
              )}
              <div>
                <p className="font-semibold text-slate-700">{plan.name}</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{plan.label}</p>
                <p className="text-sm text-slate-400">{plan.description}</p>
              </div>
              <ul className="space-y-2">
                {features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-green-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => handlePlan(plan.id)}
                disabled={loading !== null}
                className={`w-full ${i === 2 ? "bg-green-600 hover:bg-green-700" : ""}`}
                variant={i === 2 ? "default" : "outline"}
              >
                {loading === plan.id ? "Aguarde..." : "Assinar"}
              </Button>
            </div>
          ))}
        </div>

        <div className="text-center space-y-2">
          <p className="text-xs text-slate-400">Pagamento seguro via Stripe - Pix, Boleto ou Cartao de credito</p>
          <p className="text-xs text-slate-400">Ja pagou? Entre em contato para liberar seu acesso.</p>
          <Button variant="ghost" size="sm" onClick={() => { window.location.href = "/login"; }} className="text-slate-400">
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
