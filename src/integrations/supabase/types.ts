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
      agente_documentos: {
        Row: {
          agente_id: string
          criado_em: string
          id: string
          nome: string
          tipo: string
          url: string
        }
        Insert: {
          agente_id: string
          criado_em?: string
          id?: string
          nome: string
          tipo?: string
          url: string
        }
        Update: {
          agente_id?: string
          criado_em?: string
          id?: string
          nome?: string
          tipo?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "agente_documentos_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_servicos: {
        Row: {
          aceita: boolean
          agente_id: string
          atualizado_em: string
          id: string
          servico_id: string
        }
        Insert: {
          aceita?: boolean
          agente_id: string
          atualizado_em?: string
          id?: string
          servico_id: string
        }
        Update: {
          aceita?: boolean
          agente_id?: string
          atualizado_em?: string
          id?: string
          servico_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agente_servicos_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agente_servicos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      agentes: {
        Row: {
          ativo: boolean
          bairro: string
          cep: string
          cidade: string
          cidades_atendidas: string[]
          cnh: string
          cnh_categoria: string
          cnh_validade: string
          contratado_em: string
          cpf: string
          criado_em: string
          email: string
          estado_civil: string
          foto: string
          id: string
          moto_ano: string
          moto_cor: string
          moto_modelo: string
          moto_placa: string
          moto_renavam: string
          nascimento: string
          nome: string
          numero: string
          observacoes: string
          online: boolean
          regiao: string
          rg: string
          rua: string
          seguro: string
          sexo: string
          situacao: string
          telefone: string
          uf: string
          visto_em: string | null
          whatsapp: string
        }
        Insert: {
          ativo?: boolean
          bairro?: string
          cep?: string
          cidade?: string
          cidades_atendidas?: string[]
          cnh?: string
          cnh_categoria?: string
          cnh_validade?: string
          contratado_em?: string
          cpf?: string
          criado_em?: string
          email?: string
          estado_civil?: string
          foto?: string
          id?: string
          moto_ano?: string
          moto_cor?: string
          moto_modelo?: string
          moto_placa?: string
          moto_renavam?: string
          nascimento?: string
          nome: string
          numero?: string
          observacoes?: string
          online?: boolean
          regiao?: string
          rg?: string
          rua?: string
          seguro?: string
          sexo?: string
          situacao?: string
          telefone?: string
          uf?: string
          visto_em?: string | null
          whatsapp?: string
        }
        Update: {
          ativo?: boolean
          bairro?: string
          cep?: string
          cidade?: string
          cidades_atendidas?: string[]
          cnh?: string
          cnh_categoria?: string
          cnh_validade?: string
          contratado_em?: string
          cpf?: string
          criado_em?: string
          email?: string
          estado_civil?: string
          foto?: string
          id?: string
          moto_ano?: string
          moto_cor?: string
          moto_modelo?: string
          moto_placa?: string
          moto_renavam?: string
          nascimento?: string
          nome?: string
          numero?: string
          observacoes?: string
          online?: boolean
          regiao?: string
          rg?: string
          rua?: string
          seguro?: string
          sexo?: string
          situacao?: string
          telefone?: string
          uf?: string
          visto_em?: string | null
          whatsapp?: string
        }
        Relationships: []
      }
      auditoria: {
        Row: {
          acao: string
          criado_em: string
          dados: Json | null
          entidade: string
          id: string
          quem: string | null
          quem_nome: string
          registro_id: string | null
        }
        Insert: {
          acao: string
          criado_em?: string
          dados?: Json | null
          entidade: string
          id?: string
          quem?: string | null
          quem_nome?: string
          registro_id?: string | null
        }
        Update: {
          acao?: string
          criado_em?: string
          dados?: Json | null
          entidade?: string
          id?: string
          quem?: string | null
          quem_nome?: string
          registro_id?: string | null
        }
        Relationships: []
      }
      cancelamentos_ordem: {
        Row: {
          aceite_cobranca: boolean
          aceito_em: string | null
          cancelado_em: string
          id: string
          locadora_id: string
          motivo: string
          ordem_id: string
          percentual_cobranca: number
          texto_aceite: string
          usuario_id: string | null
          valor_cobranca: number
          valor_original: number
        }
        Insert: {
          aceite_cobranca?: boolean
          aceito_em?: string | null
          cancelado_em?: string
          id?: string
          locadora_id: string
          motivo?: string
          ordem_id: string
          percentual_cobranca?: number
          texto_aceite?: string
          usuario_id?: string | null
          valor_cobranca?: number
          valor_original?: number
        }
        Update: {
          aceite_cobranca?: boolean
          aceito_em?: string | null
          cancelado_em?: string
          id?: string
          locadora_id?: string
          motivo?: string
          ordem_id?: string
          percentual_cobranca?: number
          texto_aceite?: string
          usuario_id?: string | null
          valor_cobranca?: number
          valor_original?: number
        }
        Relationships: [
          {
            foreignKeyName: "cancelamentos_ordem_locadora_id_fkey"
            columns: ["locadora_id"]
            isOneToOne: false
            referencedRelation: "locadoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancelamentos_ordem_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: true
            referencedRelation: "ordens"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          chave: string
          valor: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          chave: string
          valor?: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          chave?: string
          valor?: string
        }
        Relationships: []
      }
      distribuicao_eventos: {
        Row: {
          acao: string
          automatico: boolean
          dados: Json
          detalhe: string
          distribuicao_id: string
          id: string
          quando: string
          quem: string | null
          quem_nome: string
        }
        Insert: {
          acao: string
          automatico?: boolean
          dados?: Json
          detalhe?: string
          distribuicao_id: string
          id?: string
          quando?: string
          quem?: string | null
          quem_nome?: string
        }
        Update: {
          acao?: string
          automatico?: boolean
          dados?: Json
          detalhe?: string
          distribuicao_id?: string
          id?: string
          quando?: string
          quem?: string | null
          quem_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "distribuicao_eventos_distribuicao_id_fkey"
            columns: ["distribuicao_id"]
            isOneToOne: false
            referencedRelation: "distribuicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      distribuicao_recusas: {
        Row: {
          agente_id: string
          distribuicao_id: string
          id: string
          motivo: string
          recusada_em: string
        }
        Insert: {
          agente_id: string
          distribuicao_id: string
          id?: string
          motivo?: string
          recusada_em?: string
        }
        Update: {
          agente_id?: string
          distribuicao_id?: string
          id?: string
          motivo?: string
          recusada_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "distribuicao_recusas_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribuicao_recusas_distribuicao_id_fkey"
            columns: ["distribuicao_id"]
            isOneToOne: false
            referencedRelation: "distribuicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      distribuicoes: {
        Row: {
          aceita_em: string | null
          agente_auxiliar_id: string | null
          agente_id: string | null
          aprovada_em: string | null
          aprovada_por: string | null
          aprovada_por_nome: string
          atualizado_em: string
          cancelada_em: string | null
          concluida_em: string | null
          criada_em: string
          descartados: Json
          distribuida_em: string | null
          elegiveis: Json
          gatilho: string
          horario_especial: boolean
          id: string
          locadora_id: string
          motivo: string
          moto_id: string | null
          notificada_em: string | null
          ordem_id: string | null
          origem: Database["public"]["Enums"]["distribuicao_origem"]
          recusada_em: string | null
          referencia_adicional_cobranca: number
          referencia_adicional_pagamento: number
          referencia_cobranca: number
          referencia_pagamento: number
          regra: string
          servico_id: string | null
          servico_nome: string
          status: Database["public"]["Enums"]["distribuicao_status"]
          tipo: Database["public"]["Enums"]["distribuicao_tipo"]
          valor_cobranca: number
          valor_cobranca_adicional: number
          valor_cobranca_base: number
          valor_pagamento: number
          valor_pagamento_adicional: number
          valor_pagamento_base: number
          vistoria_id: string | null
        }
        Insert: {
          aceita_em?: string | null
          agente_auxiliar_id?: string | null
          agente_id?: string | null
          aprovada_em?: string | null
          aprovada_por?: string | null
          aprovada_por_nome?: string
          atualizado_em?: string
          cancelada_em?: string | null
          concluida_em?: string | null
          criada_em?: string
          descartados?: Json
          distribuida_em?: string | null
          elegiveis?: Json
          gatilho?: string
          horario_especial?: boolean
          id?: string
          locadora_id: string
          motivo?: string
          moto_id?: string | null
          notificada_em?: string | null
          ordem_id?: string | null
          origem?: Database["public"]["Enums"]["distribuicao_origem"]
          recusada_em?: string | null
          referencia_adicional_cobranca?: number
          referencia_adicional_pagamento?: number
          referencia_cobranca?: number
          referencia_pagamento?: number
          regra?: string
          servico_id?: string | null
          servico_nome?: string
          status?: Database["public"]["Enums"]["distribuicao_status"]
          tipo: Database["public"]["Enums"]["distribuicao_tipo"]
          valor_cobranca?: number
          valor_cobranca_adicional?: number
          valor_cobranca_base?: number
          valor_pagamento?: number
          valor_pagamento_adicional?: number
          valor_pagamento_base?: number
          vistoria_id?: string | null
        }
        Update: {
          aceita_em?: string | null
          agente_auxiliar_id?: string | null
          agente_id?: string | null
          aprovada_em?: string | null
          aprovada_por?: string | null
          aprovada_por_nome?: string
          atualizado_em?: string
          cancelada_em?: string | null
          concluida_em?: string | null
          criada_em?: string
          descartados?: Json
          distribuida_em?: string | null
          elegiveis?: Json
          gatilho?: string
          horario_especial?: boolean
          id?: string
          locadora_id?: string
          motivo?: string
          moto_id?: string | null
          notificada_em?: string | null
          ordem_id?: string | null
          origem?: Database["public"]["Enums"]["distribuicao_origem"]
          recusada_em?: string | null
          referencia_adicional_cobranca?: number
          referencia_adicional_pagamento?: number
          referencia_cobranca?: number
          referencia_pagamento?: number
          regra?: string
          servico_id?: string | null
          servico_nome?: string
          status?: Database["public"]["Enums"]["distribuicao_status"]
          tipo?: Database["public"]["Enums"]["distribuicao_tipo"]
          valor_cobranca?: number
          valor_cobranca_adicional?: number
          valor_cobranca_base?: number
          valor_pagamento?: number
          valor_pagamento_adicional?: number
          valor_pagamento_base?: number
          vistoria_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distribuicoes_agente_auxiliar_id_fkey"
            columns: ["agente_auxiliar_id"]
            isOneToOne: false
            referencedRelation: "agentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribuicoes_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribuicoes_locadora_id_fkey"
            columns: ["locadora_id"]
            isOneToOne: false
            referencedRelation: "locadoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribuicoes_moto_id_fkey"
            columns: ["moto_id"]
            isOneToOne: false
            referencedRelation: "motos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribuicoes_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribuicoes_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribuicoes_vistoria_id_fkey"
            columns: ["vistoria_id"]
            isOneToOne: false
            referencedRelation: "vistorias"
            referencedColumns: ["id"]
          },
        ]
      }
      importacoes: {
        Row: {
          arquivo: string
          autor: string
          criada_em: string
          id: string
          locadora_id: string
          total: number
        }
        Insert: {
          arquivo: string
          autor?: string
          criada_em?: string
          id?: string
          locadora_id: string
          total?: number
        }
        Update: {
          arquivo?: string
          autor?: string
          criada_em?: string
          id?: string
          locadora_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "importacoes_locadora_id_fkey"
            columns: ["locadora_id"]
            isOneToOne: false
            referencedRelation: "locadoras"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_remuneracao: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          codigo: string
          criado_em: string
          criado_por: string | null
          descricao: string
          id: string
          nome: string
          observacao: string
          posicao: number
          servico_id: string | null
          status: string
          tabela_id: string
          unidade: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          codigo?: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string
          id?: string
          nome: string
          observacao?: string
          posicao?: number
          servico_id?: string | null
          status?: string
          tabela_id: string
          unidade?: string
          valor?: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          codigo?: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string
          id?: string
          nome?: string
          observacao?: string
          posicao?: number
          servico_id?: string | null
          status?: string
          tabela_id?: string
          unidade?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "itens_remuneracao_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_remuneracao_tabela_id_fkey"
            columns: ["tabela_id"]
            isOneToOne: false
            referencedRelation: "tabelas_remuneracao"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos_agente: {
        Row: {
          agente_id: string
          comprovante: string
          criado_em: string
          criado_por: string | null
          data: string
          descricao: string
          forma: string
          id: string
          motivo: string
          observacao: string
          ordem_id: string | null
          referencia_id: string | null
          responsavel: string
          situacao: string
          tipo: Database["public"]["Enums"]["tipo_lancamento"]
          valor: number
        }
        Insert: {
          agente_id: string
          comprovante?: string
          criado_em?: string
          criado_por?: string | null
          data?: string
          descricao?: string
          forma?: string
          id?: string
          motivo?: string
          observacao?: string
          ordem_id?: string | null
          referencia_id?: string | null
          responsavel?: string
          situacao?: string
          tipo: Database["public"]["Enums"]["tipo_lancamento"]
          valor: number
        }
        Update: {
          agente_id?: string
          comprovante?: string
          criado_em?: string
          criado_por?: string | null
          data?: string
          descricao?: string
          forma?: string
          id?: string
          motivo?: string
          observacao?: string
          ordem_id?: string | null
          referencia_id?: string | null
          responsavel?: string
          situacao?: string
          tipo?: Database["public"]["Enums"]["tipo_lancamento"]
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_agente_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_agente_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens"
            referencedColumns: ["id"]
          },
        ]
      }
      locadora_apelidos: {
        Row: {
          apelido: string
          criado_em: string
          id: string
          locadora_id: string
        }
        Insert: {
          apelido: string
          criado_em?: string
          id?: string
          locadora_id: string
        }
        Update: {
          apelido?: string
          criado_em?: string
          id?: string
          locadora_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "locadora_apelidos_locadora_id_fkey"
            columns: ["locadora_id"]
            isOneToOne: false
            referencedRelation: "locadoras"
            referencedColumns: ["id"]
          },
        ]
      }
      locadoras: {
        Row: {
          ativa: boolean
          bairro: string
          cep: string
          cidade: string
          cnae: string
          cnpj: string
          complemento: string
          criada_em: string
          data_abertura: string
          email: string
          forma_pagamento: string
          id: string
          limite_credito: number
          natureza_juridica: string
          nome: string
          nome_fantasia: string
          numero: string
          observacoes: string
          prazo_pagamento: number
          razao_social: string
          responsavel: string
          rua: string
          situacao_cadastral: string
          tabela_cobranca_id: string | null
          telefone: string
          uf: string
        }
        Insert: {
          ativa?: boolean
          bairro?: string
          cep?: string
          cidade?: string
          cnae?: string
          cnpj?: string
          complemento?: string
          criada_em?: string
          data_abertura?: string
          email?: string
          forma_pagamento?: string
          id?: string
          limite_credito?: number
          natureza_juridica?: string
          nome: string
          nome_fantasia?: string
          numero?: string
          observacoes?: string
          prazo_pagamento?: number
          razao_social?: string
          responsavel?: string
          rua?: string
          situacao_cadastral?: string
          tabela_cobranca_id?: string | null
          telefone?: string
          uf?: string
        }
        Update: {
          ativa?: boolean
          bairro?: string
          cep?: string
          cidade?: string
          cnae?: string
          cnpj?: string
          complemento?: string
          criada_em?: string
          data_abertura?: string
          email?: string
          forma_pagamento?: string
          id?: string
          limite_credito?: number
          natureza_juridica?: string
          nome?: string
          nome_fantasia?: string
          numero?: string
          observacoes?: string
          prazo_pagamento?: number
          razao_social?: string
          responsavel?: string
          rua?: string
          situacao_cadastral?: string
          tabela_cobranca_id?: string | null
          telefone?: string
          uf?: string
        }
        Relationships: [
          {
            foreignKeyName: "locadoras_tabela_cobranca_id_fkey"
            columns: ["tabela_cobranca_id"]
            isOneToOne: false
            referencedRelation: "tabelas_remuneracao"
            referencedColumns: ["id"]
          },
        ]
      }
      motos: {
        Row: {
          ano: string
          atualizado_em: string
          chassi: string
          cor: string
          criada_em: string
          criada_por: string | null
          host: string
          id: string
          locadora_id: string
          marca: string
          modelo: string
          observacoes: string
          pin: string
          placa: string
          proxima_vistoria_at: string | null
          situacao: Database["public"]["Enums"]["situacao_moto"]
          ultima_vistoria_at: string | null
        }
        Insert: {
          ano?: string
          atualizado_em?: string
          chassi?: string
          cor?: string
          criada_em?: string
          criada_por?: string | null
          host?: string
          id?: string
          locadora_id: string
          marca?: string
          modelo?: string
          observacoes?: string
          pin?: string
          placa: string
          proxima_vistoria_at?: string | null
          situacao?: Database["public"]["Enums"]["situacao_moto"]
          ultima_vistoria_at?: string | null
        }
        Update: {
          ano?: string
          atualizado_em?: string
          chassi?: string
          cor?: string
          criada_em?: string
          criada_por?: string | null
          host?: string
          id?: string
          locadora_id?: string
          marca?: string
          modelo?: string
          observacoes?: string
          pin?: string
          placa?: string
          proxima_vistoria_at?: string | null
          situacao?: Database["public"]["Enums"]["situacao_moto"]
          ultima_vistoria_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "motos_locadora_id_fkey"
            columns: ["locadora_id"]
            isOneToOne: false
            referencedRelation: "locadoras"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          criada_em: string
          dados: Json
          entregue_em: string | null
          id: string
          lida: boolean
          lida_em: string | null
          mensagem: string
          ordem_id: string | null
          tipo: string
          titulo: string
          usuario_id: string
          vistoria_id: string | null
        }
        Insert: {
          criada_em?: string
          dados?: Json
          entregue_em?: string | null
          id?: string
          lida?: boolean
          lida_em?: string | null
          mensagem?: string
          ordem_id?: string | null
          tipo?: string
          titulo: string
          usuario_id: string
          vistoria_id?: string | null
        }
        Update: {
          criada_em?: string
          dados?: Json
          entregue_em?: string | null
          id?: string
          lida?: boolean
          lida_em?: string | null
          mensagem?: string
          ordem_id?: string | null
          tipo?: string
          titulo?: string
          usuario_id?: string
          vistoria_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_vistoria_id_fkey"
            columns: ["vistoria_id"]
            isOneToOne: false
            referencedRelation: "vistorias"
            referencedColumns: ["id"]
          },
        ]
      }
      ordem_cobrancas: {
        Row: {
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          estornada_em: string | null
          estornada_por: string | null
          id: string
          locadora_id: string
          motivo_estorno: string
          nome: string
          observacao: string
          ordem_id: string
          situacao: string
          tipo: string
          valor: number
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          estornada_em?: string | null
          estornada_por?: string | null
          id?: string
          locadora_id: string
          motivo_estorno?: string
          nome?: string
          observacao?: string
          ordem_id: string
          situacao?: string
          tipo?: string
          valor?: number
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          estornada_em?: string | null
          estornada_por?: string | null
          id?: string
          locadora_id?: string
          motivo_estorno?: string
          nome?: string
          observacao?: string
          ordem_id?: string
          situacao?: string
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordem_cobrancas_locadora_id_fkey"
            columns: ["locadora_id"]
            isOneToOne: false
            referencedRelation: "locadoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordem_cobrancas_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens"
            referencedColumns: ["id"]
          },
        ]
      }
      ordem_evidencias: {
        Row: {
          agente_id: string | null
          caminho: string
          criada_em: string
          etapa: string
          gps: string
          id: string
          locadora_id: string
          mime: string
          nome: string
          observacao: string
          ordem_id: string
          tamanho: number
          tipo: string
          url: string
          usuario_id: string | null
        }
        Insert: {
          agente_id?: string | null
          caminho?: string
          criada_em?: string
          etapa?: string
          gps?: string
          id?: string
          locadora_id: string
          mime?: string
          nome?: string
          observacao?: string
          ordem_id: string
          tamanho?: number
          tipo?: string
          url?: string
          usuario_id?: string | null
        }
        Update: {
          agente_id?: string | null
          caminho?: string
          criada_em?: string
          etapa?: string
          gps?: string
          id?: string
          locadora_id?: string
          mime?: string
          nome?: string
          observacao?: string
          ordem_id?: string
          tamanho?: number
          tipo?: string
          url?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordem_evidencias_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordem_evidencias_locadora_id_fkey"
            columns: ["locadora_id"]
            isOneToOne: false
            referencedRelation: "locadoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordem_evidencias_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens"
            referencedColumns: ["id"]
          },
        ]
      }
      ordem_fotos: {
        Row: {
          criada_em: string
          etapa: string
          id: string
          imagem: string
          ordem_id: string
        }
        Insert: {
          criada_em?: string
          etapa: string
          id?: string
          imagem: string
          ordem_id: string
        }
        Update: {
          criada_em?: string
          etapa?: string
          id?: string
          imagem?: string
          ordem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordem_fotos_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens"
            referencedColumns: ["id"]
          },
        ]
      }
      ordem_historico: {
        Row: {
          acao: string
          detalhe: string | null
          gps: string | null
          id: string
          ordem_id: string
          quando: string
          quem: string
        }
        Insert: {
          acao: string
          detalhe?: string | null
          gps?: string | null
          id?: string
          ordem_id: string
          quando?: string
          quem: string
        }
        Update: {
          acao?: string
          detalhe?: string | null
          gps?: string | null
          id?: string
          ordem_id?: string
          quando?: string
          quem?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordem_historico_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens: {
        Row: {
          aceita_em: string | null
          agente_auxiliar_id: string | null
          agente_id: string | null
          ano: string
          bairro: string
          cancelada_em: string | null
          cep: string
          checklist: Json | null
          chegada_em: string | null
          cidade: string
          codigo: string
          concluida_em: string | null
          cor: string
          cpf: string
          criada_em: string
          criada_por: string | null
          definido_em: string | null
          definido_por: string | null
          distribuida_em: string | null
          endereco: string
          horario_especial: boolean
          host: string
          id: string
          iniciada_em: string | null
          latitude: string
          legado: boolean
          liberado_em: string | null
          liberado_por: string | null
          link_maps: string
          link_rastreador: string | null
          locadora_id: string
          locatario: string
          longitude: string
          marca: string
          modelo: string
          motivo_cancelamento: string
          observacoes: string | null
          pagamento_pago: boolean
          pin: string
          placa: string
          prioridade: Database["public"]["Enums"]["prioridade"]
          quantidade_km: number
          recebimento_pago: boolean
          resumo_ia: string
          servico_id: string | null
          situacao_financeira: string
          status: Database["public"]["Enums"]["status_ordem"]
          status_informado: string
          telefone: string
          telefone_secundario: string
          termo_aceito: boolean
          texto_origem: string
          tipo_servico: Database["public"]["Enums"]["tipo_servico"] | null
          uf: string
          ultimo_rastreio: string
          valor_cobranca: number | null
          valor_cobranca_adicional: number
          valor_cobranca_base: number | null
          valor_cobranca_final: number | null
          valor_pagamento: number | null
          valor_pagamento_adicional: number
          valor_pagamento_auxiliar: number | null
          valor_pagamento_base: number | null
          valor_pagamento_final: number | null
          valor_pagamento_principal: number | null
          valor_pendente: number
        }
        Insert: {
          aceita_em?: string | null
          agente_auxiliar_id?: string | null
          agente_id?: string | null
          ano?: string
          bairro?: string
          cancelada_em?: string | null
          cep?: string
          checklist?: Json | null
          chegada_em?: string | null
          cidade?: string
          codigo: string
          concluida_em?: string | null
          cor?: string
          cpf?: string
          criada_em?: string
          criada_por?: string | null
          definido_em?: string | null
          definido_por?: string | null
          distribuida_em?: string | null
          endereco?: string
          horario_especial?: boolean
          host?: string
          id?: string
          iniciada_em?: string | null
          latitude?: string
          legado?: boolean
          liberado_em?: string | null
          liberado_por?: string | null
          link_maps?: string
          link_rastreador?: string | null
          locadora_id: string
          locatario?: string
          longitude?: string
          marca?: string
          modelo?: string
          motivo_cancelamento?: string
          observacoes?: string | null
          pagamento_pago?: boolean
          pin?: string
          placa: string
          prioridade?: Database["public"]["Enums"]["prioridade"]
          quantidade_km?: number
          recebimento_pago?: boolean
          resumo_ia?: string
          servico_id?: string | null
          situacao_financeira?: string
          status?: Database["public"]["Enums"]["status_ordem"]
          status_informado?: string
          telefone?: string
          telefone_secundario?: string
          termo_aceito?: boolean
          texto_origem?: string
          tipo_servico?: Database["public"]["Enums"]["tipo_servico"] | null
          uf?: string
          ultimo_rastreio?: string
          valor_cobranca?: number | null
          valor_cobranca_adicional?: number
          valor_cobranca_base?: number | null
          valor_cobranca_final?: number | null
          valor_pagamento?: number | null
          valor_pagamento_adicional?: number
          valor_pagamento_auxiliar?: number | null
          valor_pagamento_base?: number | null
          valor_pagamento_final?: number | null
          valor_pagamento_principal?: number | null
          valor_pendente?: number
        }
        Update: {
          aceita_em?: string | null
          agente_auxiliar_id?: string | null
          agente_id?: string | null
          ano?: string
          bairro?: string
          cancelada_em?: string | null
          cep?: string
          checklist?: Json | null
          chegada_em?: string | null
          cidade?: string
          codigo?: string
          concluida_em?: string | null
          cor?: string
          cpf?: string
          criada_em?: string
          criada_por?: string | null
          definido_em?: string | null
          definido_por?: string | null
          distribuida_em?: string | null
          endereco?: string
          horario_especial?: boolean
          host?: string
          id?: string
          iniciada_em?: string | null
          latitude?: string
          legado?: boolean
          liberado_em?: string | null
          liberado_por?: string | null
          link_maps?: string
          link_rastreador?: string | null
          locadora_id?: string
          locatario?: string
          longitude?: string
          marca?: string
          modelo?: string
          motivo_cancelamento?: string
          observacoes?: string | null
          pagamento_pago?: boolean
          pin?: string
          placa?: string
          prioridade?: Database["public"]["Enums"]["prioridade"]
          quantidade_km?: number
          recebimento_pago?: boolean
          resumo_ia?: string
          servico_id?: string | null
          situacao_financeira?: string
          status?: Database["public"]["Enums"]["status_ordem"]
          status_informado?: string
          telefone?: string
          telefone_secundario?: string
          termo_aceito?: boolean
          texto_origem?: string
          tipo_servico?: Database["public"]["Enums"]["tipo_servico"] | null
          uf?: string
          ultimo_rastreio?: string
          valor_cobranca?: number | null
          valor_cobranca_adicional?: number
          valor_cobranca_base?: number | null
          valor_cobranca_final?: number | null
          valor_pagamento?: number | null
          valor_pagamento_adicional?: number
          valor_pagamento_auxiliar?: number | null
          valor_pagamento_base?: number | null
          valor_pagamento_final?: number | null
          valor_pagamento_principal?: number | null
          valor_pendente?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordens_agente_auxiliar_id_fkey"
            columns: ["agente_auxiliar_id"]
            isOneToOne: false
            referencedRelation: "agentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_locadora_id_fkey"
            columns: ["locadora_id"]
            isOneToOne: false
            referencedRelation: "locadoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_agente: {
        Row: {
          agente_id: string
          comprovante: string
          criado_em: string
          forma: string
          id: string
          observacao: string
          pago_em: string
          responsavel: string
          valor: number
        }
        Insert: {
          agente_id: string
          comprovante?: string
          criado_em?: string
          forma?: string
          id?: string
          observacao?: string
          pago_em?: string
          responsavel?: string
          valor?: number
        }
        Update: {
          agente_id?: string
          comprovante?: string
          criado_em?: string
          forma?: string
          id?: string
          observacao?: string
          pago_em?: string
          responsavel?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_agente_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes"
            referencedColumns: ["id"]
          },
        ]
      }
      precos: {
        Row: {
          escopo: string
          id: string
          referencia_id: string
          tipo_servico: Database["public"]["Enums"]["tipo_servico"]
          valor: number
        }
        Insert: {
          escopo: string
          id?: string
          referencia_id: string
          tipo_servico: Database["public"]["Enums"]["tipo_servico"]
          valor?: number
        }
        Update: {
          escopo?: string
          id?: string
          referencia_id?: string
          tipo_servico?: Database["public"]["Enums"]["tipo_servico"]
          valor?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          agente_id: string | null
          criado_em: string
          email: string
          id: string
          locadora_id: string | null
          nome: string
          tutorial_apresentado_em: string | null
        }
        Insert: {
          agente_id?: string | null
          criado_em?: string
          email?: string
          id: string
          locadora_id?: string | null
          nome?: string
          tutorial_apresentado_em?: string | null
        }
        Update: {
          agente_id?: string | null
          criado_em?: string
          email?: string
          id?: string
          locadora_id?: string | null
          nome?: string
          tutorial_apresentado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_locadora_id_fkey"
            columns: ["locadora_id"]
            isOneToOne: false
            referencedRelation: "locadoras"
            referencedColumns: ["id"]
          },
        ]
      }
      push_config: {
        Row: {
          atualizado_em: string
          chave: string
          valor: string
        }
        Insert: {
          atualizado_em?: string
          chave: string
          valor: string
        }
        Update: {
          atualizado_em?: string
          chave?: string
          valor?: string
        }
        Relationships: []
      }
      push_dispatch_tokens: {
        Row: {
          criado_em: string
          expira_em: string
          notificacao_id: string
          token: string
        }
        Insert: {
          criado_em?: string
          expira_em?: string
          notificacao_id: string
          token?: string
        }
        Update: {
          criado_em?: string
          expira_em?: string
          notificacao_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_dispatch_tokens_notificacao_id_fkey"
            columns: ["notificacao_id"]
            isOneToOne: true
            referencedRelation: "notificacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      push_notification_logs: {
        Row: {
          enviado_em: string
          erro: string
          id: string
          notification_id: string | null
          status: string
          subscription_id: string | null
          usuario_id: string | null
        }
        Insert: {
          enviado_em?: string
          erro?: string
          id?: string
          notification_id?: string | null
          status?: string
          subscription_id?: string | null
          usuario_id?: string | null
        }
        Update: {
          enviado_em?: string
          erro?: string
          id?: string
          notification_id?: string | null
          status?: string
          subscription_id?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_notification_logs_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notificacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_notification_logs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          agente_id: string | null
          ativo: boolean
          atualizada_em: string
          auth: string
          criada_em: string
          dispositivo: string
          endpoint: string
          id: string
          navegador: string
          p256dh: string
          ultimo_envio_em: string | null
          ultimo_erro: string
          user_agent: string
          usuario_id: string
        }
        Insert: {
          agente_id?: string | null
          ativo?: boolean
          atualizada_em?: string
          auth: string
          criada_em?: string
          dispositivo?: string
          endpoint: string
          id?: string
          navegador?: string
          p256dh: string
          ultimo_envio_em?: string | null
          ultimo_erro?: string
          user_agent?: string
          usuario_id: string
        }
        Update: {
          agente_id?: string | null
          ativo?: boolean
          atualizada_em?: string
          auth?: string
          criada_em?: string
          dispositivo?: string
          endpoint?: string
          id?: string
          navegador?: string
          p256dh?: string
          ultimo_envio_em?: string | null
          ultimo_erro?: string
          user_agent?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes"
            referencedColumns: ["id"]
          },
        ]
      }
      servicos: {
        Row: {
          ativo: boolean
          atualizado_em: string
          codigo: string
          criado_em: string
          descricao: string
          id: string
          nome: string
          posicao: number
          unidade: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          codigo: string
          criado_em?: string
          descricao?: string
          id?: string
          nome: string
          posicao?: number
          unidade?: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          codigo?: string
          criado_em?: string
          descricao?: string
          id?: string
          nome?: string
          posicao?: number
          unidade?: string
        }
        Relationships: []
      }
      tabelas_remuneracao: {
        Row: {
          agente_id: string | null
          ativa: boolean
          atualizado_em: string
          atualizado_por: string | null
          criado_em: string
          criado_por: string | null
          escopo: string
          id: string
          locadora_id: string | null
          nome: string
          observacao: string
          padrao: boolean
        }
        Insert: {
          agente_id?: string | null
          ativa?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          escopo: string
          id?: string
          locadora_id?: string | null
          nome: string
          observacao?: string
          padrao?: boolean
        }
        Update: {
          agente_id?: string | null
          ativa?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          escopo?: string
          id?: string
          locadora_id?: string | null
          nome?: string
          observacao?: string
          padrao?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tabelas_remuneracao_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabelas_remuneracao_locadora_id_fkey"
            columns: ["locadora_id"]
            isOneToOne: false
            referencedRelation: "locadoras"
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
        Relationships: []
      }
      vistoria_avarias: {
        Row: {
          atualizado_em: string
          componente: string
          condicao: string
          criado_em: string
          criado_por: string | null
          descricao: string
          id: string
          item_id: string | null
          vistoria_id: string
        }
        Insert: {
          atualizado_em?: string
          componente: string
          condicao?: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string
          id?: string
          item_id?: string | null
          vistoria_id: string
        }
        Update: {
          atualizado_em?: string
          componente?: string
          condicao?: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string
          id?: string
          item_id?: string | null
          vistoria_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vistoria_avarias_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "vistoria_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistoria_avarias_vistoria_id_fkey"
            columns: ["vistoria_id"]
            isOneToOne: false
            referencedRelation: "vistorias"
            referencedColumns: ["id"]
          },
        ]
      }
      vistoria_checklist_itens: {
        Row: {
          ativo: boolean
          atualizado_em: string
          codigo: string
          criado_em: string
          foto_quando_regular: boolean
          foto_quando_ruim: boolean
          id: string
          nome: string
          obrigatorio: boolean
          posicao: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          codigo: string
          criado_em?: string
          foto_quando_regular?: boolean
          foto_quando_ruim?: boolean
          id?: string
          nome: string
          obrigatorio?: boolean
          posicao?: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          codigo?: string
          criado_em?: string
          foto_quando_regular?: boolean
          foto_quando_ruim?: boolean
          id?: string
          nome?: string
          obrigatorio?: boolean
          posicao?: number
        }
        Relationships: []
      }
      vistoria_evidencias: {
        Row: {
          agente_id: string | null
          avaria_id: string | null
          caminho: string
          categoria: string
          criada_em: string
          etapa: string
          gps: string
          id: string
          km: number | null
          latitude: string
          locadora_id: string
          longitude: string
          mime: string
          moto_id: string
          nome: string
          observacao: string
          tamanho: number
          tipo: string
          url: string
          usuario_id: string | null
          vistoria_id: string
        }
        Insert: {
          agente_id?: string | null
          avaria_id?: string | null
          caminho?: string
          categoria?: string
          criada_em?: string
          etapa?: string
          gps?: string
          id?: string
          km?: number | null
          latitude?: string
          locadora_id: string
          longitude?: string
          mime?: string
          moto_id: string
          nome?: string
          observacao?: string
          tamanho?: number
          tipo?: string
          url?: string
          usuario_id?: string | null
          vistoria_id: string
        }
        Update: {
          agente_id?: string | null
          avaria_id?: string | null
          caminho?: string
          categoria?: string
          criada_em?: string
          etapa?: string
          gps?: string
          id?: string
          km?: number | null
          latitude?: string
          locadora_id?: string
          longitude?: string
          mime?: string
          moto_id?: string
          nome?: string
          observacao?: string
          tamanho?: number
          tipo?: string
          url?: string
          usuario_id?: string | null
          vistoria_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vistoria_evidencias_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistoria_evidencias_avaria_id_fkey"
            columns: ["avaria_id"]
            isOneToOne: false
            referencedRelation: "vistoria_avarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistoria_evidencias_locadora_id_fkey"
            columns: ["locadora_id"]
            isOneToOne: false
            referencedRelation: "locadoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistoria_evidencias_moto_id_fkey"
            columns: ["moto_id"]
            isOneToOne: false
            referencedRelation: "motos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistoria_evidencias_vistoria_id_fkey"
            columns: ["vistoria_id"]
            isOneToOne: false
            referencedRelation: "vistorias"
            referencedColumns: ["id"]
          },
        ]
      }
      vistoria_historico: {
        Row: {
          acao: string
          detalhe: string
          gps: string
          id: string
          moto_id: string | null
          quando: string
          quem: string
          vistoria_id: string
        }
        Insert: {
          acao: string
          detalhe?: string
          gps?: string
          id?: string
          moto_id?: string | null
          quando?: string
          quem?: string
          vistoria_id: string
        }
        Update: {
          acao?: string
          detalhe?: string
          gps?: string
          id?: string
          moto_id?: string | null
          quando?: string
          quem?: string
          vistoria_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vistoria_historico_moto_id_fkey"
            columns: ["moto_id"]
            isOneToOne: false
            referencedRelation: "motos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistoria_historico_vistoria_id_fkey"
            columns: ["vistoria_id"]
            isOneToOne: false
            referencedRelation: "vistorias"
            referencedColumns: ["id"]
          },
        ]
      }
      vistoria_itens: {
        Row: {
          atualizado_em: string
          avaliado_em: string | null
          avaliado_por: string | null
          catalogo_id: string | null
          codigo: string
          condicao: string
          criado_em: string
          id: string
          item: string
          obrigatorio: boolean
          observacao: string
          posicao: number
          vistoria_id: string
        }
        Insert: {
          atualizado_em?: string
          avaliado_em?: string | null
          avaliado_por?: string | null
          catalogo_id?: string | null
          codigo?: string
          condicao?: string
          criado_em?: string
          id?: string
          item: string
          obrigatorio?: boolean
          observacao?: string
          posicao?: number
          vistoria_id: string
        }
        Update: {
          atualizado_em?: string
          avaliado_em?: string | null
          avaliado_por?: string | null
          catalogo_id?: string | null
          codigo?: string
          condicao?: string
          criado_em?: string
          id?: string
          item?: string
          obrigatorio?: boolean
          observacao?: string
          posicao?: number
          vistoria_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vistoria_itens_catalogo_id_fkey"
            columns: ["catalogo_id"]
            isOneToOne: false
            referencedRelation: "vistoria_checklist_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistoria_itens_vistoria_id_fkey"
            columns: ["vistoria_id"]
            isOneToOne: false
            referencedRelation: "vistorias"
            referencedColumns: ["id"]
          },
        ]
      }
      vistorias: {
        Row: {
          aceita_em: string | null
          agente_auxiliar_id: string | null
          agente_id: string | null
          atualizado_em: string
          bairro: string
          cancelada_em: string | null
          cep: string
          checklist: Json | null
          chegada_em: string | null
          cidade: string
          codigo: string
          concluida_em: string | null
          contato_email: string
          contato_nome: string
          contato_telefone: string
          criada_em: string
          distribuida_em: string | null
          distribuida_por: string | null
          endereco: string
          host: string
          id: string
          iniciada_em: string | null
          km: number | null
          latitude: string
          link_maps: string
          locadora_id: string
          longitude: string
          motivo_cancelamento: string
          moto_id: string
          observacoes: string
          origem: string
          pagamento_pago: boolean
          pin: string
          pin_validade: string
          recebimento_pago: boolean
          servico_id: string | null
          solicitada_em: string
          solicitada_por: string | null
          status: Database["public"]["Enums"]["status_vistoria"]
          tabela_cobranca_id: string | null
          tabela_pagamento_id: string | null
          termo_aceito: boolean
          termo_aceito_em: string | null
          texto_origem: string
          uf: string
          valor_cobranca: number | null
          valor_pagamento: number | null
          valor_pagamento_auxiliar: number | null
          valor_pagamento_principal: number | null
        }
        Insert: {
          aceita_em?: string | null
          agente_auxiliar_id?: string | null
          agente_id?: string | null
          atualizado_em?: string
          bairro?: string
          cancelada_em?: string | null
          cep?: string
          checklist?: Json | null
          chegada_em?: string | null
          cidade?: string
          codigo?: string
          concluida_em?: string | null
          contato_email?: string
          contato_nome?: string
          contato_telefone?: string
          criada_em?: string
          distribuida_em?: string | null
          distribuida_por?: string | null
          endereco?: string
          host?: string
          id?: string
          iniciada_em?: string | null
          km?: number | null
          latitude?: string
          link_maps?: string
          locadora_id: string
          longitude?: string
          motivo_cancelamento?: string
          moto_id: string
          observacoes?: string
          origem?: string
          pagamento_pago?: boolean
          pin?: string
          pin_validade?: string
          recebimento_pago?: boolean
          servico_id?: string | null
          solicitada_em?: string
          solicitada_por?: string | null
          status?: Database["public"]["Enums"]["status_vistoria"]
          tabela_cobranca_id?: string | null
          tabela_pagamento_id?: string | null
          termo_aceito?: boolean
          termo_aceito_em?: string | null
          texto_origem?: string
          uf?: string
          valor_cobranca?: number | null
          valor_pagamento?: number | null
          valor_pagamento_auxiliar?: number | null
          valor_pagamento_principal?: number | null
        }
        Update: {
          aceita_em?: string | null
          agente_auxiliar_id?: string | null
          agente_id?: string | null
          atualizado_em?: string
          bairro?: string
          cancelada_em?: string | null
          cep?: string
          checklist?: Json | null
          chegada_em?: string | null
          cidade?: string
          codigo?: string
          concluida_em?: string | null
          contato_email?: string
          contato_nome?: string
          contato_telefone?: string
          criada_em?: string
          distribuida_em?: string | null
          distribuida_por?: string | null
          endereco?: string
          host?: string
          id?: string
          iniciada_em?: string | null
          km?: number | null
          latitude?: string
          link_maps?: string
          locadora_id?: string
          longitude?: string
          motivo_cancelamento?: string
          moto_id?: string
          observacoes?: string
          origem?: string
          pagamento_pago?: boolean
          pin?: string
          pin_validade?: string
          recebimento_pago?: boolean
          servico_id?: string | null
          solicitada_em?: string
          solicitada_por?: string | null
          status?: Database["public"]["Enums"]["status_vistoria"]
          tabela_cobranca_id?: string | null
          tabela_pagamento_id?: string | null
          termo_aceito?: boolean
          termo_aceito_em?: string | null
          texto_origem?: string
          uf?: string
          valor_cobranca?: number | null
          valor_pagamento?: number | null
          valor_pagamento_auxiliar?: number | null
          valor_pagamento_principal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vistorias_agente_auxiliar_id_fkey"
            columns: ["agente_auxiliar_id"]
            isOneToOne: false
            referencedRelation: "agentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistorias_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistorias_locadora_id_fkey"
            columns: ["locadora_id"]
            isOneToOne: false
            referencedRelation: "locadoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistorias_moto_id_fkey"
            columns: ["moto_id"]
            isOneToOne: false
            referencedRelation: "motos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistorias_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistorias_tabela_cobranca_id_fkey"
            columns: ["tabela_cobranca_id"]
            isOneToOne: false
            referencedRelation: "tabelas_remuneracao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistorias_tabela_pagamento_id_fkey"
            columns: ["tabela_pagamento_id"]
            isOneToOne: false
            referencedRelation: "tabelas_remuneracao"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aceitar_distribuicao: { Args: { _dist: string }; Returns: undefined }
      aceitar_ordem: { Args: { _ordem: string }; Returns: string }
      adicional_horario: { Args: { _escopo: string }; Returns: number }
      admin_alterar_servico: {
        Args: { _dist: string; _motivo?: string; _servico: string }
        Returns: undefined
      }
      admin_alterar_valor: {
        Args: {
          _cobranca: number
          _dist: string
          _motivo?: string
          _pagamento: number
        }
        Returns: undefined
      }
      admin_cancelar_distribuicao: {
        Args: { _dist: string; _motivo?: string }
        Returns: undefined
      }
      admin_redistribuir: {
        Args: { _agente?: string; _dist: string; _motivo?: string }
        Returns: string
      }
      agente_aceita_servico: {
        Args: { _agente: string; _servico: string }
        Returns: boolean
      }
      agente_disponivel: { Args: { _agente: string }; Returns: boolean }
      agente_do_usuario: { Args: { _user_id: string }; Returns: string }
      agente_ocupado: { Args: { _agente: string }; Returns: boolean }
      aprovar_distribuicao: {
        Args: {
          _cobranca_adicional: number
          _cobranca_base: number
          _dist: string
          _motivo?: string
          _pagamento_adicional: number
          _pagamento_base: number
        }
        Returns: string
      }
      atualizar_cadastro_agente: {
        Args: {
          _agente: string
          _cidade: string
          _nome: string
          _situacao: string
          _telefone: string
        }
        Returns: undefined
      }
      cancelar_ordem_locadora: {
        Args: {
          _aceite?: boolean
          _motivo?: string
          _ordem_id: string
          _texto_aceite?: string
        }
        Returns: Json
      }
      config_valor: {
        Args: { _chave: string; _padrao: string }
        Returns: string
      }
      consumir_token_push: {
        Args: { _notificacao_id: string; _token: string }
        Returns: boolean
      }
      definir_auxiliar_distribuicao: {
        Args: { _auxiliar: string; _dist: string }
        Returns: undefined
      }
      definir_servico_aceito: {
        Args: { _aceita: boolean; _servico: string }
        Returns: undefined
      }
      em_horario_especial: { Args: { _em: string }; Returns: boolean }
      equipe: { Args: { _user_id: string }; Returns: boolean }
      fotos_obrigatorias_vistoria: { Args: never; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      horario_especial_inicio: { Args: never; Returns: string }
      locadora_do_usuario: { Args: { _user_id: string }; Returns: string }
      modo_distribuicao: { Args: never; Returns: boolean }
      notificar_agente: {
        Args: {
          _agente_id: string
          _mensagem: string
          _ordem_id: string
          _tipo: string
          _titulo: string
        }
        Returns: undefined
      }
      notificar_agente_vistoria: {
        Args: {
          _agente_id: string
          _mensagem: string
          _tipo: string
          _titulo: string
          _vistoria_id: string
        }
        Returns: undefined
      }
      notificar_equipe: {
        Args: {
          _mensagem: string
          _tipo: string
          _titulo: string
          _vistoria_id: string
        }
        Returns: undefined
      }
      notificar_locadora: {
        Args: {
          _locadora_id: string
          _mensagem: string
          _ordem_id: string
          _tipo: string
          _titulo: string
        }
        Returns: undefined
      }
      notificar_locadora_vistoria: {
        Args: {
          _locadora_id: string
          _mensagem: string
          _tipo: string
          _titulo: string
          _vistoria_id: string
        }
        Returns: undefined
      }
      ordem_tem_cobranca_ativa: {
        Args: { _ordem_id: string }
        Returns: boolean
      }
      presenca_valida: { Args: { _visto: string }; Returns: boolean }
      previa_cancelamento_locadora: {
        Args: { _ordem_id: string }
        Returns: Json
      }
      processar_fila_distribuicao: { Args: never; Returns: number }
      proximo_codigo_ordem: {
        Args: { _quantidade?: number }
        Returns: string[]
      }
      recusar_distribuicao: {
        Args: { _dist: string; _motivo?: string }
        Returns: undefined
      }
      reenviar_notificacao_distribuicao: {
        Args: { _dist: string }
        Returns: undefined
      }
      registrar_evento_distribuicao: {
        Args: {
          _acao: string
          _automatico: boolean
          _dados?: Json
          _detalhe: string
          _dist: string
        }
        Returns: undefined
      }
      registrar_presenca: { Args: { _online?: boolean }; Returns: string }
      registrar_taxa_cancelamento: {
        Args: { _ordem_id: string; _percentual?: number }
        Returns: string
      }
      reprocessar_fila_push: { Args: never; Returns: undefined }
      servicos_do_agente: {
        Args: never
        Returns: {
          aceita: boolean
          codigo: string
          nome: string
          servico_id: string
          valor: number
        }[]
      }
      sortear_agente_distribuicao: {
        Args: {
          _dist: string
          _forcado?: string
          _origem?: Database["public"]["Enums"]["distribuicao_origem"]
        }
        Returns: string
      }
      tocar_presenca: { Args: never; Returns: string }
      transferir_ordem_agente: {
        Args: { _agente: string; _motivo?: string; _ordem: string }
        Returns: string
      }
      valor_servico_ordem: { Args: { _ordem_id: string }; Returns: number }
      valor_tabela_servico: {
        Args: { _escopo: string; _locadora: string; _servico: string }
        Returns: number
      }
      vistoria_bloqueios_conclusao: { Args: { _id: string }; Returns: Json }
      vistoria_bloqueios_itens: { Args: { _id: string }; Returns: Json }
      vistoria_editavel: { Args: { _vistoria_id: string }; Returns: boolean }
      vistoria_foto_valida: {
        Args: { _etapa: string; _vistoria: string }
        Returns: boolean
      }
      vistoria_visivel: { Args: { _vistoria_id: string }; Returns: boolean }
      vistorias_inconsistentes: {
        Args: never
        Returns: {
          codigo: string
          concluida_em: string
          fotos_faltando: string
          locadora_id: string
          moto_id: string
          registros_sem_arquivo: number
          status: Database["public"]["Enums"]["status_vistoria"]
          vistoria_id: string
        }[]
      }
    }
    Enums: {
      app_role: "super_admin" | "operador" | "cliente" | "agente"
      distribuicao_origem: "automatica" | "manual" | "redistribuida"
      distribuicao_status:
        | "aguardando_definicao"
        | "aguardando_distribuicao"
        | "distribuida"
        | "notificada"
        | "aceita"
        | "recusada"
        | "em_execucao"
        | "concluida"
        | "cancelada"
        | "redistribuida"
      distribuicao_tipo: "vistoria" | "recolhimento"
      prioridade: "baixa" | "normal" | "alta" | "urgente"
      situacao_moto: "ativa" | "inativa"
      status_ordem:
        | "pendente_definicao"
        | "pendente"
        | "liberada"
        | "distribuida"
        | "em_andamento"
        | "concluida"
        | "cancelada"
      status_vistoria:
        | "pendente"
        | "distribuida"
        | "em_andamento"
        | "concluida"
        | "cancelada"
        | "aguardando_complementacao"
      tipo_lancamento:
        | "producao"
        | "adiantamento"
        | "pagamento"
        | "desconto"
        | "bonificacao"
        | "compensacao"
      tipo_servico:
        | "captura_normal"
        | "captura_dificil"
        | "busca_especial"
        | "recolhimento_urbano"
        | "recolhimento_rural"
        | "tentativa_sem_sucesso"
        | "moto_patio"
        | "entrega"
        | "remocao_especial"
        | "coleta_padrao"
        | "coleta_externa"
        | "viagem_especial"
        | "limpeza_moto"
        | "escapamento"
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
      app_role: ["super_admin", "operador", "cliente", "agente"],
      distribuicao_origem: ["automatica", "manual", "redistribuida"],
      distribuicao_status: [
        "aguardando_definicao",
        "aguardando_distribuicao",
        "distribuida",
        "notificada",
        "aceita",
        "recusada",
        "em_execucao",
        "concluida",
        "cancelada",
        "redistribuida",
      ],
      distribuicao_tipo: ["vistoria", "recolhimento"],
      prioridade: ["baixa", "normal", "alta", "urgente"],
      situacao_moto: ["ativa", "inativa"],
      status_ordem: [
        "pendente_definicao",
        "pendente",
        "liberada",
        "distribuida",
        "em_andamento",
        "concluida",
        "cancelada",
      ],
      status_vistoria: [
        "pendente",
        "distribuida",
        "em_andamento",
        "concluida",
        "cancelada",
        "aguardando_complementacao",
      ],
      tipo_lancamento: [
        "producao",
        "adiantamento",
        "pagamento",
        "desconto",
        "bonificacao",
        "compensacao",
      ],
      tipo_servico: [
        "captura_normal",
        "captura_dificil",
        "busca_especial",
        "recolhimento_urbano",
        "recolhimento_rural",
        "tentativa_sem_sucesso",
        "moto_patio",
        "entrega",
        "remocao_especial",
        "coleta_padrao",
        "coleta_externa",
        "viagem_especial",
        "limpeza_moto",
        "escapamento",
      ],
    },
  },
} as const
