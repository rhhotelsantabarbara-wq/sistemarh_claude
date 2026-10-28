// Campos da ficha completa do colaborador (além dos campos básicos que já existiam).
// Um único catálogo alimenta o formulário, a ficha de leitura e a admissão por link.

export type TipoCampo = "texto" | "data" | "numero" | "dinheiro" | "select" | "sim_nao" | "funcionario" | "telefone" | "email";

export interface CampoFicha {
  campo: string;
  rotulo: string;
  tipo: TipoCampo;
  opcoes?: string[];
  placeholder?: string;
  largo?: boolean; // ocupa a linha toda
  dica?: string;
  /** só aparece quando outro campo tem esse valor */
  mostrarSe?: (v: Record<string, string>) => boolean;
  /** o candidato pode preencher na admissão por link */
  candidato?: boolean;
  /** valor sensível (salário/benefícios em dinheiro): esconder de quem não vê salário */
  financeiro?: boolean;
}

export interface GrupoFicha {
  chave: string;
  titulo: string;
  campos: CampoFicha[];
}

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export const ESTADO_CIVIL = ["Solteiro(a)", "Casado(a)", "União estável", "Divorciado(a)", "Separado(a)", "Viúvo(a)"];
export const GRAU_INSTRUCAO = [
  "Analfabeto",
  "Fundamental incompleto (até o 5º ano)",
  "5º ano completo",
  "Fundamental incompleto (6º ao 9º ano)",
  "Fundamental completo",
  "Médio incompleto",
  "Médio completo",
  "Superior incompleto",
  "Superior completo",
  "Pós-graduação",
  "Mestrado",
  "Doutorado",
];
export const PARENTESCO = ["Cônjuge", "Companheiro(a)", "Filho(a)", "Enteado(a)", "Pai", "Mãe", "Irmão(ã)", "Outro"];

const pcd = (v: Record<string, string>) => v.pcd === "true";
const vt = (v: Record<string, string>) => v.vt_opta === "true";

