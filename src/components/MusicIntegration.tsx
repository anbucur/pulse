/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Music,
  Spotify,
  Headphones,
  Heart,
  Users,
  Settings,
  RefreshCw,
  Link,
  LinkOff,
  TrendingUp,
  Disc,
  PlayCircle,
  X,
  ChevronDown,
  ChevronRight,
  Filter,
  Zap,
  Clock,
  Eye,
  MessageCircle
} from 'lucide-react';

interface Artist {
  name: string;
}

interface MusicProfile {
  id: number;
  user_id: number;
  spotify_connected: boolean;
  apple_music_connected: boolean;
  top_artists: string[];
  top_genres: string[];
  recently_played: string[];
  music_taste_score: {
    diversity: number;
    mainstream: number;
    energy: number;
  };
  last_synced_at: string;
  sync_count: number;
  display_music_data: boolean;
}

interface MusicMatch {
  user_id: number;
  display_name: string;
  age: number;
  gender: string;
  photos: string[];
  primary_photo_index: number;
  bio: string;
  interests: string[];
  location: string;
  their_top_artists: string[];
  their_top_genres: string[];
  compatibility_score: number;
  shared_artists: string[];
  shared_genres: string[];
  match_strength: string;
}

interface DiscoverySettings {
  music_mode_enabled: boolean;
  min_compatibility_score: number;
  preferred_genres: string[];
  artists_to_match: string[];
  artists_to_avoid: string[];
  genre_weight: number;
  artist_weight: number;
  audio_feature_weight: number;
}

interface MusicIntegrationProps {
  onUserClick?: (userId: number) => void;
  onMessageClick?: (userId: number) => void;
}

