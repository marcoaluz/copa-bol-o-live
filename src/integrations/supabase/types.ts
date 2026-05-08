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
        ]
      }
      partidas: {
        Row: {
          bracket_proximo_id: string | null
          codigo: string | null
          created_at: string
          data_hora: string
          estadio: string | null
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
          status: Database["public"]["Enums"]["status_partida"]
          updated_at: string
        }
        Insert: {
          bracket_proximo_id?: string | null
          codigo?: string | null
          created_at?: string
          data_hora: string
          estadio?: string | null
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
          status?: Database["public"]["Enums"]["status_partida"]
          updated_at?: string
        }
        Update: {
          bracket_proximo_id?: string | null
          codigo?: string | null
          created_at?: string
          data_hora?: string
          estadio?: string | null
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
          apelido: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          id: string
          is_admin: boolean
          nome_completo: string | null
          saldo_centavos: number
          updated_at: string
        }
        Insert: {
          aceitou_risco_em?: string | null
          aceitou_termos_em?: string | null
          apelido?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          id: string
          is_admin?: boolean
          nome_completo?: string | null
          saldo_centavos?: number
          updated_at?: string
        }
        Update: {
          aceitou_risco_em?: string | null
          aceitou_termos_em?: string | null
          apelido?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          id?: string
          is_admin?: boolean
          nome_completo?: string | null
          saldo_centavos?: number
          updated_at?: string
        }
        Relationships: []
      }
      selecoes: {
        Row: {
          bandeira_url: string | null
          codigo_iso: string
          created_at: string
          grupo: string | null
          id: string
          nome: string
        }
        Insert: {
          bandeira_url?: string | null
          codigo_iso: string
          created_at?: string
          grupo?: string | null
          id?: string
          nome: string
        }
        Update: {
          bandeira_url?: string | null
          codigo_iso?: string
          created_at?: string
          grupo?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      transacoes: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          referencia_id: string | null
          saldo_apos_centavos: number
          tipo: Database["public"]["Enums"]["tipo_transacao"]
          usuario_id: string
          valor_centavos: number
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          referencia_id?: string | null
          saldo_apos_centavos: number
          tipo: Database["public"]["Enums"]["tipo_transacao"]
          usuario_id: string
          valor_centavos: number
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          referencia_id?: string | null
          saldo_apos_centavos?: number
          tipo?: Database["public"]["Enums"]["tipo_transacao"]
          usuario_id?: string
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
    }
    Functions: {
      agora_servidor: { Args: never; Returns: string }
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
      is_admin: { Args: { _user_id: string }; Returns: boolean }
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
      resultado_partida: "casa" | "empate" | "visitante"
      status_aposta: "ativa" | "ganhou" | "perdeu" | "devolvida"
      status_partida: "agendada" | "ao_vivo" | "encerrada" | "cancelada"
      tipo_transacao:
        | "deposito"
        | "aposta"
        | "devolucao_aposta"
        | "premio"
        | "saque"
        | "ajuste_admin"
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
      resultado_partida: ["casa", "empate", "visitante"],
      status_aposta: ["ativa", "ganhou", "perdeu", "devolvida"],
      status_partida: ["agendada", "ao_vivo", "encerrada", "cancelada"],
      tipo_transacao: [
        "deposito",
        "aposta",
        "devolucao_aposta",
        "premio",
        "saque",
        "ajuste_admin",
      ],
    },
  },
} as const
