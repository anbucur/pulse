/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  ShieldAlert,
  Phone,
  MapPin,
  Video,
  CheckCircle,
  XCircle,
  Users,
  Plus,
  Trash2,
  Edit,
  Clock,
  AlertTriangle,
  Bell,
  PhoneCall,
  Volume2,
  VolumeX,
  X
} from 'lucide-react';

interface TrustedContact {
  id: string;
  contact_name: string;
  contact_phone?: string;
  contact_email?: string;
  relationship?: string;
  priority: number;
  notify_on_sos: boolean;
  share_location: boolean;
  is_verified: boolean;
}

interface SafeSignalStatus {
  isActive: boolean;
  activatedAt?: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    updatedAt: string;
  };
  isRecording: boolean;
  recordingUrl?: string;
  statusNotes?: string;
  lastCheckIn?: string;
  contactsNotified?: string[];
}

interface SOSAlert {
  id: string;
  created_at: string;
  latitude?: number;
  longitude?: number;
  was_on_date: boolean;
  date_partner_name?: string;
  date_location?: string;
  fake_call_triggered: boolean;
  location_shared: boolean;
  recording_started: boolean;
  resolved_at?: string;
  resolution_notes?: string;
}

interface SafeSignalProps {
  onDatePartnerId?: string;
  onDateLocation?: string;
}

