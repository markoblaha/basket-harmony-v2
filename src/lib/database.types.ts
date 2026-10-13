// Typy databázy. Základ je vygenerovaný zo Supabase (generate_typescript_types);
// Insert/Update sú zúžené podľa skutočných oprávnení (kam aplikácia smie zapisovať).
// Po zmene databázy treba typy aktualizovať.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type SessionRow = {
  ended_at: string | null;
  expires_at: string;
  household_id: string;
  id: string;
  list_id: string;
  shopper_id: string;
  started_at: string;
  status: Database["public"]["Enums"]["session_status"];
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      addition_requests: {
        Row: {
          category_id: string;
          client_op_id: string | null;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          household_id: string;
          id: string;
          list_id: string;
          name: string;
          note: string | null;
          quantity: number | null;
          requested_by: string | null;
          requested_for: string;
          resulting_item_id: string | null;
          session_id: string;
          status: Database["public"]["Enums"]["request_status"];
          unit: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      categories: {
        Row: { emoji: string; id: string; name: string; sort_order: number };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      category_memory: {
        Row: { category_id: string; household_id: string; name_key: string; updated_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      household_invitations: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          created_by: string | null;
          expires_at: string;
          household_id: string;
          id: string;
          status: Database["public"]["Enums"]["invitation_status"];
          token_hash: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      household_members: {
        Row: {
          household_id: string;
          joined_at: string;
          role: Database["public"]["Enums"]["member_role"];
          user_id: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      households: {
        Row: { created_at: string; created_by: string | null; id: string; name: string };
        Insert: never;
        Update: { name?: string };
        Relationships: [];
      };
      profiles: {
        Row: { created_at: string; display_name: string; id: string; updated_at: string };
        Insert: never;
        Update: { display_name?: string };
        Relationships: [];
      };
      receipt_items: {
        Row: {
          category_id: string;
          discount: number;
          household_id: string;
          id: string;
          line_total: number;
          name_key: string;
          position: number;
          quantity: number;
          raw_name: string;
          receipt_id: string;
          unit: string | null;
          unit_price: number | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      receipt_pages: {
        Row: {
          created_at: string;
          household_id: string;
          id: string;
          image_checksum: string;
          image_path: string;
          position: number;
          receipt_id: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      receipts: {
        Row: {
          created_at: string;
          currency: string;
          discount_total: number | null;
          duplicate_of: string | null;
          error_text: string | null;
          household_id: string;
          id: string;
          image_checksum: string;
          image_path: string;
          items_sum: number | null;
          purchased_on: string | null;
          purchased_time: string | null;
          review_reason: string | null;
          source: string;
          status: Database["public"]["Enums"]["receipt_status"];
          store_key: string | null;
          store_name: string | null;
          total: number | null;
          updated_at: string;
          uploaded_by: string | null;
        };
        Insert: never;
        Update: { purchased_on?: string | null; store_name?: string | null; total?: number | null };
        Relationships: [];
      };
      shopping_list_items: {
        Row: {
          added_by: string | null;
          category_id: string;
          client_op_id: string | null;
          created_at: string;
          household_id: string;
          id: string;
          list_id: string;
          name: string;
          note: string | null;
          purchased_at: string | null;
          purchased_by: string | null;
          quantity: number | null;
          status: Database["public"]["Enums"]["item_status"];
          unit: string | null;
          updated_at: string;
        };
        Insert: never;
        Update: {
          category_id?: string;
          name?: string;
          note?: string | null;
          quantity?: number | null;
          status?: Database["public"]["Enums"]["item_status"];
          unit?: string | null;
        };
        Relationships: [];
      };
      shopping_lists: {
        Row: {
          created_at: string;
          created_by: string | null;
          household_id: string;
          id: string;
          is_archived: boolean;
          name: string;
          updated_at: string;
        };
        Insert: { household_id: string; name: string };
        Update: { is_archived?: boolean; name?: string };
        Relationships: [];
      };
      shopping_sessions: {
        Row: SessionRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string };
      accept_request: { Args: { p_request_id: string }; Returns: Json };
      add_item: {
        Args: {
          p_category_guess?: string;
          p_category_id?: string;
          p_client_op_id?: string;
          p_list_id: string;
          p_name: string;
          p_note?: string;
          p_quantity?: number;
          p_unit?: string;
        };
        Returns: Json;
      };
      confirm_receipt: { Args: { p_receipt_id: string }; Returns: undefined };
      create_household: { Args: { p_name: string }; Returns: string };
      create_invitation: { Args: { p_household_id: string }; Returns: Json };
      end_shopping: { Args: { p_session_id: string }; Returns: SessionRow };
      invitation_preview: { Args: { p_token: string }; Returns: Json };
      leave_household: { Args: { p_household_id: string }; Returns: undefined };
      merge_receipts: { Args: { p_receipt_ids: string[] }; Returns: string };
      register_receipt: {
        Args: { p_checksum: string; p_ext?: string; p_household_id: string; p_source?: string };
        Returns: { already_exists: boolean; path: string; receipt_id: string }[];
      };
      register_receipt_page: {
        Args: { p_checksum: string; p_ext?: string; p_receipt_id: string };
        Returns: { already_exists: boolean; owner_receipt_id: string; path: string }[];
      };
      reject_request: { Args: { p_request_id: string }; Returns: Json };
      remove_member: { Args: { p_household_id: string; p_user_id: string }; Returns: undefined };
      revoke_invitation: { Args: { p_invitation_id: string }; Returns: undefined };
      start_shopping: { Args: { p_list_id: string }; Returns: SessionRow };
    };
    Enums: {
      invitation_status: "PENDING" | "ACCEPTED" | "REVOKED";
      item_status: "OPEN" | "PURCHASED";
      member_role: "OWNER" | "MEMBER";
      receipt_status: "PROCESSING" | "OK" | "NEEDS_REVIEW" | "FAILED";
      request_status: "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED";
      session_status: "ACTIVE" | "ENDED" | "EXPIRED";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicTables = Database["public"]["Tables"];
export type Row<T extends keyof PublicTables> = PublicTables[T]["Row"];
export type Enum<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