export const GRUPOS_FICHA: GrupoFicha[] = [
  {
    chave: "pessoais",
    titulo: "Dados complementares",
    campos: [
      { campo: "nome_social", rotulo: "Nome social", tipo: "texto", candidato: true },
      { campo: "estado_civil", rotulo: "Estado civil", tipo: "select", opcoes: ESTADO_CIVIL, candidato: true },
      { campo: "grau_instrucao", rotulo: "Escolaridade", tipo: "select", opcoes: GRAU_INSTRUCAO, candidato: true },
      { campo: "email_pessoal", rotulo: "E-mail pessoal", tipo: "email", candidato: true },
      { campo: "pais_nascimento", rotulo: "País de nascimento", tipo: "texto", placeholder: "Brasil", candidato: true },
    ],
  },
  {
    chave: "emergencia",
    titulo: "Contato de emergência",
    campos: [
      { campo: "contato_emergencia_nome", rotulo: "Nome", tipo: "texto", candidato: true },
      { campo: "contato_emergencia_telefone", rotulo: "Telefone", tipo: "telefone", candidato: true },
      { campo: "contato_emergencia_parentesco", rotulo: "Parentesco", tipo: "texto", placeholder: "Ex.: mãe, esposa", candidato: true },
    ],
  },
  {
    chave: "pcd",
    titulo: "Pessoa com deficiência",
    campos: [
      { campo: "pcd", rotulo: "É pessoa com deficiência?", tipo: "sim_nao", candidato: true },
      { campo: "pcd_tipo", rotulo: "Tipo de deficiência", tipo: "select", opcoes: ["Física", "Auditiva", "Visual", "Intelectual", "Mental", "Múltipla"], mostrarSe: pcd, candidato: true },
      { campo: "pcd_reabilitado", rotulo: "Reabilitado pelo INSS", tipo: "sim_nao", mostrarSe: pcd, candidato: true },
      { campo: "pcd_cota", rotulo: "Conta na cota de PcD", tipo: "sim_nao", mostrarSe: pcd },
    ],
  },
  {
    chave: "documentos",
    titulo: "Outros documentos",
    campos: [
      { campo: "ctps_serie", rotulo: "CTPS - série", tipo: "texto", candidato: true },
      { campo: "ctps_uf", rotulo: "CTPS - UF", tipo: "select", opcoes: UFS, candidato: true },
      { campo: "titulo_eleitor", rotulo: "Título de eleitor", tipo: "texto", candidato: true },
      { campo: "titulo_zona", rotulo: "Zona", tipo: "texto", candidato: true },
      { campo: "titulo_secao", rotulo: "Seção", tipo: "texto", candidato: true },
      { campo: "reservista", rotulo: "Certificado de reservista", tipo: "texto", candidato: true },
      { campo: "cnh_numero", rotulo: "CNH - número", tipo: "texto", candidato: true },
      { campo: "cnh_categoria", rotulo: "CNH - categoria", tipo: "select", opcoes: ["A", "B", "AB", "C", "D", "E", "AC", "AD", "AE"], candidato: true },
      { campo: "cnh_validade", rotulo: "CNH - validade", tipo: "data", candidato: true },
      { campo: "conselho_classe", rotulo: "Registro em conselho", tipo: "texto", placeholder: "Ex.: COREN-SP 123456", candidato: true },
      { campo: "certidao", rotulo: "Certidão de nascimento/casamento", tipo: "texto", placeholder: "Matrícula ou livro/folha/termo", candidato: true },
    ],
  },
  {
    chave: "banco",
    titulo: "Dados bancários",
    campos: [
      { campo: "banco", rotulo: "Banco", tipo: "texto", placeholder: "Ex.: Caixa, Itaú", candidato: true },
      { campo: "agencia", rotulo: "Agência", tipo: "texto", candidato: true },
      { campo: "conta", rotulo: "Conta", tipo: "texto", candidato: true },
      { campo: "conta_tipo", rotulo: "Tipo de conta", tipo: "select", opcoes: ["Corrente", "Poupança", "Salário"], candidato: true },
      { campo: "pix_chave", rotulo: "Chave PIX", tipo: "texto", candidato: true },
    ],
  },
  {
    chave: "contrato",
    titulo: "Contrato e jornada",
    campos: [
      { campo: "categoria_esocial", rotulo: "Categoria (eSocial)", tipo: "select", opcoes: ["101 - Empregado geral", "103 - Aprendiz", "105 - Prazo determinado", "111 - Intermitente", "701 - Autônomo", "901 - Estagiário"] },
      { campo: "experiencia_dias", rotulo: "Experiência - 1º período (dias)", tipo: "numero", placeholder: "45" },
      { campo: "experiencia_prorrogacao_dias", rotulo: "Experiência - prorrogação (dias)", tipo: "numero", placeholder: "45" },
      { campo: "escala", rotulo: "Escala", tipo: "select", opcoes: ["6x1", "5x2", "12x36", "Intermitente", "Outra"] },
      { campo: "horas_semanais", rotulo: "Horas semanais", tipo: "numero", placeholder: "44" },
      { campo: "horario_trabalho", rotulo: "Horário de trabalho", tipo: "texto", placeholder: "Ex.: 07:00-15:20, intervalo 1h" },
      { campo: "sindicato", rotulo: "Sindicato", tipo: "texto" },
      { campo: "primeiro_emprego", rotulo: "Primeiro emprego", tipo: "sim_nao", candidato: true },
      { campo: "insalubridade", rotulo: "Insalubridade", tipo: "select", opcoes: ["Não", "Grau mínimo (10%)", "Grau médio (20%)", "Grau máximo (40%)"] },
      { campo: "periculosidade", rotulo: "Periculosidade (30%)", tipo: "sim_nao" },
      { campo: "adicional_noturno", rotulo: "Adicional noturno", tipo: "sim_nao" },
      { campo: "aso_admissional_data", rotulo: "Data do ASO admissional", tipo: "data" },
    ],
  },
  {
    chave: "organizacao",
    titulo: "Organização",
    campos: [
      { campo: "gestor_id", rotulo: "Gestor direto", tipo: "funcionario" },
      { campo: "centro_custo", rotulo: "Centro de custo", tipo: "texto" },
      { campo: "local_trabalho", rotulo: "Local de trabalho", tipo: "texto", placeholder: "Ex.: Hotel, Fazenda" },
    ],
  },
  {
    chave: "beneficios",
    titulo: "Benefícios",
    campos: [
      { campo: "vt_opta", rotulo: "Usa vale-transporte", tipo: "sim_nao", candidato: true },
      { campo: "vt_linhas", rotulo: "Linhas / trajeto", tipo: "texto", mostrarSe: vt, candidato: true },
      { campo: "vt_valor_diario", rotulo: "Valor do VT por dia", tipo: "dinheiro", mostrarSe: vt },
      { campo: "vale_refeicao_valor", rotulo: "Vale-refeição (mês)", tipo: "dinheiro" },
      { campo: "vale_alimentacao_valor", rotulo: "Vale-alimentação (mês)", tipo: "dinheiro" },
      { campo: "plano_saude", rotulo: "Plano de saúde", tipo: "texto", placeholder: "Operadora / plano" },
      { campo: "plano_odonto", rotulo: "Plano odontológico", tipo: "texto" },
      { campo: "seguro_vida", rotulo: "Seguro de vida", tipo: "sim_nao" },
    ],
  },
  {
    chave: "tamanhos",
    titulo: "Tamanhos (uniforme e EPI)",
    campos: [
      { campo: "tamanho_camisa", rotulo: "Camisa", tipo: "select", opcoes: ["PP", "P", "M", "G", "GG", "XG", "XGG"], candidato: true },
      { campo: "tamanho_calca", rotulo: "Calça", tipo: "texto", placeholder: "Ex.: 40 ou M", candidato: true },
      { campo: "tamanho_calcado", rotulo: "Calçado", tipo: "texto", placeholder: "Ex.: 39", candidato: true },
    ],
  },
  {
    chave: "desligamento",
    titulo: "Desligamento",
    campos: [
      { campo: "desligamento_tipo", rotulo: "Tipo de desligamento", tipo: "select", opcoes: ["Pedido de demissão", "Sem justa causa", "Com justa causa", "Término de experiência", "Término de contrato", "Acordo (art. 484-A)", "Aposentadoria", "Falecimento"] },
      { campo: "aviso_previo", rotulo: "Aviso prévio", tipo: "select", opcoes: ["Trabalhado", "Indenizado", "Dispensado", "Não se aplica"] },
      { campo: "exame_demissional_data", rotulo: "Data do exame demissional", tipo: "data" },
      { campo: "desligamento_motivo", rotulo: "Motivo / observações", tipo: "texto", largo: true },
    ],
  },
];

