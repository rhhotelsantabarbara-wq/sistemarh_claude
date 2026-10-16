-- Correções de segurança (auditoria de 16/10/2026)

-- 1) Holerites assinados: qualquer visitante (anon) conseguia listar TODAS as assinaturas
--    (nome, CPF, IP, geolocalização, caminho da selfie). A validação pública por protocolo
--    é feita pela edge function holerite-validar, que usa a chave de serviço.
DROP POLICY IF EXISTS "validacao publica por protocolo" ON public.holerite_assinaturas;

-- 2) Novos usuários: o papel vinha de raw_user_meta_data, que qualquer pessoa pode preencher
--    ao se cadastrar pela API pública (ex.: role = 'gestor'). Agora vem de raw_app_meta_data,
--    que só o servidor consegue definir. Sem papel definido = funcionario.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  papel public.app_role := 'funcionario';
BEGIN
  IF NEW.raw_app_meta_data->>'role' IN ('gestor', 'funcionario', 'admin_parcial') THEN
    papel := (NEW.raw_app_meta_data->>'role')::public.app_role;
  END IF;

  INSERT INTO public.profiles (id, nome_completo, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome_completo', NEW.email), NEW.email);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, papel);

  RETURN NEW;
END;
$function$;

-- 3) Histórico de candidaturas: é gravado pelo gatilho registrar_historico_status (SECURITY DEFINER);
--    a regra que deixava qualquer pessoa inserir registros não é necessária.
DROP POLICY IF EXISTS "Sistema pode inserir histórico" ON public.historico_status_candidatura;

-- 4) Pesquisas NR-1 (clima e liderança): qualquer visitante conseguia LISTAR todos os códigos
--    de acesso, marcá-los como usados e enviar respostas ilimitadas sem código.
--    Agora a validação e o envio passam por funções que conferem o código e o gastam
--    na mesma operação.
DROP POLICY IF EXISTS "Anyone can read tokens for validation" ON public.nr1_pesquisa_tokens;
DROP POLICY IF EXISTS "Anyone can mark token used" ON public.nr1_pesquisa_tokens;
DROP POLICY IF EXISTS "Anyone can validate token" ON public.nr1_lideranca_tokens;
DROP POLICY IF EXISTS "Anyone can mark token used" ON public.nr1_lideranca_tokens;
DROP POLICY IF EXISTS "Anyone can submit respostas" ON public.nr1_clima_respostas;
DROP POLICY IF EXISTS "Anyone can submit nr1_lideranca_respostas" ON public.nr1_lideranca_respostas;
DROP POLICY IF EXISTS "Auth users can submit nr1_lideranca_respostas" ON public.nr1_lideranca_respostas;

-- A tela da pesquisa de clima sempre enviou "comentario", mas a coluna não existia:
-- toda resposta falhava (150 links gerados, nenhuma resposta gravada).
ALTER TABLE public.nr1_clima_respostas ADD COLUMN IF NOT EXISTS comentario text;

-- Valida um código e devolve a pesquisa (só se o código existir, não tiver sido usado
-- e a pesquisa estiver ativa). p_tipo: 'clima' ou 'lideranca'.
CREATE OR REPLACE FUNCTION public.nr1_validar_token(p_tipo text, p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_pesquisa_id uuid;
  v_usado boolean;
  v_pesquisa jsonb;
BEGIN
  IF p_tipo = 'clima' THEN
    SELECT pesquisa_id, usado INTO v_pesquisa_id, v_usado FROM nr1_pesquisa_tokens WHERE token::text = p_token;
    IF v_pesquisa_id IS NULL OR v_usado THEN RETURN NULL; END IF;
    SELECT to_jsonb(p) INTO v_pesquisa FROM nr1_pesquisas_clima p WHERE p.id = v_pesquisa_id AND p.status = 'ativa';
  ELSIF p_tipo = 'lideranca' THEN
    SELECT pesquisa_id, usado INTO v_pesquisa_id, v_usado FROM nr1_lideranca_tokens WHERE token::text = p_token;
    IF v_pesquisa_id IS NULL OR v_usado THEN RETURN NULL; END IF;
    SELECT to_jsonb(p) INTO v_pesquisa FROM nr1_lideranca_pesquisas p WHERE p.id = v_pesquisa_id AND p.ativa;
  ELSE
    RETURN NULL;
  END IF;
  RETURN v_pesquisa;
END
$fn$;

-- Envia a resposta e gasta o código na mesma transação (o código não pode ser reutilizado).
CREATE OR REPLACE FUNCTION public.nr1_enviar_resposta(p_tipo text, p_token text, p_respostas jsonb, p_comentario text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_token_id uuid;
  v_pesquisa_id uuid;
BEGIN
  IF p_respostas IS NULL OR jsonb_typeof(p_respostas) <> 'array' OR jsonb_array_length(p_respostas) = 0 THEN
    RAISE EXCEPTION 'Respostas inválidas';
  END IF;

  IF p_tipo = 'clima' THEN
    SELECT t.id, t.pesquisa_id INTO v_token_id, v_pesquisa_id
    FROM nr1_pesquisa_tokens t JOIN nr1_pesquisas_clima p ON p.id = t.pesquisa_id
    WHERE t.token::text = p_token AND NOT t.usado AND p.status = 'ativa'
    FOR UPDATE OF t;
    IF v_token_id IS NULL THEN RAISE EXCEPTION 'Este link já foi utilizado ou expirou'; END IF;
    INSERT INTO nr1_clima_respostas (pesquisa_id, respostas, comentario) VALUES (v_pesquisa_id, p_respostas, nullif(p_comentario, ''));
    UPDATE nr1_pesquisa_tokens SET usado = true, usado_em = now() WHERE id = v_token_id;
  ELSIF p_tipo = 'lideranca' THEN
    SELECT t.id, t.pesquisa_id INTO v_token_id, v_pesquisa_id
    FROM nr1_lideranca_tokens t JOIN nr1_lideranca_pesquisas p ON p.id = t.pesquisa_id
    WHERE t.token::text = p_token AND NOT t.usado AND p.ativa
    FOR UPDATE OF t;
    IF v_token_id IS NULL THEN RAISE EXCEPTION 'Este link já foi utilizado ou expirou'; END IF;
    INSERT INTO nr1_lideranca_respostas (pesquisa_id, respostas, comentario) VALUES (v_pesquisa_id, p_respostas, nullif(p_comentario, ''));
    UPDATE nr1_lideranca_tokens SET usado = true, usado_em = now() WHERE id = v_token_id;
  ELSE
    RAISE EXCEPTION 'Tipo de pesquisa inválido';
  END IF;
  RETURN true;
END
$fn$;

REVOKE ALL ON FUNCTION public.nr1_validar_token(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nr1_enviar_resposta(text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nr1_validar_token(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nr1_enviar_resposta(text, text, jsonb, text) TO anon, authenticated;
