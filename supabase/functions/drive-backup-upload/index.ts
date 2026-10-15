import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DRIVE_BASE, driveHeaders } from "../_shared/googleDrive.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = DRIVE_BASE;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;


async function findOrCreateFolder(
  supabase: any,
  name: string,
  parentId: string | null,
  cacheKey: string
): Promise<string> {
  const { data: cached } = await supabase
    .from("drive_folder_cache")
    .select("drive_folder_id")
    .eq("caminho", cacheKey)
    .maybeSingle();
  if (cached?.drive_folder_id) return cached.drive_folder_id;

  // Search existing
  const q = encodeURIComponent(
    `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false` +
    (parentId ? ` and '${parentId}' in parents` : "")
  );
  const searchRes = await fetch(`${GATEWAY}/drive/v3/files?q=${q}&fields=files(id,name)`, {
    headers: await driveHeaders(),
  });
  const searchJson = await searchRes.json();
  let folderId: string | undefined = searchJson?.files?.[0]?.id;

  if (!folderId) {
    const body: any = { name, mimeType: "application/vnd.google-apps.folder" };
    if (parentId) body.parents = [parentId];
    const createRes = await fetch(`${GATEWAY}/drive/v3/files?fields=id`, {
      method: "POST",
      headers: { ...(await driveHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const createJson = await createRes.json();
    if (!createRes.ok) throw new Error(`Erro criando pasta: ${JSON.stringify(createJson)}`);
    folderId = createJson.id;
  }

  await supabase.from("drive_folder_cache").insert({ caminho: cacheKey, drive_folder_id: folderId });
  return folderId!;
}

async function ensurePath(supabase: any, segments: string[], rootId: string): Promise<string> {
  let parent = rootId;
  let path = "__root__";
  for (const seg of segments) {
    path += "/" + seg;
    parent = await findOrCreateFolder(supabase, seg, parent, path);
  }
  return parent;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Usuário inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json();
    const { action } = body;

    // Action: status — verifica conexão
    if (action === "status") {
      const aboutRes = await fetch(`${GATEWAY}/drive/v3/about?fields=user(emailAddress,displayName),storageQuota`, {
        headers: await driveHeaders(),
      });
      if (!aboutRes.ok) {
        const txt = await aboutRes.text();
        return new Response(JSON.stringify({ connected: false, error: txt }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const about = await aboutRes.json();
      return new Response(JSON.stringify({ connected: true, account: about.user }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carrega config
    const { data: config } = await supabase.from("drive_backup_config").select("*").eq("id", 1).maybeSingle();
    if (!config) throw new Error("Configuração não encontrada");

    if (action === "test" || action === "upload") {
      if (action === "upload" && !config.ativo) {
        return new Response(JSON.stringify({ skipped: true, reason: "Backup desativado" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { tipo, nome_arquivo, employee_id, pdf_base64, subpasta } = body;
      if (!tipo || !nome_arquivo || !pdf_base64) {
        return new Response(JSON.stringify({ error: "Parâmetros faltando" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Garantir pasta raiz
      let rootId = config.pasta_raiz_id;
      if (!rootId) {
        rootId = await findOrCreateFolder(supabase, config.pasta_raiz_nome, null, "__rootonly__");
        await supabase.from("drive_backup_config").update({ pasta_raiz_id: rootId }).eq("id", 1);
      }

      // Construir caminho: TIPO / [SUBPASTA] (sempre em MAIÚSCULAS)
      const TIPO_MAP: Record<string, string> = {
        EPIS: "EPI",
        UNIFORMES: "UNIFORME",
        TACS: "TAC",
        CRACHAS: "CRACHÁ",
        DESLIGAMENTOS: "DESLIGAMENTO",
        ENCAMINHAMENTOS: "ENCAMINHAMENTO",
        ETIQUETAS: "ETIQUETA",
        PONTO: "PONTO",
        CONTASALARIO: "CONTA SALÁRIO",
      };
      const tipoUpper = String(tipo).toUpperCase();
      const tipoFolder = TIPO_MAP[tipoUpper] || tipoUpper;
      const segments = [tipoFolder];
      if (subpasta) segments.push(String(subpasta).toUpperCase());
      const folderId = await ensurePath(supabase, segments, rootId);

      // Upload multipart
      const boundary = "lovable_boundary_" + crypto.randomUUID();
      const metadata = { name: nome_arquivo, parents: [folderId] };
      const body1 = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/pdf\r\nContent-Transfer-Encoding: base64\r\n\r\n${pdf_base64}\r\n--${boundary}--`;

      const uploadRes = await fetch(
        `${GATEWAY}/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,size`,
        {
          method: "POST",
          headers: { ...(await driveHeaders()), "Content-Type": `multipart/related; boundary=${boundary}` },
          body: body1,
        }
      );

      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok) {
        await supabase.from("drive_backup_log").insert({
          tipo, nome_arquivo, employee_id: employee_id || null,
          status: "erro", erro_mensagem: JSON.stringify(uploadJson).slice(0, 500),
        });
        throw new Error(`Upload falhou: ${JSON.stringify(uploadJson)}`);
      }

      await supabase.from("drive_backup_log").insert({
        tipo, nome_arquivo, employee_id: employee_id || null,
        drive_file_id: uploadJson.id, drive_url: uploadJson.webViewLink,
        tamanho_bytes: uploadJson.size ? parseInt(uploadJson.size) : null,
        status: "sucesso",
      });

      return new Response(JSON.stringify({
        success: true, drive_file_id: uploadJson.id, drive_url: uploadJson.webViewLink,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Ação desconhecida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
