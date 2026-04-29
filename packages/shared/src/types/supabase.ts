export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      admin_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          performed_by: string
          target_id: string
          target_table: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          performed_by?: string
          target_id: string
          target_table: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          performed_by?: string
          target_id?: string
          target_table?: string
        }
        Relationships: []
      }
      ai_companion_mentions: {
        Row: {
          created_at: string
          crisis_detected: boolean
          id: string
          reply_message_id: string | null
          room_id: string
          suppressed: boolean
          trigger_message_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          crisis_detected?: boolean
          id?: string
          reply_message_id?: string | null
          room_id: string
          suppressed?: boolean
          trigger_message_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          crisis_detected?: boolean
          id?: string
          reply_message_id?: string | null
          room_id?: string
          suppressed?: boolean
          trigger_message_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_companion_mentions_reply_message_id_fkey"
            columns: ["reply_message_id"]
            isOneToOne: false
            referencedRelation: "room_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_companion_mentions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_companion_mentions_trigger_message_id_fkey"
            columns: ["trigger_message_id"]
            isOneToOne: false
            referencedRelation: "room_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          context_snapshot: Json | null
          created_at: string | null
          id: string
          messages: Json
          skill_type: string
          specialist_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          context_snapshot?: Json | null
          created_at?: string | null
          id?: string
          messages?: Json
          skill_type: string
          specialist_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          context_snapshot?: Json | null
          created_at?: string | null
          id?: string
          messages?: Json
          skill_type?: string
          specialist_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialist_admin_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          amount_cents: number | null
          appointment_at: string
          created_at: string | null
          duration_min: number | null
          external_id: string | null
          id: string
          is_telehealth: boolean | null
          notes: string | null
          service_type: string | null
          source: string
          specialist_id: string
          status: string
          stripe_payment_intent_id: string | null
          telehealth_link: string | null
          twilio_reminder_sent: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_cents?: number | null
          appointment_at: string
          created_at?: string | null
          duration_min?: number | null
          external_id?: string | null
          id?: string
          is_telehealth?: boolean | null
          notes?: string | null
          service_type?: string | null
          source: string
          specialist_id: string
          status?: string
          stripe_payment_intent_id?: string | null
          telehealth_link?: string | null
          twilio_reminder_sent?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number | null
          appointment_at?: string
          created_at?: string | null
          duration_min?: number | null
          external_id?: string | null
          id?: string
          is_telehealth?: boolean | null
          notes?: string | null
          service_type?: string | null
          source?: string
          specialist_id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          telehealth_link?: string | null
          twilio_reminder_sent?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialist_admin_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      baby_profiles: {
        Row: {
          baby_name: string | null
          birth_weight_grams: number | null
          corrected_age_offset_days: number | null
          created_at: string
          date_of_birth: string
          due_date: string | null
          feeding_method: string | null
          gender: string | null
          id: string
          is_premature: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          baby_name?: string | null
          birth_weight_grams?: number | null
          corrected_age_offset_days?: number | null
          created_at?: string
          date_of_birth: string
          due_date?: string | null
          feeding_method?: string | null
          gender?: string | null
          id?: string
          is_premature?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          baby_name?: string | null
          birth_weight_grams?: number | null
          corrected_age_offset_days?: number | null
          created_at?: string
          date_of_birth?: string
          due_date?: string | null
          feeding_method?: string | null
          gender?: string | null
          id?: string
          is_premature?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      brand_deals: {
        Row: {
          affiliate_advertiser_id: string | null
          affiliate_network: string
          affiliate_url_template: string | null
          brand_logo_url: string | null
          brand_name: string
          category: string
          created_at: string
          deal_type: string
          direct_url: string | null
          disclosure_required: boolean
          discount_code: string | null
          discount_label: string | null
          eligibility_age_tags: string[]
          eligibility_countries: string[]
          ends_at: string | null
          hero_image_url: string | null
          id: string
          is_partner: boolean
          long_description: string
          redemption_method: string
          short_description: string
          sort_priority: number
          starts_at: string | null
          status: string
          terms_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          affiliate_advertiser_id?: string | null
          affiliate_network?: string
          affiliate_url_template?: string | null
          brand_logo_url?: string | null
          brand_name: string
          category: string
          created_at?: string
          deal_type: string
          direct_url?: string | null
          disclosure_required?: boolean
          discount_code?: string | null
          discount_label?: string | null
          eligibility_age_tags?: string[]
          eligibility_countries?: string[]
          ends_at?: string | null
          hero_image_url?: string | null
          id?: string
          is_partner?: boolean
          long_description: string
          redemption_method: string
          short_description: string
          sort_priority?: number
          starts_at?: string | null
          status?: string
          terms_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          affiliate_advertiser_id?: string | null
          affiliate_network?: string
          affiliate_url_template?: string | null
          brand_logo_url?: string | null
          brand_name?: string
          category?: string
          created_at?: string
          deal_type?: string
          direct_url?: string | null
          disclosure_required?: boolean
          discount_code?: string | null
          discount_label?: string | null
          eligibility_age_tags?: string[]
          eligibility_countries?: string[]
          ends_at?: string | null
          hero_image_url?: string | null
          id?: string
          is_partner?: boolean
          long_description?: string
          redemption_method?: string
          short_description?: string
          sort_priority?: number
          starts_at?: string | null
          status?: string
          terms_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cpsc_recall_cache: {
        Row: {
          brand_lc: string | null
          cached_at: string
          cpsc_categories: string[]
          description: string | null
          hazard: string | null
          product_name_lc: string | null
          recall_date: string | null
          recall_number: string
          recall_url: string | null
          remedy: string | null
          title: string
          upcs: string[]
          updated_at: string
        }
        Insert: {
          brand_lc?: string | null
          cached_at?: string
          cpsc_categories?: string[]
          description?: string | null
          hazard?: string | null
          product_name_lc?: string | null
          recall_date?: string | null
          recall_number: string
          recall_url?: string | null
          remedy?: string | null
          title: string
          upcs?: string[]
          updated_at?: string
        }
        Update: {
          brand_lc?: string | null
          cached_at?: string
          cpsc_categories?: string[]
          description?: string | null
          hazard?: string | null
          product_name_lc?: string | null
          recall_date?: string | null
          recall_number?: string
          recall_url?: string | null
          remedy?: string | null
          title?: string
          upcs?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      crisis_flags: {
        Row: {
          ai_assessment: string | null
          created_at: string
          flagged_user_id: string | null
          id: string
          message_id: string
          moderator_id: string | null
          moderator_notes: string | null
          resolved_at: string | null
          room_id: string
          severity: string
          sms_sent: boolean
          sms_sent_at: string | null
          status: string
          trigger_phrases: string[] | null
        }
        Insert: {
          ai_assessment?: string | null
          created_at?: string
          flagged_user_id?: string | null
          id?: string
          message_id: string
          moderator_id?: string | null
          moderator_notes?: string | null
          resolved_at?: string | null
          room_id: string
          severity: string
          sms_sent?: boolean
          sms_sent_at?: string | null
          status?: string
          trigger_phrases?: string[] | null
        }
        Update: {
          ai_assessment?: string | null
          created_at?: string
          flagged_user_id?: string | null
          id?: string
          message_id?: string
          moderator_id?: string | null
          moderator_notes?: string | null
          resolved_at?: string | null
          room_id?: string
          severity?: string
          sms_sent?: boolean
          sms_sent_at?: string | null
          status?: string
          trigger_phrases?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "crisis_flags_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "room_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crisis_flags_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_checkins: {
        Row: {
          ai_reply: string | null
          ai_reply_model: string | null
          checkin_date: string
          created_at: string
          crisis_flagged: boolean
          crisis_resources: Json | null
          energy_score: number | null
          id: string
          mood_score: number
          updated_at: string
          user_id: string
          user_response: string | null
        }
        Insert: {
          ai_reply?: string | null
          ai_reply_model?: string | null
          checkin_date?: string
          created_at?: string
          crisis_flagged?: boolean
          crisis_resources?: Json | null
          energy_score?: number | null
          id?: string
          mood_score: number
          updated_at?: string
          user_id: string
          user_response?: string | null
        }
        Update: {
          ai_reply?: string | null
          ai_reply_model?: string | null
          checkin_date?: string
          created_at?: string
          crisis_flagged?: boolean
          crisis_resources?: Json | null
          energy_score?: number | null
          id?: string
          mood_score?: number
          updated_at?: string
          user_id?: string
          user_response?: string | null
        }
        Relationships: []
      }
      deal_claims: {
        Row: {
          claimed_at: string
          click_url: string | null
          converted_amount_cents: number | null
          deal_id: string
          id: string
          network_order_id: string | null
          revealed_code: string | null
          status: string
          subid: string
          user_id: string
          webhook_confirmed_at: string | null
        }
        Insert: {
          claimed_at?: string
          click_url?: string | null
          converted_amount_cents?: number | null
          deal_id: string
          id?: string
          network_order_id?: string | null
          revealed_code?: string | null
          status?: string
          subid: string
          user_id: string
          webhook_confirmed_at?: string | null
        }
        Update: {
          claimed_at?: string
          click_url?: string | null
          converted_amount_cents?: number | null
          deal_id?: string
          id?: string
          network_order_id?: string | null
          revealed_code?: string | null
          status?: string
          subid?: string
          user_id?: string
          webhook_confirmed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_claims_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "brand_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvps: {
        Row: {
          added_to_calendar: boolean
          calendar_event_id: string | null
          cancelled_at: string | null
          event_id: string
          id: string
          rsvpd_at: string
          status: string
          user_id: string
        }
        Insert: {
          added_to_calendar?: boolean
          calendar_event_id?: string | null
          cancelled_at?: string | null
          event_id: string
          id?: string
          rsvpd_at?: string
          status?: string
          user_id: string
        }
        Update: {
          added_to_calendar?: boolean
          calendar_event_id?: string | null
          cancelled_at?: string | null
          event_id?: string
          id?: string
          rsvpd_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          address: string | null
          age_tags: string[]
          capacity: number | null
          city: string | null
          cover_image_url: string | null
          created_at: string
          description: string
          ends_at: string
          host_avatar_url: string | null
          host_name: string
          id: string
          is_free: boolean
          is_partner: boolean
          is_third_party: boolean
          location: unknown
          platform: string | null
          price_cents: number | null
          starts_at: string
          status: string
          stream_url: string | null
          timezone: string
          title: string
          type: string
          updated_at: string
          venue_name: string | null
        }
        Insert: {
          address?: string | null
          age_tags?: string[]
          capacity?: number | null
          city?: string | null
          cover_image_url?: string | null
          created_at?: string
          description: string
          ends_at: string
          host_avatar_url?: string | null
          host_name: string
          id?: string
          is_free?: boolean
          is_partner?: boolean
          is_third_party?: boolean
          location?: unknown
          platform?: string | null
          price_cents?: number | null
          starts_at: string
          status?: string
          stream_url?: string | null
          timezone?: string
          title: string
          type: string
          updated_at?: string
          venue_name?: string | null
        }
        Update: {
          address?: string | null
          age_tags?: string[]
          capacity?: number | null
          city?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string
          ends_at?: string
          host_avatar_url?: string | null
          host_name?: string
          id?: string
          is_free?: boolean
          is_partner?: boolean
          is_third_party?: boolean
          location?: unknown
          platform?: string | null
          price_cents?: number | null
          starts_at?: string
          status?: string
          stream_url?: string | null
          timezone?: string
          title?: string
          type?: string
          updated_at?: string
          venue_name?: string | null
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string | null
          id: string
          specialist_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          specialist_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          specialist_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialist_admin_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          description: string | null
          enabled: boolean
          key: string
          rollout_percent: number
          updated_at: string
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          key: string
          rollout_percent?: number
          updated_at?: string
        }
        Update: {
          description?: string | null
          enabled?: boolean
          key?: string
          rollout_percent?: number
          updated_at?: string
        }
        Relationships: []
      }
      gear_analytics_events: {
        Row: {
          event_name: string
          id: number
          occurred_at: string
          properties: Json | null
          user_id: string | null
        }
        Insert: {
          event_name: string
          id?: number
          occurred_at?: string
          properties?: Json | null
          user_id?: string | null
        }
        Update: {
          event_name?: string
          id?: number
          occurred_at?: string
          properties?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      gear_legal_acceptances: {
        Row: {
          accepted_at: string
          context: Json | null
          document_key: string
          document_version: string
          id: string
          ip_address: unknown
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          context?: Json | null
          document_key: string
          document_version: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          context?: Json | null
          document_key?: string
          document_version?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      gear_listing_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          listing_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          listing_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          listing_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "gear_listing_images_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "gear_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      gear_listing_reports: {
        Row: {
          created_at: string
          description: string
          id: string
          listing_id: string
          reason_code: string
          reporter_user_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          listing_id: string
          reason_code: string
          reporter_user_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          listing_id?: string
          reason_code?: string
          reporter_user_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gear_listing_reports_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "gear_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      gear_listings: {
        Row: {
          age_tags: string[]
          brand: string | null
          category: string
          condition: string
          cpsc_checked_at: string | null
          cpsc_recall_id: string | null
          cpsc_recall_status: string | null
          cpsc_recall_url: string | null
          created_at: string
          currency: string
          description: string
          id: string
          is_cpsc_checked: boolean
          is_free: boolean
          location: unknown
          model: string | null
          pickup_city: string
          pickup_zip: string | null
          price_cents: number
          removed_reason: string | null
          save_count: number
          seller_id: string
          status: string
          subcategory: string | null
          title: string
          upc: string | null
          updated_at: string
          view_count: number
          vision_confidence: number | null
          year_manufactured: number | null
        }
        Insert: {
          age_tags?: string[]
          brand?: string | null
          category: string
          condition: string
          cpsc_checked_at?: string | null
          cpsc_recall_id?: string | null
          cpsc_recall_status?: string | null
          cpsc_recall_url?: string | null
          created_at?: string
          currency?: string
          description: string
          id?: string
          is_cpsc_checked?: boolean
          is_free?: boolean
          location: unknown
          model?: string | null
          pickup_city: string
          pickup_zip?: string | null
          price_cents: number
          removed_reason?: string | null
          save_count?: number
          seller_id: string
          status?: string
          subcategory?: string | null
          title: string
          upc?: string | null
          updated_at?: string
          view_count?: number
          vision_confidence?: number | null
          year_manufactured?: number | null
        }
        Update: {
          age_tags?: string[]
          brand?: string | null
          category?: string
          condition?: string
          cpsc_checked_at?: string | null
          cpsc_recall_id?: string | null
          cpsc_recall_status?: string | null
          cpsc_recall_url?: string | null
          created_at?: string
          currency?: string
          description?: string
          id?: string
          is_cpsc_checked?: boolean
          is_free?: boolean
          location?: unknown
          model?: string | null
          pickup_city?: string
          pickup_zip?: string | null
          price_cents?: number
          removed_reason?: string | null
          save_count?: number
          seller_id?: string
          status?: string
          subcategory?: string | null
          title?: string
          upc?: string | null
          updated_at?: string
          view_count?: number
          vision_confidence?: number | null
          year_manufactured?: number | null
        }
        Relationships: []
      }
      gear_message_threads: {
        Row: {
          buyer_user_id: string
          created_at: string
          id: string
          last_message_at: string | null
          listing_id: string
          safe_meeting_ack_at: string | null
          seller_user_id: string
        }
        Insert: {
          buyer_user_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          listing_id: string
          safe_meeting_ack_at?: string | null
          seller_user_id: string
        }
        Update: {
          buyer_user_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          listing_id?: string
          safe_meeting_ack_at?: string | null
          seller_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gear_message_threads_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "gear_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      gear_messages: {
        Row: {
          body: string
          id: string
          is_read: boolean
          sender_id: string
          sent_at: string
          thread_id: string
        }
        Insert: {
          body: string
          id?: string
          is_read?: boolean
          sender_id: string
          sent_at?: string
          thread_id: string
        }
        Update: {
          body?: string
          id?: string
          is_read?: boolean
          sender_id?: string
          sent_at?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gear_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "gear_message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      gear_saved_listings: {
        Row: {
          listing_id: string
          saved_at: string
          user_id: string
        }
        Insert: {
          listing_id: string
          saved_at?: string
          user_id: string
        }
        Update: {
          listing_id?: string
          saved_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gear_saved_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "gear_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      home_feed_cache: {
        Row: {
          cards: Json
          expires_at: string
          generated_at: string
          generator_version: string
          model_used: string | null
          user_id: string
        }
        Insert: {
          cards?: Json
          expires_at?: string
          generated_at?: string
          generator_version?: string
          model_used?: string | null
          user_id: string
        }
        Update: {
          cards?: Json
          expires_at?: string
          generated_at?: string
          generator_version?: string
          model_used?: string | null
          user_id?: string
        }
        Relationships: []
      }
      icebreaker_suggestions: {
        Row: {
          created_at: string
          dismissed_at: string | null
          id: string
          room_id: string
          suggestion: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          dismissed_at?: string | null
          id?: string
          room_id: string
          suggestion: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          dismissed_at?: string | null
          id?: string
          room_id?: string
          suggestion?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "icebreaker_suggestions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string | null
          id: string
          read_at: string | null
          sender_id: string
          specialist_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          read_at?: string | null
          sender_id: string
          specialist_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          read_at?: string | null
          sender_id?: string
          specialist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialist_admin_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialists"
            referencedColumns: ["id"]
          },
        ]
      }
      milestone_library: {
        Row: {
          ai_summary_cache: string | null
          ai_summary_cached_at: string | null
          category: string
          description: string
          feed_interval_hours_max: number | null
          feed_interval_hours_min: number | null
          hero_emoji: string | null
          id: string
          sleep_hours_max: number | null
          sleep_hours_min: number | null
          title: string
          week_number: number
        }
        Insert: {
          ai_summary_cache?: string | null
          ai_summary_cached_at?: string | null
          category: string
          description: string
          feed_interval_hours_max?: number | null
          feed_interval_hours_min?: number | null
          hero_emoji?: string | null
          id?: string
          sleep_hours_max?: number | null
          sleep_hours_min?: number | null
          title: string
          week_number: number
        }
        Update: {
          ai_summary_cache?: string | null
          ai_summary_cached_at?: string | null
          category?: string
          description?: string
          feed_interval_hours_max?: number | null
          feed_interval_hours_min?: number | null
          hero_emoji?: string | null
          id?: string
          sleep_hours_max?: number | null
          sleep_hours_min?: number | null
          title?: string
          week_number?: number
        }
        Relationships: []
      }
      milk_analytics_events: {
        Row: {
          event_name: string
          id: number
          occurred_at: string
          properties: Json | null
          user_id: string | null
        }
        Insert: {
          event_name: string
          id?: number
          occurred_at?: string
          properties?: Json | null
          user_id?: string | null
        }
        Update: {
          event_name?: string
          id?: number
          occurred_at?: string
          properties?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      milk_disputes: {
        Row: {
          created_at: string
          description: string
          evidence_urls: string[] | null
          id: string
          opened_by_role: string
          opened_by_user_id: string
          reason_code: string
          refund_amount_cents: number | null
          resolution_notes: string | null
          resolved_at: string | null
          status: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          evidence_urls?: string[] | null
          id?: string
          opened_by_role: string
          opened_by_user_id: string
          reason_code: string
          refund_amount_cents?: number | null
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          evidence_urls?: string[] | null
          id?: string
          opened_by_role?: string
          opened_by_user_id?: string
          reason_code?: string
          refund_amount_cents?: number | null
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milk_disputes_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "milk_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      milk_donor_diet_flags: {
        Row: {
          donor_profile_id: string
          flag_key: string
          id: string
          is_active: boolean
        }
        Insert: {
          donor_profile_id: string
          flag_key: string
          id?: string
          is_active?: boolean
        }
        Update: {
          donor_profile_id?: string
          flag_key?: string
          id?: string
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "milk_donor_diet_flags_donor_profile_id_fkey"
            columns: ["donor_profile_id"]
            isOneToOne: false
            referencedRelation: "milk_donor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      milk_donor_medications: {
        Row: {
          donor_profile_id: string
          dosage: string | null
          frequency: string | null
          id: string
          is_current: boolean
          medication_name: string
          notes: string | null
        }
        Insert: {
          donor_profile_id: string
          dosage?: string | null
          frequency?: string | null
          id?: string
          is_current?: boolean
          medication_name: string
          notes?: string | null
        }
        Update: {
          donor_profile_id?: string
          dosage?: string | null
          frequency?: string | null
          id?: string
          is_current?: boolean
          medication_name?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milk_donor_medications_donor_profile_id_fkey"
            columns: ["donor_profile_id"]
            isOneToOne: false
            referencedRelation: "milk_donor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      milk_donor_profiles: {
        Row: {
          address_line: string | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          is_verified: boolean
          lat: number | null
          lng: number | null
          neighborhood: string | null
          phone: string | null
          price_per_oz: number
          rating_avg: number | null
          review_count: number | null
          state: string | null
          stripe_account_id: string | null
          stripe_onboarding_complete: boolean | null
          supply_oz_available: number
          updated_at: string
          user_id: string
          zip_code: string | null
        }
        Insert: {
          address_line?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          is_verified?: boolean
          lat?: number | null
          lng?: number | null
          neighborhood?: string | null
          phone?: string | null
          price_per_oz?: number
          rating_avg?: number | null
          review_count?: number | null
          state?: string | null
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean | null
          supply_oz_available?: number
          updated_at?: string
          user_id: string
          zip_code?: string | null
        }
        Update: {
          address_line?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          is_verified?: boolean
          lat?: number | null
          lng?: number | null
          neighborhood?: string | null
          phone?: string | null
          price_per_oz?: number
          rating_avg?: number | null
          review_count?: number | null
          state?: string | null
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean | null
          supply_oz_available?: number
          updated_at?: string
          user_id?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      milk_legal_acceptances: {
        Row: {
          accepted_at: string
          context: Json | null
          document_key: string
          document_version: string
          id: string
          ip_address: unknown
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          context?: Json | null
          document_key: string
          document_version: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          context?: Json | null
          document_key?: string
          document_version?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      milk_listings: {
        Row: {
          created_at: string
          donor_profile_id: string
          id: string
          min_order_oz: number
          notes: string | null
          oz_available: number
          pickup_available: boolean
          price_per_oz: number
          shipping_available: boolean
          shipping_price: number | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          donor_profile_id: string
          id?: string
          min_order_oz?: number
          notes?: string | null
          oz_available: number
          pickup_available?: boolean
          price_per_oz: number
          shipping_available?: boolean
          shipping_price?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          donor_profile_id?: string
          id?: string
          min_order_oz?: number
          notes?: string | null
          oz_available?: number
          pickup_available?: boolean
          price_per_oz?: number
          shipping_available?: boolean
          shipping_price?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milk_listings_donor_profile_id_fkey"
            columns: ["donor_profile_id"]
            isOneToOne: false
            referencedRelation: "milk_donor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      milk_message_threads: {
        Row: {
          donor_profile_id: string
          id: string
          last_message_at: string | null
          listing_id: string | null
          recipient_user_id: string
        }
        Insert: {
          donor_profile_id: string
          id?: string
          last_message_at?: string | null
          listing_id?: string | null
          recipient_user_id: string
        }
        Update: {
          donor_profile_id?: string
          id?: string
          last_message_at?: string | null
          listing_id?: string | null
          recipient_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "milk_message_threads_donor_profile_id_fkey"
            columns: ["donor_profile_id"]
            isOneToOne: false
            referencedRelation: "milk_donor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milk_message_threads_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "milk_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      milk_messages: {
        Row: {
          body: string
          id: string
          is_read: boolean
          sender_id: string
          sent_at: string
          thread_id: string
        }
        Insert: {
          body: string
          id?: string
          is_read?: boolean
          sender_id: string
          sent_at?: string
          thread_id: string
        }
        Update: {
          body?: string
          id?: string
          is_read?: boolean
          sender_id?: string
          sent_at?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "milk_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "milk_message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      milk_questionnaire_responses: {
        Row: {
          answer_value: string
          answered_at: string
          donor_profile_id: string
          id: string
          question_key: string
          question_text: string
        }
        Insert: {
          answer_value: string
          answered_at?: string
          donor_profile_id: string
          id?: string
          question_key: string
          question_text: string
        }
        Update: {
          answer_value?: string
          answered_at?: string
          donor_profile_id?: string
          id?: string
          question_key?: string
          question_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "milk_questionnaire_responses_donor_profile_id_fkey"
            columns: ["donor_profile_id"]
            isOneToOne: false
            referencedRelation: "milk_donor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      milk_reviews: {
        Row: {
          body: string | null
          created_at: string
          donor_profile_id: string
          id: string
          rating: number
          response_body: string | null
          reviewer_user_id: string
          transaction_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          donor_profile_id: string
          id?: string
          rating: number
          response_body?: string | null
          reviewer_user_id: string
          transaction_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          donor_profile_id?: string
          id?: string
          rating?: number
          response_body?: string | null
          reviewer_user_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "milk_reviews_donor_profile_id_fkey"
            columns: ["donor_profile_id"]
            isOneToOne: false
            referencedRelation: "milk_donor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milk_reviews_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "milk_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      milk_saved_donors: {
        Row: {
          donor_profile_id: string
          user_id: string
        }
        Insert: {
          donor_profile_id: string
          user_id: string
        }
        Update: {
          donor_profile_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "milk_saved_donors_donor_profile_id_fkey"
            columns: ["donor_profile_id"]
            isOneToOne: false
            referencedRelation: "milk_donor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      milk_shipping_labels: {
        Row: {
          carrier: string | null
          created_at: string
          id: string
          insurance_cents: number | null
          label_url: string | null
          rate_cents: number | null
          service_level: string | null
          shippo_transaction_id: string
          status: string
          tracking_number: string | null
          tracking_url: string | null
          transaction_id: string
          updated_at: string
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          id?: string
          insurance_cents?: number | null
          label_url?: string | null
          rate_cents?: number | null
          service_level?: string | null
          shippo_transaction_id: string
          status?: string
          tracking_number?: string | null
          tracking_url?: string | null
          transaction_id: string
          updated_at?: string
        }
        Update: {
          carrier?: string | null
          created_at?: string
          id?: string
          insurance_cents?: number | null
          label_url?: string | null
          rate_cents?: number | null
          service_level?: string | null
          shippo_transaction_id?: string
          status?: string
          tracking_number?: string | null
          tracking_url?: string | null
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milk_shipping_labels_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "milk_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      milk_transactions: {
        Row: {
          address_revealed_at: string | null
          created_at: string
          donor_notified_at: string | null
          donor_payout_cents: number
          donor_profile_id: string
          fulfillment_method: string
          id: string
          listing_id: string
          oz_purchased: number
          pickup_confirmed_at: string | null
          platform_fee_cents: number
          price_per_oz: number
          recipient_address_line: string | null
          recipient_city: string | null
          recipient_notes: string | null
          recipient_notified_at: string | null
          recipient_state: string | null
          recipient_user_id: string
          recipient_zip: string | null
          status: string
          stripe_payment_intent: string
          stripe_transfer_id: string | null
          subtotal_cents: number
          total_charged_cents: number
          updated_at: string
        }
        Insert: {
          address_revealed_at?: string | null
          created_at?: string
          donor_notified_at?: string | null
          donor_payout_cents: number
          donor_profile_id: string
          fulfillment_method: string
          id?: string
          listing_id: string
          oz_purchased: number
          pickup_confirmed_at?: string | null
          platform_fee_cents: number
          price_per_oz: number
          recipient_address_line?: string | null
          recipient_city?: string | null
          recipient_notes?: string | null
          recipient_notified_at?: string | null
          recipient_state?: string | null
          recipient_user_id: string
          recipient_zip?: string | null
          status?: string
          stripe_payment_intent: string
          stripe_transfer_id?: string | null
          subtotal_cents: number
          total_charged_cents: number
          updated_at?: string
        }
        Update: {
          address_revealed_at?: string | null
          created_at?: string
          donor_notified_at?: string | null
          donor_payout_cents?: number
          donor_profile_id?: string
          fulfillment_method?: string
          id?: string
          listing_id?: string
          oz_purchased?: number
          pickup_confirmed_at?: string | null
          platform_fee_cents?: number
          price_per_oz?: number
          recipient_address_line?: string | null
          recipient_city?: string | null
          recipient_notes?: string | null
          recipient_notified_at?: string | null
          recipient_state?: string | null
          recipient_user_id?: string
          recipient_zip?: string | null
          status?: string
          stripe_payment_intent?: string
          stripe_transfer_id?: string | null
          subtotal_cents?: number
          total_charged_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milk_transactions_donor_profile_id_fkey"
            columns: ["donor_profile_id"]
            isOneToOne: false
            referencedRelation: "milk_donor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milk_transactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "milk_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      milk_trust_badges: {
        Row: {
          ai_last_evaluated_at: string | null
          ai_safety_flags: Json | null
          ai_safety_score: number | null
          ai_trust_narrative: string | null
          ai_trust_narrative_cached_at: string | null
          badge_level: string
          bloodwork_linked: boolean
          bloodwork_report_url: string | null
          bloodwork_verified_at: string | null
          created_at: string
          diet_disclosed: boolean
          donor_profile_id: string
          id: string
          medications_disclosed: boolean
          questionnaire_complete: boolean
          questionnaire_completed_at: string | null
          updated_at: string
        }
        Insert: {
          ai_last_evaluated_at?: string | null
          ai_safety_flags?: Json | null
          ai_safety_score?: number | null
          ai_trust_narrative?: string | null
          ai_trust_narrative_cached_at?: string | null
          badge_level?: string
          bloodwork_linked?: boolean
          bloodwork_report_url?: string | null
          bloodwork_verified_at?: string | null
          created_at?: string
          diet_disclosed?: boolean
          donor_profile_id: string
          id?: string
          medications_disclosed?: boolean
          questionnaire_complete?: boolean
          questionnaire_completed_at?: string | null
          updated_at?: string
        }
        Update: {
          ai_last_evaluated_at?: string | null
          ai_safety_flags?: Json | null
          ai_safety_score?: number | null
          ai_trust_narrative?: string | null
          ai_trust_narrative_cached_at?: string | null
          badge_level?: string
          bloodwork_linked?: boolean
          bloodwork_report_url?: string | null
          bloodwork_verified_at?: string | null
          created_at?: string
          diet_disclosed?: boolean
          donor_profile_id?: string
          id?: string
          medications_disclosed?: boolean
          questionnaire_complete?: boolean
          questionnaire_completed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milk_trust_badges_donor_profile_id_fkey"
            columns: ["donor_profile_id"]
            isOneToOne: true
            referencedRelation: "milk_donor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      npi_cache: {
        Row: {
          fetched_at: string | null
          npi_number: string
          raw_response: Json
        }
        Insert: {
          fetched_at?: string | null
          npi_number: string
          raw_response: Json
        }
        Update: {
          fetched_at?: string | null
          npi_number?: string
          raw_response?: Json
        }
        Relationships: []
      }
      pinned_resources: {
        Row: {
          display_order: number
          id: string
          is_active: boolean
          phone_number: string | null
          resource_type: string
          room_id: string
          title: string
          url: string | null
        }
        Insert: {
          display_order?: number
          id?: string
          is_active?: boolean
          phone_number?: string | null
          resource_type: string
          room_id: string
          title: string
          url?: string | null
        }
        Update: {
          display_order?: number
          id?: string
          is_active?: boolean
          phone_number?: string | null
          resource_type?: string
          room_id?: string
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pinned_resources_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          ai_summary: string | null
          body: string | null
          created_at: string | null
          id: string
          rating: number
          specialist_id: string
          user_id: string
          verified_patient: boolean | null
        }
        Insert: {
          ai_summary?: string | null
          body?: string | null
          created_at?: string | null
          id?: string
          rating: number
          specialist_id: string
          user_id: string
          verified_patient?: boolean | null
        }
        Update: {
          ai_summary?: string | null
          body?: string | null
          created_at?: string | null
          id?: string
          rating?: number
          specialist_id?: string
          user_id?: string
          verified_patient?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialist_admin_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      room_events: {
        Row: {
          calendly_event_uri: string | null
          created_at: string
          description: string | null
          ends_at: string
          id: string
          is_cancelled: boolean
          moderator_id: string
          room_id: string
          rsvp_count: number
          starts_at: string
          title: string
        }
        Insert: {
          calendly_event_uri?: string | null
          created_at?: string
          description?: string | null
          ends_at: string
          id?: string
          is_cancelled?: boolean
          moderator_id: string
          room_id: string
          rsvp_count?: number
          starts_at: string
          title: string
        }
        Update: {
          calendly_event_uri?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string
          id?: string
          is_cancelled?: boolean
          moderator_id?: string
          room_id?: string
          rsvp_count?: number
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_events_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "room_moderators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_events_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_match_suggestions: {
        Row: {
          created_at: string
          generator_version: string
          id: string
          primary_room_id: string | null
          reason: string | null
          secondary_room_ids: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          generator_version?: string
          id?: string
          primary_room_id?: string | null
          reason?: string | null
          secondary_room_ids?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          generator_version?: string
          id?: string
          primary_room_id?: string | null
          reason?: string | null
          secondary_room_ids?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_match_suggestions_primary_room_id_fkey"
            columns: ["primary_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_members: {
        Row: {
          id: string
          is_muted: boolean
          joined_at: string
          last_read_at: string
          notif_pref: string
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string
          notif_pref?: string
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string
          notif_pref?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "room_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      room_messages: {
        Row: {
          ai_scan_at: string | null
          ai_scan_status: string
          body: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_deleted: boolean
          message_type: string
          parent_id: string | null
          room_id: string
          sender_anon_id: string | null
          sender_user_id: string | null
        }
        Insert: {
          ai_scan_at?: string | null
          ai_scan_status?: string
          body: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_deleted?: boolean
          message_type?: string
          parent_id?: string | null
          room_id: string
          sender_anon_id?: string | null
          sender_user_id?: string | null
        }
        Update: {
          ai_scan_at?: string | null
          ai_scan_status?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_deleted?: boolean
          message_type?: string
          parent_id?: string | null
          room_id?: string
          sender_anon_id?: string | null
          sender_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "room_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_messages_sender_anon_id_fkey"
            columns: ["sender_anon_id"]
            isOneToOne: false
            referencedRelation: "user_anonymous_identities"
            referencedColumns: ["id"]
          },
        ]
      }
      room_moderators: {
        Row: {
          calendly_event_type_uri: string | null
          credential_label: string | null
          id: string
          is_active: boolean
          role: string
          room_id: string
          user_id: string
        }
        Insert: {
          calendly_event_type_uri?: string | null
          credential_label?: string | null
          id?: string
          is_active?: boolean
          role?: string
          room_id: string
          user_id: string
        }
        Update: {
          calendly_event_type_uri?: string | null
          credential_label?: string | null
          id?: string
          is_active?: boolean
          role?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_moderators_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_presence: {
        Row: {
          last_seen_at: string
          room_id: string
          user_id: string
        }
        Insert: {
          last_seen_at?: string
          room_id: string
          user_id: string
        }
        Update: {
          last_seen_at?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_presence_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_weekly_summaries: {
        Row: {
          created_at: string
          generator_model: string
          id: string
          message_count: number
          period_end: string
          period_start: string
          pushed_at: string | null
          room_id: string
          summary: string
        }
        Insert: {
          created_at?: string
          generator_model?: string
          id?: string
          message_count?: number
          period_end: string
          period_start: string
          pushed_at?: string | null
          room_id: string
          summary: string
        }
        Update: {
          created_at?: string
          generator_model?: string
          id?: string
          message_count?: number
          period_end?: string
          period_start?: string
          pushed_at?: string | null
          room_id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_weekly_summaries_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          anonymous_mode: string
          city: string | null
          color_theme: string
          created_at: string
          description: string
          emoji: string
          id: string
          is_active: boolean
          member_count: number
          name: string
          room_type: string
          slug: string
          stage_week_max: number | null
          stage_week_min: number | null
        }
        Insert: {
          anonymous_mode?: string
          city?: string | null
          color_theme?: string
          created_at?: string
          description: string
          emoji?: string
          id?: string
          is_active?: boolean
          member_count?: number
          name: string
          room_type: string
          slug: string
          stage_week_max?: number | null
          stage_week_min?: number | null
        }
        Update: {
          anonymous_mode?: string
          city?: string | null
          color_theme?: string
          created_at?: string
          description?: string
          emoji?: string
          id?: string
          is_active?: boolean
          member_count?: number
          name?: string
          room_type?: string
          slug?: string
          stage_week_max?: number | null
          stage_week_min?: number | null
        }
        Relationships: []
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      specialist_insurances: {
        Row: {
          id: string
          insurance_name: string
          plan_type: string | null
          specialist_id: string
        }
        Insert: {
          id?: string
          insurance_name: string
          plan_type?: string | null
          specialist_id: string
        }
        Update: {
          id?: string
          insurance_name?: string
          plan_type?: string | null
          specialist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "specialist_insurances_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialist_admin_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specialist_insurances_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialists"
            referencedColumns: ["id"]
          },
        ]
      }
      specialist_languages: {
        Row: {
          id: string
          language_code: string
          specialist_id: string
        }
        Insert: {
          id?: string
          language_code: string
          specialist_id: string
        }
        Update: {
          id?: string
          language_code?: string
          specialist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "specialist_languages_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialist_admin_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specialist_languages_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialists"
            referencedColumns: ["id"]
          },
        ]
      }
      specialist_services: {
        Row: {
          description: string | null
          duration_min: number | null
          id: string
          price_cents: number | null
          service_name: string
          specialist_id: string
        }
        Insert: {
          description?: string | null
          duration_min?: number | null
          id?: string
          price_cents?: number | null
          service_name: string
          specialist_id: string
        }
        Update: {
          description?: string | null
          duration_min?: number | null
          id?: string
          price_cents?: number | null
          service_name?: string
          specialist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "specialist_services_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialist_admin_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specialist_services_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialists"
            referencedColumns: ["id"]
          },
        ]
      }
      specialist_translations: {
        Row: {
          content_hash: string
          created_at: string | null
          field_name: string
          id: string
          language_code: string
          specialist_id: string
          translated_text: string
        }
        Insert: {
          content_hash: string
          created_at?: string | null
          field_name: string
          id?: string
          language_code: string
          specialist_id: string
          translated_text: string
        }
        Update: {
          content_hash?: string
          created_at?: string | null
          field_name?: string
          id?: string
          language_code?: string
          specialist_id?: string
          translated_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "specialist_translations_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialist_admin_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specialist_translations_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialists"
            referencedColumns: ["id"]
          },
        ]
      }
      specialists: {
        Row: {
          accepting_patients: boolean | null
          address_line1: string | null
          admin_approved: boolean
          admin_approved_at: string | null
          admin_rejection_reason: string | null
          bio: string | null
          calendly_username: string | null
          city: string | null
          created_at: string | null
          credentials: string
          full_name: string
          id: string
          lat: number | null
          lng: number | null
          npi_number: string
          npi_verified: boolean | null
          npi_verified_at: string | null
          phone: string | null
          photo_url: string | null
          practice_name: string | null
          rating_avg: number | null
          review_count: number | null
          review_summary_cache: string | null
          review_summary_cached_at: string | null
          specialty: string
          state: string | null
          stripe_account_id: string | null
          telehealth_available: boolean | null
          telehealth_link: string | null
          updated_at: string | null
          user_id: string | null
          website_url: string | null
          years_experience: number | null
          zip_code: string | null
          zocdoc_provider_id: string | null
        }
        Insert: {
          accepting_patients?: boolean | null
          address_line1?: string | null
          admin_approved?: boolean
          admin_approved_at?: string | null
          admin_rejection_reason?: string | null
          bio?: string | null
          calendly_username?: string | null
          city?: string | null
          created_at?: string | null
          credentials: string
          full_name: string
          id?: string
          lat?: number | null
          lng?: number | null
          npi_number: string
          npi_verified?: boolean | null
          npi_verified_at?: string | null
          phone?: string | null
          photo_url?: string | null
          practice_name?: string | null
          rating_avg?: number | null
          review_count?: number | null
          review_summary_cache?: string | null
          review_summary_cached_at?: string | null
          specialty: string
          state?: string | null
          stripe_account_id?: string | null
          telehealth_available?: boolean | null
          telehealth_link?: string | null
          updated_at?: string | null
          user_id?: string | null
          website_url?: string | null
          years_experience?: number | null
          zip_code?: string | null
          zocdoc_provider_id?: string | null
        }
        Update: {
          accepting_patients?: boolean | null
          address_line1?: string | null
          admin_approved?: boolean
          admin_approved_at?: string | null
          admin_rejection_reason?: string | null
          bio?: string | null
          calendly_username?: string | null
          city?: string | null
          created_at?: string | null
          credentials?: string
          full_name?: string
          id?: string
          lat?: number | null
          lng?: number | null
          npi_number?: string
          npi_verified?: boolean | null
          npi_verified_at?: string | null
          phone?: string | null
          photo_url?: string | null
          practice_name?: string | null
          rating_avg?: number | null
          review_count?: number | null
          review_summary_cache?: string | null
          review_summary_cached_at?: string | null
          specialty?: string
          state?: string | null
          stripe_account_id?: string | null
          telehealth_available?: boolean | null
          telehealth_link?: string | null
          updated_at?: string | null
          user_id?: string | null
          website_url?: string | null
          years_experience?: number | null
          zip_code?: string | null
          zocdoc_provider_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "specialists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_anonymous_identities: {
        Row: {
          anon_alias: string
          anon_avatar_seed: string
          created_at: string
          id: string
          room_id: string
          user_id: string
        }
        Insert: {
          anon_alias: string
          anon_avatar_seed: string
          created_at?: string
          id?: string
          room_id: string
          user_id: string
        }
        Update: {
          anon_alias?: string
          anon_avatar_seed?: string
          created_at?: string
          id?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_anonymous_identities_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications_feed: {
        Row: {
          body: string
          created_at: string
          deeplink: string | null
          id: string
          is_read: boolean
          is_sent: boolean
          reference_id: string | null
          reference_table: string | null
          scheduled_for: string | null
          sent_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          deeplink?: string | null
          id?: string
          is_read?: boolean
          is_sent?: boolean
          reference_id?: string | null
          reference_table?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deeplink?: string | null
          id?: string
          is_read?: boolean
          is_sent?: boolean
          reference_id?: string | null
          reference_table?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          deleted_at: string | null
          deletion_requested_at: string | null
          due_date: string | null
          email: string
          full_name: string
          id: string
          insurance_provider: string | null
          phone: string | null
          preferred_language: string | null
          pregnancy_stage: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deletion_requested_at?: string | null
          due_date?: string | null
          email: string
          full_name: string
          id?: string
          insurance_provider?: string | null
          phone?: string | null
          preferred_language?: string | null
          pregnancy_stage?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deletion_requested_at?: string | null
          due_date?: string | null
          email?: string
          full_name?: string
          id?: string
          insurance_provider?: string | null
          phone?: string | null
          preferred_language?: string | null
          pregnancy_stage?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      baby_profiles_with_week: {
        Row: {
          baby_name: string | null
          birth_weight_grams: number | null
          corrected_age_offset_days: number | null
          created_at: string | null
          current_week_number: number | null
          date_of_birth: string | null
          due_date: string | null
          feeding_method: string | null
          gender: string | null
          id: string | null
          is_premature: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          baby_name?: string | null
          birth_weight_grams?: number | null
          corrected_age_offset_days?: number | null
          created_at?: string | null
          current_week_number?: never
          date_of_birth?: string | null
          due_date?: string | null
          feeding_method?: string | null
          gender?: string | null
          id?: string | null
          is_premature?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          baby_name?: string | null
          birth_weight_grams?: number | null
          corrected_age_offset_days?: number | null
          created_at?: string | null
          current_week_number?: never
          date_of_birth?: string | null
          due_date?: string | null
          feeding_method?: string | null
          gender?: string | null
          id?: string | null
          is_premature?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      specialist_admin_queue: {
        Row: {
          admin_approved: boolean | null
          admin_approved_at: string | null
          admin_rejection_reason: string | null
          city: string | null
          created_at: string | null
          credentials: string | null
          full_name: string | null
          id: string | null
          npi_number: string | null
          npi_verified: boolean | null
          npi_verified_at: string | null
          phone: string | null
          practice_name: string | null
          specialty: string | null
          state: string | null
          user_email: string | null
          user_phone: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      ack_gear_safe_meeting: { Args: { p_thread_id: string }; Returns: string }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      claim_perk: {
        Args: { p_deal_id: string }
        Returns: {
          claim_id: string
          click_url: string
          deal_type: string
          discount_code: string
          redemption_method: string
          subid: string
        }[]
      }
      create_gear_listing: {
        Args: {
          p_age_tags: string[]
          p_brand: string
          p_category: string
          p_condition: string
          p_description: string
          p_is_free: boolean
          p_lat: number
          p_lng: number
          p_model: string
          p_pickup_city: string
          p_pickup_zip: string
          p_price_cents: number
          p_subcategory: string
          p_title: string
          p_year_manufactured: number
        }
        Returns: {
          id: string
        }[]
      }
      disablelongtransactions: { Args: never; Returns: string }
      dismiss_icebreaker: { Args: { p_room_id: string }; Returns: undefined }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      earth: { Args: never; Returns: number }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_dispute_for_transaction: {
        Args: { p_transaction_id: string }
        Returns: {
          created_at: string
          description: string
          evidence_urls: string[] | null
          id: string
          opened_by_role: string
          opened_by_user_id: string
          reason_code: string
          refund_amount_cents: number | null
          resolution_notes: string | null
          resolved_at: string | null
          status: string
          transaction_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "milk_disputes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_gear_listing: {
        Args: { p_id: string }
        Returns: {
          age_tags: string[]
          brand: string
          category: string
          condition: string
          cpsc_checked_at: string
          cpsc_recall_id: string
          cpsc_recall_status: string
          cpsc_recall_url: string
          created_at: string
          currency: string
          description: string
          id: string
          images: Json
          is_cpsc_checked: boolean
          is_free: boolean
          is_saved: boolean
          lat: number
          lng: number
          model: string
          pickup_city: string
          pickup_zip: string
          price_cents: number
          save_count: number
          seller_avatar_url: string
          seller_id: string
          seller_name: string
          status: string
          subcategory: string
          title: string
          upc: string
          view_count: number
          year_manufactured: number
        }[]
      }
      get_home_feed: {
        Args: never
        Returns: {
          cards: Json
          expires_at: string
          generated_at: string
          is_stale: boolean
        }[]
      }
      get_icebreaker: { Args: { p_room_id: string }; Returns: string }
      get_milestones_for_week: {
        Args: { p_week: number }
        Returns: {
          ai_summary_cache: string
          category: string
          description: string
          feed_interval_hours_max: number
          feed_interval_hours_min: number
          hero_emoji: string
          id: string
          sleep_hours_max: number
          sleep_hours_min: number
          title: string
          week_number: number
        }[]
      }
      get_my_current_milestone: {
        Args: never
        Returns: {
          baby_name: string
          category: string
          description: string
          hero_emoji: string
          title: string
          week_number: number
        }[]
      }
      get_my_room_match: {
        Args: never
        Returns: {
          created_at: string
          primary_room: Json
          reason: string
          secondary_rooms: Json
        }[]
      }
      get_or_create_gear_thread: {
        Args: { p_listing_id: string }
        Returns: {
          buyer_user_id: string
          listing_id: string
          safe_meeting_ack_at: string
          seller_user_id: string
          thread_id: string
        }[]
      }
      get_specialists_needing_summary_refresh: {
        Args: never
        Returns: {
          specialist_id: string
        }[]
      }
      get_today_checkin: {
        Args: never
        Returns: {
          ai_reply: string | null
          ai_reply_model: string | null
          checkin_date: string
          created_at: string
          crisis_flagged: boolean
          crisis_resources: Json | null
          energy_score: number | null
          id: string
          mood_score: number
          updated_at: string
          user_id: string
          user_response: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "daily_checkins"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_transaction_pickup_address: {
        Args: { p_transaction_id: string }
        Returns: {
          donor_address_line: string
          donor_city: string
          donor_display_name: string
          donor_phone: string
          donor_state: string
          donor_zip: string
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      has_village_mention: { Args: { p_body: string }; Returns: boolean }
      is_moderator_anywhere: { Args: never; Returns: boolean }
      join_room: {
        Args: { p_room_id: string }
        Returns: {
          id: string
          is_muted: boolean
          joined_at: string
          last_read_at: string
          notif_pref: string
          room_id: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "room_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      leave_room: { Args: { p_room_id: string }; Returns: undefined }
      list_active_home_users: {
        Args: { p_limit?: number }
        Returns: {
          current_week_number: number
          feeding_method: string
          preferred_language: string
          pregnancy_stage: string
          user_id: string
        }[]
      }
      list_events_near: {
        Args: {
          p_age_tags?: string[]
          p_lat: number
          p_lng: number
          p_radius_km?: number
          p_type?: string
        }
        Returns: {
          address: string
          age_tags: string[]
          capacity: number
          city: string
          cover_image_url: string
          description: string
          distance_km: number
          ends_at: string
          going_count: number
          host_avatar_url: string
          host_name: string
          id: string
          is_free: boolean
          is_partner: boolean
          is_third_party: boolean
          lat: number
          lng: number
          platform: string
          price_cents: number
          starts_at: string
          status: string
          stream_url: string
          timezone: string
          title: string
          type: string
          venue_name: string
        }[]
      }
      list_gear_near: {
        Args: {
          p_age_tags?: string[]
          p_category?: string
          p_include_free?: boolean
          p_lat: number
          p_lng: number
          p_max_price_cents?: number
          p_radius_km?: number
        }
        Returns: {
          age_tags: string[]
          brand: string
          category: string
          condition: string
          cover_image_url: string
          created_at: string
          currency: string
          distance_km: number
          id: string
          is_cpsc_checked: boolean
          is_free: boolean
          pickup_city: string
          price_cents: number
          save_count: number
          subcategory: string
          title: string
        }[]
      }
      list_my_claims: {
        Args: never
        Returns: {
          brand_logo_url: string
          brand_name: string
          category: string
          claim_id: string
          claimed_at: string
          click_url: string
          converted_amount_cents: number
          deal_id: string
          deal_type: string
          revealed_code: string
          status: string
          title: string
          webhook_confirmed_at: string
        }[]
      }
      list_my_gear_listings: {
        Args: never
        Returns: {
          category: string
          cover_image_url: string
          created_at: string
          currency: string
          id: string
          is_free: boolean
          price_cents: number
          save_count: number
          status: string
          title: string
          view_count: number
        }[]
      }
      list_my_gear_threads: {
        Args: never
        Returns: {
          is_seller_side: boolean
          last_message_at: string
          last_message_body: string
          listing_cover_url: string
          listing_id: string
          listing_status: string
          listing_title: string
          other_avatar_url: string
          other_display_name: string
          other_user_id: string
          thread_id: string
          unread_count: number
        }[]
      }
      list_my_milk_threads: {
        Args: { p_user_id: string }
        Returns: {
          donor_profile_id: string
          is_donor_side: boolean
          last_message_at: string
          last_message_body: string
          other_avatar_url: string
          other_display_name: string
          recipient_user_id: string
          thread_id: string
          unread_count: number
        }[]
      }
      list_my_orders: {
        Args: { p_user_id: string }
        Returns: {
          address_revealed_at: string
          created_at: string
          donor_avatar_url: string
          donor_display_name: string
          donor_profile_id: string
          fulfillment_method: string
          id: string
          oz_purchased: number
          status: string
          total_charged_cents: number
        }[]
      }
      list_my_rsvps: {
        Args: { p_past?: boolean }
        Returns: {
          added_to_calendar: boolean
          address: string
          city: string
          cover_image_url: string
          ends_at: string
          event_id: string
          event_status: string
          host_name: string
          platform: string
          rsvp_id: string
          rsvp_status: string
          rsvpd_at: string
          starts_at: string
          stream_url: string
          timezone: string
          title: string
          type: string
          venue_name: string
        }[]
      }
      list_my_saved_gear: {
        Args: never
        Returns: {
          category: string
          cover_image_url: string
          currency: string
          id: string
          is_free: boolean
          pickup_city: string
          price_cents: number
          saved_at: string
          status: string
          title: string
        }[]
      }
      list_open_crisis_flags_for_moderator: {
        Args: never
        Returns: {
          ai_assessment: string
          created_at: string
          flagged_user_id: string
          id: string
          message_body: string
          message_id: string
          room_id: string
          room_name: string
          sender_name: string
          severity: string
          status: string
          trigger_phrases: string[]
        }[]
      }
      list_perks: {
        Args: { p_age_tags?: string[]; p_category?: string; p_country?: string }
        Returns: {
          affiliate_network: string
          already_claimed: boolean
          brand_logo_url: string
          brand_name: string
          category: string
          deal_type: string
          disclosure_required: boolean
          discount_label: string
          eligibility_age_tags: string[]
          ends_at: string
          hero_image_url: string
          id: string
          is_partner: boolean
          redemption_method: string
          short_description: string
          title: string
        }[]
      }
      list_reviewable_orders: {
        Args: { p_user_id: string }
        Returns: {
          created_at: string
          donor_avatar_url: string
          donor_display_name: string
          donor_profile_id: string
          oz_purchased: number
          transaction_id: string
        }[]
      }
      list_room_messages: {
        Args: { p_before?: string; p_limit?: number; p_room_id: string }
        Returns: {
          ai_scan_status: string
          body: string
          created_at: string
          id: string
          message_type: string
          parent_id: string
          reactions: Json
          room_id: string
          sender_anon_id: string
          sender_avatar_url: string
          sender_name: string
          sender_user_id: string
        }[]
      }
      list_rooms_for_discovery: {
        Args: { p_user_id?: string }
        Returns: {
          anonymous_mode: string
          city: string
          color_theme: string
          description: string
          emoji: string
          id: string
          is_member: boolean
          member_count: number
          name: string
          room_type: string
          slug: string
          stage_match_score: number
          stage_week_max: number
          stage_week_min: number
        }[]
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      mark_gear_thread_read: {
        Args: { p_thread_id: string }
        Returns: undefined
      }
      mark_listing_cpsc: {
        Args: {
          p_listing_id: string
          p_recall_id?: string
          p_recall_url?: string
          p_status: string
        }
        Returns: undefined
      }
      mark_room_read: { Args: { p_room_id: string }; Returns: undefined }
      mark_thread_read: { Args: { p_thread_id: string }; Returns: undefined }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      recalculate_milk_badge_level: {
        Args: { p_donor_profile_id: string }
        Returns: undefined
      }
      resolve_crisis_flag: {
        Args: { p_action: string; p_flag_id: string; p_notes?: string }
        Returns: undefined
      }
      search_donors_near: {
        Args: {
          filter_badge?: string
          max_price?: number
          radius_miles?: number
          user_lat: number
          user_lng: number
        }
        Returns: {
          ai_safety_score: number
          avatar_url: string
          badge_level: string
          city: string
          display_name: string
          distance_miles: number
          id: string
          is_verified: boolean
          lat: number
          lng: number
          neighborhood: string
          price_per_oz: number
          rating_avg: number
          review_count: number
          state: string
          supply_oz_available: number
          user_id: string
        }[]
      }
      specialists_near: {
        Args: {
          insurance_filter?: string
          language_filter?: string
          lat: number
          lng: number
          radius_miles?: number
          specialty_filter?: string
          telehealth_only?: boolean
        }
        Returns: {
          accepting_patients: boolean
          bio: string
          calendly_username: string
          city: string
          credentials: string
          distance_miles: number
          full_name: string
          id: string
          lat: number
          lng: number
          phone: string
          photo_url: string
          practice_name: string
          rating_avg: number
          review_count: number
          review_summary_cache: string
          specialty: string
          state: string
          telehealth_available: boolean
          telehealth_link: string
          years_experience: number
        }[]
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      sweep_active_listings_for_recalls: {
        Args: never
        Returns: {
          last_run: string
          swept_count: number
        }[]
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      upsert_daily_checkin: {
        Args: {
          p_energy_score?: number
          p_mood_score: number
          p_user_response?: string
        }
        Returns: {
          ai_reply: string | null
          ai_reply_model: string | null
          checkin_date: string
          created_at: string
          crisis_flagged: boolean
          crisis_resources: Json | null
          energy_score: number | null
          id: string
          mood_score: number
          updated_at: string
          user_id: string
          user_response: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "daily_checkins"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          remote_table_id: string | null
          shard_id: string | null
          shard_key: string | null
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
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
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const

