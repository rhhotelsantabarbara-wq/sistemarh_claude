import { useState, useEffect } from "react";
import { todayISO, dataBR } from "@/lib/date";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { User, FileText, MapPin, Briefcase, Landmark } from "lucide-react";
import ChangePasswordDialog from "./ChangePasswordDialog";
import { gerarSolicitacaoContaSalario } from "@/lib/pdfGeneratorContaSalario";
import { toast } from "sonner";
import { useCanViewSalary } from "@/hooks/useCanViewSalary";

interface EmployeeInfoProps {
  employee: any;
  onUpdate: () => void;
}

const EmployeeInfo = ({ employee }: EmployeeInfoProps) => {
  const { canViewSalary } = useCanViewSalary();
  const [isOnVacation, setIsOnVacation] = useState(false);

  useEffect(() => {
    const checkVacation = async () => {
      if (!employee?.id) return;
      const todayStr = todayISO();
      const { count } = await supabase
        .from("ferias")
        .select("*", { count: "exact", head: true })
        .eq("employee_id", employee.id)
        .lte("periodo_gozo_inicio", todayStr)
        .gte("periodo_gozo_fim", todayStr);
      setIsOnVacation((count || 0) > 0);
    };
    checkVacation();
  }, [employee?.id]);

  const getEffectiveStatus = () => {
    if (isOnVacation) return "ferias";
    if (employee.status === "ferias") return "ativo";
    return employee.status;
  };
  const getStatusBadge = (status: string) => {
    const variants: any = {
      em_admissao: "outline",
      ativo: "default",
      ferias: "secondary",
      afastado: "destructive",
      demitido: "outline",
    };
    const labels: any = {
      em_admissao: "Em Admissão",
      ativo: "Ativo",
      ferias: "Férias",
      afastado: "Afastado",
      demitido: "Demitido",
    };
    return (
      <Badge variant={variants[status] || "default"} className={status === "em_admissao" ? "bg-amber-50 text-amber-700 border-amber-200" : ""}>
        {labels[status] || status}
      </Badge>
    );
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return dataBR(date).toLocaleDateString("pt-BR");
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "—";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getTipoSalarioLabel = (tipo: string | null) => {
    const labels: Record<string, string> = {
      mensal: "Mensal",
      diario: "Diário",
      por_hora: "Por Hora",
    };
    return labels[tipo || ""] || tipo || "—";
  };

  const getTipoContratoLabel = (tipo: string | null) => {
    const labels: Record<string, string> = {
      fixo: "Fixo",
      intermitente: "Intermitente",
      prestador_servico: "Prestador de Serviço",
    };
    return labels[tipo || ""] || tipo || "—";
  };

  const InfoRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <span>Informações do Funcionário</span>
            {getStatusBadge(getEffectiveStatus())}
          </CardTitle>
          <ChangePasswordDialog 
            userId={employee.user_id} 
            employeeName={employee.nome_completo}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center">
          <Avatar className="w-32 h-32">
            <AvatarImage src={employee.foto_url || undefined} alt={employee.nome_completo} />
            <AvatarFallback className="bg-muted">
              <User className="w-16 h-16 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
        </div>

        <Tabs defaultValue="dados-pessoais" className="w-full">
          <TabsList className="inline-flex w-full overflow-x-auto tabs-scroll lg:grid lg:grid-cols-4">
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
          </TabsList>

          <TabsContent value="dados-pessoais" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <InfoRow label="Nome Completo" value={employee.nome_completo} />
              </div>
              <InfoRow label="Código do funcionário" value={employee.codigo_funcionario} />
              <InfoRow label="Data de Nascimento" value={formatDate(employee.data_nascimento)} />
              <InfoRow label="Nacionalidade" value={employee.nacionalidade} />
              <InfoRow label="Naturalidade - Estado" value={employee.naturalidade_estado} />
              <InfoRow label="Naturalidade - Município" value={employee.naturalidade_municipio} />
              <InfoRow label="Nome do Pai" value={employee.nome_pai} />
              <InfoRow label="Nome da Mãe" value={employee.nome_mae} />
              <InfoRow label="Raça/Cor" value={employee.raca_cor} />
              <InfoRow label="Sexo" value={employee.sexo} />
            </div>
          </TabsContent>

          <TabsContent value="documentacao" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow label="Carteira de Trabalho" value={employee.carteira_trabalho} />
              <InfoRow label="CPF" value={employee.cpf} />
              <InfoRow label="PIS" value={employee.pis} />
              <InfoRow label="RG" value={employee.rg} />
              <InfoRow label="RG - Órgão Expedidor" value={employee.rg_orgao_expedidor} />
              <InfoRow label="RG - Data de Emissão" value={formatDate(employee.rg_data_emissao)} />
              <InfoRow label="RG - UF de Emissão" value={employee.rg_uf} />
              <InfoRow label="Telefone" value={employee.telefone} />
            </div>
            <div className="mt-6 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={async () => {
                  if (!employee.empresa_id) {
                    toast.error("Funcionário sem empresa vinculada.");
                    return;
                  }
                  const { data: empresa, error } = await supabase
                    .from("empresas")
                    .select("nome, cnpj, numero_convenio_bancario")
                    .eq("id", employee.empresa_id)
                    .maybeSingle();
                  if (error || !empresa) {
                    toast.error("Não foi possível carregar dados da empresa.");
                    return;
                  }
                  if (!empresa.numero_convenio_bancario) {
                    toast.error("Configure o número do convênio bancário da empresa para gerar a solicitação.");
                    return;
                  }
                  gerarSolicitacaoContaSalario({
                    funcionario: {
                      nome_completo: employee.nome_completo,
                      cpf: employee.cpf,
                      cargo: employee.cargo,
                    },
                    empresa: {
                      nome: empresa.nome,
                      cnpj: empresa.cnpj,
                      numero_convenio_bancario: empresa.numero_convenio_bancario,
                    },
                  });
                  toast.success("Solicitação gerada com sucesso!");
                }}
              >
                <Landmark className="h-4 w-4 mr-2" />
                Gerar Solicitação de Abertura de Conta Salário
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="endereco" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow label="CEP" value={employee.cep} />
              <div className="md:col-span-2">
                <InfoRow label="Endereço" value={employee.endereco} />
              </div>
              <InfoRow label="Número" value={employee.endereco_numero} />
              <InfoRow label="Complemento" value={employee.endereco_complemento} />
              <InfoRow label="Bairro" value={employee.bairro} />
              <InfoRow label="UF" value={employee.uf} />
              <InfoRow label="Cidade" value={employee.cidade} />
            </div>
          </TabsContent>

          <TabsContent value="movimentacoes" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow label="Função" value={employee.cargo} />
              <InfoRow label="Setor" value={employee.setor} />
              <InfoRow label="Tipo de Contrato" value={getTipoContratoLabel(employee.tipo_contrato)} />
              {canViewSalary && (
                <>
                  <InfoRow label="Salário" value={formatCurrency(employee.salario)} />
                  <InfoRow label="Tipo de Salário" value={getTipoSalarioLabel(employee.tipo_salario)} />
                </>
              )}
              <InfoRow label="Data de Admissão" value={formatDate(employee.data_admissao)} />
              {employee.status === "demitido" && (
                <InfoRow label="Data de Desligamento" value={formatDate(employee.data_desligamento)} />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default EmployeeInfo;
