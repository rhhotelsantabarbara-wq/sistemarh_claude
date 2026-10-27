-- Avaliação de Liderança: um link único e anônimo por pesquisa.
-- Antes: cada pesquisa avaliava 1 líder e precisava gerar um link por pessoa.
-- Agora: a pesquisa tem vários líderes e um link só; quem responde escolhe o seu líder.
-- Anonimato: nada que identifique quem respondeu é gravado (nem IP), e o horário da
-- resposta é guardado só com o dia, para não dar para cruzar com quem estava no turno.

ALTER TABLE public.nr1_lideranca_pesquisas
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS lideres uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.nr1_lideranca_pesquisas ALTER COLUMN lider_employee_id DROP NOT NULL;

-- Código curto e difícil de adivinhar para o link
UPDATE public.nr1_lideranca_pesquisas
SET codigo = substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
WHERE codigo IS NULL;
ALTER TABLE public.nr1_lideranca_pesquisas
  ALTER COLUMN codigo SET DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  ALTER COLUMN codigo SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS nr1_lideranca_pesquisas_codigo_idx ON public.nr1_lideranca_pesquisas (codigo);

-- Pesquisas antigas (1 líder): o líder passa a constar na lista
UPDATE public.nr1_lideranca_pesquisas
SET lideres = ARRAY[lider_employee_id]
WHERE lider_employee_id IS NOT NULL AND cardinality(lideres) = 0;

ALTER TABLE public.nr1_lideranca_respostas ADD COLUMN IF NOT EXISTS lider_employee_id uuid;
UPDATE public.nr1_lideranca_respostas r
SET lider_employee_id = p.lider_employee_id
FROM public.nr1_lideranca_pesquisas p
WHERE p.id = r.pesquisa_id AND r.lider_employee_id IS NULL;

-- Abre a pesquisa pelo código: título e líderes (só nome e função). Nada mais é exposto.
CREATE OR REPLACE FUNCTION public.nr1_lideranca_abrir(p_codigo text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  p record;
  hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  SELECT * INTO p FROM nr1_lideranca_pesquisas WHERE codigo = p_codigo;
  IF p.id IS NULL THEN RETURN jsonb_build_object('erro', 'nao_encontrada'); END IF;
  IF NOT p.ativa OR (p.data_fim IS NOT NULL AND p.data_fim < hoje) THEN
    RETURN jsonb_build_object('erro', 'encerrada', 'titulo', p.titulo);
  END IF;
  IF p.data_inicio > hoje THEN RETURN jsonb_build_object('erro', 'nao_iniciada', 'titulo', p.titulo); END IF;
  RETURN jsonb_build_object(
    'titulo', p.titulo,
    'lideres', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', e.id, 'nome', e.nome_completo, 'cargo', e.cargo, 'setor', e.setor) ORDER BY e.nome_completo)
      FROM employees e WHERE e.id = ANY (p.lideres)
    ), '[]'::jsonb)
  );
END
$fn$;

-- Grava uma resposta anônima para um dos líderes da pesquisa
CREATE OR REPLACE FUNCTION public.nr1_lideranca_responder(p_codigo text, p_lider uuid, p_respostas jsonb, p_comentario text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  p record;
  hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  SELECT * INTO p FROM nr1_lideranca_pesquisas WHERE codigo = p_codigo;
  IF p.id IS NULL OR NOT p.ativa OR (p.data_fim IS NOT NULL AND p.data_fim < hoje) OR p.data_inicio > hoje THEN
    RAISE EXCEPTION 'Esta pesquisa não está aberta';
  END IF;
  IF p_lider IS NULL OR NOT (p_lider = ANY (p.lideres)) THEN
    RAISE EXCEPTION 'Escolha um dos líderes da lista';
  END IF;
  IF p_respostas IS NULL OR jsonb_typeof(p_respostas) <> 'array' OR jsonb_array_length(p_respostas) = 0 THEN
    RAISE EXCEPTION 'Respostas inválidas';
  END IF;
  INSERT INTO nr1_lideranca_respostas (pesquisa_id, lider_employee_id, respostas, comentario, created_at)
  VALUES (p.id, p_lider, p_respostas, nullif(left(p_comentario, 2000), ''), date_trunc('day', now()));
  RETURN true;
END
$fn$;

REVOKE ALL ON FUNCTION public.nr1_lideranca_abrir(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nr1_lideranca_responder(text, uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nr1_lideranca_abrir(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nr1_lideranca_responder(text, uuid, jsonb, text) TO anon, authenticated;
