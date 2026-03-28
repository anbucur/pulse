import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, getDocs, doc, setDoc, deleteDoc, updateDoc, addDoc, documentId } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Pin, PinOff, Check, X, MessageCircle } from 'lucide-react';

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

interface ChatRequest {
  id: string;
  from: string;
  to: string;
  status: string;
  createdAt: number;
  fromProfile?: any;
}

export default function ChatList() {
  const { user, blockedUsers } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [pinnedChats, setPinnedChats] = useState<string[]>([]);
  const [chatRequests, setChatRequests] = useState<ChatRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const pinnedUnsub = onSnapshot(collection(db, `pinned_chats/${user.uid}/chats`), (snapshot) => {
      setPinnedChats(snapshot.docs.map(doc => doc.id));
    });

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
    );

    // Batch profile fetching: collect all UIDs and fetch in one query (Firestore max 10 per 'in')
    async function fetchProfilesBatch(uids: string[]): Promise<Record<string, any>> {
      const profileMap: Record<string, any> = {};
      if (uids.length === 0) return profileMap;
      const chunks: string[][] = [];
      for (let i = 0; i < uids.length; i += 10) chunks.push(uids.slice(i, i + 10));
      await Promise.all(chunks.map(async (chunk) => {
        const snap = await getDocs(query(collection(db, 'public_profiles'), where(documentId(), 'in', chunk)));
        snap.docs.forEach(d => { profileMap[d.id] = d.data(); });
      }));
      return profileMap;
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatDocs = snapshot.docs;

      // Collect all other UIDs (excluding blocked)
      const otherUids = chatDocs
        .map(d => d.data().participants.find((id: string) => id !== user.uid))
        .filter((uid): uid is string => !!uid && !blockedUsers.includes(uid));

      const profileMap = await fetchProfilesBatch(otherUids);

      const chats = chatDocs
        .map((chatDoc) => {
          const data = chatDoc.data();
          const otherUid = data.participants.find((id: string) => id !== user.uid);
          if (!otherUid || blockedUsers.includes(otherUid)) return null;
          const otherUser = profileMap[otherUid] || null;
          return { id: chatDoc.id, ...data, otherUser } as Chat;
        })
        .filter(Boolean) as Chat[];

      setChats(chats);
      setLoading(false);
    });

    // Fetch incoming chat requests (pending only) — also batch profile fetch
    const requestsQ = query(
      collection(db, 'chat_requests'),
      where('to', '==', user.uid),
      where('status', '==', 'pending')
    );
    const requestsUnsub = onSnapshot(requestsQ, async (snap) => {
      const fromUids = snap.docs.map(d => d.data().from);
      const profileMap = await fetchProfilesBatch(fromUids);
      const requests = snap.docs.map((d) => {
        const data = d.data();
        const fromProfile = profileMap[data.from] || null;
        return { id: d.id, ...data, fromProfile } as ChatRequest;
      }).filter(r => r.fromProfile);
      setChatRequests(requests);
    });

    return () => {
      unsubscribe();
      pinnedUnsub();
      requestsUnsub();
    };
  }, [user, blockedUsers]);

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

  const acceptRequest = async (request: ChatRequest) => {
    if (!user) return;
    try {
      // Create the actual chat
      const newChatRef = await addDoc(collection(db, 'chats'), {
        participants: [request.from, user.uid],
        updatedAt: Date.now(),
        lastMessage: ''
      });
      // Update request status
      await updateDoc(doc(db, 'chat_requests', request.id), { status: 'accepted', chatId: newChatRef.id });
    } catch (e) {
      console.error('Error accepting request', e);
    }
  };

  const declineRequest = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'chat_requests', requestId), { status: 'declined' });
    } catch (e) {
      console.error('Error declining request', e);
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

      {/* Chat Requests */}
      {chatRequests.length > 0 && (
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3 flex items-center">
            <MessageCircle className="w-4 h-4 mr-2" /> Chat Requests ({chatRequests.length})
          </h2>
          <div className="space-y-3">
            {chatRequests.map(req => (
              <div key={req.id} className="flex items-center p-3 bg-zinc-900 rounded-xl border border-zinc-800">
                <img
                  src={req.fromProfile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.from}`}
                  alt={req.fromProfile?.displayName}
                  className="w-10 h-10 rounded-full object-cover mr-3"
                />
                <div className="flex-1">
                  <p className="font-medium text-white text-sm">{req.fromProfile?.displayName}</p>
                  <p className="text-xs text-zinc-500">Wants to chat</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => acceptRequest(req)}
                    className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full transition-colors"
                    title="Accept"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => declineRequest(req.id)}
                    className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-full transition-colors"
                    title="Decline"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
