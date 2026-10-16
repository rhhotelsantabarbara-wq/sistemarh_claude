// Verificação de login e papel para edge functions que usam a chave de serviço.
// Uso:
//   const acesso = await exigirPapel(req, ["gestor"]);
//   if (acesso.resposta) return acesso.resposta;
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function clienteServico() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function papeisDoUsuario(userId: string): Promise<string[]> {
  const { data } = await clienteServico().from("user_roles").select("role").eq("user_id", userId);
  return (data || []).map((r: any) => r.role);
}

export async function exigirPapel(
  req: Request,
  permitidos: string[],
): Promise<{ resposta?: Response; userId?: string; papeis: string[] }> {
  const negar = (msg: string, status: number) => ({
    resposta: new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }),
    papeis: [] as string[],
  });

  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return negar("Não autorizado", 401);
  const { data: { user } } = await clienteServico().auth.getUser(token);
  if (!user) return negar("Sessão inválida ou expirada", 401);

  const papeis = await papeisDoUsuario(user.id);
  if (!papeis.some((p) => permitidos.includes(p))) return negar("Você não tem permissão para esta ação", 403);
  return { userId: user.id, papeis };
}
