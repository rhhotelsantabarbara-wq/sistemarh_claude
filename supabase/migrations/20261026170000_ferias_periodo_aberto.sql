-- Início do período aquisitivo de férias mais antigo em aberto (vem da contabilidade).
-- Os dados são carregados pelo arquivo 11-ferias-contabilidade.sql.
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS ferias_periodo_aberto_inicio date;
