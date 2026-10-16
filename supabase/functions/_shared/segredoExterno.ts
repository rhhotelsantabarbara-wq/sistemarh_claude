// Proteção opcional para funções chamadas de fora do sistema (webhook do WhatsApp e agendamentos).
// Só passa a valer quando o secret correspondente existe no Supabase; sem ele, nada muda.
//   WHATSAPP_WEBHOOK_TOKEN → o webhook precisa vir com ?token=<valor> na URL
//   CRON_SECRET            → os agendamentos precisam mandar o cabeçalho x-cron-secret: <valor>

function comparar(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const negar = () =>
  new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { "Content-Type": "application/json" } });

export function exigirTokenWebhook(req: Request): Response | null {
  const esperado = Deno.env.get("WHATSAPP_WEBHOOK_TOKEN");
  if (!esperado) return null;
  const recebido = new URL(req.url).searchParams.get("token") || req.headers.get("x-webhook-token") || "";
  return comparar(recebido, esperado) ? null : negar();
}

export function exigirSegredoCron(req: Request): Response | null {
  const esperado = Deno.env.get("CRON_SECRET");
  if (!esperado) return null;
  const recebido = req.headers.get("x-cron-secret") || "";
  return comparar(recebido, esperado) ? null : negar();
}
