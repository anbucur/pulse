import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { Camera, CheckCircle2, Loader2 } from 'lucide-react';

export default function Onboarding() {
  const { user, checkProfileStatus } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    age: '',
    sexualRole: 'Versatile',
    intent: 'Chat',
    bio: '',
  });

  if (!user) return <Navigate to="/login" />;

  const handleVerify = async () => {
    setLoading(true);
    // Simulate AI verification
    setTimeout(() => {
      setStep(2);
      setLoading(false);
    }, 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const createProfile = async (latitude: number, longitude: number) => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/profiles/me', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            display_name: formData.displayName,
            age: parseInt(formData.age) || 18,
            sexual_role: [formData.sexualRole],
            intent: [formData.intent],
            bio: formData.bio,
            lat: latitude,
            lng: longitude,
            interests: [],
            tags: [],
          }),
        });

        if (!response.ok) throw new Error('Failed to create profile');

        await checkProfileStatus(user.id);
        navigate('/');
      } catch (error) {
        console.error('Error creating profile', error);
        alert('Failed to create profile. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          createProfile(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.warn('Error getting location, using default', error);
          createProfile(37.7749, -122.4194);
        },
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

            <div>
              <label className="block text-sm font-medium text-zinc-400">Display Name</label>
              <input required type="text" value={formData.displayName} onChange={e => setFormData({...formData, displayName: e.target.value})} className="mt-1 block w-full rounded-md bg-zinc-800 border-zinc-700 text-white px-3 py-2" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400">Age</label>
                <input required type="number" min="18" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} className="mt-1 block w-full rounded-md bg-zinc-800 border-zinc-700 text-white px-3 py-2" />
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
              <label className="block text-sm font-medium text-zinc-400">Bio</label>
              <textarea value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} className="mt-1 block w-full rounded-md bg-zinc-800 border-zinc-700 text-white px-3 py-2" rows={3}></textarea>
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
