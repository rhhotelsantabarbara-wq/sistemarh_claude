import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Settings, TrendingUp, Users, Award, Download, Calendar } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import jsPDF from "jspdf";
import AvaliacaoForm from "@/components/avaliacoes/AvaliacaoForm";
import AvaliacaoCard from "@/components/avaliacoes/AvaliacaoCard";
import CriteriosConfig from "@/components/avaliacoes/CriteriosConfig";
import { CiclosConfig } from "@/components/avaliacoes/CiclosConfig";
import { ProximasAvaliacoes } from "@/components/avaliacoes/ProximasAvaliacoes";
import { todayISO } from "@/lib/date";

export default function Avaliacoes() {
  const [showAvaliacaoForm, setShowAvaliacaoForm] = useState(false);
  const [showCriteriosConfig, setShowCriteriosConfig] = useState(false);
  const [showCiclosConfig, setShowCiclosConfig] = useState(false);
  const [selectedAvaliacao, setSelectedAvaliacao] = useState<any>(null);

  const { data: avaliacoes, refetch: refetchAvaliacoes } = useQuery({
    queryKey: ["avaliacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avaliacoes_desempenho")
        .select(`
          *,
          employee:employees(id, nome_completo, cargo, setor, foto_url)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const pendentes = avaliacoes?.filter(a => a.status === "pendente") || [];
  const emAndamento = avaliacoes?.filter(a => a.status === "em_andamento") || [];
  const concluidas = avaliacoes?.filter(a => a.status === "concluida") || [];

  // Estatísticas
  const mediaGeral = concluidas.length > 0
    ? (concluidas.reduce((sum, av) => sum + Number(av.nota_final || 0), 0) / concluidas.length).toFixed(2)
    : "0";

  const totalFuncionariosAvaliados = new Set(avaliacoes?.map(a => a.employee_id)).size;

  // Dados para gráfico de distribuição por tipo
  const avaliacoesPorTipo = avaliacoes?.reduce((acc: any, av) => {
    const tipo = av.tipo;
    const existing = acc.find((item: any) => item.tipo === tipo);
    if (existing) {
      existing.quantidade += 1;
    } else {
      acc.push({ tipo, quantidade: 1 });
    }
    return acc;
  }, []) || [];

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

  const exportRelatorio = () => {
    try {
      const doc = new jsPDF();
      
      doc.setFontSize(18);
      doc.text("Relatório de Avaliações de Desempenho", 20, 20);
      
      doc.setFontSize(12);
      doc.text(`Data: ${new Date().toLocaleDateString()}`, 20, 35);
      
      doc.setFontSize(14);
      doc.text("Resumo Geral", 20, 50);
      
      doc.setFontSize(11);
      doc.text(`Total de Avaliações: ${avaliacoes?.length || 0}`, 25, 60);
      doc.text(`Pendentes: ${pendentes.length}`, 25, 67);
      doc.text(`Em Andamento: ${emAndamento.length}`, 25, 74);
      doc.text(`Concluídas: ${concluidas.length}`, 25, 81);
      doc.text(`Funcionários Avaliados: ${totalFuncionariosAvaliados}`, 25, 88);
      doc.text(`Média Geral: ${mediaGeral}`, 25, 95);
      
      doc.save(`relatorio-avaliacoes-${todayISO()}.pdf`);
      toast.success("Relatório exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      toast.error("Erro ao gerar relatório");
    }
  };

  const handleEdit = (avaliacao: any) => {
    setSelectedAvaliacao(avaliacao);
    setShowAvaliacaoForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("avaliacoes_desempenho")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Avaliação excluída com sucesso!");
      refetchAvaliacoes();
    } catch (error: any) {
      toast.error("Erro ao excluir avaliação: " + error.message);
    }
  };

  return (
    <div className="container mx-auto p-0 sm:p-2 lg:p-4 space-y-6">
      <div className="flex-wrap gap-3 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-medium leading-tight">Avaliações de Desempenho</h1>
          <p className="text-muted-foreground">
            Gerencie avaliações periódicas e acompanhe o desenvolvimento da equipe
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setShowCiclosConfig(true)}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Ciclos Automáticos
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowCriteriosConfig(true)}
          >
            <Settings className="w-4 h-4 mr-2" />
            Critérios
          </Button>
          <Button onClick={() => {
            setSelectedAvaliacao(null);
            setShowAvaliacaoForm(true);
          }}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Avaliação
          </Button>
        </div>
      </div>

      {/* Métricas e Analytics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendentes.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Aguardando início</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Em Andamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{emAndamento.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Em processo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Award className="w-4 h-4" />
              Concluídas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{concluidas.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Finalizadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4" />
              Funcionários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFuncionariosAvaliados}</div>
            <p className="text-xs text-muted-foreground mt-1">Avaliados</p>
          </CardContent>
        </Card>
      </div>

      {/* Preview de Próximas Avaliações */}
      <ProximasAvaliacoes />

      {/* Gráficos e Análises */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Distribuição por Tipo</CardTitle>
              <Button variant="ghost" size="sm" onClick={exportRelatorio}>
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={avaliacoesPorTipo}
                  dataKey="quantidade"
                  nameKey="tipo"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {avaliacoesPorTipo.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status das Avaliações</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={[
                { status: "Pendentes", quantidade: pendentes.length },
                { status: "Em Andamento", quantidade: emAndamento.length },
                { status: "Concluídas", quantidade: concluidas.length },
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="quantidade" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Card de Média Geral */}
      {concluidas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Desempenho Geral</CardTitle>
            <CardDescription>Média de todas as avaliações concluídas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-5xl font-bold">{mediaGeral}</div>
              <div className="flex-1">
                <div className="text-sm text-muted-foreground">de 10</div>
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all" 
                    style={{ width: `${Math.min(100, (Number(mediaGeral) / 10) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="pendentes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pendentes">
            Pendentes ({pendentes.length})
          </TabsTrigger>
          <TabsTrigger value="em_andamento">
            Em Andamento ({emAndamento.length})
          </TabsTrigger>
          <TabsTrigger value="concluidas">
            Concluídas ({concluidas.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes" className="space-y-4">
          {pendentes.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Nenhuma avaliação pendente
              </CardContent>
            </Card>
          ) : (
            pendentes.map((avaliacao) => (
              <AvaliacaoCard
                key={avaliacao.id}
                avaliacao={avaliacao}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onRefresh={refetchAvaliacoes}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="em_andamento" className="space-y-4">
          {emAndamento.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Nenhuma avaliação em andamento
              </CardContent>
            </Card>
          ) : (
            emAndamento.map((avaliacao) => (
              <AvaliacaoCard
                key={avaliacao.id}
                avaliacao={avaliacao}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onRefresh={refetchAvaliacoes}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="concluidas" className="space-y-4">
          {concluidas.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Nenhuma avaliação concluída
              </CardContent>
            </Card>
          ) : (
            concluidas.map((avaliacao) => (
              <AvaliacaoCard
                key={avaliacao.id}
                avaliacao={avaliacao}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onRefresh={refetchAvaliacoes}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      {showAvaliacaoForm && (
        <AvaliacaoForm
          avaliacao={selectedAvaliacao}
          onClose={() => {
            setShowAvaliacaoForm(false);
            setSelectedAvaliacao(null);
          }}
          onSuccess={() => {
            setShowAvaliacaoForm(false);
            setSelectedAvaliacao(null);
            refetchAvaliacoes();
          }}
        />
      )}

      {showCriteriosConfig && (
        <CriteriosConfig onClose={() => setShowCriteriosConfig(false)} />
      )}

      {showCiclosConfig && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 overflow-y-auto">
          <div className="container mx-auto p-4 sm:p-6">
            <div className="flex justify-end mb-4">
              <Button variant="outline" onClick={() => setShowCiclosConfig(false)}>
                Fechar
              </Button>
            </div>
            <CiclosConfig />
          </div>
        </div>
      )}
    </div>
  );
}
