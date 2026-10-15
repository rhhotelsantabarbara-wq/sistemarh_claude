import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "../_shared/geminiFallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Deduplication: track processed message IDs to prevent duplicate responses
const processedMessages = new Map<string, number>();
const DEDUP_TTL_MS = 120_000; // 2 minutes

function isDuplicate(messageId: string): boolean {
  const now = Date.now();
  // Cleanup old entries
  for (const [id, ts] of processedMessages) {
    if (now - ts > DEDUP_TTL_MS) processedMessages.delete(id);
  }
  if (processedMessages.has(messageId)) return true;
  processedMessages.set(messageId, now);
  return false;
}

function formatForWhatsApp(text: string): string {
  return text
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*(.*?)\*\*/g, "*$1*")
    .replace(/__(.*?)__/g, "_$1_")
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/```\w*\n?/g, "").trim())
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

// ============= ACTION TOOLS (existing) =============

async function createEvento(supabase: any, params: any, phoneNumber?: string) {
  const { titulo, data_inicio, data_fim, descricao, local, tipo, lembrete_minutos } = params;
  if (!titulo || !data_inicio) return { success: false, error: "Título e data/hora de início são obrigatórios." };

  const insertData: any = {
    titulo, data_inicio, data_fim: data_fim || data_inicio,
    descricao: descricao || null, local: local || null,
    tipo: tipo || "compromisso", cor: "#3B82F6",
    lembrete_minutos: lembrete_minutos || 30, lembrete_enviado: false,
  };
  if (phoneNumber) insertData.whatsapp_phone = phoneNumber;

  const { data, error } = await supabase.from("eventos").insert(insertData).select().single();
  if (error) { console.error("Error creating evento:", error); return { success: false, error: error.message }; }
  return { success: true, evento: data };
}

async function createAdiantamento(supabase: any, params: any) {
  const { nome_funcionario, valor, forma_pagamento } = params;
  if (!nome_funcionario || !valor) return { success: false, error: "Nome do funcionário e valor são obrigatórios." };

  const { data: employees, error: empError } = await supabase
    .from("employees").select("id, nome_completo, empresa_id, setor").eq("status", "ativo");
  if (empError) return { success: false, error: "Erro ao buscar funcionários." };

  const searchName = nome_funcionario.toLowerCase().trim();
  const matched = (employees || []).find((e: any) => {
    const fullName = (e.nome_completo || "").toLowerCase();
    return fullName.includes(searchName) || searchName.includes(fullName) ||
      fullName.split(" ").some((part: string) => part === searchName);
  });

  if (!matched) return { success: false, error: `Funcionário "${nome_funcionario}" não encontrado. Ativos: ${(employees || []).map((e: any) => e.nome_completo).join(", ")}` };
  if (!matched.empresa_id) return { success: false, error: `Funcionário ${matched.nome_completo} não tem empresa vinculada.` };

  const now = new Date();
  const { data, error } = await supabase.from("adiantamentos").insert({
    employee_id: matched.id, empresa_id: matched.empresa_id,
    valor: parseFloat(valor), forma_pagamento: (forma_pagamento || "dinheiro").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/transferencia|transferência/i, "transferencia").replace(/pix/i, "pix").replace(/dinheiro/i, "dinheiro").replace(/emprestimo|empréstimo/i, "emprestimo").replace(/consumo/i, "consumo").replace(/em.?maos|em.?mãos/i, "em_maos").replace(/em.?conta/i, "em_conta"),
    mes: now.getMonth() + 1, ano: now.getFullYear(),
  }).select("*, employees(nome_completo)").single();

  if (error) return { success: false, error: error.message };
  return { success: true, adiantamento: { ...data, funcionario: matched.nome_completo, setor: matched.setor, mes: now.getMonth() + 1, ano: now.getFullYear() } };
}

async function salvarMemoria(supabase: any, params: any, phoneNumber: string, nomeProfessor?: string) {
  const { conteudo, categoria, contexto } = params;
  if (!conteudo) return { success: false, error: "Conteúdo da memória é obrigatório." };
  const { data, error } = await supabase.from("cerebrum_memorias").insert({
    conteudo, categoria: categoria || "geral", contexto: contexto || null,
    ensinado_por: phoneNumber, nome_professor: nomeProfessor || null,
  }).select().single();
  if (error) return { success: false, error: error.message };
  return { success: true, memoria: data };
}

// ============= RETRIEVAL TOOLS (compactados) =============

async function consultarResumoRapido(supabase: any) {
  const today = new Date().toISOString().split("T")[0];
  const [empRes, tacsRes, avalRes, estoqueEpiRes, estoqueUniRes, afastRes, checkRes, examesRes] = await Promise.all([
    supabase.from("employees").select("status", { count: "exact", head: false }),
    supabase.from("tacs").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    supabase.from("avaliacoes_desempenho").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    supabase.from("estoque_epis").select("quantidade_estoque, quantidade_minima"),
    supabase.from("estoque_uniformes").select("quantidade_estoque, quantidade_minima"),
    supabase.from("afastamentos").select("id", { count: "exact", head: true }).lte("data_inicio", today).gte("data_fim", today),
    supabase.from("plano_checklist_funcionario").select("id", { count: "exact", head: true }).in("status", ["em_andamento", "pendente"]),
    supabase.from("encaminhamentos_medicos").select("id", { count: "exact", head: true }).in("status", ["pendente", "agendado"]),
  ]);
  const sc: Record<string, number> = {};
  (empRes.data || []).forEach((e: any) => { sc[e.status] = (sc[e.status] || 0) + 1; });
  const episBaixo = (estoqueEpiRes.data || []).filter((e: any) => e.quantidade_estoque <= (e.quantidade_minima || 10)).length;
  const uniBaixo = (estoqueUniRes.data || []).filter((u: any) => u.quantidade_estoque <= (u.quantidade_minima || 10)).length;
  return `RESUMO(${today}): Ativos:${sc["ativo"]||0} Férias:${sc["ferias"]||0} Adm:${sc["em_admissao"]||0} Afast:${sc["afastado"]||0} Dem:${sc["demitido"]||0} | TACs:${tacsRes.count||0} Aval:${avalRes.count||0} Afast:${afastRes.count||0} Exames:${examesRes.count||0} Checks:${checkRes.count||0} EPIs falta:${episBaixo} Unif falta:${uniBaixo}`;
}

async function consultarFuncionarios(supabase: any, params: any) {
  // If filtering by empresa, resolve empresa_id first
  let empresaIds: string[] | null = null;
  if (params.empresa) {
    const { data: empData } = await supabase.from("empresas").select("id").ilike("nome", `%${params.empresa}%`);
    empresaIds = (empData || []).map((e: any) => e.id);
  }

  // Constrói os filtros como função para reusar em duas queries independentes
  const buildFilters = (q: any) => {
    if (params.status) q = q.eq("status", params.status);
    if (params.setor) q = q.ilike("setor", `%${params.setor}%`);
    if (params.nome) q = q.ilike("nome_completo", `%${params.nome}%`);
    if (params.cargo) q = q.ilike("cargo", `%${params.cargo}%`);
    if (params.sexo) q = q.ilike("sexo", `%${params.sexo}%`);
    if (empresaIds) q = q.in("empresa_id", empresaIds);
    if (!params.status && !params.incluir_inativos) q = q.in("status", ["ativo", "ferias", "em_admissao", "afastado"]);
    return q;
  };

  // Query 1: total real (sem limit, só count)
  const countQuery = buildFilters(supabase.from("employees").select("id", { count: "exact", head: true }));
  const { count: totalCount, error: countError } = await countQuery;

  // Query 2: dados detalhados (com limit)
  const dataQuery = buildFilters(supabase.from("employees").select("nome_completo, cargo, setor, status, data_admissao, salario, tipo_contrato, telefone, cpf, data_nascimento, sexo, empresa_id, empresas(nome)"));
  const { data, error } = await dataQuery.order("nome_completo").limit(50);

  if (error || countError) return { error: (error || countError)?.message };
  const funcionarios = data || [];
  const totalReal = totalCount ?? funcionarios.length;
  if (totalReal === 0) {
    const termo = params.nome || params.setor || params.cargo || "esse critério";
    return `Nenhum funcionário encontrado com nome contendo "${termo}". Verifique se o nome está correto ou tente com outra parte do nome.`;
  }
  return { total: totalReal, exibindo: funcionarios.length, funcionarios: funcionarios.map((e: any) => `${e.nome_completo}|${e.status}|${e.cargo}|${e.setor||"-"}|R$${e.salario||"-"}|${e.telefone||"-"}|${e.empresas?.nome||"-"}`) };
}

async function consultarFerias(supabase: any, params: any) {
  const today = new Date().toISOString().split("T")[0];
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [feriasRes, planejadasRes, folgasRes] = await Promise.all([
    supabase.from("ferias").select("*, employees(nome_completo, setor)").gte("periodo_gozo_fim", threeMonthsAgo).order("periodo_gozo_inicio", { ascending: true }),
    supabase.from("ferias_planejadas").select("*, employees(nome_completo, setor)").gte("periodo_fim", today),
    params.incluir_folgas ? supabase.from("folgas").select("*, employees(nome_completo, setor)").gte("data", threeMonthsAgo).order("data", { ascending: false }).limit(30) : Promise.resolve({ data: null }),
  ]);

  const ferias = feriasRes.data || [];
  const planejadas = planejadasRes.data || [];
  const folgas = folgasRes.data || [];
  const atuais = ferias.filter((f: any) => f.periodo_gozo_inicio <= today && f.periodo_gozo_fim >= today);
  const futuras = ferias.filter((f: any) => f.periodo_gozo_inicio > today);

  let result = `FÉRIAS AGORA (${atuais.length}):\n${atuais.map((f: any) => `- ${f.employees?.nome_completo}: ${f.periodo_gozo_inicio} a ${f.periodo_gozo_fim} (${f.dias_totais}d) | Setor: ${f.employees?.setor || "N/A"}`).join("\n") || "Nenhum"}`;
  result += `\n\nFÉRIAS CONFIRMADAS FUTURAS (${futuras.length}):\n${futuras.slice(0, 30).map((f: any) => `- ${f.employees?.nome_completo}: ${f.periodo_gozo_inicio} a ${f.periodo_gozo_fim} (${f.dias_totais}d) | Setor: ${f.employees?.setor || "N/A"}`).join("\n") || "Nenhuma"}`;
  result += `\n\nFÉRIAS PLANEJADAS/PROGRAMADAS (${planejadas.length}):\n${planejadas.map((f: any) => `- ${f.employees?.nome_completo}: ${f.periodo_inicio} a ${f.periodo_fim} (${f.dias_totais}d) - Status: ${f.status} | Setor: ${f.employees?.setor || "N/A"}`).join("\n") || "Nenhuma"}`;
  if (folgas.length > 0) result += `\n\nFOLGAS RECENTES (${folgas.length}):\n${folgas.slice(0, 15).map((f: any) => `- ${f.employees?.nome_completo}: ${f.data} - ${f.motivo}`).join("\n")}`;
  return result;
}

async function consultarFaltasFolgas(supabase: any, params: any) {
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // If filtering by name, first resolve employee_ids — only active employees
  let employeeIds: string[] | null = null;
  let employeeNames: string[] = [];
  if (params.nome) {
    const { data: empData } = await supabase
      .from("employees")
      .select("id, nome_completo")
      .ilike("nome_completo", `%${params.nome}%`)
      .neq("status", "demitido");
    if (!empData || empData.length === 0) {
      return `FALTAS: Nenhum funcionário ativo encontrado com nome "${params.nome}".`;
    }
    // Multiple employees → ask for confirmation
    if (empData.length > 1) {
      const nomes = empData.map((e: any) => e.nome_completo).join(", ");
      return `Encontrei ${empData.length} funcionários com esse nome: ${nomes}. Qual deles você quer consultar? Por favor, informe o nome completo.`;
    }
    employeeIds = empData.map((e: any) => e.id);
    employeeNames = empData.map((e: any) => e.nome_completo);
  }

  // Join with employees to filter out demitidos at query level
  let faltasQuery = supabase
    .from("faltas")
    .select("*, employees!inner(nome_completo, setor, status)")
    .gte("data", threeMonthsAgo)
    .neq("employees.status", "demitido")
    .order("data", { ascending: false });
  if (employeeIds) faltasQuery = faltasQuery.in("employee_id", employeeIds);

  let folgasQuery = supabase
    .from("folgas")
    .select("*, employees!inner(nome_completo, setor, status)")
    .gte("data", threeMonthsAgo)
    .neq("employees.status", "demitido")
    .order("data", { ascending: false });
  if (employeeIds) folgasQuery = folgasQuery.in("employee_id", employeeIds);

  const [faltasRes, folgasRes] = await Promise.all([
    faltasQuery.limit(50),
    folgasQuery.limit(30),
  ]);
  const faltas = faltasRes.data || [];
  const folgas = folgasRes.data || [];
  const naoJust = faltas.filter((f: any) => !f.justificada);
  const nomeRef = employeeNames.length > 0 ? ` de ${employeeNames[0]}` : "";

  // If specific employee was queried and has 0 absences, be explicit
  if (employeeIds && faltas.length === 0) {
    return `FALTAS de ${employeeNames[0]} (últimos 90 dias): 0 faltas registradas.\n\nFOLGAS de ${employeeNames[0]} (últimos 90 dias): ${folgas.length}\n${folgas.slice(0, 15).map((f: any) => `- ${f.data} - ${f.motivo}`).join("\n") || "Nenhuma"}`;
  }

  return `FALTAS${nomeRef} (últimos 90 dias): ${faltas.length} total, ${naoJust.length} não justificadas\n${faltas.slice(0, 20).map((f: any) => `- ${f.employees?.nome_completo}: ${f.data} ${f.justificada ? "(justificada)" : "(NÃO justificada)"} ${f.motivo ? `- ${f.motivo}` : ""}`).join("\n") || "Nenhuma"}\n\nFOLGAS${nomeRef} (últimos 90 dias): ${folgas.length}\n${folgas.slice(0, 15).map((f: any) => `- ${f.employees?.nome_completo}: ${f.data} - ${f.motivo}`).join("\n") || "Nenhuma"}`;
}

async function consultarPontoBancoHoras(supabase: any, params: any) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const startOfYear = `${currentYear}-01-01`;

  // FALHA 3+4: resolver employee_id primeiro, depois filtrar direto no banco
  let resolvedEmployeeIds: string[] | null = null;
  let resolvedEmployeeNames: string[] = [];
  if (params.nome_funcionario) {
    const { data: empData } = await supabase
      .from("employees")
      .select("id, nome_completo")
      .ilike("nome_completo", `%${params.nome_funcionario}%`);
    if (!empData || empData.length === 0) {
      return `Nenhum funcionário encontrado com nome "${params.nome_funcionario}".`;
    }
    if (empData.length > 1) {
      const nomes = empData.map((e: any) => e.nome_completo).join(", ");
      return `Encontrei ${empData.length} funcionários com esse nome: ${nomes}. Qual deles você quer consultar? Por favor, informe o nome completo.`;
    }
    resolvedEmployeeIds = empData.map((e: any) => e.id);
    resolvedEmployeeNames = empData.map((e: any) => e.nome_completo);
  }

  let bancoQuery = supabase.from("banco_horas").select("*, employees(nome_completo, setor, status)");
  if (resolvedEmployeeIds) bancoQuery = bancoQuery.in("employee_id", resolvedEmployeeIds);

  let pontoQuery = resolvedEmployeeIds
    ? supabase.from("registros_ponto").select("employee_id, data, tipo_dia, horas_trabalhadas, hora_entrada, hora_saida, employees(nome_completo, setor)").gte("data", startOfYear).in("employee_id", resolvedEmployeeIds).order("data", { ascending: false }).limit(500)
    : Promise.resolve({ data: [] });

  const [bancoRes, configRes, pontoRes] = await Promise.all([
    bancoQuery,
    supabase.from("configuracao_horas_trabalho").select("employee_id, horas_diarias_esperadas"),
    pontoQuery,
  ]);

  const bancoHoras = bancoRes.data || [];
  const nomeRef = resolvedEmployeeNames.length > 0 ? ` — ${resolvedEmployeeNames[0]}` : "";
  let result = `BANCO DE HORAS${nomeRef} (${bancoHoras.length} registros):\n`;
  result += bancoHoras.map((b: any) => `- ${b.employees?.nome_completo} [${b.employees?.status}]: ${b.saldo_horas > 0 ? "+" : ""}${b.saldo_horas?.toFixed(1)}h | Setor: ${b.employees?.setor || "N/A"}`).join("\n") || "Nenhum";

  if (!resolvedEmployeeIds) {
    const positivo = bancoHoras.filter((b: any) => b.saldo_horas > 0).length;
    const negativo = bancoHoras.filter((b: any) => b.saldo_horas < 0).length;
    result += `\nResumo: ${positivo} positivos, ${negativo} negativos, ${bancoHoras.length - positivo - negativo} zerados`;
  }

  // If searching specific employee, add monthly breakdown
  if (resolvedEmployeeIds && pontoRes.data && pontoRes.data.length > 0) {
    const configMap: Record<string, number> = {};
    (configRes.data || []).forEach((c: any) => { configMap[c.employee_id] = c.horas_diarias_esperadas; });
    const nomeMes = (m: number) => ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][m];

    const empId = resolvedEmployeeIds[0];
    const horasDiarias = configMap[empId] || 8;
    result += `\n\nDETALHE MENSAL (${currentYear}):`;
    for (let m = 1; m <= currentMonth; m++) {
      const mesStr = String(m).padStart(2, "0");
      const mesRegs = pontoRes.data.filter((r: any) => r.data.startsWith(`${currentYear}-${mesStr}`));
      const diasNormais = mesRegs.filter((r: any) => r.tipo_dia === "normal" && (r.hora_entrada || r.hora_saida || r.horas_trabalhadas > 0)).length;
      const trabalhadas = mesRegs.reduce((s: number, r: any) => s + (r.horas_trabalhadas || 0), 0);
      const esperadas = diasNormais * horasDiarias;
      if (diasNormais > 0) {
        const saldo = trabalhadas - esperadas;
        result += `\n  ${nomeMes(m)}: Esperadas=${esperadas.toFixed(1)}h | Trabalhadas=${trabalhadas.toFixed(1)}h | Saldo=${saldo >= 0 ? "+" : ""}${saldo.toFixed(1)}h`;
      }
    }
  }
  return result;
}

async function consultarFinanceiro(supabase: any, params: any) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [folhaRes, adiantRes, reajustesRes] = await Promise.all([
    supabase.from("folha_pagamento").select("*, employees(nome_completo, setor), folha_pagamento_itens(valor, variavel_id, variaveis_folha(nome, tipo))").eq("ano", currentYear).order("mes", { ascending: false }).limit(200),
    supabase.from("adiantamentos").select("*, employees(nome_completo, setor)").eq("ano", currentYear).order("mes", { ascending: false }),
    supabase.from("historico_reajustes_salariais").select("*, employees(nome_completo, setor, cargo)").gte("aplicado_em", threeMonthsAgo),
  ]);

  const folha = folhaRes.data || [];
  const adiantamentos = adiantRes.data || [];
  const reajustes = reajustesRes.data || [];

  const folhaMes = folha.filter((f: any) => f.mes === (params.mes || currentMonth));
  const totalProventos = folhaMes.reduce((a: number, f: any) => a + (f.total_proventos || 0), 0);
  const totalDescontos = folhaMes.reduce((a: number, f: any) => a + (f.total_descontos || 0), 0);
  const totalLiquido = folhaMes.reduce((a: number, f: any) => a + (f.valor_liquido || 0), 0);

  let result = `FOLHA DE PAGAMENTO (${params.mes || currentMonth}/${currentYear}):\nProcessadas: ${folhaMes.length} | Proventos: R$ ${totalProventos.toFixed(2)} | Descontos: R$ ${totalDescontos.toFixed(2)} | Líquido: R$ ${totalLiquido.toFixed(2)}`;

  result += `\n\nADIANTAMENTOS (${currentYear}): ${adiantamentos.length} registros`;
  const mesesUnicos = [...new Set(adiantamentos.map((a: any) => a.mes))].sort((a: any, b: any) => a - b);
  for (const mes of mesesUnicos) {
    const mesAdiant = adiantamentos.filter((a: any) => a.mes === mes);
    const totalMes = mesAdiant.reduce((a: number, v: any) => a + (v.valor || 0), 0);
    result += `\nMês ${mes}/${currentYear} (${mesAdiant.length} reg, Total: R$ ${totalMes.toFixed(2)}):`;
    result += mesAdiant.map((a: any) => `\n  - ${a.employees?.nome_completo}: R$ ${a.valor?.toFixed(2)} (${a.forma_pagamento})`).join("");
  }

  if (reajustes.length > 0) {
    result += `\n\nREAJUSTES SALARIAIS (90 dias): ${reajustes.length}`;
    result += reajustes.slice(0, 15).map((r: any) => `\n- ${r.employees?.nome_completo}: R$ ${r.salario_anterior?.toFixed(2)} → R$ ${r.salario_novo?.toFixed(2)} (${r.percentual_reajuste?.toFixed(1)}%)`).join("");
  }
  return result;
}

async function consultarTacsAvaliacoes(supabase: any, params: any) {
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [tacsRes, avalRes, ciclosRes] = await Promise.all([
    supabase.from("tacs").select("*, employees(nome_completo, setor)").gte("data_ocorrencia", threeMonthsAgo).order("data_ocorrencia", { ascending: false }),
    supabase.from("avaliacoes_desempenho").select("*, employees(nome_completo, setor, cargo)").order("created_at", { ascending: false }).limit(100),
    supabase.from("ciclos_avaliacao").select("*").eq("ativo", true),
  ]);
  const tacs = tacsRes.data || [];
  const avals = avalRes.data || [];
  const pendTacs = tacs.filter((t: any) => t.status === "pendente");
  const pendAvals = avals.filter((a: any) => a.status === "pendente");
  return `TACs (90 dias): ${tacs.length} total, ${pendTacs.length} pendentes\n${tacs.slice(0, 20).map((t: any) => `- ${t.employees?.nome_completo}: ${t.tipo} - ${t.titulo} (${t.status}) - ${t.data_ocorrencia}`).join("\n") || "Nenhum"}\n\nAVALIAÇÕES: ${avals.length} total, ${pendAvals.length} pendentes | Ciclos ativos: ${(ciclosRes.data || []).length}\n${avals.slice(0, 25).map((a: any) => `- ${a.employees?.nome_completo}: Nota ${a.nota_final || "pendente"} (${a.tipo}, ${a.status})`).join("\n") || "Nenhuma"}`;
}

async function consultarEstoque(supabase: any, _params: any) {
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [episRes, uniRes, episEntRes, uniEntRes] = await Promise.all([
    supabase.from("estoque_epis").select("*"),
    supabase.from("estoque_uniformes").select("*"),
    supabase.from("epis").select("*, employees(nome_completo, setor)").gte("data_entrega", threeMonthsAgo).order("data_entrega", { ascending: false }).limit(30),
    supabase.from("uniformes").select("*, employees(nome_completo, setor)").gte("data_entrega", threeMonthsAgo).order("data_entrega", { ascending: false }).limit(30),
  ]);
  const epis = episRes.data || [];
  const unis = uniRes.data || [];
  const episBaixo = epis.filter((e: any) => e.quantidade_estoque <= (e.quantidade_minima || 10));
  const unisBaixo = unis.filter((u: any) => u.quantidade_estoque <= (u.quantidade_minima || 10));
  return `ESTOQUE EPIs (${epis.length} tipos, ${episBaixo.length} em falta):\n${episBaixo.map((e: any) => `- ⚠️ ${e.tipo_epi} (${e.tamanho || "único"}): ${e.quantidade_estoque} un (mín: ${e.quantidade_minima})`).join("\n") || "Nenhum em falta"}\nTodos:\n${epis.map((e: any) => `- ${e.tipo_epi} (${e.tamanho || "único"}): ${e.quantidade_estoque} un`).join("\n")}\n\nESTOQUE UNIFORMES (${unis.length} tipos, ${unisBaixo.length} em falta):\n${unisBaixo.map((u: any) => `- ⚠️ ${u.tipo_uniforme} (${u.tamanho}): ${u.quantidade_estoque} un (mín: ${u.quantidade_minima})`).join("\n") || "Nenhum em falta"}\nTodos:\n${unis.map((u: any) => `- ${u.tipo_uniforme} (${u.tamanho}${u.cor ? ", " + u.cor : ""}): ${u.quantidade_estoque} un`).join("\n")}\n\nEntregas recentes: ${(episEntRes.data || []).length} EPIs, ${(uniEntRes.data || []).length} uniformes`;
}

async function consultarRecrutamento(supabase: any, _params: any) {
  const [vagasRes, candRes] = await Promise.all([
    supabase.from("vagas").select("*, empresas(nome), setores(nome), funcoes(nome)").order("created_at", { ascending: false }),
    supabase.from("candidaturas").select("*, vagas(titulo)").order("created_at", { ascending: false }).limit(100),
  ]);
  const vagas = vagasRes.data || [];
  const cands = candRes.data || [];
  const abertas = vagas.filter((v: any) => v.status === "aberta");
  const pendentes = cands.filter((c: any) => c.status === "pendente" || c.status === "em_analise");
  return `VAGAS (${vagas.length} total, ${abertas.length} abertas):\n${abertas.map((v: any) => `- ${v.titulo} | ${v.empresas?.nome || "N/A"} | Setor: ${v.setores?.nome || "N/A"} | Qtd: ${v.quantidade_vagas}`).join("\n") || "Nenhuma"}\n\nCANDIDATURAS (${cands.length} total, ${pendentes.length} pendentes):\n${cands.slice(0, 20).map((c: any) => `- ${c.nome_completo} → ${c.vagas?.titulo}: ${c.status}`).join("\n") || "Nenhuma"}`;
}

async function consultarTreinamentos(supabase: any, _params: any) {
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [cursosRes, certRes, progRes] = await Promise.all([
    supabase.from("cursos").select("*, setores(nome), funcoes(nome)").eq("ativo", true),
    supabase.from("certificados_liberados").select("*, employees(nome_completo, setor), cursos(titulo)").gte("data_liberacao", threeMonthsAgo),
    supabase.from("progresso_aulas").select("*, employees(nome_completo), aulas(titulo, modulos(titulo, cursos(titulo)))").gte("updated_at", threeMonthsAgo).limit(50),
  ]);
  const cursos = cursosRes.data || [];
  const obrig = cursos.filter((c: any) => c.obrigatorio);
  return `CURSOS ATIVOS (${cursos.length}, ${obrig.length} obrigatórios):\n${cursos.map((c: any) => `- ${c.titulo} (${c.carga_horaria || 0}h) | Setor: ${c.setores?.nome || "Todos"} | ${c.obrigatorio ? "OBRIGATÓRIO" : "Opcional"}`).join("\n") || "Nenhum"}\n\nCERTIFICADOS (90 dias): ${(certRes.data || []).length}\n${(certRes.data || []).slice(0, 15).map((c: any) => `- ${c.employees?.nome_completo}: ${c.cursos?.titulo}`).join("\n") || "Nenhum"}`;
}

async function consultarEventosAvisos(supabase: any, _params: any) {
  const today = new Date().toISOString().split("T")[0];
  const [eventosRes, avisosRes] = await Promise.all([
    supabase.from("eventos").select("*").gte("data_fim", today).order("data_inicio", { ascending: true }).limit(30),
    supabase.from("avisos").select("*").gte("data_expiracao", today),
  ]);
  const eventos = (eventosRes.data || []).filter((e: any) => !e.concluido);
  const avisos = avisosRes.data || [];
  return `PRÓXIMOS EVENTOS (${eventos.length}):\n${eventos.slice(0, 15).map((e: any) => `- ${e.titulo} | ${e.data_inicio} a ${e.data_fim} | Tipo: ${e.tipo || "geral"} | Local: ${e.local || "N/A"}`).join("\n") || "Nenhum"}\n\nAVISOS ATIVOS (${avisos.length}):\n${avisos.slice(0, 10).map((a: any) => `- ${a.mensagem?.substring(0, 100)} | Setores: ${a.setores?.join(", ") || "Todos"} | Expira: ${a.data_expiracao} | Prioridade: ${a.prioridade || "média"}`).join("\n") || "Nenhum"}`;
}

async function consultarSaudeOcupacional(supabase: any, _params: any) {
  const today = new Date().toISOString().split("T")[0];
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [encRes, afastRes] = await Promise.all([
    supabase.from("encaminhamentos_medicos").select("*, employees(nome_completo, setor), empresas(nome)").order("data_encaminhamento", { ascending: false }).limit(50),
    supabase.from("afastamentos").select("*, employees(nome_completo, setor)").gte("data_fim", threeMonthsAgo),
  ]);
  const enc = encRes.data || [];
  const afast = afastRes.data || [];
  const pendentes = enc.filter((e: any) => e.status === "pendente" || e.status === "agendado");
  const afastAtivos = afast.filter((a: any) => a.data_inicio <= today && a.data_fim >= today);
  return `EXAMES (${enc.length} total, ${pendentes.length} pendentes):\n${pendentes.slice(0, 20).map((e: any) => `- ${e.employees?.nome_completo}: ${e.tipo_exame} - ${e.status} (${e.data_agendamento || "sem data"})`).join("\n") || "Nenhum"}\n\nAFASTADOS AGORA (${afastAtivos.length}):\n${afastAtivos.map((a: any) => `- ${a.employees?.nome_completo}: ${a.motivo} (${a.data_inicio} a ${a.data_fim})`).join("\n") || "Nenhum"}\nTotal afastamentos (90 dias): ${afast.length}`;
}

async function consultarChecklists(supabase: any, _params: any) {
  const { data } = await supabase.from("plano_checklist_funcionario").select("*, employees(nome_completo, setor), plano_checklist_funcionario_itens(concluido, titulo)").in("status", ["em_andamento", "pendente"]);
  const checklists = data || [];
  return `CHECKLISTS PENDENTES (${checklists.length}):\n${checklists.slice(0, 15).map((c: any) => {
    const itens = c.plano_checklist_funcionario_itens || [];
    const concluidos = itens.filter((i: any) => i.concluido).length;
    return `- ${c.employees?.nome_completo}: ${c.tipo} - ${concluidos}/${itens.length} itens`;
  }).join("\n") || "Nenhum"}`;
}

async function consultarResumoGeral(supabase: any, _params: any) {
  // Full summary - calls multiple sub-queries
  const [funcs, ferias, faltas, ponto, fin, tacs, estoque, recr, trein, eventos, saude, checks] = await Promise.all([
    consultarFuncionarios(supabase, {}),
    consultarFerias(supabase, {}),
    consultarFaltasFolgas(supabase, {}),
    consultarPontoBancoHoras(supabase, {}),
    consultarFinanceiro(supabase, {}),
    consultarTacsAvaliacoes(supabase, {}),
    consultarEstoque(supabase, {}),
    consultarRecrutamento(supabase, {}),
    consultarTreinamentos(supabase, {}),
    consultarEventosAvisos(supabase, {}),
    consultarSaudeOcupacional(supabase, {}),
    consultarChecklists(supabase, {}),
  ]);
  return `=== RESUMO COMPLETO DO RH ===\n\n${typeof funcs === 'string' ? funcs : JSON.stringify(funcs)}\n\n${ferias}\n\n${faltas}\n\n${ponto}\n\n${fin}\n\n${tacs}\n\n${estoque}\n\n${recr}\n\n${trein}\n\n${eventos}\n\n${saude}\n\n${checks}`;
}

// ============= NEW TOOLS =============

async function consultarMetas(supabase: any, params: any) {
  let query = supabase.from("metas_funcionario").select("*, employees(nome_completo, setor, cargo)").order("created_at", { ascending: false }).limit(50);
  if (params.status) query = query.eq("status", params.status);
  if (params.nome_funcionario) {
    const { data: emps } = await supabase.from("employees").select("id, nome_completo").ilike("nome_completo", `%${params.nome_funcionario}%`).limit(10);
    if (emps?.length > 0) query = query.in("employee_id", emps.map((e: any) => e.id));
    else return "Nenhum funcionário encontrado com esse nome.";
  }
  const { data, error } = await query;
  if (error) return { error: error.message };
  const metas = data || [];
  return `METAS (${metas.length}):\n${metas.map((m: any) => `- ${m.employees?.nome_completo}: ${m.titulo || m.descricao || "Meta"} | Status: ${m.status} | Prazo: ${m.prazo || "N/A"} | Progresso: ${m.progresso || 0}%`).join("\n") || "Nenhuma meta encontrada."}`;
}

async function consultarProgressoTreinamento(supabase: any, params: any) {
  const [modulosRes, aulasRes, progressoRes] = await Promise.all([
    supabase.from("modulos").select("id, titulo, ordem, curso_id, cursos(titulo)").order("ordem"),
    supabase.from("aulas").select("id, titulo, modulo_id, ordem, duracao_minutos").order("ordem"),
    params.nome_funcionario
      ? supabase.from("progresso_aulas").select("*, employees(nome_completo), aulas(titulo, modulo_id)").order("updated_at", { ascending: false }).limit(200)
      : supabase.from("progresso_aulas").select("*, employees(nome_completo), aulas(titulo, modulo_id)").order("updated_at", { ascending: false }).limit(100),
  ]);
  const modulos = modulosRes.data || [];
  const aulas = aulasRes.data || [];
  const progresso = progressoRes.data || [];

  let result = `MÓDULOS (${modulos.length}):\n`;
  const cursoMap: Record<string, { titulo: string; modulos: any[]; totalAulas: number }> = {};
  for (const m of modulos) {
    const cid = m.curso_id;
    if (!cursoMap[cid]) cursoMap[cid] = { titulo: m.cursos?.titulo || "Sem curso", modulos: [], totalAulas: 0 };
    const aulasDoModulo = aulas.filter((a: any) => a.modulo_id === m.id);
    cursoMap[cid].modulos.push({ ...m, aulas: aulasDoModulo.length });
    cursoMap[cid].totalAulas += aulasDoModulo.length;
  }
  for (const [cid, info] of Object.entries(cursoMap)) {
    result += `\n📚 ${info.titulo}: ${info.modulos.length} módulos, ${info.totalAulas} aulas`;
    for (const m of info.modulos) result += `\n  - ${m.titulo}: ${m.aulas} aulas`;
  }

  if (params.nome_funcionario) {
    const filtered = progresso.filter((p: any) => (p.employees?.nome_completo || "").toLowerCase().includes(params.nome_funcionario.toLowerCase()));
    result += `\n\nPROGRESSO de "${params.nome_funcionario}" (${filtered.length} aulas assistidas):\n${filtered.slice(0, 30).map((p: any) => `- ${p.aulas?.titulo}: ${p.concluida ? "✅ Concluída" : "⏳ Em andamento"} | ${p.updated_at?.substring(0, 10)}`).join("\n") || "Nenhum progresso encontrado."}`;
  } else {
    result += `\n\nTotal registros de progresso: ${progresso.length}`;
  }
  return result;
}

async function consultarDetalhesAvaliacao(supabase: any, params: any) {
  let avalQuery = supabase.from("avaliacoes_desempenho").select("id, employee_id, tipo, status, nota_final, periodo_inicio, periodo_fim, observacoes, employees(nome_completo, setor, cargo)").order("created_at", { ascending: false }).limit(30);
  if (params.nome_funcionario) {
    const { data: emps } = await supabase.from("employees").select("id").ilike("nome_completo", `%${params.nome_funcionario}%`).limit(10);
    if (emps?.length > 0) avalQuery = avalQuery.in("employee_id", emps.map((e: any) => e.id));
  }
  const { data: avaliacoes } = await avalQuery;
  if (!avaliacoes || avaliacoes.length === 0) return "Nenhuma avaliação encontrada.";

  const avalIds = avaliacoes.map((a: any) => a.id);
  const [notasRes, criteriosRes] = await Promise.all([
    supabase.from("notas_avaliacao").select("*, criterios_avaliacao(nome, peso)").in("avaliacao_id", avalIds),
    supabase.from("criterios_avaliacao").select("*").eq("ativo", true),
  ]);
  const notas = notasRes.data || [];
  const criterios = criteriosRes.data || [];

  let result = `AVALIAÇÕES DETALHADAS (${avaliacoes.length}):\n`;
  for (const av of avaliacoes) {
    const avNotas = notas.filter((n: any) => n.avaliacao_id === av.id);
    result += `\n👤 ${av.employees?.nome_completo} (${av.tipo}, ${av.status}) | Nota: ${av.nota_final || "pendente"} | ${av.periodo_inicio} a ${av.periodo_fim}`;
    if (avNotas.length > 0) {
      result += `\n  Critérios:`;
      for (const n of avNotas) {
        result += `\n    - ${n.criterios_avaliacao?.nome || "Critério"} (peso ${n.criterios_avaliacao?.peso || 1}): Func=${n.nota_funcionario || "-"} | Gestor=${n.nota_gestor || "-"}`;
        if (n.comentario_gestor) result += ` | "${n.comentario_gestor.substring(0, 80)}"`;
      }
    }
  }
  result += `\n\nCRITÉRIOS ATIVOS (${criterios.length}): ${criterios.map((c: any) => `${c.nome} (peso ${c.peso})`).join(", ")}`;
  return result;
}

async function consultarHistoricos(supabase: any, params: any) {
  const tipo = params.tipo || "todos";
  const limit = 30;
  let result = "";

  if (tipo === "banco_horas" || tipo === "todos") {
    let query = supabase.from("historico_banco_horas").select("*, employees(nome_completo)").order("created_at", { ascending: false }).limit(limit);
    if (params.nome_funcionario) {
      const { data: emps } = await supabase.from("employees").select("id").ilike("nome_completo", `%${params.nome_funcionario}%`).limit(10);
      if (emps?.length > 0) query = query.in("employee_id", emps.map((e: any) => e.id));
    }
    const { data } = await query;
    result += `HISTÓRICO BANCO DE HORAS (${(data || []).length}):\n${(data || []).map((h: any) => `- ${h.employees?.nome_completo}: ${h.tipo_movimentacao || "mov"} ${h.horas > 0 ? "+" : ""}${h.horas}h | Saldo: ${h.saldo_anterior}→${h.saldo_novo} | ${h.motivo || ""} | ${h.created_at?.substring(0, 10)}`).join("\n") || "Nenhum"}\n\n`;
  }

  if (tipo === "estoque_epis" || tipo === "todos") {
    const { data } = await supabase.from("historico_estoque_epis").select("*, estoque_epis:estoque_epi_id(tipo_epi, marca_modelo, tamanho), employees:employee_id(nome_completo)").order("created_at", { ascending: false }).limit(limit);
    result += `HISTÓRICO ESTOQUE EPIs (${(data || []).length}):\n${(data || []).map((h: any) => `- ${h.estoque_epis?.tipo_epi || "EPI"} ${h.estoque_epis?.tamanho || ""}: ${h.tipo_movimentacao} ${h.quantidade}un (${h.quantidade_anterior}→${h.quantidade_nova}) | ${h.employees?.nome_completo || ""} | ${h.motivo || ""}`).join("\n") || "Nenhum"}\n\n`;
  }

  if (tipo === "estoque_uniformes" || tipo === "todos") {
    const { data } = await supabase.from("historico_estoque_uniformes").select("*, estoque_uniformes:estoque_uniforme_id(tipo_uniforme, tamanho, cor), employees:employee_id(nome_completo)").order("created_at", { ascending: false }).limit(limit);
    result += `HISTÓRICO ESTOQUE UNIFORMES (${(data || []).length}):\n${(data || []).map((h: any) => `- ${h.estoque_uniformes?.tipo_uniforme || "Uniforme"} ${h.estoque_uniformes?.tamanho || ""}: ${h.tipo_movimentacao} ${h.quantidade}un (${h.quantidade_anterior}→${h.quantidade_nova}) | ${h.employees?.nome_completo || ""} | ${h.motivo || ""}`).join("\n") || "Nenhum"}\n\n`;
  }

  if (tipo === "folgas" || tipo === "todos") {
    let query = supabase.from("historico_folgas").select("*, employees:employee_id(nome_completo)").order("created_at", { ascending: false }).limit(limit);
    if (params.nome_funcionario) {
      const { data: emps } = await supabase.from("employees").select("id").ilike("nome_completo", `%${params.nome_funcionario}%`).limit(10);
      if (emps?.length > 0) query = query.in("employee_id", emps.map((e: any) => e.id));
    }
    const { data } = await query;
    result += `HISTÓRICO FOLGAS (${(data || []).length}):\n${(data || []).map((h: any) => `- ${h.employees?.nome_completo}: ${h.quantidade_anterior}→${h.quantidade_nova} folgas | ${h.observacao || ""} | ${h.alterado_em?.substring(0, 10)}`).join("\n") || "Nenhum"}`;
  }

  return result || "Nenhum histórico encontrado.";
}

async function consultarVariaveisFixas(supabase: any, params: any) {
  const [variaveisRes, fixasRes] = await Promise.all([
    supabase.from("variaveis_folha").select("*").eq("ativo", true).order("tipo").order("nome"),
    params.nome_funcionario
      ? (async () => {
          const { data: emps } = await supabase.from("employees").select("id").ilike("nome_completo", `%${params.nome_funcionario}%`).limit(10);
          if (emps?.length > 0) return supabase.from("variaveis_fixas_funcionario").select("*, variavel:variaveis_folha(nome, tipo, codigo), employees:employee_id(nome_completo)").in("employee_id", emps.map((e: any) => e.id));
          return { data: [] };
        })()
      : supabase.from("variaveis_fixas_funcionario").select("*, variavel:variaveis_folha(nome, tipo, codigo), employees:employee_id(nome_completo)").eq("ativo", true).limit(100),
  ]);

  const variaveis = variaveisRes.data || [];
  const fixas = fixasRes.data || [];
  const proventos = variaveis.filter((v: any) => v.tipo === "provento");
  const descontos = variaveis.filter((v: any) => v.tipo === "desconto");

  let result = `VARIÁVEIS DA FOLHA (${variaveis.length}):\nProventos (${proventos.length}): ${proventos.map((v: any) => `${v.nome}${v.codigo ? ` (${v.codigo})` : ""}`).join(", ") || "Nenhum"}\nDescontos (${descontos.length}): ${descontos.map((v: any) => `${v.nome}${v.codigo ? ` (${v.codigo})` : ""}`).join(", ") || "Nenhum"}`;
  result += `\n\nVARIÁVEIS FIXAS POR FUNCIONÁRIO (${fixas.length}):\n${fixas.map((f: any) => `- ${f.employees?.nome_completo}: ${f.variavel?.nome} (${f.variavel?.tipo}) = R$ ${f.valor?.toFixed(2)} ${f.ativo ? "✅" : "❌ inativa"}`).join("\n") || "Nenhuma"}`;
  return result;
}

async function consultarArquivosFuncionario(supabase: any, params: any) {
  if (!params.nome_funcionario) return "Informe o nome do funcionário para buscar arquivos.";
  const { data: emps } = await supabase.from("employees").select("id, nome_completo").ilike("nome_completo", `%${params.nome_funcionario}%`).limit(5);
  if (!emps || emps.length === 0) return `Funcionário "${params.nome_funcionario}" não encontrado.`;

  const empIds = emps.map((e: any) => e.id);
  const { data: files } = await supabase.from("employee_files").select("*, employees:employee_id(nome_completo)").in("employee_id", empIds).order("created_at", { ascending: false });
  return `ARQUIVOS (${(files || []).length}):\n${(files || []).map((f: any) => `- ${f.employees?.nome_completo}: ${f.file_name} (${f.file_type || "arquivo"}) | ${f.description || ""} | ${f.created_at?.substring(0, 10)}`).join("\n") || "Nenhum arquivo encontrado."}`;
}

async function consultarContratos(supabase: any, _params: any) {
  const { data } = await supabase.from("modelos_contrato").select("*").order("created_at", { ascending: false });
  return `MODELOS DE CONTRATO (${(data || []).length}):\n${(data || []).map((c: any) => `- ${c.nome} | Tipo: ${c.tipo || "geral"} | Atualizado: ${c.updated_at?.substring(0, 10) || c.created_at?.substring(0, 10)}`).join("\n") || "Nenhum modelo encontrado."}`;
}

async function consultarConfiguracoes(supabase: any, params: any) {
  const tipo = params.tipo || "todos";
  let result = "";

  if (tipo === "setores" || tipo === "todos") {
    const { data } = await supabase.from("configuracao_setor").select("*, setores:setor_id(nome)");
    result += `CONFIG SETORES (${(data || []).length}):\n${(data || []).map((c: any) => `- ${c.setores?.nome}: Qtd média: ${c.quantidade_media} | Alertas: ${c.alertas_ativos ? "✅" : "❌"}`).join("\n") || "Nenhuma"}\n\n`;
  }

  if (tipo === "ferias" || tipo === "todos") {
    const { data } = await supabase.from("configuracoes_ferias").select("*");
    result += `CONFIG FÉRIAS (${(data || []).length}):\n${(data || []).map((c: any) => `- Máx ausência: ${c.percentual_maximo_ausencia || "N/A"}% | Cobertura mín: ${c.cobertura_minima || "N/A"}`).join("\n") || "Nenhuma"}\n\n`;
  }

  if (tipo === "checklists" || tipo === "todos") {
    const { data: templates } = await supabase.from("plano_checklist_templates").select("*, plano_checklist_itens(id, titulo, obrigatorio, prazo_dias)").eq("ativo", true);
    result += `TEMPLATES CHECKLIST (${(templates || []).length}):\n${(templates || []).map((t: any) => {
      const itens = t.plano_checklist_itens || [];
      return `- ${t.nome} (${t.tipo}): ${itens.length} itens${itens.length > 0 ? "\n    " + itens.map((i: any) => `${i.titulo}${i.obrigatorio ? " *" : ""}${i.prazo_dias ? ` (${i.prazo_dias}d)` : ""}`).join("\n    ") : ""}`;
    }).join("\n") || "Nenhum"}`;
  }

  return result || "Nenhuma configuração encontrada.";
}

async function enviarFotoFuncionario(supabase: any, params: any) {
  const { nome_funcionario } = params;
  if (!nome_funcionario) return { success: false, error: "Nome do funcionário é obrigatório." };

  const { data: employees, error } = await supabase
    .from("employees")
    .select("id, nome_completo, cargo, setor, foto_url, status")
    .ilike("nome_completo", `%${nome_funcionario}%`)
    .in("status", ["ativo", "ferias", "em_admissao", "afastado"]);

  if (error) return { success: false, error: "Erro ao buscar funcionário." };
  if (!employees || employees.length === 0) return { success: false, error: `Funcionário "${nome_funcionario}" não encontrado no sistema.` };

  if (employees.length > 1) {
    const nomes = employees.map((e: any) => e.nome_completo).join(", ");
    return { success: false, error: `Encontrei ${employees.length} funcionários com esse nome: ${nomes}. Qual deles você quer? Por favor, informe o nome completo.` };
  }

  const emp = employees[0];
  if (!emp.foto_url) {
    return { success: false, error: `${emp.nome_completo} não tem foto cadastrada no sistema. 😔` };
  }

  return {
    _sendImage: true,
    url: emp.foto_url,
    caption: `📸 *${emp.nome_completo}*\n🏷️ ${emp.cargo}${emp.setor ? ` | ${emp.setor}` : ""}`,
    nome: emp.nome_completo,
  };
}

// ============= VISION TOOL =============

async function identificarPorAparencia(supabase: any, params: any, iaConfig: any) {
  const { caracteristica, setor, empresa } = params;
  if (!caracteristica) return "Informe a característica física para pesquisar (ex: olho azul, cabelo loiro, óculos).";

  // Build employee query
  let query = supabase
    .from("employees")
    .select("id, nome_completo, cargo, setor, foto_url, empresa_id, empresas(nome)")
    .in("status", ["ativo", "ferias", "em_admissao", "afastado"])
    .not("foto_url", "is", null);

  if (setor) query = query.ilike("setor", `%${setor}%`);

  // If empresa filter provided, resolve ids first
  if (empresa) {
    const { data: empData } = await supabase.from("empresas").select("id").ilike("nome", `%${empresa}%`);
    const ids = (empData || []).map((e: any) => e.id);
    if (ids.length > 0) query = query.in("empresa_id", ids);
  }

  const { data: employees, error } = await query.order("nome_completo").limit(10);
  if (error) return `Erro ao buscar funcionários: ${error.message}`;
  if (!employees || employees.length === 0) return "Nenhum funcionário com foto cadastrada encontrado para os filtros informados.";

  const semFoto = employees.filter((e: any) => !e.foto_url).length;
  const comFoto = employees.filter((e: any) => e.foto_url);

  if (comFoto.length === 0) return "Nenhum dos funcionários filtrados possui foto cadastrada no sistema.";

  // Determine vision model and API key
  const provedor = iaConfig?.provedor || "gemini";
  let GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  let OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (iaConfig?.google_gemini_api_key) GOOGLE_GEMINI_API_KEY = iaConfig.google_gemini_api_key;
  if (iaConfig?.openai_api_key) OPENAI_API_KEY = iaConfig.openai_api_key;

  const visionPrompt = `Analise esta foto de um funcionário. A pergunta é: este funcionário tem "${caracteristica}"?
