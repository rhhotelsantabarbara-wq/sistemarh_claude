-- Revogar administrador: a tabela user_roles não aceita alteração direta pelo navegador
-- (por segurança), então o botão "excluir" não fazia nada. Esta função faz o serviço,
-- só para gestor.
-- - Se a conta é de um funcionário cadastrado: volta a ser só funcionário.
-- - Se a conta não é de nenhum funcionário (ex.: login "admin.<cpf>" duplicado): a conta é apagada.
CREATE OR REPLACE FUNCTION public.revogar_admin(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT has_role(auth.uid(), 'gestor') THEN
    RAISE EXCEPTION 'Apenas gestores podem remover administradores';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode remover o seu próprio acesso';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_user_id AND role = 'admin_parcial') THEN
    RAISE EXCEPTION 'Este usuário não é administrador';
  END IF;

  DELETE FROM admin_module_permissions WHERE user_id = p_user_id;

  IF EXISTS (SELECT 1 FROM employees WHERE user_id = p_user_id) THEN
    UPDATE user_roles SET role = 'funcionario' WHERE user_id = p_user_id AND role = 'admin_parcial';
    RETURN 'rebaixado';
  END IF;

  DELETE FROM user_roles WHERE user_id = p_user_id AND role = 'admin_parcial';
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_user_id) THEN
    DELETE FROM auth.users WHERE id = p_user_id;
    RETURN 'excluido';
  END IF;
  RETURN 'removido';
END
$fn$;

REVOKE ALL ON FUNCTION public.revogar_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revogar_admin(uuid) TO authenticated;
