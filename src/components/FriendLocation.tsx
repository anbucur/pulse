/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Users,
  Shield,
  Clock,
  Plus,
  Trash2,
  Edit,
  Bell,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Radio,
  Calendar,
  UserPlus,
  Settings,
  Eye,
  EyeOff,
  Navigation,
  Phone,
  Mail,
  Timer,
  AlertCircle,
  X,
  Satellite
} from 'lucide-react';

interface TrustedContact {
  id: string;
  contact_name: string;
  contact_phone?: string;
  contact_email?: string;
  relationship?: string;
  priority: number;
  can_receive_location: boolean;
  can_receive_emergency: boolean;
  can_request_checkin: boolean;
  is_verified: boolean;
  active: boolean;
  notes?: string;
}

interface LocationShare {
  id: string;
  share_name?: string;
  share_type: string;
  is_active: boolean;
  share_started_at: string;
  share_ends_at?: string;
  date_partner_id?: number;
  date_location?: string;
  emergency_broadcast: boolean;
  update_count?: number;
}

interface CheckInRequest {
  id: string;
  request_type: string;
  scheduled_for?: string;
  due_by: string;
  message?: string;
  status: string;
  reminder_sent: boolean;
  completed_at?: string;
  contact_name?: string;
}

interface EmergencyBroadcast {
  id: string;
  broadcast_type: string;
  message?: string;
  location_sent: boolean;
  latitude?: number;
  longitude?: number;
  contacts_notified: number;
  status: string;
  resolved_at?: string;
  created_at: string;
}

interface ScheduledRule {
  id: string;
  rule_name: string;
  start_time: string;
  end_time: string;
  days_of_week: string;
  auto_activate: boolean;
  active: boolean;
}

interface FriendLocationProps {
  onDatePartnerId?: string;
  onDateLocation?: string;
}

