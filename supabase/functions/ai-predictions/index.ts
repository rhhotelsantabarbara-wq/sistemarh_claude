import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "../_shared/geminiFallback.ts";
import { exigirPapel } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RiskFactor {
  factor: string;
  score: number;
  detail: string;
}

interface EmployeeRisk {
  employee_id: string;
  nome: string;
  cargo: string;
  setor: string;
  score: number;
  risk_level: "alto" | "medio" | "baixo";
  factors: RiskFactor[];
  suggestion?: string;
}

interface PromotionCandidate {
  employee_id: string;
  nome: string;
  cargo: string;
  setor: string;
  score: number;
  factors: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Só usuários com permissão podem executar esta função
    const acesso = await exigirPapel(req, ["gestor", "admin_parcial"]);
    if (acesso.resposta) return acesso.resposta;

    const { type } = await req.json(); // "turnover" | "promotion"
    
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

    const today = new Date();
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Fetch all relevant data
    const [
      employeesRes,
      avaliacoesRes,
      faltasRes,
      tacsRes,
      loginsRes,
      cursosRes,
      progressoRes,
      certificadosRes
    ] = await Promise.all([
      supabase.from("employees").select("*").eq("status", "ativo"),
      supabase.from("avaliacoes_desempenho").select("*"),
      supabase.from("faltas").select("*").gte("data", ninetyDaysAgo),
      supabase.from("tacs").select("*").gte("data_ocorrencia", ninetyDaysAgo),
      supabase.from("login_history").select("*").gte("login_at", thirtyDaysAgo),
      supabase.from("cursos").select("*").eq("obrigatorio", true).eq("ativo", true),
      supabase.from("progresso_aulas").select("*, aulas(modulo_id, modulos(curso_id))"),
      supabase.from("certificados_liberados").select("*")
    ]);

    const employees = employeesRes.data || [];
    const avaliacoes = avaliacoesRes.data || [];
    const faltas = faltasRes.data || [];
    const tacs = tacsRes.data || [];
    const logins = loginsRes.data || [];
    const cursos = cursosRes.data || [];
    const progressos = progressoRes.data || [];
    const certificados = certificadosRes.data || [];

