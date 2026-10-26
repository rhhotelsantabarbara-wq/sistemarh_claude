import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  calcularResumoFerias,
  dataLocal,
  diasEntre,
  hojeLocal,
  periodoParaLancamento,
  type RegistroFerias,
} from "@/lib/feriasCalculo";

interface ApproveVacationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plannedVacation: {
    id: string;
    employee_id: string;
    periodo_inicio: string;
    periodo_fim: string;
    employee_name?: string;
  } | null;
  onSuccess: () => void;
}

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const br = (d: Date | null) => (d ? format(d, "dd/MM/yyyy", { locale: ptBR }) : "—");

// Aprovação em um passo: o período aquisitivo vem calculado (pode ser ajustado) e as datas
// já são as da programação. Grava em "ferias" e remove a programação.
export function ApproveVacationDialog({ open, onOpenChange, plannedVacation, onSuccess }: ApproveVacationDialogProps) {
  const [nome, setNome] = useState("");
  const [aqInicio, setAqInicio] = useState("");
  const [aqFim, setAqFim] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const inicio = dataLocal(plannedVacation?.periodo_inicio);
  const fim = dataLocal(plannedVacation?.periodo_fim);
  const dias = inicio && fim ? diasEntre(inicio, fim) : 0;

  useEffect(() => {
    if (!open || !plannedVacation) return;
    (async () => {
      setCarregando(true);
      const [{ data: emp }, { data: registros }] = await Promise.all([
        supabase.from("employees").select("nome_completo, data_admissao").eq("id", plannedVacation.employee_id).single(),
        supabase
          .from("ferias")
          .select("id, employee_id, periodo_aquisitivo_inicio, periodo_aquisitivo_fim, periodo_gozo_inicio, periodo_gozo_fim, dias_totais")
          .eq("employee_id", plannedVacation.employee_id),
      ]);
      setNome(emp?.nome_completo || plannedVacation.employee_name || "");
      const resumo = calcularResumoFerias(emp?.data_admissao, (registros || []) as RegistroFerias[], []);
      const sugerido = periodoParaLancamento(resumo);
      setAqInicio(sugerido ? iso(sugerido.inicio) : "");
      setAqFim(sugerido ? iso(sugerido.fim) : "");
      setCarregando(false);
    })();
  }, [open, plannedVacation]);

  const aprovar = async () => {
    if (!plannedVacation || !inicio || !fim) return;
    if (!aqInicio || !aqFim) {
      toast.error("Informe o período aquisitivo");
      return;
    }
    setSalvando(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("ferias").insert({
      employee_id: plannedVacation.employee_id,
      periodo_aquisitivo_inicio: aqInicio,
      periodo_aquisitivo_fim: aqFim,
      periodo_gozo_inicio: iso(inicio),
      periodo_gozo_fim: iso(fim),
      dias_totais: dias,
      created_by: user?.id,
    } as any);
    if (error) {
      setSalvando(false);
      console.error("Aprovar férias:", error);
      toast.error("Erro ao aprovar as férias");
      return;
    }
    await supabase.from("ferias_planejadas").delete().eq("id", plannedVacation.id);

    // Se as férias já começaram, o colaborador passa a constar como "de férias"
    const hoje = hojeLocal();
    if (inicio <= hoje && fim >= hoje) {
      await supabase.from("employees").update({ status: "ferias" }).eq("id", plannedVacation.employee_id).eq("status", "ativo");
    }
    setSalvando(false);
    toast.success("Férias aprovadas!");
    onSuccess();
    onOpenChange(false);
  };

  if (!plannedVacation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Aprovar férias</DialogTitle>
          <DialogDescription>{nome || "Carregando…"}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <div className="text-sm text-muted-foreground">Férias</div>
            <div className="text-lg font-semibold">{br(inicio)} a {br(fim)}</div>
            <div className="text-sm">{dias} dias</div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Período aquisitivo</legend>
            <p className="text-xs text-muted-foreground">
              Calculado pela data de admissão e pelas férias já lançadas. Ajuste só se precisar.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="aq-inicio">Início</Label>
                <Input id="aq-inicio" type="date" value={aqInicio} disabled={carregando} onChange={(e) => setAqInicio(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="aq-fim">Fim</Label>
                <Input id="aq-fim" type="date" value={aqFim} disabled={carregando} onChange={(e) => setAqFim(e.target.value)} />
              </div>
            </div>
          </fieldset>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={aprovar} disabled={carregando || salvando}>
            {salvando ? "Aprovando…" : "Aprovar férias"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
