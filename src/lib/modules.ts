// Catálogo central de módulos do sistema usado por permissões de admin_parcial
export interface ModuleDef {
  key: string;
  label: string;
  path: string;
  group: string;
}

export const MODULES: ModuleDef[] = [
  { key: "dashboard", label: "Visão Geral", path: "/dashboard", group: "Principal" },
  { key: "managers", label: "Gestores", path: "/managers", group: "Pessoas" },
  { key: "admissao-digital", label: "Admissão digital", path: "/admissao-digital", group: "Pessoas" },
  { key: "funcoes", label: "Funções", path: "/funcoes", group: "Pessoas" },
  { key: "people-manager", label: "People Manager", path: "/people-manager", group: "Pessoas" },
  { key: "controle-ponto", label: "Controle de Ponto", path: "/controle-ponto", group: "Operacional" },
  { key: "vacation-schedule", label: "Escala de Férias", path: "/vacation-schedule", group: "Operacional" },
  { key: "avaliacoes", label: "Avaliações", path: "/avaliacoes", group: "Operacional" },
  { key: "treinamentos", label: "Treinamentos", path: "/treinamentos", group: "Operacional" },
  { key: "plano-admissao-desligamento", label: "Checklists", path: "/plano-admissao-desligamento", group: "Operacional" },
  { key: "eventos", label: "Eventos", path: "/eventos", group: "Operacional" },
  { key: "vagas", label: "Vagas", path: "/vagas", group: "Recrutamento" },
  { key: "recrutamento", label: "Candidaturas", path: "/recrutamento", group: "Recrutamento" },
  { key: "payroll", label: "Folha de Pagamento", path: "/payroll", group: "Financeiro" },
  { key: "meus-holerites", label: "Meus Holerites", path: "/meus-holerites", group: "Financeiro" },
  { key: "salary-adjustment", label: "Reajuste Salarial", path: "/salary-adjustment", group: "Financeiro" },
  { key: "adiantamentos", label: "Adiantamentos", path: "/adiantamentos", group: "Financeiro" },
  { key: "financeiro", label: "Financeiro", path: "/financeiro", group: "Financeiro" },
  { key: "contracts", label: "Contratos", path: "/contracts", group: "Documentos" },
  { key: "tacs", label: "TACs", path: "/tacs", group: "Documentos" },
  { key: "crachas", label: "Crachás", path: "/crachas", group: "Documentos" },
  { key: "consulta-judicial", label: "Consulta Judicial", path: "/consulta-judicial", group: "Documentos" },
  { key: "stock", label: "EPIs / Uniformes", path: "/stock", group: "Estoque" },
  { key: "distribuir-epi", label: "Distribuir EPI", path: "/distribuir-epi", group: "Estoque" },
  { key: "distribuir-uniforme", label: "Distribuir Uniforme", path: "/distribuir-uniforme", group: "Estoque" },
  { key: "afastamentos", label: "Afastamentos / Atestados", path: "/afastamentos", group: "Saúde" },
  { key: "saude-ocupacional", label: "Saúde Ocupacional", path: "/saude-ocupacional", group: "Saúde" },
  { key: "contabilidade", label: "Info. Contabilidade", path: "/contabilidade", group: "Contabilidade" },
  { key: "companies", label: "Empresas", path: "/companies", group: "Admin" },
  { key: "sectors", label: "Setores", path: "/sectors", group: "Admin" },
  { key: "turnover", label: "Turnover", path: "/turnover", group: "Admin" },
  { key: "relatorios", label: "Relatórios", path: "/relatorios", group: "Admin" },
  { key: "settings", label: "Configurações", path: "/settings", group: "Admin" },
  { key: "ai-insights", label: "Inteligência Artificial", path: "/ai-insights", group: "Cérebrum IA" },
  { key: "nr1-dashboard", label: "Dashboard NR-1", path: "/nr1/dashboard", group: "NR-1 | Gestão Psicossocial" },
  { key: "nr1-clima", label: "Pesquisa de Clima", path: "/nr1/clima", group: "NR-1 | Gestão Psicossocial" },
  { key: "nr1-denuncias", label: "Canal de Denúncias", path: "/nr1/denuncias", group: "NR-1 | Gestão Psicossocial" },
  { key: "nr1-riscos", label: "Gestão de Riscos", path: "/nr1/riscos", group: "NR-1 | Gestão Psicossocial" },
  { key: "nr1-treinamentos", label: "Treinamentos NR-1", path: "/nr1/treinamentos", group: "NR-1 | Gestão Psicossocial" },
  { key: "nr1-acoes", label: "Ações Preventivas", path: "/nr1/acoes", group: "NR-1 | Gestão Psicossocial" },
  { key: "nr1-lideranca", label: "Avaliação de Liderança", path: "/nr1/lideranca", group: "NR-1 | Gestão Psicossocial" },
  { key: "nr1-relatorios", label: "Relatórios NR-1", path: "/nr1/relatorios", group: "NR-1 | Gestão Psicossocial" },
  { key: "nr1-config", label: "Configurações NR-1", path: "/nr1/config", group: "NR-1 | Gestão Psicossocial" },
];

export const moduleKeyFromPath = (pathname: string): string | null => {
  // match exato ou prefixo (ex: /employee/:id pertence a dashboard)
  const exact = MODULES.find((m) => m.path === pathname);
  if (exact) return exact.key;
  if (pathname.startsWith("/employee")) return "dashboard";
  if (pathname.startsWith("/recrutamento")) return "recrutamento";
  if (pathname.startsWith("/vaga")) return "vagas";
  return null;
};
