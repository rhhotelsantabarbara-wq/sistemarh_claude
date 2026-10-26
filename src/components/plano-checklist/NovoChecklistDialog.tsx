import { useState, useEffect } from "react";
import { parseDateOnly, dataBR } from "@/lib/date";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { differenceInYears, addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileDown, Calculator, Landmark } from "lucide-react";
import { gerarCartaDemissao, gerarPedidoDemissao } from "@/lib/pdfGeneratorDesligamento";
import { gerarSolicitacaoContaSalario } from "@/lib/pdfGeneratorContaSalario";

interface NovoChecklistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: "admissao" | "desligamento";
  onCreated: () => void;
  preSelectedEmployeeId?: string;
}

export function NovoChecklistDialog({
  open,
  onOpenChange,
  tipo,
  onCreated,
  preSelectedEmployeeId,
}: NovoChecklistDialogProps) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState(preSelectedEmployeeId || "");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Campos específicos de desligamento
  const [tipoDesligamento, setTipoDesligamento] = useState<"pedido_demissao" | "dispensa_empresa">("dispensa_empresa");
  const [motivoDesligamento, setMotivoDesligamento] = useState("");
  const [avisoTipo, setAvisoTipo] = useState<"trabalhado" | "indenizado">("trabalhado");
  const [observacoes, setObservacoes] = useState("");
  const [diasAviso, setDiasAviso] = useState(30);
  const [dataFimAviso, setDataFimAviso] = useState<Date | null>(null);
  const [selectedEmployeeData, setSelectedEmployeeData] = useState<any>(null);
  const [empresa, setEmpresa] = useState<any>(null);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, tipo]);

  useEffect(() => {
    if (selectedEmployee) {
      const emp = employees.find(e => e.id === selectedEmployee);
      setSelectedEmployeeData(emp);
      
      if (tipo === "desligamento" && emp?.data_admissao) {
        // Pedido de demissão: sempre 30 dias. Dispensa: proporcional ao tempo de serviço.
        const dias = tipoDesligamento === "pedido_demissao" ? 30 : calcularDiasAviso(emp.data_admissao);
        setDiasAviso(dias);
        setDataFimAviso(addDays(new Date(), dias));
      }
      
      if (emp?.empresa_id) {
        fetchEmpresa(emp.empresa_id);
      }
    }
  }, [selectedEmployee, employees, tipo, tipoDesligamento]);

  const fetchEmpresa = async (empresaId: string) => {
    const { data } = await supabase
      .from("empresas")
      .select("*")
      .eq("id", empresaId)
      .single();
    setEmpresa(data);
  };

  const calcularDiasAviso = (dataAdmissao: string): number => {
    const admissao = dataBR(dataAdmissao);
    const hoje = new Date();
    const anosTrabalho = differenceInYears(hoje, admissao);
    
    // Lei 12.506/2011: 30 dias + 3 dias por ano trabalhado (máximo 90 dias)
    const diasAdicionais = Math.min(anosTrabalho * 3, 60);
    return 30 + diasAdicionais;
  };

  const fetchData = async () => {
    try {
      const statusFilter = tipo === "admissao" ? "ativo" : "ativo";
      const { data: empData, error: empError } = await supabase
        .from("employees")
        .select("id, nome_completo, cargo, setor, data_admissao, cpf, empresa_id")
        .eq("status", statusFilter)
        .order("nome_completo");

      if (empError) throw empError;

      const { data: activeChecklists, error: checklistError } = await supabase
        .from("plano_checklist_funcionario")
        .select("employee_id")
        .eq("tipo", tipo)
        .eq("status", "em_andamento");

      if (checklistError) throw checklistError;

      const activeEmployeeIds = new Set(activeChecklists?.map((c) => c.employee_id));
      const availableEmployees = empData?.filter((e) => !activeEmployeeIds.has(e.id)) || [];
      setEmployees(availableEmployees);

      const { data: tempData, error: tempError } = await supabase
        .from("plano_checklist_templates")
        .select("id, nome")
        .eq("tipo", tipo)
        .eq("ativo", true);

      if (tempError) throw tempError;
      setTemplates(tempData || []);

      if (tempData && tempData.length > 0) {
        setSelectedTemplate(tempData[0].id);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCreate = async () => {
    if (!selectedEmployee || !selectedTemplate) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione um funcionário e um template.",
        variant: "destructive",
      });
      return;
    }

    if (tipo === "desligamento" && !motivoDesligamento) {
      toast({
        title: "Motivo obrigatório",
        description: "Selecione o motivo do desligamento.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const { data: templateItems, error: itemsError } = await supabase
        .from("plano_checklist_itens")
        .select("*")
        .eq("template_id", selectedTemplate)
        .order("ordem");

      if (itemsError) throw itemsError;

      const { data: { user } } = await supabase.auth.getUser();

      const checklistData: any = {
        employee_id: selectedEmployee,
        template_id: selectedTemplate,
        tipo,
        created_by: user?.id,
      };

      // Adicionar dados específicos de desligamento
      if (tipo === "desligamento") {
        checklistData.tipo_desligamento = tipoDesligamento;
        checklistData.motivo_desligamento = motivoDesligamento;
        checklistData.aviso_tipo = avisoTipo;
        checklistData.dias_aviso = diasAviso;
        checklistData.observacoes_desligamento = observacoes;
      }

      const { data: checklist, error: checklistError } = await supabase
        .from("plano_checklist_funcionario")
        .insert(checklistData)
        .select()
        .single();

      if (checklistError) throw checklistError;

      const checklistItems = templateItems?.map((item) => ({
        checklist_funcionario_id: checklist.id,
        item_id: item.id,
        titulo: item.titulo,
        descricao: item.descricao,
        ordem: item.ordem,
        obrigatorio: item.obrigatorio,
        prazo_dias: item.prazo_dias,
      }));

      if (checklistItems && checklistItems.length > 0) {
        const { error: insertError } = await supabase
          .from("plano_checklist_funcionario_itens")
          .insert(checklistItems);

        if (insertError) throw insertError;
      }

      // Se for admissão, atualizar status do funcionário para "em_admissao"
      if (tipo === "admissao") {
        const { error: employeeError } = await supabase
          .from("employees")
          .update({ status: "em_admissao" })
          .eq("id", selectedEmployee);

        if (employeeError) {
          console.error("Erro ao atualizar status do funcionário:", employeeError);
        }
      }

      toast({
        title: "Checklist criado",
        description: `Processo de ${tipo === "admissao" ? "admissão" : "desligamento"} iniciado com sucesso.`,
      });

      setSelectedEmployee("");
      setTipoDesligamento("dispensa_empresa");
      setMotivoDesligamento("");
      setAvisoTipo("trabalhado");
      setObservacoes("");
      onCreated();
    } catch (error: any) {
      toast({
        title: "Erro ao criar checklist",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!selectedEmployeeData || !empresa) {
      toast({
        title: "Dados incompletos",
        description: "Selecione um funcionário para gerar o documento.",
        variant: "destructive",
      });
      return;
    }

    const dados = {
      funcionario: selectedEmployeeData,
      empresa,
      tipoDesligamento,
      motivoDesligamento,
      avisoTipo,
      diasAviso,
      dataDesligamento: new Date(),
      dataFimAviso: dataFimAviso || addDays(new Date(), diasAviso),
      observacoes,
    };

    if (tipoDesligamento === "pedido_demissao") {
      gerarPedidoDemissao(dados);
    } else {
      gerarCartaDemissao(dados);
    }
  };

  const motivosDesligamento = [
    { value: "sem_justa_causa", label: "Sem justa causa" },
    { value: "com_justa_causa", label: "Com justa causa" },
    { value: "acordo_mutuo", label: "Acordo mútuo (Art. 484-A CLT)" },
    { value: "termino_contrato", label: "Término de contrato" },
    { value: "aposentadoria", label: "Aposentadoria" },
    { value: "falecimento", label: "Falecimento" },
    { value: "pedido_demissao", label: "Pedido de demissão" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={tipo === "desligamento" ? "max-w-2xl" : ""}>
        <DialogHeader>
          <DialogTitle>
            Novo {tipo === "admissao" ? "Processo de Admissão" : "Processo de Desligamento"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Funcionário</Label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um funcionário" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.nome_completo} - {emp.cargo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {employees.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum funcionário disponível para este processo.
              </p>
            )}
          </div>

          {tipo === "admissao" && selectedEmployee && selectedEmployeeData && empresa && (
            <div className="pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  gerarSolicitacaoContaSalario({
                    funcionario: selectedEmployeeData,
                    empresa,
                  });
                }}
                className="w-full"
                disabled={!empresa?.numero_convenio_bancario}
              >
                <Landmark className="h-4 w-4 mr-2" />
                Gerar Solicitação de Abertura de Conta Salário
              </Button>
              {!empresa?.numero_convenio_bancario && (
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  Configure o número do convênio bancário da empresa para habilitar esta opção.
                </p>
              )}
            </div>
          )}

          {tipo === "desligamento" && selectedEmployee && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Desligamento</Label>
                  <Select value={tipoDesligamento} onValueChange={(v: any) => setTipoDesligamento(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pedido_demissao">Pedido de Demissão</SelectItem>
                      <SelectItem value="dispensa_empresa">Dispensa pela Empresa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Motivo do Desligamento</Label>
                  <Select value={motivoDesligamento} onValueChange={setMotivoDesligamento}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o motivo" />
                    </SelectTrigger>
                    <SelectContent>
                      {motivosDesligamento.map((motivo) => (
                        <SelectItem key={motivo.value} value={motivo.value}>
                          {motivo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Aviso Prévio</Label>
                  <Select value={avisoTipo} onValueChange={(v: any) => setAvisoTipo(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trabalhado">Trabalhado</SelectItem>
                      <SelectItem value="indenizado">Indenizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    Dias de Aviso (calculado)
                  </Label>
                  <div className="p-3 bg-muted rounded-md">
                    <span className="text-lg font-bold">{diasAviso} dias</span>
                    {selectedEmployeeData?.data_admissao && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Admissão: {format((parseDateOnly(selectedEmployeeData.data_admissao) ?? new Date()), "dd/MM/yyyy", { locale: ptBR })}
                        <br />
                        {avisoTipo === "trabalhado" && dataFimAviso && (
                          <>Fim do aviso: {format(dataFimAviso, "dd/MM/yyyy", { locale: ptBR })}</>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Observações adicionais sobre o desligamento..."
                  className="min-h-[80px]"
                />
              </div>

              {selectedEmployeeData && empresa && (
                <div className="pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDownloadPDF}
                    className="w-full"
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    {tipoDesligamento === "pedido_demissao" 
                      ? "Baixar Pedido de Demissão (PDF)" 
                      : "Baixar Carta de Dispensa (PDF)"}
                  </Button>
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label>Template</Label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((temp) => (
                  <SelectItem key={temp.id} value={temp.id}>
                    {temp.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={loading || !selectedEmployee}>
              {loading ? "Criando..." : "Criar Checklist"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
