import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { FileWarning, Eye, CheckCircle2, AlertTriangle, Calendar } from "lucide-react";
import { toast } from "sonner";
import { dataBR } from "@/lib/date";

interface TacCardProps {
  employeeId: string;
}

const tipoLabels: Record<string, string> = {
  advertencia_verbal: "Advertência Verbal",
  advertencia_escrita: "Advertência Escrita",
  suspensao: "Suspensão",
  compromisso: "Termo de Compromisso",
};

const TacCard = ({ employeeId }: TacCardProps) => {
  const [tacs, setTacs] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [selectedTac, setSelectedTac] = useState<any>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTacs();
  }, [employeeId]);

  const fetchTacs = async () => {
    const { data, error } = await supabase
      .from("tacs")
      .select("*")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching TACs:", error);
    } else {
      setTacs(data || []);
      setPendingCount(data?.filter((t) => t.status === "pendente").length || 0);
    }
  };

  const handleViewTac = async (tac: any) => {
    setSelectedTac(tac);
    setShowDialog(true);

    // Mark as viewed if pending
    if (tac.status === "pendente") {
      await supabase
        .from("tacs")
        .update({
          status: "visualizado",
          lido_em: new Date().toISOString(),
        })
        .eq("id", tac.id);
      
      fetchTacs();
    }
  };

  const handleConfirmTac = async () => {
    if (!selectedTac) return;

    setLoading(true);
    const { error } = await supabase
      .from("tacs")
      .update({
        status: "confirmado",
        confirmado_em: new Date().toISOString(),
      })
      .eq("id", selectedTac.id);

    if (error) {
      toast.error("Erro ao confirmar ciência");
    } else {
      toast.success("Ciência confirmada com sucesso");
      setShowDialog(false);
      fetchTacs();
    }
    setLoading(false);
  };

  if (tacs.length === 0) return null;

  return (
    <>
      {/* Alert for pending TACs */}
      {pendingCount > 0 && (
        <Alert className="border-warning bg-warning/10">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <AlertTitle className="font-semibold">Atenção!</AlertTitle>
          <AlertDescription>
            Você tem {pendingCount} TAC{pendingCount > 1 ? "s" : ""} pendente{pendingCount > 1 ? "s" : ""} de visualização.
          </AlertDescription>
        </Alert>
      )}

      {/* TAC List Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileWarning className="w-5 h-5 text-warning" />
            Meus TACs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tacs.map((tac) => (
            <div
              key={tac.id}
              className={`p-4 rounded-lg border ${
                tac.status === "pendente"
                  ? "border-warning bg-warning/5"
                  : tac.status === "visualizado"
                  ? "border-primary bg-primary/5"
                  : "border-border bg-muted"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-medium">{tac.titulo}</p>
                  <p className="text-sm text-muted-foreground">
                    {tipoLabels[tac.tipo] || tac.tipo}
                  </p>
                </div>
                <Badge
                  variant={
                    tac.status === "pendente"
                      ? "outline"
                      : tac.status === "visualizado"
                      ? "default"
                      : "secondary"
                  }
                  className={
                    tac.status === "pendente"
                      ? "border-warning text-warning"
                      : ""
                  }
                >
                  {tac.status === "pendente"
                    ? "Pendente"
                    : tac.status === "visualizado"
                    ? "Visualizado"
                    : "Confirmado"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {dataBR(tac.data_publicacao).toLocaleDateString("pt-BR")}
                </span>
                <Button
                  variant={tac.status === "pendente" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleViewTac(tac)}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  {tac.status === "pendente" ? "Visualizar" : "Ver Detalhes"}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* TAC Details Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileWarning className="w-5 h-5 text-warning" />
              {selectedTac?.titulo}
            </DialogTitle>
          </DialogHeader>

          {selectedTac && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">
                  {tipoLabels[selectedTac.tipo] || selectedTac.tipo}
                </Badge>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Data da ocorrência: {dataBR(selectedTac.data_ocorrencia).toLocaleDateString("pt-BR")}
                </div>
              </div>

              <Separator />

              <div>
                <span className="text-sm font-medium block mb-2">Descrição do Termo</span>
                <div className="p-4 bg-muted rounded-lg whitespace-pre-wrap text-sm">
                  {selectedTac.descricao}
                </div>
              </div>

              {selectedTac.observacoes && (
                <div>
                  <span className="text-sm font-medium block mb-2">Observações</span>
                  <div className="p-4 bg-muted rounded-lg whitespace-pre-wrap text-sm">
                    {selectedTac.observacoes}
                  </div>
                </div>
              )}

              {selectedTac.status !== "confirmado" && (
                <>
                  <Separator />
                  <p className="text-sm text-muted-foreground text-center">
                    Ao clicar em "Confirmar Ciência", você declara que leu e compreendeu o conteúdo deste termo.
                  </p>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedTac?.status !== "confirmado" ? (
              <Button onClick={handleConfirmTac} disabled={loading}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {loading ? "Confirmando..." : "Confirmar Ciência"}
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-secondary">
                <CheckCircle2 className="w-5 h-5" />
                <span>Ciência confirmada em {dataBR(selectedTac.confirmado_em).toLocaleDateString("pt-BR")}</span>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TacCard;
