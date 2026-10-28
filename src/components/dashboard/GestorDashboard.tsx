import { useState, useEffect } from "react";
import { parseDateOnly, todayISO, toISODateLocal, dataBR } from "@/lib/date";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutDashboard,
  Users,
  LogOut,
  Search,
  Plus,
  Shield,
  Calendar,
  FileText,
  Clock,
  Package,
  TrendingUp,
  Building2,
  DollarSign,
  Wallet,
  Bell,
  Receipt,
  Briefcase,
  FileSignature,
  TrendingUp as TrendingUpIcon,
  BarChart3,
  Activity,
  Settings,
  Award,
  GraduationCap,
  ClipboardList,
  CheckCircle2,
  UsersRound,
  FileWarning,
  IdCard,
  Bot,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { VacationProgress } from "@/components/ui/vacation-progress";
import { Skeleton } from "@/components/ui/skeleton";
import EmployeeList from "@/components/employees/EmployeeList";
import EmployeeForm from "@/components/forms/EmployeeForm";
import TimeOffListDialog from "@/components/dashboard/TimeOffListDialog";
import TimeOffHistoryDialog from "@/components/dashboard/TimeOffHistoryDialog";
import AvisoForm from "@/components/forms/AvisoForm";
import ManageAvisosDialog from "@/components/dashboard/ManageAvisosDialog";
import LoginHistoryDialog from "@/components/dashboard/LoginHistoryDialog";
import MetricsCharts from "@/components/dashboard/MetricsCharts";

import StockAlerts from "@/components/dashboard/StockAlerts";
import AttendanceMetrics from "@/components/dashboard/AttendanceMetrics";
import DashboardFilters from "@/components/dashboard/DashboardFilters";
import { WorkforceAlerts } from "@/components/dashboard/WorkforceAlerts";
import { BirthdayCard } from "@/components/dashboard/BirthdayCard";
import { BirthdayListDialog } from "@/components/dashboard/BirthdayListDialog";
import { PendingChecklistsAlert } from "@/components/dashboard/PendingChecklistsAlert";
import { ExperiencePeriodAlerts } from "@/components/dashboard/ExperiencePeriodAlerts";
import { DocumentosVencendoAlert } from "@/components/dashboard/DocumentosVencendoAlert";
import EventoNotifications from "@/components/dashboard/EventoNotifications";
import TaskList from "@/components/dashboard/TaskList";
import NavigationSearch from "@/components/dashboard/NavigationSearch";
import IndicadoresEstrategicos from "@/components/dashboard/IndicadoresEstrategicos";
import { toast } from "sonner";

interface GestorDashboardProps {
  user: User;
}

