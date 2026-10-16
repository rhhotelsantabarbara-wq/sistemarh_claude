import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'
import { exigirPapel } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Só usuários com permissão podem executar esta função
    const acesso = await exigirPapel(req, ["gestor"]);
    if (acesso.resposta) return acesso.resposta;

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { user_id, nome_completo, senha } = await req.json()

    if (!user_id || !nome_completo) {
      return new Response(
        JSON.stringify({ error: 'user_id e nome_completo são obrigatórios' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Preparar dados de atualização
    const updateData: any = {
      user_metadata: {
        nome_completo: nome_completo,
        role: 'gestor'
      }
    }

    // Se senha foi fornecida, incluir na atualização
    if (senha && senha.trim() !== '') {
      updateData.password = senha
    }

    // Atualizar usuário usando service role key
    const { data, error } = await supabaseClient.auth.admin.updateUserById(
      user_id,
      updateData
    )

    if (error) {
      console.error('Erro ao atualizar gestor:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ user: data.user }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Erro inesperado:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
