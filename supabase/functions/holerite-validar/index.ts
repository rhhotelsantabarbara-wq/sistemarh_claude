// Endpoint público: valida um holerite assinado a partir do protocolo.
// Retorna apenas dados básicos (sem CPF completo, sem links de download).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function maskCpf(cpf: string | null) {
  if (!cpf) return null;
  const c = cpf.replace(/\D/g, "");
  if (c.length < 11) return "***";
  return `***.${c.slice(3, 6)}.${c.slice(6, 9)}-**`;
}
function maskNome(nome: string | null) {
  if (!nome) return null;
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts.slice(1).map((p) => p[0] + ".").join(" ")}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    let protocolo = url.searchParams.get("protocolo");
    if (!protocolo && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      protocolo = body.protocolo;
    }
    if (!protocolo) {
      return new Response(JSON.stringify({ valido: false, erro: "Protocolo ausente" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await supa
      .from("holerite_assinaturas")
      .select(
        "protocolo, hash_documento, hash_assinatura, nome_completo, cpf, data_assinatura, status, empresas:empresa_id(nome, cnpj), folha:folha_pagamento_id(mes, ano)",
      )
      .eq("protocolo", protocolo)
      .eq("status", "assinado")
      .maybeSingle();

    if (!error && !data) {
      // Holerites em PDF importados e assinados pelo portal
      const { data: doc } = await supa
        .from("holerite_documentos")
        .select("protocolo, hash_documento, hash_assinatura, data_assinatura, mes, ano, employees:employee_id(nome_completo, cpf), empresas:empresa_id(nome, cnpj)")
        .eq("protocolo", protocolo)
        .eq("status", "assinado")
        .maybeSingle();
      if (doc) {
        return new Response(
          JSON.stringify({
            valido: true,
            protocolo: doc.protocolo,
            hash_documento: doc.hash_documento,
            hash_assinatura: doc.hash_assinatura,
            signatario_nome: maskNome((doc as any).employees?.nome_completo),
            signatario_cpf: maskCpf((doc as any).employees?.cpf),
            empresa: (doc as any).empresas?.nome || null,
            cnpj: (doc as any).empresas?.cnpj || null,
            periodo: `${String(doc.mes).padStart(2, "0")}/${doc.ano}`,
            data_assinatura: doc.data_assinatura,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (error || !data) {
      return new Response(JSON.stringify({ valido: false, erro: "Não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        valido: true,
        protocolo: data.protocolo,
        hash_documento: data.hash_documento,
        hash_assinatura: data.hash_assinatura,
        signatario_nome: maskNome(data.nome_completo),
        signatario_cpf: maskCpf(data.cpf),
        empresa: (data as any).empresas?.nome || null,
        cnpj: (data as any).empresas?.cnpj || null,
        periodo: (data as any).folha
          ? `${String((data as any).folha.mes).padStart(2, "0")}/${(data as any).folha.ano}`
          : null,
        data_assinatura: data.data_assinatura,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ valido: false, erro: String((e as Error).message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
