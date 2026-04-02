import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, LogOut, PanelLeft, Users, BarChart3, Package, FileText, TrendingUp, Shield, BrainCircuit, BookOpen, MessageSquare, CalendarDays, ShieldCheck } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Users, label: "Clientes", path: "/clients" },
  { icon: TrendingUp, label: "Oportunidades", path: "/opportunities" },
  { icon: Package, label: "Produtos", path: "/products" },
  { icon: FileText, label: "Orcamentos", path: "/quotes" },
  { icon: BarChart3, label: "Relatorios", path: "/reports" },
  { icon: BrainCircuit, label: "Previsao IA", path: "/ai-forecast" },
  { icon: BookOpen, label: "Tutorial", path: "/tutorial" },
  { icon: MessageSquare, label: "Interacoes", path: "/interactions" },
  { icon: CalendarDays, label: "Planejamento", path: "/planning" },
  { icon: ShieldCheck, label: "Superadmin", path: "/superadmin" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;



function HelpButton() {
  const [, nav] = useLocation();
  return (
    <button
      onClick={() => nav("/tutorial")}
      className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-primary text-white rounded-full shadow-lg flex items-center justify-center text-xl font-bold hover:bg-primary/90 transition-all hover:scale-110"
      title="Tutorial"
    >?</button>
  );
}
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
    <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access to this dashboard requires authentication. Continue to launch the login flow.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center border-b border-sidebar-border/50">
            <div className="flex items-center gap-3 px-3 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors focus:outline-none shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-sidebar-foreground/60" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
                    <span className="text-primary-foreground font-black text-xs">NC</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sidebar-foreground text-sm leading-none tracking-tight">NutriCRM</p>
                    <p className="text-sidebar-foreground/50 text-[10px] leading-none mt-0.5">Nutricao Animal</p>
                  </div>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 px-3 py-2">
            <SidebarMenu className="gap-0.5">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-9 rounded-lg transition-all font-normal text-sm group/menu-btn
                        ${isActive
                          ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground font-medium shadow-sm"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }`}
                    >
                      <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary-foreground" : "text-sidebar-foreground/60"}`} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              <SidebarMenuItem key="/users">
                <SidebarMenuButton
                  isActive={location === "/users"}
                  onClick={() => setLocation("/users")}
                  tooltip="Usuarios"
                  className={`h-9 rounded-lg transition-all font-normal text-sm
                    ${location === "/users"
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground font-medium shadow-sm"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                >
                  <Shield className={`h-4 w-4 shrink-0 ${location === "/users" ? "text-primary-foreground" : "text-sidebar-foreground/60"}`} />
                  <span>Usuarios</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-sidebar-border/50">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-sidebar-accent transition-colors w-full text-left focus:outline-none group-data-[collapsible=icon]:justify-center">
                  <Avatar className="h-8 w-8 shrink-0 ring-2 ring-primary/30">
                    <AvatarFallback className="text-xs font-bold bg-primary text-primary-foreground">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-semibold text-sidebar-foreground truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-sidebar-foreground/50 truncate mt-1">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="bg-background">
        {!isMobile && (
          <div className="flex border-b border-border/60 h-14 items-center justify-between bg-white/80 px-6 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground/80 text-sm">{activeMenuItem?.label ?? "Dashboard"}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Avatar className="h-7 w-7 ring-2 ring-primary/20">
                  <AvatarFallback className="text-[10px] font-bold bg-primary text-primary-foreground">
                    {user?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground/70 hidden sm:block">{user?.name}</span>
              </div>
            </div>
          </div>
        )}
        {isMobile && (
          <div className="flex border-b border-border h-14 items-center justify-between bg-white/95 px-3 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40 shadow-sm">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg" />
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-black text-[10px]">NC</span>
                </div>
                <span className="font-semibold text-foreground text-sm">
                  {activeMenuItem?.label ?? "NutriCRM"}
                </span>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-5 md:p-6 max-w-[1400px] mx-auto w-full">{children}</main>
      <HelpButton />
      </SidebarInset>
    </>
  );
}