-- Conexão própria com o Google Drive (substitui o conector da Lovable).
-- Tabelas acessíveis apenas pelas edge functions (service role): RLS ligado e sem políticas.

CREATE TABLE IF NOT EXISTS public.google_drive_conexao (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  refresh_token text NOT NULL,
  email text,
  nome text,
  conectado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  conectado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.google_drive_conexao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_drive_conexao FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.google_drive_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  retorno text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.google_drive_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_drive_oauth_states FROM anon, authenticated;
