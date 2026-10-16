import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'
import { exigirPapel, papeisDoUsuario } from "../_shared/auth.ts";

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
    const acesso = await exigirPapel(req, ["gestor", "admin_parcial"]);
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

    // Formatar CPF para criar um email válido (remover caracteres especiais)
    const cpfLimpo = cpf.replace(/\D/g, '')
    const email = `funcionario.${cpfLimpo}@rhsantabarbara.app`

    // Tentar criar usuário usando service role key
    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email: email,
      password: senha,
      email_confirm: true,
      user_metadata: {
        nome_completo: nome_completo,
        role: 'funcionario'
      },
      // O papel vem de app_metadata (só o servidor consegue definir)
      app_metadata: { role: 'funcionario' }
    })

    if (authError) {
      // Se o usuário já existe, buscar e retornar o existente
      if (authError.message.includes('already been registered')) {
        const { data: users, error: listError } = await supabaseClient.auth.admin.listUsers()
        if (listError) {
          return new Response(
            JSON.stringify({ error: 'Erro ao buscar usuário existente' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const existingUser = users.users.find(u => u.email === email)
        if (existingUser) {
          // Só reaproveita (e troca a senha de) contas que são apenas de funcionário,
          // para ninguém assumir a conta de um gestor/admin por aqui
          const papeisExistente = await papeisDoUsuario(existingUser.id)
          if (papeisExistente.some((p) => p !== 'funcionario')) {
            return new Response(
              JSON.stringify({ error: 'Já existe um usuário gestor/administrador com este CPF' }),
              { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          // Atualizar senha do usuário existente
          const { data: updated, error: updateError } = await supabaseClient.auth.admin.updateUserById(
            existingUser.id,
            { password: senha, user_metadata: { nome_completo: nome_completo, role: 'funcionario' } }
          )
          if (updateError) {
            return new Response(
              JSON.stringify({ error: updateError.message }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          return new Response(
            JSON.stringify({ user: updated.user }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
      console.error('Erro ao criar usuário:', authError)
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
