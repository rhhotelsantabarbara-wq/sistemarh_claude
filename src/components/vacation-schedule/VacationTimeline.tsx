import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, differenceInCalendarDays, format, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, Check, ChevronLeft, ChevronRight, Clock, Search, Sun } from "lucide-react";
import { Card } from "@/components/ui/card";
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
  type FeriasPlanejada,
  type RegistroFerias,
} from "@/lib/feriasCalculo";
import type { VacationFiltersType } from "./types";

interface VacationTimelineProps {
  filters: VacationFiltersType;
}

type TipoBarra = "em_ferias" | "aprovada" | "aguardando" | "concluida" | "prazo";

interface Barra {
  tipo: TipoBarra;
  inicio: Date;
  fim: Date;
  texto: string;
  detalhe: string;
}

interface Linha {
  id: string;
  nome: string;
  setor: string;
  barras: Barra[];
}

const LARGURA_DIA = 38;
const DIAS_VISIVEIS = 63; // 9 semanas
const ALTURA_LINHA = 64;

const ESTILO: Record<TipoBarra, { barra: string; icone: string; rotulo: string }> = {
  em_ferias: { barra: "bg-violet-600 text-white shadow-violet-600/30", icone: "bg-white/25", rotulo: "Em férias" },
  aprovada: { barra: "bg-emerald-600 text-white shadow-emerald-600/30", icone: "bg-white/25", rotulo: "Aprovada" },
  aguardando: { barra: "bg-amber-400 text-amber-950 shadow-amber-400/40", icone: "bg-white/40", rotulo: "Aguardando aprovação" },
  concluida: { barra: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100 shadow-transparent", icone: "bg-white/50 dark:bg-white/10", rotulo: "Concluída" },
  prazo: { barra: "bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-rose-600/30", icone: "bg-white/25", rotulo: "Prazo para iniciar" },
};

const FILTROS: { valor: "todos" | TipoBarra; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "prazo", rotulo: "A vencer" },
  { valor: "aguardando", rotulo: "Aguardando" },
  { valor: "aprovada", rotulo: "Aprovadas" },
  { valor: "em_ferias", rotulo: "Em férias" },
];

const SEM_FERIAS = ["intermitente", "prestador_servico"];
const dm = (d: Date) => format(d, "dd/MM", { locale: ptBR });
const dmy = (d: Date) => format(d, "dd/MM/yyyy", { locale: ptBR });

function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

function IconeBarra({ tipo }: { tipo: TipoBarra }) {
  const cls = "h-3.5 w-3.5";
  if (tipo === "prazo") return <AlertCircle className={cls} />;
  if (tipo === "aprovada" || tipo === "concluida") return <Check className={cls} />;
  if (tipo === "aguardando") return <Clock className={cls} />;
  return <Sun className={cls} />;
}

