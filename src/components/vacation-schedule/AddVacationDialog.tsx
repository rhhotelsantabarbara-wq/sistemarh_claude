import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Info } from "lucide-react";
import {
  calcularResumoFerias,
  dataLocal,
  diasEntre,
  hojeLocal,
  type FeriasPlanejada,
  type RegistroFerias,
  type ResumoFerias,
} from "@/lib/feriasCalculo";

interface AddVacationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  onSuccess: () => void;
  employeeIdInicial?: string | null;
}

interface Colega {
  nome: string;
  inicio: string;
  fim: string;
}

const br = (d: Date | null | undefined) => (d ? format(d, "dd/MM/yyyy", { locale: ptBR }) : "—");

export function AddVacationDialog({
  open,
  onOpenChange,
  selectedDate,
  onSuccess,
  employeeIdInicial,
}: AddVacationDialogProps) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [observations, setObservations] = useState("");
  const [loading, setLoading] = useState(false);
  const [resumo, setResumo] = useState<ResumoFerias | null>(null);
  const [ausenciasSetor, setAusenciasSetor] = useState<(Colega & { employee_id: string })[]>([]);

  const diasTotais = useMemo(() => {
    const i = dataLocal(startDate);
    const f = dataLocal(endDate);
    if (!i || !f) return 0;
    const d = diasEntre(i, f);
    return d > 0 ? d : 0;
  }, [startDate, endDate]);

  useEffect(() => {
    if (!open) return;
    fetchEmployees();
    if (employeeIdInicial) setSelectedEmployee(employeeIdInicial);
    if (selectedDate) {
      setStartDate(format(selectedDate, "yyyy-MM-dd"));
      setEndDate(format(addDays(selectedDate, 29), "yyyy-MM-dd"));
    }
  }, [open, selectedDate, employeeIdInicial]);

  // Ao escolher o colaborador: calcula o saldo e busca quem do mesmo setor já tem férias marcadas
  useEffect(() => {
    if (!open || !selectedEmployee) {
      setResumo(null);
      setAusenciasSetor([]);
      return;
    }
    (async () => {
      const emp = employees.find((e) => e.id === selectedEmployee);
      const [{ data: empData }, { data: registros }, { data: planejadas }] = await Promise.all([
        supabase.from("employees").select("data_admissao, setor").eq("id", selectedEmployee).single(),
        supabase
          .from("ferias")
          .select("id, employee_id, periodo_aquisitivo_inicio, periodo_aquisitivo_fim, periodo_gozo_inicio, periodo_gozo_fim, dias_totais")
          .eq("employee_id", selectedEmployee),
        supabase.from("ferias_planejadas").select("id, employee_id, periodo_inicio, periodo_fim, dias_totais, status").eq("employee_id", selectedEmployee),
      ]);
      setResumo(calcularResumoFerias(empData?.data_admissao, (registros || []) as RegistroFerias[], (planejadas || []) as FeriasPlanejada[]));

      const setor = empData?.setor || emp?.setor;
      if (!setor) { setAusenciasSetor([]); return; }
      const { data: colegas } = await supabase.from("employees").select("id, nome_completo").eq("setor", setor).neq("id", selectedEmployee).neq("status", "demitido");
      const ids = (colegas || []).map((c: any) => c.id);
      if (ids.length === 0) { setAusenciasSetor([]); return; }
      const nomes = new Map((colegas || []).map((c: any) => [c.id, c.nome_completo]));
      const hoje = format(new Date(), "yyyy-MM-dd");
      const [{ data: fer }, { data: plan }] = await Promise.all([
        supabase.from("ferias").select("employee_id, periodo_gozo_inicio, periodo_gozo_fim").in("employee_id", ids).gte("periodo_gozo_fim", hoje),
        supabase.from("ferias_planejadas").select("employee_id, periodo_inicio, periodo_fim").in("employee_id", ids).gte("periodo_fim", hoje),
      ]);
      setAusenciasSetor([
        ...(fer || []).map((f: any) => ({ employee_id: f.employee_id, nome: nomes.get(f.employee_id) || "", inicio: f.periodo_gozo_inicio, fim: f.periodo_gozo_fim })),
        ...(plan || []).map((p: any) => ({ employee_id: p.employee_id, nome: nomes.get(p.employee_id) || "", inicio: p.periodo_inicio, fim: p.periodo_fim })),
      ]);
    })();
  }, [open, selectedEmployee, employees]);

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from("employees")
      .select("id, nome_completo, setor")
      .in("status", ["ativo", "ferias", "afastado"])
      .order("nome_completo");
    if (data) setEmployees(data);
  };

  const handleStartDateChange = (newStartDate: string) => {
    setStartDate(newStartDate);
    const i = dataLocal(newStartDate);
    if (i) {
      const dias = resumo?.periodoPendente?.saldo || 30;
      setEndDate(format(addDays(i, dias - 1), "yyyy-MM-dd"));
    }
  };

  // Avisos (não impedem salvar)
  const avisos = useMemo(() => {
    const lista: { tipo: "alerta" | "info"; texto: string }[] = [];
    const inicio = dataLocal(startDate);
    const fim = dataLocal(endDate);
    if (!inicio || !fim || diasTotais <= 0) return lista;
    const hoje = hojeLocal();
    const p = resumo?.periodoPendente;

    if (resumo && !p) {
      if (resumo.situacao === "em_aquisicao" && resumo.periodoAtual) {
        lista.push({ tipo: "alerta", texto: `Ainda não completou 12 meses de casa (completa em ${br(addDays(resumo.periodoAtual.fim, 1))}). Férias antes disso são antecipação.` });
      } else if (resumo.situacao !== "sem_admissao") {
        lista.push({ tipo: "info", texto: "Não há saldo pendente: estas férias serão do período aquisitivo atual (antecipação)." });
      }
    }
    if (p && diasTotais > resumo!.saldoTotal) {
      lista.push({ tipo: "alerta", texto: `São ${diasTotais} dias, mas o saldo é de ${resumo!.saldoTotal} dias.` });
    }
    if (p && diasTotais < p.saldo) {
      lista.push({ tipo: "info", texto: `Ficam ${p.saldo - diasTotais} dias de saldo deste período para depois.` });
    }
    if (p && fim > p.limite) {
      const fora = Math.min(diasTotais, differenceInCalendarDays(fim, p.limite));
      lista.push({ tipo: "alerta", texto: `Passa do prazo (${br(p.limite)}): ${fora} dia(s) fora do prazo são pagos em dobro.` });
    }
    if (differenceInCalendarDays(inicio, hoje) < 30) {
      lista.push({ tipo: "info", texto: "Começa em menos de 30 dias: a CLT pede aviso de férias com 30 dias de antecedência." });
    }
    const choques = ausenciasSetor.filter((c) => {
      const ci = dataLocal(c.inicio);
      const cf = dataLocal(c.fim);
      return ci && cf && ci <= fim && cf >= inicio;
    });
    if (choques.length > 0) {
      const nomes = Array.from(new Set(choques.map((c) => c.nome.split(" ")[0]))).join(", ");
      lista.push({ tipo: "alerta", texto: `Mesmo setor de férias no período: ${nomes}.` });
    }
    return lista;
  }, [startDate, endDate, diasTotais, resumo, ausenciasSetor]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !startDate || !endDate) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setLoading(true);
    // Horário de meio-dia para evitar problemas de fuso
    const { error } = await supabase.from("ferias_planejadas").insert({
      employee_id: selectedEmployee,
      periodo_inicio: `${startDate}T12:00:00`,
      periodo_fim: `${endDate}T12:00:00`,
      dias_totais: diasTotais,
      status: "planejado",
      observacoes: observations,
      criado_por: (await supabase.auth.getUser()).data.user?.id,
    });
    setLoading(false);
    if (error) {
      toast.error("Erro ao programar férias");
      return;
    }
    toast.success("Férias programadas. Falta aprovar.");
    onSuccess();
    resetForm();
  };

  const resetForm = () => {
    setSelectedEmployee("");
    setStartDate("");
    setEndDate("");
    setObservations("");
    setResumo(null);
  };

  const p = resumo?.periodoPendente;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Programar férias</DialogTitle>
          <DialogDescription>Depois é só aprovar com um clique na aba Controle.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="employee">Colaborador</Label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger id="employee">
                <SelectValue placeholder="Selecione o colaborador" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.nome_completo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {resumo && (
            <div className="rounded-lg border bg-muted/50 p-3 text-sm">
              {p ? (
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  <span><span className="text-muted-foreground">Saldo:</span> <strong>{resumo.saldoTotal} dias</strong></span>
                  <span><span className="text-muted-foreground">Período:</span> {br(p.inicio)} a {br(p.fim)}</span>
                  <span><span className="text-muted-foreground">Tirar até:</span> <strong>{br(p.limite)}</strong></span>
                </div>
              ) : resumo.situacao === "sem_admissao" ? (
                <span className="text-muted-foreground">Sem data de admissão no cadastro: não dá para calcular o saldo.</span>
              ) : (
                <span className="text-muted-foreground">Sem saldo pendente.</span>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Início</Label>
              <Input id="startDate" type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Fim</Label>
              <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>

          {diasTotais > 0 && (
            <div className="text-sm font-medium">
              Total: <span className="text-lg">{diasTotais}</span> {diasTotais === 1 ? "dia" : "dias"}
            </div>
          )}

          {avisos.length > 0 && (
            <ul className="space-y-2">
              {avisos.map((a, i) => (
                <li
                  key={i}
                  className={`flex gap-2 rounded-md p-2.5 text-sm ${a.tipo === "alerta" ? "bg-orange-50 text-orange-900 dark:bg-orange-950 dark:text-orange-100" : "bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100"}`}
                >
                  {a.tipo === "alerta" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Info className="mt-0.5 h-4 w-4 shrink-0" />}
                  <span>{a.texto}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2">
            <Label htmlFor="observations">Observações</Label>
            <Textarea id="observations" value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="Opcional" />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || diasTotais === 0}>
              {loading ? "Salvando..." : "Programar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
