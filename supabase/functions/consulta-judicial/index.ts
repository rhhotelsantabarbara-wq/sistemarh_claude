import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "../_shared/geminiFallback.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function buildPrompt(nome: string, cpfFormatado: string, cpfLimpo: string) {
  const nomePartes = nome.trim().split(/\s+/);
  const primeiroNome = nomePartes[0];
  const ultimoNome = nomePartes[nomePartes.length - 1];
  const nomeSemAcento = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  return `Você é um investigador jurídico digital. Sua tarefa é buscar processos judiciais públicos envolvendo uma pessoa específica.

PESSOA ALVO:
- Nome completo: "${nome}"
- Variação sem acentos: "${nomeSemAcento}"
- Primeiro e último nome: "${primeiroNome} ${ultimoNome}"
- CPF formatado: ${cpfFormatado}
- CPF somente números: ${cpfLimpo}

ESTRATÉGIA DE BUSCA OBRIGATÓRIA:
Realize buscas na web usando TODAS estas combinações:

1. "${nome}" processo judicial
2. "${nome}" site:jusbrasil.com.br
3. "${cpfFormatado}" site:jusbrasil.com.br
4. "${nome}" site:escavador.com
5. "${nomeSemAcento}" processo tribunal
6. "${primeiroNome} ${ultimoNome}" reclamante OR reclamado OR autor OR réu
7. "${nome}" TRT OR TJSP OR TJRJ OR TJMG OR TJBA OR TJPR OR TJRS OR TRF
8. "${cpfLimpo}" processo
9. "${nome}" vara do trabalho OR vara cível
10. "${primeiroNome} ${ultimoNome}" jusbrasil OR escavador OR consulta processual

REGRAS CRÍTICAS:
- NÃO invente processos. Relate SOMENTE o que encontrar nas buscas reais.
- Se encontrar qualquer menção a processo, INCLUA mesmo que parcial.
- Considere variações do nome (com/sem acento, abreviações do meio).
- Busque em TODOS os tribunais brasileiros (trabalhista, cível, criminal, federal).
- Se o resultado da busca mostrar páginas do JusBrasil/Escavador com o nome da pessoa, extraia as informações disponíveis.

FORMATO DE RESPOSTA (JSON obrigatório):
{
  "processos_encontrados": <número>,
  "processos": [
    {
      "numero_processo": "<número CNJ ou 'não disponível'>",
      "tribunal": "<sigla do tribunal>",
      "tipo": "<trabalhista/cível/criminal/administrativo/outro>",
      "status": "<ativo/arquivado/em andamento/baixado>",
      "polo": "<autor/réu/reclamante/reclamado/terceiro>",
      "resumo": "<descrição breve>",
      "fonte": "<URL da fonte>"
    }
  ],
  "resumo_geral": "<2-3 frases sobre a situação judicial>",
  "fontes": ["<URLs consultadas>"]
}`;
}

class BuscaIndisponivelError extends Error {}

async function callGeminiWithGrounding(prompt: string, apiKey: string, modelo?: string): Promise<{ texto: string; fontes: string[]; buscas: string[] }> {
  const geminiModel = modelo || 'gemini-3.5-flash';
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

  const response = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.0,
        maxOutputTokens: 8192,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error:', response.status, errorText);
    if (response.status === 429 || response.status === 403) {
      throw new BuscaIndisponivelError(
        'A busca na internet do Gemini não está liberada para a chave cadastrada (plano gratuito sem cota de pesquisa Google). ' +
        'Ative o faturamento no Google AI Studio (Chaves de API → Configurar faturamento) para usar a consulta judicial.'
      );
    }
    throw new BuscaIndisponivelError(`A busca na internet falhou (Gemini ${response.status}). Tente novamente em alguns minutos.`);
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const texto = parts.map((p: any) => p.text || '').join('');
  const gm = data.candidates?.[0]?.groundingMetadata || {};
  const fontes = (gm.groundingChunks || [])
    .map((c: any) => (c.web?.title ? `${c.web.title} — ${c.web.uri}` : c.web?.uri))
    .filter(Boolean);
  const buscas = gm.webSearchQueries || [];
  console.log(`Grounding: ${buscas.length} busca(s), ${fontes.length} fonte(s)`);
  return { texto, fontes, buscas };
}