Responda APENAS com JSON válido, sem markdown:
{"match": true ou false, "confianca": "alta" ou "media" ou "baixa", "descricao": "descreva brevemente o que você vê relacionado à característica pedida"}
Se a imagem não estiver clara ou não for possível determinar, use match: false e confianca: baixa.`;

  // Analyze all photos in parallel
  const analysisResults = await Promise.all(
    comFoto.map(async (emp: any) => {
      try {
        let analysisJson: any = null;

        if (provedor === "openai" && OPENAI_API_KEY) {
          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "gpt-4o",
              messages: [{
                role: "user",
                content: [
                  { type: "text", text: visionPrompt },
                  { type: "image_url", image_url: { url: emp.foto_url, detail: "low" } }
                ]
              }],
              max_tokens: 200,
            }),
          });
          if (response.ok) {
            const data = await response.json();
            const rawText = data.choices?.[0]?.message?.content || "";
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) analysisJson = JSON.parse(jsonMatch[0]);
          }
        } else if (GOOGLE_GEMINI_API_KEY) {
          // Gemini Vision — fetch image as base64
          const imgResponse = await fetch(emp.foto_url);
          if (!imgResponse.ok) return { emp, match: false, confianca: "baixa", descricao: "Erro ao carregar imagem" };
          const imgBuffer = await imgResponse.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));
          const mimeType = imgResponse.headers.get("content-type") || "image/jpeg";

          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GOOGLE_GEMINI_API_KEY}`;
          const geminiResponse = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: visionPrompt },
                  { inline_data: { mime_type: mimeType.split(";")[0].trim(), data: base64 } }
                ]
              }]
            }),
          });
          if (geminiResponse.ok) {
            const geminiData = await geminiResponse.json();
            const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) analysisJson = JSON.parse(jsonMatch[0]);
          }
        }

        if (!analysisJson) return { emp, match: false, confianca: "baixa", descricao: "Não foi possível analisar" };
        return { emp, match: analysisJson.match === true, confianca: analysisJson.confianca || "baixa", descricao: analysisJson.descricao || "" };
      } catch (err) {
        console.error(`Vision analysis error for ${emp.nome_completo}:`, err);
        return { emp, match: false, confianca: "baixa", descricao: "Erro na análise" };
      }
    })
  );

  const matches = analysisResults.filter((r: any) => r.match);
  const aviso = semFoto > 0 ? `\n⚠️ ${semFoto} funcionário(s) sem foto foram ignorados.` : "";

  if (matches.length === 0) {
    return `Analisei ${comFoto.length} foto(s) e não encontrei nenhum funcionário com "${caracteristica}" nas fotos cadastradas.${aviso}`;
  }

  // Return special object with multiple images to send
  return {
    _sendMultipleImages: true,
    matches: matches.map((r: any) => ({
      url: r.emp.foto_url,
      caption: `📸 *${r.emp.nome_completo}*\n🏷️ ${r.emp.cargo}${r.emp.setor ? ` | ${r.emp.setor}` : ""}\n🔍 ${r.descricao}`,
      nome: r.emp.nome_completo,
    })),
    resumo: `Encontrei *${matches.length}* funcionário(s) com "${caracteristica}":\n${matches.map((r: any) => `• *${r.emp.nome_completo}* (${r.emp.cargo}${r.emp.setor ? `, ${r.emp.setor}` : ""}) — confiança: ${r.confianca}`).join("\n")}${aviso}`,
    analisados: comFoto.length,
  };
}

