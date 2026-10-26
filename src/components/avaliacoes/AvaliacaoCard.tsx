import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, Edit, Trash2, Eye, CheckCircle, FileDown } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { dataBR } from "@/lib/date";

interface AvaliacaoCardProps {
  avaliacao: any;
  onEdit: (avaliacao: any) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

export default function AvaliacaoCard({ avaliacao, onEdit, onDelete, onRefresh }: AvaliacaoCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAvaliarDialog, setShowAvaliarDialog] = useState(false);
  const [notas, setNotas] = useState<any>({});

  const { data: criterios } = useQuery({
    queryKey: ["criterios-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("criterios_avaliacao")
        .select("*")
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      return data;
    },
  });

  const { data: notasExistentes } = useQuery({
    queryKey: ["notas-avaliacao", avaliacao.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas_avaliacao")
        .select("*, criterio:criterios_avaliacao(*)")
        .eq("avaliacao_id", avaliacao.id);

      if (error) throw error;
      return data;
    },
    enabled: showDetails,
  });

  const statusColors = {
    pendente: "bg-yellow-500",
    em_andamento: "bg-blue-500",
    concluida: "bg-green-500",
  };

  const statusLabels = {
    pendente: "Pendente",
    em_andamento: "Em Andamento",
    concluida: "Concluída",
  };

  const tipoLabels = {
    mensal: "Mensal",
    trimestral: "Trimestral",
    semestral: "Semestral",
    anual: "Anual",
  };