function parseAIResponse(aiResponse: string) {
  try {
    const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/) || 
                      aiResponse.match(/```\s*([\s\S]*?)\s*```/) ||
                      [null, aiResponse];
    const jsonStr = jsonMatch[1] || aiResponse;
    
    const jsonObjectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      return JSON.parse(jsonObjectMatch[0]);
    }
    return JSON.parse(jsonStr.trim());
  } catch (e) {
    console.error('Error parsing AI response:', e);
    console.log('Raw response (first 1000):', aiResponse.substring(0, 1000));
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Somente gestores podem consultar
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    const { data: { user } } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
    if (!user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: papel } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'gestor').maybeSingle();
    if (!papel) {
      return new Response(JSON.stringify({ error: 'Apenas gestores podem fazer consultas judiciais' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: aiConfig } = await supabase
      .from('configuracoes_ia')
      .select('*')
      .limit(1)
      .maybeSingle();

    const { employee_id, cpf, nome, consultado_por } = await req.json();

    if (!cpf || !nome) {
      return new Response(JSON.stringify({ error: 'CPF e nome são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cpfLimpo = cpf.replace(/\D/g, '');
    const cpfFormatado = cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    const prompt = buildPrompt(nome, cpfFormatado, cpfLimpo);

    console.log(`=== Consulta Judicial: ${nome} (${cpfFormatado}) ===`);

    // Só a busca com Google Search conta como consulta. Modelos sem acesso à internet
    // não conseguem achar processos e davam um falso "nenhum processo encontrado".
    const geminiKey = aiConfig?.google_gemini_api_key || Deno.env.get('GOOGLE_GEMINI_API_KEY');
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: 'Chave do Google Gemini não configurada (Configurações → IA).' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let busca: { texto: string; fontes: string[]; buscas: string[] };
    try {
      busca = await callGeminiWithGrounding(prompt, geminiKey, aiConfig?.modelo);
    } catch (e) {
      const msg = e instanceof BuscaIndisponivelError ? e.message : `Erro na busca: ${(e as Error).message}`;
      return new Response(JSON.stringify({ error: msg }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const aiResponse = busca.texto;
    const usedProvider = 'gemini-google-search';

    // Parse final response
    let resultado: any = {};
    let processos_encontrados = 0;
    let resumo = '';

    const parsedResult = parseAIResponse(aiResponse);
    if (parsedResult) {
      resultado = parsedResult;
      // Fontes que a pesquisa realmente abriu, para conferência manual
      if (busca.fontes.length > 0) {
        resultado.fontes = Array.from(new Set([...(resultado.fontes || []), ...busca.fontes]));
      }
      resultado.buscas_realizadas = busca.buscas;
      processos_encontrados = parsedResult.processos_encontrados || 0;
      resumo = parsedResult.resumo_geral || 'Consulta realizada com sucesso.';
    } else {
      resultado = { raw_response: aiResponse, fontes: busca.fontes, buscas_realizadas: busca.buscas };
      resumo = aiResponse.substring(0, 500);
    }

    console.log(`=== Resultado final: ${processos_encontrados} processo(s) [${usedProvider}] ===`);

    // Save to database
    if (employee_id) {
      const { error: insertError } = await supabase.from('consultas_judiciais').insert({
        employee_id,
        resultado: { ...resultado, _provider: usedProvider },
        processos_encontrados,
        resumo,
        consultado_por,
      });
      
      if (insertError) {
        console.error('Error saving consultation:', insertError);
      }
    }

    return new Response(JSON.stringify({
      processos_encontrados,
      resumo,
      resultado,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
