/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  MessageCircle,
  Heart,
  Lightbulb,
  ChevronRight,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Send,
  Copy,
  Check,
  X,
} from 'lucide-react';

interface ConversationStarter {
  id: string;
  match_id: number;
  shared_interests: string[];
  conversation_prompts: string[];
  fun_questions: string[];
  deep_questions: string[];
  compatibility_insights: string[];
  generated_at: string;
}

interface Feedback {
  id: string;
  convo_starter_id: string;
  starter_type: string;
  starter_text: string;
  feedback_type: string;
  rating: number;
  led_to_conversation: boolean;
  created_at: string;
}

interface AIConvoStartersProps {
  matchId: number;
  onSendMessage?: (message: string) => void;
}

export default function AIConvoStarters({ matchId, onSendMessage }: AIConvoStartersProps) {
  const [starters, setStarters] = useState<ConversationStarter | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'prompts' | 'fun' | 'deep' | 'insights'>('prompts');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedStarter, setSelectedStarter] = useState<{ type: string; text: string } | null>(null);

  useEffect(() => {
    fetchStarters();
  }, [matchId]);

  const fetchStarters = async () => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/convo-starters/match/${matchId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate conversation starters');
      }

      const data = await response.json();
      setStarters(data);
      await fetchFeedbacks(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchFeedbacks = async (starterId: string) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/convo-starters/feedback/${starterId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setFeedbacks(data);
      }
    } catch {
      // Silent fail
    }
  };

  const refreshStarters = async () => {
    setRefreshing(true);
    await fetchStarters();
    setRefreshing(false);
  };

  const handleUseStarter = (text: string, type: string) => {
    if (onSendMessage) {
      onSendMessage(text);
      setSelectedStarter({ type, text });
      setShowFeedbackModal(true);
    } else {
      copyToClipboard(text);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 2000);
    } catch {
      // Clipboard not available
    }
  };

  const submitFeedback = async (feedbackType: string, rating?: number) => {
    if (!starters || !selectedStarter) return;

    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/convo-starters/feedback/${starters.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          starter_type: selectedStarter.type,
          starter_text: selectedStarter.text,
          feedback_type: feedbackType,
          rating,
          led_to_conversation: feedbackType === 'used',
        }),
      });

      await fetchFeedbacks(starters.id);
      setShowFeedbackModal(false);
      setSelectedStarter(null);
    } catch {
      // Silent fail
    }
  };

  const getStarterFeedback = (type: string, text: string) => {
    return feedbacks.find(
      f => f.starter_type === type && f.starter_text === text
    );
  };

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-pink-500 border-t-transparent"></div>
        <p className="mt-4 text-gray-400">Generating conversation starters...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
        <Sparkles className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400 mb-4">{error}</p>
        <button
          onClick={refreshStarters}
          className="px-4 py-2 bg-pink-500 hover:bg-pink-600 rounded-lg transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!starters) {
    return null;
  }

  const tabs = [
    { id: 'prompts' as const, label: 'Conversation Starters', icon: MessageCircle },
    { id: 'fun' as const, label: 'Fun Questions', icon: Lightbulb },
    { id: 'deep' as const, label: 'Deep Questions', icon: Heart },
    { id: 'insights' as const, label: 'Compatibility', icon: Sparkles },
  ];

  const getStartersForTab = () => {
    switch (selectedTab) {
      case 'prompts':
        return starters.conversation_prompts;
      case 'fun':
        return starters.fun_questions;
      case 'deep':
        return starters.deep_questions;
      case 'insights':
        return starters.compatibility_insights;
      default:
        return [];
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-pink-500" />
            AI Conversation Starters
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Personalized icebreakers to kickstart your conversation
          </p>
        </div>
        <button
          onClick={refreshStarters}
          disabled={refreshing}
          className="p-2 hover:bg-white/10 rounded-lg transition"
          title="Refresh starters"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Shared Interests Badge */}
      {starters.shared_interests && starters.shared_interests.length > 0 && (
        <div className="mb-4 p-3 bg-pink-500/10 border border-pink-500/30 rounded-lg">
          <p className="text-sm text-pink-300">
            <Heart className="w-4 h-4 inline mr-1" />
            You both like: {starters.shared_interests.join(', ')}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition flex items-center gap-2 ${
                selectedTab === tab.id
                  ? 'bg-pink-500 text-white'
                  : 'bg-white/5 hover:bg-white/10 text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="space-y-3">
        {getStartersForTab().map((starter, index) => {
          const feedback = getStarterFeedback(selectedTab, starter);
          return (
            <div
              key={index}
              className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition group"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-gray-200 flex-1">{starter}</p>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                  {selectedTab !== 'insights' && (
                    <>
                      <button
                        onClick={() => handleUseStarter(starter, selectedTab)}
                        className="p-2 hover:bg-pink-500/20 rounded-lg transition"
                        title="Send message"
                      >
                        <Send className="w-4 h-4 text-pink-400" />
                      </button>
                      <button
                        onClick={() => copyToClipboard(starter)}
                        className="p-2 hover:bg-white/10 rounded-lg transition"
                        title="Copy to clipboard"
                      >
                        {copiedText === starter ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Feedback indicators */}
              {feedback && (
                <div className="mt-2 flex items-center gap-2">
                  {feedback.feedback_type === 'used' && feedback.led_to_conversation && (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Led to conversation
                    </span>
                  )}
                  {feedback.rating && (
                    <span className="text-xs text-yellow-400">
                      {'★'.repeat(feedback.rating)}{'☆'.repeat(5 - feedback.rating)}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {getStartersForTab().length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No starters available for this category</p>
          </div>
        )}
      </div>

      {/* Feedback Modal */}
      {showFeedbackModal && selectedStarter && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Was this helpful?</h3>
            <p className="text-gray-400 mb-6">"{selectedStarter.text}"</p>

            <div className="space-y-3">
              <button
                onClick={() => submitFeedback('used', 5)}
                className="w-full px-4 py-3 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded-lg transition flex items-center gap-3"
              >
                <ThumbsUp className="w-5 h-5 text-green-400" />
                <span>Yes, it started a conversation!</span>
              </button>

              <button
                onClick={() => submitFeedback('helpful', 4)}
                className="w-full px-4 py-3 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded-lg transition flex items-center gap-3"
              >
                <ThumbsUp className="w-5 h-5 text-blue-400" />
                <span>Helpful, but haven't used it yet</span>
              </button>

              <button
                onClick={() => submitFeedback('not_helpful', 2)}
                className="w-full px-4 py-3 bg-gray-500/20 hover:bg-gray-500/30 border border-gray-500/50 rounded-lg transition flex items-center gap-3"
              >
                <ThumbsDown className="w-5 h-5 text-gray-400" />
                <span>Not really for me</span>
              </button>

              <button
                onClick={() => {
                  setShowFeedbackModal(false);
                  setSelectedStarter(null);
                }}
                className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 rounded-lg transition"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timestamp */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <p className="text-xs text-gray-500">
          Generated {new Date(starters.generated_at).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
