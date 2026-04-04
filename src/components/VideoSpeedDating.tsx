/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Clock,
  Users,
  Calendar,
  Star,
  X,
  Heart,
  MessageCircle,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Timer,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

interface SpeedDatingEvent {
  id: string;
  title: string;
  description: string;
  event_type: string;
  event_date: string;
  duration_minutes: number;
  round_duration_minutes: number;
  break_duration_minutes: number;
  max_participants: number;
  min_participants: number;
  current_participants: number;
  gender_preference: string;
  age_min: number;
  age_max: number;
  interests_match: boolean;
  interests_tags: string[];
  requires_verification: boolean;
  entry_fee: number;
  status: string;
  user_registered: boolean;
  user_status: string;
  participant_number?: number;
  participants?: EventParticipant[];
}

interface EventParticipant {
  id: string;
  user_id: string;
  event_id: string;
  participant_number: number;
  status: string;
  display_name: string;
  age: number;
  gender: string;
  photos: string[];
  primary_photo_index: number;
  interests: string[];
}

interface CurrentMatch {
  id: string;
  round_id: string;
  event_id: string;
  participant1_id: string;
  participant2_id: string;
  match_started_at: string;
  round_number: number;
  round_status: string;
  round_started_at: string;
  elapsed_minutes: number;
  partner_name: string;
  partner_age: number;
  partner_gender: string;
  partner_photos: string[];
  partner_photo_index: number;
  room_name: string;
}

interface MutualMatch {
  id: string;
  event_id: string;
  user1_id: string;
  user2_id: string;
  match_score: number;
  compatibility_tags: string[];
  display_name: string;
  age: number;
  gender: string;
  photos: string[];
  primary_photo_index: number;
  interests: string[];
  bio: string;
  matched_user_id: string;
}

interface SpeedDatingStats {
  events_participated: number;
  total_rounds: number;
  total_matches: number;
  mutual_matches: number;
  average_rating: number;
  received_rating_count: number;
}

interface VideoSpeedDatingProps {
  onUserClick?: (userId: string) => void;
  onMessageClick?: (userId: string) => void;
}

