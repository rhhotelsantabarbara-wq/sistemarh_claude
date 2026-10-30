-- Atestados enviados pelo colaborador no portal (celular). O RH confere e aprova:
-- ao aprovar, vira um afastamento normal.

CREATE TABLE IF NOT EXISTS public.atestados_enviados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  data_inicio date NOT NULL,
  dias integer NOT NULL CHECK (dias BETWEEN 1 AND 365),
  tipo text NOT NULL DEFAULT 'Atestado médico',
  observacao text,
  arquivo_path text NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'recusado')),
  resposta_rh text,
  cid text,
  afastamento_id uuid REFERENCES public.afastamentos(id) ON DELETE SET NULL,
  analisado_por uuid,
  analisado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS atestados_enviados_status_idx ON public.atestados_enviados (status, created_at DESC);
CREATE INDEX IF NOT EXISTS atestados_enviados_employee_idx ON public.atestados_enviados (employee_id, created_at DESC);
ALTER TABLE public.atestados_enviados ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atestados_enviados TO authenticated;

DROP POLICY IF EXISTS "RH gerencia atestados enviados" ON public.atestados_enviados;
CREATE POLICY "RH gerencia atestados enviados" ON public.atestados_enviados
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'admin_parcial'))
  WITH CHECK (has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'admin_parcial'));

DROP POLICY IF EXISTS "Colaborador ve seus atestados" ON public.atestados_enviados;
CREATE POLICY "Colaborador ve seus atestados" ON public.atestados_enviados
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM employees e WHERE e.id = employee_id AND e.user_id = auth.uid()));

-- O colaborador só cria atestado pendente, para ele mesmo, com arquivo na própria pasta
DROP POLICY IF EXISTS "Colaborador envia atestado" ON public.atestados_enviados;
CREATE POLICY "Colaborador envia atestado" ON public.atestados_enviados
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'pendente' AND afastamento_id IS NULL AND analisado_por IS NULL
    AND EXISTS (SELECT 1 FROM employees e WHERE e.id = employee_id AND e.user_id = auth.uid())
    AND arquivo_path LIKE employee_id::text || '/%'
  );

-- Pasta privada das fotos dos atestados: <employee_id>/<arquivo>
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('atestados', 'atestados', false, 10485760,
        ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Colaborador envia foto do atestado" ON storage.objects;
CREATE POLICY "Colaborador envia foto do atestado" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'atestados'
    AND EXISTS (SELECT 1 FROM public.employees e WHERE e.id::text = (storage.foldername(name))[1] AND e.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Colaborador ve foto do proprio atestado" ON storage.objects;
CREATE POLICY "Colaborador ve foto do proprio atestado" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'atestados'
    AND EXISTS (SELECT 1 FROM public.employees e WHERE e.id::text = (storage.foldername(name))[1] AND e.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "RH ve fotos de atestados" ON storage.objects;
CREATE POLICY "RH ve fotos de atestados" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'atestados' AND (public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'admin_parcial')));

DROP POLICY IF EXISTS "RH apaga fotos de atestados" ON storage.objects;
CREATE POLICY "RH apaga fotos de atestados" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'atestados' AND (public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'admin_parcial')));
