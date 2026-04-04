/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { asyncHandler, AppError } from '../utils/errors.js';
import { pool } from '../config/index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { randomUUID } from 'crypto';

const router = Router();
router.use(authenticate);

// Get current user's music profile
router.get('/profile', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(`
    SELECT
      mp.*,
      json_build_object(
        'spotify', mp.spotify_connected,
        'apple_music', mp.apple_music_connected
      ) as connected_services
    FROM music_profiles mp
    WHERE mp.user_id = $1
  `, [req.userId]);

  if (result.rows.length === 0) {
    // Create default profile
    await pool.query(`
      INSERT INTO music_profiles (user_id)
      VALUES ($1)
    `, [req.userId]);

    const newProfile = await pool.query(
      'SELECT * FROM music_profiles WHERE user_id = $1',
      [req.userId]
    );

    return res.json(newProfile.rows[0]);
  }

  res.json(result.rows[0]);
}));

// Connect music service (OAuth placeholder)
router.post('/connect', asyncHandler(async (req: AuthRequest, res) => {
  const { service, code, redirect_uri } = req.body;

  if (!['spotify', 'apple_music'].includes(service)) {
    throw new AppError('Invalid music service', 400);
  }

  // TODO: Implement actual OAuth flow with Spotify/Apple Music APIs
  // For now, create a placeholder connection
  const mockAccessToken = `mock_token_${randomUUID()}`;
  const mockRefreshToken = `mock_refresh_${randomUUID()}`;
  const tokenExpiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour

  const result = await pool.query(`
    INSERT INTO music_connections (
      user_id, service, access_token, refresh_token,
      token_expires_at, service_user_id, service_username
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (user_id, service)
    DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      token_expires_at = EXCLUDED.token_expires_at,
      is_active = true,
      updated_at = NOW()
    RETURNING *
  `, [req.userId, service, mockAccessToken, mockRefreshToken, tokenExpiresAt, `mock_id_${req.userId}`, `user_${req.userId}`]);

  // Update music profile connection status
  await pool.query(`
    INSERT INTO music_profiles (user_id, ${service}_connected, last_synced_at, sync_count)
    VALUES ($1, true, NOW(), 1)
    ON CONFLICT (user_id)
    DO UPDATE SET
      ${service}_connected = true,
      last_synced_at = NOW(),
      sync_count = music_profiles.sync_count + 1
  `, [req.userId]);

  res.json({
    success: true,
    connection: result.rows[0],
    message: `${service === 'spotify' ? 'Spotify' : 'Apple Music'} connected successfully`
  });
}));

// Sync music data (placeholder for actual API sync)
router.post('/sync', asyncHandler(async (req: AuthRequest, res) => {
  const { service } = req.body;

  if (!service || !['spotify', 'apple_music'].includes(service)) {
    throw new AppError('Valid service required', 400);
  }

  // Check if connected
  const connectionResult = await pool.query(
    'SELECT * FROM music_connections WHERE user_id = $1 AND service = $2 AND is_active = true',
    [req.userId, service]
  );

  if (connectionResult.rows.length === 0) {
    throw new AppError('Music service not connected', 400);
  }

  // TODO: Implement actual API sync with Spotify/Apple Music
  // For now, generate mock data
  const mockArtists = [
    'Taylor Swift', 'Drake', 'Bad Bunny', 'The Weeknd', 'Dua Lipa',
    'Harry Styles', 'Billie Eilish', 'Post Malone', 'Ariana Grande', 'Ed Sheeran'
  ];
  const mockGenres = ['Pop', 'Hip-Hop', 'R&B', 'Electronic', 'Indie', 'Rock', 'Latin', 'Alternative'];
  const mockRecentlyPlayed = [
    'Anti-Hero', 'As It Was', 'Bad Habit', 'Unholy', 'Lavender Haze'
  ];

  // Update music profile with synced data
  const result = await pool.query(`
    UPDATE music_profiles
    SET
      top_artists = $1,
      top_genres = $2,
      recently_played = $3,
      music_taste_score = $4,
      last_synced_at = NOW(),
      sync_count = sync_count + 1
    WHERE user_id = $5
    RETURNING *
  `, [
    mockArtists.sort(() => Math.random() - 0.5).slice(0, 5),
    mockGenres.sort(() => Math.random() - 0.5).slice(0, 4),
    mockRecentlyPlayed,
    { diversity: Math.floor(Math.random() * 40) + 60, mainstream: Math.floor(Math.random() * 40) + 40, energy: Math.floor(Math.random() * 40) + 60 },
    req.userId
  ]);

  // Update connection
  await pool.query(`
    UPDATE music_connections
    SET last_synced_at = NOW()
    WHERE user_id = $1 AND service = $2
  `, [req.userId, service]);

  res.json({
    success: true,
    profile: result.rows[0],
    message: 'Music data synced successfully'
  });
}));

