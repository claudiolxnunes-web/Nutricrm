import { useAuth } from "@/_core/hooks/useAuth";
import { Redirect } from "wouter";

type Role = "superadmin" | "admin" | "gerente" | "vendedor";

interface ProtectedRouteProps {
  allowedRoles: Role[];
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * Protege uma rota verificando o perfil (role) do usuário autenticado.
 * - Se ainda carregando, renderiza null (evita flash de conteúdo).
 * - Se não autenticado, redireciona para /login.
 * - Se autenticado mas sem permissão, redireciona para /dashboard.
 * - Se permitido, renderiza os filhos normalmente.
 */
export function ProtectedRoute({
  allowedRoles,
  children,
  redirectTo = "/dashboard",
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    return <Redirect to="/login" />;
  }

  const role = (user as any).role as Role;
  if (!allowedRoles.includes(role)) {
    return <Redirect to={redirectTo} />;
  }

  return <>{children}</>;
}
