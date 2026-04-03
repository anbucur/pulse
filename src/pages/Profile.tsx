import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, Edit3, Settings, ShieldCheck, EyeOff, MapPin, Radio, Sparkles, Loader2,
  Camera, X, CheckCircle, Zap, Eye, Image as ImageIcon, Video, Plus, Trash2,
  Heart, Star, MessageCircle, Calendar, Map, Award, Target, Flame, Lock, Unlock,
  ChevronsUpDown, ChevronsUp
} from 'lucide-react';
import { storageProvider, aiProvider } from '../lib/providers';

interface Profile {
  user_id: string;
  display_name?: string;
  age?: number;
  gender?: string;
  pronouns?: string;
  bio?: string;
  location?: string;
  lat?: number;
  lng?: number;
  height?: string;
  body_type?: string;
  hair_color?: string;
  eye_color?: string;
  ethnicity?: string;
  sexual_orientation?: string[];
  relationship_status?: string;
  relationship_style?: string[];
  sexual_role?: string[];
  experience_level?: string;
  std_friendly?: boolean;
  vaccinated?: boolean;
  kinks?: any;
  kink_preferences?: any;
  education?: string;
  occupation?: string;
  income_level?: string;
  smoking_habit?: string;
  drinking_habit?: string;
  exercise_habit?: string;
  diet?: string;
  mbti?: string;
  love_languages?: string[];
  attachment_style?: string;
  communication_style?: string;
  interests?: string[];
  hobbies?: string[];
  tags?: string[];
  intent?: string[];
  looking_for_age_range?: number[];
  looking_for_gender?: string[];
  looking_for_location_radius?: number;
  privacy_settings?: Record<string, string>;
  photos?: string[];
  primary_photo_index?: number;
  video_url?: string;
  is_verified?: boolean;
  is_ghost_mode?: boolean;
  incognito_mode?: boolean;
  boost_expires_at?: number;
  broadcast?: string;
  broadcast_expires_at?: number;
  album_photos?: any[];
}

