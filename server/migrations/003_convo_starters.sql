-- AI Conversation Starters Tables

-- Cache of AI-generated conversation starters for matches
CREATE TABLE IF NOT EXISTS convo_starters (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  shared_interests TEXT[] DEFAULT array[]::TEXT[],
  conversation_prompts TEXT[] NOT NULL,
  fun_questions TEXT[] NOT NULL,
  deep_questions TEXT[] NOT NULL,
  compatibility_insights TEXT[] DEFAULT array[]::TEXT[],
  is_personalized BOOLEAN DEFAULT true,
  ai_model_version VARCHAR(50) DEFAULT 'gpt-4',
  language VARCHAR(10) DEFAULT 'en',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(match_id)
);

-- User feedback on conversation starters
CREATE TABLE IF NOT EXISTS convo_starter_feedback (
  id SERIAL PRIMARY KEY,
  convo_starter_id INTEGER NOT NULL REFERENCES convo_starters(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starter_type VARCHAR(20) NOT NULL CHECK (starter_type IN ('prompt', 'fun', 'deep', 'insight')),
  starter_text TEXT NOT NULL,
  feedback_type VARCHAR(20) NOT NULL CHECK (feedback_type IN ('used', 'helpful', 'not_helpful', 'reported')),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  led_to_conversation BOOLEAN DEFAULT false,
  response_time_hours INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(convo_starter_id, user_id, starter_text)
);

-- Track starter usage and effectiveness
CREATE TABLE IF NOT EXISTS convo_starter_analytics (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_generated INTEGER DEFAULT 0,
  total_used INTEGER DEFAULT 0,
  led_to_conversation INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2),
  starter_type_distribution JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_convo_starters_match ON convo_starters(match_id);
CREATE INDEX IF NOT EXISTS idx_convo_starter_feedback_user ON convo_starter_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_convo_starter_feedback_type ON convo_starter_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_convo_starter_analytics_date ON convo_starter_analytics(date);
