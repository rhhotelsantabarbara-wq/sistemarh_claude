import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, TrendingUp, TrendingDown, Download, BarChart3 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from "recharts";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { dataBR, todayISO } from "@/lib/date";

interface HistoricoAvaliacoesProps {
  employeeId: string;
}

export default function HistoricoAvaliacoes({ employeeId }: HistoricoAvaliacoesProps) {
  const { data: avaliacoes } = useQuery({
    queryKey: ["historico-avaliacoes", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avaliacoes_desempenho")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("status", "concluida")
        .order("periodo_fim", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const { data: notas } = useQuery({
    queryKey: ["notas-historico", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas_avaliacao")
        .select(`
          *,
          avaliacao:avaliacoes_desempenho!inner(employee_id, periodo_fim, status),
          criterio:criterios_avaliacao(nome)
        `)
        .eq("avaliacao.employee_id", employeeId)
        .eq("avaliacao.status", "concluida");

      if (error) throw error;
      return data;
    },
  });

  const { data: employee } = useQuery({
    queryKey: ["employee-avaliacao", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("id", employeeId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const chartData = avaliacoes?.map((av) => ({
    periodo: dataBR(av.periodo_fim).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }),
    nota: Number(av.nota_final || 0),
  })) || [];

  const mediaGeral = avaliacoes?.length
    ? (avaliacoes.reduce((sum, av) => sum + Number(av.nota_final || 0), 0) / avaliacoes.length).toFixed(2)
    : "0";

  const ultimaNota = Number(avaliacoes?.[avaliacoes.length - 1]?.nota_final || 0);
  const penultimaNota = Number(avaliacoes?.[avaliacoes.length - 2]?.nota_final || ultimaNota);
  const tendencia = ultimaNota - penultimaNota;

  // Agrupar notas por critério para análise
  const criteriosData = notas?.reduce((acc: any[], nota: any) => {
    const criterioNome = nota.criterio?.nome || "Sem critério";
    const existing = acc.find(item => item.criterio === criterioNome);
    
    const notaFinal = (Number(nota.nota_gestor || 0) + Number(nota.nota_funcionario || 0)) / 2;
    
    if (existing) {
      existing.notas.push(notaFinal);
      existing.media = existing.notas.reduce((sum: number, n: number) => sum + n, 0) / existing.notas.length;
    } else {
      acc.push({
        criterio: criterioNome,
        notas: [notaFinal],
        media: notaFinal,
      });
    }
    return acc;
  }, []) || [];

  const tipoLabels = {
    mensal: "Mensal",
    trimestral: "Trimestral",
    semestral: "Semestral",
    anual: "Anual",
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      
      doc.setFontSize(18);
      doc.text("Histórico de Avaliações de Desempenho", 20, 20);
      
      doc.setFontSize(12);
      doc.text(`Funcionário: ${employee?.nome_completo || ""}`, 20, 35);
      doc.text(`Cargo: ${employee?.cargo || ""}`, 20, 42);
      doc.text(`Setor: ${employee?.setor || ""}`, 20, 49);
      
      doc.setFontSize(14);
      doc.text("Resumo Geral", 20, 65);
      
      doc.setFontSize(11);
      doc.text(`Total de Avaliações: ${avaliacoes?.length || 0}`, 25, 75);
      doc.text(`Média Geral: ${mediaGeral}`, 25, 82);
      doc.text(`Tendência: ${tendencia > 0 ? "+" : ""}${tendencia.toFixed(2)}`, 25, 89);
      
      let yPos = 105;
      doc.setFontSize(14);
      doc.text("Histórico de Avaliações", 20, yPos);
      yPos += 10;
      
      doc.setFontSize(10);
      avaliacoes?.forEach((av, index) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        
        const tipo = tipoLabels[av.tipo as keyof typeof tipoLabels];
        const periodo = `${dataBR(av.periodo_inicio).toLocaleDateString()} - ${dataBR(av.periodo_fim).toLocaleDateString()}`;
        
        doc.text(`${index + 1}. ${tipo} - ${periodo}`, 25, yPos);
        doc.text(`Nota: ${av.nota_final || "N/A"}`, 25, yPos + 5);
        if (av.observacoes) {
          const obs = av.observacoes.substring(0, 80);
          doc.text(`Obs: ${obs}${av.observacoes.length > 80 ? "..." : ""}`, 25, yPos + 10);
          yPos += 20;
        } else {
          yPos += 15;
        }
      });
      
      doc.save(`avaliacao-${employee?.nome_completo || "funcionario"}-${todayISO()}.pdf`);
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header com botão de exportar */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Histórico de Avaliações</h2>
        <Button onClick={exportToPDF} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Exportar PDF
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Avaliações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avaliacoes?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Média Geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{mediaGeral}</div>
              <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tendência
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {tendencia > 0 ? (
                <>
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  <span className="text-2xl font-bold text-green-500">+{tendencia.toFixed(2)}</span>
                </>
              ) : tendencia < 0 ? (
                <>
                  <TrendingDown className="w-5 h-5 text-red-500" />
                  <span className="text-2xl font-bold text-red-500">{tendencia.toFixed(2)}</span>
                </>
              ) : (
                <span className="text-2xl font-bold">0.00</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos de Análise */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Gráfico de Evolução */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Evolução do Desempenho
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="periodo" />
                  <YAxis domain={[0, 10]} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="nota"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Nota Final"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Gráfico de Critérios */}
        {criteriosData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Desempenho por Critério
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={criteriosData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="criterio" />
                  <YAxis domain={[0, 10]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="media" fill="hsl(var(--primary))" name="Média" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Radar Chart de Critérios */}
      {criteriosData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Análise Multidimensional</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart data={criteriosData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="criterio" />
                <PolarRadiusAxis domain={[0, 10]} />
                <Radar name="Média" dataKey="media" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.6} />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Lista de Avaliações */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Histórico de Avaliações</h3>
        {avaliacoes?.map((avaliacao) => (
          <Card key={avaliacao.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-base">
                    Avaliação {tipoLabels[avaliacao.tipo as keyof typeof tipoLabels]}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {dataBR(avaliacao.periodo_inicio).toLocaleDateString()} até{" "}
                    {dataBR(avaliacao.periodo_fim).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{avaliacao.nota_final}</span>
                  <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" />
                </div>
              </div>
            </CardHeader>
            {avaliacao.observacoes && (
              <CardContent>
                <p className="text-sm text-muted-foreground">{avaliacao.observacoes}</p>
              </CardContent>
            )}
          </Card>
        ))}

        {(!avaliacoes || avaliacoes.length === 0) && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Nenhuma avaliação concluída ainda
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
