// Acesso direto à API do Google Drive (substitui o conector da Lovable).
// Secrets: GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.
// A autorização da conta Google vem do botão "Conectar Google Drive" (tabela google_drive_conexao);
// opcionalmente, GOOGLE_DRIVE_REFRESH_TOKEN nos secrets tem prioridade.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const DRIVE_BASE = "https://www.googleapis.com";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getRefreshToken(): Promise<string | null> {
  const fromEnv = Deno.env.get("GOOGLE_DRIVE_REFRESH_TOKEN");
  if (fromEnv) return fromEnv;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data } = await admin.from("google_drive_conexao").select("refresh_token").eq("id", 1).maybeSingle();
  return data?.refresh_token ?? null;
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Google Drive não configurado: cadastre GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET nos secrets do Supabase");
  }
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    throw new Error("Google Drive não conectado: clique em Conectar Google Drive em Configurações");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(`Falha ao autenticar no Google Drive: ${json.error_description || json.error || res.status}`);
  }
  cachedToken = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

export async function driveHeaders(): Promise<Record<string, string>> {
  return { Authorization: `Bearer ${await getAccessToken()}` };
}
