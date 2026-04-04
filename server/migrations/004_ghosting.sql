-- Anti-Ghosting System Tables

-- Social contract pledges between matched users
CREATE TABLE IF NOT EXISTS ghosting_pledges (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user1_pledge_status VARCHAR(20) DEFAULT 'pending' CHECK (user1_pledge_status IN ('pending', 'agreed', 'declined', 'revoked')),
  user2_pledge_status VARCHAR(20) DEFAULT 'pending' CHECK (user2_pledge_status IN ('pending', 'agreed', 'declined', 'revoked')),
  response_expectation_hours INTEGER DEFAULT 48 CHECK (response_expectation_hours IN (24, 48, 72)),
  both_agreed_at TIMESTAMP,
  pledge_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(match_id)
);

-- Response nudges scheduled and sent
CREATE TABLE IF NOT EXISTS response_nudges (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
  nudge_type VARCHAR(30) NOT NULL CHECK (nudge_type IN ('24h_reminder', '48h_reminder', '72h_reminder', 'friendly_check', 'pledge_reminder', 'gentle_nudge')),
  scheduled_for TIMESTAMP NOT NULL,
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  read_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'cancelled')),
  is_automated BOOLEAN DEFAULT true,
  custom_message TEXT,
  response_triggered BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ghosting metrics per user
CREATE TABLE IF NOT EXISTS ghost_metrics (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  pledges_agreed INTEGER DEFAULT 0,
  pledges_broken INTEGER DEFAULT 0,
  pledge_compliance_rate DECIMAL(5,2) DEFAULT 100.00,
  average_response_time_hours DECIMAL(10,2),
  longest_response_gap_hours INTEGER DEFAULT 0,
  nudges_sent INTEGER DEFAULT 0,
  nudges_responded INTEGER DEFAULT 0,
  nudge_response_rate DECIMAL(5,2),
  last_message_sent_at TIMESTAMP,
  last_message_responded_at TIMESTAMP,
  current_streak_days INTEGER DEFAULT 0,
  longest_streak_days INTEGER DEFAULT 0,
  reliability_score DECimal(5,2) DEFAULT 100.00,
  broken_pledge_incidents TEXT[] DEFAULT array[]::TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Message read receipts and timestamps
CREATE TABLE IF NOT EXISTS message_read_receipts (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  reader_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at TIMESTAMP,
  was_first_read BOOLEAN DEFAULT false,
  time_to_read_seconds INTEGER,
  UNIQUE(message_id, reader_id)
);

-- Last seen tracking
CREATE TABLE IF NOT EXISTS user_last_seen (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  last_active_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_chat_opened_at TIMESTAMP,
  last_profile_view_at TIMESTAMP,
  is_online BOOLEAN DEFAULT false,
  online_status_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ghosting_pledges_match ON ghosting_pledges(match_id);
CREATE INDEX IF NOT EXISTS idx_ghosting_pledges_users ON ghosting_pledges(user1_id, user2_id);
CREATE INDEX IF NOT EXISTS idx_response_nudges_match ON response_nudges(match_id);
CREATE INDEX IF NOT EXISTS idx_response_nudges_recipient ON response_nudges(recipient_id);
CREATE INDEX IF NOT EXISTS idx_response_nudges_status ON response_nudges(status);
CREATE INDEX IF NOT EXISTS idx_response_nudges_scheduled ON response_nudges(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_ghost_metrics_user ON ghost_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_message_read_receipts_message ON message_read_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_message_read_receipts_reader ON message_read_receipts(reader_id);
CREATE INDEX IF NOT EXISTS idx_user_last_seen_user ON user_last_seen(user_id);
CREATE INDEX IF NOT EXISTS idx_user_last_seen_online ON user_last_seen(is_online);
