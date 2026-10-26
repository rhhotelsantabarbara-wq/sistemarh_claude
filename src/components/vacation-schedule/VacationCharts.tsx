import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import type { VacationFiltersType } from "@/components/vacation-schedule/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { dataBR } from "@/lib/date";

interface VacationChartsProps {
  filters: VacationFiltersType;
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

export function VacationCharts({ filters }: VacationChartsProps) {
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<{ name: string; total: number }[]>([]);
  const [sectorData, setSectorData] = useState<{ name: string; value: number }[]>([]);
  const [statusData, setStatusData] = useState<{ name: string; value: number }[]>([]);
  const [trendData, setTrendData] = useState<{ name: string; planejado: number; confirmado: number }[]>([]);

  useEffect(() => {
    fetchChartData();
  }, [filters]);

  const fetchChartData = async () => {
    setLoading(true);
    const currentYear = filters.ano || new Date().getFullYear();

    // Buscar funcionários conforme filtros
    let employeesQuery = supabase
      .from("employees")
      .select("id, setor, empresa_id");

    if (filters.empresa && filters.empresa !== "all") {
      employeesQuery = employeesQuery.eq("empresa_id", filters.empresa);
    }

    if (filters.setor && filters.setor !== "all") {
      employeesQuery = employeesQuery.eq("setor", filters.setor);
    }

    const { data: employees } = await employeesQuery;

    if (!employees || employees.length === 0) {
      setLoading(false);
      return;
    }

    const employeeIds = employees.map((e) => e.id);

    // Buscar férias planejadas
    const { data: plannedData } = await supabase
      .from("ferias_planejadas")
      .select("*")
      .in("employee_id", employeeIds)
      .gte("periodo_inicio", `${currentYear}-01-01`)
      .lte("periodo_inicio", `${currentYear}-12-31`);

    // Buscar férias confirmadas
    const { data: confirmedData } = await supabase
      .from("ferias")
      .select("*")
      .in("employee_id", employeeIds)
      .gte("periodo_gozo_inicio", `${currentYear}-01-01`)
      .lte("periodo_gozo_inicio", `${currentYear}-12-31`);

    // Processar dados por mês
    const monthCounts: Record<number, number> = {};
    const monthPlanned: Record<number, number> = {};
    const monthConfirmed: Record<number, number> = {};

    for (let i = 0; i < 12; i++) {
      monthCounts[i] = 0;
      monthPlanned[i] = 0;
      monthConfirmed[i] = 0;
    }

    (plannedData || []).forEach((item) => {
      const month = dataBR(item.periodo_inicio).getMonth();
      monthCounts[month]++;
      monthPlanned[month]++;
    });

    (confirmedData || []).forEach((item) => {
      const month = dataBR(item.periodo_gozo_inicio).getMonth();
      monthCounts[month]++;
      monthConfirmed[month]++;
    });

    setMonthlyData(
      MONTHS.map((name, i) => ({ name, total: monthCounts[i] }))
    );

    setTrendData(
      MONTHS.map((name, i) => ({ 
        name, 
        planejado: monthPlanned[i], 
        confirmado: monthConfirmed[i] 
      }))
    );

    // Processar dados por setor
    const sectorCounts: Record<string, number> = {};
    const employeeSectors: Record<string, string> = {};

    employees.forEach((emp) => {
      employeeSectors[emp.id] = emp.setor || "Sem setor";
    });

    [...(plannedData || []), ...(confirmedData || [])].forEach((item) => {
      const sector = employeeSectors[item.employee_id] || "Sem setor";
      sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
    });

    setSectorData(
      Object.entries(sectorCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6)
    );

    // Processar dados por status
    const statusCounts: Record<string, number> = {
      "Planejado": 0,
      "Aprovado": 0,
      "Em Andamento": 0,
      "Concluído": 0,
    };

    const now = new Date();

    (plannedData || []).forEach((item) => {
      if (item.status === "planejado") statusCounts["Planejado"]++;
      else if (item.status === "aprovado") statusCounts["Aprovado"]++;
    });

    (confirmedData || []).forEach((item) => {
      const start = dataBR(item.periodo_gozo_inicio);
      const end = dataBR(item.periodo_gozo_fim);
      if (now < start) statusCounts["Aprovado"]++;
      else if (now > end) statusCounts["Concluído"]++;
      else statusCounts["Em Andamento"]++;
    });

    setStatusData(
      Object.entries(statusCounts)
        .map(([name, value]) => ({ name, value }))
        .filter((item) => item.value > 0)
    );

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
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
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Gráfico de Barras - Férias por Mês */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Férias por Mês</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "hsl(var(--popover-foreground))" }}
              />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico de Pizza - Férias por Setor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Férias por Setor</CardTitle>
        </CardHeader>
        <CardContent>
          {sectorData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={sectorData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {sectorData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Nenhum dado disponível
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráfico de Linha - Tendência Mensal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tendência de Férias</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="planejado" 
                stroke="hsl(var(--chart-1))" 
                strokeWidth={2}
                name="Planejadas"
              />
              <Line 
                type="monotone" 
                dataKey="confirmado" 
                stroke="hsl(var(--chart-2))" 
                strokeWidth={2}
                name="Confirmadas"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico de Pizza - Férias por Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Distribuição por Status</CardTitle>
        </CardHeader>
        <CardContent>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {statusData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Nenhum dado disponível
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
