/**
 * Tipos do banco de dados (espelham supabase/migrations).
 * Podem ser regenerados com: npx supabase gen types typescript --project-id <id>
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = "recepcao" | "gestor";

export type AuditAction =
  | "pessoa.criada"
  | "pessoa.editada"
  | "pessoa.excluida"
  | "usuario.criado"
  | "usuario.editado"
  | "usuario.senha_redefinida"
  | "sessao.login"
  | "sessao.logout"
  | "dados.exportados";

export type AuditEntity = "pessoa" | "usuario" | "sessao" | "exportacao";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: AppRole;
          can_view_records: boolean;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: {
          full_name?: string;
          role?: AppRole;
          can_view_records?: boolean;
          active?: boolean;
        };
        Relationships: [];
      };
      pessoas: {
        Row: {
          id: string;
          nome: string;
          numero: string;
          nome_busca: string;
          created_at: string;
          created_by: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: { nome: string; numero: string };
        Update: { nome?: string; numero?: string };
        Relationships: [
          {
            foreignKeyName: "pessoas_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pessoas_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          id: number;
          occurred_at: string;
          actor_id: string | null;
          action: AuditAction;
          entity: AuditEntity;
          entity_id: string | null;
          details: Json;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      dashboard_stats: { Args: { p_tz?: string }; Returns: Json };
      registrar_evento: {
        Args: { p_action: string; p_entity_id?: string | null; p_details?: Json };
        Returns: undefined;
      };
      is_gestor: { Args: Record<string, never>; Returns: boolean };
      is_active_user: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: { app_role: AppRole };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Pessoa = Database["public"]["Tables"]["pessoas"]["Row"];
export type AuditLog = Database["public"]["Tables"]["audit_log"]["Row"];
