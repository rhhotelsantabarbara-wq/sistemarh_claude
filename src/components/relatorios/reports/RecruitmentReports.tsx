import { supabase } from "@/integrations/supabase/client";
import { RelatorioConfiguravel, type TipoRel } from "../RelatorioConfiguravel";
import { chaveMes, dataBr, mesAno, nomeBonito, todas } from "../relatorioUtil";

const STATUS: Record<string, string> = {
  nova: "Nova",
  pendente: "Nova",
  em_analise: "Em análise",
  entrevista: "Entrevista",
  aprovada: "Aprovada",
  aprovado: "Aprovada",
  reprovada: "Reprovada",
  reprovado: "Reprovada",
  contratada: "Contratada",
  contratado: "Contratada",
};
const status = (r: any) => STATUS[r.status] || nomeBonito(String(r.status || "").replace(/_/g, " ")) || "—";
const vaga = (r: any) => r.vagas?.titulo || "Sem vaga";

const TIPOS: TipoRel[] = [
  {
    chave: "candidaturas",
    nome: "Candidaturas",
    titulo: "Candidaturas",
    buscar: () => todas((de, ate) => supabase.from("candidaturas").select("*, vagas(titulo)").order("data_candidatura", { ascending: false }).range(de, ate)),
    colunas: [
      { titulo: "Candidato", valor: (r) => nomeBonito(r.nome_completo), destaque: true },
      { titulo: "Vaga", valor: vaga, largura: 48 },
      { titulo: "Data", valor: (r) => dataBr(r.data_candidatura), largura: 22 },
      { titulo: "Situação", valor: status, largura: 28 },
      { titulo: "Nota", valor: (r) => r.nota_avaliacao, largura: 14, alinhar: "direita" },
      { titulo: "Telefone", valor: (r) => r.telefone, largura: 32 },
      { titulo: "E-mail", valor: (r) => r.email, largura: 52 },
    ],
    agrupamentos: [
      { chave: "vaga", rotulo: "Vaga", valor: vaga },
      { chave: "status", rotulo: "Situação", valor: status },
      { chave: "mes", rotulo: "Mês", valor: (r) => mesAno(r.data_candidatura), ordem: "cronologica", chaveOrdem: (r) => chaveMes(r.data_candidatura) },
    ],
    campoData: (r) => r.data_candidatura,
    textoBusca: (r) => `${r.nome_completo} ${r.vagas?.titulo} ${r.email} ${r.telefone}`,
  },
];

const RecruitmentReports = () => <RelatorioConfiguravel titulo="Relatório de recrutamento" tipos={TIPOS} />;

export default RecruitmentReports;
