import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, where, getDocs, addDoc, serverTimestamp, updateDoc, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Search, Zap, MapPin, Filter, MessageCircle, Map as MapIcon, Grid as GridIcon, X, Sparkles, Radio, Flame, ShieldCheck, Heart, ThumbsUp, Dog, Ban, AlertTriangle, PlusCircle, Crown } from 'lucide-react';
import { sendNotification } from '../lib/notifications';
import { callAI } from '../lib/ai';
import { toast } from '../lib/toast';
import { useNavigate } from 'react-router-dom';
import { uploadMedia } from '../lib/uploadMedia';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet.heat';
import MatchModal from '../components/MatchModal';

// Fix leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Profile {
  uid: string;
  displayName: string;
  photoURL: string;
  photos?: string[];
  videoURL?: string;
  age: number;
  height: number;
  weight: number;
  sexualRole: string;
  intent: string;
  bio: string;
  lat: number;
  lng: number;
  livePulseExpiresAt?: number;
  lastActive: number;
  isGhostMode?: boolean;
  broadcast?: string;
  broadcastExpiresAt?: number;
  isVerified?: boolean;
  hivStatus?: string;
  lastTested?: string;
  pronouns?: string;
  relationship?: string;
  bodyType?: string;
  boostExpiresAt?: number;
  incognitoMode?: boolean;
  messagingPref?: string;
  prepStatus?: string;
  travelCity?: string;
  tags?: string[];
  tribes?: string[];
  moodColor?: string;
  moodExpiresAt?: number;
}

function HeatmapLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    
    // @ts-ignore - leaflet.heat adds heatLayer to L
    const heat = L.heatLayer(points, {
      radius: 25,
      blur: 15,
      maxZoom: 15,
      gradient: {
        0.4: '#3b82f6', // blue
        0.6: '#8b5cf6', // purple
        0.8: '#f43f5e', // rose
        1.0: '#fbbf24'  // amber
      }
    }).addTo(map);

    return () => {
      map.removeLayer(heat);
    };
  }, [map, points]);

  return null;
}

