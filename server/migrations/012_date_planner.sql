-- Date Planner System Tables

-- Date plans (scheduled dates between two users)
CREATE TABLE IF NOT EXISTS date_plans (
  id SERIAL PRIMARY KEY,
  plan_id VARCHAR(36) NOT NULL UNIQUE,
  user1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  suggested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  date_idea_type VARCHAR(50) CHECK (date_idea_type IN ('coffee', 'dinner', 'activity', 'outdoor', 'entertainment', 'cultural', 'adventure', 'relaxed', 'surprise', 'custom')),
  proposed_date_time TIMESTAMP,
  duration_minutes INTEGER DEFAULT 120,
  location_name VARCHAR(255),
  location_address VARCHAR(500),
  location_latitude DECIMAL(10, 8),
  location_longitude DECIMAL(11, 8),
  venue_id INTEGER REFERENCES marketplace_listings(id) ON DELETE SET NULL, -- Link to DateMarketplace
  estimated_budget VARCHAR(50),
  status VARCHAR(20) DEFAULT 'proposed' CHECK (status IN ('proposed', 'pending_confirmation', 'confirmed', 'scheduled', 'completed', 'cancelled', 'rescheduled')),
  user1_confirmed BOOLEAN DEFAULT false,
  user2_confirmed BOOLEAN DEFAULT false,
  calendar_event_id VARCHAR(255), -- External calendar event ID
  calendar_provider VARCHAR(50), -- 'google', 'apple', 'outlook'
  reminder_sent BOOLEAN DEFAULT false,
  reminder_minutes_before INTEGER DEFAULT 60,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  cancellation_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (user1_id < user2_id)
);

-- Availability slots (when users are free for dates)
CREATE TABLE IF NOT EXISTS availability_slots (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot_type VARCHAR(20) DEFAULT 'available' CHECK (slot_type IN ('available', 'busy', 'preferred')),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule VARCHAR(100), -- iCal RRULE format
  recurrence_exceptions TEXT[], -- Dates to skip
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_time > start_time)
);

-- Date suggestions (AI-generated or curated date ideas)
CREATE TABLE IF NOT EXISTS date_suggestions (
  id SERIAL PRIMARY KEY,
  suggestion_id VARCHAR(36) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL CHECK (category IN ('coffee', 'dinner', 'activity', 'outdoor', 'entertainment', 'cultural', 'adventure', 'relaxed', 'surprise')),
  location_name VARCHAR(255),
  location_address VARCHAR(500),
  location_latitude DECIMAL(10, 8),
  location_longitude DECIMAL(11, 8),
  venue_id INTEGER REFERENCES marketplace_listings(id) ON DELETE SET NULL,
  estimated_duration_minutes INTEGER DEFAULT 120,
  estimated_budget VARCHAR(50),
  budget_min DECIMAL(10, 2),
  budget_max DECIMAL(10, 2),
  best_for_daytime BOOLEAN DEFAULT true,
  best_for_evening BOOLEAN DEFAULT true,
  best_for_weekend BOOLEAN DEFAULT true,
  conversation_rating INTEGER DEFAULT 5 CHECK (conversation_rating >= 1 AND conversation_rating <= 10),
  romance_rating INTEGER DEFAULT 5 CHECK (romance_rating >= 1 AND romance_rating <= 10),
  fun_rating INTEGER DEFAULT 5 CHECK (fun_rating >= 1 AND fun_rating <= 10),
  activity_level VARCHAR(20) DEFAULT 'moderate' CHECK (activity_level IN ('low', 'moderate', 'high')),
  tags TEXT[],
  required_items TEXT[], -- Things to bring
  weather_dependent BOOLEAN DEFAULT false,
  min_age_restriction INTEGER,
  accessibility_notes TEXT,
  image_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  popularity_score INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Date plan messages (communication within date planning)
CREATE TABLE IF NOT EXISTS date_plan_messages (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES date_plans(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_type VARCHAR(30) DEFAULT 'message' CHECK (message_type IN ('message', 'time_change', 'location_change', 'confirmation', 'cancellation', 'reminder')),
  content TEXT,
  metadata JSONB, -- { new_time: "2025-01-15 19:00", new_location: "Cafe X" }
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Date feedback and ratings
CREATE TABLE IF NOT EXISTS date_feedback (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES date_plans(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
  location_rating INTEGER CHECK (location_rating >= 1 AND overall_rating <= 5),
  conversation_rating INTEGER CHECK (conversation_rating >= 1 AND conversation_rating <= 5),
  chemistry_rating INTEGER CHECK (chemistry_rating >= 1 AND chemistry_rating <= 5),
  would_date_again BOOLEAN,
  would_recommend_location BOOLEAN,
  feedback_text TEXT,
  went_well TEXT[],
  could_improve TEXT[],
  actual_cost DECIMAL(10, 2),
  actual_duration_minutes INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plan_id, user_id)
);

-- Calendar sync connections
CREATE TABLE IF NOT EXISTS calendar_connections (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('google', 'apple', 'outlook')),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  calendar_id VARCHAR(255),
  calendar_name VARCHAR(255),
  sync_enabled BOOLEAN DEFAULT true,
  auto_add_dates BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, provider)
);

-- Mutual availability cache (pre-computed overlapping slots)
CREATE TABLE IF NOT EXISTS mutual_availability_cache (
  id SERIAL PRIMARY KEY,
  user1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  available_slots JSONB, -- Array of { start, end, priority }
  last_computed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user1_id, user2_id),
  CHECK (user1_id < user2_id)
);

