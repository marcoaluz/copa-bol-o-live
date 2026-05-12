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
      api_sync_log: {
        Row: {
          detalhes: Json | null
          erro: string | null
          finalizado_em: string | null
          fonte: string
          id: string
          iniciado_em: string
          partidas_atualizadas: number
          partidas_inseridas: number
          partidas_puladas: number
          requests_consumidos: number
          selecoes_atualizadas: number
          selecoes_inseridas: number
          status: string
          times_nao_mapeados: string[]
        }
        Insert: {
          detalhes?: Json | null
          erro?: string | null
          finalizado_em?: string | null
          fonte?: string
          id?: string
          iniciado_em?: string
          partidas_atualizadas?: number
          partidas_inseridas?: number
          partidas_puladas?: number
          requests_consumidos?: number
          selecoes_atualizadas?: number
          selecoes_inseridas?: number
          status?: string
          times_nao_mapeados?: string[]
        }
        Update: {
          detalhes?: Json | null
          erro?: string | null
          finalizado_em?: string | null
          fonte?: string
          id?: string
          iniciado_em?: string
          partidas_atualizadas?: number
          partidas_inseridas?: number
          partidas_puladas?: number
          requests_consumidos?: number
          selecoes_atualizadas?: number
          selecoes_inseridas?: number
          status?: string
          times_nao_mapeados?: string[]
        }
        Relationships: []
      }
      apostas: {
        Row: {
          created_at: string
          id: string
          palpite: Database["public"]["Enums"]["palpite_aposta"]
          partida_id: string
          premio_centavos: number | null
          status: Database["public"]["Enums"]["status_aposta"]
          updated_at: string
          usuario_id: string
          valor_centavos: number
        }
        Insert: {
          created_at?: string
          id?: string
          palpite: Database["public"]["Enums"]["palpite_aposta"]
          partida_id: string
          premio_centavos?: number | null
          status?: Database["public"]["Enums"]["status_aposta"]
          updated_at?: string
          usuario_id: string
          valor_centavos: number
        }
        Update: {
          created_at?: string
          id?: string
          palpite?: Database["public"]["Enums"]["palpite_aposta"]
          partida_id?: string
          premio_centavos?: number | null
          status?: Database["public"]["Enums"]["status_aposta"]
          updated_at?: string
          usuario_id?: string
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "apostas_partida_id_fkey"
            columns: ["partida_id"]
            isOneToOne: false
            referencedRelation: "partidas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apostas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apostas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "ranking_usuarios"
            referencedColumns: ["usuario_id"]
          },
        ]
      }
      apostas_placar: {
        Row: {
          created_at: string
          gols_casa_palpite: number
          gols_visitante_palpite: number
          id: string
          partida_id: string
          premio_centavos: number
          status: string
          updated_at: string
          usuario_id: string
          valor_centavos: number
        }
        Insert: {
          created_at?: string
          gols_casa_palpite: number
          gols_visitante_palpite: number
          id?: string
          partida_id: string
          premio_centavos?: number
          status?: string
          updated_at?: string
          usuario_id: string
          valor_centavos: number
        }
        Update: {
          created_at?: string
          gols_casa_palpite?: number
          gols_visitante_palpite?: number
          id?: string
          partida_id?: string
          premio_centavos?: number
          status?: string
          updated_at?: string
          usuario_id?: string
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "apostas_placar_partida_id_fkey"
            columns: ["partida_id"]
            isOneToOne: false
            referencedRelation: "partidas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apostas_placar_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apostas_placar_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "ranking_usuarios"
            referencedColumns: ["usuario_id"]
          },
        ]
      }
      audit_log: {
        Row: {
          acao: string
          created_at: string
          dados: Json | null
          fonte: string
          id: string
          partida_id: string | null
          usuario_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          dados?: Json | null
          fonte: string
          id?: string
          partida_id?: string | null
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          dados?: Json | null
          fonte?: string
          id?: string
          partida_id?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_partida_id_fkey"
            columns: ["partida_id"]
            isOneToOne: false
            referencedRelation: "partidas"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_lancamento: {
        Row: {
          categoria: string
          concluido: boolean
          concluido_em: string | null
          concluido_por: string | null
          created_at: string
          descricao: string | null
          id: string
          observacao: string | null
          ordem: number
          titulo: string
          updated_at: string
        }
        Insert: {
          categoria: string
          concluido?: boolean
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          observacao?: string | null
          ordem?: number
          titulo: string
          updated_at?: string
        }
        Update: {
          categoria?: string
          concluido?: boolean
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          observacao?: string | null
          ordem?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_lancamento_concluido_por_fkey"
            columns: ["concluido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_lancamento_concluido_por_fkey"
            columns: ["concluido_por"]
            isOneToOne: false
            referencedRelation: "ranking_usuarios"
            referencedColumns: ["usuario_id"]
          },
        ]
      }
      config: {
        Row: {
          api_football_league_id: number
          api_football_season: number
          api_football_sync_ativo: boolean
          api_football_ultimo_erro: string | null
          api_football_ultimo_sync: string | null
          chave_pix_admin: string
          deposito_maximo_centavos: number
          deposito_maximo_mensal_centavos: number
          deposito_minimo_centavos: number
          id: number
          manutencao_ativa: boolean
          manutencao_mensagem: string | null
          nome_admin_recebedor: string
          notif_email_ativo: boolean
          notif_email_destino: string
          notif_eventos: Json
          notif_telegram_ativo: boolean
          politica_sem_ganhadores: Database["public"]["Enums"]["politica_sem_ganhadores"]
          saldo_bancario_declarado_centavos: number
          taxa_casa_percentual: number
          updated_at: string
          valor_maximo_aposta_centavos: number
          valor_maximo_saque_diario_centavos: number
          valor_minimo_aposta_centavos: number
          valor_minimo_saque_centavos: number
        }
        Insert: {
          api_football_league_id?: number
          api_football_season?: number
          api_football_sync_ativo?: boolean
          api_football_ultimo_erro?: string | null
          api_football_ultimo_sync?: string | null
          chave_pix_admin?: string
          deposito_maximo_centavos?: number
          deposito_maximo_mensal_centavos?: number
          deposito_minimo_centavos?: number
          id?: number
          manutencao_ativa?: boolean
          manutencao_mensagem?: string | null
          nome_admin_recebedor?: string
          notif_email_ativo?: boolean
          notif_email_destino?: string
          notif_eventos?: Json
          notif_telegram_ativo?: boolean
          politica_sem_ganhadores?: Database["public"]["Enums"]["politica_sem_ganhadores"]
          saldo_bancario_declarado_centavos?: number
          taxa_casa_percentual?: number
          updated_at?: string
          valor_maximo_aposta_centavos?: number
          valor_maximo_saque_diario_centavos?: number
          valor_minimo_aposta_centavos?: number
          valor_minimo_saque_centavos?: number
        }
        Update: {
          api_football_league_id?: number
          api_football_season?: number
          api_football_sync_ativo?: boolean
          api_football_ultimo_erro?: string | null
          api_football_ultimo_sync?: string | null
          chave_pix_admin?: string
          deposito_maximo_centavos?: number
          deposito_maximo_mensal_centavos?: number
          deposito_minimo_centavos?: number
          id?: number
          manutencao_ativa?: boolean
          manutencao_mensagem?: string | null
          nome_admin_recebedor?: string
          notif_email_ativo?: boolean
          notif_email_destino?: string
          notif_eventos?: Json
          notif_telegram_ativo?: boolean
          politica_sem_ganhadores?: Database["public"]["Enums"]["politica_sem_ganhadores"]
          saldo_bancario_declarado_centavos?: number
          taxa_casa_percentual?: number
          updated_at?: string
          valor_maximo_aposta_centavos?: number
          valor_maximo_saque_diario_centavos?: number
          valor_minimo_aposta_centavos?: number
          valor_minimo_saque_centavos?: number
        }
        Relationships: []
      }
      depositos: {
        Row: {
          codigo_referencia: string
          confirmado_em: string | null
          confirmado_por_admin_id: string | null
          created_at: string
          e2e_id_pix: string | null
          id: string
          motivo_rejeicao: string | null
          observacao_admin: string | null
          status: string
          updated_at: string
          usuario_id: string
          valor_centavos: number
        }
        Insert: {
          codigo_referencia: string
          confirmado_em?: string | null
          confirmado_por_admin_id?: string | null
          created_at?: string
          e2e_id_pix?: string | null
          id?: string
          motivo_rejeicao?: string | null
          observacao_admin?: string | null
          status?: string
          updated_at?: string
          usuario_id: string
          valor_centavos: number
        }
        Update: {
          codigo_referencia?: string
          confirmado_em?: string | null
          confirmado_por_admin_id?: string | null
          created_at?: string
          e2e_id_pix?: string | null
          id?: string
          motivo_rejeicao?: string | null
          observacao_admin?: string | null
          status?: string
          updated_at?: string
          usuario_id?: string
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "depositos_confirmado_por_admin_id_fkey"
            columns: ["confirmado_por_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depositos_confirmado_por_admin_id_fkey"
            columns: ["confirmado_por_admin_id"]
            isOneToOne: false
            referencedRelation: "ranking_usuarios"
            referencedColumns: ["usuario_id"]
          },
          {
            foreignKeyName: "depositos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depositos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "ranking_usuarios"
            referencedColumns: ["usuario_id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          link: string | null
          mensagem: string
          tipo: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem: string
          tipo: string
          titulo: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string
          tipo?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "ranking_usuarios"
            referencedColumns: ["usuario_id"]
          },
        ]
      }
      notificacoes_admin: {
        Row: {
          canais_enviados: string[]
          canais_falharam: string[]
          created_at: string
          enviada_em: string | null
          evento: string
          id: string
          payload: Json
          status: string
          tentativas: number
          ultimo_erro: string | null
        }
        Insert: {
          canais_enviados?: string[]
          canais_falharam?: string[]
          created_at?: string
          enviada_em?: string | null
          evento: string
          id?: string
          payload: Json
          status?: string
          tentativas?: number
          ultimo_erro?: string | null
        }
        Update: {
          canais_enviados?: string[]
          canais_falharam?: string[]
          created_at?: string
          enviada_em?: string | null
          evento?: string
          id?: string
          payload?: Json
          status?: string
          tentativas?: number
          ultimo_erro?: string | null
        }
        Relationships: []
      }
      partidas: {
        Row: {
          api_fixture_id: number | null
          bolo_acumulado_centavos: number
          bracket_proximo_id: string | null
          codigo: string | null
          created_at: string
          data_hora: string
          estadio: string | null
          external_id: string | null
          fase: Database["public"]["Enums"]["fase_partida"]
          gols_casa: number | null
          gols_visitante: number | null
          grupo: string | null
          id: string
          ordem_bracket: number | null
          placeholder_casa: string | null
          placeholder_visitante: string | null
          resultado: Database["public"]["Enums"]["resultado_partida"] | null
          selecao_casa_id: string | null
          selecao_visitante_id: string | null
          sincronizada_em: string | null
          status: Database["public"]["Enums"]["status_partida"]
          updated_at: string
        }
        Insert: {
          api_fixture_id?: number | null
          bolo_acumulado_centavos?: number
          bracket_proximo_id?: string | null
          codigo?: string | null
          created_at?: string
          data_hora: string
          estadio?: string | null
          external_id?: string | null
          fase: Database["public"]["Enums"]["fase_partida"]
          gols_casa?: number | null
          gols_visitante?: number | null
          grupo?: string | null
          id?: string
          ordem_bracket?: number | null
          placeholder_casa?: string | null
          placeholder_visitante?: string | null
          resultado?: Database["public"]["Enums"]["resultado_partida"] | null
          selecao_casa_id?: string | null
          selecao_visitante_id?: string | null
          sincronizada_em?: string | null
          status?: Database["public"]["Enums"]["status_partida"]
          updated_at?: string
        }
        Update: {
          api_fixture_id?: number | null
          bolo_acumulado_centavos?: number
          bracket_proximo_id?: string | null
          codigo?: string | null
          created_at?: string
          data_hora?: string
          estadio?: string | null
          external_id?: string | null
          fase?: Database["public"]["Enums"]["fase_partida"]
          gols_casa?: number | null
          gols_visitante?: number | null
          grupo?: string | null
          id?: string
          ordem_bracket?: number | null
          placeholder_casa?: string | null
          placeholder_visitante?: string | null
          resultado?: Database["public"]["Enums"]["resultado_partida"] | null
          selecao_casa_id?: string | null
          selecao_visitante_id?: string | null
          sincronizada_em?: string | null
          status?: Database["public"]["Enums"]["status_partida"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partidas_bracket_proximo_id_fkey"
            columns: ["bracket_proximo_id"]
            isOneToOne: false
            referencedRelation: "partidas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidas_selecao_casa_id_fkey"
            columns: ["selecao_casa_id"]
            isOneToOne: false
            referencedRelation: "classificacao_grupos"
            referencedColumns: ["selecao_id"]
          },
          {
            foreignKeyName: "partidas_selecao_casa_id_fkey"
            columns: ["selecao_casa_id"]
            isOneToOne: false
            referencedRelation: "selecoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidas_selecao_visitante_id_fkey"
            columns: ["selecao_visitante_id"]
            isOneToOne: false
            referencedRelation: "classificacao_grupos"
            referencedColumns: ["selecao_id"]
          },
          {
            foreignKeyName: "partidas_selecao_visitante_id_fkey"
            columns: ["selecao_visitante_id"]
            isOneToOne: false
            referencedRelation: "selecoes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          aceitou_risco_em: string | null
          aceitou_termos_em: string | null
          anonimo: boolean
          apelido: string | null
          bloqueado: boolean
          bloqueado_em: string | null
          bloqueado_motivo: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          foto_url: string | null
          id: string
          is_admin: boolean
          nome_completo: string | null
          saldo_centavos: number
          updated_at: string
        }
        Insert: {
          aceitou_risco_em?: string | null
          aceitou_termos_em?: string | null
          anonimo?: boolean
          apelido?: string | null
          bloqueado?: boolean
          bloqueado_em?: string | null
          bloqueado_motivo?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          foto_url?: string | null
          id: string
          is_admin?: boolean
          nome_completo?: string | null
          saldo_centavos?: number
          updated_at?: string
        }
        Update: {
          aceitou_risco_em?: string | null
          aceitou_termos_em?: string | null
          anonimo?: boolean
          apelido?: string | null
          bloqueado?: boolean
          bloqueado_em?: string | null
          bloqueado_motivo?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          foto_url?: string | null
          id?: string
          is_admin?: boolean
          nome_completo?: string | null
          saldo_centavos?: number
          updated_at?: string
        }
        Relationships: []
      }
      saques: {
        Row: {
          admin_revisor_id: string | null
          chave_pix: string
          created_at: string
          id: string
          motivo_rejeicao: string | null
          observacao_admin: string | null
          pago_em: string | null
          revisado_em: string | null
          solicitado_em: string
          status: Database["public"]["Enums"]["status_saque"]
          tipo_chave: Database["public"]["Enums"]["tipo_chave_pix"]
          updated_at: string
          usuario_id: string
          valor_centavos: number
        }
        Insert: {
          admin_revisor_id?: string | null
          chave_pix: string
          created_at?: string
          id?: string
          motivo_rejeicao?: string | null
          observacao_admin?: string | null
          pago_em?: string | null
          revisado_em?: string | null
          solicitado_em?: string
          status?: Database["public"]["Enums"]["status_saque"]
          tipo_chave: Database["public"]["Enums"]["tipo_chave_pix"]
          updated_at?: string
          usuario_id: string
          valor_centavos: number
        }
        Update: {
          admin_revisor_id?: string | null
          chave_pix?: string
          created_at?: string
          id?: string
          motivo_rejeicao?: string | null
          observacao_admin?: string | null
          pago_em?: string | null
          revisado_em?: string | null
          solicitado_em?: string
          status?: Database["public"]["Enums"]["status_saque"]
          tipo_chave?: Database["public"]["Enums"]["tipo_chave_pix"]
          updated_at?: string
          usuario_id?: string
          valor_centavos?: number
        }
        Relationships: []
      }
      selecoes: {
        Row: {
          api_team_id: number | null
          bandeira_url: string | null
          codigo_iso: string
          created_at: string
          grupo: string | null
          id: string
          nome: string
        }
        Insert: {
          api_team_id?: number | null
          bandeira_url?: string | null
          codigo_iso: string
          created_at?: string
          grupo?: string | null
          id?: string
          nome: string
        }
        Update: {
          api_team_id?: number | null
          bandeira_url?: string | null
          codigo_iso?: string
          created_at?: string
          grupo?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      suporte_mensagens: {
        Row: {
          assunto: string
          created_at: string
          email_contato: string
          id: string
          mensagem: string
          respondido_em: string | null
          respondido_por: string | null
          resposta_admin: string | null
          status: string
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          assunto: string
          created_at?: string
          email_contato: string
          id?: string
          mensagem: string
          respondido_em?: string | null
          respondido_por?: string | null
          resposta_admin?: string | null
          status?: string
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          assunto?: string
          created_at?: string
          email_contato?: string
          id?: string
          mensagem?: string
          respondido_em?: string | null
          respondido_por?: string | null
          resposta_admin?: string | null
          status?: string
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suporte_mensagens_respondido_por_fkey"
            columns: ["respondido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suporte_mensagens_respondido_por_fkey"
            columns: ["respondido_por"]
            isOneToOne: false
            referencedRelation: "ranking_usuarios"
            referencedColumns: ["usuario_id"]
          },
          {
            foreignKeyName: "suporte_mensagens_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suporte_mensagens_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "ranking_usuarios"
            referencedColumns: ["usuario_id"]
          },
        ]
      }
      transacoes: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          referencia_id: string | null
          saldo_apos_centavos: number
          tipo: Database["public"]["Enums"]["tipo_transacao"]
          usuario_id: string | null
          valor_centavos: number
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          referencia_id?: string | null
          saldo_apos_centavos: number
          tipo: Database["public"]["Enums"]["tipo_transacao"]
          usuario_id?: string | null
          valor_centavos: number
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          referencia_id?: string | null
          saldo_apos_centavos?: number
          tipo?: Database["public"]["Enums"]["tipo_transacao"]
          usuario_id?: string | null
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "ranking_usuarios"
            referencedColumns: ["usuario_id"]
          },
        ]
      }
      usuarios_autorizados: {
        Row: {
          convidado_por: string | null
          convite_aceito: boolean
          created_at: string
          email: string
          observacao: string | null
        }
        Insert: {
          convidado_por?: string | null
          convite_aceito?: boolean
          created_at?: string
          email: string
          observacao?: string | null
        }
        Update: {
          convidado_por?: string | null
          convite_aceito?: boolean
          created_at?: string
          email?: string
          observacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_autorizados_convidado_por_fkey"
            columns: ["convidado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_autorizados_convidado_por_fkey"
            columns: ["convidado_por"]
            isOneToOne: false
            referencedRelation: "ranking_usuarios"
            referencedColumns: ["usuario_id"]
          },
        ]
      }
    }
    Views: {
      classificacao_grupos: {
        Row: {
          derrotas: number | null
          empates: number | null
          gc: number | null
          gp: number | null
          grupo: string | null
          jogos: number | null
          pontos: number | null
          selecao_id: string | null
          sg: number | null
          vitorias: number | null
        }
        Relationships: []
      }
      ranking_usuarios: {
        Row: {
          anonimo: boolean | null
          apelido: string | null
          foto_url: string | null
          lucro_centavos: number | null
          taxa_acerto: number | null
          total_acertos: number | null
          total_apostado_centavos: number | null
          total_apostas: number | null
          total_ganho_centavos: number | null
          usuario_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _assert_admin: { Args: never; Returns: undefined }
      _assert_autorizado: { Args: never; Returns: undefined }
      _self_test_apuracao: { Args: never; Returns: Json }
      adicionar_emails_autorizados: {
        Args: { p_emails: string[] }
        Returns: number
      }
      admin_dashboard_stats: { Args: never; Returns: Json }
      admin_receita_diaria: {
        Args: { p_dias?: number }
        Returns: {
          apostado: number
          dia: string
          premios: number
          taxa: number
        }[]
      }
      admin_top_partidas: {
        Args: { p_limite?: number }
        Returns: {
          bolo_centavos: number
          codigo: string
          data_hora: string
          fase: Database["public"]["Enums"]["fase_partida"]
          partida_id: string
          qtd_apostas: number
        }[]
      }
      agora_servidor: { Args: never; Returns: string }
      ajustar_saldo_usuario: {
        Args: { p_delta_centavos: number; p_motivo: string; p_user_id: string }
        Returns: number
      }
      apurar_partida: { Args: { p_id: string }; Returns: Json }
      atualizar_partida_externa: {
        Args: {
          p_dados?: Json
          p_external_id: string
          p_gols_casa?: number
          p_gols_visitante?: number
          p_status: Database["public"]["Enums"]["status_partida"]
        }
        Returns: {
          api_fixture_id: number | null
          bolo_acumulado_centavos: number
          bracket_proximo_id: string | null
          codigo: string | null
          created_at: string
          data_hora: string
          estadio: string | null
          external_id: string | null
          fase: Database["public"]["Enums"]["fase_partida"]
          gols_casa: number | null
          gols_visitante: number | null
          grupo: string | null
          id: string
          ordem_bracket: number | null
          placeholder_casa: string | null
          placeholder_visitante: string | null
          resultado: Database["public"]["Enums"]["resultado_partida"] | null
          selecao_casa_id: string | null
          selecao_visitante_id: string | null
          sincronizada_em: string | null
          status: Database["public"]["Enums"]["status_partida"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "partidas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bloquear_usuario: {
        Args: { p_motivo: string; p_user_id: string }
        Returns: {
          aceitou_risco_em: string | null
          aceitou_termos_em: string | null
          anonimo: boolean
          apelido: string | null
          bloqueado: boolean
          bloqueado_em: string | null
          bloqueado_motivo: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          foto_url: string | null
          id: string
          is_admin: boolean
          nome_completo: string | null
          saldo_centavos: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancelar_aposta_placar: {
        Args: { p_aposta_id: string }
        Returns: undefined
      }
      cancelar_partida: {
        Args: { p_id: string }
        Returns: {
          api_fixture_id: number | null
          bolo_acumulado_centavos: number
          bracket_proximo_id: string | null
          codigo: string | null
          created_at: string
          data_hora: string
          estadio: string | null
          external_id: string | null
          fase: Database["public"]["Enums"]["fase_partida"]
          gols_casa: number | null
          gols_visitante: number | null
          grupo: string | null
          id: string
          ordem_bracket: number | null
          placeholder_casa: string | null
          placeholder_visitante: string | null
          resultado: Database["public"]["Enums"]["resultado_partida"] | null
          selecao_casa_id: string | null
          selecao_visitante_id: string | null
          sincronizada_em: string | null
          status: Database["public"]["Enums"]["status_partida"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "partidas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      criar_deposito: { Args: { p_valor_centavos: number }; Returns: Json }
      criar_ou_alterar_aposta: {
        Args: {
          p_palpite: Database["public"]["Enums"]["palpite_aposta"]
          p_partida_id: string
          p_valor_centavos: number
        }
        Returns: {
          created_at: string
          id: string
          palpite: Database["public"]["Enums"]["palpite_aposta"]
          partida_id: string
          premio_centavos: number | null
          status: Database["public"]["Enums"]["status_aposta"]
          updated_at: string
          usuario_id: string
          valor_centavos: number
        }
        SetofOptions: {
          from: "*"
          to: "apostas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      criar_ou_alterar_aposta_placar: {
        Args: {
          p_gols_casa: number
          p_gols_visitante: number
          p_partida_id: string
          p_valor_centavos: number
        }
        Returns: {
          created_at: string
          gols_casa_palpite: number
          gols_visitante_palpite: number
          id: string
          partida_id: string
          premio_centavos: number
          status: string
          updated_at: string
          usuario_id: string
          valor_centavos: number
        }
        SetofOptions: {
          from: "*"
          to: "apostas_placar"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      desbloquear_usuario: {
        Args: { p_user_id: string }
        Returns: {
          aceitou_risco_em: string | null
          aceitou_termos_em: string | null
          anonimo: boolean
          apelido: string | null
          bloqueado: boolean
          bloqueado_em: string | null
          bloqueado_motivo: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          foto_url: string | null
          id: string
          is_admin: boolean
          nome_completo: string | null
          saldo_centavos: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      email_esta_autorizado: { Args: never; Returns: boolean }
      estatisticas_usuario: { Args: { p_uid?: string }; Returns: Json }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      lancar_resultado_partida: {
        Args: { p_gols_casa: number; p_gols_visitante: number; p_id: string }
        Returns: {
          api_fixture_id: number | null
          bolo_acumulado_centavos: number
          bracket_proximo_id: string | null
          codigo: string | null
          created_at: string
          data_hora: string
          estadio: string | null
          external_id: string | null
          fase: Database["public"]["Enums"]["fase_partida"]
          gols_casa: number | null
          gols_visitante: number | null
          grupo: string | null
          id: string
          ordem_bracket: number | null
          placeholder_casa: string | null
          placeholder_visitante: string | null
          resultado: Database["public"]["Enums"]["resultado_partida"] | null
          selecao_casa_id: string | null
          selecao_visitante_id: string | null
          sincronizada_em: string | null
          status: Database["public"]["Enums"]["status_partida"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "partidas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      marcar_convite_aceito: { Args: never; Returns: undefined }
      marcar_deposito_pago: {
        Args: { p_deposito_id: string }
        Returns: undefined
      }
      marcar_notificacoes_lidas: { Args: { p_ids?: string[] }; Returns: number }
      preparar_para_sync_real: { Args: never; Returns: Json }
      processar_deposito: {
        Args: {
          p_acao: string
          p_deposito_id: string
          p_e2e_id?: string
          p_motivo?: string
          p_observacao?: string
        }
        Returns: {
          codigo_referencia: string
          confirmado_em: string | null
          confirmado_por_admin_id: string | null
          created_at: string
          e2e_id_pix: string | null
          id: string
          motivo_rejeicao: string | null
          observacao_admin: string | null
          status: string
          updated_at: string
          usuario_id: string
          valor_centavos: number
        }
        SetofOptions: {
          from: "*"
          to: "depositos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      processar_saque: {
        Args: {
          p_acao: string
          p_motivo?: string
          p_observacao?: string
          p_saque_id: string
        }
        Returns: {
          admin_revisor_id: string | null
          chave_pix: string
          created_at: string
          id: string
          motivo_rejeicao: string | null
          observacao_admin: string | null
          pago_em: string | null
          revisado_em: string | null
          solicitado_em: string
          status: Database["public"]["Enums"]["status_saque"]
          tipo_chave: Database["public"]["Enums"]["tipo_chave_pix"]
          updated_at: string
          usuario_id: string
          valor_centavos: number
        }
        SetofOptions: {
          from: "*"
          to: "saques"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ranking_filtrado: {
        Args: { p_filtro?: string }
        Returns: {
          anonimo: boolean
          apelido: string
          foto_url: string
          lucro_centavos: number
          pontos_ranking: number
          posicao: number
          taxa_acerto: number
          total_acertos: number
          total_acertos_placar: number
          total_apostado_centavos: number
          total_apostas: number
          total_apostas_placar: number
          total_ganho_centavos: number
          usuario_id: string
        }[]
      }
      remover_email_autorizado: { Args: { p_email: string }; Returns: boolean }
      resgatar_bonus: { Args: { p_tipo: string }; Returns: Json }
      solicitar_saque: {
        Args: {
          p_chave_pix: string
          p_tipo_chave: Database["public"]["Enums"]["tipo_chave_pix"]
          p_valor_centavos: number
        }
        Returns: {
          admin_revisor_id: string | null
          chave_pix: string
          created_at: string
          id: string
          motivo_rejeicao: string | null
          observacao_admin: string | null
          pago_em: string | null
          revisado_em: string | null
          solicitado_em: string
          status: Database["public"]["Enums"]["status_saque"]
          tipo_chave: Database["public"]["Enums"]["tipo_chave_pix"]
          updated_at: string
          usuario_id: string
          valor_centavos: number
        }
        SetofOptions: {
          from: "*"
          to: "saques"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      fase_partida:
        | "grupos"
        | "oitavas"
        | "quartas"
        | "semi"
        | "terceiro"
        | "final"
      palpite_aposta: "casa" | "empate" | "visitante"
      politica_sem_ganhadores: "devolver" | "acumular"
      resultado_partida: "casa" | "empate" | "visitante"
      status_aposta: "ativa" | "ganhou" | "perdeu" | "devolvida"
      status_partida: "agendada" | "ao_vivo" | "encerrada" | "cancelada"
      status_saque: "pendente" | "pago" | "rejeitado" | "cancelado"
      tipo_chave_pix: "cpf" | "email" | "telefone" | "aleatoria"
      tipo_transacao:
        | "deposito"
        | "aposta"
        | "devolucao_aposta"
        | "premio"
        | "saque"
        | "ajuste_admin"
        | "bonus"
        | "devolucao_saque"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      fase_partida: [
        "grupos",
        "oitavas",
        "quartas",
        "semi",
        "terceiro",
        "final",
      ],
      palpite_aposta: ["casa", "empate", "visitante"],
      politica_sem_ganhadores: ["devolver", "acumular"],
      resultado_partida: ["casa", "empate", "visitante"],
      status_aposta: ["ativa", "ganhou", "perdeu", "devolvida"],
      status_partida: ["agendada", "ao_vivo", "encerrada", "cancelada"],
      status_saque: ["pendente", "pago", "rejeitado", "cancelado"],
      tipo_chave_pix: ["cpf", "email", "telefone", "aleatoria"],
      tipo_transacao: [
        "deposito",
        "aposta",
        "devolucao_aposta",
        "premio",
        "saque",
        "ajuste_admin",
        "bonus",
        "devolucao_saque",
      ],
    },
  },
} as const
