import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { addYears, differenceInDays, format } from "date-fns";
import { dataBR } from "@/lib/date";

interface EditVacationDialogProps {
  vacation: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

const EditVacationDialog = ({
  vacation,
  open,
  onOpenChange,
  onUpdated,
}: EditVacationDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [periodoAquisitivoInicio, setPeriodoAquisitivoInicio] = useState("");
  const [periodoAquisitivoFim, setPeriodoAquisitivoFim] = useState("");
  const [periodoGozoInicio, setPeriodoGozoInicio] = useState("");
  const [periodoGozoFim, setPeriodoGozoFim] = useState("");
  const [diasCalculados, setDiasCalculados] = useState(0);

  // Sincroniza os estados quando o vacation prop mudar ou o dialog abrir
  useEffect(() => {
    if (vacation && open) {
      setPeriodoAquisitivoInicio(vacation.periodo_aquisitivo_inicio ?? "");
      setPeriodoAquisitivoFim(vacation.periodo_aquisitivo_fim ?? "");
      setPeriodoGozoInicio(vacation.periodo_gozo_inicio ?? "");
      setPeriodoGozoFim(vacation.periodo_gozo_fim ?? "");
      setDiasCalculados(vacation.dias_totais ?? 0);
    }
  }, [vacation, open]);

  const handlePeriodoAquisitivoInicioChange = (dateString: string) => {
    setPeriodoAquisitivoInicio(dateString);
    if (dateString) {
      const startDate = dataBR(dateString);
      const endDate = addYears(startDate, 1);
      const formattedEndDate = format(endDate, "yyyy-MM-dd");
      setPeriodoAquisitivoFim(formattedEndDate);
    }
  };

  const handlePeriodoGozoChange = (inicio?: string, fim?: string) => {
    const inicioDate = inicio || periodoGozoInicio;
    const fimDate = fim || periodoGozoFim;

    if (inicioDate && fimDate) {
      const start = dataBR(inicioDate);
      const end = dataBR(fimDate);
      const days = differenceInDays(end, start) + 1;
      setDiasCalculados(days > 0 ? days : 0);
    } else {
      setDiasCalculados(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    // Adiciona horário meio-dia para evitar problemas de timezone
    const { error } = await supabase
      .from("ferias")
      .update({
        periodo_aquisitivo_inicio: `${periodoAquisitivoInicio}T12:00:00`,
        periodo_aquisitivo_fim: `${periodoAquisitivoFim}T12:00:00`,
        periodo_gozo_inicio: `${periodoGozoInicio}T12:00:00`,
        periodo_gozo_fim: `${periodoGozoFim}T12:00:00`,
        dias_totais: diasCalculados,
      })
      .eq("id", vacation.id);

    setLoading(false);
    if (error) {
      toast.error("Erro ao atualizar férias");
    } else {
      toast.success("Férias atualizadas!");
      onUpdated();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Férias</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Período Aquisitivo - Início</Label>
                <Input
                  type="date"
                  value={periodoAquisitivoInicio}
                  onChange={(e) =>
                    handlePeriodoAquisitivoInicioChange(e.target.value)
                  }
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
                      setPeriodoGozoInicio(e.target.value);
                      handlePeriodoGozoChange(e.target.value, undefined);
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
                    Total de dias:{" "}
                    <span className="text-lg">{diasCalculados}</span>{" "}
                    {diasCalculados === 1 ? "dia" : "dias"}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading || diasCalculados === 0}>
              Salvar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditVacationDialog;