// Disconnect music service
router.delete('/connect/:service', asyncHandler(async (req: AuthRequest, res) => {
  const { service } = req.params;

  if (!['spotify', 'apple_music'].includes(service)) {
    throw new AppError('Invalid music service', 400);
  }

  // Deactivate connection
  await pool.query(`
    UPDATE music_connections
    SET is_active = false
    WHERE user_id = $1 AND service = $2
  `, [req.userId, service]);

  // Update music profile
  await pool.query(`
    UPDATE music_profiles
    SET ${service}_connected = false
    WHERE user_id = $1
  `, [req.userId]);

  res.json({ success: true });
}));

// Get music-based matches
router.get('/matches', asyncHandler(async (req: AuthRequest, res) => {
  const { min_score = '50', limit = '20' } = req.query;

  // Check if user has music profile
  const userProfile = await pool.query(
    'SELECT * FROM music_profiles WHERE user_id = $1',
    [req.userId]
  );

  if (userProfile.rows.length === 0 || (!userProfile.rows[0].spotify_connected && !userProfile.rows[0].apple_music_connected)) {
    return res.json({ matches: [], message: 'Connect a music service to see matches' });
  }

  // Get music matches
  const result = await pool.query(`
    SELECT
      mm.*,
      p.display_name,
      p.age,
      p.gender,
      p.photos,
      p.primary_photo_index,
      p.bio,
      p.interests,
      mp2.top_artists as their_top_artists,
      mp2.top_genres as their_top_genres
    FROM music_matches mm
    JOIN profiles p ON p.user_id = CASE WHEN mm.user1_id = $1 THEN mm.user2_id ELSE mm.user1_id END
    JOIN music_profiles mp2 ON mp2.user_id = CASE WHEN mm.user1_id = $1 THEN mm.user2_id ELSE mm.user1_id END
    WHERE (mm.user1_id = $1 OR mm.user2_id = $1)
      AND mm.compatibility_score >= $2
    ORDER BY mm.compatibility_score DESC
    LIMIT $3
  `, [req.userId, parseInt(min_score as string), parseInt(limit as string)]);

  res.json({ matches: result.rows });
}));

// Calculate music compatibility with a specific user
router.get('/compatibility/:userId', asyncHandler(async (req: AuthRequest, res) => {
  const { userId } = req.params;

  // Check if both users have music profiles
  const myProfile = await pool.query(
    'SELECT * FROM music_profiles WHERE user_id = $1',
    [req.userId]
  );

  const theirProfile = await pool.query(
    'SELECT * FROM music_profiles WHERE user_id = $1',
    [userId]
  );

  if (myProfile.rows.length === 0 || theirProfile.rows.length === 0) {
    throw new AppError('One or both users do not have music profiles', 400);
  }

  // Calculate compatibility using the database function
  const result = await pool.query(`
    SELECT * FROM calculate_music_compatibility($1, $2)
  `, [req.userId, parseInt(userId)]);

  const compatibility = result.rows[0];

  // Store or update match record
  await pool.query(`
    INSERT INTO music_matches (user1_id, user2_id, compatibility_score, shared_artists, shared_genres, artist_affinity_score, genre_affinity_score)
    VALUES (LEAST($1, $2), GREATEST($1, $2), $3, $4, $5, $6, $7)
    ON CONFLICT (user1_id, user2_id)
    DO UPDATE SET
      compatibility_score = EXCLUDED.compatibility_score,
      shared_artists = EXCLUDED.shared_artists,
      shared_genres = EXCLUDED.shared_genres,
      artist_affinity_score = EXCLUDED.artist_affinity_score,
      genre_affinity_score = EXCLUDED.genre_affinity_score,
      updated_at = NOW()
  `, [
    req.userId,
    parseInt(userId),
    compatibility.compatibility_score,
    compatibility.shared_artists,
    compatibility.shared_genres,
    compatibility.artist_affinity,
    compatibility.genre_affinity
  ]);

  res.json(compatibility);
}));

