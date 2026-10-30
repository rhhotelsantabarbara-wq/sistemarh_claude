import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarPlus, CheckCircle2, Search, UserRound } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  calcularResumoFerias,
  dataLocal,
  formatarDias,
  hojeLocal,
  SITUACOES,
  type FeriasPlanejada,
  type RegistroFerias,
  type ResumoFerias,
  type SituacaoFerias,
} from "@/lib/feriasCalculo";
import { differenceInCalendarDays } from "date-fns";
import type { VacationFiltersType } from "./types";

interface Linha {
  id: string;
  nome: string;
  setor: string;
  empresa: string;
  resumo: ResumoFerias;
}

interface ControleFeriasProps {
  filters: VacationFiltersType;
  onFiltersChange: (f: VacationFiltersType) => void;
  onProgramar: (employeeId: string) => void;
  onAprovar: (planejada: FeriasPlanejada) => void;
}

const fmt = (d?: Date | null) => (d ? format(d, "dd/MM/yyyy", { locale: ptBR }) : "—");
const fmtCurto = (d?: Date | null) => (d ? format(d, "dd/MM/yy", { locale: ptBR }) : "—");

const SEM_FERIAS = ["intermitente", "prestador_servico"];

// Uma pessoa pode estar em mais de uma situação (ex.: vencida e com férias programadas)
function etiquetas(r: ResumoFerias): SituacaoFerias[] {
  const t = new Set<SituacaoFerias>([r.situacao]);
  if (r.periodosVencidos > 0) t.add("vencida");
  if (r.programada) t.add("programada");
  if (r.proximaAprovada) t.add("aprovada");
  if (r.emCurso) t.add("de_ferias");
  return Array.from(t);
}

const ORDEM_CHIPS: SituacaoFerias[] = ["vencida", "vence_breve", "programada", "pode_tirar", "aprovada", "de_ferias", "em_dia", "em_aquisicao", "sem_admissao"];

