/// <reference types="vite/client" />
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { LogOut, Edit3, Settings, ShieldCheck, EyeOff, MapPin, Radio, Sparkles, Loader2, Camera, X, CheckCircle } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import Webcam from 'react-webcam';

export default function Profile() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [broadcast, setBroadcast] = useState('');
  const [travelLat, setTravelLat] = useState('');
  const [travelLng, setTravelLng] = useState('');
  const [optimizing, setOptimizing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const webcamRef = useRef<Webcam>(null);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const docRef = doc(db, 'public_profiles', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile(data);
        setIsGhostMode(data.isGhostMode || false);
        setBroadcast(data.broadcast || '');
        setTravelLat(data.lat?.toString() || '');
        setTravelLng(data.lng?.toString() || '');
      }
    };
    fetchProfile();
  }, [user]);

  const handleToggleGhostMode = async () => {
    if (!user || !profile) return;
    const newMode = !isGhostMode;
    setIsGhostMode(newMode);
    await updateDoc(doc(db, 'public_profiles', user.uid), {
      isGhostMode: newMode
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
    
    await updateDoc(doc(db, 'public_profiles', user.uid), {
      lat,
      lng
    });
    alert('Location updated!');
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
        await updateDoc(doc(db, 'public_profiles', user.uid), {
          isVerified: true
        });
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
              <h1 className="text-3xl font-bold flex items-center">
                {profile.displayName}, {profile.age}
              </h1>
              <p className="text-zinc-400">{profile.sexualRole} • {profile.height}cm • {profile.weight}kg</p>
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

        {/* Pro Features */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 space-y-6">
          <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Pro Features</h3>
          
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
