import { useState, useEffect } from "react";
import { parseDateOnly, dataBR } from "@/lib/date";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Eye, CheckCircle2, Clock, AlertTriangle, Trash2 } from "lucide-react";
import { ChecklistExecucao } from "./ChecklistExecucao";
import { NovoChecklistDialog } from "./NovoChecklistDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface ChecklistsEmAndamentoProps {
  tipo: "admissao" | "desligamento";
}

export function ChecklistsEmAndamento({ tipo }: ChecklistsEmAndamentoProps) {
  const [checklists, setChecklists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChecklist, setSelectedChecklist] = useState<any>(null);
  const [showNovoDialog, setShowNovoDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleDelete = async (checklistId: string) => {
    try {
      // First delete all items
      const { error: itemsError } = await supabase
        .from("plano_checklist_funcionario_itens")
        .delete()
        .eq("checklist_funcionario_id", checklistId);

      if (itemsError) throw itemsError;

      // Then delete the checklist
      const { error } = await supabase
        .from("plano_checklist_funcionario")
        .delete()
        .eq("id", checklistId);

      if (error) throw error;

      toast({
        title: "Processo excluído",
        description: "O processo foi removido com sucesso.",
      });
      fetchChecklists();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir processo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const fetchChecklists = async () => {
    try {
      const { data, error } = await supabase
        .from("plano_checklist_funcionario")
        .select(`
          *,
          employee:employees(id, nome_completo, cargo, setor, foto_url),
          template:plano_checklist_templates(nome),
          itens:plano_checklist_funcionario_itens(id, concluido, obrigatorio, prazo_dias)
        `)
        .eq("tipo", tipo)
        .eq("status", "em_andamento")
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
  }, [tipo]);

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

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">
          {tipo === "admissao" ? "Admissões" : "Desligamentos"} em Andamento ({checklists.length})
        </h2>
        <Button onClick={() => setShowNovoDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo {tipo === "admissao" ? "Onboarding" : "Offboarding"}
        </Button>
      </div>

      {checklists.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum {tipo === "admissao" ? "processo de admissão" : "processo de desligamento"} em andamento.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {checklists.map((checklist) => {
            const progresso = calcularProgresso(checklist.itens);
            const atrasados = contarItensAtrasados(checklist);
            const diasDesdeInicio = differenceInDays(new Date(), (parseDateOnly(checklist.data_inicio) ?? new Date()));

            return (
              <Card key={checklist.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        {checklist.employee?.foto_url ? (
                          <img
                            src={checklist.employee.foto_url}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-lg font-bold text-primary">
                            {checklist.employee?.nome_completo?.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {checklist.employee?.nome_completo}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {checklist.employee?.cargo}
                        </p>
                      </div>
                    </div>
                    {atrasados > 0 && (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {atrasados}
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
                      <span>Há {diasDesdeInicio} dias</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span>
                        {checklist.itens?.filter((i: any) => i.concluido).length || 0}/
                        {checklist.itens?.length || 0}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Início: {format((parseDateOnly(checklist.data_inicio) ?? new Date()), "dd/MM/yyyy", { locale: ptBR })}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setSelectedChecklist(checklist)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Ver Checklist
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir processo?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. O processo de {tipo === "admissao" ? "admissão" : "desligamento"} de {checklist.employee?.nome_completo} será removido permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(checklist.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
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
              Checklist de {tipo === "admissao" ? "Admissão" : "Desligamento"} -{" "}
              {selectedChecklist?.employee?.nome_completo}
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
        tipo={tipo}
        onCreated={() => {
          setShowNovoDialog(false);
          fetchChecklists();
        }}
      />
    </div>
  );
}
