import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { aiProvider } from '../lib/providers';
import { Search, Zap, MapPin, Filter, MessageCircle, Map as MapIcon, Grid as GridIcon, X, Sparkles, Radio, Flame, ShieldCheck, Heart, ThumbsUp, Ban, AlertTriangle, Target, Award, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet.heat';
import CompatibilityMatrix from '../components/CompatibilityMatrix';
import SocialProofReferences from '../components/SocialProofReferences';

// Fix leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Profile {
  user_id: string;
  display_name?: string;
  photos?: string[];
  video_url?: string;
  age?: number;
  height?: string;
  body_type?: string;
  sexual_role?: string[];
  intent?: string[];
  bio?: string;
  lat?: number;
  lng?: number;
  is_verified?: boolean;
  is_ghost_mode?: boolean;
  broadcast?: string;
  broadcast_expires_at?: string;
  tags?: string[];
  interests?: string[];
  location?: string;
}

function HeatmapLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    // @ts-ignore
    const heat = L.heatLayer(points, {
      radius: 25,
      blur: 15,
      maxZoom: 15,
      gradient: {
        0.4: '#3b82f6',
        0.6: '#8b5cf6',
        0.8: '#f43f5e',
        1.0: '#fbbf24'
      }
    }).addTo(map);

    return () => { map.removeLayer(heat); };
  }, [map, points]);

  return null;
}

function CollapsibleSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-zinc-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-2 font-semibold text-white">
          {icon}
          {title}
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export default function Grid() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [vibeMatch, setVibeMatch] = useState<{ score: number; reason: string } | null>(null);
  const [calculatingVibe, setCalculatingVibe] = useState(false);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [intentFilter, setIntentFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'distance' | 'lastActive'>('distance');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    minAge: 18, maxAge: 99,
    role: '',
    maxDistanceKm: 100
  });

  // Fetch my profile
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    fetch('/api/profiles/me', {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(setMyProfile)
      .catch(console.error);
  }, [user]);

  // Fetch profiles
  useEffect(() => {
    if (!user) return;
    fetchProfiles();
  }, [user, filters, intentFilter, sortBy]);

  const fetchProfiles = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filters.minAge) params.set('age_min', String(filters.minAge));
      if (filters.maxAge < 99) params.set('age_max', String(filters.maxAge));
      if (intentFilter && intentFilter !== 'Favorites') params.set('intent', intentFilter);
      if (filters.role) params.set('gender', filters.role);
      params.set('limit', '50');

      const response = await fetch(`/api/profiles/search?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setProfiles(data.profiles || []);
      }
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  };

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const handleSemanticSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const profileData = JSON.stringify(profiles.map(p => ({
        uid: p.user_id,
        age: p.age,
        role: p.sexual_role,
        intent: p.intent,
        bio: p.bio,
      })));

      const result = await aiProvider.generateText(
        `You are an AI matchmaking assistant for a dating app.
User query: "${searchQuery}"

Available profiles:
${profileData}

Return a JSON array of 'uid' strings that best match the query. Only return the JSON array, no markdown formatting.`,
        { model: 'gemini-2.5-flash' }
      );

      const matchedUids = JSON.parse(result.text || '[]');
      setProfiles(prev => {
        const matched = prev.filter(p => matchedUids.includes(p.user_id));
        const unmatched = prev.filter(p => !matchedUids.includes(p.user_id));
        return [...matched, ...unmatched];
      });
    } catch (error) {
      console.error('Error during semantic search:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const calculateVibeMatch = async (otherProfile: Profile) => {
    if (!myProfile) return;
    setCalculatingVibe(true);
    setVibeMatch(null);
    try {
      const result = await aiProvider.generateText(
        `Analyze these two dating profiles and calculate a "Vibe Match" score from 1 to 100.
Provide a 1-sentence explanation.

User 1 (Me):
Intent: ${myProfile.intent?.join(', ')}
Role: ${myProfile.sexual_role?.join(', ')}
Bio: ${myProfile.bio || 'None'}

User 2 (Them):
Intent: ${otherProfile.intent?.join(', ')}
Role: ${otherProfile.sexual_role?.join(', ')}
Bio: ${otherProfile.bio || 'None'}

Return JSON format: {"score": 85, "reason": "You both want to grab drinks right now and love techno."}`,
        { model: 'gemini-2.5-flash' }
      );
      setVibeMatch(JSON.parse(result.text || '{"score": 50, "reason": "Could be a match!"}'));
    } catch (error) {
      console.error('Error calculating vibe match:', error);
    } finally {
      setCalculatingVibe(false);
    }
  };

  const openProfile = async (profile: Profile) => {
    setSelectedProfile(profile);
    calculateVibeMatch(profile);
  };

  const handleTap = async (profileId: string) => {
    if (!user) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/profiles/tap/${profileId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ type: 'like' }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.match) {
          alert("It's a mutual match!");
        } else {
          alert('Woof sent!');
        }
      }
    } catch (e) {
      console.error('Error sending tap:', e);
    }
  };

  const handleBlock = async (profileId: string) => {
    if (!user) return;
    if (window.confirm('Are you sure you want to block this user?')) {
      try {
        const token = localStorage.getItem('token');
        await fetch(`/api/profiles/block/${profileId}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        alert('User blocked.');
        setSelectedProfile(null);
        fetchProfiles();
      } catch (e) {
        console.error('Error blocking user:', e);
      }
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

  const filteredProfiles = profiles.filter(p => {
    if (p.is_ghost_mode) return false;
    if (myProfile && p.lat && p.lng && myProfile.lat && myProfile.lng) {
      const dist = getDistance(myProfile.lat, myProfile.lng, p.lat, p.lng);
      if (dist > filters.maxDistanceKm) return false;
    }
    return true;
  });

  const activeBroadcasts = filteredProfiles.filter(p => p.broadcast && p.broadcast_expires_at && new Date(p.broadcast_expires_at) > new Date());

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      {/* Header & Search */}
      <div className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white tracking-tight">Pulse</h1>
          <div className="flex items-center space-x-3">
            <button onClick={() => setViewMode(viewMode === 'grid' ? 'map' : 'grid')} className="p-2 rounded-full bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
              {viewMode === 'grid' ? <MapIcon className="w-5 h-5" /> : <GridIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <form onSubmit={handleSemanticSearch} className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-zinc-500" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-10 py-3 border border-zinc-800 rounded-full leading-5 bg-zinc-900 text-zinc-300 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 sm:text-sm"
            placeholder="e.g. Muscular guys hosting right now..."
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {isSearching ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-rose-500"></div>
            ) : (
              <button type="button" onClick={() => setShowFilters(true)}>
                <Filter className="h-5 w-5 text-zinc-500 hover:text-white transition-colors" />
              </button>
            )}
          </div>
        </form>

        {/* Intent Filters */}
        <div className="flex overflow-x-auto gap-2 mt-4 pb-1 scrollbar-hide">
          {['All', 'Dates', 'Networking', 'Chat', 'Right Now'].map(intent => (
            <button
              key={intent}
              onClick={() => setIntentFilter(intent === 'All' ? null : intent)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                (intent === 'All' && !intentFilter) || intent === intentFilter
                  ? 'bg-rose-500 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {intent}
            </button>
          ))}
        </div>
      </div>

      {/* Broadcasts */}
      {viewMode === 'grid' && activeBroadcasts.length > 0 && (
        <div className="px-4 py-3 bg-zinc-900/50 border-b border-zinc-800 overflow-x-auto whitespace-nowrap scrollbar-hide">
          <div className="flex space-x-3">
            {activeBroadcasts.map(p => (
              <div key={`broadcast-${p.user_id}`} onClick={() => openProfile(p)} className="inline-flex items-center bg-zinc-800 rounded-full px-3 py-1.5 cursor-pointer hover:bg-zinc-700 transition-colors">
                <img src={p.photos?.[0] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.user_id}`} alt="" className="w-6 h-6 rounded-full mr-2 object-cover" />
                <span className="text-sm text-white font-medium mr-2">{p.display_name}</span>
                <span className="text-sm text-zinc-400 truncate max-w-[200px]">{p.broadcast}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content Area */}
      {viewMode === 'grid' ? (
        <div className="p-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {filteredProfiles.map((profile) => {
            const dist = myProfile?.lat && myProfile?.lng && profile.lat && profile.lng
              ? getDistance(myProfile.lat, myProfile.lng, profile.lat, profile.lng) : 0;
            const distDisplay = dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`;

            return (
              <div
                key={profile.user_id}
                onClick={() => openProfile(profile)}
                className="relative aspect-[3/4] rounded-xl overflow-hidden group cursor-pointer bg-zinc-900"
              >
                <img
                  src={profile.photos?.[0] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.user_id}`}
                  alt={profile.display_name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold text-lg leading-tight flex items-center">
                      {profile.display_name}, {profile.age}
                      {profile.is_verified && <ShieldCheck className="w-4 h-4 text-blue-500 ml-1" />}
                    </h3>
                  </div>
                  <div className="flex items-center text-zinc-300 text-xs mt-1 space-x-2">
                    <span className="flex items-center"><MapPin className="w-3 h-3 mr-0.5" /> {distDisplay}</span>
                    {profile.sexual_role && <span>• {profile.sexual_role.join(', ')}</span>}
                  </div>
                  {profile.intent && (
                    <div className="mt-2">
                      <div className="inline-block px-2 py-1 bg-white/10 backdrop-blur-sm rounded text-[10px] font-medium text-white uppercase tracking-wider">
                        {profile.intent.join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 relative z-0">
          <div className="absolute top-4 right-4 z-[1000]">
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={`p-3 rounded-full shadow-lg flex items-center justify-center transition-colors ${showHeatmap ? 'bg-rose-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}
            >
              <Flame className="w-5 h-5" />
            </button>
          </div>
          {myProfile && (
            <MapContainer
              center={[myProfile.lat || 37.7749, myProfile.lng || -122.4194]}
              zoom={13}
              style={{ height: '100%', width: '100%', minHeight: '400px' }}
              className="z-0"
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; OpenStreetMap contributors &copy; CARTO'
              />
              {showHeatmap ? (
                <HeatmapLayer
                  points={filteredProfiles.filter(p => p.lat && p.lng).map(p => [p.lat!, p.lng!, 0.5])}
                />
              ) : (
                filteredProfiles.filter(p => p.lat && p.lng).map(p => (
                  <Circle
                    key={`map-${p.user_id}`}
                    center={[p.lat!, p.lng!]}
                    radius={200}
                    pathOptions={{ color: '#f43f5e', fillColor: '#f43f5e', fillOpacity: 0.2, weight: 0 }}
                    eventHandlers={{ click: () => openProfile(p) }}
                  />
                ))
              )}
            </MapContainer>
          )}
        </div>
      )}

      {filteredProfiles.length === 0 && viewMode === 'grid' && (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-8 text-center">
          <Zap className="w-12 h-12 mb-4 opacity-20" />
          <p>No profiles found nearby.</p>
          <p className="text-sm mt-2">Try expanding your search or check back later.</p>
        </div>
      )}

      {/* Profile Modal */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setSelectedProfile(null)} className="absolute top-4 right-4 z-10 p-2 bg-black/50 rounded-full text-white hover:bg-black/70">
              <X className="w-5 h-5" />
            </button>

            <div className="relative h-96">
              <img src={selectedProfile.photos?.[0] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedProfile.user_id}`} alt={selectedProfile.display_name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/20 to-transparent"></div>
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <h2 className="text-3xl font-bold text-white flex items-center">
                  {selectedProfile.display_name}, {selectedProfile.age}
                  {selectedProfile.is_verified && <ShieldCheck className="w-6 h-6 text-blue-500 ml-2" />}
                </h2>
                <p className="text-zinc-300 mt-1">
                  {selectedProfile.sexual_role?.join(', ')}
                  {selectedProfile.height && ` • ${selectedProfile.height}`}
                  {selectedProfile.body_type && ` • ${selectedProfile.body_type}`}
                </p>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Vibe Match */}
              <div className="bg-zinc-800/50 rounded-2xl p-4 border border-zinc-700/50">
                <div className="flex items-center mb-2">
                  <Sparkles className="w-5 h-5 text-rose-500 mr-2" />
                  <h3 className="font-semibold text-white">AI Vibe Match</h3>
                </div>
                {calculatingVibe ? (
                  <div className="flex items-center text-zinc-400 text-sm">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-rose-500 mr-2"></div>
                    Analyzing compatibility...
                  </div>
                ) : vibeMatch ? (
                  <div>
                    <div className="flex items-center mb-2">
                      <div className="flex-1 bg-zinc-700 rounded-full h-2 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-rose-500 to-orange-500" style={{ width: `${vibeMatch.score}%` }}></div>
                      </div>
                      <span className="ml-3 font-bold text-white">{vibeMatch.score}%</span>
                    </div>
                    <p className="text-sm text-zinc-300">{vibeMatch.reason}</p>
                  </div>
                ) : null}
              </div>

              {selectedProfile.broadcast && selectedProfile.broadcast_expires_at && new Date(selectedProfile.broadcast_expires_at) > new Date() && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4">
                  <div className="flex items-center text-rose-500 mb-1">
                    <Radio className="w-4 h-4 mr-2" />
                    <span className="text-xs font-bold uppercase tracking-wider">Looking For</span>
                  </div>
                  <p className="text-white text-sm">{selectedProfile.broadcast}</p>
                </div>
              )}

              {selectedProfile.intent && (
                <div>
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Intent</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedProfile.intent.map((i, idx) => (
                      <span key={idx} className="inline-block px-3 py-1 bg-zinc-800 text-white rounded-lg text-sm">{i}</span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">About</h3>
                <p className="text-zinc-300 text-sm leading-relaxed">{selectedProfile.bio || 'No bio provided.'}</p>
              </div>

              {selectedProfile.interests && selectedProfile.interests.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Interests</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedProfile.interests.map((interest, idx) => (
                      <span key={idx} className="bg-rose-500/10 text-rose-500 border border-rose-500/20 px-3 py-1 rounded-full text-sm font-medium">{interest}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Compatibility Matrix (Collapsible) */}
              <CollapsibleSection
                icon={<Target className="w-5 h-5 text-pink-500" />}
                title="Compatibility Matrix"
              >
                <CompatibilityMatrix
                  targetUserId={selectedProfile.user_id}
                  targetUserName={selectedProfile.display_name}
                />
              </CollapsibleSection>

              {/* Social Proof References (Collapsible) */}
              <CollapsibleSection
                icon={<Award className="w-5 h-5 text-yellow-500" />}
                title="Social Proof"
              >
                <SocialProofReferences userId={selectedProfile.user_id} mode="view" />
              </CollapsibleSection>

              <div className="flex space-x-2">
                <button
                  onClick={() => handleTap(selectedProfile.user_id)}
                  className="flex-1 flex items-center justify-center px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-2xl font-bold transition-colors"
                >
                  <ThumbsUp className="w-5 h-5 mr-2" />
                  Like
                </button>
              </div>

              <button
                onClick={() => startChat(selectedProfile.user_id)}
                className="w-full flex items-center justify-center px-6 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-full font-bold text-lg transition-colors shadow-lg shadow-rose-500/20"
              >
                <MessageCircle className="w-6 h-6 mr-2" />
                Start Chat
              </button>

              <div className="flex justify-center space-x-4 pt-4 border-t border-zinc-800">
                <button onClick={() => handleBlock(selectedProfile.user_id)} className="text-sm text-zinc-500 hover:text-rose-500 transition-colors flex items-center">
                  <Ban className="w-4 h-4 mr-1" /> Block
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Drawer */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 w-full max-w-sm h-full overflow-y-auto p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Filters</h2>
              <button onClick={() => setShowFilters(false)} className="p-2 bg-zinc-800 rounded-full text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Sort By</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white">
                  <option value="distance">Distance</option>
                  <option value="lastActive">Recently Active</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Max Distance: {filters.maxDistanceKm}km</label>
                <input type="range" min="1" max="500" value={filters.maxDistanceKm} onChange={(e) => setFilters({...filters, maxDistanceKm: parseInt(e.target.value)})} className="w-full accent-rose-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Age Range: {filters.minAge} - {filters.maxAge}</label>
                <div className="flex space-x-2">
                  <input type="number" min="18" max="99" value={filters.minAge} onChange={(e) => setFilters({...filters, minAge: parseInt(e.target.value)})} className="w-1/2 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-white" />
                  <input type="number" min="18" max="99" value={filters.maxAge} onChange={(e) => setFilters({...filters, maxAge: parseInt(e.target.value)})} className="w-1/2 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-white" />
                </div>
              </div>

              <button
                onClick={() => { setFilters({ minAge: 18, maxAge: 99, role: '', maxDistanceKm: 100 }); setSortBy('distance'); }}
                className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
