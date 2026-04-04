import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Shield, Bell, Eye, MapPin, Lock, Moon, Globe, Heart,
  Trash2, LogOut, ChevronRight, ToggleLeft, ToggleRight, Palette,
  Crown, Volume2, VolumeX, Wifi, WifiOff, MessageCircle, Zap
} from 'lucide-react';

interface SettingsData {
  privacy: {
    showOnline: boolean;
    showDistance: boolean;
    showReadReceipts: boolean;
    showTyping: boolean;
    allowScreenshots: boolean;
    profileVisibility: 'public' | 'connections' | 'private';
  };
  notifications: {
    newMatches: boolean;
    newMessages: boolean;
    profileViews: boolean;
    vibeNearby: boolean;
    weeklyDigest: boolean;
    marketing: boolean;
  };
  appearance: {
    theme: 'dark' | 'light' | 'system';
    compactMode: boolean;
  };
  discovery: {
    showOnGrid: boolean;
    maxDistance: number;
    ageMin: number;
    ageMax: number;
    showGhostMode: boolean;
  };
}

export default function Settings() {
  const { user, logout, isPremium } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<SettingsData>({
    privacy: {
      showOnline: true,
      showDistance: true,
      showReadReceipts: true,
      showTyping: true,
      allowScreenshots: false,
      profileVisibility: 'public',
    },
    notifications: {
      newMatches: true,
      newMessages: true,
      profileViews: true,
      vibeNearby: true,
      weeklyDigest: false,
      marketing: false,
    },
    appearance: {
      theme: 'dark',
      compactMode: false,
    },
    discovery: {
      showOnGrid: true,
      maxDistance: 100,
      ageMin: 18,
      ageMax: 99,
      showGhostMode: false,
    },
  });
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/profiles/me', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.privacy_settings) {
          setSettings(prev => ({
            ...prev,
            privacy: { ...prev.privacy, ...data.privacy_settings },
          }));
        }
        if (data.is_ghost_mode) {
          setSettings(prev => ({
            ...prev,
            discovery: { ...prev.discovery, showGhostMode: true },
          }));
        }
      }
    } catch (e) {
      console.error('Error fetching settings:', e);
    }
  };

  const saveSettings = async (section: string, data: any) => {
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/profiles/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
    } catch (e) {
      console.error('Error saving settings:', e);
    }
  };

  const updatePrivacy = (key: string, value: any) => {
    setSettings(prev => {
      const updated = { ...prev, privacy: { ...prev.privacy, [key]: value } };
      saveSettings('privacy', { privacy_settings: updated.privacy });
      return updated;
    });
  };

  const updateNotifications = (key: string, value: boolean) => {
    setSettings(prev => {
      const updated = { ...prev, notifications: { ...prev.notifications, [key]: value } };
      return updated;
    });
  };

  const updateDiscovery = (key: string, value: any) => {
    setSettings(prev => {
      const updated = { ...prev, discovery: { ...prev.discovery, [key]: value } };
      if (key === 'showGhostMode') {
        saveSettings('discovery', { is_ghost_mode: value });
      }
      return updated;
    });
  };

  const handleDeleteAccount = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/auth/account', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      logout();
      navigate('/login');
    } catch (e) {
      console.error('Error deleting account:', e);
    }
  };

  const Toggle = ({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => (
    <button onClick={onToggle} className="flex-shrink-0">
      {enabled ? (
        <ToggleRight className="w-8 h-8 text-rose-500" />
      ) : (
        <ToggleLeft className="w-8 h-8 text-zinc-600" />
      )}
    </button>
  );

  const SettingRow = ({ icon, label, description, children }: {
    icon: React.ReactNode;
    label: string;
    description?: string;
    children: React.ReactNode;
  }) => (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3 flex-1">
        <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-400">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-white">{label}</p>
          {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 p-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </button>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        </div>
      </div>

      <div className="p-4 space-y-6 max-w-2xl mx-auto">
        {/* Premium Banner */}
        {!isPremium && (
          <div className="bg-gradient-to-r from-rose-600 to-pink-600 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Crown className="w-8 h-8 text-yellow-300" />
              <div>
                <p className="font-bold">Upgrade to Premium</p>
                <p className="text-sm text-white/70">Unlock ghost mode, unlimited likes & more</p>
              </div>
            </div>
            <button className="px-4 py-2 bg-white text-rose-600 rounded-full font-bold text-sm">
              Upgrade
            </button>
          </div>
        )}

        {/* Privacy Section */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="font-semibold flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-500" />
              Privacy
            </h2>
          </div>
          <div className="px-4 divide-y divide-zinc-800">
            <SettingRow icon={<Eye className="w-4 h-4" />} label="Show Online Status" description="Let others see when you're active">
              <Toggle enabled={settings.privacy.showOnline} onToggle={() => updatePrivacy('showOnline', !settings.privacy.showOnline)} />
            </SettingRow>
            <SettingRow icon={<MapPin className="w-4 h-4" />} label="Show Distance" description="Display your approximate distance">
              <Toggle enabled={settings.privacy.showDistance} onToggle={() => updatePrivacy('showDistance', !settings.privacy.showDistance)} />
            </SettingRow>
            <SettingRow icon={<Eye className="w-4 h-4" />} label="Read Receipts" description="Let others see when you've read messages">
              <Toggle enabled={settings.privacy.showReadReceipts} onToggle={() => updatePrivacy('showReadReceipts', !settings.privacy.showReadReceipts)} />
            </SettingRow>
            <SettingRow icon={<Wifi className="w-4 h-4" />} label="Typing Indicators" description="Show when you're typing a message">
              <Toggle enabled={settings.privacy.showTyping} onToggle={() => updatePrivacy('showTyping', !settings.privacy.showTyping)} />
            </SettingRow>
            <SettingRow icon={<Globe className="w-4 h-4" />} label="Profile Visibility" description="Control who can see your profile">
              <select
                value={settings.privacy.profileVisibility}
                onChange={(e) => updatePrivacy('profileVisibility', e.target.value)}
                className="bg-zinc-800 border border-zinc-700 text-sm rounded-lg px-3 py-1.5"
              >
                <option value="public">Everyone</option>
                <option value="connections">Connections Only</option>
                <option value="private">Private</option>
              </select>
            </SettingRow>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="font-semibold flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-500" />
              Notifications
            </h2>
          </div>
          <div className="px-4 divide-y divide-zinc-800">
            <SettingRow icon={<Heart className="w-4 h-4" />} label="New Matches">
              <Toggle enabled={settings.notifications.newMatches} onToggle={() => updateNotifications('newMatches', !settings.notifications.newMatches)} />
            </SettingRow>
            <SettingRow icon={<MessageCircle className="w-4 h-4" />} label="New Messages">
              <Toggle enabled={settings.notifications.newMessages} onToggle={() => updateNotifications('newMessages', !settings.notifications.newMessages)} />
            </SettingRow>
            <SettingRow icon={<Eye className="w-4 h-4" />} label="Profile Views">
              <Toggle enabled={settings.notifications.profileViews} onToggle={() => updateNotifications('profileViews', !settings.notifications.profileViews)} />
            </SettingRow>
            <SettingRow icon={<Zap className="w-4 h-4" />} label="Vibe Nearby">
              <Toggle enabled={settings.notifications.vibeNearby} onToggle={() => updateNotifications('vibeNearby', !settings.notifications.vibeNearby)} />
            </SettingRow>
          </div>
        </div>

        {/* Discovery Section */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="font-semibold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-rose-500" />
              Discovery
            </h2>
          </div>
          <div className="px-4 divide-y divide-zinc-800">
            <SettingRow icon={<Globe className="w-4 h-4" />} label="Show on Grid" description="Appear in other people's browse grid">
              <Toggle enabled={settings.discovery.showOnGrid} onToggle={() => updateDiscovery('showOnGrid', !settings.discovery.showOnGrid)} />
            </SettingRow>
            <div className="py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-400">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <p className="text-sm font-medium">Max Distance</p>
                </div>
                <span className="text-sm text-rose-500 font-medium">{settings.discovery.maxDistance}km</span>
              </div>
              <input
                type="range"
                min="1"
                max="500"
                value={settings.discovery.maxDistance}
                onChange={(e) => updateDiscovery('maxDistance', parseInt(e.target.value))}
                className="w-full accent-rose-500"
              />
            </div>
            <SettingRow icon={<WifiOff className="w-4 h-4" />} label="Ghost Mode" description="Browse profiles without being seen">
              <Toggle enabled={settings.discovery.showGhostMode} onToggle={() => updateDiscovery('showGhostMode', !settings.discovery.showGhostMode)} />
            </SettingRow>
          </div>
        </div>

        {/* Account Section */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="font-semibold flex items-center gap-2">
              <Lock className="w-5 h-5 text-yellow-500" />
              Account
            </h2>
          </div>
          <div className="px-4 divide-y divide-zinc-800">
            <button
              onClick={() => navigate('/profile')}
              className="flex items-center justify-between py-3 w-full"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-400">
                  <Eye className="w-4 h-4" />
                </div>
                <p className="text-sm font-medium">Edit Profile</p>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-600" />
            </button>
            <button
              onClick={logout}
              className="flex items-center justify-between py-3 w-full"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-400">
                  <LogOut className="w-4 h-4" />
                </div>
                <p className="text-sm font-medium">Sign Out</p>
              </div>
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-zinc-900 rounded-2xl border border-red-900/50 overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="font-semibold text-red-500">Danger Zone</h2>
          </div>
          <div className="p-4">
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 text-sm text-red-500 hover:text-red-400"
              >
                <Trash2 className="w-4 h-4" />
                Delete Account
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-zinc-400">This action is permanent and cannot be undone. All your data will be deleted.</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteAccount}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    Yes, delete my account
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-zinc-600 pb-8">
          Pulse v1.0.0
        </p>
      </div>
    </div>
  );
}
