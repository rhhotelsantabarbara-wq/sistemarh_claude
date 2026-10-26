import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/nr1/KpiCard";
import { AlertaCard } from "@/components/nr1/AlertaCard";
import {
  Activity,
  AlertTriangle,
  BookOpenCheck,
  Calendar,
  Download,
  FileBarChart,
  HeartPulse,
  ListChecks,
  Megaphone,
  Smile,
  Star,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { dataBR } from "@/lib/date";

type Periodo = "30" | "90" | "180" | "365" | "all";

const COLORS = ["hsl(var(--primary))", "#f59e0b", "#ef4444", "#10b981", "#6366f1", "#8b5cf6"];

function startDate(periodo: Periodo): string | null {
  if (periodo === "all") return null;
  const d = new Date();
  d.setDate(d.getDate() - parseInt(periodo, 10));
  return d.toISOString();
}

export default function NR1PainelGerencial() {
  const [periodo, setPeriodo] = useState<Periodo>("90");
  const [empresaId, setEmpresaId] = useState<string>("all");
  const [empresas, setEmpresas] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [denuncias, setDenuncias] = useState<any[]>([]);
  const [clima, setClima] = useState<any[]>([]);
  const [riscos, setRiscos] = useState<any[]>([]);
  const [acoes, setAcoes] = useState<any[]>([]);
  const [treinamentos, setTreinamentos] = useState<any[]>([]);
  const [conclusoes, setConclusoes] = useState<any[]>([]);
  const [liderancaResp, setLiderancaResp] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from("empresas") as any).select("id, nome").order("nome");
      setEmpresas(data || []);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const from = startDate(periodo);
      const filterDate = (q: any) => (from ? q.gte("created_at", from) : q);

      const [d, c, r, a, t, tc, lr] = await Promise.all([
        filterDate((supabase.from("nr1_denuncias") as any).select("*")),
        filterDate((supabase.from("nr1_clima_respostas") as any).select("*")),
        filterDate((supabase.from("nr1_riscos") as any).select("*")),
        filterDate((supabase.from("nr1_acoes_preventivas") as any).select("*")),
        (supabase.from("nr1_treinamentos") as any).select("*"),
        filterDate((supabase.from("nr1_treinamento_conclusoes") as any).select("*")),
        filterDate((supabase.from("nr1_lideranca_respostas") as any).select("*")),
      ]);

      setDenuncias(d.data || []);
      setClima(c.data || []);
      setRiscos(r.data || []);
      setAcoes(a.data || []);
      setTreinamentos(t.data || []);
      setConclusoes(tc.data || []);
      setLiderancaResp(lr.data || []);
      setLoading(false);
    })();
  }, [periodo]);

  // KPIs
  const denunciasAbertas = denuncias.filter((x) => x.status !== "concluida" && x.status !== "arquivada").length;
  const climaScore = useMemo(() => {
    const notas: number[] = [];
    clima.forEach((r) => (r.respostas || []).forEach((x: any) => typeof x.valor === "number" && notas.push(x.valor)));
    return notas.length ? +(notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(2) : null;
  }, [clima]);
  const riscosAltos = riscos.filter((r) => (r.probabilidade || 0) * (r.severidade || 0) >= 15).length;
  const acoesAtrasadas = acoes.filter(
    (a) => a.prazo && dataBR(a.prazo) < new Date() && a.status !== "concluida"
  ).length;
  const acoesConcluidas = acoes.filter((a) => a.status === "concluida").length;
  const taxaConclusao = acoes.length ? Math.round((acoesConcluidas / acoes.length) * 100) : 0;
  const liderancaScore = useMemo(() => {
    const notas: number[] = [];
    liderancaResp.forEach((r) => (r.respostas || []).forEach((x: any) => typeof x.valor === "number" && notas.push(x.valor)));
    return notas.length ? +(notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(2) : null;
  }, [liderancaResp]);

  // Gráficos
  const denunciasPorCategoria = useMemo(() => {
    const m: Record<string, number> = {};
    denuncias.forEach((d) => {
      const k = d.categoria || "Não informado";
      m[k] = (m[k] || 0) + 1;
    });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [denuncias]);

  const denunciasPorMes = useMemo(() => {
    const m: Record<string, number> = {};
    denuncias.forEach((d) => {
      const mes = dataBR(d.created_at).toISOString().slice(0, 7);
      m[mes] = (m[mes] || 0) + 1;
    });
    return Object.entries(m).sort().map(([mes, total]) => ({ mes, total }));
  }, [denuncias]);

  const climaEvolucao = useMemo(() => {
    const m: Record<string, number[]> = {};
    clima.forEach((r) => {
      const mes = dataBR(r.created_at).toISOString().slice(0, 7);
      (r.respostas || []).forEach((x: any) => typeof x.valor === "number" && (m[mes] = m[mes] || []).push(x.valor));
    });
    return Object.entries(m).sort().map(([mes, arr]) => ({ mes, nota: +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) }));
  }, [clima]);

  const riscosPorCategoria = useMemo(() => {
    const m: Record<string, number> = {};
    riscos.forEach((r) => {
      const k = r.categoria || "Outros";
      m[k] = (m[k] || 0) + 1;
    });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [riscos]);

  const acoesPorStatus = useMemo(() => {
    const m: Record<string, number> = {};
    acoes.forEach((a) => {
      const k = a.status || "pendente";
      m[k] = (m[k] || 0) + 1;
    });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [acoes]);

  // Alertas gerenciais
  const alertas = useMemo(() => {
    const out: { nivel: "alto" | "medio" | "info"; titulo: string; descricao: string }[] = [];
    if (denunciasAbertas >= 5)
      out.push({ nivel: "alto", titulo: "Volume crítico de denúncias", descricao: `${denunciasAbertas} denúncias em aberto no período.` });
    if (climaScore !== null && climaScore < 3)
      out.push({ nivel: "alto", titulo: "Clima organizacional crítico", descricao: `Nota média ${climaScore} (escala 1-5).` });
    if (riscosAltos > 0)
      out.push({ nivel: "alto", titulo: "Riscos psicossociais altos", descricao: `${riscosAltos} risco(s) com P×S ≥ 15.` });
    if (acoesAtrasadas > 0)
      out.push({ nivel: "medio", titulo: "Ações preventivas atrasadas", descricao: `${acoesAtrasadas} ação(ões) fora do prazo.` });
    if (liderancaScore !== null && liderancaScore < 6)
      out.push({ nivel: "medio", titulo: "Liderança com baixa avaliação", descricao: `Média geral ${liderancaScore} (escala 1-10).` });
    if (out.length === 0)
      out.push({ nivel: "info", titulo: "Indicadores saudáveis", descricao: "Nenhum alerta crítico no período selecionado." });
    return out;
  }, [denunciasAbertas, climaScore, riscosAltos, acoesAtrasadas, liderancaScore]);

  const periodoLabel: Record<Periodo, string> = {
    "30": "Últimos 30 dias",
    "90": "Últimos 90 dias",
    "180": "Últimos 180 dias",
    "365": "Último ano",
    all: "Todo o histórico",
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Painel Gerencial NR-1", 14, 15);
    doc.setFontSize(10);
    doc.text(`Período: ${periodoLabel[periodo]}`, 14, 22);
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 27);

    autoTable(doc, {
      startY: 33,
      head: [["Indicador", "Valor"]],
      body: [
        ["Denúncias em aberto", String(denunciasAbertas)],
        ["Total de denúncias no período", String(denuncias.length)],
        ["Índice de Clima (1-5)", climaScore ?? "—"],
        ["Riscos altos (P×S ≥ 15)", String(riscosAltos)],
        ["Total de riscos mapeados", String(riscos.length)],
        ["Ações preventivas atrasadas", String(acoesAtrasadas)],
        ["Taxa de conclusão de ações", `${taxaConclusao}%`],
        ["Avaliação média de liderança (1-10)", liderancaScore ?? "—"],
        ["Conclusões de treinamentos", String(conclusoes.length)],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229] },
    });

    let y = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(12);
    doc.text("Alertas Gerenciais", 14, y);
    y += 2;
    autoTable(doc, {
      startY: y + 2,
      head: [["Nível", "Título", "Descrição"]],
      body: alertas.map((a) => [a.nivel.toUpperCase(), a.titulo, a.descricao]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229] },
    });

    doc.save(`painel-gerencial-nr1-${Date.now()}.pdf`);
    toast.success("PDF gerado!");
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const resumo = [
      ["Indicador", "Valor"],
      ["Período", periodoLabel[periodo]],
      ["Denúncias em aberto", denunciasAbertas],
      ["Total de denúncias", denuncias.length],
      ["Índice de Clima (1-5)", climaScore ?? ""],
      ["Riscos altos (P×S ≥ 15)", riscosAltos],
      ["Total de riscos", riscos.length],
      ["Ações atrasadas", acoesAtrasadas],
      ["Taxa de conclusão (%)", taxaConclusao],
      ["Avaliação liderança (1-10)", liderancaScore ?? ""],
      ["Conclusões treinamentos", conclusoes.length],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), "Resumo");
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([["Categoria", "Total"], ...denunciasPorCategoria.map((x) => [x.name, x.value])]),
      "Denúncias por Categoria"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([["Mês", "Nota"], ...climaEvolucao.map((x) => [x.mes, x.nota])]),
      "Evolução Clima"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([["Categoria", "Total"], ...riscosPorCategoria.map((x) => [x.name, x.value])]),
      "Riscos"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([["Status", "Total"], ...acoesPorStatus.map((x) => [x.name, x.value])]),
      "Ações"
    );
    XLSX.writeFile(wb, `painel-gerencial-nr1-${Date.now()}.xlsx`);
    toast.success("Excel gerado!");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header + filtros */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <HeartPulse className="w-7 h-7 text-primary" />
            Painel Gerencial NR-1
          </h1>
          <p className="text-muted-foreground mt-1">
            Métricas executivas e relatórios gerenciais de compliance psicossocial
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="180">Últimos 180 dias</SelectItem>
                <SelectItem value="365">Último ano</SelectItem>
                <SelectItem value="all">Todo o histórico</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {empresas.length > 0 && (
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={exportPDF} size="sm">
            <Download className="w-4 h-4 mr-2" /> PDF
          </Button>
          <Button onClick={exportExcel} size="sm" variant="outline">
            <Download className="w-4 h-4 mr-2" /> Excel
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard title="Denúncias abertas" value={denunciasAbertas} icon={Megaphone} variant={denunciasAbertas >= 5 ? "danger" : denunciasAbertas > 0 ? "warning" : "success"} />
        <KpiCard title="Clima (1-5)" value={climaScore ?? "—"} icon={Smile} variant={climaScore !== null && climaScore < 3 ? "danger" : "success"} />
        <KpiCard title="Riscos altos" value={riscosAltos} icon={AlertTriangle} subtitle={`${riscos.length} mapeados`} variant={riscosAltos > 0 ? "danger" : "success"} />
        <KpiCard title="Ações atrasadas" value={acoesAtrasadas} icon={ListChecks} subtitle={`${taxaConclusao}% concluídas`} variant={acoesAtrasadas > 0 ? "warning" : "success"} />
        <KpiCard title="Liderança (1-10)" value={liderancaScore ?? "—"} icon={Star} variant={liderancaScore !== null && liderancaScore < 6 ? "warning" : "success"} />
        <KpiCard title="Treinamentos" value={conclusoes.length} icon={BookOpenCheck} subtitle="conclusões" />
      </div>

      {/* Alertas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {alertas.map((a, i) => (
          <AlertaCard key={i} nivel={a.nivel} titulo={a.titulo} descricao={a.descricao} />
        ))}
      </div>

      {/* Tabs de relatórios */}
      <Tabs defaultValue="visao">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="visao"><TrendingUp className="w-4 h-4 mr-2" />Visão Geral</TabsTrigger>
          <TabsTrigger value="denuncias"><Megaphone className="w-4 h-4 mr-2" />Denúncias</TabsTrigger>
          <TabsTrigger value="clima"><Smile className="w-4 h-4 mr-2" />Clima</TabsTrigger>
          <TabsTrigger value="riscos"><AlertTriangle className="w-4 h-4 mr-2" />Riscos</TabsTrigger>
          <TabsTrigger value="acoes"><ListChecks className="w-4 h-4 mr-2" />Ações</TabsTrigger>
        </TabsList>

        <TabsContent value="visao" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5 shadow-elegant">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Activity className="w-4 h-4" /> Evolução do Clima</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={climaEvolucao}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis domain={[0, 5]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="nota" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
              {!climaEvolucao.length && <p className="text-sm text-muted-foreground text-center py-4">Sem dados no período</p>}
            </Card>
            <Card className="p-5 shadow-elegant">
              <h3 className="font-semibold mb-4">Denúncias por Mês</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={denunciasPorMes}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
              {!denunciasPorMes.length && <p className="text-sm text-muted-foreground text-center py-4">Sem dados no período</p>}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="denuncias" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5 shadow-elegant">
              <h3 className="font-semibold mb-4">Por Categoria</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={denunciasPorCategoria} dataKey="value" nameKey="name" outerRadius={90} label>
                    {denunciasPorCategoria.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-5 shadow-elegant">
              <h3 className="font-semibold mb-4">Últimas denúncias</h3>
              <Table>
                <TableHeader><TableRow><TableHead>Protocolo</TableHead><TableHead>Categoria</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {denuncias.slice(0, 8).map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs">{d.protocolo}</TableCell>
                      <TableCell>{d.categoria}</TableCell>
                      <TableCell><Badge variant="outline">{d.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {!denuncias.length && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Sem registros</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="clima" className="mt-4">
          <Card className="p-5 shadow-elegant">
            <h3 className="font-semibold mb-4">Evolução detalhada do clima</h3>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={climaEvolucao}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis domain={[0, 5]} />
                <Tooltip />
                <Line type="monotone" dataKey="nota" stroke="hsl(var(--primary))" strokeWidth={3} dot />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-sm text-muted-foreground mt-3">
              {clima.length} resposta(s) coletada(s) no período. Nota média geral: <strong>{climaScore ?? "—"}</strong>
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="riscos" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5 shadow-elegant">
              <h3 className="font-semibold mb-4">Riscos por Categoria</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={riscosPorCategoria}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-5 shadow-elegant">
              <h3 className="font-semibold mb-4">Top riscos (P×S)</h3>
              <Table>
                <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>P</TableHead><TableHead>S</TableHead><TableHead>Score</TableHead></TableRow></TableHeader>
                <TableBody>
                  {[...riscos]
                    .sort((a, b) => (b.probabilidade * b.severidade) - (a.probabilidade * a.severidade))
                    .slice(0, 8)
                    .map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.categoria}</TableCell>
                        <TableCell>{r.probabilidade}</TableCell>
                        <TableCell>{r.severidade}</TableCell>
                        <TableCell><Badge variant={r.probabilidade * r.severidade >= 15 ? "destructive" : "outline"}>{r.probabilidade * r.severidade}</Badge></TableCell>
                      </TableRow>
                    ))}
                  {!riscos.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem registros</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="acoes" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5 shadow-elegant">
              <h3 className="font-semibold mb-4">Status das Ações</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={acoesPorStatus} dataKey="value" nameKey="name" outerRadius={90} label>
                    {acoesPorStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-5 shadow-elegant">
              <h3 className="font-semibold mb-4">Ações em atraso</h3>
              <Table>
                <TableHeader><TableRow><TableHead>Título</TableHead><TableHead>Prioridade</TableHead><TableHead>Prazo</TableHead></TableRow></TableHeader>
                <TableBody>
                  {acoes
                    .filter((a) => a.prazo && dataBR(a.prazo) < new Date() && a.status !== "concluida")
                    .slice(0, 8)
                    .map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.titulo}</TableCell>
                        <TableCell><Badge variant="outline">{a.prioridade}</Badge></TableCell>
                        <TableCell className="text-destructive">{a.prazo}</TableCell>
                      </TableRow>
                    ))}
                  {!acoesAtrasadas && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Nenhuma ação em atraso 🎉</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {loading && <p className="text-sm text-muted-foreground">Carregando dados do período...</p>}
    </div>
  );
}
