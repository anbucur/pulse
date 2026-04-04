-- Profile Completion Gamification Tables

-- Milestones that can be achieved
CREATE TABLE IF NOT EXISTS profile_milestones (
  id SERIAL PRIMARY KEY,
  milestone_key VARCHAR(50) NOT NULL UNIQUE,
  milestone_name VARCHAR(100) NOT NULL,
  description TEXT,
  milestone_category VARCHAR(30) CHECK (milestone_category IN ('profile', 'photos', 'bio', 'interests', 'verification', 'engagement', 'premium')),
  required_completion_percent INTEGER CHECK (required_completion_percent BETWEEN 0 AND 100),
  required_fields TEXT[], -- array of required field names
  reward_type VARCHAR(30) CHECK (reward_type IN ('more_matches', 'visibility_boost', 'badge', 'priority', 'daily_swipes', 'super_like', 'none')),
  reward_value INTEGER DEFAULT 0,
  reward_duration_hours INTEGER,
  icon VARCHAR(50),
  badge_url TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User milestone progress and achievements
CREATE TABLE IF NOT EXISTS user_milestones (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  milestone_id INTEGER NOT NULL REFERENCES profile_milestones(id) ON DELETE CASCADE,
  achieved_at TIMESTAMP,
  reward_claimed BOOLEAN DEFAULT false,
  reward_claimed_at TIMESTAMP,
  reward_expires_at TIMESTAMP,
  progress_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, milestone_id)
);

-- Profile completion snapshots (track over time)
CREATE TABLE IF NOT EXISTS completion_snapshots (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  completion_percent INTEGER CHECK (completion_percent BETWEEN 0 AND 100),
  filled_fields TEXT[],
  missing_fields TEXT[],
  photo_count INTEGER DEFAULT 0,
  has_bio BOOLEAN DEFAULT false,
  has_interests BOOLEAN DEFAULT false,
  has_location BOOLEAN DEFAULT false,
  verification_level VARCHAR(20) DEFAULT 'none' CHECK (verification_level IN ('none', 'email', 'phone', 'photo', 'id')),
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rewards granted to users
CREATE TABLE IF NOT EXISTS completion_rewards (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  milestone_id INTEGER REFERENCES profile_milestones(id) ON DELETE SET NULL,
  reward_type VARCHAR(30) NOT NULL,
  reward_value INTEGER DEFAULT 0,
  reward_status VARCHAR(20) DEFAULT 'active' CHECK (reward_status IN ('pending', 'active', 'expired', 'revoked')),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  used_value INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily reward tracking (prevent farming)
CREATE TABLE IF NOT EXISTS daily_reward_tracking (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_date DATE NOT NULL DEFAULT CURRENT_DATE,
  rewards_claimed INTEGER DEFAULT 0,
  completion_percent_at_claim INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, reward_date)
);

-- Streak tracking for consistent profile completion
CREATE TABLE IF NOT EXISTS completion_streaks (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  current_streak_days INTEGER DEFAULT 0,
  longest_streak_days INTEGER DEFAULT 0,
  last_completion_update_at TIMESTAMP,
  streak_milestone_7 BOOLEAN DEFAULT false,
  streak_milestone_30 BOOLEAN DEFAULT false,
  streak_milestone_100 BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_milestones_user ON user_milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_user_milestones_milestone ON user_milestones(milestone_id);
CREATE INDEX IF NOT EXISTS idx_user_milestones_achieved ON user_milestones(achieved_at);
CREATE INDEX IF NOT EXISTS idx_completion_snapshots_user ON completion_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_completion_snapshots_calculated ON completion_snapshots(calculated_at);
CREATE INDEX IF NOT EXISTS idx_completion_rewards_user ON completion_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_completion_rewards_status ON completion_rewards(reward_status);
CREATE INDEX IF NOT EXISTS idx_completion_rewards_expires ON completion_rewards(expires_at);
CREATE INDEX IF NOT EXISTS idx_daily_reward_tracking_user ON daily_reward_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_reward_tracking_date ON daily_reward_tracking(reward_date);
CREATE INDEX IF NOT EXISTS idx_completion_streaks_user ON completion_streaks(user_id);

-- Insert default milestones
INSERT INTO profile_milestones (milestone_key, milestone_name, description, milestone_category, required_completion_percent, reward_type, reward_value, reward_duration_hours, icon, sort_order) VALUES
  ('starter_profile', 'Starter Profile', 'Add your basic info to get started', 'profile', 20, 'more_matches', 5, 168, 'user', 1),
  ('photo_upload', 'First Photo', 'Upload your first photo', 'photos', 30, 'more_matches', 10, 168, 'image', 2),
  ('bio_added', 'Tell Your Story', 'Add a bio to let people know you better', 'bio', 40, 'visibility_boost', 20, 72, 'file-text', 3),
  ('interests_explorer', 'Share Your Interests', 'Add at least 3 interests', 'interests', 50, 'more_matches', 15, 168, 'heart', 4),
  ('verified_email', 'Email Verified', 'Verify your email address', 'verification', 25, 'badge', 1, NULL, 'mail', 5),
  ('multi_photo', 'Photo Gallery', 'Upload at least 3 photos', 'photos', 60, 'visibility_boost', 30, 72, 'images', 6),
  ('detailed_profile', 'Detailed Profile', 'Complete most profile fields', 'profile', 70, 'priority', 1, 48, 'star', 7),
  ('voice_profile', 'Voice Intro', 'Add a voice profile', 'profile', 75, 'super_like', 3, 168, 'mic', 8),
  ('super_fan', 'Profile Enthusiast', 'Fill out 90% of your profile', 'profile', 90, 'daily_swipes', 10, 168, 'award', 9),
  ('perfectionist', 'Complete Profile', 'Achieve 100% profile completion', 'profile', 100, 'visibility_boost', 50, 120, 'trophy', 10),
  ('verified_phone', 'Phone Verified', 'Verify your phone number', 'verification', 80, 'badge', 1, NULL, 'phone', 11),
  ('photo_verified', 'Photo Verified', 'Get your photos verified', 'verification', 85, 'visibility_boost', 40, 168, 'shield', 12),
  ('kink_profile', 'Kink Profile', 'Complete your kink profile', 'profile', 65, 'more_matches', 20, 168, 'flame', 13)
ON CONFLICT (milestone_key) DO NOTHING;
