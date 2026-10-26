-- Férias: status "de férias" do colaborador automático pelas datas.
-- Antes, aprovar férias futuras já marcava o colaborador como "ferias" no mesmo dia,
-- e a volta dependia de confirmação manual. Agora:
--   * entra em "ferias" no primeiro dia de férias aprovadas;
--   * volta para "ativo" quando não há férias aprovadas cobrindo a data de hoje.
-- Só mexe em quem está "ativo" ou "ferias" (afastados, em admissão e demitidos não são tocados).
CREATE OR REPLACE FUNCTION public.sincronizar_status_ferias()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_entraram int;
  v_voltaram int;
BEGIN
  -- Chamado pelo sistema (gestor/admin) ou pelo agendamento (sem usuário)
  IF auth.uid() IS NOT NULL
     AND NOT (public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'admin_parcial')) THEN
    RETURN jsonb_build_object('ignorado', true);
  END IF;

  UPDATE employees e SET status = 'ferias'
  WHERE e.status = 'ativo'
    AND EXISTS (SELECT 1 FROM ferias f WHERE f.employee_id = e.id AND hoje BETWEEN f.periodo_gozo_inicio AND f.periodo_gozo_fim);
  GET DIAGNOSTICS v_entraram = ROW_COUNT;

  UPDATE employees e SET status = 'ativo'
  WHERE e.status = 'ferias'
    AND NOT EXISTS (SELECT 1 FROM ferias f WHERE f.employee_id = e.id AND hoje BETWEEN f.periodo_gozo_inicio AND f.periodo_gozo_fim);
  GET DIAGNOSTICS v_voltaram = ROW_COUNT;

  RETURN jsonb_build_object('entraram_em_ferias', v_entraram, 'voltaram', v_voltaram);
END
$fn$;

REVOKE ALL ON FUNCTION public.sincronizar_status_ferias() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sincronizar_status_ferias() TO authenticated, service_role;

-- Roda todo dia às 00:05 (horário de Brasília = 03:05 UTC)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'sincronizar-status-ferias';
    PERFORM cron.schedule('sincronizar-status-ferias', '5 3 * * *', 'SELECT public.sincronizar_status_ferias()');
  END IF;
END $$;

-- Atualiza já
SELECT public.sincronizar_status_ferias();
