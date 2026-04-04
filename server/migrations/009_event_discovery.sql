-- Event Discovery System Tables

-- Discovered events (local events from various sources)
CREATE TABLE IF NOT EXISTS discovered_events (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  source VARCHAR(50) NOT NULL, -- 'ticketmaster', 'eventbrite', 'meetup', 'manual', etc.
  source_event_id VARCHAR(255),
  source_url VARCHAR(500),
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('concert', 'party', 'rave', 'fetish', 'queer_event', 'meetup', 'cultural', 'social', 'other')),
  category VARCHAR(100),
  venue_name VARCHAR(255),
  venue_address VARCHAR(500),
  city VARCHAR(100),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  event_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  age_restriction VARCHAR(50),
  dress_code VARCHAR(255),
  ticket_price VARCHAR(100),
  ticket_url VARCHAR(500),
  image_url VARCHAR(500),
  is_18_plus BOOLEAN DEFAULT false,
  is_21_plus BOOLEAN DEFAULT false,
  tags TEXT[],
  organizer_name VARCHAR(255),
  organizer_url VARCHAR(500),
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Event categories for filtering
CREATE TABLE IF NOT EXISTS event_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(50),
  color VARCHAR(20),
  display_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RSVPs for discovered events
CREATE TABLE IF NOT EXISTS event_rsvps (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES discovered_events(id) ON DELETE CASCADE,
  rsvp_status VARCHAR(20) DEFAULT 'going' CHECK (rsvp_status IN ('going', 'maybe', 'interested')),
  plus_ones INTEGER DEFAULT 0,
  notes TEXT,
  check_in_status VARCHAR(20) DEFAULT 'not_checked_in' CHECK (check_in_status IN ('not_checked_in', 'checked_in', 'checked_out')),
  checked_in_at TIMESTAMP,
  checked_out_at TIMESTAMP,
  visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'friends', 'private')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, event_id)
);

-- Event attendance tracking (who actually attended)
CREATE TABLE IF NOT EXISTS event_attendance (
  id SERIAL PRIMARY KEY,
  rsvp_id INTEGER REFERENCES event_rsvps(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES discovered_events(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  checked_out_at TIMESTAMP,
  duration_minutes INTEGER,
  UNIQUE(user_id, event_id)
);

-- Event interests for recommendations
CREATE TABLE IF NOT EXISTS event_interests (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  preference_score INTEGER DEFAULT 5 CHECK (preference_score >= 1 AND preference_score <= 10),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, category)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_discovered_events_date ON discovered_events(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_discovered_events_type ON discovered_events(event_type);
CREATE INDEX IF NOT EXISTS idx_discovered_events_category ON discovered_events(category);
CREATE INDEX IF NOT EXISTS idx_discovered_events_location ON discovered_events(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_discovered_events_city ON discovered_events(city);
CREATE INDEX IF NOT EXISTS idx_discovered_events_source ON discovered_events(source);
CREATE INDEX IF NOT EXISTS idx_discovered_events_synced ON discovered_events(last_synced_at);

CREATE INDEX IF NOT EXISTS idx_event_rsvps_user ON event_rsvps(user_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event ON event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_status ON event_rsvps(rsvp_status);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_visibility ON event_rsvps(visibility);

CREATE INDEX IF NOT EXISTS idx_event_attendance_user ON event_attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_event_attendance_event ON event_attendance(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendance_checked_in ON event_attendance(checked_in_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_interests_user ON event_interests(user_id);
CREATE INDEX IF NOT EXISTS idx_event_interests_category ON event_interests(category);

CREATE INDEX IF NOT EXISTS idx_event_categories_active ON event_categories(active);
CREATE INDEX IF NOT EXISTS idx_event_categories_order ON event_categories(display_order);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_event_discovery_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_discovered_events_updated_at ON discovered_events;
CREATE TRIGGER update_discovered_events_updated_at
  BEFORE UPDATE ON discovered_events
  FOR EACH ROW
  EXECUTE FUNCTION update_event_discovery_updated_at();

DROP TRIGGER IF EXISTS update_event_categories_updated_at ON event_categories;
CREATE TRIGGER update_event_categories_updated_at
  BEFORE UPDATE ON event_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_event_discovery_updated_at();

DROP TRIGGER IF EXISTS update_event_rsvps_updated_at ON event_rsvps;
CREATE TRIGGER update_event_rsvps_updated_at
  BEFORE UPDATE ON event_rsvps
  FOR EACH ROW
  EXECUTE FUNCTION update_event_discovery_updated_at();

DROP TRIGGER IF EXISTS update_event_interests_updated_at ON event_interests;
CREATE TRIGGER update_event_interests_updated_at
  BEFORE UPDATE ON event_interests
  FOR EACH ROW
  EXECUTE FUNCTION update_event_discovery_updated_at();

-- Insert default categories
INSERT INTO event_categories (name, slug, description, icon, color, display_order) VALUES
  ('Concerts', 'concerts', 'Live music events and performances', 'music', '#8b5cf6', 1),
  ('Parties', 'parties', 'Nightlife, club events, and parties', 'party-popper', '#f97316', 2),
  ('Raves', 'raves', 'EDM, electronic music events', 'zap', '#ec4899', 3),
  ('Fetish Nights', 'fetish', 'Fetish and kink-friendly events', 'mask', '#ef4444', 4),
  ('Queer Events', 'queer', 'LGBTQ+ specific events and gatherings', 'rainbow', '#06b6d4', 5),
  ('Meetups', 'meetups', 'Social meetups and community gatherings', 'users', '#10b981', 6),
  ('Cultural', 'cultural', 'Art, theater, and cultural events', 'palette', '#f59e0b', 7)
ON CONFLICT (slug) DO NOTHING;
