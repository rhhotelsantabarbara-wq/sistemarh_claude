// Proteção para chamadas ao Gemini (importe uma vez no topo da função: import "../_shared/geminiFallback.ts").
// - Troca modelos descontinuados (gemini-1.x / 2.x) pelo modelo atual.
// - Se o Google responder 404 (modelo indisponível), 429 (limite) ou 503 (sobrecarga),
//   tenta automaticamente os próximos modelos da lista.
// Funciona para o endpoint compatível com OpenAI (modelo no corpo) e para o nativo (modelo na URL).

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

    let resposta: Response | null = null;
    for (const modelo of cadeia(modeloAtual)) {
      const novaUrl = naUrl ? url.replace(`/models/${naUrl[1]}:`, `/models/${modelo}:`) : url;
      const novoInit = noCorpo ? { ...init, body: JSON.stringify({ ...corpo, model: modelo }) } : init;
      resposta = await fetchOriginal(novaUrl, novoInit);
      if (!STATUS_TROCA.has(resposta.status)) return resposta;
      console.warn(`Gemini ${modelo} respondeu ${resposta.status}; tentando o próximo modelo`);
      await resposta.body?.cancel().catch(() => {});
    }
    // Todos falharam: refaz a última para devolver a resposta de erro legível
    const ultimo = cadeia(modeloAtual).at(-1)!;
    return fetchOriginal(
      naUrl ? url.replace(`/models/${naUrl[1]}:`, `/models/${ultimo}:`) : url,
      noCorpo ? { ...init, body: JSON.stringify({ ...corpo, model: ultimo }) } : init,
    );
  };
}
