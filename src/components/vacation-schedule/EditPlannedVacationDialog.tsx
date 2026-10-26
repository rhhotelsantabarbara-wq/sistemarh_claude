import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { differenceInDays, format, addDays } from "date-fns";
import { dataBR } from "@/lib/date";

interface EditPlannedVacationDialogProps {
  vacation: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

const EditPlannedVacationDialog = ({
  vacation,
  open,
  onOpenChange,
  onUpdated,
}: EditPlannedVacationDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Sincroniza os estados quando o vacation prop mudar ou o dialog abrir
  useEffect(() => {
    if (vacation && open) {
      // Férias planejadas usam periodo_inicio/periodo_fim
      // Férias confirmadas usam periodo_gozo_inicio/periodo_gozo_fim
      setPeriodoInicio(vacation.periodo_inicio || vacation.periodo_gozo_inicio || "");
      setPeriodoFim(vacation.periodo_fim || vacation.periodo_gozo_fim || "");
      setObservacoes(vacation.observacoes || "");
    }
  }, [vacation, open]);

  // Calcular dias totais
  const diasCalculados = useMemo(() => {
    if (periodoInicio && periodoFim) {
      const start = dataBR(periodoInicio);
      const end = dataBR(periodoFim);
      const days = differenceInDays(end, start) + 1;
      return days > 0 ? days : 0;
    }
    return 0;
  }, [periodoInicio, periodoFim]);

  const handleStartDateChange = (newStartDate: string) => {
    setPeriodoInicio(newStartDate);
    if (newStartDate) {
      const start = dataBR(newStartDate);
      const end = addDays(start, 29); // 30 dias incluindo o primeiro
      setPeriodoFim(format(end, "yyyy-MM-dd"));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    // Determinar qual tabela atualizar baseado no status
    const isPlanned = vacation.status === "planejado";
    const tableName = isPlanned ? "ferias_planejadas" : "ferias";
    
    let updateData: any;
    
    // Adiciona horário meio-dia para evitar problemas de timezone
    if (isPlanned) {
      updateData = {
        periodo_inicio: `${periodoInicio}T12:00:00`,
        periodo_fim: `${periodoFim}T12:00:00`,
        dias_totais: diasCalculados,
        observacoes: observacoes,
      };
    } else {
      updateData = {
        periodo_gozo_inicio: `${periodoInicio}T12:00:00`,
        periodo_gozo_fim: `${periodoFim}T12:00:00`,
        dias_totais: diasCalculados,
      };
    }

    const { error } = await supabase
      .from(tableName)
      .update(updateData)
      .eq("id", vacation.id);

    setLoading(false);
    
    if (error) {
      console.error("Erro ao atualizar férias:", error);
      toast.error("Erro ao atualizar férias");
    } else {
      toast.success("Férias atualizadas!");
      onUpdated();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Férias</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data de Início</Label>
              <Input
                type="date"
                value={periodoInicio}
                onChange={(e) => handleStartDateChange(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Data de Fim</Label>
              <Input
                type="date"
                value={periodoFim}
                onChange={(e) => setPeriodoFim(e.target.value)}
                required
              />
            </div>
          </div>

          {diasCalculados > 0 && (
            <div className="p-3 bg-primary/10 rounded-md">
              <p className="text-sm font-medium">
                Total de dias: <span className="text-lg">{diasCalculados}</span>{" "}
                {diasCalculados === 1 ? "dia" : "dias"}
              </p>
            </div>
          )}

          {vacation?.status === "planejado" && (
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Observações sobre as férias..."
                rows={3}
              />
            </div>
          )}

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

export default EditPlannedVacationDialog;
