-- Pulse Database Schema for PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    is_verified BOOLEAN DEFAULT false,
    is_premium BOOLEAN DEFAULT false,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    fcm_token VARCHAR(500),
    push_subscription JSONB
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Profiles table (rich profile data)
CREATE TABLE IF NOT EXISTS profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

    -- Basic Info
    display_name VARCHAR(100),
    age INTEGER,
    gender VARCHAR(50),
    pronouns VARCHAR(100),
    bio TEXT,
    location VARCHAR(500),
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),

    -- Physical Attributes
    height VARCHAR(20),
    body_type VARCHAR(50),
    hair_color VARCHAR(50),
    eye_color VARCHAR(50),
    ethnicity VARCHAR(100),

    -- Sexual Profile
    sexual_orientation VARCHAR(100)[],
    relationship_status VARCHAR(50),
    relationship_style VARCHAR(100)[],
    sexual_role VARCHAR(100)[],
    experience_level VARCHAR(50),
    std_friendly BOOLEAN DEFAULT false,
    vaccinated BOOLEAN DEFAULT false,

    -- Kink Profile
    kinks JSONB,
    kink_preferences JSONB,

    -- Lifestyle
    education VARCHAR(100),
    occupation VARCHAR(100),
    income_level VARCHAR(50),
    smoking_habit VARCHAR(50),
    drinking_habit VARCHAR(50),
    exercise_habit VARCHAR(50),
    diet VARCHAR(50),

    -- Personality
    mbti VARCHAR(10),
    love_languages VARCHAR(100)[],
    attachment_style VARCHAR(50),
    communication_style VARCHAR(50),

    -- Interests & Tags
    interests VARCHAR(200)[],
    hobbies TEXT[],
    tags VARCHAR(200)[],

    -- Looking For
    intent VARCHAR(100)[],
    looking_for_age_range INTEGER[],
    looking_for_gender VARCHAR(100)[],
    looking_for_location_radius INTEGER,

    -- Privacy Settings (per-field privacy)
    privacy_settings JSONB,

    -- Media
    photos TEXT[],
    primary_photo_index INTEGER DEFAULT 0,
    video_url TEXT,
    album_photos JSONB,

    -- Verification
    is_verified BOOLEAN DEFAULT false,
    verification_method VARCHAR(100),
    verified_at TIMESTAMP,

    -- Premium Features
    is_ghost_mode BOOLEAN DEFAULT false,
    incognito_mode BOOLEAN DEFAULT false,
    boost_expires_at TIMESTAMP,
    broadcast TEXT,
    broadcast_expires_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    profile_views INTEGER DEFAULT 0,
    search_appears INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_profiles_location ON profiles(lat, lng);
CREATE INDEX IF NOT EXISTS idx_profiles_tags ON profiles USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_profiles_interests ON profiles USING GIN (interests);
CREATE INDEX IF NOT EXISTS idx_profiles_gender ON profiles(gender);
CREATE INDEX IF NOT EXISTS idx_profiles_orientation ON profiles USING GIN (sexual_orientation);

-- Compatibility Matrix
CREATE TABLE IF NOT EXISTS compatibility_matrices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    communication_score INTEGER,
    lifestyle_score INTEGER,
    values_score INTEGER,
    intimacy_score INTEGER,
    conflict_resolution_score INTEGER,
    growth_score INTEGER,

    overall_score INTEGER,

    strengths TEXT[],
    potential_challenges TEXT[],
    recommendations TEXT[],

    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, target_user_id)
);

CREATE INDEX IF NOT EXISTS idx_compatibility_user ON compatibility_matrices(user_id);
CREATE INDEX IF NOT EXISTS idx_compatibility_target ON compatibility_matrices(target_user_id);
CREATE INDEX IF NOT EXISTS idx_compatibility_overall ON compatibility_matrices(overall_score);

-- Consent Protocols
CREATE TABLE IF NOT EXISTS consent_protocols (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    boundaries JSONB,
    safe_words VARCHAR(100)[],
    check_in_frequency VARCHAR(50),
    first_meeting_preference VARCHAR(100),
    meeting_constraints TEXT[],

    std_status VARCHAR(100),
    last_test_date DATE,
    birth_control VARCHAR(100),
    protection_required BOOLEAN DEFAULT true,

    status VARCHAR(50) DEFAULT 'draft',
    responded_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, target_user_id)
);

