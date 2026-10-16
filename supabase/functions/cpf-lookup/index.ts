// Consulta de dados básicos por CPF (nome, data de nascimento e sexo) via CPFHub.io.
// Secret: CPFHUB_API_KEY (plano gratuito: 50 consultas/mês).
// Só gestores e administradores parciais podem consultar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Erros voltam com status 200 + campo error, para a tela exibir a mensagem
const responder = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (base: string, pesoInicial: number) => {
    const soma = base.split("").reduce((acc, n, i) => acc + Number(n) * (pesoInicial - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(cpf.slice(0, 9), 10) === Number(cpf[9]) && digito(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

function paraISO(data?: string | null): string | null {
  if (!data) return null;
  const br = data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = data.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

function paraSexo(g?: string | null): string | null {
  const v = (g || "").toString().trim().toUpperCase();
  if (v.startsWith("M")) return "Masculino";
  if (v.startsWith("F")) return "Feminino";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
    if (!user) return responder({ error: "Não autorizado" });
    const { data: papeis } = await supabase.from("user_roles").select("role").eq("user_id", user.id).in("role", ["gestor", "admin_parcial"]);
    if (!papeis || papeis.length === 0) return responder({ error: "Sem permissão para consultar CPF" });

    const { cpf } = await req.json();
    const cpfLimpo = String(cpf || "").replace(/\D/g, "");
    if (cpfLimpo.length !== 11) return responder({ error: "CPF deve ter 11 dígitos" });
    if (!cpfValido(cpfLimpo)) return responder({ error: "CPF inválido: confira os números digitados" });

    const apiKey = Deno.env.get("CPFHUB_API_KEY");
    if (!apiKey) {
      return responder({
        error: "Consulta de CPF não configurada: crie uma conta grátis em cpfhub.io e cadastre a chave como CPFHUB_API_KEY nos secrets do Supabase.",
      });
    }

    const resposta = await fetch(`https://api.cpfhub.io/cpf/${cpfLimpo}`, {
      headers: { "x-api-key": apiKey, Accept: "application/json" },
    });
    const json = await resposta.json().catch(() => ({}));

    if (!resposta.ok || json?.success === false) {
      console.error(`CPFHub ${resposta.status}:`, JSON.stringify(json).slice(0, 300));
      if (resposta.status === 404) return responder({ error: "CPF não encontrado na base do CPFHub" });
      if (resposta.status === 401 || resposta.status === 403) return responder({ error: "Chave do CPFHub inválida. Confira o secret CPFHUB_API_KEY." });
      if (resposta.status === 429) return responder({ error: "Limite de consultas grátis do CPFHub atingido neste mês." });
      return responder({ error: json?.message || `Erro na consulta ao CPFHub (${resposta.status})` });
    }

    // O CPFHub devolve os dados dentro de "data"; aceita também o formato plano
    const d = json?.data ?? json;
    const dados = {
      nome_completo: d.name || d.nome || d.nome_completo || null,
      data_nascimento: paraISO(d.birthDate || d.data_nascimento || d.nascimento),
      sexo: paraSexo(d.gender || d.sexo || d.genero),
    };
    return responder({ success: true, dados });
  } catch (error) {
    console.error("cpf-lookup:", error);
    return responder({ error: "Erro interno ao consultar CPF" });
  }
});