export const CAMPOS_FICHA: CampoFicha[] = GRUPOS_FICHA.flatMap((g) => g.campos);
export const grupo = (chave: string) => GRUPOS_FICHA.find((g) => g.chave === chave)!;

/** Valor do banco -> texto do formulário */
export const paraFormulario = (dados: any): Record<string, string> => {
  const r: Record<string, string> = {};
  for (const c of CAMPOS_FICHA) {
    const v = dados?.[c.campo];
    r[c.campo] = v === null || v === undefined ? (c.tipo === "sim_nao" ? "false" : "") : String(v);
  }
  return r;
};

/** Texto do formulário -> valor do banco */
export const paraBanco = (valores: Record<string, string>): Record<string, any> => {
  const r: Record<string, any> = {};
  for (const c of CAMPOS_FICHA) {
    if (!(c.campo in valores)) continue;
    const v = (valores[c.campo] ?? "").trim();
    if (c.tipo === "sim_nao") r[c.campo] = v === "true";
    else if (c.tipo === "numero" || c.tipo === "dinheiro") {
      const n = parseFloat(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v);
      r[c.campo] = v === "" || Number.isNaN(n) ? null : c.tipo === "numero" && c.campo.startsWith("experiencia") ? Math.round(n) : n;
    } else r[c.campo] = v === "" ? null : v;
  }
  return r;
};

/** Valor para exibir na ficha */
export const formatarValor = (c: CampoFicha, v: any, nomes?: Record<string, string>): string => {
  if (v === null || v === undefined || v === "") return c.tipo === "sim_nao" ? "Não" : "—";
  if (c.tipo === "sim_nao") return v === true || v === "true" ? "Sim" : "Não";
  if (c.tipo === "data") {
    const [a, m, d] = String(v).slice(0, 10).split("-");
    return d ? `${d}/${m}/${a}` : String(v);
  }
  if (c.tipo === "dinheiro") return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (c.tipo === "funcionario") return nomes?.[v] || "—";
  return String(v);
};

