/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Shield,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  Lock,
  Unlock,
  Info,
} from 'lucide-react';

interface BodyMapProps {
  targetUserId?: string;
  readOnly?: boolean;
}

interface Zone {
  id: string;
  name: string;
  color: 'green' | 'yellow' | 'red';
  description?: string;
}

const BODY_ZONES: Omit<Zone, 'color'>[] = [
  { id: 'head', name: 'Head/Face' },
  { id: 'neck', name: 'Neck/Throat' },
  { id: 'chest', name: 'Chest/Breasts' },
  { id: 'stomach', name: 'Stomach/Abdomen' },
  { id: 'groin', name: 'Groin/Genitals' },
  { id: 'butt', name: 'Buttocks' },
  { id: 'back', name: 'Back' },
  { id: 'arms', name: 'Arms/Hands' },
  { id: 'legs', name: 'Legs/Feet' },
];

const COLOR_LABELS: Record<Zone['color'], { label: string; description: string; bgClass: string; borderClass: string }> = {
  green: {
    label: 'Preferred',
    description: 'Love attention here',
    bgClass: 'bg-green-500/20 hover:bg-green-500/30',
    borderClass: 'border-green-500'
  },
  yellow: {
    label: 'Curious',
    description: 'Open to exploration',
    bgClass: 'bg-yellow-500/20 hover:bg-yellow-500/30',
    borderClass: 'border-yellow-500'
  },
  red: {
    label: 'Off-limits',
    description: 'No go zone',
    bgClass: 'bg-red-500/20 hover:bg-red-500/30',
    borderClass: 'border-red-500'
  }
};

