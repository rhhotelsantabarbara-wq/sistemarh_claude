import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Award, Download, Unlock, Check } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { dataBR } from "@/lib/date";

export function RelatoriosTreinamento() {
  const queryClient = useQueryClient();

  // Buscar certificados já liberados
  const { data: certificadosLiberados } = useQuery({
    queryKey: ["certificados-liberados"],
    queryFn: async () => {
      const { data } = await supabase
        .from("certificados_liberados")
        .select("employee_id, curso_id");
      return data || [];
    },
  });

  const { data: progressData } = useQuery({
    queryKey: ["relatorios-treinamento"],
    queryFn: async () => {
      // Buscar todos os cursos com módulos e aulas
      const { data: cursos } = await supabase
        .from("cursos")
        .select(`
          *,
          modulos:modulos(
            id,
            aulas:aulas(id)
          )
        `)
        .eq("ativo", true);

      // Buscar progresso dos funcionários
      const { data: progresso } = await supabase
        .from("progresso_treinamento")
        .select(`
          *,
          employee:employees(nome_completo, cpf, empresa_id),
          aula:aulas(
            id,
            modulo:modulos(curso_id)
          )
        `);

      // Calcular estatísticas
      const stats = cursos?.map((curso) => {
        const totalAulas = curso.modulos.reduce(
          (sum: number, mod: any) => sum + (mod.aulas?.length || 0),
          0
        );

        const aulasIds = curso.modulos.flatMap((mod: any) =>
          mod.aulas?.map((a: any) => a.id) || []
        );

        const progressoCurso = progresso?.filter((p: any) =>
          aulasIds.includes(p.aula_id)
        );

        const funcionariosUnicos = new Set(
          progressoCurso?.map((p: any) => p.employee_id)
        );

        const aulasConcluidasTotal = progressoCurso?.filter(
          (p: any) => p.concluida
        ).length || 0;

        const taxaConclusao =
          funcionariosUnicos.size > 0 && totalAulas > 0
            ? (aulasConcluidasTotal / (funcionariosUnicos.size * totalAulas)) *
              100
            : 0;

        // Calcular funcionários que completaram o curso
        const funcionariosCompletos = Array.from(funcionariosUnicos).filter(
          (employeeId) => {
            const aulasDoFuncionario = progressoCurso?.filter(
              (p: any) => p.employee_id === employeeId && p.concluida
            ).length || 0;
            return aulasDoFuncionario === totalAulas;
          }
        );

        // Obter dados dos funcionários completos
        const funcionariosCompletosDados = funcionariosCompletos.map((employeeId) => {
          const progressoFuncionario = progressoCurso?.find(
            (p: any) => p.employee_id === employeeId
          );
          const dataConclusao = progressoCurso
            ?.filter((p: any) => p.employee_id === employeeId && p.concluida)
            .map((p: any) => dataBR(p.data_conclusao))
            .sort((a: Date, b: Date) => b.getTime() - a.getTime())[0];
          
          return {
            id: employeeId,
            nome: progressoFuncionario?.employee?.nome_completo,
            cpf: progressoFuncionario?.employee?.cpf,
            empresa_id: progressoFuncionario?.employee?.empresa_id,
            dataConclusao: dataConclusao,
          };
        });

        return {
          curso,
          totalAulas,
          funcionariosInscritos: funcionariosUnicos.size,
          taxaConclusao: Math.round(taxaConclusao),
          funcionariosCompletos: funcionariosCompletosDados,
        };
      });

      return stats;
    },
  });

  // Mutation para liberar certificado
  const liberarCertificado = useMutation({
    mutationFn: async ({ employeeId, cursoId, dataConclusao }: { employeeId: string; cursoId: string; dataConclusao: Date }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("certificados_liberados")
        .insert({
          employee_id: employeeId,
          curso_id: cursoId,
          liberado_por: user?.id,
          data_conclusao: dataConclusao.toISOString(),
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificados-liberados"] });
      toast.success("Certificado liberado para o funcionário!");
    },
    onError: (error: any) => {
      if (error.code === "23505") {
        toast.info("Certificado já foi liberado para este funcionário");
      } else {
        toast.error("Erro ao liberar certificado");
      }
    },
  });

  const isCertificadoLiberado = (employeeId: string, cursoId: string) => {
    return certificadosLiberados?.some(
      (c) => c.employee_id === employeeId && c.curso_id === cursoId
    );
  };

  const gerarCertificado = async (
    funcionario: any,
    curso: any
  ) => {
    try {
      // Buscar logo da empresa
      const { data: empresa } = await supabase
        .from("empresas")
        .select("nome, logo_url")
        .eq("id", funcionario.empresa_id)
        .single();

      const doc = new jsPDF({ orientation: "landscape" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Adicionar logo se existir
      if (empresa?.logo_url) {
        try {
          doc.addImage(empresa.logo_url, "PNG", pageWidth / 2 - 15, 15, 30, 30);
        } catch (error) {
          console.error("Erro ao adicionar logo:", error);
        }
      }

      // Borda decorativa
      doc.setLineWidth(2);
      doc.setDrawColor(59, 130, 246);
      doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

      // Título
      doc.setFontSize(28);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(59, 130, 246);
      doc.text("CERTIFICADO", pageWidth / 2, 55, { align: "center" });

      // Subtítulo
      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      doc.text("DE CONCLUSÃO DE CURSO", pageWidth / 2, 65, { align: "center" });

      // Texto principal
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("Certificamos que", pageWidth / 2, 80, { align: "center" });

      // Nome do funcionário
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(59, 130, 246);
      doc.text(funcionario.nome, pageWidth / 2, 92, { align: "center" });

      // CPF do funcionário
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`CPF: ${funcionario.cpf || "Não informado"}`, pageWidth / 2, 100, {
        align: "center",
      });

      // Texto do curso
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      doc.text("concluiu com êxito o curso", pageWidth / 2, 112, {
        align: "center",
      });

      // Nome do curso
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(59, 130, 246);
      const cursoTitulo = doc.splitTextToSize(curso.titulo, pageWidth - 100);
      doc.text(cursoTitulo, pageWidth / 2, 124, { align: "center" });

      // Carga horária
      if (curso.carga_horaria) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text(`Carga Horária: ${curso.carga_horaria} horas`, pageWidth / 2, 136, {
          align: "center",
        });
      }

      // Nome da empresa - posicionado na parte inferior
      if (empresa?.nome) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(empresa.nome, pageWidth / 2, pageHeight - 45, {
          align: "center",
        });
      }

      // Data de conclusão - logo abaixo do nome da empresa
      const dataFormatada = dataBR(funcionario.dataConclusao).toLocaleDateString(
        "pt-BR",
        { day: "2-digit", month: "long", year: "numeric" }
      );
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`Concluído em ${dataFormatada}`, pageWidth / 2, pageHeight - 36, {
        align: "center",
      });

      // Linha de assinatura
      doc.setLineWidth(0.5);
      doc.setDrawColor(0, 0, 0);
      doc.line(pageWidth / 2 - 40, pageHeight - 22, pageWidth / 2 + 40, pageHeight - 22);
      doc.setFontSize(10);
      doc.text("Assinatura Autorizada", pageWidth / 2, pageHeight - 17, {
        align: "center",
      });

      doc.save(
        `Certificado_${funcionario.nome.replace(/\s/g, "_")}_${curso.titulo.replace(/\s/g, "_")}.pdf`
      );
      toast.success("Certificado gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar certificado:", error);
      toast.error("Erro ao gerar certificado");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Relatórios de Treinamento</h2>
        <p className="text-muted-foreground">
          Acompanhe o progresso dos funcionários nos cursos
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {progressData?.map((stat) => (
          <Card key={stat.curso.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{stat.curso.titulo}</CardTitle>
                  <CardDescription className="mt-2">
                    {stat.totalAulas} aulas • {stat.funcionariosInscritos}{" "}
                    funcionários inscritos
                  </CardDescription>
                </div>
                {stat.curso.obrigatorio && (
                  <Badge variant="destructive">Obrigatório</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Taxa de Conclusão</span>
                    <span className="font-medium">{stat.taxaConclusao}%</span>
                  </div>
                  <Progress value={stat.taxaConclusao} />
                </div>

                {stat.funcionariosCompletos &&
                  stat.funcionariosCompletos.length > 0 && (
                    <div className="border-t pt-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Award className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">
                          Funcionários que Completaram ({stat.funcionariosCompletos.length})
                        </span>
                      </div>
                      <div className="space-y-2">
                        {stat.funcionariosCompletos.map((func: any) => {
                          const liberado = isCertificadoLiberado(func.id, stat.curso.id);
                          
                          return (
                            <div
                              key={func.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded-lg bg-muted/50 gap-2"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{func.nome}</p>
                                <p className="text-xs text-muted-foreground">
                                  CPF: {func.cpf || "Não informado"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Concluído em:{" "}
                                  {dataBR(func.dataConclusao).toLocaleDateString(
                                    "pt-BR"
                                  )}
                                </p>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => gerarCertificado(func, stat.curso)}
                                  className="gap-1"
                                >
                                  <Download className="w-3 h-3" />
                                  <span className="hidden sm:inline">Baixar</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant={liberado ? "secondary" : "default"}
                                  onClick={() => liberarCertificado.mutate({
                                    employeeId: func.id,
                                    cursoId: stat.curso.id,
                                    dataConclusao: func.dataConclusao,
                                  })}
                                  disabled={liberado || liberarCertificado.isPending}
                                  className="gap-1"
                                >
                                  {liberado ? (
                                    <>
                                      <Check className="w-3 h-3" />
                                      <span className="hidden sm:inline">Liberado</span>
                                    </>
                                  ) : (
                                    <>
                                      <Unlock className="w-3 h-3" />
                                      <span className="hidden sm:inline">Liberar</span>
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(!progressData || progressData.length === 0) && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum curso cadastrado ainda
          </CardContent>
        </Card>
      )}
    </div>
  );
}