CREATE INDEX IF NOT EXISTS idx_consent_user ON consent_protocols(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_status ON consent_protocols(status);

-- Vibe Checks (temporal mood/intent status)
CREATE TABLE IF NOT EXISTS vibe_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    current_mood VARCHAR(100)[],
    current_intent VARCHAR(100)[],
    availability VARCHAR(50),

    activity_status VARCHAR(100),
    activity_description TEXT,

    social_battery INTEGER,

    expires_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vibe_user ON vibe_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_vibe_expires ON vibe_checks(expires_at);
CREATE INDEX IF NOT EXISTS idx_vibe_mood ON vibe_checks USING GIN (current_mood);

-- Burner Chat Rooms
CREATE TABLE IF NOT EXISTS burner_chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,

    room_name VARCHAR(200),
    max_lifetime INTEGER,
    max_messages INTEGER,

    encryption_key TEXT,

    destruct_on_read BOOLEAN DEFAULT false,
    destruct_timer INTEGER,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_burner_expires ON burner_chats(expires_at);
CREATE INDEX IF NOT EXISTS idx_burner_created_by ON burner_chats(created_by);

-- Burner Chat Participants
CREATE TABLE IF NOT EXISTS burner_chat_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID REFERENCES burner_chats(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    public_key TEXT,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,

    UNIQUE(chat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_burner_participants_chat ON burner_chat_participants(chat_id);
CREATE INDEX IF NOT EXISTS idx_burner_participants_user ON burner_chat_participants(user_id);

-- Burner Chat Messages
CREATE TABLE IF NOT EXISTS burner_chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID REFERENCES burner_chats(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,

    encrypted_content TEXT NOT NULL,
    nonce TEXT,

    view_count INTEGER DEFAULT 0,
    max_views INTEGER DEFAULT 1,

    destruct_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_burner_messages_chat ON burner_chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_burner_messages_destruct ON burner_chat_messages(destruct_at);

-- Social Proof References
CREATE TABLE IF NOT EXISTS social_references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    about_user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    reference_type VARCHAR(50),
    interaction_date DATE,

    is_anonymous BOOLEAN DEFAULT true,

    respect_rating INTEGER,
    communication_rating INTEGER,
    safety_rating INTEGER,
    satisfaction_rating INTEGER,
    overall_rating INTEGER,

    would_meet_again BOOLEAN,
    feedback TEXT,
    strengths TEXT[],
    areas_for_improvement TEXT[],
    flags VARCHAR(100)[],

    is_mutual BOOLEAN DEFAULT false,
    confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(from_user_id, about_user_id)
);

CREATE INDEX IF NOT EXISTS idx_references_about ON social_references(about_user_id);
CREATE INDEX IF NOT EXISTS idx_references_from ON social_references(from_user_id);
CREATE INDEX IF NOT EXISTS idx_references_type ON social_references(reference_type);
CREATE INDEX IF NOT EXISTS idx_references_rating ON social_references(overall_rating);

-- Chat Rooms (persistent chats)
CREATE TABLE IF NOT EXISTS chat_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participants UUID[] NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,

    last_message_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    typing JSONB,
    unread_counts JSONB
);

CREATE INDEX IF NOT EXISTS idx_chat_participants ON chat_rooms USING GIN (participants);
CREATE INDEX IF NOT EXISTS idx_chat_last_message ON chat_rooms(last_message_at);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,

    text TEXT,
    media_url TEXT,
    media_type VARCHAR(50),

    is_view_once BOOLEAN DEFAULT false,
    viewed_at TIMESTAMP,
    reply_to UUID REFERENCES chat_messages(id) ON DELETE SET NULL,

    reactions JSONB,
    is_read BOOLEAN DEFAULT false,
    read_by UUID[],
    is_view_once_viewed BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

-- Profile Views
CREATE TABLE IF NOT EXISTS profile_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    viewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    profile_id UUID REFERENCES users(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_profile_views_profile ON profile_views(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewer ON profile_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_date ON profile_views(viewed_at);

-- Taps (likes, super likes, etc)
CREATE TABLE IF NOT EXISTS taps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    to_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tap_type VARCHAR(50),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(from_user_id, to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_taps_from ON taps(from_user_id);
CREATE INDEX IF NOT EXISTS idx_taps_to ON taps(to_user_id);
CREATE INDEX IF NOT EXISTS idx_taps_type ON taps(tap_type);

-- Blocks
CREATE TABLE IF NOT EXISTS blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blocker_id UUID REFERENCES users(id) ON DELETE CASCADE,
    blocked_id UUID REFERENCES users(id) ON DELETE CASCADE,
    blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(200),

    UNIQUE(blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_id);

-- Matches (mutual likes)
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user1_id UUID REFERENCES users(id) ON DELETE CASCADE,
    user2_id UUID REFERENCES users(id) ON DELETE CASCADE,
    matched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user1_id, user2_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_user1 ON matches(user1_id);
CREATE INDEX IF NOT EXISTS idx_matches_user2 ON matches(user2_id);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100),
    title VARCHAR(200),
    body TEXT,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- Saved Phrases (for quick replies)
CREATE TABLE IF NOT EXISTS saved_phrases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_saved_phrases_user ON saved_phrases(user_id);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    details JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_consent_protocols_updated_at BEFORE UPDATE ON consent_protocols
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vibe_checks_updated_at BEFORE UPDATE ON vibe_checks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_references_updated_at BEFORE UPDATE ON social_references
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_rooms_updated_at BEFORE UPDATE ON chat_rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Scene Match - Events
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,

    title VARCHAR(200) NOT NULL,
    description TEXT,
    event_type VARCHAR(100),
    event_url TEXT,

    venue_name VARCHAR(200),
    venue_address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),

    event_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP,

    age_restriction VARCHAR(50),
    dress_code TEXT,
    ticket_price VARCHAR(100),
    ticket_url TEXT,

    tags VARCHAR(200)[],
    is_public BOOLEAN DEFAULT true,
    max_attendees INTEGER,

    status VARCHAR(50) DEFAULT 'upcoming',
    is_cancelled BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_location ON events(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_tags ON events USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);

-- Event Attendees
CREATE TABLE IF NOT EXISTS event_attendees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    attendance_status VARCHAR(50) DEFAULT 'attending',
    plus_ones INTEGER DEFAULT 0,
    notes TEXT,

    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_attendees_event ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user ON event_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_status ON event_attendees(attendance_status);

-- Event Matches (auto-generated matches between attendees)
CREATE TABLE IF NOT EXISTS event_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    user1_id UUID REFERENCES users(id) ON DELETE CASCADE,
    user2_id UUID REFERENCES users(id) ON DELETE CASCADE,

    compatibility_score INTEGER,
    shared_interests TEXT[],
    match_reason TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(event_id, user1_id, user2_id)
);

CREATE INDEX IF NOT EXISTS idx_event_matches_event ON event_matches(event_id);
CREATE INDEX IF NOT EXISTS idx_event_matches_users ON event_matches(user1_id, user2_id);
CREATE INDEX IF NOT EXISTS idx_event_matches_score ON event_matches(compatibility_score);

-- Negotiation Sessions
CREATE TABLE IF NOT EXISTS negotiation_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    initiated_by UUID REFERENCES users(id) ON DELETE CASCADE,
    with_user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    status VARCHAR(50) DEFAULT 'pending',

    phase VARCHAR(50) DEFAULT 'preferences',
    user1_completed BOOLEAN DEFAULT false,
    user2_completed BOOLEAN DEFAULT false,

    match_score INTEGER,
    highlighted_matches TEXT[],
    potential_gaps TEXT[],

    scheduled_meeting_at TIMESTAMP,
    meeting_notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(initiated_by, with_user_id)
);

CREATE INDEX IF NOT EXISTS idx_negotiation_initiated ON negotiation_sessions(initiated_by);
CREATE INDEX IF NOT EXISTS idx_negotiation_with ON negotiation_sessions(with_user_id);
CREATE INDEX IF NOT EXISTS idx_negotiation_status ON negotiation_sessions(status);

-- Negotiation Categories
CREATE TABLE IF NOT EXISTS negotiation_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

-- Negotiation Questions
CREATE TABLE IF NOT EXISTS negotiation_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES negotiation_categories(id) ON DELETE CASCADE,

    question_text TEXT NOT NULL,
    question_type VARCHAR(50) DEFAULT 'single_choice',
    options JSONB,

    allows_multiple BOOLEAN DEFAULT false,
    requires_explanation BOOLEAN DEFAULT false,

    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_negotiation_questions_category ON negotiation_questions(category_id);
CREATE INDEX IF NOT EXISTS idx_negotiation_questions_active ON negotiation_questions(is_active);

-- Negotiation Answers
CREATE TABLE IF NOT EXISTS negotiation_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES negotiation_sessions(id) ON DELETE CASCADE,
    question_id UUID REFERENCES negotiation_questions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    answer JSONB,
    explanation TEXT,

    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(session_id, question_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_negotiation_answers_session ON negotiation_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_negotiation_answers_user ON negotiation_answers(user_id);

-- Add triggers for new tables
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_event_attendees_updated_at BEFORE UPDATE ON event_attendees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_negotiation_sessions_updated_at BEFORE UPDATE ON negotiation_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default negotiation categories
INSERT INTO negotiation_categories (name, description, icon, display_order) VALUES
    ('Communication', 'How we talk and connect', 'message-circle', 1),
    ('Physical Intimacy', 'Boundaries, pace, and preferences', 'heart', 2),
    ('Social & Lifestyle', 'Social battery, habits, and routines', 'users', 3),
    ('Dating Expectations', 'What we are looking for', 'target', 4),
    ('Safety & Consent', 'Boundaries and agreements', 'shield', 5),
    ('Kinks & Fetishes', 'Shared interests and exploration', 'sparkles', 6)
ON CONFLICT (name) DO NOTHING;

-- Insert default negotiation questions
INSERT INTO negotiation_questions (category_id, question_text, question_type, options, allows_multiple, display_order)
SELECT
    c.id,
    'What is your preferred communication frequency?',
    'single_choice',
    '["Daily", "Every few days", "Weekly", "As needed", "I will let you know"]'::jsonb,
    false,
    1
FROM negotiation_categories c WHERE c.name = 'Communication'
UNION ALL
SELECT
    c.id,
    'What is your preferred response time?',
    'single_choice',
    '["Within hours", "Same day", "Within 24-48 hours", "Flexible"]'::jsonb,
    false,
    2
FROM negotiation_categories c WHERE c.name = 'Communication'
UNION ALL
SELECT
    c.id,
    'What is your preferred communication style?',
    'multiple_choice',
    '["Text messages", "Voice notes", "Video calls", "Phone calls", "In person"]'::jsonb,
    true,
    3
FROM negotiation_categories c WHERE c.name = 'Communication'
UNION ALL
SELECT
    c.id,
    'What pace are you comfortable with for physical intimacy?',
    'single_choice',
    '["Slow - multiple dates first", "Moderate - when it feels right", "Fast - chemistry is key", "Depends on the connection"]'::jsonb,
    false,
    1
FROM negotiation_categories c WHERE c.name = 'Physical Intimacy'
UNION ALL
SELECT
    c.id,
    'What are your boundaries for public displays of affection (PDA)?',
    'single_choice',
    '["Very comfortable", "Comfortable with hand-holding and light kisses", "Minimal PDA preferred", "No PDA"]'::jsonb,
    false,
    2
FROM negotiation_categories c WHERE c.name = 'Physical Intimacy'
UNION ALL
SELECT
    c.id,
    'What is your typical social battery like?',
    'single_choice',
    '["High - love socializing", "Medium - enjoy social events but need recharge time", "Low - prefer smaller gatherings", "Varies"]'::jsonb,
    false,
    1
FROM negotiation_categories c WHERE c.name = 'Social & Lifestyle'
UNION ALL
SELECT
    c.id,
    'What type of dates do you prefer?',
    'multiple_choice',
    '["Dinner and drinks", ' ||
    '"Activity-based (bowling, hiking, etc)", ' ||
    '"Coffee and conversation", ' ||
    '"Events and concerts", ' ||
    '"Creative dates (museums, galleries)"]'::jsonb,
    true,
    2
FROM negotiation_categories c WHERE c.name = 'Social & Lifestyle'
UNION ALL
SELECT
    c.id,
    'What are you looking for?',
    'multiple_choice',
    '["Casual dating", ' ||
    '"Serious relationship", ' ||
    '"Friendship with benefits", ' ||
    '"Play partner", ' ||
    '"Open to possibilities"]'::jsonb,
    true,
    1
FROM negotiation_categories c WHERE c.name = 'Dating Expectations'
UNION ALL
SELECT
    c.id,
    'How do you feel about exclusivity?',
    'single_choice',
    '["Monogamous - one partner at a time", ' ||
    '"Ethically non-monogamous", ' ||
    '"Open to discuss", ' ||
    '"Not looking for exclusivity right now"]'::jsonb,
    false,
    2
FROM negotiation_categories c WHERE c.name = 'Dating Expectations'
UNION ALL
SELECT
    c.id,
    'What is your approach to sexual health?',
    'single_choice',
    '["Regular testing (every 3-6 months)", ' ||
    '"Test before new partners", ' ||
    '"Test annually", ' ||
    '"Upon request"]'::jsonb,
    false,
    1
FROM negotiation_categories c WHERE c.name = 'Safety & Consent'
UNION ALL
SELECT
    c.id,
    'How important is discussing boundaries before meeting?',
    'single_choice',
    '["Essential - must discuss beforehand", ' ||
    '"Important - prefer to discuss", ' ||
    '"Flexible - can discuss when meeting", ' ||
    '"As needed"]'::jsonb,
    false,
    2
FROM negotiation_categories c WHERE c.name = 'Safety & Consent'
ON CONFLICT DO NOTHING;

-- Vibe Timeline - Daily mood/energy/appetite entries
CREATE TABLE IF NOT EXISTS vibe_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    date DATE NOT NULL,
    mood VARCHAR(50) NOT NULL,
    energy INTEGER DEFAULT 50,
    social_appetite INTEGER DEFAULT 50,
    note TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_vibe_entries_user ON vibe_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_vibe_entries_date ON vibe_entries(date);
CREATE INDEX IF NOT EXISTS idx_vibe_entries_mood ON vibe_entries(mood);

CREATE TRIGGER update_vibe_entries_updated_at BEFORE UPDATE ON vibe_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Wingman AI - Date briefings
CREATE TABLE IF NOT EXISTS wingman_briefings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    compatibility_score INTEGER,
    date_ideas TEXT[],
    conversation_starters TEXT[],
    compatibility_notes TEXT,
    key_observations TEXT[],

    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, target_user_id)
);

