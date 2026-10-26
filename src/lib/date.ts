import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Retorna a data de HOJE no fuso LOCAL como string "YYYY-MM-DD".
 * Evita o bug de `new Date().toISOString().split("T")[0]` que, em fusos
 * negativos como Brasil (UTC-3), pode retornar o dia seguinte após ~21h.
 */
export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Converte um Date para "YYYY-MM-DD" usando o fuso LOCAL.
 */
export function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Converte uma string de data (YYYY-MM-DD vindo do Postgres tipo DATE)
 * em um objeto Date no fuso LOCAL — evita o bug do JS
 * `new Date('YYYY-MM-DD')` que interpreta como UTC e pode voltar 1 dia
 * em fusos negativos (ex.: Brasil UTC-3).
 *
 * Aceita também timestamps/ISO completos como fallback.
 */
export function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null;

  // YYYY-MM-DD puro (sem hora)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) {
    const [, y, mo, d] = m;
    return new Date(Number(y), Number(mo) - 1, Number(d));
  }

  // DD/MM/YYYY
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (br) {
    const [, d, mo, y] = br;
    return new Date(Number(y), Number(mo) - 1, Number(d));
  }

  // Timestamp/ISO completo — Date nativo já funciona corretamente
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Formata datas vindas de colunas SQL do tipo DATE (YYYY-MM-DD) sem sofrer
 * o bug do JS `new Date('YYYY-MM-DD')` (que interpreta como UTC e pode voltar 1 dia).
 */
export function formatDateOnlyPtBR(value?: string | null): string {
  if (!value) return "";

  // DATE do Postgres normalmente vem como YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = parse(value, "yyyy-MM-dd", new Date());
    return format(d, "dd/MM/yyyy", { locale: ptBR });
  }

  // Fallback (caso venha timestamp/ISO)
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("pt-BR");
}

/**
 * Substituto de `new Date(valor)` para valores vindos do banco/formulários.
 * Igual ao `new Date`, exceto que "YYYY-MM-DD" (coluna DATE / <input type="date">)
 * vira meia-noite LOCAL, e não UTC — no Brasil o JS mostraria o dia anterior.
 */
export function dataBR(valor?: unknown): Date {
  if (typeof valor === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor.trim());
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(valor as any);
}
