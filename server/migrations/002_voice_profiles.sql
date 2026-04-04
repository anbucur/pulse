-- Voice Profiles Tables

-- User voice profile recordings
CREATE TABLE IF NOT EXISTS voice_profiles (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  audio_url VARCHAR(500) NOT NULL,
  duration INTEGER NOT NULL CHECK (duration BETWEEN 1 AND 30),
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  transcript TEXT,
  language VARCHAR(10) DEFAULT 'en',
  play_count INTEGER DEFAULT 0,
  last_played_at TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Voice profile interactions (who played whose voice)
CREATE TABLE IF NOT EXISTS voice_profile_plays (
  id SERIAL PRIMARY KEY,
  voice_profile_id INTEGER NOT NULL REFERENCES voice_profiles(id) ON DELETE CASCADE,
  listener_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  played_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed BOOLEAN DEFAULT true, -- Whether they listened to the full recording
  UNIQUE(voice_profile_id, listener_id)
);

-- Voice profile feedback/reactions
CREATE TABLE IF NOT EXISTS voice_profile_reactions (
  id SERIAL PRIMARY KEY,
  voice_profile_id INTEGER NOT NULL REFERENCES voice_profiles(id) ON DELETE CASCADE,
  reactor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_type VARCHAR(20) NOT NULL CHECK (reaction_type IN ('heart', 'fire', 'laugh', 'thoughtful')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(voice_profile_id, reactor_id, reaction_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_voice_profiles_user ON voice_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_profiles_active ON voice_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_voice_profile_plays_profile ON voice_profile_plays(voice_profile_id);
CREATE INDEX IF NOT EXISTS idx_voice_profile_plays_listener ON voice_profile_plays(listener_id);
CREATE INDEX IF NOT EXISTS idx_voice_profile_reactions_profile ON voice_profile_reactions(voice_profile_id);
