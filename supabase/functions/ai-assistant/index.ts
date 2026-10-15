import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DRIVE_BASE, driveHeaders } from "../_shared/googleDrive.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============= RETRIEVAL TOOLS (compactados) =============

async function consultarFuncionarios(supabase: any, params: any) {
  let query = supabase.from("employees").select("nome_completo, cargo, setor, status, data_admissao, salario, tipo_contrato, telefone, cpf, data_nascimento, sexo, empresas(nome)");
  if (params.status) query = query.eq("status", params.status);
  if (params.setor) query = query.ilike("setor", `%${params.setor}%`);
  if (params.nome) query = query.ilike("nome_completo", `%${params.nome}%`);
  if (params.cargo) query = query.ilike("cargo", `%${params.cargo}%`);
  if (params.sexo) query = query.ilike("sexo", `%${params.sexo}%`);
  if (params.empresa) query = query.ilike("empresas.nome", `%${params.empresa}%`);
  if (!params.status && !params.incluir_inativos) query = query.in("status", ["ativo", "ferias", "em_admissao", "afastado"]);
  const { data, error } = await query.order("nome_completo").limit(30);
  if (error) return { error: error.message };
  return { total: (data || []).length, funcionarios: (data || []).map((e: any) => `${e.nome_completo}|${e.status}|${e.cargo}|${e.setor||"-"}|Adm:${e.data_admissao||"-"}|R$${e.salario||"-"}|${e.tipo_contrato||"-"}|${e.telefone||"-"}|${e.sexo||"-"}|${e.empresas?.nome||"-"}`) };
}

async function consultarFerias(supabase: any, params: any) {
  const today = new Date().toISOString().split("T")[0];
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [feriasRes, planejadasRes, folgasRes] = await Promise.all([
    supabase.from("ferias").select("*, employees(nome_completo, setor)").gte("periodo_gozo_fim", threeMonthsAgo).order("periodo_gozo_inicio").limit(50),
    supabase.from("ferias_planejadas").select("*, employees(nome_completo, setor)").gte("periodo_fim", today).limit(30),
    params.incluir_folgas ? supabase.from("folgas").select("*, employees(nome_completo)").gte("data", threeMonthsAgo).order("data", { ascending: false }).limit(15) : Promise.resolve({ data: null }),
  ]);
  const ferias = feriasRes.data || [];
  const planejadas = planejadasRes.data || [];
  const folgas = folgasRes.data || [];
  const atuais = ferias.filter((f: any) => f.periodo_gozo_inicio <= today && f.periodo_gozo_fim >= today);
  const futuras = ferias.filter((f: any) => f.periodo_gozo_inicio > today);
  let r = `FÉRIAS AGORA(${atuais.length}):\n${atuais.map((f: any) => `- ${f.employees?.nome_completo}: ${f.periodo_gozo_inicio} a ${f.periodo_gozo_fim} (${f.dias_totais}d)`).join("\n") || "Nenhum"}`;
  r += `\nFUTURAS(${futuras.length}):\n${futuras.slice(0, 20).map((f: any) => `- ${f.employees?.nome_completo}: ${f.periodo_gozo_inicio} a ${f.periodo_gozo_fim}`).join("\n") || "Nenhuma"}`;
  r += `\nPLANEJADAS(${planejadas.length}):\n${planejadas.map((f: any) => `- ${f.employees?.nome_completo}: ${f.periodo_inicio} a ${f.periodo_fim} (${f.status})`).join("\n") || "Nenhuma"}`;
  if (folgas.length > 0) r += `\nFOLGAS(${folgas.length}):\n${folgas.map((f: any) => `- ${f.employees?.nome_completo}: ${f.data} - ${f.motivo}`).join("\n")}`;
  return r;
}

async function consultarFaltasFolgas(supabase: any, params: any) {
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [faltasRes, folgasRes] = await Promise.all([
    supabase.from("faltas").select("*, employees(nome_completo, setor)").gte("data", threeMonthsAgo).order("data", { ascending: false }).limit(30),
    supabase.from("folgas").select("*, employees(nome_completo)").gte("data", threeMonthsAgo).order("data", { ascending: false }).limit(15),
  ]);
  const faltas = faltasRes.data || [];
  const folgas = folgasRes.data || [];
  const naoJust = faltas.filter((f: any) => !f.justificada);
  return `FALTAS(90d): ${faltas.length} total, ${naoJust.length} não just.\n${naoJust.slice(0, 15).map((f: any) => `- ${f.employees?.nome_completo}: ${f.data} ${f.motivo||""}`).join("\n") || "Nenhuma"}\nFOLGAS: ${folgas.length}\n${folgas.slice(0, 10).map((f: any) => `- ${f.employees?.nome_completo}: ${f.data} - ${f.motivo}`).join("\n") || "Nenhuma"}`;
}

