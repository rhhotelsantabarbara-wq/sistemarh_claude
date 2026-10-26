import { useState } from "react";
import { todayISO, dataBR } from "@/lib/date";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Edit, Trash2, CheckCircle2, Download } from "lucide-react";
import { EncaminhamentoForm } from "./EncaminhamentoForm";
import { generateEncaminhamentoPDF } from "@/lib/pdfGeneratorEncaminhamento";

interface EncaminhamentoCardProps {
  encaminhamento: any;
  onRefresh: () => void;
}

export const EncaminhamentoCard = ({ encaminhamento, onRefresh }: EncaminhamentoCardProps) => {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRealizadoDialog, setShowRealizadoDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const statusColors = {
    pendente: "bg-yellow-500",
    agendado: "bg-orange-500",
    realizado: "bg-green-500",
    cancelado: "bg-gray-500",
  };

  const statusLabels = {
    pendente: "Pendente",
    agendado: "Agendado",
    realizado: "Realizado",
    cancelado: "Cancelado",
  };

  const tipoLabels = {
    admissional: "Admissional",
    demissional: "Demissional",
    periodico: "Periódico",
    mudanca_riscos: "Mudança de Riscos",
    retorno_trabalho: "Retorno ao Trabalho",
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("encaminhamentos_medicos")
        .delete()
        .eq("id", encaminhamento.id);

      if (error) throw error;

      toast.success("Encaminhamento excluído com sucesso");
      setShowDeleteDialog(false);
      onRefresh();
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
      toast.error(error.message || "Erro ao excluir encaminhamento");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMarcarRealizado = async () => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("encaminhamentos_medicos")
        .update({
          status: "realizado",
          data_realizacao: todayISO(),
        })
        .eq("id", encaminhamento.id);

      if (error) throw error;

      toast.success("Encaminhamento marcado como realizado");
      setShowRealizadoDialog(false);
      onRefresh();
    } catch (error: any) {
      console.error("Erro ao atualizar:", error);
      toast.error(error.message || "Erro ao atualizar encaminhamento");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleGerarPDF = async () => {
    try {
      // Buscar dados completos incluindo logo
      const { data: encData, error } = await supabase
        .from("encaminhamentos_medicos")
        .select(`
          *,
          employees(*),
          empresas(nome, cnpj, endereco, logo_url)
        `)
        .eq("id", encaminhamento.id)
        .single();

      if (error) throw error;

      await generateEncaminhamentoPDF(encData);
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF");
    }
  };

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold">{encaminhamento.employees?.nome_completo}</h3>
                <Badge className={statusColors[encaminhamento.status as keyof typeof statusColors]}>
                  {statusLabels[encaminhamento.status as keyof typeof statusLabels]}
                </Badge>
                <Badge variant="outline">
                  {tipoLabels[encaminhamento.tipo_exame as keyof typeof tipoLabels]}
                </Badge>
              </div>
              
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Função: {encaminhamento.funcao}</p>
                <p>Setor: {encaminhamento.setor}</p>
                <p>Empresa: {encaminhamento.empresas?.nome}</p>
                {encaminhamento.data_agendamento && (
                  <p>
                    Data Agendada:{" "}
                    {format(dataBR(encaminhamento.data_agendamento), "dd/MM/yyyy", {
                      locale: ptBR,
                    })}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={handleGerarPDF}>
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
              
              {encaminhamento.status !== "realizado" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowRealizadoDialog(true)}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Realizado
                </Button>
              )}
              
              <Button size="sm" variant="outline" onClick={() => setShowEditDialog(true)}>
                <Edit className="w-4 h-4" />
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Edição */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Encaminhamento</DialogTitle>
          </DialogHeader>
          <EncaminhamentoForm
            encaminhamentoId={encaminhamento.id}
            onSaved={() => {
              setShowEditDialog(false);
              onRefresh();
            }}
            onCancel={() => setShowEditDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este encaminhamento de{" "}
              <strong>{encaminhamento.employees?.nome_completo}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Confirmação - Marcar como Realizado */}
      <AlertDialog open={showRealizadoDialog} onOpenChange={setShowRealizadoDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como Realizado</AlertDialogTitle>
            <AlertDialogDescription>
              Confirma que o exame de <strong>{encaminhamento.employees?.nome_completo}</strong>{" "}
              foi realizado?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarcarRealizado} disabled={isUpdating}>
              {isUpdating ? "Atualizando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
