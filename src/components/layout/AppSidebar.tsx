import {
  LayoutDashboard,
  Users,
  Shield,
  Briefcase,
  UsersRound,
  Clock,
  Calendar,
  Award,
  GraduationCap,
  ClipboardList,
  CalendarDays,
  Search as SearchIcon,
  UserPlus,
  Receipt,
  TrendingUp,
  DollarSign,
  Wallet,
  FileSignature,
  FileWarning,
  IdCard,
  Package,
  Activity,
  Building2,
  BarChart3,
  Settings,
  Bot,
  Scale,
  Calculator,
  ShieldCheck,
  HeartPulse,
  Smile,
  Megaphone,
  AlertTriangle,
  BookOpenCheck,
  ListChecks,
  Star,
  FileBarChart,
  Settings2,
  HardHat,
  Shirt,
  Stethoscope,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const menuGroups = [
  {
    label: "Principal",
    items: [
      { title: "Visão Geral", url: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Pessoas",
    items: [
      { title: "Funcionários", url: "/dashboard", icon: Users, hash: "#funcionarios" },
      { title: "Gestores", url: "/managers", icon: Shield },
      { title: "Administradores", url: "/admin-users", icon: ShieldCheck },
      { title: "Admissão digital", url: "/admissao-digital", icon: UserPlus },
      { title: "Funções", url: "/funcoes", icon: Briefcase },
      { title: "People Manager", url: "/people-manager", icon: UsersRound },
    ],
  },
  {
    label: "Operacional",
    items: [
      { title: "Controle de Ponto", url: "/controle-ponto", icon: Clock },
      { title: "Escala de Férias", url: "/vacation-schedule", icon: Calendar },
      { title: "Avaliações", url: "/avaliacoes", icon: Award },
      { title: "Treinamentos", url: "/treinamentos", icon: GraduationCap },
      { title: "Checklists", url: "/plano-admissao-desligamento", icon: ClipboardList },
      { title: "Eventos", url: "/eventos", icon: CalendarDays },
    ],
  },
  {
    label: "Recrutamento",
    items: [
      { title: "Vagas", url: "/vagas", icon: SearchIcon },
      { title: "Candidaturas", url: "/recrutamento", icon: UserPlus },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Folha de Pagamento", url: "/payroll", icon: Receipt },
      { title: "Reajuste Salarial", url: "/salary-adjustment", icon: TrendingUp },
      { title: "Adiantamentos", url: "/adiantamentos", icon: DollarSign },
      { title: "Financeiro", url: "/financeiro", icon: Wallet },
    ],
  },
  {
    label: "Documentos",
    items: [
      { title: "Contratos", url: "/contracts", icon: FileSignature },
      { title: "TACs", url: "/tacs", icon: FileWarning },
      { title: "Crachás", url: "/crachas", icon: IdCard },
      { title: "Consulta Judicial", url: "/consulta-judicial", icon: Scale },
    ],
  },
  {
    label: "Estoque",
    items: [
      { title: "EPIs / Uniformes", url: "/stock", icon: Package },
      { title: "Distribuir EPI", url: "/distribuir-epi", icon: HardHat },
      { title: "Distribuir Uniforme", url: "/distribuir-uniforme", icon: Shirt },
    ],
  },
  {
    label: "Saúde",
    items: [
      { title: "Saúde Ocupacional", url: "/saude-ocupacional", icon: Activity },
      { title: "Afastamentos / Atestados", url: "/afastamentos", icon: Stethoscope },
    ],
  },
  {
    label: "Contabilidade",
    items: [
      { title: "Info. Contabilidade", url: "/contabilidade", icon: Calculator },
    ],
  },
  {
    label: "Admin",
    items: [
      { title: "Empresas", url: "/companies", icon: Building2 },
      { title: "Setores", url: "/sectors", icon: Building2 },
      { title: "Turnover", url: "/turnover", icon: TrendingUp },
      { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
      { title: "Configurações", url: "/settings", icon: Settings },
    ],
  },
  {
    label: "Cérebrum IA",
    items: [
      { title: "Inteligência Artificial", url: "/ai-insights", icon: Bot },
    ],
  },
  {
    label: "NR-1 | Gestão Psicossocial",
    items: [
      { title: "Dashboard NR-1", url: "/nr1/dashboard", icon: HeartPulse },
      { title: "Painel Gerencial", url: "/nr1/painel", icon: BarChart3 },
      { title: "Pesquisa de Clima", url: "/nr1/clima", icon: Smile },
      { title: "Canal de Denúncias", url: "/nr1/denuncias", icon: Megaphone },
      { title: "Gestão de Riscos", url: "/nr1/riscos", icon: AlertTriangle },
      { title: "Treinamentos NR-1", url: "/nr1/treinamentos", icon: BookOpenCheck },
      { title: "Ações Preventivas", url: "/nr1/acoes", icon: ListChecks },
      { title: "Avaliação de Liderança", url: "/nr1/lideranca", icon: Star },
      { title: "Relatórios NR-1", url: "/nr1/relatorios", icon: FileBarChart },
      { title: "Auditoria MT", url: "/nr1/auditoria", icon: ShieldCheck },
      { title: "Configurações NR-1", url: "/nr1/config", icon: Settings2 },
    ],
  },
];

interface AppSidebarProps {
  /** quando passado, filtra os itens do menu pelos módulos permitidos (admin_parcial). null = mostra tudo (gestor) */
  allowedModules?: Set<string> | null;
}

// mapeia url -> module key (precisa bater com src/lib/modules.ts)
const urlToModuleKey: Record<string, string> = {
  "/dashboard": "dashboard",
  "/managers": "managers",
  "/admin-users": "managers", // admin_parcial nunca vê isso (gerenciado por gestor)
  "/funcoes": "funcoes",
  "/people-manager": "people-manager",
  "/controle-ponto": "controle-ponto",
  "/vacation-schedule": "vacation-schedule",
  "/avaliacoes": "avaliacoes",
  "/treinamentos": "treinamentos",
  "/plano-admissao-desligamento": "plano-admissao-desligamento",
  "/admissao-digital": "admissao-digital",
  "/eventos": "eventos",
  "/vagas": "vagas",
  "/recrutamento": "recrutamento",
  "/payroll": "payroll",
  "/salary-adjustment": "salary-adjustment",
  "/adiantamentos": "adiantamentos",
  "/financeiro": "financeiro",
  "/contracts": "contracts",
  "/tacs": "tacs",
  "/crachas": "crachas",
  "/consulta-judicial": "consulta-judicial",
  "/stock": "stock",
  "/distribuir-epi": "distribuir-epi",
  "/distribuir-uniforme": "distribuir-uniforme",
  "/afastamentos": "afastamentos",
  "/saude-ocupacional": "saude-ocupacional",
  "/contabilidade": "contabilidade",
  "/companies": "companies",
  "/sectors": "sectors",
  "/turnover": "turnover",
  "/relatorios": "relatorios",
  "/settings": "settings",
  "/ai-insights": "ai-insights",
  "/nr1/dashboard": "nr1-dashboard",
  "/nr1/painel": "nr1-painel",
  "/nr1/clima": "nr1-clima",
  "/nr1/denuncias": "nr1-denuncias",
  "/nr1/riscos": "nr1-riscos",
  "/nr1/treinamentos": "nr1-treinamentos",
  "/nr1/acoes": "nr1-acoes",
  "/nr1/lideranca": "nr1-lideranca",
  "/nr1/relatorios": "nr1-relatorios",
  "/nr1/auditoria": "nr1-auditoria",
  "/nr1/config": "nr1-config",
};

export function AppSidebar({ allowedModules = null }: AppSidebarProps) {
  const { state } = useSidebar();
  const location = useLocation();
  const collapsed = state === "collapsed";

  const isActive = (url: string, hash?: string) =>
    location.pathname === url &&
    (url !== "/dashboard" || location.hash === (hash ?? ""));
  const canSee = (url: string) => {
    if (!allowedModules) return true;
    if (url === "/admin-users") return false; // só gestor cadastra
    const key = urlToModuleKey[url];
    return key ? allowedModules.has(key) : true;
  };

  return (
    <Sidebar collapsible="icon" className="z-40">

      <SidebarHeader className="h-16 justify-center px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-primary flex items-center justify-center shrink-0 text-primary-foreground text-[17px] font-bold">
            C
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-[15px] font-medium text-foreground">Cérebrum</span>
              <span className="text-[11px] text-muted-foreground">Sistema de RH</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        {menuGroups.map((group) => {
          const visibleItems = group.items.filter((it) => canSee(it.url));
          if (visibleItems.length === 0) return null;
          return (
          <SidebarGroup key={group.label} className="py-1">
            <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground/80 font-medium px-3 mb-1">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                       isActive={isActive(item.url, "hash" in item ? item.hash : undefined)}
                      tooltip={item.title}
                    >
                      <NavLink
                         to={item.url + ("hash" in item ? item.hash : "")}
                        end
                        className="flex items-center gap-3 rounded-[10px] px-3 py-2 text-sidebar-foreground transition-colors hover:text-foreground hover:bg-muted"
                         activeClassName={isActive(item.url, "hash" in item ? item.hash : undefined) ? "!bg-sidebar-accent !text-sidebar-accent-foreground font-medium" : undefined}
                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
                        <span className="text-[13px]">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <p className="text-[11px] text-muted-foreground text-center">
            RH Santa Bárbara
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