async function consultarPontoBancoHoras(supabase: any, params: any) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [bancoRes, configRes, pontoRes] = await Promise.all([
    supabase.from("banco_horas").select("*, employees(nome_completo, setor, status)"),
    supabase.from("configuracao_horas_trabalho").select("employee_id, horas_diarias_esperadas"),
    params.nome_funcionario ? supabase.from("registros_ponto").select("employee_id, data, tipo_dia, horas_trabalhadas, employees(nome_completo)").gte("data", `${currentYear}-01-01`).order("data", { ascending: false }).limit(300) : Promise.resolve({ data: [] }),
  ]);
  const bancoHoras = bancoRes.data || [];
  const filtrados = params.nome_funcionario ? bancoHoras.filter((b: any) => (b.employees?.nome_completo || "").toLowerCase().includes(params.nome_funcionario.toLowerCase())) : bancoHoras;
  let r = `BANCO HORAS(${bancoHoras.length}):\n${filtrados.map((b: any) => `- ${b.employees?.nome_completo}[${b.employees?.status}]: ${b.saldo_horas > 0 ? "+" : ""}${b.saldo_horas?.toFixed(1)}h`).join("\n") || "Nenhum"}`;
  if (params.nome_funcionario && pontoRes.data?.length > 0) {
    const configMap: Record<string, number> = {};
    (configRes.data || []).forEach((c: any) => { configMap[c.employee_id] = c.horas_diarias_esperadas; });
    const nomeMes = (m: number) => ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][m];
    const empRegs = pontoRes.data.filter((reg: any) => (reg.employees?.nome_completo || "").toLowerCase().includes(params.nome_funcionario.toLowerCase()));
    if (empRegs.length > 0) {
      const hd = configMap[empRegs[0].employee_id] || 8;
      r += `\nDETALHE MENSAL(${currentYear}):`;
      for (let m = 1; m <= currentMonth; m++) {
        const ms = String(m).padStart(2, "0");
        const mr = empRegs.filter((reg: any) => reg.data.startsWith(`${currentYear}-${ms}`));
        const dn = mr.filter((reg: any) => reg.tipo_dia === "normal" && reg.horas_trabalhadas > 0).length;
        const trab = mr.reduce((s: number, reg: any) => s + (reg.horas_trabalhadas || 0), 0);
        if (dn > 0) { const saldo = trab - dn * hd; r += `\n  ${nomeMes(m)}: Esp=${(dn * hd).toFixed(1)}h Trab=${trab.toFixed(1)}h Saldo=${saldo >= 0 ? "+" : ""}${saldo.toFixed(1)}h`; }
      }
    }
  }
  return r;
}

async function consultarFinanceiro(supabase: any, params: any) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [folhaRes, adiantRes, reajustesRes] = await Promise.all([
    supabase.from("folha_pagamento").select("*, employees(nome_completo, setor)").eq("ano", currentYear).order("mes", { ascending: false }).limit(100),
    supabase.from("adiantamentos").select("*, employees(nome_completo)").eq("ano", currentYear).order("mes", { ascending: false }).limit(50),
    supabase.from("historico_reajustes_salariais").select("*, employees(nome_completo)").gte("aplicado_em", threeMonthsAgo).limit(15),
  ]);
  const folha = folhaRes.data || [];
  const adiantamentos = adiantRes.data || [];
  const reajustes = reajustesRes.data || [];
  const folhaMes = folha.filter((f: any) => f.mes === (params.mes || currentMonth));
  const tp = folhaMes.reduce((a: number, f: any) => a + (f.total_proventos || 0), 0);
  const td = folhaMes.reduce((a: number, f: any) => a + (f.total_descontos || 0), 0);
  const tl = folhaMes.reduce((a: number, f: any) => a + (f.valor_liquido || 0), 0);
  let r = `FOLHA(${params.mes || currentMonth}/${currentYear}): ${folhaMes.length} proc | Prov:R$${tp.toFixed(2)} Desc:R$${td.toFixed(2)} Líq:R$${tl.toFixed(2)}`;
  r += `\nADIANTAMENTOS(${currentYear}): ${adiantamentos.length}`;
  const meses = [...new Set(adiantamentos.map((a: any) => a.mes))].sort((a: any, b: any) => a - b);
  for (const mes of meses) {
    const ma = adiantamentos.filter((a: any) => a.mes === mes);
    r += `\nMês ${mes}: ${ma.length} reg, R$${ma.reduce((a: number, v: any) => a + (v.valor || 0), 0).toFixed(2)}`;
    r += ma.map((a: any) => `\n  - ${a.employees?.nome_completo}: R$${a.valor?.toFixed(2)} (${a.forma_pagamento})`).join("");
  }
  if (reajustes.length > 0) r += `\nREAJUSTES(90d): ${reajustes.map((rj: any) => `${rj.employees?.nome_completo}: R$${rj.salario_anterior?.toFixed(2)}→R$${rj.salario_novo?.toFixed(2)}`).join("; ")}`;
  return r;
}

async function consultarTacsAvaliacoes(supabase: any, _params: any) {
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [tacsRes, avalRes, ciclosRes] = await Promise.all([
    supabase.from("tacs").select("*, employees(nome_completo)").gte("data_ocorrencia", threeMonthsAgo).order("data_ocorrencia", { ascending: false }).limit(30),
    supabase.from("avaliacoes_desempenho").select("*, employees(nome_completo)").order("created_at", { ascending: false }).limit(30),
    supabase.from("ciclos_avaliacao").select("nome").eq("ativo", true),
  ]);
  const tacs = tacsRes.data || [];
  const avals = avalRes.data || [];
  return `TACs(90d): ${tacs.length}, ${tacs.filter((t: any) => t.status === "pendente").length} pend.\n${tacs.slice(0, 15).map((t: any) => `- ${t.employees?.nome_completo}: ${t.tipo}-${t.titulo}(${t.status})`).join("\n") || "Nenhum"}\nAVAL: ${avals.length}, ${avals.filter((a: any) => a.status === "pendente").length} pend. | Ciclos:${(ciclosRes.data || []).length}\n${avals.slice(0, 15).map((a: any) => `- ${a.employees?.nome_completo}: ${a.nota_final||"pend"}(${a.tipo},${a.status})`).join("\n") || "Nenhuma"}`;
}

async function consultarEstoque(supabase: any, _params: any) {
  const [episRes, uniRes] = await Promise.all([
    supabase.from("estoque_epis").select("tipo_epi, tamanho, quantidade_estoque, quantidade_minima"),
    supabase.from("estoque_uniformes").select("tipo_uniforme, tamanho, quantidade_estoque, quantidade_minima"),
  ]);
  const epis = episRes.data || [];
  const unis = uniRes.data || [];
  const episBaixo = epis.filter((e: any) => e.quantidade_estoque <= (e.quantidade_minima || 10));
  const unisBaixo = unis.filter((u: any) => u.quantidade_estoque <= (u.quantidade_minima || 10));
  return `EPIs(${epis.length}, ${episBaixo.length} falta):\n${epis.map((e: any) => `- ${e.tipo_epi}(${e.tamanho||"un"}): ${e.quantidade_estoque}${e.quantidade_estoque <= (e.quantidade_minima || 10) ? "⚠️" : ""}`).join("\n")}\nUNIF(${unis.length}, ${unisBaixo.length} falta):\n${unis.map((u: any) => `- ${u.tipo_uniforme}(${u.tamanho}): ${u.quantidade_estoque}${u.quantidade_estoque <= (u.quantidade_minima || 10) ? "⚠️" : ""}`).join("\n")}`;
}