/** Fim da experiência: 1º período e prorrogação, contando o dia da admissão */
export const fimExperiencia = (dataAdmissao: string | null | undefined, dias: number | null | undefined, prorrogacao: number | null | undefined) => {
  if (!dataAdmissao) return null;
  const [a, m, d] = dataAdmissao.slice(0, 10).split("-").map(Number);
  const soma = (n: number) => {
    const dt = new Date(a, m - 1, d + n - 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  };
  const p1 = dias || 45;
  return { primeiro: soma(p1), prorrogacao: prorrogacao ? soma(p1 + prorrogacao) : null };
};

// Campos básicos do cadastro (já existiam na tabela), usados na admissão por link
export const GRUPOS_BASE: GrupoFicha[] = [
  {
    chave: "base_pessoais",
    titulo: "Seus dados",
    campos: [
      { campo: "nome_completo", rotulo: "Nome completo *", tipo: "texto", largo: true, candidato: true },
      { campo: "cpf", rotulo: "CPF *", tipo: "texto", placeholder: "000.000.000-00", candidato: true },
      { campo: "data_nascimento", rotulo: "Data de nascimento *", tipo: "data", candidato: true },
      { campo: "telefone", rotulo: "Celular / WhatsApp *", tipo: "telefone", placeholder: "(00) 00000-0000", candidato: true },
      { campo: "sexo", rotulo: "Sexo", tipo: "select", opcoes: ["Masculino", "Feminino", "Outro", "Prefiro não informar"], candidato: true },
      { campo: "raca_cor", rotulo: "Raça/cor", tipo: "select", opcoes: ["Branca", "Preta", "Parda", "Amarela", "Indígena", "Não informado"], candidato: true },
      { campo: "nacionalidade", rotulo: "Nacionalidade", tipo: "select", opcoes: ["Brasileiro(a)", "Estrangeiro(a)"], candidato: true },
      { campo: "naturalidade_municipio", rotulo: "Cidade onde nasceu", tipo: "texto", candidato: true },
      { campo: "naturalidade_estado", rotulo: "Estado onde nasceu", tipo: "select", opcoes: UFS, candidato: true },
      { campo: "nome_mae", rotulo: "Nome da mãe *", tipo: "texto", largo: true, candidato: true },
      { campo: "nome_pai", rotulo: "Nome do pai", tipo: "texto", largo: true, candidato: true },
    ],
  },
  {
    chave: "base_documentos",
    titulo: "Documentos principais",
    campos: [
      { campo: "rg", rotulo: "RG", tipo: "texto", candidato: true },
      { campo: "rg_orgao_expedidor", rotulo: "Órgão emissor", tipo: "texto", placeholder: "SSP", candidato: true },
      { campo: "rg_uf", rotulo: "UF do RG", tipo: "select", opcoes: UFS, candidato: true },
      { campo: "rg_data_emissao", rotulo: "Data de emissão do RG", tipo: "data", candidato: true },
      { campo: "pis", rotulo: "PIS / NIS", tipo: "texto", dica: "Fica na Carteira de Trabalho Digital ou no app Caixa Tem", candidato: true },
      { campo: "carteira_trabalho", rotulo: "Número da Carteira de Trabalho", tipo: "texto", candidato: true },
    ],
  },
  {
    chave: "base_endereco",
    titulo: "Endereço",
    campos: [
      { campo: "cep", rotulo: "CEP", tipo: "texto", placeholder: "00000-000", candidato: true },
      { campo: "endereco", rotulo: "Rua / avenida", tipo: "texto", largo: true, candidato: true },
      { campo: "endereco_numero", rotulo: "Número", tipo: "texto", candidato: true },
      { campo: "endereco_complemento", rotulo: "Complemento", tipo: "texto", candidato: true },
      { campo: "bairro", rotulo: "Bairro", tipo: "texto", candidato: true },
      { campo: "cidade", rotulo: "Cidade", tipo: "texto", candidato: true },
      { campo: "uf", rotulo: "Estado", tipo: "select", opcoes: UFS, candidato: true },
    ],
  },
];

/** Todos os campos que aparecem na admissão por link, com o rótulo para a conferência do RH */
export const CAMPOS_ADMISSAO: CampoFicha[] = [...GRUPOS_BASE, ...GRUPOS_FICHA].flatMap((g) => g.campos).filter((c) => c.candidato);
