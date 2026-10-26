import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { Users, BookOpen, Award, TrendingUp, Clock, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { dataBR } from "@/lib/date";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export function EstatisticasTreinamento() {
  const [cursoFiltro, setCursoFiltro] = useState<string>("todos");

  const { data: stats } = useQuery({
    queryKey: ["estatisticas-treinamento-detalhadas"],
    queryFn: async () => {
      // Buscar todos os cursos com módulos e aulas
      const { data: cursos } = await supabase
        .from("cursos")
        .select(`
          *,
          modulos:modulos(
            id,
            titulo,
            aulas:aulas(id, titulo, duracao_minutos)
          )
        `)
        .eq("ativo", true);

      // Buscar todos os funcionários
      const { data: funcionarios } = await supabase
        .from("employees")
        .select("id, nome_completo, setor, cargo, empresa_id")
        .in("status", ["ativo", "ferias"]);

      // Buscar todo o progresso
      const { data: progresso } = await supabase
        .from("progresso_treinamento")
        .select(`
          *,
          employee:employees(id, nome_completo, setor, cargo),
          aula:aulas(
            id,
            titulo,
            modulo:modulos(curso_id, titulo)
          )
        `);

      // Calcular estatísticas gerais
      const totalCursos = cursos?.length || 0;
      const totalAlunos = funcionarios?.length || 0;
      const totalConclusoes = progresso?.filter((p) => p.concluida).length || 0;
      
      // Funcionários únicos que acessaram algum curso
      const funcionariosAtivos = new Set(progresso?.map(p => p.employee_id)).size;

      // Calcular estatísticas por curso
      const estatisticasPorCurso = cursos?.map((curso) => {
        const aulasIds = curso.modulos.flatMap((mod: any) =>
          mod.aulas?.map((a: any) => a.id) || []
        );
        const totalAulasCurso = aulasIds.length;

        const progressoCurso = progresso?.filter((p) =>
          aulasIds.includes(p.aula_id)
        ) || [];

        const funcionariosUnicos = new Set(
          progressoCurso.map((p) => p.employee_id)
        );

        const aulasConcluidasTotal = progressoCurso.filter((p) => p.concluida).length;

        // Taxa de conclusão considerando funcionários inscritos
        const taxaConclusao =
          funcionariosUnicos.size > 0 && totalAulasCurso > 0
            ? (aulasConcluidasTotal / (funcionariosUnicos.size * totalAulasCurso)) * 100
            : 0;

        // Último acesso ao curso
        const ultimoAcesso = progressoCurso
          .filter(p => p.ultimo_acesso)
          .map(p => dataBR(p.ultimo_acesso))
          .sort((a, b) => b.getTime() - a.getTime())[0];

        return {
          id: curso.id,
          nome: curso.titulo,
          totalAulas: totalAulasCurso,
          inscritos: funcionariosUnicos.size,
          aulasFeitas: aulasConcluidasTotal,
          conclusoes: Math.round(taxaConclusao),
          ultimoAcesso,
        };
      }) || [];

      // Taxa média de conclusão
      const cursosComInscritos = estatisticasPorCurso.filter(c => c.inscritos > 0);
      const taxaMediaConclusao = cursosComInscritos.length > 0
        ? Math.round(cursosComInscritos.reduce((sum, c) => sum + c.conclusoes, 0) / cursosComInscritos.length)
        : 0;

      // Estatísticas detalhadas por funcionário
      const estatisticasPorFuncionario = funcionarios?.map((func) => {
        const progressoFunc = progresso?.filter((p) => p.employee_id === func.id) || [];
        
        const cursosAcessados = new Set(
          progressoFunc.map((p) => p.aula?.modulo?.curso_id).filter(Boolean)
        ).size;

        const aulasFeitas = progressoFunc.filter((p) => p.concluida).length;
        const totalAcessos = progressoFunc.length;

        const ultimoAcesso = progressoFunc
          .filter(p => p.ultimo_acesso)
          .map(p => dataBR(p.ultimo_acesso))
          .sort((a, b) => b.getTime() - a.getTime())[0];

        // Calcular progresso geral do funcionário
        let totalAulasDisponiveis = 0;
        let aulasConcluidasFunc = 0;

        cursos?.forEach((curso) => {
          const aulasIds = curso.modulos.flatMap((mod: any) =>
            mod.aulas?.map((a: any) => a.id) || []
          );
          totalAulasDisponiveis += aulasIds.length;
          aulasConcluidasFunc += progressoFunc.filter(
            (p) => aulasIds.includes(p.aula_id) && p.concluida
          ).length;
        });

        const progressoGeral = totalAulasDisponiveis > 0
          ? Math.round((aulasConcluidasFunc / totalAulasDisponiveis) * 100)
          : 0;

        return {
          id: func.id,
          nome: func.nome_completo,
          setor: func.setor,
          cargo: func.cargo,
          cursosAcessados,
          aulasFeitas,
          totalAcessos,
          ultimoAcesso,
          progressoGeral,
        };
      }).sort((a, b) => b.aulasFeitas - a.aulasFeitas) || [];

      // Progresso mensal (últimos 6 meses)
      const hoje = new Date();
      const progressoMensal = [];

      for (let i = 5; i >= 0; i--) {
        const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const mesAno = data.toLocaleDateString("pt-BR", {
          month: "short",
          year: "2-digit",
        });

        const conclusoesMes = progresso?.filter((p) => {
          if (!p.data_conclusao || !p.concluida) return false;
          const dataConclusao = dataBR(p.data_conclusao);
          return (
            dataConclusao.getMonth() === data.getMonth() &&
            dataConclusao.getFullYear() === data.getFullYear()
          );
        }).length || 0;

        const acessosMes = progresso?.filter((p) => {
          if (!p.ultimo_acesso) return false;
          const dataAcesso = dataBR(p.ultimo_acesso);
          return (
            dataAcesso.getMonth() === data.getMonth() &&
            dataAcesso.getFullYear() === data.getFullYear()
          );
        }).length || 0;

        progressoMensal.push({
          mes: mesAno,
          conclusoes: conclusoesMes,
          acessos: acessosMes,
        });
      }

      // Cursos por setor
      const { data: setores } = await supabase.from("setores").select("id, nome");
      const cursosPorSetor: { [key: string]: number } = {};
      cursos?.forEach((curso) => {
        if (curso.setor_id) {
          cursosPorSetor[curso.setor_id] = (cursosPorSetor[curso.setor_id] || 0) + 1;
        }
      });
      const dadosPorSetor = Object.entries(cursosPorSetor).map(([setorId, total]) => {
        const setor = setores?.find((s) => s.id === setorId);
        return { setor: setor?.nome || "Sem setor", total };
      });

      return {
        totalCursos,
        totalAlunos,
        totalConclusoes,
        funcionariosAtivos,
        taxaMediaConclusao,
        estatisticasPorCurso,
        estatisticasPorFuncionario,
        progressoMensal,
        dadosPorSetor,
        cursos: cursos || [],
      };
    },
  });

  const funcionariosFiltrados = cursoFiltro === "todos"
    ? stats?.estatisticasPorFuncionario
    : stats?.estatisticasPorFuncionario?.filter(f => f.cursosAcessados > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Estatísticas de Treinamentos</h2>
        <p className="text-muted-foreground">
          Visão geral e análise detalhada dos cursos e funcionários
        </p>
      </div>

      {/* Cards de Métricas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Cursos</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCursos || 0}</div>
            <p className="text-xs text-muted-foreground">Cursos ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Funcionários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalAlunos || 0}</div>
            <p className="text-xs text-muted-foreground">Funcionários ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Funcionários Ativos</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.funcionariosAtivos || 0}</div>
            <p className="text-xs text-muted-foreground">Acessaram treinamentos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aulas Concluídas</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalConclusoes || 0}</div>
            <p className="text-xs text-muted-foreground">Total de conclusões</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa Média</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.taxaMediaConclusao || 0}%</div>
            <p className="text-xs text-muted-foreground">Conclusão média</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Estatísticas por Curso */}
      <Card>
        <CardHeader>
          <CardTitle>Estatísticas por Curso</CardTitle>
          <CardDescription>
            Detalhes de inscrições, conclusões e último acesso de cada curso
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Curso</TableHead>
                <TableHead className="text-center">Total Aulas</TableHead>
                <TableHead className="text-center">Inscritos</TableHead>
                <TableHead className="text-center">Aulas Feitas</TableHead>
                <TableHead className="text-center">Taxa Conclusão</TableHead>
                <TableHead className="text-center">Último Acesso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats?.estatisticasPorCurso?.map((curso) => (
                <TableRow key={curso.id}>
                  <TableCell className="font-medium">{curso.nome}</TableCell>
                  <TableCell className="text-center">{curso.totalAulas}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{curso.inscritos}</Badge>
                  </TableCell>
                  <TableCell className="text-center">{curso.aulasFeitas}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center gap-2">
                      <Progress value={curso.conclusoes} className="w-16 h-2" />
                      <span className="text-sm">{curso.conclusoes}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {curso.ultimoAcesso ? (
                      <span className="flex items-center justify-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(curso.ultimoAcesso, {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </span>
                    ) : (
                      "Nunca"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tabela de Estatísticas por Funcionário */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Progresso por Funcionário</CardTitle>
              <CardDescription>
                Detalhes de acessos e conclusões de cada funcionário
              </CardDescription>
            </div>
            <Select value={cursoFiltro} onValueChange={setCursoFiltro}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativos">Apenas com acessos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead className="text-center">Cursos Acessados</TableHead>
                <TableHead className="text-center">Aulas Concluídas</TableHead>
                <TableHead className="text-center">Progresso Geral</TableHead>
                <TableHead className="text-center">Último Acesso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {funcionariosFiltrados?.slice(0, 20).map((func) => (
                <TableRow key={func.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{func.nome}</p>
                      <p className="text-xs text-muted-foreground">{func.cargo}</p>
                    </div>
                  </TableCell>
                  <TableCell>{func.setor || "-"}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{func.cursosAcessados}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={func.aulasFeitas > 0 ? "default" : "secondary"}>
                      {func.aulasFeitas}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center gap-2 justify-center">
                      <Progress value={func.progressoGeral} className="w-16 h-2" />
                      <span className="text-sm">{func.progressoGeral}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {func.ultimoAcesso ? (
                      <span className="flex items-center justify-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(func.ultimoAcesso, {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </span>
                    ) : (
                      "Nunca acessou"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {funcionariosFiltrados && funcionariosFiltrados.length > 20 && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              Mostrando 20 de {funcionariosFiltrados.length} funcionários
            </p>
          )}
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Gráfico de Barras - Inscritos por Curso */}
        <Card>
          <CardHeader>
            <CardTitle>Alunos Inscritos por Curso</CardTitle>
            <CardDescription>
              Quantidade de funcionários inscritos em cada curso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats?.estatisticasPorCurso || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="inscritos" fill="#3b82f6" name="Inscritos" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Linha - Evolução Mensal */}
        <Card>
          <CardHeader>
            <CardTitle>Evolução Mensal</CardTitle>
            <CardDescription>
              Acessos e conclusões nos últimos 6 meses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats?.progressoMensal || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="acessos"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Acessos"
                />
                <Line
                  type="monotone"
                  dataKey="conclusoes"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Conclusões"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Pizza - Taxa de Conclusão */}
        <Card>
          <CardHeader>
            <CardTitle>Taxa de Conclusão por Curso</CardTitle>
            <CardDescription>
              Percentual de conclusão de cada curso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats?.estatisticasPorCurso?.filter(c => c.inscritos > 0) || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.nome.substring(0, 15)}...: ${entry.conclusoes}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="conclusoes"
                >
                  {stats?.estatisticasPorCurso?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Barras - Cursos por Setor */}
        {stats?.dadosPorSetor && stats.dadosPorSetor.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Cursos por Setor</CardTitle>
              <CardDescription>
                Distribuição de cursos pelos setores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.dadosPorSetor}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="setor" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total" fill="#10b981" name="Total de Cursos" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {(!stats?.estatisticasPorCurso || stats.estatisticasPorCurso.length === 0) && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum dado disponível ainda. Cadastre cursos e acompanhe o
            progresso dos funcionários.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
