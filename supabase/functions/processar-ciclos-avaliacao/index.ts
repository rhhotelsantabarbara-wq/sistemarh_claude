import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';
import { exigirSegredoCron } from "../_shared/segredoExterno.ts";
import { exigirPapel } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Ciclo {
  id: string;
  nome: string;
  tipo: string;
  data_proxima_execucao: string;
  dias_para_conclusao: number;
  criar_metas: boolean;
  empresa_id?: string;
  setor_id?: string;
  funcao_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Aceita o agendamento (x-cron-secret) ou um gestor logado (botão no sistema)
  if (exigirSegredoCron(req)) {
    const acesso = await exigirPapel(req, ["gestor", "admin_parcial"]);
    if (acesso.resposta) return acesso.resposta;
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 Iniciando processamento de ciclos de avaliação...');

    // Buscar ciclos ativos que devem ser executados hoje ou antes
    const { data: ciclos, error: ciclosError } = await supabase
      .from('ciclos_avaliacao')
      .select('*')
      .eq('ativo', true)
      .lte('data_proxima_execucao', new Date().toISOString().split('T')[0]);

    if (ciclosError) {
      console.error('❌ Erro ao buscar ciclos:', ciclosError);
      throw ciclosError;
    }

    console.log(`📋 ${ciclos?.length || 0} ciclos encontrados para processar`);

    let totalAvaliacoes = 0;

    for (const ciclo of (ciclos as Ciclo[]) || []) {
      console.log(`\n🔄 Processando ciclo: ${ciclo.nome}`);
      
      try {
        // Buscar funcionários elegíveis
        let query = supabase
          .from('employees')
          .select('id, nome_completo, cargo, setor, empresa_id')
          .eq('status', 'ativo');

        if (ciclo.empresa_id) query = query.eq('empresa_id', ciclo.empresa_id);
        if (ciclo.setor_id) query = query.eq('setor', ciclo.setor_id);
        if (ciclo.funcao_id) query = query.eq('cargo', ciclo.funcao_id);

        const { data: funcionarios, error: funcError } = await query;

        if (funcError) {
          console.error(`❌ Erro ao buscar funcionários para ciclo ${ciclo.nome}:`, funcError);
          continue;
        }

        console.log(`👥 ${funcionarios?.length || 0} funcionários elegíveis encontrados`);

        // Criar avaliações para cada funcionário
        const avaliacoesParaCriar = funcionarios?.map(func => {
          const dataFim = new Date();
          dataFim.setDate(dataFim.getDate() + ciclo.dias_para_conclusao);

          return {
            employee_id: func.id,
            tipo: ciclo.tipo,
            periodo_inicio: ciclo.data_proxima_execucao,
            periodo_fim: dataFim.toISOString().split('T')[0],
            status: 'pendente',
            observacoes: `Avaliação criada automaticamente pelo ciclo: ${ciclo.nome}`,
          };
        }) || [];

        if (avaliacoesParaCriar.length > 0) {
          const { error: avalError } = await supabase
            .from('avaliacoes_desempenho')
            .insert(avaliacoesParaCriar);

          if (avalError) {
            console.error(`❌ Erro ao criar avaliações para ciclo ${ciclo.nome}:`, avalError);
            
            // Registrar execução com erro
            await supabase.from('execucoes_ciclo').insert({
              ciclo_id: ciclo.id,
              avaliacoes_criadas: 0,
              status: 'erro',
              detalhes: { erro: avalError.message },
            });
            
            continue;
          }

          totalAvaliacoes += avaliacoesParaCriar.length;
          console.log(`✅ ${avaliacoesParaCriar.length} avaliações criadas`);
        }

        // Calcular próxima execução baseado no tipo
        const proximaExecucao = new Date(ciclo.data_proxima_execucao);
        switch (ciclo.tipo) {
          case 'mensal':
            proximaExecucao.setMonth(proximaExecucao.getMonth() + 1);
            break;
          case 'trimestral':
            proximaExecucao.setMonth(proximaExecucao.getMonth() + 3);
            break;
          case 'semestral':
            proximaExecucao.setMonth(proximaExecucao.getMonth() + 6);
            break;
          case 'anual':
            proximaExecucao.setFullYear(proximaExecucao.getFullYear() + 1);
            break;
        }

        // Atualizar data da próxima execução
        await supabase
          .from('ciclos_avaliacao')
          .update({ data_proxima_execucao: proximaExecucao.toISOString().split('T')[0] })
          .eq('id', ciclo.id);

        // Registrar execução com sucesso
        await supabase.from('execucoes_ciclo').insert({
          ciclo_id: ciclo.id,
          avaliacoes_criadas: avaliacoesParaCriar.length,
          status: 'sucesso',
          detalhes: { 
            funcionarios_processados: funcionarios?.length || 0,
            proxima_execucao: proximaExecucao.toISOString().split('T')[0]
          },
        });

        console.log(`✅ Ciclo ${ciclo.nome} processado com sucesso`);
      } catch (error) {
        console.error(`❌ Erro ao processar ciclo ${ciclo.nome}:`, error);
        
        // Registrar execução com erro
        await supabase.from('execucoes_ciclo').insert({
          ciclo_id: ciclo.id,
          avaliacoes_criadas: 0,
          status: 'erro',
          detalhes: { erro: error instanceof Error ? error.message : String(error) },
        });
      }
    }

    console.log(`\n✅ Processamento concluído: ${totalAvaliacoes} avaliações criadas no total`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        ciclosProcessados: ciclos?.length || 0,
        avaliacoesCriadas: totalAvaliacoes 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Erro no processamento:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});