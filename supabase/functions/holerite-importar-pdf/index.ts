// Edge function: extrai holerites de um PDF usando Gemini Vision
// Não persiste nada. Devolve a estrutura para o admin revisar.

import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument } from "npm:pdf-lib@1.17.1";
import "../_shared/geminiFallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  pdf_base64: string;
  nome_arquivo?: string;
  mes_default?: number;
  ano_default?: number;
  empresa_id_default?: string;
}

interface PdfBatch {
  base64: string;
  pages: number[];
}

const PAGE_BATCH_SIZE = 1;

const EXTRACT_PROMPT = `Você recebe um PDF com UMA ÚNICA PÁGINA que pode conter MÚLTIPLOS HOLERITES (recibos de pagamento) brasileiros empilhados verticalmente. É COMUM ter 2 (DOIS) holerites por página, um na metade superior e outro na metade inferior. PODE ter até 3.

ATENÇÃO MÁXIMA: Você DEVE varrer a página INTEIRA, de cima até embaixo, e extrair TODOS os holerites visíveis. NÃO PARE no primeiro. Cada holerite começa com um cabeçalho da empresa (razão social + CNPJ) e termina com "Total Líquido". Conte quantos blocos "Total Líquido" existem na página — esse é o número de holerites que você DEVE retornar.

Para CADA holerite identificado, retorne um objeto com:
- pagina: número da página (sempre 1 já que é uma página por vez)
- cpf: CPF do funcionário, APENAS DÍGITOS (11 caracteres). Se não encontrar, null.
- nome: nome completo do funcionário em UPPERCASE
- mes: número do mês de referência (1-12)
- ano: ano de referência (4 dígitos)
- tipo_folha: "salario" | "adiantamento" | "decimo_terceiro" | "rescisao" | "complementar"
- empresa_nome: nome da empresa pagadora ou null
- proventos: array de { codigo, descricao, valor } - valor positivo em reais
- descontos: array de { codigo, descricao, valor } - valor positivo em reais
- valor_bruto: total dos proventos (número)
- descontos_total: total dos descontos (número)
- valor_liquido: valor líquido a receber (número)

REGRAS RÍGIDAS:
- Nomes SEMPRE em UPPERCASE
- Valores em ponto decimal (ex: 1234.56)
- Não invente dados. Campo ausente = null.
- NÃO PULE holerites. Se vir 2 nomes diferentes na página, retorne 2 objetos.
- Se a página for capa/índice (sem holerite), retorne array vazio.
- Para mes/ano, procure especificamente no campo "Período", "Competência", "Referência" ou texto como "01/06/2026 Até 30/06/2026". Nesse exemplo, mes=6 e ano=2026.
- NÃO use data atual, data de processamento, data de emissão, data de admissão nem data de assinatura como competência do holerite.
- Se houver dúvida entre duas datas, use o mês/ano do intervalo do "Período" do recibo; se não encontrar, deixe mes/ano como null.

Retorne APENAS JSON válido: { "holerites": [ {...}, {...} ] }`;

async function callGeminiOnce(pdfBase64: string, apiKey: string, modelName: string): Promise<any> {
  const clean = pdfBase64.includes(",") ? pdfBase64.split(",")[1] : pdfBase64;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: EXTRACT_PROMPT },
          { inline_data: { mime_type: "application/pdf", data: clean } },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
      maxOutputTokens: 32768,
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const raw = await resp.text();
  if (!resp.ok) {
    const err: any = new Error(`Gemini error ${resp.status} (${modelName}): ${raw.slice(0, 500)}`);
    err.status = resp.status;
    throw err;
  }

  let json: any;
  try { json = JSON.parse(raw); } catch { throw new Error("Gemini retornou resposta não-JSON"); }
  const finishReason = json?.candidates?.[0]?.finishReason;
  const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("") || "";
  if (!text) throw new Error("Gemini retornou conteúdo vazio. Verifique se o PDF não está protegido/escaneado.");

  const truncated = finishReason && finishReason !== "STOP";
  if (truncated) {
    console.warn(`[holerite-importar-pdf] resposta truncada (finishReason=${finishReason}) - tentando reparar JSON`);
  }

  return parseLooseJson(text, !!truncated);
}

