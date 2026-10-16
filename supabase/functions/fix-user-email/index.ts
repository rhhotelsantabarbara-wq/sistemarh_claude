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

    const { user_id, cpf } = await req.json()

    if (!user_id || !cpf) {
      return new Response(
        JSON.stringify({ error: 'user_id e cpf são obrigatórios' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Formatar CPF e criar novo email
    const cpfLimpo = cpf.replace(/\D/g, '')
    const newEmail = `funcionario.${cpfLimpo}@rhsantabarbara.app`

    console.log(`Atualizando email do usuário ${user_id} para ${newEmail}`)

    // Atualizar email do usuário
    const { data, error } = await supabaseClient.auth.admin.updateUserById(
      user_id,
      { email: newEmail }
    )

    if (error) {
      console.error('Erro ao atualizar email:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Email atualizado com sucesso')

    return new Response(
      JSON.stringify({ success: true, user: data.user }),
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