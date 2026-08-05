/**
 * Minimal typed surface for Attendly cloud tables.
 * Generated shape kept hand-maintained to match migration `attendly_cloud_schema`.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      settings: {
        Row: {
          clerk_user_id: string;
          id: number;
          semester_name: string;
          semester_start: string;
          semester_end: string;
          target_pct: number;
          buffer_pct: number;
          timezone: string;
          working_days: number[];
          period_slots: Json;
          od_counts_as: string;
          late_counts_as_present: boolean;
          theme: string;
          high_contrast: boolean;
          reduced_motion: boolean;
          large_tap_targets: boolean;
          use_24h: boolean;
          onboarded: boolean;
          notify_enabled: boolean;
          notify_pre_class: boolean;
          notify_pre_class_minutes: number;
          notify_post_class: boolean;
          notify_critical: boolean;
          updated_at: string;
        };
        Insert: Database["public"]["Tables"]["settings"]["Row"];
        Update: Partial<Database["public"]["Tables"]["settings"]["Row"]>;
      };
      subjects: {
        Row: {
          id: string;
          clerk_user_id: string;
          name: string;
          short_code: string;
          color: string;
          target_pct: number | null;
          component_targets: Json | null;
          archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Database["public"]["Tables"]["subjects"]["Row"];
        Update: Partial<Database["public"]["Tables"]["subjects"]["Row"]>;
      };
      timetable_series: {
        Row: {
          id: string;
          clerk_user_id: string;
          subject_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          location: string | null;
          session_type: string;
          target_pct: number | null;
          week_parity: string;
          effective_from: string;
          effective_to: string | null;
          counts_toward_attendance: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Database["public"]["Tables"]["timetable_series"]["Row"];
        Update: Partial<Database["public"]["Tables"]["timetable_series"]["Row"]>;
      };
      series_exceptions: {
        Row: {
          id: string;
          clerk_user_id: string;
          series_id: string;
          date: string;
          type: string;
          new_start_time: string | null;
          new_end_time: string | null;
          new_location: string | null;
          reason: string | null;
          created_at: string;
        };
        Insert: Database["public"]["Tables"]["series_exceptions"]["Row"];
        Update: Partial<Database["public"]["Tables"]["series_exceptions"]["Row"]>;
      };
      calendar_blocks: {
        Row: {
          id: string;
          clerk_user_id: string;
          kind: string;
          title: string;
          starts_on: string;
          ends_on: string;
          suppresses_teaching: boolean;
          created_at: string;
        };
        Insert: Database["public"]["Tables"]["calendar_blocks"]["Row"];
        Update: Partial<Database["public"]["Tables"]["calendar_blocks"]["Row"]>;
      };
      class_sessions: {
        Row: {
          id: string;
          clerk_user_id: string;
          occurrence_key: string;
          subject_id: string;
          series_id: string | null;
          original_start: string | null;
          starts_at: string;
          ends_at: string;
          location: string | null;
          session_type: string;
          source: string;
          status: string;
          counts_toward_attendance: boolean;
          relevance: string;
          replaces_session_id: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Database["public"]["Tables"]["class_sessions"]["Row"];
        Update: Partial<Database["public"]["Tables"]["class_sessions"]["Row"]>;
      };
      attendance_records: {
        Row: {
          id: string;
          clerk_user_id: string;
          session_id: string;
          status: string;
          marked_at: string;
          note: string | null;
        };
        Insert: Database["public"]["Tables"]["attendance_records"]["Row"];
        Update: Partial<
          Database["public"]["Tables"]["attendance_records"]["Row"]
        >;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