function parseLooseJson(text: string, truncated: boolean): any {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  const candidate = m ? m[0] : text;
  try { return JSON.parse(candidate); } catch {}
  const repaired = repairJson(candidate);
  try { return JSON.parse(repaired); } catch (e: any) {
    if (truncated) throw new Error(`Resposta da IA foi truncada e não pôde ser reparada (PDF muito grande). Divida o PDF em arquivos menores. Detalhe: ${e?.message}`);
    throw new Error(`Resposta da IA não é JSON válido: ${e?.message}`);
  }
}

function repairJson(input: string): string {
  let str = input.trim();
  // Walk: drop last incomplete element by truncating to the last completed item inside the outermost array
  const stack: string[] = [];
  let inStr = false, esc = false;
  let lastItemEnd = -1;
  let rootArrayDepth = -1;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === "{" || c === "[") {
      stack.push(c);
      if (c === "[" && rootArrayDepth === -1) rootArrayDepth = stack.length;
    } else if (c === "}" || c === "]") {
      stack.pop();
      if (rootArrayDepth !== -1 && stack.length === rootArrayDepth) {
        // we just completed an element inside the root array
        lastItemEnd = i;
      }
    }
  }
  if (lastItemEnd > 0) {
    str = str.slice(0, lastItemEnd + 1);
  }
  str = str.replace(/,\s*$/, "");
  // close remaining brackets
  const stack2: string[] = [];
  inStr = false; esc = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === "{" || c === "[") stack2.push(c);
    else if (c === "}" || c === "]") stack2.pop();
  }
  while (stack2.length) {
    const open = stack2.pop();
    str += open === "{" ? "}" : "]";
  }
  return str;
}

function base64ToBytes(pdfBase64: string): Uint8Array {
  const clean = pdfBase64.includes(",") ? pdfBase64.split(",")[1] : pdfBase64;
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(bin);
}

async function splitPdfIntoBatches(pdfBase64: string, batchSize = PAGE_BATCH_SIZE): Promise<PdfBatch[]> {
  const source = await PDFDocument.load(base64ToBytes(pdfBase64), { ignoreEncryption: true });
  const totalPages = source.getPageCount();
  const batches: PdfBatch[] = [];

  for (let start = 0; start < totalPages; start += batchSize) {
    const end = Math.min(start + batchSize, totalPages);
    const indexes = Array.from({ length: end - start }, (_, i) => start + i);
    const doc = await PDFDocument.create();
    const pages = await doc.copyPages(source, indexes);
    pages.forEach((page) => doc.addPage(page));
    const bytes = await doc.save({ useObjectStreams: false });
    batches.push({
      base64: bytesToBase64(bytes),
      pages: indexes.map((i) => i + 1),
    });
  }

  return batches.length ? batches : [{ base64: pdfBase64, pages: [1] }];
}

const FALLBACK_MODELS = ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-flash-latest"];

async function callGemini(pdfBase64: string, apiKey: string, model: string): Promise<any> {
  const primary = model || "gemini-3.5-flash";
  const chain = [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];
  let lastErr: any;
  for (const m of chain) {
    try {
      console.log(`[holerite-importar-pdf] tentando modelo ${m}`);
      return await callGeminiOnce(pdfBase64, apiKey, m);
    } catch (e: any) {
      lastErr = e;
      const status = e?.status;
      const msg = String(e?.message || "");
      const isQuota = status === 429 || /quota|rate.?limit|exceeded/i.test(msg);
      const isUnavailable = status === 503 || /unavailable|high demand|try again later/i.test(msg);
      if (!isQuota && !isUnavailable) throw e;
      console.warn(`[holerite-importar-pdf] modelo ${m} indisponível (${status}), tentando próximo...`);
    }
  }
  throw new Error(`Todos os modelos Gemini falharam. Último erro: ${lastErr?.message || lastErr}`);
}


