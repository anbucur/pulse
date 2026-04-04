-- Photo Verification System Tables (FaceCheck)

-- Photo verification attempts
CREATE TABLE IF NOT EXISTS photo_verifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  live_photo_url VARCHAR(500),
  profile_photo_id INTEGER,
  comparison_score DECIMAL(5,2),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'expired')),
  rejection_reason TEXT,
  attempt_count INTEGER DEFAULT 1,
  ip_address VARCHAR(45),
  user_agent TEXT,
  verified_at TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Verification badges (visual indicators on profile)
CREATE TABLE IF NOT EXISTS verification_badges (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  badge_type VARCHAR(30) DEFAULT 'verified' CHECK (badge_type IN ('verified', 'verified_plus', 'super_verified')),
  display_on_profile BOOLEAN DEFAULT true,
  last_verified_at TIMESTAMP,
  verification_count INTEGER DEFAULT 0,
  consecutive_verifications INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Verification audit log
CREATE TABLE IF NOT EXISTS verification_audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verification_id INTEGER REFERENCES photo_verifications(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  status_from VARCHAR(20),
  status_to VARCHAR(20),
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_photo_verifications_user ON photo_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_photo_verifications_status ON photo_verifications(status);
CREATE INDEX IF NOT EXISTS idx_photo_verifications_created ON photo_verifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_badges_user ON verification_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_badges_type ON verification_badges(badge_type);
CREATE INDEX IF NOT EXISTS idx_verification_audit_user ON verification_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_audit_verification ON verification_audit_log(verification_id);
CREATE INDEX IF NOT EXISTS idx_verification_audit_created ON verification_audit_log(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_verification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_photo_verifications_updated_at ON photo_verifications;
CREATE TRIGGER update_photo_verifications_updated_at
  BEFORE UPDATE ON photo_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_verification_updated_at();

DROP TRIGGER IF EXISTS update_verification_badges_updated_at ON verification_badges;
CREATE TRIGGER update_verification_badges_updated_at
  BEFORE UPDATE ON verification_badges
  FOR EACH ROW
  EXECUTE FUNCTION update_verification_updated_at();
