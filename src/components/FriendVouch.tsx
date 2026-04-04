/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Award,
  Send,
  UserPlus,
  ThumbsUp,
  MessageCircle,
  Tag,
  X,
  Check,
  Star,
  TrendingUp,
  Heart,
  Clock,
  Users,
  Sparkles,
  Eye,
  EyeOff,
  Plus,
  ChevronDown
} from 'lucide-react';

interface Vouch {
  id: string;
  vouch_for_id: number;
  vouch_from_id: number;
  vouch_from_name: string;
  vouch_from_photos: string[];
  primary_photo_index: number;
  relationship_type: string;
  known_for_years: number;
  vouch_text: string;
  anonymous: boolean;
  created_at: string;
  tags: VouchTag[];
  reactions: VouchReaction[];
}

interface VouchTag {
  id: string;
  tag_name: string;
  tag_category: string;
  description: string;
}

interface VouchReaction {
  id: string;
  reaction_type: string;
  user_id: number;
}

interface VouchRequest {
  id: string;
  requested_by_id: number;
  requested_from_id: number;
  requester_name: string;
  requester_photos: string[];
  primary_photo_index: number;
  message: string;
  status: string;
  created_at: string;
}

interface VouchStats {
  user_id: number;
  total_vouches_received: number;
  total_vouches_given: number;
  trust_score: number;
  verification_level: string;
  most_common_tag_id: number;
}

interface FriendVouchProps {
  userId?: number;
  onProfileClick?: (userId: number) => void;
}

