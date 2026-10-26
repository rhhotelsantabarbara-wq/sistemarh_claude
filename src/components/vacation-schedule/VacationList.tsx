import { useEffect, useMemo, useState } from "react";
import { format, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Pencil, Search, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ApproveVacationDialog } from "./ApproveVacationDialog";
import EditPlannedVacationDialog from "./EditPlannedVacationDialog";
import { dataLocal, diasEntre, hojeLocal } from "@/lib/feriasCalculo";
import type { VacationFiltersType } from "./types";

interface VacationListProps {
  filters: VacationFiltersType;
  onRefresh: () => void;
}

type StatusLancamento = "planejado" | "aprovado" | "em_andamento" | "concluido";

interface Lancamento {
  id: string;
  employee_id: string;
  employee_name: string;
  setor: string;
  empresa_nome: string;
  periodo_inicio: string;
  periodo_fim: string;
  inicio: Date;
  fim: Date;
  dias_totais: number;
  status: StatusLancamento;
  aquisitivo_inicio: Date | null;
  aquisitivo_fim: Date | null;
  observacoes?: string | null;
}

const STATUS: Record<StatusLancamento, { rotulo: string; pill: string; avatar: string }> = {
  em_andamento: { rotulo: "Em andamento", pill: "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950 dark:text-violet-200 dark:border-violet-800", avatar: "bg-violet-600 text-white" },
  planejado: { rotulo: "Aguardando aprovação", pill: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800", avatar: "bg-blue-600 text-white" },
  aprovado: { rotulo: "Aprovada", pill: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800", avatar: "bg-emerald-600 text-white" },
  concluido: { rotulo: "Concluída", pill: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600", avatar: "bg-slate-400 text-white dark:bg-slate-600" },
};

const FILTROS_STATUS: { valor: "todos" | StatusLancamento; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todas" },
  { valor: "em_andamento", rotulo: "Em andamento" },
  { valor: "planejado", rotulo: "Aguardando aprovação" },
  { valor: "aprovado", rotulo: "Aprovadas" },
  { valor: "concluido", rotulo: "Concluídas" },
];

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const dm = (d: Date) => format(d, "dd/MM", { locale: ptBR });
const dmy = (d: Date) => format(d, "dd/MM/yyyy", { locale: ptBR });
const dmyCurto = (d: Date) => format(d, "dd/MM/yy", { locale: ptBR });

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] || "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

export function VacationList({ filters, onRefresh }: VacationListProps) {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<"todos" | StatusLancamento>("todos");
  const [ano, setAno] = useState<string>(String(filters.ano || new Date().getFullYear()));
  const [mes, setMes] = useState<string>("all");

  const [aprovar, setAprovar] = useState<Lancamento | null>(null);
  const [editar, setEditar] = useState<Lancamento | null>(null);
  const [excluir, setExcluir] = useState<Lancamento | null>(null);

  useEffect(() => {
    carregar();
  }, [filters.empresa, filters.setor]);

  const carregar = async () => {
    setLoading(true);
    let empQuery = supabase.from("employees").select("id, nome_completo, setor, empresa_id, empresas(nome)");
    if (filters.empresa && filters.empresa !== "all") empQuery = empQuery.eq("empresa_id", filters.empresa);
    if (filters.setor && filters.setor !== "all") empQuery = empQuery.eq("setor", filters.setor);

    const [empRes, planRes, ferRes] = await Promise.all([
      empQuery,
      supabase.from("ferias_planejadas").select("*"),
      supabase.from("ferias").select("*"),
    ]);
    if (empRes.error || planRes.error || ferRes.error) {
      console.error("Lançamentos de férias:", empRes.error || planRes.error || ferRes.error);
      toast.error("Erro ao carregar as férias");
      setLoading(false);
      return;
    }

    const emps = new Map<string, any>((empRes.data || []).map((e: any) => [e.id, e]));
    const hoje = hojeLocal();
    const lista: Lancamento[] = [];

    for (const p of planRes.data || []) {
      const e = emps.get(p.employee_id);
      const inicio = dataLocal(p.periodo_inicio);
      const fim = dataLocal(p.periodo_fim);
      if (!e || !inicio || !fim) continue;
      lista.push({
        id: p.id, employee_id: p.employee_id, employee_name: e.nome_completo, setor: e.setor || "Sem setor",
        empresa_nome: e.empresas?.nome || "", periodo_inicio: p.periodo_inicio, periodo_fim: p.periodo_fim,
        inicio, fim, dias_totais: p.dias_totais || diasEntre(inicio, fim), status: "planejado",
        aquisitivo_inicio: null, aquisitivo_fim: null, observacoes: p.observacoes,
      });
    }
    for (const f of ferRes.data || []) {
      const e = emps.get(f.employee_id);
      const inicio = dataLocal(f.periodo_gozo_inicio);
      const fim = dataLocal(f.periodo_gozo_fim);
      if (!e || !inicio || !fim) continue;
      const st: StatusLancamento = hoje < inicio ? "aprovado" : hoje > fim ? "concluido" : "em_andamento";
      lista.push({
        id: f.id, employee_id: f.employee_id, employee_name: e.nome_completo, setor: e.setor || "Sem setor",
        empresa_nome: e.empresas?.nome || "", periodo_inicio: f.periodo_gozo_inicio, periodo_fim: f.periodo_gozo_fim,
        inicio, fim, dias_totais: f.dias_totais, status: st,
        aquisitivo_inicio: dataLocal(f.periodo_aquisitivo_inicio), aquisitivo_fim: dataLocal(f.periodo_aquisitivo_fim),
      });
    }
    setLancamentos(lista);
    setLoading(false);
  };

  const anos = useMemo(() => {
    const s = new Set<number>([new Date().getFullYear()]);
    lancamentos.forEach((l) => { s.add(l.inicio.getFullYear()); s.add(l.fim.getFullYear()); });
    return Array.from(s).sort((a, b) => b - a);
  }, [lancamentos]);

  // Filtro por ano/mês: férias com algum dia no período escolhido
  const noPeriodo = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return lancamentos.filter((l) => {
      if (termo && !l.employee_name.toLowerCase().includes(termo)) return false;
      if (ano === "all") return true;
      const y = Number(ano);
      const ini = mes === "all" ? new Date(y, 0, 1) : new Date(y, Number(mes), 1);
      const fim = mes === "all" ? new Date(y, 11, 31) : new Date(y, Number(mes) + 1, 0);
      return l.inicio <= fim && l.fim >= ini;
    });
  }, [lancamentos, busca, ano, mes]);

  const contagem = useMemo(() => {
    const c: Record<string, number> = { todos: noPeriodo.length };
    noPeriodo.forEach((l) => { c[l.status] = (c[l.status] || 0) + 1; });
    return c;
  }, [noPeriodo]);

  // Agrupa por mês de início; em andamento primeiro, depois em ordem de data
  const grupos = useMemo(() => {
    const visiveis = (status === "todos" ? noPeriodo : noPeriodo.filter((l) => l.status === status))
      .sort((a, b) => a.inicio.getTime() - b.inicio.getTime() || a.employee_name.localeCompare(b.employee_name));
    const mapa = new Map<string, { titulo: string; itens: Lancamento[] }>();
    for (const l of visiveis) {
      const chave = `${l.inicio.getFullYear()}-${String(l.inicio.getMonth()).padStart(2, "0")}`;
      if (!mapa.has(chave)) mapa.set(chave, { titulo: `${MESES[l.inicio.getMonth()]} de ${l.inicio.getFullYear()}`, itens: [] });
      mapa.get(chave)!.itens.push(l);
    }
    return Array.from(mapa.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, g]) => g);
  }, [noPeriodo, status]);

  const confirmarExclusao = async () => {
    if (!excluir) return;
    const tabela = excluir.status === "planejado" ? "ferias_planejadas" : "ferias";
    const { error } = await supabase.from(tabela).delete().eq("id", excluir.id);
    if (error) {
      toast.error("Erro ao excluir as férias");
      return;
    }
    toast.success("Férias excluídas");
    setExcluir(null);
    carregar();
    onRefresh();
  };

  const hoje = hojeLocal();

  return (
    <>
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Label htmlFor="busca-lancamentos" className="sr-only">Buscar colaborador</Label>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="busca-lancamentos" placeholder="Buscar colaborador…" className="pl-9 h-11" value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
              <div className="w-32">
                <Label htmlFor="ano-lancamentos" className="sr-only">Ano</Label>
                <Select value={ano} onValueChange={(v) => { setAno(v); if (v === "all") setMes("all"); }}>
                  <SelectTrigger id="ano-lancamentos" className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os anos</SelectItem>
                    {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-44">
                <Label htmlFor="mes-lancamentos" className="sr-only">Mês</Label>
                <Select value={mes} onValueChange={setMes} disabled={ano === "all"}>
                  <SelectTrigger id="mes-lancamentos" className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Ano inteiro</SelectItem>
                    {MESES.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por situação">
              {FILTROS_STATUS.map((f) => (
                <button
                  key={f.valor}
                  type="button"
                  aria-pressed={status === f.valor}
                  onClick={() => setStatus(f.valor)}
                  className={`min-h-10 rounded-full border px-4 text-sm font-medium transition ${status === f.valor ? "bg-foreground text-background border-foreground" : "bg-card hover:bg-muted"}`}
                >
                  {f.rotulo} <span className="ml-1 opacity-70">{contagem[f.valor] || 0}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="py-16 text-center text-muted-foreground">Carregando férias…</div>
        ) : grupos.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="font-medium">Nenhuma férias neste período</p>
              <p className="text-sm text-muted-foreground">Troque o ano, o mês ou a situação acima.</p>
            </CardContent>
          </Card>
        ) : (
          grupos.map((g) => (
            <section key={g.titulo} className="space-y-2">
              <div className="flex items-baseline justify-between px-1">
                <h3 className="text-base font-semibold">{g.titulo}</h3>
                <span className="text-sm text-muted-foreground">{g.itens.length} {g.itens.length === 1 ? "férias" : "férias"}</span>
              </div>
              <Card className="overflow-hidden">
                <ul className="divide-y">
                  {g.itens.map((l) => {
                    const st = STATUS[l.status];
                    const diaAtual = l.status === "em_andamento" ? differenceInCalendarDays(hoje, l.inicio) + 1 : 0;
                    const totalDias = diasEntre(l.inicio, l.fim);
                    const faltam = l.status === "aprovado" || l.status === "planejado" ? differenceInCalendarDays(l.inicio, hoje) : null;
                    return (
                      <li key={`${l.status}-${l.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${st.avatar}`} aria-hidden="true">
                          {iniciais(l.employee_name)}
                        </div>

                        <div className="min-w-[180px] flex-1">
                          <div className="font-medium leading-tight">{l.employee_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {l.setor}{l.empresa_nome ? ` · ${l.empresa_nome}` : ""}
                          </div>
                        </div>

                        <div className="min-w-[200px] flex-1">
                          <div className="font-medium tabular-nums">
                            {dm(l.inicio)} → {dmy(l.fim)} <span className="ml-1 text-sm font-normal text-muted-foreground">· {l.dias_totais} dias</span>
                          </div>
                          {l.status === "em_andamento" ? (
                            <div className="mt-1.5 flex items-center gap-2">
                              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={1} aria-valuemax={totalDias} aria-valuenow={diaAtual} aria-label="Andamento das férias">
                                <div className="h-full rounded-full bg-violet-600" style={{ width: `${Math.min(100, (diaAtual / totalDias) * 100)}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground">dia {diaAtual} de {totalDias} · volta em {dmy(new Date(l.fim.getFullYear(), l.fim.getMonth(), l.fim.getDate() + 1))}</span>
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              {l.aquisitivo_inicio && l.aquisitivo_fim
                                ? `Período aquisitivo ${dmyCurto(l.aquisitivo_inicio)} a ${dmyCurto(l.aquisitivo_fim)}`
                                : l.status === "planejado" ? "Período aquisitivo definido na aprovação" : ""}
                              {faltam !== null && faltam > 0 && ` · começa em ${faltam} ${faltam === 1 ? "dia" : "dias"}`}
                            </div>
                          )}
                        </div>

                        <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${st.pill}`}>
                          {st.rotulo}
                        </span>

                        <div className="ml-auto flex shrink-0 items-center gap-1">
                          {l.status === "planejado" && (
                            <Button size="sm" className="h-10" onClick={() => setAprovar(l)}>
                              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Aprovar
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setEditar(l)} aria-label={`Editar férias de ${l.employee_name}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive hover:text-destructive" onClick={() => setExcluir(l)} aria-label={`Excluir férias de ${l.employee_name}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          ))
        )}
      </div>

      <ApproveVacationDialog
        open={!!aprovar}
        onOpenChange={(o) => { if (!o) setAprovar(null); }}
        plannedVacation={aprovar}
        onSuccess={() => { carregar(); onRefresh(); }}
      />

      <EditPlannedVacationDialog
        open={!!editar}
        onOpenChange={(o: boolean) => { if (!o) setEditar(null); }}
        vacation={editar}
        onUpdated={() => { carregar(); onRefresh(); }}
      />

      <AlertDialog open={!!excluir} onOpenChange={(o) => { if (!o) setExcluir(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir férias?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluir && `${excluir.employee_name}: ${dmy(excluir.inicio)} a ${dmy(excluir.fim)}. Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