function cleanCpf(cpf: string | null | undefined): string | null {
  if (!cpf) return null;
  const digits = cpf.replace(/\D/g, "");
  return digits.length === 11 ? digits : null;
}

function normalizeStr(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function inferCompetenciaFromNomeArquivo(nomeArquivo?: string): { mes: number; ano: number } | null {
  if (!nomeArquivo) return null;
  const normalized = nomeArquivo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const numeric = normalized.match(/(?:^|\D)(0?[1-9]|1[0-2])\D?(20\d{2})(?:\D|$)/);
  if (numeric) return { mes: Number(numeric[1]), ano: Number(numeric[2]) };

  const reverseNumeric = normalized.match(/(?:^|\D)(20\d{2})\D?(0?[1-9]|1[0-2])(?:\D|$)/);
  if (reverseNumeric) return { mes: Number(reverseNumeric[2]), ano: Number(reverseNumeric[1]) };

  const meses: Record<string, number> = {
    janeiro: 1, jan: 1,
    fevereiro: 2, fev: 2,
    marco: 3, mar: 3,
    abril: 4, abr: 4,
    maio: 5, mai: 5,
    junho: 6, jun: 6,
    julho: 7, jul: 7,
    agosto: 8, ago: 8,
    setembro: 9, set: 9,
    outubro: 10, out: 10,
    novembro: 11, nov: 11,
    dezembro: 12, dez: 12,
  };
  const ano = normalized.match(/(?:^|\D)(20\d{2})(?:\D|$)/)?.[1];
  if (!ano) return null;
  for (const [nomeMes, mes] of Object.entries(meses)) {
    if (new RegExp(`(?:^|[^a-z])${nomeMes}(?:[^a-z]|$)`).test(normalized)) {
      return { mes, ano: Number(ano) };
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;



    const supaUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } =
      await supaUser.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

    // valida role
    const { data: rolesData } = await supa
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (rolesData || []).map((r: any) => r.role);
    if (!roles.includes("admin") && !roles.includes("gestor")) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Payload;
    if (!body.pdf_base64) {
      return new Response(JSON.stringify({ error: "pdf_base64 obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cria job e processa em background (evita timeout 504 em PDFs grandes)
    const { data: job, error: errJob } = await supa
      .from("holerite_import_jobs")
      .insert({ user_id: userId, status: "processando" })
      .select("id")
      .single();
    if (errJob || !job) {
      return new Response(
        JSON.stringify({ error: `Erro ao criar job: ${errJob?.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const processar = async () => {
      try {
        // 1) carrega configuração de IA do usuário (Gemini direto)
        const { data: cfg } = await supa
          .from("configuracoes_ia")
          .select("google_gemini_api_key, modelo, provedor")
          .limit(1)
          .maybeSingle();
        const geminiKey = (cfg as any)?.google_gemini_api_key || Deno.env.get("GOOGLE_GEMINI_API_KEY");
        if (!geminiKey) {
          throw new Error("Chave do Google Gemini não configurada em Configurações > IA.");
        }
        const modelo = (cfg as any)?.provedor === "gemini" ? ((cfg as any)?.modelo || "gemini-3.5-flash") : "gemini-3.5-flash";
        const batches = await splitPdfIntoBatches(body.pdf_base64);
        const holerites: any[] = [];
        const avisos: string[] = [];

        await supa
          .from("holerite_import_jobs")
          .update({
            resultado: { total_lotes: batches.length, lotes_processados: 0, holerites_parciais: 0 },
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          try {
            if (i > 0) await new Promise((resolve) => setTimeout(resolve, 1200));
            console.log(`[holerite-importar-pdf] processando lote ${i + 1}/${batches.length} páginas ${batch.pages.join(",")}`);
            let extracted = await callGemini(batch.base64, geminiKey, modelo);
            let batchHolerites = Array.isArray(extracted?.holerites) ? extracted.holerites : [];

            // Retry se vier vazio (página com holerite costuma ter ≥1)
            if (batchHolerites.length === 0) {
              console.warn(`[holerite-importar-pdf] página ${batch.pages.join(",")} veio vazia — retry`);
              await new Promise((r) => setTimeout(r, 1500));
              try {
                extracted = await callGemini(batch.base64, geminiKey, modelo);
                batchHolerites = Array.isArray(extracted?.holerites) ? extracted.holerites : [];
              } catch (e: any) {
                console.warn(`[holerite-importar-pdf] retry falhou: ${e?.message}`);
              }
            }

            // Se a página geralmente tem 2 holerites e veio só 1, faz uma segunda tentativa pedindo verificação
            if (batchHolerites.length === 1) {
              console.warn(`[holerite-importar-pdf] página ${batch.pages.join(",")} veio com apenas 1 holerite — tentando 2ª varredura`);
              await new Promise((r) => setTimeout(r, 1500));
              try {
                const extra = await callGemini(batch.base64, geminiKey, modelo);
                const extras = Array.isArray(extra?.holerites) ? extra.holerites : [];
                // Mescla evitando duplicar pelo CPF+valor_liquido
                const key = (h: any) => `${(h?.cpf || "").replace(/\D/g, "")}_${h?.valor_liquido || 0}`;
                const seen = new Set(batchHolerites.map(key));
                for (const e of extras) {
                  if (!seen.has(key(e))) {
                    batchHolerites.push(e);
                    seen.add(key(e));
                  }
                }
              } catch (e: any) {
                console.warn(`[holerite-importar-pdf] 2ª varredura falhou: ${e?.message}`);
              }
            }

            for (const h of batchHolerites) {
              const pageInBatch = Number(h?.pagina) || 1;
              holerites.push({
                ...h,
                pagina: batch.pages[Math.max(0, pageInBatch - 1)] || batch.pages[0],
              });
            }
          } catch (e: any) {
            const msg = `Páginas ${batch.pages.join("-")}: ${e?.message || "erro ao extrair"}`;
            console.error(`[holerite-importar-pdf] ${msg}`);
            avisos.push(msg);
          }


          await supa
            .from("holerite_import_jobs")
            .update({
              resultado: {
                total_lotes: batches.length,
                lotes_processados: i + 1,
                holerites_parciais: holerites.length,
                avisos,
              },
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);
        }

        if (holerites.length === 0 && avisos.length > 0) {
          throw new Error(`Nenhum holerite extraído. O PDF foi dividido em ${batches.length} lote(s), mas a IA falhou em todos. Primeiro erro: ${avisos[0]}`);
        }

        // 2) busca employees + variaveis + empresas para matching
        const [{ data: employees }, { data: variaveis }, { data: empresas }] =
          await Promise.all([
            supa.from("employees").select("id, nome_completo, cpf, empresa_id").not("cpf", "is", null),
            supa.from("variaveis_folha").select("id, nome, codigo, tipo, empresa_id").eq("ativo", true),
            supa.from("empresas").select("id, nome"),
          ]);

        const empByCpf = new Map<string, any>();
        (employees || []).forEach((e: any) => {
          const c = cleanCpf(e.cpf);
          if (c) empByCpf.set(c, e);
        });

        const empresaByNome = new Map<string, any>();
        (empresas || []).forEach((e: any) => {
          empresaByNome.set(normalizeStr(e.nome), e);
        });

        function findVariavel(rubrica: { codigo?: string; descricao?: string }, tipo: "provento" | "desconto", empresaId: string | null) {
          const pool = (variaveis || []).filter((v: any) => v.tipo === tipo && (!v.empresa_id || v.empresa_id === empresaId));
          if (rubrica.codigo) {
            const byCode = pool.find((v: any) => (v.codigo || "").toLowerCase() === String(rubrica.codigo).toLowerCase());
            if (byCode) return byCode;
          }
          if (rubrica.descricao) {
            const target = normalizeStr(rubrica.descricao);
            const exact = pool.find((v: any) => normalizeStr(v.nome) === target);
            if (exact) return exact;
            const partial = pool.find((v: any) => normalizeStr(v.nome).includes(target) || target.includes(normalizeStr(v.nome)));
            if (partial) return partial;
          }
          return null;
        }

        // 3) processa cada holerite
        const competenciaArquivo = inferCompetenciaFromNomeArquivo(body.nome_arquivo);
        const resultado: any[] = [];
        for (const h of holerites) {
          const cpfClean = cleanCpf(h.cpf);
          const employee = cpfClean ? empByCpf.get(cpfClean) : null;

          let empresaId: string | null = null;
          if (h.empresa_nome) {
            const norm = normalizeStr(h.empresa_nome);
            const found = empresaByNome.get(norm) || Array.from(empresaByNome.entries()).find(([k]) => k.includes(norm) || norm.includes(k))?.[1];
            if (found) empresaId = found.id;
          }
          if (!empresaId && employee?.empresa_id) empresaId = employee.empresa_id;
          if (!empresaId) empresaId = body.empresa_id_default || null;

          const mes = competenciaArquivo?.mes || h.mes || body.mes_default || null;
          const ano = competenciaArquivo?.ano || h.ano || body.ano_default || null;

          // verifica duplicidade
          let jaExiste = false;
          if (employee && mes && ano) {
            const { data: existing } = await supa
              .from("folha_pagamento")
              .select("id")
              .eq("employee_id", employee.id)
              .eq("mes", mes)
              .eq("ano", ano)
              .eq("tipo_folha", h.tipo_folha || "salario")
              .maybeSingle();
            if (existing) jaExiste = true;
          }

          // mapeia rubricas
          const proventosMapped = (h.proventos || []).map((p: any) => {
            const variavel = findVariavel(p, "provento", empresaId);
            return { ...p, variavel_id: variavel?.id || null, variavel_nome: variavel?.nome || null };
          });
          const descontosMapped = (h.descontos || []).map((d: any) => {
            const variavel = findVariavel(d, "desconto", empresaId);
            return { ...d, variavel_id: variavel?.id || null, variavel_nome: variavel?.nome || null };
          });

          let status: "ok" | "sem_cpf" | "cpf_nao_encontrado" | "ja_existe" | "sem_periodo" = "ok";
          if (!cpfClean) status = "sem_cpf";
          else if (!employee) status = "cpf_nao_encontrado";
          else if (!mes || !ano) status = "sem_periodo";
          else if (jaExiste) status = "ja_existe";

          resultado.push({
            pagina: h.pagina,
            cpf: cpfClean,
            cpf_raw: h.cpf,
            nome: (h.nome || "").toUpperCase(),
            mes,
            ano,
            tipo_folha: h.tipo_folha || "salario",
            empresa_nome: h.empresa_nome,
            empresa_id: empresaId,
            employee_id: employee?.id || null,
            employee_nome: employee?.nome_completo || null,
            valor_bruto: Number(h.valor_bruto) || 0,
            descontos_total: Number(h.descontos_total) || 0,
            valor_liquido: Number(h.valor_liquido) || 0,
            proventos: proventosMapped,
            descontos: descontosMapped,
            status,
          });
        }

        await supa
          .from("holerite_import_jobs")
          .update({
            status: "concluido",
            resultado: {
              total: resultado.length,
              holerites: resultado,
              total_lotes: batches.length,
              avisos,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
      } catch (e: any) {
        console.error("[holerite-importar-pdf] job error", e);
        await supa
          .from("holerite_import_jobs")
          .update({
            status: "erro",
            erro: e?.message || "Erro interno",
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
      }
    };

    // @ts-ignore EdgeRuntime disponível no edge-runtime
    EdgeRuntime.waitUntil(processar());

    return new Response(
      JSON.stringify({ job_id: job.id, status: "processando" }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[holerite-importar-pdf]", e);
    return new Response(
      JSON.stringify({ error: e?.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
