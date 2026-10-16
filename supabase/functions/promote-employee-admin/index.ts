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

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { employee_id, modules } = await req.json()
    if (!employee_id) {
      return new Response(JSON.stringify({ error: 'employee_id obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Buscar user_id do funcionário
    const { data: emp, error: empErr } = await admin
      .from('employees')
      .select('id, user_id, nome_completo')
      .eq('id', employee_id)
      .maybeSingle()

    if (empErr || !emp) {
      return new Response(JSON.stringify({ error: 'Funcionário não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!emp.user_id) {
      return new Response(JSON.stringify({ error: 'Este funcionário ainda não possui usuário de acesso. Crie o login primeiro.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = emp.user_id

    // Atualizar/inserir role para admin_parcial
    const { data: existingRole } = await admin
      .from('user_roles')
      .select('id, role')
      .eq('user_id', userId)
      .maybeSingle()

    if (existingRole) {
      if (existingRole.role !== 'admin_parcial') {
        await admin.from('user_roles').update({ role: 'admin_parcial' }).eq('id', existingRole.id)
      }
    } else {
      await admin.from('user_roles').insert({ user_id: userId, role: 'admin_parcial' })
    }

    // Substituir permissões
    await admin.from('admin_module_permissions').delete().eq('user_id', userId)
    if (Array.isArray(modules) && modules.length > 0) {
      const rows = modules.map((m: string) => ({ user_id: userId, module_key: m }))
      await admin.from('admin_module_permissions').insert(rows)
    }

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
