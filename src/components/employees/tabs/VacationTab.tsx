import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Calendar, Check, Pencil, Trash2 } from "lucide-react";
import VacationForm from "@/components/forms/VacationForm";
import EditVacationDialog from "@/components/forms/EditVacationDialog";
import { VacationProgress } from "@/components/ui/vacation-progress";
import { toast } from "sonner";
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
import { dataBR } from "@/lib/date";

interface VacationTabProps {
  employeeId: string;
  isManager?: boolean;
}

const VacationTab = ({ employeeId, isManager = false }: VacationTabProps) => {
  const [ferias, setFerias] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingVacation, setEditingVacation] = useState<any>(null);
  const [deletingVacationId, setDeletingVacationId] = useState<string | null>(null);

  useEffect(() => {
    fetchFerias();
  }, [employeeId]);

  const fetchFerias = async () => {
    const { data } = await supabase
      .from("ferias")
      .select("*")
      .eq("employee_id", employeeId)
      .order("periodo_gozo_inicio", { ascending: false });

    setFerias(data || []);
  };

  const handleSaved = () => {
    setShowForm(false);
    fetchFerias();
  };

  const handleConfirmReturn = async (feriaId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Update vacation record
    const { error: feriaError } = await supabase
      .from("ferias")
      .update({
        data_retorno_confirmada: true,
        confirmado_por: user.id,
        data_confirmacao: new Date().toISOString(),
      })
      .eq("id", feriaId);

    if (feriaError) {
      toast.error("Erro ao confirmar retorno");
      return;
    }

    // Update employee status back to "ativo"
    const { error: statusError } = await supabase
      .from("employees")
      .update({ status: "ativo" })
      .eq("id", employeeId);

    if (statusError) {
      toast.error("Retorno confirmado, mas erro ao atualizar status");
    } else {
      toast.success("Retorno confirmado e status atualizado!");
    }
    
    fetchFerias();
  };

  const handleDeleteVacation = async () => {
    if (!deletingVacationId) return;

    const { error } = await supabase
      .from("ferias")
      .delete()
      .eq("id", deletingVacationId);

    if (error) {
      toast.error("Erro ao excluir férias");
    } else {
      toast.success("Férias excluídas!");
      fetchFerias();
    }
    
    setDeletingVacationId(null);
  };

  const calculateProgress = (inicio: string, fim: string, diasTotais: number) => {
    const startDate = dataBR(inicio);
    const endDate = dataBR(fim);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const daysPassed = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = diasTotais - daysPassed;
    
    const progress = Math.min(100, Math.max(0, (daysPassed / diasTotais) * 100));
    
    // Calcular dias de férias normais vs dias de folgas
    const realVacationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const timeOffDays = diasTotais - realVacationDays;
    
    return { progress, daysRemaining: Math.max(0, daysRemaining), totalDays: diasTotais, vacationDays: realVacationDays, timeOffDays };
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Férias</h3>
        {isManager && (
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4 mr-2" />
            Registrar Férias
          </Button>
        )}
      </div>

      {showForm && isManager && (
        <VacationForm
          employeeId={employeeId}
          onSaved={handleSaved}
          onCancel={() => setShowForm(false)}
        />
      )}

      {ferias.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma féria registrada
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {ferias.map((feria) => {
            const { progress, daysRemaining, totalDays, vacationDays, timeOffDays } = calculateProgress(
              feria.periodo_gozo_inicio,
              feria.periodo_gozo_fim,
              feria.dias_totais
            );
            const isOngoing = daysRemaining > 0 && progress > 0;
            const isFinished = daysRemaining === 0 && !feria.data_retorno_confirmada;

            return (
              <Card key={feria.id}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Férias - {feria.dias_totais} dias
                    </div>
                    {feria.data_retorno_confirmada && (
                      <div className="flex items-center gap-1 text-sm text-green-600">
                        <Check className="w-4 h-4" />
                        Retorno confirmado
                      </div>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Data de Início</p>
                      <p className="font-medium">
                        {dataBR(feria.periodo_gozo_inicio).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Data de Retorno</p>
                      <p className="font-medium">
                        {dataBR(feria.periodo_gozo_fim).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>

                  {isOngoing && !feria.data_retorno_confirmada && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progresso das férias</span>
                        <span className="font-medium">
                          {daysRemaining} {daysRemaining === 1 ? 'dia restante' : 'dias restantes'}
                        </span>
                      </div>
                      <VacationProgress 
                        totalDays={totalDays}
                        daysPassed={totalDays - daysRemaining}
                        vacationDays={vacationDays}
                        timeOffDays={timeOffDays}
                      />
                      {timeOffDays > 0 && (
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-full bg-secondary" />
                            <span>Férias ({vacationDays} dias)</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-full bg-warning" />
                            <span>Folgas ({timeOffDays} dias)</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {isFinished && isManager && (
                    <Button
                      onClick={() => handleConfirmReturn(feria.id)}
                      className="w-full"
                      variant="default"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Confirmar Retorno
                    </Button>
                  )}

                  {isManager && (
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        onClick={() => setEditingVacation(feria)}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Editar
                      </Button>
                      <Button
                        onClick={() => setDeletingVacationId(feria.id)}
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {editingVacation && (
        <EditVacationDialog
          vacation={editingVacation}
          open={!!editingVacation}
          onOpenChange={(open) => !open && setEditingVacation(null)}
          onUpdated={fetchFerias}
        />
      )}

      <AlertDialog open={!!deletingVacationId} onOpenChange={(open) => !open && setDeletingVacationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este registro de férias? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteVacation}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VacationTab;
