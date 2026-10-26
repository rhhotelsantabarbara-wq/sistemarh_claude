// Cálculo do controle de férias (CLT): períodos aquisitivos, saldo, prazo limite e situação.
// - Período aquisitivo: cada 12 meses a partir da admissão (direito de 30 dias).
// - Prazo limite (período concessivo): as férias devem ser gozadas nos 12 meses seguintes
//   ao fim do período aquisitivo; dias gozados depois disso são pagos em dobro (art. 137).
// - Para não acusar "vencida" em períodos antigos que nunca foram lançados no sistema,
//   considera-se quitado tudo antes do último período que tem férias registradas.
//   Sem nenhum registro, olham-se só os 2 períodos completos mais recentes.
import { addDays, addYears, differenceInCalendarDays, differenceInDays } from "date-fns";

export const DIAS_DIREITO = 30;
export const DIAS_AVISO_VENCIMENTO = 90;

export interface RegistroFerias {
  id: string;
  employee_id: string;
  periodo_aquisitivo_inicio: string;
  periodo_aquisitivo_fim: string;
  periodo_gozo_inicio: string;
  periodo_gozo_fim: string;
  dias_totais: number;
}

export interface FeriasPlanejada {
  id: string;
  employee_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  dias_totais: number;
  status?: string | null;
  observacoes?: string | null;
}

export interface PeriodoAquisitivo {
  indice: number;
  inicio: Date;
  fim: Date;
  limite: Date;
  gozados: number;
  saldo: number;
}

export type SituacaoFerias =
  | "de_ferias"
  | "vencida"
  | "aprovada"
  | "programada"
  | "vence_breve"
  | "pode_tirar"
  | "em_dia"
  | "em_aquisicao"
  | "sem_admissao";

