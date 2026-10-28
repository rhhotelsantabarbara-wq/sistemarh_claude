-- Ficha completa do colaborador, admissão digital por link,
-- documentos com vencimento e histórico de alterações.

------------------------------------------------------------------
-- 1) Ficha completa: novos campos no cadastro
------------------------------------------------------------------
ALTER TABLE public.employees
  -- Pessoais
  ADD COLUMN IF NOT EXISTS nome_social text,
  ADD COLUMN IF NOT EXISTS estado_civil text,
  ADD COLUMN IF NOT EXISTS grau_instrucao text,
  ADD COLUMN IF NOT EXISTS email_pessoal text,
  ADD COLUMN IF NOT EXISTS pais_nascimento text,
  ADD COLUMN IF NOT EXISTS contato_emergencia_nome text,
  ADD COLUMN IF NOT EXISTS contato_emergencia_telefone text,
  ADD COLUMN IF NOT EXISTS contato_emergencia_parentesco text,
  -- Pessoa com deficiência
  ADD COLUMN IF NOT EXISTS pcd boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pcd_tipo text,
  ADD COLUMN IF NOT EXISTS pcd_reabilitado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pcd_cota boolean NOT NULL DEFAULT false,
  -- Documentos
  ADD COLUMN IF NOT EXISTS ctps_serie text,
  ADD COLUMN IF NOT EXISTS ctps_uf text,
  ADD COLUMN IF NOT EXISTS titulo_eleitor text,
  ADD COLUMN IF NOT EXISTS titulo_zona text,
  ADD COLUMN IF NOT EXISTS titulo_secao text,
  ADD COLUMN IF NOT EXISTS reservista text,
  ADD COLUMN IF NOT EXISTS cnh_numero text,
  ADD COLUMN IF NOT EXISTS cnh_categoria text,
  ADD COLUMN IF NOT EXISTS cnh_validade date,
  ADD COLUMN IF NOT EXISTS conselho_classe text,
  ADD COLUMN IF NOT EXISTS certidao text,
  -- Dados bancários
  ADD COLUMN IF NOT EXISTS banco text,
  ADD COLUMN IF NOT EXISTS agencia text,
  ADD COLUMN IF NOT EXISTS conta text,
  ADD COLUMN IF NOT EXISTS conta_tipo text,
  ADD COLUMN IF NOT EXISTS pix_chave text,
  -- Contrato e jornada
  ADD COLUMN IF NOT EXISTS experiencia_dias integer,
  ADD COLUMN IF NOT EXISTS experiencia_prorrogacao_dias integer,
  ADD COLUMN IF NOT EXISTS horas_semanais numeric,
  ADD COLUMN IF NOT EXISTS escala text,
  ADD COLUMN IF NOT EXISTS horario_trabalho text,
  ADD COLUMN IF NOT EXISTS sindicato text,
  ADD COLUMN IF NOT EXISTS primeiro_emprego boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS categoria_esocial text,
  ADD COLUMN IF NOT EXISTS insalubridade text,
  ADD COLUMN IF NOT EXISTS periculosidade boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS adicional_noturno boolean NOT NULL DEFAULT false,
  -- Organização
  ADD COLUMN IF NOT EXISTS gestor_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS centro_custo text,
  ADD COLUMN IF NOT EXISTS local_trabalho text,
  -- Benefícios
  ADD COLUMN IF NOT EXISTS vt_opta boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vt_linhas text,
  ADD COLUMN IF NOT EXISTS vt_valor_diario numeric,
  ADD COLUMN IF NOT EXISTS vale_refeicao_valor numeric,
  ADD COLUMN IF NOT EXISTS vale_alimentacao_valor numeric,
  ADD COLUMN IF NOT EXISTS plano_saude text,
  ADD COLUMN IF NOT EXISTS plano_odonto text,
  ADD COLUMN IF NOT EXISTS seguro_vida boolean NOT NULL DEFAULT false,
  -- Tamanhos (uniforme/EPI)
  ADD COLUMN IF NOT EXISTS tamanho_camisa text,
  ADD COLUMN IF NOT EXISTS tamanho_calca text,
  ADD COLUMN IF NOT EXISTS tamanho_calcado text,
  -- Saúde
  ADD COLUMN IF NOT EXISTS aso_admissional_data date,
  -- Desligamento
  ADD COLUMN IF NOT EXISTS desligamento_tipo text,
  ADD COLUMN IF NOT EXISTS desligamento_motivo text,
  ADD COLUMN IF NOT EXISTS aviso_previo text,
  ADD COLUMN IF NOT EXISTS exame_demissional_data date;

CREATE INDEX IF NOT EXISTS employees_gestor_id_idx ON public.employees (gestor_id);
CREATE INDEX IF NOT EXISTS employees_cnh_validade_idx ON public.employees (cnh_validade) WHERE cnh_validade IS NOT NULL;

------------------------------------------------------------------
-- Dependentes
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_dependentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cpf text,
  data_nascimento date,
  parentesco text,
  dependente_ir boolean NOT NULL DEFAULT false,
  salario_familia boolean NOT NULL DEFAULT false,
  plano_saude boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employee_dependentes_employee_idx ON public.employee_dependentes (employee_id);
