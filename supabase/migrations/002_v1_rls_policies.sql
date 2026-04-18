-- V1 — Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialists ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialist_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialist_insurances ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialist_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialist_translations ENABLE ROW LEVEL SECURITY;

-- Users: own row only
CREATE POLICY "users_select_own" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users_insert_own" ON users FOR INSERT WITH CHECK (auth.uid() = id);

-- Specialists: public read, service role write
CREATE POLICY "specialists_select_all" ON specialists FOR SELECT USING (true);
CREATE POLICY "specialists_insert_service" ON specialists FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "specialists_update_service" ON specialists FOR UPDATE USING (auth.role() = 'service_role');

-- Sub-tables: public read
CREATE POLICY "spec_langs_select" ON specialist_languages FOR SELECT USING (true);
CREATE POLICY "spec_ins_select" ON specialist_insurances FOR SELECT USING (true);
CREATE POLICY "spec_svc_select" ON specialist_services FOR SELECT USING (true);
CREATE POLICY "spec_trans_select" ON specialist_translations FOR SELECT USING (true);
CREATE POLICY "spec_trans_insert_service" ON specialist_translations FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Reviews: public read, authenticated insert own
CREATE POLICY "reviews_select_all" ON reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert_own" ON reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_update_own" ON reviews FOR UPDATE USING (auth.uid() = user_id);

-- Favorites: own rows only
CREATE POLICY "favorites_select_own" ON favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "favorites_insert_own" ON favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "favorites_delete_own" ON favorites FOR DELETE USING (auth.uid() = user_id);

-- Appointments: own rows only
CREATE POLICY "appts_select_own" ON appointments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "appts_insert_own" ON appointments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "appts_update_service" ON appointments FOR UPDATE USING (auth.role() = 'service_role');

-- Messages: sender or specialist's linked user
CREATE POLICY "messages_select_participant" ON messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = (SELECT user_id FROM specialists WHERE id = specialist_id));
CREATE POLICY "messages_insert_own" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- AI conversations: own rows only
CREATE POLICY "ai_conv_select_own" ON ai_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ai_conv_insert_own" ON ai_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_conv_update_service" ON ai_conversations FOR UPDATE USING (auth.role() = 'service_role');
