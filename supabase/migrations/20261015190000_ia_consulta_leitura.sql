-- Cérebrum: consulta livre ao banco SOMENTE LEITURA, usada pela edge function ai-assistant.
-- A consulta roda com o papel "ia_leitura", que só tem SELECT nas tabelas do RH
-- (sem acesso a chaves, tokens e ao schema auth). Qualquer escrita falha por falta de permissão.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ia_leitura') THEN
    CREATE ROLE ia_leitura NOLOGIN BYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO ia_leitura;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ia_leitura;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ia_leitura;

-- Tabelas com segredos: nunca visíveis para a IA
REVOKE ALL ON public.configuracoes_ia FROM ia_leitura;
REVOKE ALL ON public.configuracoes_whatsapp FROM ia_leitura;
REVOKE ALL ON public.google_calendar_tokens FROM ia_leitura;
REVOKE ALL ON public.google_drive_conexao FROM ia_leitura;
REVOKE ALL ON public.google_drive_oauth_states FROM ia_leitura;
REVOKE ALL ON public.drive_backup_config FROM ia_leitura;

-- Quem chama a função (service_role, dentro da edge function) pode assumir o papel de leitura
GRANT ia_leitura TO service_role;

CREATE OR REPLACE FUNCTION public.ia_consulta_sql(consulta text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  q text := btrim(consulta);
  resultado jsonb;
BEGIN
  q := regexp_replace(q, ';\s*$', '');
  IF q ~ ';' THEN
    RAISE EXCEPTION 'Envie apenas uma consulta, sem ponto e vírgula no meio';
  END IF;
  IF q !~* '^(select|with)\s' THEN
    RAISE EXCEPTION 'Apenas consultas SELECT são permitidas';
  END IF;

  PERFORM set_config('role', 'ia_leitura', true);

  EXECUTE format(
    'SELECT coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM (%s) AS sub LIMIT 200) AS t',
    q
  ) INTO resultado;

  PERFORM set_config('role', 'none', true);
  RETURN resultado;
END
$fn$;

REVOKE ALL ON FUNCTION public.ia_consulta_sql(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ia_consulta_sql(text) TO service_role;

-- Modelos antigos do Gemini foram descontinuados: atualiza para o 2.5 Flash
UPDATE public.configuracoes_ia SET modelo = 'gemini-2.5-flash'
WHERE provedor = 'gemini' AND (modelo IS NULL OR modelo IN ('gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'));
ALTER TABLE public.configuracoes_ia ALTER COLUMN modelo SET DEFAULT 'gemini-2.5-flash';
