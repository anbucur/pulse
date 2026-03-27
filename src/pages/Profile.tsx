/// <reference types="vite/client" />
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, updateDoc, setDoc, deleteDoc, collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { LogOut, Edit3, Settings, ShieldCheck, EyeOff, MapPin, Radio, Sparkles, Loader2, Camera, X, CheckCircle, Zap, Eye, Dog, Image as ImageIcon, Video, Crown, Phone } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import Webcam from 'react-webcam';
import { uploadMedia } from '../lib/uploadMedia';

export default function Profile() {
  const { user, logout, isPremium } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [incognitoMode, setIncognitoMode] = useState(false);
  const [broadcast, setBroadcast] = useState('');
  const [travelLat, setTravelLat] = useState('');
  const [travelLng, setTravelLng] = useState('');
  const [optimizing, setOptimizing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const [taps, setTaps] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [showPulseUpgrade, setShowPulseUpgrade] = useState(false);
  const [upgradingPulse, setUpgradingPulse] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [twoFAPhone, setTwoFAPhone] = useState('');
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const albumInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const docRef = doc(db, 'public_profiles', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile(data);
        setIsGhostMode(data.isGhostMode || false);
        setIncognitoMode(data.incognitoMode || false);
        setBroadcast(data.broadcast || '');
        setTravelLat(data.lat?.toString() || '');
        setTravelLng(data.lng?.toString() || '');
      }
    };
    fetchProfile();

    // Fetch viewers
    const viewersUnsub = onSnapshot(query(collection(db, `profile_views/${user.uid}/viewers`), orderBy('viewedAt', 'desc'), limit(20)), async (snap) => {
      const viewersData = await Promise.all(snap.docs.map(async (d) => {
        const pSnap = await getDoc(doc(db, 'public_profiles', d.id));
        return { id: d.id, viewedAt: d.data().viewedAt, profile: pSnap.data() };
      }));
      setViewers(viewersData.filter(v => v.profile));
    });

    // Fetch taps
    const tapsUnsub = onSnapshot(query(collection(db, `taps/${user.uid}/received`), orderBy('sentAt', 'desc'), limit(20)), async (snap) => {
      const tapsData = await Promise.all(snap.docs.map(async (d) => {
        const pSnap = await getDoc(doc(db, 'public_profiles', d.id));
        return { id: d.id, sentAt: d.data().sentAt, type: d.data().type, profile: pSnap.data() };
      }));
      setTaps(tapsData.filter(t => t.profile));
    });

    // Fetch albums
    const albumsUnsub = onSnapshot(collection(db, `albums/${user.uid}/photos`), (snap) => {
      setAlbums(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      viewersUnsub();
      tapsUnsub();
      albumsUnsub();
    };
  }, [user]);

  const handleAlbumUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setUploadingMedia(true);
    try {
      const url = await uploadMedia(file, `albums/${user.uid}/${Date.now()}_${file.name}`);
      await setDoc(doc(collection(db, `albums/${user.uid}/photos`)), {
        url,
        createdAt: Date.now()
      });
    } catch (error) {
      console.error('Error uploading album photo:', error);
      alert('Failed to upload album photo.');
    } finally {
      setUploadingMedia(false);
      if (albumInputRef.current) albumInputRef.current.value = '';
    }
  };

  const handleRemoveAlbumPhoto = async (photoId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `albums/${user.uid}/photos`, photoId));
    } catch (error) {
      console.error('Error removing album photo:', error);
    }
  };

  const handleBoost = async () => {
    if (!user || !profile) return;
    if (!isPremium) {
      alert("Boost is a Pulse+ premium feature.");
      return;
    }
    try {
      await updateDoc(doc(db, 'public_profiles', user.uid), {
        boostExpiresAt: Date.now() + 30 * 60 * 1000 // 30 minutes
      });
      alert('Profile boosted for 30 minutes!');
      setProfile({ ...profile, boostExpiresAt: Date.now() + 30 * 60 * 1000 });
    } catch (e) {
      console.error("Error boosting profile", e);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !profile || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setUploadingMedia(true);
    try {
      const url = await uploadMedia(file, `profiles/${user.uid}/photos/${Date.now()}_${file.name}`);
      const updatedPhotos = [...(profile.photos || []), url];
      await updateDoc(doc(db, 'public_profiles', user.uid), {
        photos: updatedPhotos
      });
      setProfile({ ...profile, photos: updatedPhotos });
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Failed to upload photo.');
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !profile || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setUploadingMedia(true);
    try {
      const url = await uploadMedia(file, `profiles/${user.uid}/videos/${Date.now()}_${file.name}`);
      await updateDoc(doc(db, 'public_profiles', user.uid), {
        videoURL: url
      });
      setProfile({ ...profile, videoURL: url });
    } catch (error) {
      console.error('Error uploading video:', error);
      alert('Failed to upload video.');
    } finally {
      setUploadingMedia(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async (index: number) => {
    if (!user || !profile) return;
    const updatedPhotos = [...(profile.photos || [])];
    updatedPhotos.splice(index, 1);
    await updateDoc(doc(db, 'public_profiles', user.uid), {
      photos: updatedPhotos
    });
    setProfile({ ...profile, photos: updatedPhotos });
  };

  const handleRemoveVideo = async () => {
    if (!user || !profile) return;
    await updateDoc(doc(db, 'public_profiles', user.uid), {
      videoURL: null
    });
    setProfile({ ...profile, videoURL: null });
  };

  const handleToggleGhostMode = async () => {
    if (!user || !profile) return;
    if (!isPremium) {
      alert("Ghost Mode is a Pulse+ premium feature.");
      return;
    }
    const newMode = !isGhostMode;
    setIsGhostMode(newMode);
    await updateDoc(doc(db, 'public_profiles', user.uid), {
      isGhostMode: newMode
    });
  };

  const handleToggleIncognitoMode = async () => {
    if (!user || !profile) return;
    if (!isPremium) {
      alert("Incognito Mode is a Pulse+ premium feature.");
      return;
    }
    const newMode = !incognitoMode;
    setIncognitoMode(newMode);
    await updateDoc(doc(db, 'public_profiles', user.uid), {
      incognitoMode: newMode
    });
  };

  const handleUpdateBroadcast = async () => {
    if (!user || !profile) return;
    await updateDoc(doc(db, 'public_profiles', user.uid), {
      broadcast: broadcast,
      broadcastExpiresAt: broadcast ? Date.now() + 2 * 60 * 60 * 1000 : null // 2 hours
    });
    alert('Broadcast updated!');
  };

  const handleUpdateLocation = async () => {
    if (!user || !profile) return;
    const lat = parseFloat(travelLat);
    const lng = parseFloat(travelLng);
    if (isNaN(lat) || isNaN(lng)) return alert('Invalid coordinates');

    let travelCity = '';
    try {
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
      const geoData = await geoRes.json();
      travelCity = geoData.address?.city || geoData.address?.town || geoData.address?.state || '';
    } catch (_) { /* ignore geocoding errors */ }

    await updateDoc(doc(db, 'public_profiles', user.uid), { lat, lng, travelCity });
    setProfile({ ...profile, lat, lng, travelCity });
    alert(`Location updated!${travelCity ? ` Now showing as: ${travelCity}` : ''}`);
  };

  const handleOptimizeProfile = async () => {
    if (!user || !profile) return;
    setOptimizing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Rewrite this dating app bio to be more engaging, attractive, and tailored to their intent. Keep it under 300 characters.
      Current Bio: ${profile.bio || 'None'}
      Intent: ${profile.intent}
      Role: ${profile.sexualRole}
      Age: ${profile.age}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      const newBio = response.text?.trim() || profile.bio;
      await updateDoc(doc(db, 'public_profiles', user.uid), {
        bio: newBio
      });
      setProfile({ ...profile, bio: newBio });
    } catch (error) {
      console.error('Error optimizing profile:', error);
      alert('Failed to optimize profile.');
    } finally {
      setOptimizing(false);
    }
  };

  const verifyPhoto = useCallback(async () => {
    if (!user || !profile) return;
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return;

    setShowCamera(false);
    setVerifying(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Extract base64 data
      const base64Data = imageSrc.split(',')[1];

      const prompt = `
        Analyze this selfie for a dating app profile verification.
        Does this image contain a clear, well-lit human face?
        Return a JSON object with 'verified' (boolean) and 'reason' (string).
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { text: prompt },
            { inlineData: { data: base64Data, mimeType: 'image/jpeg' } }
          ]
        },
        config: { responseMimeType: "application/json" }
      });

      const result = JSON.parse(response.text || '{"verified": false, "reason": "Failed to parse"}');
      
      if (result.verified) {
        await updateDoc(doc(db, 'public_profiles', user.uid), { isVerified: true });
        await updateDoc(doc(db, 'users', user.uid), { isVerified: true });
        setProfile({ ...profile, isVerified: true });
        alert('Profile verified successfully!');
      } else {
        alert(`Verification failed: ${result.reason}`);
      }
    } catch (error) {
      console.error('Error verifying photo:', error);
      alert('Failed to verify photo. Please try again.');
    } finally {
      setVerifying(false);
    }
  }, [webcamRef, user, profile]);

  const handleUpgradePulse = async () => {
    if (!user) return;
    setUpgradingPulse(true);
    try {
      const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
      await updateDoc(doc(db, 'users', user.uid), {
        isPremium: true,
        premiumExpiresAt: expiresAt
      });
      alert('Welcome to Pulse+! Premium features are now unlocked.');
      setShowPulseUpgrade(false);
      window.location.reload();
    } catch (e) {
      console.error('Error upgrading to Pulse+', e);
    } finally {
      setUpgradingPulse(false);
    }
  };

  const seedDemoProfiles = async () => {
    if (!profile) return;
    try {
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
          lat: profile.lat + 0.01,
          lng: profile.lng + 0.01,
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
          lat: profile.lat - 0.01,
          lng: profile.lng - 0.01,
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
          lat: profile.lat + 0.02,
          lng: profile.lng - 0.01,
          lastActive: Date.now()
        }
      ];

      for (const p of demoProfiles) {
        await setDoc(doc(db, 'public_profiles', p.uid), p);
      }
      alert('Demo profiles loaded! Check the Grid.');
    } catch (error) {
      console.error("Error seeding demo profiles:", error);
      alert('Failed to load demo profiles.');
    }
  };

  if (!profile) return <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-20">
      {/* Header */}
      <div className="relative h-64 bg-zinc-900">
        <img 
          src={profile.photoURL} 
          alt={profile.displayName} 
          className="w-full h-full object-cover opacity-50"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent"></div>
        
        <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <img 
                src={profile.photoURL} 
                alt={profile.displayName} 
                className="w-24 h-24 rounded-full border-4 border-zinc-950 object-cover"
                referrerPolicy="no-referrer"
              />
              {profile.isVerified && (
                <div className="absolute bottom-0 right-0 bg-blue-500 p-1 rounded-full border-2 border-zinc-950" title="Verified">
                  <ShieldCheck className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                {profile.displayName}, {profile.age}
                {isPremium && <span className="text-xs bg-amber-500 text-black px-2 py-0.5 rounded-full font-bold flex items-center"><Crown className="w-3 h-3 mr-1" />Pulse+</span>}
              </h1>
              <p className="text-zinc-400">{profile.pronouns ? `${profile.pronouns} · ` : ''}{profile.sexualRole} • {profile.height}cm • {profile.weight}kg</p>
              {incognitoMode && <p className="text-xs text-zinc-500 flex items-center mt-1"><EyeOff className="w-3 h-3 mr-1" />Incognito active</p>}
            </div>
          </div>
          <button className="p-3 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors">
            <Edit3 className="w-5 h-5 text-zinc-300" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-8">
        {/* Verification Status */}
        {!profile.isVerified && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center">
              <ShieldCheck className="w-6 h-6 text-blue-500 mr-3" />
              <div>
                <h3 className="font-medium text-blue-500">Verify Your Profile</h3>
                <p className="text-xs text-blue-400">Get a blue checkmark to show you're real.</p>
              </div>
            </div>
            <button 
              onClick={() => setShowCamera(true)}
              disabled={verifying}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center"
            >
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify Now'}
            </button>
          </div>
        )}

        {/* Intent */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-2">Primary Intent</h3>
          <div className="inline-block px-4 py-2 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-lg font-medium">
            {profile.intent}
          </div>
        </div>

        {/* Bio */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">About Me</h3>
            <button 
              onClick={handleOptimizeProfile}
              disabled={optimizing}
              className="flex items-center text-xs text-rose-500 hover:text-rose-400 disabled:opacity-50"
            >
              {optimizing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
              AI Polish
            </button>
          </div>
          <p className="text-zinc-300 leading-relaxed">{profile.bio || "No bio provided."}</p>
        </div>

        {/* Tags & Tribes */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">Tags & Tribes</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-2">Tribes (e.g. Bear, Twink, Jock)</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {profile.tribes?.map((tribe: string, idx: number) => (
                  <span key={idx} className="bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-sm flex items-center">
                    {tribe}
                    <button 
                      onClick={() => {
                        const newTribes = profile.tribes.filter((_: any, i: number) => i !== idx);
                        setProfile({...profile, tribes: newTribes});
                        updateDoc(doc(db, 'public_profiles', user.uid), { tribes: newTribes });
                      }}
                      className="ml-2 text-zinc-500 hover:text-rose-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <input 
                type="text" 
                placeholder="Type and press Enter..." 
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value) {
                    const val = e.currentTarget.value.trim();
                    if (val && !(profile.tribes || []).includes(val)) {
                      const newTribes = [...(profile.tribes || []), val];
                      setProfile({...profile, tribes: newTribes});
                      updateDoc(doc(db, 'public_profiles', user.uid), { tribes: newTribes });
                    }
                    e.currentTarget.value = '';
                  }
                }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-500 mb-2">Tags (e.g. Gym, Travel, Coffee)</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {profile.tags?.map((tag: string, idx: number) => (
                  <span key={idx} className="bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-sm flex items-center">
                    {tag}
                    <button 
                      onClick={() => {
                        const newTags = profile.tags.filter((_: any, i: number) => i !== idx);
                        setProfile({...profile, tags: newTags});
                        updateDoc(doc(db, 'public_profiles', user.uid), { tags: newTags });
                      }}
                      className="ml-2 text-zinc-500 hover:text-rose-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <input 
                type="text" 
                placeholder="Type and press Enter..." 
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value) {
                    const val = e.currentTarget.value.trim();
                    if (val && !(profile.tags || []).includes(val)) {
                      const newTags = [...(profile.tags || []), val];
                      setProfile({...profile, tags: newTags});
                      updateDoc(doc(db, 'public_profiles', user.uid), { tags: newTags });
                    }
                    e.currentTarget.value = '';
                  }
                }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>
        </div>

        {/* Private Albums */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Private Albums</h3>
            {uploadingMedia && <Loader2 className="w-4 h-4 text-rose-500 animate-spin" />}
          </div>
          
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="font-medium flex items-center">
                  <ImageIcon className="w-4 h-4 mr-2 text-zinc-400" /> Private Photos
                </p>
                <button 
                  onClick={() => albumInputRef.current?.click()}
                  disabled={uploadingMedia || albums.length >= 10}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  Add Photo
                </button>
                <input 
                  type="file" 
                  ref={albumInputRef} 
                  onChange={handleAlbumUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                {albums.map((photo) => (
                  <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden group">
                    <img src={photo.url} alt="Album" className="w-full h-full object-cover" />
                    <button 
                      onClick={() => handleRemoveAlbumPhoto(photo.id)}
                      className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {albums.length === 0 && (
                  <div className="col-span-3 aspect-[3/1] rounded-xl border-2 border-dashed border-zinc-800 flex flex-col items-center justify-center text-zinc-500">
                    <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">No private photos yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Extended Stats */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">Extended Stats</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-zinc-500 mb-1">PrEP Status</label>
              <select
                value={profile.prepStatus || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setProfile({...profile, prepStatus: val});
                  updateDoc(doc(db, 'public_profiles', user.uid), { prepStatus: val });
                }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-500"
              >
                <option value="">Select...</option>
                <option value="On PrEP">On PrEP</option>
                <option value="Not on PrEP">Not on PrEP</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Pronouns</label>
              <input 
                type="text" 
                value={profile.pronouns || ''} 
                onChange={(e) => {
                  const val = e.target.value;
                  setProfile({...profile, pronouns: val});
                  updateDoc(doc(db, 'public_profiles', user.uid), { pronouns: val });
                }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-500"
                placeholder="e.g. he/him"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Relationship</label>
              <select 
                value={profile.relationship || ''} 
                onChange={(e) => {
                  const val = e.target.value;
                  setProfile({...profile, relationship: val});
                  updateDoc(doc(db, 'public_profiles', user.uid), { relationship: val });
                }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-500"
              >
                <option value="">Select...</option>
                <option value="Single">Single</option>
                <option value="Partnered">Partnered</option>
                <option value="Married">Married</option>
                <option value="Open Relationship">Open Relationship</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Body Type</label>
              <select 
                value={profile.bodyType || ''} 
                onChange={(e) => {
                  const val = e.target.value;
                  setProfile({...profile, bodyType: val});
                  updateDoc(doc(db, 'public_profiles', user.uid), { bodyType: val });
                }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-500"
              >
                <option value="">Select...</option>
                <option value="Slim">Slim</option>
                <option value="Athletic">Athletic</option>
                <option value="Average">Average</option>
                <option value="Muscular">Muscular</option>
                <option value="Stocky">Stocky</option>
                <option value="Large">Large</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">HIV Status</label>
              <select 
                value={profile.hivStatus || ''} 
                onChange={(e) => {
                  const val = e.target.value;
                  setProfile({...profile, hivStatus: val});
                  updateDoc(doc(db, 'public_profiles', user.uid), { hivStatus: val });
                }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-500"
              >
                <option value="">Select...</option>
                <option value="Negative">Negative</option>
                <option value="Negative, on PrEP">Negative, on PrEP</option>
                <option value="Positive, Undetectable">Positive, Undetectable</option>
                <option value="Positive">Positive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Media */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Media</h3>
            {uploadingMedia && <Loader2 className="w-4 h-4 text-rose-500 animate-spin" />}
          </div>
          
          <div className="space-y-6">
            {/* Photos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium flex items-center">
                  <ImageIcon className="w-4 h-4 mr-2 text-zinc-400" /> Photos
                </p>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingMedia || (profile.photos && profile.photos.length >= 6)}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  Add Photo
                </button>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handlePhotoUpload} 
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {profile.photos && profile.photos.map((url: string, idx: number) => (
                  <div key={idx} className="relative aspect-[3/4] rounded-lg overflow-hidden group">
                    <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                    <button 
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-black/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
                {(!profile.photos || profile.photos.length === 0) && (
                  <div className="col-span-3 py-8 text-center border-2 border-dashed border-zinc-800 rounded-lg">
                    <p className="text-sm text-zinc-500">No additional photos uploaded.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Video */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium flex items-center">
                  <Video className="w-4 h-4 mr-2 text-zinc-400" /> Video Snippet
                </p>
                {!profile.videoURL && (
                  <button 
                    onClick={() => videoInputRef.current?.click()}
                    disabled={uploadingMedia}
                    className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Add Video
                  </button>
                )}
                <input 
                  type="file" 
                  accept="video/*" 
                  className="hidden" 
                  ref={videoInputRef} 
                  onChange={handleVideoUpload} 
                />
              </div>
              {profile.videoURL ? (
                <div className="relative aspect-video rounded-lg overflow-hidden group">
                  <video src={profile.videoURL} controls className="w-full h-full object-cover" />
                  <button 
                    onClick={handleRemoveVideo}
                    className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : (
                <div className="py-8 text-center border-2 border-dashed border-zinc-800 rounded-lg">
                  <p className="text-sm text-zinc-500">No video snippet uploaded.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pro Features */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Pro Features</h3>
            {!isPremium && <span className="text-xs bg-rose-500/20 text-rose-500 px-2 py-1 rounded font-bold">PULSE+</span>}
          </div>

          {/* Boost */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-2 bg-zinc-800 rounded-lg mr-3">
                <Zap className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="font-medium flex items-center">
                  Boost Profile
                  {profile.boostExpiresAt && profile.boostExpiresAt > Date.now() && (
                    <span className="ml-2 text-xs bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full">Active</span>
                  )}
                </p>
                <p className="text-xs text-zinc-500">Get seen by more guys for 30 mins</p>
              </div>
            </div>
            <button 
              onClick={handleBoost}
              disabled={profile.boostExpiresAt && profile.boostExpiresAt > Date.now()}
              className="px-4 py-2 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              Boost
            </button>
          </div>
          
          {/* Ghost Mode */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-2 bg-zinc-800 rounded-lg mr-3">
                <EyeOff className="w-5 h-5 text-zinc-400" />
              </div>
              <div>
                <p className="font-medium">Ghost Mode</p>
                <p className="text-xs text-zinc-500">Hide from the public grid</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={isGhostMode} onChange={handleToggleGhostMode} />
              <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
            </label>
          </div>

          {/* Incognito Mode */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-2 bg-zinc-800 rounded-lg mr-3">
                <Eye className="w-5 h-5 text-zinc-400" />
              </div>
              <div>
                <p className="font-medium">Incognito Browsing</p>
                <p className="text-xs text-zinc-500">View profiles without leaving a trace</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={incognitoMode} onChange={handleToggleIncognitoMode} />
              <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
            </label>
          </div>

          {/* Broadcast */}
          <div>
            <div className="flex items-center mb-2">
              <div className="p-2 bg-zinc-800 rounded-lg mr-3">
                <Radio className="w-5 h-5 text-zinc-400" />
              </div>
              <div>
                <p className="font-medium">"Looking For" Broadcast</p>
                <p className="text-xs text-zinc-500">Visible at the top of the grid for 2 hours</p>
              </div>
            </div>
            <div className="flex space-x-2 mt-2">
              <input 
                type="text" 
                placeholder="e.g. Grabbing coffee at Dolores Park..." 
                value={broadcast}
                onChange={(e) => setBroadcast(e.target.value)}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-500"
              />
              <button 
                onClick={handleUpdateBroadcast}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 rounded-lg text-sm font-medium transition-colors"
              >
                Post
              </button>
            </div>
          </div>

          {/* Travel Mode */}
          <div>
            <div className="flex items-center mb-2">
              <div className="p-2 bg-zinc-800 rounded-lg mr-3">
                <MapPin className="w-5 h-5 text-zinc-400" />
              </div>
              <div>
                <p className="font-medium">Travel / Teleport Mode</p>
                <p className="text-xs text-zinc-500">Change your location manually</p>
              </div>
            </div>
            <div className="flex space-x-2 mt-2">
              <input 
                type="text" 
                placeholder="Lat" 
                value={travelLat}
                onChange={(e) => setTravelLat(e.target.value)}
                className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-500"
              />
              <input 
                type="text" 
                placeholder="Lng" 
                value={travelLng}
                onChange={(e) => setTravelLng(e.target.value)}
                className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-500"
              />
              <button 
                onClick={handleUpdateLocation}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm font-medium transition-colors"
              >
                Teleport
              </button>
            </div>
          </div>
        </div>

        {/* Viewers & Taps */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Who Viewed Me */}
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider flex items-center">
                <Eye className="w-4 h-4 mr-2" /> Who Viewed Me
              </h3>
              {!isPremium && <span className="text-xs bg-rose-500/20 text-rose-500 px-2 py-1 rounded font-bold">PULSE+</span>}
            </div>
            
            {viewers.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center py-4">No recent views.</p>
            ) : (
              <div className="space-y-3">
                {viewers.map((v, idx) => (
                  <div key={`viewer-${v.id}-${idx}`} className="flex items-center justify-between p-2 rounded-xl hover:bg-zinc-800 transition-colors cursor-pointer">
                    <div className="flex items-center">
                      <img src={v.profile.photoURL} alt={v.profile.displayName} className={`w-10 h-10 rounded-full object-cover mr-3 ${!isPremium ? 'blur-sm' : ''}`} />
                      <div>
                        <p className="font-medium text-white">{isPremium ? v.profile.displayName : 'Hidden'}</p>
                        <p className="text-xs text-zinc-500">{new Date(v.viewedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Taps */}
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider flex items-center">
                <Dog className="w-4 h-4 mr-2" /> Taps Received
              </h3>
            </div>
            
            {taps.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center py-4">No recent taps.</p>
            ) : (
              <div className="space-y-3">
                {taps.map((t, idx) => (
                  <div key={`tap-${t.id}-${idx}`} className="flex items-center justify-between p-2 rounded-xl hover:bg-zinc-800 transition-colors cursor-pointer">
                    <div className="flex items-center">
                      <img src={t.profile.photoURL} alt={t.profile.displayName} className="w-10 h-10 rounded-full object-cover mr-3" />
                      <div>
                        <p className="font-medium text-white">{t.profile.displayName}</p>
                        <p className="text-xs text-zinc-500">Sent a {t.type} • {new Date(t.sentAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pulse+ Upgrade Banner */}
        {!isPremium && (
          <div className="bg-gradient-to-r from-amber-500/20 to-rose-500/20 border border-amber-500/30 rounded-2xl p-6">
            <div className="flex items-center mb-3">
              <Crown className="w-6 h-6 text-amber-500 mr-2" />
              <h3 className="text-lg font-bold text-white">Upgrade to Pulse+</h3>
            </div>
            <ul className="text-sm text-zinc-300 space-y-1 mb-4">
              <li>⚡ Boost profile visibility</li>
              <li>👁️ See who viewed you (unblurred)</li>
              <li>🌍 Travel / Teleport Mode</li>
              <li>🕵️ Incognito browsing</li>
              <li>🔍 Advanced filters</li>
            </ul>
            <button
              onClick={() => setShowPulseUpgrade(true)}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition-colors"
            >
              Subscribe — $9.99/mo
            </button>
          </div>
        )}

        {/* 2FA Section */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Phone className="w-5 h-5 text-zinc-400 mr-2" />
              <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Two-Factor Authentication</h3>
            </div>
          </div>
          {show2FA ? (
            <div className="space-y-3">
              <input
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={twoFAPhone}
                onChange={(e) => setTwoFAPhone(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-500"
              />
              <div className="flex space-x-2">
                <button
                  onClick={() => { alert('2FA enrollment requires Firebase phone auth setup with reCAPTCHA. Stub: 2FA enabled.'); setShow2FA(false); }}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Enable 2FA
                </button>
                <button onClick={() => setShow2FA(false)} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShow2FA(true)}
              className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Enable 2FA via Phone
            </button>
          )}
        </div>

        {/* Settings & Logout */}
        <div className="space-y-2">
          <button
            onClick={seedDemoProfiles}
            className="w-full flex items-center justify-between p-4 bg-zinc-900 rounded-xl border border-zinc-800 hover:bg-zinc-800 transition-colors"
          >
            <div className="flex items-center text-zinc-300">
              <Sparkles className="w-5 h-5 mr-3 text-rose-500" />
              <span>Load Demo Profiles</span>
            </div>
          </button>
          <button className="w-full flex items-center justify-between p-4 bg-zinc-900 rounded-xl border border-zinc-800 hover:bg-zinc-800 transition-colors">
            <div className="flex items-center text-zinc-300">
              <Settings className="w-5 h-5 mr-3" />
              <span>Settings</span>
            </div>
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center justify-between p-4 bg-zinc-900 rounded-xl border border-zinc-800 hover:bg-zinc-800 transition-colors text-red-500"
          >
            <div className="flex items-center">
              <LogOut className="w-5 h-5 mr-3" />
              <span>Log Out</span>
            </div>
          </button>
        </div>
      </div>

      {/* Pulse+ Upgrade Modal */}
      {showPulseUpgrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 w-full max-w-sm rounded-3xl p-8 border border-amber-500/30 shadow-2xl">
            <div className="text-center mb-6">
              <Crown className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <h2 className="text-2xl font-bold text-white mb-1">Pulse+ Premium</h2>
              <p className="text-zinc-400 text-sm">Unlock the full Pulse experience</p>
            </div>
            <ul className="space-y-3 mb-6 text-sm">
              {[
                ['⚡', 'Boost — appear at the top of the grid'],
                ['👁️', 'See exactly who viewed your profile'],
                ['🌍', 'Travel / Teleport anywhere in the world'],
                ['🕵️', 'Incognito mode — browse without a trace'],
                ['🔍', 'Unlimited advanced filters'],
              ].map(([icon, text]) => (
                <li key={text} className="flex items-center text-zinc-300">
                  <span className="text-lg mr-3">{icon}</span> {text}
                </li>
              ))}
            </ul>
            <button
              onClick={handleUpgradePulse}
              disabled={upgradingPulse}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-rose-500 hover:opacity-90 text-white font-bold rounded-2xl text-lg transition-opacity disabled:opacity-50 flex items-center justify-center"
            >
              {upgradingPulse ? <Loader2 className="animate-spin w-5 h-5" /> : 'Subscribe — $9.99/mo'}
            </button>
            <button onClick={() => setShowPulseUpgrade(false)} className="w-full mt-3 py-2 text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
              Maybe later
            </button>
          </div>
        </div>
      )}

      {/* Camera Modal for Verification */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
          <div className="relative w-full max-w-md">
            {/* @ts-ignore */}
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: "user" }}
              className="w-full h-auto rounded-2xl"
            />
            <button 
              onClick={() => setShowCamera(false)}
              className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white hover:bg-black/70"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="absolute bottom-4 left-0 right-0 flex justify-center">
              <button 
                onClick={verifyPhoto}
                className="w-16 h-16 bg-white rounded-full border-4 border-zinc-300 flex items-center justify-center hover:scale-105 transition-transform"
              >
                <div className="w-12 h-12 bg-blue-500 rounded-full"></div>
              </button>
            </div>
            <div className="absolute top-4 left-4 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-md flex items-center">
              <Camera className="w-3 h-3 mr-1" /> Take Selfie
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