// Get Music Mode discovery settings
router.get('/discovery-settings', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    'SELECT * FROM music_discovery_settings WHERE user_id = $1',
    [req.userId]
  );

  if (result.rows.length === 0) {
    // Create default settings
    await pool.query(`
      INSERT INTO music_discovery_settings (user_id)
      VALUES ($1)
    `, [req.userId]);

    const newSettings = await pool.query(
      'SELECT * FROM music_discovery_settings WHERE user_id = $1',
      [req.userId]
    );

    return res.json(newSettings.rows[0]);
  }

  res.json(result.rows[0]);
}));

// Update Music Mode discovery settings
router.put('/discovery-settings', asyncHandler(async (req: AuthRequest, res) => {
  const {
    music_mode_enabled,
    min_compatibility_score,
    preferred_genres,
    artists_to_match,
    artists_to_avoid,
    genre_weight,
    artist_weight,
    audio_feature_weight
  } = req.body;

  const result = await pool.query(`
    INSERT INTO music_discovery_settings (
      user_id, music_mode_enabled, min_compatibility_score, preferred_genres,
      artists_to_match, artists_to_avoid, genre_weight, artist_weight, audio_feature_weight
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (user_id)
    DO UPDATE SET
      music_mode_enabled = COALESCE(EXCLUDED.music_mode_enabled, music_discovery_settings.music_mode_enabled),
      min_compatibility_score = COALESCE(EXCLUDED.min_compatibility_score, music_discovery_settings.min_compatibility_score),
      preferred_genres = COALESCE(EXCLUDED.preferred_genres, music_discovery_settings.preferred_genres),
      artists_to_match = COALESCE(EXCLUDED.artists_to_match, music_discovery_settings.artists_to_match),
      artists_to_avoid = COALESCE(EXCLUDED.artists_to_avoid, music_discovery_settings.artists_to_avoid),
      genre_weight = COALESCE(EXCLUDED.genre_weight, music_discovery_settings.genre_weight),
      artist_weight = COALESCE(EXCLUDED.artist_weight, music_discovery_settings.artist_weight),
      audio_feature_weight = COALESCE(EXCLUDED.audio_feature_weight, music_discovery_settings.audio_feature_weight),
      updated_at = NOW()
    RETURNING *
  `, [
    req.userId,
    music_mode_enabled,
    min_compatibility_score,
    preferred_genres,
    artists_to_match,
    artists_to_avoid,
    genre_weight,
    artist_weight,
    audio_feature_weight
  ]);

  res.json(result.rows[0]);
}));

