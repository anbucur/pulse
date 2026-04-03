import React, { useState } from 'react';
import { Shield, CheckCircle, XCircle, Clock, Send, Plus, Trash2 } from 'lucide-react';

interface Boundary {
  category: string;
  items: string[];
}

interface ConsentData {
  boundaries?: Record<string, string[]>;
  safeWords?: string[];
  checkInFrequency?: string;
  firstMeetingPreference?: string;
  meetingConstraints?: string[];
  stdStatus?: string;
  lastTestDate?: string;
  birthControl?: string;
  protectionRequired?: boolean;
}

interface ConsentProtocolProps {
  targetUserId: string;
  targetUserName?: string;
}

export default function ConsentProtocol({ targetUserId, targetUserName = 'This person' }: ConsentProtocolProps) {
  const [step, setStep] = useState<'create' | 'review' | 'sent'>('create');
  const [consentData, setConsentData] = useState<ConsentData>({
    boundaries: {
      physical: [],
      sexual: [],
      emotional: [],
      communication: [],
    },
    safeWords: [],
    checkInFrequency: 'sometimes',
    firstMeetingPreference: 'public',
    meetingConstraints: [],
    stdStatus: null,
    lastTestDate: null,
    birthControl: null,
    protectionRequired: true,
  });

  const [newItem, setNewItem] = useState<{ category: string; item: string }>({ category: 'physical', item: '' });

  const boundaryCategories: Array<{ key: string; label: string; placeholder: string }> = [
    { key: 'physical', label: 'Physical Boundaries', placeholder: 'e.g., no kissing on first date' },
    { key: 'sexual', label: 'Sexual Boundaries', placeholder: 'e.g., protected sex only' },
    { key: 'emotional', label: 'Emotional Boundaries', placeholder: 'e.g., need alone time after intimacy' },
    { key: 'communication', label: 'Communication Preferences', placeholder: 'e.g., text vs call preferences' },
  ];

  const addBoundaryItem = () => {
    if (!newItem.item.trim()) return;

    setConsentData({
      ...consentData,
      boundaries: {
        ...consentData.boundaries,
        [newItem.category]: [
          ...(consentData.boundaries?.[newItem.category] || []),
          newItem.item.trim(),
        ],
      },
    });

    setNewItem({ ...newItem, item: '' });
  };

  const removeBoundaryItem = (category: string, index: number) => {
    setConsentData({
      ...consentData,
      boundaries: {
        ...consentData.boundaries,
        [category]: (consentData.boundaries?.[category] || []).filter((_, i) => i !== index),
      },
    });
  };

  const addSafeWord = () => {
    // Simple prompt for demo - in production, use a proper modal
    const word = prompt('Enter safe word:');
    if (word?.trim()) {
      setConsentData({
        ...consentData,
        safeWords: [...(consentData.safeWords || []), word.trim()],
      });
    }
  };

  const removeSafeWord = (index: number) => {
    setConsentData({
      ...consentData,
      safeWords: consentData.safeWords?.filter((_, i) => i !== index) || [],
    });
  };

  const handleSubmit = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/features/consent/${targetUserId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(consentData),
      });

      if (response.ok) {
        setStep('sent');
      }
    } catch (error) {
      console.error('Error sending consent protocol:', error);
      alert('Failed to send consent protocol');
    }
  };

  if (step === 'sent') {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <div className="text-center">
          <Send className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Consent Protocol Sent!</h3>
          <p className="text-gray-400">
            Your consent protocol has been shared with {targetUserName}. They can review and accept it before you meet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Shield className="w-5 h-5 text-green-500" />
          Consent Protocol
        </h3>
        <p className="text-sm text-gray-400 mt-1">
          Establish clear boundaries with {targetUserName} before meeting
        </p>
      </div>

      {/* Boundaries */}
      <div className="space-y-4">
        <h4 className="font-semibold">Boundaries</h4>

        {boundaryCategories.map((category) => (
          <div key={category.key} className="bg-black/20 rounded-lg p-4">
            <h5 className="text-sm font-medium mb-2">{category.label}</h5>

            <ul className="space-y-1 mb-3">
              {(consentData.boundaries?.[category.key] || []).map((item, i) => (
                <li key={i} className="text-sm flex items-center justify-between gap-2 bg-black/20 px-3 py-1 rounded">
                  {item}
                  <button onClick={() => removeBoundaryItem(category.key, i)}>
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex gap-2">
              <select
                value={newItem.category}
                onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                className="px-3 py-1 rounded bg-white/10 text-sm flex-1"
              >
                {boundaryCategories.map((cat) => (
                  <option key={cat.key} value={cat.key}>
                    {cat.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={newItem.category === category.key ? newItem.item : ''}
                onChange={(e) => setNewItem({ category: category.key, item: e.target.value })}
                placeholder={category.placeholder}
                className="flex-1 px-3 py-1 rounded bg-white/10 text-sm"
              />
              <button onClick={addBoundaryItem} className="px-3 py-1 bg-purple-500 rounded">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Safe Words */}
      <div>
        <h4 className="font-semibold mb-2">Safe Words</h4>
        <div className="flex flex-wrap gap-2 mb-2">
          {(consentData.safeWords || []).map((word, i) => (
            <span key={i} className="px-3 py-1 bg-red-500/30 rounded-full text-sm flex items-center gap-2">
              {word}
              <button onClick={() => removeSafeWord(i)}>
                <XCircle className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <button onClick={addSafeWord} className="text-sm text-purple-400 hover:text-purple-300">
          + Add Safe Word
        </button>
      </div>

      {/* Meeting Preferences */}
      <div className="space-y-4">
        <h4 className="font-semibold">Meeting Preferences</h4>

        <div>
          <label className="block text-sm text-gray-400 mb-1">First Meeting</label>
          <select
            value={consentData.firstMeetingPreference}
            onChange={(e) => setConsentData({ ...consentData, firstMeetingPreference: e.target.value })}
            className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20"
          >
            <option value="public">Public Place</option>
            <option value="private">Private Setting</option>
            <option value="video">Video Call First</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Check-in Frequency</label>
          <select
            value={consentData.checkInFrequency}
            onChange={(e) => setConsentData({ ...consentData, checkInFrequency: e.target.value })}
            className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20"
          >
            <option value="always">Always Check In</option>
            <option value="sometimes">Sometimes</option>
            <option value="rarely">Rarely</option>
          </select>
        </div>
      </div>

      {/* Health & Safety */}
      <div className="space-y-4">
        <h4 className="font-semibold">Health & Safety</h4>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Recent STD Test</label>
          <input
            type="date"
            value={consentData.lastTestDate || ''}
            onChange={(e) => setConsentData({ ...consentData, lastTestDate: e.target.value })}
            className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Birth Control</label>
          <input
            type="text"
            value={consentData.birthControl || ''}
            onChange={(e) => setConsentData({ ...consentData, birthControl: e.target.value })}
            placeholder="e.g., on pill, using condoms"
            className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="protection"
            checked={consentData.protectionRequired}
            onChange={(e) => setConsentData({ ...consentData, protectionRequired: e.target.checked })}
            className="w-4 h-4"
          />
          <label htmlFor="protection" className="text-sm">Protection required</label>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-lg transition flex items-center justify-center gap-2 font-semibold"
      >
        <Send className="w-5 h-5" />
        Share Consent Protocol
      </button>
    </div>
  );
}
