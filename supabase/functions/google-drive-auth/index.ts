// Conecta a conta Google da empresa ao backup do Drive (fluxo OAuth próprio).
// POST (gestor logado): { action: "init", retorno } -> { authUrl }
//                       { action: "disconnect" }
// GET (redirecionamento do Google): ?code=...&state=...  -> salva o refresh token e volta ao sistema
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-drive-auth`;
const SCOPE = "https://www.googleapis.com/auth/drive openid email profile";
const STATE_TTL_MS = 15 * 60 * 1000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function voltar(retorno: string, params: Record<string, string>) {
  let destino: URL;
  try { destino = new URL(retorno); } catch { return new Response("Retorno inválido", { status: 400 }); }
  for (const [k, v] of Object.entries(params)) destino.searchParams.set(k, v);
  return new Response(null, { status: 302, headers: { Location: destino.toString() } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ---------- Retorno do Google ----------
  if (req.method === "GET") {
    const url = new URL(req.url);
    const state = url.searchParams.get("state");
    if (!state) return new Response("Parâmetros ausentes", { status: 400 });

    const { data: st } = await admin.from("google_drive_oauth_states").select("*").eq("state", state).maybeSingle();
    if (!st) return new Response("Solicitação expirada. Volte ao sistema e clique em Conectar novamente.", { status: 400 });
    await admin.from("google_drive_oauth_states").delete().eq("state", state);

    if (Date.now() - new Date(st.criado_em).getTime() > STATE_TTL_MS) {
      return voltar(st.retorno, { drive: "erro", motivo: "Tempo esgotado, tente novamente" });
    }
    const erroGoogle = url.searchParams.get("error");
    if (erroGoogle) return voltar(st.retorno, { drive: "erro", motivo: erroGoogle });

    const code = url.searchParams.get("code");
    if (!code || !CLIENT_ID || !CLIENT_SECRET) {
      return voltar(st.retorno, { drive: "erro", motivo: "Configuração do Google incompleta" });
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI, grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok || !tokens.refresh_token) {
      console.error("Erro ao trocar código:", tokens);
      return voltar(st.retorno, { drive: "erro", motivo: tokens.error_description || tokens.error || "Google não devolveu autorização permanente" });
    }

    let email: string | null = null, nome: string | null = null;
    const about = await fetch("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,displayName)", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (about.ok) {
      const a = await about.json();
      email = a.user?.emailAddress ?? null;
      nome = a.user?.displayName ?? null;
    }

    const { error } = await admin.from("google_drive_conexao").upsert({
      id: 1, refresh_token: tokens.refresh_token, email, nome,
      conectado_por: st.user_id, conectado_em: new Date().toISOString(),
    });
    if (error) return voltar(st.retorno, { drive: "erro", motivo: "Falha ao salvar a conexão" });

    return voltar(st.retorno, { drive: "conectado" });
  }

  // ---------- Ações do sistema (gestor logado) ----------
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ error: "Não autorizado" }, 401);
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: "Sessão inválida" }, 401);
    const { data: papel } = await admin.from("user_roles").select("role")
      .eq("user_id", user.id).eq("role", "gestor").maybeSingle();
    if (!papel) return json({ error: "Apenas gestores podem conectar o Google Drive" }, 403);

    const body = await req.json().catch(() => ({}));

    if (body.action === "init") {
      if (!CLIENT_ID || !CLIENT_SECRET) {
        return json({ error: "Cadastre GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET nos secrets do Supabase" }, 400);
      }
      let retorno: URL;
      try { retorno = new URL(String(body.retorno)); } catch { return json({ error: "Endereço de retorno inválido" }, 400); }
      if (!["https:", "http:"].includes(retorno.protocol)) return json({ error: "Endereço de retorno inválido" }, 400);

      const state = crypto.randomUUID();
      await admin.from("google_drive_oauth_states").delete().lt("criado_em", new Date(Date.now() - STATE_TTL_MS).toISOString());
      const { error } = await admin.from("google_drive_oauth_states").insert({ state, user_id: user.id, retorno: retorno.toString() });
      if (error) throw error;

      const authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
        client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, response_type: "code",
        scope: SCOPE, access_type: "offline", prompt: "consent", state,
      }).toString();
      return json({ authUrl });
    }

    if (body.action === "disconnect") {
      const { data: con } = await admin.from("google_drive_conexao").select("refresh_token").eq("id", 1).maybeSingle();
      if (con?.refresh_token) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(con.refresh_token)}`, { method: "POST" }).catch(() => {});
      }
      await admin.from("google_drive_conexao").delete().eq("id", 1);
      return json({ success: true });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