    if (type === "turnover") {
      // Calculate turnover risk for each employee
      const riskResults: EmployeeRisk[] = [];

      for (const emp of employees) {
        const factors: RiskFactor[] = [];
        let totalScore = 0;

        // Factor 1: Low evaluation score (30%)
        const empAvaliacoes = avaliacoes.filter(a => a.employee_id === emp.id && a.nota_final);
        if (empAvaliacoes.length > 0) {
          const avgNota = empAvaliacoes.reduce((sum, a) => sum + (a.nota_final || 0), 0) / empAvaliacoes.length;
          if (avgNota < 5) {
            const evalScore = Math.min(30, (5 - avgNota) * 6);
            totalScore += evalScore;
            factors.push({
              factor: "Avaliação baixa",
              score: evalScore,
              detail: `Média: ${avgNota.toFixed(1)}/10`
            });
          }
        }

        // Factor 2: Unjustified absences (20%)
        const empFaltas = faltas.filter(f => f.employee_id === emp.id && !f.justificada);
        if (empFaltas.length > 0) {
          const faltaScore = Math.min(20, empFaltas.length * 4);
          totalScore += faltaScore;
          factors.push({
            factor: "Faltas não justificadas",
            score: faltaScore,
            detail: `${empFaltas.length} falta(s) nos últimos 90 dias`
          });
        }

        // Factor 3: Pending TACs (20%)
        const empTacs = tacs.filter(t => t.employee_id === emp.id && t.status === 'pendente');
        if (empTacs.length > 0) {
          const tacScore = Math.min(20, empTacs.length * 10);
          totalScore += tacScore;
          factors.push({
            factor: "TACs pendentes",
            score: tacScore,
            detail: `${empTacs.length} TAC(s) pendente(s)`
          });
        }

        // Factor 4: Low engagement - no logins (15%)
        const empLogins = logins.filter(l => l.employee_id === emp.id);
        if (empLogins.length === 0) {
          totalScore += 15;
          factors.push({
            factor: "Baixo engajamento",
            score: 15,
            detail: "Nenhum login nos últimos 30 dias"
          });
        }

        // Factor 5: Pending mandatory training (15%)
        const empCertificados = certificados.filter(c => c.employee_id === emp.id);
        const completedCursos = new Set(empCertificados.map(c => c.curso_id));
        const pendingCursos = cursos.filter(c => !completedCursos.has(c.id));
        if (pendingCursos.length > 0) {
          const trainScore = Math.min(15, pendingCursos.length * 5);
          totalScore += trainScore;
          factors.push({
            factor: "Treinamentos pendentes",
            score: trainScore,
            detail: `${pendingCursos.length} curso(s) obrigatório(s) pendente(s)`
          });
        }

        // Only include employees with some risk
        if (totalScore > 20) {
          const riskLevel = totalScore >= 70 ? "alto" : totalScore >= 40 ? "medio" : "baixo";
          
          riskResults.push({
            employee_id: emp.id,
            nome: emp.nome_completo,
            cargo: emp.cargo,
            setor: emp.setor || "Não definido",
            score: Math.round(totalScore),
            risk_level: riskLevel,
            factors
          });
        }
      }

      // Sort by risk score descending
      riskResults.sort((a, b) => b.score - a.score);

      // Generate AI suggestions for high-risk employees
      const highRiskEmployees = riskResults.filter(r => r.risk_level === "alto").slice(0, 5);
      
      if (highRiskEmployees.length > 0) {
        const suggestionPrompt = `Para cada funcionário de alto risco de turnover abaixo, sugira UMA ação preventiva específica e prática (máximo 15 palavras cada):

${highRiskEmployees.map((e, i) => `${i + 1}. ${e.nome} - Fatores: ${e.factors.map(f => f.factor).join(", ")}`).join("\n")}

Responda apenas com as sugestões numeradas, uma por linha.`;

        try {
          const aiResponse = await fetch(getAiUrl(), {
            method: "POST",
            headers: getAiHeaders(),
            body: JSON.stringify({
              model: aiModel,
              messages: [{ role: "user", content: suggestionPrompt }],
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const suggestions = aiData.choices?.[0]?.message?.content?.split("\n").filter((s: string) => s.trim());
            
            highRiskEmployees.forEach((emp, idx) => {
              if (suggestions?.[idx]) {
                const suggestion = suggestions[idx].replace(/^\d+\.\s*/, "").trim();
                const resultIdx = riskResults.findIndex(r => r.employee_id === emp.employee_id);
                if (resultIdx !== -1) {
                  riskResults[resultIdx].suggestion = suggestion;
                }
              }
            });
          }
        } catch (e) {
          console.error("Error generating suggestions:", e);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        data: riskResults,
        summary: {
          total: riskResults.length,
          alto: riskResults.filter(r => r.risk_level === "alto").length,
          medio: riskResults.filter(r => r.risk_level === "medio").length,
          baixo: riskResults.filter(r => r.risk_level === "baixo").length
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (type === "promotion") {
      // Calculate promotion candidates
      const candidates: PromotionCandidate[] = [];

      for (const emp of employees) {
        const factors: string[] = [];
        let score = 0;

        // Factor 1: High evaluation score (>=8)
        const empAvaliacoes = avaliacoes.filter(a => a.employee_id === emp.id && a.nota_final);
        if (empAvaliacoes.length > 0) {
          const avgNota = empAvaliacoes.reduce((sum, a) => sum + (a.nota_final || 0), 0) / empAvaliacoes.length;
          if (avgNota >= 8) {
            score += 30;
            factors.push(`Avaliação excelente: ${avgNota.toFixed(1)}/10`);
          }
        }

        // Factor 2: Time at company (>1 year)
        if (emp.data_admissao) {
          const admissao = new Date(emp.data_admissao);
          const yearsAtCompany = (today.getTime() - admissao.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
          if (yearsAtCompany >= 1) {
            score += 20;
            factors.push(`${yearsAtCompany.toFixed(1)} anos na empresa`);
          }
        }

        // Factor 3: Completed training
        const empCertificados = certificados.filter(c => c.employee_id === emp.id);
        if (empCertificados.length >= 2) {
          score += 20;
          factors.push(`${empCertificados.length} cursos concluídos`);
        }

        // Factor 4: No recent TACs
        const empTacs = tacs.filter(t => t.employee_id === emp.id);
        if (empTacs.length === 0) {
          score += 15;
          factors.push("Sem TACs nos últimos 90 dias");
        }

        // Factor 5: Good attendance
        const empFaltas = faltas.filter(f => f.employee_id === emp.id && !f.justificada);
        if (empFaltas.length === 0) {
          score += 15;
          factors.push("Sem faltas não justificadas");
        }

        if (score >= 50) {
          candidates.push({
            employee_id: emp.id,
            nome: emp.nome_completo,
            cargo: emp.cargo,
            setor: emp.setor || "Não definido",
            score,
            factors
          });
        }
      }

      candidates.sort((a, b) => b.score - a.score);

      return new Response(JSON.stringify({
        success: true,
        data: candidates,
        total: candidates.length
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Tipo de predição inválido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("AI Predictions error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
