/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  MapPin,
  Calendar,
  MessageSquare,
  Settings,
  UserPlus,
  Shield,
  Check,
  X,
  ChevronRight,
  Globe,
  Lock,
  Crown,
  Star,
  TrendingUp,
  Filter,
  Pin,
  Send,
  Clock,
  AlertCircle,
} from 'lucide-react';

interface Tribe {
  id: string;
  name: string;
  description: string;
  slug: string;
  category: string;
  tags: string[];
  location: string;
  icon: string;
  color: string;
  is_private: boolean;
  approval_required: boolean;
  max_members: number;
  member_count: number;
  is_member: boolean;
  user_role: string;
  membership_status: string;
  creator_name: string;
}

interface TribeMember {
  id: string;
  user_id: string;
  display_name: string;
  role: string;
  bio: string;
  photos: string[];
  primary_photo_index: number;
  joined_at: string;
}

interface TribeMessage {
  id: string;
  content: string;
  sender_id: string;
  display_name: string;
  photos: string[];
  primary_photo_index: number;
  created_at: string;
  is_pinned: boolean;
  reply_to?: string;
}

interface TribeEvent {
  id: string;
  title: string;
  description: string;
  event_date: string;
  venue_name: string;
  venue_address: string;
  max_attendees: number;
  attendee_count: number;
  is_attending: boolean;
}

interface TabType {
  id: string;
  label: string;
  icon: React.ElementType;
}

