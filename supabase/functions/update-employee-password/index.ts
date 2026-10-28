import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Sem autorização');
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    // Verificar se o usuário é um gestor
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roles || roles.role !== 'gestor') {
      throw new Error('Acesso negado. Apenas gestores podem alterar senhas.');
    }

    const { userId, newPassword } = await req.json();

    if (!userId || !newPassword) {
      throw new Error('userId e newPassword são obrigatórios');
    }

    if (newPassword.length < 6) {
      throw new Error('A senha deve ter no mínimo 6 caracteres');
    }

    console.log('Alterando senha para usuário:', userId);

    // Atualizar senha usando o service role
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Erro ao atualizar senha:', updateError);
      throw updateError;
    }

    console.log('Senha alterada com sucesso');

    // O login é feito pelo CPF (e-mail interno "funcionario.<cpf>@rhsantabarbara.app").
    // Se o CPF do cadastro foi corrigido depois de criar o acesso, o e-mail ficou com o CPF antigo
    // e a pessoa não conseguia entrar. Aqui o e-mail passa a usar o CPF atual do cadastro.
    let emailCorrigido = false;
    const { data: emp } = await supabaseAdmin.from('employees').select('cpf').eq('user_id', userId).maybeSingle();
    const cpfAtual = String(emp?.cpf || '').replace(/\D/g, '');
    if (cpfAtual.length === 11) {
      const { data: alvo } = await supabaseAdmin.auth.admin.getUserById(userId);
      const emailAtual = alvo?.user?.email || '';
      const prefixo = ['funcionario', 'gestor', 'admin'].find((p) => emailAtual.startsWith(p + '.')) || 'funcionario';
      const esperado = `${prefixo}.${cpfAtual}@rhsantabarbara.app`;
      if (emailAtual && emailAtual !== esperado && emailAtual.endsWith('@rhsantabarbara.app')) {
        const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(userId, { email: esperado, email_confirm: true });
        if (emailError) console.error('Não foi possível ajustar o e-mail ao CPF:', emailError);
        else emailCorrigido = true;
      }
    }

    return new Response(
      JSON.stringify({ message: 'Senha alterada com sucesso', emailCorrigido }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
