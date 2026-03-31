import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Clock, Lock } from "lucide-react";

export default function TrialExpired() {
  const { data: me } = trpc.auth.me.useQuery();

  const handlePayment = async () => {
    const checkoutUrl = import.meta.env.VITE_MERCADOPAGO_URL || "https://mpago.la/seu-link";
    window.open(checkoutUrl, "_blank");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="p-4 bg-orange-100 rounded-full">
              <Lock className="w-10 h-10 text-orange-500" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Período de teste encerrado</h1>
            <p className="text-slate-500 mt-2">
              Seu trial gratuito de 7 dias encerrou. Para continuar usando o NutriCRM, assine o plano mensal.
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <p className="text-sm text-slate-500">Plano Mensal</p>
            <p className="text-3xl font-bold text-slate-800">R$ 97<span className="text-base font-normal text-slate-500">/mês</span></p>
            <ul className="text-sm text-slate-600 space-y-1 text-left pt-2">
              <li>✅ Clientes ilimitados</li>
              <li>✅ Múltiplos representantes</li>
              <li>✅ Relatórios e oportunidades</li>
              <li>✅ Suporte via WhatsApp</li>
            </ul>
          </div>
          <Button onClick={handlePayment} size="lg" className="w-full bg-green-600 hover:bg-green-700 text-white">
            Assinar agora — Pix, boleto ou cartão
          </Button>
          <p className="text-xs text-slate-400">
            Já pagou? Entre em contato com o administrador para liberar seu acesso.
          </p>
          <Button variant="ghost" size="sm" onClick={() => { window.location.href = "/login"; }} className="text-slate-400">
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