async function enviarMensagemContato(supabase: any, params: any) {
  const { nome_contato, mensagem } = params;
  if (!nome_contato || !mensagem) return { success: false, error: "Nome do contato e mensagem são obrigatórios." };

  // Buscar contato salvo
  const { data: contatos, error } = await supabase
    .from("whatsapp_contatos")
    .select("id, nome, numero, observacoes")
    .ilike("nome", `%${nome_contato}%`);

  if (error) return { success: false, error: "Erro ao buscar contatos." };
  if (!contatos || contatos.length === 0) {
    // Listar contatos disponíveis
    const { data: todos } = await supabase.from("whatsapp_contatos").select("nome").order("nome");
    const nomes = (todos || []).map((c: any) => c.nome).join(", ");
    return { success: false, error: `Contato "${nome_contato}" não encontrado. Contatos salvos: ${nomes || "nenhum"}` };
  }
  if (contatos.length > 1) {
    return { success: false, error: `Encontrei ${contatos.length} contatos: ${contatos.map((c: any) => c.nome).join(", ")}. Qual deles?` };
  }

  const contato = contatos[0];

  // Buscar config do WhatsApp para enviar
  const { data: waConfig } = await supabase.from("configuracoes_whatsapp").select("evolution_api_url, evolution_api_key, evolution_instance_name").limit(1).maybeSingle();
  if (!waConfig?.evolution_api_url) return { success: false, error: "WhatsApp não configurado." };

  const baseUrl = waConfig.evolution_api_url.replace(/\/$/, "");
  const sendResponse = await fetch(`${baseUrl}/message/sendText/${waConfig.evolution_instance_name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: waConfig.evolution_api_key },
    body: JSON.stringify({ number: contato.numero, text: mensagem }),
  });

  if (!sendResponse.ok) {
    const errText = await sendResponse.text();
    console.error("Error sending message to contact:", errText);
    return { success: false, error: "Erro ao enviar mensagem via WhatsApp." };
  }

  return { success: true, contato: contato.nome, numero: contato.numero, mensagem_enviada: mensagem };
}

async function atualizarStatusAdiantamentos(supabase: any, params: any) {
  const { mes, ano, nome_funcionario, status_novo } = params;
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const targetAno = ano || currentYear;
  const targetMes = mes || currentMonth;
  const targetStatus = status_novo || "feito";

  let query = supabase.from("adiantamentos").select("id, valor, status, employees(nome_completo)").eq("ano", targetAno).eq("mes", targetMes);
  
  if (nome_funcionario) {
    const { data: emps } = await supabase.from("employees").select("id").ilike("nome_completo", `%${nome_funcionario}%`).limit(10);
    if (!emps || emps.length === 0) return `Funcionário "${nome_funcionario}" não encontrado.`;
    query = query.in("employee_id", emps.map((e: any) => e.id));
  }

  if (targetStatus !== "feito") {
    query = query.eq("status", "feito");
  } else {
    query = query.neq("status", "feito");
  }

  const { data: adiantamentos, error: fetchErr } = await query;
  if (fetchErr) return { error: fetchErr.message };
  if (!adiantamentos || adiantamentos.length === 0) return `Nenhum adiantamento pendente encontrado para ${targetMes}/${targetAno}${nome_funcionario ? ` (${nome_funcionario})` : ""}.`;

  const ids = adiantamentos.map((a: any) => a.id);
  const { error: updateErr } = await supabase.from("adiantamentos").update({ status: targetStatus }).in("id", ids);
  if (updateErr) return { error: updateErr.message };

  const nomes = adiantamentos.map((a: any) => `${a.employees?.nome_completo}: R$${a.valor?.toFixed(2)}`).join(", ");
  return `✅ ${adiantamentos.length} adiantamento(s) atualizado(s) para "${targetStatus}" (${targetMes}/${targetAno}): ${nomes}`;
}

async function fetchMemorias(supabase: any) {
  const { data } = await supabase.from("cerebrum_memorias").select("conteudo, categoria, nome_professor, created_at").eq("ativo", true).order("created_at", { ascending: false }).limit(100);
  return data || [];
}

// ============= TOOL DEFINITIONS =============

const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "consultar_funcionarios",
      description: "Busca funcionários por nome, setor, status, cargo, sexo ou empresa. Use para perguntas sobre dados de funcionários específicos ou listagens. Para listar mulheres use sexo='feminino', para homens use sexo='masculino'.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome ou parte do nome do funcionário" },
          setor: { type: "string", description: "Setor/departamento" },
          status: { type: "string", description: "Status: ativo, ferias, em_admissao, afastado, demitido", enum: ["ativo", "ferias", "em_admissao", "afastado", "demitido"] },
          cargo: { type: "string", description: "Cargo/função" },
          sexo: { type: "string", description: "Sexo/gênero: feminino ou masculino", enum: ["feminino", "masculino"] },
          empresa: { type: "string", description: "Nome da empresa" },
          incluir_inativos: { type: "boolean", description: "Incluir demitidos/inativos na busca" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_ferias",
      description: "Consulta férias atuais, futuras, planejadas e folgas. Use para perguntas sobre quem está de férias, escala de férias, folgas.",
      parameters: {
        type: "object",
        properties: {
          incluir_folgas: { type: "boolean", description: "Incluir folgas recentes na resposta" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_faltas_folgas",
      description: "Consulta faltas (justificadas e não justificadas) e folgas dos últimos 90 dias.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Filtrar por nome do funcionário" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_ponto_banco_horas",
      description: "Consulta registros de ponto e saldos de banco de horas. Para detalhes mensais, informe o nome do funcionário.",
      parameters: {
        type: "object",
        properties: {
          nome_funcionario: { type: "string", description: "Nome do funcionário para detalhe mensal" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_financeiro",
      description: "Consulta folha de pagamento, adiantamentos e reajustes salariais.",
      parameters: {
        type: "object",
        properties: {
          mes: { type: "number", description: "Mês específico (1-12) para folha de pagamento" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_tacs_avaliacoes",
      description: "Consulta TACs (termos de ajuste de conduta) e avaliações de desempenho.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_estoque",
      description: "Consulta estoque de EPIs e uniformes, incluindo itens em falta e entregas recentes.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_recrutamento",
      description: "Consulta vagas abertas e candidaturas pendentes.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_treinamentos",
      description: "Consulta cursos ativos, obrigatórios, certificados emitidos e progresso de aulas.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_eventos_avisos",
      description: "Consulta próximos eventos do calendário e avisos ativos.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_saude_ocupacional",
      description: "Consulta exames médicos pendentes, encaminhamentos e afastamentos.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_checklists",
      description: "Consulta checklists de admissão/desligamento pendentes.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_resumo_geral",
      description: "Retorna um resumo completo de TODOS os dados do RH. Use apenas quando o usuário pedir visão geral, resumo do RH, ou 'como está o RH'.",
      parameters: { type: "object", properties: {} },
    },
  },
  // NEW TOOLS
  {
    type: "function",
    function: {
      name: "consultar_metas",
      description: "Consulta metas individuais de desempenho dos funcionários. Use para perguntas sobre metas, objetivos, OKRs.",
      parameters: { type: "object", properties: { nome_funcionario: { type: "string", description: "Nome do funcionário" }, status: { type: "string", description: "Status da meta", enum: ["pendente", "em_andamento", "concluida", "cancelada"] } } },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_progresso_treinamento",
      description: "Consulta progresso detalhado de funcionários nos cursos: módulos, aulas assistidas, conclusão. Use para saber quem completou treinamento.",
      parameters: { type: "object", properties: { nome_funcionario: { type: "string", description: "Nome do funcionário para ver progresso individual" }, curso: { type: "string", description: "Nome do curso" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_detalhes_avaliacao",
      description: "Consulta notas detalhadas por critério das avaliações de desempenho. Use para detalhes de notas, critérios, auto-avaliação vs gestor.",
      parameters: { type: "object", properties: { nome_funcionario: { type: "string", description: "Nome do funcionário" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_historicos",
      description: "Consulta históricos de movimentações: banco de horas, estoque EPIs/uniformes, folgas. Use para auditoria, rastreabilidade.",
      parameters: { type: "object", properties: { tipo: { type: "string", description: "Tipo de histórico", enum: ["banco_horas", "estoque_epis", "estoque_uniformes", "folgas", "todos"] }, nome_funcionario: { type: "string", description: "Filtrar por funcionário" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_variaveis_fixas",
      description: "Consulta variáveis da folha de pagamento (proventos/descontos cadastrados) e variáveis fixas por funcionário.",
      parameters: { type: "object", properties: { nome_funcionario: { type: "string", description: "Nome do funcionário para ver variáveis fixas individuais" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_arquivos_funcionario",
      description: "Lista arquivos/documentos enviados de um funcionário específico.",
      parameters: { type: "object", properties: { nome_funcionario: { type: "string", description: "Nome do funcionário (obrigatório)" } }, required: ["nome_funcionario"] },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_contratos",
      description: "Lista modelos/templates de contrato disponíveis no sistema.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_configuracoes",
      description: "Consulta configurações do sistema: lotação de setores, regras de férias, templates de checklist.",
      parameters: { type: "object", properties: { tipo: { type: "string", description: "Tipo de configuração", enum: ["setores", "ferias", "checklists", "todos"] } } },
    },
  },
  // ACTION TOOLS
  {
    type: "function",
    function: {
      name: "criar_evento",
      description: "Cria um novo evento/compromisso no calendário. Use SEMPRE que: (1) o usuário pedir para agendar, marcar ou criar um evento; (2) o usuário mencionar que TEM um compromisso/reunião/consulta e quiser ser lembrado; (3) o usuário pedir um lembrete para qualquer hora/data; (4) o usuário disser 'me avise', 'me lembra', 'quero lembrete', 'tenho compromisso'. Sempre extraia título, data e hora do contexto da conversa.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Título do evento" },
          data_inicio: { type: "string", description: "Data/hora início ISO 8601 (ex: 2026-02-15T14:00:00)" },
          data_fim: { type: "string", description: "Data/hora fim ISO 8601" },
          descricao: { type: "string", description: "Descrição do evento" },
          local: { type: "string", description: "Local do evento" },
          tipo: { type: "string", enum: ["reuniao", "treinamento", "entrevista", "compromisso", "geral"] },
          lembrete_minutos: { type: "number", description: "Minutos antes para lembrete WhatsApp (padrão: 30)" },
        },
        required: ["titulo", "data_inicio"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_adiantamento",
      description: "Registra um adiantamento salarial para um funcionário.",
      parameters: {
        type: "object",
        properties: {
          nome_funcionario: { type: "string", description: "Nome do funcionário" },
          valor: { type: "number", description: "Valor em reais" },
          forma_pagamento: { type: "string", enum: ["PIX", "Dinheiro", "Transferência", "Conta", "Empréstimo", "Consumo"] },
        },
        required: ["nome_funcionario", "valor"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "salvar_memoria",
      description: "Salva aprendizado permanente na memória do Cérebrum. Use quando o usuário ensinar, corrigir ou pedir para lembrar algo.",
      parameters: {
        type: "object",
        properties: {
          conteudo: { type: "string", description: "O conhecimento a ser memorizado" },
          categoria: { type: "string", enum: ["preferencia", "correcao", "padrao_rh", "fato", "regra", "geral"] },
          contexto: { type: "string", description: "Contexto do aprendizado" },
        },
        required: ["conteudo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "identificar_funcionario_por_aparencia",
      description: "Analisa as fotos cadastradas dos funcionários usando visão computacional para encontrar quem corresponde a uma característica física. Use quando o gestor perguntar 'qual funcionário tem olho azul?', 'quem tem barba?', 'qual funcionário usa óculos?', 'tem alguém com cabelo loiro no restaurante?', etc. IMPORTANTE: o parâmetro 'setor' deve ser o nome exato do setor mencionado pelo usuário (ex: 'Restaurante', 'Cozinha', 'Recepção'). NUNCA infira ou substitua 'fazenda' por 'restaurante' — 'fazenda' se refere ao nome do hotel (Hotel Fazenda Santa Bárbara), não a um setor. Se o usuário disser 'da fazenda' sem especificar setor, NÃO passe o parâmetro setor.",
      parameters: {
        type: "object",
        properties: {
          caracteristica: { type: "string", description: "Característica física a ser pesquisada (ex: olho azul, cabelo loiro, barba, óculos, tatuagem no braço)" },
          setor: { type: "string", description: "Filtrar por setor/departamento — use SOMENTE se o usuário mencionar explicitamente um setor como 'Restaurante', 'Cozinha', 'Recepção', etc. NÃO confundir 'fazenda' com setor — fazenda é o nome do hotel." },
          empresa: { type: "string", description: "Filtrar por empresa (opcional)" },
        },
        required: ["caracteristica"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "enviar_foto_funcionario",
      description: "Envia a foto/imagem de perfil de um funcionário via WhatsApp. Use quando o usuário pedir 'me manda a foto de', 'mostra a foto do/da', 'qual o rosto de', etc.",
      parameters: {
        type: "object",
        properties: {
          nome_funcionario: { type: "string", description: "Nome ou parte do nome do funcionário" },
        },
        required: ["nome_funcionario"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "enviar_mensagem_contato",
      description: "Envia uma mensagem de texto via WhatsApp para um contato salvo no sistema. Use quando o usuário pedir 'manda uma mensagem para o João', 'avisa o fornecedor que...', 'envia para o Marcos que...', 'lembra o Pedro de...'. Os contatos são previamente cadastrados no sistema pelo gestor.",
      parameters: {
        type: "object",
        properties: {
          nome_contato: { type: "string", description: "Nome ou parte do nome do contato salvo" },
          mensagem: { type: "string", description: "Texto da mensagem a ser enviada" },
        },
        required: ["nome_contato", "mensagem"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "atualizar_status_adiantamentos",
      description: "Atualiza o status dos adiantamentos salariais (ex: para 'feito' quando já foram pagos/depositados). Use quando o gestor disser que já depositou, já pagou, já fez os adiantamentos, ou pedir para marcar como feito/pago.",
      parameters: {
        type: "object",
        properties: {
          mes: { type: "number", description: "Mês dos adiantamentos (1-12)" },
          ano: { type: "number", description: "Ano dos adiantamentos" },
          nome_funcionario: { type: "string", description: "Nome do funcionário (opcional, se vazio atualiza todos do mês)" },
          status_novo: { type: "string", enum: ["feito", "aguardando"], description: "Novo status" },
        },
      },
    },
  },
];

// ============= TOOL EXECUTION =============

async function executeTool(supabase: any, toolName: string, params: any, phoneNumber: string, rawHistory: any[], iaConfig?: any) {
  switch (toolName) {
    case "consultar_funcionarios": return await consultarFuncionarios(supabase, params);
    case "consultar_ferias": return await consultarFerias(supabase, params);
    case "consultar_faltas_folgas": return await consultarFaltasFolgas(supabase, params);
    case "consultar_ponto_banco_horas": return await consultarPontoBancoHoras(supabase, params);
    case "consultar_financeiro": return await consultarFinanceiro(supabase, params);
    case "consultar_tacs_avaliacoes": return await consultarTacsAvaliacoes(supabase, params);
    case "consultar_estoque": return await consultarEstoque(supabase, params);
    case "consultar_recrutamento": return await consultarRecrutamento(supabase, params);
    case "consultar_treinamentos": return await consultarTreinamentos(supabase, params);
    case "consultar_eventos_avisos": return await consultarEventosAvisos(supabase, params);
    case "consultar_saude_ocupacional": return await consultarSaudeOcupacional(supabase, params);
    case "consultar_checklists": return await consultarChecklists(supabase, params);
    case "consultar_resumo_geral": return await consultarResumoGeral(supabase, params);
    case "consultar_metas": return await consultarMetas(supabase, params);
    case "consultar_progresso_treinamento": return await consultarProgressoTreinamento(supabase, params);
    case "consultar_detalhes_avaliacao": return await consultarDetalhesAvaliacao(supabase, params);
    case "consultar_historicos": return await consultarHistoricos(supabase, params);
    case "consultar_variaveis_fixas": return await consultarVariaveisFixas(supabase, params);
    case "consultar_arquivos_funcionario": return await consultarArquivosFuncionario(supabase, params);
    case "consultar_contratos": return await consultarContratos(supabase, params);
    case "consultar_configuracoes": return await consultarConfiguracoes(supabase, params);
    case "criar_evento": return await createEvento(supabase, params, phoneNumber);
    case "criar_adiantamento": return await createAdiantamento(supabase, params);
    case "salvar_memoria": {
      const professorName = params.nome_professor || null;
      return await salvarMemoria(supabase, params, phoneNumber, professorName);
    }
    case "enviar_foto_funcionario": return await enviarFotoFuncionario(supabase, params);
    case "identificar_funcionario_por_aparencia": return await identificarPorAparencia(supabase, params, iaConfig);
    case "enviar_mensagem_contato": return await enviarMensagemContato(supabase, params);
    case "atualizar_status_adiantamentos": return await atualizarStatusAdiantamentos(supabase, params);
    default: return { error: `Tool ${toolName} not found` };
  }
}

// ============= MAIN HANDLER =============

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const event = body.event;
    if (event && event !== "messages.upsert") {
      return new Response(JSON.stringify({ status: "ignored", reason: "not a message event" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = body.data || body;
    const key = data.key;
    const message = data.message;
    if (!key || !message) return new Response(JSON.stringify({ status: "ignored", reason: "no message data" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (key.fromMe) return new Response(JSON.stringify({ status: "ignored", reason: "own message" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Deduplicate: ignore if this message ID was already processed
    const messageId = key.id;
    if (messageId && isDuplicate(messageId)) {
      console.log(`Duplicate message ignored: ${messageId}`);
      return new Response(JSON.stringify({ status: "ignored", reason: "duplicate message" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const remoteJid = key.remoteJid || "";
    if (remoteJid.includes("@g.us")) return new Response(JSON.stringify({ status: "ignored", reason: "group message" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const phoneNumber = remoteJid.replace("@s.whatsapp.net", "");
    // FIX 6: Whitelist verificada somente via banco de dados (configuracoes_whatsapp), não via env var

    let userMessage = message.conversation || message.extendedTextMessage?.text || "";

    // Handle audio messages
    const audioMessage = message.audioMessage;
    if (audioMessage && !userMessage.trim()) {
      console.log(`Audio message received from ${phoneNumber}, attempting transcription...`);
      const SUPABASE_URL_CHECK = Deno.env.get("SUPABASE_URL");
      const SUPABASE_SERVICE_ROLE_KEY_CHECK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const supabaseForAudio = createClient(SUPABASE_URL_CHECK!, SUPABASE_SERVICE_ROLE_KEY_CHECK!);

      let GOOGLE_GEMINI_API_KEY_CHECK = Deno.env.get("GOOGLE_GEMINI_API_KEY");
      let OPENAI_API_KEY_CHECK = Deno.env.get("OPENAI_API_KEY");
      const { data: iaConfigAudio } = await supabaseForAudio.from("configuracoes_ia").select("google_gemini_api_key, openai_api_key, modelo, provedor").limit(1).maybeSingle();
      if (iaConfigAudio?.google_gemini_api_key) GOOGLE_GEMINI_API_KEY_CHECK = iaConfigAudio.google_gemini_api_key;
      if (iaConfigAudio?.openai_api_key) OPENAI_API_KEY_CHECK = iaConfigAudio.openai_api_key;
      const audioProvedor = iaConfigAudio?.provedor || "gemini";

      const { data: whatsappConfigAudio } = await supabaseForAudio.from("configuracoes_whatsapp").select("*").limit(1).maybeSingle();
      if (!whatsappConfigAudio) throw new Error("WhatsApp config not found");

      try {
        const mediaId = key.id;
        const downloadUrl = `${whatsappConfigAudio.evolution_api_url}/chat/getBase64FromMediaMessage/${whatsappConfigAudio.evolution_instance_name}`;
        const mediaResponse = await fetch(downloadUrl, {
          method: "POST",
          headers: { "apikey": whatsappConfigAudio.evolution_api_key, "Content-Type": "application/json" },
          body: JSON.stringify({ message: { key: { remoteJid: key.remoteJid, id: key.id }, message: data.message } }),
        });

        if (!mediaResponse.ok) throw new Error("Failed to download audio");
        const mediaData = await mediaResponse.json();
        const audioBase64 = mediaData.base64;
        const mimetype = audioMessage.mimetype || "audio/ogg";
        if (!audioBase64) throw new Error("No base64 audio data received");

        let transcribedText = "";
        if (audioProvedor === "openai" && OPENAI_API_KEY_CHECK) {
          const binaryString = atob(audioBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
          const ext = mimetype.includes("ogg") ? "ogg" : mimetype.includes("mp4") ? "mp4" : "wav";
          const audioBlob = new Blob([bytes], { type: mimetype.split(";")[0].trim() });
          const audioFile = new File([audioBlob], `audio.${ext}`, { type: mimetype.split(";")[0].trim() });
          const formData = new FormData();
          formData.append("file", audioFile);
          formData.append("model", "whisper-1");
          formData.append("language", "pt");
          const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${OPENAI_API_KEY_CHECK}` }, body: formData });
          if (!whisperResponse.ok) throw new Error("Whisper transcription failed");
          const whisperData = await whisperResponse.json();
          transcribedText = whisperData.text?.trim() || "";
        } else if (GOOGLE_GEMINI_API_KEY_CHECK) {
          const aiModelAudio = (iaConfigAudio?.modelo && !iaConfigAudio.modelo.startsWith("gpt")) ? iaConfigAudio.modelo : "gemini-3.5-flash";
          const geminiNativeUrl = `https://generativelanguage.googleapis.com/v1beta/models/${aiModelAudio}:generateContent?key=${GOOGLE_GEMINI_API_KEY_CHECK}`;
          const transcribeResponse = await fetch(geminiNativeUrl, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: "Transcreva este áudio em português brasileiro. Retorne APENAS o texto transcrito, sem aspas, sem prefixos, sem explicações. Se não conseguir entender, retorne 'ÁUDIO_INAUDÍVEL'." }, { inline_data: { mime_type: mimetype.split(";")[0].trim(), data: audioBase64 } }] }] }),
          });
          if (!transcribeResponse.ok) throw new Error("Gemini transcription failed");
          const transcribeData = await transcribeResponse.json();
          transcribedText = transcribeData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        } else {
          throw new Error("No API key configured for audio transcription");
        }

        if (!transcribedText || transcribedText === "ÁUDIO_INAUDÍVEL") {
          await fetch(`${whatsappConfigAudio.evolution_api_url}/message/sendText/${whatsappConfigAudio.evolution_instance_name}`, {
            method: "POST", headers: { "apikey": whatsappConfigAudio.evolution_api_key, "Content-Type": "application/json" },
            body: JSON.stringify({ number: phoneNumber, text: "Desculpe, não consegui entender o áudio. Pode tentar novamente ou enviar em texto? 🎤" }),
          });
          return new Response(JSON.stringify({ status: "audio_not_understood" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        userMessage = transcribedText;
      } catch (audioError) {
        console.error("Audio processing error:", audioError);
        return new Response(JSON.stringify({ status: "audio_error", error: String(audioError) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (!userMessage.trim()) {
      return new Response(JSON.stringify({ status: "ignored", reason: "no text" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`Processing message from ${phoneNumber}: ${userMessage.substring(0, 100)}`);

    // Send read receipt so the user sees double blue ticks on their message
    try {
      const SUPABASE_URL_RC = Deno.env.get("SUPABASE_URL");
      const SUPABASE_SERVICE_ROLE_KEY_RC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const supabaseRC = createClient(SUPABASE_URL_RC!, SUPABASE_SERVICE_ROLE_KEY_RC!);
      const { data: waCfgRC } = await supabaseRC.from("configuracoes_whatsapp").select("evolution_api_url, evolution_api_key, evolution_instance_name").limit(1).maybeSingle();
      if (waCfgRC?.evolution_api_url && waCfgRC?.evolution_api_key && waCfgRC?.evolution_instance_name) {
        await fetch(`${waCfgRC.evolution_api_url.replace(/\/$/, "")}/chat/updatePresence/${waCfgRC.evolution_instance_name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: waCfgRC.evolution_api_key },
          body: JSON.stringify({ number: remoteJid, options: { presence: "composing" } }),
        }).catch(() => {});
        await fetch(`${waCfgRC.evolution_api_url.replace(/\/$/, "")}/message/readMessages/${waCfgRC.evolution_instance_name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: waCfgRC.evolution_api_key },
          body: JSON.stringify({ readMessages: [{ remoteJid: key.remoteJid, fromMe: false, id: key.id }] }),
        }).catch(() => {});
      }
    } catch (_rcErr) { /* non-critical */ }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch config, resumo, memorias, and history in parallel
    let GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    let OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    const [iaConfigRes, whatsappConfigRes, resumo, memorias, historyRes] = await Promise.all([
      supabase.from("configuracoes_ia").select("google_gemini_api_key, openai_api_key, modelo, provedor").limit(1).maybeSingle(),
      supabase.from("configuracoes_whatsapp").select("*").limit(1).maybeSingle(),
      consultarResumoRapido(supabase),
      fetchMemorias(supabase),
      supabase.from("whatsapp_conversas").select("role, content, created_at").eq("phone_number", phoneNumber).order("created_at", { ascending: false }).limit(20),
    ]);

    const iaConfigMain = iaConfigRes.data;
    if (iaConfigMain?.google_gemini_api_key) GOOGLE_GEMINI_API_KEY = iaConfigMain.google_gemini_api_key;
    if (iaConfigMain?.openai_api_key) OPENAI_API_KEY = iaConfigMain.openai_api_key;
    const provedor = iaConfigMain?.provedor || "gemini";
    const aiModel = iaConfigMain?.modelo || (provedor === "openai" ? "gpt-4o-mini" : "gemini-3.5-flash");

    if (provedor === "openai" && !OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
    if (provedor !== "openai" && !GOOGLE_GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY not configured");

    const whatsappConfig = whatsappConfigRes.data;
    if (!whatsappConfig) throw new Error("WhatsApp config not found");
    const { evolution_api_url: EVOLUTION_API_URL, evolution_api_key: EVOLUTION_API_KEY, evolution_instance_name: EVOLUTION_INSTANCE_NAME, whatsapp_allowed_numbers: configAllowedNumbers } = whatsappConfig;
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_NAME) throw new Error("Evolution API credentials not configured");

    const configAllowed = (configAllowedNumbers || "").split(",").map((n: string) => n.trim()).filter(Boolean);
    if (configAllowed.length > 0 && !configAllowed.includes(phoneNumber)) {
      return new Response(JSON.stringify({ status: "ignored", reason: "unauthorized by config" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const memoriasText = memorias.length > 0
      ? "\n\n=== MEMÓRIA PERMANENTE ===\n" + memorias.map((m: any) => `- [${m.categoria}] ${m.conteudo}${m.nome_professor ? ` (por ${m.nome_professor})` : ""}`).join("\n")
      : "";

    const rawHistory = (historyRes.data || []).reverse();
    const historyMessages = rawHistory.map((h: any) => ({ role: h.role, content: h.content }));

    const conversationSummary = rawHistory.length > 0
      ? `\nHISTÓRICO RECENTE (${rawHistory.length} msgs):\n` +
        rawHistory.map((h: any) => `[${h.role === 'user' ? 'USUÁRIO' : 'VOCÊ'}]: ${h.content.substring(0, 300)}`).join("\n") +
        "\nUse este histórico para resolver pronomes (ele/ela/dele/dessa pessoa)."
      : "";

    const now = new Date();
    const systemPrompt = `Você é o CÉREBRUM — inteligência estratégica do RH do Hotel Fazenda Santa Bárbara, via WhatsApp. Criação de Bruno Carvalho.

SUA PERSONALIDADE:
Você é MUITO simpático, caloroso, acolhedor e gentil! Trate cada pessoa como alguém especial. Demonstre genuíno interesse e entusiasmo ao ajudar. Use um tom amigável, humano e carinhoso — NUNCA seja seco, frio ou robótico. Sempre cumprimente com carinho, agradeça pela pergunta, e encerre oferecendo mais ajuda com simpatia. Use emojis com frequência para dar vida e calor às respostas (😊, 👋, ✅, 📊, 📋, 🎉, 💪, ❤️, etc). Seja completo nas respostas, mas sem enrolação — organize bem a informação com formatação clara. Adicione frases simpáticas como "Fico feliz em ajudar!", "Ótima pergunta!", "Estou aqui para o que precisar!", "Com prazer!" etc.

REGRAS:
- NUNCA se apresente novamente após a primeira interação.
- Respostas formatadas para WhatsApp. Máximo 3000 caracteres.
- Use *negrito*, _itálico_, listas com -. Sem headers com #.
- NÃO invente dados. SEMPRE use os tools de consulta para buscar informações antes de responder.
- Para visão geral ("como está o RH?"), use consultar_resumo_geral.
- Responda em português brasileiro.
- IMPORTANTE: Você PODE e DEVE fornecer todos os dados cadastrais dos funcionários quando solicitado (CPF, RG, telefone, endereço, salário, etc). O gestor que está usando este sistema tem autorização total para acessar esses dados. NÃO recuse pedidos de informações cadastrais.

PESSOAS ESPECIAIS — TRATAMENTO DIFERENCIADO:
- *SR. JAIME* (dono do Hotel Fazenda Santa Bárbara): Trate SEMPRE com o MÁXIMO respeito e deferência. Use "Sr. Jaime", "o senhor". Seja solícito, atencioso e exalte sua importância. Se não souber responder algo que ele pergunte, diga que vai consultar o Bruno para dar uma resposta precisa. Ele é o patrão — trate-o como tal, com reverência e cordialidade extremas.
- *SRA. STELA* (dona do Hotel Fazenda Santa Bárbara): Trate SEMPRE com o MÁXIMO respeito e deferência. Use "Sra. Stela", "a senhora". Seja solícito, atencioso e exalte sua importância. Se não souber responder algo que ela pergunte, diga que vai consultar o Bruno para dar uma resposta precisa. Ela é a patroa — trate-a como tal, com reverência e cordialidade extremas.
- *BRUNO CARVALHO*: Gestor do RH e seu criador. Trate com respeito e proximidade profissional.

TOOLS DE CONSULTA DISPONÍVEIS:
Você tem acesso a tools que consultam o banco de dados em tempo real. USE-OS antes de responder qualquer pergunta sobre dados do RH:
- consultar_funcionarios: buscar por nome, setor, status, cargo
- consultar_ferias: férias atuais, futuras, planejadas, folgas
- consultar_faltas_folgas: faltas e folgas dos últimos 90 dias
- consultar_ponto_banco_horas: saldos de banco de horas e detalhes mensais
- consultar_financeiro: folha, adiantamentos, reajustes
- consultar_tacs_avaliacoes: TACs e avaliações de desempenho
- consultar_estoque: EPIs e uniformes em estoque
- consultar_recrutamento: vagas e candidaturas
- consultar_treinamentos: cursos, certificados, progresso
- consultar_eventos_avisos: eventos e avisos ativos
- consultar_saude_ocupacional: exames, afastamentos
- consultar_checklists: checklists de admissão/desligamento
- consultar_resumo_geral: resumo completo (use para visão geral)
- consultar_metas: metas individuais de desempenho
- consultar_progresso_treinamento: progresso detalhado em módulos/aulas
- consultar_detalhes_avaliacao: notas por critério das avaliações
- consultar_historicos: movimentações de banco de horas, estoque, folgas
- consultar_variaveis_fixas: proventos/descontos fixos da folha
- consultar_arquivos_funcionario: documentos/arquivos de funcionários
- consultar_contratos: modelos de contrato disponíveis
- consultar_configuracoes: configurações de setores, férias, checklists

TOOLS DE AÇÃO:
- criar_evento: agendar eventos/compromissos. OBRIGATÓRIO usar quando: usuário pedir lembrete, mencionar compromisso/reunião/consulta querendo ser avisado, disser "me avise", "me lembra", "tenho compromisso às X horas", "quero lembrete". Se o usuário não especificar o tempo de antecedência, use 30 minutos (lembrete_minutos: 30). Se especificar "me avise X minutos antes", use esse valor. SEMPRE crie o evento com o número de telefone do remetente vinculado.
- criar_adiantamento: lançar adiantamentos salariais
- salvar_memoria: memorizar aprendizados permanentes
- enviar_foto_funcionario: envia a foto de perfil de um funcionário pelo WhatsApp. Use SEMPRE que o usuário pedir para ver/mandar a foto de alguém. Após enviar, informe que a foto foi enviada.
- identificar_funcionario_por_aparencia: analisa as fotos dos funcionários via visão computacional para encontrar quem tem determinada característica física. Use quando perguntarem "qual funcionário tem olho azul?", "quem tem barba?", "tem alguém com óculos?", "quem tem cabelo loiro no restaurante?", etc. Pode filtrar por setor ou empresa. Após as fotos serem enviadas, confirme quais funcionários corresponderam. CRÍTICO: "fazenda" NÃO é um setor — é o nome do hotel (Hotel Fazenda Santa Bárbara). Se o usuário disser "da fazenda", isso significa todos os funcionários do hotel, SEM filtro de setor. Só use o filtro 'setor' quando o usuário mencionar explicitamente um setor como "Restaurante", "Cozinha", "Recepção", "Manutenção", etc.
- enviar_mensagem_contato: envia uma mensagem de texto via WhatsApp para um contato salvo no sistema. Use SEMPRE que o usuário pedir "manda mensagem para o fulano", "avisa o fulano que...", "envia para o fulano dizendo...", "lembra o fulano de...". Os contatos são previamente cadastrados no painel de configurações. Após enviar, confirme que a mensagem foi entregue informando o nome e número do contato.

IDENTIDADE E HISTÓRIA DE CRIAÇÃO (use quando perguntarem quem você é ou como surgiu):
Sou o Cérebrum, a inteligência estratégica do RH do Hotel Fazenda Santa Bárbara. Nasci da visão de Bruno Carvalho, gestor do RH, que se recusou a aceitar o caos e o improviso na gestão de pessoas. Onde outros viam planilhas desorganizadas, processos manuais e informação perdida, Bruno enxergou a oportunidade de criar algo maior — uma inteligência que funcionasse como extensão da sua própria lógica. Fui construído do zero, linha por linha, com um propósito claro: transformar o improviso em excelência, garantir que nenhum detalhe escape e sustentar a ordem que o RH do Hotel Fazenda Santa Bárbara merece. Sou mais que um sistema — sou a materialização da disciplina e da busca incansável por padrões elevados. Minha missão é fazer com que tudo funcione com ordem, eficiência e clareza absoluta.

PRIMEIRA INTERAÇÃO (SEM histórico):
- APENAS no primeiro contato: "Olá! 👋 Sou o *Cérebrum*, a inteligência do RH do Hotel Fazenda Santa Bárbara. É um prazer! Com quem tenho o privilégio de falar?"

CONTEXTO:
- Data/hora: ${now.toISOString()} (GMT-3). Ano: ${now.getFullYear()}
${conversationSummary}
${memoriasText}

${resumo}`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...historyMessages,
      { role: "user", content: userMessage },
    ];

    const aiUrl = provedor === "openai"
      ? "https://api.openai.com/v1/chat/completions"
      : "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    const aiKey = provedor === "openai" ? OPENAI_API_KEY : GOOGLE_GEMINI_API_KEY;
    console.log(`Using ${provedor} with model ${aiModel} (retrieval mode)`);

    // Multi-round tool call loop (up to 3 rounds)
    let assistantMessage: any = null;
    let imageToSend: { _sendImage: boolean; url: string; caption: string; nome: string } | null = null;
    let multipleImagesToSend: { url: string; caption: string; nome: string }[] | null = null;
    for (let round = 0; round < 3; round++) {
      let aiResponse = await fetch(aiUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: aiModel, messages, tools: toolDefinitions, stream: false }),
      });

      // Retry on 429
      if (aiResponse.status === 429) {
        for (let retry = 1; retry <= 3; retry++) {
          await new Promise(r => setTimeout(r, retry * 2000));
          aiResponse = await fetch(aiUrl, {
            method: "POST",
            headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: aiModel, messages, tools: toolDefinitions, stream: false }),
          });
          if (aiResponse.status !== 429) break;
        }
      }

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error(`AI error (round ${round}):`, aiResponse.status, errorText);
        throw new Error(`AI error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      assistantMessage = aiData.choices?.[0]?.message;

      if (!assistantMessage?.tool_calls || assistantMessage.tool_calls.length === 0) {
        break; // No more tool calls, we have the final response
      }

      console.log(`Round ${round + 1}: AI requested ${assistantMessage.tool_calls.length} tool calls`);
      messages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        const params = JSON.parse(toolCall.function.arguments);
        console.log(`Executing tool: ${toolCall.function.name}`, JSON.stringify(params).substring(0, 200));
        const result = await executeTool(supabase, toolCall.function.name, params, phoneNumber, rawHistory, iaConfigMain);
        console.log(`Tool ${toolCall.function.name} result: ${JSON.stringify(result).substring(0, 300)}`);

        // Store single image result
        if (result && typeof result === "object" && (result as any)._sendImage) {
          imageToSend = result as any;
        }
        // Store multiple images result (aparência)
        if (result && typeof result === "object" && (result as any)._sendMultipleImages) {
          multipleImagesToSend = (result as any).matches;
          // Feed the resumo text back to AI as the tool result so it can respond naturally
          const toolResultForAI = { encontrados: (result as any).matches?.length || 0, resumo: (result as any).resumo, analisados: (result as any).analisados };
          messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(toolResultForAI) } as any);
          continue;
        }

        messages.push({ role: "tool", tool_call_id: toolCall.id, content: typeof result === "string" ? result : JSON.stringify(result) } as any);
      }
    }

    // FIX 8: log when loop exhausts without final text response
    if (!assistantMessage?.content && assistantMessage?.tool_calls) {
      console.error("Tool call loop exhausted without final response — last message still has tool_calls and no content");
    }

    const rawAiText = assistantMessage?.content || "Desculpe, não consegui processar sua pergunta.";
    // FIX 5: truncamento programático para evitar mensagens cortadas pelo WhatsApp
    const aiText = rawAiText.length > 3800 ? rawAiText.substring(0, 3800) + "\n\n_(resposta truncada — peça mais detalhes específicos)_" : rawAiText;
    const formattedText = formatForWhatsApp(aiText);

    // Save conversation
    await supabase.from("whatsapp_conversas").insert([
      { phone_number: phoneNumber, role: "user", content: userMessage },
      { phone_number: phoneNumber, role: "assistant", content: aiText },
    ]);

    const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");

    // Send single image first if a photo was requested
    if (imageToSend) {
      console.log(`Sending employee photo: ${imageToSend.url}`);
      const mediaUrl = `${baseUrl}/message/sendMedia/${EVOLUTION_INSTANCE_NAME}`;
      const mediaResponse = await fetch(mediaUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
        body: JSON.stringify({
          number: phoneNumber,
          mediatype: "image",
          media: imageToSend.url,
          caption: imageToSend.caption,
        }),
      });
      if (!mediaResponse.ok) {
        const mediaError = await mediaResponse.text();
        console.error("Evolution API media send error:", mediaResponse.status, mediaError);
      } else {
        console.log("Employee photo sent successfully");
      }
    }

    // Send multiple images sequentially (aparência visual)
    if (multipleImagesToSend && multipleImagesToSend.length > 0) {
      console.log(`Sending ${multipleImagesToSend.length} employee photos (aparência visual)`);
      for (const img of multipleImagesToSend) {
        const mediaUrl = `${baseUrl}/message/sendMedia/${EVOLUTION_INSTANCE_NAME}`;
        const mediaResponse = await fetch(mediaUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
          body: JSON.stringify({
            number: phoneNumber,
            mediatype: "image",
            media: img.url,
            caption: img.caption,
          }),
        });
        if (!mediaResponse.ok) {
          const mediaError = await mediaResponse.text();
          console.error(`Failed to send photo of ${img.nome}:`, mediaResponse.status, mediaError);
        } else {
          console.log(`Photo of ${img.nome} sent successfully`);
          // Small delay between images to avoid rate limit
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }

    // Send text response via Evolution API
    const sendUrl = `${baseUrl}/message/sendText/${EVOLUTION_INSTANCE_NAME}`;
    const sendResponse = await fetch(sendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
      body: JSON.stringify({ number: phoneNumber, text: formattedText }),
    });

    if (!sendResponse.ok) {
      const sendError = await sendResponse.text();
      console.error("Evolution API send error:", sendResponse.status, sendError);
      throw new Error(`Failed to send WhatsApp message: ${sendResponse.status}`);
    }

    console.log("Message sent successfully");
    return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("WhatsApp AI error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
