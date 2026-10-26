import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { addYears, differenceInDays, format, addDays } from "date-fns";

interface VacationFormProps {
  employeeId: string;
  onSaved: () => void;
  onCancel: () => void;
  initialData?: {
    periodoGozoInicio?: string;
    periodoGozoFim?: string;
  };
}

const VacationForm = ({ employeeId, onSaved, onCancel, initialData }: VacationFormProps) => {
  const [loading, setLoading] = useState(false);
  const [periodoAquisitivoInicio, setPeriodoAquisitivoInicio] = useState("");
  const [periodoAquisitivoFim, setPeriodoAquisitivoFim] = useState("");
  const [periodoGozoInicio, setPeriodoGozoInicio] = useState("");
  const [periodoGozoFim, setPeriodoGozoFim] = useState("");
  const [diasCalculados, setDiasCalculados] = useState(0);
  const [usarFolgas, setUsarFolgas] = useState(false);
  const [diasFolgas, setDiasFolgas] = useState(0);
  const [folgasDisponiveis, setFolgasDisponiveis] = useState(0);

  useEffect(() => {
    fetchEmployeeFolgas();
    
    // Preencher dados iniciais se fornecidos
    if (initialData) {
      if (initialData.periodoGozoInicio) {
        setPeriodoGozoInicio(initialData.periodoGozoInicio);
      }
      if (initialData.periodoGozoFim) {
        setPeriodoGozoFim(initialData.periodoGozoFim);
      }
      if (initialData.periodoGozoInicio && initialData.periodoGozoFim) {
        handlePeriodoGozoChange(initialData.periodoGozoInicio, initialData.periodoGozoFim);
      }
    }
  }, [employeeId, initialData]);

  const fetchEmployeeFolgas = async () => {
    const { data } = await supabase
      .from("employees")
      .select("quantidade_folgas")
      .eq("id", employeeId)
      .single();

    if (data) {
      setFolgasDisponiveis(data.quantidade_folgas || 0);
    }
  };

  const handlePeriodoAquisitivoInicioChange = (dateString: string) => {
    setPeriodoAquisitivoInicio(dateString);
    if (dateString) {
      const startDate = new Date(dateString);
      const endDate = addYears(startDate, 1);
      const formattedEndDate = format(endDate, 'yyyy-MM-dd');
      setPeriodoAquisitivoFim(formattedEndDate);
    }
  };

  const handlePeriodoGozoChange = (inicio?: string, fim?: string) => {
    const inicioDate = inicio || periodoGozoInicio;
    const fimDate = fim || periodoGozoFim;
    
    if (inicioDate && fimDate) {
      const start = new Date(inicioDate);
      const end = new Date(fimDate);
      const days = differenceInDays(end, start) + 1;
      setDiasCalculados(days > 0 ? days : 0);
    } else {
      setDiasCalculados(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    // Calculate final end date with time off days
    let finalEndDate = periodoGozoFim;
    let totalDays = diasCalculados;
    
    if (usarFolgas && diasFolgas > 0) {
      const endDate = new Date(periodoGozoFim);
      const newEndDate = addDays(endDate, diasFolgas);
      finalEndDate = format(newEndDate, 'yyyy-MM-dd');
      totalDays = diasCalculados + diasFolgas;
    }

    // Insert vacation record - Adiciona horário meio-dia para evitar problemas de timezone
    const { error: feriaError } = await supabase.from("ferias").insert({
      employee_id: employeeId,
      periodo_aquisitivo_inicio: `${periodoAquisitivoInicio}T12:00:00`,
      periodo_aquisitivo_fim: `${periodoAquisitivoFim}T12:00:00`,
      periodo_gozo_inicio: `${periodoGozoInicio}T12:00:00`,
      periodo_gozo_fim: `${finalEndDate}T12:00:00`,
      dias_totais: totalDays,
    });

    if (feriaError) {
      setLoading(false);
      toast.error("Erro ao salvar férias");
      return;
    }

    // Só marca "de férias" se as férias já começaram (as futuras viram status automaticamente no dia)
    const hojeStr = format(new Date(), "yyyy-MM-dd");
    const comecou = periodoGozoInicio <= hojeStr && finalEndDate >= hojeStr;
    const { error: statusError } = comecou
      ? await supabase.from("employees").update({ status: "ferias" }).eq("id", employeeId)
      : { error: null };

    if (statusError) {
      setLoading(false);
      toast.error("Férias registradas, mas erro ao atualizar status");
      return;
    }

    // If using time off, deduct from employee's balance
    if (usarFolgas && diasFolgas > 0) {
      const { data: { user } } = await supabase.auth.getUser();
      const novaQuantidade = folgasDisponiveis - diasFolgas;

      // Update employee time off balance
      const { error: folgasError } = await supabase
        .from("employees")
        .update({ 
          quantidade_folgas: novaQuantidade,
          ultima_alteracao_folgas: new Date().toISOString()
        })
        .eq("id", employeeId);

      if (folgasError) {
        setLoading(false);
        toast.error("Férias registradas, mas erro ao atualizar folgas");
        return;
      }

      // Record in time off history
      const { error: historicoError } = await supabase
        .from("historico_folgas")
        .insert({
          employee_id: employeeId,
          quantidade_anterior: folgasDisponiveis,
          quantidade_nova: novaQuantidade,
          alterado_por: user?.id,
          observacao: `Folgas utilizadas em férias (${diasFolgas} dias)`,
        });

      if (historicoError) {
        console.error("Error recording time off history:", historicoError);
      }
    }

    setLoading(false);
    toast.success("Férias registradas e status atualizado!");
    onSaved();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar Férias</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Período Aquisitivo - Início</Label>
                <Input
                  type="date"
                  value={periodoAquisitivoInicio}
                  onChange={(e) => handlePeriodoAquisitivoInicioChange(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Período Aquisitivo - Fim</Label>
                <Input
                  type="date"
                  value={periodoAquisitivoFim}
                  onChange={(e) => setPeriodoAquisitivoFim(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Período de Gozo</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data de Início</Label>
                  <Input
                    type="date"
                    value={periodoGozoInicio}
                    onChange={(e) => {
                      const novaDataInicio = e.target.value;
                      setPeriodoGozoInicio(novaDataInicio);
                      
                      // Auto-preencher data final 30 dias depois
                      if (novaDataInicio) {
                        const dataInicio = new Date(novaDataInicio);
                        const dataFim = addDays(dataInicio, 29); // 30 dias incluindo o primeiro
                        const dataFimFormatada = format(dataFim, 'yyyy-MM-dd');
                        setPeriodoGozoFim(dataFimFormatada);
                        handlePeriodoGozoChange(novaDataInicio, dataFimFormatada);
                      } else {
                        handlePeriodoGozoChange(novaDataInicio, undefined);
                      }
                    }}
                    required
                  />
                </div>
                <div>
                  <Label>Data de Fim</Label>
                  <Input
                    type="date"
                    value={periodoGozoFim}
                    onChange={(e) => {
                      setPeriodoGozoFim(e.target.value);
                      handlePeriodoGozoChange(undefined, e.target.value);
                    }}
                    required
                  />
                </div>
              </div>
              {diasCalculados > 0 && (
                <div className="mt-3 p-3 bg-primary/10 rounded-md">
                  <p className="text-sm font-medium">
                    Total de dias de férias: <span className="text-lg">{diasCalculados}</span> {diasCalculados === 1 ? 'dia' : 'dias'}
                  </p>
                </div>
              )}
            </div>

            {/* Time Off Section */}
            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="usar-folgas" 
                  checked={usarFolgas}
                  onCheckedChange={(checked) => {
                    setUsarFolgas(checked as boolean);
                    if (!checked) setDiasFolgas(0);
                  }}
                />
                <label
                  htmlFor="usar-folgas"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Adicionar folgas acumuladas às férias
                </label>
              </div>

              {usarFolgas && (
                <div className="space-y-3 pl-6">
                  <p className="text-sm text-muted-foreground">
                    Folgas disponíveis: <span className="font-semibold">{folgasDisponiveis} dias</span>
                  </p>
                  <div>
                    <Label>Quantidade de dias de folga a usar</Label>
                    <Input
                      type="number"
                      min="0"
                      max={folgasDisponiveis}
                      value={diasFolgas}
                      onChange={(e) => setDiasFolgas(parseInt(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  {diasFolgas > 0 && (
                    <div className="p-3 bg-secondary/20 rounded-md space-y-1">
                      <p className="text-sm">
                        <span className="text-muted-foreground">Dias de férias:</span>{" "}
                        <span className="font-medium">{diasCalculados} dias</span>
                      </p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">+ Folgas:</span>{" "}
                        <span className="font-medium">{diasFolgas} dias</span>
                      </p>
                      <p className="text-sm font-bold border-t pt-1">
                        Total: {diasCalculados + diasFolgas} dias
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Nova data de retorno: {periodoGozoFim && format(addDays(new Date(periodoGozoFim), diasFolgas), 'dd/MM/yyyy')}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading || diasCalculados === 0 || (usarFolgas && diasFolgas > folgasDisponiveis)}>
              Salvar
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

export default VacationForm;
