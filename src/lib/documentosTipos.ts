import { todayISO } from "@/lib/date";

export interface TipoDocumento {
  chave: string;
  nome: string;
  /** documento que costuma ter data de validade */
  vence?: boolean;
  /** pedido na admissão por link */
  admissao?: "obrigatorio" | "opcional";
  dica?: string;
}

export const TIPOS_DOCUMENTO: TipoDocumento[] = [
  { chave: "foto", nome: "Foto (rosto)", admissao: "obrigatorio", dica: "Uma selfie de frente, com fundo claro" },
  { chave: "rg", nome: "RG (frente e verso)", admissao: "obrigatorio", dica: "Ou CNH, se não tiver RG" },
  { chave: "cpf", nome: "CPF", admissao: "opcional", dica: "Só se o número não estiver no RG" },
  { chave: "ctps", nome: "Carteira de Trabalho", admissao: "obrigatorio", dica: "Print da CTPS Digital (página de dados) ou foto da física" },
  { chave: "comprovante_residencia", nome: "Comprovante de residência", admissao: "obrigatorio", dica: "Conta de luz, água ou telefone recente" },
  { chave: "titulo_eleitor", nome: "Título de eleitor", admissao: "opcional" },
  { chave: "reservista", nome: "Certificado de reservista", admissao: "opcional", dica: "Homens de 18 a 45 anos" },
  { chave: "certidao", nome: "Certidão de nascimento ou casamento", admissao: "opcional" },
  { chave: "escolaridade", nome: "Comprovante de escolaridade", admissao: "opcional" },
  { chave: "cnh", nome: "CNH", vence: true, admissao: "opcional" },
  { chave: "certidao_filhos", nome: "Certidão dos filhos", admissao: "opcional", dica: "Filhos menores de 14 anos (salário-família)" },
  { chave: "vacinacao_filhos", nome: "Caderneta de vacinação dos filhos", admissao: "opcional", dica: "Filhos menores de 7 anos" },
  { chave: "conta_bancaria", nome: "Comprovante de conta bancária", admissao: "opcional" },
  { chave: "aso", nome: "ASO (atestado de saúde ocupacional)", vence: true },
  { chave: "certificado_nr", nome: "Certificado de NR / treinamento", vence: true },
  { chave: "contrato_experiencia", nome: "Contrato de experiência", vence: true },
  { chave: "contrato", nome: "Contrato de trabalho" },
  { chave: "atestado", nome: "Atestado médico" },
  { chave: "outro", nome: "Outro" },
];

export const tipoDocumento = (chave?: string | null) => TIPOS_DOCUMENTO.find((t) => t.chave === chave);
export const nomeTipoDocumento = (chave?: string | null) => tipoDocumento(chave)?.nome || (chave ? chave : "Sem tipo");

export const DIAS_AVISO_VENCIMENTO = 30;

/** Situação da validade: vencido, vence em breve (até 30 dias) ou em dia */
export const situacaoValidade = (validade?: string | null, hoje = todayISO()) => {
  if (!validade) return null;
  const [a, m, d] = validade.slice(0, 10).split("-").map(Number);
  const [ha, hm, hd] = hoje.split("-").map(Number);
  const dias = Math.round((Date.UTC(a, m - 1, d) - Date.UTC(ha, hm - 1, hd)) / 86400000);
  if (dias < 0) return { tipo: "vencido" as const, dias, texto: `Vencido há ${-dias} ${dias === -1 ? "dia" : "dias"}` };
  if (dias === 0) return { tipo: "breve" as const, dias, texto: "Vence hoje" };
  if (dias <= DIAS_AVISO_VENCIMENTO) return { tipo: "breve" as const, dias, texto: `Vence em ${dias} ${dias === 1 ? "dia" : "dias"}` };
  const [va, vm, vd] = [a, m, d];
  return { tipo: "ok" as const, dias, texto: `Válido até ${String(vd).padStart(2, "0")}/${String(vm).padStart(2, "0")}/${va}` };
};
