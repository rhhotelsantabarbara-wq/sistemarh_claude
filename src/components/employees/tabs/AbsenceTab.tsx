import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { abrirDocumentoAfastamento } from "@/components/afastamentos/AtestadosRecebidos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, FileText, Download, Eye } from "lucide-react";
import AbsenceForm from "@/components/forms/AbsenceForm";
import { formatDateOnlyPtBR } from "@/lib/date";

interface AbsenceTabProps {
  employeeId: string;
}

const AbsenceTab = ({ employeeId }: AbsenceTabProps) => {
  const [afastamentos, setAfastamentos] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchAfastamentos();
  }, [employeeId]);

  const fetchAfastamentos = async () => {
    const { data } = await supabase
      .from("afastamentos")
      .select("*")
      .eq("employee_id", employeeId)
      .order("data_inicio", { ascending: false });

    setAfastamentos(data || []);
  };

  const handleSaved = () => {
    setShowForm(false);
    fetchAfastamentos();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Afastamentos / Atestados</h3>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-2" />
          Registrar Afastamento
        </Button>
      </div>

      {showForm && (
        <AbsenceForm
          employeeId={employeeId}
          onSaved={handleSaved}
          onCancel={() => setShowForm(false)}
        />
      )}

      {afastamentos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum afastamento registrado
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {afastamentos.map((afastamento) => (
            <Card key={afastamento.id}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Afastamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-muted-foreground">Data Início</p>
                      <p className="font-medium">
                        {formatDateOnlyPtBR(afastamento.data_inicio)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Data Fim</p>
                      <p className="font-medium">
                        {formatDateOnlyPtBR(afastamento.data_fim)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Motivo</p>
                    <p className="font-medium">{afastamento.motivo}</p>
                  </div>
                  {afastamento.cid && (
                    <div>
                      <p className="text-muted-foreground">CID</p>
                      <p className="font-medium">{afastamento.cid}</p>
                    </div>
                  )}
                  {afastamento.documento_url && (
                    <div>
                      <p className="text-muted-foreground mb-2">Atestado</p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => abrirDocumentoAfastamento(afastamento.documento_url)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Visualizar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => abrirDocumentoAfastamento(afastamento.documento_url, true)}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Baixar
                        </Button>
                      </div>
                    </div>
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

export default AbsenceTab;
