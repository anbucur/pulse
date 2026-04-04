import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  TrendingUp,
  Battery,
  Users,
  Plus,
  Edit2,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Zap,
  Moon,
  Sun,
  Heart,
  Sparkles,
  Coffee,
  PartyPopper,
} from 'lucide-react';

interface VibeEntry {
  id: string;
  user_id: string;
  date: string;
  mood: 'high-energy' | 'hermit' | 'social' | 'creative' | 'intimate';
  energy: number;
  social_appetite: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

interface TimelineStats {
  avgEnergy: number;
  avgSocial: number;
  dominantMood: string;
  trend: 'up' | 'down' | 'stable';
}

const moodConfig: Record<string, { icon: React.ReactNode; label: string; color: string; bgColor: string }> = {
  'high-energy': {
    icon: <Zap className="w-4 h-4" />,
    label: 'High Energy',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/20',
  },
  hermit: {
    icon: <Moon className="w-4 h-4" />,
    label: 'Hermit',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-400/20',
  },
  social: {
    icon: <Users className="w-4 h-4" />,
    label: 'Social',
    color: 'text-green-400',
    bgColor: 'bg-green-400/20',
  },
  creative: {
    icon: <Sparkles className="w-4 h-4" />,
    label: 'Creative',
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/20',
  },
  intimate: {
    icon: <Heart className="w-4 h-4" />,
    label: 'Intimate',
    color: 'text-pink-400',
    bgColor: 'bg-pink-400/20',
  },
};

const moodOptions: VibeEntry['mood'][] = ['high-energy', 'hermit', 'social', 'creative', 'intimate'];

export default function VibeTimeline() {
  const [entries, setEntries] = useState<VibeEntry[]>([]);
  const [stats, setStats] = useState<TimelineStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<VibeEntry | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    mood: 'social' as VibeEntry['mood'],
    energy: 50,
    social_appetite: 50,
    note: '',
  });

  useEffect(() => {
    fetchTimeline();
  }, [weekOffset]);

  const getWeekDates = () => {
    const dates: Date[] = [];
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1 + weekOffset * 7);
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatDateForAPI = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const fetchTimeline = async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('token');
    try {
      const weekDates = getWeekDates();
      const startDate = formatDateForAPI(weekDates[0]);
      const endDate = formatDateForAPI(weekDates[6]);

      const response = await fetch(`/api/vibe?start=${startDate}&end=${endDate}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch timeline');
      }

      const data = await response.json();
      setEntries(data.entries || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const saveEntry = async () => {
    const token = localStorage.getItem('token');
    setLoading(true);
    setError(null);

    try {
      const url = editingEntry ? `/api/vibe/${editingEntry.id}` : '/api/vibe';
      const method = editingEntry ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to save entry');
      }

      setShowModal(false);
      setEditingEntry(null);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        mood: 'social',
        energy: 50,
        social_appetite: 50,
        note: '',
      });
      await fetchTimeline();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/vibe/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to delete entry');
      }

      await fetchTimeline();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const openEditModal = (entry: VibeEntry) => {
    setEditingEntry(entry);
    setFormData({
      date: entry.date,
      mood: entry.mood,
      energy: entry.energy,
      social_appetite: entry.social_appetite,
      note: entry.note || '',
    });
    setShowModal(true);
  };

  const openNewModal = (date: Date) => {
    setEditingEntry(null);
    setFormData({
      date: formatDateForAPI(date),
      mood: 'social',
      energy: 50,
      social_appetite: 50,
      note: '',
    });
    setShowModal(true);
  };

  const getEntryForDate = (date: Date) => {
    const dateStr = formatDateForAPI(date);
    return entries.find(e => e.date === dateStr);
  };

  const weekDates = getWeekDates();

  return (
    <div className="space-y-6">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="w-6 h-6 text-pink-500" />
              Vibe Timeline
            </h2>
            <p className="text-gray-400 mt-1">Track your weekly moods and patterns</p>
          </div>
          <button
            onClick={() => openNewModal(new Date())}
            className="px-4 py-2 bg-pink-500 hover:bg-pink-600 rounded-lg transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Log Today
          </button>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300 mb-4">
            {error}
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white/5 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <TrendingUp className="w-4 h-4" />
                Avg Energy
              </div>
              <p className="text-2xl font-bold">{stats.avgEnergy}%</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <Users className="w-4 h-4" />
                Avg Social
              </div>
              <p className="text-2xl font-bold">{stats.avgSocial}%</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <Sparkles className="w-4 h-4" />
                Dominant Mood
              </div>
              <p className="text-lg font-bold capitalize">{stats.dominantMood}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <Clock className="w-4 h-4" />
                Trend
              </div>
              <p className={`text-lg font-bold capitalize ${
                stats.trend === 'up' ? 'text-green-400' : stats.trend === 'down' ? 'text-red-400' : 'text-yellow-400'
              }`}>
                {stats.trend}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setWeekOffset(weekOffset - 1)}
            className="p-2 hover:bg-white/10 rounded-lg transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex gap-2 flex-1 justify-center">
            {weekDates.map((date, i) => {
              const entry = getEntryForDate(date);
              const isToday = formatDateForAPI(date) === formatDateForAPI(new Date());
              return (
                <div
                  key={i}
                  className={`flex-1 max-w-[120px] ${isToday ? 'ring-2 ring-pink-500 rounded-lg' : ''}`}
                >
                  <p className="text-center text-xs text-gray-400 mb-2">{formatDate(date)}</p>
                  {entry ? (
                    <div
                      className={`${moodConfig[entry.mood].bgColor} rounded-lg p-3 cursor-pointer hover:opacity-80 transition`}
                      onClick={() => openEditModal(entry)}
                    >
                      <div className={`flex items-center gap-1 ${moodConfig[entry.mood].color} mb-1`}>
                        {moodConfig[entry.mood].icon}
                        <span className="text-xs font-medium">{moodConfig[entry.mood].label}</span>
                      </div>
                      <div className="flex gap-2 text-xs text-gray-300">
                        <span className="flex items-center gap-1">
                          <Battery className="w-3 h-3" />
                          {entry.energy}%
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {entry.social_appetite}%
                        </span>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => openNewModal(date)}
                      className="w-full h-16 border-2 border-dashed border-white/10 rounded-lg hover:border-white/30 transition flex items-center justify-center"
                    >
                      <Plus className="w-4 h-4 text-gray-500" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => setWeekOffset(weekOffset + 1)}
            className="p-2 hover:bg-white/10 rounded-lg transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {weekOffset === 0 && (
          <button
            onClick={() => setWeekOffset(0)}
            className="mt-2 text-sm text-pink-400 hover:text-pink-300"
          >
            Back to current week
          </button>
        )}
      </div>

      {entries.length > 0 && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-pink-500" />
            Recent Entries
          </h3>
          <div className="space-y-3">
            {entries.slice(0, 7).reverse().map((entry) => {
              const mood = moodConfig[entry.mood];
              return (
                <div key={entry.id} className="bg-white/5 rounded-lg p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full ${mood.bgColor} flex items-center justify-center ${mood.color}`}>
                    {mood.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{mood.label}</span>
                      <span className="text-sm text-gray-400">
                        {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    {entry.note && (
                      <p className="text-sm text-gray-300 mt-1 line-clamp-1">{entry.note}</p>
                    )}
                  </div>
                  <div className="flex gap-4 text-sm">
                    <div className="text-center">
                      <Battery className="w-4 h-4 mx-auto text-gray-400" />
                      <p className="font-medium">{entry.energy}%</p>
                    </div>
                    <div className="text-center">
                      <Users className="w-4 h-4 mx-auto text-gray-400" />
                      <p className="font-medium">{entry.social_appetite}%</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditModal(entry)}
                      className="p-2 hover:bg-white/10 rounded-lg transition"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="p-2 hover:bg-red-500/20 rounded-lg transition text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-xl font-bold">{editingEntry ? 'Edit Entry' : 'Log Vibe'}</h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingEntry(null);
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Mood</label>
                <div className="grid grid-cols-5 gap-2">
                  {moodOptions.map((mood) => {
                    const config = moodConfig[mood];
                    return (
                      <button
                        key={mood}
                        onClick={() => setFormData({ ...formData, mood })}
                        className={`p-3 rounded-lg transition flex flex-col items-center gap-1 ${
                          formData.mood === mood
                            ? `${config.bgColor} ${config.color}`
                            : 'bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        {config.icon}
                        <span className="text-xs">{config.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  Energy Level ({formData.energy}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.energy}
                  onChange={(e) => setFormData({ ...formData, energy: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Depleted</span>
                  <span>Full power</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4 text-green-400" />
                  Social Appetite ({formData.social_appetite}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.social_appetite}
                  onChange={(e) => setFormData({ ...formData, social_appetite: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Solo mode</span>
                  <span>Social butterfly</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Note (optional)</label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                  rows={3}
                  placeholder="How was your day? Any triggers or highlights?"
                />
              </div>

              <button
                onClick={saveEntry}
                disabled={loading}
                className="w-full px-6 py-3 bg-pink-500 hover:bg-pink-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition flex items-center justify-center gap-2"
              >
                {loading ? 'Saving...' : (editingEntry ? 'Update Entry' : 'Save Entry')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}