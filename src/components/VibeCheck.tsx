import React, { useState, useEffect } from 'react';
import { Zap, Smile, Target, MapPin, Battery, Send, Clock } from 'lucide-react';

interface VibeData {
  user_id: string;
  current_mood: string[];
  current_intent: string[];
  availability: string;
  activity_status: string;
  activity_description: string;
  social_battery: number;
  expires_at: string;
}

interface NearbyVibe extends VibeData {
  display_name: string;
  photos: string[];
  lat: number;
  lng: number;
}

export default function VibeCheck() {
  const [myVibe, setMyVibe] = useState<VibeData | null>(null);
  const [nearbyVibes, setNearbyVibes] = useState<NearbyVibe[]>([]);
  const [loading, setLoading] = useState(false);

  const [vibe, setVibe] = useState({
    currentMood: [] as string[],
    currentIntent: [] as string[],
    availability: 'flexible',
    activityStatus: '',
    activityDescription: '',
    socialBattery: 50,
    expiresIn: 24, // hours
  });

  useEffect(() => {
    fetchMyVibe();
    fetchNearbyVibes();
  }, []);

  const fetchMyVibe = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/features/vibe', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data) {
          setMyVibe(data);
          setVibe({
            currentMood: data.current_mood || [],
            currentIntent: data.current_intent || [],
            availability: data.availability || 'flexible',
            activityStatus: data.activity_status || '',
            activityDescription: data.activity_description || '',
            socialBattery: data.social_battery || 50,
            expiresIn: 24,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching vibe:', error);
    }
  };

  const fetchNearbyVibes = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/features/vibe/nearby', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setNearbyVibes(data);
      }
    } catch (error) {
      console.error('Error fetching nearby vibes:', error);
    }
  };

  const handleSetVibe = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/features/vibe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(vibe),
      });

      if (response.ok) {
        const data = await response.json();
        setMyVibe(data);
      }
    } catch (error) {
      console.error('Error setting vibe:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleMood = (mood: string) => {
    setVibe({
      ...vibe,
      currentMood: vibe.currentMood.includes(mood)
        ? vibe.currentMood.filter(m => m !== mood)
        : [...vibe.currentMood, mood],
    });
  };

  const toggleIntent = (intent: string) => {
    setVibe({
      ...vibe,
      currentIntent: vibe.currentIntent.includes(intent)
        ? vibe.currentIntent.filter(i => i !== intent)
        : [...vibe.currentIntent, intent],
    });
  };

  const moods = [
    { emoji: '😊', label: 'happy', color: 'bg-yellow-500' },
    { emoji: '😌', label: 'chill', color: 'bg-blue-500' },
    { emoji: '🔥', label: 'horny', color: 'bg-red-500' },
    { emoji: '🤩', label: 'adventurous', color: 'bg-purple-500' },
    { emoji: '😴', label: 'tired', color: 'bg-gray-500' },
    { emoji: '🗣️', label: 'social', color: 'bg-green-500' },
  ];

  const intents = [
    { emoji: '💬', label: 'chat' },
    { emoji: '☕', label: 'meet' },
    { emoji: '🍽️', label: 'date' },
    { emoji: '🔥', label: 'hookup' },
    { emoji: '🤝', label: 'friendship' },
    { emoji: '📵', label: 'nothing' },
  ];

  const timeRemaining = myVibe
    ? Math.max(0, Math.floor((new Date(myVibe.expires_at).getTime() - Date.now()) / (1000 * 60 * 60)))
    : 0;

  return (
    <div className="space-y-6">
      {/* My Vibe */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              My Current Vibe
            </h3>
            {myVibe && timeRemaining > 0 && (
              <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Expires in {timeRemaining}h
              </p>
            )}
          </div>
          <button
            onClick={handleSetVibe}
            disabled={loading || vibe.currentMood.length === 0}
            className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 rounded-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Setting...' : <><Send className="w-4 h-4" /> Update Vibe</>}
          </button>
        </div>

        {/* Current Mood */}
        <div className="mb-6">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Smile className="w-4 h-4" />
            Current Mood
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {moods.map((mood) => (
              <button
                key={mood.label}
                onClick={() => toggleMood(mood.label)}
                className={`p-3 rounded-lg transition ${
                  vibe.currentMood.includes(mood.label)
                    ? `${mood.color} text-white`
                    : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                <span className="text-2xl">{mood.emoji}</span>
                <p className="text-xs mt-1 capitalize">{mood.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Current Intent */}
        <div className="mb-6">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Looking For
          </h4>
          <div className="flex flex-wrap gap-2">
            {intents.map((intent) => (
              <button
                key={intent.label}
                onClick={() => toggleIntent(intent.label)}
                className={`px-4 py-2 rounded-full transition ${
                  vibe.currentIntent.includes(intent.label)
                    ? 'bg-pink-500 text-white'
                    : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                <span className="mr-2">{intent.emoji}</span>
                {intent.label}
              </button>
            ))}
          </div>
        </div>

        {/* Availability */}
        <div className="mb-6">
          <h4 className="font-semibold mb-3">Availability</h4>
          <div className="flex gap-2">
            {['now', 'today', 'weekend', 'flexible'].map((avail) => (
              <button
                key={avail}
                onClick={() => setVibe({ ...vibe, availability: avail })}
                className={`flex-1 px-3 py-2 rounded-lg transition ${
                  vibe.availability === avail
                    ? 'bg-purple-500 text-white'
                    : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                {avail}
              </button>
            ))}
          </div>
        </div>

        {/* Activity Status */}
        <div className="mb-6">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Current Activity
          </h4>
          <select
            value={vibe.activityStatus}
            onChange={(e) => setVibe({ ...vibe, activityStatus: e.target.value })}
            className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20"
          >
            <option value="">Not specified</option>
            <option value="at_home">At Home</option>
            <option value="at_work">At Work</option>
            <option value="out_social">Out Socializing</option>
            <option value="traveling">Traveling</option>
            <option value="at_gym">At Gym</option>
            <option value="at_cafe">At Cafe</option>
          </select>
        </div>

        {/* Social Battery */}
        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Battery className="w-4 h-4" />
            Social Battery
          </h4>
          <div className="space-y-2">
            <input
              type="range"
              min="0"
              max="100"
              value={vibe.socialBattery}
              onChange={(e) => setVibe({ ...vibe, socialBattery: parseInt(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-gray-400">
              <span>🪫 Need space</span>
              <span className="font-bold text-lg">{vibe.socialBattery}%</span>
              <span>⚡ Ready to mingle</span>
            </div>
          </div>
        </div>
      </div>

      {/* Nearby Vibes */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <h3 className="text-xl font-bold mb-4">Nearby Vibes</h3>

        {nearbyVibes.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No one nearby has shared their vibe yet</p>
        ) : (
          <div className="space-y-3">
            {nearbyVibes.map((vibeData) => (
              <div key={vibeData.user_id} className="bg-black/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <img
                    src={vibeData.photos?.[0] || '/default-avatar.png'}
                    alt={vibeData.display_name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <h4 className="font-semibold">{vibeData.display_name}</h4>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {vibeData.current_mood?.map((mood) => (
                        <span key={mood} className="text-xs px-2 py-0.5 bg-yellow-500/30 rounded-full capitalize">
                          {mood}
                        </span>
                      ))}
                      {vibeData.current_intent?.map((intent) => (
                        <span key={intent} className="text-xs px-2 py-0.5 bg-pink-500/30 rounded-full capitalize">
                          {intent}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-1 capitalize">
                      {vibeData.activity_status?.replace('_', ' ')} • {vibeData.availability}
                    </p>
                  </div>
                  {vibeData.social_battery && (
                    <div className="text-center">
                      <Battery className="w-5 h-5" />
                      <p className="text-sm font-bold">{vibeData.social_battery}%</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
