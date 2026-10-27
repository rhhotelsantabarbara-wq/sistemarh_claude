import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "@/lib/date";
import { RelatorioConfiguravel, type TipoRel } from "../RelatorioConfiguravel";
import { chaveMes, dataBr, dias, mesAno, nomeBonito, pessoa, setorDe, todas } from "../relatorioUtil";

const situacaoFerias = (r: any) => {
  const hoje = todayISO();
  if (r.periodo_gozo_inicio > hoje) return "Aprovada";
  if (r.periodo_gozo_fim < hoje) return "Concluída";
  return "Em andamento";
};

const porSetor = { chave: "setor", rotulo: "Setor", valor: setorDe };
const porPessoa = { chave: "pessoa", rotulo: "Colaborador", valor: pessoa, ordem: "alfabetica" as const };

const TIPOS: TipoRel[] = [
  {
    chave: "afastamentos",
    nome: "Afastamentos e atestados",
    titulo: "Afastamentos e Atestados",
    buscar: () => todas((de, ate) => supabase.from("afastamentos").select("*, employees(nome_completo, setor, cargo)").order("data_inicio", { ascending: false }).range(de, ate)),
    colunas: [
      { titulo: "Colaborador", valor: pessoa, destaque: true },
      { titulo: "Setor", valor: setorDe, largura: 34 },
      { titulo: "Motivo", valor: (r) => r.motivo, largura: 60 },
      { titulo: "CID", valor: (r) => r.cid, largura: 18 },
      { titulo: "Início", valor: (r) => dataBr(r.data_inicio), largura: 22 },
      { titulo: "Fim", valor: (r) => dataBr(r.data_fim), largura: 22 },
      { titulo: "Dias", valor: (r) => dias(r.data_inicio, r.data_fim), largura: 14, alinhar: "direita" },
    ],
    agrupamentos: [
      { chave: "mes", rotulo: "Mês de início", valor: (r) => mesAno(r.data_inicio), ordem: "cronologica", chaveOrdem: (r) => chaveMes(r.data_inicio) },
      porSetor,
      porPessoa,
      { chave: "motivo", rotulo: "Motivo", valor: (r) => nomeBonito(r.motivo) || "Sem motivo" },
    ],
    campoData: (r) => r.data_inicio,
    textoBusca: (r) => `${r.employees?.nome_completo} ${r.motivo} ${r.cid}`,
  },
  {
    chave: "ferias",
    nome: "Férias",
    titulo: "Férias",
    buscar: () => todas((de, ate) => supabase.from("ferias").select("*, employees(nome_completo, setor, cargo)").order("periodo_gozo_inicio", { ascending: false }).range(de, ate)),
    colunas: [
      { titulo: "Colaborador", valor: pessoa, destaque: true },
      { titulo: "Setor", valor: setorDe, largura: 34 },
      { titulo: "Período aquisitivo", valor: (r) => `${dataBr(r.periodo_aquisitivo_inicio)} a ${dataBr(r.periodo_aquisitivo_fim)}`, largura: 44 },
      { titulo: "Início", valor: (r) => dataBr(r.periodo_gozo_inicio), largura: 22 },
      { titulo: "Fim", valor: (r) => dataBr(r.periodo_gozo_fim), largura: 22 },
      { titulo: "Dias", valor: (r) => r.dias_totais, largura: 14, alinhar: "direita" },
      { titulo: "Situação", valor: situacaoFerias, largura: 26 },
    ],
    agrupamentos: [
      { chave: "mes", rotulo: "Mês de início", valor: (r) => mesAno(r.periodo_gozo_inicio), ordem: "cronologica", chaveOrdem: (r) => chaveMes(r.periodo_gozo_inicio) },
      porSetor,
      { chave: "situacao", rotulo: "Situação", valor: situacaoFerias },
      porPessoa,
    ],
    campoData: (r) => r.periodo_gozo_inicio,
    textoBusca: (r) => `${r.employees?.nome_completo} ${r.employees?.setor}`,
  },
  {
    chave: "folgas",
    nome: "Folgas",
    titulo: "Folgas",
    buscar: () => todas((de, ate) => supabase.from("folgas").select("*, employees(nome_completo, setor, cargo)").order("data", { ascending: false }).range(de, ate)),
    colunas: [
      { titulo: "Colaborador", valor: pessoa, destaque: true },
      { titulo: "Setor", valor: setorDe, largura: 40 },
      { titulo: "Data", valor: (r) => dataBr(r.data), largura: 24 },
      { titulo: "Motivo", valor: (r) => r.motivo, largura: 70 },
    ],
    agrupamentos: [
      { chave: "mes", rotulo: "Mês", valor: (r) => mesAno(r.data), ordem: "cronologica", chaveOrdem: (r) => chaveMes(r.data) },
      porSetor,
      porPessoa,
    ],
    campoData: (r) => r.data,
    textoBusca: (r) => `${r.employees?.nome_completo} ${r.motivo}`,
  },
  {
    chave: "faltas",
    nome: "Faltas",
    titulo: "Faltas",
    buscar: () => todas((de, ate) => supabase.from("faltas").select("*, employees(nome_completo, setor, cargo)").order("data", { ascending: false }).range(de, ate)),
    colunas: [
      { titulo: "Colaborador", valor: pessoa, destaque: true },
      { titulo: "Setor", valor: setorDe, largura: 36 },
      { titulo: "Data", valor: (r) => dataBr(r.data), largura: 24 },
      { titulo: "Justificada", valor: (r) => (r.justificada ? "Sim" : "Não"), largura: 24 },
      { titulo: "Motivo", valor: (r) => r.motivo, largura: 64 },
    ],
    agrupamentos: [
      porPessoa,
      porSetor,
      { chave: "mes", rotulo: "Mês", valor: (r) => mesAno(r.data), ordem: "cronologica", chaveOrdem: (r) => chaveMes(r.data) },
      { chave: "just", rotulo: "Justificada", valor: (r) => (r.justificada ? "Justificadas" : "Não justificadas") },
    ],
    campoData: (r) => r.data,
    textoBusca: (r) => `${r.employees?.nome_completo} ${r.motivo}`,
  },
];

const AttendanceReports = () => <RelatorioConfiguravel titulo="Relatórios de frequência" tipos={TIPOS} />;

export default AttendanceReports;
