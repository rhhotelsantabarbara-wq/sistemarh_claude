-- Cria o login de todos os colaboradores com CPF e define a senha = CPF (só números).
-- Quem já tinha login também passa a ter senha = CPF.
-- Contas de gestor/administrador NÃO são alteradas (segurança).
-- O login fica "funcionario.<cpf>@rhsantabarbara.app", que é o que a tela de entrada usa.

CREATE SCHEMA IF NOT EXISTS importacao;
DROP TABLE IF EXISTS importacao.logins_cpf;

-- 1) Um login por CPF (se o CPF aparece em mais de um cadastro, vale o mais recente que não foi desligado)
CREATE TABLE importacao.logins_cpf AS
SELECT DISTINCT ON (regexp_replace(e.cpf, '\D', '', 'g'))
  e.id AS employee_id,
  e.nome_completo,
  e.user_id,
  regexp_replace(e.cpf, '\D', '', 'g') AS cpf_limpo,
  NULL::uuid AS alvo,
  NULL::text AS acao
FROM public.employees e
WHERE length(regexp_replace(coalesce(e.cpf, ''), '\D', '', 'g')) = 11
ORDER BY regexp_replace(e.cpf, '\D', '', 'g'), (e.status = 'demitido'), e.data_admissao DESC NULLS LAST;

-- 2) Conta que já existe: primeiro a que já usa esse CPF no login (é a que a tela de entrada procura),
--    depois a que está ligada ao cadastro
UPDATE importacao.logins_cpf l SET alvo = u.id
FROM auth.users u
WHERE lower(u.email) = 'funcionario.' || l.cpf_limpo || '@rhsantabarbara.app';

UPDATE importacao.logins_cpf l SET alvo = l.user_id
WHERE l.alvo IS NULL AND l.user_id IS NOT NULL AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = l.user_id);

-- 3) Não mexe em contas de gestor / administrador
UPDATE importacao.logins_cpf l SET acao = 'ignorado: conta de gestor/admin'
WHERE l.alvo IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = l.alvo AND r.role <> 'funcionario');

-- 4) Quem não tem conta: cria
UPDATE importacao.logins_cpf SET alvo = gen_random_uuid(), acao = 'criado'
WHERE alvo IS NULL;
UPDATE importacao.logins_cpf SET acao = 'senha redefinida'
WHERE acao IS NULL;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token,
  is_sso_user, is_anonymous
)
SELECT
  '00000000-0000-0000-0000-000000000000', l.alvo, 'authenticated', 'authenticated',
  'funcionario.' || l.cpf_limpo || '@rhsantabarbara.app',
  extensions.crypt(l.cpf_limpo, extensions.gen_salt('bf', 10)),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', 'funcionario'),
  jsonb_build_object('nome_completo', l.nome_completo, 'role', 'funcionario', 'email_verified', true),
  now(), now(),
  '', '', '', '', '', '', '', '',
  false, false
FROM importacao.logins_cpf l
WHERE l.acao = 'criado';

INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), l.alvo, l.alvo::text, 'email',
  jsonb_build_object('sub', l.alvo::text, 'email', 'funcionario.' || l.cpf_limpo || '@rhsantabarbara.app', 'email_verified', true, 'phone_verified', false),
  NULL, now(), now()
FROM importacao.logins_cpf l
WHERE l.acao = 'criado'
ON CONFLICT (provider_id, provider) DO NOTHING;

-- 5) Quem já tinha conta: senha = CPF e login ajustado ao CPF atual (se ninguém mais usa esse e-mail)
UPDATE auth.users u SET
  encrypted_password = extensions.crypt(l.cpf_limpo, extensions.gen_salt('bf', 10)),
  email_confirmed_at = coalesce(u.email_confirmed_at, now()),
  banned_until = NULL,
  updated_at = now()
FROM importacao.logins_cpf l
WHERE u.id = l.alvo AND l.acao = 'senha redefinida';

UPDATE auth.users u SET email = 'funcionario.' || l.cpf_limpo || '@rhsantabarbara.app', updated_at = now()
FROM importacao.logins_cpf l
WHERE u.id = l.alvo AND l.acao = 'senha redefinida'
  AND lower(coalesce(u.email, '')) <> 'funcionario.' || l.cpf_limpo || '@rhsantabarbara.app'
  AND (u.email IS NULL OR u.email ILIKE '%@rhsantabarbara.app')
  AND NOT EXISTS (SELECT 1 FROM auth.users o WHERE lower(o.email) = 'funcionario.' || l.cpf_limpo || '@rhsantabarbara.app' AND o.id <> u.id);

UPDATE auth.identities i SET
  identity_data = i.identity_data || jsonb_build_object('email', u.email),
  updated_at = now()
FROM auth.users u, importacao.logins_cpf l
WHERE i.user_id = u.id AND u.id = l.alvo AND l.acao = 'senha redefinida' AND i.provider = 'email';

-- Contas antigas sem "identidade" de e-mail não conseguem entrar: cria se faltar
INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
SELECT gen_random_uuid(), u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false), now(), now()
FROM auth.users u JOIN importacao.logins_cpf l ON l.alvo = u.id AND l.acao = 'senha redefinida'
WHERE NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email')
ON CONFLICT (provider_id, provider) DO NOTHING;

-- Todo login de colaborador precisa do papel "funcionario"
INSERT INTO public.user_roles (user_id, role)
SELECT l.alvo, 'funcionario' FROM importacao.logins_cpf l
WHERE l.acao IN ('criado', 'senha redefinida')
  AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = l.alvo);

-- 6) Liga o login ao cadastro (todos os cadastros com aquele CPF)
UPDATE public.employees e SET user_id = l.alvo
FROM importacao.logins_cpf l
WHERE l.acao IN ('criado', 'senha redefinida')
  AND regexp_replace(coalesce(e.cpf, ''), '\D', '', 'g') = l.cpf_limpo
  AND e.user_id IS DISTINCT FROM l.alvo
  AND (e.user_id IS NULL OR e.id = l.employee_id OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = e.user_id));

-- 7) Resumo
SELECT acao AS resultado, count(*) AS colaboradores FROM importacao.logins_cpf GROUP BY acao ORDER BY acao;
