import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "../_shared/geminiFallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatForWhatsApp(text: string): string {
  return text
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*(.*?)\*\*/g, "*$1*")
    .replace(/__(.*?)__/g, "_$1_")
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/```\w*\n?/g, "").trim())
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

async function fetchGlobalContext(supabase: any, today: string, tomorrow: string) {
  const [eventosRes, feriasRes, afastamentosRes, folgasRes, allEmployeesRes, checklistsRes, examesRes] = await Promise.all([
    supabase.from("eventos").select("*").is("whatsapp_phone", null).gte("data_inicio", `${today}T00:00:00`).lt("data_inicio", `${tomorrow}T00:00:00`).eq("concluido", false).order("data_inicio", { ascending: true }),
    supabase.from("ferias").select("*, employees(nome_completo, setor)").lte("periodo_gozo_inicio", today).gte("periodo_gozo_fim", today),
    supabase.from("afastamentos").select("*, employees(nome_completo, setor)").lte("data_inicio", today).gte("data_fim", today),
    supabase.from("folgas").select("*, employees(nome_completo, setor)").eq("data", today),
    supabase.from("employees").select("nome_completo, data_nascimento, setor").eq("status", "ativo"),
    supabase.from("plano_checklist_funcionario").select("*, employees(nome_completo)").in("status", ["pendente", "em_andamento"]),
    supabase.from("encaminhamentos_medicos").select("*, employees(nome_completo)").in("status", ["pendente", "agendado"]).lte("data_agendamento", today),
  ]);

  const eventos = eventosRes.data || [];
  const feriasHoje = feriasRes.data || [];
  const afastamentosHoje = afastamentosRes.data || [];
  const folgasHoje = folgasRes.data || [];
  const allEmployees = allEmployeesRes.data || [];
  const checklistsPendentes = checklistsRes.data || [];
  const examesPendentes = examesRes.data || [];

  const aniversariantes = allEmployees.filter((e: any) => {
    if (!e.data_nascimento) return false;
    const [, m, d] = e.data_nascimento.split("-");
    const [, tm, td] = today.split("-");
    return m === tm && d === td;
  });

  return `
