import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Shirt, Trash2, FileDown, PenLine } from "lucide-react";
import UniformForm from "@/components/forms/UniformForm";
import { toast } from "sonner";
import { generateUniformReceipt } from "@/lib/pdfGenerator";
import { dataBR } from "@/lib/date";

interface UniformTabProps {
  employeeId: string;
}

const UniformTab = ({ employeeId }: UniformTabProps) => {
  const [uniformes, setUniformes] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchUniformes();
  }, [employeeId]);

  const fetchUniformes = async () => {
    const { data } = await supabase
      .from("uniformes")
      .select("*")
      .eq("employee_id", employeeId)
      .order("data_entrega", { ascending: false });

    setUniformes(data || []);
  };

  const handleSaved = () => {
    setShowForm(false);
    fetchUniformes();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este uniforme?")) return;

    const { error } = await supabase
      .from("uniformes")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao excluir uniforme");
    } else {
      toast.success("Uniforme excluído com sucesso");
      fetchUniformes();
    }
  };

  const handleMarkAsPhysicallySigned = async (id: string) => {
    if (!confirm("Confirma que o funcionário assinou fisicamente este recibo?")) return;

    const { error } = await supabase
      .from("uniformes")
      .update({
        assinatura_funcionario: "ASSINATURA_FISICA",
        data_assinatura: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao registrar assinatura");
    } else {
      toast.success("Assinatura física registrada com sucesso");
      fetchUniformes();
    }
  };

  const handleReprintReceipt = async (uniforme: any) => {
    const { data: employee } = await supabase
      .from("employees")
      .select("nome_completo, cpf, cargo, empresa_id")
      .eq("id", employeeId)
      .single();

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

    generateUniformReceipt({
      employeeName: employee.nome_completo,
      employeeCpf: employee.cpf || "Não informado",
      employeeRole: employee.cargo,
      tipoUniforme: uniforme.tipo_uniforme,
      tamanho: uniforme.tamanho,
      quantidade: uniforme.quantidade,
      dataEntrega: uniforme.data_entrega,
      observacoes: uniforme.observacoes,
      assinatura: uniforme.assinatura_funcionario,
      empresaNome,
      empresaCnpj,
    });

    toast.success("Recibo gerado com sucesso!");
  };

  const getSignatureStatus = (uniforme: any) => {
    if (!uniforme.assinatura_funcionario) {
      return { text: "Pendente de assinatura", color: "text-yellow-600", signed: false };
    }
    if (uniforme.assinatura_funcionario === "ASSINATURA_FISICA") {
      return { text: "✓ Assinado fisicamente", color: "text-green-600", signed: true };
    }
    return { text: "✓ Assinado digitalmente", color: "text-green-600", signed: true };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h3 className="text-lg font-semibold">Uniformes Entregues</h3>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-2" />
          Registrar Uniforme
        </Button>
      </div>

      {showForm && (
        <UniformForm
          employeeId={employeeId}
          onSaved={handleSaved}
          onCancel={() => setShowForm(false)}
        />
      )}

      {uniformes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum uniforme registrado
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {uniformes.map((uniforme) => {
            const signatureStatus = getSignatureStatus(uniforme);
            return (
              <Card key={uniforme.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shirt className="w-4 h-4" />
                      {uniforme.tipo_uniforme}
                    </CardTitle>
                    <div className="flex flex-wrap gap-2">
                      {!signatureStatus.signed && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkAsPhysicallySigned(uniforme.id)}
                          title="Marcar como assinado fisicamente"
                        >
                          <PenLine className="w-4 h-4 mr-1" />
                          Assinatura Física
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleReprintReceipt(uniforme)}
                        title="Reimprimir Recibo"
                      >
                        <FileDown className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(uniforme.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Tamanho</p>
                      <p className="font-medium">{uniforme.tamanho}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Quantidade</p>
                      <p className="font-medium">{uniforme.quantidade}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Data de Entrega</p>
                      <p className="font-medium">
                        {dataBR(uniforme.data_entrega).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="col-span-3">
                      <p className="text-muted-foreground">Status da Assinatura</p>
                      <p className={`font-medium ${signatureStatus.color}`}>{signatureStatus.text}</p>
                    </div>
                    {uniforme.observacoes && (
                      <div className="col-span-3">
                        <p className="text-muted-foreground">Observações</p>
                        <p className="font-medium">{uniforme.observacoes}</p>
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

export default UniformTab;
