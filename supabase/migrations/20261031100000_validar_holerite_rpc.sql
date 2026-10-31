-- Validação pública do comprovante de assinatura (QR code), direto no banco.
-- Cobre os holerites em PDF (holerite_documentos) e os antigos (holerite_assinaturas).
-- Devolve só dados mascarados: nome abreviado e CPF parcial.
CREATE OR REPLACE FUNCTION public.validar_holerite(p_protocolo text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  r record;
  nome text;
  cpf text;
  partes text[];
BEGIN
  IF p_protocolo IS NULL OR length(p_protocolo) < 8 THEN
    RETURN jsonb_build_object('valido', false, 'erro', 'Protocolo inválido');
  END IF;

  SELECT d.protocolo, d.hash_documento, d.hash_assinatura, d.data_assinatura, d.mes, d.ano,
         e.nome_completo AS nome, e.cpf AS cpf, em.nome AS empresa, em.cnpj AS cnpj
    INTO r
    FROM holerite_documentos d
    LEFT JOIN employees e ON e.id = d.employee_id
    LEFT JOIN empresas em ON em.id = d.empresa_id
   WHERE d.protocolo = p_protocolo AND d.status = 'assinado'
   LIMIT 1;

  IF r.protocolo IS NULL THEN
    SELECT a.protocolo, a.hash_documento, a.hash_assinatura, a.data_assinatura, f.mes, f.ano,
           a.nome_completo AS nome, a.cpf AS cpf, em.nome AS empresa, em.cnpj AS cnpj
      INTO r
      FROM holerite_assinaturas a
      LEFT JOIN folha_pagamento f ON f.id = a.folha_pagamento_id
      LEFT JOIN empresas em ON em.id = a.empresa_id
     WHERE a.protocolo = p_protocolo AND a.status = 'assinado'
     LIMIT 1;
  END IF;

  IF r.protocolo IS NULL THEN
    RETURN jsonb_build_object('valido', false, 'erro', 'Documento não encontrado');
  END IF;

  partes := regexp_split_to_array(trim(coalesce(r.nome, '')), '\s+');
  nome := CASE WHEN array_length(partes, 1) > 1
               THEN partes[1] || ' ' || (SELECT string_agg(left(p, 1) || '.', ' ') FROM unnest(partes[2:]) p)
               ELSE partes[1] END;
  cpf := regexp_replace(coalesce(r.cpf, ''), '\D', '', 'g');
  cpf := CASE WHEN length(cpf) = 11 THEN '***.' || substr(cpf, 4, 3) || '.' || substr(cpf, 7, 3) || '-**' ELSE NULL END;

  RETURN jsonb_build_object(
    'valido', true,
    'protocolo', r.protocolo,
    'hash_documento', r.hash_documento,
    'hash_assinatura', r.hash_assinatura,
    'signatario_nome', nome,
    'signatario_cpf', cpf,
    'empresa', r.empresa,
    'cnpj', r.cnpj,
    'periodo', CASE WHEN r.mes IS NOT NULL THEN lpad(r.mes::text, 2, '0') || '/' || r.ano ELSE NULL END,
    'data_assinatura', r.data_assinatura
  );
END
$fn$;

REVOKE ALL ON FUNCTION public.validar_holerite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validar_holerite(text) TO anon, authenticated;