export default function VideoSpeedDating({ onUserClick, onMessageClick }: VideoSpeedDatingProps) {
  const [events, setEvents] = useState<SpeedDatingEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<SpeedDatingEvent | null>(null);
  const [currentMatch, setCurrentMatch] = useState<CurrentMatch | null>(null);
  const [mutualMatches, setMutualMatches] = useState<MutualMatch[]>([]);
  const [stats, setStats] = useState<SpeedDatingStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRatings, setShowRatings] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Video state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [callConnected, setCallConnected] = useState(false);

  // Ratings state
  const [rating, setRating] = useState(0);
  const [wouldMatchAgain, setWouldMatchAgain] = useState(false);
  const [interestLevel, setInterestLevel] = useState('');
  const [notes, setNotes] = useState('');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchEvents();
    fetchStats();

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      stopLocalStream();
    };
  }, []);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Poll for current match during active event
  useEffect(() => {
    if (selectedEvent?.user_status === 'active' && selectedEvent?.status === 'ongoing') {
      pollingRef.current = setInterval(() => {
        fetchCurrentMatch(selectedEvent.id);
      }, 5000); // Poll every 5 seconds

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
      };
    }
  }, [selectedEvent]);

  useEffect(() => {
    if (currentMatch && currentMatch.round_status === 'active') {
      const roundDuration = selectedEvent?.round_duration_minutes || 3;
      const elapsed = currentMatch.elapsed_minutes || 0;
      const remaining = Math.max(0, roundDuration - elapsed);
      setTimeRemaining(Math.ceil(remaining * 60));

      const timer = setInterval(() => {
        setTimeRemaining((prev) => Math.max(0, prev - 1));
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [currentMatch]);

  const stopLocalStream = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/speed-dating/events?page=1&limit=10', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }

      const data = await response.json();
      setEvents(data.events);
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
      const response = await fetch(`/api/speed-dating/events/${eventId}`, {
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

  const fetchCurrentMatch = async (eventId: string) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/speed-dating/events/${eventId}/current-match`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.match && data.match.id !== currentMatch?.id) {
          setCurrentMatch(data.match);
          // Could initiate WebRTC connection here
        }
      }
    } catch (err) {
      console.error('Failed to fetch current match:', err);
    }
  };

  const fetchMutualMatches = async (eventId: string) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/speed-dating/events/${eventId}/mutual-matches`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setMutualMatches(data);
      }
    } catch (err) {
      console.error('Failed to fetch mutual matches:', err);
    }
  };

  const fetchStats = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/speed-dating/stats/me', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const registerForEvent = async (eventId: string) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/speed-dating/events/${eventId}/register`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to register');
      }

      await fetchEvents();
      await fetchEventDetails(eventId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register');
    }
  };

  const startVideoCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      setCallConnected(true);

      // In production, set up WebRTC connection here
      // This would involve:
      // 1. Getting TURN/STUN servers
      // 2. Creating RTCPeerConnection
      // 3. Exchanging offers/answers via signaling server
      // 4. Adding remote stream when received

    } catch (err) {
      setError('Failed to access camera/microphone. Please check permissions.');
    }
  };

  const endCall = async () => {
    stopLocalStream();
    setRemoteStream(null);
    setCallConnected(false);
    setShowRatings(true);
  };

  const submitRating = async () => {
    if (!currentMatch || !selectedEvent) return;

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/speed-dating/events/${selectedEvent.id}/ratings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          match_id: currentMatch.id,
          rated_user_id: currentMatch.partner_name, // Would be actual user_id
          rating,
          would_match_again: wouldMatchAgain,
          interest_level,
          notes,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit rating');
      }

      const data = await response.json();
      if (data.isMutualMatch) {
        setError('🎉 It\'s a mutual match!');
        setTimeout(() => setError(null), 3000);
      }

      // Reset rating form
      setRating(0);
      setWouldMatchAgain(false);
      setInterestLevel('');
      setNotes('');
      setShowRatings(false);
      setCurrentMatch(null);

      // Fetch updated mutual matches
      await fetchMutualMatches(selectedEvent.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit rating');
    }
  };

  const cancelRegistration = async (eventId: string) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/speed-dating/events/${eventId}/register`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      await fetchEvents();
      setSelectedEvent(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getEventTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      standard: 'bg-purple-500',
      queer_only: 'bg-pink-500',
      age_specific: 'bg-blue-500',
      interest_based: 'bg-green-500',
      premium: 'bg-yellow-500',
    };
    return colors[type] || colors.standard;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Video className="w-6 h-6 text-pink-500" />
              Video Speed Dating
            </h2>
            <p className="text-gray-400 mt-1">
              3-minute video rounds with verified users. Meet multiple matches!
            </p>
          </div>

          {stats && (
            <div className="flex gap-6 text-center">
              <div>
                <div className="text-2xl font-bold text-pink-500">{stats.events_participated}</div>
                <div className="text-xs text-gray-400">Events</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-500">{stats.mutual_matches}</div>
                <div className="text-xs text-gray-400">Mutual Matches</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-500">{stats.average_rating.toFixed(1)}</div>
                <div className="text-xs text-gray-400">Avg Rating</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Events Grid */}
      {loading && !selectedEvent ? (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-pink-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-400">Loading events...</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {events.map((event) => (
            <div key={event.id} className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
              <div className="flex justify-between items-start mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getEventTypeColor(event.event_type)}`}>
                  {event.event_type.replace('_', ' ')}
                </span>
                {event.requires_verification && (
                  <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Verified Only
                  </span>
                )}
              </div>

              <h3 className="text-xl font-bold mb-2">{event.title}</h3>
              <p className="text-gray-400 text-sm mb-4 line-clamp-2">{event.description}</p>

              <div className="space-y-2 text-sm text-gray-400 mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {formatDate(event.event_date)}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {event.duration_minutes} min • {event.round_duration_minutes} min rounds
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {event.current_participants}/{event.max_participants} registered
                </div>
                {event.interests_match && event.interests_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {event.interests_tags.slice(0, 3).map((tag, i) => (
                      <span key={i} className="px-2 py-0.5 bg-pink-500/20 text-pink-300 rounded text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {event.user_registered ? (
                  <>
                    <button
                      onClick={() => fetchEventDetails(event.id)}
                      className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg transition"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => cancelRegistration(event.id)}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg transition"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => registerForEvent(event.id)}
                    disabled={event.current_participants >= event.max_participants}
                    className="flex-1 px-4 py-2 bg-pink-500 hover:bg-pink-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition"
                  >
                    {event.current_participants >= event.max_participants ? 'Full' : 'Register'}
                  </button>
                )}
              </div>
            </div>
          ))}

          {events.length === 0 && !loading && (
            <div className="md:col-span-2 bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center">
              <Video className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No upcoming events. Check back soon!</p>
            </div>
          )}
        </div>
      )}

      {/* Event Details Modal */}
      {selectedEvent && !showRatings && !currentMatch && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-6">
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

            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-2 text-gray-300">
                <Calendar className="w-5 h-5 text-pink-500" />
                {formatDate(selectedEvent.event_date)}
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <Clock className="w-5 h-5 text-pink-500" />
                {selectedEvent.duration_minutes} minutes • {selectedEvent.round_duration_minutes} min rounds • {selectedEvent.break_duration_minutes} min breaks
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <Users className="w-5 h-5 text-pink-500" />
                {selectedEvent.current_participants}/{selectedEvent.max_participants} participants
              </div>
              {selectedEvent.age_min > 18 && (
                <div className="text-gray-300">
                  Age range: {selectedEvent.age_min} - {selectedEvent.age_max}
                </div>
              )}
            </div>

            {selectedEvent.participants && selectedEvent.participants.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Participants</h3>
                <div className="grid grid-cols-4 gap-2">
                  {selectedEvent.participants.map((participant) => (
                    <div key={participant.id} className="bg-white/5 rounded-lg p-2 text-center">
                      {participant.photos && participant.photos.length > 0 && (
                        <img
                          src={participant.photos[participant.primary_photo_index || 0]}
                          alt={participant.display_name}
                          className="w-12 h-12 rounded-lg object-cover mx-auto mb-1"
                        />
                      )}
                      <div className="text-xs font-medium truncate">{participant.display_name}</div>
                      <div className="text-xs text-gray-400">{participant.age}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mutualMatches.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Heart className="w-5 h-5 text-pink-500" />
                  Mutual Matches ({mutualMatches.length})
                </h3>
                <div className="grid gap-2">
                  {mutualMatches.map((match) => (
                    <div key={match.id} className="bg-white/5 rounded-lg p-3 flex items-center gap-3">
                      {match.photos && match.photos.length > 0 && (
                        <img
                          src={match.photos[match.primary_photo_index || 0]}
                          alt={match.display_name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <h4 className="font-semibold">{match.display_name}</h4>
                        <p className="text-sm text-gray-400">{match.age} • {match.gender}</p>
                      </div>
                      <div className="flex gap-1">
                        {onUserClick && (
                          <button
                            onClick={() => onUserClick(match.matched_user_id)}
                            className="p-2 hover:bg-white/10 rounded-lg transition"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              {selectedEvent.user_status === 'registered' && (
                <button
                  onClick={startVideoCall}
                  className="flex-1 px-6 py-3 bg-green-500 hover:bg-green-600 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Video className="w-5 h-5" />
                  Ready to Start
                </button>
              )}
              {selectedEvent.user_status === 'checked_in' && selectedEvent.status === 'ongoing' && (
                <button
                  onClick={() => fetchCurrentMatch(selectedEvent.id)}
                  className="flex-1 px-6 py-3 bg-pink-500 hover:bg-pink-600 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-5 h-5" />
                  Check for Match
                </button>
              )}
              {selectedEvent.user_status === 'active' && (
                <button
                  onClick={() => fetchCurrentMatch(selectedEvent.id)}
                  className="flex-1 px-6 py-3 bg-pink-500 hover:bg-pink-600 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-5 h-5" />
                  Find Next Match
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Video Call Interface */}
      {currentMatch && !showRatings && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-center p-4 bg-black/50">
            <div className="flex items-center gap-3">
              <Timer className="w-5 h-5 text-pink-500" />
              <span className="text-2xl font-bold">{formatTime(timeRemaining)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Round {currentMatch.round_number}</span>
            </div>
            <button
              onClick={endCall}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg transition flex items-center gap-2"
            >
              <PhoneOff className="w-4 h-4" />
              End Round
            </button>
          </div>

          {/* Video Grid */}
          <div className="flex-1 grid md:grid-cols-2 gap-4 p-4">
            {/* Local Video */}
            <div className="relative bg-gray-900 rounded-2xl overflow-hidden">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              {!callConnected && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                  <button
                    onClick={startVideoCall}
                    className="px-6 py-3 bg-pink-500 hover:bg-pink-600 rounded-lg transition flex items-center gap-2"
                  >
                    <Video className="w-5 h-5" />
                    Start Camera
                  </button>
                </div>
              )}
              <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/50 rounded text-sm">
                You
              </div>
            </div>

            {/* Remote Video */}
            <div className="relative bg-gray-900 rounded-2xl overflow-hidden">
              {remoteStream ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                  <div className="text-center">
                    {currentMatch.partner_photos && currentMatch.partner_photos.length > 0 && (
                      <img
                        src={currentMatch.partner_photos[currentMatch.partner_photo_index || 0]}
                        alt={currentMatch.partner_name}
                        className="w-32 h-32 rounded-full object-cover mx-auto mb-3"
                      />
                    )}
                    <div className="text-xl font-semibold">{currentMatch.partner_name}</div>
                    <div className="text-gray-400">{currentMatch.partner_age} • {currentMatch.partner_gender}</div>
                    <div className="text-gray-400 text-sm mt-2">Waiting for video...</div>
                  </div>
                </div>
              )}
              <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/50 rounded text-sm">
                {currentMatch.partner_name}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-4 p-4 bg-black/50">
            <button
              onClick={() => setVideoEnabled(!videoEnabled)}
              className={`p-4 rounded-full transition ${
                videoEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/50'
              }`}
            >
              {videoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
            </button>
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={`p-4 rounded-full transition ${
                audioEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/50'
              }`}
            >
              {audioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
            </button>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {showRatings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Star className="w-6 h-6 text-yellow-500" />
              Rate Your Date
            </h3>

            {currentMatch?.partner_photos && (
              <div className="flex justify-center mb-4">
                <img
                  src={currentMatch.partner_photos[currentMatch.partner_photo_index || 0]}
                  alt={currentMatch.partner_name}
                  className="w-24 h-24 rounded-full object-cover"
                />
              </div>
            )}

            <div className="space-y-4">
              {/* Rating */}
              <div>
                <label className="block text-sm font-medium mb-2">Overall Rating</label>
                <div className="flex gap-2 justify-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className={`text-3xl transition ${
                        star <= rating ? 'text-yellow-500' : 'text-gray-600'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Would Match Again */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wouldMatchAgain}
                    onChange={(e) => setWouldMatchAgain(e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <span>I'd like to match again</span>
                </label>
              </div>

              {/* Interest Level */}
              <div>
                <label className="block text-sm font-medium mb-2">Interest Level</label>
                <select
                  value={interestLevel}
                  onChange={(e) => setInterestLevel(e.target.value)}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                >
                  <option value="">Select...</option>
                  <option value="not_interested">Not Interested</option>
                  <option value="maybe">Maybe</option>
                  <option value="interested">Interested</option>
                  <option value="very_interested">Very Interested</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-2">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                  rows={3}
                  placeholder="Any thoughts about this match..."
                />
              </div>

              {/* Submit */}
              <button
                onClick={submitRating}
                disabled={rating === 0}
                className="w-full px-6 py-3 bg-pink-500 hover:bg-pink-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition"
              >
                Submit Rating
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
