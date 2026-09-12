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
          cancellation_reason: string | null
          cancelled_at: string | null
          confirmation_status: string
          created_at: string
          end_time: string
          id: string
          integration_id: string | null
          last_synced_at: string | null
          notes: string | null
          offered_slots: Json | null
          operatory: string | null
          opportunity_id: string | null
          patient_id: string
          practice_id: string
          provider_id: string | null
          provider_name: string | null
          reschedule_status: string
          source: string
          source_appointment_id: string
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          appointment_type?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmation_status?: string
          created_at?: string
          end_time: string
          id?: string
          integration_id?: string | null
          last_synced_at?: string | null
          notes?: string | null
          offered_slots?: Json | null
          operatory?: string | null
          opportunity_id?: string | null
          patient_id: string
          practice_id: string
          provider_id?: string | null
          provider_name?: string | null
          reschedule_status?: string
          source?: string
          source_appointment_id: string
          start_time: string
          status: string
          updated_at?: string
        }
        Update: {
          appointment_type?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmation_status?: string
          created_at?: string
          end_time?: string
          id?: string
          integration_id?: string
          last_synced_at?: string | null
          notes?: string | null
          offered_slots?: Json | null
          operatory?: string | null
          opportunity_id?: string | null
          patient_id?: string
          practice_id?: string
          provider_id?: string | null
          provider_name?: string | null
          reschedule_status?: string
          source?: string
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
            foreignKeyName: "appointments_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "revenue_opportunities"
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
      appointment_events: {
        Row: {
          appointment_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          new_state: string | null
          previous_state: string | null
          practice_id: string
          source: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          new_state?: string | null
          previous_state?: string | null
          practice_id: string
          source?: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          new_state?: string | null
          previous_state?: string | null
          practice_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_events_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_events_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
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
          source_status: string | null
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
          source_status?: string | null
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
          source_status?: string | null
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
          last_claim_scan_at: string | null
          last_recall_scan_at: string | null
          last_sync_at: string | null
          last_treatment_scan_at: string | null
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
          last_claim_scan_at?: string | null
          last_recall_scan_at?: string | null
          last_sync_at?: string | null
          last_treatment_scan_at?: string | null
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
          last_claim_scan_at?: string | null
          last_recall_scan_at?: string | null
          last_sync_at?: string | null
          last_treatment_scan_at?: string | null
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
      practice_members: {
        Row: {
          created_at: string
          id: string
          practice_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          practice_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          practice_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_members_practice_id_fkey"
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
          source_status: string | null
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
          source_status?: string | null
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
          source_status?: string | null
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
          source_status: string | null
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
          source_status?: string | null
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
          source_status?: string | null
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
      opendental_claimprocs: {
        Row: {
          absent_from_sync_at: string | null
          claim_adj_reason_codes: string | null
          claim_payment_num: number | null
          copay_amt: number | null
          created_at: string
          date_cp: string | null
          date_entry: string | null
          ded_applied: number | null
          fee_billed: number | null
          id: string
          ins_pay_amt: number
          ins_pay_est: number
          integration_id: string
          is_overpay: boolean | null
          is_transfer: boolean | null
          last_synced_at: string
          practice_id: string
          proc_date: string | null
          source_claim_id: number | null
          source_claimproc_id: number
          source_patient_id: number | null
          source_procedure_id: number | null
          status: string
          updated_at: string
          write_off: number
        }
        Insert: {
          absent_from_sync_at?: string | null
          claim_adj_reason_codes?: string | null
          claim_payment_num?: number | null
          copay_amt?: number | null
          created_at?: string
          date_cp?: string | null
          date_entry?: string | null
          ded_applied?: number | null
          fee_billed?: number | null
          id?: string
          ins_pay_amt?: number
          ins_pay_est?: number
          integration_id: string
          is_overpay?: boolean | null
          is_transfer?: boolean | null
          last_synced_at?: string
          practice_id: string
          proc_date?: string | null
          source_claim_id?: number | null
          source_claimproc_id: number
          source_patient_id?: number | null
          source_procedure_id?: number | null
          status: string
          updated_at?: string
          write_off?: number
        }
        Update: {
          absent_from_sync_at?: string | null
          claim_adj_reason_codes?: string | null
          claim_payment_num?: number | null
          copay_amt?: number | null
          created_at?: string
          date_cp?: string | null
          date_entry?: string | null
          ded_applied?: number | null
          fee_billed?: number | null
          id?: string
          ins_pay_amt?: number
          ins_pay_est?: number
          integration_id?: string
          is_overpay?: boolean | null
          is_transfer?: boolean | null
          last_synced_at?: string
          practice_id?: string
          proc_date?: string | null
          source_claim_id?: number | null
          source_claimproc_id?: number
          source_patient_id?: number | null
          source_procedure_id?: number | null
          status?: string
          updated_at?: string
          write_off?: number
        }
        Relationships: [
          {
            foreignKeyName: "opendental_claimprocs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opendental_claimprocs_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_activities: {
        Row: {
          actor_user_id: string
          contact_outcome: string | null
          created_at: string
          event_type: string
          from_status: string | null
          id: string
          note: string | null
          opportunity_id: string
          practice_id: string
          snoozed_until: string | null
          to_status: string | null
        }
        Insert: {
          actor_user_id: string
          contact_outcome?: string | null
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: string
          note?: string | null
          opportunity_id: string
          practice_id: string
          snoozed_until?: string | null
          to_status?: string | null
        }
        Update: {
          actor_user_id?: string
          contact_outcome?: string | null
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          note?: string | null
          opportunity_id?: string
          practice_id?: string
          snoozed_until?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "revenue_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_activities_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_payment_attribution_events: {
        Row: {
          attribution_id: string
          claimproc_id: string
          created_at: string
          credited_amount: number
          event_type: string
          id: string
          opportunity_id: string
          practice_id: string
          previous_credited_amount: number | null
          reason: string | null
          source_claimproc_id: number
        }
        Insert: {
          attribution_id: string
          claimproc_id: string
          created_at?: string
          credited_amount: number
          event_type: string
          id?: string
          opportunity_id: string
          practice_id: string
          previous_credited_amount?: number | null
          reason?: string | null
          source_claimproc_id: number
        }
        Update: {
          attribution_id?: string
          claimproc_id?: string
          created_at?: string
          credited_amount?: number
          event_type?: string
          id?: string
          opportunity_id?: string
          practice_id?: string
          previous_credited_amount?: number | null
          reason?: string | null
          source_claimproc_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_payment_attribution_events_attribution_id_fkey"
            columns: ["attribution_id"]
            isOneToOne: false
            referencedRelation: "opportunity_payment_attributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_payment_attribution_events_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_payment_attributions: {
        Row: {
          cap_snapshot: number
          claimproc_id: string
          created_at: string
          credited_amount: number
          id: string
          identified_at_snapshot: string
          opportunity_id: string
          payment_dated_at: string
          practice_id: string
          reversal_reason: string | null
          reversed_at: string | null
          source_claimproc_id: number
          status: string
          updated_at: string
        }
        Insert: {
          cap_snapshot: number
          claimproc_id: string
          created_at?: string
          credited_amount?: number
          id?: string
          identified_at_snapshot: string
          opportunity_id: string
          payment_dated_at: string
          practice_id: string
          reversal_reason?: string | null
          reversed_at?: string | null
          source_claimproc_id: number
          status?: string
          updated_at?: string
        }
        Update: {
          cap_snapshot?: number
          claimproc_id?: string
          created_at?: string
          credited_amount?: number
          id?: string
          identified_at_snapshot?: string
          opportunity_id?: string
          payment_dated_at?: string
          practice_id?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          source_claimproc_id?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_payment_attributions_claimproc_id_fkey"
            columns: ["claimproc_id"]
            isOneToOne: false
            referencedRelation: "opendental_claimprocs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_payment_attributions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "revenue_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_payment_attributions_practice_id_fkey"
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
          close_reason: string | null
          completed: boolean
          confidence_score: number | null
          contact_outcome: string | null
          created_at: string
          estimated_value: number
          id: string
          identified_at: string
          identified_estimated_value: number
          last_acted_at: string | null
          last_actor_user_id: string | null
          opportunity_type: string
          patient_id: string | null
          practice_id: string
          priority: string
          procedure_id: string | null
          reason: string | null
          recall_id: string | null
          recommended_action: string | null
          snoozed_until: string | null
          updated_at: string
          workflow_status: string
        }
        Insert: {
          claim_id?: string | null
          close_reason?: string | null
          completed?: boolean
          confidence_score?: number | null
          contact_outcome?: string | null
          created_at?: string
          estimated_value?: number
          id?: string
          identified_at?: string
          identified_estimated_value?: number
          last_acted_at?: string | null
          last_actor_user_id?: string | null
          opportunity_type: string
          patient_id?: string | null
          practice_id: string
          priority: string
          procedure_id?: string | null
          reason?: string | null
          recall_id?: string | null
          recommended_action?: string | null
          snoozed_until?: string | null
          updated_at?: string
          workflow_status?: string
        }
        Update: {
          claim_id?: string | null
          close_reason?: string | null
          completed?: boolean
          confidence_score?: number | null
          contact_outcome?: string | null
          created_at?: string
          estimated_value?: number
          id?: string
          identified_at?: string
          identified_estimated_value?: number
          last_acted_at?: string | null
          last_actor_user_id?: string | null
          opportunity_type?: string
          patient_id?: string | null
          practice_id?: string
          priority?: string
          procedure_id?: string | null
          reason?: string | null
          recall_id?: string | null
          recommended_action?: string | null
          snoozed_until?: string | null
          updated_at?: string
          workflow_status?: string
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
            foreignKeyName: "revenue_opportunities_recall_id_fkey"
            columns: ["recall_id"]
            isOneToOne: false
            referencedRelation: "recalls"
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
      scheduling_jobs: {
        Row: {
          appointment_id: string | null
          attempts: number
          created_at: string
          dedupe_key: string
          id: string
          job_type: string
          last_error: string | null
          opportunity_id: string | null
          patient_id: string | null
          practice_id: string
          run_after: string
          status: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          attempts?: number
          created_at?: string
          dedupe_key: string
          id?: string
          job_type: string
          last_error?: string | null
          opportunity_id?: string | null
          patient_id?: string | null
          practice_id: string
          run_after?: string
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          attempts?: number
          created_at?: string
          dedupe_key?: string
          id?: string
          job_type?: string
          last_error?: string | null
          opportunity_id?: string | null
          patient_id?: string | null
          practice_id?: string
          run_after?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduling_jobs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduling_jobs_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "revenue_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduling_jobs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduling_jobs_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_conversations: {
        Row: {
          appointment_id: string | null
          created_at: string
          id: string
          last_inbound_at: string | null
          last_outbound_at: string | null
          opted_out: boolean
          patient_id: string
          practice_id: string
          state: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          opted_out?: boolean
          patient_id: string
          practice_id: string
          state?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          opted_out?: boolean
          patient_id?: string
          practice_id?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_conversations_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_conversations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_conversations_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_messages: {
        Row: {
          appointment_id: string | null
          body: string
          conversation_id: string | null
          created_at: string
          direction: string
          error: string | null
          id: string
          message_type: string
          patient_id: string
          practice_id: string
          provider: string
          provider_message_id: string | null
          status: string
        }
        Insert: {
          appointment_id?: string | null
          body: string
          conversation_id?: string | null
          created_at?: string
          direction: string
          error?: string | null
          id?: string
          message_type: string
          patient_id: string
          practice_id: string
          provider?: string
          provider_message_id?: string | null
          status?: string
        }
        Update: {
          appointment_id?: string | null
          body?: string
          conversation_id?: string | null
          created_at?: string
          direction?: string
          error?: string | null
          id?: string
          message_type?: string
          patient_id?: string
          practice_id?: string
          provider?: string
          provider_message_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "sms_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_opportunity_workflow: {
        Args: {
          p_clear_snooze?: boolean
          p_contact_outcome?: string | null
          p_event_type: string
          p_note?: string | null
          p_opportunity_id: string
          p_practice_id: string
          p_snoozed_until?: string | null
          p_to_status?: string | null
        }
        Returns: Json
      }
      opportunity_workflow_transition_allowed: {
        Args: {
          p_from: string
          p_opportunity_type: string
          p_to: string
        }
        Returns: boolean
      }
      create_practice_with_owner: {
        Args: {
          p_address?: string
          p_city?: string
          p_email?: string
          p_name: string
          p_organization_id: string
          p_phone?: string
          p_state?: string
          p_zip_code?: string
        }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "practices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      user_organization_ids: { Args: never; Returns: string[] }
      user_practice_ids: { Args: never; Returns: string[] }
      user_practice_role: { Args: { p_practice_id: string }; Returns: string }
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

