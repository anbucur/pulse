-- Music Integration System Tables

-- User music profiles (aggregated data from music services)
CREATE TABLE IF NOT EXISTS music_profiles (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  spotify_connected BOOLEAN DEFAULT false,
  apple_music_connected BOOLEAN DEFAULT false,
  top_artists TEXT[],
  top_genres TEXT[],
  recently_played TEXT[], -- Array of track names or IDs
  music_taste_score JSONB, -- { diversity: 0-100, mainstream: 0-100, energy: 0-100 }
  last_synced_at TIMESTAMP,
  sync_count INTEGER DEFAULT 0,
  display_music_data BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Music service connections (OAuth tokens and metadata)
CREATE TABLE IF NOT EXISTS music_connections (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service VARCHAR(20) NOT NULL CHECK (service IN ('spotify', 'apple_music')),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  service_user_id VARCHAR(255),
  service_username VARCHAR(255),
  service_country VARCHAR(10),
  scope TEXT[],
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, service)
);

-- Music-based matches
CREATE TABLE IF NOT EXISTS music_matches (
  id SERIAL PRIMARY KEY,
  user1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  compatibility_score INTEGER CHECK (compatibility_score >= 0 AND compatibility_score <= 100),
  shared_artists TEXT[],
  shared_genres TEXT[],
  artist_affinity_score INTEGER, -- 0-100 based on shared top artists
  genre_affinity_score INTEGER, -- 0-100 based on shared genres
  audio_feature_compatibility JSONB, -- { danceability: 0.85, energy: 0.72, etc }
  match_strength VARCHAR(20) DEFAULT 'medium' CHECK (match_strength IN ('low', 'medium', 'high', 'very_high')),
  user1_interest BOOLEAN DEFAULT false,
  user2_interest BOOLEAN DEFAULT false,
  mutual_match BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user1_id, user2_id),
  CHECK (user1_id < user2_id)
);

