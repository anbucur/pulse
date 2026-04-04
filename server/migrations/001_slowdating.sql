-- Slow Dating Mode Tables

-- Daily curated matches for users
CREATE TABLE IF NOT EXISTS slowdating_daily_matches (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_date DATE NOT NULL DEFAULT CURRENT_DATE,
  compatibility_score DECIMAL(5,2) NOT NULL,
  conversation_starters TEXT[] NOT NULL,
  compatibility_reason TEXT NOT NULL,
  shared_interests TEXT[] DEFAULT array[]::TEXT[],
  shared_values TEXT[] DEFAULT array[]::TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, match_id, match_date)
);

-- User responses to curated matches (pass/like/skip)
CREATE TABLE IF NOT EXISTS slowdating_responses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  response_type VARCHAR(20) NOT NULL CHECK (response_type IN ('pass', 'like', 'skip')),
  responded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  UNIQUE(user_id, match_id)
);

-- User preferences for slow dating matching
CREATE TABLE IF NOT EXISTS slowdating_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  daily_match_count INTEGER DEFAULT 3 CHECK (daily_match_count BETWEEN 3 AND 10),
  min_compatibility_score DECIMAL(5,2) DEFAULT 70.00 CHECK (min_compatibility_score BETWEEN 0 AND 100),
  preferred_age_range JSONB DEFAULT '{"min": 21, "max": 100}',
  preferred_genders TEXT[] DEFAULT array[]::TEXT[],
  preferred_orientations TEXT[] DEFAULT array[]::TEXT[],
  focus_areas TEXT[] DEFAULT array[]::TEXT[] CHECK (focus_areas <@ array['values', 'interests', 'communication', 'lifestyle', 'sexual', 'emotional']),
  wants_kids BOOLEAN,
  relationship_goals TEXT[] DEFAULT array[]::TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Match history and stats
CREATE TABLE IF NOT EXISTS slowdating_match_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_date DATE NOT NULL,
  matches_received INTEGER DEFAULT 0,
  matches_responded INTEGER DEFAULT 0,
  matches_liked INTEGER DEFAULT 0,
  mutual_connections INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_slowdating_daily_matches_user_date ON slowdating_daily_matches(user_id, match_date);
CREATE INDEX IF NOT EXISTS idx_slowdating_daily_matches_match_date ON slowdating_daily_matches(match_id, match_date);
CREATE INDEX IF NOT EXISTS idx_slowdating_responses_user ON slowdating_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_slowdating_responses_response_type ON slowdating_responses(response_type);
CREATE INDEX IF NOT EXISTS idx_slowdating_history_user_date ON slowdating_match_history(user_id, match_date);