const GestorDashboard = ({ user }: GestorDashboardProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showTimeOffDialog, setShowTimeOffDialog] = useState(false);
  const [showTimeOffHistoryDialog, setShowTimeOffHistoryDialog] = useState(false);
  const [showAvisoDialog, setShowAvisoDialog] = useState(false);
  const [showManageAvisosDialog, setShowManageAvisosDialog] = useState(false);
  const [showLoginHistoryDialog, setShowLoginHistoryDialog] = useState(false);
  const [showBirthdayDialog, setShowBirthdayDialog] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>("all");
  const [empresas, setEmpresas] = useState<Array<{ id: string; nome: string; logo_url?: string }>>([]);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    onVacation: 0,
    onLeave: 0,
  });
  const [employeesOnVacation, setEmployeesOnVacation] = useState<any[]>([]);
  const [period, setPeriod] = useState("current");
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const requestedTab = location.hash.slice(1);
  const activeTab = ["funcionarios", "charts", "estrategico", "stock", "attendance"].includes(requestedTab)
    ? requestedTab
    : "overview";
  const setActiveTab = (tab: string) => {
    navigate({ pathname: "/dashboard", hash: tab === "overview" ? "" : `#${tab}` });
  };
  
  // Metrics state
  const [metricsData, setMetricsData] = useState<any>(null);

  useEffect(() => {
    fetchEmpresas();
    fetchStats();
    fetchEmployeesOnVacation();
    fetchAdvancedMetrics();
  }, [selectedEmpresa, period]);

  const fetchEmpresas = async () => {
    const { data } = await supabase
      .from("empresas")
      .select("id, nome, logo_url")
      .order("nome");
    
    if (data) {
      setEmpresas(data);
      
      // Set logo from selected company or first company
      if (selectedEmpresa !== "all") {
        const selectedCompany = data.find(e => e.id === selectedEmpresa);
        setCompanyLogo(selectedCompany?.logo_url || null);
      } else if (data.length > 0) {
        setCompanyLogo(data[0].logo_url || null);
      }
    }
  };

  const fetchStats = async () => {
    try {
      let query = supabase.from("employees").select("id, status");
      
      if (selectedEmpresa && selectedEmpresa !== "all") {
        query = query.eq("empresa_id", selectedEmpresa);
      }

      const { data: employees } = await query;

      if (employees && employees.length > 0) {
        // Filtrar funcionários não demitidos para o total
        const nonDismissedEmployees = employees.filter((e: any) => e.status !== "demitido");
        const employeeIds = nonDismissedEmployees.map((e: any) => e.id);
        
        const todayStr = todayISO();

        // Contar férias em gozo ativas HOJE (dinâmico)
        const { data: vacationData } = await supabase
          .from("ferias")
          .select("employee_id")
          .in("employee_id", employeeIds)
          .lte("periodo_gozo_inicio", todayStr)
          .gte("periodo_gozo_fim", todayStr);

        const onVacationIds = new Set(vacationData?.map((v: any) => v.employee_id) || []);
        const onVacationCount = onVacationIds.size;
        const onLeaveCount = nonDismissedEmployees.filter((e: any) => e.status === "afastado").length;

        // Ativos = total - férias dinâmicas - afastados
        const activeCount = nonDismissedEmployees.length - onVacationCount - onLeaveCount;

        setStats({
          totalEmployees: nonDismissedEmployees.length,
          activeEmployees: activeCount,
          onVacation: onVacationCount,
          onLeave: onLeaveCount,
        });
      } else {
        setStats({
          totalEmployees: 0,
          activeEmployees: 0,
          onVacation: 0,
          onLeave: 0,
        });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchEmployeesOnVacation = async () => {
    try {
      const todayStr = todayISO();

      // Buscar férias ativas (gozo) que estão em andamento HOJE
      const { data: activeVacations, error: vacationsError } = await supabase
        .from("ferias")
        .select("*")
        .lte("periodo_gozo_inicio", todayStr)
        .gte("periodo_gozo_fim", todayStr)
        .eq("data_retorno_confirmada", false);

      if (vacationsError || !activeVacations || activeVacations.length === 0) {
        setEmployeesOnVacation([]);
        return;
      }

      const employeeIds = Array.from(new Set(activeVacations.map((v: any) => v.employee_id)));

      let employeeQuery = supabase
        .from("employees")
        .select("id, nome_completo, cargo, empresa_id, status")
        .in("status", ["ativo", "ferias"]) // Funcionários ativos ou em férias
        .in("id", employeeIds);

      if (selectedEmpresa && selectedEmpresa !== "all") {
        employeeQuery = employeeQuery.eq("empresa_id", selectedEmpresa);
      }

      const { data: employees, error: employeesError } = await employeeQuery;

      if (employeesError || !employees || employees.length === 0) {
        setEmployeesOnVacation([]);
        return;
      }

      const employeesWithVacations = employees
        .map((emp: any) => {
          const vacation = activeVacations.find((v: any) => v.employee_id === emp.id);
          return vacation ? { ...emp, vacation } : null;
        })
        .filter(Boolean) as any[];

      setEmployeesOnVacation(employeesWithVacations);
    } catch (error) {
      console.error("Error fetching employees on vacation:", error);
      setEmployeesOnVacation([]);
    }
  };

  const calculateVacationProgress = (inicio: string, fim: string, diasTotais: number) => {
    const startDate = dataBR(inicio);
    const endDate = dataBR(fim);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysPassed = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = diasTotais - daysPassed;

    const progress = Math.min(100, Math.max(0, (daysPassed / diasTotais) * 100));
    
    const realVacationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const timeOffDays = diasTotais - realVacationDays;

    return { 
      progress, 
      daysRemaining: Math.max(0, daysRemaining), 
      totalDays: diasTotais,
      vacationDays: realVacationDays,
      timeOffDays
    };
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Erro ao sair");
    } else {
      navigate("/auth");
    }
  };

  const handleAddEmployee = () => {
    setShowAddDialog(true);
  };

  const fetchAdvancedMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const now = new Date();
      let startDate: Date;
      
      // Calculate date range based on period
      switch (period) {
        case "last3":
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          break;
        case "last6":
          startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
          break;
        case "year":
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default: // current month
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      // Fetch all employees
      let employeeQuery = supabase.from("employees").select("*");
      if (selectedEmpresa && selectedEmpresa !== "all") {
        employeeQuery = employeeQuery.eq("empresa_id", selectedEmpresa);
      }
      const { data: employees } = await employeeQuery;

      // Fetch sectors
      const { data: sectors } = await supabase.from("setores").select("*");

      // Fetch payroll data
      let payrollQuery = supabase.from("folha_pagamento").select("*").gte("created_at", startDate.toISOString());
      if (selectedEmpresa && selectedEmpresa !== "all") {
        payrollQuery = payrollQuery.eq("empresa_id", selectedEmpresa);
      }
      const { data: payroll } = await payrollQuery;

      // Fetch stock data
      const { data: episStock } = await supabase.from("estoque_epis").select("*");
      const { data: uniformsStock } = await supabase.from("estoque_uniformes").select("*");
      
      // Fetch distribution history
      const { data: episDistribution } = await supabase
        .from("historico_estoque_epis")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .eq("tipo_movimentacao", "saida");
      
      const { data: uniformsDistribution } = await supabase
        .from("historico_estoque_uniformes")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .eq("tipo_movimentacao", "saida");

      // Fetch absences
      let absencesQuery = supabase.from("faltas").select("*, employees(nome_completo)").gte("data", toISODateLocal(startDate));
      const { data: absences } = await absencesQuery;

      // Process data for charts - usar contagem real de férias ativas hoje
      const todayForChart = todayISO();
      const employeeIds = employees?.map((e: any) => e.id) || [];
      let onVacationChartCount = 0;
      if (employeeIds.length > 0) {
        const { count } = await supabase
          .from("ferias")
          .select("*", { count: "exact", head: true })
          .in("employee_id", employeeIds)
          .lte("periodo_gozo_inicio", todayForChart)
          .gte("periodo_gozo_fim", todayForChart);
        onVacationChartCount = count || 0;
      }

      const statusData = [
        { name: "Ativos", value: employees?.filter(e => e.status === "ativo").length || 0, color: "hsl(var(--secondary))" },
        { name: "Férias", value: onVacationChartCount, color: "hsl(var(--primary))" },
        { name: "Afastados", value: employees?.filter(e => e.status === "afastado").length || 0, color: "hsl(var(--warning))" },
        { name: "Demitidos", value: employees?.filter(e => e.status === "demitido").length || 0, color: "hsl(var(--destructive))" }
      ];

      // Employees by sector
      const sectorCounts = sectors?.map(sector => ({
        name: sector.nome,
        total: employees?.filter(e => e.setor === sector.nome).length || 0
      })) || [];

      // Calculate evolution data (last 6 months)
      const monthsEvolution = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = monthDate.toLocaleDateString("pt-BR", { month: "short" });
        const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).toISOString();
        const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).toISOString();
        
        const admitted = employees?.filter(e => e.data_admissao && e.data_admissao >= monthStart.split("T")[0] && e.data_admissao <= monthEnd.split("T")[0]).length || 0;
        const dismissed = employees?.filter(e => e.data_desligamento && e.data_desligamento >= monthStart.split("T")[0] && e.data_desligamento <= monthEnd.split("T")[0]).length || 0;
        const total = employees?.filter(e => {
          const admDate = e.data_admissao ? (parseDateOnly(e.data_admissao) ?? new Date()) : null;
          const dismDate = e.data_desligamento ? dataBR(e.data_desligamento) : null;
          return admDate && admDate <= dataBR(monthEnd) && (!dismDate || dismDate >= dataBR(monthStart));
        }).length || 0;
        
        monthsEvolution.push({
          month: monthName,
          total,
          admissions: admitted,
          dismissals: dismissed
        });
      }

      // Financial metrics
      const currentMonthPayroll = payroll?.filter(p => {
        const pDate = dataBR(p.created_at || "");
        return pDate.getMonth() === now.getMonth() && pDate.getFullYear() === now.getFullYear();
      }).reduce((sum, p) => sum + (p.valor_liquido || 0), 0) || 0;

      const previousMonthPayroll = payroll?.filter(p => {
        const pDate = dataBR(p.created_at || "");
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return pDate.getMonth() === prevMonth.getMonth() && pDate.getFullYear() === prevMonth.getFullYear();
      }).reduce((sum, p) => sum + (p.valor_liquido || 0), 0) || 0;

      const avgSalary = employees && employees.length > 0
        ? employees.filter(e => e.status === "ativo" && e.salario).reduce((sum, e) => sum + (e.salario || 0), 0) / employees.filter(e => e.status === "ativo" && e.salario).length
        : 0;

      // Payroll by sector
      const payrollBySector = sectors?.map(sector => {
        const sectorEmployees = employees?.filter(e => e.setor === sector.nome && e.status === "ativo") || [];
        const total = sectorEmployees.reduce((sum, e) => sum + (e.salario || 0), 0);
        return { name: sector.nome, value: total };
      }).filter(s => s.value > 0) || [];

      // Payroll evolution (last 6 months)
      const payrollEvolution = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = monthDate.toLocaleDateString("pt-BR", { month: "short" });
        const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).toISOString();
        const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).toISOString();
        
        const monthTotal = payroll?.filter(p => {
          const pDate = dataBR(p.created_at || "");
          return pDate >= dataBR(monthStart) && pDate <= dataBR(monthEnd);
        }).reduce((sum, p) => sum + (p.valor_liquido || 0), 0) || 0;
        
        payrollEvolution.push({ month: monthName, value: monthTotal });
      }

      // Stock alerts
      const lowStockEpis = episStock?.filter(item => item.quantidade_estoque <= (item.quantidade_minima || 10)).map(item => ({
        name: `${item.tipo_epi} ${item.tamanho || ""} ${item.marca_modelo || ""}`.trim(),
        current: item.quantidade_estoque,
        minimum: item.quantidade_minima || 10,
        distributed: 0
      })) || [];

      const lowStockUniforms = uniformsStock?.filter(item => item.quantidade_estoque <= (item.quantidade_minima || 10)).map(item => ({
        name: `${item.tipo_uniforme} ${item.tamanho}`,
        current: item.quantidade_estoque,
        minimum: item.quantidade_minima || 10,
        distributed: 0
      })) || [];

      // Top distributed items
      const episDistCount = episDistribution?.reduce((acc: any, item) => {
        const key = item.estoque_epi_id;
        if (!acc[key]) acc[key] = { id: key, count: 0 };
        acc[key].count += item.quantidade;
        return acc;
      }, {});

      const uniformsDistCount = uniformsDistribution?.reduce((acc: any, item) => {
        const key = item.estoque_uniforme_id;
        if (!acc[key]) acc[key] = { id: key, count: 0 };
        acc[key].count += item.quantidade;
        return acc;
      }, {});

      const topDistributed = [
        ...Object.values(episDistCount || {}).map((item: any) => {
          const epi = episStock?.find(e => e.id === item.id);
          return { name: epi?.tipo_epi || "EPI", quantity: item.count };
        }),
        ...Object.values(uniformsDistCount || {}).map((item: any) => {
          const uniform = uniformsStock?.find(u => u.id === item.id);
          return { name: uniform?.tipo_uniforme || "Uniforme", quantity: item.count };
        })
      ].sort((a, b) => b.quantity - a.quantity).slice(0, 10);

      // Attendance metrics
      const totalAbsences = absences?.length || 0;
      const justifiedAbsences = absences?.filter(a => a.justificada).length || 0;
      const unjustifiedAbsences = totalAbsences - justifiedAbsences;

      // Calculate absenteeism rate
      const workingDays = 22; // Average working days per month
      const activeEmployees = employees?.filter(e => e.status === "ativo").length || 1;
      const absenteeismRate = (totalAbsences / (workingDays * activeEmployees)) * 100;

      // Top absent employees
      const employeeAbsences = absences?.reduce((acc: any, absence) => {
        const empId = absence.employee_id;
        if (!acc[empId]) {
          acc[empId] = {
            name: absence.employees?.nome_completo || "Desconhecido",
            total: 0,
            justified: 0,
            unjustified: 0
          };
        }
        acc[empId].total++;
        if (absence.justificada) {
          acc[empId].justified++;
        } else {
          acc[empId].unjustified++;
        }
        return acc;
      }, {});

      const topAbsentEmployees = Object.values(employeeAbsences || {})
        .sort((a: any, b: any) => b.total - a.total)
        .slice(0, 10);

      // Absence evolution (last 6 months)
      const absenceEvolution = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = monthDate.toLocaleDateString("pt-BR", { month: "short" });
        const monthStart = toISODateLocal(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
        const monthEnd = toISODateLocal(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));
        
        const monthAbsences = absences?.filter(a => a.data >= monthStart && a.data <= monthEnd) || [];
        const justified = monthAbsences.filter(a => a.justificada).length;
        const unjustified = monthAbsences.length - justified;
        
        absenceEvolution.push({
          month: monthName,
          justified,
          unjustified
        });
      }

      setMetricsData({
        statusData,
        sectorData: sectorCounts,
        evolutionData: monthsEvolution,
        financial: {
          totalPayroll: currentMonthPayroll,
          previousMonthPayroll,
          payrollBySector,
          payrollEvolution,
          averageSalary: avgSalary
        },
        stock: {
          lowStockEpis,
          lowStockUniforms,
          topDistributed
        },
        attendance: {
          totalAbsences,
          justifiedAbsences,
          unjustifiedAbsences,
          absenteeismRate,
          topAbsentEmployees,
          absenceEvolution
        }
      });
    } catch (error) {
      console.error("Error fetching advanced metrics:", error);
      toast.error("Erro ao carregar métricas avançadas");
    } finally {
      setLoadingMetrics(false);
    }
  };

  return (
    <div className="space-y-8">
        {/* Navigation Search */}
        <NavigationSearch />

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="inline-flex lg:grid w-full lg:grid-cols-6 overflow-x-auto tabs-scroll">
            <TabsTrigger value="overview" className="flex items-center gap-2 flex-shrink-0 min-w-fit">
              <LayoutDashboard className="w-4 h-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="funcionarios" className="flex items-center gap-2 flex-shrink-0 min-w-fit">
              <Users className="w-4 h-4" />
              Funcionários
            </TabsTrigger>
            <TabsTrigger value="charts" className="flex items-center gap-2 flex-shrink-0 min-w-fit">
              <BarChart3 className="w-4 h-4" />
              Gráficos
            </TabsTrigger>
            <TabsTrigger value="estrategico" className="flex items-center gap-2 flex-shrink-0 min-w-fit">
              <Activity className="w-4 h-4" />
              Estratégico
            </TabsTrigger>
            <TabsTrigger value="stock" className="flex items-center gap-2 flex-shrink-0 min-w-fit">
              <Package className="w-4 h-4" />
              Estoque
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center gap-2 flex-shrink-0 min-w-fit">
              <FileText className="w-4 h-4" />
              Frequência
            </TabsTrigger>
          </TabsList>

          {/* Filters */}
          <DashboardFilters
            period={period}
            onPeriodChange={setPeriod}
            selectedCompany={selectedEmpresa}
            onCompanyChange={setSelectedEmpresa}
            companies={empresas}
          />

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-8">
            {/* Event Notifications */}
            <EventoNotifications />

            {/* Task List */}
            <TaskList />

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Total</p>
                      <p className="text-2xl font-bold">{stats.totalEmployees}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                      <LayoutDashboard className="h-5 w-5 text-secondary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Ativos</p>
                      <p className="text-2xl font-bold text-secondary">{stats.activeEmployees}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Férias</p>
                      <p className="text-2xl font-bold text-primary">{stats.onVacation}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Afastados</p>
                      <p className="text-2xl font-bold text-destructive">{stats.onLeave}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Birthday Card */}
            <BirthdayCard 
              empresaId={selectedEmpresa !== "all" ? selectedEmpresa : undefined}
              onViewAll={() => setShowBirthdayDialog(true)}
            />

            {/* Pending Checklists Alert */}
            <PendingChecklistsAlert />

            {/* Documentos vencendo e admissões por link */}
            <DocumentosVencendoAlert />

            {/* Experience Period Alerts */}
            <ExperiencePeriodAlerts selectedEmpresa={selectedEmpresa} />

            {/* Workforce Alerts */}
            <WorkforceAlerts />

            {/* Employees on Vacation */}
            {employeesOnVacation.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Funcionários em Férias / Aguardando Confirmação de Retorno ({employeesOnVacation.length})
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {employeesOnVacation.map((employee) => {
                    const { progress, daysRemaining, totalDays, vacationDays, timeOffDays } = calculateVacationProgress(
                      employee.vacation.periodo_gozo_inicio,
                      employee.vacation.periodo_gozo_fim,
                      employee.vacation.dias_totais
                    );

                    return (
                      <Card key={employee.id} className={`${daysRemaining === 0 ? 'border-warning' : 'border-primary/50'}`}>
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-base">{employee.nome_completo}</CardTitle>
                              <p className="text-sm text-muted-foreground">{employee.cargo}</p>
                            </div>
                            {daysRemaining === 0 && (
                              <span className="text-xs bg-warning/20 text-warning-foreground px-2 py-1 rounded">
                                Aguardando retorno
                              </span>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Retorno</span>
                            <span className="font-medium">
                              {(parseDateOnly(employee.vacation.periodo_gozo_fim) ?? new Date()).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Dias restantes</span>
                              <span className="font-bold">
                                {daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'}
                              </span>
                            </div>
                            <VacationProgress 
                              totalDays={totalDays}
                              daysPassed={totalDays - daysRemaining}
                              vacationDays={vacationDays}
                              timeOffDays={timeOffDays}
                              className="h-2"
                            />
                            {timeOffDays > 0 && (
                              <div className="flex gap-2 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-full bg-secondary" />
                                  <span>{vacationDays}d</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-full bg-warning" />
                                  <span>{timeOffDays}d</span>
                                </div>
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground text-right">
                              {Math.round(progress)}% concluído
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => navigate(`/employee/${employee.id}`)}
                            >
                              Ver Detalhes
                            </Button>
                            {daysRemaining === 0 && (
                              <Button
                                variant="default"
                                size="sm"
                                className="flex-1"
                                onClick={async () => {
                                  try {
                                    const { error: feriasError } = await supabase
                                      .from("ferias")
                                      .update({ 
                                        data_retorno_confirmada: true,
                                        data_confirmacao: new Date().toISOString(),
                                        confirmado_por: user.id
                                      })
                                      .eq("id", employee.vacation.id);

                                    if (feriasError) throw feriasError;

                                    const { error: empError } = await supabase
                                      .from("employees")
                                      .update({ status: "ativo" })
                                      .eq("id", employee.id);

                                    if (empError) throw empError;

                                    toast.success("Retorno confirmado com sucesso!");
                                    fetchEmployeesOnVacation();
                                    fetchStats();
                                  } catch (error) {
                                    console.error("Error confirming return:", error);
                                    toast.error("Erro ao confirmar retorno");
                                  }
                                }}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Confirmar Retorno
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Folgas na Casa */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Folgas na Casa
              </h2>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setShowTimeOffDialog(true)}>
                  <Users className="w-4 h-4 mr-2" />
                  Controle de Folgas
                </Button>
                <Button variant="outline" onClick={() => setShowTimeOffHistoryDialog(true)}>
                  <FileText className="w-4 h-4 mr-2" />
                  Histórico de Alterações
                </Button>
              </div>
            </div>

          </TabsContent>

          <TabsContent value="funcionarios" className="space-y-6">
            <h1 className="text-2xl font-bold">Funcionários</h1>
            {/* Search and Employee List */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Buscar por nome, cargo ou setor..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button onClick={handleAddEmployee}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Funcionário
                </Button>
              </div>
            </div>

            {/* Employee List */}
            <EmployeeList searchQuery={searchQuery} onStatsUpdate={() => {
              fetchStats();
              fetchAdvancedMetrics();
            }} />
          </TabsContent>

          {/* Charts Tab */}
          <TabsContent value="charts" className="space-y-6">
            {loadingMetrics ? (
              <div className="grid gap-6 md:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-40" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-[250px] w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : metricsData ? (
              <MetricsCharts
                selectedEmpresa={selectedEmpresa}
                setSelectedEmpresa={setSelectedEmpresa}
                empresas={empresas}
                period={period}
                setPeriod={setPeriod}
              />
            ) : null}
          </TabsContent>

          {/* Estratégico Tab */}
          <TabsContent value="estrategico" className="space-y-6">
            <IndicadoresEstrategicos selectedEmpresa={selectedEmpresa} />
          </TabsContent>


          {/* Stock Tab */}
          <TabsContent value="stock" className="space-y-6">
            {loadingMetrics ? (
              <div className="space-y-6">
                <Skeleton className="h-12 w-full" />
                <div className="grid gap-6 md:grid-cols-2">
                  {[1, 2].map((i) => (
                    <Card key={i}>
                      <CardHeader>
                        <Skeleton className="h-6 w-40" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-[200px] w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : metricsData ? (
              <StockAlerts
                lowStockEpis={metricsData.stock.lowStockEpis}
                lowStockUniforms={metricsData.stock.lowStockUniforms}
                topDistributed={metricsData.stock.topDistributed}
              />
            ) : null}
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance" className="space-y-6">
            {loadingMetrics ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Card key={i}>
                      <CardHeader>
                        <Skeleton className="h-4 w-24" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-8 w-16" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  {[1, 2].map((i) => (
                    <Card key={i}>
                      <CardHeader>
                        <Skeleton className="h-6 w-40" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-[300px] w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : metricsData ? (
              <AttendanceMetrics
                totalAbsences={metricsData.attendance.totalAbsences}
                justifiedAbsences={metricsData.attendance.justifiedAbsences}
                unjustifiedAbsences={metricsData.attendance.unjustifiedAbsences}
                absenteeismRate={metricsData.attendance.absenteeismRate}
                topAbsentEmployees={metricsData.attendance.topAbsentEmployees}
                absenceEvolution={metricsData.attendance.absenceEvolution}
              />
            ) : null}
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <TimeOffListDialog 
          open={showTimeOffDialog} 
          onOpenChange={setShowTimeOffDialog} 
        />

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Adicionar Novo Funcionário</DialogTitle>
            </DialogHeader>
            <EmployeeForm
              onSaved={() => {
                setShowAddDialog(false);
                fetchStats();
                fetchAdvancedMetrics();
              }}
              onCancel={() => setShowAddDialog(false)}
            />
          </DialogContent>
        </Dialog>

        <TimeOffHistoryDialog 
          open={showTimeOffHistoryDialog} 
          onOpenChange={setShowTimeOffHistoryDialog} 
        />

        <Dialog open={showAvisoDialog} onOpenChange={setShowAvisoDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Aviso</DialogTitle>
            </DialogHeader>
            <AvisoForm />
          </DialogContent>
        </Dialog>

        <ManageAvisosDialog 
          open={showManageAvisosDialog} 
          onOpenChange={setShowManageAvisosDialog} 
        />

        <LoginHistoryDialog 
          open={showLoginHistoryDialog} 
          onOpenChange={setShowLoginHistoryDialog} 
        />

        <BirthdayListDialog
          open={showBirthdayDialog}
          onOpenChange={setShowBirthdayDialog}
          empresaId={selectedEmpresa !== "all" ? selectedEmpresa : undefined}
        />
    </div>
  );
};

export default GestorDashboard;
