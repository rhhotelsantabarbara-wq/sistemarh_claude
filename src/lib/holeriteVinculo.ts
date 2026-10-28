// Descobre de quem é cada página de holerite lendo o texto do PDF:
// 1º pelo CPF, 2º pelo nome completo, 3º por nome parecido (quase todas as palavras do nome).

export interface FuncionarioVinculo {
  id: string;
  nome_completo: string;
  cpf: string | null;
}

export type ComoEncontrou = "cpf" | "nome" | "nome_parecido";

export interface ResultadoVinculo {
  employee_id: string;
  como: ComoEncontrou;
}

export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();

const PARTICULAS = new Set(["DA", "DE", "DO", "DAS", "DOS", "E"]);
const palavras = (nome: string) => normalizar(nome).split(" ").filter((p) => p.length > 1 && !PARTICULAS.has(p));

export function vincularPorTexto(texto: string, funcionarios: FuncionarioVinculo[]): ResultadoVinculo | null {
  if (!texto.trim()) return null;
  const digitos = texto.replace(/[^\d]/g, " ");
  const norm = ` ${normalizar(texto)} `;
  const semEspaco = norm.replace(/ /g, "");

  // 1) CPF (com ou sem pontuação)
  const cpfsNoTexto = new Set<string>();
  for (const m of texto.matchAll(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g)) cpfsNoTexto.add(m[0].replace(/\D/g, ""));
  for (const m of digitos.matchAll(/\d{11}/g)) cpfsNoTexto.add(m[0]);
  const porCpf = funcionarios.filter((f) => {
    const c = (f.cpf || "").replace(/\D/g, "");
    return c.length === 11 && cpfsNoTexto.has(c);
  });
  if (porCpf.length === 1) return { employee_id: porCpf[0].id, como: "cpf" };

  // 2) Nome completo escrito na página (fica com o nome mais longo, para "ANA SILVA" não ganhar de "ANA SILVA SANTOS")
  let melhor: FuncionarioVinculo | null = null;
  let melhorTam = 0;
  for (const f of funcionarios) {
    const n = normalizar(f.nome_completo);
    if (n.length < 8) continue;
    const achou = norm.includes(` ${n} `) || semEspaco.includes(n.replace(/ /g, ""));
    if (achou && n.length > melhorTam) { melhor = f; melhorTam = n.length; }
  }
  if (melhor) return { employee_id: melhor.id, como: "nome" };

  // 3) Nome parecido: primeiro e último nome presentes e pelo menos 75% das palavras (nome abreviado ou com erro)
  const tokensTexto = new Set(norm.trim().split(" "));
  let candidatos: { f: FuncionarioVinculo; nota: number }[] = [];
  for (const f of funcionarios) {
    const ps = palavras(f.nome_completo);
    if (ps.length < 2) continue;
    if (!tokensTexto.has(ps[0]) || !tokensTexto.has(ps[ps.length - 1])) continue;
    const nota = ps.filter((p) => tokensTexto.has(p)).length / ps.length;
    if (nota >= 0.75) candidatos.push({ f, nota });
  }
  candidatos = candidatos.sort((a, b) => b.nota - a.nota);
  if (candidatos.length === 1 || (candidatos.length > 1 && candidatos[0].nota > candidatos[1].nota)) {
    return { employee_id: candidatos[0].f.id, como: "nome_parecido" };
  }
  return null;
}

const MESES_NOME = ["JANEIRO", "FEVEREIRO", "MARCO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

/** Competência escrita por extenso, ex.: "Outubro/2026", "OUTUBRO DE 2026" */
export function competenciaDoTexto(texto: string): { mes: number; ano: number } | null {
  const norm = normalizar(texto);
  const re = new RegExp(`\\b(${MESES_NOME.join("|")})\\s+(?:DE\\s+)?(20\\d{2})\\b`, "g");
  const contagem = new Map<string, number>();
  for (const m of norm.matchAll(re)) {
    const k = `${MESES_NOME.indexOf(m[1]) + 1}-${m[2]}`;
    contagem.set(k, (contagem.get(k) || 0) + 1);
  }
  if (!contagem.size) return null;
  const [k] = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0];
  const [mes, ano] = k.split("-").map(Number);
  return { mes, ano };
}

/** Nome que aparece na página (para mostrar quando não achou ninguém) */
export function nomeProvavel(texto: string): string | null {
  const linhas = texto.split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < linhas.length; i++) {
    const m = linhas[i].match(/(?:NOME(?:\s+DO\s+(?:FUNCION[AÁ]RIO|EMPREGADO|COLABORADOR))?|FUNCION[AÁ]RIO|EMPREGADO)\s*[:\-]?\s*([A-ZÀ-Ú][A-ZÀ-Ú .']{6,})/i);
    if (m) return m[1].replace(/\s{2,}.*/, "").trim();
  }
  return null;
}
