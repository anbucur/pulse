import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Pin, PinOff } from 'lucide-react';

interface Chat {
  id: string;
  participants: string[];
  lastMessage: string;
  updatedAt: number;
  unreadCount?: Record<string, number>;
  otherUser?: {
    uid: string;
    displayName: string;
    photoURL: string;
  };
}

export default function ChatList() {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [pinnedChats, setPinnedChats] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const pinnedUnsub = onSnapshot(collection(db, `pinned_chats/${user.uid}/chats`), (snapshot) => {
      setPinnedChats(snapshot.docs.map(doc => doc.id));
    }, (error) => {
      console.error("Error fetching pinned chats:", error);
    });

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatPromises = snapshot.docs.map(async (chatDoc) => {
        const data = chatDoc.data();
        const otherUid = data.participants.find((id: string) => id !== user.uid);
        
        let otherUser = null;
        if (otherUid) {
          const profileDoc = await getDocs(query(collection(db, 'public_profiles'), where('uid', '==', otherUid)));
          if (!profileDoc.empty) {
            otherUser = profileDoc.docs[0].data();
          }
        }

        return {
          id: chatDoc.id,
          ...data,
          otherUser
        } as Chat;
      });

      const resolvedChats = await Promise.all(chatPromises);
      setChats(resolvedChats);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      pinnedUnsub();
    };
  }, [user]);

  const togglePin = async (e: React.MouseEvent, chatId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;

    try {
      if (pinnedChats.includes(chatId)) {
        await deleteDoc(doc(db, `pinned_chats/${user.uid}/chats`, chatId));
      } else {
        await setDoc(doc(db, `pinned_chats/${user.uid}/chats`, chatId), { pinnedAt: Date.now() });
      }
    } catch (error) {
      console.error("Error toggling pin:", error);
    }
  };

  const sortedChats = [...chats].sort((a, b) => {
    const aPinned = pinnedChats.includes(a.id);
    const bPinned = pinnedChats.includes(b.id);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return b.updatedAt - a.updatedAt;
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 p-4">
        <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
      </div>

      <div className="divide-y divide-zinc-800">
        {loading ? (
          <div className="p-8 text-center text-zinc-500">Loading chats...</div>
        ) : sortedChats.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">No messages yet. Start swiping!</div>
        ) : (
          sortedChats.map((chat) => (
            <Link 
              key={chat.id} 
              to={`/chat/${chat.id}`}
              className={`flex items-center p-4 hover:bg-zinc-900 transition-colors ${pinnedChats.includes(chat.id) ? 'bg-zinc-900/50' : ''}`}
            >
              <div className="relative">
                <img 
                  src={chat.otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.id}`} 
                  alt={chat.otherUser?.displayName || 'User'} 
                  className="w-14 h-14 rounded-full object-cover border border-zinc-800"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-zinc-950 rounded-full"></div>
              </div>
              <div className="ml-4 flex-1 overflow-hidden">
                <div className="flex justify-between items-baseline">
                  <h3 className={`font-semibold truncate ${(chat.unreadCount?.[user?.uid || ''] || 0) > 0 ? 'text-white' : 'text-zinc-100'} flex items-center`}>
                    {chat.otherUser?.displayName || 'Unknown User'}
                    {pinnedChats.includes(chat.id) && <Pin className="w-3 h-3 ml-2 text-rose-500" />}
                  </h3>
                  <span className={`text-xs flex-shrink-0 ml-2 ${(chat.unreadCount?.[user?.uid || ''] || 0) > 0 ? 'text-rose-500 font-medium' : 'text-zinc-500'}`}>
                    {chat.updatedAt ? formatDistanceToNow(chat.updatedAt, { addSuffix: true }) : ''}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-0.5">
                  <p className={`text-sm truncate pr-2 ${(chat.unreadCount?.[user?.uid || ''] || 0) > 0 ? 'text-zinc-200 font-medium' : 'text-zinc-400'}`}>
                    {chat.lastMessage || 'No messages yet'}
                  </p>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {(chat.unreadCount?.[user?.uid || ''] || 0) > 0 && (
                      <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {chat.unreadCount?.[user?.uid || '']}
                      </span>
                    )}
                    <button 
                      onClick={(e) => togglePin(e, chat.id)}
                      className="p-1.5 text-zinc-500 hover:text-rose-500 hover:bg-zinc-800 rounded-full transition-colors"
                      title={pinnedChats.includes(chat.id) ? "Unpin chat" : "Pin chat"}
                    >
                      {pinnedChats.includes(chat.id) ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
