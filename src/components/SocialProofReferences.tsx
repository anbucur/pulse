import React, { useState, useEffect } from 'react';
import { Star, MessageCircle, Award, ThumbsUp, Send, CheckCircle, User, UserPlus, Filter } from 'lucide-react';

interface SocialReference {
  id: string;
  from_user_id: string;
  about_user_id: string;
  reference_type: string;
  interaction_date: string;
  is_anonymous: boolean;
  respect_rating: number;
  communication_rating: number;
  safety_rating: number;
  satisfaction_rating: number;
  overall_rating: number;
  would_meet_again: boolean;
  feedback: string;
  strengths: string[];
  areas_for_improvement: string[];
  flags: string[];
  is_mutual: boolean;
  created_at: string;
  from_user_name?: string;
  about_user_name?: string;
}

interface SocialProofReferencesProps {
  userId?: string;
  mode?: 'view' | 'create';
}

export default function SocialProofReferences({ userId, mode = 'view' }: SocialProofReferencesProps) {
  const [references, setReferences] = useState<SocialReference[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [filter, setFilter] = useState<string>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [newReference, setNewReference] = useState({
    referenceType: 'date',
    interactionDate: '',
    isAnonymous: true,
    respectRating: 5,
    communicationRating: 5,
    safetyRating: 5,
    satisfactionRating: 5,
    overallRating: 5,
    wouldMeetAgain: true,
    feedback: '',
    strengths: [] as string[],
    areasForImprovement: [] as string[],
    flags: [] as string[],
  });

  const [newStrength, setNewStrength] = useState('');
  const [newImprovement, setNewImprovement] = useState('');

  useEffect(() => {
    fetchReferences();
    fetchSummary();
  }, [userId]);

  const fetchReferences = async () => {
    const targetUserId = userId || localStorage.getItem('userId');
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/features/reference/${targetUserId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setReferences(data);
      }
    } catch (error) {
      console.error('Error fetching references:', error);
    }
  };

  const fetchSummary = async () => {
    const targetUserId = userId || localStorage.getItem('userId');
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/features/reference/${targetUserId}/summary`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  const createReference = async () => {
    const targetUserId = userId || localStorage.getItem('userId');
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/features/reference/${targetUserId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...newReference,
          interactionDate: newReference.interactionDate ? new Date(newReference.interactionDate).toISOString() : null,
        }),
      });

      if (response.ok) {
        setShowCreateForm(false);
        fetchReferences();
        fetchSummary();
      }
    } catch (error) {
      console.error('Error creating reference:', error);
    }
  };

  const addStrength = () => {
    if (newStrength.trim()) {
      setNewReference({
        ...newReference,
        strengths: [...newReference.strengths, newStrength.trim()],
      });
      setNewStrength('');
    }
  };

  const addImprovement = () => {
    if (newImprovement.trim()) {
      setNewReference({
        ...newReference,
        areas_for_improvement: [...newReference.areasForImprovement, newImprovement.trim()],
      });
      setNewImprovement('');
    }
  };

  const filteredReferences = references.filter(ref => {
    if (filter === 'all') return true;
    return ref.reference_type === filter;
  });

  const referenceTypes = ['date', 'hookup', 'friendship', 'professional'];

  const renderStars = (rating: number) => {
    return Array(5).fill(0).map((_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'}`}
      />
    ));
  };

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-500" />
            Social Proof References
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Anonymous post-date references from real interactions
          </p>
        </div>

        {mode === 'create' && !userId && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 rounded-lg transition flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Give Reference
          </button>
        )}
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-black/20 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-yellow-400">{summary.total_references || 0}</p>
            <p className="text-sm text-gray-400">References</p>
          </div>
          <div className="bg-black/20 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-green-400">
              {summary.average_rating ? summary.average_rating.toFixed(1) : '-'}
            </p>
            <p className="text-sm text-gray-400">Average Rating</p>
          </div>
          <div className="bg-black/20 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-blue-400">
              {summary.would_meet_again_count || 0}
            </p>
            <p className="text-sm text-gray-400">Would Meet Again</p>
          </div>
          <div className="bg-black/20 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-purple-400">
              {summary.reference_types?.length || 0}
            </p>
            <p className="text-sm text-gray-400">Reference Types</p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-full whitespace-nowrap transition ${
            filter === 'all' ? 'bg-pink-500' : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          All ({references.length})
        </button>
        {referenceTypes.map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-4 py-2 rounded-full whitespace-nowrap capitalize transition ${
              filter === type ? 'bg-pink-500' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            {type} ({references.filter(r => r.reference_type === type).length})
          </button>
        ))}
      </div>

      {/* Create Reference Form */}
      {showCreateForm && (
        <div className="bg-black/20 rounded-lg p-4 space-y-4">
          <h4 className="font-semibold">Give a Reference</h4>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Interaction Type</label>
              <select
                value={newReference.referenceType}
                onChange={(e) => setNewReference({ ...newReference, referenceType: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20"
              >
                {referenceTypes.map(type => (
                  <option key={type} value={type} className="capitalize">
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Interaction Date</label>
              <input
                type="date"
                value={newReference.interactionDate}
                onChange={(e) => setNewReference({ ...newReference, interactionDate: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20"
              />
            </div>
          </div>

          {/* Ratings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Respect</label>
              <div className="flex gap-1">{renderStars(newReference.respectRating)}</div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Communication</label>
              <div className="flex gap-1">{renderStars(newReference.communicationRating)}</div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Safety</label>
              <div className="flex gap-1">{renderStars(newReference.safetyRating)}</div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Satisfaction</label>
              <div className="flex gap-1">{renderStars(newReference.satisfactionRating)}</div>
            </div>
          </div>

          {/* Overall Rating */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Overall Rating</label>
            <input
              type="range"
              min="1"
              max="5"
              value={newReference.overallRating}
              onChange={(e) => setNewReference({ ...newReference, overallRating: parseInt(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Poor</span>
              <span className="text-xl font-bold">{newReference.overallRating}</span>
              <span>Excellent</span>
            </div>
          </div>

          {/* Would Meet Again */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="wouldMeetAgain"
              checked={newReference.wouldMeetAgain}
              onChange={(e) => setNewReference({ ...newReference, wouldMeetAgain: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="wouldMeetAgain" className="flex items-center gap-2">
              <ThumbsUp className="w-4 h-4" />
              I would meet this person again
            </label>
          </div>

          {/* Feedback */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Feedback</label>
            <textarea
              value={newReference.feedback}
              onChange={(e) => setNewReference({ ...newReference, feedback: e.target.value })}
              placeholder="Share your experience..."
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 resize-none"
              rows={3}
              maxLength={1000}
            />
          </div>

          {/* Strengths */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Strengths</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newStrength}
                onChange={(e) => setNewStrength(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addStrength())}
                placeholder="e.g., great listener"
                className="flex-1 px-4 py-2 rounded-lg bg-white/10 border border-white/20"
              />
              <button
                onClick={addStrength}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {newReference.strengths.map((strength, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-green-500/30 rounded-full text-sm flex items-center gap-2"
                >
                  {strength}
                  <button onClick={() => setNewReference({
                    ...newReference,
                    strengths: newReference.strengths.filter((_, idx) => idx !== i)
                  })}>
                    <XCircle className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Areas for Improvement */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Areas for Improvement</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newImprovement}
                onChange={(e) => setNewImprovement(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addImprovement())}
                placeholder="Constructive feedback..."
                className="flex-1 px-4 py-2 rounded-lg bg-white/10 border border-white/20"
              />
              <button
                onClick={addImprovement}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {newReference.areas_for_improvement.map((improvement, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-blue-500/30 rounded-full text-sm flex items-center gap-2"
                >
                  {improvement}
                  <button onClick={() => setNewReference({
                    ...newReference,
                    areas_for_improvement: newReference.areas_for_improvement.filter((_, idx) => idx !== i)
                  })}>
                    <XCircle className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Anonymity */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isAnonymous"
              checked={newReference.isAnonymous}
              onChange={(e) => setNewReference({ ...newReference, isAnonymous: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="isAnonymous" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Keep this reference anonymous
            </label>
          </div>

          {/* Submit */}
          <div className="flex gap-2">
            <button
              onClick={createReference}
              className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 rounded-lg transition"
            >
              Submit Reference
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* References List */}
      <div className="space-y-4">
        {filteredReferences.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No references yet</p>
        ) : (
          filteredReferences.map((reference) => (
            <div key={reference.id} className="bg-black/20 rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-1 bg-pink-500/30 rounded text-xs capitalize">
                      {reference.reference_type}
                    </span>
                    {reference.is_mutual && (
                      <span className="px-2 py-1 bg-green-500/30 rounded text-xs flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Mutual
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">
                    {reference.from_user_name || 'Anonymous'} • {new Date(reference.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="text-right">
                  <div className="flex gap-1 mb-1">{renderStars(reference.overall_rating)}</div>
                  {reference.would_meet_again && (
                    <p className="text-xs text-green-400 flex items-center justify-end gap-1">
                      <ThumbsUp className="w-3 h-3" />
                      Would meet again
                    </p>
                  )}
                  </div>
              </div>

              {/* Category Ratings */}
              <div className="grid grid-cols-4 gap-2 mb-3 text-center">
                <div>
                  <p className="text-xs text-gray-400">Respect</p>
                  <p className="font-semibold">{reference.respect_rating}/5</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Communication</p>
                  <p className="font-semibold">{reference.communication_rating}/5</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Safety</p>
                  <p className="font-semibold">{reference.safety_rating}/5</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Satisfaction</p>
                  <p className="font-semibold">{reference.satisfaction_rating}/5</p>
                </div>
              </div>

              {/* Feedback */}
              {reference.feedback && (
                <p className="text-sm mb-3">{reference.feedback}</p>
              )}

              {/* Strengths */}
              {reference.strengths.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-gray-400 mb-1">Strengths:</p>
                  <div className="flex flex-wrap gap-1">
                    {reference.strengths.map((strength, i) => (
                      <span key={i} className="px-2 py-0.5 bg-green-500/30 rounded text-xs">
                        {strength}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Areas for Improvement */}
              {reference.areas_for_improvement.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Areas to Improve:</p>
                  <div className="flex flex-wrap gap-1">
                    {reference.areas_for_improvement.map((area, i) => (
                      <span key={i} className="px-2 py-0.5 bg-blue-500/30 rounded text-xs">
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Flags */}
              {reference.flags.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <div className="flex flex-wrap gap-1">
                    {reference.flags.map((flag, i) => (
                      <span key={i} className="px-2 py-0.5 bg-red-500/30 rounded text-xs">
                        🚩 {flag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
