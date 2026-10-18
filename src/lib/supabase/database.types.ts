// PROVISIONAL: escrito a mano a partir de supabase/migrations/ (hasta la 0006). Cuando el
// proyecto enlazado tenga aplicadas todas las migraciones, regenera este fichero con
// `pnpm db:types` (sobrescribe todo; no lo edites a mano después).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      achievements: {
        Row: {
          code: string;
          unlocked_at: string;
          user_id: string;
        };
        Insert: {
          code: string;
          unlocked_at?: string;
          user_id?: string;
        };
        Update: {
          code?: string;
          unlocked_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      activity_days: {
        Row: {
          active_seconds: number;
          day: string;
          freeze_used: boolean;
          goal_met: boolean;
          user_id: string;
          xp: number;
        };
        Insert: {
          active_seconds?: number;
          day: string;
          freeze_used?: boolean;
          goal_met?: boolean;
          user_id?: string;
          xp?: number;
        };
        Update: {
          active_seconds?: number;
          day?: string;
          freeze_used?: boolean;
          goal_met?: boolean;
          user_id?: string;
          xp?: number;
        };
        Relationships: [];
      };
      ai_usage: {
        Row: {
          cost_usd: number;
          created_at: string;
          id: string;
          input_tokens: number | null;
          model: string;
          output_tokens: number | null;
          reason: string | null;
          reserved_usd: number;
          settle_hash: string | null;
          settled_at: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          cost_usd?: number;
          created_at?: string;
          id?: string;
          input_tokens?: number | null;
          model: string;
          output_tokens?: number | null;
          reason?: string | null;
          reserved_usd: number;
          settle_hash?: string | null;
          settled_at?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          cost_usd?: number;
          created_at?: string;
          id?: string;
          input_tokens?: number | null;
          model?: string;
          output_tokens?: number | null;
          reason?: string | null;
          reserved_usd?: number;
          settle_hash?: string | null;
          settled_at?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      daily_plans: {
        Row: {
          created_at: string;
          day: string;
          engine_version: number;
          items: Json;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          day: string;
          engine_version?: number;
          items: Json;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          day?: string;
          engine_version?: number;
          items?: Json;
          user_id?: string;
        };
        Relationships: [];
      };
      input_log: {
        Row: {
          accent: string | null;
          created_at: string;
          id: number;
          kind: Database['public']['Enums']['input_kind'];
          lesson_id: string | null;
          logged_on: string;
          minutes: number;
          perceived_level: Database['public']['Enums']['cefr'] | null;
          source: Database['public']['Enums']['input_source'];
          title: string | null;
          url: string | null;
          user_id: string;
          words: number | null;
        };
        Insert: {
          accent?: string | null;
          created_at?: string;
          id?: never;
          kind: Database['public']['Enums']['input_kind'];
          lesson_id?: string | null;
          logged_on: string;
          minutes: number;
          perceived_level?: Database['public']['Enums']['cefr'] | null;
          source: Database['public']['Enums']['input_source'];
          title?: string | null;
          url?: string | null;
          user_id?: string;
          words?: number | null;
        };
        Update: {
          accent?: string | null;
          created_at?: string;
          id?: never;
          kind?: Database['public']['Enums']['input_kind'];
          lesson_id?: string | null;
          logged_on?: string;
          minutes?: number;
          perceived_level?: Database['public']['Enums']['cefr'] | null;
          source?: Database['public']['Enums']['input_source'];
          title?: string | null;
          url?: string | null;
          user_id?: string;
          words?: number | null;
        };
        Relationships: [];
      };
      item_attempts: {
        Row: {
          client_id: string;
          created_at: string;
          duration_ms: number | null;
          focus: string | null;
          id: number;
          item_difficulty: number;
          item_id: string;
          lesson_id: string;
          phase: string | null;
          rating_before: number;
          response: Json;
          score: number;
          skill: Database['public']['Enums']['skill'];
          task_type: string;
          user_id: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          duration_ms?: number | null;
          focus?: string | null;
          id?: never;
          item_difficulty: number;
          item_id: string;
          lesson_id: string;
          phase?: string | null;
          rating_before: number;
          response?: Json;
          score: number;
          skill: Database['public']['Enums']['skill'];
          task_type: string;
          user_id?: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          duration_ms?: number | null;
          focus?: string | null;
          id?: never;
          item_difficulty?: number;
          item_id?: string;
          lesson_id?: string;
          phase?: string | null;
          rating_before?: number;
          response?: Json;
          score?: number;
          skill?: Database['public']['Enums']['skill'];
          task_type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      language_levels: {
        Row: {
          declared_level: Database['public']['Enums']['cefr'];
          language: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          declared_level: Database['public']['Enums']['cefr'];
          language: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          declared_level?: Database['public']['Enums']['cefr'];
          language?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      lesson_progress: {
        Row: {
          attempts: number;
          best_score: number | null;
          completed_at: string | null;
          lesson_id: string;
          lesson_version: number;
          phase: number;
          reading_wpm: number | null;
          score: number | null;
          self_rating_final: number | null;
          self_rating_initial: number | null;
          started_at: string;
          status: Database['public']['Enums']['lesson_status'];
          time_spent_s: number;
          transcript_first: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          attempts?: number;
          best_score?: number | null;
          completed_at?: string | null;
          lesson_id: string;
          lesson_version?: number;
          phase?: number;
          reading_wpm?: number | null;
          score?: number | null;
          self_rating_final?: number | null;
          self_rating_initial?: number | null;
          started_at?: string;
          status?: Database['public']['Enums']['lesson_status'];
          time_spent_s?: number;
          transcript_first?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          attempts?: number;
          best_score?: number | null;
          completed_at?: string | null;
          lesson_id?: string;
          lesson_version?: number;
          phase?: number;
          reading_wpm?: number | null;
          score?: number | null;
          self_rating_final?: number | null;
          self_rating_initial?: number | null;
          started_at?: string;
          status?: Database['public']['Enums']['lesson_status'];
          time_spent_s?: number;
          transcript_first?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      lexicon: {
        Row: {
          language: string;
          cefr: Database['public']['Enums']['cefr'] | null;
          first_seen_at: string;
          lemma: string;
          lookup_count: number;
          seen_count: number;
          source: Database['public']['Enums']['lexeme_source'];
          status: Database['public']['Enums']['lexeme_status'];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          language?: string;
          cefr?: Database['public']['Enums']['cefr'] | null;
          first_seen_at?: string;
          lemma: string;
          lookup_count?: number;
          seen_count?: number;
          source: Database['public']['Enums']['lexeme_source'];
          status: Database['public']['Enums']['lexeme_status'];
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          language?: string;
          cefr?: Database['public']['Enums']['cefr'] | null;
          first_seen_at?: string;
          lemma?: string;
          lookup_count?: number;
          seen_count?: number;
          source?: Database['public']['Enums']['lexeme_source'];
          status?: Database['public']['Enums']['lexeme_status'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      listening_diagnostics: {
        Row: {
          cause: Database['public']['Enums']['diag_cause'];
          cause_source: string;
          created_at: string;
          expected: string;
          features: string[];
          id: number;
          lesson_id: string;
          playback_rate: number;
          segment_id: string;
          typed: string | null;
          user_id: string;
        };
        Insert: {
          cause: Database['public']['Enums']['diag_cause'];
          cause_source?: string;
          created_at?: string;
          expected: string;
          features?: string[];
          id?: never;
          lesson_id: string;
          playback_rate?: number;
          segment_id: string;
          typed?: string | null;
          user_id?: string;
        };
        Update: {
          cause?: Database['public']['Enums']['diag_cause'];
          cause_source?: string;
          created_at?: string;
          expected?: string;
          features?: string[];
          id?: never;
          lesson_id?: string;
          playback_rate?: number;
          segment_id?: string;
          typed?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      login_attempts: {
        Row: {
          attempts: number;
          last_attempt_at: string | null;
          locked_until: string | null;
          user_id: string;
        };
        Insert: {
          attempts?: number;
          last_attempt_at?: string | null;
          locked_until?: string | null;
          user_id: string;
        };
        Update: {
          attempts?: number;
          last_attempt_at?: string | null;
          locked_until?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      placement_results: {
        Row: {
          details: Json;
          id: string;
          kind: string;
          passed: boolean | null;
          score: number | null;
          skill: Database['public']['Enums']['skill'] | null;
          taken_at: string;
          target_level: Database['public']['Enums']['cefr'] | null;
          user_id: string;
        };
        Insert: {
          details: Json;
          id?: string;
          kind: string;
          passed?: boolean | null;
          score?: number | null;
          skill?: Database['public']['Enums']['skill'] | null;
          taken_at?: string;
          target_level?: Database['public']['Enums']['cefr'] | null;
          user_id?: string;
        };
        Update: {
          details?: Json;
          id?: string;
          kind?: string;
          passed?: boolean | null;
          score?: number | null;
          skill?: Database['public']['Enums']['skill'] | null;
          taken_at?: string;
          target_level?: Database['public']['Enums']['cefr'] | null;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          daily_goal_min: number;
          declared_level: Database['public']['Enums']['cefr'] | null;
          display_name: string | null;
          id: string;
          interests: string[];
          native_language: string;
          settings: Json;
          streak_min_minutes: number;
          timezone: string;
          ui_locale: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          daily_goal_min?: number;
          declared_level?: Database['public']['Enums']['cefr'] | null;
          display_name?: string | null;
          id: string;
          interests?: string[];
          native_language?: string;
          settings?: Json;
          streak_min_minutes?: number;
          timezone?: string;
          ui_locale?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          daily_goal_min?: number;
          declared_level?: Database['public']['Enums']['cefr'] | null;
          display_name?: string | null;
          id?: string;
          interests?: string[];
          native_language?: string;
          settings?: Json;
          streak_min_minutes?: number;
          timezone?: string;
          ui_locale?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rating_history: {
        Row: {
          language: string;
          id: number;
          rating: number;
          recorded_at: string;
          skill: Database['public']['Enums']['skill'];
          user_id: string;
        };
        Insert: {
          language?: string;
          id?: never;
          rating: number;
          recorded_at?: string;
          skill: Database['public']['Enums']['skill'];
          user_id?: string;
        };
        Update: {
          language?: string;
          id?: never;
          rating?: number;
          recorded_at?: string;
          skill?: Database['public']['Enums']['skill'];
          user_id?: string;
        };
        Relationships: [];
      };
      skill_ratings: {
        Row: {
          language: string;
          confirmed_at: string | null;
          confirmed_level: Database['public']['Enums']['cefr'] | null;
          items_count: number;
          rating: number;
          skill: Database['public']['Enums']['skill'];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          language?: string;
          confirmed_at?: string | null;
          confirmed_level?: Database['public']['Enums']['cefr'] | null;
          items_count?: number;
          rating?: number;
          skill: Database['public']['Enums']['skill'];
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          language?: string;
          confirmed_at?: string | null;
          confirmed_level?: Database['public']['Enums']['cefr'] | null;
          items_count?: number;
          rating?: number;
          skill?: Database['public']['Enums']['skill'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      srs_cards: {
        Row: {
          language: string;
          back: Json;
          created_at: string;
          difficulty: number;
          due: string;
          elapsed_days: number;
          front: Json;
          id: string;
          kind: Database['public']['Enums']['card_kind'];
          lapses: number;
          last_review: string | null;
          learning_steps: number;
          lemma: string | null;
          reps: number;
          scheduled_days: number;
          source_lesson_id: string | null;
          source_segment_id: string | null;
          stability: number;
          state: number;
          suspended: boolean;
          user_id: string;
        };
        Insert: {
          language?: string;
          back: Json;
          created_at?: string;
          difficulty?: number;
          due?: string;
          elapsed_days?: number;
          front: Json;
          id?: string;
          kind: Database['public']['Enums']['card_kind'];
          lapses?: number;
          last_review?: string | null;
          learning_steps?: number;
          lemma?: string | null;
          reps?: number;
          scheduled_days?: number;
          source_lesson_id?: string | null;
          source_segment_id?: string | null;
          stability?: number;
          state?: number;
          suspended?: boolean;
          user_id?: string;
        };
        Update: {
          language?: string;
          back?: Json;
          created_at?: string;
          difficulty?: number;
          due?: string;
          elapsed_days?: number;
          front?: Json;
          id?: string;
          kind?: Database['public']['Enums']['card_kind'];
          lapses?: number;
          last_review?: string | null;
          learning_steps?: number;
          lemma?: string | null;
          reps?: number;
          scheduled_days?: number;
          source_lesson_id?: string | null;
          source_segment_id?: string | null;
          stability?: number;
          state?: number;
          suspended?: boolean;
          user_id?: string;
        };
        Relationships: [];
      };
      srs_reviews: {
        Row: {
          card_id: string;
          client_id: string;
          difficulty: number;
          due: string;
          duration_ms: number | null;
          elapsed_days: number;
          id: number;
          last_elapsed_days: number;
          learning_steps: number;
          rating: number;
          review: string;
          scheduled_days: number;
          stability: number;
          state: number;
          user_id: string;
        };
        Insert: {
          card_id: string;
          client_id: string;
          difficulty: number;
          due: string;
          duration_ms?: number | null;
          elapsed_days: number;
          id?: never;
          last_elapsed_days: number;
          learning_steps?: number;
          rating: number;
          review: string;
          scheduled_days: number;
          stability: number;
          state: number;
          user_id?: string;
        };
        Update: {
          card_id?: string;
          client_id?: string;
          difficulty?: number;
          due?: string;
          duration_ms?: number | null;
          elapsed_days?: number;
          id?: never;
          last_elapsed_days?: number;
          learning_steps?: number;
          rating?: number;
          review?: string;
          scheduled_days?: number;
          stability?: number;
          state?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'srs_reviews_card_id_fkey';
            columns: ['card_id'];
            isOneToOne: false;
            referencedRelation: 'srs_cards';
            referencedColumns: ['id'];
          },
        ];
      };
      writing_submissions: {
        Row: {
          active_seconds: number;
          cost_usd: number;
          created_at: string;
          exam_mode: boolean;
          feedback: Json | null;
          id: string;
          input_tokens: number | null;
          model: string | null;
          output_tokens: number | null;
          prompt_id: string | null;
          review_kind: string;
          rewrite_text: string | null;
          rewritten_at: string | null;
          status: string;
          target_level: Database['public']['Enums']['cefr'];
          task_type: string;
          text: string;
          user_id: string;
          word_count: number;
        };
        Insert: {
          active_seconds?: number;
          cost_usd?: number;
          created_at?: string;
          exam_mode?: boolean;
          feedback?: Json | null;
          id?: string;
          input_tokens?: number | null;
          model?: string | null;
          output_tokens?: number | null;
          prompt_id?: string | null;
          review_kind?: string;
          rewrite_text?: string | null;
          rewritten_at?: string | null;
          status?: string;
          target_level: Database['public']['Enums']['cefr'];
          task_type: string;
          text: string;
          user_id?: string;
          word_count: number;
        };
        Update: {
          active_seconds?: number;
          cost_usd?: number;
          created_at?: string;
          exam_mode?: boolean;
          feedback?: Json | null;
          id?: string;
          input_tokens?: number | null;
          model?: string | null;
          output_tokens?: number | null;
          prompt_id?: string | null;
          review_kind?: string;
          rewrite_text?: string | null;
          rewritten_at?: string | null;
          status?: string;
          target_level?: Database['public']['Enums']['cefr'];
          task_type?: string;
          text?: string;
          user_id?: string;
          word_count?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      v_ai_spend_month: {
        Row: {
          cost_usd: number | null;
          month: string | null;
          requests: number | null;
          user_id: string | null;
        };
        Relationships: [];
      };
      v_input_weekly: {
        Row: {
          kind: Database['public']['Enums']['input_kind'] | null;
          minutes: number | null;
          user_id: string | null;
          week: string | null;
          words: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      add_activity: {
        Args: { p_day: string; p_seconds: number; p_xp: number };
        Returns: Database['public']['Tables']['activity_days']['Row'];
      };
      ai_usage_reserve: {
        Args: {
          p_daily_limit: number;
          p_day_start: string;
          p_model: string;
          p_month_start: string;
          p_monthly_budget_usd: number;
          p_reserve_usd: number;
        };
        Returns: Json;
      };
      ai_usage_settle: {
        Args: {
          p_cost_usd: number;
          p_id: string;
          p_input_tokens: number;
          p_outcome: string;
          p_output_tokens: number;
          p_token: string;
        };
        Returns: boolean;
      };
      apply_lesson_attempts: {
        Args: {
          p_attempts: Json;
          p_lesson_id: string;
          p_language?: string;
          p_lesson_version: number;
          p_progress: Json;
          p_ratings: Json;
        };
        Returns: undefined;
      };
      apply_reviews: {
        Args: { p_reviews: Json };
        Returns: number;
      };
      login_attempt_begin: {
        Args: { p_email: string };
        Returns: Json;
      };
      login_attempt_clear: {
        Args: never;
        Returns: undefined;
      };
    };
    Enums: {
      card_kind: 'word' | 'chunk' | 'audio' | 'grammar' | 'production';
      cefr: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
      diag_cause: 'unknown_word' | 'not_recognized' | 'boundaries' | 'speed' | 'accent' | 'attention';
      input_kind:
        | 'intensive_listening'
        | 'extensive_listening'
        | 'intensive_reading'
        | 'extensive_reading';
      input_source: 'app' | 'external';
      lesson_status: 'started' | 'completed';
      lexeme_source: 'placement' | 'manual' | 'srs' | 'implicit' | 'lesson';
      lexeme_status: 'new' | 'learning' | 'known' | 'ignored';
      skill: 'listening' | 'reading' | 'vocabulary' | 'grammar' | 'writing' | 'speaking';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];
