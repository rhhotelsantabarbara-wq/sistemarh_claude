-- Descrição da aparência de cada foto de funcionário, gerada uma vez pela IA de visão.
-- Usada pela busca "quem tem barba/óculos..." do Cérebrum no WhatsApp para não reanalisar
-- todas as fotos a cada pergunta. Só a função do servidor (chave de serviço) lê e grava.
CREATE TABLE IF NOT EXISTS public.funcionario_foto_descricao (
  employee_id uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  foto_url text NOT NULL,
  descricao text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.funcionario_foto_descricao ENABLE ROW LEVEL SECURITY;