ALTER TABLE public.employee_dependentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "RH gerencia dependentes" ON public.employee_dependentes;
CREATE POLICY "RH gerencia dependentes" ON public.employee_dependentes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'admin_parcial'))
  WITH CHECK (has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'admin_parcial'));
DROP POLICY IF EXISTS "Funcionario ve seus dependentes" ON public.employee_dependentes;
CREATE POLICY "Funcionario ve seus dependentes" ON public.employee_dependentes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM employees e WHERE e.id = employee_id AND e.user_id = auth.uid()));

------------------------------------------------------------------
-- 3a) Documentos com tipo e vencimento
------------------------------------------------------------------
ALTER TABLE public.employee_files
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS validade date;
CREATE INDEX IF NOT EXISTS employee_files_validade_idx ON public.employee_files (validade) WHERE validade IS NOT NULL;

------------------------------------------------------------------
-- 3b) Histórico de alterações do cadastro (automático)
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_alteracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  campo text NOT NULL,
  valor_anterior text,
  valor_novo text,
  alterado_por uuid,
  alterado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employee_alteracoes_employee_idx ON public.employee_alteracoes (employee_id, alterado_em DESC);
ALTER TABLE public.employee_alteracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gestor ve alteracoes" ON public.employee_alteracoes;
CREATE POLICY "Gestor ve alteracoes" ON public.employee_alteracoes
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'gestor'));
-- Administrador parcial não vê salário
DROP POLICY IF EXISTS "Admin parcial ve alteracoes sem salario" ON public.employee_alteracoes;
CREATE POLICY "Admin parcial ve alteracoes sem salario" ON public.employee_alteracoes
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin_parcial') AND campo <> 'salario');

CREATE OR REPLACE FUNCTION public.registrar_alteracoes_employee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  campos text[] := ARRAY['cargo','setor','empresa_id','salario','tipo_salario','tipo_contrato','status',
                         'gestor_id','escala','horario_trabalho','horas_semanais','centro_custo',
                         'local_trabalho','data_admissao','data_desligamento','codigo_funcionario'];
  c text;
  antes jsonb := to_jsonb(OLD);
  depois jsonb := to_jsonb(NEW);
  va text;
  vn text;
BEGIN
  FOREACH c IN ARRAY campos LOOP
    va := antes ->> c;
    vn := depois ->> c;
    IF va IS DISTINCT FROM vn THEN
      -- Entrada e saída automática de férias não é alteração de cadastro
      IF c = 'status' AND (va = 'ferias' OR vn = 'ferias') THEN CONTINUE; END IF;
      IF c = 'empresa_id' THEN
        va := (SELECT nome FROM empresas WHERE id = (antes ->> c)::uuid);
        vn := (SELECT nome FROM empresas WHERE id = (depois ->> c)::uuid);
      ELSIF c = 'gestor_id' THEN
        va := (SELECT nome_completo FROM employees WHERE id = (antes ->> c)::uuid);
        vn := (SELECT nome_completo FROM employees WHERE id = (depois ->> c)::uuid);
      END IF;
      INSERT INTO employee_alteracoes (employee_id, campo, valor_anterior, valor_novo, alterado_por)
      VALUES (NEW.id, c, va, vn, auth.uid());
    END IF;
  END LOOP;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS employees_registrar_alteracoes ON public.employees;
CREATE TRIGGER employees_registrar_alteracoes
  AFTER UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.registrar_alteracoes_employee();

------------------------------------------------------------------
-- 2) Admissão digital por link
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admissao_convites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
  nome text NOT NULL,
  telefone text,
  cpf text,
  cargo text,
  setor text,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  data_admissao_prevista date,
  status text NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando','preenchido','aprovado','cancelado')),
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  dependentes jsonb NOT NULL DEFAULT '[]'::jsonb,
  documentos jsonb NOT NULL DEFAULT '[]'::jsonb,
  observacao_rh text,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  expira_em date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 30),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  preenchido_em timestamptz,
  aprovado_em timestamptz
);
ALTER TABLE public.admissao_convites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "RH gerencia convites de admissao" ON public.admissao_convites;
CREATE POLICY "RH gerencia convites de admissao" ON public.admissao_convites
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'admin_parcial'))
  WITH CHECK (has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'admin_parcial'));

-- O link só aceita envio enquanto estiver aguardando e dentro do prazo
CREATE OR REPLACE FUNCTION public.admissao_codigo_aberto(p_codigo text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM admissao_convites
    WHERE codigo = p_codigo AND status = 'aguardando'
      AND expira_em >= (now() AT TIME ZONE 'America/Sao_Paulo')::date
  );
$fn$;

