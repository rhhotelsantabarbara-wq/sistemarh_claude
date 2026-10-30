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
import { ArrowLeft, Edit, Loader2, Trash2, RotateCcw, Eye } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import DependentesTab from "@/components/employees/tabs/DependentesTab";

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
    <div>
      <div className="space-y-5">
        <button type="button" onClick={() => navigate("/dashboard#funcionarios")} className="-ml-1 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Colaboradores
        </button>

        <div className="flex flex-col gap-5 rounded-lg border-l-4 border-l-primary bg-card p-5 shadow-[0_1px_2px_rgba(20,24,40,0.06)] lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative shrink-0">
              <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
                <AvatarImage src={employee.foto_url || undefined} alt="" className="object-cover" />
                <AvatarFallback className="bg-muted text-lg font-bold text-muted-foreground">
                  {String(employee.nome_completo || "").split(" ").filter(Boolean).map((p: string, i: number, a: string[]) => (i === 0 || i === a.length - 1 ? p[0] : "")).join("").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className={`absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${employee.status === "ativo" ? "bg-emerald-500" : "bg-slate-300"}`} />
            </div>
            <div className="min-w-0 space-y-1.5">
              <h1 className="break-words text-xl font-medium leading-tight sm:text-2xl">{employee.nome_completo}</h1>
              <p className="text-sm text-muted-foreground">{[employee.cargo, employee.setor].filter(Boolean).join(" · ")}</p>
              <div className="flex flex-wrap gap-1.5">
                <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] ${({ ativo: "bg-emerald-50 text-emerald-700", ferias: "bg-sky-50 text-sky-700", afastado: "bg-rose-50 text-rose-700", em_admissao: "bg-amber-50 text-amber-800", demitido: "bg-slate-100 text-slate-600" } as Record<string, string>)[employee.status] || "bg-muted text-muted-foreground"}`}>
                  {({ ativo: "Ativo", ferias: "Férias", afastado: "Afastado", em_admissao: "Em admissão", demitido: "Desligado" } as Record<string, string>)[employee.status] || employee.status}
                </span>
                {employee.codigo_funcionario && <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">Cód. {employee.codigo_funcionario}</span>}
                {employee.data_admissao && <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">Desde {String(employee.data_admissao).split("-").reverse().join("/")}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {employee.status === "demitido" && (
              <Button variant="outline" size="sm" onClick={() => setShowReadmitDialog(true)}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Readmitir
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate(`/ver-como/${employee.id}`)}>
              <Eye className="w-4 h-4 mr-2" />
              Ver portal
            </Button>
            <GenerateContractButton employee={employee} />
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
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
                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={deleting}>
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

        <Tabs defaultValue="epis" className="mt-2">
          <TabsList className="inline-flex w-full overflow-x-auto justify-start tabs-scroll">
            <TabsTrigger value="epis" className="flex-shrink-0">EPIs</TabsTrigger>
            <TabsTrigger value="uniformes" className="flex-shrink-0">Uniformes</TabsTrigger>
            <TabsTrigger value="ferias" className="flex-shrink-0">Férias</TabsTrigger>
            <TabsTrigger value="afastamentos" className="flex-shrink-0">Afastamentos</TabsTrigger>
            <TabsTrigger value="folgas" className="flex-shrink-0">Folgas</TabsTrigger>
            <TabsTrigger value="faltas" className="flex-shrink-0">Faltas</TabsTrigger>
            <TabsTrigger value="arquivos" className="flex-shrink-0">Documentos</TabsTrigger>
            <TabsTrigger value="dependentes" className="flex-shrink-0">Dependentes</TabsTrigger>
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

          <TabsContent value="dependentes">
            <DependentesTab employeeId={id!} />
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