export default function Profile() {
  const { user, logout, isPremium } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [incognitoMode, setIncognitoMode] = useState(false);
  const [broadcast, setBroadcast] = useState('');
  const [editing, setEditing] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const [taps, setTaps] = useState<any[]>([]);
  const [formData, setFormData] = useState<Partial<Profile>>({});
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const webcamRef = useRef<any>(null);

  useEffect(() => {
    if (!user) return;
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/profiles/me', {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (response.ok) {
      const data = await response.json();
      setProfile(data);
      setIsGhostMode(data.is_ghost_mode || false);
      setIncognitoMode(data.incognito_mode || false);
      setBroadcast(data.broadcast || '');
      setFormData(data);
    }
  };

  const handleSave = async (section?: string) => {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/profiles/me', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(formData),
    });

    if (response.ok) {
      const updated = await response.json();
      setProfile(updated);
      setEditingSection(null);
      setUnsavedChanges(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    setUploadingMedia(true);
    try {
      const result = await storageProvider.upload(file, { folder: 'profiles/photos', isPublic: true });
      const response = await fetch('/api/profiles/photos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ url: result.url }),
      });

      if (response.ok) {
        const data = await response.json();
        setFormData({ ...formData, photos: data.photos });
        setUnsavedChanges(true);
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Failed to upload photo.');
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async (index: number) => {
    if (!profile) return;
    const updatedPhotos = [...(profile.photos || [])];
    updatedPhotos.splice(index, 1);

    const response = await fetch(`/api/profiles/photos/${index}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    });

    if (response.ok) {
      const data = await response.json();
      setFormData({ ...formData, photos: data.photos });
      setUnsavedChanges(true);
    }
  };

  const handleOptimizeBio = async () => {
    if (!profile) return;
    setOptimizing(true);
    try {
      const result = await aiProvider.generateText(
        `Rewrite this dating app bio to be more engaging, attractive, and tailored to their intent. Keep it under 300 characters.\n\nCurrent Bio: ${profile.bio || 'None'}\nIntent: ${profile.intent?.join(', ') || 'Not specified'}\nAge: ${profile.age || 'Not specified'}`
      );

      setFormData({ ...formData, bio: result.text.trim() });
      setUnsavedChanges(true);
    } catch (error) {
      console.error('Error optimizing profile:', error);
      alert('Failed to optimize profile.');
    } finally {
      setOptimizing(false);
    }
  };

  const handleVerifyPhoto = async () => {
    if (!user || !profile) return;
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return;

    setShowCamera(false);
    setVerifying(true);

    try {
      const base64Data = imageSrc.split(',')[1];
      const result = await aiProvider.analyzeImage(
        base64Data,
        'Analyze this selfie for a dating app profile verification. Does this image contain a clear, well-lit human face? Return a JSON object with "verified" (boolean) and "reason" (string).'
      );

      const parsed = JSON.parse(result.text || '{"verified": false, "reason": "Failed to parse"}');

      if (parsed.verified) {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/profiles/me', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ is_verified: true }),
        });

        if (response.ok) {
          const updated = await response.json();
          setProfile(updated);
          alert('Profile verified successfully!');
        }
      } else {
        alert(`Verification failed: ${parsed.reason}`);
      }
    } catch (error) {
      console.error('Error verifying photo:', error);
      alert('Failed to verify photo.');
    } finally {
      setVerifying(false);
    }
  };

  const handleUpdateBroadcast = async () => {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/profiles/me', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        broadcast,
        broadcast_expires_at: broadcast ? Date.now() + 2 * 60 * 60 * 1000 : null
      }),
    });

    if (response.ok) {
      alert('Broadcast updated!');
      fetchProfile();
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-red-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-red-900 text-white">
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Profile</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(!editing)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
            >
              <Edit3 className="w-5 h-5" />
            </button>
            <button
              onClick={logout}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Verification Badge */}
        {profile.is_verified && (
          <div className="mb-4 flex items-center gap-2 text-green-400">
            <ShieldCheck className="w-5 h-5" />
            <span>Verified Profile</span>
          </div>
        )}

        {/* Photos Section */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Photos</h2>
            {editing && (
              <label className="cursor-pointer p-2 rounded-full bg-pink-500 hover:bg-pink-600 transition">
                <Plus className="w-5 h-5" />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={uploadingMedia}
                />
              </label>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            {(formData.photos || profile.photos || []).map((photo: string, index: number) => (
              <div key={index} className="relative aspect-square rounded-lg overflow-hidden">
                <img src={photo} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                {editing && (
                  <button
                    onClick={() => handleRemovePhoto(index)}
                    className="absolute top-2 right-2 p-1 rounded-full bg-red-500 hover:bg-red-600 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                {index === (formData.primary_photo_index ?? 0) && (
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-pink-500 rounded text-xs">
                    Primary
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Basic Info Section */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Basic Info</h2>
            {editing && (
              <button
                onClick={() => handleSave('basic')}
                className="px-4 py-2 bg-pink-500 hover:bg-pink-600 rounded-lg transition"
              >
                Save
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Display Name</label>
                <input
                  type="text"
                  value={formData.display_name || ''}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-pink-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Age</label>
                <input
                  type="number"
                  value={formData.age || ''}
                  onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-pink-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Gender</label>
                <select
                  value={formData.gender || ''}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-pink-500 outline-none"
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non-binary">Non-binary</option>
                  <option value="other">Other</option>
                  <option value="prefer not to say">Prefer not to say</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Bio</label>
                <textarea
                  value={formData.bio || ''}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-pink-500 outline-none"
                  rows={3}
                />
                <button
                  onClick={handleOptimizeBio}
                  className="mt-2 flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg transition"
                  disabled={optimizing}
                >
                  {optimizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Optimize with AI
                </button>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Location</label>
                <input
                  type="text"
                  value={formData.location || ''}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-pink-500 outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p><strong>Name:</strong> {profile.display_name}</p>
              <p><strong>Age:</strong> {profile.age}</p>
              <p><strong>Gender:</strong> {profile.gender}</p>
              <p><strong>Bio:</strong> {profile.bio || 'No bio yet'}</p>
              <p className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {profile.location || 'Location not set'}
              </p>
            </div>
          )}
        </div>

        {/* Physical Attributes */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-4">
          <h2 className="text-xl font-semibold mb-4">Physical Attributes</h2>
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Height</label>
                <input
                  type="text"
                  value={formData.height || ''}
                  onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                  placeholder="e.g., 5'10\""
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-pink-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Body Type</label>
                <select
                  value={formData.body_type || ''}
                  onChange={(e) => setFormData({ ...formData, body_type: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-pink-500 outline-none"
                >
                  <option value="">Select body type</option>
                  <option value="slim">Slim</option>
                  <option value="athletic">Athletic</option>
                  <option value="average">Average</option>
                  <option value="curvy">Curvy</option>
                  <option value="full-figured">Full Figured</option>
                  <option value="muscular">Muscular</option>
                  <option value="prefer not to say">Prefer not to say</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Hair Color</label>
                <input
                  type="text"
                  value={formData.hair_color || ''}
                  onChange={(e) => setFormData({ ...formData, hair_color: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-pink-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Eye Color</label>
                <input
                  type="text"
                  value={formData.eye_color || ''}
                  onChange={(e) => setFormData({ ...formData, eye_color: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-pink-500 outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p><strong>Height:</strong> {profile.height || 'Not specified'}</p>
              <p><strong>Body Type:</strong> {profile.body_type || 'Not specified'}</p>
              <p><strong>Hair Color:</strong> {profile.hair_color || 'Not specified'}</p>
              <p><strong>Eye Color:</strong> {profile.eye_color || 'Not specified'}</p>
            </div>
          )}
        </div>

        {/* Sexual Profile */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-4">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Flame className="w-5 h-5" />
            Sexual Profile
          </h2>
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Sexual Orientation</label>
                <input
                  type="text"
                  value={formData.sexual_orientation?.join(', ') || ''}
                  onChange={(e) => setFormData({ ...formData, sexual_orientation: e.target.value.split(',').map(s => s.trim()) })}
                  placeholder="e.g., straight, bisexual, pansexual"
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-pink-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Relationship Style</label>
                <input
                  type="text"
                  value={formData.relationship_style?.join(', ') || ''}
                  onChange={(e) => setFormData({ ...formData, relationship_style: e.target.value.split(',').map(s => s.trim()) })}
                  placeholder="e.g., monogamous, polyamorous, open relationship"
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-pink-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Role/Position</label>
                <input
                  type="text"
                  value={formData.sexual_role?.join(', ') || ''}
                  onChange={(e) => setFormData({ ...formData, sexual_role: e.target.value.split(',').map(s => s.trim()) })}
                  placeholder="e.g., top, bottom, switch, versatile"
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-pink-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Experience Level</label>
                <select
                  value={formData.experience_level || ''}
                  onChange={(e) => setFormData({ ...formData, experience_level: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-pink-500 outline-none"
                >
                  <option value="">Select experience level</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="experienced">Experienced</option>
                  <option value="expert">Expert</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p><strong>Orientation:</strong> {profile.sexual_orientation?.join(', ') || 'Not specified'}</p>
              <p><strong>Relationship Style:</strong> {profile.relationship_style?.join(', ') || 'Not specified'}</p>
              <p><strong>Role:</strong> {profile.sexual_role?.join(', ') || 'Not specified'}</p>
              <p><strong>Experience:</strong> {profile.experience_level || 'Not specified'}</p>
            </div>
          )}
        </div>

        {/* Intent & What I'm Looking For */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-4">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Target className="w-5 h-5" />
            What I'm Looking For
          </h2>
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Intent</label>
                <input
                  type="text"
                  value={formData.intent?.join(', ') || ''}
                  onChange={(e) => setFormData({ ...formData, intent: e.target.value.split(',').map(s => s.trim()) })}
                  placeholder="e.g., casual dating, serious relationship, friendship"
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-pink-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Preferred Age Range</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={formData.looking_for_age_range?.[0] || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      looking_for_age_range: [parseInt(e.target.value), formData.looking_for_age_range?.[1] || 100]
                    })}
                    placeholder="Min"
                    className="flex-1 px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-pink-500 outline-none"
                  />
                  <input
                    type="number"
                    value={formData.looking_for_age_range?.[1] || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      looking_for_age_range: [formData.looking_for_age_range?.[0] || 18, parseInt(e.target.value)]
                    })}
                    placeholder="Max"
                    className="flex-1 px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-pink-500 outline-none"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p><strong>Looking for:</strong> {profile.intent?.join(', ') || 'Not specified'}</p>
              <p><strong>Age range:</strong> {profile.looking_for_age_range?.join(' - ') || 'Not specified'}</p>
            </div>
          )}
        </div>

        {/* Interests & Tags */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-4">
          <h2 className="text-xl font-semibold mb-4">Interests & Tags</h2>
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Interests</label>
                <input
                  type="text"
                  value={formData.interests?.join(', ') || ''}
                  onChange={(e) => setFormData({ ...formData, interests: e.target.value.split(',').map(s => s.trim()) })}
                  placeholder="e.g., hiking, cooking, gaming, photography"
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-pink-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Tags</label>
                <input
                  type="text"
                  value={formData.tags?.join(', ') || ''}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value.split(',').map(s => s.trim()) })}
                  placeholder="e.g., adventurous, creative, spontaneous"
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-pink-500 outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(profile.interests || []).map((interest, i) => (
                <span key={i} className="px-3 py-1 bg-purple-500/30 rounded-full text-sm">
                  {interest}
                </span>
              ))}
              {(profile.tags || []).map((tag, i) => (
                <span key={i} className="px-3 py-1 bg-pink-500/30 rounded-full text-sm">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Personality */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-4">
          <h2 className="text-xl font-semibold mb-4">Personality</h2>
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">MBTI</label>
                <select
                  value={formData.mbti || ''}
                  onChange={(e) => setFormData({ ...formData, mbti: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-pink-500 outline-none"
                >
                  <option value="">Select MBTI</option>
                  <option value="INTJ">INTJ - Architect</option>
                  <option value="INTP">INTP - Logician</option>
                  <option value="ENTJ">ENTJ - Commander</option>
                  <option value="ENTP">ENTP - Debater</option>
                  <option value="INFJ">INFJ - Advocate</option>
                  <option value="INFP">INFP - Mediator</option>
                  <option value="ENFJ">ENFJ - Protagonist</option>
                  <option value="ENFP">ENFP - Campaigner</option>
                  <option value="ISTJ">ISTJ - Logistician</option>
                  <option value="ISFJ">ISFJ - Defender</option>
                  <option value="ESTJ">ESTJ - Executive</option>
                  <option value="ESFJ">ESFJ - Consul</option>
                  <option value="ISTP">ISTP - Virtuoso</option>
                  <option value="ISFP">ISFP - Adventurer</option>
                  <option value="ESTP">ESTP - Entrepreneur</option>
                  <option value="ESFP">ESFP - Entertainer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Love Languages</label>
                <input
                  type="text"
                  value={formData.love_languages?.join(', ') || ''}
                  onChange={(e) => setFormData({ ...formData, love_languages: e.target.value.split(',').map(s => s.trim()) })}
                  placeholder="e.g., words of affirmation, quality time, physical touch"
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-pink-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Attachment Style</label>
                <select
                  value={formData.attachment_style || ''}
                  onChange={(e) => setFormData({ ...formData, attachment_style: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-pink-500 outline-none"
                >
                  <option value="">Select attachment style</option>
                  <option value="secure">Secure</option>
                  <option value="anxious">Anxious</option>
                  <option value="avoidant">Avoidant</option>
                  <option value="disorganized">Disorganized</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p><strong>MBTI:</strong> {profile.mbti || 'Not specified'}</p>
              <p><strong>Love Languages:</strong> {profile.love_languages?.join(', ') || 'Not specified'}</p>
              <p><strong>Attachment Style:</strong> {profile.attachment_style || 'Not specified'}</p>
            </div>
          )}
        </div>

        {/* Broadcast Feature */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-4">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Radio className="w-5 h-5" />
            Broadcast
          </h2>
          <p className="text-sm text-gray-300 mb-4">
            Share your current vibe with everyone nearby. Expires in 2 hours.
          </p>
          <textarea
            value={broadcast}
            onChange={(e) => setBroadcast(e.target.value)}
            placeholder="What's your vibe right now?"
            className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-pink-500 outline-none resize-none"
            rows={2}
            maxLength={140}
          />
          <button
            onClick={handleUpdateBroadcast}
            className="mt-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 rounded-lg transition"
          >
            Update Broadcast
          </button>
        </div>

        {/* Verification */}
        {!profile.is_verified && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-4">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              Get Verified
            </h2>
            <p className="text-sm text-gray-300 mb-4">
              Verify your profile with a live photo to increase trust and visibility.
            </p>
            {!showCamera ? (
              <button
                onClick={() => setShowCamera(true)}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg transition flex items-center gap-2"
              >
                <Camera className="w-4 h-4" />
                Take Verification Photo
              </button>
            ) : (
              <div className="space-y-4">
                <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
                  {/* Webcam component would go here */}
                  <p className="flex items-center justify-center h-full text-gray-400">Camera placeholder</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleVerifyPhoto}
                    disabled={verifying}
                    className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Verify Photo
                  </button>
                  <button
                    onClick={() => setShowCamera(false)}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 rounded-lg transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Privacy Settings */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-4">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Privacy Settings
          </h2>
          <p className="text-sm text-gray-300 mb-4">
            Control who can see different parts of your profile.
          </p>
          <div className="space-y-2">
            {[
              'displayName', 'age', 'gender', 'bio', 'photos', 'location',
              'sexualProfile', 'kinkProfile'
            ].map(field => (
              <div key={field} className="flex justify-between items-center">
                <span className="capitalize">{field.replace(/([A-Z])/g, ' $1')}</span>
                <select
                  value={profile.privacy_settings?.[field] || 'public'}
                  className="px-3 py-1 rounded bg-white/10 border border-white/20 text-sm"
                >
                  <option value="public">Public</option>
                  <option value="connections">Connections Only</option>
                  <option value="private">Private</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
