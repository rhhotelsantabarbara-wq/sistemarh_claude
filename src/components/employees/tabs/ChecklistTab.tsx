import { useState, useEffect } from "react";
import { parseDateOnly, dataBR } from "@/lib/date";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Eye, CheckCircle2, Clock, AlertTriangle, ClipboardList } from "lucide-react";
import { ChecklistExecucao } from "@/components/plano-checklist/ChecklistExecucao";
import { NovoChecklistDialog } from "@/components/plano-checklist/NovoChecklistDialog";

interface ChecklistTabProps {
  employeeId: string;
  isManager?: boolean;
}

export function ChecklistTab({ employeeId, isManager = false }: ChecklistTabProps) {
  const [checklists, setChecklists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChecklist, setSelectedChecklist] = useState<any>(null);
  const [showNovoDialog, setShowNovoDialog] = useState(false);
  const [novoTipo, setNovoTipo] = useState<"admissao" | "desligamento">("admissao");
  const { toast } = useToast();

  const fetchChecklists = async () => {
    try {
      const { data, error } = await supabase
        .from("plano_checklist_funcionario")
        .select(`
          *,
          template:plano_checklist_templates(nome),
          itens:plano_checklist_funcionario_itens(id, concluido, obrigatorio, prazo_dias)
        `)
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setChecklists(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar checklists",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChecklists();
  }, [employeeId]);

  const calcularProgresso = (itens: any[]) => {
    if (!itens || itens.length === 0) return 0;
    const concluidos = itens.filter((i) => i.concluido).length;
    return Math.round((concluidos / itens.length) * 100);
  };

  const contarItensAtrasados = (checklist: any) => {
    if (!checklist.itens) return 0;
    const dataInicio = (parseDateOnly(checklist.data_inicio) ?? new Date());
    return checklist.itens.filter((item: any) => {
      if (item.concluido || !item.prazo_dias) return false;
      const prazoData = dataBR(dataInicio);
      prazoData.setDate(prazoData.getDate() + item.prazo_dias);
      return new Date() > prazoData;
    }).length;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "em_andamento":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Em Andamento</Badge>;
      case "concluido":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Concluído</Badge>;
      case "cancelado":
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Cancelado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      {isManager && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setNovoTipo("admissao");
              setShowNovoDialog(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Iniciar Admissão
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setNovoTipo("desligamento");
              setShowNovoDialog(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Iniciar Desligamento
          </Button>
        </div>
      )}

      {checklists.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum processo de admissão ou desligamento registrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {checklists.map((checklist) => {
            const progresso = calcularProgresso(checklist.itens);
            const atrasados = contarItensAtrasados(checklist);

            return (
              <Card key={checklist.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {checklist.tipo === "admissao" ? "Admissão" : "Desligamento"}
                        {getStatusBadge(checklist.status)}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {checklist.template?.nome || "Template personalizado"}
                      </p>
                    </div>
                    {atrasados > 0 && checklist.status === "em_andamento" && (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {atrasados} atrasados
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="font-medium">{progresso}%</span>
                    </div>
                    <Progress value={progresso} className="h-2" />
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>
                        Início: {format((parseDateOnly(checklist.data_inicio) ?? new Date()), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span>
                        {checklist.itens?.filter((i: any) => i.concluido).length || 0}/
                        {checklist.itens?.length || 0}
                      </span>
                    </div>
                  </div>

                  {checklist.data_conclusao && (
                    <p className="text-xs text-muted-foreground">
                      Concluído em: {format(dataBR(checklist.data_conclusao), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  )}

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setSelectedChecklist(checklist)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    {checklist.status === "em_andamento" && isManager ? "Gerenciar" : "Visualizar"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedChecklist} onOpenChange={() => setSelectedChecklist(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Checklist de {selectedChecklist?.tipo === "admissao" ? "Admissão" : "Desligamento"}
            </DialogTitle>
          </DialogHeader>
          {selectedChecklist && (
            <ChecklistExecucao
              checklistId={selectedChecklist.id}
              onUpdate={() => {
                fetchChecklists();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <NovoChecklistDialog
        open={showNovoDialog}
        onOpenChange={setShowNovoDialog}
        tipo={novoTipo}
        onCreated={() => {
          setShowNovoDialog(false);
          fetchChecklists();
        }}
      />
    </div>
  );
}
