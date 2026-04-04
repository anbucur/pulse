/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  MapPin,
  Users,
  Plus,
  Search,
  Filter,
  Heart,
  MessageCircle,
  ExternalLink,
  Clock,
  Tag,
  X,
  ChevronDown,
  Sparkles,
  UserPlus,
  Check,
} from 'lucide-react';

interface Event {
  id: string;
  title: string;
  description: string;
  event_type: string;
  event_url: string;
  venue_name: string;
  venue_address: string;
  latitude: number;
  longitude: number;
  event_date: string;
  end_date: string;
  age_restriction: string;
  dress_code: string;
  ticket_price: string;
  ticket_url: string;
  tags: string[];
  is_public: boolean;
  max_attendees: number;
  attendee_count: number;
  creator_name: string;
  creator_photos: string[];
  creator_photo_index: number;
  user_attendance?: any;
  attendees?: EventAttendee[];
}

interface EventAttendee {
  user_id: string;
  display_name: string;
  age: number;
  gender: string;
  photos: string[];
  primary_photo_index: number;
  interests: string[];
  plus_ones: number;
  notes: string;
  shared_interests?: string[];
}

interface EventMatch {
  user_id: string;
  display_name: string;
  age: number;
  gender: string;
  photos: string[];
  primary_photo_index: number;
  interests: string[];
  bio: string;
  location: string;
  plus_ones: number;
  notes: string;
  shared_interests: string[];
  has_shared_interests: boolean;
}

interface SceneMatchProps {
  onUserClick?: (userId: string) => void;
  onMessageClick?: (userId: string) => void;
}