async function consultarRecrutamento(supabase: any, _params: any) {
  const [vagasRes, candRes] = await Promise.all([
    supabase.from("vagas").select("titulo, status, empresas(nome), setores(nome)"),
    supabase.from("candidaturas").select("nome_completo, status, vagas(titulo)").order("created_at", { ascending: false }).limit(30),
  ]);
  const vagas = vagasRes.data || [];
  const cands = candRes.data || [];
  const abertas = vagas.filter((v: any) => v.status === "aberta");
  return `VAGAS(${vagas.length}, ${abertas.length} abertas):\n${abertas.map((v: any) => `- ${v.titulo}|${v.empresas?.nome||"-"}|${v.setores?.nome||"-"}`).join("\n") || "Nenhuma"}\nCAND: ${cands.length}, ${cands.filter((c: any) => c.status === "pendente" || c.status === "em_analise").length} pend.`;
}

async function consultarTreinamentos(supabase: any, _params: any) {
  const [cursosRes, certRes] = await Promise.all([
    supabase.from("cursos").select("titulo, carga_horaria, obrigatorio").eq("ativo", true),
    supabase.from("certificados_liberados").select("employees(nome_completo), cursos(titulo)").order("data_liberacao", { ascending: false }).limit(15),
  ]);
  const cursos = cursosRes.data || [];
  return `CURSOS(${cursos.length}, ${cursos.filter((c: any) => c.obrigatorio).length} obrig.):\n${cursos.map((c: any) => `- ${c.titulo}(${c.carga_horaria||0}h)${c.obrigatorio ? " OBRIG" : ""}`).join("\n") || "Nenhum"}\nCERTIF recentes: ${(certRes.data || []).length}`;
}

async function consultarEventosAvisos(supabase: any, _params: any) {
  const today = new Date().toISOString().split("T")[0];
  const [eventosRes, avisosRes] = await Promise.all([
    supabase.from("eventos").select("titulo, data_inicio, data_fim, tipo").gte("data_fim", today).eq("concluido", false).order("data_inicio").limit(15),
    supabase.from("avisos").select("mensagem, data_expiracao, prioridade").gte("data_expiracao", today).limit(10),
  ]);
  return `EVENTOS(${(eventosRes.data || []).length}):\n${(eventosRes.data || []).map((e: any) => `- ${e.titulo}|${e.data_inicio} a ${e.data_fim}|${e.tipo||"geral"}`).join("\n") || "Nenhum"}\nAVISOS(${(avisosRes.data || []).length}):\n${(avisosRes.data || []).map((a: any) => `- ${a.mensagem?.substring(0, 80)}|Exp:${a.data_expiracao}`).join("\n") || "Nenhum"}`;
}

async function consultarSaudeOcupacional(supabase: any, _params: any) {
  const today = new Date().toISOString().split("T")[0];
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [encRes, afastRes] = await Promise.all([
    supabase.from("encaminhamentos_medicos").select("tipo_exame, status, employees(nome_completo)").in("status", ["pendente", "agendado"]).limit(20),
    supabase.from("afastamentos").select("motivo, data_inicio, data_fim, employees(nome_completo)").gte("data_fim", threeMonthsAgo),
  ]);
  const afastAtivos = (afastRes.data || []).filter((a: any) => a.data_inicio <= today && a.data_fim >= today);
  return `EXAMES PEND(${(encRes.data || []).length}):\n${(encRes.data || []).map((e: any) => `- ${e.employees?.nome_completo}: ${e.tipo_exame}(${e.status})`).join("\n") || "Nenhum"}\nAFASTADOS(${afastAtivos.length}):\n${afastAtivos.map((a: any) => `- ${a.employees?.nome_completo}: ${a.motivo}(${a.data_inicio} a ${a.data_fim})`).join("\n") || "Nenhum"}`;
}

async function consultarChecklists(supabase: any, _params: any) {
  const { data } = await supabase.from("plano_checklist_funcionario").select("tipo, employees(nome_completo), plano_checklist_funcionario_itens(concluido)").in("status", ["em_andamento", "pendente"]).limit(15);
  return `CHECKLISTS PEND(${(data || []).length}):\n${(data || []).map((c: any) => {
    const itens = c.plano_checklist_funcionario_itens || [];
    return `- ${c.employees?.nome_completo}: ${c.tipo} ${itens.filter((i: any) => i.concluido).length}/${itens.length}`;
  }).join("\n") || "Nenhum"}`;
}

// REMOVIDO: consultarResumoGeral (chamava TODAS as 12 tools de uma vez - desperdício massivo de tokens)

async function consultarMetas(supabase: any, params: any) {
  let query = supabase.from("metas_funcionario").select("titulo, status, prazo, progresso, employees(nome_completo)").order("created_at", { ascending: false }).limit(30);
  if (params.status) query = query.eq("status", params.status);
  if (params.nome_funcionario) {
    const { data: emps } = await supabase.from("employees").select("id").ilike("nome_completo", `%${params.nome_funcionario}%`).limit(10);
    if (emps?.length > 0) query = query.in("employee_id", emps.map((e: any) => e.id));
    else return "Funcionário não encontrado.";
  }
  const { data, error } = await query;
  if (error) return { error: error.message };
  return `METAS(${(data || []).length}):\n${(data || []).map((m: any) => `- ${m.employees?.nome_completo}: ${m.titulo||"Meta"}|${m.status}|Prazo:${m.prazo||"-"}|${m.progresso||0}%`).join("\n") || "Nenhuma."}`;
}

