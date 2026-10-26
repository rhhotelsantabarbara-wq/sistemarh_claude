import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { dataBR } from "@/lib/date";

interface EncaminhamentoFormProps {
  onSaved: () => void;
  onCancel: () => void;
  encaminhamentoId?: string;
}

export const EncaminhamentoForm = ({ onSaved, onCancel, encaminhamentoId }: EncaminhamentoFormProps) => {
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [dataAgendamento, setDataAgendamento] = useState<Date>();
  const [tipoExame, setTipoExame] = useState<string>("admissional");
  const [condicoesEspeciais, setCondicoesEspeciais] = useState({
    beneficiario_reabilitado: false,
    portador_deficiencia: false,
    trabalho_altura: false,
    espaco_confinado: false,
  });

  const { register, handleSubmit, setValue, watch } = useForm();

  useEffect(() => {
    fetchEmployees();
    if (encaminhamentoId) {
      fetchEncaminhamento();
    }
  }, [encaminhamentoId]);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("*, empresas(nome, cnpj, endereco, logo_url)")
        .order("nome_completo");

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error("Erro ao carregar funcionários:", error);
      toast.error("Erro ao carregar funcionários");
    }
  };

  const fetchEncaminhamento = async () => {
    try {
      const { data, error } = await supabase
        .from("encaminhamentos_medicos")
        .select("*, employees(*, empresas(*))")
        .eq("id", encaminhamentoId)
        .single();

      if (error) throw error;
      
      if (data) {
        setSelectedEmployee(data.employees);
        setTipoExame(data.tipo_exame);
        if (data.data_agendamento) {
          setDataAgendamento(dataBR(data.data_agendamento));
        }
        setCondicoesEspeciais({
          beneficiario_reabilitado: data.beneficiario_reabilitado,
          portador_deficiencia: data.portador_deficiencia,
          trabalho_altura: data.trabalho_altura,
          espaco_confinado: data.espaco_confinado,
        });
        setValue("matricula_esocial", data.matricula_esocial);
        setValue("descricao_atividade", data.descricao_atividade);
        setValue("observacoes", data.observacoes);
      }
    } catch (error) {
      console.error("Erro ao carregar encaminhamento:", error);
      toast.error("Erro ao carregar encaminhamento");
    }
  };

  const onSubmit = async (formData: any) => {
    if (!selectedEmployee) {
      toast.error("Selecione um funcionário");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Buscar CBO da função
      let cbo = null;
      if (selectedEmployee.cargo) {
        const { data: funcaoData } = await supabase
          .from("funcoes")
          .select("cbo")
          .eq("nome", selectedEmployee.cargo)
          .maybeSingle();
        
        cbo = funcaoData?.cbo || null;
      }

      const encaminhamentoData = {
        employee_id: selectedEmployee.id,
        empresa_id: selectedEmployee.empresa_id,
        tipo_exame: tipoExame as "admissional" | "demissional" | "periodico" | "mudanca_riscos" | "retorno_trabalho",
        data_agendamento: dataAgendamento ? format(dataAgendamento, "yyyy-MM-dd") : null,
        funcao: selectedEmployee.cargo,
        cbo: cbo,
        setor: selectedEmployee.setor,
        matricula_esocial: formData.matricula_esocial,
        descricao_atividade: formData.descricao_atividade,
        ...condicoesEspeciais,
        observacoes: formData.observacoes,
        status: (dataAgendamento ? "agendado" : "pendente") as "agendado" | "pendente",
        created_by: user?.id,
      };

      let error;
      if (encaminhamentoId) {
        const result = await supabase
          .from("encaminhamentos_medicos")
          .update(encaminhamentoData)
          .eq("id", encaminhamentoId);
        error = result.error;
      } else {
        const result = await supabase
          .from("encaminhamentos_medicos")
          .insert([encaminhamentoData]);
        error = result.error;
      }

      if (error) throw error;

      toast.success(encaminhamentoId ? "Encaminhamento atualizado!" : "Encaminhamento criado!");
      onSaved();
    } catch (error: any) {
      console.error("Erro ao salvar encaminhamento:", error);
      toast.error(error.message || "Erro ao salvar encaminhamento");
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeChange = (employeeId: string) => {
    const employee = employees.find((e) => e.id === employeeId);
    setSelectedEmployee(employee);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Seleção de Funcionário */}
      <div className="space-y-2">
        <Label>Funcionário *</Label>
        <Select
          value={selectedEmployee?.id}
          onValueChange={handleEmployeeChange}
          disabled={!!encaminhamentoId}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o funcionário" />
          </SelectTrigger>
          <SelectContent>
            {employees.map((employee) => (
              <SelectItem key={employee.id} value={employee.id}>
                {employee.nome_completo} - {employee.cargo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tipo de Exame */}
      <div className="space-y-2">
        <Label>Tipo de Exame *</Label>
        <RadioGroup value={tipoExame} onValueChange={setTipoExame}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="admissional" id="admissional" />
            <Label htmlFor="admissional" className="font-normal">Admissional</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="demissional" id="demissional" />
            <Label htmlFor="demissional" className="font-normal">Demissional</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="periodico" id="periodico" />
            <Label htmlFor="periodico" className="font-normal">Periódico</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="mudanca_riscos" id="mudanca_riscos" />
            <Label htmlFor="mudanca_riscos" className="font-normal">Mudança de Riscos Ocupacionais</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="retorno_trabalho" id="retorno_trabalho" />
            <Label htmlFor="retorno_trabalho" className="font-normal">Retorno ao Trabalho</Label>
          </div>
        </RadioGroup>
      </div>

      {/* Data de Agendamento */}
      <div className="space-y-2">
        <Label>Data de Agendamento</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !dataAgendamento && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dataAgendamento ? format(dataAgendamento, "dd/MM/yyyy") : "Selecione a data"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dataAgendamento}
              onSelect={setDataAgendamento}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Condições Especiais */}
      <div className="space-y-3">
        <Label>Condições Especiais</Label>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="beneficiario_reabilitado"
              checked={condicoesEspeciais.beneficiario_reabilitado}
              onCheckedChange={(checked) =>
                setCondicoesEspeciais((prev) => ({
                  ...prev,
                  beneficiario_reabilitado: checked as boolean,
                }))
              }
            />
            <Label htmlFor="beneficiario_reabilitado" className="font-normal">
              Beneficiário Reabilitado
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="portador_deficiencia"
              checked={condicoesEspeciais.portador_deficiencia}
              onCheckedChange={(checked) =>
                setCondicoesEspeciais((prev) => ({
                  ...prev,
                  portador_deficiencia: checked as boolean,
                }))
              }
            />
            <Label htmlFor="portador_deficiencia" className="font-normal">
              Portador de Deficiência Habilitado
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="trabalho_altura"
              checked={condicoesEspeciais.trabalho_altura}
              onCheckedChange={(checked) =>
                setCondicoesEspeciais((prev) => ({
                  ...prev,
                  trabalho_altura: checked as boolean,
                }))
              }
            />
            <Label htmlFor="trabalho_altura" className="font-normal">
              Realiza Trabalho em Altura
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="espaco_confinado"
              checked={condicoesEspeciais.espaco_confinado}
              onCheckedChange={(checked) =>
                setCondicoesEspeciais((prev) => ({
                  ...prev,
                  espaco_confinado: checked as boolean,
                }))
              }
            />
            <Label htmlFor="espaco_confinado" className="font-normal">
              Trabalha em Espaço Confinado
            </Label>
          </div>
        </div>
      </div>

      {/* Matrícula E-Social */}
      <div className="space-y-2">
        <Label htmlFor="matricula_esocial">Matrícula E-Social</Label>
        <Input
          id="matricula_esocial"
          {...register("matricula_esocial")}
          placeholder="Digite a matrícula E-Social"
        />
      </div>

      {/* Descrição da Atividade */}
      <div className="space-y-2">
        <Label htmlFor="descricao_atividade">Descrição da Atividade</Label>
        <Textarea
          id="descricao_atividade"
          {...register("descricao_atividade")}
          placeholder="Descreva as atividades realizadas pelo funcionário"
          rows={3}
        />
      </div>

      {/* Observações */}
      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea
          id="observacoes"
          {...register("observacoes")}
          placeholder="Observações adicionais"
          rows={3}
        />
      </div>

      {/* Botões */}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {encaminhamentoId ? "Atualizar" : "Criar"} Encaminhamento
        </Button>
      </div>
    </form>
  );
};
