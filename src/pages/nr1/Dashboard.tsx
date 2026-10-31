import { useEffect, useState } from "react";
import { todayISO, dataBR } from "@/lib/date";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/nr1/KpiCard";
import { AlertaCard } from "@/components/nr1/AlertaCard";
import { Card } from "@/components/ui/card";
import {
  Megaphone,
  Smile,
  Clock,
  TrendingUp,
  HeartPulse,
  AlertTriangle,
  BookOpenCheck,
  UserMinus,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function NR1Dashboard() {
  const [loading, setLoading] = useState(true);
  const [denunciasAbertas, setDenunciasAbertas] = useState(0);
  const [denunciasPorSetor, setDenunciasPorSetor] = useState<{ setor: string; total: number }[]>([]);
  const [climaScore, setClimaScore] = useState<number | null>(null);
  const [climaEvolucao, setClimaEvolucao] = useState<{ mes: string; nota: number }[]>([]);
  const [afastados, setAfastados] = useState(0);
  const [treinamentosVencidos, setTreinamentosVencidos] = useState(0);

  useEffect(() => {
    (async () => {
      const [denRes, climaRes, afastRes] = await Promise.all([
        (supabase.from("nr1_denuncias") as any).select("setor, status, created_at"),
        (supabase.from("nr1_clima_respostas") as any).select("respostas, created_at, setor"),
        supabase.from("afastamentos").select("id, data_fim").gte("data_fim", todayISO()),
      ]);

      const denuncias = denRes.data || [];
      setDenunciasAbertas(denuncias.filter((d: any) => d.status !== "concluida" && d.status !== "arquivada").length);
      const porSetor: Record<string, number> = {};
      denuncias.forEach((d: any) => {
        const s = d.setor || "Não informado";
        porSetor[s] = (porSetor[s] || 0) + 1;
      });
      setDenunciasPorSetor(Object.entries(porSetor).map(([setor, total]) => ({ setor, total })));

      const respostas = climaRes.data || [];
      const todasNotas: number[] = [];
      respostas.forEach((r: any) => {
        (r.respostas || []).forEach((x: any) => {
          if (typeof x.valor === "number") todasNotas.push(x.valor);
        });
      });
      setClimaScore(todasNotas.length ? +(todasNotas.reduce((a, b) => a + b, 0) / todasNotas.length).toFixed(2) : null);

      const porMes: Record<string, number[]> = {};
      respostas.forEach((r: any) => {
        const mes = dataBR(r.created_at).toISOString().slice(0, 7);
        (r.respostas || []).forEach((x: any) => {
          if (typeof x.valor === "number") (porMes[mes] = porMes[mes] || []).push(x.valor);
        });
      });
      setClimaEvolucao(
        Object.entries(porMes)
          .sort()
          .map(([mes, arr]) => ({ mes, nota: +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) }))
      );

      setAfastados(afastRes.data?.length || 0);
      setTreinamentosVencidos(0);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="container mx-auto p-0 sm:p-2 lg:p-4 space-y-6">
      <div>
        <h1 className="text-xl font-medium leading-tight flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-primary" />
          Dashboard NR-1
        </h1>
        <p className="text-muted-foreground mt-2">Indicadores executivos de saúde organizacional e compliance psicossocial</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Denúncias Abertas" value={denunciasAbertas} icon={Megaphone} variant={denunciasAbertas > 0 ? "warning" : "success"} />
        <KpiCard title="Índice de Clima" value={climaScore ?? "—"} icon={Smile} subtitle="Média (1-5)" variant={climaScore && climaScore < 3 ? "danger" : "success"} />
        <KpiCard title="Colaboradores Afastados" value={afastados} icon={UserMinus} variant={afastados > 5 ? "warning" : "default"} />
        <KpiCard title="Treinamentos Vencidos" value={treinamentosVencidos} icon={BookOpenCheck} />
      </div>

      {/* Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {denunciasAbertas >= 5 && (
          <AlertaCard nivel="alto" titulo="Alto volume de denúncias" descricao={`${denunciasAbertas} denúncias em aberto. Investigue com prioridade.`} />
        )}
        {climaScore !== null && climaScore < 3 && (
          <AlertaCard nivel="alto" titulo="Possível risco psicossocial" descricao={`Índice de clima em ${climaScore} (abaixo de 3). Considere ações imediatas.`} />
        )}
        {afastados >= 10 && (
          <AlertaCard nivel="medio" titulo="Alto índice de afastamentos" descricao={`${afastados} colaboradores afastados atualmente.`} />
        )}
        {denunciasAbertas === 0 && climaScore && climaScore >= 4 && afastados < 5 && (
          <AlertaCard nivel="info" titulo="Indicadores saudáveis" descricao="Nenhum alerta crítico no momento. Mantenha as ações preventivas." />
        )}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 shadow-elegant">
          <h3 className="font-semibold mb-4">Evolução do Clima Organizacional</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={climaEvolucao}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis domain={[0, 5]} />
              <Tooltip />
              <Line type="monotone" dataKey="nota" stroke="hsl(var(--primary))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
          {climaEvolucao.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Sem respostas de pesquisa ainda</p>
          )}
        </Card>

        <Card className="p-5 shadow-elegant">
          <h3 className="font-semibold mb-4">Denúncias por Setor</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={denunciasPorSetor}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="setor" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
          {denunciasPorSetor.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Sem denúncias registradas</p>
          )}
        </Card>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Carregando indicadores...</p>}
    </div>
  );
}
