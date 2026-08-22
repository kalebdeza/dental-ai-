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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          answer: string
          claim_id: string | null
          created_at: string
          id: string
          patient_id: string | null
          practice_id: string
          question: string
        }
        Insert: {
          answer: string
          claim_id?: string | null
          created_at?: string
          id?: string
          patient_id?: string | null
          practice_id: string
          question: string
        }
        Update: {
          answer?: string
          claim_id?: string | null
          created_at?: string
          id?: string
          patient_id?: string | null
          practice_id?: string
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_type: string | null
          created_at: string
          end_time: string
          id: string
          integration_id: string
          last_synced_at: string | null
          notes: string | null
          operatory: string | null
          patient_id: string
          practice_id: string
          provider_id: string | null
          source_appointment_id: string
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          appointment_type?: string | null
          created_at?: string
          end_time: string
          id?: string
          integration_id: string
          last_synced_at?: string | null
          notes?: string | null
          operatory?: string | null
          patient_id: string
          practice_id: string
          provider_id?: string | null
          source_appointment_id: string
          start_time: string
          status: string
          updated_at?: string
        }
        Update: {
          appointment_type?: string | null
          created_at?: string
          end_time?: string
          id?: string
          integration_id?: string
          last_synced_at?: string | null
          notes?: string | null
          operatory?: string | null
          patient_id?: string
          practice_id?: string
          provider_id?: string | null
          source_appointment_id?: string
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          practice_id: string | null
          resource: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          practice_id?: string | null
          resource?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          practice_id?: string | null
          resource?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          amount_billed: number
          amount_paid: number
          claim_number: string | null
          created_at: string
          denial_reason: string | null
          id: string
          insurance_company: string | null
          integration_id: string
          last_action: string | null
          last_synced_at: string | null
          paid_at: string | null
          patient_id: string
          practice_id: string
          provider_id: string | null
          remaining_balance: number
          source_claim_id: string
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          amount_billed?: number
          amount_paid?: number
          claim_number?: string | null
          created_at?: string
          denial_reason?: string | null
          id?: string
          insurance_company?: string | null
          integration_id: string
          last_action?: string | null
          last_synced_at?: string | null
          paid_at?: string | null
          patient_id: string
          practice_id: string
          provider_id?: string | null
          remaining_balance?: number
          source_claim_id: string
          status: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          amount_billed?: number
          amount_paid?: number
          claim_number?: string | null
          created_at?: string
          denial_reason?: string | null
          id?: string
          insurance_company?: string | null
          integration_id?: string
          last_action?: string | null
          last_synced_at?: string | null
          paid_at?: string | null
          patient_id?: string
          practice_id?: string
          provider_id?: string | null
          remaining_balance?: number
          source_claim_id?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          created_at: string
          customer_key: string | null
          external_practice_id: string | null
          id: string
          last_sync_at: string | null
          practice_id: string
          provider: string
          status: string
          sync_frequency_minutes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_key?: string | null
          external_practice_id?: string | null
          id?: string
          last_sync_at?: string | null
          practice_id: string
          provider: string
          status?: string
          sync_frequency_minutes?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_key?: string | null
          external_practice_id?: string | null
          id?: string
          last_sync_at?: string | null
          practice_id?: string
          provider?: string
          status?: string
          sync_frequency_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_user_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_user_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      patients: {
        Row: {
          address: string | null
          balance: number
          birth_date: string | null
          chart_number: string | null
          city: string | null
          created_at: string
          email: string | null
          first_name: string
          gender: string | null
          home_phone: string | null
          id: string
          insurance_estimate: number
          integration_id: string
          last_name: string
          last_synced_at: string | null
          last_visit: string | null
          middle_name: string | null
          mobile_phone: string | null
          next_visit: string | null
          patient_status: string | null
          practice_id: string
          preferred_name: string | null
          source_patient_id: string
          state: string | null
          updated_at: string
          work_phone: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          balance?: number
          birth_date?: string | null
          chart_number?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          gender?: string | null
          home_phone?: string | null
          id?: string
          insurance_estimate?: number
          integration_id: string
          last_name: string
          last_synced_at?: string | null
          last_visit?: string | null
          middle_name?: string | null
          mobile_phone?: string | null
          next_visit?: string | null
          patient_status?: string | null
          practice_id: string
          preferred_name?: string | null
          source_patient_id: string
          state?: string | null
          updated_at?: string
          work_phone?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          balance?: number
          birth_date?: string | null
          chart_number?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          gender?: string | null
          home_phone?: string | null
          id?: string
          insurance_estimate?: number
          integration_id?: string
          last_name?: string
          last_synced_at?: string | null
          last_visit?: string | null
          middle_name?: string | null
          mobile_phone?: string | null
          next_visit?: string | null
          patient_status?: string | null
          practice_id?: string
          preferred_name?: string | null
          source_patient_id?: string
          state?: string | null
          updated_at?: string
          work_phone?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      practices: {
        Row: {
          active: boolean
          address: string | null
          city: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          organization_id: string
          phone: string | null
          state: string | null
          timezone: string
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          organization_id: string
          phone?: string | null
          state?: string | null
          timezone?: string
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          organization_id?: string
          phone?: string | null
          state?: string | null
          timezone?: string
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      procedure_codes: {
        Row: {
          active: boolean
          category: string | null
          code: string
          created_at: string
          description: string
          fee: number | null
          id: string
          integration_id: string
          source_code_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          code: string
          created_at?: string
          description: string
          fee?: number | null
          id?: string
          integration_id: string
          source_code_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          code?: string
          created_at?: string
          description?: string
          fee?: number | null
          id?: string
          integration_id?: string
          source_code_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedure_codes_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      procedures: {
        Row: {
          appointment_id: string | null
          completed_at: string | null
          created_at: string
          fee: number
          id: string
          insurance_estimate: number
          insurance_paid: number
          integration_id: string
          last_synced_at: string | null
          patient_id: string
          patient_portion: number
          practice_id: string
          procedure_code_id: string
          provider_id: string | null
          source_procedure_id: string
          status: string
          surface: string | null
          tooth: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          completed_at?: string | null
          created_at?: string
          fee?: number
          id?: string
          insurance_estimate?: number
          insurance_paid?: number
          integration_id: string
          last_synced_at?: string | null
          patient_id: string
          patient_portion?: number
          practice_id: string
          procedure_code_id: string
          provider_id?: string | null
          source_procedure_id: string
          status: string
          surface?: string | null
          tooth?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          completed_at?: string | null
          created_at?: string
          fee?: number
          id?: string
          insurance_estimate?: number
          insurance_paid?: number
          integration_id?: string
          last_synced_at?: string | null
          patient_id?: string
          patient_portion?: number
          practice_id?: string
          procedure_code_id?: string
          provider_id?: string | null
          source_procedure_id?: string
          status?: string
          surface?: string | null
          tooth?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedures_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedures_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedures_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedures_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedures_procedure_code_id_fkey"
            columns: ["procedure_code_id"]
            isOneToOne: false
            referencedRelation: "procedure_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedures_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          abbreviation: string | null
          active: boolean
          created_at: string
          email: string | null
          first_name: string
          id: string
          integration_id: string
          last_name: string
          last_synced_at: string | null
          npi: string | null
          phone: string | null
          practice_id: string
          provider_number: string | null
          provider_type: string | null
          source_provider_id: string
          updated_at: string
        }
        Insert: {
          abbreviation?: string | null
          active?: boolean
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          integration_id: string
          last_name: string
          last_synced_at?: string | null
          npi?: string | null
          phone?: string | null
          practice_id: string
          provider_number?: string | null
          provider_type?: string | null
          source_provider_id: string
          updated_at?: string
        }
        Update: {
          abbreviation?: string | null
          active?: boolean
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          integration_id?: string
          last_name?: string
          last_synced_at?: string | null
          npi?: string | null
          phone?: string | null
          practice_id?: string
          provider_number?: string | null
          provider_type?: string | null
          source_provider_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "providers_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "providers_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      recalls: {
        Row: {
          completed_date: string | null
          created_at: string
          due_date: string | null
          estimated_revenue: number
          id: string
          integration_id: string
          last_synced_at: string | null
          patient_id: string
          practice_id: string
          recall_type: string | null
          source_recall_id: string
          status: string
          updated_at: string
        }
        Insert: {
          completed_date?: string | null
          created_at?: string
          due_date?: string | null
          estimated_revenue?: number
          id?: string
          integration_id: string
          last_synced_at?: string | null
          patient_id: string
          practice_id: string
          recall_type?: string | null
          source_recall_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          completed_date?: string | null
          created_at?: string
          due_date?: string | null
          estimated_revenue?: number
          id?: string
          integration_id?: string
          last_synced_at?: string | null
          patient_id?: string
          practice_id?: string
          recall_type?: string | null
          source_recall_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recalls_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recalls_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recalls_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_opportunities: {
        Row: {
          claim_id: string | null
          completed: boolean
          confidence_score: number | null
          created_at: string
          estimated_value: number
          id: string
          opportunity_type: string
          patient_id: string | null
          practice_id: string
          priority: string
          procedure_id: string | null
          reason: string | null
          recommended_action: string | null
          updated_at: string
        }
        Insert: {
          claim_id?: string | null
          completed?: boolean
          confidence_score?: number | null
          created_at?: string
          estimated_value?: number
          id?: string
          opportunity_type: string
          patient_id?: string | null
          practice_id: string
          priority: string
          procedure_id?: string | null
          reason?: string | null
          recommended_action?: string | null
          updated_at?: string
        }
        Update: {
          claim_id?: string | null
          completed?: boolean
          confidence_score?: number | null
          created_at?: string
          estimated_value?: number
          id?: string
          opportunity_type?: string
          patient_id?: string | null
          practice_id?: string
          priority?: string
          procedure_id?: string | null
          reason?: string | null
          recommended_action?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_opportunities_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_opportunities_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_opportunities_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_opportunities_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
