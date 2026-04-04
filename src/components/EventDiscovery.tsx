/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  MapPin,
  Users,
  Search,
  Filter,
  ExternalLink,
  Clock,
  Tag,
  X,
  Sparkles,
  MapPinOff,
  ChevronDown,
  Heart,
  Navigation,
  Ticket,
  UserCheck,
  LogOut,
  TrendingUp,
} from 'lucide-react';

interface DiscoveredEvent {
  id: string;
  title: string;
  description: string;
  event_type: string;
  category: string;
  source: string;
  source_url: string;
  venue_name: string;
  venue_address: string;
  city: string;
  latitude: number;
  longitude: number;
  event_date: string;
  end_date: string;
  age_restriction: string;
  dress_code: string;
  ticket_price: string;
  ticket_url: string;
  image_url: string;
  is_18_plus: boolean;
  is_21_plus: boolean;
  tags: string[];
  organizer_name: string;
  organizer_url: string;
  user_rsvp: string;
  rsvp_visibility: string;
  attending_count: number;
  attendees?: EventAttendee[];
  distance_km?: number;
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
  rsvp_status: string;
}

interface EventCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
}

interface EventDiscoveryProps {
  onUserClick?: (userId: string) => void;
  onMessageClick?: (userId: string) => void;
}

export default function EventDiscovery({ onUserClick, onMessageClick }: EventDiscoveryProps) {
  const [events, setEvents] = useState<DiscoveredEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<DiscoveredEvent | null>(null);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showNearbyOnly, setShowNearbyOnly] = useState(false);
  const [rsvpModal, setRsvpModal] = useState<{ eventId: string; status: string } | null>(null);

  useEffect(() => {
    fetchCategories();
    fetchEvents();
    getUserLocation();
  }, [filterType, filterCategory, searchQuery, showNearbyOnly]);

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          console.log('Location access denied');
        }
      );
    }
  };

  const fetchCategories = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/event-discovery/categories', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      let url = '/api/event-discovery';
      const params = new URLSearchParams();

      if (filterType) params.append('type', filterType);
      if (filterCategory) params.append('category', filterCategory);
      if (searchQuery) params.append('search', searchQuery);
      if (userLocation?.lat && userLocation?.lng && showNearbyOnly) {
        params.append('lat', userLocation.lat.toString());
        params.append('lng', userLocation.lng.toString());
        params.append('radius', '50');
      }

      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }

      const data = await response.json();
      setEvents(data.events || data);
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
      const response = await fetch(`/api/event-discovery/${eventId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
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

  const rsvpToEvent = async (eventId: string, status: string) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/event-discovery/${eventId}/rsvp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ rsvp_status: status }),
      });

      if (!response.ok) {
        throw new Error('Failed to RSVP');
      }

      setRsvpModal(null);
      await fetchEvents();
      if (selectedEvent?.id === eventId) {
        await fetchEventDetails(eventId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const cancelRsvp = async (eventId: string) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/event-discovery/${eventId}/rsvp`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      await fetchEvents();
      if (selectedEvent?.id === eventId) {
        await fetchEventDetails(eventId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const checkInToEvent = async (eventId: string) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/event-discovery/${eventId}/checkin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: userLocation?.lat,
          longitude: userLocation?.lng,
        }),
      });

      if (selectedEvent?.id === eventId) {
        await fetchEventDetails(eventId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-in failed. Are you at the event location?' : 'An error occurred');
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

  const getEventTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      concert: 'bg-purple-500',
      party: 'bg-orange-500',
      rave: 'bg-pink-500',
      fetish: 'bg-red-500',
      queer_event: 'bg-cyan-500',
      meetup: 'bg-green-500',
      cultural: 'bg-amber-500',
      social: 'bg-blue-500',
      other: 'bg-gray-500',
    };
    return colors[type] || colors.other;
  };

  const getCategoryColor = (categorySlug: string) => {
    const category = categories.find(c => c.slug === categorySlug);
    return category?.color || '#8b5cf6';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-purple-500" />
              Event Discovery
            </h2>
            <p className="text-gray-400 mt-1">
              Discover local events - concerts, parties, queer events, meetups
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events..."
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-purple-500 focus:outline-none"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
              showFilters ? 'bg-purple-500' : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          {userLocation && (
            <button
              onClick={() => setShowNearbyOnly(!showNearbyOnly)}
              className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                showNearbyOnly ? 'bg-purple-500' : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <Navigation className="w-4 h-4" />
              Nearby Only
            </button>
          )}
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="space-y-4">
            {/* Event Type Filter */}
            <div>
              <label className="block text-sm font-medium mb-2">Event Type</label>
              <div className="flex gap-2 flex-wrap">
                {['concert', 'party', 'rave', 'fetish', 'queer_event', 'meetup', 'cultural', 'social'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(filterType === type ? '' : type)}
                    className={`px-3 py-1 rounded-full text-sm transition ${
                      filterType === type
                        ? 'bg-purple-500 text-white'
                        : 'bg-white/5 hover:bg-white/10 text-gray-300'
                    }`}
                  >
                    {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Filter */}
            {categories.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2">Category</label>
                <div className="flex gap-2 flex-wrap">
                  {categories.map((cat) => (
                    <button
                      key={cat.slug}
                      onClick={() => setFilterCategory(filterCategory === cat.slug ? '' : cat.slug)}
                      className={`px-3 py-1 rounded-full text-sm transition ${
                        filterCategory === cat.slug
                          ? 'text-white'
                          : 'bg-white/5 hover:bg-white/10 text-gray-300'
                      }`}
                      style={{
                        backgroundColor: filterCategory === cat.slug ? cat.color : undefined,
                      }}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300 flex items-center gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Events Grid */}
      {loading && !selectedEvent ? (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-400">Loading events...</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {events.map((event) => (
            <div key={event.id} className="bg-white/10 backdrop-blur-lg rounded-2xl overflow-hidden cursor-pointer hover:bg-white/15 transition" onClick={() => fetchEventDetails(event.id)}>
              {event.image_url && (
                <div className="h-40 bg-gradient-to-br from-purple-500/20 to-pink-500/20 relative">
                  <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getEventTypeColor(event.event_type)}`}>
                      {event.event_type.replace('_', ' ')}
                    </span>
                    {event.distance_km && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500">
                        {event.distance_km.toFixed(1)} km
                      </span>
                    )}
                  </div>
                  {event.user_rsvp && event.user_rsvp !== 'none' && (
                    <div className="absolute top-3 right-3">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500 flex items-center gap-1">
                        <UserCheck className="w-3 h-3" />
                        {event.user_rsvp}
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div className="p-4">
                <h3 className="text-lg font-bold mb-2 line-clamp-1">{event.title}</h3>
                <p className="text-gray-400 text-sm mb-3 line-clamp-2">{event.description}</p>

                <div className="flex flex-wrap gap-3 text-sm text-gray-400 mb-3">
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
                  {event.attending_count > 0 && (
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {event.attending_count}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    {event.is_18_plus && (
                      <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded text-xs">18+</span>
                    )}
                    {event.is_21_plus && (
                      <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs">21+</span>
                    )}
                  </div>
                  {event.ticket_price && (
                    <div className="flex items-center gap-1 text-purple-400">
                      <Ticket className="w-4 h-4" />
                      <span className="font-semibold">{event.ticket_price}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {events.length === 0 && !loading && (
            <div className="md:col-span-2 bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center">
              <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No events found. Try adjusting your filters!</p>
            </div>
          )}
        </div>
      )}

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {selectedEvent.image_url && (
              <div className="h-48 relative">
                <img src={selectedEvent.image_url} alt={selectedEvent.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent" />
              </div>
            )}

            <div className="p-6 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getEventTypeColor(selectedEvent.event_type)}`}>
                    {selectedEvent.event_type.replace('_', ' ')}
                  </span>
                  <h2 className="text-2xl font-bold mt-3">{selectedEvent.title}</h2>
                  <p className="text-gray-400 mt-2">{selectedEvent.description}</p>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Event Details */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-purple-500" />
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
                      <MapPin className="w-5 h-5 text-purple-500" />
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
                      <Ticket className="w-5 h-5 text-purple-500" />
                      Tickets
                    </h3>
                    <p className="text-gray-300">{selectedEvent.ticket_price}</p>
                    {selectedEvent.ticket_url && (
                      <a
                        href={selectedEvent.ticket_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:underline text-sm flex items-center gap-1"
                      >
                        Get tickets <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}

                {selectedEvent.dress_code && (
                  <div>
                    <h3 className="font-semibold mb-3">Dress Code</h3>
                    <p className="text-gray-300">{selectedEvent.dress_code}</p>
                  </div>
                )}
              </div>

              {/* Tags */}
              {selectedEvent.tags && selectedEvent.tags.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedEvent.tags.map((tag, i) => (
                      <span key={i} className="px-2 py-1 bg-white/5 rounded text-sm text-gray-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                {selectedEvent.user_rsvp && selectedEvent.user_rsvp !== 'none' ? (
                  <>
                    <button
                      onClick={() => checkInToEvent(selectedEvent.id)}
                      className="px-6 py-3 bg-green-500 hover:bg-green-600 rounded-lg transition flex items-center gap-2 flex-1 justify-center"
                    >
                      <UserCheck className="w-5 h-5" />
                      Check In
                    </button>
                    <button
                      onClick={() => cancelRsvp(selectedEvent.id)}
                      className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg transition flex items-center gap-2"
                    >
                      <LogOut className="w-5 h-5" />
                      Cancel RSVP
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setRsvpModal({ eventId: selectedEvent.id, status: 'going' })}
                    className="px-6 py-3 bg-purple-500 hover:bg-purple-600 rounded-lg transition flex items-center gap-2 flex-1 justify-center"
                  >
                    <Heart className="w-5 h-5" />
                    RSVP Going
                  </button>
                )}
                {selectedEvent.source_url && (
                  <a
                    href={selectedEvent.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition flex items-center gap-2"
                  >
                    <ExternalLink className="w-5 h-5" />
                    View Source
                  </a>
                )}
              </div>

              {/* Attendees */}
              {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-500" />
                    Attending ({selectedEvent.attendees.length})
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedEvent.attendees.map((attendee) => (
                      <div key={attendee.user_id} className="bg-white/5 rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          {attendee.photos && attendee.photos.length > 0 && (
                            <img
                              src={attendee.photos[attendee.primary_photo_index || 0]}
                              alt={attendee.display_name}
                              className="w-12 h-12 rounded-lg object-cover"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold truncate">{attendee.display_name}</h4>
                            <p className="text-sm text-gray-400">
                              {attendee.age} • {attendee.gender}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            {onUserClick && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUserClick(attendee.user_id);
                                }}
                                className="p-1.5 hover:bg-white/10 rounded-lg transition"
                              >
                                <UserCheck className="w-4 h-4" />
                              </button>
                            )}
                            {onMessageClick && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMessageClick(attendee.user_id);
                                }}
                                className="p-1.5 hover:bg-white/10 rounded-lg transition"
                              >
                                <TrendingUp className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RSVP Modal */}
      {rsvpModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">RSVP to Event</h3>
            <div className="space-y-3">
              <button
                onClick={() => rsvpToEvent(rsvpModal.eventId, 'going')}
                className="w-full px-4 py-3 bg-green-500 hover:bg-green-600 rounded-lg transition"
              >
                Going
              </button>
              <button
                onClick={() => rsvpToEvent(rsvpModal.eventId, 'maybe')}
                className="w-full px-4 py-3 bg-yellow-500 hover:bg-yellow-600 rounded-lg transition"
              >
                Maybe
              </button>
              <button
                onClick={() => rsvpToEvent(rsvpModal.eventId, 'interested')}
                className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg transition"
              >
                Interested
              </button>
              <button
                onClick={() => setRsvpModal(null)}
                className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
