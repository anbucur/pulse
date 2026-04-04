-- Friend Vouch System Tables

-- Vouch tags (predefined categories for what someone is being vouched for)
CREATE TABLE IF NOT EXISTS vouch_tags (
  id SERIAL PRIMARY KEY,
  tag_name VARCHAR(50) NOT NULL UNIQUE,
  tag_category VARCHAR(30) CHECK (tag_category IN ('personality', 'behavior', 'skill', 'social', 'safety', 'other')),
  description TEXT,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Friend vouches (endorsements from friends)
CREATE TABLE IF NOT EXISTS friend_vouches (
  id SERIAL PRIMARY KEY,
  vouch_for_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vouch_from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship_type VARCHAR(30) DEFAULT 'friend' CHECK (relationship_type IN ('friend', 'family', 'colleague', 'partner', 'met_in_person', 'online_friend')),
  known_for_years INTEGER CHECK (known_for_years >= 0 AND known_for_years <= 50),
  is_verified_connection BOOLEAN DEFAULT false,
  vouch_text TEXT,
  anonymous BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'removed')),
  admin_reviewed_at TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(vouch_for_id, vouch_from_id)
);

-- Vouch tag connections (many-to-many between vouches and tags)
CREATE TABLE IF NOT EXISTS vouch_tag_connections (
  id SERIAL PRIMARY KEY,
  vouch_id INTEGER NOT NULL REFERENCES friend_vouches(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES vouch_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(vouch_id, tag_id)
);

-- Vouch requests (ask someone to vouch for you)
CREATE TABLE IF NOT EXISTS vouch_requests (
  id SERIAL PRIMARY KEY,
  requested_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  responded_at TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(requested_by_id, requested_from_id)
);

-- Vouch reactions (likes/helpful votes on vouches)
CREATE TABLE IF NOT EXISTS vouch_reactions (
  id SERIAL PRIMARY KEY,
  vouch_id INTEGER NOT NULL REFERENCES friend_vouches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_type VARCHAR(20) DEFAULT 'helpful' CHECK (reaction_type IN ('helpful', 'agree', 'insightful')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(vouch_id, user_id)
);

-- Vouch statistics (aggregate data per user)
CREATE TABLE IF NOT EXISTS vouch_stats (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  total_vouches_received INTEGER DEFAULT 0,
  total_vouches_given INTEGER DEFAULT 0,
  total_vouch_requests_sent INTEGER DEFAULT 0,
  total_vouch_requests_received INTEGER DEFAULT 0,
  total_reactions_received INTEGER DEFAULT 0,
  most_common_tag_id INTEGER REFERENCES vouch_tags(id),
  trust_score DECIMAL(5,2) DEFAULT 0.00,
  verification_level VARCHAR(20) DEFAULT 'none' CHECK (verification_level IN ('none', 'basic', 'verified', 'highly_trusted')),
  last_vouch_received_at TIMESTAMP,
  last_vouch_given_at TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_friend_vouches_for ON friend_vouches(vouch_for_id);
CREATE INDEX IF NOT EXISTS idx_friend_vouches_from ON friend_vouches(vouch_from_id);
CREATE INDEX IF NOT EXISTS idx_friend_vouches_status ON friend_vouches(status);
CREATE INDEX IF NOT EXISTS idx_vouch_tag_connections_vouch ON vouch_tag_connections(vouch_id);
CREATE INDEX IF NOT EXISTS idx_vouch_tag_connections_tag ON vouch_tag_connections(tag_id);
CREATE INDEX IF NOT EXISTS idx_vouch_requests_by ON vouch_requests(requested_by_id);
CREATE INDEX IF NOT EXISTS idx_vouch_requests_from ON vouch_requests(requested_from_id);
CREATE INDEX IF NOT EXISTS idx_vouch_requests_status ON vouch_requests(status);
CREATE INDEX IF NOT EXISTS idx_vouch_reactions_vouch ON vouch_reactions(vouch_id);
CREATE INDEX IF NOT EXISTS idx_vouch_reactions_user ON vouch_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_vouch_stats_user ON vouch_stats(user_id);

-- Insert default vouch tags
INSERT INTO vouch_tags (tag_name, tag_category, description) VALUES
  ('great listener', 'personality', 'Always attentive and supportive'),
  ('fun at parties', 'social', 'Life of the party, brings energy'),
  ('respectful', 'behavior', 'Treats everyone with respect'),
  ('reliable', 'personality', 'Can be counted on'),
  ('honest', 'behavior', 'Trustworthy and truthful'),
  ('good communicator', 'skill', 'Expresses themselves clearly'),
  ('emotionally intelligent', 'personality', 'Understands emotions well'),
  ('safe to meet', 'safety', 'Vouches for in-person safety'),
  ('known for years', 'relationship', 'Long-term friend'),
  ('met in person', 'safety', 'Has met offline'),
  ('kind', 'personality', 'Genuinely caring person'),
  ('adventurous', 'personality', 'Loves trying new things'),
  ('great sense of humor', 'personality', 'Funny and entertaining'),
  ('supportive friend', 'relationship', 'Always there for friends'),
  ('boundary-respecting', 'behavior', 'Honors boundaries well')
ON CONFLICT (tag_name) DO NOTHING;
