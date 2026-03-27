import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Camera, CheckCircle2, Loader2, Upload } from 'lucide-react';
import { uploadMedia } from '../lib/uploadMedia';

const PRESET_TAGS = ['Dates', 'Hookup', 'Friends', 'Relationship', 'Chat', 'Networking'];

export default function Onboarding() {
  const { user, hasProfile, checkProfileStatus } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    displayName: '',
    age: '',
    height: '',
    weight: '',
    sexualRole: 'Versatile',
    intent: 'Chat',
    bio: '',
    pronouns: '',
    relationship: '',
    bodyType: '',
    hivStatus: '',
    tags: [] as string[],
  });

  if (!user) return <Navigate to="/login" />;
  if (hasProfile) return <Navigate to="/" />;

  const handleVerify = async () => {
    setLoading(true);
    setTimeout(async () => {
      await setDoc(doc(db, 'users', user.uid), { isVerified: true }, { merge: true });
      setStep(2);
      setLoading(false);
    }, 2000);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const toggleTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const createProfile = async (latitude: number, longitude: number) => {
      try {
        let photoURL = user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`;
        let photos: string[] = [];

        if (photoFile) {
          const uploadedUrl = await uploadMedia(photoFile, `profile-photos/${user.uid}/${Date.now()}_${photoFile.name}`);
          photoURL = uploadedUrl;
          photos = [uploadedUrl];
        }

        await setDoc(doc(db, 'public_profiles', user.uid), {
          uid: user.uid,
          displayName: formData.displayName,
          age: parseInt(formData.age) || 18,
          height: parseInt(formData.height) || 0,
          weight: parseInt(formData.weight) || 0,
          sexualRole: formData.sexualRole,
          intent: formData.intent,
          bio: formData.bio,
          pronouns: formData.pronouns,
          relationship: formData.relationship,
          bodyType: formData.bodyType,
          hivStatus: formData.hivStatus,
          tags: formData.tags,
          lat: latitude,
          lng: longitude,
          lastActive: Date.now(),
          tribes: [],
          photoURL,
          photos,
        });

        await checkProfileStatus(user.uid);
        navigate('/');
      } catch (error) {
        console.error("Error creating profile", error);
        alert("Failed to create profile. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => createProfile(position.coords.latitude, position.coords.longitude),
        () => createProfile(37.7749, -122.4194),
        { timeout: 10000 }
      );
    } else {
      createProfile(37.7749, -122.4194);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-zinc-900 rounded-2xl p-8 shadow-xl border border-zinc-800">
        {step === 1 ? (
          <div className="space-y-6 text-center">
            <h2 className="text-2xl font-bold">Verify Your Identity</h2>
            <p className="text-zinc-400">To keep our community safe, we need to verify you are a real person.</p>
            <div className="bg-zinc-800 rounded-xl p-8 flex justify-center items-center border-2 border-dashed border-zinc-700">
              <Camera className="w-16 h-16 text-zinc-500" />
            </div>
            <p className="text-sm text-zinc-500">Look left and blink.</p>
            <button
              onClick={handleVerify}
              disabled={loading}
              className="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-full text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Start Verification'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center mb-6">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <h2 className="text-2xl font-bold">Verified!</h2>
              <p className="text-zinc-400">Now, let's build your profile.</p>
            </div>

            {/* Photo Upload */}
            <div className="flex flex-col items-center space-y-2">
              <label className="block text-sm font-medium text-zinc-400">Profile Photo</label>
              <label className="cursor-pointer">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-zinc-800 border-2 border-dashed border-zinc-600 flex items-center justify-center hover:border-rose-500 transition-colors">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="w-8 h-8 text-zinc-500" />
                  )}
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
              </label>
              <p className="text-xs text-zinc-500">Tap to upload photo</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400">Display Name *</label>
              <input required type="text" value={formData.displayName} onChange={e => setFormData({...formData, displayName: e.target.value})} className="mt-1 block w-full rounded-md bg-zinc-800 border-zinc-700 text-white px-3 py-2" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400">Age</label>
                <input required type="number" min="18" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} className="mt-1 block w-full rounded-md bg-zinc-800 border-zinc-700 text-white px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400">Height (cm)</label>
                <input type="number" value={formData.height} onChange={e => setFormData({...formData, height: e.target.value})} className="mt-1 block w-full rounded-md bg-zinc-800 border-zinc-700 text-white px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400">Weight (kg)</label>
                <input type="number" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} className="mt-1 block w-full rounded-md bg-zinc-800 border-zinc-700 text-white px-3 py-2" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400">Pronouns</label>
                <select value={formData.pronouns} onChange={e => setFormData({...formData, pronouns: e.target.value})} className="mt-1 block w-full rounded-md bg-zinc-800 border-zinc-700 text-white px-3 py-2">
                  <option value="">Select...</option>
                  <option value="he/him">he/him</option>
                  <option value="they/them">they/them</option>
                  <option value="she/her">she/her</option>
                  <option value="he/they">he/they</option>
                  <option value="any/all">any/all</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400">Relationship</label>
                <select value={formData.relationship} onChange={e => setFormData({...formData, relationship: e.target.value})} className="mt-1 block w-full rounded-md bg-zinc-800 border-zinc-700 text-white px-3 py-2">
                  <option value="">Select...</option>
                  <option value="Single">Single</option>
                  <option value="Partnered">Partnered</option>
                  <option value="Married">Married</option>
                  <option value="Open Relationship">Open Relationship</option>
                  <option value="Complicated">Complicated</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400">Body Type</label>
                <select value={formData.bodyType} onChange={e => setFormData({...formData, bodyType: e.target.value})} className="mt-1 block w-full rounded-md bg-zinc-800 border-zinc-700 text-white px-3 py-2">
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
                <label className="block text-sm font-medium text-zinc-400">HIV Status</label>
                <select value={formData.hivStatus} onChange={e => setFormData({...formData, hivStatus: e.target.value})} className="mt-1 block w-full rounded-md bg-zinc-800 border-zinc-700 text-white px-3 py-2">
                  <option value="">Select...</option>
                  <option value="Negative">Negative</option>
                  <option value="Negative, on PrEP">Neg, on PrEP</option>
                  <option value="Positive, Undetectable">Positive, U=U</option>
                  <option value="Positive">Positive</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400">Role</label>
              <select value={formData.sexualRole} onChange={e => setFormData({...formData, sexualRole: e.target.value})} className="mt-1 block w-full rounded-md bg-zinc-800 border-zinc-700 text-white px-3 py-2">
                <option>Top</option>
                <option>Versatile</option>
                <option>Bottom</option>
                <option>Side</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400">Primary Intent</label>
              <select value={formData.intent} onChange={e => setFormData({...formData, intent: e.target.value})} className="mt-1 block w-full rounded-md bg-zinc-800 border-zinc-700 text-white px-3 py-2">
                <option>Right Now</option>
                <option>Dates</option>
                <option>Chat</option>
                <option>Networking</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Looking For (pick all that apply)</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_TAGS.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      formData.tags.includes(tag)
                        ? 'bg-rose-500 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400">Bio</label>
              <textarea value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} className="mt-1 block w-full rounded-md bg-zinc-800 border-zinc-700 text-white px-3 py-2" rows={3} placeholder="Tell people about yourself..." />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-full text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 mt-6"
            >
              {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Complete Profile'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