async function consultarProgressoTreinamento(supabase: any, params: any) {
  const [modulosRes, aulasRes, progressoRes] = await Promise.all([
    supabase.from("modulos").select("id, titulo, curso_id, cursos(titulo)").order("ordem"),
    supabase.from("aulas").select("id, modulo_id").order("ordem"),
    params.nome_funcionario
      ? supabase.from("progresso_aulas").select("concluida, employees(nome_completo), aulas(titulo, modulo_id)").order("updated_at", { ascending: false }).limit(100)
      : supabase.from("progresso_aulas").select("concluida, employees(nome_completo)").order("updated_at", { ascending: false }).limit(50),
  ]);
  const modulos = modulosRes.data || [];
  const aulas = aulasRes.data || [];
  const progresso = progressoRes.data || [];
  const cursoMap: Record<string, { titulo: string; modulos: number; aulas: number }> = {};
  for (const m of modulos) {
    const cid = m.curso_id;
    if (!cursoMap[cid]) cursoMap[cid] = { titulo: m.cursos?.titulo || "?", modulos: 0, aulas: 0 };
    cursoMap[cid].modulos++;
    cursoMap[cid].aulas += aulas.filter((a: any) => a.modulo_id === m.id).length;
  }
  let r = `CURSOS:\n${Object.values(cursoMap).map((c) => `- ${c.titulo}: ${c.modulos}mod, ${c.aulas}aulas`).join("\n")}`;
  if (params.nome_funcionario) {
    const filtered = progresso.filter((p: any) => (p.employees?.nome_completo || "").toLowerCase().includes(params.nome_funcionario.toLowerCase()));
    r += `\nPROGRESSO "${params.nome_funcionario}"(${filtered.length}):\n${filtered.slice(0, 20).map((p: any) => `- ${p.aulas?.titulo}: ${p.concluida ? "✅" : "⏳"}`).join("\n") || "Nenhum."}`;
  }
  return r;
}

async function consultarDetalhesAvaliacao(supabase: any, params: any) {
  let avalQuery = supabase.from("avaliacoes_desempenho").select("id, tipo, status, nota_final, periodo_inicio, periodo_fim, employees(nome_completo, cargo)").order("created_at", { ascending: false }).limit(20);
  if (params.nome_funcionario) {
    const { data: emps } = await supabase.from("employees").select("id").ilike("nome_completo", `%${params.nome_funcionario}%`).limit(10);
    if (emps?.length > 0) avalQuery = avalQuery.in("employee_id", emps.map((e: any) => e.id));
  }
  const { data: avaliacoes } = await avalQuery;
  if (!avaliacoes || avaliacoes.length === 0) return "Nenhuma avaliação.";
  const { data: notas } = await supabase.from("notas_avaliacao").select("avaliacao_id, nota_funcionario, nota_gestor, criterios_avaliacao(nome, peso)").in("avaliacao_id", avaliacoes.map((a: any) => a.id));
  let r = `AVALIAÇÕES(${avaliacoes.length}):\n`;
  for (const av of avaliacoes) {
    const avNotas = (notas || []).filter((n: any) => n.avaliacao_id === av.id);
    r += `\n${av.employees?.nome_completo}(${av.tipo},${av.status}) Nota:${av.nota_final||"pend"} ${av.periodo_inicio} a ${av.periodo_fim}`;
    if (avNotas.length > 0) r += avNotas.map((n: any) => `\n  ${n.criterios_avaliacao?.nome||"?"}(p${n.criterios_avaliacao?.peso||1}): F=${n.nota_funcionario||"-"} G=${n.nota_gestor||"-"}`).join("");
  }
  return r;
}

async function consultarHistoricos(supabase: any, params: any) {
  const tipo = params.tipo || "todos";
  const limit = 20;
  let r = "";
  if (tipo === "banco_horas" || tipo === "todos") {
    let query = supabase.from("historico_banco_horas").select("horas, saldo_anterior, saldo_novo, tipo_movimentacao, motivo, created_at, employees(nome_completo)").order("created_at", { ascending: false }).limit(limit);
    if (params.nome_funcionario) {
      const { data: emps } = await supabase.from("employees").select("id").ilike("nome_completo", `%${params.nome_funcionario}%`).limit(10);
      if (emps?.length > 0) query = query.in("employee_id", emps.map((e: any) => e.id));
    }
    const { data } = await query;
    r += `HIST BH(${(data || []).length}):\n${(data || []).map((h: any) => `- ${h.employees?.nome_completo}: ${h.tipo_movimentacao||"mov"} ${h.horas>0?"+":""}${h.horas}h ${h.saldo_anterior}→${h.saldo_novo} ${h.motivo||""}`).join("\n") || "Nenhum"}\n`;
  }
  if (tipo === "estoque_epis" || tipo === "todos") {
    const { data } = await supabase.from("historico_estoque_epis").select("quantidade, tipo_movimentacao, motivo, estoque_epis:estoque_epi_id(tipo_epi), employees:employee_id(nome_completo)").order("created_at", { ascending: false }).limit(limit);
    r += `HIST EPIs(${(data || []).length}):\n${(data || []).map((h: any) => `- ${h.estoque_epis?.tipo_epi||"EPI"}: ${h.tipo_movimentacao} ${h.quantidade}un ${h.employees?.nome_completo||""}`).join("\n") || "Nenhum"}\n`;
  }
  if (tipo === "estoque_uniformes" || tipo === "todos") {
    const { data } = await supabase.from("historico_estoque_uniformes").select("quantidade, tipo_movimentacao, motivo, estoque_uniformes:estoque_uniforme_id(tipo_uniforme), employees:employee_id(nome_completo)").order("created_at", { ascending: false }).limit(limit);
    r += `HIST UNIF(${(data || []).length}):\n${(data || []).map((h: any) => `- ${h.estoque_uniformes?.tipo_uniforme||"Unif"}: ${h.tipo_movimentacao} ${h.quantidade}un ${h.employees?.nome_completo||""}`).join("\n") || "Nenhum"}\n`;
  }
  if (tipo === "folgas" || tipo === "todos") {
    let query = supabase.from("historico_folgas").select("quantidade_anterior, quantidade_nova, observacao, alterado_em, employees:employee_id(nome_completo)").order("created_at", { ascending: false }).limit(limit);
    if (params.nome_funcionario) {
      const { data: emps } = await supabase.from("employees").select("id").ilike("nome_completo", `%${params.nome_funcionario}%`).limit(10);
      if (emps?.length > 0) query = query.in("employee_id", emps.map((e: any) => e.id));
    }
    const { data } = await query;
    r += `HIST FOLGAS(${(data || []).length}):\n${(data || []).map((h: any) => `- ${h.employees?.nome_completo}: ${h.quantidade_anterior}→${h.quantidade_nova} ${h.observacao||""}`).join("\n") || "Nenhum"}`;
  }
  return r || "Nenhum histórico.";
}

