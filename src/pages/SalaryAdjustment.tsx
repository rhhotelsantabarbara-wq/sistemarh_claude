import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { dataBR } from "@/lib/date";

export default function SalaryAdjustment() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [adjustmentValue, setAdjustmentValue] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<"percentage" | "fixed">("percentage");
  const [justification, setJustification] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { data: employees, refetch: refetchEmployees } = useQuery({
    queryKey: ["employees-for-adjustment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, nome_completo, cargo, salario, setor")
        .in("status", ["ativo", "ferias"])
        .order("nome_completo");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: adjustmentHistory, refetch: refetchHistory } = useQuery({
    queryKey: ["salary-adjustment-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historico_reajustes_salariais")
        .select(`
          *,
          employee:employees(nome_completo, cargo),
          aplicador:profiles!historico_reajustes_salariais_aplicado_por_fkey(nome_completo)
        `)
        .order("aplicado_em", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const toggleEmployee = (employeeId: string) => {
    const newSelected = new Set(selectedEmployees);
    if (newSelected.has(employeeId)) {
      newSelected.delete(employeeId);
    } else {
      newSelected.add(employeeId);
    }
    setSelectedEmployees(newSelected);
  };

  const toggleAll = () => {
    if (selectedEmployees.size === employees?.length) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(employees?.map(e => e.id) || []));
    }
  };

  const calculateNewSalary = (currentSalary: number) => {
    const value = parseFloat(adjustmentValue);
    if (isNaN(value)) return currentSalary;
    
    if (adjustmentType === "percentage") {
      return currentSalary * (1 + value / 100);
    } else {
      return currentSalary + value;
    }
  };

  const applyAdjustment = async () => {
    if (selectedEmployees.size === 0) {
      toast({
        title: "Nenhum funcionário selecionado",
        description: "Selecione pelo menos um funcionário para aplicar o reajuste.",
        variant: "destructive",
      });
      return;
    }

    if (!adjustmentValue || parseFloat(adjustmentValue) === 0) {
      toast({
        title: "Valor inválido",
        description: "Informe um valor válido para o reajuste.",
        variant: "destructive",
      });
      return;
    }

    if (!justification.trim()) {
      toast({
        title: "Justificativa obrigatória",
        description: "Informe a justificativa para o reajuste.",
        variant: "destructive",
      });
      return;
    }

    setIsApplying(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const employeesToUpdate = employees?.filter(e => selectedEmployees.has(e.id)) || [];

      for (const employee of employeesToUpdate) {
        const oldSalary = employee.salario || 0;
        const newSalary = calculateNewSalary(oldSalary);
        const percentage = adjustmentType === "percentage" 
          ? parseFloat(adjustmentValue)
          : ((newSalary - oldSalary) / oldSalary) * 100;

        // Update employee salary
        const { error: updateError } = await supabase
          .from("employees")
          .update({ salario: newSalary })
          .eq("id", employee.id);

        if (updateError) throw updateError;

        // Insert adjustment history
        const { error: historyError } = await supabase
          .from("historico_reajustes_salariais")
          .insert({
            employee_id: employee.id,
            salario_anterior: oldSalary,
            salario_novo: newSalary,
            percentual_reajuste: percentage,
            justificativa: justification,
            aplicado_por: user?.id,
          });

        if (historyError) throw historyError;
      }

      toast({
        title: "Reajuste aplicado com sucesso",
        description: `${selectedEmployees.size} funcionário(s) atualizado(s).`,
      });

      // Reset form
      setSelectedEmployees(new Set());
      setAdjustmentValue("");
      setJustification("");
      refetchEmployees();
      refetchHistory();
    } catch (error) {
      console.error("Error applying adjustment:", error);
      toast({
        title: "Erro ao aplicar reajuste",
        description: "Ocorreu um erro ao processar o reajuste salarial.",
        variant: "destructive",
      });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="container mx-auto p-0 sm:p-2 lg:p-4">
      <Button
        variant="ghost"
        onClick={() => navigate("/dashboard")}
        className="mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Voltar
      </Button>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h1 className="text-3xl font-bold">Reajuste Salarial</h1>
        <Button onClick={() => setShowHistory(true)}>Ver Histórico Completo</Button>
      </div>

      <Tabs defaultValue="apply" className="space-y-6">
        <TabsList>
          <TabsTrigger value="apply">Aplicar Reajuste</TabsTrigger>
        </TabsList>

        <TabsContent value="apply" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Configuração do Reajuste</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <Label>Tipo de Reajuste</Label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={adjustmentType === "percentage"}
                      onChange={() => setAdjustmentType("percentage")}
                    />
                    Percentual (%)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={adjustmentType === "fixed"}
                      onChange={() => setAdjustmentType("fixed")}
                    />
                    Valor Fixo (R$)
                  </label>
                </div>
              </div>

              <div>
                <Label>Valor do Reajuste</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={adjustmentValue}
                  onChange={(e) => setAdjustmentValue(e.target.value)}
                  placeholder={adjustmentType === "percentage" ? "Ex: 10" : "Ex: 500"}
                />
              </div>

              <div className="md:col-span-3">
                <Label>Justificativa do Reajuste *</Label>
                <Textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Descreva o motivo do reajuste salarial..."
                  rows={3}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 sm:gap-4 mb-4">
              <Button variant="outline" onClick={toggleAll}>
                {selectedEmployees.size === employees?.length ? "Desmarcar Todos" : "Selecionar Todos"}
              </Button>
              <Button onClick={applyAdjustment} disabled={isApplying}>
                {isApplying ? "Aplicando..." : `Aplicar Reajuste (${selectedEmployees.size} selecionado(s))`}
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedEmployees.size === employees?.length && employees?.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Salário Atual</TableHead>
                    <TableHead>Novo Salário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees?.map((employee) => {
                    const isSelected = selectedEmployees.has(employee.id);
                    const newSalary = isSelected ? calculateNewSalary(employee.salario || 0) : employee.salario;
                    
                    return (
                      <TableRow key={employee.id}>
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleEmployee(employee.id)}
                          />
                        </TableCell>
                        <TableCell>{employee.nome_completo}</TableCell>
                        <TableCell>{employee.cargo}</TableCell>
                        <TableCell>{employee.setor || "-"}</TableCell>
                        <TableCell>
                          R$ {(employee.salario || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className={isSelected ? "font-bold text-green-600" : ""}>
                          R$ {(newSalary || 0).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico Completo de Reajustes</DialogTitle>
          </DialogHeader>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Funcionário</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Salário Anterior</TableHead>
                <TableHead>Salário Novo</TableHead>
                <TableHead>Reajuste (%)</TableHead>
                <TableHead>Justificativa</TableHead>
                <TableHead>Aplicado Por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjustmentHistory?.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    {format(dataBR(record.aplicado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>{record.employee?.nome_completo}</TableCell>
                  <TableCell>{record.employee?.cargo}</TableCell>
                  <TableCell>R$ {record.salario_anterior.toFixed(2)}</TableCell>
                  <TableCell>R$ {record.salario_novo.toFixed(2)}</TableCell>
                  <TableCell>{record.percentual_reajuste?.toFixed(2)}%</TableCell>
                  <TableCell className="max-w-xs truncate" title={record.justificativa}>
                    {record.justificativa}
                  </TableCell>
                  <TableCell>{record.aplicador?.nome_completo}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