export default function MusicIntegration({ onUserClick, onMessageClick }: MusicIntegrationProps) {
  const [profile, setProfile] = useState<MusicProfile | null>(null);
  const [matches, setMatches] = useState<MusicMatch[]>([]);
  const [settings, setSettings] = useState<DiscoverySettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'matches' | 'settings'>('profile');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [expandedMatches, setExpandedMatches] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchProfile();
    fetchSettings();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/music/profile', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch music profile');

      const data = await response.json();
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchMatches = async () => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/music/matches', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch music matches');

      const data = await response.json();
      setMatches(data.matches || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/music/discovery-settings', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch settings');

      const data = await response.json();
      setSettings(data);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const connectService = async (service: 'spotify' | 'apple_music') => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/music/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ service }),
      });

      if (!response.ok) throw new Error(`Failed to connect ${service}`);

      await fetchProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const disconnectService = async (service: 'spotify' | 'apple_music') => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/music/connect/${service}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      await fetchProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const syncMusic = async (service: 'spotify' | 'apple_music') => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/music/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ service }),
      });

      if (!response.ok) throw new Error('Failed to sync music');

      await fetchProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleMusicMode = async () => {
    if (!settings) return;

    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/music/discovery-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...settings,
          music_mode_enabled: !settings.music_mode_enabled,
        }),
      });

      if (!response.ok) throw new Error('Failed to update settings');

      await fetchSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const expressInterest = async (userId: number) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/music/matches/${userId}/interest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ interested: true }),
      });
    } catch (err) {
      console.error('Failed to express interest:', err);
    }
  };

  const getMatchStrengthColor = (strength: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-500',
      medium: 'bg-blue-500',
      high: 'bg-purple-500',
      very_high: 'bg-pink-500',
    };
    return colors[strength] || colors.medium;
  };

  const getMatchStrengthLabel = (strength: string) => {
    const labels: Record<string, string> = {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      very_high: 'Very High',
    };
    return labels[strength] || 'Medium';
  };

  const toggleMatchExpansion = (userId: number) => {
    const newExpanded = new Set(expandedMatches);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedMatches(newExpanded);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Music className="w-6 h-6 text-purple-500" />
              Music Integration
            </h2>
            <p className="text-gray-400 mt-1">
              Connect your music services and match based on taste
            </p>
          </div>
          <button
            onClick={() => setActiveTab('settings')}
            className="p-2 hover:bg-white/10 rounded-lg transition"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === 'profile'
                ? 'bg-purple-500 text-white'
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            }`}
          >
            My Music
          </button>
          <button
            onClick={() => {
              setActiveTab('matches');
              fetchMatches();
            }}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === 'matches'
                ? 'bg-purple-500 text-white'
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            }`}
          >
            Music Matches
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && profile && (
        <div className="space-y-6">
          {/* Connection Status */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
            <h3 className="text-xl font-bold mb-4">Connected Services</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {/* Spotify */}
              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Spotify className="w-5 h-5 text-green-500" />
                    <span className="font-semibold">Spotify</span>
                  </div>
                  {profile.spotify_connected ? (
                    <button
                      onClick={() => disconnectService('spotify')}
                      className="text-red-400 hover:text-red-300 transition flex items-center gap-1 text-sm"
                    >
                      <LinkOff className="w-4 h-4" />
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => connectService('spotify')}
                      className="text-green-400 hover:text-green-300 transition flex items-center gap-1 text-sm"
                    >
                      <Link className="w-4 h-4" />
                      Connect
                    </button>
                  )}
                </div>
                {profile.spotify_connected && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Last synced:</span>
                      <span className="text-gray-300">
                        {profile.last_synced_at
                          ? new Date(profile.last_synced_at).toLocaleDateString()
                          : 'Never'}
                      </span>
                    </div>
                    <button
                      onClick={() => syncMusic('spotify')}
                      disabled={loading}
                      className="w-full px-3 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded-lg transition flex items-center justify-center gap-2 text-sm"
                    >
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                      Sync Now
                    </button>
                  </div>
                )}
              </div>

              {/* Apple Music */}
              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Headphones className="w-5 h-5 text-pink-500" />
                    <span className="font-semibold">Apple Music</span>
                  </div>
                  {profile.apple_music_connected ? (
                    <button
                      onClick={() => disconnectService('apple_music')}
                      className="text-red-400 hover:text-red-300 transition flex items-center gap-1 text-sm"
                    >
                      <LinkOff className="w-4 h-4" />
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => connectService('apple_music')}
                      className="text-green-400 hover:text-green-300 transition flex items-center gap-1 text-sm"
                    >
                      <Link className="w-4 h-4" />
                      Connect
                    </button>
                  )}
                </div>
                {profile.apple_music_connected && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Last synced:</span>
                      <span className="text-gray-300">
                        {profile.last_synced_at
                          ? new Date(profile.last_synced_at).toLocaleDateString()
                          : 'Never'}
                      </span>
                    </div>
                    <button
                      onClick={() => syncMusic('apple_music')}
                      disabled={loading}
                      className="w-full px-3 py-2 bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/50 rounded-lg transition flex items-center justify-center gap-2 text-sm"
                    >
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                      Sync Now
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Music Taste */}
          {profile.top_artists && profile.top_artists.length > 0 && (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Disc className="w-5 h-5 text-purple-500" />
                My Music Taste
              </h3>

              {/* Taste Score */}
              {profile.music_taste_score && (
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-white/5 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">Diversity</div>
                    <div className="text-2xl font-bold text-purple-400">
                      {profile.music_taste_score.diversity}%
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">Mainstream</div>
                    <div className="text-2xl font-bold text-blue-400">
                      {profile.music_taste_score.mainstream}%
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">Energy</div>
                    <div className="text-2xl font-bold text-pink-400">
                      {profile.music_taste_score.energy}%
                    </div>
                  </div>
                </div>
              )}

              {/* Top Artists */}
              <div className="mb-6">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Top Artists
                </h4>
                <div className="flex flex-wrap gap-2">
                  {profile.top_artists.map((artist, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm"
                    >
                      {artist}
                    </span>
                  ))}
                </div>
              </div>

              {/* Top Genres */}
              {profile.top_genres && profile.top_genres.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-semibold mb-3">Top Genres</h4>
                  <div className="flex flex-wrap gap-2">
                    {profile.top_genres.map((genre, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recently Played */}
              {profile.recently_played && profile.recently_played.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Recently Played
                  </h4>
                  <div className="space-y-2">
                    {profile.recently_played.map((track, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 bg-white/5 rounded-lg p-3"
                      >
                        <PlayCircle className="w-5 h-5 text-gray-400" />
                        <span className="text-gray-300">{track}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* No Music Data */}
          {(!profile.top_artists || profile.top_artists.length === 0) && (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center">
              <Music className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">
                Connect a music service and sync your data to see your music taste
              </p>
            </div>
          )}

          {/* Music Mode Toggle */}
          {settings && (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-500" />
                    Music Mode
                  </h3>
                  <p className="text-gray-400 text-sm mt-1">
                    Match with people based on music compatibility
                  </p>
                </div>
                <button
                  onClick={toggleMusicMode}
                  className={`px-6 py-3 rounded-lg transition font-semibold ${
                    settings.music_mode_enabled
                      ? 'bg-purple-500 hover:bg-purple-600 text-white'
                      : 'bg-white/5 hover:bg-white/10 text-gray-300'
                  }`}
                >
                  {settings.music_mode_enabled ? 'Enabled' : 'Enable Music Mode'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Matches Tab */}
      {activeTab === 'matches' && (
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
              <p className="mt-4 text-gray-400">Finding music matches...</p>
            </div>
          ) : matches.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center">
              <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-2">No music matches yet</p>
              <p className="text-gray-500 text-sm">Connect a music service to start matching</p>
            </div>
          ) : (
            matches.map((match) => (
              <div
                key={match.user_id}
                className="bg-white/10 backdrop-blur-lg rounded-2xl p-6"
              >
                <div className="flex items-start gap-4">
                  {/* Photo */}
                  {match.photos && match.photos.length > 0 && (
                    <img
                      src={match.photos[match.primary_photo_index || 0]}
                      alt={match.display_name}
                      className="w-20 h-20 rounded-xl object-cover"
                    />
                  )}

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-lg font-semibold">{match.display_name}</h4>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-semibold ${getMatchStrengthColor(
                              match.match_strength
                            )} text-white`}
                          >
                            {getMatchStrengthLabel(match.match_strength)} Match
                          </span>
                        </div>
                        <p className="text-sm text-gray-400">
                          {match.age} • {match.gender}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="text-2xl font-bold text-purple-400">
                            {match.compatibility_score}%
                          </div>
                          <div className="text-xs text-gray-400">Compatible</div>
                        </div>
                      </div>
                    </div>

                    {/* Compatibility Details */}
                    {(match.shared_artists.length > 0 || match.shared_genres.length > 0) && (
                      <div className="mb-3">
                        {match.shared_artists.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {match.shared_artists.slice(0, 3).map((artist, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs"
                              >
                                {artist}
                              </span>
                            ))}
                            {match.shared_artists.length > 3 && (
                              <span className="text-xs text-gray-400">
                                +{match.shared_artists.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                        {match.shared_genres.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {match.shared_genres.slice(0, 3).map((genre, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs"
                              >
                                {genre}
                              </span>
                            ))}
                            {match.shared_genres.length > 3 && (
                              <span className="text-xs text-gray-400">
                                +{match.shared_genres.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => expressInterest(match.user_id)}
                        className="px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg transition flex items-center gap-2"
                      >
                        <Heart className="w-4 h-4" />
                        Interested
                      </button>
                      {onUserClick && (
                        <button
                          onClick={() => onUserClick(match.user_id)}
                          className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition flex items-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          View Profile
                        </button>
                      )}
                      {onMessageClick && (
                        <button
                          onClick={() => onMessageClick(match.user_id)}
                          className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition flex items-center gap-2"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Message
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && settings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Music Mode Settings</h2>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Minimum Compatibility Score: {settings.min_compatibility_score}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.min_compatibility_score}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      min_compatibility_score: parseInt(e.target.value),
                    })
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Genre Weight: {settings.genre_weight}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.genre_weight}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      genre_weight: parseInt(e.target.value),
                    })
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Artist Weight: {settings.artist_weight}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.artist_weight}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      artist_weight: parseInt(e.target.value),
                    })
                  }
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