-- Date planner statistics
CREATE TABLE IF NOT EXISTS date_planner_stats (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  dates_proposed INTEGER DEFAULT 0,
  dates_confirmed INTEGER DEFAULT 0,
  dates_completed INTEGER DEFAULT 0,
  dates_cancelled INTEGER DEFAULT 0,
  dates_rescheduled INTEGER DEFAULT 0,
  average_date_rating DECIMAL(3, 2),
  total_dates_as_initiator INTEGER DEFAULT 0,
  total_dates_as_invitee INTEGER DEFAULT 0,
  response_rate DECIMAL(5, 2), -- Percentage of date invitations responded to
  average_response_time_hours DECIMAL(10, 2),
  most_common_date_type VARCHAR(50),
  last_date_activity_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_date_plans_users ON date_plans(user1_id, user2_id);
CREATE INDEX IF NOT EXISTS idx_date_plans_status ON date_plans(status);
CREATE INDEX IF NOT EXISTS idx_date_plans_datetime ON date_plans(proposed_date_time);
CREATE INDEX IF NOT EXISTS idx_date_plans_suggested_by ON date_plans(suggested_by);
CREATE INDEX IF NOT EXISTS idx_date_plans_venue ON date_plans(venue_id);

CREATE INDEX IF NOT EXISTS idx_availability_slots_user ON availability_slots(user_id);
CREATE INDEX IF NOT EXISTS idx_availability_slots_time ON availability_slots(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_availability_slots_type ON availability_slots(slot_type);
CREATE INDEX IF NOT EXISTS idx_availability_slots_active ON availability_slots(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_date_suggestions_category ON date_suggestions(category);
CREATE INDEX IF NOT EXISTS idx_date_suggestions_active ON date_suggestions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_date_suggestions_popularity ON date_suggestions(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_date_suggestions_location ON date_suggestions(location_latitude, location_longitude);

CREATE INDEX IF NOT EXISTS idx_date_plan_messages_plan ON date_plan_messages(plan_id);
CREATE INDEX IF NOT EXISTS idx_date_plan_messages_sender ON date_plan_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_date_plan_messages_type ON date_plan_messages(message_type);

CREATE INDEX IF NOT EXISTS idx_date_feedback_plan ON date_feedback(plan_id);
CREATE INDEX IF NOT EXISTS idx_date_feedback_user ON date_feedback(user_id);

CREATE INDEX IF NOT EXISTS idx_calendar_connections_user ON calendar_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_provider ON calendar_connections(provider);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_active ON calendar_connections(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_mutual_availability_users ON mutual_availability_cache(user1_id, user2_id);
CREATE INDEX IF NOT EXISTS idx_mutual_availability_computed ON mutual_availability_cache(last_computed_at);

CREATE INDEX IF NOT EXISTS idx_date_planner_stats_user ON date_planner_stats(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_date_planner_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_date_plans_updated_at ON date_plans;
CREATE TRIGGER update_date_plans_updated_at
  BEFORE UPDATE ON date_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_date_planner_updated_at();

DROP TRIGGER IF EXISTS update_availability_slots_updated_at ON availability_slots;
CREATE TRIGGER update_availability_slots_updated_at
  BEFORE UPDATE ON availability_slots
  FOR EACH ROW
  EXECUTE FUNCTION update_date_planner_updated_at();

DROP TRIGGER IF EXISTS update_date_suggestions_updated_at ON date_suggestions;
CREATE TRIGGER update_date_suggestions_updated_at
  BEFORE UPDATE ON date_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_date_planner_updated_at();

DROP TRIGGER IF EXISTS update_calendar_connections_updated_at ON calendar_connections;
CREATE TRIGGER update_calendar_connections_updated_at
  BEFORE UPDATE ON calendar_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_date_planner_updated_at();

DROP TRIGGER IF EXISTS update_mutual_availability_updated_at ON mutual_availability_cache;
CREATE TRIGGER update_mutual_availability_updated_at
  BEFORE UPDATE ON mutual_availability_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_date_planner_updated_at();

DROP TRIGGER IF EXISTS update_date_planner_stats_updated_at ON date_planner_stats;
CREATE TRIGGER update_date_planner_stats_updated_at
  BEFORE UPDATE ON date_planner_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_date_planner_updated_at();

-- Function to update date planner stats
CREATE OR REPLACE FUNCTION update_date_planner_stats_on_plan()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment proposed count
    INSERT INTO date_planner_stats (user_id, dates_proposed)
    VALUES (NEW.suggested_by, 1)
    ON CONFLICT (user_id)
    DO UPDATE SET
      dates_proposed = date_planner_stats.dates_proposed + 1,
      last_date_activity_at = NOW();

    IF NEW.suggested_by = NEW.user1_id THEN
      INSERT INTO date_planner_stats (user_id, total_dates_as_initiator)
      VALUES (NEW.user1_id, 1)
      ON CONFLICT (user_id)
      DO UPDATE SET total_dates_as_initiator = date_planner_stats.total_dates_as_initiator + 1;
    ELSE
      INSERT INTO date_planner_stats (user_id, total_dates_as_invitee)
      VALUES (NEW.user2_id, 1)
      ON CONFLICT (user_id)
      DO UPDATE SET total_dates_as_invitee = date_planner_stats.total_dates_as_invitee + 1;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      CASE NEW.status
        WHEN 'confirmed' THEN
          UPDATE date_planner_stats
          SET dates_confirmed = dates_confirmed + 1
          WHERE user_id IN (NEW.user1_id, NEW.user2_id);
        WHEN 'completed' THEN
          UPDATE date_planner_stats
          SET dates_completed = dates_completed + 1,
              last_date_activity_at = NOW()
          WHERE user_id IN (NEW.user1_id, NEW.user2_id);
        WHEN 'cancelled' THEN
          UPDATE date_planner_stats
          SET dates_cancelled = dates_cancelled + 1
          WHERE user_id IN (NEW.user1_id, NEW.user2_id);
        WHEN 'rescheduled' THEN
          UPDATE date_planner_stats
          SET dates_rescheduled = dates_rescheduled + 1
          WHERE user_id IN (NEW.user1_id, NEW.user2_id);
      END CASE;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_date_planner_stats ON date_plans;
CREATE TRIGGER update_date_planner_stats
  AFTER INSERT OR UPDATE ON date_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_date_planner_stats_on_plan();

-- Function to calculate mutual availability
CREATE OR REPLACE FUNCTION calculate_mutual_availability(user1_id INTEGER, user2_id INTEGER)
RETURNS JSONB AS $$
DECLARE
  mutual_slots JSONB := '[]'::JSONB;
BEGIN
  -- Find overlapping availability slots
  SELECT jsonb_agg(jsonb_build_object(
    'start', greatest(s1.start_time, s2.start_time),
    'end', least(s1.end_time, s2.end_time),
    'priority', (s1.priority + s2.priority)::FLOAT / 2
  ))
  INTO mutual_slots
  FROM availability_slots s1
  JOIN availability_slots s2 ON (
    s1.start_time < s2.end_time AND
    s1.end_time > s2.start_time AND
    s1.slot_type = 'available' AND
    s2.slot_type = 'available' AND
    s1.is_active = true AND
    s2.is_active = true
  )
  WHERE s1.user_id = user1_id AND s2.user_id = user2_id
  LIMIT 50;

  RETURN COALESCE(mutual_slots, '[]'::JSONB);
END;
$$ LANGUAGE plpgsql;

-- Insert default date suggestions
INSERT INTO date_suggestions (suggestion_id, title, description, category, estimated_duration_minutes, estimated_budget, conversation_rating, romance_rating, fun_rating, activity_level, tags) VALUES
  ('suggestion_1', 'Coffee & Conversation', 'Meet at a cozy café for coffee and great conversation', 'coffee', 60, '$10-20', 9, 6, 5, 'low', ARRAY['casual', 'daytime', 'conversation']),
  ('suggestion_2', 'Dinner at a Nice Restaurant', 'Enjoy a delicious meal together', 'dinner', 120, '$50-100', 8, 9, 7, 'low', ARRAY['romantic', 'evening', 'food']),
  ('suggestion_3', 'Art Gallery Visit', 'Explore art and share opinions', 'cultural', 90, '$15-30', 8, 7, 6, 'moderate', ARRAY['cultural', 'art', 'conversation']),
  ('suggestion_4', 'Hiking Adventure', 'Enjoy nature and get some exercise together', 'outdoor', 180, '$0-20', 7, 6, 9, 'high', ARRAY['outdoor', 'active', 'nature']),
  ('suggestion_5', 'Movie Night', 'Watch the latest blockbuster together', 'entertainment', 150, '$20-40', 5, 8, 7, 'low', ARRAY['relaxed', 'entertainment', 'indoor']),
  ('suggestion_6', 'Concert or Live Music', 'Enjoy live music together', 'entertainment', 180, '$30-100', 6, 8, 10, 'moderate', ARRAY['music', 'nightlife', 'fun']),
  ('suggestion_7', 'Picnic in the Park', 'Relax outdoors with food and conversation', 'outdoor', 120, '$20-40', 9, 9, 7, 'low', ARRAY['romantic', 'outdoor', 'casual']),
  ('suggestion_8', 'Cooking Class', 'Learn to cook something new together', 'activity', 150, '$80-150', 8, 7, 9, 'moderate', ARRAY['activity', 'learning', 'fun']),
  ('suggestion_9', 'Wine Tasting', 'Sample wines and enjoy conversation', 'activity', 120, '$40-80', 8, 8, 7, 'low', ARRAY['sophisticated', 'drinks', 'conversation']),
  ('suggestion_10', 'Bowling or Arcade', 'Fun and games together', 'activity', 120, '$30-50', 7, 6, 9, 'moderate', ARRAY['fun', 'casual', 'games'])
ON CONFLICT (suggestion_id) DO NOTHING;