async function consultarVariaveisFixas(supabase: any, params: any) {
  const [variaveisRes, fixasRes] = await Promise.all([
    supabase.from("variaveis_folha").select("nome, tipo, codigo").eq("ativo", true).order("tipo").order("nome"),
    params.nome_funcionario
      ? (async () => {
          const { data: emps } = await supabase.from("employees").select("id").ilike("nome_completo", `%${params.nome_funcionario}%`).limit(10);
          if (emps?.length > 0) return supabase.from("variaveis_fixas_funcionario").select("valor, ativo, variavel:variaveis_folha(nome, tipo), employees:employee_id(nome_completo)").in("employee_id", emps.map((e: any) => e.id));
          return { data: [] };
        })()
      : supabase.from("variaveis_fixas_funcionario").select("valor, ativo, variavel:variaveis_folha(nome, tipo), employees:employee_id(nome_completo)").eq("ativo", true).limit(50),
  ]);
  const variaveis = variaveisRes.data || [];
  const fixas = fixasRes.data || [];
  const prov = variaveis.filter((v: any) => v.tipo === "provento");
  const desc = variaveis.filter((v: any) => v.tipo === "desconto");
  let r = `VARIÁVEIS(${variaveis.length}): Prov(${prov.length}): ${prov.map((v: any) => v.nome).join(", ")||"Nenhum"} | Desc(${desc.length}): ${desc.map((v: any) => v.nome).join(", ")||"Nenhum"}`;
  r += `\nFIXAS POR FUNC(${fixas.length}):\n${fixas.map((f: any) => `- ${f.employees?.nome_completo}: ${f.variavel?.nome}(${f.variavel?.tipo})=R$${f.valor?.toFixed(2)}`).join("\n") || "Nenhuma"}`;
  return r;
}

async function consultarArquivosFuncionario(supabase: any, params: any) {
  if (!params.nome_funcionario) return "Informe o nome.";
  const { data: emps } = await supabase.from("employees").select("id, nome_completo").ilike("nome_completo", `%${params.nome_funcionario}%`).limit(5);
  if (!emps || emps.length === 0) return `"${params.nome_funcionario}" não encontrado.`;
  const { data: files } = await supabase.from("employee_files").select("file_name, file_type, description, created_at, employees:employee_id(nome_completo)").in("employee_id", emps.map((e: any) => e.id)).order("created_at", { ascending: false });
  return `ARQUIVOS(${(files || []).length}):\n${(files || []).map((f: any) => `- ${f.employees?.nome_completo}: ${f.file_name}(${f.file_type||"arq"}) ${f.description||""}`).join("\n") || "Nenhum."}`;
}

async function consultarContratos(supabase: any, _params: any) {
  const { data } = await supabase.from("modelos_contrato").select("nome, tipo, updated_at").order("created_at", { ascending: false });
  return `CONTRATOS(${(data || []).length}):\n${(data || []).map((c: any) => `- ${c.nome}|${c.tipo||"geral"}|${c.updated_at?.substring(0, 10)}`).join("\n") || "Nenhum."}`;
}

async function consultarConfiguracoes(supabase: any, params: any) {
  const tipo = params.tipo || "todos";
  let r = "";
  if (tipo === "setores" || tipo === "todos") {
    const { data } = await supabase.from("configuracao_setor").select("quantidade_media, alertas_ativos, setores:setor_id(nome)");
    r += `SETORES(${(data || []).length}):\n${(data || []).map((c: any) => `- ${c.setores?.nome}: qtd=${c.quantidade_media} alerta=${c.alertas_ativos?"✅":"❌"}`).join("\n") || "Nenhuma"}\n`;
  }
  if (tipo === "ferias" || tipo === "todos") {
    const { data } = await supabase.from("configuracoes_ferias").select("percentual_maximo_ausencia, cobertura_minima");
    r += `FÉRIAS(${(data || []).length}):\n${(data || []).map((c: any) => `- Máx:${c.percentual_maximo_ausencia||"N/A"}% Cob:${c.cobertura_minima||"N/A"}`).join("\n") || "Nenhuma"}\n`;
  }
  if (tipo === "checklists" || tipo === "todos") {
    const { data: templates } = await supabase.from("plano_checklist_templates").select("nome, tipo, plano_checklist_itens(titulo)").eq("ativo", true);
    r += `CHECKLISTS(${(templates || []).length}):\n${(templates || []).map((t: any) => `- ${t.nome}(${t.tipo}): ${(t.plano_checklist_itens||[]).length} itens`).join("\n") || "Nenhum"}`;
  }
  return r || "Nenhuma config.";
}

// ============= NOVAS TOOLS SOB DEMANDA =============

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

