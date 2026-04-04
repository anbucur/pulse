-- Friend Location Sharing System Tables

-- Trusted contacts (friends who can receive location)
CREATE TABLE IF NOT EXISTS trusted_contacts (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_name VARCHAR(100) NOT NULL,
  contact_phone VARCHAR(20),
  contact_email VARCHAR(255),
  relationship VARCHAR(50),
  priority INTEGER DEFAULT 0 CHECK (priority >= 0 AND priority <= 10),
  can_receive_location BOOLEAN DEFAULT true,
  can_receive_emergency BOOLEAN DEFAULT true,
  can_request_checkin BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  verification_method VARCHAR(30),
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Active location sharing sessions
CREATE TABLE IF NOT EXISTS location_shares (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_name VARCHAR(100),
  share_type VARCHAR(30) DEFAULT 'date' CHECK (share_type IN ('date', 'travel', 'emergency', 'manual', 'indefinite')),
  is_active BOOLEAN DEFAULT true,
  share_started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  share_ends_at TIMESTAMP,
  date_partner_id INTEGER REFERENCES users(id),
  date_location VARCHAR(255),
  emergency_broadcast BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Location updates during active sharing
CREATE TABLE IF NOT EXISTS location_updates (
  id SERIAL PRIMARY KEY,
  share_id INTEGER NOT NULL REFERENCES location_shares(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(10, 2),
  altitude DECIMAL(10, 2),
  speed DECIMAL(10, 2),
  heading DECIMAL(10, 2),
  battery_level INTEGER,
  is_moving BOOLEAN DEFAULT false,
  location_source VARCHAR(30) DEFAULT 'gps',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Check-in requests
CREATE TABLE IF NOT EXISTS check_in_requests (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_by_contact_id INTEGER REFERENCES trusted_contacts(id) ON DELETE SET NULL,
  request_type VARCHAR(30) DEFAULT 'manual' CHECK (request_type IN ('manual', 'scheduled', 'automated')),
  scheduled_for TIMESTAMP,
  due_by TIMESTAMP,
  message TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'overdue', 'cancelled')),
  reminder_sent BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Check-in responses
CREATE TABLE IF NOT EXISTS check_in_responses (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES check_in_requests(id) ON DELETE CASCADE,
  response_text TEXT,
  location_shared BOOLEAN DEFAULT false,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  response_method VARCHAR(30) DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Emergency broadcasts
CREATE TABLE IF NOT EXISTS emergency_broadcasts (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_id INTEGER REFERENCES location_shares(id) ON DELETE SET NULL,
  broadcast_type VARCHAR(30) DEFAULT 'sos' CHECK (broadcast_type IN ('sos', 'danger', 'medical', 'check_in_failed')),
  message TEXT,
  location_sent BOOLEAN DEFAULT false,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location_accuracy DECIMAL(10, 2),
  contacts_notified INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'false_alarm')),
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Emergency broadcast notifications to contacts
CREATE TABLE IF NOT EXISTS emergency_notifications (
  id SERIAL PRIMARY KEY,
  broadcast_id INTEGER NOT NULL REFERENCES emergency_broadcasts(id) ON DELETE CASCADE,
  contact_id INTEGER REFERENCES trusted_contacts(id) ON DELETE SET NULL,
  notification_method VARCHAR(30) CHECK (notification_type IN ('push', 'sms', 'email', 'call')),
  destination VARCHAR(255),
  status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled location sharing rules
CREATE TABLE IF NOT EXISTS scheduled_sharing_rules (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_name VARCHAR(100) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  days_of_week VARCHAR(20) DEFAULT '0,1,2,3,4,5,6',
  auto_activate BOOLEAN DEFAULT true,
  share_with_verified_contacts BOOLEAN DEFAULT true,
  share_with_contacts INTEGER[],
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Location sharing history (audit log)
CREATE TABLE IF NOT EXISTS location_sharing_history (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_id INTEGER REFERENCES location_shares(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trusted_contacts_user ON trusted_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_contacts_active ON trusted_contacts(user_id, active);
CREATE INDEX IF NOT EXISTS idx_location_shares_user ON location_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_location_shares_active ON location_shares(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_location_updates_share ON location_updates(share_id);
CREATE INDEX IF NOT EXISTS idx_location_updates_created ON location_updates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_check_in_requests_user ON check_in_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_check_in_requests_status ON check_in_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_check_in_requests_due ON check_in_requests(due_by);
CREATE INDEX IF NOT EXISTS idx_emergency_broadcasts_user ON emergency_broadcasts(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_broadcasts_status ON emergency_broadcasts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_emergency_notifications_broadcast ON emergency_notifications(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_rules_user ON scheduled_sharing_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_rules_active ON scheduled_sharing_rules(user_id, active);
CREATE INDEX IF NOT EXISTS idx_location_history_user ON location_sharing_history(user_id);
CREATE INDEX IF NOT EXISTS idx_location_history_created ON location_sharing_history(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_location_sharing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_trusted_contacts_updated_at
  BEFORE UPDATE ON trusted_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_location_sharing_updated_at();

CREATE TRIGGER update_location_shares_updated_at
  BEFORE UPDATE ON location_shares
  FOR EACH ROW
  EXECUTE FUNCTION update_location_sharing_updated_at();

CREATE TRIGGER update_check_in_requests_updated_at
  BEFORE UPDATE ON check_in_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_location_sharing_updated_at();

CREATE TRIGGER update_emergency_broadcasts_updated_at
  BEFORE UPDATE ON emergency_broadcasts
  FOR EACH ROW
  EXECUTE FUNCTION update_location_sharing_updated_at();

CREATE TRIGGER update_scheduled_sharing_rules_updated_at
  BEFORE UPDATE ON scheduled_sharing_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_location_sharing_updated_at();
