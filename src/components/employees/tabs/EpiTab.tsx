import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Shield, Trash2, FileDown, PenLine } from "lucide-react";
import EpiForm from "@/components/forms/EpiForm";
import { toast } from "sonner";
import { generateEpiReceipt } from "@/lib/pdfGenerator";
import { dataBR } from "@/lib/date";

interface EpiTabProps {
  employeeId: string;
}

const EpiTab = ({ employeeId }: EpiTabProps) => {
  const [epis, setEpis] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchEpis();
  }, [employeeId]);

  const fetchEpis = async () => {
    const { data } = await supabase
      .from("epis")
      .select("*")
      .eq("employee_id", employeeId)
      .order("data_entrega", { ascending: false });

    setEpis(data || []);
  };

  const handleSaved = () => {
    setShowForm(false);
    fetchEpis();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este EPI?")) return;

    const { error } = await supabase
      .from("epis")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao excluir EPI");
    } else {
      toast.success("EPI excluído com sucesso");
      fetchEpis();
    }
  };

  const handleMarkAsPhysicallySigned = async (id: string) => {
    if (!confirm("Confirma que o funcionário assinou fisicamente este recibo?")) return;

    const { error } = await supabase
      .from("epis")
      .update({
        assinatura_funcionario: "ASSINATURA_FISICA",
        data_assinatura: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao registrar assinatura");
    } else {
      toast.success("Assinatura física registrada com sucesso");
      fetchEpis();
    }
  };

  const handleReprintReceipt = async (epi: any) => {
    const { data: employee } = await supabase
      .from("employees")
      .select("nome_completo, cpf, cargo, empresa_id")
      .eq("id", employeeId)
      .single();

    const { data: stockData } = await supabase
      .from("estoque_epis")
      .select("marca_modelo, ca, tamanho, finalidade")
      .eq("tipo_epi", epi.tipo_epi)
      .limit(1)
      .maybeSingle();

    if (!employee) {
      toast.error("Erro ao buscar dados do funcionário");
      return;
    }

    let empresaNome: string | null = null;
    let empresaCnpj: string | null = null;
    if (employee.empresa_id) {
      const { data: empresa } = await supabase
        .from("empresas")
        .select("nome, cnpj")
        .eq("id", employee.empresa_id)
        .single();
      empresaNome = empresa?.nome || null;
      empresaCnpj = empresa?.cnpj || null;
    }

    generateEpiReceipt({
      employeeName: employee.nome_completo,
      employeeCpf: employee.cpf || "Não informado",
      employeeRole: employee.cargo,
      tipoEpi: epi.tipo_epi,
      marcaModelo: stockData?.marca_modelo || null,
      ca: stockData?.ca || null,
      quantidade: epi.quantidade,
      tamanho: stockData?.tamanho || null,
      finalidade: stockData?.finalidade || null,
      dataEntrega: epi.data_entrega,
      observacoes: epi.observacoes,
      assinatura: epi.assinatura_funcionario,
      empresaNome,
      empresaCnpj,
    });

    toast.success("Recibo gerado com sucesso!");
  };

  const getSignatureStatus = (epi: any) => {
    if (!epi.assinatura_funcionario) {
      return { text: "Pendente de assinatura", color: "text-yellow-600", signed: false };
    }
    if (epi.assinatura_funcionario === "ASSINATURA_FISICA") {
      return { text: "✓ Assinado fisicamente", color: "text-green-600", signed: true };
    }
    return { text: "✓ Assinado digitalmente", color: "text-green-600", signed: true };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h3 className="text-lg font-semibold">EPIs Entregues</h3>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-2" />
          Registrar EPI
        </Button>
      </div>

      {showForm && (
        <EpiForm employeeId={employeeId} onSaved={handleSaved} onCancel={() => setShowForm(false)} />
      )}

      {epis.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum EPI registrado
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {epis.map((epi) => {
            const signatureStatus = getSignatureStatus(epi);
            return (
              <Card key={epi.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      {epi.tipo_epi}
                    </CardTitle>
                    <div className="flex flex-wrap gap-2">
                      {!signatureStatus.signed && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkAsPhysicallySigned(epi.id)}
                          title="Marcar como assinado fisicamente"
                        >
                          <PenLine className="w-4 h-4 mr-1" />
                          Assinatura Física
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleReprintReceipt(epi)}
                        title="Reimprimir Recibo"
                      >
                        <FileDown className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(epi.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Quantidade</p>
                      <p className="font-medium">{epi.quantidade}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Data de Entrega</p>
                      <p className="font-medium">
                        {dataBR(epi.data_entrega).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Status da Assinatura</p>
                      <p className={`font-medium ${signatureStatus.color}`}>{signatureStatus.text}</p>
                    </div>
                    {epi.observacoes && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Observações</p>
                        <p className="font-medium">{epi.observacoes}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EpiTab;
