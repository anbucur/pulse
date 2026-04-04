-- Add indexes for foreign keys to improve query performance
-- This migration creates indexes on all foreign key columns

-- Slow Dating indexes
CREATE INDEX IF NOT EXISTS idx_slowdating_daily_matches_user_id ON slowdating_daily_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_slowdating_daily_matches_match_id ON slowdating_daily_matches(match_id);
CREATE INDEX IF NOT EXISTS idx_slowdating_responses_user_id ON slowdating_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_slowdating_responses_match_id ON slowdating_responses(match_id);
CREATE INDEX IF NOT EXISTS idx_slowdating_preferences_user_id ON slowdating_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_slowdating_match_history_user_id ON slowdating_match_history(user_id);

-- Voice Profiles indexes
CREATE INDEX IF NOT EXISTS idx_voice_profile_plays_voice_profile_id ON voice_profile_plays(voice_profile_id);
CREATE INDEX IF NOT EXISTS idx_voice_profile_reactions_voice_profile_id ON voice_profile_reactions(voice_profile_id);

-- Conversation Starters indexes
CREATE INDEX IF NOT EXISTS idx_convo_starters_match_id ON convo_starters(match_id);

-- Ghosting Pledges indexes
CREATE INDEX IF NOT EXISTS idx_ghosting_pledges_user1_id ON ghosting_pledges(user1_id);
CREATE INDEX IF NOT EXISTS idx_ghosting_pledges_user2_id ON ghosting_pledges(user2_id);
CREATE INDEX IF NOT EXISTS idx_response_nudges_sender_id ON response_nudges(sender_id);
CREATE INDEX IF NOT EXISTS idx_response_nudges_message_id ON response_nudges(message_id);

-- Vouch indexes
CREATE INDEX IF NOT EXISTS idx_vouch_stats_most_common_tag_id ON vouch_stats(most_common_tag_id);

-- Completion Rewards indexes
CREATE INDEX IF NOT EXISTS idx_completion_rewards_milestone_id ON completion_rewards(milestone_id);

-- Photo Verification indexes
CREATE INDEX IF NOT EXISTS idx_photo_verifications_profile_photo_id ON photo_verifications(profile_photo_id);
CREATE INDEX IF NOT EXISTS idx_verification_audit_log_verification_id ON verification_audit_log(verification_id);

-- Location Sharing indexes
CREATE INDEX IF NOT EXISTS idx_location_shares_user_id ON location_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_location_shares_date_partner_id ON location_shares(date_partner_id);
CREATE INDEX IF NOT EXISTS idx_check_in_requests_requested_by_contact_id ON check_in_requests(requested_by_contact_id);
CREATE INDEX IF NOT EXISTS idx_emergency_broadcasts_share_id ON emergency_broadcasts(share_id);
CREATE INDEX IF NOT EXISTS idx_emergency_notifications_contact_id ON emergency_notifications(contact_id);
CREATE INDEX IF NOT EXISTS idx_location_updates_share_id ON location_updates(share_id);
CREATE INDEX IF NOT EXISTS idx_location_sharing_history_share_id ON location_sharing_history(share_id);

-- Event Discovery indexes
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_id ON event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user_id ON event_rsvps(user_id);
CREATE INDEX IF NOT EXISTS idx_event_attendance_rsvp_id ON event_attendance(rsvp_id);
CREATE INDEX IF NOT EXISTS idx_event_attendance_event_id ON event_attendance(event_id);
CREATE INDEX IF NOT EXISTS idx_discovered_events_user_id ON discovered_events(user_id);

-- Speed Dating indexes
CREATE INDEX IF NOT EXISTS idx_speed_dating_participants_event_id ON speed_dating_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_speed_dating_participants_user_id ON speed_dating_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_speed_dating_rounds_event_id ON speed_dating_rounds(event_id);
CREATE INDEX IF NOT EXISTS idx_speed_dating_matches_event_id ON speed_dating_matches(event_id);
CREATE INDEX IF NOT EXISTS idx_speed_dating_matches_participant1_id ON speed_dating_matches(participant1_id);
CREATE INDEX IF NOT EXISTS idx_speed_dating_matches_participant2_id ON speed_dating_matches(participant2_id);
CREATE INDEX IF NOT EXISTS idx_speed_dating_ratings_match_id ON speed_dating_ratings(match_id);
CREATE INDEX IF NOT EXISTS idx_speed_dating_rooms_match_id ON speed_dating_rooms(match_id);

-- Music Integration indexes
CREATE INDEX IF NOT EXISTS idx_music_discovery_settings_user_id ON music_discovery_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_music_matches_user1_id ON music_matches(user1_id);
CREATE INDEX IF NOT EXISTS idx_music_matches_user2_id ON music_matches(user2_id);
CREATE INDEX IF NOT EXISTS idx_music_interactions_profile_user_id ON music_interactions(profile_user_id);

-- Date Planner indexes
CREATE INDEX IF NOT EXISTS idx_date_plans_suggested_by ON date_plans(suggested_by);
CREATE INDEX IF NOT EXISTS idx_date_plans_venue_id ON date_plans(venue_id);
CREATE INDEX IF NOT EXISTS idx_date_suggestions_venue_id ON date_suggestions(venue_id);

-- Freemium indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_subscription_id ON subscription_history(subscription_id);

-- Referrals indexes
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referral_id ON referral_rewards(referral_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_referral_id ON referral_events(referral_id);

-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_slowdating_daily_matches_user_date ON slowdating_daily_matches(user_id, match_date DESC);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user_event ON event_rsvps(user_id, event_id);
CREATE INDEX IF NOT EXISTS idx_location_updates_share_created ON location_updates(share_id, created_at DESC);