-- Music mode discovery settings (user preferences for music-based matching)
CREATE TABLE IF NOT EXISTS music_discovery_settings (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  music_mode_enabled BOOLEAN DEFAULT false,
  min_compatibility_score INTEGER DEFAULT 50 CHECK (min_compatibility_score >= 0 AND min_compatibility_score <= 100),
  preferred_genres TEXT[],
  artists_to_match TEXT[], -- Specific artists they want to match on
  artists_to_avoid TEXT[], -- Artists they don't want to match on
  genre_weight INTEGER DEFAULT 30 CHECK (genre_weight >= 0 AND genre_weight <= 100),
  artist_weight INTEGER DEFAULT 50 CHECK (artist_weight >= 0 AND artist_weight <= 100),
  audio_feature_weight INTEGER DEFAULT 20 CHECK (audio_feature_weight >= 0 AND audio_feature_weight <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Music interactions (likes, shares on music profiles)
CREATE TABLE IF NOT EXISTS music_interactions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interaction_type VARCHAR(20) NOT NULL CHECK (interaction_type IN ('profile_view', 'artist_like', 'genre_like', 'music_message')),
  metadata JSONB, -- { artist: "Taylor Swift", genre: "Pop", message: "Great taste!" }
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CHECK (user_id != profile_user_id)
);

-- Music taste statistics
CREATE TABLE IF NOT EXISTS music_stats (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  total_matches INTEGER DEFAULT 0,
  mutual_matches INTEGER DEFAULT 0,
  profile_views INTEGER DEFAULT 0,
  average_compatibility_score DECIMAL(5, 2),
  most_matched_genres TEXT[],
  music_mode_used_count INTEGER DEFAULT 0,
  last_music_mode_used_at TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_music_profiles_user ON music_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_music_profiles_genres ON music_profiles USING GIN(top_genres);
CREATE INDEX IF NOT EXISTS idx_music_profiles_artists ON music_profiles USING GIN(top_artists);

CREATE INDEX IF NOT EXISTS idx_music_connections_user ON music_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_music_connections_service ON music_connections(service);
CREATE INDEX IF NOT EXISTS idx_music_connections_active ON music_connections(is_active);

CREATE INDEX IF NOT EXISTS idx_music_matches_users ON music_matches(user1_id, user2_id);
CREATE INDEX IF NOT EXISTS idx_music_matches_score ON music_matches(compatibility_score DESC);
CREATE INDEX IF NOT EXISTS idx_music_matches_mutual ON music_matches(mutual_match) WHERE mutual_match = true;
CREATE INDEX IF NOT EXISTS idx_music_matches_genres ON music_matches USING GIN(shared_genres);
CREATE INDEX IF NOT EXISTS idx_music_matches_artists ON music_matches USING GIN(shared_artists);

CREATE INDEX IF NOT EXISTS idx_music_discovery_settings_user ON music_discovery_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_music_discovery_settings_enabled ON music_discovery_settings(music_mode_enabled) WHERE music_mode_enabled = true;

CREATE INDEX IF NOT EXISTS idx_music_interactions_user ON music_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_music_interactions_profile_user ON music_interactions(profile_user_id);
CREATE INDEX IF NOT EXISTS idx_music_interactions_type ON music_interactions(interaction_type);

CREATE INDEX IF NOT EXISTS idx_music_stats_user ON music_stats(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_music_integration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_music_profiles_updated_at ON music_profiles;
CREATE TRIGGER update_music_profiles_updated_at
  BEFORE UPDATE ON music_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_music_integration_updated_at();

DROP TRIGGER IF EXISTS update_music_connections_updated_at ON music_connections;
CREATE TRIGGER update_music_connections_updated_at
  BEFORE UPDATE ON music_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_music_integration_updated_at();

DROP TRIGGER IF EXISTS update_music_matches_updated_at ON music_matches;
CREATE TRIGGER update_music_matches_updated_at
  BEFORE UPDATE ON music_matches
  FOR EACH ROW
  EXECUTE FUNCTION update_music_integration_updated_at();

DROP TRIGGER IF EXISTS update_music_discovery_settings_updated_at ON music_discovery_settings;
CREATE TRIGGER update_music_discovery_settings_updated_at
  BEFORE UPDATE ON music_discovery_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_music_integration_updated_at();

DROP TRIGGER IF EXISTS update_music_stats_updated_at ON music_stats;
CREATE TRIGGER update_music_stats_updated_at
  BEFORE UPDATE ON music_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_music_integration_updated_at();

-- Function to calculate music compatibility
CREATE OR REPLACE FUNCTION calculate_music_compatibility(user1_id INTEGER, user2_id INTEGER)
RETURNS TABLE (
  compatibility_score INTEGER,
  shared_artists TEXT[],
  shared_genres TEXT[],
  artist_affinity INTEGER,
  genre_affinity INTEGER
) AS $$
DECLARE
  user1_genres TEXT[];
  user2_genres TEXT[];
  user1_artists TEXT[];
  user2_artists TEXT[];
  shared_genre_count INTEGER;
  shared_artist_count INTEGER;
  total_genres INTEGER;
  total_artists INTEGER;
  artist_score INTEGER;
  genre_score INTEGER;
  final_score INTEGER;
BEGIN
  -- Get user music profiles
  SELECT top_genres, top_artists INTO user1_genres, user1_artists
  FROM music_profiles WHERE user_id = user1_id;

  SELECT top_genres, top_artists INTO user2_genres, user2_artists
  FROM music_profiles WHERE user_id = user2_id;

  -- Calculate shared genres
  shared_genres := ARRAY(
    SELECT UNNEST(user1_genres)
    INTERSECT
    SELECT UNNEST(user2_genres)
  );
  shared_genre_count := COALESCE(array_length(shared_genres, 1), 0);

  -- Calculate shared artists
  shared_artists := ARRAY(
    SELECT UNNEST(user1_artists)
    INTERSECT
    SELECT UNNEST(user2_artists)
  );
  shared_artist_count := COALESCE(array_length(shared_artists, 1), 0);

  -- Calculate affinity scores
  total_genres := GREATEST(array_length(user1_genres, 1), 0);
  total_artists := GREATEST(array_length(user1_artists, 1), 0);

  IF total_genres > 0 THEN
    genre_score := (shared_genre_count::FLOAT / total_genres * 100)::INTEGER;
  ELSE
    genre_score := 0;
  END IF;

  IF total_artists > 0 THEN
    artist_score := (shared_artist_count::FLOAT / total_artists * 100)::INTEGER;
  ELSE
    artist_score := 0;
  END IF;

  -- Calculate final compatibility score (weighted average)
  final_score := (artist_score * 60 + genre_score * 40)::INTEGER;

  RETURN QUERY SELECT final_score, shared_artists, shared_genres, artist_score, genre_score;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-update music stats on interaction
CREATE OR REPLACE FUNCTION update_music_stats_on_interaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment profile views
  IF NEW.interaction_type = 'profile_view' THEN
    UPDATE music_stats
    SET profile_views = profile_views + 1
    WHERE user_id = NEW.profile_user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_music_stats_interaction ON music_interactions;
CREATE TRIGGER update_music_stats_interaction
  AFTER INSERT ON music_interactions
  FOR EACH ROW
  EXECUTE FUNCTION update_music_stats_on_interaction();