  const exportarAvaliacaoPDF = async () => {
    try {
      // Buscar notas da avaliação se não estiverem carregadas
      const { data: notasData } = await supabase
        .from("notas_avaliacao")
        .select("*, criterio:criterios_avaliacao(*)")
        .eq("avaliacao_id", avaliacao.id);

      // Buscar empresa do funcionário
      const { data: empresaData } = await supabase
        .from("empresas")
        .select("nome, logo_url")
        .eq("id", avaliacao.employee?.empresa_id)
        .single();

      const doc = new jsPDF();
      let yPos = 20;

      // Cabeçalho
      doc.setFontSize(18);
      doc.setFont(undefined, "bold");
      doc.text("AVALIAÇÃO DE DESEMPENHO", 105, yPos, { align: "center" });
      yPos += 10;

      doc.setFontSize(12);
      doc.setFont(undefined, "normal");
      doc.text(tipoLabels[avaliacao.tipo as keyof typeof tipoLabels], 105, yPos, { align: "center" });
      yPos += 15;

      // Linha separadora
      doc.setDrawColor(79, 70, 229);
      doc.setLineWidth(0.5);
      doc.line(20, yPos, 190, yPos);
      yPos += 15;

      // Informações do Funcionário
      doc.setFontSize(14);
      doc.setFont(undefined, "bold");
      doc.text("DADOS DO COLABORADOR", 20, yPos);
      yPos += 10;

      doc.setFontSize(11);
      doc.setFont(undefined, "normal");
      doc.text(`Nome: ${avaliacao.employee?.nome_completo || "N/A"}`, 25, yPos);
      yPos += 7;
      doc.text(`Cargo: ${avaliacao.employee?.cargo || "N/A"}`, 25, yPos);
      yPos += 7;
      doc.text(`Setor: ${avaliacao.employee?.setor || "N/A"}`, 25, yPos);
      yPos += 7;
      if (empresaData?.nome) {
        doc.text(`Empresa: ${empresaData.nome}`, 25, yPos);
        yPos += 7;
      }
      yPos += 8;

      // Informações da Avaliação
      doc.setFontSize(14);
      doc.setFont(undefined, "bold");
      doc.text("INFORMAÇÕES DA AVALIAÇÃO", 20, yPos);
      yPos += 10;

      doc.setFontSize(11);
      doc.setFont(undefined, "normal");
      doc.text(`Tipo: ${tipoLabels[avaliacao.tipo as keyof typeof tipoLabels]}`, 25, yPos);
      yPos += 7;
      doc.text(`Período: ${dataBR(avaliacao.periodo_inicio).toLocaleDateString("pt-BR")} até ${dataBR(avaliacao.periodo_fim).toLocaleDateString("pt-BR")}`, 25, yPos);
      yPos += 7;
      doc.text(`Status: ${statusLabels[avaliacao.status as keyof typeof statusLabels]}`, 25, yPos);
      yPos += 7;
      
      if (avaliacao.nota_final) {
        doc.setFont(undefined, "bold");
        doc.text(`NOTA FINAL: ${avaliacao.nota_final}`, 25, yPos);
        doc.setFont(undefined, "normal");
        yPos += 7;
      }
      yPos += 10;

      // Critérios Avaliados
      if (notasData && notasData.length > 0) {
        doc.setFontSize(14);
        doc.setFont(undefined, "bold");
        doc.text("CRITÉRIOS AVALIADOS", 20, yPos);
        yPos += 10;

        const tableData = notasData.map((nota: any) => {
          const notaMedia = nota.nota_gestor && nota.nota_funcionario
            ? ((Number(nota.nota_gestor) + Number(nota.nota_funcionario)) / 2).toFixed(1)
            : nota.nota_gestor || nota.nota_funcionario || "N/A";
          
          return [
            nota.criterio?.nome || "Critério",
            nota.nota_funcionario || "-",
            nota.nota_gestor || "-",
            notaMedia,
            nota.comentario_gestor || nota.comentario_funcionario || "-"
          ];
        });

        autoTable(doc, {
          startY: yPos,
          head: [["Critério", "Auto-Avaliação", "Gestor", "Média", "Comentário"]],
          body: tableData,
          theme: "grid",
          headStyles: { fillColor: [79, 70, 229], fontSize: 10 },
          bodyStyles: { fontSize: 9 },
          columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 25, halign: "center" },
            2: { cellWidth: 25, halign: "center" },
            3: { cellWidth: 20, halign: "center" },
            4: { cellWidth: 60 }
          },
          margin: { left: 20, right: 20 }
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;
      }

      // Observações
      if (avaliacao.observacoes) {
        if (yPos > 240) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.setFontSize(14);
        doc.setFont(undefined, "bold");
        doc.text("OBSERVAÇÕES GERAIS", 20, yPos);
        yPos += 10;

        doc.setFontSize(11);
        doc.setFont(undefined, "normal");
        const splitObs = doc.splitTextToSize(avaliacao.observacoes, 170);
        doc.text(splitObs, 25, yPos);
        yPos += splitObs.length * 6 + 15;
      }

      // Espaço para assinaturas
      if (yPos > 230) {
        doc.addPage();
        yPos = 20;
      } else {
        yPos += 20;
      }

      doc.setFontSize(12);
      doc.setFont(undefined, "bold");
      doc.text("ASSINATURAS", 20, yPos);
      yPos += 20;

      // Linhas de assinatura
      doc.setDrawColor(100, 100, 100);
      doc.setLineWidth(0.3);
      
      doc.line(25, yPos, 90, yPos);
      doc.line(115, yPos, 185, yPos);
      yPos += 5;

      doc.setFontSize(10);
      doc.setFont(undefined, "normal");
      doc.text("Colaborador", 57.5, yPos, { align: "center" });
      doc.text("Gestor/Avaliador", 150, yPos, { align: "center" });
      yPos += 15;

      doc.line(25, yPos, 90, yPos);
      yPos += 5;
      doc.text("Data", 57.5, yPos, { align: "center" });

      // Rodapé
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.text(
          `Gerado em ${new Date().toLocaleString("pt-BR")} - Página ${i} de ${pageCount}`,
          105,
          290,
          { align: "center" }
        );
      }

      const fileName = `avaliacao_${avaliacao.employee?.nome_completo?.replace(/\s+/g, "_") || "funcionario"}_${dataBR(avaliacao.periodo_fim).toISOString().split("T")[0]}.pdf`;
      doc.save(fileName);
      toast.success("PDF da avaliação gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF");
    }
  };

  const handleAvaliar = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Inserir/atualizar notas
      for (const criterioId of Object.keys(notas)) {
        const nota = notas[criterioId];
        
        const { error } = await supabase
          .from("notas_avaliacao")
          .upsert({
            avaliacao_id: avaliacao.id,
            criterio_id: criterioId,
            nota_gestor: nota.nota,
            comentario_gestor: nota.comentario,
          }, {
            onConflict: "avaliacao_id,criterio_id"
          });

        if (error) throw error;
      }

      // Calcular nota final
      const notaValues = Object.values(notas).map((n: any) => n.nota).filter(Boolean);
      const notaFinal = notaValues.length > 0
        ? Number((notaValues.reduce((a: number, b: number) => a + b, 0) / notaValues.length).toFixed(2))
        : null;

      // Atualizar avaliação
      const { error } = await supabase
        .from("avaliacoes_desempenho")
        .update({
          status: "concluida",
          nota_final: notaFinal,
          avaliacao_gestor_concluida: true,
        })
        .eq("id", avaliacao.id);

      if (error) throw error;

      toast.success("Avaliação concluída com sucesso!");
      setShowAvaliarDialog(false);
      onRefresh();
    } catch (error: any) {
      toast.error("Erro ao salvar avaliação: " + error.message);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={avaliacao.employee?.foto_url} />
                <AvatarFallback>
                  {avaliacao.employee?.nome_completo?.split(" ").map((n: string) => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">{avaliacao.employee?.nome_completo}</h3>
                <p className="text-sm text-muted-foreground">
                  {avaliacao.employee?.cargo} - {avaliacao.employee?.setor}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={statusColors[avaliacao.status as keyof typeof statusColors]}>
                {statusLabels[avaliacao.status as keyof typeof statusLabels]}
              </Badge>
              <Badge variant="outline">{tipoLabels[avaliacao.tipo as keyof typeof tipoLabels]}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Período:</span>
              <span className="font-medium">
                {dataBR(avaliacao.periodo_inicio).toLocaleDateString()} até{" "}
                {dataBR(avaliacao.periodo_fim).toLocaleDateString()}
              </span>
            </div>

            {avaliacao.nota_final && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Nota Final:</span>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-lg">{avaliacao.nota_final}</span>
                  <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDetails(true)}
              >
                <Eye className="w-4 h-4 mr-1" />
                Ver Detalhes
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={exportarAvaliacaoPDF}
              >
                <FileDown className="w-4 h-4 mr-1" />
                Exportar PDF
              </Button>

              {avaliacao.status !== "concluida" ? (
                <>
                  <Button
                    size="sm"
                    onClick={() => setShowAvaliarDialog(true)}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Avaliar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(avaliacao)}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Excluir
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Excluir
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Detalhes */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Avaliação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Informações Gerais</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Funcionário:</span>
                  <p className="font-medium">{avaliacao.employee?.nome_completo}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tipo:</span>
                  <p className="font-medium">{tipoLabels[avaliacao.tipo as keyof typeof tipoLabels]}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <p className="font-medium">{statusLabels[avaliacao.status as keyof typeof statusLabels]}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Nota Final:</span>
                  <p className="font-medium">{avaliacao.nota_final || "Não avaliado"}</p>
                </div>
              </div>
            </div>

            {notasExistentes && notasExistentes.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Critérios Avaliados</h4>
                <div className="space-y-3">
                  {notasExistentes.map((nota) => (
                    <div key={nota.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium">{nota.criterio?.nome}</p>
                          <p className="text-xs text-muted-foreground">{nota.criterio?.descricao}</p>
                        </div>
                        <div className="flex gap-4">
                          {nota.nota_funcionario && (
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">Auto</p>
                              <div className="flex items-center gap-1">
                                <span className="font-bold">{nota.nota_funcionario}</span>
                                <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                              </div>
                            </div>
                          )}
                          {nota.nota_gestor && (
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">Gestor</p>
                              <div className="flex items-center gap-1">
                                <span className="font-bold">{nota.nota_gestor}</span>
                                <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      {(nota.comentario_funcionario || nota.comentario_gestor) && (
                        <div className="text-xs space-y-1">
                          {nota.comentario_funcionario && (
                            <p><span className="font-medium">Funcionário:</span> {nota.comentario_funcionario}</p>
                          )}
                          {nota.comentario_gestor && (
                            <p><span className="font-medium">Gestor:</span> {nota.comentario_gestor}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {avaliacao.observacoes && (
              <div>
                <h4 className="font-semibold mb-2">Observações</h4>
                <p className="text-sm text-muted-foreground">{avaliacao.observacoes}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Avaliar */}
      <Dialog open={showAvaliarDialog} onOpenChange={setShowAvaliarDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Avaliar Desempenho</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {criterios?.map((criterio) => (
              <div key={criterio.id} className="border rounded-lg p-4 space-y-3">
                <div>
                  <Label className="font-semibold">{criterio.nome}</Label>
                  {criterio.descricao && (
                    <p className="text-xs text-muted-foreground">{criterio.descricao}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Nota (1-10)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    placeholder="Digite a nota"
                    value={notas[criterio.id]?.nota || ""}
                    onChange={(e) => setNotas({
                      ...notas,
                      [criterio.id]: {
                        ...notas[criterio.id],
                        nota: parseInt(e.target.value),
                      },
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Comentário</Label>
                  <Textarea
                    placeholder="Adicione um comentário sobre este critério..."
                    value={notas[criterio.id]?.comentario || ""}
                    onChange={(e) => setNotas({
                      ...notas,
                      [criterio.id]: {
                        ...notas[criterio.id],
                        comentario: e.target.value,
                      },
                    })}
                  />
                </div>
              </div>
            ))}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowAvaliarDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAvaliar}>
                Concluir Avaliação
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta avaliação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              onDelete(avaliacao.id);
              setShowDeleteDialog(false);
            }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