export default function SceneMatch({ onUserClick, onMessageClick }: SceneMatchProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [matches, setMatches] = useState<EventMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMatches, setShowMatches] = useState(false);
  const [filterType, setFilterType] = useState<string>('');
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  // New event form state
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    event_type: 'social',
    event_url: '',
    venue_name: '',
    venue_address: '',
    latitude: '',
    longitude: '',
    event_date: '',
    end_date: '',
    age_restriction: '',
    dress_code: '',
    ticket_price: '',
    ticket_url: '',
    tags: [] as string[],
    is_public: true,
    max_attendees: '',
  });

  useEffect(() => {
    fetchEvents();
  }, [filterType]);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      let url = '/api/events';
      const params = new URLSearchParams();
      if (filterType) params.append('type', filterType);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }

      const data = await response.json();
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchEventDetails = async (eventId: string) => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch event details');
      }

      const data = await response.json();
      setSelectedEvent(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchMatches = async (eventId: string) => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/events/${eventId}/matches`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch matches');
      }

      const data = await response.json();
      setMatches(data);
      setShowMatches(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const joinEvent = async (eventId: string) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/events/${eventId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ plus_ones: 0 }),
      });

      if (!response.ok) {
        throw new Error('Failed to join event');
      }

      await fetchEventDetails(eventId);
      await fetchEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const leaveEvent = async (eventId: string) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/events/${eventId}/leave`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to leave event');
      }

      await fetchEventDetails(eventId);
      await fetchEvents();
    } catch {
      // Silent fail
    }
  };

  const createEvent = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(newEvent),
      });

      if (!response.ok) {
        throw new Error('Failed to create event');
      }

      setShowCreateModal(false);
      setNewEvent({
        ...newEvent,
        title: '',
        description: '',
        event_url: '',
        venue_name: '',
        venue_address: '',
        latitude: '',
        longitude: '',
        event_date: '',
        end_date: '',
        age_restriction: '',
        dress_code: '',
        ticket_price: '',
        ticket_url: '',
        tags: [],
        max_attendees: '',
      });
      await fetchEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const toggleEventExpansion = (eventId: string) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedEvents(newExpanded);
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

  const getEventColor = (type: string) => {
    const colors: Record<string, string> = {
      social: 'bg-pink-500',
      concert: 'bg-purple-500',
      party: 'bg-orange-500',
      fetish: 'bg-red-500',
      cultural: 'bg-blue-500',
      other: 'bg-gray-500',
    };
    return colors[type] || colors.other;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-pink-500" />
              Scene Match
            </h2>
            <p className="text-gray-400 mt-1">
              Discover events and connect with people attending the same events
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-pink-500 hover:bg-pink-600 rounded-lg transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Event
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => setFilterType('')}
            className={`px-4 py-2 rounded-lg transition ${
              filterType === ''
                ? 'bg-pink-500 text-white'
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            }`}
          >
            All Events
          </button>
          <button
            onClick={() => setFilterType('social')}
            className={`px-4 py-2 rounded-lg transition ${
              filterType === 'social'
                ? 'bg-pink-500 text-white'
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            }`}
          >
            Social
          </button>
          <button
            onClick={() => setFilterType('concert')}
            className={`px-4 py-2 rounded-lg transition ${
              filterType === 'concert'
                ? 'bg-pink-500 text-white'
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            }`}
          >
            Concerts
          </button>
          <button
            onClick={() => setFilterType('party')}
            className={`px-4 py-2 rounded-lg transition ${
              filterType === 'party'
                ? 'bg-pink-500 text-white'
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            }`}
          >
            Parties
          </button>
          <button
            onClick={() => setFilterType('fetish')}
            className={`px-4 py-2 rounded-lg transition ${
              filterType === 'fetish'
                ? 'bg-pink-500 text-white'
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            }`}
          >
            Fetish Nights
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {/* Events List */}
      {loading && !selectedEvent ? (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-pink-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-400">Loading events...</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {events.map((event) => (
            <div key={event.id} className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getEventColor(event.event_type)}`}>
                      {event.event_type}
                    </span>
                    <div className="flex items-center gap-1 text-gray-400 text-sm">
                      <Users className="w-4 h-4" />
                      {event.attendee_count} attending
                    </div>
                  </div>

                  <h3 className="text-xl font-bold mb-2">{event.title}</h3>
                  <p className="text-gray-300 text-sm mb-3">{event.description}</p>

                  <div className="flex flex-wrap gap-3 text-sm text-gray-400">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(event.event_date)}
                    </div>
                    {event.venue_name && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {event.venue_name}
                      </div>
                    )}
                    {event.ticket_price && (
                      <div className="flex items-center gap-1">
                        <Tag className="w-4 h-4" />
                        {event.ticket_price}
                      </div>
                    )}
                  </div>

                  {event.tags && event.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {event.tags.slice(0, 3).map((tag, i) => (
                        <span key={i} className="px-2 py-1 bg-white/5 rounded text-xs text-gray-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => fetchEventDetails(event.id)}
                    className="px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg transition flex items-center gap-2"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}

          {events.length === 0 && !loading && (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center">
              <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No events found. Create one to get started!</p>
            </div>
          )}
        </div>
      )}

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10">
              <div className="flex justify-between items-start">
                <div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getEventColor(selectedEvent.event_type)}`}>
                    {selectedEvent.event_type}
                  </span>
                  <h2 className="text-2xl font-bold mt-3">{selectedEvent.title}</h2>
                  <p className="text-gray-400 mt-2">{selectedEvent.description}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedEvent(null);
                    setShowMatches(false);
                    setMatches([]);
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Event Info */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-pink-500" />
                    Date & Time
                  </h3>
                  <p className="text-gray-300">{formatDate(selectedEvent.event_date)}</p>
                  {selectedEvent.end_date && (
                    <p className="text-gray-400 text-sm">Ends: {formatDate(selectedEvent.end_date)}</p>
                  )}
                </div>

                {selectedEvent.venue_name && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-pink-500" />
                      Location
                    </h3>
                    <p className="text-gray-300">{selectedEvent.venue_name}</p>
                    {selectedEvent.venue_address && (
                      <p className="text-gray-400 text-sm">{selectedEvent.venue_address}</p>
                    )}
                  </div>
                )}

                {selectedEvent.ticket_price && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Tag className="w-5 h-5 text-pink-500" />
                      Tickets
                    </h3>
                    <p className="text-gray-300">{selectedEvent.ticket_price}</p>
                  </div>
                )}

                {selectedEvent.dress_code && (
                  <div>
                    <h3 className="font-semibold mb-3">Dress Code</h3>
                    <p className="text-gray-300">{selectedEvent.dress_code}</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                {selectedEvent.user_attendance ? (
                  <>
                    <button
                      onClick={() => fetchMatches(selectedEvent.id)}
                      className="px-6 py-3 bg-pink-500 hover:bg-pink-600 rounded-lg transition flex items-center gap-2 flex-1 justify-center"
                    >
                      <Sparkles className="w-5 h-5" />
                      See Matches ({selectedEvent.attendee_count - 1})
                    </button>
                    <button
                      onClick={() => leaveEvent(selectedEvent.id)}
                      className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg transition"
                    >
                      Leave Event
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => joinEvent(selectedEvent.id)}
                    className="px-6 py-3 bg-pink-500 hover:bg-pink-600 rounded-lg transition flex items-center gap-2 flex-1 justify-center"
                  >
                    <UserPlus className="w-5 h-5" />
                    Join Event
                  </button>
                )}
                {selectedEvent.event_url && (
                  <a
                    href={selectedEvent.event_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition flex items-center gap-2"
                  >
                    <ExternalLink className="w-5 h-5" />
                    Event Link
                  </a>
                )}
              </div>

              {/* Matches */}
              {showMatches && (
                <div>
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Heart className="w-5 h-5 text-pink-500" />
                    People Attending
                  </h3>

                  {matches.length === 0 ? (
                    <div className="bg-white/5 rounded-lg p-8 text-center">
                      <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400">No other attendees yet. Be the first to match!</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {matches.map((match) => (
                        <div key={match.user_id} className="bg-white/5 rounded-lg p-4">
                          <div className="flex items-start gap-4">
                            {match.photos && match.photos.length > 0 && (
                              <img
                                src={match.photos[match.primary_photo_index || 0]}
                                alt={match.display_name}
                                className="w-16 h-16 rounded-lg object-cover"
                              />
                            )}

                            <div className="flex-1">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h4 className="font-semibold">{match.display_name}</h4>
                                  <p className="text-sm text-gray-400">
                                    {match.age} • {match.gender}
                                  </p>
                                </div>

                                <div className="flex gap-2">
                                  {onUserClick && (
                                    <button
                                      onClick={() => onUserClick(match.user_id)}
                                      className="p-2 hover:bg-white/10 rounded-lg transition"
                                    >
                                      <UserPlus className="w-4 h-4" />
                                    </button>
                                  )}
                                  {onMessageClick && (
                                    <button
                                      onClick={() => onMessageClick(match.user_id)}
                                      className="p-2 hover:bg-white/10 rounded-lg transition"
                                    >
                                      <MessageCircle className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {match.bio && (
                                <p className="text-sm text-gray-300 mt-2 line-clamp-2">{match.bio}</p>
                              )}

                              {match.has_shared_interests && match.shared_interests && match.shared_interests.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-xs text-gray-400 mb-1">Shared interests:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {match.shared_interests.slice(0, 3).map((interest, i) => (
                                      <span key={i} className="px-2 py-0.5 bg-pink-500/20 text-pink-300 rounded text-xs">
                                        {interest}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Create Event</h2>
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
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                  placeholder="Amazing Party Night"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                  rows={3}
                  placeholder="Describe your event..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Event Type</label>
                <select
                  value={newEvent.event_type}
                  onChange={(e) => setNewEvent({ ...newEvent, event_type: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                >
                  <option value="social">Social</option>
                  <option value="concert">Concert</option>
                  <option value="party">Party</option>
                  <option value="fetish">Fetish Night</option>
                  <option value="cultural">Cultural</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Venue Name</label>
                  <input
                    type="text"
                    value={newEvent.venue_name}
                    onChange={(e) => setNewEvent({ ...newEvent, venue_name: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                    placeholder="Club Awesome"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Venue Address</label>
                  <input
                    type="text"
                    value={newEvent.venue_address}
                    onChange={(e) => setNewEvent({ ...newEvent, venue_address: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                    placeholder="123 Main St"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Event Date *</label>
                <input
                  type="datetime-local"
                  value={newEvent.event_date}
                  onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Ticket Price</label>
                  <input
                    type="text"
                    value={newEvent.ticket_price}
                    onChange={(e) => setNewEvent({ ...newEvent, ticket_price: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                    placeholder="$20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Max Attendees</label>
                  <input
                    type="number"
                    value={newEvent.max_attendees}
                    onChange={(e) => setNewEvent({ ...newEvent, max_attendees: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                    placeholder="100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Event URL</label>
                <input
                  type="url"
                  value={newEvent.event_url}
                  onChange={(e) => setNewEvent({ ...newEvent, event_url: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                  placeholder="https://..."
                />
              </div>

              <button
                onClick={createEvent}
                disabled={!newEvent.title || !newEvent.event_date}
                className="w-full px-6 py-3 bg-pink-500 hover:bg-pink-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
