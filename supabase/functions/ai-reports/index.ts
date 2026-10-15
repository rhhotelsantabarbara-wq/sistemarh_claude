import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "../_shared/geminiFallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, month, year } = await req.json(); // type: "monthly" | "sentiment"
    
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Determine AI provider
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    let GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    const { data: iaConfig } = await supabase.from("configuracoes_ia").select("google_gemini_api_key, openai_api_key, modelo, provedor").limit(1).maybeSingle();
    if (iaConfig?.google_gemini_api_key) {
      GOOGLE_GEMINI_API_KEY = iaConfig.google_gemini_api_key;
    }
    const openaiKey = iaConfig?.openai_api_key || OPENAI_API_KEY;
    const provedor = iaConfig?.provedor || (openaiKey ? "openai" : "gemini");
    const defaultModels: Record<string, string> = { openai: "gpt-4o-mini", gemini: "gemini-3.5-flash" };
    const aiModel = iaConfig?.modelo || defaultModels[provedor] || "gemini-3.5-flash";

    const getAiUrl = () => provedor === "openai" ? "https://api.openai.com/v1/chat/completions" : "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    const getAiHeaders = () => ({
      Authorization: `Bearer ${provedor === "openai" ? openaiKey : GOOGLE_GEMINI_API_KEY}`,
      "Content-Type": "application/json",
    });

    if (provedor === "openai" && !openaiKey) {
      throw new Error("Chave da OpenAI não configurada.");
    }
    if (provedor === "gemini" && !GOOGLE_GEMINI_API_KEY) {
      throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
    }

    const currentDate = new Date();
    const targetMonth = month || currentDate.getMonth() + 1;
    const targetYear = year || currentDate.getFullYear();
    
    const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const endDate = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];
    
    // Previous month for comparison
    const prevMonth = targetMonth === 1 ? 12 : targetMonth - 1;
    const prevYear = targetMonth === 1 ? targetYear - 1 : targetYear;
    const prevStartDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
    const prevEndDate = new Date(prevYear, prevMonth, 0).toISOString().split('T')[0];

    if (type === "monthly") {
      // Fetch current month data
      const [
        employeesRes,
        admissoesRes,
        desligamentosRes,
        feriasRes,
        faltasRes,
        tacsRes,
        avaliacoesRes,
        treinamentosRes,
        // Previous month data
        prevAdmissoesRes,
        prevDesligamentosRes,
        prevFaltasRes,
        prevTacsRes
      ] = await Promise.all([
        supabase.from("employees").select("id, status, setor").eq("status", "ativo"),
        supabase.from("employees").select("id").gte("data_admissao", startDate).lte("data_admissao", endDate),
        supabase.from("employees").select("id").gte("data_desligamento", startDate).lte("data_desligamento", endDate),
        supabase.from("ferias").select("id, dias_totais").gte("periodo_gozo_inicio", startDate).lte("periodo_gozo_inicio", endDate),
        supabase.from("faltas").select("id, justificada").gte("data", startDate).lte("data", endDate),
        supabase.from("tacs").select("id, tipo, status").gte("data_ocorrencia", startDate).lte("data_ocorrencia", endDate),
        supabase.from("avaliacoes_desempenho").select("id, nota_final, status").gte("created_at", startDate).lte("created_at", endDate + "T23:59:59"),
        supabase.from("certificados_liberados").select("id").gte("data_conclusao", startDate).lte("data_conclusao", endDate + "T23:59:59"),
        supabase.from("employees").select("id").gte("data_admissao", prevStartDate).lte("data_admissao", prevEndDate),
        supabase.from("employees").select("id").gte("data_desligamento", prevStartDate).lte("data_desligamento", prevEndDate),
        supabase.from("faltas").select("id, justificada").gte("data", prevStartDate).lte("data", prevEndDate),
        supabase.from("tacs").select("id").gte("data_ocorrencia", prevStartDate).lte("data_ocorrencia", prevEndDate)
      ]);

      const employees = employeesRes.data || [];
      const admissoes = admissoesRes.data?.length || 0;
      const desligamentos = desligamentosRes.data?.length || 0;
      const ferias = feriasRes.data || [];
      const faltas = faltasRes.data || [];
      const tacs = tacsRes.data || [];
      const avaliacoes = avaliacoesRes.data || [];
      const treinamentos = treinamentosRes.data?.length || 0;
      
      const prevAdmissoes = prevAdmissoesRes.data?.length || 0;
      const prevDesligamentos = prevDesligamentosRes.data?.length || 0;
      const prevFaltas = prevFaltasRes.data?.length || 0;
      const prevTacs = prevTacsRes.data?.length || 0;

      const faltasNaoJustificadas = faltas.filter(f => !f.justificada).length;
      const avaliacoesMedia = avaliacoes.filter(a => a.nota_final).length > 0 
        ? avaliacoes.filter(a => a.nota_final).reduce((sum, a) => sum + (a.nota_final || 0), 0) / avaliacoes.filter(a => a.nota_final).length
        : 0;

      const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

      const reportData = `
RELATÓRIO MENSAL DE RH - ${monthNames[targetMonth - 1]} de ${targetYear}

QUADRO DE PESSOAL:
- Funcionários ativos: ${employees.length}
- Admissões no mês: ${admissoes} (mês anterior: ${prevAdmissoes})
- Desligamentos no mês: ${desligamentos} (mês anterior: ${prevDesligamentos})
- Taxa de turnover: ${employees.length > 0 ? ((desligamentos / employees.length) * 100).toFixed(1) : 0}%

FÉRIAS:
- Funcionários em férias: ${ferias.length}
- Total de dias concedidos: ${ferias.reduce((sum, f) => sum + f.dias_totais, 0)}

FREQUÊNCIA:
- Total de faltas: ${faltas.length} (mês anterior: ${prevFaltas})
- Faltas justificadas: ${faltas.filter(f => f.justificada).length}
- Faltas não justificadas: ${faltasNaoJustificadas}

GESTÃO DE DESEMPENHO:
- TACs emitidos: ${tacs.length} (mês anterior: ${prevTacs})
- Tipos de TAC: ${[...new Set(tacs.map(t => t.tipo))].join(", ") || "N/A"}
- Avaliações realizadas: ${avaliacoes.length}
- Média das avaliações: ${avaliacoesMedia.toFixed(1)}/10

TREINAMENTOS:
- Certificados emitidos: ${treinamentos}
`;

      const prompt = `Com base nos dados abaixo, gere um relatório executivo resumido para o gestor de RH. Destaque:
1. Principais indicadores do mês
2. Comparação com o mês anterior (tendências)
3. Alertas importantes (se houver)
4. 2-3 recomendações práticas

Use bullet points e seja objetivo. Máximo 300 palavras.

${reportData}`;

      const response = await fetch(getAiUrl(), {
        method: "POST",
        headers: getAiHeaders(),
        body: JSON.stringify({
          model: aiModel,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) {
        throw new Error("Erro ao gerar relatório com IA");
      }

      const aiData = await response.json();
      const report = aiData.choices?.[0]?.message?.content || "Erro ao gerar relatório";

      return new Response(JSON.stringify({
        success: true,
        report,
        data: {
          month: targetMonth,
          year: targetYear,
          employees: employees.length,
          admissoes,
          desligamentos,
          ferias: ferias.length,
          faltas: faltas.length,
          faltasNaoJustificadas,
          tacs: tacs.length,
          avaliacoes: avaliacoes.length,
          avaliacoesMedia,
          treinamentos
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (type === "sentiment") {
      // Fetch evaluation comments
      const { data: notas } = await supabase
        .from("notas_avaliacao")
        .select(`
          comentario_funcionario,
          comentario_gestor,
          avaliacao_id,
          avaliacoes_desempenho(employee_id, employees(setor, cargo))
        `)
        .or("comentario_funcionario.neq.,comentario_gestor.neq.")
        .order("created_at", { ascending: false })
        .limit(100);

      const comments = (notas || [])
        .flatMap(n => [n.comentario_funcionario, n.comentario_gestor])
        .filter(c => c && c.trim().length > 10);

      if (comments.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          analysis: "Não há comentários suficientes para análise de sentimento.",
          data: { totalComments: 0 }
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const prompt = `Analise os seguintes comentários de avaliações de desempenho e forneça:

1. Sentimento geral (Positivo/Neutro/Negativo com %)
2. Principais temas positivos mencionados (top 3)
3. Principais preocupações/problemas mencionados (top 3)
4. Insights para o RH
5. Recomendações de ação

Comentários (${comments.length} total):
${comments.slice(0, 50).map((c, i) => `${i + 1}. "${c}"`).join("\n")}

Responda de forma estruturada e objetiva.`;

      const response = await fetch(getAiUrl(), {
        method: "POST",
        headers: getAiHeaders(),
        body: JSON.stringify({
          model: aiModel,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) {
        throw new Error("Erro ao analisar sentimentos");
      }

      const aiData = await response.json();
      const analysis = aiData.choices?.[0]?.message?.content || "Erro na análise";

      return new Response(JSON.stringify({
        success: true,
        analysis,
        data: { totalComments: comments.length }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Tipo de relatório inválido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("AI Reports error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
