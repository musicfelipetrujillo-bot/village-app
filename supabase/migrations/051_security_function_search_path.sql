-- Migration 051: Harden function search_path on all app-owned public functions.
--
-- Why: Supabase advisor flags `function_search_path_mutable` for 42 SECURITY
-- DEFINER / non-pinned functions. A mutable search_path can be exploited when
-- a function references unqualified identifiers and an attacker creates a
-- shadowed object in a schema earlier on the search_path. Pinning to
-- `public, pg_catalog` makes resolution deterministic and removes the lint.
--
-- Scope: Only functions owned by the app (NOT extension-owned PostGIS / pgcrypto
-- internals). Generated dynamically from pg_proc + pg_depend on 2026-04-29.
--
-- Risk: Behavior-preserving — `SET search_path` only affects identifier
-- resolution, and every app function already references public schema objects
-- with their actual names. No data changes, no lock escalation.

ALTER FUNCTION public.bump_gear_save_count() SET search_path = public, pg_catalog;
ALTER FUNCTION public.bump_gear_thread_last_message() SET search_path = public, pg_catalog;
ALTER FUNCTION public.bump_room_member_count() SET search_path = public, pg_catalog;
ALTER FUNCTION public.bump_sender_last_read() SET search_path = public, pg_catalog;
ALTER FUNCTION public.bump_thread_last_message() SET search_path = public, pg_catalog;
ALTER FUNCTION public.decrement_listing_supply() SET search_path = public, pg_catalog;
ALTER FUNCTION public.enforce_event_capacity() SET search_path = public, pg_catalog;
ALTER FUNCTION public.find_duplicate_event(p_title text, p_starts_at timestamp with time zone, p_lat double precision, p_lng double precision) SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_dispute_for_transaction(p_transaction_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_home_feed() SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_milestones_for_week(p_week smallint) SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_specialists_needing_summary_refresh() SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_today_checkin() SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_transaction_pickup_address(p_transaction_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.has_village_mention(p_body text) SET search_path = public, pg_catalog;
ALTER FUNCTION public.join_room(p_room_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.leave_room(p_room_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.list_events_near(p_lat double precision, p_lng double precision, p_radius_km double precision, p_type text, p_age_tags text[]) SET search_path = public, pg_catalog;
ALTER FUNCTION public.list_gear_near(p_lat double precision, p_lng double precision, p_radius_km double precision, p_category text, p_age_tags text[], p_max_price_cents integer, p_include_free boolean) SET search_path = public, pg_catalog;
ALTER FUNCTION public.list_my_milk_threads(p_user_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.list_my_orders(p_user_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.list_reviewable_orders(p_user_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.list_rooms_for_discovery(p_user_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.mark_thread_read(p_thread_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.mark_transaction_disputed() SET search_path = public, pg_catalog;
ALTER FUNCTION public.recalculate_milk_badge_level(p_donor_profile_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.recalculate_specialist_rating() SET search_path = public, pg_catalog;
ALTER FUNCTION public.scan_room_message_async() SET search_path = public, pg_catalog;
ALTER FUNCTION public.search_donors_near(user_lat numeric, user_lng numeric, radius_miles integer, filter_badge text, max_price numeric) SET search_path = public, pg_catalog;
ALTER FUNCTION public.set_event_location(p_event_id uuid, p_lat double precision, p_lng double precision) SET search_path = public, pg_catalog;
ALTER FUNCTION public.specialists_near(lat double precision, lng double precision, radius_miles double precision, specialty_filter text, language_filter text, insurance_filter text, telehealth_only boolean) SET search_path = public, pg_catalog;
ALTER FUNCTION public.touch_baby_profile_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.touch_brand_deals_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.touch_checkin_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.touch_cpsc_cache_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.touch_events_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.touch_gear_listings_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_donor_rating() SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_milk_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.upsert_daily_checkin(p_mood_score smallint, p_energy_score smallint, p_user_response text) SET search_path = public, pg_catalog;
ALTER FUNCTION public.upsert_ingested_event(p_source_feed_id uuid, p_source_uid text, p_type text, p_title text, p_description text, p_host_name text, p_host_avatar_url text, p_is_partner boolean, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_timezone text, p_age_tags text[], p_venue_name text, p_address text, p_city text, p_lat double precision, p_lng double precision, p_stream_url text, p_platform text) SET search_path = public, pg_catalog;
