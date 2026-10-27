// Formatação comum dos relatórios
import { buscarTudo } from "@/lib/buscarTudo";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export const dataBr = (v?: string | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};
export const mesAno = (v?: string | null) => {
  const m = /^(\d{4})-(\d{2})/.exec(v || "");
  return m ? `${MESES[Number(m[2]) - 1]} de ${m[1]}` : "Sem data";
};
export const chaveMes = (v?: string | null) => (v || "").slice(0, 7);
export const dias = (ini?: string | null, fim?: string | null) => {
  const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(ini || "");
  const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(fim || "");
  if (!a || !b) return "";
  return String(Math.round((Date.UTC(+b[1], +b[2] - 1, +b[3]) - Date.UTC(+a[1], +a[2] - 1, +a[3])) / 86400000) + 1);
};
export const nomeBonito = (s?: string | null) =>
  (s || "").toLowerCase().replace(/(^|\s)(\p{L})/gu, (m) => m.toUpperCase()).replace(/\s(De|Da|Do|Das|Dos|E)\s/g, (m) => m.toLowerCase());
export const pessoa = (r: any) => nomeBonito(r.employees?.nome_completo) || "—";
export const setorDe = (r: any) => r.employees?.setor || "Sem setor";

export async function todas(montar: (de: number, ate: number) => any) {
  return buscarTudo<any>((de, ate) => montar(de, ate));
}
