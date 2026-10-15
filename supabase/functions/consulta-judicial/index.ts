import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

async function callGeminiWithGrounding(prompt: string, apiKey: string, modelo?: string): Promise<string> {
  const geminiModel = modelo || 'gemini-2.0-flash';
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
    console.error('Gemini API error:', errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p: any) => p.text || '').join('');

  const groundingMetadata = data.candidates?.[0]?.groundingMetadata;
  if (groundingMetadata) {
    console.log('Grounding sources count:', groundingMetadata.groundingChunks?.length || 0);
    if (groundingMetadata.groundingChunks) {
      for (const chunk of groundingMetadata.groundingChunks.slice(0, 5)) {
        console.log('Source:', chunk.web?.uri || 'unknown');
      }
    }
  }

  return text;
}

async function callGeminiSemGrounding(prompt: string, apiKey: string | undefined): Promise<string> {
  if (!apiKey) throw new Error('GOOGLE_GEMINI_API_KEY not configured');

  // Endpoint do Gemini compatível com o formato OpenAI (substitui o gateway de IA da Lovable)
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'Você é um investigador jurídico especializado em busca de processos judiciais no Brasil. Responda sempre em JSON válido. NÃO invente processos.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.0,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini (sem grounding) error:', response.status, errorText);
    throw new Error(`Gemini error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
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

    let aiResponse = '';
    let usedProvider = '';

    // Strategy 1: Gemini with Google Search grounding (best for real web search)
    const geminiKey = aiConfig?.google_gemini_api_key || Deno.env.get('GOOGLE_GEMINI_API_KEY');
    if (geminiKey) {
      try {
        console.log('Tentativa 1: Gemini com Google Search grounding...');
        aiResponse = await callGeminiWithGrounding(prompt, geminiKey, aiConfig?.modelo);
        usedProvider = 'gemini-grounding';
        console.log(`Gemini response length: ${aiResponse.length}`);
      } catch (e) {
        console.error('Gemini falhou:', e.message);
      }
    }

    // Strategy 2: If Gemini found nothing or failed, try Gemini without grounding as second opinion
    const parsed1 = aiResponse ? parseAIResponse(aiResponse) : null;
    if (!parsed1 || (parsed1.processos_encontrados === 0 && geminiKey)) {
      try {
        console.log('Tentativa 2: Gemini sem grounding (segunda opinião)...');
        const respostaSegunda = await callGeminiSemGrounding(prompt, geminiKey);
        const parsed2 = parseAIResponse(respostaSegunda);
        
        if (parsed2 && parsed2.processos_encontrados > 0) {
          console.log(`Gemini (2ª opinião) encontrou ${parsed2.processos_encontrados} processo(s)!`);
          aiResponse = respostaSegunda;
          usedProvider = 'gemini';
        } else if (!parsed1) {
          aiResponse = respostaSegunda;
          usedProvider = 'gemini';
        }
      } catch (e) {
        console.error('Gemini (2ª opinião) falhou:', e.message);
      }
    }

    // Strategy 3: If still no response, try OpenAI if configured
    if (!aiResponse) {
      const openaiKey = aiConfig?.openai_api_key || Deno.env.get('OPENAI_API_KEY');
      if (openaiKey) {
        try {
          console.log('Tentativa 3: OpenAI...');
          const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: 'Você é um investigador jurídico especializado em busca de processos judiciais no Brasil. Responda sempre em JSON válido.' },
                { role: 'user', content: prompt },
              ],
              temperature: 0.0,
              max_tokens: 8192,
            }),
          });

          if (openaiResponse.ok) {
            const openaiData = await openaiResponse.json();
            aiResponse = openaiData.choices?.[0]?.message?.content || '';
            usedProvider = 'openai';
          }
        } catch (e) {
          console.error('OpenAI falhou:', e.message);
        }
      }
    }

    // Fallback: Gemini without grounding if nothing worked
    if (!aiResponse) {
      console.log('Fallback final: Gemini sem grounding...');
      aiResponse = await callGeminiSemGrounding(prompt, geminiKey);
      usedProvider = 'gemini-fallback';
    }

    console.log(`Provider usado: ${usedProvider}`);

    // Parse final response
    let resultado: any = {};
    let processos_encontrados = 0;
    let resumo = '';

    const parsedResult = parseAIResponse(aiResponse);
    if (parsedResult) {
      resultado = parsedResult;
      processos_encontrados = parsedResult.processos_encontrados || 0;
      resumo = parsedResult.resumo_geral || 'Consulta realizada com sucesso.';
    } else {
      resultado = { raw_response: aiResponse };
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
