import { Suspense, useEffect, useState } from "react";
import CarregandoTela from "./CarregandoTela";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useInactivityLock } from "@/hooks/useInactivityLock";
import LockScreen from "./LockScreen";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { moduleKeyFromPath } from "@/lib/modules";
import NavigationSearch from "@/components/dashboard/NavigationSearch";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>("all");
  const [empresas, setEmpresas] = useState<Array<{ id: string; nome: string; logo_url?: string }>>([]);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const { isLocked, unlock } = useInactivityLock(15 * 60 * 1000);
  const { role: userRole, allowedModules, loading: permLoading } = useUserPermissions(user?.id);
  const loading = !user || permLoading;

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "SIGNED_OUT") navigate("/auth");
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) navigate("/auth");
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Bloqueio de rota para admin_parcial
  useEffect(() => {
    if (userRole !== "admin_parcial") return;
    // /admin-users é exclusivo de gestor
    if (location.pathname === "/admin-users") {
      navigate("/dashboard", { replace: true });
      return;
    }
    const key = moduleKeyFromPath(location.pathname);
    if (key && !allowedModules.has(key)) {
      const fallback = allowedModules.has("dashboard")
        ? "/dashboard"
        : Array.from(allowedModules)[0];
      if (fallback) {
        navigate(fallback.startsWith("/") ? fallback : `/${fallback}`, { replace: true });
      }
    }
  }, [userRole, allowedModules, location.pathname, navigate]);

  useEffect(() => {
    const fetchEmpresas = async () => {
      const { data } = await supabase.from("empresas").select("id, nome, logo_url").order("nome");
      if (data) {
        setEmpresas(data);
        if (selectedEmpresa !== "all") {
          const sel = data.find((e) => e.id === selectedEmpresa);
          setCompanyLogo(sel?.logo_url || null);
        } else if (data.length > 0) {
          setCompanyLogo(data[0].logo_url || null);
        }
      }
    };
    if (user) fetchEmpresas();
  }, [user, selectedEmpresa]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error("Erro ao sair");
    else navigate("/auth");
  };

  if (isLocked && user?.email) {
    return <LockScreen userEmail={user.email} onUnlock={unlock} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">Acesso não autorizado</h1>
          <p className="text-muted-foreground">
            Seu usuário ainda não possui uma função atribuída. Entre em contato com o administrador.
          </p>
        </div>
      </div>
    );
  }

  if (userRole !== "gestor" && userRole !== "admin_parcial") {
    return <Suspense fallback={<CarregandoTela telaCheia />}>{children}</Suspense>;
  }

  const isPartial = userRole === "admin_parcial";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar allowedModules={isPartial ? allowedModules : null} />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-16 bg-card border-b border-border flex items-center gap-3 px-4 sm:px-6 shrink-0 z-20">
            <SidebarTrigger className="text-muted-foreground" />
            {companyLogo && (
              <img src={companyLogo} alt="Logo da empresa" className="w-8 h-8 object-contain hidden sm:block" />
            )}
            <div className="hidden md:flex flex-1 justify-center">
              <NavigationSearch />
            </div>
            <div className="ml-auto md:ml-0 flex items-center gap-2 sm:gap-3">
              <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
                <SelectTrigger className="h-9 w-[140px] sm:w-[230px] rounded-full border-0 bg-muted text-xs uppercase tracking-[0.03em] text-muted-foreground">
                  <SelectValue placeholder="Empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as empresas</SelectItem>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="hidden sm:block h-7 w-px bg-border" />
              <div className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800" title={isPartial ? "Administrador" : "Gestor"}>
                {isPartial ? "AD" : "RH"}
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Sair" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-auto p-4 sm:p-6 lg:px-8 lg:py-7">
            <Suspense fallback={<CarregandoTela />}>
              {typeof children === "function"
                ? (children as any)({ selectedEmpresa, empresas, user })
                : children}
            </Suspense>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
