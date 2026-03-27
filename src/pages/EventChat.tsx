import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection, query, orderBy, onSnapshot, addDoc, getDoc, doc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from '../lib/toast';

interface EventMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  senderName?: string;
  senderPhoto?: string;
}

interface EventInfo {
  id: string;
  title: string;
  attendees: string[];
  creatorUid: string;
  date: number;
}

export default function EventChat() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<EventMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);
  const [profileCache, setProfileCache] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch event info
  useEffect(() => {
    if (!eventId) return;
    getDoc(doc(db, 'events', eventId)).then((snap) => {
      if (snap.exists()) {
        setEventInfo({ id: snap.id, ...snap.data() } as EventInfo);
      }
    });
  }, [eventId]);

  // Listen to messages
  useEffect(() => {
    if (!eventId) return;
    const q = query(
      collection(db, `event_chats/${eventId}/messages`),
      orderBy('timestamp', 'asc')
    );
    const unsub = onSnapshot(q, async (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as EventMessage));

      // Fetch sender profiles we don't have cached yet
      const unknownUids = [...new Set(msgs.map(m => m.senderId))].filter(
        uid => !profileCache[uid]
      );
      if (unknownUids.length > 0) {
        const fetched: Record<string, any> = {};
        await Promise.all(unknownUids.map(async (uid) => {
          const pSnap = await getDoc(doc(db, 'public_profiles', uid));
          if (pSnap.exists()) fetched[uid] = pSnap.data();
        }));
        setProfileCache(prev => ({ ...prev, ...fetched }));
      }

      setMessages(msgs);
      setLoading(false);
    });
    return () => unsub();
  }, [eventId]);

  const isAttendee = eventInfo?.attendees?.includes(user?.uid || '');

  const sendMessage = async () => {
    if (!user || !eventId || !newMessage.trim() || !isAttendee) return;
    if (newMessage.trim().length > 1000) {
      toast.error('Message must be 1000 characters or fewer');
      return;
    }
    const text = newMessage.trim();
    setNewMessage('');
    try {
      await addDoc(collection(db, `event_chats/${eventId}/messages`), {
        senderId: user.uid,
        text,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message. Please try again.');
      setNewMessage(text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!eventInfo && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white">
        <p className="text-zinc-400">Event not found.</p>
        <button onClick={() => navigate('/events')} className="mt-4 text-rose-500">Back to Events</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-zinc-900 border-b border-zinc-800 p-4 flex items-center">
        <button onClick={() => navigate(-1)} className="mr-4 p-2 hover:bg-zinc-800 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-zinc-400" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-white truncate">{eventInfo?.title || 'Event Chat'}</h1>
          <p className="text-xs text-zinc-500">{eventInfo?.attendees?.length || 0} attendees</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-rose-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-zinc-500 py-8">
            <p>No messages yet. Be the first to say something!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === user?.uid;
            const sender = profileCache[msg.senderId];
            return (
              <div key={msg.id} className={`flex items-end space-x-2 ${isMe ? 'flex-row-reverse space-x-reverse' : ''}`}>
                {!isMe && (
                  <img
                    src={sender?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderId}`}
                    alt={sender?.displayName}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  />
                )}
                <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                  {!isMe && sender && (
                    <span className="text-xs text-zinc-500 mb-1 ml-1">{sender.displayName}</span>
                  )}
                  <div className={`px-4 py-2 rounded-2xl text-sm ${isMe ? 'bg-rose-600 text-white rounded-br-sm' : 'bg-zinc-800 text-zinc-100 rounded-bl-sm'}`}>
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-zinc-600 mt-1 mx-1">
                    {msg.timestamp ? formatDistanceToNow(msg.timestamp, { addSuffix: true }) : ''}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {isAttendee ? (
        <div className="sticky bottom-0 bg-zinc-900 border-t border-zinc-800 p-3 flex items-center space-x-3">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message the group..."
            maxLength={1000}
            className="flex-1 bg-zinc-800 text-white placeholder-zinc-500 rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim()}
            className="p-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-full transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <div className="sticky bottom-0 bg-zinc-900 border-t border-zinc-800 p-4 text-center">
          <p className="text-zinc-500 text-sm">RSVP to this event to join the group chat</p>
          <button onClick={() => navigate('/events')} className="mt-2 text-rose-500 text-sm">Back to Events</button>
        </div>
      )}
    </div>
  );
}
