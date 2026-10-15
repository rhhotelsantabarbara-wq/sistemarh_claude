import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const OAUTH_REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-calendar-auth?action=oauth_callback`;
const STATE_TTL_MS = 15 * 60 * 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get user from authorization header
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    if (action === "init") {
      if (!userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const body = await req.json();
      let appRedirect: URL;
      try {
        appRedirect = new URL(String(body.redirectUri));
        if (!["https:", "http:"].includes(appRedirect.protocol)) throw new Error("protocolo inválido");
      } catch {
        return new Response(JSON.stringify({ error: "redirectUri inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Estado aleatório guardado no banco (mesma tabela usada pelo Drive), ligado ao usuário logado
      const state = crypto.randomUUID();
      await supabase.from("google_drive_oauth_states").delete()
        .lt("criado_em", new Date(Date.now() - STATE_TTL_MS).toISOString());
      const { error: stateError } = await supabase.from("google_drive_oauth_states")
        .insert({ state, user_id: userId, retorno: appRedirect.toString() });
      if (stateError) throw stateError;

      const authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        redirect_uri: OAUTH_REDIRECT_URI,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly",
        access_type: "offline",
        prompt: "consent",
        state,
      }).toString();

      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Retorno do Google (redirecionamento do navegador): troca o código pelos tokens aqui mesmo
    // e devolve o usuário ao sistema com HTTP 302 (o Supabase não exibe respostas HTML das funções).
    if (action === "oauth_callback") {
      const texto = (msg: string, status = 400) =>
        new Response(msg, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

      const stateParam = url.searchParams.get("state");
      if (!stateParam) return texto("Parâmetros ausentes. Volte ao sistema e tente conectar novamente.");

      const { data: st } = await supabase.from("google_drive_oauth_states")
        .select("*").eq("state", stateParam).maybeSingle();
      if (!st) return texto("Solicitação expirada. Volte ao sistema e clique em Conectar novamente.");
      await supabase.from("google_drive_oauth_states").delete().eq("state", stateParam);

      const destino = new URL(st.retorno);
      destino.searchParams.delete("code");
      const voltar = (params: Record<string, string>) => {
        for (const [k, v] of Object.entries(params)) destino.searchParams.set(k, v);
        return new Response(null, { status: 302, headers: { Location: destino.toString() } });
      };

      if (Date.now() - new Date(st.criado_em).getTime() > STATE_TTL_MS) {
        return voltar({ google_calendar: "erro", motivo: "Tempo esgotado, tente novamente" });
      }
      const googleError = url.searchParams.get("error");
      if (googleError) return voltar({ google_calendar: "erro", motivo: googleError });
      const code = url.searchParams.get("code");
      if (!code) return voltar({ google_calendar: "erro", motivo: "missing_params" });

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID!,
          client_secret: GOOGLE_CLIENT_SECRET!,
          redirect_uri: OAUTH_REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });
      const tokens = await tokenResponse.json();
      if (tokens.error || !tokens.access_token) {
        console.error("Token error:", tokens);
        return voltar({ google_calendar: "erro", motivo: tokens.error_description || tokens.error || "token" });
      }

      const { error: dbError } = await supabase.from("google_calendar_tokens").upsert({
        user_id: st.user_id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      }, { onConflict: "user_id" });
      if (dbError) {
        console.error("DB error:", dbError);
        return voltar({ google_calendar: "erro", motivo: "Falha ao salvar a conexão" });
      }

      return voltar({ google_calendar: "conectado" });
    }

    if (action === "callback") {
      // Exchange code for tokens
      const body = await req.json();
      const { code } = body;

      if (!userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Use the edge function URL as redirect_uri (must match what was used in auth URL)

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID!,
          client_secret: GOOGLE_CLIENT_SECRET!,
          redirect_uri: OAUTH_REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });

      const tokens = await tokenResponse.json();

      if (tokens.error) {
        console.error("Token error:", tokens);
        return new Response(JSON.stringify({ error: tokens.error_description || tokens.error }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Calculate expiry time
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Upsert tokens in database
      const { error: dbError } = await supabase
        .from("google_calendar_tokens")
        .upsert({
          user_id: userId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
        }, { onConflict: "user_id" });

      if (dbError) {
        console.error("DB error:", dbError);
        return new Response(JSON.stringify({ error: "Failed to save tokens" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      if (!userId) {
        return new Response(JSON.stringify({ connected: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: tokenData } = await supabase
        .from("google_calendar_tokens")
        .select("*")
        .eq("user_id", userId)
        .single();

      return new Response(JSON.stringify({ 
        connected: !!tokenData,
        expiresAt: tokenData?.expires_at 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "disconnect") {
      if (!userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase
        .from("google_calendar_tokens")
        .delete()
        .eq("user_id", userId);

      if (error) {
        return new Response(JSON.stringify({ error: "Failed to disconnect" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "refresh") {
      if (!userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: tokenData } = await supabase
        .from("google_calendar_tokens")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!tokenData?.refresh_token) {
        return new Response(JSON.stringify({ error: "No refresh token" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID!,
          client_secret: GOOGLE_CLIENT_SECRET!,
          refresh_token: tokenData.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      const tokens = await tokenResponse.json();

      if (tokens.error) {
        console.error("Refresh error:", tokens);
        return new Response(JSON.stringify({ error: tokens.error_description || tokens.error }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      await supabase
        .from("google_calendar_tokens")
        .update({
          access_token: tokens.access_token,
          expires_at: expiresAt,
        })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ 
        access_token: tokens.access_token,
        expires_at: expiresAt 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
