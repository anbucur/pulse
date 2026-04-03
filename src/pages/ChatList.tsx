import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Pin, PinOff } from 'lucide-react';

interface ChatRoom {
  id: string;
  participants: string[];
  other_users: Array<{
    userId: string;
    displayName: string;
    photo: string | null;
  }>;
  last_message_at: string;
  last_message_text?: string;
  unread_counts: Record<string, number>;
}

export default function ChatList() {
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchChats();
  }, [user]);

  const fetchChats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/chat/rooms', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setChats(data);
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOtherUser = (chat: ChatRoom) => {
    return chat.other_users?.[0] || null;
  };

  const getUnreadCount = (chat: ChatRoom) => {
    if (!user || !chat.unread_counts) return 0;
    return chat.unread_counts[user.id] || 0;
  };

  const getLastMessage = (chat: ChatRoom) => {
    return chat.last_message_text || 'No messages yet';
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 p-4">
        <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
      </div>

      <div className="divide-y divide-zinc-800">
        {loading ? (
          <div className="p-8 text-center text-zinc-500">Loading chats...</div>
        ) : chats.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">No messages yet. Start swiping!</div>
        ) : (
          chats.map((chat) => {
            const otherUser = getOtherUser(chat);
            const unreadCount = getUnreadCount(chat);
            return (
              <Link
                key={chat.id}
                to={`/chat/${chat.id}`}
                className="flex items-center p-4 hover:bg-zinc-900 transition-colors"
              >
                <div className="relative">
                  <img
                    src={otherUser?.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.id}`}
                    alt={otherUser?.displayName || 'User'}
                    className="w-14 h-14 rounded-full object-cover border border-zinc-800"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-zinc-950 rounded-full"></div>
                </div>
                <div className="ml-4 flex-1 overflow-hidden">
                  <div className="flex justify-between items-baseline">
                    <h3 className={`font-semibold truncate ${unreadCount > 0 ? 'text-white' : 'text-zinc-100'}`}>
                      {otherUser?.displayName || 'Unknown User'}
                    </h3>
                    <span className={`text-xs flex-shrink-0 ml-2 ${unreadCount > 0 ? 'text-rose-500 font-medium' : 'text-zinc-500'}`}>
                      {chat.last_message_at ? formatDistanceToNow(new Date(chat.last_message_at), { addSuffix: true }) : ''}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-0.5">
                    <p className={`text-sm truncate pr-2 ${unreadCount > 0 ? 'text-zinc-200 font-medium' : 'text-zinc-400'}`}>
                      {getLastMessage(chat)}
                    </p>
                    {unreadCount > 0 && (
                      <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