export const SITUACOES: Record<SituacaoFerias, { rotulo: string; descricao: string; classe: string; ordem: number }> = {
  vencida: { rotulo: "Vencida", descricao: "Passou do prazo: dias fora do prazo são pagos em dobro", classe: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-200 dark:border-red-800", ordem: 1 },
  vence_breve: { rotulo: "Vence em breve", descricao: `Prazo termina em até ${DIAS_AVISO_VENCIMENTO} dias e ainda não foi programada`, classe: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-800", ordem: 2 },
  programada: { rotulo: "Programada", descricao: "Tem férias programadas aguardando aprovação", classe: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800", ordem: 3 },
  pode_tirar: { rotulo: "Pode tirar", descricao: "Tem saldo e o prazo ainda está folgado", classe: "bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800", ordem: 4 },
  aprovada: { rotulo: "Aprovada", descricao: "Férias aprovadas com data marcada", classe: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800", ordem: 5 },
  de_ferias: { rotulo: "De férias", descricao: "Está de férias hoje", classe: "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950 dark:text-violet-200 dark:border-violet-800", ordem: 6 },
  em_dia: { rotulo: "Em dia", descricao: "Sem saldo pendente", classe: "bg-green-50 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-200 dark:border-green-800", ordem: 7 },
  em_aquisicao: { rotulo: "1º período", descricao: "Ainda não completou 12 meses de casa", classe: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600", ordem: 8 },
  sem_admissao: { rotulo: "Sem admissão", descricao: "Cadastre a data de admissão para calcular", classe: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600", ordem: 9 },
};

export interface ResumoFerias {
  situacao: SituacaoFerias;
  periodoPendente: PeriodoAquisitivo | null;
  periodoAtual: PeriodoAquisitivo | null; // período em aquisição (ainda não completo)
  periodosVencidos: number;
  saldoTotal: number;
  emCurso: RegistroFerias | null;
  proximaAprovada: RegistroFerias | null;
  programada: FeriasPlanejada | null;
  semHistorico: boolean;
}

/** Lê "2026-01-10", "2026-01-10T12:00:00" ou ISO completo como data local (sem fuso). */
export function dataLocal(valor?: string | null): Date | null {
  if (!valor) return null;
  const m = String(valor).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function hojeLocal(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function diasEntre(inicio: Date, fim: Date): number {
  return differenceInCalendarDays(fim, inicio) + 1;
}

function periodo(admissao: Date, k: number): Omit<PeriodoAquisitivo, "gozados" | "saldo"> {
  const inicio = addYears(admissao, k);
  const fim = addDays(addYears(admissao, k + 1), -1);
  const limite = addDays(addYears(admissao, k + 2), -1);
  return { indice: k, inicio, fim, limite };
}

/** Em qual período aquisitivo (índice) um registro de férias se encaixa. */
function indiceDoRegistro(admissao: Date, r: RegistroFerias): number {
  const aq = dataLocal(r.periodo_aquisitivo_inicio);
  if (!aq) return 0;
  return Math.max(0, Math.round(differenceInDays(aq, admissao) / 365.25));
}

export function calcularResumoFerias(
  dataAdmissao: string | null | undefined,
  registros: RegistroFerias[],
  planejadas: FeriasPlanejada[],
  hoje: Date = hojeLocal(),
): ResumoFerias {
  const emCurso = registros.find((r) => {
    const i = dataLocal(r.periodo_gozo_inicio);
    const f = dataLocal(r.periodo_gozo_fim);
    return i && f && i <= hoje && f >= hoje;
  }) || null;

  const proximaAprovada = registros
    .filter((r) => (dataLocal(r.periodo_gozo_inicio) as Date) > hoje)
    .sort((a, b) => a.periodo_gozo_inicio.localeCompare(b.periodo_gozo_inicio))[0] || null;

  const programada = planejadas
    .filter((p) => (dataLocal(p.periodo_fim) as Date) >= hoje)
    .sort((a, b) => a.periodo_inicio.localeCompare(b.periodo_inicio))[0] || null;

  const admissao = dataLocal(dataAdmissao);
  if (!admissao) {
    return { situacao: emCurso ? "de_ferias" : "sem_admissao", periodoPendente: null, periodoAtual: null, periodosVencidos: 0, saldoTotal: 0, emCurso, proximaAprovada, programada, semHistorico: registros.length === 0 };
  }

  // Dias gozados por período aquisitivo
  const gozadosPorPeriodo = new Map<number, number>();
  let ultimoComRegistro = -1;
  for (const r of registros) {
    const k = indiceDoRegistro(admissao, r);
    gozadosPorPeriodo.set(k, (gozadosPorPeriodo.get(k) || 0) + (r.dias_totais || 0));
    ultimoComRegistro = Math.max(ultimoComRegistro, k);
  }

  // Quantos períodos já se completaram
  let completos = 0;
  while (periodo(admissao, completos).fim < hoje) completos++;

  const primeiroConsiderado = ultimoComRegistro >= 0 ? ultimoComRegistro : Math.max(0, completos - 2);

  const montar = (k: number): PeriodoAquisitivo => {
    const p = periodo(admissao, k);
    const gozados = gozadosPorPeriodo.get(k) || 0;
    return { ...p, gozados, saldo: Math.max(0, DIAS_DIREITO - gozados) };
  };

  const pendentes: PeriodoAquisitivo[] = [];
  for (let k = primeiroConsiderado; k < completos; k++) {
    const p = montar(k);
    if (p.saldo > 0) pendentes.push(p);
  }
  const periodoAtual = montar(completos);
  const periodoPendente = pendentes[0] || null;
  const periodosVencidos = pendentes.filter((p) => p.limite < hoje).length;
  const saldoTotal = pendentes.reduce((s, p) => s + p.saldo, 0);

  let situacao: SituacaoFerias;
  if (emCurso) situacao = "de_ferias";
  else if (periodosVencidos > 0) situacao = "vencida";
  else if (proximaAprovada) situacao = "aprovada";
  else if (programada) situacao = "programada";
  else if (periodoPendente && differenceInCalendarDays(periodoPendente.limite, hoje) <= DIAS_AVISO_VENCIMENTO) situacao = "vence_breve";
  else if (periodoPendente) situacao = "pode_tirar";
  else if (completos === 0) situacao = "em_aquisicao";
  else situacao = "em_dia";

  return { situacao, periodoPendente, periodoAtual, periodosVencidos, saldoTotal, emCurso, proximaAprovada, programada, semHistorico: registros.length === 0 };
}

/** Período aquisitivo sugerido ao aprovar férias: o pendente mais antigo, senão o que está em curso. */
export function periodoParaLancamento(resumo: ResumoFerias): PeriodoAquisitivo | null {
  return resumo.periodoPendente || resumo.periodoAtual;
}