CREATE INDEX IF NOT EXISTS idx_wingman_user ON wingman_briefings(user_id);
CREATE INDEX IF NOT EXISTS idx_wingman_target ON wingman_briefings(target_user_id);
CREATE INDEX IF NOT EXISTS idx_wingman_generated ON wingman_briefings(generated_at);

-- Aftercare Check-In - Post-date feedback system
CREATE TABLE IF NOT EXISTS date_pairs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user1_id UUID REFERENCES users(id) ON DELETE CASCADE,
    user2_id UUID REFERENCES users(id) ON DELETE CASCADE,

    scheduled_date TIMESTAMP,
    met_at TIMESTAMP,

    status VARCHAR(50) DEFAULT 'scheduled',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user1_id, user2_id, scheduled_date)
);

CREATE INDEX IF NOT EXISTS idx_date_pairs_user1 ON date_pairs(user1_id);
CREATE INDEX IF NOT EXISTS idx_date_pairs_user2 ON date_pairs(user2_id);
CREATE INDEX IF NOT EXISTS idx_date_pairs_status ON date_pairs(status);
CREATE INDEX IF NOT EXISTS idx_date_pairs_date ON date_pairs(scheduled_date);

CREATE TABLE IF NOT EXISTS aftercare_checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date_pair_id UUID REFERENCES date_pairs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    rating INTEGER,
    would_see_again BOOLEAN,
    felt_safe BOOLEAN,

    what_went_well TEXT[],
    could_improve TEXT[],
    boundaries_respected BOOLEAN,
    communication_rating INTEGER,

    safety_concerns BOOLEAN DEFAULT false,
    safety_report TEXT,
    report_anonymous BOOLEAN DEFAULT true,

    wants_second_date BOOLEAN DEFAULT false,
    second_date_suggestions TEXT[],

    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(date_pair_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_aftercare_date_pair ON aftercare_checkins(date_pair_id);
CREATE INDEX IF NOT EXISTS idx_aftercare_user ON aftercare_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_aftercare_rating ON aftercare_checkins(rating);
CREATE INDEX IF NOT EXISTS idx_aftercare_safety ON aftercare_checkins(safety_concerns);

CREATE TRIGGER update_date_pairs_updated_at BEFORE UPDATE ON date_pairs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Tribe Hubs - Micro-communities
CREATE TABLE IF NOT EXISTS tribes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,

    name VARCHAR(200) NOT NULL,
    description TEXT,
    slug VARCHAR(200) UNIQUE,

    category VARCHAR(100),
    tags VARCHAR(200)[],

    location VARCHAR(500),
    is_location_based BOOLEAN DEFAULT false,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),

    icon VARCHAR(100),
    color VARCHAR(20),

    is_private BOOLEAN DEFAULT false,
    approval_required BOOLEAN DEFAULT false,

    max_members INTEGER,

    member_count INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tribes_slug ON tribes(slug);
