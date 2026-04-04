import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  User,
  MessageCircle,
  Lightbulb,
  Heart,
  Target,
  Users,
  Clock,
  Copy,
  Check,
  RefreshCw,
  ChevronRight,
  Zap,
  Shield,
  Coffee,
  Moon,
  Sun,
  PartyPopper,
  MapPin,
} from 'lucide-react';

interface Profile {
  user_id: string;
  display_name: string;
  age: number;
  gender: string;
  bio: string;
  photos: string[];
  interests: string[];
  location: string;
  mbti: string;
  love_languages: string[];
  attachment_style: string;
  relationship_style: string[];
}

interface Briefing {
  id: string;
  target_user_id: string;
  target_display_name: string;
  compatibility_score: number;
  date_ideas: string[];
  conversation_starters: string[];
  compatibility_notes: string;
  key_observations: string[];
  generated_at: string;
}

interface Match {
  id: string;
  matched_user_id: string;
  display_name: string;
  age: number;
  gender: string;
  photos: string[];
  primary_photo_index: number;
  bio: string;
  interests: string[];
  location: string;
}

export default function WingmanAI() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/wingman/matches', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch matches');
      }

      const data = await response.json();
      setMatches(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchBriefing = async (matchId: string) => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/wingman/${matchId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch briefing');
      }

      const data = await response.json();
      setBriefing(data);
      setSelectedMatch(matches.find(m => m.matched_user_id === matchId) || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const generateBriefing = async (matchId: string) => {
    setGenerating(true);
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/wingman/${matchId}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate briefing');
      }

      const data = await response.json();
      setBriefing(data);
      setSelectedMatch(matches.find(m => m.matched_user_id === matchId) || null);
      await fetchMatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getCompatibilityColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getCompatibilityBg = (score: number) => {
    if (score >= 80) return 'bg-green-400/20';
    if (score >= 60) return 'bg-yellow-400/20';
    if (score >= 40) return 'bg-orange-400/20';
    return 'bg-red-400/20';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-purple-500" />
              Wingman AI
            </h2>
            <p className="text-gray-400 mt-1">Get personalized date prep with AI-powered insights</p>
          </div>
          <button
            onClick={fetchMatches}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300 mb-4">
            {error}
          </div>
        )}

        {loading && matches.length === 0 ? (
          <div className="bg-white/5 rounded-lg p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
            <p className="mt-4 text-gray-400">Finding your matches...</p>
          </div>
        ) : matches.length === 0 ? (
          <div className="bg-white/5 rounded-lg p-12 text-center">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No matches yet. Match with someone to get AI-powered date prep!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {matches.map((match) => (
              <div
                key={match.id}
                className={`bg-white/5 rounded-lg p-4 cursor-pointer hover:bg-white/10 transition ${
                  selectedMatch?.matched_user_id === match.matched_user_id ? 'ring-2 ring-purple-500' : ''
                }`}
                onClick={() => fetchBriefing(match.matched_user_id)}
              >
                <div className="flex items-start gap-4">
                  {match.photos && match.photos.length > 0 ? (
                    <img
                      src={match.photos[match.primary_photo_index || 0]}
                      alt={match.display_name}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-white/10 flex items-center justify-center">
                      <User className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold">{match.display_name}</h3>
                    <p className="text-sm text-gray-400">{match.age} • {match.gender}</p>
                    {match.location && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {match.location}
                      </p>
                    )}
                    {match.interests && match.interests.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {match.interests.slice(0, 3).map((interest, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 bg-pink-500/20 text-pink-300 rounded-full">
                            {interest}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedMatch && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-6">
            {selectedMatch.photos && selectedMatch.photos.length > 0 ? (
              <img
                src={selectedMatch.photos[selectedMatch.primary_photo_index || 0]}
                alt={selectedMatch.display_name}
                className="w-20 h-20 rounded-lg object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-lg bg-white/10 flex items-center justify-center">
                <User className="w-10 h-10 text-gray-400" />
              </div>
            )}
            <div>
              <h3 className="text-xl font-bold">Date Prep: {selectedMatch.display_name}</h3>
              <p className="text-gray-400">AI-powered insights for your upcoming date</p>
            </div>
            {!briefing && (
              <button
                onClick={() => generateBriefing(selectedMatch.matched_user_id)}
                disabled={generating}
                className="ml-auto px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition flex items-center gap-2"
              >
                <Sparkles className="w-5 h-5" />
                {generating ? 'Generating...' : 'Generate Briefing'}
              </button>
            )}
          </div>

          {generating && (
            <div className="bg-white/5 rounded-lg p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
              <p className="mt-4 text-gray-400">Analyzing profiles and generating insights...</p>
            </div>
          )}

          {briefing && !generating && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Compatibility Score</span>
                  <div className={`px-3 py-1 rounded-full ${getCompatibilityBg(briefing.compatibility_score)}`}>
                    <span className={`text-2xl font-bold ${getCompatibilityColor(briefing.compatibility_score)}`}>
                      {briefing.compatibility_score}%
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => generateBriefing(selectedMatch.matched_user_id)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Regenerate
                </button>
              </div>

              {briefing.key_observations && briefing.key_observations.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-yellow-400" />
                    Key Observations
                  </h4>
                  <div className="grid gap-2">
                    {briefing.key_observations.map((obs, i) => (
                      <div key={i} className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                        <p className="text-sm">{obs}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {briefing.date_ideas && briefing.date_ideas.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Coffee className="w-5 h-5 text-pink-400" />
                    Date Ideas
                  </h4>
                  <div className="grid md:grid-cols-2 gap-3">
                    {briefing.date_ideas.map((idea, i) => (
                      <div key={i} className="bg-white/5 rounded-lg p-4 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-pink-400 font-bold">{i + 1}</span>
                        </div>
                        <p className="text-sm">{idea}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {briefing.conversation_starters && briefing.conversation_starters.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-blue-400" />
                    Conversation Starters
                  </h4>
                  <div className="space-y-2">
                    {briefing.conversation_starters.map((starter, i) => (
                      <div key={i} className="bg-white/5 rounded-lg p-4 flex items-start gap-3 group">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-blue-400 font-bold">{i + 1}</span>
                        </div>
                        <p className="text-sm flex-1">{starter}</p>
                        <button
                          onClick={() => copyToClipboard(starter)}
                          className="p-2 hover:bg-white/10 rounded-lg transition opacity-0 group-hover:opacity-100"
                        >
                          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {briefing.compatibility_notes && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Heart className="w-5 h-5 text-red-400" />
                    Compatibility Notes
                  </h4>
                  <div className="bg-white/5 rounded-lg p-4">
                    <p className="text-sm whitespace-pre-wrap">{briefing.compatibility_notes}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                Generated {new Date(briefing.generated_at).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      )}

      {!selectedMatch && matches.length > 0 && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center">
          <Target className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Select a match from above to get your AI-powered date briefing</p>
        </div>
      )}
    </div>
  );
}