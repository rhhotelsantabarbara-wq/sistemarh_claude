import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Edit, Loader2, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import EmployeeInfo from "@/components/employees/EmployeeInfo";
import EmployeeForm from "@/components/forms/EmployeeForm";
import { GenerateContractButton } from "@/components/contracts/GenerateContractButton";
import EpiTab from "@/components/employees/tabs/EpiTab";
import UniformTab from "@/components/employees/tabs/UniformTab";
import VacationTab from "@/components/employees/tabs/VacationTab";
import AbsenceTab from "@/components/employees/tabs/AbsenceTab";
import FaultTab from "@/components/employees/tabs/FaultTab";
import TimeOffTab from "@/components/employees/tabs/TimeOffTab";
import FilesTab from "@/components/employees/tabs/FilesTab";
import { SalaryHistoryTab } from "@/components/employees/tabs/SalaryHistoryTab";
import ExamesMedicosTab from "@/components/employees/tabs/ExamesMedicosTab";
import AvaliacoesTab from "@/components/employees/tabs/AvaliacoesTab";
import { ChecklistTab } from "@/components/employees/tabs/ChecklistTab";
import { VariaveisFixasTab } from "@/components/employees/tabs/VariaveisFixasTab";
import ReadmitDialog from "@/components/employees/ReadmitDialog";
import { HoleritesTab } from "@/components/employees/tabs/HoleritesTab";
import HistoricoTimelineTab from "@/components/employees/tabs/HistoricoTimelineTab";

const EmployeeDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showReadmitDialog, setShowReadmitDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchEmployee();
    }
  }, [id]);

  const fetchEmployee = async () => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setEmployee(data);
    } catch (error) {
      console.error("Error fetching employee:", error);
      toast.error("Erro ao carregar funcionário");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // Se tiver user_id, exclui o usuário de autenticação (que por cascade exclui o employee)
      if (employee?.user_id) {
        const { error } = await supabase.functions.invoke('delete-user', {
          body: { user_id: employee.user_id }
        });

        if (error) throw error;
      } else {
        // Se não tiver user_id, exclui diretamente o registro do funcionário
        const { error } = await supabase
          .from("employees")
          .delete()
          .eq("id", employee.id);

        if (error) throw error;
      }

      toast.success("Funcionário excluído com sucesso!");
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Erro ao excluir funcionário:", error);
      toast.error(error.message || "Erro ao excluir funcionário");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Funcionário não encontrado</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div className="flex flex-wrap gap-2">
            {employee.status === "demitido" && (
              <Button variant="outline" onClick={() => setShowReadmitDialog(true)}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Readmitir
              </Button>
            )}
            <GenerateContractButton employee={employee} />
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Editar Funcionário</DialogTitle>
              </DialogHeader>
              <EmployeeForm
                employeeId={id}
                initialData={employee}
                onSaved={() => {
                  setShowEditDialog(false);
                  fetchEmployee();
                }}
                onCancel={() => setShowEditDialog(false)}
              />
            </DialogContent>
          </Dialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deleting}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deleting ? "Excluindo..." : "Excluir"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja excluir o funcionário <strong>{employee.nome_completo}</strong>?
                    Esta ação não pode ser desfeita e todos os dados relacionados serão removidos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <EmployeeInfo employee={employee} onUpdate={fetchEmployee} />

        <Tabs defaultValue="epis" className="mt-6">
          <TabsList className="inline-flex w-full overflow-x-auto justify-start tabs-scroll">
            <TabsTrigger value="epis" className="flex-shrink-0">EPIs</TabsTrigger>
            <TabsTrigger value="uniformes" className="flex-shrink-0">Uniformes</TabsTrigger>
            <TabsTrigger value="ferias" className="flex-shrink-0">Férias</TabsTrigger>
            <TabsTrigger value="afastamentos" className="flex-shrink-0">Afastamentos</TabsTrigger>
            <TabsTrigger value="folgas" className="flex-shrink-0">Folgas</TabsTrigger>
            <TabsTrigger value="faltas" className="flex-shrink-0">Faltas</TabsTrigger>
            <TabsTrigger value="arquivos" className="flex-shrink-0">Arquivos</TabsTrigger>
            <TabsTrigger value="reajustes" className="flex-shrink-0">Histórico Salarial</TabsTrigger>
            <TabsTrigger value="holerites" className="flex-shrink-0">Holerites</TabsTrigger>
            <TabsTrigger value="variaveis" className="flex-shrink-0">Variáveis Fixas</TabsTrigger>
            <TabsTrigger value="exames" className="flex-shrink-0">Exames Médicos</TabsTrigger>
            <TabsTrigger value="avaliacoes" className="flex-shrink-0">Avaliações</TabsTrigger>
            <TabsTrigger value="checklist" className="flex-shrink-0">Checklist</TabsTrigger>
            <TabsTrigger value="historico" className="flex-shrink-0">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="epis">
            <EpiTab employeeId={id!} />
          </TabsContent>

          <TabsContent value="uniformes">
            <UniformTab employeeId={id!} />
          </TabsContent>

          <TabsContent value="ferias">
            <VacationTab employeeId={id!} isManager={true} />
          </TabsContent>

          <TabsContent value="afastamentos">
            <AbsenceTab employeeId={id!} />
          </TabsContent>

          <TabsContent value="folgas">
            <TimeOffTab employeeId={id!} />
          </TabsContent>

          <TabsContent value="faltas">
            <FaultTab employeeId={id!} />
          </TabsContent>

          <TabsContent value="arquivos">
            <FilesTab employeeId={id!} />
          </TabsContent>

          <TabsContent value="reajustes">
            <SalaryHistoryTab employeeId={id!} />
          </TabsContent>

          <TabsContent value="holerites">
            <HoleritesTab employeeId={id!} />
          </TabsContent>

          <TabsContent value="variaveis">
            <VariaveisFixasTab employeeId={id!} />
          </TabsContent>

          <TabsContent value="exames">
            <ExamesMedicosTab employeeId={id!} />
          </TabsContent>

          <TabsContent value="avaliacoes">
            <AvaliacoesTab employeeId={id!} />
          </TabsContent>

          <TabsContent value="checklist">
            <ChecklistTab employeeId={id!} isManager={true} />
          </TabsContent>

          <TabsContent value="historico">
            <HistoricoTimelineTab employeeId={id!} employee={employee} />
          </TabsContent>
        </Tabs>

        <ReadmitDialog
          open={showReadmitDialog}
          onOpenChange={setShowReadmitDialog}
          employee={employee}
          onSuccess={fetchEmployee}
        />
      </div>
    </div>
  );
};

export default EmployeeDetails;
