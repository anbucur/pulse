/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Heart,
  X,
  Sparkles,
  Clock,
  TrendingUp,
  Settings,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  UserPlus,
  Eye,
  Calendar,
  CheckCircle2,
} from 'lucide-react';

interface Match {
  id: number;
  user_id: string;
  match_id: number;
  compatibility_score: number;
  conversation_starters: string[];
  compatibility_reason: string;
  shared_interests: string[];
  display_name: string;
  age: number;
  gender: string;
  photos: string[];
  primary_photo_index: number;
  bio: string;
  location: string;
  tags: string[];
}

interface SlowDatingProps {
  onUserClick?: (userId: string) => void;
  onMessageClick?: (userId: string) => void;
}

export default function SlowDating({ onUserClick, onMessageClick }: SlowDatingProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [responseLoading, setResponseLoading] = useState(false);
  const [matchDate, setMatchDate] = useState<string>('');
  const [preferences, setPreferences] = useState({
    daily_match_count: 3,
    min_compatibility_score: 70,
    preferred_age_range: { min: 21, max: 100 },
    preferred_genders: [] as string[],
    focus_areas: [] as string[],
  });

  useEffect(() => {
    fetchDailyMatches();
    fetchPreferences();
  }, []);

  const fetchDailyMatches = async () => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/slowdating/daily', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch daily matches');
      }

      const data = await response.json();
      setMatches(data.matches || []);
      setMatchDate(data.date || new Date().toISOString().split('T')[0]);
      setCurrentMatchIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchPreferences = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/slowdating/preferences', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) return;

      const data = await response.json();
      setPreferences(data);
    } catch (err) {
      // Silently fail
    }
  };

  const respondToMatch = async (responseType: 'pass' | 'like' | 'skip') => {
    setResponseLoading(true);
    const currentMatch = matches[currentMatchIndex];

    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/slowdating/respond/${currentMatch.match_id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          response_type: responseType,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to record response');
      }

      const data = await res.json();

      // Move to next match
      if (currentMatchIndex < matches.length - 1) {
        setCurrentMatchIndex(currentMatchIndex + 1);
      } else {
        setMatches([]);
      }

      // Show mutual match notification
      if (data.mutual_match) {
        setError('🎉 It\'s a match!');
        setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to respond');
    } finally {
      setResponseLoading(false);
    }
  };

  const updatePreferences = async (newPrefs: typeof preferences) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/slowdating/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(newPrefs),
      });

      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }

      const data = await response.json();
      setPreferences(data);
      setShowPreferences(false);
      await fetchDailyMatches(); // Refresh with new preferences
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update preferences');
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-400';
    if (score >= 70) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const getScoreGradient = (score: number) => {
    if (score >= 85) return 'from-green-500 to-emerald-600';
    if (score >= 70) return 'from-yellow-500 to-amber-600';
    return 'from-orange-500 to-red-600';
  };

  const currentMatch = matches[currentMatchIndex];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-pink-500 border-t-transparent mb-4"></div>
          <p className="text-gray-400">Finding your perfect matches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-pink-500" />
              Slow Dating Mode
            </h2>
            <p className="text-gray-400 mt-1">
              Quality over quantity. Deep compatibility matches daily.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 hover:bg-white/10 rounded-lg transition"
              title="Match history"
            >
              <Calendar className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowPreferences(!showPreferences)}
              className="p-2 hover:bg-white/10 rounded-lg transition"
              title="Preferences"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {matchDate && (
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-400">
            <Clock className="w-4 h-4" />
            Matches for {new Date(matchDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        )}
      </div>

      {/* Error/Notification */}
      {error && (
        <div className={`rounded-lg p-4 ${error.includes('match') ? 'bg-green-500/20 border border-green-500/50 text-green-300' : 'bg-red-500/20 border border-red-500/50 text-red-300'}`}>
          {error}
        </div>
      )}

      {/* Preferences Modal */}
      {showPreferences && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Dating Preferences</h3>
              <button
                onClick={() => setShowPreferences(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Daily Matches</label>
                <select
                  value={preferences.daily_match_count}
                  onChange={(e) => setPreferences({ ...preferences, daily_match_count: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                >
                  <option value={3}>3 matches</option>
                  <option value={5}>5 matches</option>
                  <option value={7}>7 matches</option>
                  <option value={10}>10 matches (Premium)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Minimum Compatibility Score</label>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={preferences.min_compatibility_score}
                  onChange={(e) => setPreferences({ ...preferences, min_compatibility_score: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-gray-400">
                  <span>50%</span>
                  <span>{preferences.min_compatibility_score}%</span>
                  <span>100%</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Age Range</label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    value={preferences.preferred_age_range.min}
                    onChange={(e) => setPreferences({
                      ...preferences,
                      preferred_age_range: { ...preferences.preferred_age_range, min: parseInt(e.target.value) }
                    })}
                    className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                    placeholder="Min"
                  />
                  <input
                    type="number"
                    value={preferences.preferred_age_range.max}
                    onChange={(e) => setPreferences({
                      ...preferences,
                      preferred_age_range: { ...preferences.preferred_age_range, max: parseInt(e.target.value) }
                    })}
                    className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                    placeholder="Max"
                  />
                </div>
              </div>

              <button
                onClick={() => updatePreferences(preferences)}
                className="w-full px-6 py-3 bg-pink-500 hover:bg-pink-600 rounded-lg transition"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Match History</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="text-center py-8 text-gray-400">
              <Calendar className="w-12 h-12 mx-auto mb-3" />
              <p>Your match history will appear here</p>
            </div>
          </div>
        </div>
      )}

      {/* No Matches */}
      {matches.length === 0 && !loading && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center">
          <CheckCircle2 className="w-16 h-16 text-pink-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">All caught up!</h3>
          <p className="text-gray-400 mb-6">
            You've reviewed all your matches for today. Come back tomorrow for fresh connections.
          </p>
          <button
            onClick={fetchDailyMatches}
            className="px-6 py-3 bg-pink-500 hover:bg-pink-600 rounded-lg transition"
          >
            Refresh
          </button>
        </div>
      )}

      {/* Match Cards */}
      {currentMatch && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl overflow-hidden">
          {/* Match Counter */}
          <div className="bg-white/5 px-6 py-3 flex justify-between items-center">
            <span className="text-sm text-gray-400">
              Match {currentMatchIndex + 1} of {matches.length}
            </span>
            <div className="flex gap-1">
              {matches.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-2 h-2 rounded-full ${
                    idx === currentMatchIndex ? 'bg-pink-500' :
                    idx < currentMatchIndex ? 'bg-gray-600' : 'bg-gray-700'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="md:flex">
            {/* Photo */}
            <div className="md:w-2/5 relative">
              {currentMatch.photos && currentMatch.photos.length > 0 ? (
                <img
                  src={currentMatch.photos[currentMatch.primary_photo_index || 0]}
                  alt={currentMatch.display_name}
                  className="w-full h-96 md:h-full object-cover"
                />
              ) : (
                <div className="w-full h-96 md:h-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                  <span className="text-6xl font-bold text-white/30">
                    {currentMatch.display_name?.charAt(0) || '?'}
                  </span>
                </div>
              )}

              {/* Compatibility Score Overlay */}
              <div className="absolute top-4 left-4">
                <div className={`bg-gradient-to-r ${getScoreGradient(currentMatch.compatibility_score)} px-4 py-2 rounded-lg shadow-lg`}>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-white" />
                    <div>
                      <div className={`text-2xl font-bold ${getScoreColor(currentMatch.compatibility_score)}`}>
                        {currentMatch.compatibility_score.toFixed(0)}%
                      </div>
                      <div className="text-xs text-white/80">Compatible</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="md:w-3/5 p-6">
              <h3 className="text-2xl font-bold mb-2">{currentMatch.display_name}</h3>
              <p className="text-gray-400 mb-4">
                {currentMatch.age} • {currentMatch.gender} • {currentMatch.location}
              </p>

              {/* Compatibility Reason */}
              <div className="bg-white/5 rounded-lg p-4 mb-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-pink-500" />
                  Why you matched
                </h4>
                <p className="text-sm text-gray-300">{currentMatch.compatibility_reason}</p>
              </div>

              {/* Shared Interests */}
              {currentMatch.shared_interests && currentMatch.shared_interests.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold mb-2">Shared Interests</h4>
                  <div className="flex flex-wrap gap-2">
                    {currentMatch.shared_interests.map((interest, i) => (
                      <span key={i} className="px-3 py-1 bg-pink-500/20 text-pink-300 rounded-full text-sm">
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Bio */}
              {currentMatch.bio && (
                <div className="mb-4">
                  <h4 className="font-semibold mb-2">About</h4>
                  <p className="text-sm text-gray-300 line-clamp-3">{currentMatch.bio}</p>
                </div>
              )}

              {/* Conversation Starters */}
              <div className="mb-6">
                <h4 className="font-semibold mb-2">Conversation Starters</h4>
                <div className="space-y-2">
                  {currentMatch.conversation_starters.map((starter, i) => (
                    <div key={i} className="bg-white/5 rounded-lg p-3 text-sm text-gray-300">
                      💬 {starter}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => respondToMatch('pass')}
                  disabled={responseLoading}
                  className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg transition flex flex-col items-center gap-1"
                >
                  <X className="w-6 h-6" />
                  <span className="text-xs">Pass</span>
                </button>
                <button
                  onClick={() => respondToMatch('skip')}
                  disabled={responseLoading}
                  className="px-4 py-3 bg-gray-500/20 hover:bg-gray-500/30 border border-gray-500/50 rounded-lg transition flex flex-col items-center gap-1"
                >
                  <Clock className="w-6 h-6" />
                  <span className="text-xs">Later</span>
                </button>
                <button
                  onClick={() => respondToMatch('like')}
                  disabled={responseLoading}
                  className="px-4 py-3 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded-lg transition flex flex-col items-center gap-1"
                >
                  <Heart className="w-6 h-6" />
                  <span className="text-xs">Like</span>
                </button>
              </div>

              {/* Additional Actions */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                {onUserClick && (
                  <button
                    onClick={() => onUserClick(currentMatch.user_id)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    View Profile
                  </button>
                )}
                {onMessageClick && (
                  <button
                    onClick={() => onMessageClick(currentMatch.user_id)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Message
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