export default function TribeHubs() {
  const [tribes, setTribes] = useState<Tribe[]>([]);
  const [myTribes, setMyTribes] = useState<Tribe[]>([]);
  const [selectedTribe, setSelectedTribe] = useState<Tribe | null>(null);
  const [activeTab, setActiveTab] = useState<string>('discover');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tribe detail views
  const [viewMode, setViewMode] = useState<'chat' | 'members' | 'events'>('chat');
  const [members, setMembers] = useState<TribeMember[]>([]);
  const [messages, setMessages] = useState<TribeMessage[]>([]);
  const [events, setEvents] = useState<TribeEvent[]>([]);
  const [newMessage, setNewMessage] = useState('');

  // Create tribe modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTribe, setNewTribe] = useState({
    name: '',
    description: '',
    category: 'community',
    tags: [] as string[],
    location: '',
    is_private: false,
    approval_required: false,
    max_members: '',
    icon: 'users',
    color: '#ec4899',
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    fetchTribes();
    fetchMyTribes();
  }, [categoryFilter]);

  const fetchTribes = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      let url = '/api/tribes';
      const params = new URLSearchParams();
      if (categoryFilter) params.append('category', categoryFilter);
      if (searchQuery) params.append('search', searchQuery);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch tribes');

      const data = await response.json();
      setTribes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyTribes = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/tribes/my-tribes', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) return;

      const data = await response.json();
      setMyTribes(data);
    } catch (err) {
      console.error('Error fetching my tribes:', err);
    }
  };

  const fetchTribeDetails = async (tribeId: string) => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const [tribeRes, membersRes, messagesRes, eventsRes] = await Promise.all([
        fetch(`/api/tribes/${tribeId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`/api/tribes/${tribeId}/members`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`/api/tribes/${tribeId}/messages`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`/api/tribes/${tribeId}/events`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      if (tribeRes.ok) {
        const tribe = await tribeRes.json();
        setSelectedTribe(tribe);
      }

      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(data);
      }

      if (messagesRes.ok) {
        const data = await messagesRes.json();
        setMessages(data);
      }

      if (eventsRes.ok) {
        const data = await eventsRes.json();
        setEvents(data);
      }
    } catch (err) {
      console.error('Error fetching tribe details:', err);
    } finally {
      setLoading(false);
    }
  };

  const joinTribe = async (tribeId: string) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/tribes/${tribeId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to join tribe');

      await fetchTribes();
      await fetchMyTribes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join tribe');
    }
  };

  const leaveTribe = async (tribeId: string) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/tribes/${tribeId}/leave`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to leave tribe');

      setSelectedTribe(null);
      await fetchTribes();
      await fetchMyTribes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave tribe');
    }
  };

  const sendMessage = async () => {
    if (!selectedTribe || !newMessage.trim()) return;

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/tribes/${selectedTribe.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ content: newMessage }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const message = await response.json();
      setMessages([...messages, message]);
      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const rsvpEvent = async (eventId: string, status: string) => {
    if (!selectedTribe) return;

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/tribes/${selectedTribe.id}/events/${eventId}/rsvp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) throw new Error('Failed to RSVP');

      await fetchTribeDetails(selectedTribe.id);
    } catch (err) {
      console.error('Error RSVPing:', err);
    }
  };

  const createTribe = async () => {
    if (!newTribe.name.trim()) return;

    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/tribes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(newTribe),
      });

      if (!response.ok) throw new Error('Failed to create tribe');

      setShowCreateModal(false);
      setNewTribe({
        ...newTribe,
        name: '',
        description: '',
        tags: [],
        location: '',
        max_members: '',
      });
      await fetchTribes();
      await fetchMyTribes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tribe');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const tabs: TabType[] = [
    { id: 'discover', label: 'Discover', icon: Globe },
    { id: 'my-tribes', label: 'My Tribes', icon: Users },
  ];

  const viewTabs: TabType[] = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'events', label: 'Events', icon: Calendar },
  ];

  const categories = [
    'community',
    'kink',
    'lifestyle',
    'social',
    'support',
    'education',
    'events',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-pink-500" />
              Tribe Hubs
            </h2>
            <p className="text-gray-400 mt-1">
              Connect with micro-communities that share your interests
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-pink-500 hover:bg-pink-600 rounded-lg transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Tribe
          </button>
        </div>

        {/* Main Tabs */}
        <div className="flex gap-2 mb-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-pink-500 text-white'
                    : 'bg-white/5 hover:bg-white/10 text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search & Filter */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && fetchTribes()}
              placeholder="Search tribes..."
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {/* Main Content */}
      {selectedTribe ? (
        /* Tribe Detail View */
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl overflow-hidden">
          {/* Tribe Header */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl"
                  style={{ backgroundColor: selectedTribe.color + '20' }}
                >
                  {selectedTribe.icon === 'users' && <Users className="w-8 h-8" />}
                  {selectedTribe.icon === 'heart' && <Star className="w-8 h-8" />}
                  {selectedTribe.icon === 'sparkles' && <Crown className="w-8 h-8" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-2xl font-bold">{selectedTribe.name}</h3>
                    {selectedTribe.is_private ? (
                      <Lock className="w-4 h-4 text-gray-400" />
                    ) : (
                      <Globe className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <p className="text-gray-400">{selectedTribe.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {selectedTribe.member_count} members
                    </span>
                    {selectedTribe.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {selectedTribe.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedTribe(null)}
                className="p-2 hover:bg-white/10 rounded-lg transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* View Tabs */}
            <div className="flex gap-2 mt-6">
              {viewTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setViewMode(tab.id as any)}
                    className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                      viewMode === tab.id
                        ? 'bg-pink-500 text-white'
                        : 'bg-white/5 hover:bg-white/10 text-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Leave Tribe Button */}
            {selectedTribe.is_member && (
              <div className="mt-4">
                <button
                  onClick={() => leaveTribe(selectedTribe.id)}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg transition text-red-300"
                >
                  Leave Tribe
                </button>
              </div>
            )}
          </div>

          {/* View Content */}
          <div className="p-6">
            {viewMode === 'chat' && (
              <div className="space-y-4">
                {!selectedTribe.is_member ? (
                  <div className="text-center py-8">
                    <Lock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400 mb-4">Join this tribe to see the chat</p>
                    <button
                      onClick={() => joinTribe(selectedTribe.id)}
                      className="px-6 py-2 bg-pink-500 hover:bg-pink-600 rounded-lg transition"
                    >
                      Join Tribe
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {messages.map((message) => (
                        <div key={message.id} className="bg-white/5 rounded-lg p-3">
                          {message.is_pinned && (
                            <div className="flex items-center gap-1 text-xs text-yellow-400 mb-2">
                              <Pin className="w-3 h-3" />
                              Pinned
                            </div>
                          )}
                          <div className="flex items-start gap-3">
                            {message.photos && message.photos.length > 0 && (
                              <img
                                src={message.photos[message.primary_photo_index || 0]}
                                alt={message.display_name}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-sm">{message.display_name}</span>
                                <span className="text-xs text-gray-500">{formatDate(message.created_at)}</span>
                              </div>
                              <p className="text-gray-300 text-sm">{message.content}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {messages.length === 0 && (
                        <div className="text-center py-8 text-gray-400">
                          <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                          <p>No messages yet. Start the conversation!</p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                      />
                      <button
                        onClick={sendMessage}
                        disabled={!newMessage.trim()}
                        className="px-4 py-2 bg-pink-500 hover:bg-pink-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {viewMode === 'members' && (
              <div className="grid md:grid-cols-2 gap-4">
                {members.map((member) => (
                  <div key={member.id} className="bg-white/5 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      {member.photos && member.photos.length > 0 && (
                        <img
                          src={member.photos[member.primary_photo_index || 0]}
                          alt={member.display_name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{member.display_name}</h4>
                          {member.role === 'admin' && (
                            <Crown className="w-3 h-3 text-yellow-400" />
                          )}
                          {member.role === 'moderator' && (
                            <Shield className="w-3 h-3 text-blue-400" />
                          )}
                        </div>
                        <p className="text-xs text-gray-400">Joined {formatDate(member.joined_at)}</p>
                        {member.bio && (
                          <p className="text-sm text-gray-300 mt-1 line-clamp-2">{member.bio}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {viewMode === 'events' && (
              <div className="space-y-4">
                {events.map((event) => (
                  <div key={event.id} className="bg-white/5 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg mb-1">{event.title}</h4>
                        <p className="text-gray-400 text-sm mb-2">{event.description}</p>
                        <div className="flex flex-wrap gap-3 text-sm text-gray-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(event.event_date)}
                          </span>
                          {event.venue_name && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {event.venue_name}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {event.attendee_count}
                            {event.max_attendees && `/${event.max_attendees}`} attending
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => rsvpEvent(event.id, event.is_attending ? 'not-attending' : 'attending')}
                        className={`px-4 py-2 rounded-lg transition ${
                          event.is_attending
                            ? 'bg-green-500 hover:bg-green-600'
                            : 'bg-white/10 hover:bg-white/20'
                        }`}
                      >
                        {event.is_attending ? (
                          <>
                            <Check className="w-4 h-4 inline mr-1" />
                            Going
                          </>
                        ) : (
                          'RSVP'
                        )}
                      </button>
                    </div>
                  </div>
                ))}
                {events.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                    <p>No upcoming events</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Tribe List */
        <div className="grid gap-4">
          {loading ? (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-pink-500 border-t-transparent"></div>
              <p className="mt-4 text-gray-400">Loading tribes...</p>
            </div>
          ) : (
            <>
              {(activeTab === 'discover' ? tribes : myTribes).map((tribe) => (
                <div key={tribe.id} className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
                  <div className="flex items-start gap-4">
                    <div
                      className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ backgroundColor: tribe.color + '20' }}
                    >
                      {tribe.icon === 'users' && <Users className="w-8 h-8" />}
                      {tribe.icon === 'heart' && <Star className="w-8 h-8" />}
                      {tribe.icon === 'sparkles' && <Crown className="w-8 h-8" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-bold">{tribe.name}</h3>
                          {tribe.is_private ? (
                            <Lock className="w-4 h-4 text-gray-400" />
                          ) : (
                            <Globe className="w-4 h-4 text-gray-400" />
                          )}
                          {tribe.is_member && (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-300 rounded text-xs">
                              Member
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-gray-300 text-sm mb-3 line-clamp-2">{tribe.description}</p>

                      <div className="flex flex-wrap gap-3 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {tribe.member_count} members
                        </span>
                        {tribe.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {tribe.location}
                          </span>
                        )}
                        <span className="px-2 py-0.5 bg-white/10 rounded text-xs">
                          {tribe.category}
                        </span>
                      </div>

                      {tribe.tags && tribe.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {tribe.tags.slice(0, 3).map((tag, i) => (
                            <span key={i} className="px-2 py-0.5 bg-white/5 rounded text-xs text-gray-400">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setSelectedTribe(tribe);
                        setViewMode('chat');
                        fetchTribeDetails(tribe.id);
                      }}
                      className="px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg transition flex items-center gap-2 flex-shrink-0"
                    >
                      {tribe.is_member ? 'Open' : 'View'}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {(activeTab === 'discover' ? tribes : myTribes).length === 0 && !loading && (
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center">
                  <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">
                    {activeTab === 'discover'
                      ? 'No tribes found. Create one to get started!'
                      : "You haven't joined any tribes yet."}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Create Tribe Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Create Tribe</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tribe Name *</label>
                <input
                  type="text"
                  value={newTribe.name}
                  onChange={(e) => setNewTribe({ ...newTribe, name: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                  placeholder="Amazing Tribe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={newTribe.description}
                  onChange={(e) => setNewTribe({ ...newTribe, description: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                  rows={3}
                  placeholder="What is your tribe about?"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select
                    value={newTribe.category}
                    onChange={(e) => setNewTribe({ ...newTribe, category: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Location (optional)</label>
                  <input
                    type="text"
                    value={newTribe.location}
                    onChange={(e) => setNewTribe({ ...newTribe, location: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                    placeholder="Amsterdam, NYC..."
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Max Members</label>
                  <input
                    type="number"
                    value={newTribe.max_members}
                    onChange={(e) => setNewTribe({ ...newTribe, max_members: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                    placeholder="Leave empty for unlimited"
                  />
                </div>

                <div className="flex items-end gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newTribe.is_private}
                      onChange={(e) => setNewTribe({ ...newTribe, is_private: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                    <span className="text-sm">Private Tribe</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newTribe.approval_required}
                      onChange={(e) => setNewTribe({ ...newTribe, approval_required: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                    <span className="text-sm">Approval Required</span>
                  </label>
                </div>
              </div>

              <button
                onClick={createTribe}
                disabled={!newTribe.name.trim()}
                className="w-full px-6 py-3 bg-pink-500 hover:bg-pink-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create Tribe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
