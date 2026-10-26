import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, AreaChart, Area, Cell } from "recharts";
import ChartCard from "./ChartCard";
import { AlertTriangle, TrendingDown, Building2, Calendar, Users } from "lucide-react";
import { dataBR } from "@/lib/date";

interface AttendanceChartsProps {
  absenteeismBySector: Array<{ name: string; taxa: number }>;
  topAbsentEmployees: Array<{ name: string; total: number; justified: number; unjustified: number }>;
  absenceEvolution: Array<{ month: string; justified: number; unjustified: number }>;
  vacationCalendar: Array<{ name: string; inicio: string; fim: string; dias: number }>;
}

const AttendanceCharts = ({ absenteeismBySector, topAbsentEmployees, absenceEvolution, vacationCalendar }: AttendanceChartsProps) => {
  const getAbsenteeismColor = (taxa: number) => {
    if (taxa < 3) return "hsl(var(--secondary))";
    if (taxa < 6) return "hsl(var(--warning))";
    return "hsl(var(--destructive))";
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Absenteeism by Sector */}
      <ChartCard title="Taxa de Absenteísmo por Setor" icon={<Building2 className="w-4 h-4" />}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={absenteeismBySector} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
            <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))", 
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)"
              }}
              formatter={(value: any) => `${value.toFixed(1)}%`}
            />
            <Bar dataKey="taxa" radius={[0, 8, 8, 0]} name="Taxa %">
              {absenteeismBySector.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getAbsenteeismColor(entry.taxa)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Top Absent Employees */}
      <ChartCard title="Top 10 Funcionários com Mais Faltas" icon={<Users className="w-4 h-4" />}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={topAbsentEmployees.slice(0, 10)} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
            <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))", 
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)"
              }}
            />
            <Legend />
            <Bar dataKey="justified" fill="hsl(var(--secondary))" name="Justificadas" stackId="a" />
            <Bar dataKey="unjustified" fill="hsl(var(--destructive))" name="Injustificadas" stackId="a" radius={[0, 8, 8, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Absence Evolution */}
      <ChartCard title="Evolução de Faltas Mensal" icon={<TrendingDown className="w-4 h-4" />}>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={absenceEvolution}>
            <defs>
              <linearGradient id="colorJustified" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorUnjustified" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
            <YAxis stroke="hsl(var(--muted-foreground))" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))", 
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)"
              }}
            />
            <Legend />
            <Area type="monotone" dataKey="justified" stroke="hsl(var(--secondary))" fillOpacity={1} fill="url(#colorJustified)" name="Justificadas" />
            <Area type="monotone" dataKey="unjustified" stroke="hsl(var(--destructive))" fillOpacity={1} fill="url(#colorUnjustified)" name="Injustificadas" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Vacation Calendar */}
      <ChartCard title="Calendário de Férias (Próximos 30 dias)" icon={<Calendar className="w-4 h-4" />}>
        <div className="h-[300px] overflow-y-auto">
          {vacationCalendar.length > 0 ? (
            <div className="space-y-2">
              {vacationCalendar.map((vacation, index) => (
                <div key={index} className="p-3 bg-muted/30 rounded-lg border flex justify-between items-center">
                  <div>
                    <p className="font-medium text-sm">{vacation.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {dataBR(vacation.inicio).toLocaleDateString("pt-BR")} - {dataBR(vacation.fim).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-primary">{vacation.dias} dias</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Nenhuma férias programada
            </div>
          )}
        </div>
      </ChartCard>
    </div>
  );
};

export default AttendanceCharts;