EVENTOS GERAIS DO SISTEMA (${eventos.length}):
${eventos.map((e: any) => {
  const hora = e.data_inicio ? new Date(e.data_inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "sem horário";
  return `- ${hora} - ${e.titulo} ${e.local ? `(${e.local})` : ""} | Tipo: ${e.tipo || "geral"}`;
}).join("\n") || "Nenhum evento hoje."}

FUNCIONÁRIOS DE FÉRIAS HOJE (${feriasHoje.length}):
${feriasHoje.map((f: any) => `- ${f.employees?.nome_completo} (${f.employees?.setor || "N/A"}) até ${f.periodo_gozo_fim}`).join("\n") || "Nenhum"}

AFASTADOS HOJE (${afastamentosHoje.length}):
${afastamentosHoje.map((a: any) => `- ${a.employees?.nome_completo}: ${a.motivo}`).join("\n") || "Nenhum"}

FOLGAS HOJE (${folgasHoje.length}):
${folgasHoje.map((f: any) => `- ${f.employees?.nome_completo}: ${f.motivo}`).join("\n") || "Nenhum"}

ANIVERSARIANTES DO DIA (${aniversariantes.length}):
${aniversariantes.map((a: any) => `- ${a.nome_completo} (${a.setor || "N/A"})`).join("\n") || "Nenhum"}

CHECKLISTS PENDENTES (${checklistsPendentes.length}):
${checklistsPendentes.slice(0, 5).map((c: any) => `- ${c.employees?.nome_completo}: ${c.tipo}`).join("\n") || "Nenhum"}

EXAMES MÉDICOS PENDENTES PARA HOJE (${examesPendentes.length}):
${examesPendentes.slice(0, 5).map((e: any) => `- ${e.employees?.nome_completo}: ${e.tipo_exame}`).join("\n") || "Nenhum"}
`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Try to get API key and provider config from DB first, fallback to env
    let GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    let OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const { data: iaConfig } = await supabase.from("configuracoes_ia").select("google_gemini_api_key, openai_api_key, modelo, provedor").limit(1).maybeSingle();
    if (iaConfig?.google_gemini_api_key) {
      GOOGLE_GEMINI_API_KEY = iaConfig.google_gemini_api_key;
    }
    if ((iaConfig as any)?.openai_api_key) {
      OPENAI_API_KEY = (iaConfig as any).openai_api_key;
    }
    const provedor = (iaConfig as any)?.provedor || "gemini";
    const aiModel = iaConfig?.modelo || (provedor === "openai" ? "gpt-4o-mini" : "gemini-3.5-flash");

    // Determine API URL and key based on provider
    let aiApiUrl: string;
    let aiApiKey: string;
    if (provedor === "openai") {
      if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
      aiApiUrl = "https://api.openai.com/v1/chat/completions";
      aiApiKey = OPENAI_API_KEY;
    } else {
      if (!GOOGLE_GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY not configured");
      aiApiUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
      aiApiKey = GOOGLE_GEMINI_API_KEY;
    }

    const { data: config } = await supabase
      .from("configuracoes_whatsapp")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!config || !config.lembrete_ativo || !config.numero_lembrete) {
      return new Response(JSON.stringify({ status: "skipped", reason: "reminder not configured or disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { evolution_api_url, evolution_api_key, evolution_instance_name, numero_lembrete } = config;
    const numerosEventosGlobais = (config.numeros_eventos_globais || "").split(",").map((n: string) => n.trim()).filter((n: string) => n.length > 0);

    if (!evolution_api_url || !evolution_api_key || !evolution_instance_name) {
      throw new Error("Evolution API credentials not configured");
    }

    const numeros = numero_lembrete.split(",").map((n: string) => n.trim()).filter((n: string) => n.length > 0);

    if (numeros.length === 0) {
      return new Response(JSON.stringify({ status: "skipped", reason: "no reminder numbers configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Pre-fetch global context once (only used for global numbers)
    let globalContext = "";
    if (numerosEventosGlobais.length > 0) {
      globalContext = await fetchGlobalContext(supabase, today, tomorrow);
    }

    const results: { number: string; status: string; error?: string }[] = [];

    for (const numero of numeros) {
      try {
        const isGlobal = numerosEventosGlobais.includes(numero);

        // Fetch this person's personal events
        const { data: eventosDoUsuario } = await supabase
          .from("eventos")
          .select("*")
          .eq("whatsapp_phone", numero)
          .gte("data_inicio", `${today}T00:00:00`)
          .lt("data_inicio", `${tomorrow}T00:00:00`)
          .eq("concluido", false)
          .order("data_inicio", { ascending: true });

        // Conversation history for context
        const { data: history } = await supabase
          .from("whatsapp_conversas")
          .select("role, content")
          .eq("phone_number", numero)
          .order("created_at", { ascending: false })
          .limit(10);

        const historyContext = (history || []).length > 0
          ? `\n\nHISTÓRICO RECENTE DE CONVERSAS (para contexto):\n${(history || []).reverse().map((h: any) => `${h.role === "user" ? "Usuário" : "Assistente"}: ${h.content.substring(0, 200)}`).join("\n")}`
          : "";

        const personalEventsText = `
COMPROMISSOS PESSOAIS DE HOJE (${(eventosDoUsuario || []).length}):
${(eventosDoUsuario || []).map((e: any) => {
  const hora = e.data_inicio ? new Date(e.data_inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "sem horário";
  return `- ${hora} - ${e.titulo} ${e.local ? `(${e.local})` : ""} | Tipo: ${e.tipo || "geral"}`;
}).join("\n") || "Nenhum compromisso pessoal hoje."}
`;

        let context: string;
        let instructions: string;

        if (isGlobal) {
          // Global numbers get EVERYTHING: personal events + full system overview
          context = `DADOS PARA LEMBRETE MATINAL COMPLETO (${today}):\nDESTINATÁRIO: ${numero}\n${personalEventsText}\n${globalContext}`;
          instructions = `Você é um assistente de RH inteligente enviando o lembrete matinal diário via WhatsApp.

INSTRUÇÕES:
- Comece com uma saudação amigável (Bom dia! 🌅)
- Resuma os compromissos PESSOAIS do usuário primeiro
- Depois apresente o panorama COMPLETO do dia: eventos gerais, quem está ausente (férias/afastamento/folga), aniversariantes, pendências
- Use formatação WhatsApp: *negrito*, _itálico_, listas com - ou emojis
- Seja conciso mas completo
- Máximo 2000 caracteres
- Se não houver nada relevante, envie uma mensagem curta positiva`;
        } else {
          // Non-global numbers get ONLY their personal events
          context = `DADOS PARA LEMBRETE MATINAL PESSOAL (${today}):\nDESTINATÁRIO: ${numero}\n${personalEventsText}`;
          instructions = `Você é um assistente de RH inteligente enviando o lembrete matinal diário via WhatsApp.

INSTRUÇÕES:
- Comece com uma saudação amigável (Bom dia! 🌅)
- Foque EXCLUSIVAMENTE nos compromissos PESSOAIS desta pessoa
- NÃO inclua informações de outros funcionários, férias, afastamentos etc.
- Use formatação WhatsApp: *negrito*, _itálico_, listas com - ou emojis
- Seja conciso e direto
- Máximo 1500 caracteres
- Se não houver nenhum compromisso, envie uma mensagem curta positiva desejando um bom dia`;
        }

        const systemPrompt = `${instructions}\n${historyContext}\n\n${context}`;

        const aiResponse = await fetch(aiApiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${aiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: aiModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: "Gere o lembrete matinal de hoje." },
            ],
            stream: false,
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          throw new Error(`AI error: ${aiResponse.status} - ${errorText}`);
        }

        const aiData = await aiResponse.json();
        const aiText = aiData.choices?.[0]?.message?.content || "Bom dia! Não há compromissos para hoje. 🌟";
        const formattedText = formatForWhatsApp(aiText);

        const sendUrl = `${evolution_api_url.replace(/\/$/, "")}/message/sendText/${evolution_instance_name}`;
        const sendResponse = await fetch(sendUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: evolution_api_key,
          },
          body: JSON.stringify({
            number: numero,
            text: formattedText,
          }),
        });

        if (!sendResponse.ok) {
          const sendError = await sendResponse.text();
          throw new Error(`Failed to send: ${sendResponse.status} - ${sendError}`);
        }

        await supabase.from("whatsapp_conversas").insert([
          { phone_number: numero, role: "assistant", content: formattedText },
        ]);

        console.log(`Daily reminder sent to ${numero} (global: ${isGlobal})`);
        results.push({ number: numero, status: "ok" });
      } catch (numError) {
        console.error(`Error sending reminder to ${numero}:`, numError);
        results.push({ number: numero, status: "error", error: numError instanceof Error ? numError.message : "Unknown error" });
      }
    }

    return new Response(JSON.stringify({ status: "ok", results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Daily reminder error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
