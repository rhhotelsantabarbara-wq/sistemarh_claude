export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      adiantamentos: {
        Row: {
          ano: number
          created_at: string
          created_by: string | null
          employee_id: string
          empresa_id: string
          forma_pagamento: string
          id: string
          mes: number
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          ano: number
          created_at?: string
          created_by?: string | null
          employee_id: string
          empresa_id: string
          forma_pagamento: string
          id?: string
          mes: number
          status?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          ano?: number
          created_at?: string
          created_by?: string | null
          employee_id?: string
          empresa_id?: string
          forma_pagamento?: string
          id?: string
          mes?: number
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "adiantamentos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adiantamentos_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adiantamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_module_permissions: {
        Row: {
          created_at: string
          id: string
          module_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          module_key?: string
          user_id?: string
        }
        Relationships: []
      }
      afastamentos: {
        Row: {
          cid: string | null
          created_at: string | null
          created_by: string | null
          data_fim: string
          data_inicio: string
          documento_url: string | null
          employee_id: string
          id: string
          motivo: string
        }
        Insert: {
          cid?: string | null
          created_at?: string | null
          created_by?: string | null
          data_fim: string
          data_inicio: string
          documento_url?: string | null
          employee_id: string
          id?: string
          motivo: string
        }
        Update: {
          cid?: string | null
          created_at?: string | null
          created_by?: string | null
          data_fim?: string
          data_inicio?: string
          documento_url?: string | null
          employee_id?: string
          id?: string
          motivo?: string
        }
        Relationships: [
          {
            foreignKeyName: "afastamentos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afastamentos_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      aulas: {
        Row: {
          created_at: string | null
          descricao: string | null
          duracao_minutos: number | null
          id: string
          modulo_id: string
          ordem: number
          titulo: string
          youtube_url: string
          youtube_video_id: string
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          duracao_minutos?: number | null
          id?: string
          modulo_id: string
          ordem?: number
          titulo: string
          youtube_url: string
          youtube_video_id: string
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          duracao_minutos?: number | null
          id?: string
          modulo_id?: string
          ordem?: number
          titulo?: string
          youtube_url?: string
          youtube_video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aulas_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes_desempenho: {
        Row: {
          auto_avaliacao_concluida: boolean | null
          avaliacao_gestor_concluida: boolean | null
          avaliador_id: string | null
          created_at: string | null
          employee_id: string
          id: string
          nota_final: number | null
          observacoes: string | null
          periodo_fim: string
          periodo_inicio: string
          status: string
          tipo: string
          updated_at: string | null
        }
        Insert: {
          auto_avaliacao_concluida?: boolean | null
          avaliacao_gestor_concluida?: boolean | null
          avaliador_id?: string | null
          created_at?: string | null
          employee_id: string
          id?: string
          nota_final?: number | null
          observacoes?: string | null
          periodo_fim: string
          periodo_inicio: string
          status?: string
          tipo: string
          updated_at?: string | null
        }
        Update: {
          auto_avaliacao_concluida?: boolean | null
          avaliacao_gestor_concluida?: boolean | null
          avaliador_id?: string | null
          created_at?: string | null
          employee_id?: string
          id?: string
          nota_final?: number | null
          observacoes?: string | null
          periodo_fim?: string
          periodo_inicio?: string
          status?: string
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_desempenho_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      avisos: {
        Row: {
          anexo_url: string | null
          categoria: string | null
          created_at: string | null
          created_by: string | null
          data_expiracao: string
          data_publicacao: string | null
          empresa_id: string | null
          funcionarios_ids: string[] | null
          id: string
          mensagem: string
          prioridade: string | null
          setores: string[]
          tipo_destinatario: string | null
        }
        Insert: {
          anexo_url?: string | null
          categoria?: string | null
          created_at?: string | null
          created_by?: string | null
          data_expiracao: string
          data_publicacao?: string | null
          empresa_id?: string | null
          funcionarios_ids?: string[] | null
          id?: string
          mensagem: string
          prioridade?: string | null
          setores: string[]
          tipo_destinatario?: string | null
        }
        Update: {
          anexo_url?: string | null
          categoria?: string | null
          created_at?: string | null
          created_by?: string | null
          data_expiracao?: string
          data_publicacao?: string | null
          empresa_id?: string | null
          funcionarios_ids?: string[] | null
          id?: string
          mensagem?: string
          prioridade?: string | null
          setores?: string[]
          tipo_destinatario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avisos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avisos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      avisos_leituras: {
        Row: {
          aviso_id: string
          employee_id: string
          id: string
          lido_em: string | null
        }
        Insert: {
          aviso_id: string
          employee_id: string
          id?: string
          lido_em?: string | null
        }
        Update: {
          aviso_id?: string
          employee_id?: string
          id?: string
          lido_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avisos_leituras_aviso_id_fkey"
            columns: ["aviso_id"]
            isOneToOne: false
            referencedRelation: "avisos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avisos_leituras_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      banco_horas: {
        Row: {
          created_at: string | null
          employee_id: string
          id: string
          saldo_horas: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          employee_id: string
          id?: string
          saldo_horas?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          employee_id?: string
          id?: string
          saldo_horas?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banco_horas_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      candidaturas: {
        Row: {
          avaliacao_gestor: string | null
          avaliado_por: string | null
          carta_apresentacao: string | null
          cpf: string
          created_at: string | null
          curriculum_url: string | null
          data_avaliacao: string | null
          data_candidatura: string | null
          data_entrevista: string | null
          data_nascimento: string
          email: string
          endereco: string | null
          experiencia_resumo: string | null
          id: string
          motivo_reprovacao: string | null
          nome_completo: string
          nota_avaliacao: number | null
          status: Database["public"]["Enums"]["candidatura_status"] | null
          telefone: string
          updated_at: string | null
          vaga_id: string
        }
        Insert: {
          avaliacao_gestor?: string | null
          avaliado_por?: string | null
          carta_apresentacao?: string | null
          cpf: string
          created_at?: string | null
          curriculum_url?: string | null
          data_avaliacao?: string | null
          data_candidatura?: string | null
          data_entrevista?: string | null
          data_nascimento: string
          email: string
          endereco?: string | null
          experiencia_resumo?: string | null
          id?: string
          motivo_reprovacao?: string | null
          nome_completo: string
          nota_avaliacao?: number | null
          status?: Database["public"]["Enums"]["candidatura_status"] | null
          telefone: string
          updated_at?: string | null
          vaga_id: string
        }
        Update: {
          avaliacao_gestor?: string | null
          avaliado_por?: string | null
          carta_apresentacao?: string | null
          cpf?: string
          created_at?: string | null
          curriculum_url?: string | null
          data_avaliacao?: string | null
          data_candidatura?: string | null
          data_entrevista?: string | null
          data_nascimento?: string
          email?: string
          endereco?: string | null
          experiencia_resumo?: string | null
          id?: string
          motivo_reprovacao?: string | null
          nome_completo?: string
          nota_avaliacao?: number | null
          status?: Database["public"]["Enums"]["candidatura_status"] | null
          telefone?: string
          updated_at?: string | null
          vaga_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidaturas_avaliado_por_fkey"
            columns: ["avaliado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidaturas_vaga_id_fkey"
            columns: ["vaga_id"]
            isOneToOne: false
            referencedRelation: "vagas"
            referencedColumns: ["id"]
          },
        ]
      }
      cerebrum_memorias: {
        Row: {
          ativo: boolean
          categoria: string
          conteudo: string
          contexto: string | null
          created_at: string
          ensinado_por: string | null
          id: string
          nome_professor: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          conteudo: string
          contexto?: string | null
          created_at?: string
          ensinado_por?: string | null
          id?: string
          nome_professor?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          conteudo?: string
          contexto?: string | null
          created_at?: string
          ensinado_por?: string | null
          id?: string
          nome_professor?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      certificados_liberados: {
        Row: {
          created_at: string
          curso_id: string
          data_conclusao: string
          data_liberacao: string
          employee_id: string
          id: string
          liberado_por: string | null
        }
        Insert: {
          created_at?: string
          curso_id: string
          data_conclusao: string
          data_liberacao?: string
          employee_id: string
          id?: string
          liberado_por?: string | null
        }
        Update: {
          created_at?: string
          curso_id?: string
          data_conclusao?: string
          data_liberacao?: string
          employee_id?: string
          id?: string
          liberado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificados_liberados_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificados_liberados_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      ciclos_avaliacao: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          created_by: string | null
          criar_metas: boolean | null
          data_inicio: string
          data_proxima_execucao: string
          dias_para_conclusao: number | null
          empresa_id: string | null
          funcao_id: string | null
          id: string
          nome: string
          setor_id: string | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          created_by?: string | null
          criar_metas?: boolean | null
          data_inicio: string
          data_proxima_execucao: string
          dias_para_conclusao?: number | null
          empresa_id?: string | null
          funcao_id?: string | null
          id?: string
          nome: string
          setor_id?: string | null
          tipo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          created_by?: string | null
          criar_metas?: boolean | null
          data_inicio?: string
          data_proxima_execucao?: string
          dias_para_conclusao?: number | null
          empresa_id?: string | null
          funcao_id?: string | null
          id?: string
          nome?: string
          setor_id?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ciclos_avaliacao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ciclos_avaliacao_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ciclos_avaliacao_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracao_alertas_experiencia: {
        Row: {
          ativo: boolean
          created_at: string
          dias_antecedencia: number
          id: string
          marcos_dias: number[]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dias_antecedencia?: number
          id?: string
          marcos_dias?: number[]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dias_antecedencia?: number
          id?: string
          marcos_dias?: number[]
          updated_at?: string
        }
        Relationships: []
      }
      configuracao_alertas_ponto: {
        Row: {
          alerta_atraso_ativo: boolean
          alerta_banco_horas_ativo: boolean
          alerta_intervalo_curto_ativo: boolean
          alerta_intervalo_longo_ativo: boolean
          alerta_saida_antecipada_ativo: boolean
          banco_horas_max: number
          banco_horas_min: number
          created_at: string
          hora_entrada_padrao: string
          hora_saida_padrao: string
          id: string
          intervalo_max_minutos: number
          intervalo_min_minutos: number
          janela_dias: number
          ocorrencias_minimas: number
          tolerancia_atraso_minutos: number
          tolerancia_saida_minutos: number
          updated_at: string
        }
        Insert: {
          alerta_atraso_ativo?: boolean
          alerta_banco_horas_ativo?: boolean
          alerta_intervalo_curto_ativo?: boolean
          alerta_intervalo_longo_ativo?: boolean
          alerta_saida_antecipada_ativo?: boolean
          banco_horas_max?: number
          banco_horas_min?: number
          created_at?: string
          hora_entrada_padrao?: string
          hora_saida_padrao?: string
          id?: string
          intervalo_max_minutos?: number
          intervalo_min_minutos?: number
          janela_dias?: number
          ocorrencias_minimas?: number
          tolerancia_atraso_minutos?: number
          tolerancia_saida_minutos?: number
          updated_at?: string
        }
        Update: {
          alerta_atraso_ativo?: boolean
          alerta_banco_horas_ativo?: boolean
          alerta_intervalo_curto_ativo?: boolean
          alerta_intervalo_longo_ativo?: boolean
          alerta_saida_antecipada_ativo?: boolean
          banco_horas_max?: number
          banco_horas_min?: number
          created_at?: string
          hora_entrada_padrao?: string
          hora_saida_padrao?: string
          id?: string
          intervalo_max_minutos?: number
          intervalo_min_minutos?: number
          janela_dias?: number
          ocorrencias_minimas?: number
          tolerancia_atraso_minutos?: number
          tolerancia_saida_minutos?: number
          updated_at?: string
        }
        Relationships: []
      }
      configuracao_holerite_diferenca: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          incluir_liquido_holerite: boolean
          updated_at: string
          variaveis_desconto_ids: string[]
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          incluir_liquido_holerite?: boolean
          updated_at?: string
          variaveis_desconto_ids?: string[]
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          incluir_liquido_holerite?: boolean
          updated_at?: string
          variaveis_desconto_ids?: string[]
        }
        Relationships: []
      }
      configuracao_horas_trabalho: {
        Row: {
          created_at: string | null
          employee_id: string
          hora_entrada_prevista: string | null
          hora_saida_prevista: string | null
          horas_diarias_esperadas: number
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          employee_id: string
          hora_entrada_prevista?: string | null
          hora_saida_prevista?: string | null
          horas_diarias_esperadas?: number
          id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          employee_id?: string
          hora_entrada_prevista?: string | null
          hora_saida_prevista?: string | null
          horas_diarias_esperadas?: number
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "configuracao_horas_trabalho_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracao_setor: {
        Row: {
          alertas_ativos: boolean
          created_at: string | null
          id: string
          quantidade_media: number
          setor_id: string
          updated_at: string | null
        }
        Insert: {
          alertas_ativos?: boolean
          created_at?: string | null
          id?: string
          quantidade_media?: number
          setor_id: string
          updated_at?: string | null
        }
        Update: {
          alertas_ativos?: boolean
          created_at?: string | null
          id?: string
          quantidade_media?: number
          setor_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "configuracao_setor_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: true
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_dashboard_funcionario: {
        Row: {
          avisos_visivel: boolean
          banco_horas_visivel: boolean
          created_at: string | null
          epis_visivel: boolean
          ferias_visivel: boolean
          folgas_visivel: boolean
          holerite_visivel: boolean
          id: string
          saldo_horas_visivel: boolean
          tacs_visivel: boolean
          tipos_contrato_permitidos: string[]
          treinamentos_visivel: boolean
          uniformes_visivel: boolean
          updated_at: string | null
        }
        Insert: {
          avisos_visivel?: boolean
          banco_horas_visivel?: boolean
          created_at?: string | null
          epis_visivel?: boolean
          ferias_visivel?: boolean
          folgas_visivel?: boolean
          holerite_visivel?: boolean
          id?: string
          saldo_horas_visivel?: boolean
          tacs_visivel?: boolean
          tipos_contrato_permitidos?: string[]
          treinamentos_visivel?: boolean
          uniformes_visivel?: boolean
          updated_at?: string | null
        }
        Update: {
          avisos_visivel?: boolean
          banco_horas_visivel?: boolean
          created_at?: string | null
          epis_visivel?: boolean
          ferias_visivel?: boolean
          folgas_visivel?: boolean
          holerite_visivel?: boolean
          id?: string
          saldo_horas_visivel?: boolean
          tacs_visivel?: boolean
          tipos_contrato_permitidos?: string[]
          treinamentos_visivel?: boolean
          uniformes_visivel?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      configuracoes_ferias: {
        Row: {
          cobertura_minima: number | null
          created_at: string | null
          empresa_id: string | null
          funcionarios_chave: string[] | null
          id: string
          percentual_maximo_ausencia: number | null
          setor_id: string | null
          updated_at: string | null
        }
        Insert: {
          cobertura_minima?: number | null
          created_at?: string | null
          empresa_id?: string | null
          funcionarios_chave?: string[] | null
          id?: string
          percentual_maximo_ausencia?: number | null
          setor_id?: string | null
          updated_at?: string | null
        }
        Update: {
          cobertura_minima?: number | null
          created_at?: string | null
          empresa_id?: string | null
          funcionarios_chave?: string[] | null
          id?: string
          percentual_maximo_ausencia?: number | null
          setor_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      configuracoes_ia: {
        Row: {
          created_at: string
          google_gemini_api_key: string | null
          id: string
          modelo: string | null
          openai_api_key: string | null
          provedor: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          google_gemini_api_key?: string | null
          id?: string
          modelo?: string | null
          openai_api_key?: string | null
          provedor?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          google_gemini_api_key?: string | null
          id?: string
          modelo?: string | null
          openai_api_key?: string | null
          provedor?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      configuracoes_whatsapp: {
        Row: {
          created_at: string
          evolution_api_key: string | null
          evolution_api_url: string | null
          evolution_instance_name: string | null
          horario_lembrete: string | null
          id: string
          lembrete_ativo: boolean | null
          numero_lembrete: string | null
          numeros_eventos_globais: string | null
          updated_at: string
          whatsapp_allowed_numbers: string | null
        }
        Insert: {
          created_at?: string
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_instance_name?: string | null
          horario_lembrete?: string | null
          id?: string
          lembrete_ativo?: boolean | null
          numero_lembrete?: string | null
          numeros_eventos_globais?: string | null
          updated_at?: string
          whatsapp_allowed_numbers?: string | null
        }
        Update: {
          created_at?: string
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_instance_name?: string | null
          horario_lembrete?: string | null
          id?: string
          lembrete_ativo?: boolean | null
          numero_lembrete?: string | null
          numeros_eventos_globais?: string | null
          updated_at?: string
          whatsapp_allowed_numbers?: string | null
        }
        Relationships: []
      }
      consultas_judiciais: {
        Row: {
          consultado_por: string | null
          created_at: string
          data_consulta: string
          employee_id: string
          id: string
          processos_encontrados: number
          resultado: Json | null
          resumo: string | null
        }
        Insert: {
          consultado_por?: string | null
          created_at?: string
          data_consulta?: string
          employee_id: string
          id?: string
          processos_encontrados?: number
          resultado?: Json | null
          resumo?: string | null
        }
        Update: {
          consultado_por?: string | null
          created_at?: string
          data_consulta?: string
          employee_id?: string
          id?: string
          processos_encontrados?: number
          resultado?: Json | null
          resumo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultas_judiciais_consultado_por_fkey"
            columns: ["consultado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultas_judiciais_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      cracha_templates: {
        Row: {
          altura: number
          background_url: string | null
          configuracao_json: Json
          created_at: string
          created_by: string | null
          empresa_id: string | null
          id: string
          largura: number
          nome: string
          orientacao: string
          updated_at: string
        }
        Insert: {
          altura?: number
          background_url?: string | null
          configuracao_json?: Json
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          id?: string
          largura?: number
          nome: string
          orientacao?: string
          updated_at?: string
        }
        Update: {
          altura?: number
          background_url?: string | null
          configuracao_json?: Json
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          id?: string
          largura?: number
          nome?: string
          orientacao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cracha_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cracha_templates_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      criterios_avaliacao: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          funcao_id: string | null
          id: string
          nome: string
          peso: number | null
          setor_id: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          funcao_id?: string | null
          id?: string
          nome: string
          peso?: number | null
          setor_id?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          funcao_id?: string | null
          id?: string
          nome?: string
          peso?: number | null
          setor_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "criterios_avaliacao_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "criterios_avaliacao_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      cursos: {
        Row: {
          ativo: boolean | null
          carga_horaria: number | null
          created_at: string | null
          descricao: string | null
          empresa_id: string | null
          funcao_id: string | null
          id: string
          obrigatorio: boolean | null
          setor_id: string | null
          titulo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          carga_horaria?: number | null
          created_at?: string | null
          descricao?: string | null
          empresa_id?: string | null
          funcao_id?: string | null
          id?: string
          obrigatorio?: boolean | null
          setor_id?: string | null
          titulo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          carga_horaria?: number | null
          created_at?: string | null
          descricao?: string | null
          empresa_id?: string | null
          funcao_id?: string | null
          id?: string
          obrigatorio?: boolean | null
          setor_id?: string | null
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cursos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cursos_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cursos_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_backup_config: {
        Row: {
          ativo: boolean
          created_at: string
          id: number
          pasta_raiz_id: string | null
          pasta_raiz_nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: number
          pasta_raiz_id?: string | null
          pasta_raiz_nome?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: number
          pasta_raiz_id?: string | null
          pasta_raiz_nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      drive_backup_log: {
        Row: {
          created_at: string
          drive_file_id: string | null
          drive_url: string | null
          employee_id: string | null
          erro_mensagem: string | null
          id: string
          nome_arquivo: string
          status: string
          tamanho_bytes: number | null
          tipo: string
        }
        Insert: {
          created_at?: string
          drive_file_id?: string | null
          drive_url?: string | null
          employee_id?: string | null
          erro_mensagem?: string | null
          id?: string
          nome_arquivo: string
          status?: string
          tamanho_bytes?: number | null
          tipo: string
        }
        Update: {
          created_at?: string
          drive_file_id?: string | null
          drive_url?: string | null
          employee_id?: string | null
          erro_mensagem?: string | null
          id?: string
          nome_arquivo?: string
          status?: string
          tamanho_bytes?: number | null
          tipo?: string
        }
        Relationships: []
      }
      drive_folder_cache: {
        Row: {
          caminho: string
          created_at: string
          drive_folder_id: string
        }
        Insert: {
          caminho: string
          created_at?: string
          drive_folder_id: string
        }
        Update: {
          caminho?: string
          created_at?: string
          drive_folder_id?: string
        }
        Relationships: []
      }
      employee_files: {
        Row: {
          categoria: string | null
          validade: string | null
          created_at: string
          description: string | null
          employee_id: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          uploaded_by: string | null
        }
        Insert: {
          categoria?: string | null
          validade?: string | null
          created_at?: string
          description?: string | null
          employee_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          categoria?: string | null
          validade?: string | null
          created_at?: string
          description?: string | null
          employee_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_files_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          nome_social: string | null
          estado_civil: string | null
          grau_instrucao: string | null
          email_pessoal: string | null
          pais_nascimento: string | null
          contato_emergencia_nome: string | null
          contato_emergencia_telefone: string | null
          contato_emergencia_parentesco: string | null
          pcd: boolean
          pcd_tipo: string | null
          pcd_reabilitado: boolean
          pcd_cota: boolean
          ctps_serie: string | null
          ctps_uf: string | null
          titulo_eleitor: string | null
          titulo_zona: string | null
          titulo_secao: string | null
          reservista: string | null
          cnh_numero: string | null
          cnh_categoria: string | null
          cnh_validade: string | null
          conselho_classe: string | null
          certidao: string | null
          banco: string | null
          agencia: string | null
          conta: string | null
          conta_tipo: string | null
          pix_chave: string | null
          experiencia_dias: number | null
          experiencia_prorrogacao_dias: number | null
          horas_semanais: number | null
          escala: string | null
          horario_trabalho: string | null
          sindicato: string | null
          primeiro_emprego: boolean
          categoria_esocial: string | null
          insalubridade: string | null
          periculosidade: boolean
          adicional_noturno: boolean
          gestor_id: string | null
          centro_custo: string | null
          local_trabalho: string | null
          vt_opta: boolean
          vt_linhas: string | null
          vt_valor_diario: number | null
          vale_refeicao_valor: number | null
          vale_alimentacao_valor: number | null
          plano_saude: string | null
          plano_odonto: string | null
          seguro_vida: boolean
          tamanho_camisa: string | null
          tamanho_calca: string | null
          tamanho_calcado: string | null
          aso_admissional_data: string | null
          desligamento_tipo: string | null
          desligamento_motivo: string | null
          aviso_previo: string | null
          exame_demissional_data: string | null
          bairro: string | null
          cargo: string
          carteira_trabalho: string | null
          cep: string | null
          cidade: string | null
          codigo_funcionario: string | null
          cpf: string | null
          created_at: string | null
          data_admissao: string | null
          data_desligamento: string | null
          data_nascimento: string | null
          empresa_id: string | null
          endereco: string | null
          endereco_complemento: string | null
          endereco_numero: string | null
          foto_url: string | null
          id: string
          nacionalidade: string | null
          naturalidade_estado: string | null
          naturalidade_municipio: string | null
          nome_completo: string
          nome_mae: string | null
          nome_pai: string | null
          pis: string | null
          quantidade_folgas: number | null
          raca_cor: string | null
          rg: string | null
          rg_data_emissao: string | null
          rg_orgao_expedidor: string | null
          rg_uf: string | null
          salario: number | null
          setor: string | null
          sexo: string | null
          status: Database["public"]["Enums"]["employee_status"] | null
          telefone: string | null
          tipo_contrato: Database["public"]["Enums"]["tipo_contrato"] | null
          tipo_salario: Database["public"]["Enums"]["tipo_salario"] | null
          uf: string | null
          ultima_alteracao_folgas: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          nome_social?: string | null
          estado_civil?: string | null
          grau_instrucao?: string | null
          email_pessoal?: string | null
          pais_nascimento?: string | null
          contato_emergencia_nome?: string | null
          contato_emergencia_telefone?: string | null
          contato_emergencia_parentesco?: string | null
          pcd?: boolean
          pcd_tipo?: string | null
          pcd_reabilitado?: boolean
          pcd_cota?: boolean
          ctps_serie?: string | null
          ctps_uf?: string | null
          titulo_eleitor?: string | null
          titulo_zona?: string | null
          titulo_secao?: string | null
          reservista?: string | null
          cnh_numero?: string | null
          cnh_categoria?: string | null
          cnh_validade?: string | null
          conselho_classe?: string | null
          certidao?: string | null
          banco?: string | null
          agencia?: string | null
          conta?: string | null
          conta_tipo?: string | null
          pix_chave?: string | null
          experiencia_dias?: number | null
          experiencia_prorrogacao_dias?: number | null
          horas_semanais?: number | null
          escala?: string | null
          horario_trabalho?: string | null
          sindicato?: string | null
          primeiro_emprego?: boolean
          categoria_esocial?: string | null
          insalubridade?: string | null
          periculosidade?: boolean
          adicional_noturno?: boolean
          gestor_id?: string | null
          centro_custo?: string | null
          local_trabalho?: string | null
          vt_opta?: boolean
          vt_linhas?: string | null
          vt_valor_diario?: number | null
          vale_refeicao_valor?: number | null
          vale_alimentacao_valor?: number | null
          plano_saude?: string | null
          plano_odonto?: string | null
          seguro_vida?: boolean
          tamanho_camisa?: string | null
          tamanho_calca?: string | null
          tamanho_calcado?: string | null
          aso_admissional_data?: string | null
          desligamento_tipo?: string | null
          desligamento_motivo?: string | null
          aviso_previo?: string | null
          exame_demissional_data?: string | null
          bairro?: string | null
          cargo: string
          carteira_trabalho?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_funcionario?: string | null
          cpf?: string | null
          created_at?: string | null
          data_admissao?: string | null
          data_desligamento?: string | null
          data_nascimento?: string | null
          empresa_id?: string | null
          endereco?: string | null
          endereco_complemento?: string | null
          endereco_numero?: string | null
          foto_url?: string | null
          id?: string
          nacionalidade?: string | null
          naturalidade_estado?: string | null
          naturalidade_municipio?: string | null
          nome_completo: string
          nome_mae?: string | null
          nome_pai?: string | null
          pis?: string | null
          quantidade_folgas?: number | null
          raca_cor?: string | null
          rg?: string | null
          rg_data_emissao?: string | null
          rg_orgao_expedidor?: string | null
          rg_uf?: string | null
          salario?: number | null
          setor?: string | null
          sexo?: string | null
          status?: Database["public"]["Enums"]["employee_status"] | null
          telefone?: string | null
          tipo_contrato?: Database["public"]["Enums"]["tipo_contrato"] | null
          tipo_salario?: Database["public"]["Enums"]["tipo_salario"] | null
          uf?: string | null
          ultima_alteracao_folgas?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          nome_social?: string | null
          estado_civil?: string | null
          grau_instrucao?: string | null
          email_pessoal?: string | null
          pais_nascimento?: string | null
          contato_emergencia_nome?: string | null
          contato_emergencia_telefone?: string | null
          contato_emergencia_parentesco?: string | null
          pcd?: boolean
          pcd_tipo?: string | null
          pcd_reabilitado?: boolean
          pcd_cota?: boolean
          ctps_serie?: string | null
          ctps_uf?: string | null
          titulo_eleitor?: string | null
          titulo_zona?: string | null
          titulo_secao?: string | null
          reservista?: string | null
          cnh_numero?: string | null
          cnh_categoria?: string | null
          cnh_validade?: string | null
          conselho_classe?: string | null
          certidao?: string | null
          banco?: string | null
          agencia?: string | null
          conta?: string | null
          conta_tipo?: string | null
          pix_chave?: string | null
          experiencia_dias?: number | null
          experiencia_prorrogacao_dias?: number | null
          horas_semanais?: number | null
          escala?: string | null
          horario_trabalho?: string | null
          sindicato?: string | null
          primeiro_emprego?: boolean
          categoria_esocial?: string | null
          insalubridade?: string | null
          periculosidade?: boolean
          adicional_noturno?: boolean
          gestor_id?: string | null
          centro_custo?: string | null
          local_trabalho?: string | null
          vt_opta?: boolean
          vt_linhas?: string | null
          vt_valor_diario?: number | null
          vale_refeicao_valor?: number | null
          vale_alimentacao_valor?: number | null
          plano_saude?: string | null
          plano_odonto?: string | null
          seguro_vida?: boolean
          tamanho_camisa?: string | null
          tamanho_calca?: string | null
          tamanho_calcado?: string | null
          aso_admissional_data?: string | null
          desligamento_tipo?: string | null
          desligamento_motivo?: string | null
          aviso_previo?: string | null
          exame_demissional_data?: string | null
          bairro?: string | null
          cargo?: string
          carteira_trabalho?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_funcionario?: string | null
          cpf?: string | null
          created_at?: string | null
          data_admissao?: string | null
          data_desligamento?: string | null
          data_nascimento?: string | null
          empresa_id?: string | null
          endereco?: string | null
          endereco_complemento?: string | null
          endereco_numero?: string | null
          foto_url?: string | null
          id?: string
          nacionalidade?: string | null
          naturalidade_estado?: string | null
          naturalidade_municipio?: string | null
          nome_completo?: string
          nome_mae?: string | null
          nome_pai?: string | null
          pis?: string | null
          quantidade_folgas?: number | null
          raca_cor?: string | null
          rg?: string | null
          rg_data_emissao?: string | null
          rg_orgao_expedidor?: string | null
          rg_uf?: string | null
          salario?: number | null
          setor?: string | null
          sexo?: string | null
          status?: Database["public"]["Enums"]["employee_status"] | null
          telefone?: string | null
          tipo_contrato?: Database["public"]["Enums"]["tipo_contrato"] | null
          tipo_salario?: Database["public"]["Enums"]["tipo_salario"] | null
          uf?: string | null
          ultima_alteracao_folgas?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          cnpj: string | null
          created_at: string
          endereco: string | null
          id: string
          logo_url: string | null
          nome: string
          numero_convenio_bancario: string | null
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          numero_convenio_bancario?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          numero_convenio_bancario?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      encaminhamentos_medicos: {
        Row: {
          apto_trabalho: boolean | null
          beneficiario_reabilitado: boolean
          cbo: string | null
          created_at: string
          created_by: string | null
          data_agendamento: string | null
          data_encaminhamento: string
          data_realizacao: string | null
          descricao_atividade: string | null
          employee_id: string
          empresa_id: string
          espaco_confinado: boolean
          funcao: string
          id: string
          matricula_esocial: string | null
          observacoes: string | null
          portador_deficiencia: boolean
          resultado_exame: string | null
          setor: string | null
          status: Database["public"]["Enums"]["status_encaminhamento"]
          tipo_exame: Database["public"]["Enums"]["tipo_exame_medico"]
          trabalho_altura: boolean
          updated_at: string
        }
        Insert: {
          apto_trabalho?: boolean | null
          beneficiario_reabilitado?: boolean
          cbo?: string | null
          created_at?: string
          created_by?: string | null
          data_agendamento?: string | null
          data_encaminhamento?: string
          data_realizacao?: string | null
          descricao_atividade?: string | null
          employee_id: string
          empresa_id: string
          espaco_confinado?: boolean
          funcao: string
          id?: string
          matricula_esocial?: string | null
          observacoes?: string | null
          portador_deficiencia?: boolean
          resultado_exame?: string | null
          setor?: string | null
          status?: Database["public"]["Enums"]["status_encaminhamento"]
          tipo_exame: Database["public"]["Enums"]["tipo_exame_medico"]
          trabalho_altura?: boolean
          updated_at?: string
        }
        Update: {
          apto_trabalho?: boolean | null
          beneficiario_reabilitado?: boolean
          cbo?: string | null
          created_at?: string
          created_by?: string | null
          data_agendamento?: string | null
          data_encaminhamento?: string
          data_realizacao?: string | null
          descricao_atividade?: string | null
          employee_id?: string
          empresa_id?: string
          espaco_confinado?: boolean
          funcao?: string
          id?: string
          matricula_esocial?: string | null
          observacoes?: string | null
          portador_deficiencia?: boolean
          resultado_exame?: string | null
          setor?: string | null
          status?: Database["public"]["Enums"]["status_encaminhamento"]
          tipo_exame?: Database["public"]["Enums"]["tipo_exame_medico"]
          trabalho_altura?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "encaminhamentos_medicos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encaminhamentos_medicos_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encaminhamentos_medicos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      epis: {
        Row: {
          assinatura_funcionario: string | null
          created_at: string | null
          created_by: string | null
          data_assinatura: string | null
          data_entrega: string
          employee_id: string
          id: string
          observacoes: string | null
          quantidade: number
          tipo_epi: string
        }
        Insert: {
          assinatura_funcionario?: string | null
          created_at?: string | null
          created_by?: string | null
          data_assinatura?: string | null
          data_entrega: string
          employee_id: string
          id?: string
          observacoes?: string | null
          quantidade?: number
          tipo_epi: string
        }
        Update: {
          assinatura_funcionario?: string | null
          created_at?: string | null
          created_by?: string | null
          data_assinatura?: string | null
          data_entrega?: string
          employee_id?: string
          id?: string
          observacoes?: string | null
          quantidade?: number
          tipo_epi?: string
        }
        Relationships: [
          {
            foreignKeyName: "epis_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epis_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_epis: {
        Row: {
          ca: string | null
          created_at: string | null
          finalidade: string | null
          id: string
          marca_modelo: string | null
          observacoes: string | null
          quantidade_estoque: number
          quantidade_minima: number | null
          tamanho: string | null
          tipo_epi: string
          updated_at: string | null
        }
        Insert: {
          ca?: string | null
          created_at?: string | null
          finalidade?: string | null
          id?: string
          marca_modelo?: string | null
          observacoes?: string | null
          quantidade_estoque?: number
          quantidade_minima?: number | null
          tamanho?: string | null
          tipo_epi: string
          updated_at?: string | null
        }
        Update: {
          ca?: string | null
          created_at?: string | null
          finalidade?: string | null
          id?: string
          marca_modelo?: string | null
          observacoes?: string | null
          quantidade_estoque?: number
          quantidade_minima?: number | null
          tamanho?: string | null
          tipo_epi?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      estoque_uniformes: {
        Row: {
          cor: string | null
          created_at: string | null
          id: string
          observacoes: string | null
          quantidade_estoque: number
          quantidade_minima: number | null
          tamanho: string
          tipo_uniforme: string
          updated_at: string | null
        }
        Insert: {
          cor?: string | null
          created_at?: string | null
          id?: string
          observacoes?: string | null
          quantidade_estoque?: number
          quantidade_minima?: number | null
          tamanho: string
          tipo_uniforme: string
          updated_at?: string | null
        }
        Update: {
          cor?: string | null
          created_at?: string | null
          id?: string
          observacoes?: string | null
          quantidade_estoque?: number
          quantidade_minima?: number | null
          tamanho?: string
          tipo_uniforme?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      eventos: {
        Row: {
          concluido: boolean | null
          concluido_em: string | null
          cor: string | null
          created_at: string | null
          criado_por: string | null
          data_fim: string
          data_inicio: string
          descricao: string | null
          empresa_id: string | null
          google_event_id: string | null
          id: string
          lembrete_enviado: boolean | null
          lembrete_minutos: number | null
          local: string | null
          participantes: string[] | null
          recorrencia_tipo: string | null
          recorrente: boolean | null
          tipo: string | null
          titulo: string
          updated_at: string | null
          whatsapp_phone: string | null
        }
        Insert: {
          concluido?: boolean | null
          concluido_em?: string | null
          cor?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_fim: string
          data_inicio: string
          descricao?: string | null
          empresa_id?: string | null
          google_event_id?: string | null
          id?: string
          lembrete_enviado?: boolean | null
          lembrete_minutos?: number | null
          local?: string | null
          participantes?: string[] | null
          recorrencia_tipo?: string | null
          recorrente?: boolean | null
          tipo?: string | null
          titulo: string
          updated_at?: string | null
          whatsapp_phone?: string | null
        }
        Update: {
          concluido?: boolean | null
          concluido_em?: string | null
          cor?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_fim?: string
          data_inicio?: string
          descricao?: string | null
          empresa_id?: string | null
          google_event_id?: string | null
          id?: string
          lembrete_enviado?: boolean | null
          lembrete_minutos?: number | null
          local?: string | null
          participantes?: string[] | null
          recorrencia_tipo?: string | null
          recorrente?: boolean | null
          tipo?: string | null
          titulo?: string
          updated_at?: string | null
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      execucoes_ciclo: {
        Row: {
          avaliacoes_criadas: number | null
          ciclo_id: string | null
          created_at: string | null
          data_execucao: string | null
          detalhes: Json | null
          id: string
          status: string | null
        }
        Insert: {
          avaliacoes_criadas?: number | null
          ciclo_id?: string | null
          created_at?: string | null
          data_execucao?: string | null
          detalhes?: Json | null
          id?: string
          status?: string | null
        }
        Update: {
          avaliacoes_criadas?: number | null
          ciclo_id?: string | null
          created_at?: string | null
          data_execucao?: string | null
          detalhes?: Json | null
          id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "execucoes_ciclo_ciclo_id_fkey"
            columns: ["ciclo_id"]
            isOneToOne: false
            referencedRelation: "ciclos_avaliacao"
            referencedColumns: ["id"]
          },
        ]
      }
      faltas: {
        Row: {
          created_at: string | null
          created_by: string | null
          data: string
          employee_id: string
          id: string
          justificada: boolean | null
          motivo: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          data: string
          employee_id: string
          id?: string
          justificada?: boolean | null
          motivo?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          data?: string
          employee_id?: string
          id?: string
          justificada?: boolean | null
          motivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "faltas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faltas_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias: {
        Row: {
          confirmado_por: string | null
          created_at: string | null
          created_by: string | null
          data_confirmacao: string | null
          data_retorno_confirmada: boolean | null
          dias_totais: number
          employee_id: string
          id: string
          periodo_aquisitivo_fim: string
          periodo_aquisitivo_inicio: string
          periodo_gozo_fim: string
          periodo_gozo_inicio: string
        }
        Insert: {
          confirmado_por?: string | null
          created_at?: string | null
          created_by?: string | null
          data_confirmacao?: string | null
          data_retorno_confirmada?: boolean | null
          dias_totais: number
          employee_id: string
          id?: string
          periodo_aquisitivo_fim: string
          periodo_aquisitivo_inicio: string
          periodo_gozo_fim: string
          periodo_gozo_inicio: string
        }
        Update: {
          confirmado_por?: string | null
          created_at?: string | null
          created_by?: string | null
          data_confirmacao?: string | null
          data_retorno_confirmada?: boolean | null
          dias_totais?: number
          employee_id?: string
          id?: string
          periodo_aquisitivo_fim?: string
          periodo_aquisitivo_inicio?: string
          periodo_gozo_fim?: string
          periodo_gozo_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "ferias_confirmado_por_fkey"
            columns: ["confirmado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ferias_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ferias_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias_planejadas: {
        Row: {
          aprovado_por: string | null
          created_at: string | null
          criado_por: string | null
          data_aprovacao: string | null
          dias_totais: number
          employee_id: string
          id: string
          observacoes: string | null
          periodo_fim: string
          periodo_inicio: string
          status: string
          updated_at: string | null
        }
        Insert: {
          aprovado_por?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_aprovacao?: string | null
          dias_totais: number
          employee_id: string
          id?: string
          observacoes?: string | null
          periodo_fim: string
          periodo_inicio: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          aprovado_por?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_aprovacao?: string | null
          dias_totais?: number
          employee_id?: string
          id?: string
          observacoes?: string | null
          periodo_fim?: string
          periodo_inicio?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      folgas: {
        Row: {
          created_at: string | null
          created_by: string | null
          data: string
          employee_id: string
          id: string
          motivo: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          data: string
          employee_id: string
          id?: string
          motivo: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          data?: string
          employee_id?: string
          id?: string
          motivo?: string
        }
        Relationships: [
          {
            foreignKeyName: "folgas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folgas_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      folha_pagamento: {
        Row: {
          ano: number
          aviso_previo_cumprido: boolean | null
          backup_drive_em: string | null
          created_at: string | null
          created_by: string | null
          data_desligamento: string | null
          desconto: number | null
          descontos: number | null
          employee_id: string
          empresa_id: string
          id: string
          mes: number
          observacoes: string | null
          status: string
          tipo_folha: string
          tipo_rescisao: string | null
          updated_at: string | null
          valor_bruto: number
          valor_liquido: number
        }
        Insert: {
          ano: number
          aviso_previo_cumprido?: boolean | null
          backup_drive_em?: string | null
          created_at?: string | null
          created_by?: string | null
          data_desligamento?: string | null
          desconto?: number | null
          descontos?: number | null
          employee_id: string
          empresa_id: string
          id?: string
          mes: number
          observacoes?: string | null
          status?: string
          tipo_folha?: string
          tipo_rescisao?: string | null
          updated_at?: string | null
          valor_bruto?: number
          valor_liquido?: number
        }
        Update: {
          ano?: number
          aviso_previo_cumprido?: boolean | null
          backup_drive_em?: string | null
          created_at?: string | null
          created_by?: string | null
          data_desligamento?: string | null
          desconto?: number | null
          descontos?: number | null
          employee_id?: string
          empresa_id?: string
          id?: string
          mes?: number
          observacoes?: string | null
          status?: string
          tipo_folha?: string
          tipo_rescisao?: string | null
          updated_at?: string | null
          valor_bruto?: number
          valor_liquido?: number
        }
        Relationships: [
          {
            foreignKeyName: "folha_pagamento_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_pagamento_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_pagamento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      folha_pagamento_itens: {
        Row: {
          created_at: string
          folha_pagamento_id: string
          id: string
          valor: number
          variavel_id: string
        }
        Insert: {
          created_at?: string
          folha_pagamento_id: string
          id?: string
          valor?: number
          variavel_id: string
        }
        Update: {
          created_at?: string
          folha_pagamento_id?: string
          id?: string
          valor?: number
          variavel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folha_pagamento_itens_folha_pagamento_id_fkey"
            columns: ["folha_pagamento_id"]
            isOneToOne: false
            referencedRelation: "folha_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_pagamento_itens_variavel_id_fkey"
            columns: ["variavel_id"]
            isOneToOne: false
            referencedRelation: "variaveis_folha"
            referencedColumns: ["id"]
          },
        ]
      }
      funcoes: {
        Row: {
          cbo: string | null
          created_at: string | null
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          cbo?: string | null
          created_at?: string | null
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          cbo?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string
          id: string
          refresh_token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at: string
          id?: string
          refresh_token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          refresh_token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      historico_banco_horas: {
        Row: {
          created_at: string | null
          created_by: string | null
          employee_id: string
          horas: number
          id: string
          mes_referencia: string | null
          observacao: string | null
          saldo_anterior: number
          saldo_novo: number
          tipo_movimentacao: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          employee_id: string
          horas: number
          id?: string
          mes_referencia?: string | null
          observacao?: string | null
          saldo_anterior: number
          saldo_novo: number
          tipo_movimentacao: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          employee_id?: string
          horas?: number
          id?: string
          mes_referencia?: string | null
          observacao?: string | null
          saldo_anterior?: number
          saldo_novo?: number
          tipo_movimentacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "historico_banco_horas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_banco_horas_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_estoque_epis: {
        Row: {
          backup_drive_em: string | null
          created_at: string
          created_by: string | null
          employee_id: string | null
          estoque_epi_id: string
          id: string
          motivo: string | null
          quantidade: number
          quantidade_anterior: number
          quantidade_nova: number
          tipo_movimentacao: string
        }
        Insert: {
          backup_drive_em?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          estoque_epi_id: string
          id?: string
          motivo?: string | null
          quantidade: number
          quantidade_anterior: number
          quantidade_nova: number
          tipo_movimentacao: string
        }
        Update: {
          backup_drive_em?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          estoque_epi_id?: string
          id?: string
          motivo?: string | null
          quantidade?: number
          quantidade_anterior?: number
          quantidade_nova?: number
          tipo_movimentacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "historico_estoque_epis_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_estoque_epis_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_estoque_epis_estoque_epi_id_fkey"
            columns: ["estoque_epi_id"]
            isOneToOne: false
            referencedRelation: "estoque_epis"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_estoque_uniformes: {
        Row: {
          backup_drive_em: string | null
          created_at: string
          created_by: string | null
          employee_id: string | null
          estoque_uniforme_id: string
          id: string
          motivo: string | null
          quantidade: number
          quantidade_anterior: number
          quantidade_nova: number
          tipo_movimentacao: string
        }
        Insert: {
          backup_drive_em?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          estoque_uniforme_id: string
          id?: string
          motivo?: string | null
          quantidade: number
          quantidade_anterior: number
          quantidade_nova: number
          tipo_movimentacao: string
        }
        Update: {
          backup_drive_em?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          estoque_uniforme_id?: string
          id?: string
          motivo?: string | null
          quantidade?: number
          quantidade_anterior?: number
          quantidade_nova?: number
          tipo_movimentacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "historico_estoque_uniformes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_estoque_uniformes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_estoque_uniformes_estoque_uniforme_id_fkey"
            columns: ["estoque_uniforme_id"]
            isOneToOne: false
            referencedRelation: "estoque_uniformes"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_folgas: {
        Row: {
          alterado_em: string
          alterado_por: string | null
          created_at: string | null
          employee_id: string
          id: string
          observacao: string | null
          quantidade_anterior: number
          quantidade_nova: number
        }
        Insert: {
          alterado_em?: string
          alterado_por?: string | null
          created_at?: string | null
          employee_id: string
          id?: string
          observacao?: string | null
          quantidade_anterior: number
          quantidade_nova: number
        }
        Update: {
          alterado_em?: string
          alterado_por?: string | null
          created_at?: string | null
          employee_id?: string
          id?: string
          observacao?: string | null
          quantidade_anterior?: number
          quantidade_nova?: number
        }
        Relationships: [
          {
            foreignKeyName: "historico_folgas_alterado_por_fkey"
            columns: ["alterado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_folgas_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_reajustes_salariais: {
        Row: {
          aplicado_em: string
          aplicado_por: string | null
          created_at: string | null
          employee_id: string
          id: string
          justificativa: string
          percentual_reajuste: number | null
          salario_anterior: number
          salario_novo: number
        }
        Insert: {
          aplicado_em?: string
          aplicado_por?: string | null
          created_at?: string | null
          employee_id: string
          id?: string
          justificativa: string
          percentual_reajuste?: number | null
          salario_anterior: number
          salario_novo: number
        }
        Update: {
          aplicado_em?: string
          aplicado_por?: string | null
          created_at?: string | null
          employee_id?: string
          id?: string
          justificativa?: string
          percentual_reajuste?: number | null
          salario_anterior?: number
          salario_novo?: number
        }
        Relationships: [
          {
            foreignKeyName: "historico_reajustes_salariais_aplicado_por_fkey"
            columns: ["aplicado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_reajustes_salariais_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_status_candidatura: {
        Row: {
          alterado_em: string | null
          alterado_por: string | null
          candidatura_id: string
          id: string
          observacao: string | null
          status_anterior:
            | Database["public"]["Enums"]["candidatura_status"]
            | null
          status_novo: Database["public"]["Enums"]["candidatura_status"]
        }
        Insert: {
          alterado_em?: string | null
          alterado_por?: string | null
          candidatura_id: string
          id?: string
          observacao?: string | null
          status_anterior?:
            | Database["public"]["Enums"]["candidatura_status"]
            | null
          status_novo: Database["public"]["Enums"]["candidatura_status"]
        }
        Update: {
          alterado_em?: string | null
          alterado_por?: string | null
          candidatura_id?: string
          id?: string
          observacao?: string | null
          status_anterior?:
            | Database["public"]["Enums"]["candidatura_status"]
            | null
          status_novo?: Database["public"]["Enums"]["candidatura_status"]
        }
        Relationships: [
          {
            foreignKeyName: "historico_status_candidatura_alterado_por_fkey"
            columns: ["alterado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_status_candidatura_candidatura_id_fkey"
            columns: ["candidatura_id"]
            isOneToOne: false
            referencedRelation: "candidaturas"
            referencedColumns: ["id"]
          },
        ]
      }
      holerite_assinaturas: {
        Row: {
          assinatura_imagem_path: string | null
          cpf: string | null
          created_at: string
          data_assinatura: string | null
          data_visualizacao: string | null
          employee_id: string
          empresa_id: string | null
          folha_pagamento_id: string
          geo_consentimento: boolean
          geo_latitude: number | null
          geo_longitude: number | null
          hash_assinatura: string | null
          hash_documento: string
          id: string
          ip_publico: string | null
          matricula: string | null
          navegador: string | null
          nome_completo: string
          pdf_certificado_path: string | null
          pdf_original_path: string
          protocolo: string
          selfie_path: string | null
          sistema_operacional: string | null
          status: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          assinatura_imagem_path?: string | null
          cpf?: string | null
          created_at?: string
          data_assinatura?: string | null
          data_visualizacao?: string | null
          employee_id: string
          empresa_id?: string | null
          folha_pagamento_id: string
          geo_consentimento?: boolean
          geo_latitude?: number | null
          geo_longitude?: number | null
          hash_assinatura?: string | null
          hash_documento: string
          id?: string
          ip_publico?: string | null
          matricula?: string | null
          navegador?: string | null
          nome_completo: string
          pdf_certificado_path?: string | null
          pdf_original_path: string
          protocolo: string
          selfie_path?: string | null
          sistema_operacional?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          assinatura_imagem_path?: string | null
          cpf?: string | null
          created_at?: string
          data_assinatura?: string | null
          data_visualizacao?: string | null
          employee_id?: string
          empresa_id?: string | null
          folha_pagamento_id?: string
          geo_consentimento?: boolean
          geo_latitude?: number | null
          geo_longitude?: number | null
          hash_assinatura?: string | null
          hash_documento?: string
          id?: string
          ip_publico?: string | null
          matricula?: string | null
          navegador?: string | null
          nome_completo?: string
          pdf_certificado_path?: string | null
          pdf_original_path?: string
          protocolo?: string
          selfie_path?: string | null
          sistema_operacional?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holerite_assinaturas_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holerite_assinaturas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holerite_assinaturas_folha_pagamento_id_fkey"
            columns: ["folha_pagamento_id"]
            isOneToOne: false
            referencedRelation: "folha_pagamento"
            referencedColumns: ["id"]
          },
        ]
      }
      holerite_documentos: {
        Row: {
          ano: number
          arquivo_nome: string
          arquivo_path: string
          assinatura_imagem_path: string | null
          created_at: string
          created_by: string | null
          data_assinatura: string | null
          data_visualizacao: string | null
          employee_id: string
          empresa_id: string | null
          geo_consentimento: boolean
          geo_latitude: number | null
          geo_longitude: number | null
          hash_assinatura: string | null
          hash_documento: string | null
          id: string
          ip_publico: string | null
          mes: number
          navegador: string | null
          pdf_assinado_path: string | null
          protocolo: string | null
          selfie_path: string | null
          sistema_operacional: string | null
          status: string
          tipo_folha: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          ano: number
          arquivo_nome: string
          arquivo_path: string
          assinatura_imagem_path?: string | null
          created_at?: string
          created_by?: string | null
          data_assinatura?: string | null
          data_visualizacao?: string | null
          employee_id: string
          empresa_id?: string | null
          geo_consentimento?: boolean
          geo_latitude?: number | null
          geo_longitude?: number | null
          hash_assinatura?: string | null
          hash_documento?: string | null
          id?: string
          ip_publico?: string | null
          mes: number
          navegador?: string | null
          pdf_assinado_path?: string | null
          protocolo?: string | null
          selfie_path?: string | null
          sistema_operacional?: string | null
          status?: string
          tipo_folha?: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          ano?: number
          arquivo_nome?: string
          arquivo_path?: string
          assinatura_imagem_path?: string | null
          created_at?: string
          created_by?: string | null
          data_assinatura?: string | null
          data_visualizacao?: string | null
          employee_id?: string
          empresa_id?: string | null
          geo_consentimento?: boolean
          geo_latitude?: number | null
          geo_longitude?: number | null
          hash_assinatura?: string | null
          hash_documento?: string | null
          id?: string
          ip_publico?: string | null
          mes?: number
          navegador?: string | null
          pdf_assinado_path?: string | null
          protocolo?: string | null
          selfie_path?: string | null
          sistema_operacional?: string | null
          status?: string
          tipo_folha?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holerite_documentos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holerite_documentos_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holerite_documentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      holerite_eventos_auditoria: {
        Row: {
          assinatura_id: string
          created_at: string
          geo_latitude: number | null
          geo_longitude: number | null
          id: string
          ip: string | null
          metadata: Json | null
          tipo_evento: string
          user_agent: string | null
        }
        Insert: {
          assinatura_id: string
          created_at?: string
          geo_latitude?: number | null
          geo_longitude?: number | null
          id?: string
          ip?: string | null
          metadata?: Json | null
          tipo_evento: string
          user_agent?: string | null
        }
        Update: {
          assinatura_id?: string
          created_at?: string
          geo_latitude?: number | null
          geo_longitude?: number | null
          id?: string
          ip?: string | null
          metadata?: Json | null
          tipo_evento?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holerite_eventos_auditoria_assinatura_id_fkey"
            columns: ["assinatura_id"]
            isOneToOne: false
            referencedRelation: "holerite_assinaturas"
            referencedColumns: ["id"]
          },
        ]
      }
      holerite_exportacoes_fiscalizacao: {
        Row: {
          created_at: string
          email_exportador: string | null
          exportado_por: string
          filtros_aplicados: Json
          hash_pacote: string | null
          id: string
          ip: string | null
          nome_exportador: string | null
          quantidade_assinados: number
          quantidade_holerites: number
          tamanho_bytes: number | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email_exportador?: string | null
          exportado_por: string
          filtros_aplicados?: Json
          hash_pacote?: string | null
          id?: string
          ip?: string | null
          nome_exportador?: string | null
          quantidade_assinados?: number
          quantidade_holerites?: number
          tamanho_bytes?: number | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email_exportador?: string | null
          exportado_por?: string
          filtros_aplicados?: Json
          hash_pacote?: string | null
          id?: string
          ip?: string | null
          nome_exportador?: string | null
          quantidade_assinados?: number
          quantidade_holerites?: number
          tamanho_bytes?: number | null
          user_agent?: string | null
        }
        Relationships: []
      }
      holerite_import_jobs: {
        Row: {
          created_at: string
          erro: string | null
          id: string
          resultado: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          erro?: string | null
          id?: string
          resultado?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          erro?: string | null
          id?: string
          resultado?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      informacoes_contabilidade: {
        Row: {
          ano: number
          created_at: string
          employee_id: string | null
          empresa_id: string | null
          id: string
          mes: number
          observacoes: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ano: number
          created_at?: string
          employee_id?: string | null
          empresa_id?: string | null
          id?: string
          mes: number
          observacoes: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ano?: number
          created_at?: string
          employee_id?: string | null
          empresa_id?: string | null
          id?: string
          mes?: number
          observacoes?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "informacoes_contabilidade_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "informacoes_contabilidade_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      login_history: {
        Row: {
          employee_id: string | null
          id: string
          ip_address: string | null
          login_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          employee_id?: string | null
          id?: string
          ip_address?: string | null
          login_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          employee_id?: string | null
          id?: string
          ip_address?: string | null
          login_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "login_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      metas_funcionario: {
        Row: {
          avaliacao_id: string | null
          created_at: string | null
          created_by: string | null
          descricao: string | null
          employee_id: string
          id: string
          percentual_conclusao: number | null
          prazo: string | null
          status: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          avaliacao_id?: string | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          employee_id: string
          id?: string
          percentual_conclusao?: number | null
          prazo?: string | null
          status?: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          avaliacao_id?: string | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          employee_id?: string
          id?: string
          percentual_conclusao?: number | null
          prazo?: string | null
          status?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "metas_funcionario_avaliacao_id_fkey"
            columns: ["avaliacao_id"]
            isOneToOne: false
            referencedRelation: "avaliacoes_desempenho"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_funcionario_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      modelos_contrato: {
        Row: {
          conteudo_template: string
          created_at: string
          funcao_id: string
          id: string
          tipo_contrato: Database["public"]["Enums"]["tipo_contrato"]
          updated_at: string
        }
        Insert: {
          conteudo_template: string
          created_at?: string
          funcao_id: string
          id?: string
          tipo_contrato: Database["public"]["Enums"]["tipo_contrato"]
          updated_at?: string
        }
        Update: {
          conteudo_template?: string
          created_at?: string
          funcao_id?: string
          id?: string
          tipo_contrato?: Database["public"]["Enums"]["tipo_contrato"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modelos_contrato_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
        ]
      }
      modulos: {
        Row: {
          created_at: string | null
          curso_id: string
          descricao: string | null
          id: string
          ordem: number
          titulo: string
        }
        Insert: {
          created_at?: string | null
          curso_id: string
          descricao?: string | null
          id?: string
          ordem?: number
          titulo: string
        }
        Update: {
          created_at?: string | null
          curso_id?: string
          descricao?: string | null
          id?: string
          ordem?: number
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "modulos_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      nfe_vinculos_estoque: {
        Row: {
          created_at: string
          descricao_nfe: string
          estoque_item_id: string
          id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          descricao_nfe: string
          estoque_item_id: string
          id?: string
          tipo: string
        }
        Update: {
          created_at?: string
          descricao_nfe?: string
          estoque_item_id?: string
          id?: string
          tipo?: string
        }
        Relationships: []
      }
      notas_avaliacao: {
        Row: {
          avaliacao_id: string
          comentario_funcionario: string | null
          comentario_gestor: string | null
          created_at: string | null
          criterio_id: string
          id: string
          nota_funcionario: number | null
          nota_gestor: number | null
          updated_at: string | null
        }
        Insert: {
          avaliacao_id: string
          comentario_funcionario?: string | null
          comentario_gestor?: string | null
          created_at?: string | null
          criterio_id: string
          id?: string
          nota_funcionario?: number | null
          nota_gestor?: number | null
          updated_at?: string | null
        }
        Update: {
          avaliacao_id?: string
          comentario_funcionario?: string | null
          comentario_gestor?: string | null
          created_at?: string | null
          criterio_id?: string
          id?: string
          nota_funcionario?: number | null
          nota_gestor?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_avaliacao_avaliacao_id_fkey"
            columns: ["avaliacao_id"]
            isOneToOne: false
            referencedRelation: "avaliacoes_desempenho"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_avaliacao_criterio_id_fkey"
            columns: ["criterio_id"]
            isOneToOne: false
            referencedRelation: "criterios_avaliacao"
            referencedColumns: ["id"]
          },
        ]
      }
      nr1_acoes_preventivas: {
        Row: {
          created_at: string
          created_by: string | null
          data_conclusao: string | null
          descricao: string | null
          evidencia_url: string | null
          id: string
          origem: string | null
          origem_id: string | null
          prazo: string | null
          prioridade: string
          responsavel_employee_id: string | null
          setor_id: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_conclusao?: string | null
          descricao?: string | null
          evidencia_url?: string | null
          id?: string
          origem?: string | null
          origem_id?: string | null
          prazo?: string | null
          prioridade?: string
          responsavel_employee_id?: string | null
          setor_id?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_conclusao?: string | null
          descricao?: string | null
          evidencia_url?: string | null
          id?: string
          origem?: string | null
          origem_id?: string | null
          prazo?: string | null
          prioridade?: string
          responsavel_employee_id?: string | null
          setor_id?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      nr1_auditoria_exports: {
        Row: {
          created_at: string
          empresa_id: string | null
          formato: string
          gerado_por: string | null
          hash_integridade: string | null
          id: string
          metadata: Json | null
          periodo_fim: string | null
          periodo_inicio: string | null
          responsavel_cargo: string | null
          responsavel_nome: string | null
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          formato: string
          gerado_por?: string | null
          hash_integridade?: string | null
          id?: string
          metadata?: Json | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          responsavel_cargo?: string | null
          responsavel_nome?: string | null
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          formato?: string
          gerado_por?: string | null
          hash_integridade?: string | null
          id?: string
          metadata?: Json | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          responsavel_cargo?: string | null
          responsavel_nome?: string | null
        }
        Relationships: []
      }
      nr1_clima_respostas: {
        Row: {
          created_at: string
          id: string
          pesquisa_id: string
          respostas: Json
          setor: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          pesquisa_id: string
          respostas?: Json
          setor?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          pesquisa_id?: string
          respostas?: Json
          setor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nr1_clima_respostas_pesquisa_id_fkey"
            columns: ["pesquisa_id"]
            isOneToOne: false
            referencedRelation: "nr1_pesquisas_clima"
            referencedColumns: ["id"]
          },
        ]
      }
      nr1_config: {
        Row: {
          alerta_denuncias_qtd: number
          alerta_lideranca_score: number
          clima_score_minimo: number
          created_at: string
          id: string
          observacoes: string | null
          reciclagem_padrao_meses: number
          updated_at: string
        }
        Insert: {
          alerta_denuncias_qtd?: number
          alerta_lideranca_score?: number
          clima_score_minimo?: number
          created_at?: string
          id?: string
          observacoes?: string | null
          reciclagem_padrao_meses?: number
          updated_at?: string
        }
        Update: {
          alerta_denuncias_qtd?: number
          alerta_lideranca_score?: number
          clima_score_minimo?: number
          created_at?: string
          id?: string
          observacoes?: string | null
          reciclagem_padrao_meses?: number
          updated_at?: string
        }
        Relationships: []
      }
      nr1_denuncias: {
        Row: {
          categoria: string
          classificacao_gravidade: string | null
          created_at: string
          descricao: string
          empresa_id: string | null
          id: string
          protocolo: string
          setor: string | null
          status: string
          updated_at: string
        }
        Insert: {
          categoria: string
          classificacao_gravidade?: string | null
          created_at?: string
          descricao: string
          empresa_id?: string | null
          id?: string
          protocolo: string
          setor?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          categoria?: string
          classificacao_gravidade?: string | null
          created_at?: string
          descricao?: string
          empresa_id?: string | null
          id?: string
          protocolo?: string
          setor?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      nr1_denuncias_anexos: {
        Row: {
          created_at: string
          denuncia_id: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
        }
        Insert: {
          created_at?: string
          denuncia_id: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
        }
        Update: {
          created_at?: string
          denuncia_id?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nr1_denuncias_anexos_denuncia_id_fkey"
            columns: ["denuncia_id"]
            isOneToOne: false
            referencedRelation: "nr1_denuncias"
            referencedColumns: ["id"]
          },
        ]
      }
      nr1_denuncias_apuracao: {
        Row: {
          created_at: string
          denuncia_id: string
          evidencia_url: string | null
          id: string
          nota: string
          registrado_por: string | null
        }
        Insert: {
          created_at?: string
          denuncia_id: string
          evidencia_url?: string | null
          id?: string
          nota: string
          registrado_por?: string | null
        }
        Update: {
          created_at?: string
          denuncia_id?: string
          evidencia_url?: string | null
          id?: string
          nota?: string
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nr1_denuncias_apuracao_denuncia_id_fkey"
            columns: ["denuncia_id"]
            isOneToOne: false
            referencedRelation: "nr1_denuncias"
            referencedColumns: ["id"]
          },
        ]
      }
      nr1_lideranca_pesquisas: {
        Row: {
          ativa: boolean
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string
          id: string
          lider_employee_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          id?: string
          lider_employee_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          id?: string
          lider_employee_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      nr1_lideranca_respostas: {
        Row: {
          comentario: string | null
          created_at: string
          id: string
          pesquisa_id: string
          respostas: Json
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          id?: string
          pesquisa_id: string
          respostas: Json
        }
        Update: {
          comentario?: string | null
          created_at?: string
          id?: string
          pesquisa_id?: string
          respostas?: Json
        }
        Relationships: [
          {
            foreignKeyName: "nr1_lideranca_respostas_pesquisa_id_fkey"
            columns: ["pesquisa_id"]
            isOneToOne: false
            referencedRelation: "nr1_lideranca_pesquisas"
            referencedColumns: ["id"]
          },
        ]
      }
      nr1_lideranca_tokens: {
        Row: {
          created_at: string
          id: string
          pesquisa_id: string
          token: string
          usado: boolean
          usado_em: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          pesquisa_id: string
          token?: string
          usado?: boolean
          usado_em?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          pesquisa_id?: string
          token?: string
          usado?: boolean
          usado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nr1_lideranca_tokens_pesquisa_id_fkey"
            columns: ["pesquisa_id"]
            isOneToOne: false
            referencedRelation: "nr1_lideranca_pesquisas"
            referencedColumns: ["id"]
          },
        ]
      }
      nr1_pesquisa_tokens: {
        Row: {
          created_at: string
          id: string
          pesquisa_id: string
          token: string
          usado: boolean
          usado_em: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          pesquisa_id: string
          token?: string
          usado?: boolean
          usado_em?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          pesquisa_id?: string
          token?: string
          usado?: boolean
          usado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nr1_pesquisa_tokens_pesquisa_id_fkey"
            columns: ["pesquisa_id"]
            isOneToOne: false
            referencedRelation: "nr1_pesquisas_clima"
            referencedColumns: ["id"]
          },
        ]
      }
      nr1_pesquisas_clima: {
        Row: {
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          perguntas: Json
          qtd_sortear: number | null
          setor_id: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          perguntas?: Json
          qtd_sortear?: number | null
          setor_id?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          perguntas?: Json
          qtd_sortear?: number | null
          setor_id?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      nr1_riscos: {
        Row: {
          categoria: string
          created_at: string
          created_by: string | null
          data_identificacao: string
          data_revisao: string | null
          descricao: string
          empresa_id: string | null
          id: string
          plano_acao: string | null
          probabilidade: number
          responsavel_employee_id: string | null
          setor_id: string | null
          severidade: number
          status: string
          updated_at: string
        }
        Insert: {
          categoria: string
          created_at?: string
          created_by?: string | null
          data_identificacao?: string
          data_revisao?: string | null
          descricao: string
          empresa_id?: string | null
          id?: string
          plano_acao?: string | null
          probabilidade?: number
          responsavel_employee_id?: string | null
          setor_id?: string | null
          severidade?: number
          status?: string
          updated_at?: string
        }
        Update: {
          categoria?: string
          created_at?: string
          created_by?: string | null
          data_identificacao?: string
          data_revisao?: string | null
          descricao?: string
          empresa_id?: string | null
          id?: string
          plano_acao?: string | null
          probabilidade?: number
          responsavel_employee_id?: string | null
          setor_id?: string | null
          severidade?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      nr1_treinamento_conclusoes: {
        Row: {
          certificado_url: string | null
          created_at: string
          data_conclusao: string
          employee_id: string
          id: string
          nota: number | null
          treinamento_id: string
        }
        Insert: {
          certificado_url?: string | null
          created_at?: string
          data_conclusao?: string
          employee_id: string
          id?: string
          nota?: number | null
          treinamento_id: string
        }
        Update: {
          certificado_url?: string | null
          created_at?: string
          data_conclusao?: string
          employee_id?: string
          id?: string
          nota?: number | null
          treinamento_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nr1_treinamento_conclusoes_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "nr1_treinamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      nr1_treinamentos: {
        Row: {
          ativo: boolean
          carga_horaria: number | null
          categoria: string
          conteudo_url: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          obrigatorio: boolean
          reciclagem_meses: number | null
          titulo: string
          updated_at: string
          youtube_video_id: string | null
        }
        Insert: {
          ativo?: boolean
          carga_horaria?: number | null
          categoria?: string
          conteudo_url?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          obrigatorio?: boolean
          reciclagem_meses?: number | null
          titulo: string
          updated_at?: string
          youtube_video_id?: string | null
        }
        Update: {
          ativo?: boolean
          carga_horaria?: number | null
          categoria?: string
          conteudo_url?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          obrigatorio?: boolean
          reciclagem_meses?: number | null
          titulo?: string
          updated_at?: string
          youtube_video_id?: string | null
        }
        Relationships: []
      }
      plano_checklist_funcionario: {
        Row: {
          aviso_tipo: string | null
          created_at: string
          created_by: string | null
          data_conclusao: string | null
          data_inicio: string
          dias_aviso: number | null
          employee_id: string
          id: string
          motivo_desligamento: string | null
          observacoes_desligamento: string | null
          status: Database["public"]["Enums"]["status_checklist"]
          template_id: string | null
          tipo: Database["public"]["Enums"]["tipo_checklist"]
          tipo_desligamento: string | null
          updated_at: string
        }
        Insert: {
          aviso_tipo?: string | null
          created_at?: string
          created_by?: string | null
          data_conclusao?: string | null
          data_inicio?: string
          dias_aviso?: number | null
          employee_id: string
          id?: string
          motivo_desligamento?: string | null
          observacoes_desligamento?: string | null
          status?: Database["public"]["Enums"]["status_checklist"]
          template_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_checklist"]
          tipo_desligamento?: string | null
          updated_at?: string
        }
        Update: {
          aviso_tipo?: string | null
          created_at?: string
          created_by?: string | null
          data_conclusao?: string | null
          data_inicio?: string
          dias_aviso?: number | null
          employee_id?: string
          id?: string
          motivo_desligamento?: string | null
          observacoes_desligamento?: string | null
          status?: Database["public"]["Enums"]["status_checklist"]
          template_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_checklist"]
          tipo_desligamento?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_checklist_funcionario_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_checklist_funcionario_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_checklist_funcionario_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "plano_checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_checklist_funcionario_itens: {
        Row: {
          anexo_url: string | null
          checklist_funcionario_id: string
          concluido: boolean
          concluido_por: string | null
          created_at: string
          data_conclusao: string | null
          descricao: string | null
          id: string
          item_id: string | null
          obrigatorio: boolean
          observacoes: string | null
          ordem: number
          prazo_dias: number | null
          titulo: string
        }
        Insert: {
          anexo_url?: string | null
          checklist_funcionario_id: string
          concluido?: boolean
          concluido_por?: string | null
          created_at?: string
          data_conclusao?: string | null
          descricao?: string | null
          id?: string
          item_id?: string | null
          obrigatorio?: boolean
          observacoes?: string | null
          ordem?: number
          prazo_dias?: number | null
          titulo: string
        }
        Update: {
          anexo_url?: string | null
          checklist_funcionario_id?: string
          concluido?: boolean
          concluido_por?: string | null
          created_at?: string
          data_conclusao?: string | null
          descricao?: string | null
          id?: string
          item_id?: string | null
          obrigatorio?: boolean
          observacoes?: string | null
          ordem?: number
          prazo_dias?: number | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_checklist_funcionario_itens_checklist_funcionario_id_fkey"
            columns: ["checklist_funcionario_id"]
            isOneToOne: false
            referencedRelation: "plano_checklist_funcionario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_checklist_funcionario_itens_concluido_por_fkey"
            columns: ["concluido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_checklist_funcionario_itens_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "plano_checklist_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_checklist_itens: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          obrigatorio: boolean
          ordem: number
          prazo_dias: number | null
          template_id: string
          titulo: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          obrigatorio?: boolean
          ordem?: number
          prazo_dias?: number | null
          template_id: string
          titulo: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          obrigatorio?: boolean
          ordem?: number
          prazo_dias?: number | null
          template_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_checklist_itens_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "plano_checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_checklist_templates: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string | null
          funcao_id: string | null
          id: string
          nome: string
          setor_id: string | null
          tipo: Database["public"]["Enums"]["tipo_checklist"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          funcao_id?: string | null
          id?: string
          nome: string
          setor_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_checklist"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          funcao_id?: string | null
          id?: string
          nome?: string
          setor_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_checklist"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_checklist_templates_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_checklist_templates_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_checklist_templates_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          id: string
          nome_completo: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          nome_completo: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          nome_completo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      progresso_treinamento: {
        Row: {
          aula_id: string
          concluida: boolean | null
          created_at: string | null
          data_conclusao: string | null
          employee_id: string
          id: string
          ultimo_acesso: string | null
        }
        Insert: {
          aula_id: string
          concluida?: boolean | null
          created_at?: string | null
          data_conclusao?: string | null
          employee_id: string
          id?: string
          ultimo_acesso?: string | null
        }
        Update: {
          aula_id?: string
          concluida?: boolean | null
          created_at?: string | null
          data_conclusao?: string | null
          employee_id?: string
          id?: string
          ultimo_acesso?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "progresso_treinamento_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "aulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progresso_treinamento_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      registros_ponto: {
        Row: {
          created_at: string | null
          created_by: string | null
          data: string
          employee_id: string
          hora_entrada: string | null
          hora_fim_intervalo: string | null
          hora_inicio_intervalo: string | null
          hora_saida: string | null
          horas_trabalhadas: number | null
          id: string
          observacoes: string | null
          tipo_dia: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          data: string
          employee_id: string
          hora_entrada?: string | null
          hora_fim_intervalo?: string | null
          hora_inicio_intervalo?: string | null
          hora_saida?: string | null
          horas_trabalhadas?: number | null
          id?: string
          observacoes?: string | null
          tipo_dia?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          data?: string
          employee_id?: string
          hora_entrada?: string | null
          hora_fim_intervalo?: string | null
          hora_inicio_intervalo?: string | null
          hora_saida?: string | null
          horas_trabalhadas?: number | null
          id?: string
          observacoes?: string | null
          tipo_dia?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registros_ponto_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_ponto_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      setores: {
        Row: {
          created_at: string | null
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          created_at: string
          favicon_url: string | null
          id: string
          site_description: string | null
          site_title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          favicon_url?: string | null
          id?: string
          site_description?: string | null
          site_title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          favicon_url?: string | null
          id?: string
          site_description?: string | null
          site_title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tacs: {
        Row: {
          confirmado_em: string | null
          created_at: string
          created_by: string | null
          data_ocorrencia: string
          data_publicacao: string
          descricao: string
          employee_id: string
          id: string
          lido_em: string | null
          observacoes: string | null
          status: Database["public"]["Enums"]["status_tac"]
          tipo: Database["public"]["Enums"]["tipo_tac"]
          titulo: string
          updated_at: string
        }
        Insert: {
          confirmado_em?: string | null
          created_at?: string
          created_by?: string | null
          data_ocorrencia: string
          data_publicacao?: string
          descricao: string
          employee_id: string
          id?: string
          lido_em?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["status_tac"]
          tipo: Database["public"]["Enums"]["tipo_tac"]
          titulo: string
          updated_at?: string
        }
        Update: {
          confirmado_em?: string | null
          created_at?: string
          created_by?: string | null
          data_ocorrencia?: string
          data_publicacao?: string
          descricao?: string
          employee_id?: string
          id?: string
          lido_em?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["status_tac"]
          tipo?: Database["public"]["Enums"]["tipo_tac"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tacs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tacs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          concluida: boolean
          concluida_em: string | null
          created_at: string
          data_vencimento: string | null
          descricao: string | null
          id: string
          prioridade: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          concluida?: boolean
          concluida_em?: string | null
          created_at?: string
          data_vencimento?: string | null
          descricao?: string | null
          id?: string
          prioridade?: string
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          concluida?: boolean
          concluida_em?: string | null
          created_at?: string
          data_vencimento?: string | null
          descricao?: string | null
          id?: string
          prioridade?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      uniformes: {
        Row: {
          assinatura_funcionario: string | null
          created_at: string | null
          created_by: string | null
          data_assinatura: string | null
          data_entrega: string
          employee_id: string
          id: string
          observacoes: string | null
          quantidade: number
          tamanho: string
          tipo_uniforme: string
        }
        Insert: {
          assinatura_funcionario?: string | null
          created_at?: string | null
          created_by?: string | null
          data_assinatura?: string | null
          data_entrega: string
          employee_id: string
          id?: string
          observacoes?: string | null
          quantidade?: number
          tamanho: string
          tipo_uniforme: string
        }
        Update: {
          assinatura_funcionario?: string | null
          created_at?: string | null
          created_by?: string | null
          data_assinatura?: string | null
          data_entrega?: string
          employee_id?: string
          id?: string
          observacoes?: string | null
          quantidade?: number
          tamanho?: string
          tipo_uniforme?: string
        }
        Relationships: [
          {
            foreignKeyName: "uniformes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uniformes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vagas: {
        Row: {
          beneficios: string | null
          created_at: string | null
          created_by: string | null
          data_abertura: string
          data_fechamento: string | null
          descricao: string
          empresa_id: string | null
          exibir_salario: boolean | null
          funcao_id: string | null
          id: string
          quantidade_vagas: number | null
          requisitos: string
          salario: number | null
          setor_id: string | null
          status: Database["public"]["Enums"]["vaga_status"] | null
          tipo_contrato: Database["public"]["Enums"]["tipo_contrato"]
          tipo_salario: Database["public"]["Enums"]["tipo_salario"]
          titulo: string
          updated_at: string | null
        }
        Insert: {
          beneficios?: string | null
          created_at?: string | null
          created_by?: string | null
          data_abertura?: string
          data_fechamento?: string | null
          descricao: string
          empresa_id?: string | null
          exibir_salario?: boolean | null
          funcao_id?: string | null
          id?: string
          quantidade_vagas?: number | null
          requisitos: string
          salario?: number | null
          setor_id?: string | null
          status?: Database["public"]["Enums"]["vaga_status"] | null
          tipo_contrato: Database["public"]["Enums"]["tipo_contrato"]
          tipo_salario: Database["public"]["Enums"]["tipo_salario"]
          titulo: string
          updated_at?: string | null
        }
        Update: {
          beneficios?: string | null
          created_at?: string | null
          created_by?: string | null
          data_abertura?: string
          data_fechamento?: string | null
          descricao?: string
          empresa_id?: string | null
          exibir_salario?: boolean | null
          funcao_id?: string | null
          id?: string
          quantidade_vagas?: number | null
          requisitos?: string
          salario?: number | null
          setor_id?: string | null
          status?: Database["public"]["Enums"]["vaga_status"] | null
          tipo_contrato?: Database["public"]["Enums"]["tipo_contrato"]
          tipo_salario?: Database["public"]["Enums"]["tipo_salario"]
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vagas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vagas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vagas_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vagas_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      variaveis_fixas_funcionario: {
        Row: {
          ativo: boolean
          created_at: string
          employee_id: string
          id: string
          updated_at: string
          valor: number
          variavel_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          employee_id: string
          id?: string
          updated_at?: string
          valor?: number
          variavel_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          employee_id?: string
          id?: string
          updated_at?: string
          valor?: number
          variavel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variaveis_fixas_funcionario_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variaveis_fixas_funcionario_variavel_id_fkey"
            columns: ["variavel_id"]
            isOneToOne: false
            referencedRelation: "variaveis_folha"
            referencedColumns: ["id"]
          },
        ]
      }
      variaveis_folha: {
        Row: {
          ativo: boolean
          codigo: string | null
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          tipo: Database["public"]["Enums"]["tipo_variavel_folha"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
          tipo: Database["public"]["Enums"]["tipo_variavel_folha"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          tipo?: Database["public"]["Enums"]["tipo_variavel_folha"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "variaveis_folha_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_contatos: {
        Row: {
          created_at: string
          id: string
          nome: string
          numero: string
          observacoes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          numero: string
          observacoes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          numero?: string
          observacoes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_conversas: {
        Row: {
          content: string
          created_at: string
          id: string
          phone_number: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          phone_number: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          phone_number?: string
          role?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      export_sql_schema: {
        Args: { _requesting_user_id: string }
        Returns: string[]
      }
      export_sql_table_chunk: {
        Args: {
          _limit?: number
          _offset?: number
          _requesting_user_id?: string
          _table_name: string
        }
        Returns: string[]
      }
      export_sql_tables: {
        Args: { _requesting_user_id: string }
        Returns: {
          table_name: string
          total_rows: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "gestor" | "funcionario" | "admin_parcial"
      candidatura_status:
        | "nova"
        | "em_analise"
        | "entrevista_agendada"
        | "aprovada"
        | "reprovada"
        | "contratada"
      employee_status:
        | "em_admissao"
        | "ativo"
        | "ferias"
        | "afastado"
        | "demitido"
      status_checklist: "em_andamento" | "concluido" | "cancelado"
      status_encaminhamento: "pendente" | "agendado" | "realizado" | "cancelado"
      status_tac: "pendente" | "visualizado" | "confirmado" | "aplicada"
      tipo_checklist: "admissao" | "desligamento"
      tipo_contrato: "fixo" | "intermitente" | "prestador_servico"
      tipo_exame_medico:
        | "admissional"
        | "demissional"
        | "periodico"
        | "mudanca_riscos"
        | "retorno_trabalho"
      tipo_salario: "mensal" | "diario" | "por_hora"
      tipo_tac:
        | "advertencia_verbal"
        | "advertencia_escrita"
        | "suspensao"
        | "compromisso"
      tipo_variavel_folha: "desconto" | "provento"
      vaga_status: "aberta" | "pausada" | "fechada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["gestor", "funcionario", "admin_parcial"],
      candidatura_status: [
        "nova",
        "em_analise",
        "entrevista_agendada",
        "aprovada",
        "reprovada",
        "contratada",
      ],
      employee_status: [
        "em_admissao",
        "ativo",
        "ferias",
        "afastado",
        "demitido",
      ],
      status_checklist: ["em_andamento", "concluido", "cancelado"],
      status_encaminhamento: ["pendente", "agendado", "realizado", "cancelado"],
      status_tac: ["pendente", "visualizado", "confirmado", "aplicada"],
      tipo_checklist: ["admissao", "desligamento"],
      tipo_contrato: ["fixo", "intermitente", "prestador_servico"],
      tipo_exame_medico: [
        "admissional",
        "demissional",
        "periodico",
        "mudanca_riscos",
        "retorno_trabalho",
      ],
      tipo_salario: ["mensal", "diario", "por_hora"],
      tipo_tac: [
        "advertencia_verbal",
        "advertencia_escrita",
        "suspensao",
        "compromisso",
      ],
      tipo_variavel_folha: ["desconto", "provento"],
      vaga_status: ["aberta", "pausada", "fechada"],
    },
  },
} as const
