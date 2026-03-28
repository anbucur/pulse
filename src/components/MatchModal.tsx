import React, { useEffect } from 'react';
import { Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

interface Profile {
  uid: string;
  displayName: string;
  photoURL: string;
}

interface MatchModalProps {
  myProfile: Profile;
  matchedProfile: Profile;
  onClose: () => void;
}

export default function MatchModal({ myProfile, matchedProfile, onClose }: MatchModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Auto-close after 8 seconds
  useEffect(() => {
    const t = setTimeout(onClose, 8000);
    return () => clearTimeout(t);
  }, [onClose]);

  const openChat = async () => {
    if (!user) return;
    try {
      const snap = await getDocs(
        query(collection(db, 'chats'), where('participants', 'array-contains', user.uid))
      );
      const chatDoc = snap.docs.find(d => {
        const parts = d.data().participants as string[];
        return parts.includes(matchedProfile.uid);
      });
      if (chatDoc) {
        onClose();
        navigate(`/chat/${chatDoc.id}`);
      }
    } catch (e) {
      console.error('Error opening match chat:', e);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center p-4"
      style={{ background: 'radial-gradient(circle at center, rgba(244,63,94,0.3) 0%, rgba(0,0,0,0.95) 70%)' }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col items-center text-center max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sparkle background */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-rose-400 rounded-full animate-ping"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1 + Math.random()}s`,
              }}
            />
          ))}
        </div>

        <div className="text-rose-400 text-5xl font-black mb-2 animate-bounce">It's a Match!</div>
        <p className="text-zinc-300 text-sm mb-8">You and {matchedProfile.displayName} liked each other</p>

        {/* Photos */}
        <div className="flex items-center justify-center space-x-4 mb-8">
          <div className="relative">
            <img
              src={myProfile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${myProfile.uid}`}
              alt={myProfile.displayName}
              className="w-28 h-28 rounded-full object-cover border-4 border-rose-500 shadow-lg shadow-rose-500/30"
            />
          </div>
          <Heart className="w-8 h-8 text-rose-500 fill-rose-500 animate-pulse flex-shrink-0" />
          <div className="relative">
            <img
              src={matchedProfile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${matchedProfile.uid}`}
              alt={matchedProfile.displayName}
              className="w-28 h-28 rounded-full object-cover border-4 border-rose-500 shadow-lg shadow-rose-500/30"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-3 w-full">
          <button
            onClick={openChat}
            className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold transition-colors"
          >
            Send a Message
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-2xl font-bold transition-colors"
          >
            Keep Browsing
          </button>
        </div>
      </div>
    </div>
  );
}
