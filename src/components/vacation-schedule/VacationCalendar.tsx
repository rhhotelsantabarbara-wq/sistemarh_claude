import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { dataLocal, diasEntre, hojeLocal } from "@/lib/feriasCalculo";
import { AddVacationDialog } from "./AddVacationDialog";
import type { VacationFiltersType } from "./types";

interface VacationCalendarProps {
  filters: VacationFiltersType;
  onRefresh: () => void;
}

type Tipo = "em_ferias" | "aprovada" | "aguardando" | "concluida";

interface Ferias {
  chave: string;
  employee_id: string;
  nome: string;
  apelido: string;
  setor: string;
  inicio: Date;
  fim: Date;
  dias: number;
  tipo: Tipo;
}

const COR: Record<Tipo, { chip: string; ponto: string; pill: string; rotulo: string }> = {
  em_ferias: { chip: "bg-violet-600 text-white", ponto: "bg-violet-600", pill: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200", rotulo: "Em férias" },
  aprovada: { chip: "bg-emerald-600 text-white", ponto: "bg-emerald-600", pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200", rotulo: "Aprovada" },
  aguardando: { chip: "bg-amber-400 text-amber-950", ponto: "bg-amber-400", pill: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200", rotulo: "Aguardando aprovação" },
  concluida: { chip: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100", ponto: "bg-slate-400", pill: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200", rotulo: "Concluída" },
};

const SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MAX_CHIPS = 3;

function apelido(nome: string) {
  const p = nome.trim().toLowerCase().split(/\s+/).map((x) => x.charAt(0).toUpperCase() + x.slice(1));
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0] || "";
}

export function VacationCalendar({ filters, onRefresh }: VacationCalendarProps) {
  const hoje = hojeLocal();
  const [mes, setMes] = useState(startOfMonth(hoje));
  const [selecionado, setSelecionado] = useState<Date>(hoje);
  const [ferias, setFerias] = useState<Ferias[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [programarEm, setProgramarEm] = useState<Date | null>(null);

  useEffect(() => {
    carregar();
  }, [filters.empresa, filters.setor, filters.search]);

  const carregar = async () => {
    setCarregando(true);
    let empQuery = supabase.from("employees").select("id, nome_completo, setor, empresa_id").neq("status", "demitido");
    if (filters.empresa && filters.empresa !== "all") empQuery = empQuery.eq("empresa_id", filters.empresa);
    if (filters.setor && filters.setor !== "all") empQuery = empQuery.eq("setor", filters.setor);
    if (filters.search) empQuery = empQuery.ilike("nome_completo", `%${filters.search}%`);

    const [empRes, ferRes, planRes] = await Promise.all([
      empQuery,
      supabase.from("ferias").select("id, employee_id, periodo_gozo_inicio, periodo_gozo_fim, dias_totais"),
      supabase.from("ferias_planejadas").select("id, employee_id, periodo_inicio, periodo_fim, dias_totais"),
    ]);
    if (empRes.error || ferRes.error || planRes.error) {
      console.error("Calendário de férias:", empRes.error || ferRes.error || planRes.error);
      toast.error("Erro ao carregar o calendário");
      setCarregando(false);
      return;
    }
    const emps = new Map((empRes.data || []).map((e: any) => [e.id, e]));
    const lista: Ferias[] = [];
    for (const f of ferRes.data || []) {
      const e: any = emps.get(f.employee_id);
      const ini = dataLocal(f.periodo_gozo_inicio);
      const fim = dataLocal(f.periodo_gozo_fim);
      if (!e || !ini || !fim) continue;
      const tipo: Tipo = hoje < ini ? "aprovada" : hoje > fim ? "concluida" : "em_ferias";
      lista.push({ chave: `f-${f.id}`, employee_id: e.id, nome: e.nome_completo, apelido: apelido(e.nome_completo), setor: e.setor || "Sem setor", inicio: ini, fim, dias: f.dias_totais, tipo });
    }
    for (const p of planRes.data || []) {
      const e: any = emps.get(p.employee_id);
      const ini = dataLocal(p.periodo_inicio);
      const fim = dataLocal(p.periodo_fim);
      if (!e || !ini || !fim) continue;
      lista.push({ chave: `p-${p.id}`, employee_id: e.id, nome: e.nome_completo, apelido: apelido(e.nome_completo), setor: e.setor || "Sem setor", inicio: ini, fim, dias: p.dias_totais || diasEntre(ini, fim), tipo: "aguardando" });
    }
    lista.sort((a, b) => a.inicio.getTime() - b.inicio.getTime() || a.nome.localeCompare(b.nome));
    setFerias(lista);
    setCarregando(false);
  };

  const dias = useMemo(() => {
    const ini = startOfWeek(startOfMonth(mes), { weekStartsOn: 1 });
    const fim = endOfWeek(endOfMonth(mes), { weekStartsOn: 1 });
    return Array.from({ length: differenceInCalendarDays(fim, ini) + 1 }, (_, i) => addDays(ini, i));
  }, [mes]);

  const doDia = (d: Date) => ferias.filter((f) => f.inicio <= d && f.fim >= d);

  const noMes = useMemo(() => {
    const ini = startOfMonth(mes);
    const fim = endOfMonth(mes);
    const ids = new Set(ferias.filter((f) => f.inicio <= fim && f.fim >= ini && f.tipo !== "concluida").map((f) => f.employee_id));
    return ids.size;
  }, [ferias, mes]);

  const doSelecionado = doDia(selecionado);
  const tituloMes = format(mes, "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <Card className="min-w-0 flex-1 overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => setMes(addMonths(mes, -1))} aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="min-w-[170px] text-center text-lg font-semibold">{tituloMes.charAt(0).toUpperCase() + tituloMes.slice(1)}</h3>
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => setMes(addMonths(mes, 1))} aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="h-10 rounded-full px-5" onClick={() => { setMes(startOfMonth(hoje)); setSelecionado(hoje); }}>Hoje</Button>
          <span className="ml-auto text-sm text-muted-foreground">
            {noMes} {noMes === 1 ? "pessoa" : "pessoas"} de férias no mês
          </span>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-3 text-xs text-muted-foreground">
          {(["em_ferias", "aprovada", "aguardando", "concluida"] as Tipo[]).map((t) => (
            <span key={t} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${COR[t].ponto}`} />{COR[t].rotulo}</span>
          ))}
        </div>

        {/* Grade */}
        <div className="p-2 sm:p-4">
          <div className="grid grid-cols-7 gap-1 pb-1">
            {SEMANA.map((s, i) => (
              <div key={s} className={`py-1 text-center text-xs font-semibold uppercase tracking-wide ${i >= 5 ? "text-muted-foreground/70" : "text-muted-foreground"}`}>{s}</div>
            ))}
          </div>
          {carregando ? (
            <div className="py-24 text-center text-muted-foreground">Carregando…</div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {dias.map((d) => {
                const lista = doDia(d);
                const foraDoMes = !isSameMonth(d, mes);
                const fds = d.getDay() === 0 || d.getDay() === 6;
                const ehHoje = isSameDay(d, hoje);
                const sel = isSameDay(d, selecionado);
                const ativos = lista.filter((f) => f.tipo !== "concluida").length;
                return (
                  <button
                    key={d.toISOString()}
                    type="button"
                    onClick={() => setSelecionado(d)}
                    aria-pressed={sel}
                    aria-label={`${format(d, "d 'de' MMMM", { locale: ptBR })}: ${lista.length} ${lista.length === 1 ? "pessoa" : "pessoas"} de férias`}
                    className={`group flex min-h-[64px] flex-col gap-1 rounded-xl border p-1.5 text-left transition sm:min-h-[112px] sm:p-2
                      ${fds ? "bg-muted/50" : "bg-card"}
                      ${foraDoMes ? "opacity-40" : ""}
                      ${sel ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-border"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm tabular-nums ${ehHoje ? "bg-primary font-bold text-primary-foreground" : "font-medium"}`}>
                        {d.getDate()}
                      </span>
                      {ativos > 0 && (
                        <span className="hidden rounded-full bg-foreground/5 px-1.5 text-[11px] font-semibold text-muted-foreground sm:inline">{ativos} fora</span>
                      )}
                    </div>
                    {/* celular: só pontos */}
                    <div className="flex flex-wrap gap-0.5 sm:hidden">
                      {lista.slice(0, 6).map((f) => <span key={f.chave} className={`h-1.5 w-1.5 rounded-full ${COR[f.tipo].ponto}`} />)}
                    </div>
                    {/* computador: nomes */}
                    <div className="hidden flex-col gap-1 sm:flex">
                      {lista.slice(0, MAX_CHIPS).map((f) => {
                        const comeca = isSameDay(f.inicio, d);
                        const termina = isSameDay(f.fim, d);
                        return (
                          <span
                            key={f.chave}
                            title={`${f.nome} · ${format(f.inicio, "dd/MM")} a ${format(f.fim, "dd/MM")}`}
                            className={`truncate px-2 py-0.5 text-[11px] font-semibold leading-4 ${COR[f.tipo].chip} ${comeca ? "rounded-l-full" : "rounded-l-sm"} ${termina ? "rounded-r-full" : "rounded-r-sm"}`}
                          >
                            {f.apelido}
                          </span>
                        );
                      })}
                      {lista.length > MAX_CHIPS && (
                        <span className="px-1 text-[11px] font-medium text-muted-foreground">+{lista.length - MAX_CHIPS} mais</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Painel do dia */}
      <Card className="w-full shrink-0 lg:sticky lg:top-4 lg:w-80">
        <div className="border-b px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isSameDay(selecionado, hoje) ? "Hoje" : format(selecionado, "EEEE", { locale: ptBR })}
          </div>
          <div className="text-lg font-semibold">{format(selecionado, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</div>
        </div>
        <div className="max-h-[520px] overflow-y-auto p-2">
          {doSelecionado.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">Ninguém de férias neste dia.</p>
          ) : (
            <ul className="space-y-1">
              {doSelecionado.map((f) => {
                const volta = addDays(f.fim, 1);
                return (
                  <li key={f.chave} className="flex items-start gap-3 rounded-lg p-2 hover:bg-muted/60">
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${COR[f.tipo].ponto}`} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold" title={f.nome}>{f.nome}</div>
                      <div className="text-xs text-muted-foreground">{f.setor}</div>
                      <div className="mt-1 text-xs">
                        {format(f.inicio, "dd/MM")} a {format(f.fim, "dd/MM/yyyy")} · {f.dias} dias
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${COR[f.tipo].pill}`}>{COR[f.tipo].rotulo}</span>
                        {f.tipo !== "concluida" && <span className="text-[11px] text-muted-foreground">volta {format(volta, "dd/MM")}</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="border-t p-3">
          <Button className="w-full" variant="outline" onClick={() => setProgramarEm(selecionado)}>
            <CalendarPlus className="mr-2 h-4 w-4" /> Programar férias a partir deste dia
          </Button>
        </div>
      </Card>

      <AddVacationDialog
        open={!!programarEm}
        onOpenChange={(o) => { if (!o) setProgramarEm(null); }}
        selectedDate={programarEm}
        onSuccess={() => { setProgramarEm(null); carregar(); onRefresh(); }}
      />
    </div>
  );
}
