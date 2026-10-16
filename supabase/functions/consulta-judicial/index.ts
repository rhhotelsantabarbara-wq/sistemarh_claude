// Consulta judicial automática e gratuita via Tavily (busca na web feita para sistemas).
// Pesquisa o nome exato do colaborador no JusBrasil e no Escavador, filtra os resultados
// que citam o nome completo, extrai números de processo no padrão CNJ e identifica o tribunal.
// O gestor confirma na tela se cada resultado é mesmo do colaborador (homônimos são comuns).
//
// Secret necessário: TAVILY_API_KEY (plano gratuito: 1.000 buscas/mês, sem cartão).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Erros "esperados" voltam com status 200 + campo error, para a tela conseguir exibir a mensagem
const responder = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// Ordem oficial dos códigos de tribunal estadual (segmento 8) na numeração CNJ
const UF_TJ = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SE", "SP", "TO"];

function tribunalDoNumero(numero: string): string {
  const m = numero.match(/^\d{7}-\d{2}\.\d{4}\.(\d)\.(\d{2})\.\d{4}$/);
  if (!m) return "";
  const segmento = m[1];
  const tr = parseInt(m[2], 10);
  switch (segmento) {
    case "1": return "STF";
    case "3": return "STJ";
    case "4": return `TRF${tr}`;
    case "5": return tr === 0 ? "TST" : `TRT${tr}`;
    case "6": return `TRE-${UF_TJ[tr - 1] ?? tr}`;
    case "7": return "Justiça Militar da União";
    case "8": return `TJ${UF_TJ[tr - 1] ?? tr}`;
    case "9": return `TJM-${UF_TJ[tr - 1] ?? tr}`;
    default: return "";
  }
}

const REGEX_CNJ = /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/g;

interface ResultadoTavily { title?: string; url?: string; content?: string; score?: number }

async function buscarTavily(chave: string, query: string, dominios?: string[]): Promise<ResultadoTavily[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: 10,
      ...(dominios ? { include_domains: dominios } : {}),
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detalhe = json?.detail?.error || json?.detail || json?.error || res.status;
    if (res.status === 401) throw new Error("Chave do Tavily inválida. Confira o secret TAVILY_API_KEY no Supabase.");
    if (res.status === 429 || res.status === 432 || res.status === 433) {
      throw new Error("Limite de buscas grátis do Tavily atingido neste mês. Ele renova no início do próximo mês.");
    }
    throw new Error(`Busca falhou (Tavily): ${typeof detalhe === "string" ? detalhe : JSON.stringify(detalhe)}`);
  }
  return Array.isArray(json.results) ? json.results : [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Somente gestores
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
    if (!user) return responder({ error: "Não autorizado" });
    const { data: papel } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "gestor").maybeSingle();
    if (!papel) return responder({ error: "Apenas gestores podem fazer consultas judiciais" });

    const chave = Deno.env.get("TAVILY_API_KEY");
    if (!chave) {
      return responder({
        error: "Busca automática não configurada: crie uma conta grátis em tavily.com e cadastre a chave como TAVILY_API_KEY nos secrets do Supabase (Edge Functions → Secrets).",
      });
    }

    const { employee_id, nome } = await req.json();
    if (!employee_id || !nome) return responder({ error: "Funcionário e nome são obrigatórios" });

    const nomeExato = String(nome).trim().replace(/\s+/g, " ");
    const nomeNorm = normalizar(nomeExato);

    // 1ª busca: sites de consulta processual. 2ª (só se a 1ª vier vazia): web em geral.
    const buscas: string[] = [];
    let brutos: ResultadoTavily[] = [];
    const q1 = `"${nomeExato}"`;
    buscas.push(`${q1} em jusbrasil.com.br / escavador.com`);
    brutos = await buscarTavily(chave, q1, ["jusbrasil.com.br", "escavador.com"]);
    if (brutos.length === 0) {
      const q2 = `"${nomeExato}" processo judicial`;
      buscas.push(q2);
      brutos = await buscarTavily(chave, q2);
    }

    // Mantém só resultados que citam o nome completo (sem acento/maiúscula), sem repetir URL
    const vistos = new Set<string>();
    const candidatos = brutos
      .filter((r) => r.url && !vistos.has(r.url) && vistos.add(r.url))
      .filter((r) => normalizar(`${r.title || ""} ${r.content || ""}`).includes(nomeNorm))
      .map((r) => {
        const texto = `${r.title || ""} ${r.content || ""} ${r.url || ""}`;
        const numeros = Array.from(new Set(texto.match(REGEX_CNJ) || []));
        return {
          titulo: (r.title || r.url || "").slice(0, 200),
          url: r.url,
          trecho: (r.content || "").slice(0, 400),
          numeros,
          tribunais: numeros.map(tribunalDoNumero), // alinhado com numeros (mesmo índice)
          revisao: null as null | "confirmado" | "descartado",
        };
      });

    const resumo = candidatos.length === 0
      ? "Nenhuma menção ao nome completo encontrada no JusBrasil, Escavador ou na web."
      : `${candidatos.length} resultado(s) citando o nome. Confira se é a mesma pessoa.`;

    const { data: salvo, error: insertError } = await supabase.from("consultas_judiciais").insert({
      employee_id,
      processos_encontrados: 0, // só conta depois que o gestor confirma
      resumo,
      consultado_por: user.id,
      resultado: { _provider: "tavily", candidatos, buscas, descartados_por_nome: brutos.length - candidatos.length },
    }).select().single();
    if (insertError) console.error("Erro ao salvar consulta:", insertError);

    return responder({ consulta: salvo, candidatos: candidatos.length, resumo });
  } catch (error) {
    console.error("Consulta judicial:", error);
    return responder({ error: (error as Error).message || "Erro desconhecido" });
  }
});
