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

    const { cpf, senha, nome_completo } = await req.json()

    if (!cpf || !senha || !nome_completo) {
      return new Response(
        JSON.stringify({ error: 'CPF, senha e nome completo são obrigatórios' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Formatar CPF para criar um email válido
    const cpfLimpo = cpf.replace(/\D/g, '')
    const email = `gestor.${cpfLimpo}@rhsantabarbara.app`

    // Criar usuário gestor usando service role key
    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email: email,
      password: senha,
      email_confirm: true,
      user_metadata: {
        nome_completo: nome_completo,
        role: 'gestor'
      },
      // O papel vem de app_metadata (só o servidor consegue definir)
      app_metadata: { role: 'gestor' }
    })

    if (authError) {
      console.error('Erro ao criar gestor:', authError)
      return new Response(
        JSON.stringify({ error: authError.message }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ user: authData.user }),
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