export default function FriendLocation({ onDatePartnerId, onDateLocation }: FriendLocationProps) {
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [activeShares, setActiveShares] = useState<LocationShare[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInRequest[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyBroadcast[]>([]);
  const [scheduledRules, setScheduledRules] = useState<ScheduledRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // UI states
  const [showContacts, setShowContacts] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showCheckIns, setShowCheckIns] = useState(false);
  const [showEmergencies, setShowEmergencies] = useState(false);
  const [showScheduled, setShowScheduled] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);

  // Forms
  const [newContact, setNewContact] = useState({
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    relationship: '',
    priority: 0,
    can_receive_location: true,
    can_receive_emergency: true,
    can_request_checkin: true,
    notes: ''
  });

  const [newShare, setNewShare] = useState({
    share_name: '',
    share_type: 'date',
    share_ends_at: '',
    date_partner_id: onDatePartnerId || '',
    date_location: onDateLocation || ''
  });

  const [checkInData, setCheckInData] = useState({
    request_type: 'manual',
    due_by: '',
    message: ''
  });

  useEffect(() => {
    fetchContacts();
    fetchActiveShares();
    fetchCheckIns();
    fetchEmergencies();
    fetchScheduledRules();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (sharingLocation) {
      interval = setInterval(() => {
        updateLocation();
      }, 30000); // Update every 30 seconds
    }
    return () => clearInterval(interval);
  }, [sharingLocation]);

  const fetchContacts = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/location-sharing/contacts', {
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

  const fetchActiveShares = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/location-sharing/shares/active', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setActiveShares(data);
        setSharingLocation(data.some((s: LocationShare) => s.is_active));
      }
    } catch (err) {
      console.error('Error fetching shares:', err);
    }
  };

  const fetchCheckIns = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/location-sharing/checkins/pending', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCheckIns(data);
      }
    } catch (err) {
      console.error('Error fetching check-ins:', err);
    }
  };

  const fetchEmergencies = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/location-sharing/emergency/active', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setEmergencies(data);
      }
    } catch (err) {
      console.error('Error fetching emergencies:', err);
    }
  };

  const fetchScheduledRules = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/location-sharing/scheduled-rules', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setScheduledRules(data);
      }
    } catch (err) {
      console.error('Error fetching scheduled rules:', err);
    }
  };

  const updateLocation = async () => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const activeShareId = activeShares.find(s => s.is_active)?.id;
        if (!activeShareId) return;

        const token = localStorage.getItem('token');
        try {
          await fetch(`/api/location-sharing/shares/${activeShareId}/location`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              speed: position.coords.speed,
              heading: position.coords.heading
            })
          });
        } catch (err) {
          console.error('Error updating location:', err);
        }
      },
      (err) => console.error('Geolocation error:', err)
    );
  };

  const addContact = async () => {
    if (!newContact.contact_name) {
      setError('Contact name is required');
      return;
    }

    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      await fetch('/api/location-sharing/contacts', {
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
        can_receive_location: true,
        can_receive_emergency: true,
        can_request_checkin: true,
        notes: ''
      });
      await fetchContacts();
      setSuccess('Contact added successfully');
    } catch (err) {
      setError('Failed to add contact');
    } finally {
      setLoading(false);
    }
  };

  const deleteContact = async (contactId: string) => {
    if (!confirm('Remove this trusted contact?')) return;

    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/location-sharing/contacts/${contactId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await fetchContacts();
      setSuccess('Contact removed');
    } catch (err) {
      setError('Failed to delete contact');
    }
  };

  const startLocationShare = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      await fetch('/api/location-sharing/shares', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newShare)
      });

      await fetchActiveShares();
      setSharingLocation(true);
      setSuccess('Location sharing started');
      setNewShare({
        share_name: '',
        share_type: 'date',
        share_ends_at: '',
        date_partner_id: onDatePartnerId || '',
        date_location: onDateLocation || ''
      });
    } catch (err) {
      setError('Failed to start location sharing');
    } finally {
      setLoading(false);
    }
  };

  const endLocationShare = async (shareId: string) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/location-sharing/shares/${shareId}/end`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await fetchActiveShares();
      setSuccess('Location sharing ended');
    } catch (err) {
      setError('Failed to end location sharing');
    }
  };

  const createCheckIn = async () => {
    if (!checkInData.due_by) {
      setError('Due time is required');
      return;
    }

    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      await fetch('/api/location-sharing/checkins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(checkInData)
      });

      await fetchCheckIns();
      setSuccess('Check-in request created');
      setCheckInData({ request_type: 'manual', due_by: '', message: '' });
    } catch (err) {
      setError('Failed to create check-in');
    } finally {
      setLoading(false);
    }
  };

  const respondToCheckIn = async (requestId: string) => {
    const notes = prompt('Add a quick status update (optional):');
    if (notes === null) return;

    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      let latitude, longitude;
      if (navigator.geolocation) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      }

      await fetch(`/api/location-sharing/checkins/${requestId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          response_text: notes,
          location_shared: !!latitude,
          latitude,
          longitude
        })
      });

      await fetchCheckIns();
      setSuccess('Check-in completed');
    } catch (err) {
      setError('Failed to respond to check-in');
    } finally {
      setLoading(false);
    }
  };

  const triggerEmergency = async () => {
    if (!confirm('Are you sure you want to send an emergency broadcast to all your trusted contacts?')) {
      return;
    }

    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      let latitude, longitude, accuracy;
      if (navigator.geolocation) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
        accuracy = position.coords.accuracy;
      }

      await fetch('/api/location-sharing/emergency', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          broadcast_type: 'sos',
          message: 'I need help!',
          latitude,
          longitude,
          location_accuracy: accuracy,
          share_id: activeShares.find(s => s.is_active)?.id
        })
      });

      await fetchEmergencies();
      setSuccess('Emergency broadcast sent');
    } catch (err) {
      setError('Failed to send emergency broadcast');
    } finally {
      setLoading(false);
    }
  };

  const resolveEmergency = async (broadcastId: string) => {
    const notes = prompt('Add resolution notes (optional):');

    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/location-sharing/emergency/${broadcastId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'resolved',
          resolution_notes: notes || null
        })
      });

      await fetchEmergencies();
      setSuccess('Emergency resolved');
    } catch (err) {
      setError('Failed to resolve emergency');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Satellite className="w-6 h-6 text-blue-500" />
              Friend Location Sharing
            </h2>
            <p className="text-gray-400 mt-1">
              "My friend has my location" - First-class safety feature
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowScheduled(!showScheduled)}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              Scheduled
            </button>
            <button
              onClick={() => setShowCheckIns(!showCheckIns)}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition flex items-center gap-2"
            >
              <Timer className="w-4 h-4" />
              Check-ins
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

      {/* Notifications */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 text-green-300 flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-300">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Active Emergency */}
      {emergencies.some(e => e.status === 'active') && (
        <div className="bg-red-500/20 border-2 border-red-500 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-red-500 animate-pulse" />
              <div>
                <h3 className="text-xl font-bold text-red-400">Emergency Active</h3>
                <p className="text-gray-300">
                  {emergencies.find(e => e.status === 'active')?.contacts_notified} contacts notified
                </p>
              </div>
            </div>
            <button
              onClick={() => resolveEmergency(emergencies.find(e => e.status === 'active')!.id)}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition flex items-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              Resolve
            </button>
          </div>
        </div>
      )}

      {/* Active Location Sharing */}
      {sharingLocation && activeShares.filter(s => s.is_active).length > 0 && (
        <div className="bg-blue-500/20 border-2 border-blue-500 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Radio className="w-8 h-8 text-blue-500 animate-pulse" />
              <div>
                <h3 className="text-xl font-bold text-blue-400">Location Sharing Active</h3>
                <p className="text-gray-300">
                  {activeShares.filter(s => s.is_active).length} active session(s)
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {activeShares.filter(s => s.is_active).map((share) => (
              <div key={share.id} className="bg-white/5 rounded-lg p-4 flex justify-between items-center">
                <div>
                  <div className="font-semibold">
                    {share.share_name || share.share_type}
                  </div>
                  <div className="text-sm text-gray-400">
                    Started: {new Date(share.share_started_at).toLocaleTimeString()}
                  </div>
                  {share.date_location && (
                    <div className="text-sm text-pink-400">
                      <MapPin className="w-3 h-3 inline mr-1" />
                      {share.date_location}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => endLocationShare(share.id)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
                >
                  End Share
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emergency SOS Button */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
        <button
          onClick={triggerEmergency}
          disabled={loading}
          className={`w-48 h-48 rounded-full bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 disabled:from-gray-700 disabled:to-gray-800 transition-all duration-300 transform hover:scale-105 disabled:scale-100 flex flex-col items-center justify-center gap-4 shadow-2xl ${loading ? 'animate-pulse' : ''}`}
        >
          <AlertTriangle className="w-20 h-20 text-white" />
          <span className="text-2xl font-bold text-white">
            {loading ? 'Sending...' : 'SOS'}
          </span>
        </button>
        <p className="text-gray-400 mt-6">
          Broadcast emergency to {contacts.length} trusted contacts
        </p>
      </div>

      {/* Start Location Sharing */}
      {!sharingLocation && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-pink-500" />
            Start Location Sharing
          </h3>

          <div className="space-y-4">
            <input
              type="text"
              placeholder="Share name (optional)"
              value={newShare.share_name}
              onChange={(e) => setNewShare({ ...newShare, share_name: e.target.value })}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
            />

            <select
              value={newShare.share_type}
              onChange={(e) => setNewShare({ ...newShare, share_type: e.target.value })}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
            >
              <option value="date">Date</option>
              <option value="travel">Travel</option>
              <option value="manual">Manual</option>
              <option value="indefinite">Indefinite</option>
            </select>

            <input
              type="datetime-local"
              placeholder="End time (optional)"
              value={newShare.share_ends_at}
              onChange={(e) => setNewShare({ ...newShare, share_ends_at: e.target.value })}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
            />

            <button
              onClick={startLocationShare}
              disabled={loading}
              className="w-full px-6 py-3 bg-pink-500 hover:bg-pink-600 disabled:from-gray-700 disabled:to-gray-800 rounded-lg transition flex items-center justify-center gap-2"
            >
              <Radio className="w-5 h-5" />
              {loading ? 'Starting...' : 'Start Sharing'}
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
              <div className="flex gap-2 flex-wrap">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newContact.can_receive_location}
                    onChange={(e) => setNewContact({ ...newContact, can_receive_location: e.target.checked })}
                    className="rounded"
                  />
                  Location
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newContact.can_receive_emergency}
                    onChange={(e) => setNewContact({ ...newContact, can_receive_emergency: e.target.checked })}
                    className="rounded"
                  />
                  Emergency
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newContact.can_request_checkin}
                    onChange={(e) => setNewContact({ ...newContact, can_request_checkin: e.target.checked })}
                    className="rounded"
                  />
                  Check-ins
                </label>
              </div>
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
              <p className="text-sm">Add friends who will receive your location during emergencies</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contacts.map((contact) => (
                <div key={contact.id} className="bg-white/5 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold flex items-center gap-2">
                        {contact.contact_name}
                        {contact.is_verified && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                      </h4>
                      {contact.relationship && (
                        <p className="text-sm text-gray-400">{contact.relationship}</p>
                      )}
                      <div className="flex gap-2 mt-2 text-xs">
                        {contact.contact_phone && (
                          <span className="text-gray-400 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {contact.contact_phone}
                          </span>
                        )}
                        {contact.contact_email && (
                          <span className="text-gray-400 flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {contact.contact_email}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-3 mt-2 text-xs">
                        <span className={contact.can_receive_location ? 'text-blue-400' : 'text-gray-500'}>
                          <MapPin className="w-3 h-3 inline mr-1" />
                          Location
                        </span>
                        <span className={contact.can_receive_emergency ? 'text-red-400' : 'text-gray-500'}>
                          <AlertTriangle className="w-3 h-3 inline mr-1" />
                          Emergency
                        </span>
                        <span className={contact.can_request_checkin ? 'text-green-400' : 'text-gray-500'}>
                          <Timer className="w-3 h-3 inline mr-1" />
                          Check-ins
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
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Check-in Requests */}
      {showCheckIns && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Timer className="w-5 h-5" />
            Check-in Requests
          </h3>

          <div className="bg-white/5 rounded-lg p-4 mb-4 space-y-3">
            <input
              type="datetime-local"
              value={checkInData.due_by}
              onChange={(e) => setCheckInData({ ...checkInData, due_by: e.target.value })}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
            />
            <textarea
              placeholder="Message (optional)"
              value={checkInData.message}
              onChange={(e) => setCheckInData({ ...checkInData, message: e.target.value })}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none resize-none"
              rows={2}
            />
            <button
              onClick={createCheckIn}
              className="w-full px-4 py-2 bg-pink-500 hover:bg-pink-600 rounded-lg transition flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Check-in
            </button>
          </div>

          {checkIns.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Timer className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No pending check-ins</p>
            </div>
          ) : (
            <div className="space-y-3">
              {checkIns.map((checkIn) => (
                <div key={checkIn.id} className="bg-white/5 rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <div className="font-semibold">
                      {checkIn.contact_name || 'Check-in'}
                    </div>
                    <div className="text-sm text-gray-400">
                      Due: {new Date(checkIn.due_by).toLocaleString()}
                    </div>
                    {checkIn.message && (
                      <div className="text-sm text-gray-300 mt-1">{checkIn.message}</div>
                    )}
                  </div>
                  <button
                    onClick={() => respondToCheckIn(checkIn.id)}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg transition flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Check In
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scheduled Rules */}
      {showScheduled && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Scheduled Sharing Rules
          </h3>

          {scheduledRules.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No scheduled rules yet</p>
              <p className="text-sm">Set up automatic location sharing during specific times</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduledRules.map((rule) => (
                <div key={rule.id} className="bg-white/5 rounded-lg p-4">
                  <div className="font-semibold">{rule.rule_name}</div>
                  <div className="text-sm text-gray-400">
                    {rule.start_time} - {rule.end_time}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Days: {rule.days_of_week.split(',').map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][parseInt(d)]).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
