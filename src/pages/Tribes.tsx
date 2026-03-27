import React, { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, getDocs, query, where, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Users, X } from 'lucide-react';

const DEFAULT_TRIBES = [
  { id: 'bears', name: 'Bears', emoji: '🐻', description: 'Larger, hairier men and admirers' },
  { id: 'otters', name: 'Otters', emoji: '🦦', description: 'Lean, hairy men' },
  { id: 'jocks', name: 'Jocks', emoji: '🏋️', description: 'Athletic and sporty' },
  { id: 'twinks', name: 'Twinks', emoji: '✨', description: 'Younger, slender men' },
  { id: 'daddies', name: 'Daddies', emoji: '👨', description: 'Older, mature men' },
  { id: 'leather', name: 'Leather', emoji: '🖤', description: 'Leather and kink community' },
  { id: 'pups', name: 'Pups', emoji: '🐶', description: 'Pup play community' },
  { id: 'cubs', name: 'Cubs', emoji: '🐾', description: 'Younger bears' },
];

interface Tribe {
  id: string;
  name: string;
  emoji: string;
  description: string;
  members: string[];
}

export default function Tribes() {
  const { user } = useAuth();
  const [tribes, setTribes] = useState<Tribe[]>([]);
  const [selectedTribe, setSelectedTribe] = useState<Tribe | null>(null);
  const [tribeMembers, setTribeMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    // Ensure default tribes exist
    const ensureDefaultTribes = async () => {
      for (const t of DEFAULT_TRIBES) {
        const tribeRef = doc(db, 'tribes', t.id);
        await setDoc(tribeRef, { name: t.name, description: t.description, emoji: t.emoji, members: [] }, { merge: true });
      }
    };
    ensureDefaultTribes();

    const unsub = onSnapshot(collection(db, 'tribes'), (snap) => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as Tribe));
      // Sort: defaults first
      const defaultOrder = DEFAULT_TRIBES.map(t => t.id);
      fetched.sort((a, b) => {
        const ai = defaultOrder.indexOf(a.id);
        const bi = defaultOrder.indexOf(b.id);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
      setTribes(fetched);
    });
    return () => unsub();
  }, []);

  const openTribe = async (tribe: Tribe) => {
    setSelectedTribe(tribe);
    setLoadingMembers(true);
    try {
      if (!tribe.members || tribe.members.length === 0) {
        setTribeMembers([]);
        return;
      }
      const profiles = await Promise.all(
        tribe.members.slice(0, 30).map(async uid => {
          const snap = await getDocs(query(collection(db, 'public_profiles'), where('uid', '==', uid)));
          return snap.empty ? null : snap.docs[0].data();
        })
      );
      setTribeMembers(profiles.filter(Boolean));
    } catch (e) {
      console.error('Error fetching tribe members', e);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleJoin = async (tribeId: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'tribes', tribeId), { members: arrayUnion(user.uid) });
      await updateDoc(doc(db, 'public_profiles', user.uid), { tribes: arrayUnion(tribeId) });
    } catch (e) {
      console.error('Error joining tribe', e);
    }
  };

  const handleLeave = async (tribeId: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'tribes', tribeId), { members: arrayRemove(user.uid) });
      await updateDoc(doc(db, 'public_profiles', user.uid), { tribes: arrayRemove(tribeId) });
    } catch (e) {
      console.error('Error leaving tribe', e);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 p-4">
        <h1 className="text-2xl font-bold tracking-tight flex items-center">
          <Users className="w-6 h-6 mr-2 text-rose-500" /> Tribes
        </h1>
        <p className="text-xs text-zinc-500 mt-1">Find your community. Join tribes to connect with your people.</p>
      </div>

      <div className="p-4 grid grid-cols-2 gap-3">
        {tribes.map(tribe => {
          const isMember = tribe.members?.includes(user?.uid || '');
          const defaultTribe = DEFAULT_TRIBES.find(d => d.id === tribe.id);
          return (
            <div
              key={tribe.id}
              onClick={() => openTribe(tribe)}
              className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors"
            >
              <div className="text-3xl mb-2">{defaultTribe?.emoji || '🏳️‍🌈'}</div>
              <h3 className="font-bold text-white mb-0.5">{tribe.name}</h3>
              <p className="text-xs text-zinc-500 mb-3 line-clamp-2">{tribe.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 flex items-center">
                  <Users className="w-3 h-3 mr-1" /> {tribe.members?.length || 0}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    isMember ? handleLeave(tribe.id) : handleJoin(tribe.id);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    isMember
                      ? 'bg-rose-500/20 text-rose-500 hover:bg-rose-500/30'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {isMember ? 'Leave' : 'Join'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tribe Detail Modal */}
      {selectedTribe && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 w-full max-w-md rounded-3xl border border-zinc-800 max-h-[85vh] overflow-y-auto">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="text-2xl">{DEFAULT_TRIBES.find(d => d.id === selectedTribe.id)?.emoji || '🏳️‍🌈'}</span>
                  {selectedTribe.name}
                </h2>
                <p className="text-sm text-zinc-400 mt-1">{selectedTribe.description}</p>
                <p className="text-xs text-zinc-500 mt-1">{selectedTribe.members?.length || 0} members</p>
              </div>
              <button onClick={() => setSelectedTribe(null)} className="p-2 bg-zinc-800 rounded-full text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              {/* Join/Leave button */}
              <button
                onClick={() => {
                  const isMember = selectedTribe.members?.includes(user?.uid || '');
                  isMember ? handleLeave(selectedTribe.id) : handleJoin(selectedTribe.id);
                }}
                className={`w-full py-3 rounded-xl font-bold mb-4 transition-colors ${
                  selectedTribe.members?.includes(user?.uid || '')
                    ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                }`}
              >
                {selectedTribe.members?.includes(user?.uid || '') ? 'Leave Tribe' : 'Join Tribe'}
              </button>

              <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Members</h3>
              {loadingMembers ? (
                <div className="text-center py-8 text-zinc-500">Loading members...</div>
              ) : tribeMembers.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No members yet. Be the first to join!</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {tribeMembers.map((m: any) => (
                    <div key={m.uid} className="flex flex-col items-center text-center">
                      <img
                        src={m.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.uid}`}
                        alt={m.displayName}
                        className="w-14 h-14 rounded-full object-cover border border-zinc-700 mb-1"
                      />
                      <p className="text-xs text-zinc-300 font-medium truncate w-full">{m.displayName}</p>
                      <p className="text-[10px] text-zinc-500">{m.age}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
