import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'
import { exigirPapel } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Só usuários com permissão podem executar esta função
    const acesso = await exigirPapel(req, ["gestor"]);
    if (acesso.resposta) return acesso.resposta;

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { cpf, senha, nome_completo, modules } = await req.json()

    if (!cpf || !senha || !nome_completo) {
      return new Response(JSON.stringify({ error: 'CPF, senha e nome completo são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const cpfLimpo = String(cpf).replace(/\D/g, '')
    const email = `admin.${cpfLimpo}@rhsantabarbara.app`

    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome_completo, role: 'admin_parcial' },
      app_metadata: { role: 'admin_parcial' },
    })

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = authData.user!.id

    // O trigger handle_new_user vai criar profile + user_role com 'admin_parcial' (vem do user_metadata)
    // Inserir as permissões de módulo
    if (Array.isArray(modules) && modules.length > 0) {
      const rows = modules.map((m: string) => ({ user_id: userId, module_key: m }))
      const { error: permError } = await supabaseClient
        .from('admin_module_permissions')
        .insert(rows)
      if (permError) console.error('Erro ao inserir permissões:', permError)
    }

    return new Response(JSON.stringify({ user: authData.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
