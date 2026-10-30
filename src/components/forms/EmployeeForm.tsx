import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { User, FileText, MapPin, Briefcase, FileSignature, Landmark } from "lucide-react";
import CamposFicha from "./employee-tabs/CamposFicha";
import { grupo, paraBanco, paraFormulario } from "@/lib/fichaCampos";
import { useCanViewSalary } from "@/hooks/useCanViewSalary";

import DadosPessoaisTab from "./employee-tabs/DadosPessoaisTab";
import DocumentacaoTab from "./employee-tabs/DocumentacaoTab";
import EnderecoTab from "./employee-tabs/EnderecoTab";
import MovimentacoesTab from "./employee-tabs/MovimentacoesTab";

interface EmployeeFormProps {
  employeeId?: string;
  initialData?: any;
  onSaved: () => void;
  onCancel: () => void;
  /** chamado com o id do funcionário recém-criado (antes de onSaved) */
  onCreated?: (id: string) => Promise<void> | void;
}

const EmployeeForm = ({ employeeId, initialData, onSaved, onCancel, onCreated }: EmployeeFormProps) => {
  const { canViewSalary } = useCanViewSalary();
  const [loading, setLoading] = useState(false);
  const [cpfLoading, setCpfLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(initialData?.foto_url || null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>(initialData?.status || "ativo");
  const [createChecklist, setCreateChecklist] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("dados-pessoais");
  
  // Estado controlado para todos os campos do formulário
  const [formValues, setFormValues] = useState<Record<string, string>>({
    nome_completo: initialData?.nome_completo || "",
    codigo_funcionario: initialData?.codigo_funcionario || "",
    data_nascimento: initialData?.data_nascimento || "",
    nacionalidade: initialData?.nacionalidade || "",
    naturalidade_estado: initialData?.naturalidade_estado || "",
    naturalidade_municipio: initialData?.naturalidade_municipio || "",
    nome_pai: initialData?.nome_pai || "",
    nome_mae: initialData?.nome_mae || "",
    raca_cor: initialData?.raca_cor || "",
    sexo: initialData?.sexo || "",
    senha: "",
    carteira_trabalho: initialData?.carteira_trabalho || "",
    cpf: initialData?.cpf || "",
    pis: initialData?.pis || "",
    rg: initialData?.rg || "",
    rg_orgao_expedidor: initialData?.rg_orgao_expedidor || "",
    rg_data_emissao: initialData?.rg_data_emissao || "",
    rg_uf: initialData?.rg_uf || "",
    telefone: initialData?.telefone || "",
    cep: initialData?.cep || "",
    endereco: initialData?.endereco || "",
    endereco_numero: initialData?.endereco_numero || "",
    endereco_complemento: initialData?.endereco_complemento || "",
    bairro: initialData?.bairro || "",
    uf: initialData?.uf || "",
    cidade: initialData?.cidade || "",
    cargo: initialData?.cargo || "",
    setor: initialData?.setor || "",
    empresa_id: initialData?.empresa_id || "",
    tipo_contrato: initialData?.tipo_contrato || "fixo",
    salario: initialData?.salario?.toString() || "",
    tipo_salario: initialData?.tipo_salario || "mensal",
    data_admissao: initialData?.data_admissao || "",
    status: initialData?.status || "ativo",
    data_desligamento: initialData?.data_desligamento || "",
    ...paraFormulario(initialData),
  });

  const handleFormChange = (field: string, value: string) => {
    setFormValues(prev => ({ ...prev, [field]: value }));
  };

  const { data: setores } = useQuery({
    queryKey: ["setores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setores")
        .select("*")
        .order("nome");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: empresas } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("*")
        .order("nome");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: funcoes } = useQuery({
    queryKey: ["funcoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcoes")
        .select("*")
        .order("nome");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: admissionTemplates } = useQuery({
    queryKey: ["admission-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plano_checklist_templates")
        .select("id, nome")
        .eq("tipo", "admissao")
        .eq("ativo", true)
        .order("nome");
      
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (admissionTemplates && admissionTemplates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(admissionTemplates[0].id);
    }
  }, [admissionTemplates, selectedTemplateId]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("A foto deve ter no máximo 5MB");
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoRemoved(true);
  };

  const uploadPhoto = async (employeeIdForUpload: string): Promise<string | null> => {
    if (!photoFile) return null;

    const fileExt = (photoFile.name.split('.').pop() || 'jpg').toLowerCase();
    const fileName = `${employeeIdForUpload}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('employee-photos')
      .upload(fileName, photoFile, { upsert: true, contentType: photoFile.type || undefined });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('employee-photos')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const createAdmissionChecklist = async (newEmployeeId: string, templateId: string) => {
    try {
      const { data: templateItems, error: itemsError } = await supabase
        .from("plano_checklist_itens")
        .select("*")
        .eq("template_id", templateId)
        .order("ordem");

      if (itemsError) throw itemsError;

      const { data: { user } } = await supabase.auth.getUser();

      const { data: checklist, error: checklistError } = await supabase
        .from("plano_checklist_funcionario")
        .insert({
          employee_id: newEmployeeId,
          template_id: templateId,
          tipo: "admissao",
          created_by: user?.id,
        })
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

      console.log("Checklist de admissão criado automaticamente");
    } catch (error: any) {
      console.error("Erro ao criar checklist de admissão:", error);
      toast.error("Erro ao criar checklist de admissão: " + error.message);
    }
  };

  const handleCpfLookup = async (automatico = false) => {
    const cpf = (formValues.cpf || "").replace(/\D/g, "");
    if (cpf.length !== 11) {
      if (!automatico) toast.error("Digite os 11 números do CPF antes de buscar");
      return;
    }

    setCpfLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("cpf-lookup", { body: { cpf } });
      if (error) {
        toast.error("Erro ao consultar CPF: " + error.message);
        return;
      }
      if (result?.error) {
        toast.error(result.error);
        return;
      }

      const dados = result?.dados || {};
      const rotulos: Record<string, string> = { nome_completo: "nome", data_nascimento: "nascimento", sexo: "sexo" };
      // Só preenche campos vazios, para não apagar o que já foi digitado
      const updates: Record<string, string> = {};
      for (const campo of ["nome_completo", "data_nascimento", "sexo"]) {
        if (dados[campo] && !formValues[campo]) updates[campo] = dados[campo];
      }

      if (Object.keys(updates).length > 0) {
        setFormValues(prev => ({ ...prev, ...updates }));
        toast.success(`CPF encontrado: ${Object.keys(updates).map((c) => rotulos[c]).join(", ")} preenchido(s) em Dados Pessoais`);
      } else if (dados.nome_completo) {
        toast.info(`CPF de ${dados.nome_completo}. Os campos já estavam preenchidos.`);
      } else {
        toast.error("Nenhum dado retornado para este CPF");
      }
    } catch (err: any) {
      console.error("CPF lookup error:", err);
      toast.error("Erro ao consultar CPF");
    } finally {
      setCpfLoading(false);
    }
  };

  // Cadastro novo: consulta sozinho quando o CPF tiver 11 dígitos (uma vez por CPF)
  const [ultimoCpfConsultado, setUltimoCpfConsultado] = useState<string>("");
  useEffect(() => {
    if (employeeId) return; // só no cadastro novo
    const cpf = (formValues.cpf || "").replace(/\D/g, "");
    if (cpf.length !== 11 || cpf === ultimoCpfConsultado) return;
    const t = setTimeout(() => {
      setUltimoCpfConsultado(cpf);
      handleCpfLookup(true);
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formValues.cpf]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    
    console.log("=== INICIANDO CADASTRO DE FUNCIONÁRIO ===");
    console.log("Form Values:", formValues);
    
    // Validação do campo obrigatório cargo
    if (!formValues.cargo) {
      toast.error("Função é obrigatória");
      setActiveTab("movimentacoes");
      setLoading(false);
      return;
    }

    const salario = formValues.salario;
    const status = formValues.status as "em_admissao" | "ativo" | "ferias" | "afastado" | "demitido" || "ativo";
    
    const data = {
      nome_completo: formValues.nome_completo,
      codigo_funcionario: formValues.codigo_funcionario.trim() || null,
      cargo: formValues.cargo,
      setor: formValues.setor || null,
      empresa_id: formValues.empresa_id || null,
      salario: salario ? parseFloat(salario) : null,
      tipo_salario: formValues.tipo_salario as "mensal" | "diario" | "por_hora" || "mensal",
      tipo_contrato: formValues.tipo_contrato as "fixo" | "intermitente" | "prestador_servico" || "fixo",
      cpf: formValues.cpf || null,
      rg: formValues.rg || null,
      telefone: formValues.telefone || null,
      endereco: formValues.endereco || null,
      data_nascimento: formValues.data_nascimento || null,
      data_admissao: formValues.data_admissao || null,
      status: status,
      data_desligamento: status === "demitido" ? (formValues.data_desligamento || null) : null,
      sexo: formValues.sexo || null,
      nacionalidade: formValues.nacionalidade || null,
      naturalidade_estado: formValues.naturalidade_estado || null,
      naturalidade_municipio: formValues.naturalidade_municipio || null,
      nome_pai: formValues.nome_pai || null,
      nome_mae: formValues.nome_mae || null,
      raca_cor: formValues.raca_cor || null,
      carteira_trabalho: formValues.carteira_trabalho || null,
      pis: formValues.pis || null,
      rg_orgao_expedidor: formValues.rg_orgao_expedidor || null,
      rg_data_emissao: formValues.rg_data_emissao || null,
      rg_uf: formValues.rg_uf || null,
      cep: formValues.cep || null,
      endereco_numero: formValues.endereco_numero || null,
      endereco_complemento: formValues.endereco_complemento || null,
      bairro: formValues.bairro || null,
      uf: formValues.uf || null,
      cidade: formValues.cidade || null,
      ...paraBanco(formValues),
    };

    try {
      if (employeeId) {
        let fotoUrl: string | null = initialData?.foto_url ?? null;
        if (photoFile) {
          fotoUrl = await uploadPhoto(employeeId);
        } else if (photoRemoved) {
          fotoUrl = null;
        }

        // Verificar se houve alteração de salário para registrar no histórico
        const oldSalary = initialData?.salario ? parseFloat(String(initialData.salario)) : null;
        const newSalary = data.salario;
        if (oldSalary != null && newSalary != null && oldSalary !== newSalary && oldSalary > 0) {
          const percentual = ((newSalary - oldSalary) / oldSalary) * 100;
          const { data: userData } = await supabase.auth.getUser();
          await supabase.from("historico_reajustes_salariais").insert({
            employee_id: employeeId,
            salario_anterior: oldSalary,
            salario_novo: newSalary,
            percentual_reajuste: percentual,
            justificativa: "Reajuste via edição do perfil do funcionário",
            aplicado_por: userData?.user?.id ?? null,
          });
        }

        const { error } = await supabase
          .from("employees")
          .update({ ...data, foto_url: fotoUrl })
          .eq("id", employeeId);

        if (error) throw error;
        toast.success("Funcionário atualizado!");
      } else {
        if (!formValues.cpf) {
          toast.error("CPF é obrigatório para criar novo funcionário");
          setActiveTab("documentacao");
          setLoading(false);
          return;
        }
        
        if (!formValues.senha) {
          toast.error("Senha é obrigatória para criar novo funcionário");
          setActiveTab("dados-pessoais");
          setLoading(false);
          return;
        }

        console.log("Criando usuário via edge function");
        
        const { data: functionData, error: functionError } = await supabase.functions.invoke('create-employee-user', {
          body: {
            cpf: formValues.cpf,
            senha: formValues.senha,
            nome_completo: data.nome_completo
          }
        });

        if (functionError) {
          console.error("Erro na função:", functionError);
          toast.error("Erro ao criar login: " + functionError.message);
          setLoading(false);
          return;
        }

        if (functionData.error) {
          console.error("Erro retornado pela função:", functionData.error);
          toast.error("Erro ao criar login: " + functionData.error);
          setLoading(false);
          return;
        }

        const userId = functionData.user.id;
        console.log("Usuário criado com sucesso:", userId);

        const { data: newEmployee, error: employeeError } = await supabase
          .from("employees")
          .insert([{ ...data, user_id: userId }])
          .select()
          .single();

        if (employeeError) {
          console.error("Erro ao inserir funcionário:", employeeError);
          const errorMsg = employeeError.message.includes("row-level security")
            ? "Sem permissão. Apenas gestores podem cadastrar funcionários."
            : "Erro ao salvar funcionário: " + employeeError.message;
          toast.error(errorMsg);
          setLoading(false);
          return;
        }

        console.log("Funcionário criado:", newEmployee.id);

        if (photoFile && newEmployee) {
          const uploadedUrl = await uploadPhoto(newEmployee.id);
          if (uploadedUrl) {
            await supabase
              .from("employees")
              .update({ foto_url: uploadedUrl })
              .eq("id", newEmployee.id);
          }
        }

        if (onCreated) await onCreated(newEmployee.id);

        if (data.status === "em_admissao" && createChecklist && selectedTemplateId) {
          await createAdmissionChecklist(newEmployee.id, selectedTemplateId);
        }

        const successMessage = data.status === "em_admissao" && createChecklist
          ? "Funcionário cadastrado com processo de admissão iniciado!"
          : "Funcionário cadastrado com sucesso!";
        toast.success(successMessage);
      }
      
      onSaved();
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error(`Erro ao salvar funcionário: ${error?.message || "desconhecido"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{employeeId ? "Editar Funcionário" : "Novo Funcionário"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="inline-flex w-full overflow-x-auto tabs-scroll">
              <TabsTrigger value="dados-pessoais" className="flex-shrink-0 flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Dados Pessoais</span>
              </TabsTrigger>
              <TabsTrigger value="documentacao" className="flex-shrink-0 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Documentação</span>
              </TabsTrigger>
              <TabsTrigger value="endereco" className="flex-shrink-0 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span className="hidden sm:inline">Endereço</span>
              </TabsTrigger>
              <TabsTrigger value="movimentacoes" className="flex-shrink-0 flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                <span className="hidden sm:inline">Movimentações</span>
              </TabsTrigger>
              <TabsTrigger value="contrato" className="flex-shrink-0 flex items-center gap-2">
                <FileSignature className="h-4 w-4" />
                <span className="hidden sm:inline">Contrato</span>
              </TabsTrigger>
              <TabsTrigger value="banco" className="flex-shrink-0 flex items-center gap-2">
                <Landmark className="h-4 w-4" />
                <span className="hidden sm:inline">Banco e benefícios</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dados-pessoais" className="mt-6">
              <DadosPessoaisTab
                initialData={initialData}
                isEditing={!!employeeId}
                photoPreview={photoPreview}
                onPhotoChange={handlePhotoChange}
                onRemovePhoto={handleRemovePhoto}
                formValues={formValues}
                onFormChange={handleFormChange}
              />
              <div className="mt-6 border-t pt-6">
                <CamposFicha grupos={[grupo("pessoais"), grupo("emergencia"), grupo("pcd")]} valores={formValues} onChange={handleFormChange} />
              </div>
            </TabsContent>

            <TabsContent value="documentacao" className="mt-6">
              <DocumentacaoTab
                initialData={initialData}
                isEditing={!!employeeId}
                formValues={formValues}
                onFormChange={handleFormChange}
                onCpfLookup={() => handleCpfLookup(false)}
                cpfLoading={cpfLoading}
              />
              <div className="mt-6 border-t pt-6">
                <CamposFicha grupos={[grupo("documentos")]} valores={formValues} onChange={handleFormChange} />
              </div>
            </TabsContent>

            <TabsContent value="endereco" className="mt-6">
              <EnderecoTab 
                initialData={initialData}
                formValues={formValues}
                onFormChange={handleFormChange}
              />
            </TabsContent>

            <TabsContent value="movimentacoes" className="mt-6">
              <MovimentacoesTab
                initialData={initialData}
                isEditing={!!employeeId}
                selectedStatus={selectedStatus}
                setSelectedStatus={setSelectedStatus}
                createChecklist={createChecklist}
                setCreateChecklist={setCreateChecklist}
                selectedTemplateId={selectedTemplateId}
                setSelectedTemplateId={setSelectedTemplateId}
                setores={setores}
                empresas={empresas}
                funcoes={funcoes}
                admissionTemplates={admissionTemplates}
                formValues={formValues}
                onFormChange={handleFormChange}
              />
            </TabsContent>

            <TabsContent value="contrato" className="mt-6">
              <CamposFicha
                grupos={[grupo("contrato"), grupo("organizacao"), ...(formValues.status === "demitido" ? [grupo("desligamento")] : [])]}
                valores={formValues}
                onChange={handleFormChange}
                proprioId={employeeId}
              />
            </TabsContent>

            <TabsContent value="banco" className="mt-6">
              <CamposFicha grupos={[grupo("banco"), grupo("beneficios"), grupo("tamanhos")]} valores={formValues} onChange={handleFormChange} semFinanceiro={!canViewSalary} />
            </TabsContent>
          </Tabs>

          <div className="flex gap-2 pt-4 border-t">
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default EmployeeForm;
