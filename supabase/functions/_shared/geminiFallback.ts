// Proteção para chamadas ao Gemini (importe uma vez no topo da função: import "../_shared/geminiFallback.ts").
// - Troca modelos descontinuados (gemini-1.x / 2.x) pelo modelo atual.
// - Se o Google responder 404 (modelo indisponível), 429 (limite) ou 503 (sobrecarga),
//   tenta automaticamente os próximos modelos da lista.
// Funciona para o endpoint compatível com OpenAI (modelo no corpo) e para o nativo (modelo na URL).
// - Se TODOS os modelos do Gemini estiverem esgotados, as conversas (endpoint compatível com OpenAI)
//   passam para a reserva gratuita do Groq, quando o secret GROQ_API_KEY existir.
//   Modelo opcional: secret GROQ_MODELO (padrão llama-3.3-70b-versatile).
//   Depois de esgotar, o Gemini fica 10 minutos em descanso e as chamadas vão direto para o Groq.

export const GEMINI_PADRAO = "gemini-3.5-flash";
const RESERVAS = ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
const DESCONTINUADO = /^gemini-(1|2)(\.|-)/;
const STATUS_TROCA = new Set([404, 429, 503]);

export function modeloGemini(modelo?: string | null): string {
  if (!modelo || !modelo.startsWith("gemini")) return GEMINI_PADRAO;
  return DESCONTINUADO.test(modelo) ? GEMINI_PADRAO : modelo;
}

function cadeia(modelo: string): string[] {
  const principal = modeloGemini(modelo);
  return [principal, ...RESERVAS.filter((m) => m !== principal)];
}

const fetchOriginal = globalThis.fetch.bind(globalThis);
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DESCANSO_MS = 10 * 60 * 1000;
let geminiEsgotadoAte = 0;

// Envia a mesma conversa para o Groq. Devolve null se não houver chave ou se o Groq também falhar.
async function tentarGroq(corpo: any, init?: RequestInit): Promise<Response | null> {
  const chave = Deno.env.get("GROQ_API_KEY");
  if (!chave || !corpo) return null;
  const modelo = Deno.env.get("GROQ_MODELO") || "llama-3.3-70b-versatile";
  // Remove campos que só o Gemini entende
  const { extra_body, reasoning_effort, ...resto } = corpo;
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${chave}`);
  headers.set("Content-Type", "application/json");
  const resposta = await fetchOriginal(GROQ_URL, {
    ...init,
    headers,
    body: JSON.stringify({ ...resto, model: modelo }),
  });
  if (resposta.ok) {
    console.warn(`IA: Gemini esgotado, resposta dada pela reserva Groq (${modelo})`);
    return resposta;
  }
  console.error(`Groq respondeu ${resposta.status}:`, (await resposta.text().catch(() => "")).slice(0, 300));
  return null;
}
const MARCA = Symbol.for("geminiFallbackInstalado");

if (!(globalThis as any)[MARCA]) {
  (globalThis as any)[MARCA] = true;

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (!url.includes("generativelanguage.googleapis.com") || typeof input !== "string" && !(input instanceof URL)) {
      return fetchOriginal(input, init);
    }

    const corpoTexto = typeof init?.body === "string" ? init.body : null;
    let corpo: any = null;
    if (corpoTexto) { try { corpo = JSON.parse(corpoTexto); } catch { corpo = null; } }

    const noCorpo = corpo && typeof corpo.model === "string" && corpo.model.startsWith("gemini");
    const naUrl = url.match(/\/models\/([^/:?]+):/);
    const modeloAtual = noCorpo ? corpo.model : naUrl ? naUrl[1] : null;
    if (!modeloAtual || !modeloAtual.startsWith("gemini")) return fetchOriginal(input, init);

    // Conversa no formato OpenAI: pode cair para o Groq
    const podeReserva = noCorpo && url.includes("/openai/");

    if (podeReserva && Date.now() < geminiEsgotadoAte) {
      const reserva = await tentarGroq(corpo, init);
      if (reserva) return reserva;
    }

    let resposta: Response | null = null;
    let ultimoStatus = 0;
    for (const modelo of cadeia(modeloAtual)) {
      const novaUrl = naUrl ? url.replace(`/models/${naUrl[1]}:`, `/models/${modelo}:`) : url;
      const novoInit = noCorpo ? { ...init, body: JSON.stringify({ ...corpo, model: modelo }) } : init;
      resposta = await fetchOriginal(novaUrl, novoInit);
      if (!STATUS_TROCA.has(resposta.status)) {
        if (resposta.ok) geminiEsgotadoAte = 0;
        return resposta;
      }
      ultimoStatus = resposta.status;
      console.warn(`Gemini ${modelo} respondeu ${resposta.status}; tentando o próximo modelo`);
      await resposta.body?.cancel().catch(() => {});
    }
    // Todos os modelos do Gemini falharam por limite/sobrecarga: tenta a reserva
    if (podeReserva && (ultimoStatus === 429 || ultimoStatus === 503)) {
      geminiEsgotadoAte = Date.now() + DESCANSO_MS;
      const reserva = await tentarGroq(corpo, init);
      if (reserva) return reserva;
    }
    // Nada funcionou: refaz a última para devolver a resposta de erro legível
    const ultimo = cadeia(modeloAtual).at(-1)!;
    return fetchOriginal(
      naUrl ? url.replace(`/models/${naUrl[1]}:`, `/models/${ultimo}:`) : url,
      noCorpo ? { ...init, body: JSON.stringify({ ...corpo, model: ultimo }) } : init,
    );
  };
}
