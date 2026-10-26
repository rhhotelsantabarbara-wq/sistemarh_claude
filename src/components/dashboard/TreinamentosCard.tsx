import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { GraduationCap, Play, CheckCircle2, Clock, Award, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { dataBR } from "@/lib/date";

interface TreinamentosCardProps {
  employeeId: string;
}

export function TreinamentosCard({ employeeId }: TreinamentosCardProps) {
  const [selectedAula, setSelectedAula] = useState<any>(null);
  const [videoStartTime, setVideoStartTime] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const queryClient = useQueryClient();

  // Buscar dados do funcionário para o certificado
  const { data: employeeData } = useQuery({
    queryKey: ["employee-data", employeeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("nome_completo, cpf, empresa_id")
        .eq("id", employeeId)
        .single();
      return data;
    },
  });

  // Buscar certificados liberados para este funcionário
  const { data: certificadosLiberados } = useQuery({
    queryKey: ["certificados-liberados-funcionario", employeeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("certificados_liberados")
        .select(`
          *,
          curso:cursos(id, titulo, carga_horaria)
        `)
        .eq("employee_id", employeeId);
      return data || [];
    },
  });

  const { data: cursosDisponiveis } = useQuery({
    queryKey: ["cursos-funcionario", employeeId],
    queryFn: async () => {
      // Buscar dados do funcionário
      const { data: employee } = await supabase
        .from("employees")
        .select("setor, cargo, empresa_id")
        .eq("id", employeeId)
        .single();

      if (!employee) return [];

      // Buscar cursos disponíveis
      const { data: cursos } = await supabase
        .from("cursos")
        .select(`
          *,
          modulos:modulos(
            *,
            aulas:aulas(*)
          )
        `)
        .eq("ativo", true);

      // Filtrar cursos relevantes para o funcionário
      const cursosRelevantes = cursos?.filter((curso) => {
        if (!curso.empresa_id && !curso.setor_id && !curso.funcao_id) {
          return true; // Curso para todos
        }

        const matchEmpresa = !curso.empresa_id || curso.empresa_id === employee.empresa_id;
        const matchSetor = !curso.setor_id;
        const matchFuncao = !curso.funcao_id;

        return matchEmpresa && matchSetor && matchFuncao;
      });

      // Buscar progresso
      const { data: progressoData } = await supabase
        .from("progresso_treinamento")
        .select("*")
        .eq("employee_id", employeeId);

      // Calcular progresso para cada curso
      return cursosRelevantes?.map((curso) => {
        const totalAulas = curso.modulos.reduce(
          (sum: number, mod: any) => sum + (mod.aulas?.length || 0),
          0
        );
        const aulasIds = curso.modulos.flatMap((mod: any) =>
          mod.aulas?.map((a: any) => a.id) || []
        );
        const aulasConcluidas = progressoData?.filter(
          (p) => aulasIds.includes(p.aula_id) && p.concluida
        ).length || 0;

        const percentual = totalAulas > 0 ? (aulasConcluidas / totalAulas) * 100 : 0;

        // Adicionar info de conclusão em cada aula
        const modulosComProgresso = curso.modulos.map((modulo: any) => ({
          ...modulo,
          aulas: modulo.aulas.map((aula: any) => ({
            ...aula,
            concluida: progressoData?.some(
              (p) => p.aula_id === aula.id && p.concluida
            ),
          })),
        }));

        return {
          ...curso,
          modulos: modulosComProgresso,
          totalAulas,
          aulasConcluidas,
          percentual: Math.round(percentual),
        };
      });
    },
  });

  // Reset timer when a new lesson is selected
  useEffect(() => {
    if (selectedAula) {
      const durationSeconds = (selectedAula.duracao_minutos || 1) * 60;
      setRemainingSeconds(durationSeconds);
      setVideoStartTime(Date.now());
    } else {
      setVideoStartTime(null);
      setRemainingSeconds(0);
    }
  }, [selectedAula]);

  // Countdown timer
  useEffect(() => {
    if (!videoStartTime || remainingSeconds <= 0) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - videoStartTime) / 1000);
      const durationSeconds = (selectedAula?.duracao_minutos || 1) * 60;
      const remaining = Math.max(0, durationSeconds - elapsed);
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [videoStartTime, selectedAula]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const canMarkComplete = remainingSeconds <= 0;

  const marcarConcluida = useMutation({
    mutationFn: async (aulaId: string) => {
      if (!canMarkComplete) {
        throw new Error("Aguarde o tempo da aula terminar");
      }
      const { error } = await supabase.from("progresso_treinamento").upsert({
        employee_id: employeeId,
        aula_id: aulaId,
        concluida: true,
        data_conclusao: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cursos-funcionario"] });
      queryClient.invalidateQueries({ queryKey: ["certificados-liberados-funcionario"] });
      toast.success("Aula marcada como concluída!");
      setSelectedAula(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao marcar aula");
    },
  });

  const handleOpenAula = async (aula: any) => {
    if (aula.concluida) {
      toast.info("Esta aula já foi concluída");
    }
    setSelectedAula(aula);
    
    // Registrar último acesso
    await supabase.from("progresso_treinamento").upsert({
      employee_id: employeeId,
      aula_id: aula.id,
      ultimo_acesso: new Date().toISOString(),
    }, {
      onConflict: 'employee_id,aula_id',
    });
  };

  const gerarCertificado = async (certificado: any) => {
    try {
      // Buscar logo da empresa
      const { data: empresa } = await supabase
        .from("empresas")
        .select("nome, logo_url")
        .eq("id", employeeData?.empresa_id)
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
      doc.text(employeeData?.nome_completo || "", pageWidth / 2, 92, { align: "center" });

      // CPF do funcionário
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`CPF: ${employeeData?.cpf || "Não informado"}`, pageWidth / 2, 100, {
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
      const cursoTitulo = doc.splitTextToSize(certificado.curso.titulo, pageWidth - 100);
      doc.text(cursoTitulo, pageWidth / 2, 124, { align: "center" });

      // Carga horária
      if (certificado.curso.carga_horaria) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text(`Carga Horária: ${certificado.curso.carga_horaria} horas`, pageWidth / 2, 136, {
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
      const dataFormatada = dataBR(certificado.data_conclusao).toLocaleDateString(
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
        `Certificado_${employeeData?.nome_completo?.replace(/\s/g, "_")}_${certificado.curso.titulo.replace(/\s/g, "_")}.pdf`
      );
      toast.success("Certificado baixado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar certificado:", error);
      toast.error("Erro ao gerar certificado");
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Meus Treinamentos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Certificados disponíveis para download */}
          {certificadosLiberados && certificadosLiberados.length > 0 && (
            <div className="space-y-2 pb-4 border-b">
              <div className="flex items-center gap-2 mb-2">
                <Award className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Meus Certificados</span>
              </div>
              <div className="space-y-2">
                {certificadosLiberados.map((cert) => (
                  <div
                    key={cert.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-green-500/10"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-700 dark:text-green-400">
                        {cert.curso?.titulo}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Concluído em {dataBR(cert.data_conclusao).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => gerarCertificado(cert)}
                      className="gap-1"
                    >
                      <Download className="h-3 w-3" />
                      Baixar
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cursosDisponiveis && cursosDisponiveis.length > 0 ? (
            cursosDisponiveis.map((curso) => (
              <div key={curso.id} className="space-y-2">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{curso.titulo}</h4>
                      {curso.obrigatorio && (
                        <Badge variant="destructive" className="text-xs">
                          Obrigatório
                        </Badge>
                      )}
                      {curso.percentual === 100 && (
                        <Badge variant="default" className="text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Concluído
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {curso.aulasConcluidas} de {curso.totalAulas} aulas concluídas
                    </p>
                  </div>
                </div>
                <Progress value={curso.percentual} />
                <div className="space-y-2 mt-2">
                  {curso.modulos.map((modulo: any) => (
                    <div key={modulo.id} className="ml-4 space-y-1">
                      <p className="text-sm font-medium">{modulo.titulo}</p>
                      {modulo.aulas.map((aula: any) => (
                        <Button
                          key={aula.id}
                          variant={aula.concluida ? "secondary" : "ghost"}
                          size="sm"
                          className="w-full justify-start text-sm"
                          onClick={() => handleOpenAula(aula)}
                        >
                          {aula.concluida ? (
                            <CheckCircle2 className="h-3 w-3 mr-2 text-green-500" />
                          ) : (
                            <Play className="h-3 w-3 mr-2" />
                          )}
                          {aula.titulo}
                          {aula.duracao_minutos && (
                            <span className="ml-auto text-xs text-muted-foreground">
                              {aula.duracao_minutos} min
                            </span>
                          )}
                        </Button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum treinamento disponível no momento
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedAula} onOpenChange={() => setSelectedAula(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAula?.titulo}
              {selectedAula?.duracao_minutos && (
                <Badge variant="outline" className="ml-2">
                  <Clock className="h-3 w-3 mr-1" />
                  {selectedAula.duracao_minutos} min
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedAula && (
            <div className="space-y-4">
              <div className="aspect-video">
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${selectedAula.youtube_video_id}`}
                  title={selectedAula.titulo}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              {selectedAula.descricao && (
                <p className="text-sm text-muted-foreground">
                  {selectedAula.descricao}
                </p>
              )}
              
              {selectedAula.concluida ? (
                <div className="flex items-center justify-center gap-2 p-3 bg-green-500/10 rounded-lg text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Aula já concluída</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {!canMarkComplete && (
                    <div className="flex items-center justify-center gap-2 p-3 bg-muted rounded-lg">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm">
                        Assista a aula por completo. Tempo restante:{" "}
                        <strong>{formatTime(remainingSeconds)}</strong>
                      </span>
                    </div>
                  )}
                  <Button
                    onClick={() => marcarConcluida.mutate(selectedAula.id)}
                    className="w-full"
                    disabled={!canMarkComplete || marcarConcluida.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {canMarkComplete
                      ? "Marcar como Concluída"
                      : `Aguarde ${formatTime(remainingSeconds)}`}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}