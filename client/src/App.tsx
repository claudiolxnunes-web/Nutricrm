import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Clients from "./pages/Clients";
import Opportunities from "./pages/Opportunities";
import Products from "./pages/Products";
import Quotes from "./pages/Quotes";
import Dashboard from "./pages/Dashboard";
import Reports from "./pages/Reports";
import Sales from "./pages/Sales";
import Login from "@/pages/Login";
import Users from "@/pages/Users";
import TrialExpired from "@/pages/TrialExpired";
import AiForecast from "@/pages/AiForecast";
import Tutorial from "@/pages/Tutorial";
import Interactions from "@/pages/Interactions";
import Planning from "@/pages/Planning";
import SuperAdmin from "@/pages/SuperAdmin";
import ManagerDashboard from "./pages/ManagerDashboard";
import Representantes from "./pages/Representantes";
import VendedorApp from "./pages/VendedorApp";
import NotificationSettings from "./pages/NotificationSettings";
import { ProtectedRoute } from "./components/ProtectedRoute";

function Router() {
  return (
    <Switch>
      <Route path={"/login"} component={Login} />
      <Route path={"/trial-expired"} component={TrialExpired} />
      <Route path={"/"} component={Home} />
      <Route path={"/dashboard"}>
        {() => (
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/clients"}>
        {() => (
          <DashboardLayout>
            <Clients />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/opportunities"}>
        {() => (
          <DashboardLayout>
            <Opportunities />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/products"}>
        {() => (
          <ProtectedRoute allowedRoles={["admin", "superadmin"]}>
            <DashboardLayout>
              <Products />
            </DashboardLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path={"/quotes"}>
        {() => (
          <DashboardLayout>
            <Quotes />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/reports"}>
        {() => (
          <DashboardLayout>
            <Reports />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/sales"}>
        {() => (
          <DashboardLayout>
            <Sales />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/tutorial"}>
        {() => (
          <DashboardLayout>
            <Tutorial />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/ai-forecast"}>
        {() => (
          <DashboardLayout>
            <AiForecast />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/superadmin"}>
        {() => (
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <DashboardLayout>
              <SuperAdmin />
            </DashboardLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path={"/interactions"}>
        {() => (
          <DashboardLayout>
            <Interactions />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/planning"}>
        {() => (
          <DashboardLayout>
            <Planning />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/users"}>
        {() => (
          <ProtectedRoute allowedRoles={["admin", "superadmin"]}>
            <DashboardLayout>
              <Users />
            </DashboardLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path={"/gestor"}>
        {() => (
          <ProtectedRoute allowedRoles={["gerente", "admin", "superadmin"]}>
            <DashboardLayout>
              <ManagerDashboard />
            </DashboardLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path={"/representantes"}>
        {() => (
          <ProtectedRoute allowedRoles={["gerente", "admin", "superadmin"]}>
            <DashboardLayout>
              <Representantes />
            </DashboardLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path={"/notifications"}>
        {() => (
          <DashboardLayout>
            <NotificationSettings />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/app"} component={VendedorApp} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;


