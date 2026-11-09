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
  | "pessoa.etapa_alterada"
  | "pessoa.contato_registrado"
  | "pessoa.recadastrada"
  | "visita.agendada"
  | "visita.reagendada"
  | "visita.registrada"
  | "usuario.criado"
  | "usuario.editado"
  | "usuario.senha_redefinida"
  | "sessao.login"
  | "sessao.logout"
  | "dados.exportados"
  | "config.alterada";

export type AuditEntity = "pessoa" | "usuario" | "sessao" | "exportacao" | "configuracao";

export type EtapaTipo = "inicial" | "intermediaria" | "concluida" | "encerrada";
export type EtapaCor =
  | "amarelo"
  | "laranja"
  | "azul_claro"
  | "azul"
  | "marinho"
  | "lilas"
  | "verde_agua"
  | "verde"
  | "cinza";
export type MotivoEncerramento = "sem_resposta" | "nao_deseja" | "mudou_se" | "outro";
export type CanalContato = "whatsapp" | "ligacao" | "presencial";
export type ResultadoContato = "conversou" | "nao_atendeu" | "nao_deseja";
export type OrigemMovimentacao = "cadastro" | "recadastro" | "gestor" | "contato" | "visita";
export type EtapaPapel = "agendamento" | "visita_agendada" | "visita_realizada";
export type SituacaoVisita = "agendada" | "realizada" | "faltou" | "cancelada";

type ProfileFk = {
  isOneToOne: false;
  referencedRelation: "profiles";
  referencedColumns: ["id"];
};

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
          igreja_id: number | null;
          created_at: string;
          created_by: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: never;
        Update: { nome?: string; numero?: string; igreja_id?: number };
        Relationships: [
          { foreignKeyName: "pessoas_created_by_fkey"; columns: ["created_by"] } & ProfileFk,
          { foreignKeyName: "pessoas_updated_by_fkey"; columns: ["updated_by"] } & ProfileFk,
          {
            foreignKeyName: "pessoas_igreja_id_fkey";
            columns: ["igreja_id"];
            isOneToOne: false;
            referencedRelation: "igrejas";
            referencedColumns: ["id"];
          },
        ];
      };
      igrejas: {
        Row: { id: number; nome: string; ativo: boolean; created_at: string };
        Insert: { nome: string; ativo?: boolean };
        Update: { nome?: string; ativo?: boolean };
        Relationships: [];
      };
      etapas: {
        Row: {
          id: number;
          nome: string;
          cor: EtapaCor;
          tipo: EtapaTipo;
          ordem: number;
          prazo_horas: number | null;
          ativo: boolean;
          papel: EtapaPapel | null;
          created_at: string;
          updated_at: string;
        };
        Insert: { nome: string; cor: EtapaCor; ordem?: number; prazo_horas?: number | null };
        Update: { nome?: string; cor?: EtapaCor; ordem?: number; prazo_horas?: number | null; ativo?: boolean };
        Relationships: [];
      };
      atendimentos: {
        Row: {
          pessoa_id: string;
          etapa_id: number;
          etapa_desde: string;
          tentativas_contato: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "atendimentos_pessoa_id_fkey";
            columns: ["pessoa_id"];
            isOneToOne: true;
            referencedRelation: "pessoas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "atendimentos_etapa_id_fkey";
            columns: ["etapa_id"];
            isOneToOne: false;
            referencedRelation: "etapas";
            referencedColumns: ["id"];
          },
        ];
      };
      movimentacoes: {
        Row: {
          id: number;
          pessoa_id: string;
          de_etapa_id: number | null;
          para_etapa_id: number;
          origem: OrigemMovimentacao;
          motivo: MotivoEncerramento | null;
          observacao: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [
          { foreignKeyName: "movimentacoes_created_by_fkey"; columns: ["created_by"] } & ProfileFk,
          {
            foreignKeyName: "movimentacoes_de_etapa_id_fkey";
            columns: ["de_etapa_id"];
            isOneToOne: false;
            referencedRelation: "etapas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movimentacoes_para_etapa_id_fkey";
            columns: ["para_etapa_id"];
            isOneToOne: false;
            referencedRelation: "etapas";
            referencedColumns: ["id"];
          },
        ];
      };
      contatos: {
        Row: {
          id: number;
          pessoa_id: string;
          canal: CanalContato;
          resultado: ResultadoContato;
          observacao: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [{ foreignKeyName: "contatos_created_by_fkey"; columns: ["created_by"] } & ProfileFk];
      };
      visitas: {
        Row: {
          id: string;
          pessoa_id: string;
          agendada_para: string;
          endereco: string;
          visitante_id: string;
          observacao: string | null;
          situacao: SituacaoVisita;
          resultado_obs: string | null;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [
          { foreignKeyName: "visitas_visitante_id_fkey"; columns: ["visitante_id"] } & ProfileFk,
          { foreignKeyName: "visitas_created_by_fkey"; columns: ["created_by"] } & ProfileFk,
          {
            foreignKeyName: "visitas_pessoa_id_fkey";
            columns: ["pessoa_id"];
            isOneToOne: false;
            referencedRelation: "pessoas";
            referencedColumns: ["id"];
          },
        ];
      };
      configuracoes: {
        Row: { id: boolean; mensagem_whatsapp: string; updated_at: string; updated_by: string | null };
        Insert: never;
        Update: { mensagem_whatsapp?: string };
        Relationships: [];
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
        Relationships: [{ foreignKeyName: "audit_log_actor_id_fkey"; columns: ["actor_id"] } & ProfileFk];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      dashboard_stats: { Args: { p_tz?: string }; Returns: Json };
      registrar_evento: {
        Args: { p_action: string; p_entity_id?: string | null; p_details?: Json };
        Returns: undefined;
      };
      cadastrar_pessoa: { Args: { p_nome: string; p_numero: string; p_igreja_id: number }; Returns: Json };
      mover_etapa: {
        Args: { p_pessoa_id: string; p_etapa_id: number; p_motivo?: string | null; p_observacao?: string | null };
        Returns: undefined;
      };
      registrar_contato: {
        Args: { p_pessoa_id: string; p_canal: string; p_resultado: string; p_observacao?: string | null };
        Returns: Json;
      };
      funil_resumo: { Args: { p_tz?: string }; Returns: Json };
      agendar_visita: {
        Args: { p_pessoa_id: string; p_agendada_para: string; p_endereco: string; p_visitante_id: string; p_observacao?: string | null };
        Returns: string;
      };
      reagendar_visita: {
        Args: { p_visita_id: string; p_agendada_para: string; p_endereco: string; p_visitante_id: string; p_observacao?: string | null };
        Returns: undefined;
      };
      registrar_visita: {
        Args: { p_visita_id: string; p_situacao: string; p_observacao?: string | null };
        Returns: undefined;
      };
      is_gestor: { Args: Record<string, never>; Returns: boolean };
      is_active_user: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: { app_role: AppRole; etapa_tipo: EtapaTipo };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Pessoa = Database["public"]["Tables"]["pessoas"]["Row"];
export type Etapa = Database["public"]["Tables"]["etapas"]["Row"];
export type Igreja = Database["public"]["Tables"]["igrejas"]["Row"];
export type AuditLog = Database["public"]["Tables"]["audit_log"]["Row"];
