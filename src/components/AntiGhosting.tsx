/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Users,
  Bell,
  Send,
  Calendar,
  TrendingUp,
  Award,
  Flame,
  Heart,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface Pledge {
  id: string;
  match_id: number;
  user1_pledge_status: string;
  user2_pledge_status: string;
  response_expectation_hours: number;
  both_agreed_at: string | null;
  pledge_active: boolean;
}

interface Metrics {
  pledges_agreed: number;
  pledges_broken: number;
  pledge_compliance_rate: number;
  average_response_time_hours: number;
  longest_response_gap_hours: number;
  nudges_sent: number;
  nudges_responded: number;
  nudge_response_rate: number;
  current_streak_days: number;
  longest_streak_days: number;
  reliability_score: number;
}

interface Nudge {
  id: string;
  match_id: number;
  sender_id: number;
  recipient_id: number;
  nudge_type: string;
  scheduled_for: string;
  status: string;
  custom_message: string | null;
  sender_name?: string;
  recipient_name?: string;
}

interface LastSeen {
  user_id: number;
  last_active_at: string;
  is_online: boolean;
}

interface AntiGhostingProps {
  matchId: number;
  otherUserId: number;
}

export default function AntiGhosting({ matchId, otherUserId }: AntiGhostingProps) {
  const [pledge, setPledge] = useState<Pledge | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [lastSeen, setLastSeen] = useState<LastSeen | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [responseHours, setResponseHours] = useState(48);

  useEffect(() => {
    fetchPledge();
    fetchMetrics();
    fetchNudges();
    fetchLastSeen();
  }, [matchId, otherUserId]);

  const fetchPledge = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/ghosting/pledge/${matchId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPledge(data);
      }
    } catch {
      // Silent fail
    }
  };

  const fetchMetrics = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/ghosting/metrics', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch {
      // Silent fail
    }
  };

  const fetchNudges = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/ghosting/nudges', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setNudges(data);
      }
    } catch {
      // Silent fail
    }
  };

  const fetchLastSeen = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/ghosting/last-seen/${otherUserId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setLastSeen(data);
      }
    } catch {
      // Silent fail
    }
  };

  const agreeToPledge = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/ghosting/pledge/${matchId}/agree`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ response_expectation_hours: responseHours }),
      });

      if (response.ok) {
        const data = await response.json();
        setPledge(data);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  const declinePledge = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/ghosting/pledge/${matchId}/decline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      await fetchPledge();
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  const triggerNudge = async () => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/ghosting/nudges/${matchId}/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          nudge_type: 'gentle_nudge',
          custom_message: "Hey! Just checking in. Would love to hear from you!"
        }),
      });
    } catch {
      // Silent fail
    }
  };

  const updateLastSeen = async () => {
    const token = localStorage.getItem('token');
    try {
      await fetch('/api/ghosting/last-seen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'chat_opened' }),
      });
    } catch {
      // Silent fail
    }
  };

  useEffect(() => {
    // Update last seen when component mounts
    updateLastSeen();

    // Poll for online status
    const interval = setInterval(() => {
      fetchLastSeen();
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [otherUserId]);

  const formatLastActive = (dateString: string | null) => {
    if (!dateString) return 'Unknown';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getNudgeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      '24h_reminder': '24h Reminder',
      '48h_reminder': '48h Reminder',
      '72h_reminder': '72h Reminder',
      'friendly_check': 'Friendly Check',
      'pledge_reminder': 'Pledge Reminder',
      'gentle_nudge': 'Gentle Nudge',
    };
    return labels[type] || type;
  };

  const getNudgeTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      '24h_reminder': 'bg-blue-500/20 text-blue-300 border-blue-500/50',
      '48h_reminder': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
      '72h_reminder': 'bg-orange-500/20 text-orange-300 border-orange-500/50',
      'friendly_check': 'bg-green-500/20 text-green-300 border-green-500/50',
      'pledge_reminder': 'bg-purple-500/20 text-purple-300 border-purple-500/50',
      'gentle_nudge': 'bg-pink-500/20 text-pink-300 border-pink-500/50',
    };
    return colors[type] || 'bg-gray-500/20 text-gray-300 border-gray-500/50';
  };

  return (
    <div className="space-y-4">
      {/* Pledge Section */}
      {pledge && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${pledge.pledge_active ? 'bg-green-500/20' : 'bg-gray-500/20'}`}>
                <Shield className={`w-5 h-5 ${pledge.pledge_active ? 'text-green-400' : 'text-gray-400'}`} />
              </div>
              <div>
                <h3 className="font-semibold">Anti-Ghosting Pledge</h3>
                <p className="text-sm text-gray-400">
                  {pledge.pledge_active
                    ? `Both agreed to respond within ${pledge.response_expectation_hours}h`
                    : 'Agree to respond within a time limit'}
                </p>
              </div>
            </div>
            {pledge.pledge_active && (
              <span className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-xs font-semibold">
                Active
              </span>
            )}
          </div>

          {/* Pledge Status */}
          <div className="space-y-3">
            {pledge.pledge_active ? (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="font-semibold text-green-300">Pledge Active</span>
                </div>
                <p className="text-sm text-gray-300">
                  Both users have agreed to respond within {pledge.response_expectation_hours} hours.
                  This helps maintain respectful communication.
                </p>
                {pledge.both_agreed_at && (
                  <p className="text-xs text-gray-400 mt-2">
                    Started: {new Date(pledge.both_agreed_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-white/5 rounded-lg p-4">
                <p className="text-sm text-gray-300 mb-4">
                  Take the pledge to respond within a set time. Both users must agree to activate.
                </p>

                <div className="flex gap-3 mb-4">
                  {[24, 48, 72].map((hours) => (
                    <button
                      key={hours}
                      onClick={() => setResponseHours(hours)}
                      className={`px-4 py-2 rounded-lg transition ${
                        responseHours === hours
                          ? 'bg-pink-500 text-white'
                          : 'bg-white/5 hover:bg-white/10 text-gray-300'
                      }`}
                    >
                      {hours}h
                    </button>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={agreeToPledge}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-700 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Agree
                  </button>
                  <button
                    onClick={declinePledge}
                    disabled={loading}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Last Seen & Online Status */}
      {lastSeen && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${lastSeen.is_online ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
            <div className="flex-1">
              <p className="text-sm">
                {lastSeen.is_online ? (
                  <span className="text-green-400 font-medium">Online now</span>
                ) : (
                  <span className="text-gray-400">Last active {formatLastActive(lastSeen.last_active_at)}</span>
                )}
              </p>
            </div>
            <Eye className="w-4 h-4 text-gray-500" />
          </div>
        </div>
      )}

      {/* Pending Nudges */}
          {nudges.length > 0 && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-yellow-400" />
            <h3 className="font-semibold">Pending Nudges</h3>
            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-300 rounded-full text-xs">
              {nudges.length}
            </span>
          </div>

          <div className="space-y-3">
            {nudges.map((nudge) => (
              <div
                key={nudge.id}
                className={`border rounded-lg p-4 ${getNudgeTypeColor(nudge.nudge_type)}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm font-medium">
                    {getNudgeTypeLabel(nudge.nudge_type)}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    nudge.status === 'pending' ? 'bg-gray-500/30' : 'bg-green-500/30'
                  }`}>
                    {nudge.status}
                  </span>
                </div>
                {nudge.custom_message && (
                  <p className="text-sm mt-2">"{nudge.custom_message}"</p>
                )}
                <p className="text-xs mt-2 opacity-70">
                  Scheduled: {new Date(nudge.scheduled_for).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Your Metrics */}
      {metrics && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-400" />
              <h3 className="font-semibold">Your Reliability Score</h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-2xl font-bold text-green-400">{metrics.reliability_score.toFixed(0)}%</p>
                <p className="text-xs text-gray-400">reliability</p>
              </div>
              {showDetails ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </div>
          </button>

          {showDetails && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <Flame className="w-5 h-5 text-orange-400 mx-auto mb-1" />
                <p className="text-lg font-bold">{metrics.current_streak_days}</p>
                <p className="text-xs text-gray-400">Day Streak</p>
              </div>

              <div className="bg-white/5 rounded-lg p-3 text-center">
                <CheckCircle className="w-5 h-5 text-green-400 mx-auto mb-1" />
                <p className="text-lg font-bold">{metrics.pledges_agreed}</p>
                <p className="text-xs text-gray-400">Pledges Kept</p>
              </div>

              <div className="bg-white/5 rounded-lg p-3 text-center">
                <AlertCircle className="w-5 h-5 text-red-400 mx-auto mb-1" />
                <p className="text-lg font-bold">{metrics.pledges_broken}</p>
                <p className="text-xs text-gray-400">Pledges Broken</p>
              </div>

              <div className="bg-white/5 rounded-lg p-3 text-center">
                <Clock className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                <p className="text-lg font-bold">{metrics.average_response_time_hours?.toFixed(1)}h</p>
                <p className="text-xs text-gray-400">Avg Response</p>
              </div>

              <div className="bg-white/5 rounded-lg p-3 text-center">
                <TrendingUp className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                <p className="text-lg font-bold">{metrics.longest_streak_days}</p>
                <p className="text-xs text-gray-400">Best Streak</p>
              </div>

              <div className="bg-white/5 rounded-lg p-3 text-center">
                <Users className="w-5 h-5 text-pink-400 mx-auto mb-1" />
                <p className="text-lg font-bold">{metrics.nudge_response_rate?.toFixed(0)}%</p>
                <p className="text-xs text-gray-400">Nudge Response</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Nudge Button */}
      <button
        onClick={triggerNudge}
        className="w-full px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg transition flex items-center justify-center gap-2"
      >
        <Bell className="w-5 h-5" />
        Send Friendly Nudge
      </button>
    </div>
  );
}
