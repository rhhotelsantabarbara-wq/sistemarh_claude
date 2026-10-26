import { useState, useEffect, useMemo } from "react";
import { parseDateOnly, dataBR } from "@/lib/date";
import { supabase } from "@/integrations/supabase/client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, AlertTriangle, Package } from "lucide-react";
import ChartFilters from "./charts/ChartFilters";
import HRKPIs from "./kpis/HRKPIs";
import AttendanceKPIs from "./kpis/AttendanceKPIs";
import StockKPIs from "./kpis/StockKPIs";
import HRCharts from "./charts/HRCharts";
import AttendanceCharts from "./charts/AttendanceCharts";
import StockCharts from "./charts/StockCharts";

interface MetricsChartsProps {
  selectedEmpresa: string;
  setSelectedEmpresa: (value: string) => void;
  empresas: Array<{ id: string; nome: string }>;
  period: string;
  setPeriod: (value: string) => void;
}

const MetricsCharts = ({ selectedEmpresa, setSelectedEmpresa, empresas, period, setPeriod }: MetricsChartsProps) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchAllData();
  }, [selectedEmpresa, period]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate: Date;
      
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
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      // Fetch all necessary data
      let employeeQuery = supabase.from("employees").select("*");
      if (selectedEmpresa !== "all") employeeQuery = employeeQuery.eq("empresa_id", selectedEmpresa);
      const { data: employees } = await employeeQuery;

      const { data: sectors } = await supabase.from("setores").select("*");
      const { data: companies } = await supabase.from("empresas").select("*");
      
      let payrollQuery = supabase.from("folha_pagamento").select("*").gte("created_at", startDate.toISOString());
      if (selectedEmpresa !== "all") payrollQuery = payrollQuery.eq("empresa_id", selectedEmpresa);
      const { data: payroll } = await payrollQuery;

      const { data: episStock } = await supabase.from("estoque_epis").select("*");
      const { data: uniformsStock } = await supabase.from("estoque_uniformes").select("*");
      
      const { data: episHistory } = await supabase.from("historico_estoque_epis").select("*").gte("created_at", startDate.toISOString());
      const { data: uniformsHistory } = await supabase.from("historico_estoque_uniformes").select("*").gte("created_at", startDate.toISOString());

      let absencesQuery = supabase.from("faltas").select("*, employees(nome_completo, setor)").gte("data", startDate.toISOString().split("T")[0]);
      const { data: absences } = await absencesQuery;

      const todayStr = now.toISOString().split("T")[0];
      const { data: vacations } = await supabase.from("ferias").select("*, employees(nome_completo)")
        .gte("periodo_gozo_inicio", todayStr)
        .lte("periodo_gozo_inicio", dataBR(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);

      // Contar férias ativas HOJE
      const employeeIds = employees?.map((e: any) => e.id) || [];
      let currentVacationCount = 0;
      if (employeeIds.length > 0) {
        const { count } = await supabase
          .from("ferias")
          .select("*", { count: "exact", head: true })
          .in("employee_id", employeeIds)
          .lte("periodo_gozo_inicio", todayStr)
          .gte("periodo_gozo_fim", todayStr);
        currentVacationCount = count || 0;
      }

      // Process all data
      const processedData = processData(employees, sectors, companies, payroll, episStock, uniformsStock, episHistory, uniformsHistory, absences, vacations, now, startDate, currentVacationCount);
      setData(processedData);
    } catch (error) {
      console.error("Error fetching metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  const processData = (employees: any[], sectors: any[], companies: any[], payroll: any[], episStock: any[], uniformsStock: any[], episHistory: any[], uniformsHistory: any[], absences: any[], vacations: any[], now: Date, startDate: Date, currentVacationCount: number) => {
    // HR Metrics
    const activeEmployees = employees?.filter(e => e.status === "ativo").length || 0;
    const totalEmployees = employees?.length || 0;
    const onVacation = currentVacationCount;
    const onLeave = employees?.filter(e => e.status === "afastado").length || 0;
    
    const previousMonthEmployees = employees?.filter(e => {
      const admDate = e.data_admissao ? (parseDateOnly(e.data_admissao) ?? new Date()) : null;
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return admDate && admDate < prevMonth;
    }).length || 1;
    const growthRate = ((totalEmployees - previousMonthEmployees) / previousMonthEmployees) * 100;

    const statusData = [
      { name: "Ativos", value: activeEmployees, color: "hsl(var(--secondary))" },
      { name: "Férias", value: onVacation, color: "hsl(var(--primary))" },
      { name: "Afastados", value: onLeave, color: "hsl(var(--warning))" },
      { name: "Demitidos", value: employees?.filter(e => e.status === "demitido").length || 0, color: "hsl(var(--destructive))" }
    ];

    const sectorData = sectors?.map(sector => ({
      name: sector.nome,
      total: employees?.filter(e => e.setor === sector.nome).length || 0
    })) || [];

    const contractData = [
      { name: "Fixo", value: employees?.filter(e => e.tipo_contrato === "fixo").length || 0 },
      { name: "Intermitente", value: employees?.filter(e => e.tipo_contrato === "intermitente").length || 0 },
      { name: "Prestador", value: employees?.filter(e => e.tipo_contrato === "prestador_servico").length || 0 }
    ];

    // Age distribution
    const ageDistribution = [
      { faixa: "18-25", masculino: 0, feminino: 0 },
      { faixa: "26-35", masculino: 0, feminino: 0 },
      { faixa: "36-45", masculino: 0, feminino: 0 },
      { faixa: "46-55", masculino: 0, feminino: 0 },
      { faixa: "56+", masculino: 0, feminino: 0 }
    ];

    employees?.forEach(emp => {
      if (!emp.data_nascimento) return;
      const age = Math.floor((now.getTime() - (parseDateOnly(emp.data_nascimento) ?? new Date()).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      let faixaIndex = 4;
      if (age < 26) faixaIndex = 0;
      else if (age < 36) faixaIndex = 1;
      else if (age < 46) faixaIndex = 2;
      else if (age < 56) faixaIndex = 3;
      
      if (emp.sexo === "Masculino") ageDistribution[faixaIndex].masculino++;
      else if (emp.sexo === "Feminino") ageDistribution[faixaIndex].feminino++;
    });

    const companyDistribution = companies?.map(company => ({
      name: company.nome,
      total: employees?.filter(e => e.empresa_id === company.id).length || 0
    })) || [];

    // Evolution data
    const evolutionData = [];
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
      
      evolutionData.push({ month: monthName, total, admissions: admitted, dismissals: dismissed });
    }

    // Financial Metrics
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

    const monthlyChange = previousMonthPayroll > 0 ? ((currentMonthPayroll - previousMonthPayroll) / previousMonthPayroll) * 100 : 0;

    const payrollBySector = sectors?.map(sector => {
      const sectorEmployees = employees?.filter(e => e.setor === sector.nome && e.status === "ativo") || [];
      const total = sectorEmployees.reduce((sum, e) => sum + (e.salario || 0), 0);
      return { name: sector.nome, value: total };
    }).filter(s => s.value > 0) || [];

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

    // Salary distribution by contract type
    const salaryRanges = ["R$ 0-2k", "R$ 2-4k", "R$ 4-6k", "R$ 6-10k", "R$ 10k+"];
    const salaryDistribution = salaryRanges.map(faixa => {
      const [min, max] = faixa.includes("+") ? [10000, Infinity] : faixa.replace("R$ ", "").split("-").map(v => parseFloat(v.replace("k", "")) * 1000);
      return {
        faixa,
        fixo: employees?.filter(e => e.tipo_contrato === "fixo" && e.salario >= min && e.salario < max).length || 0,
        intermitente: employees?.filter(e => e.tipo_contrato === "intermitente" && e.salario >= min && e.salario < max).length || 0,
        prestador: employees?.filter(e => e.tipo_contrato === "prestador_servico" && e.salario >= min && e.salario < max).length || 0
      };
    });

    // Payroll by contract type over time
    const payrollByContractType = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = monthDate.toLocaleDateString("pt-BR", { month: "short" });
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).toISOString();
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).toISOString();
      
      const monthPayroll = payroll?.filter(p => {
        const pDate = dataBR(p.created_at || "");
        return pDate >= dataBR(monthStart) && pDate <= dataBR(monthEnd);
      }) || [];

      const fixo = monthPayroll.filter(p => {
        const emp = employees?.find(e => e.id === p.employee_id);
        return emp?.tipo_contrato === "fixo";
      }).reduce((sum, p) => sum + (p.valor_liquido || 0), 0);

      const intermitente = monthPayroll.filter(p => {
        const emp = employees?.find(e => e.id === p.employee_id);
        return emp?.tipo_contrato === "intermitente";
      }).reduce((sum, p) => sum + (p.valor_liquido || 0), 0);

      const prestador = monthPayroll.filter(p => {
        const emp = employees?.find(e => e.id === p.employee_id);
        return emp?.tipo_contrato === "prestador_servico";
      }).reduce((sum, p) => sum + (p.valor_liquido || 0), 0);
      
      payrollByContractType.push({ month: monthName, fixo, intermitente, prestador });
    }

    // Attendance Metrics
    const totalAbsences = absences?.length || 0;
    const justifiedAbsences = absences?.filter(a => a.justificada).length || 0;
    const unjustifiedAbsences = totalAbsences - justifiedAbsences;
    
    const workingDays = 22;
    const absenteeismRate = activeEmployees > 0 ? (totalAbsences / (workingDays * activeEmployees)) * 100 : 0;

    const absenteeismBySector = sectors?.map(sector => {
      const sectorAbsences = absences?.filter(a => a.employees?.setor === sector.nome).length || 0;
      const sectorEmployees = employees?.filter(e => e.setor === sector.nome && e.status === "ativo").length || 1;
      const taxa = (sectorAbsences / (workingDays * sectorEmployees)) * 100;
      return { name: sector.nome, taxa };
    }) || [];

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
      if (absence.justificada) acc[empId].justified++;
      else acc[empId].unjustified++;
      return acc;
    }, {});

    const topAbsentEmployees = Object.values(employeeAbsences || {}).sort((a: any, b: any) => b.total - a.total);

    const absenceEvolution = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = monthDate.toLocaleDateString("pt-BR", { month: "short" });
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).toISOString().split("T")[0];
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).toISOString().split("T")[0];
      
      const monthAbsences = absences?.filter(a => a.data >= monthStart && a.data <= monthEnd) || [];
      const justified = monthAbsences.filter(a => a.justificada).length;
      const unjustified = monthAbsences.length - justified;
      
      absenceEvolution.push({ month: monthName, justified, unjustified });
    }

    const vacationCalendar = vacations?.map(v => ({
      name: v.employees?.nome_completo || "Desconhecido",
      inicio: v.periodo_gozo_inicio,
      fim: v.periodo_gozo_fim,
      dias: v.dias_totais
    })) || [];

    // Stock Metrics
    const totalItems = (episStock?.length || 0) + (uniformsStock?.length || 0);
    const lowStockEpis = episStock?.filter(item => item.quantidade_estoque <= (item.quantidade_minima || 10)).map(item => ({
      name: `${item.tipo_epi} ${item.tamanho || ""} ${item.marca_modelo || ""}`.trim(),
      current: item.quantidade_estoque,
      minimum: item.quantidade_minima || 10
    })) || [];

    const lowStockUniforms = uniformsStock?.filter(item => item.quantidade_estoque <= (item.quantidade_minima || 10)).map(item => ({
      name: `${item.tipo_uniforme} ${item.tamanho}`,
      current: item.quantidade_estoque,
      minimum: item.quantidade_minima || 10
    })) || [];

    const lowStockItems = [...lowStockEpis, ...lowStockUniforms];

    const episDistCount = episHistory?.filter(h => h.tipo_movimentacao === "saida").reduce((acc: any, item) => {
      const key = item.estoque_epi_id;
      if (!acc[key]) acc[key] = { id: key, count: 0 };
      acc[key].count += item.quantidade;
      return acc;
    }, {});

    const uniformsDistCount = uniformsHistory?.filter(h => h.tipo_movimentacao === "saida").reduce((acc: any, item) => {
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

    const totalDistributed = topDistributed.reduce((sum, item) => sum + item.quantity, 0);

    // Stock evolution
    const stockEvolution = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = monthDate.toLocaleDateString("pt-BR", { month: "short" });
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).toISOString();
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).toISOString();
      
      const monthEpisHistory = episHistory?.filter(h => {
        const hDate = dataBR(h.created_at);
        return hDate >= dataBR(monthStart) && hDate <= dataBR(monthEnd);
      }) || [];

      const monthUniformsHistory = uniformsHistory?.filter(h => {
        const hDate = dataBR(h.created_at);
        return hDate >= dataBR(monthStart) && hDate <= dataBR(monthEnd);
      }) || [];

      const entradas = [...monthEpisHistory, ...monthUniformsHistory].filter(h => h.tipo_movimentacao === "entrada").reduce((sum, h) => sum + h.quantidade, 0);
      const saidas = [...monthEpisHistory, ...monthUniformsHistory].filter(h => h.tipo_movimentacao === "saida").reduce((sum, h) => sum + h.quantidade, 0);
      
      stockEvolution.push({ month: monthName, entradas, saidas, saldo: entradas - saidas });
    }

    return {
      hr: {
        kpis: { totalEmployees, activeEmployees, onVacation, onLeave, growthRate },
        charts: { statusData, sectorData, contractData, evolutionData, ageDistribution, companyDistribution }
      },
      financial: {
        kpis: { totalPayroll: currentMonthPayroll, averageSalary: avgSalary, monthlyChange, previousPayroll: previousMonthPayroll },
        charts: { payrollBySector, payrollEvolution, salaryDistribution, payrollByContractType }
      },
      attendance: {
        kpis: { totalAbsences, justifiedAbsences, unjustifiedAbsences, absenteeismRate },
        charts: { absenteeismBySector, topAbsentEmployees, absenceEvolution, vacationCalendar }
      },
      stock: {
        kpis: { totalItems, lowStockItems: lowStockItems.length, totalDistributed, stockValue: 0 },
        charts: { lowStockItems, topDistributed, stockEvolution }
      }
    };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <ChartFilters
        selectedEmpresa={selectedEmpresa}
        setSelectedEmpresa={setSelectedEmpresa}
        empresas={empresas}
        period={period}
        setPeriod={setPeriod}
        showExport={true}
      />

      <Accordion type="multiple" defaultValue={["hr", "financial", "attendance", "stock"]} className="space-y-4">
        {/* HR Section */}
        <AccordionItem value="hr" className="border rounded-lg px-6">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <Users className="w-5 h-5 text-primary" />
              Recursos Humanos
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-6">
            <HRKPIs {...data.hr.kpis} />
            <HRCharts {...data.hr.charts} />
          </AccordionContent>
        </AccordionItem>


        {/* Attendance Section */}
        <AccordionItem value="attendance" className="border rounded-lg px-6">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <AlertTriangle className="w-5 h-5 text-primary" />
              Frequência e Faltas
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-6">
            <AttendanceKPIs {...data.attendance.kpis} />
            <AttendanceCharts {...data.attendance.charts} />
          </AccordionContent>
        </AccordionItem>

        {/* Stock Section */}
        <AccordionItem value="stock" className="border rounded-lg px-6">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <Package className="w-5 h-5 text-primary" />
              Estoque
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-6">
            <StockKPIs {...data.stock.kpis} />
            <StockCharts {...data.stock.charts} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default MetricsCharts;