export default function FriendVouch({ userId, onProfileClick }: FriendVouchProps) {
  const [vouches, setVouches] = useState<Vouch[]>([]);
  const [givenVouches, setGivenVouches] = useState<Vouch[]>([]);
  const [pendingRequests, setPendingRequests] = useState<VouchRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<VouchRequest[]>([]);
  const [availableTags, setAvailableTags] = useState<VouchTag[]>([]);
  const [stats, setStats] = useState<VouchStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showCreateVouch, setShowCreateVouch] = useState(false);
  const [showRequestVouch, setShowRequestVouch] = useState(false);
  const [showVouchDetails, setShowVouchDetails] = useState(false);
  const [selectedVouch, setSelectedVouch] = useState<Vouch | null>(null);
  const [showGivenVouches, setShowGivenVouches] = useState(false);

  // Forms
  const [vouchForm, setVouchForm] = useState({
    vouch_for_id: '',
    relationship_type: 'friend',
    known_for_years: '',
    vouch_text: '',
    anonymous: false,
    tag_ids: [] as number[]
  });

  const [requestForm, setRequestForm] = useState({
    requested_from_id: '',
    message: ''
  });

  useEffect(() => {
    if (userId) {
      fetchReceivedVouches(userId);
      fetchStats(userId);
    }
    fetchAvailableTags();
    fetchPendingRequests();
    fetchSentRequests();
    fetchGivenVouches();
  }, [userId]);

  const fetchReceivedVouches = async (targetUserId: number) => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/vouch/received/${targetUserId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch vouches');
      }

      const data = await response.json();
      setVouches(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchGivenVouches = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/vouch/given', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setGivenVouches(data);
      }
    } catch {
      // Silent fail
    }
  };

  const fetchPendingRequests = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/vouch/requests/pending', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPendingRequests(data);
      }
    } catch {
      // Silent fail
    }
  };

  const fetchSentRequests = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/vouch/requests/sent', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSentRequests(data);
      }
    } catch {
      // Silent fail
    }
  };

  const fetchAvailableTags = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/vouch/tags', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableTags(data);
      }
    } catch {
      // Silent fail
    }
  };

  const fetchStats = async (targetUserId: number) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/vouch/stats/${targetUserId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch {
      // Silent fail
    }
  };

  const createVouch = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/vouch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...vouchForm,
          vouch_for_id: parseInt(vouchForm.vouch_for_id)
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create vouch');
      }

      setShowCreateVouch(false);
      setVouchForm({
        ...vouchForm,
        vouch_for_id: '',
        vouch_text: '',
        known_for_years: '',
        tag_ids: []
      });
      await fetchGivenVouches();
      if (userId) {
        await fetchReceivedVouches(userId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const requestVouch = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/vouch/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...requestForm,
          requested_from_id: parseInt(requestForm.requested_from_id)
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to request vouch');
      }

      setShowRequestVouch(false);
      setRequestForm({
        ...requestForm,
        requested_from_id: '',
        message: ''
      });
      await fetchSentRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const reactToVouch = async (vouchId: string, reactionType: string) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/vouch/${vouchId}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ reaction_type: reactionType }),
      });
    } catch {
      // Silent fail
    }
  };

  const respondToRequest = async (requestId: string, status: string) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/vouch/request/${requestId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          status,
          vouch_data: status === 'accepted' ? vouchForm : null
        }),
      });

      await fetchPendingRequests();
      await fetchGivenVouches();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const toggleTag = (tagId: number) => {
    setVouchForm({
      ...vouchForm,
      tag_ids: vouchForm.tag_ids.includes(tagId)
        ? vouchForm.tag_ids.filter(id => id !== tagId)
        : [...vouchForm.tag_ids, tagId]
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const getTrustColor = (level: string) => {
    const colors: Record<string, string> = {
      none: 'bg-gray-500',
      basic: 'bg-blue-500',
      verified: 'bg-purple-500',
      highly_trusted: 'bg-green-500',
    };
    return colors[level] || colors.none;
  };

  const getRelationshipColor = (type: string) => {
    const colors: Record<string, string> = {
      friend: 'bg-pink-500',
      family: 'bg-blue-500',
      colleague: 'bg-purple-500',
      partner: 'bg-red-500',
      met_in_person: 'bg-green-500',
      online_friend: 'bg-orange-500',
    };
    return colors[type] || 'bg-gray-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-pink-500" />
              Friend Vouches
            </h2>
            <p className="text-gray-400 mt-1">
              See who's vouching for this user
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateVouch(true)}
              className="px-4 py-2 bg-pink-500 hover:bg-pink-600 rounded-lg transition flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Vouch for Someone
            </button>
            <button
              onClick={() => setShowRequestVouch(true)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Request Vouch
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/5 rounded-lg p-4 text-center">
              <Users className="w-6 h-6 text-pink-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.total_vouches_received}</p>
              <p className="text-sm text-gray-400">Vouches Received</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4 text-center">
              <TrendingUp className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.trust_score}%</p>
              <p className="text-sm text-gray-400">Trust Score</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4 text-center">
              <Star className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
              <p className="text-2xl font-bold capitalize">{stats.verification_level}</p>
              <p className="text-sm text-gray-400">Verification Level</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4 text-center">
              <Heart className="w-6 h-6 text-red-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.total_vouches_given}</p>
              <p className="text-sm text-gray-400">Vouches Given</p>
            </div>
          </div>
        )}

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <div className="mt-6 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <h3 className="font-semibold flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-yellow-500" />
              Pending Vouch Requests ({pendingRequests.length})
            </h3>
            <div className="space-y-2">
              {pendingRequests.slice(0, 3).map((request) => (
                <div key={request.id} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    {request.requester_photos && request.requester_photos.length > 0 && (
                      <img
                        src={request.requester_photos[request.primary_photo_index || 0]}
                        alt={request.requester_name}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    )}
                    <div>
                      <p className="font-medium">{request.requester_name}</p>
                      {request.message && (
                        <p className="text-sm text-gray-400">{request.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => respondToRequest(request.id, 'accepted')}
                      className="p-2 bg-green-500 hover:bg-green-600 rounded-lg transition"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => respondToRequest(request.id, 'declined')}
                      className="p-2 bg-red-500 hover:bg-red-600 rounded-lg transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowGivenVouches(false)}
          className={`px-4 py-2 rounded-lg transition ${
            !showGivenVouches
              ? 'bg-pink-500 text-white'
              : 'bg-white/5 hover:bg-white/10 text-gray-300'
          }`}
        >
          Received ({vouches.length})
        </button>
        <button
          onClick={() => setShowGivenVouches(true)}
          className={`px-4 py-2 rounded-lg transition ${
            showGivenVouches
              ? 'bg-pink-500 text-white'
              : 'bg-white/5 hover:bg-white/10 text-gray-300'
          }`}
        >
          Given ({givenVouches.length})
        </button>
      </div>

      {/* Vouches List */}
      {loading ? (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-pink-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-400">Loading vouches...</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {(showGivenVouches ? givenVouches : vouches).length === 0 ? (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center">
              <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">
                {showGivenVouches
                  ? "You haven't vouched for anyone yet"
                  : 'No vouches yet. Be the first to vouch!'}
              </p>
            </div>
          ) : (
            (showGivenVouches ? givenVouches : vouches).map((vouch) => (
              <div key={vouch.id} className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  {vouch.vouch_from_photos && vouch.vouch_from_photos.length > 0 && !vouch.anonymous && (
                    <img
                      src={vouch.vouch_from_photos[vouch.primary_photo_index || 0]}
                      alt={vouch.vouch_from_name}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  )}
                  {vouch.anonymous && (
                    <div className="w-16 h-16 rounded-lg bg-gray-700 flex items-center justify-center">
                      <EyeOff className="w-8 h-8 text-gray-500" />
                    </div>
                  )}

                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">
                            {vouch.anonymous ? 'Anonymous' : vouch.vouch_from_name}
                          </h4>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${getRelationshipColor(vouch.relationship_type)}`}>
                            {vouch.relationship_type}
                          </span>
                        </div>
                        {vouch.known_for_years && (
                          <p className="text-sm text-gray-400">
                            Known for {vouch.known_for_years} {vouch.known_for_years === 1 ? 'year' : 'years'}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">{formatDate(vouch.created_at)}</span>
                    </div>

                    {vouch.vouch_text && (
                      <p className="text-gray-300 mb-3">{vouch.vouch_text}</p>
                    )}

                    {vouch.tags && vouch.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {vouch.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="px-2 py-1 bg-pink-500/20 text-pink-300 rounded text-xs flex items-center gap-1"
                          >
                            <Tag className="w-3 h-3" />
                            {tag.tag_name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      {vouch.reactions && vouch.reactions.length > 0 && (
                        <div className="flex items-center gap-1 text-sm text-gray-400">
                          <ThumbsUp className="w-4 h-4" />
                          {vouch.reactions.length}
                        </div>
                      )}
                      <button
                        onClick={() => reactToVouch(vouch.id, 'helpful')}
                        className="text-sm text-gray-400 hover:text-pink-400 transition flex items-center gap-1"
                      >
                        <ThumbsUp className="w-4 h-4" />
                        Helpful
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Vouch Modal */}
      {showCreateVouch && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Vouch for Someone</h2>
                <button
                  onClick={() => setShowCreateVouch(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">User ID *</label>
                <input
                  type="number"
                  value={vouchForm.vouch_for_id}
                  onChange={(e) => setVouchForm({ ...vouchForm, vouch_for_id: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                  placeholder="Enter user ID"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Relationship</label>
                <select
                  value={vouchForm.relationship_type}
                  onChange={(e) => setVouchForm({ ...vouchForm, relationship_type: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                >
                  <option value="friend">Friend</option>
                  <option value="family">Family</option>
                  <option value="colleague">Colleague</option>
                  <option value="partner">Partner</option>
                  <option value="met_in_person">Met in Person</option>
                  <option value="online_friend">Online Friend</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Known for (years)</label>
                <input
                  type="number"
                  value={vouchForm.known_for_years}
                  onChange={(e) => setVouchForm({ ...vouchForm, known_for_years: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                  placeholder="Optional"
                  min="0"
                  max="50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Vouch Message</label>
                <textarea
                  value={vouchForm.vouch_text}
                  onChange={(e) => setVouchForm({ ...vouchForm, vouch_text: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                  rows={3}
                  placeholder="Share your experience with this person..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(parseInt(tag.id))}
                      className={`px-3 py-1.5 rounded-lg text-sm transition ${
                        vouchForm.tag_ids.includes(parseInt(tag.id))
                          ? 'bg-pink-500 text-white'
                          : 'bg-white/5 hover:bg-white/10 text-gray-300'
                      }`}
                    >
                      {tag.tag_name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="anonymous"
                  checked={vouchForm.anonymous}
                  onChange={(e) => setVouchForm({ ...vouchForm, anonymous: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="anonymous" className="text-sm">Make vouch anonymous</label>
              </div>

              <button
                onClick={createVouch}
                disabled={!vouchForm.vouch_for_id}
                className="w-full px-6 py-3 bg-pink-500 hover:bg-pink-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition flex items-center justify-center gap-2"
              >
                <Shield className="w-5 h-5" />
                Submit Vouch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Vouch Modal */}
      {showRequestVouch && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-white/10">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Request a Vouch</h2>
                <button
                  onClick={() => setShowRequestVouch(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">User ID *</label>
                <input
                  type="number"
                  value={requestForm.requested_from_id}
                  onChange={(e) => setRequestForm({ ...requestForm, requested_from_id: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                  placeholder="Enter user ID to request from"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Message</label>
                <textarea
                  value={requestForm.message}
                  onChange={(e) => setRequestForm({ ...requestForm, message: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                  rows={3}
                  placeholder="Add a personal message..."
                />
              </div>

              <button
                onClick={requestVouch}
                disabled={!requestForm.requested_from_id}
                className="w-full px-6 py-3 bg-pink-500 hover:bg-pink-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition flex items-center justify-center gap-2"
              >
                <Send className="w-5 h-5" />
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
