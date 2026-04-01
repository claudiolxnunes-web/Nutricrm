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
import Login from "@/pages/Login";
import Users from "@/pages/Users";
import TrialExpired from "@/pages/TrialExpired";
import AiForecast from "@/pages/AiForecast";
import Tutorial from "@/pages/Tutorial";

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
          <DashboardLayout>
            <Products />
          </DashboardLayout>
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
      <Route path={"/users"}>
        {() => (
          <DashboardLayout>
            <Users />
          </DashboardLayout>
        )}
      </Route>
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