export function ControleFerias({ filters, onFiltersChange, onProgramar, onAprovar }: ControleFeriasProps) {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [situacao, setSituacao] = useState<SituacaoFerias | "todas">("todas");
  const [foraDoControle, setForaDoControle] = useState(0);

  useEffect(() => {
    carregar();
  }, []);

  const carregar = async () => {
    setCarregando(true);
    // Mantém o status "de férias" dos colaboradores em dia com as datas (ignora se a função ainda não existir)
    await supabase.rpc("sincronizar_status_ferias" as any).then(() => {}, () => {});

    const [empRes, ferRes, planRes] = await Promise.all([
      (supabase.from("employees") as any)
        .select("id, nome_completo, setor, data_admissao, tipo_contrato, ferias_periodo_aberto_inicio, empresa_id, empresas(nome)")
        .neq("status", "demitido")
        .order("nome_completo"),
      supabase
        .from("ferias")
        .select("id, employee_id, periodo_aquisitivo_inicio, periodo_aquisitivo_fim, periodo_gozo_inicio, periodo_gozo_fim, dias_totais"),
      supabase
        .from("ferias_planejadas")
        .select("id, employee_id, periodo_inicio, periodo_fim, dias_totais, status, observacoes"),
    ]);

    if (empRes.error && String(empRes.error.message || "").includes("ferias_periodo_aberto_inicio")) {
      // Banco ainda sem a coluna nova: carrega sem ela
      const r = await supabase.from("employees").select("id, nome_completo, setor, data_admissao, tipo_contrato, empresa_id, empresas(nome)").neq("status", "demitido").order("nome_completo");
      empRes.data = r.data as any;
      empRes.error = r.error as any;
    }
    if (empRes.error || ferRes.error || planRes.error) {
      console.error("Controle de férias:", empRes.error || ferRes.error || planRes.error);
      toast.error("Erro ao carregar o controle de férias");
      setCarregando(false);
      return;
    }

    const porFuncionario = <T extends { employee_id: string }>(lista: T[]) => {
      const mapa = new Map<string, T[]>();
      for (const item of lista) {
        if (!mapa.has(item.employee_id)) mapa.set(item.employee_id, []);
        mapa.get(item.employee_id)!.push(item);
      }
      return mapa;
    };
    const ferias = porFuncionario((ferRes.data || []) as RegistroFerias[]);
    const planejadas = porFuncionario((planRes.data || []) as FeriasPlanejada[]);
    const hoje = hojeLocal();

    // Intermitentes e prestadores de serviço não têm férias a controlar
    const todos = (empRes.data || []) as any[];
    const comFerias = todos.filter((e) => !SEM_FERIAS.includes(e.tipo_contrato));
    setForaDoControle(todos.length - comFerias.length);

    setLinhas(
      comFerias.map((e: any) => ({
        id: e.id,
        nome: e.nome_completo,
        setor: e.setor || "Sem setor",
        empresa: e.empresa_id || "",
        resumo: calcularResumoFerias(e.data_admissao, ferias.get(e.id) || [], planejadas.get(e.id) || [], hoje, e.ferias_periodo_aberto_inicio),
      })),
    );
    setCarregando(false);
  };

  const setores = useMemo(() => Array.from(new Set(linhas.map((l) => l.setor))).sort(), [linhas]);

  // Filtros da página (empresa, setor, busca)
  const filtradas = useMemo(() => {
    const busca = (filters.search || "").toLowerCase().trim();
    return linhas.filter((l) =>
      (filters.empresa === "all" || !filters.empresa || l.empresa === filters.empresa) &&
      (filters.setor === "all" || !filters.setor || l.setor === filters.setor) &&
      (!busca || l.nome.toLowerCase().includes(busca)),
    );
  }, [linhas, filters]);

  const contagem = useMemo(() => {
    const c: Partial<Record<SituacaoFerias, number>> = {};
    for (const l of filtradas) for (const t of etiquetas(l.resumo)) c[t] = (c[t] || 0) + 1;
    return c;
  }, [filtradas]);

  const visiveis = useMemo(() => {
    const lista = situacao === "todas" ? filtradas : filtradas.filter((l) => etiquetas(l.resumo).includes(situacao));
    return [...lista].sort((a, b) => {
      const oa = SITUACOES[a.resumo.situacao].ordem;
      const ob = SITUACOES[b.resumo.situacao].ordem;
      if (oa !== ob) return oa - ob;
      const la = a.resumo.periodoPendente?.iniciarAte.getTime() ?? Infinity;
      const lb = b.resumo.periodoPendente?.iniciarAte.getTime() ?? Infinity;
      if (la !== lb) return la - lb;
      return a.nome.localeCompare(b.nome);
    });
  }, [filtradas, situacao]);

  const hoje = hojeLocal();

  return (
    <div className="space-y-4">
      {/* Resumo por situação: também funciona como filtro */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por situação">
        <button
          type="button"
          onClick={() => setSituacao("todas")}
          aria-pressed={situacao === "todas"}
          className={`min-h-10 rounded-full border px-4 text-xs font-bold uppercase tracking-[0.04em] transition ${situacao === "todas" ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
        >
          Todos <span className="ml-1 opacity-70">{filtradas.length}</span>
        </button>
        {ORDEM_CHIPS.filter((s) => contagem[s]).map((s) => (
          <button
            key={s}
            type="button"
            title={SITUACOES[s].descricao}
            onClick={() => setSituacao(situacao === s ? "todas" : s)}
            aria-pressed={situacao === s}
            className={`min-h-10 rounded-full border px-4 text-xs font-bold uppercase tracking-[0.04em] transition ${SITUACOES[s].classe} ${situacao === s ? "ring-2 ring-offset-2 ring-primary/60" : "hover:brightness-95"}`}
          >
            {SITUACOES[s].rotulo} <span className="ml-1 font-bold">{contagem[s]}</span>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Label htmlFor="busca-ferias" className="sr-only">Buscar colaborador</Label>
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="busca-ferias"
                placeholder="Procure por colaborador"
                className="h-10 rounded-full border-0 bg-muted pl-10"
                value={filters.search}
                onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
              />
            </div>
            <div className="w-full sm:w-56">
              <Label htmlFor="setor-ferias" className="sr-only">Setor</Label>
              <Select value={filters.setor || "all"} onValueChange={(v) => onFiltersChange({ ...filters, setor: v })}>
                <SelectTrigger id="setor-ferias" className="h-10 rounded-full">
                  <SelectValue placeholder="Setor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os setores</SelectItem>
                  {setores.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {carregando ? (
            <div className="py-12 text-center text-muted-foreground">Calculando férias…</div>
          ) : visiveis.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">Nenhum colaborador nesta situação.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Período aquisitivo</TableHead>
                    <TableHead className="text-center">Saldo</TableHead>
                    <TableHead title="Último dia para começar as férias sem pagar em dobro">Iniciar até</TableHead>
                    <TableHead>Férias marcadas</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visiveis.map((l) => {
                    const r = l.resumo;
                    const p = r.periodoPendente;
                    const diasPrazo = p ? differenceInCalendarDays(p.iniciarAte, hoje) : null;
                    const marcada = r.emCurso || r.proximaAprovada;
                    return (
                      <TableRow key={l.id}>
                        <TableCell>
                          <div className="font-medium">{l.nome}</div>
                          <div className="text-xs text-muted-foreground">{l.setor}</div>
                        </TableCell>
                        <TableCell>
                          <span title={SITUACOES[r.situacao].descricao} className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${SITUACOES[r.situacao].classe}`}>
                            {SITUACOES[r.situacao].rotulo}
                          </span>
                          {etiquetas(r).filter((t) => t !== r.situacao).map((t) => (
                            <span key={t} className={`ml-1 mt-1 inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${SITUACOES[t].classe}`}>
                              {SITUACOES[t].rotulo}
                            </span>
                          ))}
                          {r.periodosVencidos > 1 && (
                            <div className="mt-1 text-xs text-red-700 dark:text-red-300">{r.periodosVencidos} períodos vencidos</div>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {p && (
                            <div>
                              <span className="font-medium">{fmtCurto(p.inicio)} a {fmtCurto(p.fim)}</span>
                              <span className="ml-1.5 text-xs text-red-700 dark:text-red-300">vencido</span>
                            </div>
                          )}
                          {r.periodosPendentes > 1 && (
                            <div className="text-xs text-red-700 dark:text-red-300">+{r.periodosPendentes - 1} período(s) vencido(s)</div>
                          )}
                          {r.periodoAtual ? (
                            <div className={p ? "text-muted-foreground" : ""}>
                              {fmtCurto(r.periodoAtual.inicio)} a {fmtCurto(r.periodoAtual.fim)}
                              <span className="ml-1.5 text-xs text-muted-foreground">em curso</span>
                            </div>
                          ) : !p ? (
                            <span className="text-muted-foreground">—</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-center">
                          {r.saldoTotal > 0 ? (
                            <>
                              <div className="font-semibold">{formatarDias(r.saldoTotal)} dias</div>
                              {r.saldoVencido > 0 && r.saldoProporcional > 0 && (
                                <div className="text-xs text-muted-foreground whitespace-nowrap" title="Período(s) completo(s) + proporcional do período atual">
                                  {formatarDias(r.saldoVencido)} + {formatarDias(r.saldoProporcional)}
                                </div>
                              )}
                              {r.saldoVencido === 0 && (
                                <div className="text-xs text-muted-foreground whitespace-nowrap">proporcional ({r.avosProporcionais}/12)</div>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {p ? (
                            <>
                              <div>{fmt(p.iniciarAte)}</div>
                              <div className={`text-xs ${diasPrazo! < 0 ? "text-red-700 dark:text-red-300 font-medium" : diasPrazo! <= 90 ? "text-orange-700 dark:text-orange-300" : "text-muted-foreground"}`}>
                                {diasPrazo! < 0 ? `venceu há ${Math.abs(diasPrazo!)} dias` : diasPrazo === 0 ? "vence hoje" : `faltam ${diasPrazo} dias`}
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {marcada ? (
                            <>
                              <div>{fmtCurto(dataLocal(marcada.periodo_gozo_inicio))} a {fmtCurto(dataLocal(marcada.periodo_gozo_fim))}</div>
                              <div className="text-xs text-muted-foreground">{r.emCurso ? "em andamento" : "aprovada"}</div>
                            </>
                          ) : r.programada ? (
                            <>
                              <div>{fmtCurto(dataLocal(r.programada.periodo_inicio))} a {fmtCurto(dataLocal(r.programada.periodo_fim))}</div>
                              <div className="text-xs text-blue-700 dark:text-blue-300">aguardando aprovação</div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {r.programada && !r.emCurso ? (
                              <Button size="sm" className="h-10" onClick={() => onAprovar(r.programada!)}>
                                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Aprovar
                              </Button>
                            ) : !r.emCurso && r.situacao !== "aprovada" && r.situacao !== "sem_admissao" ? (
                              <Button size="sm" variant="outline" className="h-10" onClick={() => onProgramar(l.id)}>
                                <CalendarPlus className="mr-1.5 h-4 w-4" /> Programar
                              </Button>
                            ) : null}
                            <Button asChild size="sm" variant="ghost" className="h-10 w-10 p-0" aria-label={`Abrir ficha de ${l.nome}`}>
                              <Link to={`/employee/${l.id}`}><UserRound className="h-4 w-4" /></Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Cálculo: 30 dias por período aquisitivo de 12 meses, a gozar nos 12 meses seguintes. "Iniciar até" é o último dia para começar 30 dias de férias sem pagar em dobro. Quando o período em aberto veio da contabilidade, os períodos contam a partir dele; senão, da admissão.
            {foraDoControle > 0 && ` Intermitentes e prestadores de serviço não aparecem (${foraDoControle}).`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

