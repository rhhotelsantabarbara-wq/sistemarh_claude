import { supabase } from "@/integrations/supabase/client";
import { RelatorioConfiguravel, type TipoRel } from "../RelatorioConfiguravel";
import { chaveMes, dataBr, mesAno, nomeBonito, pessoa, setorDe, todas } from "../relatorioUtil";

const situacaoEstoque = (r: any) => {
  const min = r.quantidade_minima ?? 0;
  if ((r.quantidade_estoque ?? 0) <= 0) return "Sem estoque";
  if ((r.quantidade_estoque ?? 0) <= min) return "Abaixo do mínimo";
  return "Em ordem";
};
const ordemEstoque = (a: any, b: any) => (a.quantidade_estoque ?? 0) - (b.quantidade_estoque ?? 0);

const TIPOS: TipoRel[] = [
  {
    chave: "estoque-epi",
    nome: "Estoque de EPIs",
    titulo: "Estoque de EPIs",
    buscar: () => todas((de, ate) => supabase.from("estoque_epis").select("*").order("tipo_epi").range(de, ate)),
    colunas: [
      { titulo: "EPI", valor: (r) => r.tipo_epi, destaque: true },
      { titulo: "Marca / modelo", valor: (r) => r.marca_modelo, largura: 50 },
      { titulo: "CA", valor: (r) => r.ca, largura: 20 },
      { titulo: "Tamanho", valor: (r) => r.tamanho, largura: 20 },
      { titulo: "Estoque", valor: (r) => r.quantidade_estoque ?? 0, largura: 20, alinhar: "direita" },
      { titulo: "Mínimo", valor: (r) => r.quantidade_minima ?? 0, largura: 20, alinhar: "direita" },
      { titulo: "Situação", valor: situacaoEstoque, largura: 32 },
    ],
    agrupamentos: [
      { chave: "situacao", rotulo: "Situação", valor: situacaoEstoque },
      { chave: "item", rotulo: "EPI", valor: (r) => r.tipo_epi || "—", ordem: "alfabetica" },
    ],
    textoBusca: (r) => `${r.tipo_epi} ${r.marca_modelo} ${r.ca}`,
    ordenar: ordemEstoque,
  },
  {
    chave: "estoque-uniforme",
    nome: "Estoque de uniformes",
    titulo: "Estoque de Uniformes",
    buscar: () => todas((de, ate) => supabase.from("estoque_uniformes").select("*").order("tipo_uniforme").range(de, ate)),
    colunas: [
      { titulo: "Uniforme", valor: (r) => r.tipo_uniforme, destaque: true },
      { titulo: "Tamanho", valor: (r) => r.tamanho, largura: 24 },
      { titulo: "Cor", valor: (r) => r.cor, largura: 30 },
      { titulo: "Estoque", valor: (r) => r.quantidade_estoque ?? 0, largura: 22, alinhar: "direita" },
      { titulo: "Mínimo", valor: (r) => r.quantidade_minima ?? 0, largura: 22, alinhar: "direita" },
      { titulo: "Situação", valor: situacaoEstoque, largura: 32 },
    ],
    agrupamentos: [
      { chave: "situacao", rotulo: "Situação", valor: situacaoEstoque },
      { chave: "item", rotulo: "Uniforme", valor: (r) => r.tipo_uniforme || "—", ordem: "alfabetica" },
    ],
    textoBusca: (r) => `${r.tipo_uniforme} ${r.tamanho} ${r.cor}`,
    ordenar: ordemEstoque,
  },
  {
    chave: "entregas-epi",
    nome: "Entregas de EPIs",
    titulo: "Entregas de EPIs",
    buscar: () => todas((de, ate) => supabase.from("epis").select("*, employees(nome_completo, setor)").order("data_entrega", { ascending: false }).range(de, ate)),
    colunas: [
      { titulo: "Data", valor: (r) => dataBr(r.data_entrega), largura: 22 },
      { titulo: "Colaborador", valor: pessoa, destaque: true },
      { titulo: "Setor", valor: setorDe, largura: 32 },
      { titulo: "EPI", valor: (r) => r.tipo_epi, largura: 60 },
      { titulo: "Qtd", valor: (r) => r.quantidade, largura: 14, alinhar: "direita" },
      { titulo: "Assinado", valor: (r) => (r.data_assinatura || r.assinatura_funcionario ? "Sim" : "Não"), largura: 20 },
    ],
    agrupamentos: [
      { chave: "pessoa", rotulo: "Colaborador", valor: pessoa, ordem: "alfabetica" },
      { chave: "setor", rotulo: "Setor", valor: setorDe },
      { chave: "item", rotulo: "EPI", valor: (r) => r.tipo_epi || "—" },
      { chave: "mes", rotulo: "Mês", valor: (r) => mesAno(r.data_entrega), ordem: "cronologica", chaveOrdem: (r) => chaveMes(r.data_entrega) },
    ],
    campoData: (r) => r.data_entrega,
    textoBusca: (r) => `${r.employees?.nome_completo} ${r.tipo_epi}`,
  },
  {
    chave: "entregas-uniforme",
    nome: "Entregas de uniformes",
    titulo: "Entregas de Uniformes",
    buscar: () => todas((de, ate) => supabase.from("uniformes").select("*, employees(nome_completo, setor)").order("data_entrega", { ascending: false }).range(de, ate)),
    colunas: [
      { titulo: "Data", valor: (r) => dataBr(r.data_entrega), largura: 22 },
      { titulo: "Colaborador", valor: pessoa, destaque: true },
      { titulo: "Setor", valor: setorDe, largura: 32 },
      { titulo: "Uniforme", valor: (r) => nomeBonito(r.tipo_uniforme), largura: 50 },
      { titulo: "Tamanho", valor: (r) => r.tamanho, largura: 18 },
      { titulo: "Qtd", valor: (r) => r.quantidade, largura: 14, alinhar: "direita" },
      { titulo: "Assinado", valor: (r) => (r.data_assinatura || r.assinatura_funcionario ? "Sim" : "Não"), largura: 20 },
    ],
    agrupamentos: [
      { chave: "pessoa", rotulo: "Colaborador", valor: pessoa, ordem: "alfabetica" },
      { chave: "setor", rotulo: "Setor", valor: setorDe },
      { chave: "item", rotulo: "Uniforme", valor: (r) => nomeBonito(r.tipo_uniforme) || "—" },
      { chave: "mes", rotulo: "Mês", valor: (r) => mesAno(r.data_entrega), ordem: "cronologica", chaveOrdem: (r) => chaveMes(r.data_entrega) },
    ],
    campoData: (r) => r.data_entrega,
    textoBusca: (r) => `${r.employees?.nome_completo} ${r.tipo_uniforme}`,
  },
];

const StockReports = () => <RelatorioConfiguravel titulo="Relatórios de EPIs e uniformes" tipos={TIPOS} />;

export default StockReports;
