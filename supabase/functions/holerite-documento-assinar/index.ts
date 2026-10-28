import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.25.76";

const BodySchema = z.object({
  documento_id: z.string().uuid(),
  selfie_base64: z.string().min(100),
  assinatura_base64: z.string().min(100),
  geo: z.object({ lat: z.number(), lng: z.number(), consentimento: z.boolean() }).nullable().optional(),
  user_agent: z.string().max(2000).optional(),
  navegador: z.string().max(100).optional(),
  sistema_operacional: z.string().max(100).optional(),
});

function base64ToBytes(value: string) {
  const clean = value.includes(",") ? value.split(",")[1] : value;
  return Uint8Array.from(atob(clean), (char) => char.charCodeAt(0));
}

async function sha256(bytes: Uint8Array) {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: claims, error: claimsError } = await userClient.auth.getClaims(authHeader.slice(7));
    if (claimsError || !claims?.claims?.sub) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const payload = parsed.data;
    const admin = createClient(url, serviceKey);
    const { data: document, error: documentError } = await admin.from("holerite_documentos").select("*, employees!inner(user_id, nome_completo, cpf)").eq("id", payload.documento_id).single();
    if (documentError || !document) return new Response(JSON.stringify({ error: "Holerite não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (document.employees.user_id !== claims.claims.sub) return new Response(JSON.stringify({ error: "Você só pode assinar seu próprio holerite" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (document.status === "assinado") return new Response(JSON.stringify({ error: "Este holerite já foi assinado", protocolo: document.protocolo }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: original, error: downloadError } = await admin.storage.from("holerites-importados").download(document.arquivo_path);
    if (downloadError || !original) throw downloadError || new Error("PDF não encontrado");
    const pdfBytes = new Uint8Array(await original.arrayBuffer());
    const selfieBytes = base64ToBytes(payload.selfie_base64);
    const signatureBytes = base64ToBytes(payload.assinatura_base64);
    const hashDocumento = await sha256(pdfBytes);
    const protocolo = `HOL-${document.ano}${String(document.mes).padStart(2, "0")}-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const date = new Date().toISOString();
    const ip = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "desconhecido").split(",")[0].trim();
    const hashAssinatura = await sha256(new TextEncoder().encode([protocolo, hashDocumento, document.employee_id, ip, date, await sha256(signatureBytes)].join("|")));
    const basePath = `${document.employee_id}/${protocolo}`;
    const pdfPath = `${basePath}/holerite.pdf`;
    const selfiePath = `${basePath}/selfie.jpg`;
    const signaturePath = `${basePath}/assinatura.png`;
    const uploads = await Promise.all([
      admin.storage.from("holerites-assinados").upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: false }),
      admin.storage.from("holerites-assinados").upload(selfiePath, selfieBytes, { contentType: "image/jpeg", upsert: false }),
      admin.storage.from("holerites-assinados").upload(signaturePath, signatureBytes, { contentType: "image/png", upsert: false }),
    ]);
    const uploadError = uploads.find((result) => result.error)?.error;
    if (uploadError) throw uploadError;

    const { error: updateError } = await admin.from("holerite_documentos").update({
      status: "assinado",
      protocolo,
      hash_documento: hashDocumento,
      hash_assinatura: hashAssinatura,
      pdf_assinado_path: pdfPath,
      selfie_path: selfiePath,
      assinatura_imagem_path: signaturePath,
      ip_publico: ip,
      user_agent: payload.user_agent || req.headers.get("user-agent"),
      navegador: payload.navegador || null,
      sistema_operacional: payload.sistema_operacional || null,
      geo_latitude: payload.geo?.consentimento ? payload.geo.lat : null,
      geo_longitude: payload.geo?.consentimento ? payload.geo.lng : null,
      geo_consentimento: payload.geo?.consentimento || false,
      data_visualizacao: date,
      data_assinatura: date,
    }).eq("id", document.id);
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, protocolo, hash_documento: hashDocumento, hash_assinatura: hashAssinatura, data_assinatura: date, pdf_path: pdfPath, ip }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});