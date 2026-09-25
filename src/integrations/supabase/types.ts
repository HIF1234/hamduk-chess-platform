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
      achievements: {
        Row: {
          description: string
          icon: string
          name: string
          slug: string
          sort: number
          tier: string
        }
        Insert: {
          description: string
          icon: string
          name: string
          slug: string
          sort: number
          tier: string
        }
        Update: {
          description?: string
          icon?: string
          name?: string
          slug?: string
          sort?: number
          tier?: string
        }
        Relationships: []
      }
      activity_feed: {
        Row: {
          created_at: string
          id: number
          payload: Json
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          payload?: Json
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          payload?: Json
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_feed_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          after: Json | null
          before: Json | null
          created_at: string
          id: number
          reason: string | null
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: number
          reason?: string | null
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: number
          reason?: string | null
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: []
      }
      admin_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["admin_role_enum"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["admin_role_enum"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["admin_role_enum"]
          user_id?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          monthly_limit: number
          name: string
          owner_id: string
          revoked_at: string | null
          scopes: string[]
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          monthly_limit?: number
          name: string
          owner_id: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          monthly_limit?: number
          name?: string
          owner_id?: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Relationships: []
      }
      api_usage: {
        Row: {
          created_at: string
          endpoint: string
          id: number
          key_id: string
          method: string
          owner_id: string
          status: number
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: number
          key_id: string
          method: string
          owner_id: string
          status: number
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: number
          key_id?: string
          method?: string
          owner_id?: string
          status?: number
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_webhooks: {
        Row: {
          created_at: string
          disabled: boolean
          events: string[]
          failure_count: number
          id: string
          key_id: string | null
          owner_id: string
          secret: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          disabled?: boolean
          events?: string[]
          failure_count?: number
          id?: string
          key_id?: string | null
          owner_id: string
          secret: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          disabled?: boolean
          events?: string[]
          failure_count?: number
          id?: string
          key_id?: string | null
          owner_id?: string
          secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_webhooks_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          author_id: string | null
          body: string
          cover_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          published_at: string | null
          slug: string
          tags: string[]
          title: string
          type: string
          updated_at: string
          views: number
        }
        Insert: {
          author_id?: string | null
          body?: string
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          slug: string
          tags?: string[]
          title: string
          type?: string
          updated_at?: string
          views?: number
        }
        Update: {
          author_id?: string | null
          body?: string
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          slug?: string
          tags?: string[]
          title?: string
          type?: string
          updated_at?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_messages: {
        Row: {
          created_at: string
          id: string
          parts: Json
          role: string
          sdk_message_id: string | null
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parts?: Json
          role: string
          sdk_message_id?: string | null
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          sdk_message_id?: string | null
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "assistant_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_threads: {
        Row: {
          created_at: string
          game_id: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          game_id?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          game_id?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_threads_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_games: {
        Row: {
          bot_id: string
          bot_rating: number
          created_at: string
          end_reason: string | null
          id: string
          player_color: string
          ply: number
          result: string
          time_control: string
          user_id: string
          variant: string
        }
        Insert: {
          bot_id: string
          bot_rating: number
          created_at?: string
          end_reason?: string | null
          id?: string
          player_color: string
          ply?: number
          result: string
          time_control?: string
          user_id: string
          variant?: string
        }
        Update: {
          bot_id?: string
          bot_rating?: number
          created_at?: string
          end_reason?: string | null
          id?: string
          player_color?: string
          ply?: number
          result?: string
          time_control?: string
          user_id?: string
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_games_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_session_students: {
        Row: {
          board_fen: string | null
          created_at: string
          id: string
          label: string
          last_seen_at: string
          moves_made: number
          session_id: string
          user_id: string | null
        }
        Insert: {
          board_fen?: string | null
          created_at?: string
          id?: string
          label?: string
          last_seen_at?: string
          moves_made?: number
          session_id: string
          user_id?: string | null
        }
        Update: {
          board_fen?: string | null
          created_at?: string
          id?: string
          label?: string
          last_seen_at?: string
          moves_made?: number
          session_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_session_students_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_session_students_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_sessions: {
        Row: {
          created_at: string
          id: string
          key_id: string | null
          locked: boolean
          owner_id: string
          position_fen: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_id?: string | null
          locked?: boolean
          owner_id: string
          position_fen?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          key_id?: string | null
          locked?: boolean
          owner_id?: string
          position_fen?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      club_bans: {
        Row: {
          appeal_status: string
          appeal_text: string | null
          banned_by: string | null
          club_id: string
          created_at: string
          id: string
          reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          appeal_status?: string
          appeal_text?: string | null
          banned_by?: string | null
          club_id: string
          created_at?: string
          id?: string
          reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          appeal_status?: string
          appeal_text?: string | null
          banned_by?: string | null
          club_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_bans_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_bans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          club_id: string
          created_at: string
          id: string
          muted_until: string | null
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          muted_until?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          muted_until?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_posts: {
        Row: {
          club_id: string
          content: string
          created_at: string
          id: string
          pinned: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          club_id: string
          content: string
          created_at?: string
          id?: string
          pinned?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          club_id?: string
          content?: string
          created_at?: string
          id?: string
          pinned?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_posts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_official: boolean
          member_count: number
          min_tier: Database["public"]["Enums"]["subscription_tier_enum"]
          name: string
          owner_id: string | null
          slug: string
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_official?: boolean
          member_count?: number
          min_tier?: Database["public"]["Enums"]["subscription_tier_enum"]
          name: string
          owner_id?: string | null
          slug: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_official?: boolean
          member_count?: number
          min_tier?: Database["public"]["Enums"]["subscription_tier_enum"]
          name?: string
          owner_id?: string | null
          slug?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      coach_availability: {
        Row: {
          coach_id: string
          created_at: string
          end_minute: number
          id: string
          start_minute: number
          updated_at: string
          weekday: number
        }
        Insert: {
          coach_id: string
          created_at?: string
          end_minute: number
          id?: string
          start_minute: number
          updated_at?: string
          weekday: number
        }
        Update: {
          coach_id?: string
          created_at?: string
          end_minute?: number
          id?: string
          start_minute?: number
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "coach_availability_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_profiles: {
        Row: {
          avg_rating: number
          bio: string | null
          created_at: string
          currency: string
          display_name: string
          fide_elo: number | null
          fide_title: string | null
          hourly_rate_kobo: number
          id: string
          is_active: boolean
          languages: string[]
          paystack_subaccount_code: string | null
          platform_fee_pct: number
          rating_count: number
          sessions_completed: number
          specialties: string[]
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_rating?: number
          bio?: string | null
          created_at?: string
          currency?: string
          display_name: string
          fide_elo?: number | null
          fide_title?: string | null
          hourly_rate_kobo?: number
          id?: string
          is_active?: boolean
          languages?: string[]
          paystack_subaccount_code?: string | null
          platform_fee_pct?: number
          rating_count?: number
          sessions_completed?: number
          specialties?: string[]
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_rating?: number
          bio?: string | null
          created_at?: string
          currency?: string
          display_name?: string
          fide_elo?: number | null
          fide_title?: string | null
          hourly_rate_kobo?: number
          id?: string
          is_active?: boolean
          languages?: string[]
          paystack_subaccount_code?: string | null
          platform_fee_pct?: number
          rating_count?: number
          sessions_completed?: number
          specialties?: string[]
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coach_reviews: {
        Row: {
          coach_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          session_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          coach_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          session_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          coach_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          session_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_reviews_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_reviews_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "coach_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_sessions: {
        Row: {
          amount_kobo: number
          coach_id: string
          coach_notes: string | null
          created_at: string
          currency: string
          duration_min: number
          id: string
          meeting_url: string | null
          paystack_reference: string | null
          platform_fee_kobo: number
          scheduled_at: string
          status: string
          student_id: string
          student_notes: string | null
          updated_at: string
        }
        Insert: {
          amount_kobo: number
          coach_id: string
          coach_notes?: string | null
          created_at?: string
          currency?: string
          duration_min?: number
          id?: string
          meeting_url?: string | null
          paystack_reference?: string | null
          platform_fee_kobo?: number
          scheduled_at: string
          status?: string
          student_id: string
          student_notes?: string | null
          updated_at?: string
        }
        Update: {
          amount_kobo?: number
          coach_id?: string
          coach_notes?: string | null
          created_at?: string
          currency?: string
          duration_min?: number
          id?: string
          meeting_url?: string | null
          paystack_reference?: string | null
          platform_fee_kobo?: number
          scheduled_at?: string
          status?: string
          student_id?: string
          student_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      embed_tokens: {
        Row: {
          config: Json
          created_at: string
          expires_at: string | null
          id: string
          key_id: string
          kind: string
          owner_id: string
          token: string
        }
        Insert: {
          config?: Json
          created_at?: string
          expires_at?: string | null
          id?: string
          key_id: string
          kind: string
          owner_id: string
          token: string
        }
        Update: {
          config?: Json
          created_at?: string
          expires_at?: string | null
          id?: string
          key_id?: string
          kind?: string
          owner_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "embed_tokens_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_posts: {
        Row: {
          author_id: string
          content: string
          created_at: string
          deleted_at: string | null
          id: string
          likes: number
          parent_post_id: string | null
          thread_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          likes?: number
          parent_post_id?: string | null
          thread_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          likes?: number
          parent_post_id?: string | null
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_posts_parent_post_id_fkey"
            columns: ["parent_post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_posts_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "forum_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_threads: {
        Row: {
          author_id: string
          category: string
          club_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          last_reply_at: string
          locked: boolean
          pinned: boolean
          reply_count: number
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          author_id: string
          category: string
          club_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          last_reply_at?: string
          locked?: boolean
          pinned?: boolean
          reply_count?: number
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          author_id?: string
          category?: string
          club_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          last_reply_at?: string
          locked?: boolean
          pinned?: boolean
          reply_count?: number
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "forum_threads_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_threads_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      friends: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["friend_status_enum"]
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["friend_status_enum"]
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["friend_status_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friends_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friends_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_analysis: {
        Row: {
          accuracy_black: number | null
          accuracy_white: number | null
          classifications: Json
          created_at: string
          created_by: string | null
          depth: number
          eval_per_ply: Json
          game_id: string
          id: string
          opening_eco: string | null
          opening_name: string | null
        }
        Insert: {
          accuracy_black?: number | null
          accuracy_white?: number | null
          classifications: Json
          created_at?: string
          created_by?: string | null
          depth: number
          eval_per_ply: Json
          game_id: string
          id?: string
          opening_eco?: string | null
          opening_name?: string | null
        }
        Update: {
          accuracy_black?: number | null
          accuracy_white?: number | null
          classifications?: Json
          created_at?: string
          created_by?: string | null
          depth?: number
          eval_per_ply?: Json
          game_id?: string
          id?: string
          opening_eco?: string | null
          opening_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_analysis_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_challenges: {
        Row: {
          accepted_by: string | null
          created_at: string
          creator_color: string
          creator_id: string
          expires_at: string
          game_id: string | null
          id: string
          rated: boolean
          time_control: string
          variant: string
        }
        Insert: {
          accepted_by?: string | null
          created_at?: string
          creator_color?: string
          creator_id: string
          expires_at?: string
          game_id?: string | null
          id?: string
          rated?: boolean
          time_control: string
          variant?: string
        }
        Update: {
          accepted_by?: string | null
          created_at?: string
          creator_color?: string
          creator_id?: string
          expires_at?: string
          game_id?: string | null
          id?: string
          rated?: boolean
          time_control?: string
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_challenges_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_challenges_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_challenges_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_comment_likes: {
        Row: {
          comment_id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          user_id: string
        }
        Update: {
          comment_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "game_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_comment_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_comments: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          game_id: string
          id: string
          likes: number
          ply: number | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          game_id: string
          id?: string
          likes?: number
          ply?: number | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          game_id?: string
          id?: string
          likes?: number
          ply?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_comments_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_events: {
        Row: {
          by_user: string | null
          created_at: string
          game_id: string
          id: number
          payload: Json
          type: string
        }
        Insert: {
          by_user?: string | null
          created_at?: string
          game_id: string
          id?: number
          payload?: Json
          type: string
        }
        Update: {
          by_user?: string | null
          created_at?: string
          game_id?: string
          id?: number
          payload?: Json
          type?: string
        }
        Relationships: []
      }
      games: {
        Row: {
          black_id: string
          black_rating_before: number | null
          black_rating_delta: number | null
          bot_persona_id: string | null
          chess960_start_fen: string | null
          created_at: string
          days_per_move: number | null
          draw_offer_at: string | null
          draw_offer_by: string | null
          end_reason: string | null
          ended_at: string | null
          fen: string
          flag_reason: string | null
          flagged_for_review: boolean
          id: string
          increment_sec: number | null
          initial_sec: number | null
          is_bot_game: boolean
          is_correspondence: boolean
          is_public: boolean
          last_clock_update: string | null
          last_move_at: string
          move_deadline: string | null
          notify_by_email: boolean
          pgn: string
          ply: number
          rated: boolean
          region: string
          result: string | null
          spectator_count: number
          status: string
          takeback_offer_at: string | null
          takeback_offer_by: string | null
          time_black_ms: number | null
          time_control: string
          time_white_ms: number | null
          variant: string
          white_id: string
          white_rating_before: number | null
          white_rating_delta: number | null
          winner_id: string | null
        }
        Insert: {
          black_id: string
          black_rating_before?: number | null
          black_rating_delta?: number | null
          bot_persona_id?: string | null
          chess960_start_fen?: string | null
          created_at?: string
          days_per_move?: number | null
          draw_offer_at?: string | null
          draw_offer_by?: string | null
          end_reason?: string | null
          ended_at?: string | null
          fen?: string
          flag_reason?: string | null
          flagged_for_review?: boolean
          id?: string
          increment_sec?: number | null
          initial_sec?: number | null
          is_bot_game?: boolean
          is_correspondence?: boolean
          is_public?: boolean
          last_clock_update?: string | null
          last_move_at?: string
          move_deadline?: string | null
          notify_by_email?: boolean
          pgn?: string
          ply?: number
          rated?: boolean
          region?: string
          result?: string | null
          spectator_count?: number
          status?: string
          takeback_offer_at?: string | null
          takeback_offer_by?: string | null
          time_black_ms?: number | null
          time_control: string
          time_white_ms?: number | null
          variant?: string
          white_id: string
          white_rating_before?: number | null
          white_rating_delta?: number | null
          winner_id?: string | null
        }
        Update: {
          black_id?: string
          black_rating_before?: number | null
          black_rating_delta?: number | null
          bot_persona_id?: string | null
          chess960_start_fen?: string | null
          created_at?: string
          days_per_move?: number | null
          draw_offer_at?: string | null
          draw_offer_by?: string | null
          end_reason?: string | null
          ended_at?: string | null
          fen?: string
          flag_reason?: string | null
          flagged_for_review?: boolean
          id?: string
          increment_sec?: number | null
          initial_sec?: number | null
          is_bot_game?: boolean
          is_correspondence?: boolean
          is_public?: boolean
          last_clock_update?: string | null
          last_move_at?: string
          move_deadline?: string | null
          notify_by_email?: boolean
          pgn?: string
          ply?: number
          rated?: boolean
          region?: string
          result?: string | null
          spectator_count?: number
          status?: string
          takeback_offer_at?: string | null
          takeback_offer_by?: string | null
          time_black_ms?: number | null
          time_control?: string
          time_white_ms?: number | null
          variant?: string
          white_id?: string
          white_rating_before?: number | null
          white_rating_delta?: number | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_black_id_fkey"
            columns: ["black_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_white_id_fkey"
            columns: ["white_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matchmaking_queue: {
        Row: {
          is_priority: boolean
          joined_at: string
          rating: number
          region: string
          time_control: string
          user_id: string
          variant: string
        }
        Insert: {
          is_priority?: boolean
          joined_at?: string
          rating: number
          region?: string
          time_control: string
          user_id: string
          variant?: string
        }
        Update: {
          is_priority?: boolean
          joined_at?: string
          rating?: number
          region?: string
          time_control?: string
          user_id?: string
          variant?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read: boolean
          recipient_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read?: boolean
          recipient_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read?: boolean
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      move_reflections: {
        Row: {
          candidates: Json
          classification: string | null
          coach_reply: string
          cp_loss: number | null
          created_at: string
          fen_before: string
          game_id: string | null
          id: string
          language: string
          move_san: string
          ply: number
          thought: string
          user_id: string
        }
        Insert: {
          candidates?: Json
          classification?: string | null
          coach_reply: string
          cp_loss?: number | null
          created_at?: string
          fen_before: string
          game_id?: string | null
          id?: string
          language?: string
          move_san: string
          ply: number
          thought: string
          user_id: string
        }
        Update: {
          candidates?: Json
          classification?: string | null
          coach_reply?: string
          cp_loss?: number | null
          created_at?: string
          fen_before?: string
          game_id?: string | null
          id?: string
          language?: string
          move_san?: string
          ply?: number
          thought?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "move_reflections_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "move_reflections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      move_telemetry: {
        Row: {
          created_at: string
          elapsed_ms: number
          game_id: string
          id: number
          ply: number
          user_id: string
        }
        Insert: {
          created_at?: string
          elapsed_ms: number
          game_id: string
          id?: number
          ply: number
          user_id: string
        }
        Update: {
          created_at?: string
          elapsed_ms?: number
          game_id?: string
          id?: number
          ply?: number
          user_id?: string
        }
        Relationships: []
      }
      moves: {
        Row: {
          by_user: string
          created_at: string
          fen: string
          game_id: string
          id: number
          ply: number
          san: string
          uci: string
        }
        Insert: {
          by_user: string
          created_at?: string
          fen: string
          game_id: string
          id?: number
          ply: number
          san: string
          uci: string
        }
        Update: {
          by_user?: string
          created_at?: string
          fen?: string
          game_id?: string
          id?: number
          ply?: number
          san?: string
          uci?: string
        }
        Relationships: [
          {
            foreignKeyName: "moves_by_user_fkey"
            columns: ["by_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moves_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          payload: Json
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          payload?: Json
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          payload?: Json
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          org_owner_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_owner_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_owner_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_tournament_players: {
        Row: {
          created_at: string
          display_name: string
          id: string
          score: number
          tiebreak: number
          tournament_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          score?: number
          tiebreak?: number
          tournament_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          score?: number
          tiebreak?: number
          tournament_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_tournament_players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "org_tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_tournament_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_tournaments: {
        Row: {
          created_at: string
          current_round: number
          format: string
          id: string
          name: string
          owner_id: string
          rounds: number
          starts_at: string | null
          status: string
          time_control: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_round?: number
          format?: string
          id?: string
          name: string
          owner_id: string
          rounds?: number
          starts_at?: string | null
          status?: string
          time_control?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_round?: number
          format?: string
          id?: string
          name?: string
          owner_id?: string
          rounds?: number
          starts_at?: string | null
          status?: string
          time_control?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          event: string
          id: string
          plan_code: string | null
          raw: Json
          reference: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          event: string
          id?: string
          plan_code?: string | null
          raw: Json
          reference?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          event?: string
          id?: string
          plan_code?: string | null
          raw?: Json
          reference?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          banned_at: string | null
          banned_by: string | null
          banned_reason: string | null
          country: string | null
          created_at: string
          draws: number
          email_notify_moves: boolean
          flag_reason: string | null
          flagged_for_review: boolean
          games_played: number
          id: string
          is_guest: boolean
          is_org: boolean
          last_active_at: string
          losses: number
          paystack_customer_code: string | null
          paystack_subscription_code: string | null
          preferences: Json
          rating: number
          referral_code: string | null
          referred_by: string | null
          subscription_renews_at: string | null
          subscription_status: string
          subscription_tier: Database["public"]["Enums"]["subscription_tier_enum"]
          suspended_until: string | null
          username: string
          vacation_days_used: number
          vacation_until: string | null
          vacation_year: number | null
          wins: number
        }
        Insert: {
          banned_at?: string | null
          banned_by?: string | null
          banned_reason?: string | null
          country?: string | null
          created_at?: string
          draws?: number
          email_notify_moves?: boolean
          flag_reason?: string | null
          flagged_for_review?: boolean
          games_played?: number
          id: string
          is_guest?: boolean
          is_org?: boolean
          last_active_at?: string
          losses?: number
          paystack_customer_code?: string | null
          paystack_subscription_code?: string | null
          preferences?: Json
          rating?: number
          referral_code?: string | null
          referred_by?: string | null
          subscription_renews_at?: string | null
          subscription_status?: string
          subscription_tier?: Database["public"]["Enums"]["subscription_tier_enum"]
          suspended_until?: string | null
          username: string
          vacation_days_used?: number
          vacation_until?: string | null
          vacation_year?: number | null
          wins?: number
        }
        Update: {
          banned_at?: string | null
          banned_by?: string | null
          banned_reason?: string | null
          country?: string | null
          created_at?: string
          draws?: number
          email_notify_moves?: boolean
          flag_reason?: string | null
          flagged_for_review?: boolean
          games_played?: number
          id?: string
          is_guest?: boolean
          is_org?: boolean
          last_active_at?: string
          losses?: number
          paystack_customer_code?: string | null
          paystack_subscription_code?: string | null
          preferences?: Json
          rating?: number
          referral_code?: string | null
          referred_by?: string | null
          subscription_renews_at?: string | null
          subscription_status?: string
          subscription_tier?: Database["public"]["Enums"]["subscription_tier_enum"]
          suspended_until?: string | null
          username?: string
          vacation_days_used?: number
          vacation_until?: string | null
          vacation_year?: number | null
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      puzzle_attempts: {
        Row: {
          correct: boolean
          created_at: string
          id: string
          puzzle_id: string
          user_id: string
        }
        Insert: {
          correct: boolean
          created_at?: string
          id?: string
          puzzle_id: string
          user_id: string
        }
        Update: {
          correct?: boolean
          created_at?: string
          id?: string
          puzzle_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "puzzle_attempts_puzzle_id_fkey"
            columns: ["puzzle_id"]
            isOneToOne: false
            referencedRelation: "puzzles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "puzzle_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      puzzle_ratings: {
        Row: {
          attempts: number
          created_at: string
          id: string
          leitner_box: number
          next_due_at: string
          puzzle_id: string
          solved_at: string | null
          success: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          leitner_box?: number
          next_due_at?: string
          puzzle_id: string
          solved_at?: string | null
          success: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          leitner_box?: number
          next_due_at?: string
          puzzle_id?: string
          solved_at?: string | null
          success?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "puzzle_ratings_puzzle_id_fkey"
            columns: ["puzzle_id"]
            isOneToOne: false
            referencedRelation: "puzzles"
            referencedColumns: ["id"]
          },
        ]
      }
      puzzle_storm_scores: {
        Row: {
          duration_sec: number
          id: string
          mistakes: number
          mode: string
          played_at: string
          score: number
          solved: number
          user_id: string
        }
        Insert: {
          duration_sec?: number
          id?: string
          mistakes?: number
          mode?: string
          played_at?: string
          score?: number
          solved?: number
          user_id: string
        }
        Update: {
          duration_sec?: number
          id?: string
          mistakes?: number
          mode?: string
          played_at?: string
          score?: number
          solved?: number
          user_id?: string
        }
        Relationships: []
      }
      puzzles: {
        Row: {
          approved: boolean
          created_at: string
          creator_id: string | null
          daily_date: string | null
          fen: string
          id: string
          rating: number
          solution: string[]
          source: string | null
          themes: string[]
          updated_at: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          creator_id?: string | null
          daily_date?: string | null
          fen: string
          id?: string
          rating?: number
          solution: string[]
          source?: string | null
          themes?: string[]
          updated_at?: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          creator_id?: string | null
          daily_date?: string | null
          fen?: string
          id?: string
          rating?: number
          solution?: string[]
          source?: string | null
          themes?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          bot_games: number
          draws: number
          games_played: number
          id: string
          losses: number
          rating: number
          time_control: string
          updated_at: string
          user_id: string
          variant: string
          wins: number
        }
        Insert: {
          bot_games?: number
          draws?: number
          games_played?: number
          id?: string
          losses?: number
          rating?: number
          time_control: string
          updated_at?: string
          user_id: string
          variant?: string
          wins?: number
        }
        Update: {
          bot_games?: number
          draws?: number
          games_played?: number
          id?: string
          losses?: number
          rating?: number
          time_control?: string
          updated_at?: string
          user_id?: string
          variant?: string
          wins?: number
        }
        Relationships: []
      }
      referral_events: {
        Row: {
          converted_tier: Database["public"]["Enums"]["subscription_tier_enum"]
          created_at: string
          id: string
          payment_reference: string | null
          referred_id: string
          referrer_id: string
          reward_days: number
        }
        Insert: {
          converted_tier: Database["public"]["Enums"]["subscription_tier_enum"]
          created_at?: string
          id?: string
          payment_reference?: string | null
          referred_id: string
          referrer_id: string
          reward_days: number
        }
        Update: {
          converted_tier?: Database["public"]["Enums"]["subscription_tier_enum"]
          created_at?: string
          id?: string
          payment_reference?: string | null
          referred_id?: string
          referrer_id?: string
          reward_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "referral_events_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_events_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      study_boards: {
        Row: {
          annotations: Json
          collaborators: string[]
          created_at: string
          current_fen: string
          current_pgn: string
          id: string
          owner_id: string
          shapes: Json
          start_fen: string
          start_pgn: string | null
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          annotations?: Json
          collaborators?: string[]
          created_at?: string
          current_fen?: string
          current_pgn?: string
          id?: string
          owner_id: string
          shapes?: Json
          start_fen?: string
          start_pgn?: string | null
          title?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          annotations?: Json
          collaborators?: string[]
          created_at?: string
          current_fen?: string
          current_pgn?: string
          id?: string
          owner_id?: string
          shapes?: Json
          start_fen?: string
          start_pgn?: string | null
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      study_chat: {
        Row: {
          board_id: string
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          board_id: string
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          board_id?: string
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_chat_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "study_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      study_snapshots: {
        Row: {
          board_id: string
          created_at: string
          created_by: string
          data: Json
          id: string
          name: string
        }
        Insert: {
          board_id: string
          created_at?: string
          created_by: string
          data?: Json
          id?: string
          name: string
        }
        Update: {
          board_id?: string
          created_at?: string
          created_by?: string
          data?: Json
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_snapshots_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "study_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_chat: {
        Row: {
          content: string
          created_at: string
          id: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          tournament_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_chat_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_chat_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_games: {
        Row: {
          black_id: string | null
          created_at: string
          game_id: string | null
          id: string
          recorded: boolean
          result: string | null
          round: number
          tournament_id: string
          white_id: string | null
        }
        Insert: {
          black_id?: string | null
          created_at?: string
          game_id?: string | null
          id?: string
          recorded?: boolean
          result?: string | null
          round: number
          tournament_id: string
          white_id?: string | null
        }
        Update: {
          black_id?: string | null
          created_at?: string
          game_id?: string | null
          id?: string
          recorded?: boolean
          result?: string | null
          round?: number
          tournament_id?: string
          white_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_games_black_id_fkey"
            columns: ["black_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_games_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_games_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_games_white_id_fkey"
            columns: ["white_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_players: {
        Row: {
          buchholz: number
          created_at: string
          games_played: number
          id: string
          paid: boolean
          paystack_reference: string | null
          rating_at_join: number
          score: number
          seed: number
          status: string
          tournament_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          buchholz?: number
          created_at?: string
          games_played?: number
          id?: string
          paid?: boolean
          paystack_reference?: string | null
          rating_at_join?: number
          score?: number
          seed?: number
          status?: string
          tournament_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          buchholz?: number
          created_at?: string
          games_played?: number
          id?: string
          paid?: boolean
          paystack_reference?: string | null
          rating_at_join?: number
          score?: number
          seed?: number
          status?: string
          tournament_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_rounds: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          pairings: Json
          round: number
          status: string
          tournament_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          pairings?: Json
          round: number
          status?: string
          tournament_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          pairings?: Json
          round?: number
          status?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_rounds_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          club_id: string | null
          created_at: string
          creator_id: string
          current_round: number
          description: string | null
          duration_min: number
          entry_fee_kobo: number
          id: string
          max_players: number
          min_tier: Database["public"]["Enums"]["subscription_tier_enum"]
          name: string
          rated: boolean
          rounds: number
          starts_at: string
          status: string
          time_control: string
          type: Database["public"]["Enums"]["tournament_type_enum"]
          updated_at: string
          variant: string
        }
        Insert: {
          club_id?: string | null
          created_at?: string
          creator_id: string
          current_round?: number
          description?: string | null
          duration_min?: number
          entry_fee_kobo?: number
          id?: string
          max_players?: number
          min_tier?: Database["public"]["Enums"]["subscription_tier_enum"]
          name: string
          rated?: boolean
          rounds?: number
          starts_at?: string
          status?: string
          time_control?: string
          type?: Database["public"]["Enums"]["tournament_type_enum"]
          updated_at?: string
          variant?: string
        }
        Update: {
          club_id?: string | null
          created_at?: string
          creator_id?: string
          current_round?: number
          description?: string | null
          duration_min?: number
          entry_fee_kobo?: number
          id?: string
          max_players?: number
          min_tier?: Database["public"]["Enums"]["subscription_tier_enum"]
          name?: string
          rated?: boolean
          rounds?: number
          starts_at?: string
          status?: string
          time_control?: string
          type?: Database["public"]["Enums"]["tournament_type_enum"]
          updated_at?: string
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_club_fk"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      tv_commentary: {
        Row: {
          author_id: string
          content: string
          created_at: string
          game_id: string | null
          id: string
          ply: number | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          game_id?: string | null
          id?: string
          ply?: number | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          game_id?: string | null
          id?: string
          ply?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tv_commentary_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tv_commentary_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      tv_commentators: {
        Row: {
          added_by: string | null
          created_at: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tv_commentators_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tv_commentators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_slug: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_slug: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_slug?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_slug_fkey"
            columns: ["achievement_slug"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_endgame_progress: {
        Row: {
          attempts: number
          best_move_count: number | null
          completed: boolean
          created_at: string
          endgame_id: string
          id: string
          last_practiced_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          best_move_count?: number | null
          completed?: boolean
          created_at?: string
          endgame_id: string
          id?: string
          last_practiced_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          best_move_count?: number | null
          completed?: boolean
          created_at?: string
          endgame_id?: string
          id?: string
          last_practiced_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_opening_progress: {
        Row: {
          attempts: number
          correct: number
          created_at: string
          eco: string
          id: string
          last_practiced_at: string | null
          mastered_depth: number
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          correct?: number
          created_at?: string
          eco: string
          id?: string
          last_practiced_at?: string | null
          mastered_depth?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          correct?: number
          created_at?: string
          eco?: string
          id?: string
          last_practiced_at?: string | null
          mastered_depth?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_puzzle_stats: {
        Row: {
          best_streak: number
          current_streak: number
          failed_count: number
          last_solved_date: string | null
          rating: number
          solved_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          best_streak?: number
          current_streak?: number
          failed_count?: number
          last_solved_date?: string | null
          rating?: number
          solved_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          best_streak?: number
          current_streak?: number
          failed_count?: number
          last_solved_date?: string | null
          rating?: number
          solved_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_repertoire: {
        Row: {
          color: string
          created_at: string
          eco: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string
          eco: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          eco?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_tutorial_progress: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          step_index: number
          tutorial_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          step_index?: number
          tutorial_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          step_index?: number
          tutorial_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_video_progress: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          last_watched_at: string
          position_sec: number
          updated_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          last_watched_at?: string
          position_sec?: number
          updated_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          last_watched_at?: string
          position_sec?: number
          updated_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_video_progress_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "video_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      video_lessons: {
        Row: {
          category: string
          created_at: string
          description: string | null
          difficulty: string
          duration_sec: number
          external_id: string | null
          id: string
          instructor: string | null
          is_premium: boolean
          published: boolean
          sort_order: number
          source: Database["public"]["Enums"]["video_source_enum"]
          storage_path: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          difficulty?: string
          duration_sec?: number
          external_id?: string | null
          id?: string
          instructor?: string | null
          is_premium?: boolean
          published?: boolean
          sort_order?: number
          source: Database["public"]["Enums"]["video_source_enum"]
          storage_path?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          difficulty?: string
          duration_sec?: number
          external_id?: string | null
          id?: string
          instructor?: string | null
          is_premium?: boolean
          published?: boolean
          sort_order?: number
          source?: Database["public"]["Enums"]["video_source_enum"]
          storage_path?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      weakness_reports: {
        Row: {
          capture_heatmap: Json
          computed_at: string
          created_at: string
          games_analyzed: number
          id: string
          opening_gaps: Json
          phase_errors: Json
          piece_blunders: Json
          suggestions: Json
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          capture_heatmap?: Json
          computed_at?: string
          created_at?: string
          games_analyzed?: number
          id?: string
          opening_gaps?: Json
          phase_errors?: Json
          piece_blunders?: Json
          suggestions?: Json
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          capture_heatmap?: Json
          computed_at?: string
          created_at?: string
          games_analyzed?: number
          id?: string
          opening_gaps?: Json
          phase_errors?: Json
          piece_blunders?: Json
          suggestions?: Json
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          attempt: number
          created_at: string
          delivered_at: string | null
          error: string | null
          event: string
          id: string
          next_retry_at: string | null
          payload: Json
          response_status: number | null
          status: string
          webhook_id: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          event: string
          id?: string
          next_retry_at?: string | null
          payload?: Json
          response_status?: number | null
          status?: string
          webhook_id: string
        }
        Update: {
          attempt?: number
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          event?: string
          id?: string
          next_retry_at?: string | null
          payload?: Json
          response_status?: number | null
          status?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "api_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_elo: {
        Args: {
          p_black: string
          p_game_id?: string
          p_result: string
          p_time_control?: string
          p_variant?: string
          p_white: string
        }
        Returns: undefined
      }
      article_bump_views: { Args: { p_slug: string }; Returns: undefined }
      can_edit_study: {
        Args: { _board_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_study: {
        Args: { _board_id: string; _user_id: string }
        Returns: boolean
      }
      current_admin_role: {
        Args: never
        Returns: Database["public"]["Enums"]["admin_role_enum"]
      }
      find_or_join_match: {
        Args: {
          p_rating_window?: number
          p_region?: string
          p_start_fen?: string
          p_time_control: string
          p_variant?: string
        }
        Returns: string
      }
      forum_bump_views: { Args: { p_thread: string }; Returns: undefined }
      free_daily_puzzle_limit: { Args: never; Returns: number }
      is_admin: { Args: { min_role?: string }; Returns: boolean }
      is_club_admin: {
        Args: { _club_id: string; _user_id: string }
        Returns: boolean
      }
      is_club_member: {
        Args: { _club_id: string; _user_id: string }
        Returns: boolean
      }
      leaderboard: {
        Args: {
          p_country?: string
          p_friends_of?: string
          p_limit?: number
          p_month?: boolean
          p_offset?: number
          p_only?: string
          p_tcs: string[]
          p_variant?: string
        }
        Returns: {
          country: string
          draws: number
          games: number
          games_month: number
          last_active_at: string
          losses: number
          rank: number
          rating: number
          total: number
          user_id: string
          username: string
          wins: number
        }[]
      }
      puzzles_attempted_today: { Args: { p_user: string }; Returns: number }
      record_bot_game: {
        Args: { p_time_control: string; p_variant?: string }
        Returns: undefined
      }
      submit_puzzle_attempt: {
        Args: { p_puzzle_id: string; p_success: boolean }
        Returns: Json
      }
    }
    Enums: {
      admin_role_enum: "super_admin" | "admin" | "moderator" | "support"
      friend_status_enum: "pending" | "accepted" | "blocked"
      subscription_tier_enum: "free" | "plus" | "gold"
      tournament_type_enum: "swiss" | "arena" | "round_robin" | "knockout"
      video_source_enum: "youtube" | "vimeo" | "cloud"
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
      admin_role_enum: ["super_admin", "admin", "moderator", "support"],
      friend_status_enum: ["pending", "accepted", "blocked"],
      subscription_tier_enum: ["free", "plus", "gold"],
      tournament_type_enum: ["swiss", "arena", "round_robin", "knockout"],
      video_source_enum: ["youtube", "vimeo", "cloud"],
    },
  },
} as const
