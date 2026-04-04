-- Video Speed Dating System Tables

-- Speed dating events
CREATE TABLE IF NOT EXISTS speed_dating_events (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_type VARCHAR(30) DEFAULT 'standard' CHECK (event_type IN ('standard', 'queer_only', 'age_specific', 'interest_based', 'premium')),
  event_date TIMESTAMP NOT NULL,
  duration_minutes INTEGER DEFAULT 90,
  round_duration_minutes INTEGER DEFAULT 3,
  break_duration_minutes INTEGER DEFAULT 1,
  max_participants INTEGER DEFAULT 20,
  min_participants INTEGER DEFAULT 6,
  current_participants INTEGER DEFAULT 0,
  gender_preference VARCHAR(50) DEFAULT 'any' CHECK (gender_preference IN ('any', 'male', 'female', 'non_binary', 'queer')),
  age_min INTEGER DEFAULT 18,
  age_max INTEGER DEFAULT 100,
  interests_match BOOLEAN DEFAULT false,
  interests_tags TEXT[],
  requires_verification BOOLEAN DEFAULT true,
  entry_fee DECIMAL(10, 2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('draft', 'scheduled', 'ongoing', 'completed', 'cancelled')),
  room_url VARCHAR(500),
  room_id VARCHAR(100),
  host_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Speed dating event participants
CREATE TABLE IF NOT EXISTS speed_dating_participants (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES speed_dating_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant_number INTEGER,
  checked_in_at TIMESTAMP,
  checked_out_at TIMESTAMP,
  connection_quality VARCHAR(20), -- 'excellent', 'good', 'fair', 'poor'
  technical_issues INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'registered' CHECK (status IN ('registered', 'checked_in', 'active', 'completed', 'no_show', 'disconnected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, user_id)
);

-- Speed dating rounds
CREATE TABLE IF NOT EXISTS speed_dating_rounds (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES speed_dating_events(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration_seconds INTEGER,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'skipped')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, round_number)
);

-- Speed dating matches (pairings during rounds)
CREATE TABLE IF NOT EXISTS speed_dating_matches (
  id SERIAL PRIMARY KEY,
  round_id INTEGER NOT NULL REFERENCES speed_dating_rounds(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES speed_dating_events(id) ON DELETE CASCADE,
  participant1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  match_ended_at TIMESTAMP,
  room_name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('pending', 'active', 'completed', 'ended_early', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(participant1_id, participant2_id, round_id),
  CHECK (participant1_id != participant2_id)
);

-- Speed dating ratings and feedback
CREATE TABLE IF NOT EXISTS speed_dating_ratings (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES speed_dating_matches(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES speed_dating_events(id) ON DELETE CASCADE,
  rater_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rated_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  would_match_again BOOLEAN DEFAULT false,
  interest_level VARCHAR(20) CHECK (interest_level IN ('not_interested', 'maybe', 'interested', 'very_interested')),
  report_reason VARCHAR(100),
  notes TEXT,
  tags TEXT[], -- 'funny', 'attractive', 'smart', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(rater_id, rated_user_id, match_id),
  CHECK (rater_id != rated_user_id)
);

-- Mutual matches (both parties said yes)
CREATE TABLE IF NOT EXISTS speed_dating_mutual_matches (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES speed_dating_events(id) ON DELETE CASCADE,
  user1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_score INTEGER DEFAULT 0,
  compatibility_tags TEXT[],
  icebreaker_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, user1_id, user2_id),
  CHECK (user1_id < user2_id)
);

-- Speed dating stats and analytics
CREATE TABLE IF NOT EXISTS speed_dating_stats (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  events_participated INTEGER DEFAULT 0,
  total_rounds INTEGER DEFAULT 0,
  total_matches INTEGER DEFAULT 0,
  mutual_matches INTEGER DEFAULT 0,
  average_rating DECIMAL(3, 2),
  received_rating_count INTEGER DEFAULT 0,
  last_participated_at TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Speed dating room sessions (for WebRTC/turn server tracking)
CREATE TABLE IF NOT EXISTS speed_dating_rooms (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES speed_dating_matches(id) ON DELETE CASCADE,
  room_id VARCHAR(100) NOT NULL UNIQUE,
  room_type VARCHAR(20) DEFAULT 'webrtc' CHECK (room_type IN ('webrtc', 'sfu', 'peer_to_peer')),
  turn_server_url VARCHAR(255),
  stun_server_url VARCHAR(255),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  duration_seconds INTEGER,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended', 'failed'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_speed_dating_events_date ON speed_dating_events(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_speed_dating_events_status ON speed_dating_events(status);
CREATE INDEX IF NOT EXISTS idx_speed_dating_events_type ON speed_dating_events(event_type);
CREATE INDEX IF NOT EXISTS idx_speed_dating_events_verification ON speed_dating_events(requires_verification);

CREATE INDEX IF NOT EXISTS idx_speed_dating_participants_event ON speed_dating_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_speed_dating_participants_user ON speed_dating_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_speed_dating_participants_status ON speed_dating_participants(status);

CREATE INDEX IF NOT EXISTS idx_speed_dating_rounds_event ON speed_dating_rounds(event_id);
CREATE INDEX IF NOT EXISTS idx_speed_dating_rounds_status ON speed_dating_rounds(status);

CREATE INDEX IF NOT EXISTS idx_speed_dating_matches_round ON speed_dating_matches(round_id);
CREATE INDEX IF NOT EXISTS idx_speed_dating_matches_event ON speed_dating_matches(event_id);
CREATE INDEX IF NOT EXISTS idx_speed_dating_matches_participants ON speed_dating_matches(participant1_id, participant2_id);

CREATE INDEX IF NOT EXISTS idx_speed_dating_ratings_event ON speed_dating_ratings(event_id);
CREATE INDEX IF NOT EXISTS idx_speed_dating_ratings_rater ON speed_dating_ratings(rater_id);
CREATE INDEX IF NOT EXISTS idx_speed_dating_ratings_rated ON speed_dating_ratings(rated_user_id);

CREATE INDEX IF NOT EXISTS idx_speed_dating_mutual_event ON speed_dating_mutual_matches(event_id);
CREATE INDEX IF NOT EXISTS idx_speed_dating_mutual_users ON speed_dating_mutual_matches(user1_id, user2_id);

CREATE INDEX IF NOT EXISTS idx_speed_dating_stats_user ON speed_dating_stats(user_id);

CREATE INDEX IF NOT EXISTS idx_speed_dating_rooms_match ON speed_dating_rooms(match_id);
CREATE INDEX IF NOT EXISTS idx_speed_dating_rooms_status ON speed_dating_rooms(status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_speed_dating_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_speed_dating_events_updated_at ON speed_dating_events;
CREATE TRIGGER update_speed_dating_events_updated_at
  BEFORE UPDATE ON speed_dating_events
  FOR EACH ROW
  EXECUTE FUNCTION update_speed_dating_updated_at();

DROP TRIGGER IF EXISTS update_speed_dating_participants_updated_at ON speed_dating_participants;
CREATE TRIGGER update_speed_dating_participants_updated_at
  BEFORE UPDATE ON speed_dating_participants
  FOR EACH ROW
  EXECUTE FUNCTION update_speed_dating_updated_at();

DROP TRIGGER IF EXISTS update_speed_dating_ratings_updated_at ON speed_dating_ratings;
CREATE TRIGGER update_speed_dating_ratings_updated_at
  BEFORE UPDATE ON speed_dating_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_speed_dating_updated_at();

DROP TRIGGER IF EXISTS update_speed_dating_stats_updated_at ON speed_dating_stats;
CREATE TRIGGER update_speed_dating_stats_updated_at
  BEFORE UPDATE ON speed_dating_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_speed_dating_updated_at();

-- Function to calculate match score
CREATE OR REPLACE FUNCTION calculate_speed_dating_match_score()
RETURNS TRIGGER AS $$
DECLARE
  avg_rating DECIMAL(3,2);
BEGIN
  -- Calculate average rating when new rating is added
  SELECT COALESCE(AVG(rating), 0) INTO avg_rating
  FROM speed_dating_ratings
  WHERE rated_user_id = NEW.rated_user_id;

  UPDATE speed_dating_stats
  SET average_rating = avg_rating
  WHERE user_id = NEW.rated_user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_speed_dating_rating_stats ON speed_dating_ratings;
CREATE TRIGGER update_speed_dating_rating_stats
  AFTER INSERT ON speed_dating_ratings
  FOR EACH ROW
  EXECUTE FUNCTION calculate_speed_dating_match_score();
