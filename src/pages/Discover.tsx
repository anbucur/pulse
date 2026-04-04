import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import VibeCheck from '../components/VibeCheck';
import { Sparkles, Zap, Users, MapPin, Clock, Star, ChevronRight, TrendingUp, Flame, Target, MessageCircle } from 'lucide-react';

interface Suggestion {
  user_id: string;
  display_name?: string;
  photos?: string[];
  age?: number;
  bio?: string;
  compatibility_score?: number;
  vibe_match?: string;
  intent?: string[];
  interests?: string[];
  lat?: number;
  lng?: number;
}

export default function Discover() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [trendingTags, setTrendingTags] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'vibes' | 'suggestions' | 'trending'>('suggestions');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchSuggestions();
    fetchTrending();
  }, [user]);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/profiles/search?limit=10&sort=compatibility', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.profiles || []);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrending = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/profiles/trending-tags', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTrendingTags(data.tags || []);
      }
    } catch (error) {
      console.error('Error fetching trending:', error);
    }
  };

  const startChat = async (otherUserId: string) => {
    if (!user) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/chat/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ participants: [user.id, otherUserId] }),
      });
      if (response.ok) {
        const room = await response.json();
        navigate(`/chat/${room.id}`);
      }
    } catch (e) {
      console.error('Error starting chat:', e);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold tracking-tight">Discover</h1>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-rose-500" />
          </div>
        </div>

        <div className="flex gap-1 bg-zinc-900 rounded-xl p-1">
          {[
            { key: 'suggestions', label: 'For You', icon: Target },
            { key: 'vibes', label: 'Vibes', icon: Zap },
            { key: 'trending', label: 'Trending', icon: TrendingUp },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === key ? 'bg-rose-500 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {activeTab === 'suggestions' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-rose-500" />
              <h2 className="text-lg font-semibold">AI-Powered Suggestions</h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" />
              </div>
            ) : suggestions.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No suggestions yet. Complete your profile for better matches.</p>
              </div>
            ) : (
              suggestions.map((profile) => (
                <div
                  key={profile.user_id}
                  className="bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800"
                >
                  <div className="flex p-4 gap-4">
                    <img
                      src={profile.photos?.[0] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.user_id}`}
                      alt={profile.display_name}
                      className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-lg">
                            {profile.display_name}, {profile.age}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                            <span className="text-sm text-zinc-400">Nearby</span>
                          </div>
                        </div>
                        {profile.compatibility_score && (
                          <div className="flex items-center gap-1 bg-rose-500/10 px-2.5 py-1 rounded-full">
                            <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                            <span className="text-sm font-bold text-rose-500">{profile.compatibility_score}%</span>
                          </div>
                        )}
                      </div>

                      <p className="text-sm text-zinc-400 mt-1.5 line-clamp-2">
                        {profile.bio || 'No bio provided.'}
                      </p>

                      {profile.intent && profile.intent.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {profile.intent.slice(0, 3).map((i, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-zinc-800 rounded-full text-xs text-zinc-300">
                              {i}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => startChat(profile.user_id)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 rounded-full text-sm font-medium transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Chat
                        </button>
                        <button
                          onClick={() => navigate('/')}
                          className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-full text-sm font-medium transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                          Profile
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'vibes' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              <h2 className="text-lg font-semibold">Who's Active Right Now</h2>
            </div>
            <VibeCheck />
          </div>
        )}

        {activeTab === 'trending' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-semibold">Trending Now</h2>
            </div>

            {/* Trending Tags */}
            <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                Popular Tags
              </h3>
              {trendingTags.length === 0 ? (
                <div className="space-y-2">
                  {['adventurous', 'foodie', 'night-owl', 'gym-bro', 'creative', 'spontaneous', 'traveler', 'coffee-lover', 'tech', 'music'].map((tag, i) => (
                    <span key={tag} className="inline-block px-3 py-1.5 bg-zinc-800 rounded-full text-sm text-zinc-300 mr-2 mb-2">
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {trendingTags.map((tag, i) => (
                    <span key={i} className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-full text-sm text-rose-400">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-zinc-400">Online Now</span>
                </div>
                <p className="text-2xl font-bold">--</p>
              </div>
              <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm text-zinc-400">New Today</span>
                </div>
                <p className="text-2xl font-bold">--</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
