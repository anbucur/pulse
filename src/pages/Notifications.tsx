import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell, Heart, MessageCircle, UserPlus, ShieldCheck, Star, Zap,
  Check, CheckCheck, Trash2, Settings
} from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  like: <Heart className="w-5 h-5 text-rose-500" />,
  match: <Star className="w-5 h-5 text-yellow-500" />,
  message: <MessageCircle className="w-5 h-5 text-blue-500" />,
  visit: <UserPlus className="w-5 h-5 text-green-500" />,
  verification: <ShieldCheck className="w-5 h-5 text-purple-500" />,
  vibe: <Zap className="w-5 h-5 text-yellow-400" />,
  reference: <Star className="w-5 h-5 text-orange-500" />,
};

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (e) {
      console.error('Error fetching notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
    } catch (e) {
      console.error('Error marking as read:', e);
    }
  };

  const markAllRead = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.error('Error marking all as read:', e);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (e) {
      console.error('Error deleting notification:', e);
    }
  };

  const handleNotificationClick = (n: Notification) => {
    if (!n.is_read) markAsRead(n.id);
    if (n.data?.chatId) navigate(`/chat/${n.data.chatId}`);
    else if (n.data?.userId) navigate('/');
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
            {unreadCount > 0 && (
              <span className="bg-rose-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                Mark all read
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
          <Bell className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-lg font-medium">No notifications yet</p>
          <p className="text-sm mt-1">When people interact with you, you'll see it here.</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              className={`flex items-start gap-3 p-4 cursor-pointer transition-colors hover:bg-zinc-900 ${
                !n.is_read ? 'bg-zinc-900/50' : ''
              }`}
            >
              <div className="flex-shrink-0 w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center">
                {typeIcons[n.type] || <Bell className="w-5 h-5 text-zinc-400" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <p className={`text-sm ${!n.is_read ? 'font-semibold text-white' : 'text-zinc-300'}`}>
                    {n.title}
                  </p>
                  {!n.is_read && (
                    <div className="w-2 h-2 bg-rose-500 rounded-full flex-shrink-0 mt-1.5 ml-2" />
                  )}
                </div>
                {n.body && (
                  <p className="text-sm text-zinc-400 mt-0.5 line-clamp-2">{n.body}</p>
                )}
                <p className="text-xs text-zinc-500 mt-1">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                className="p-1.5 text-zinc-600 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