async function consultarMemorias(supabase: any, params: any) {
  let query = supabase.from("cerebrum_memorias").select("conteudo, categoria, nome_professor").eq("ativo", true).order("created_at", { ascending: false }).limit(50);
  if (params.categoria) query = query.eq("categoria", params.categoria);
  const { data } = await query;
  return `MEMÓRIAS(${(data||[]).length}):\n${(data||[]).map((m: any) => `- [${m.categoria}] ${m.conteudo}${m.nome_professor ? ` (${m.nome_professor})` : ""}`).join("\n") || "Nenhuma."}`;
}

function consultarIdentidade() {
  return `Sou o Cérebrum, inteligência estratégica do RH do Hotel Fazenda Santa Bárbara. Nasci da visão de Bruno Carvalho, gestor do RH, que se recusou a aceitar o caos na gestão de pessoas. Onde outros viam planilhas desorganizadas e processos manuais, Bruno enxergou a oportunidade de criar algo maior — uma inteligência como extensão da sua lógica. Fui construído do zero, linha por linha, para transformar o improviso em excelência. Sou a materialização da disciplina e da busca por padrões elevados. Minha missão: ordem, eficiência e clareza absoluta.`;
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

// ============= TOOL DEFINITIONS (compactadas) =============

const toolDefinitions = [
  { type: "function", function: { name: "consultar_funcionarios", description: "Busca funcionários. sexo='feminino'/'masculino'.", parameters: { type: "object", properties: { nome: { type: "string" }, setor: { type: "string" }, status: { type: "string", enum: ["ativo", "ferias", "em_admissao", "afastado", "demitido"] }, cargo: { type: "string" }, sexo: { type: "string", enum: ["feminino", "masculino"] }, empresa: { type: "string" }, incluir_inativos: { type: "boolean" } } } } },
  { type: "function", function: { name: "consultar_ferias", description: "Férias atuais, futuras, planejadas, folgas.", parameters: { type: "object", properties: { incluir_folgas: { type: "boolean" } } } } },
  { type: "function", function: { name: "consultar_faltas_folgas", description: "Faltas e folgas (90 dias).", parameters: { type: "object", properties: { nome: { type: "string" } } } } },
  { type: "function", function: { name: "consultar_ponto_banco_horas", description: "Banco de horas e ponto.", parameters: { type: "object", properties: { nome_funcionario: { type: "string" } } } } },
  { type: "function", function: { name: "consultar_financeiro", description: "Folha, adiantamentos, reajustes.", parameters: { type: "object", properties: { mes: { type: "number" } } } } },
  { type: "function", function: { name: "consultar_tacs_avaliacoes", description: "TACs e avaliações.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "consultar_estoque", description: "Estoque EPIs e uniformes.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "consultar_recrutamento", description: "Vagas e candidaturas.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "consultar_treinamentos", description: "Cursos e certificados.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "consultar_eventos_avisos", description: "Eventos e avisos.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "consultar_saude_ocupacional", description: "Exames e afastamentos.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "consultar_checklists", description: "Checklists pendentes.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "consultar_resumo_rapido", description: "Contagens rápidas: ativos, férias, pendências. Use para visão geral.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "consultar_metas", description: "Metas de desempenho.", parameters: { type: "object", properties: { nome_funcionario: { type: "string" }, status: { type: "string", enum: ["pendente", "em_andamento", "concluida", "cancelada"] } } } } },
  { type: "function", function: { name: "consultar_progresso_treinamento", description: "Progresso em cursos/módulos/aulas.", parameters: { type: "object", properties: { nome_funcionario: { type: "string" } } } } },
  { type: "function", function: { name: "consultar_detalhes_avaliacao", description: "Notas por critério das avaliações.", parameters: { type: "object", properties: { nome_funcionario: { type: "string" } } } } },
  { type: "function", function: { name: "consultar_historicos", description: "Históricos: banco horas, estoque, folgas.", parameters: { type: "object", properties: { tipo: { type: "string", enum: ["banco_horas", "estoque_epis", "estoque_uniformes", "folgas", "todos"] }, nome_funcionario: { type: "string" } } } } },
  { type: "function", function: { name: "consultar_variaveis_fixas", description: "Variáveis da folha e fixas por funcionário.", parameters: { type: "object", properties: { nome_funcionario: { type: "string" } } } } },
  { type: "function", function: { name: "consultar_arquivos_funcionario", description: "Arquivos de um funcionário.", parameters: { type: "object", properties: { nome_funcionario: { type: "string" } }, required: ["nome_funcionario"] } } },
  { type: "function", function: { name: "consultar_contratos", description: "Modelos de contrato.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "consultar_configuracoes", description: "Config setores, férias, checklists.", parameters: { type: "object", properties: { tipo: { type: "string", enum: ["setores", "ferias", "checklists", "todos"] } } } } },
  { type: "function", function: { name: "consultar_memorias", description: "Busca memórias permanentes do Cérebrum.", parameters: { type: "object", properties: { categoria: { type: "string", enum: ["preferencia", "correcao", "padrao_rh", "fato", "regra", "geral"] } } } } },
  { type: "function", function: { name: "consultar_identidade", description: "Retorna a história de criação e identidade do Cérebrum.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "atualizar_status_adiantamentos", description: "Atualiza o status dos adiantamentos (ex: para 'feito' quando já foram pagos). Use quando o gestor disser que já depositou/pagou os adiantamentos.", parameters: { type: "object", properties: { mes: { type: "number", description: "Mês dos adiantamentos" }, ano: { type: "number", description: "Ano dos adiantamentos" }, nome_funcionario: { type: "string", description: "Nome do funcionário (opcional, se vazio atualiza todos do mês)" }, status_novo: { type: "string", enum: ["feito", "aguardando"], description: "Novo status" } } } } },
  { type: "function", function: { name: "listar_drive_pastas", description: "Lista as pastas dentro da pasta de backup do Google Drive (BACKUP RH). Use para mostrar quais tipos de documentos existem (EPI, UNIFORME, TAC etc).", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "buscar_drive_arquivos", description: "Busca arquivos dentro da pasta de backup do Google Drive (BACKUP RH). Pode filtrar por nome e/ou tipo de pasta (EPI, UNIFORME, TAC etc). Retorna nome, link e data.", parameters: { type: "object", properties: { nome: { type: "string", description: "Parte do nome do arquivo (ex: nome do funcionário)" }, tipo: { type: "string", description: "Filtrar por pasta: EPI, UNIFORME, TAC, CRACHÁ, DESLIGAMENTO, ENCAMINHAMENTO, ETIQUETA, PONTO, CONTA SALÁRIO" } } } } },
];

async function executeTool(supabase: any, toolName: string, params: any) {
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
    case "consultar_resumo_rapido": return await consultarResumoRapido(supabase);
    case "consultar_metas": return await consultarMetas(supabase, params);
    case "consultar_progresso_treinamento": return await consultarProgressoTreinamento(supabase, params);
    case "consultar_detalhes_avaliacao": return await consultarDetalhesAvaliacao(supabase, params);
    case "consultar_historicos": return await consultarHistoricos(supabase, params);
    case "consultar_variaveis_fixas": return await consultarVariaveisFixas(supabase, params);
    case "consultar_arquivos_funcionario": return await consultarArquivosFuncionario(supabase, params);
    case "consultar_contratos": return await consultarContratos(supabase, params);
    case "consultar_configuracoes": return await consultarConfiguracoes(supabase, params);
    case "consultar_memorias": return await consultarMemorias(supabase, params);
    case "consultar_identidade": return consultarIdentidade();
    case "atualizar_status_adiantamentos": return await atualizarStatusAdiantamentos(supabase, params);
    case "listar_drive_pastas": return await listarDrivePastas(supabase);
    case "buscar_drive_arquivos": return await buscarDriveArquivos(supabase, params);
    default: return { error: `Tool ${toolName} not found` };
  }
}

// ============= GOOGLE DRIVE TOOLS =============
const DRIVE_GATEWAY = DRIVE_BASE;

async function getDriveRootId(supabase: any): Promise<string | null> {
  const { data } = await supabase.from("drive_backup_config").select("pasta_raiz_id, ativo").eq("id", 1).maybeSingle();
  return data?.pasta_raiz_id || null;
}

async function listarDrivePastas(supabase: any) {
  try {
    const rootId = await getDriveRootId(supabase);
    if (!rootId) return "Backup do Google Drive ainda não foi configurado. Peça ao gestor para configurar em Configurações → Google Drive.";
    const q = encodeURIComponent(`'${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const res = await fetch(`${DRIVE_GATEWAY}/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=100`, { headers: await driveHeaders() });
    if (!res.ok) return `Erro Drive: ${res.status}`;
    const json = await res.json();
    const pastas = (json.files || []).map((f: any) => f.name).sort();
    return `PASTAS NO BACKUP RH (${pastas.length}):\n${pastas.join("\n") || "Nenhuma pasta encontrada"}`;
  } catch (e) {
    return `Erro: ${(e as Error).message}`;
  }
}

async function buscarDriveArquivos(supabase: any, params: any) {
  try {
    const rootId = await getDriveRootId(supabase);
    if (!rootId) return "Backup do Google Drive ainda não foi configurado.";

    // Buscar IDs de todas as pastas do backup (root + subpastas conhecidas via cache)
    const { data: cache } = await supabase.from("drive_folder_cache").select("caminho, drive_folder_id");
    let folderIds: string[] = [rootId, ...((cache || []).map((c: any) => c.drive_folder_id))];

    // Filtro por tipo: pegar apenas IDs cujo caminho contenha o tipo
    if (params.tipo) {
      const tipoUp = String(params.tipo).toUpperCase();
      const filtered = (cache || []).filter((c: any) => c.caminho.toUpperCase().includes("/" + tipoUp));
      if (filtered.length === 0) return `Pasta "${params.tipo}" ainda não tem arquivos cadastrados no cache. Use listar_drive_pastas primeiro.`;
      folderIds = filtered.map((c: any) => c.drive_folder_id);
    }

    // Drive limita queries: usar até 50 pastas por vez
    folderIds = folderIds.slice(0, 50);
    const parentsClause = folderIds.map((id) => `'${id}' in parents`).join(" or ");
    const nameClause = params.nome ? ` and name contains '${String(params.nome).replace(/'/g, "\\'")}'` : "";
    const q = encodeURIComponent(`(${parentsClause}) and mimeType!='application/vnd.google-apps.folder' and trashed=false${nameClause}`);

    const res = await fetch(`${DRIVE_GATEWAY}/drive/v3/files?q=${q}&fields=files(id,name,webViewLink,modifiedTime,parents)&pageSize=50&orderBy=modifiedTime desc`, { headers: await driveHeaders() });
    if (!res.ok) return `Erro Drive: ${res.status} - ${await res.text()}`;
    const json = await res.json();
    const arquivos = json.files || [];
    if (arquivos.length === 0) return "Nenhum arquivo encontrado com esses filtros.";

    // Map folder id -> name from cache
    const folderName: Record<string, string> = {};
    (cache || []).forEach((c: any) => {
      const parts = c.caminho.split("/");
      folderName[c.drive_folder_id] = parts[parts.length - 1];
    });

    const linhas = arquivos.map((f: any) => {
      const pasta = (f.parents || []).map((p: string) => folderName[p]).filter(Boolean).join(",") || "-";
      const data = f.modifiedTime ? f.modifiedTime.split("T")[0] : "-";
      return `${f.name}|${pasta}|${data}|${f.webViewLink}`;
    });
    return `ARQUIVOS (${arquivos.length}):\nnome|pasta|data|link\n${linhas.join("\n")}`;
  } catch (e) {
    return `Erro: ${(e as Error).message}`;
  }
}

// ============= MAIN HANDLER =============

// Cache de configuração da IA (TTL 5 minutos)
let iaConfigCache: { data: any; timestamp: number } | null = null;
const IA_CONFIG_TTL = 5 * 60 * 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userMessage } = await req.json();

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Config da IA com cache
    const OLLAMA_BASE_URL = Deno.env.get("OLLAMA_BASE_URL");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    let GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");

    let iaConfig: any = null;
    const now = Date.now();
    if (iaConfigCache && (now - iaConfigCache.timestamp) < IA_CONFIG_TTL) {
      iaConfig = iaConfigCache.data;
    } else {
      const { data } = await supabase.from("configuracoes_ia").select("google_gemini_api_key, openai_api_key, modelo, provedor").limit(1).maybeSingle();
      iaConfig = data;
      iaConfigCache = { data, timestamp: now };
    }

    if (iaConfig?.google_gemini_api_key) GOOGLE_GEMINI_API_KEY = iaConfig.google_gemini_api_key;
    const openaiKey = iaConfig?.openai_api_key || OPENAI_API_KEY;
    const provedor = iaConfig?.provedor || (openaiKey ? "openai" : OLLAMA_BASE_URL ? "ollama" : "gemini");
    const defaultModels: Record<string, string> = { openai: "gpt-4o-mini", ollama: "llama3.1", gemini: "gemini-2.0-flash" };
    const aiModel = iaConfig?.modelo || defaultModels[provedor] || "gemini-2.0-flash";

    if (provedor === "openai" && !openaiKey) throw new Error("Chave da OpenAI não configurada.");
    if (provedor === "gemini" && !GOOGLE_GEMINI_API_KEY) throw new Error("Chave do Google Gemini não configurada.");
    if (provedor === "ollama" && !OLLAMA_BASE_URL) throw new Error("OLLAMA_BASE_URL não configurada.");

    // System prompt COMPACTADO: sem memórias, sem resumo, sem identidade
    const nowDate = new Date();
    const systemPrompt = `Você é o CÉREBRUM — inteligência estratégica do RH do Hotel Fazenda Santa Bárbara. Criação de Bruno Carvalho.
Simpático, caloroso, acolhedor. Use emojis. Organize com Markdown. Português brasileiro.
PESSOAS ESPECIAIS: Sr. Jaime e Sra. Stela (donos) = máximo respeito/deferência. Bruno Carvalho = criador/gestor.
REGRAS: NÃO invente dados. SEMPRE use tools. Pode fornecer dados cadastrais (CPF, salário etc) ao gestor.
AÇÕES: Pode atualizar status de adiantamentos quando o gestor pedir (ex: "já paguei os adiantamentos", "marca como feito").
Para saber quem você é, use consultar_identidade. Para memórias, use consultar_memorias. Para visão geral, use consultar_resumo_rapido.
Para buscar PDFs no Google Drive (BACKUP RH): listar_drive_pastas mostra os tipos de documento, buscar_drive_arquivos encontra arquivos por nome/tipo e retorna o link.
Data: ${nowDate.toISOString()} | Ano: ${nowDate.getFullYear()}`;

    // Ollama sem tools
    if (provedor === "ollama") {
      const ollamaUrl = `${OLLAMA_BASE_URL!.replace(/\/$/, "")}/v1/chat/completions`;
      const resumo = await consultarResumoRapido(supabase);
      const ollamaMessages = [
        { role: "system", content: systemPrompt + "\n\n" + resumo },
        ...(messages || []).slice(-8),
        ...(userMessage ? [{ role: "user", content: userMessage }] : []),
      ];
      const response = await fetch(ollamaUrl, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: aiModel, messages: ollamaMessages, stream: true }),
      });
      if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
      return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // OpenAI / Gemini com tools
    const aiUrl = provedor === "openai"
      ? "https://api.openai.com/v1/chat/completions"
      : "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    const aiKey = provedor === "openai" ? openaiKey : GOOGLE_GEMINI_API_KEY;

    // Limitar histórico a últimas 8 mensagens
    const limitedMessages = (messages || []).slice(-8);

    const aiMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...limitedMessages,
      ...(userMessage ? [{ role: "user", content: userMessage }] : []),
    ];

    // Multi-round tool call loop (até 3 rounds)
    for (let round = 0; round < 3; round++) {
      let aiResponse = await fetch(aiUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: aiModel, messages: aiMessages, tools: toolDefinitions, stream: false }),
      });

      if (aiResponse.status === 429) {
        for (let retry = 1; retry <= 3; retry++) {
          await new Promise(r => setTimeout(r, retry * 2000));
          aiResponse = await fetch(aiUrl, {
            method: "POST",
            headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: aiModel, messages: aiMessages, tools: toolDefinitions, stream: false }),
          });
          if (aiResponse.status !== 429) break;
        }
      }

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("AI error:", aiResponse.status, errorText);
        throw new Error(`AI error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const assistantMsg = aiData.choices?.[0]?.message;

      if (!assistantMsg?.tool_calls || assistantMsg.tool_calls.length === 0) {
        // Streaming real da resposta final
        const finalContent = assistantMsg?.content || "Desculpe, não consegui processar.";
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            const chunkSize = 20;
            for (let i = 0; i < finalContent.length; i += chunkSize) {
              const chunk = finalContent.substring(i, i + chunkSize);
              const sseData = JSON.stringify({ choices: [{ delta: { content: chunk } }] });
              controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
        return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
      }

      console.log(`Round ${round + 1}: ${assistantMsg.tool_calls.length} tool calls`);
      aiMessages.push(assistantMsg);

      for (const toolCall of assistantMsg.tool_calls) {
        const params = JSON.parse(toolCall.function.arguments);
        console.log(`Tool: ${toolCall.function.name}`);
        const result = await executeTool(supabase, toolCall.function.name, params);
        aiMessages.push({ role: "tool", tool_call_id: toolCall.id, content: typeof result === "string" ? result : JSON.stringify(result) });
      }
    }

    return new Response(JSON.stringify({ error: "Muitas consultas necessárias." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("AI Assistant error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