export default function Grid() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [livePulseActive, setLivePulseActive] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [vibeMatch, setVibeMatch] = useState<{ score: number, reason: string } | null>(null);
  const [calculatingVibe, setCalculatingVibe] = useState(false);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [intentFilter, setIntentFilter] = useState<string | null>(null);
  const [selectedProfileAlbums, setSelectedProfileAlbums] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [viewingStory, setViewingStory] = useState<any | null>(null);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [storyText, setStoryText] = useState('');
  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [uploadingStory, setUploadingStory] = useState(false);
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState(0);
  const [matchedProfile, setMatchedProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!user || !selectedProfile) {
      setSelectedProfileAlbums([]);
      return;
    }
    const unsubscribeAlbums = onSnapshot(collection(db, `albums/${selectedProfile.uid}/photos`), (snapshot) => {
      setSelectedProfileAlbums(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribeAlbums();
  }, [user, selectedProfile]);

  const seedDemoProfiles = async () => {
    if (!myProfile) return;
    const demoProfiles = [
      {
        uid: 'demo_1',
        displayName: 'Alex',
        photoURL: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=400',
        age: 28,
        height: 180,
        weight: 75,
        sexualRole: 'Versatile',
        intent: 'Dates',
        bio: 'Looking for someone to explore the city with.',
        lat: myProfile.lat + 0.01,
        lng: myProfile.lng + 0.01,
        lastActive: Date.now(),
        isVerified: true
      },
      {
        uid: 'demo_2',
        displayName: 'Sam',
        photoURL: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=400',
        age: 32,
        height: 185,
        weight: 82,
        sexualRole: 'Top',
        intent: 'Right Now',
        bio: 'Hosting in downtown. Let me know if you are around.',
        lat: myProfile.lat - 0.01,
        lng: myProfile.lng - 0.01,
        livePulseExpiresAt: Date.now() + 3600000,
        lastActive: Date.now(),
        isVerified: true
      },
      {
        uid: 'demo_3',
        displayName: 'Jordan',
        photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400',
        age: 25,
        height: 175,
        weight: 70,
        sexualRole: 'Bottom',
        intent: 'Chat',
        bio: 'Just looking to chat and see where things go.',
        lat: myProfile.lat + 0.02,
        lng: myProfile.lng - 0.01,
        lastActive: Date.now()
      }
    ];

    for (const profile of demoProfiles) {
      await setDoc(doc(db, 'public_profiles', profile.uid), profile);
    }
  };

  const [sortBy, setSortBy] = useState<'distance' | 'lastActive' | 'boost'>('distance');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [likes, setLikes] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    minAge: 18, maxAge: 99,
    minHeight: 100, maxHeight: 250,
    minWeight: 40, maxWeight: 200,
    tribes: [] as string[],
    role: '',
    maxDistanceKm: 100
  });

  // Haversine distance calculation
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
    return R * c; // Distance in km
  };

  useEffect(() => {
    if (!user) return;

    // Fetch favorites
    const favUnsub = onSnapshot(collection(db, `favorites/${user.uid}/items`), (snap) => {
      setFavorites(snap.docs.map(doc => doc.id));
    });

    // Fetch likes sent
    const likesUnsub = onSnapshot(collection(db, `likes/${user.uid}/sent`), (snap) => {
      setLikes(snap.docs.map(doc => doc.id));
    });

    // Fetch own profile for Vibe Match
    getDoc(doc(db, 'public_profiles', user.uid)).then(snap => {
      if (snap.exists()) setMyProfile(snap.data() as Profile);
    });

    // Fetch all active profiles for MVP
    const q = query(collection(db, 'public_profiles'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedProfiles: Profile[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as Profile;
        if (doc.id !== user.uid && !data.isGhostMode) {
          fetchedProfiles.push(data);
        }
      });
      setProfiles(fetchedProfiles);
    });

    // Fetch stories (non-expired)
    const storiesUnsub = onSnapshot(collection(db, 'stories'), async (snap) => {
      const now = Date.now();
      const activeStories = snap.docs
        .map(d => ({ uid: d.id, ...d.data() }))
        .filter((s: any) => s.expiresAt > now)
        .sort((a: any, b: any) => b.createdAt - a.createdAt);
      // Resolve profile names for story circles
      const storiesWithProfiles = await Promise.all(activeStories.map(async (s: any) => {
        const pSnap = await getDoc(doc(db, 'public_profiles', s.uid));
        return { ...s, profile: pSnap.exists() ? pSnap.data() : null };
      }));
      setStories(storiesWithProfiles.filter((s: any) => s.profile));
    });

    return () => {
      unsubscribe();
      favUnsub();
      likesUnsub();
      storiesUnsub();
    };
  }, [user]);

  const handleSemanticSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const profileData = profiles.map(p => ({
        uid: p.uid,
        age: p.age,
        role: p.sexualRole,
        intent: p.intent,
        bio: p.bio,
        isLive: p.livePulseExpiresAt && p.livePulseExpiresAt > Date.now()
      }));

      const matchedUids = await callAI<string[]>('/api/ai/search', {
        searchQuery,
        profiles: profileData,
      });

      setProfiles(prev => {
        const matched = prev.filter(p => matchedUids.includes(p.uid));
        const unmatched = prev.filter(p => !matchedUids.includes(p.uid));
        return [...matched, ...unmatched];
      });
    } catch (error) {
      console.error("Error during semantic search", error);
      toast.error("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const calculateVibeMatch = async (otherProfile: Profile) => {
    if (!myProfile) return;
    setCalculatingVibe(true);
    setVibeMatch(null);
    try {
      const result = await callAI<{ score: number; reason: string }>('/api/ai/vibe-match', {
        myProfile: { intent: myProfile.intent, sexualRole: myProfile.sexualRole, bio: myProfile.bio },
        otherProfile: { intent: otherProfile.intent, sexualRole: otherProfile.sexualRole, bio: otherProfile.bio },
      });
      setVibeMatch(result);
    } catch (error) {
      console.error("Error calculating vibe match", error);
      setVibeMatch({ score: 50, reason: "Could be a match!" });
    } finally {
      setCalculatingVibe(false);
    }
  };

  const openProfile = async (profile: Profile) => {
    setSelectedProfile(profile);
    setSelectedPhotoIdx(0);
    calculateVibeMatch(profile);
    
    // Record profile view
    if (user && myProfile && !myProfile.incognitoMode) {
      try {
        await setDoc(doc(db, `profile_views/${profile.uid}/viewers/${user.uid}`), {
          viewedAt: Date.now()
        });
      } catch (e) {
        console.error("Error recording profile view", e);
      }
    }
  };

  const toggleFavorite = async (profileId: string) => {
    if (!user) return;
    const isFav = favorites.includes(profileId);
    try {
      if (isFav) {
        await deleteDoc(doc(db, `favorites/${user.uid}/items/${profileId}`));
      } else {
        await setDoc(doc(db, `favorites/${user.uid}/items/${profileId}`), { addedAt: Date.now() });
      }
    } catch (e) {
      console.error("Error toggling favorite", e);
    }
  };

  const toggleLike = async (profileId: string) => {
    if (!user) return;
    const isLiked = likes.includes(profileId);
    try {
      if (!isLiked) {
        await setDoc(doc(db, `likes/${user.uid}/sent/${profileId}`), { sentAt: Date.now() });
        // Check for mutual match
        const mutualSnap = await getDoc(doc(db, `likes/${profileId}/sent/${user.uid}`));
        if (mutualSnap.exists()) {
          // Show animated match modal and auto-create an accepted chat
          const likedProfile = profiles.find(p => p.uid === profileId) || selectedProfile;
          if (likedProfile) setMatchedProfile(likedProfile);
          // Auto-create chat so they can message immediately
          const { addDoc, collection: col } = await import('firebase/firestore');
          const existingChatSnap = await getDocs(query(
            col(db, 'chats'),
            where('participants', 'array-contains', user.uid)
          ));
          const alreadyHasChat = existingChatSnap.docs.some(d => {
            const parts = d.data().participants as string[];
            return parts.includes(profileId);
          });
          if (!alreadyHasChat) {
            await addDoc(col(db, 'chats'), {
              participants: [user.uid, profileId],
              updatedAt: Date.now(),
              lastMessage: '',
            });
          }
          sendNotification(profileId, "It's a match! 🎉", `You and ${myProfile?.displayName || 'someone'} liked each other!`);
          sendNotification(user.uid, "It's a match! 🎉", "You have a new mutual match!");
        } else {
          sendNotification(profileId, "New Like ❤️", `${myProfile?.displayName || 'Someone'} liked your profile!`);
        }
      }
    } catch (e) {
      console.error("Error toggling like", e);
      toast.error("Could not save like. Please try again.");
    }
  };

  const sendTap = async (profileId: string) => {
    if (!user) return;
    try {
      await setDoc(doc(db, `taps/${profileId}/received/${user.uid}`), {
        sentAt: Date.now(),
        emoji: 'woof',
        type: 'woof'
      });
      sendNotification(profileId, "Woof! 🐺", `${myProfile?.displayName || 'Someone'} woofed at you!`);
      alert("Woof sent! 🐺");
    } catch (e) {
      console.error("Error sending tap", e);
    }
  };

  const handleBlock = async (profileId: string) => {
    if (!user) return;
    if (window.confirm("Are you sure you want to block this user? They will no longer be able to see your profile or contact you.")) {
      try {
        await setDoc(doc(db, `blocks/${user.uid}/blocked/${profileId}`), {
          blockedAt: Date.now()
        });
        alert("User blocked.");
        setSelectedProfile(null);
      } catch (e) {
        console.error("Error blocking user", e);
      }
    }
  };

  const handleReport = async (profileId: string) => {
    if (!user) return;
    const reason = window.prompt("Please provide a reason for reporting this user:");
    if (reason) {
      try {
        await addDoc(collection(db, `reports`), {
          reporterId: user.uid,
          reportedId: profileId,
          reason,
          timestamp: Date.now(),
          status: 'pending'
        });
        alert("Report submitted. Thank you.");
        setSelectedProfile(null);
      } catch (e) {
        console.error("Error reporting user", e);
      }
    }
  };

  const startChat = async (otherUid: string) => {
    if (!user) return;

    // Check if chat already exists
    const chatsSnap = await getDocs(query(collection(db, 'chats'), where('participants', 'array-contains', user.uid)));
    let existingChatId: string | null = null;
    chatsSnap.forEach((d) => {
      if (d.data().participants.includes(otherUid)) existingChatId = d.id;
    });

    if (existingChatId) {
      navigate(`/chat/${existingChatId}`);
      return;
    }

    // Check target's messagingPref
    const targetProfile = profiles.find(p => p.uid === otherUid);
    if (targetProfile?.messagingPref === 'manual') {
      // Create a chat request instead
      const chatId = [user.uid, otherUid].sort().join('_');
      await setDoc(doc(db, 'chat_requests', chatId), {
        from: user.uid,
        to: otherUid,
        status: 'pending',
        createdAt: Date.now()
      });
      sendNotification(otherUid, "Chat Request 📬", `${myProfile?.displayName || 'Someone'} wants to chat with you!`);
      alert("Chat request sent! They'll be notified.");
      return;
    }

    const newChatRef = await addDoc(collection(db, 'chats'), {
      participants: [user.uid, otherUid],
      updatedAt: Date.now(),
      lastMessage: ""
    });
    navigate(`/chat/${newChatRef.id}`);
  };

  const toggleLivePulse = async () => {
    if (!user) return;
    const newStatus = !livePulseActive;
    setLivePulseActive(newStatus);
    
    try {
      await updateDoc(doc(db, 'public_profiles', user.uid), {
        livePulseExpiresAt: newStatus ? Date.now() + 60 * 60 * 1000 : null // 1 hour from now
      });
    } catch (error) {
      console.error("Error updating Live Pulse status", error);
      setLivePulseActive(!newStatus); // Revert on error
    }
  };

  useEffect(() => {
    if (!user) return;
    // Check own live pulse status
    const checkOwnStatus = async () => {
      const docSnap = await getDoc(doc(db, 'public_profiles', user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.livePulseExpiresAt && data.livePulseExpiresAt > Date.now()) {
          setLivePulseActive(true);
        }
      }
    };
    checkOwnStatus();
  }, [user]);

  const filteredProfiles = profiles.filter(p => {
    if (intentFilter === 'Favorites') return favorites.includes(p.uid);
    if (intentFilter && p.intent !== intentFilter) return false;
    
    // Advanced filters
    if (p.age < filters.minAge || p.age > filters.maxAge) return false;
    if (p.height < filters.minHeight || p.height > filters.maxHeight) return false;
    if (p.weight < filters.minWeight || p.weight > filters.maxWeight) return false;
    if (filters.role && p.sexualRole !== filters.role) return false;
    if (filters.tribes.length > 0 && (!p.tribes || !filters.tribes.some(t => p.tribes?.includes(t)))) return false;
    
    if (myProfile) {
      const dist = getDistance(myProfile.lat, myProfile.lng, p.lat, p.lng);
      if (dist > filters.maxDistanceKm) return false;
    }
    
    return true;
  }).sort((a, b) => {
    // Boosted profiles first
    const aBoost = a.boostExpiresAt && a.boostExpiresAt > Date.now() ? 1 : 0;
    const bBoost = b.boostExpiresAt && b.boostExpiresAt > Date.now() ? 1 : 0;
    if (aBoost !== bBoost) return bBoost - aBoost;

    if (sortBy === 'distance' && myProfile) {
      const distA = getDistance(myProfile.lat, myProfile.lng, a.lat, a.lng);
      const distB = getDistance(myProfile.lat, myProfile.lng, b.lat, b.lng);
      return distA - distB;
    } else if (sortBy === 'lastActive') {
      return b.lastActive - a.lastActive;
    }
    return 0;
  });

  const handleCreateStory = async () => {
    if (!user || (!storyFile && !storyText.trim())) return;
    setUploadingStory(true);
    try {
      let photoURL = '';
      if (storyFile) {
        photoURL = await uploadMedia(storyFile, `stories/${user.uid}/${Date.now()}_${storyFile.name}`);
      }
      const now = Date.now();
      await setDoc(doc(db, 'stories', user.uid), {
        photoURL,
        text: storyText.trim(),
        createdAt: now,
        expiresAt: now + 86400000 // 24h
      });
      setShowCreateStory(false);
      setStoryText('');
      setStoryFile(null);
      alert('Story posted! It will disappear in 24 hours.');
    } catch (e) {
      console.error('Error creating story', e);
    } finally {
      setUploadingStory(false);
    }
  };

  const activeBroadcasts = filteredProfiles.filter(p => p.broadcast && p.broadcastExpiresAt && p.broadcastExpiresAt > Date.now());

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      {/* Header & Search */}
      <div className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white tracking-tight">Pulse</h1>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setViewMode(viewMode === 'grid' ? 'map' : 'grid')}
              className="p-2 rounded-full bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              {viewMode === 'grid' ? <MapIcon className="w-5 h-5" /> : <GridIcon className="w-5 h-5" />}
            </button>
            <button 
              onClick={toggleLivePulse}
              className={`p-2 rounded-full transition-colors ${livePulseActive ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.5)]' : 'bg-zinc-800 text-zinc-400'}`}
            >
              <Zap className="w-5 h-5" />
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
            className="block w-full pl-10 pr-10 py-3 border border-zinc-800 rounded-full leading-5 bg-zinc-900 text-zinc-300 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 sm:text-sm transition-all"
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
          {['All', 'Favorites', 'Dates', 'Networking', 'Chat', 'Right Now'].map(intent => (
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

      {/* Stories Row */}
      {viewMode === 'grid' && (
        <div className="px-4 py-3 border-b border-zinc-800 overflow-x-auto scrollbar-hide">
          <div className="flex space-x-4">
            {/* Create Story button */}
            <button onClick={() => setShowCreateStory(true)} className="flex flex-col items-center space-y-1 flex-shrink-0">
              <div className="w-14 h-14 rounded-full bg-zinc-800 border-2 border-dashed border-zinc-600 flex items-center justify-center hover:border-rose-500 transition-colors">
                <PlusCircle className="w-6 h-6 text-zinc-400" />
              </div>
              <span className="text-[10px] text-zinc-400">Story</span>
            </button>
            {/* Story circles */}
            {stories.map((s) => (
              <button key={s.uid} onClick={() => setViewingStory(s)} className="flex flex-col items-center space-y-1 flex-shrink-0">
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-rose-500 p-0.5">
                  <img
                    src={s.photoURL || s.profile.photoURL}
                    alt={s.profile.displayName}
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
                <span className="text-[10px] text-zinc-400 truncate max-w-[56px]">{s.profile.displayName}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Broadcasts */}
      {viewMode === 'grid' && activeBroadcasts.length > 0 && (
        <div className="px-4 py-3 bg-zinc-900/50 border-b border-zinc-800 overflow-x-auto whitespace-nowrap scrollbar-hide">
          <div className="flex space-x-3">
            {activeBroadcasts.map(p => (
              <div key={`broadcast-${p.uid}`} onClick={() => openProfile(p)} className="inline-flex items-center bg-zinc-800 rounded-full px-3 py-1.5 cursor-pointer hover:bg-zinc-700 transition-colors">
                <img src={p.photoURL} alt="" className="w-6 h-6 rounded-full mr-2 object-cover" />
                <span className="text-sm text-white font-medium mr-2">{p.displayName}</span>
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
            const isLive = profile.livePulseExpiresAt && profile.livePulseExpiresAt > Date.now();
            const isBoosted = profile.boostExpiresAt && profile.boostExpiresAt > Date.now();
            const dist = myProfile ? getDistance(myProfile.lat, myProfile.lng, profile.lat, profile.lng) : 0;
            const distDisplay = dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`;

            return (
              <div 
                key={profile.uid} 
                onClick={() => openProfile(profile)}
                className="relative aspect-[3/4] rounded-xl overflow-hidden group cursor-pointer bg-zinc-900"
              >
                <img 
                  src={profile.photoURL} 
                  alt={profile.displayName}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                
                {/* Live Pulse Halo */}
                {isLive && (
                  <div className="absolute inset-0 border-2 border-rose-500 rounded-xl shadow-[inset_0_0_20px_rgba(244,63,94,0.3)] pointer-events-none"></div>
                )}

                {/* Mood Ring */}
                {profile.moodColor && profile.moodExpiresAt && profile.moodExpiresAt > Date.now() && !isLive && (
                  <div
                    className="absolute inset-0 rounded-xl pointer-events-none"
                    style={{ boxShadow: `inset 0 0 0 3px ${profile.moodColor}, inset 0 0 16px ${profile.moodColor}55` }}
                  ></div>
                )}

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>

                {/* Info */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold text-lg leading-tight flex items-center">
                      {profile.displayName}, {profile.age}
                      {profile.isVerified && <ShieldCheck className="w-4 h-4 text-blue-500 ml-1" title="Verified" />}
                      {isBoosted && <Zap className="w-4 h-4 text-amber-500 ml-1" title="Boosted" />}
                    </h3>
                    {isLive && <Zap className="w-4 h-4 text-rose-500 fill-rose-500" />}
                  </div>
                  <div className="flex items-center text-zinc-300 text-xs mt-1 space-x-2 flex-wrap">
                    <span className="flex items-center"><MapPin className="w-3 h-3 mr-0.5" /> {profile.travelCity || distDisplay}</span>
                    <span>•</span>
                    <span>{profile.sexualRole}</span>
                  </div>
                  <div className="mt-2 flex justify-between items-center">
                    <div className="inline-block px-2 py-1 bg-white/10 backdrop-blur-sm rounded text-[10px] font-medium text-white uppercase tracking-wider">
                      {profile.intent}
                    </div>
                  </div>
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
              className={`p-3 rounded-full shadow-lg flex items-center justify-center transition-colors ${showHeatmap ? 'bg-rose-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
              title="Toggle Heatmap"
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
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              />
              {showHeatmap ? (
                <HeatmapLayer 
                  points={filteredProfiles.map(p => [
                    p.lat, 
                    p.lng, 
                    p.livePulseExpiresAt && p.livePulseExpiresAt > Date.now() ? 1 : 0.5
                  ])} 
                />
              ) : (
                filteredProfiles.map(p => {
                  const isLive = p.livePulseExpiresAt && p.livePulseExpiresAt > Date.now();
                  return (
                    <Circle
                      key={`map-${p.uid}`}
                      center={[p.lat, p.lng]}
                      radius={isLive ? 400 : 200}
                      pathOptions={{
                        color: isLive ? '#f43f5e' : '#3b82f6',
                        fillColor: isLive ? '#f43f5e' : '#3b82f6',
                        fillOpacity: isLive ? 0.4 : 0.2,
                        weight: 0
                      }}
                      eventHandlers={{
                        click: () => openProfile(p)
                      }}
                    />
                  );
                })
              )}
            </MapContainer>
          )}
        </div>
      )}
      
      {filteredProfiles.length === 0 && viewMode === 'grid' && (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-8 text-center">
          <Zap className="w-12 h-12 mb-4 opacity-20" />
          <p>No profiles found nearby.</p>
          <p className="text-sm mt-2 mb-6">Try expanding your search or check back later.</p>
          <button 
            onClick={seedDemoProfiles}
            className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full font-medium transition-colors"
          >
            Load Demo Profiles
          </button>
        </div>
      )}

      {/* Profile Modal */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setSelectedProfile(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            {/* Photo Carousel */}
            <div className="relative h-96">
              {(() => {
                const allPhotos = [
                  selectedProfile.photoURL,
                  ...(selectedProfile.photos || []).filter((u: string) => u !== selectedProfile.photoURL)
                ].filter(Boolean);
                const currentPhoto = allPhotos[selectedPhotoIdx] || selectedProfile.photoURL;
                return (
                  <>
                    <img src={currentPhoto} alt={selectedProfile.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    {allPhotos.length > 1 && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedPhotoIdx(i => Math.max(0, i - 1)); }}
                          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70"
                        >‹</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedPhotoIdx(i => Math.min(allPhotos.length - 1, i + 1)); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70"
                        >›</button>
                        <div className="absolute bottom-16 left-0 right-0 flex justify-center gap-1">
                          {allPhotos.map((_: string, i: number) => (
                            <button key={i} onClick={() => setSelectedPhotoIdx(i)} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === selectedPhotoIdx ? 'bg-white' : 'bg-white/40'}`} />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                );
              })()}
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/20 to-transparent pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <h2 className="text-3xl font-bold text-white flex items-center flex-wrap gap-2">
                  {selectedProfile.displayName}, {selectedProfile.age}
                  {selectedProfile.isVerified && <ShieldCheck className="w-6 h-6 text-blue-500" title="Verified" />}
                  {selectedProfile.livePulseExpiresAt && selectedProfile.livePulseExpiresAt > Date.now() && (
                    <Zap className="w-5 h-5 text-rose-500 fill-rose-500" />
                  )}
                  {selectedProfile.boostExpiresAt && selectedProfile.boostExpiresAt > Date.now() && (
                    <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                  )}
                </h2>
                <p className="text-zinc-300 mt-1">
                  {selectedProfile.pronouns && <span className="mr-2">{selectedProfile.pronouns}</span>}
                  {selectedProfile.sexualRole} • {selectedProfile.height}cm • {selectedProfile.weight}kg
                </p>
                {selectedProfile.travelCity && (
                  <p className="text-xs text-amber-400 mt-1 flex items-center"><MapPin className="w-3 h-3 mr-1" />Traveling to {selectedProfile.travelCity}</p>
                )}
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Media Gallery */}
              {(selectedProfile.photos?.length > 0 || selectedProfile.videoURL) && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Media</h3>
                  
                  {/* Video */}
                  {selectedProfile.videoURL && (
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800">
                      <video src={selectedProfile.videoURL} controls className="w-full h-full object-cover" />
                    </div>
                  )}

                  {/* Photos */}
                  {selectedProfile.photos?.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {selectedProfile.photos.map((url: string, idx: number) => (
                        <div key={idx} className="relative aspect-[3/4] rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800">
                          <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Private Albums */}
              {selectedProfileAlbums.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Private Albums</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedProfileAlbums.map((photo) => (
                      <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800">
                        <img src={photo.url} alt="Private Album" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                        <div 
                          className="h-full bg-gradient-to-r from-rose-500 to-orange-500" 
                          style={{ width: `${vibeMatch.score}%` }}
                        ></div>
                      </div>
                      <span className="ml-3 font-bold text-white">{vibeMatch.score}%</span>
                    </div>
                    <p className="text-sm text-zinc-300">{vibeMatch.reason}</p>
                  </div>
                ) : null}
              </div>

              {selectedProfile.broadcast && selectedProfile.broadcastExpiresAt && selectedProfile.broadcastExpiresAt > Date.now() && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4">
                  <div className="flex items-center text-rose-500 mb-1">
                    <Radio className="w-4 h-4 mr-2" />
                    <span className="text-xs font-bold uppercase tracking-wider">Looking For</span>
                  </div>
                  <p className="text-white text-sm">{selectedProfile.broadcast}</p>
                </div>
              )}

              <div>
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Intent</h3>
                <div className="inline-block px-3 py-1 bg-zinc-800 text-white rounded-lg text-sm">
                  {selectedProfile.intent}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">About</h3>
                <p className="text-zinc-300 text-sm leading-relaxed">{selectedProfile.bio || "No bio provided."}</p>
              </div>

              {/* Extended Stats */}
              <div className="grid grid-cols-2 gap-4">
                {selectedProfile.pronouns && (
                  <div>
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Pronouns</h3>
                    <p className="text-sm text-white">{selectedProfile.pronouns}</p>
                  </div>
                )}
                {selectedProfile.relationship && (
                  <div>
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Relationship</h3>
                    <p className="text-sm text-white">{selectedProfile.relationship}</p>
                  </div>
                )}
                {selectedProfile.bodyType && (
                  <div>
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Body Type</h3>
                    <p className="text-sm text-white">{selectedProfile.bodyType}</p>
                  </div>
                )}
                {selectedProfile.hivStatus && (
                  <div>
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">HIV Status</h3>
                    <p className="text-sm text-white">{selectedProfile.hivStatus}</p>
                  </div>
                )}
              </div>

              {/* Tags & Tribes */}
              {(selectedProfile.tribes?.length > 0 || selectedProfile.tags?.length > 0) && (
                <div className="space-y-4">
                  {selectedProfile.tribes?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Tribes</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedProfile.tribes.map((tribe: string, idx: number) => (
                          <span key={idx} className="bg-rose-500/10 text-rose-500 border border-rose-500/20 px-3 py-1 rounded-full text-sm font-medium">
                            {tribe}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedProfile.tags?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Tags</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedProfile.tags.map((tag: string, idx: number) => (
                          <span key={idx} className="bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-sm">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex space-x-2">
                <button 
                  onClick={() => toggleFavorite(selectedProfile.uid)}
                  className={`flex-1 flex items-center justify-center px-4 py-3 rounded-2xl font-bold transition-colors ${favorites.includes(selectedProfile.uid) ? 'bg-rose-500/20 text-rose-500 border border-rose-500/50' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
                >
                  <Heart className={`w-5 h-5 mr-2 ${favorites.includes(selectedProfile.uid) ? 'fill-rose-500' : ''}`} />
                  Favorite
                </button>
                <button 
                  onClick={() => toggleLike(selectedProfile.uid)}
                  className={`flex-1 flex items-center justify-center px-4 py-3 rounded-2xl font-bold transition-colors ${likes.includes(selectedProfile.uid) ? 'bg-blue-500/20 text-blue-500 border border-blue-500/50' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
                >
                  <ThumbsUp className={`w-5 h-5 mr-2 ${likes.includes(selectedProfile.uid) ? 'fill-blue-500' : ''}`} />
                  Like
                </button>
                <button 
                  onClick={() => sendTap(selectedProfile.uid)}
                  className="flex-1 flex items-center justify-center px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-2xl font-bold transition-colors"
                >
                  <Dog className="w-5 h-5 mr-2" />
                  Woof
                </button>
              </div>

              <button 
                onClick={() => startChat(selectedProfile.uid)}
                className="w-full flex items-center justify-center px-6 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-full font-bold text-lg transition-colors shadow-lg shadow-rose-500/20"
              >
                <MessageCircle className="w-6 h-6 mr-2" />
                Start Chat
              </button>

              <div className="flex justify-center space-x-4 pt-4 border-t border-zinc-800">
                <button 
                  onClick={() => handleBlock(selectedProfile.uid)}
                  className="text-sm text-zinc-500 hover:text-rose-500 transition-colors flex items-center"
                >
                  <Ban className="w-4 h-4 mr-1" />
                  Block
                </button>
                <button 
                  onClick={() => handleReport(selectedProfile.uid)}
                  className="text-sm text-zinc-500 hover:text-rose-500 transition-colors flex items-center"
                >
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Filter Drawer */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 w-full max-w-sm h-full overflow-y-auto p-6 shadow-2xl animate-in slide-in-from-right">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Filters</h2>
              <button onClick={() => setShowFilters(false)} className="p-2 bg-zinc-800 rounded-full text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Sort By</label>
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="distance">Distance</option>
                  <option value="lastActive">Recently Active</option>
                  <option value="boost">Boosted</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Max Distance: {filters.maxDistanceKm}km</label>
                <input 
                  type="range" min="1" max="500" 
                  value={filters.maxDistanceKm} 
                  onChange={(e) => setFilters({...filters, maxDistanceKm: parseInt(e.target.value)})}
                  className="w-full accent-rose-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Age Range: {filters.minAge} - {filters.maxAge}</label>
                <div className="flex space-x-2">
                  <input 
                    type="number" min="18" max="99" 
                    value={filters.minAge} 
                    onChange={(e) => setFilters({...filters, minAge: parseInt(e.target.value)})}
                    className="w-1/2 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-white"
                  />
                  <input 
                    type="number" min="18" max="99" 
                    value={filters.maxAge} 
                    onChange={(e) => setFilters({...filters, maxAge: parseInt(e.target.value)})}
                    className="w-1/2 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Role</label>
                <select 
                  value={filters.role} 
                  onChange={(e) => setFilters({...filters, role: e.target.value})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="">Any</option>
                  <option value="Top">Top</option>
                  <option value="Bottom">Bottom</option>
                  <option value="Versatile">Versatile</option>
                  <option value="Side">Side</option>
                </select>
              </div>

              <button 
                onClick={() => {
                  setFilters({
                    minAge: 18, maxAge: 99,
                    minHeight: 100, maxHeight: 250,
                    minWeight: 40, maxWeight: 200,
                    tribes: [],
                    role: '',
                    maxDistanceKm: 100
                  });
                  setSortBy('distance');
                }}
                className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Story Viewer Modal */}
      {viewingStory && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center" onClick={() => setViewingStory(null)}>
          <button onClick={() => setViewingStory(null)} className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white">
            <X className="w-6 h-6" />
          </button>
          <div className="w-full max-w-sm relative">
            {viewingStory.photoURL ? (
              <img src={viewingStory.photoURL} alt="Story" className="w-full rounded-2xl object-contain max-h-[70vh]" />
            ) : (
              <div className="w-full h-64 bg-gradient-to-br from-rose-500 to-purple-600 rounded-2xl flex items-center justify-center">
                <p className="text-white text-xl font-bold text-center px-6">{viewingStory.text}</p>
              </div>
            )}
            {viewingStory.text && viewingStory.photoURL && (
              <p className="absolute bottom-4 left-0 right-0 text-center text-white font-medium drop-shadow-lg px-4">{viewingStory.text}</p>
            )}
            <div className="absolute top-4 left-4 flex items-center space-x-2">
              <img src={viewingStory.profile.photoURL} alt="" className="w-8 h-8 rounded-full object-cover border border-white" />
              <span className="text-white font-medium text-sm">{viewingStory.profile.displayName}</span>
            </div>
          </div>
        </div>
      )}

      {/* Create Story Modal */}
      {showCreateStory && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 w-full max-w-sm rounded-3xl p-6 border border-zinc-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">Create Story</h3>
              <button onClick={() => setShowCreateStory(false)} className="p-1.5 bg-zinc-800 rounded-full text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <label className="cursor-pointer block">
                <div className="w-full h-32 bg-zinc-800 rounded-xl border-2 border-dashed border-zinc-700 flex items-center justify-center hover:border-rose-500 transition-colors">
                  {storyFile ? (
                    <p className="text-sm text-zinc-300">{storyFile.name}</p>
                  ) : (
                    <p className="text-sm text-zinc-500">Tap to add photo</p>
                  )}
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setStoryFile(e.target.files?.[0] || null)} />
              </label>
              <textarea
                placeholder="Add a caption... (optional)"
                value={storyText}
                onChange={(e) => setStoryText(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500 resize-none"
                rows={3}
              />
              <button
                onClick={handleCreateStory}
                disabled={uploadingStory || (!storyFile && !storyText.trim())}
                className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {uploadingStory ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : 'Post Story (24h)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mutual Match Modal */}
      {matchedProfile && myProfile && (
        <MatchModal
          myProfile={myProfile}
          matchedProfile={matchedProfile}
          onClose={() => setMatchedProfile(null)}
        />
      )}
    </div>
  );
}
