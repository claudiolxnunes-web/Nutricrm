import { useState } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Lock, Check, Zap, Users, Building2, User } from "lucide-react";

const TIERS = [
  {
    id: "individual",
    icon: User,
    title: "Individual",
    subtitle: "1 usuario (so voce)",
    color: "border-slate-200",
    highlight: false,
    plans: [
      { id: "individual_mensal",    label: "R$ 49/mes",  period: "Mensal",    badge: null },
      { id: "individual_semestral", label: "R$ 249",     period: "Semestral", badge: "15% off" },
      { id: "individual_anual",     label: "R$ 439",     period: "Anual",     badge: "25% off" },
    ],
    features: ["1 usuario (admin)", "Clientes ilimitados", "Funil de oportunidades", "Previsao de vendas", "Suporte via WhatsApp"],
  },
  {
    id: "equipe",
    icon: Users,
    title: "Equipe",
    subtitle: "Admin + ate 5 representantes",
    color: "border-green-500",
    highlight: true,
    plans: [
      { id: "equipe_mensal",    label: "R$ 149/mes", period: "Mensal",    badge: null },
      { id: "equipe_semestral", label: "R$ 749",     period: "Semestral", badge: "16% off" },
      { id: "equipe_anual",     label: "R$ 1.349",   period: "Anual",     badge: "25% off" },
    ],
    features: ["Ate 6 usuarios", "Admin + representantes", "Clientes por representante", "Relatorios por equipe", "Suporte prioritario"],
  },
  {
    id: "empresa",
    icon: Building2,
    title: "Empresa",
    subtitle: "Admin + ate 20 representantes",
    color: "border-blue-500",
    highlight: false,
    plans: [
      { id: "empresa_mensal",    label: "R$ 349/mes", period: "Mensal",    badge: null },
      { id: "empresa_semestral", label: "R$ 1.749",   period: "Semestral", badge: "17% off" },
      { id: "empresa_anual",     label: "R$ 3.149",   period: "Anual",     badge: "25% off" },
    ],
    features: ["Ate 21 usuarios", "Multi-representante", "Dashboard consolidado", "Curva ABC de clientes", "Suporte VIP"],
  },
];

export default function TrialExpired() {
  const [loading, setLoading] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<number>(0); // 0=mensal, 1=semestral, 2=anual

  const checkoutMutation = trpc.payments.createCheckout.useMutation({
    onSuccess: (data) => { if (data.url) window.location.href = data.url; },
    onError: (e: any) => { alert("Erro: " + e.message); setLoading(null); },
  });

  const handlePlan = (planId: string) => {
    setLoading(planId);
    checkoutMutation.mutate({ planId: planId as any });
  };

  const periods = ["Mensal", "Semestral", "Anual"];

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-5xl mx-auto space-y-8 py-8">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="p-4 bg-orange-100 rounded-full">
              <Lock className="w-10 h-10 text-orange-500" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-slate-800">Escolha seu plano</h1>
          <p className="text-slate-500 max-w-md mx-auto">
            Seu trial gratuito de 7 dias encerrou. Assine para continuar usando o NutriCRM.
          </p>
        </div>

        {/* Seletor de periodo */}
        <div className="flex justify-center gap-2">
          {periods.map((p, i) => (
            <button
              key={p}
              onClick={() => setSelectedPeriod(i)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedPeriod === i ? "bg-primary text-white shadow" : "bg-white border border-slate-200 text-slate-600 hover:border-primary"}`}
            >
              {p}
              {i === 2 && <span className="ml-1 text-xs text-green-500 font-bold">25% off</span>}
            </button>
          ))}
        </div>

        {/* Cards de planos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TIERS.map((tier) => {
            const plan = tier.plans[selectedPeriod];
            const Icon = tier.icon;
            return (
              <div
                key={tier.id}
                className={`relative bg-white rounded-2xl border-2 p-6 space-y-5 ${tier.color} ${tier.highlight ? "shadow-xl scale-[1.02]" : "shadow-sm"}`}
              >
                {tier.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Mais popular
                  </span>
                )}
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${tier.highlight ? "bg-green-100" : "bg-slate-100"}`}>
                    <Icon className={`w-5 h-5 ${tier.highlight ? "text-green-600" : "text-slate-600"}`} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-lg">{tier.title}</p>
                    <p className="text-xs text-slate-400">{tier.subtitle}</p>
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-bold text-slate-800">{plan.label}</p>
                  {plan.badge && <span className="inline-block mt-1 bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">{plan.badge}</span>}
                </div>
                <ul className="space-y-2">
                  {tier.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                      <Check className="w-4 h-4 text-green-500 shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => handlePlan(plan.id)}
                  disabled={loading !== null}
                  className={`w-full ${tier.highlight ? "bg-green-600 hover:bg-green-700" : tier.id === "empresa" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                  variant={tier.highlight || tier.id === "empresa" ? "default" : "outline"}
                >
                  {loading === plan.id ? "Aguarde..." : "Assinar agora"}
                </Button>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-slate-400">
          Pagamento seguro via Stripe · Pix, Boleto ou Cartao de credito
        </p>
        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={() => { window.location.href = "/login"; }} className="text-slate-400">Sair</Button>
        </div>
      </div>
    </div>
  );
}