// Discover users with Music Mode
router.get('/discover', asyncHandler(async (req: AuthRequest, res) => {
  const { min_score = '50', limit = '20' } = req.query;

  // Get user's discovery settings
  const settingsResult = await pool.query(
    'SELECT * FROM music_discovery_settings WHERE user_id = $1 AND music_mode_enabled = true',
    [req.userId]
  );

  if (settingsResult.rows.length === 0) {
    return res.json({ users: [], message: 'Music Mode is not enabled' });
  }

  const settings = settingsResult.rows[0];
  const minScore = settings.min_compatibility_score || parseInt(min_score as string);

  // Discover compatible users
  const result = await pool.query(`
    SELECT DISTINCT
      p.user_id,
      p.display_name,
      p.age,
      p.gender,
      p.photos,
      p.primary_photo_index,
      p.bio,
      p.interests,
      p.location,
      mp.top_artists,
      mp.top_genres,
      mm.compatibility_score,
      mm.shared_artists,
      mm.shared_genres,
      mm.match_strength
    FROM profiles p
    JOIN music_profiles mp ON mp.user_id = p.user_id
    JOIN music_matches mm ON (mm.user1_id = p.user_id OR mm.user2_id = p.user_id)
    WHERE (mm.user1_id = $1 OR mm.user2_id = $1)
      AND p.user_id != $1
      AND mm.compatibility_score >= $2
      AND (mm.user1_interest = false OR mm.user2_interest = false)
      AND (mp.display_music_data = true)
    ORDER BY mm.compatibility_score DESC
    LIMIT $3
  `, [req.userId, minScore, parseInt(limit as string)]);

  res.json({ users: result.rows });
}));

// Express interest in a music match
router.post('/matches/:userId/interest', asyncHandler(async (req: AuthRequest, res) => {
  const { userId } = req.params;
  const { interested = true } = req.body;

  // Update match interest
  await pool.query(`
    UPDATE music_matches
    SET
      ${req.userId < parseInt(userId) ? 'user1_interest' : 'user2_interest'} = $1,
      mutual_match = CASE
        WHEN ${req.userId < parseInt(userId) ? 'user2_interest' : 'user1_interest'} = true THEN true
        ELSE mutual_match
      END,
      updated_at = NOW()
    WHERE (user1_id = $2 AND user2_id = $3) OR (user1_id = $3 AND user2_id = $2)
  `, [interested, req.userId, parseInt(userId)]);

  // Update stats
  await pool.query(`
    INSERT INTO music_stats (user_id, total_matches)
    VALUES ($1, 1)
    ON CONFLICT (user_id)
    DO UPDATE SET
      total_matches = music_stats.total_matches + 1,
      mutual_matches = CASE WHEN $2 THEN music_stats.mutual_matches + 1 ELSE music_stats.mutual_matches END
  `, [req.userId, interested]);

  res.json({ success: true });
}));

// Record music interaction
router.post('/interactions', asyncHandler(async (req: AuthRequest, res) => {
  const { profile_user_id, interaction_type, metadata } = req.body;

  await pool.query(`
    INSERT INTO music_interactions (user_id, profile_user_id, interaction_type, metadata)
    VALUES ($1, $2, $3, $4)
  `, [req.userId, profile_user_id, interaction_type, metadata]);

  res.json({ success: true });
}));

// Get another user's music profile
router.get('/profile/:userId', asyncHandler(async (req: AuthRequest, res) => {
  const { userId } = req.params;

  // Check if user allows displaying music data
  const profileResult = await pool.query(`
    SELECT
      mp.*,
      p.display_name,
      p.age,
      p.gender,
      p.photos,
      p.primary_photo_index
    FROM music_profiles mp
    JOIN profiles p ON p.user_id = mp.user_id
    WHERE mp.user_id = $1 AND mp.display_music_data = true
  `, [userId]);

  if (profileResult.rows.length === 0) {
    throw new AppError('Music profile not found or private', 404);
  }

  // Record profile view interaction
  await pool.query(`
    INSERT INTO music_interactions (user_id, profile_user_id, interaction_type)
    VALUES ($1, $2, 'profile_view')
  `, [req.userId, userId]);

  res.json(profileResult.rows[0]);
}));

// Get user's music stats
router.get('/stats', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    'SELECT * FROM music_stats WHERE user_id = $1',
    [req.userId]
  );

  if (result.rows.length === 0) {
    // Create default stats
    await pool.query(`
      INSERT INTO music_stats (user_id)
      VALUES ($1)
    `, [req.userId]);

    const newStats = await pool.query(
      'SELECT * FROM music_stats WHERE user_id = $1',
      [req.userId]
    );

    return res.json(newStats.rows[0]);
  }

  res.json(result.rows[0]);
}));

export default router;
