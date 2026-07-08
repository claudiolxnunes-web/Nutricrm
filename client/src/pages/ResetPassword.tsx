import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { useSearch } from "wouter";

export default function ResetPassword() {
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") ?? "";
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast.error("As senhas nao coincidem");
      return;
    }
    if (form.newPassword.length < 6) {
      toast.error("A senha deve ter no minimo 6 caracteres");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: form.newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDone(true);
      toast.success("Senha redefinida com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao redefinir senha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="h-10 w-10 rounded-xl bg-green-700 flex items-center justify-center shadow-md">
              <span className="text-white font-black text-sm">NC</span>
            </div>
            <h1 className="text-3xl font-bold text-green-800">NutriCRM</h1>
          </div>
          <p className="text-green-600 mt-1">Redefinir senha</p>
        </div>
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-center">Crie uma nova senha</h2>
          </CardHeader>
          <CardContent>
            {!token ? (
              <p className="text-center text-sm text-destructive">
                Link invalido. Solicite uma nova redefinicao de senha na tela de login.
              </p>
            ) : done ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">Sua senha foi redefinida com sucesso.</p>
                <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => (window.location.href = "/login")}>
                  Ir para o login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="new-password">Nova senha</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Minimo 6 caracteres"
                    value={form.newPassword}
                    onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
                    minLength={6}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Repita a nova senha"
                    value={form.confirmPassword}
                    onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    minLength={6}
                    required
                  />
                </div>
                <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={loading}>
                  {loading ? "Redefinindo..." : "Redefinir senha"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
