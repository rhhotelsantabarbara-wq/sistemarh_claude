import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, FileText, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { EncaminhamentoForm } from "@/components/saude-ocupacional/EncaminhamentoForm";
import { generateEncaminhamentoPDF } from "@/lib/pdfGeneratorEncaminhamento";
import { dataBR } from "@/lib/date";

interface ExamesMedicosTabProps {
  employeeId: string;
}

const ExamesMedicosTab = ({ employeeId }: ExamesMedicosTabProps) => {
  const [encaminhamentos, setEncaminhamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);

  useEffect(() => {
    fetchEncaminhamentos();
  }, [employeeId]);

  const fetchEncaminhamentos = async () => {
    try {
      const { data, error } = await supabase
        .from("encaminhamentos_medicos")
        .select("*, empresas(nome, cnpj, endereco, logo_url)")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEncaminhamentos(data || []);
    } catch (error) {
      console.error("Erro ao carregar exames médicos:", error);
      toast.error("Erro ao carregar exames médicos");
    } finally {
      setLoading(false);
    }
  };

  const statusColors = {
    pendente: "bg-yellow-500",
    agendado: "bg-orange-500",
    realizado: "bg-green-500",
    cancelado: "bg-gray-500",
  };

  const statusLabels = {
    pendente: "Pendente",
    agendado: "Agendado",
    realizado: "Realizado",
    cancelado: "Cancelado",
  };

  const tipoLabels = {
    admissional: "Admissional",
    demissional: "Demissional",
    periodico: "Periódico",
    mudanca_riscos: "Mudança de Riscos",
    retorno_trabalho: "Retorno ao Trabalho",
  };

  const handleGerarPDF = async (encaminhamento: any) => {
    try {
      // Buscar dados completos do funcionário e empresa com logo para o PDF
      const { data: employee, error: empError } = await supabase
        .from("employees")
        .select("*")
        .eq("id", employeeId)
        .single();

      if (empError) throw empError;

      const { data: empresa, error: empError2 } = await supabase
        .from("empresas")
        .select("*")
        .eq("id", employee.empresa_id)
        .single();

      if (empError2) throw empError2;

      const encaminhamentoCompleto = {
        ...encaminhamento,
        employees: employee,
        empresas: empresa,
      };

      await generateEncaminhamentoPDF(encaminhamentoCompleto);
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Histórico de Exames Médicos</h3>
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Novo Encaminhamento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Encaminhamento Médico</DialogTitle>
            </DialogHeader>
            <EncaminhamentoForm
              onSaved={() => {
                setShowNewDialog(false);
                fetchEncaminhamentos();
              }}
              onCancel={() => setShowNewDialog(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : encaminhamentos.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Nenhum exame médico registrado
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {encaminhamentos.map((enc) => (
            <Card key={enc.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {tipoLabels[enc.tipo_exame as keyof typeof tipoLabels]}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[enc.status as keyof typeof statusColors]}>
                      {statusLabels[enc.status as keyof typeof statusLabels]}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => handleGerarPDF(enc)}>
                      <Download className="w-4 h-4 mr-2" />
                      PDF
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
                  <p>
                    <strong>Data de Encaminhamento:</strong>{" "}
                    {format(dataBR(enc.data_encaminhamento), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                  {enc.data_agendamento && (
                    <p>
                      <strong>Data Agendada:</strong>{" "}
                      {format(dataBR(enc.data_agendamento), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  )}
                  {enc.data_realizacao && (
                    <p>
                      <strong>Data de Realização:</strong>{" "}
                      {format(dataBR(enc.data_realizacao), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  )}
                  <p>
                    <strong>Função:</strong> {enc.funcao}
                  </p>
                  {enc.descricao_atividade && (
                    <p>
                      <strong>Atividade:</strong> {enc.descricao_atividade}
                    </p>
                  )}
                  {enc.observacoes && (
                    <p>
                      <strong>Observações:</strong> {enc.observacoes}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExamesMedicosTab;
