import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import EpiForm from "@/components/forms/EpiForm";
import EpiDistributionHistory from "@/components/stock/EpiDistributionHistory";

interface EmployeeOption {
  id: string;
  nome_completo: string;
  cargo: string | null;
}

const DistribuirEpi = () => {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, nome_completo, cargo")
        .in("status", ["ativo", "ferias"])
        .order("nome_completo");
      setEmployees(data || []);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium leading-tight">Distribuir EPI</h1>
          <p className="text-sm text-muted-foreground">
            Entregue EPIs do estoque aos colaboradores e gere o recibo assinado
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Entrega
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nova Entrega de EPI</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome_completo.toUpperCase()}
                      {e.cargo ? ` — ${e.cargo}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedEmployee ? (
              <EpiForm
                key={selectedEmployee}
                employeeId={selectedEmployee}
                onSaved={() => {
                  setShowForm(false);
                  setSelectedEmployee("");
                  setRefresh((v) => v + 1);
                }}
                onCancel={() => {
                  setShowForm(false);
                  setSelectedEmployee("");
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Selecione um colaborador para continuar.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="historico">
        <TabsList>
          <TabsTrigger value="historico">Entregas realizadas</TabsTrigger>
        </TabsList>
        <TabsContent value="historico" className="pt-4">
          <EpiDistributionHistory key={refresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DistribuirEpi;
