import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { BarChart3, Users, TrendingUp, Zap } from "lucide-react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isAuthenticated && user) {
    setLocation("/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Navigation */}
      <nav className="border-b border-slate-700/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-emerald-500" />
            <span className="text-xl font-bold">NutriCRM</span>
          </div>
          <Button onClick={() => setLocation("/dashboard")} variant="default" size="lg">
            Entrar no Sistema
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
            Gestão Inteligente de Vendas de Nutrição Animal
          </h1>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Sistema CRM completo para produtores rurais. Organize seus clientes, acompanhe oportunidades e aumente suas vendas com inteligência.
          </p>
          <Button onClick={() => setLocation("/dashboard")} size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white">
            Começar Agora
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-20">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6 hover:border-emerald-500/50 transition">
            <Users className="w-8 h-8 text-emerald-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Gestão de Clientes</h3>
            <p className="text-slate-400">Cadastro completo com informações de fazenda, tipo de animal e localização</p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6 hover:border-emerald-500/50 transition">
            <TrendingUp className="w-8 h-8 text-emerald-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Funil Kanban</h3>
            <p className="text-slate-400">Visualize seu funil de vendas com 6 etapas bem definidas</p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6 hover:border-emerald-500/50 transition">
            <BarChart3 className="w-8 h-8 text-emerald-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Relatórios</h3>
            <p className="text-slate-400">Análise de vendas por período, produto e vendedor</p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6 hover:border-emerald-500/50 transition">
            <Zap className="w-8 h-8 text-emerald-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Dashboard</h3>
            <p className="text-slate-400">Métricas em tempo real e KPIs importantes</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-emerald-600/10 border-t border-emerald-600/20 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Pronto para transformar suas vendas?</h2>
          <p className="text-slate-300 mb-8">Acesse o sistema e comece a gerenciar seus clientes e oportunidades agora mesmo.</p>
          <Button onClick={() => setLocation("/dashboard")} size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white">
            Acessar Sistema
          </Button>
        </div>
      </section>
    </div>
  );
}