export function VacationTimeline({ filters }: VacationTimelineProps) {
  const hoje = hojeLocal();
  const [inicioJanela, setInicioJanela] = useState(() => addDays(startOfWeek(hoje, { weekStartsOn: 1 }), -7));
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<"todos" | TipoBarra>("todos");
  const [busca, setBusca] = useState("");
  const rolagem = useRef<HTMLDivElement>(null);

  useEffect(() => {
    carregar();
  }, [filters.empresa, filters.setor]);

  const carregar = async () => {
    setCarregando(true);
    let empQuery = (supabase.from("employees") as any)
      .select("id, nome_completo, setor, data_admissao, tipo_contrato, ferias_periodo_aberto_inicio, empresa_id")
      .neq("status", "demitido");
    if (filters.empresa && filters.empresa !== "all") empQuery = empQuery.eq("empresa_id", filters.empresa);
    if (filters.setor && filters.setor !== "all") empQuery = empQuery.eq("setor", filters.setor);

    const [empRes, ferRes, planRes] = await Promise.all([
      empQuery.order("nome_completo"),
      supabase.from("ferias").select("id, employee_id, periodo_aquisitivo_inicio, periodo_aquisitivo_fim, periodo_gozo_inicio, periodo_gozo_fim, dias_totais"),
      supabase.from("ferias_planejadas").select("id, employee_id, periodo_inicio, periodo_fim, dias_totais, status"),
    ]);
    if (empRes.error || ferRes.error || planRes.error) {
      console.error("Linha do tempo de férias:", empRes.error || ferRes.error || planRes.error);
      toast.error("Erro ao carregar a linha do tempo");
      setCarregando(false);
      return;
    }

    const agrupar = <T extends { employee_id: string }>(lista: T[]) => {
      const m = new Map<string, T[]>();
      lista.forEach((i) => { if (!m.has(i.employee_id)) m.set(i.employee_id, []); m.get(i.employee_id)!.push(i); });
      return m;
    };
    const ferias = agrupar((ferRes.data || []) as RegistroFerias[]);
    const planejadas = agrupar((planRes.data || []) as FeriasPlanejada[]);

    const resultado: Linha[] = [];
    for (const e of (empRes.data || []) as any[]) {
      if (SEM_FERIAS.includes(e.tipo_contrato)) continue;
      const barras: Barra[] = [];
      for (const f of ferias.get(e.id) || []) {
        const ini = dataLocal(f.periodo_gozo_inicio);
        const fim = dataLocal(f.periodo_gozo_fim);
        if (!ini || !fim) continue;
        const tipo: TipoBarra = hoje < ini ? "aprovada" : hoje > fim ? "concluida" : "em_ferias";
        barras.push({ tipo, inicio: ini, fim, texto: `${dm(ini)} até ${dmy(fim)}`, detalhe: `${f.dias_totais} dias` });
      }
      for (const p of planejadas.get(e.id) || []) {
        const ini = dataLocal(p.periodo_inicio);
        const fim = dataLocal(p.periodo_fim);
        if (!ini || !fim) continue;
        barras.push({ tipo: "aguardando", inicio: ini, fim, texto: `${dm(ini)} até ${dmy(fim)}`, detalhe: `${p.dias_totais || diasEntre(ini, fim)} dias` });
      }
      // Prazo para iniciar: só quem ainda não tem férias marcadas para o período pendente
      const resumo = calcularResumoFerias(e.data_admissao, ferias.get(e.id) || [], planejadas.get(e.id) || [], hoje, e.ferias_periodo_aberto_inicio);
      const p = resumo.periodoPendente;
      if (p && !resumo.emCurso && !resumo.proximaAprovada && !resumo.programada) {
        const vencida = p.iniciarAte < hoje;
        // a barra "corre" até a data limite (ou até hoje, se já venceu)
        const fimBarra = vencida ? hoje : p.iniciarAte;
        barras.push({
          tipo: "prazo",
          inicio: addDays(fimBarra, -13),
          fim: fimBarra,
          texto: vencida ? `Venceu em ${dmy(p.iniciarAte)}` : `Iniciar até ${dmy(p.iniciarAte)}`,
          detalhe: `${p.saldo} dias`,
        });
      }
      if (barras.length) resultado.push({ id: e.id, nome: e.nome_completo, setor: e.setor || "Sem setor", barras });
    }
    setLinhas(resultado);
    setCarregando(false);
  };

  const fimJanela = addDays(inicioJanela, DIAS_VISIVEIS - 1);
  const dias = useMemo(() => Array.from({ length: DIAS_VISIVEIS }, (_, i) => addDays(inicioJanela, i)), [inicioJanela]);

  // Contagens e linhas visíveis (com alguma barra dentro da janela)
  const { visiveis, contagem } = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const contagem: Record<string, number> = { todos: 0 };
    const visiveis: (Linha & { barrasJanela: Barra[] })[] = [];
    for (const l of linhas) {
      if (termo && !l.nome.toLowerCase().includes(termo) && !l.setor.toLowerCase().includes(termo)) continue;
      const naJanela = l.barras.filter((b) => b.inicio <= fimJanela && b.fim >= inicioJanela);
      if (!naJanela.length) continue;
      contagem.todos++;
      new Set(naJanela.map((b) => b.tipo)).forEach((t) => { contagem[t] = (contagem[t] || 0) + 1; });
      const barrasJanela = filtro === "todos" ? naJanela : naJanela.filter((b) => b.tipo === filtro);
      if (barrasJanela.length) visiveis.push({ ...l, barrasJanela });
    }
    visiveis.sort((a, b) => Math.min(...a.barrasJanela.map((x) => x.inicio.getTime())) - Math.min(...b.barrasJanela.map((x) => x.inicio.getTime())));
    return { visiveis, contagem };
  }, [linhas, busca, filtro, inicioJanela, fimJanela]);

  // Rola até hoje ao abrir
  useEffect(() => {
    const el = rolagem.current;
    if (!el) return;
    const x = (differenceInCalendarDays(hoje, inicioJanela) - 7) * LARGURA_DIA;
    el.scrollLeft = Math.max(0, x);
  }, [carregando]);

  const irParaHoje = () => {
    setInicioJanela(addDays(startOfWeek(hoje, { weekStartsOn: 1 }), -7));
    requestAnimationFrame(() => { if (rolagem.current) rolagem.current.scrollLeft = 0; });
  };

  // Faixas de mês no cabeçalho
  const meses = useMemo(() => {
    const lista: { rotulo: string; inicio: number; dias: number }[] = [];
    dias.forEach((d, i) => {
      const m = format(d, "MMMM yyyy", { locale: ptBR });
      const r = m.charAt(0).toUpperCase() + m.slice(1);
      const ult = lista[lista.length - 1];
      if (ult && ult.rotulo === r) ult.dias++;
      else lista.push({ rotulo: r, inicio: i, dias: 1 });
    });
    return lista;
  }, [dias]);

  const larguraGrade = DIAS_VISIVEIS * LARGURA_DIA;
  const posHoje = differenceInCalendarDays(hoje, inicioJanela);

  return (
    <Card className="overflow-hidden">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <nav className="flex flex-wrap gap-1" aria-label="Filtrar por situação">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              onClick={() => setFiltro(f.valor)}
              aria-pressed={filtro === f.valor}
              className={`relative min-h-11 px-3 text-xs font-semibold uppercase tracking-wide transition ${filtro === f.valor ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {f.rotulo}{f.valor !== "todos" && contagem[f.valor] ? ` (${contagem[f.valor]})` : ""}
              {filtro === f.valor && <span className="absolute inset-x-2 bottom-1 h-0.5 rounded-full bg-primary" />}
            </button>
          ))}
        </nav>
        <div className="relative ml-auto w-full sm:w-72">
          <Label htmlFor="busca-timeline" className="sr-only">Buscar nome ou setor</Label>
          <Input id="busca-timeline" placeholder="Nome ou setor" className="h-11 rounded-full pl-4 pr-10" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <Search className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      {/* Navegação */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => setInicioJanela(addDays(inicioJanela, -28))} aria-label="Semanas anteriores">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" className="h-10 rounded-full px-6" onClick={irParaHoje}>Hoje</Button>
        <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => setInicioJanela(addDays(inicioJanela, 28))} aria-label="Próximas semanas">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="ml-2 text-sm text-muted-foreground">{dmy(inicioJanela)} a {dmy(fimJanela)}</span>
        <div className="ml-auto flex flex-wrap gap-3 text-xs text-muted-foreground">
          {(["em_ferias", "aprovada", "aguardando", "prazo"] as TipoBarra[]).map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${t === "prazo" ? "bg-rose-600" : ESTILO[t].barra.split(" ")[0]}`} /> {ESTILO[t].rotulo}
            </span>
          ))}
        </div>
      </div>

      {carregando ? (
        <div className="py-20 text-center text-muted-foreground">Carregando…</div>
      ) : (
        <div className="flex border-t">
          {/* Coluna de nomes */}
          <div className="w-[128px] shrink-0 border-r bg-card sm:w-[248px]">
            <div className="h-[60px] border-b" />
            {visiveis.length === 0 && <div className="p-4 text-sm text-muted-foreground">Nada neste período.</div>}
            {visiveis.map((l) => (
              <div key={l.id} className="flex items-center gap-3 border-b px-3 sm:px-4" style={{ height: ALTURA_LINHA }}>
                <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground sm:flex" aria-hidden="true">
                  {iniciais(l.nome)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold" title={l.nome}>{l.nome}</div>
                  <div className="truncate text-xs text-muted-foreground">{l.setor}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Grade de dias */}
          <div ref={rolagem} className="min-w-0 flex-1 overflow-x-auto">
            <div className="relative" style={{ width: larguraGrade }}>
              {/* fundo: fins de semana e hoje */}
              <div className="pointer-events-none absolute inset-0 flex" aria-hidden="true">
                {dias.map((d, i) => {
                  const fds = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <div key={i} className="flex justify-center" style={{ width: LARGURA_DIA }}>
                      {fds && <div className="h-full w-[26px] rounded-full bg-muted/70" />}
                    </div>
                  );
                })}
              </div>
              {posHoje >= 0 && posHoje < DIAS_VISIVEIS && (
                <div className="pointer-events-none absolute top-[30px] bottom-0 w-0.5 bg-primary/60" style={{ left: posHoje * LARGURA_DIA + LARGURA_DIA / 2 }} aria-hidden="true" />
              )}

              {/* cabeçalho */}
              <div className="relative h-[60px] border-b">
                {meses.map((m) => (
                  <div key={m.rotulo + m.inicio} className="absolute top-1.5 truncate px-2 text-xs font-semibold text-muted-foreground" style={{ left: m.inicio * LARGURA_DIA, width: m.dias * LARGURA_DIA }}>
                    {m.rotulo}
                  </div>
                ))}
                <div className="absolute bottom-2 left-0 flex">
                  {dias.map((d, i) => {
                    const ehHoje = i === posHoje;
                    return (
                      <div key={i} className="flex justify-center" style={{ width: LARGURA_DIA }}>
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums ${ehHoje ? "bg-primary font-bold text-primary-foreground" : "text-muted-foreground"}`}>
                          {d.getDate()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* linhas */}
              {visiveis.map((l) => (
                <div key={l.id} className="relative border-b" style={{ height: ALTURA_LINHA }}>
                  {l.barrasJanela.map((b, i) => {
                    const ini = Math.max(0, differenceInCalendarDays(b.inicio, inicioJanela));
                    const fim = Math.min(DIAS_VISIVEIS - 1, differenceInCalendarDays(b.fim, inicioJanela));
                    const largura = (fim - ini + 1) * LARGURA_DIA - 6;
                    const cortadaEsq = b.inicio < inicioJanela;
                    const cortadaDir = b.fim > fimJanela;
                    const estreita = largura < 150;
                    return (
                      <div
                        key={i}
                        title={`${ESTILO[b.tipo].rotulo}: ${b.texto} · ${b.detalhe}`}
                        className={`absolute top-1/2 flex h-10 -translate-y-1/2 items-center gap-2 px-1.5 text-xs font-semibold shadow-lg ${ESTILO[b.tipo].barra} ${cortadaEsq ? "rounded-l-md" : "rounded-l-full"} ${cortadaDir ? "rounded-r-md" : "rounded-r-full"}`}
                        style={{ left: ini * LARGURA_DIA + 3, width: largura }}
                      >
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${ESTILO[b.tipo].icone}`}>
                          <IconeBarra tipo={b.tipo} />
                        </span>
                        {!estreita && <span className="truncate">{b.texto}</span>}
                        <span className="ml-auto shrink-0 pr-2.5 opacity-90">{b.detalhe}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