-- Abre o formulário: devolve só o que o próprio candidato precisa ver
CREATE OR REPLACE FUNCTION public.admissao_abrir(p_codigo text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  c record;
BEGIN
  SELECT a.*, e.nome AS empresa_nome INTO c
  FROM admissao_convites a LEFT JOIN empresas e ON e.id = a.empresa_id
  WHERE a.codigo = p_codigo;
  IF c.id IS NULL OR c.status = 'cancelado' THEN RETURN jsonb_build_object('erro', 'nao_encontrado'); END IF;
  IF c.status IN ('preenchido', 'aprovado') THEN
    RETURN jsonb_build_object('erro', 'enviado', 'nome', c.nome);
  END IF;
  IF c.expira_em < (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
    RETURN jsonb_build_object('erro', 'expirado', 'nome', c.nome);
  END IF;
  RETURN jsonb_build_object(
    'nome', c.nome,
    'cpf', c.cpf,
    'telefone', c.telefone,
    'cargo', c.cargo,
    'empresa', c.empresa_nome,
    'data_admissao', c.data_admissao_prevista,
    'dados', c.dados,
    'dependentes', c.dependentes,
    'documentos', c.documentos
  );
END
$fn$;

-- Salva o rascunho ou envia de vez (p_finalizar = true)
CREATE OR REPLACE FUNCTION public.admissao_salvar(p_codigo text, p_dados jsonb, p_dependentes jsonb, p_documentos jsonb, p_finalizar boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  permitidos text[] := ARRAY[
    'nome_completo','nome_social','cpf','data_nascimento','sexo','estado_civil','grau_instrucao','raca_cor',
    'nacionalidade','pais_nascimento','naturalidade_estado','naturalidade_municipio','nome_mae','nome_pai',
    'telefone','email_pessoal','contato_emergencia_nome','contato_emergencia_telefone','contato_emergencia_parentesco',
    'pcd','pcd_tipo','pcd_reabilitado',
    'rg','rg_orgao_expedidor','rg_uf','rg_data_emissao','pis','carteira_trabalho','ctps_serie','ctps_uf',
    'titulo_eleitor','titulo_zona','titulo_secao','reservista','cnh_numero','cnh_categoria','cnh_validade',
    'conselho_classe','certidao',
    'cep','endereco','endereco_numero','endereco_complemento','bairro','cidade','uf',
    'banco','agencia','conta','conta_tipo','pix_chave',
    'vt_opta','vt_linhas','primeiro_emprego',
    'tamanho_camisa','tamanho_calca','tamanho_calcado'];
  limpos jsonb;
BEGIN
  IF NOT admissao_codigo_aberto(p_codigo) THEN
    RAISE EXCEPTION 'Este link não está mais aberto. Fale com o RH.';
  END IF;
  IF p_dados IS NULL OR jsonb_typeof(p_dados) <> 'object' THEN RAISE EXCEPTION 'Dados inválidos'; END IF;
  IF p_dependentes IS NOT NULL AND jsonb_typeof(p_dependentes) <> 'array' THEN RAISE EXCEPTION 'Dependentes inválidos'; END IF;
  IF p_documentos IS NOT NULL AND jsonb_typeof(p_documentos) <> 'array' THEN RAISE EXCEPTION 'Documentos inválidos'; END IF;
  IF length(p_dados::text) > 20000 OR length(coalesce(p_dependentes, '[]')::text) > 20000 OR length(coalesce(p_documentos, '[]')::text) > 20000 THEN
    RAISE EXCEPTION 'Dados grandes demais';
  END IF;
  -- Só guarda os campos que o candidato pode preencher
  SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) INTO limpos
  FROM jsonb_each(p_dados) AS t(k, v) WHERE k = ANY (permitidos);
  -- Documentos precisam estar na pasta do próprio convite
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(p_documentos, '[]')) d
    WHERE coalesce(d ->> 'path', '') NOT LIKE p_codigo || '/%'
  ) THEN
    RAISE EXCEPTION 'Documento inválido';
  END IF;

  UPDATE admissao_convites SET
    dados = limpos,
    dependentes = coalesce(p_dependentes, '[]'),
    documentos = coalesce(p_documentos, '[]'),
    status = CASE WHEN p_finalizar THEN 'preenchido' ELSE status END,
    preenchido_em = CASE WHEN p_finalizar THEN now() ELSE preenchido_em END
  WHERE codigo = p_codigo;
  RETURN true;
END
$fn$;

REVOKE ALL ON FUNCTION public.admissao_codigo_aberto(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admissao_abrir(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admissao_salvar(text, jsonb, jsonb, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admissao_codigo_aberto(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admissao_abrir(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admissao_salvar(text, jsonb, jsonb, jsonb, boolean) TO anon, authenticated;

-- Pasta privada para as fotos dos documentos enviados pelo candidato
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('admissao-documentos', 'admissao-documentos', false, 10485760,
        ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Candidato envia documentos de admissao" ON storage.objects;
CREATE POLICY "Candidato envia documentos de admissao" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'admissao-documentos' AND public.admissao_codigo_aberto((storage.foldername(name))[1]));

DROP POLICY IF EXISTS "RH le documentos de admissao" ON storage.objects;
CREATE POLICY "RH le documentos de admissao" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'admissao-documentos' AND (has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'admin_parcial')));

DROP POLICY IF EXISTS "RH apaga documentos de admissao" ON storage.objects;
CREATE POLICY "RH apaga documentos de admissao" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'admissao-documentos' AND (has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'admin_parcial')));