export default function SafeSignal({ onDatePartnerId, onDateLocation }: SafeSignalProps) {
  const [status, setStatus] = useState<SafeSignalStatus | null>(null);
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [history, setHistory] = useState<SOSAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showContacts, setShowContacts] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showFakeCall, setShowFakeCall] = useState(false);
  const [fakeCallTimer, setFakeCallTimer] = useState(5);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // New contact form
  const [newContact, setNewContact] = useState({
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    relationship: '',
    priority: 0,
    notify_on_sos: true,
    share_location: true
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    fetchStatus();
    fetchContacts();
    fetchHistory();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status?.isActive) {
      interval = setInterval(() => {
        updateLocation();
        fetchStatus();
      }, 30000); // Update every 30 seconds
    }
    return () => clearInterval(interval);
  }, [status?.isActive]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showFakeCall && fakeCallTimer > 0) {
      timer = setTimeout(() => setFakeCallTimer(fakeCallTimer - 1), 1000);
    } else if (showFakeCall && fakeCallTimer === 0) {
      // Trigger fake call screen
      triggerFakeCallScreen();
    }
    return () => clearTimeout(timer);
  }, [showFakeCall, fakeCallTimer]);

  const fetchStatus = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/safesignal/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Error fetching status:', err);
    }
  };

  const fetchContacts = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/safesignal/contacts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setContacts(data);
      }
    } catch (err) {
      console.error('Error fetching contacts:', err);
    }
  };

  const fetchHistory = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/safesignal/history?limit=5', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const updateLocation = async () => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const token = localStorage.getItem('token');
        try {
          await fetch('/api/safesignal/location', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy
            })
          });
        } catch (err) {
          console.error('Error updating location:', err);
        }
      },
      (err) => console.error('Geolocation error:', err)
    );
  };

  const activateSOS = async () => {
    if (!confirm('Are you sure you want to activate SOS? This will notify your trusted contacts.')) {
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const token = localStorage.getItem('token');
        try {
          const response = await fetch('/api/safesignal/sos', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              locationAccuracy: position.coords.accuracy,
              wasOnDate: !!onDatePartnerId,
              datePartnerId: onDatePartnerId || null,
              dateLocation: onDateLocation || null
            })
          });

          if (response.ok) {
            await fetchStatus();
            await fetchHistory();
          } else {
            const data = await response.json();
            setError(data.error || 'Failed to activate SOS');
          }
        } catch (err) {
          setError('Failed to activate SOS');
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setError('Could not get your location. Please enable location services.');
        setLoading(false);
      }
    );
  };

  const deactivateSOS = async () => {
    const notes = prompt('Add notes about what happened (optional):');

    const token = localStorage.getItem('token');
    try {
      await fetch('/api/safesignal/deactivate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          resolutionNotes: notes || null,
          followUpNeeded: false
        })
      });

      await fetchStatus();
      await fetchHistory();
    } catch (err) {
      setError('Failed to deactivate SOS');
    }
  };

  const triggerFakeCall = async () => {
    setFakeCallTimer(5);
    setShowFakeCall(true);
  };

  const triggerFakeCallScreen = () => {
    if (soundEnabled) {
      // Play ringtone sound
      const audio = new Audio('/sounds/ringtone.mp3');
      audio.loop = true;
      audio.play().catch(() => {});
    }
  };

  const dismissFakeCall = async () => {
    setShowFakeCall(false);
    setFakeCallTimer(5);

    const token = localStorage.getItem('token');
    try {
      await fetch('/api/safesignal/fake-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ phoneNumber: 'Unknown' })
      });
    } catch (err) {
      console.error('Error logging fake call:', err);
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Recording not supported on this device');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // In production, upload to storage service
        const audioUrl = URL.createObjectURL(audioBlob);

        const token = localStorage.getItem('token');
        await fetch('/api/safesignal/recording/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ recordingUrl: audioUrl })
        });

        await fetchStatus();
      };

      mediaRecorder.start();
      setIsRecording(true);

      await fetch('/api/safesignal/recording/start', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      await fetchStatus();
    } catch (err) {
      setError('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const checkIn = async () => {
    const notes = prompt('Add a quick status update (optional):');

    const token = localStorage.getItem('token');
    try {
      await fetch('/api/safesignal/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ notes: notes || null })
      });

      await fetchStatus();
    } catch (err) {
      setError('Failed to check in');
    }
  };

  const addContact = async () => {
    if (!newContact.contact_name) {
      setError('Contact name is required');
      return;
    }

    const token = localStorage.getItem('token');
    try {
      await fetch('/api/safesignal/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newContact)
      });

      setShowAddContact(false);
      setNewContact({
        contact_name: '',
        contact_phone: '',
        contact_email: '',
        relationship: '',
        priority: 0,
        notify_on_sos: true,
        share_location: true
      });
      await fetchContacts();
    } catch (err) {
      setError('Failed to add contact');
    }
  };

  const deleteContact = async (contactId: string) => {
    if (!confirm('Remove this trusted contact?')) return;

    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/safesignal/contacts/${contactId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await fetchContacts();
    } catch (err) {
      setError('Failed to delete contact');
    }
  };

  return (
    <div className="space-y-6">
      {/* Fake Call Screen */}
      {showFakeCall && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center">
          <div className="text-center space-y-8">
            <div className="animate-pulse">
              <PhoneCall className="w-24 h-24 text-green-500 mx-auto" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-white">Incoming Call</h2>
              <p className="text-xl text-gray-400">Mom</p>
            </div>
            <button
              onClick={dismissFakeCall}
              className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition"
            >
              <Phone className="w-10 h-10 text-white rotate-135" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-green-500" />
              Safe Signal
            </h2>
            <p className="text-gray-400 mt-1">
              Your personal safety panic button
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition flex items-center gap-2"
            >
              <Clock className="w-4 h-4" />
              History
            </button>
            <button
              onClick={() => setShowContacts(!showContacts)}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              Contacts ({contacts.length})
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {/* SOS Status */}
      {status?.isActive ? (
        <div className="bg-red-500/20 border-2 border-red-500 rounded-2xl p-8 text-center space-y-6">
          <div className="animate-pulse">
            <ShieldAlert className="w-20 h-20 text-red-500 mx-auto" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-red-400 mb-2">SOS ACTIVE</h3>
            <p className="text-gray-300">
              {status.contactsNotified?.length || 0} contacts notified
            </p>
            {status.lastCheckIn && (
              <p className="text-sm text-gray-400 mt-2">
                Last check-in: {new Date(status.lastCheckIn).toLocaleTimeString()}
              </p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={triggerFakeCall}
              className="px-6 py-4 bg-blue-500 hover:bg-blue-600 rounded-xl transition flex flex-col items-center gap-2"
            >
              <PhoneCall className="w-6 h-6" />
              <span className="font-semibold">Fake Call</span>
            </button>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`px-6 py-4 ${isRecording ? 'bg-red-500' : 'bg-purple-500'} hover:opacity-80 rounded-xl transition flex flex-col items-center gap-2`}
            >
              <Video className="w-6 h-6" />
              <span className="font-semibold">{isRecording ? 'Stop Recording' : 'Record'}</span>
            </button>
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={checkIn}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition flex items-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              I'm Safe
            </button>
            <button
              onClick={deactivateSOS}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition flex items-center gap-2"
            >
              <XCircle className="w-5 h-5" />
              Deactivate
            </button>
          </div>

          {status.location && (
            <div className="text-sm text-gray-400">
              <MapPin className="w-4 h-4 inline mr-1" />
              Location sharing active
            </div>
          )}
        </div>
      ) : (
        /* Panic Button */
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center">
          <button
            onClick={activateSOS}
            disabled={loading}
            className={`w-48 h-48 rounded-full bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 disabled:from-gray-700 disabled:to-gray-800 transition-all duration-300 transform hover:scale-105 disabled:scale-100 flex flex-col items-center justify-center gap-4 shadow-2xl ${loading ? 'animate-pulse' : ''}`}
          >
            <ShieldAlert className="w-20 h-20 text-white" />
            <span className="text-2xl font-bold text-white">
              {loading ? 'Activating...' : 'SOS'}
            </span>
          </button>
          <p className="text-gray-400 mt-6">
            Press to alert trusted contacts with your location
          </p>

          <div className="flex justify-center gap-4 mt-8">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-lg transition"
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
          </div>
        </div>
      )}

      {/* Trusted Contacts */}
      {showContacts && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Users className="w-5 h-5" />
              Trusted Contacts
            </h3>
            <button
              onClick={() => setShowAddContact(!showAddContact)}
              className="px-4 py-2 bg-pink-500 hover:bg-pink-600 rounded-lg transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Contact
            </button>
          </div>

          {showAddContact && (
            <div className="bg-white/5 rounded-lg p-4 mb-4 space-y-3">
              <input
                type="text"
                placeholder="Contact Name *"
                value={newContact.contact_name}
                onChange={(e) => setNewContact({ ...newContact, contact_name: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
              />
              <input
                type="tel"
                placeholder="Phone Number"
                value={newContact.contact_phone}
                onChange={(e) => setNewContact({ ...newContact, contact_phone: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
              />
              <input
                type="email"
                placeholder="Email"
                value={newContact.contact_email}
                onChange={(e) => setNewContact({ ...newContact, contact_email: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Relationship (e.g., Mom, Best Friend)"
                value={newContact.relationship}
                onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={addContact}
                  className="flex-1 px-4 py-2 bg-pink-500 hover:bg-pink-600 rounded-lg transition"
                >
                  Add Contact
                </button>
                <button
                  onClick={() => setShowAddContact(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {contacts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No trusted contacts yet</p>
              <p className="text-sm">Add contacts who will be notified during emergencies</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contacts.map((contact) => (
                <div key={contact.id} className="bg-white/5 rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold">{contact.contact_name}</h4>
                    {contact.relationship && (
                      <p className="text-sm text-gray-400">{contact.relationship}</p>
                    )}
                    {contact.contact_phone && (
                      <p className="text-sm text-gray-400">{contact.contact_phone}</p>
                    )}
                    <div className="flex gap-3 mt-2 text-xs">
                      <span className={contact.notify_on_sos ? 'text-green-400' : 'text-gray-500'}>
                        {contact.notify_on_sos ? <Bell className="w-3 h-3 inline mr-1" /> : null}
                        Notify on SOS
                      </span>
                      <span className={contact.share_location ? 'text-blue-400' : 'text-gray-500'}>
                        {contact.share_location ? <MapPin className="w-3 h-3 inline mr-1" /> : null}
                        Share location
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteContact(contact.id)}
                    className="p-2 hover:bg-red-500/20 rounded-lg transition text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History */}
      {showHistory && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent Alerts
          </h3>

          {history.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No previous alerts</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((alert) => (
                <div key={alert.id} className="bg-white/5 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`w-4 h-4 ${alert.resolved_at ? 'text-green-500' : 'text-red-500'}`} />
                      <span className="font-semibold">
                        {alert.resolved_at ? 'Resolved' : 'Active'}
                      </span>
                    </div>
                    <span className="text-sm text-gray-400">
                      {new Date(alert.created_at).toLocaleString()}
                    </span>
                  </div>

                  {alert.was_on_date && (
                    <div className="text-sm text-gray-300">
                      <span className="text-pink-400">During date with</span>
                      {alert.date_partner_name && ` ${alert.date_partner_name}`}
                      {alert.date_location && ` at ${alert.date_location}`}
                    </div>
                  )}

                  <div className="flex gap-3 mt-2 text-xs text-gray-400">
                    {alert.fake_call_triggered && <span>Fake call triggered</span>}
                    {alert.location_shared && <span>Location shared</span>}
                    {alert.recording_started && <span>Recording started</span>}
                  </div>

                  {alert.resolution_notes && (
                    <div className="mt-2 text-sm text-gray-300">
                      <strong>Resolution:</strong> {alert.resolution_notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