export default function BodyMap({ targetUserId, readOnly = false }: BodyMapProps) {
  const [zones, setZones] = useState<Record<string, Zone['color']>>({});
  const [sharedWithMatches, setSharedWithMatches] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<Zone['color']>('green');
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    fetchBodyMap();
  }, [targetUserId]);

  const fetchBodyMap = async () => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      const url = targetUserId ? `/api/bodymap/${targetUserId}` : '/api/bodymap';
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch body map');
      }

      const data = await response.json();
      setZones(data.zones || {});
      setSharedWithMatches(data.shared_with_matches || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const saveBodyMap = async () => {
    setSaving(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/bodymap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ zones, shared_with_matches: sharedWithMatches }),
      });

      if (!response.ok) {
        throw new Error('Failed to save body map');
      }

      await fetchBodyMap();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const updateSharingSettings = async () => {
    setSaving(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/bodymap/share', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ shared_with_matches: !sharedWithMatches }),
      });

      if (!response.ok) {
        throw new Error('Failed to update sharing settings');
      }

      setSharedWithMatches(!sharedWithMatches);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleZoneClick = (zoneId: string) => {
    if (readOnly) return;

    const colors: Zone['color'][] = ['green', 'yellow', 'red', null];
    const currentIndex = colors.indexOf(zones[zoneId]);
    const nextIndex = (currentIndex + 1) % colors.length;
    const nextColor = colors[nextIndex];

    if (nextColor) {
      setZones({ ...zones, [zoneId]: nextColor });
    } else {
      const newZones = { ...zones };
      delete newZones[zoneId];
      setZones(newZones);
    }
  };

  const setZoneColor = (zoneId: string, color: Zone['color']) => {
    if (readOnly) return;
    setZones({ ...zones, [zoneId]: color });
  };

  const resetMap = () => {
    if (readOnly) return;
    setZones({});
  };

  const getZonePath = (zoneId: string): string => {
    const paths: Record<string, string> = {
      head: 'M 200 50 C 220 50 230 70 230 90 C 230 110 220 125 200 125 C 180 125 170 110 170 90 C 170 70 180 50 200 50',
      neck: 'M 185 125 L 185 145 L 215 145 L 215 125',
      chest: 'M 160 150 C 150 170 150 200 160 220 L 240 220 C 250 200 250 170 240 150 Z',
      stomach: 'M 165 225 C 155 250 155 280 165 300 L 235 300 C 245 280 245 250 235 225 Z',
      groin: 'M 170 305 C 160 320 165 350 200 355 C 235 350 240 320 230 305 Z',
      butt: 'M 170 360 C 155 380 155 410 200 420 C 245 410 245 380 230 360 Z',
      back: 'M 160 150 C 140 170 140 280 160 300 L 175 300 L 175 150 Z',
      arms: 'M 145 155 L 110 200 L 105 280 L 120 285 L 135 220 L 155 180',
      legs: 'M 175 360 L 160 420 L 165 490 L 185 490 L 190 420 L 200 420 L 210 420 L 215 490 L 235 490 L 240 420 L 225 360',
    };

    return paths[zoneId] || '';
  };

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-pink-500 border-t-transparent"></div>
        <p className="mt-4 text-gray-400">Loading body map...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <MapPin className="w-6 h-6 text-pink-500" />
              Body Map & Boundaries
            </h2>
            <p className="text-gray-400 mt-1">
              {readOnly
                ? "Your match's body map preferences"
                : 'Mark zones on your body: green (preferred), yellow (curious), red (off-limits)'
              }
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="p-2 hover:bg-white/10 rounded-lg transition"
              title="What is this?"
            >
              <Info className="w-5 h-5" />
            </button>
            {!readOnly && (
              <>
                <button
                  onClick={resetMap}
                  className="p-2 hover:bg-white/10 rounded-lg transition"
                  title="Reset"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
                <button
                  onClick={saveBodyMap}
                  disabled={saving}
                  className="px-4 py-2 bg-pink-500 hover:bg-pink-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Info Panel */}
        {showInfo && (
          <div className="mt-4 p-4 bg-white/5 rounded-lg">
            <h3 className="font-semibold mb-2">About Body Maps</h3>
            <p className="text-sm text-gray-300 mb-2">
              This interactive body map helps you communicate your boundaries and preferences to matches.
            </p>
            <ul className="text-sm space-y-1">
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                <strong>Green:</strong> Zones you enjoy attention
              </li>
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                <strong>Yellow:</strong> Zones you're curious about exploring
              </li>
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <strong>Red:</strong> Off-limits zones
              </li>
            </ul>
            {!readOnly && (
              <p className="text-sm text-gray-400 mt-3">
                Only shared with mutual matches when you enable sharing.
              </p>
            )}
          </div>
        )}

        {/* Sharing Toggle */}
        {!readOnly && (
          <div className="mt-4 flex items-center justify-between p-4 bg-white/5 rounded-lg">
            <div className="flex items-center gap-3">
              {sharedWithMatches ? (
                <Unlock className="w-5 h-5 text-green-500" />
              ) : (
                <Lock className="w-5 h-5 text-gray-500" />
              )}
              <div>
                <p className="font-medium">Share with Matches</p>
                <p className="text-sm text-gray-400">
                  {sharedWithMatches
                    ? 'Your body map is visible to mutual matches'
                    : 'Your body map is private'
                  }
                </p>
              </div>
            </div>
            <button
              onClick={updateSharingSettings}
              disabled={saving}
              className={`px-4 py-2 rounded-lg transition ${
                sharedWithMatches
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              {sharedWithMatches ? 'Shared' : 'Private'}
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {/* Main Content */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Color Selector (only when not read-only) */}
        {!readOnly && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4">Select Zone Color</h3>
            <div className="space-y-3">
              {(Object.entries(COLOR_LABELS) as [Zone['color'], typeof COLOR_LABELS[keyof Zone['color']]][]).map(([color, info]) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`w-full p-4 rounded-lg border-2 transition ${
                    selectedColor === color
                      ? `${info.borderClass} ${info.bgClass}`
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <p className="font-semibold">{info.label}</p>
                      <p className="text-sm text-gray-400">{info.description}</p>
                    </div>
                    <span className={`w-6 h-6 rounded-full bg-${color}-500`}></span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Interactive Body Map */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4">
            {readOnly ? 'Their Body Map' : 'Click Zones to Mark (or use color selector)'}
          </h3>
          <div className="flex justify-center">
            <svg width="400" height="500" viewBox="0 0 400 500" className="max-w-full">
              {/* Body outline */}
              <g>
                {BODY_ZONES.map((zone) => {
                  const zoneColor = zones[zone.id];
                  const fillColor = zoneColor
                    ? zoneColor === 'green'
                      ? '#22c55e33'
                      : zoneColor === 'yellow'
                      ? '#eab30833'
                      : '#ef444433'
                    : '#ffffff0d';

                  const strokeColor = zoneColor
                    ? zoneColor === 'green'
                      ? '#22c55e'
                      : zoneColor === 'yellow'
                      ? '#eab308'
                      : '#ef4444'
                    : '#ffffff20';

                  return (
                    <g key={zone.id}>
                      <path
                        d={getZonePath(zone.id)}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth="2"
                        className={`cursor-pointer ${!readOnly ? 'hover:opacity-80' : ''}`}
                        onClick={() => handleZoneClick(zone.id)}
                      />
                      {zoneColor && (
                        <title>
                          {zone.name}: {COLOR_LABELS[zoneColor].label}
                        </title>
                      )}
                    </g>
                  );
                })}

                {/* Zone labels (shown on hover or when colored) */}
                <text x="200" y="95" textAnchor="middle" className="fill-current text-xs pointer-events-none">Head</text>
                <text x="200" y="185" textAnchor="middle" className="fill-current text-xs pointer-events-none">Chest</text>
                <text x="200" y="265" textAnchor="middle" className="fill-current text-xs pointer-events-none">Stomach</text>
                <text x="200" y="330" textAnchor="middle" className="fill-current text-xs pointer-events-none">Groin</text>
                <text x="200" y="390" textAnchor="middle" className="fill-current text-xs pointer-events-none">Butt</text>
                <text x="125" y="220" textAnchor="middle" className="fill-current text-xs pointer-events-none">Arms</text>
                <text x="200" y="450" textAnchor="middle" className="fill-current text-xs pointer-events-none">Legs</text>
              </g>
            </svg>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-green-500/30 border border-green-500"></span>
              <span>Preferred</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-yellow-500/30 border border-yellow-500"></span>
              <span>Curious</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-red-500/30 border border-red-500"></span>
              <span>Off-limits</span>
            </div>
          </div>
        </div>
      </div>

      {/* Zone Details List */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <h3 className="text-lg font-semibold mb-4">Zone Details</h3>
        <div className="grid md:grid-cols-3 gap-3">
          {BODY_ZONES.map((zone) => {
            const color = zones[zone.id];
            if (!color) return null;

            const colorInfo = COLOR_LABELS[color];

            return (
              <div
                key={zone.id}
                className={`p-3 rounded-lg border-2 ${colorInfo.borderClass} ${colorInfo.bgClass}`}
              >
                <p className="font-medium">{zone.name}</p>
                <p className="text-sm text-gray-300">{colorInfo.label}</p>
              </div>
            );
          })}
          {Object.keys(zones).length === 0 && (
            <div className="col-span-full text-center text-gray-400 py-8">
              {readOnly
                ? "This match hasn't marked any zones yet"
                : 'Click on the body map to mark zones'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