CREATE INDEX IF NOT EXISTS idx_tribes_category ON tribes(category);
CREATE INDEX IF NOT EXISTS idx_tribes_location ON tribes(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_tribes_created_by ON tribes(created_by);

CREATE TABLE IF NOT EXISTS tribe_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tribe_id UUID REFERENCES tribes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    role VARCHAR(50) DEFAULT 'member',

    status VARCHAR(50) DEFAULT 'pending',

    joined_at TIMESTAMP,
    approved_at TIMESTAMP,
    left_at TIMESTAMP,

    notification_settings JSONB,

    UNIQUE(tribe_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tribe_members_tribe ON tribe_members(tribe_id);
CREATE INDEX IF NOT EXISTS idx_tribe_members_user ON tribe_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tribe_members_status ON tribe_members(status);
CREATE INDEX IF NOT EXISTS idx_tribe_members_role ON tribe_members(role);

CREATE TABLE IF NOT EXISTS tribe_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tribe_id UUID REFERENCES tribes(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,

    content TEXT NOT NULL,

    reply_to UUID REFERENCES tribe_messages(id) ON DELETE SET NULL,

    reactions JSONB,
    is_pinned BOOLEAN DEFAULT false,

    deleted_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tribe_messages_tribe ON tribe_messages(tribe_id);
CREATE INDEX IF NOT EXISTS idx_tribe_messages_sender ON tribe_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_tribe_messages_created ON tribe_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_tribe_messages_pinned ON tribe_messages(is_pinned);

CREATE TABLE IF NOT EXISTS tribe_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tribe_id UUID REFERENCES tribes(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,

    title VARCHAR(200) NOT NULL,
    description TEXT,

    event_date TIMESTAMP NOT NULL,
    venue_name VARCHAR(200),
    venue_address TEXT,
    location_url TEXT,

    max_attendees INTEGER,

    attendee_count INTEGER DEFAULT 0,

    status VARCHAR(50) DEFAULT 'upcoming',
    is_cancelled BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tribe_events_tribe ON tribe_events(tribe_id);
CREATE INDEX IF NOT EXISTS idx_tribe_events_date ON tribe_events(event_date);
CREATE INDEX IF NOT EXISTS idx_tribe_events_status ON tribe_events(status);

CREATE TABLE IF NOT EXISTS tribe_event_attendees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tribe_event_id UUID REFERENCES tribe_events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    status VARCHAR(50) DEFAULT 'attending',

    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tribe_event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tribe_event_attendees_event ON tribe_event_attendees(tribe_event_id);
CREATE INDEX IF NOT EXISTS idx_tribe_event_attendees_user ON tribe_event_attendees(user_id);

CREATE TRIGGER update_tribes_updated_at BEFORE UPDATE ON tribes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tribe_events_updated_at BEFORE UPDATE ON tribe_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
