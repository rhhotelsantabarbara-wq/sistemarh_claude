import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileWarning, User, Calendar, Clock, CheckCircle2, Eye, Printer } from "lucide-react";
import { generateTacPDF } from "@/lib/pdfGeneratorTac";
import { dataBR } from "@/lib/date";

interface TacDetailsDialogProps {
  tac: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const tipoLabels: Record<string, string> = {
  advertencia_verbal: "Advertência Verbal",
  advertencia_escrita: "Advertência Escrita",
  suspensao: "Suspensão",
  compromisso: "Termo de Compromisso",
};

const statusColors: Record<string, string> = {
  pendente: "bg-warning text-warning-foreground",
  visualizado: "bg-primary text-primary-foreground",
  confirmado: "bg-secondary text-secondary-foreground",
};

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  visualizado: "Visualizado",
  confirmado: "Confirmado",
};

const TacDetailsDialog = ({ tac, open, onOpenChange }: TacDetailsDialogProps) => {
  if (!tac) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileWarning className="w-5 h-5 text-warning" />
            Detalhes do TAC
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Badge */}
          <div className="flex justify-between items-center">
            <Badge className={statusColors[tac.status]}>
              {statusLabels[tac.status]}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Publicado em {dataBR(tac.data_publicacao).toLocaleDateString("pt-BR")}
            </span>
          </div>

          {/* Employee Info */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Funcionário</span>
            </div>
            <p className="text-lg font-semibold">{tac.employees?.nome_completo}</p>
            <p className="text-sm text-muted-foreground">
              {tac.employees?.cargo}
              {tac.employees?.setor && ` • ${tac.employees.setor}`}
              {tac.employees?.empresas?.nome && ` • ${tac.employees.empresas.nome}`}
            </p>
          </div>

          <Separator />

          {/* TAC Info */}
          <div className="space-y-4">
            <div>
              <span className="text-sm text-muted-foreground">Tipo</span>
              <p className="font-medium">{tipoLabels[tac.tipo] || tac.tipo}</p>
            </div>

            <div>
              <span className="text-sm text-muted-foreground">Título</span>
              <p className="font-medium text-lg">{tac.titulo}</p>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Data da Ocorrência:</span>
              <span className="font-medium">
                {dataBR(tac.data_ocorrencia).toLocaleDateString("pt-BR")}
              </span>
            </div>
          </div>

          <Separator />

          {/* Description */}
          <div>
            <span className="text-sm text-muted-foreground block mb-2">Descrição do Termo</span>
            <div className="p-4 bg-muted rounded-lg whitespace-pre-wrap">
              {tac.descricao}
            </div>
          </div>

          {/* Observations */}
          {tac.observacoes && (
            <div>
              <span className="text-sm text-muted-foreground block mb-2">Observações</span>
              <div className="p-4 bg-muted rounded-lg whitespace-pre-wrap">
                {tac.observacoes}
              </div>
            </div>
          )}

          <Separator />

          {/* Timeline */}
          <div>
            <span className="text-sm text-muted-foreground block mb-3">Histórico de Status</span>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Publicado</p>
                  <p className="text-sm text-muted-foreground">
                    {dataBR(tac.data_publicacao).toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>

              {tac.lido_em && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Eye className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Visualizado pelo funcionário</p>
                    <p className="text-sm text-muted-foreground">
                      {dataBR(tac.lido_em).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
              )}

              {tac.confirmado_em && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-secondary" />
                  </div>
                  <div>
                    <p className="font-medium">Ciência confirmada</p>
                    <p className="text-sm text-muted-foreground">
                      {dataBR(tac.confirmado_em).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => generateTacPDF(tac)} className="w-full sm:w-auto">
            <Printer className="w-4 h-4 mr-2" />
            Imprimir TAC
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TacDetailsDialog;
