-- Freemium Model Tables

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier VARCHAR(20) NOT NULL DEFAULT 'free', -- 'free' or 'premium'
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'cancelled', 'expired'
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_date TIMESTAMP WITH TIME ZONE,
  auto_renew BOOLEAN DEFAULT true,
  billing_provider VARCHAR(50), -- 'stripe', 'apple', 'google'
  provider_subscription_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_tier ON subscriptions(tier);

-- Usage tracking table
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_type VARCHAR(50) NOT NULL, -- 'likes', 'slow_dating_matches', 'profile_views', etc.
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, feature_type, usage_date)
);

CREATE INDEX idx_usage_tracking_user_date ON usage_tracking(user_id, usage_date);
CREATE INDEX idx_usage_tracking_feature ON usage_tracking(feature_type);

-- Feature gates table
CREATE TABLE IF NOT EXISTS feature_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  free_tier_limit INTEGER, -- daily limit for free users
  premium_unlimited BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default feature gates
INSERT INTO feature_gates (feature_name, description, free_tier_limit, premium_unlimited) VALUES
  ('daily_likes', 'Number of profiles you can like per day', 3, true),
  ('slow_dating_matches', 'Number of slow dating matches per day', 5, true),
  ('profile_boosts', 'Number of profile boosts per day', 0, true),
  ('see_who_liked', 'View who liked your profile', 0, true),
  ('advanced_filters', 'Access to advanced search filters', 0, true),
  ('read_receipts', 'See when messages are read', 0, true),
  ('unlimited_rewinds', 'Unlimited profile rewinds', 0, true),
  ('incognito_mode', 'Browse profiles invisibly', 0, true)
ON CONFLICT (feature_name) DO NOTHING;

-- Subscription history for audit
CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- 'created', 'upgraded', 'downgraded', 'cancelled', 'renewed', 'expired'
  from_tier VARCHAR(20),
  to_tier VARCHAR(20),
  event_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subscription_history_subscription ON subscription_history(subscription_id);
CREATE INDEX idx_subscription_history_type ON subscription_history(event_type);
