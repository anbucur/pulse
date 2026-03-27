/// <reference types="vite/client" />
import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CalendarDays, MapPin, Plus, Users, X, Loader2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { formatDistanceToNow } from 'date-fns';

// Fix leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Event {
  id: string;
  creatorUid: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  date: number;
  attendees: string[];
}

export default function Events() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userLat, setUserLat] = useState(37.7749);
  const [userLng, setUserLng] = useState(-122.4194);
  const [form, setForm] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    lat: '',
    lng: '',
  });

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setForm(f => ({ ...f, lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) }));
      },
      () => {}
    );

    const q = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Event)));
    });
    return () => unsub();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.title || !form.date) return;
    setSubmitting(true);
    try {
      const dateTimestamp = new Date(`${form.date}T${form.time || '20:00'}`).getTime();
      await addDoc(collection(db, 'events'), {
        creatorUid: user.uid,
        title: form.title,
        description: form.description,
        lat: parseFloat(form.lat) || userLat,
        lng: parseFloat(form.lng) || userLng,
        date: dateTimestamp,
        attendees: [user.uid],
      });
      setShowCreate(false);
      setForm({ title: '', description: '', date: '', time: '', lat: String(userLat), lng: String(userLng) });
    } catch (err) {
      console.error('Error creating event', err);
      alert('Failed to create event.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRSVP = async (eventId: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'events', eventId), {
        attendees: arrayUnion(user.uid)
      });
    } catch (err) {
      console.error('Error RSVPing', err);
    }
  };

  const upcomingEvents = events.filter(e => e.date >= Date.now() - 3600000);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 p-4">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center">
            <CalendarDays className="w-6 h-6 mr-2 text-rose-500" /> Events
          </h1>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode(v => v === 'list' ? 'map' : 'list')}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-full text-sm text-zinc-300 transition-colors"
            >
              {viewMode === 'list' ? '🗺 Map' : '📋 List'}
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4 mr-1" /> Create
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="p-4 space-y-4">
          {upcomingEvents.length === 0 ? (
            <div className="text-center py-16 text-zinc-500">
              <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No upcoming events.</p>
              <button onClick={() => setShowCreate(true)} className="mt-4 px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-sm font-medium transition-colors">
                Create the first one!
              </button>
            </div>
          ) : (
            upcomingEvents.map(event => {
              const isAttending = event.attendees?.includes(user?.uid || '');
              return (
                <div key={event.id} className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white mb-1">{event.title}</h3>
                      {event.description && <p className="text-zinc-400 text-sm mb-3">{event.description}</p>}
                      <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                        <span className="flex items-center">
                          <CalendarDays className="w-3.5 h-3.5 mr-1 text-rose-500" />
                          {new Date(event.date).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="flex items-center">
                          <MapPin className="w-3.5 h-3.5 mr-1 text-rose-500" />
                          {event.lat.toFixed(3)}, {event.lng.toFixed(3)}
                        </span>
                        <span className="flex items-center">
                          <Users className="w-3.5 h-3.5 mr-1 text-rose-500" />
                          {event.attendees?.length || 0} attending
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => !isAttending && handleRSVP(event.id)}
                      disabled={isAttending}
                      className={`ml-4 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex-shrink-0 ${
                        isAttending
                          ? 'bg-green-500/20 text-green-500 cursor-default'
                          : 'bg-rose-600 hover:bg-rose-700 text-white'
                      }`}
                    >
                      {isAttending ? '✓ Going' : 'RSVP'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div style={{ height: 'calc(100vh - 130px)' }}>
          <MapContainer center={[userLat, userLng]} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            />
            {upcomingEvents.map(event => (
              <Marker key={event.id} position={[event.lat, event.lng]}>
                <Popup>
                  <div className="text-sm">
                    <strong>{event.title}</strong><br />
                    {new Date(event.date).toLocaleDateString()}<br />
                    {event.attendees?.length || 0} attending
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}

      {/* Create Event Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 w-full max-w-md rounded-3xl p-6 border border-zinc-800 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-white">Create Event</h2>
              <button onClick={() => setShowCreate(false)} className="p-2 bg-zinc-800 rounded-full text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Event Title *</label>
                <input
                  required
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Community Mixer, Hike, etc."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="What's the vibe?"
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Date *</label>
                  <input
                    required
                    type="date"
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Time</label>
                  <input
                    type="time"
                    value={form.time}
                    onChange={e => setForm({ ...form, time: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={form.lat}
                    onChange={e => setForm({ ...form, lat: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={form.lng}
                    onChange={e => setForm({ ...form, lng: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {submitting ? <Loader2 className="animate-spin w-5 h-5" /> : 'Create Event'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
