/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Heart,
  MessageCircle,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Check,
  Sparkles,
  Coffee,
  Utensils,
  Mountain,
  Music,
  Palette,
  Star,
  ExternalLink,
  CalendarClock,
  Settings,
  Filter,
  Search,
  ThumbsUp,
  Send,
  AlertCircle
} from 'lucide-react';

interface DatePlan {
  id: number;
  plan_id: string;
  user1_id: number;
  user2_id: number;
  suggested_by: number;
  title: string;
  description: string;
  date_idea_type: string;
  proposed_date_time: string;
  duration_minutes: number;
  location_name: string;
  location_address: string;
  status: string;
  user1_confirmed: boolean;
  user2_confirmed: boolean;
  venue_name: string;
  venue_images: string[];
  user1_name: string;
  user2_name: string;
  created_at: string;
}

interface AvailabilitySlot {
  id: number;
  slot_type: string;
  start_time: string;
  end_time: string;
  priority: number;
  notes: string;
}

interface DateSuggestion {
  suggestion_id: string;
  title: string;
  description: string;
  category: string;
  location_name: string;
  location_address: string;
  estimated_duration_minutes: number;
  estimated_budget: string;
  conversation_rating: number;
  romance_rating: number;
  fun_rating: number;
  activity_level: string;
  tags: string[];
  venue_name: string;
  venue_price: string;
}

interface MutualAvailability {
  start: string;
  end: string;
  priority: number;
}

interface DatePlannerProps {
  onUserClick?: (userId: number) => void;
  onMessageClick?: (userId: number) => void;
  matchedUserId?: number;
}

export default function DatePlanner({ onUserClick, onMessageClick, matchedUserId }: DatePlannerProps) {
  const [plans, setPlans] = useState<DatePlan[]>([]);
  const [suggestions, setSuggestions] = useState<DateSuggestion[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [mutualAvailability, setMutualAvailability] = useState<MutualAvailability[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'plans' | 'suggestions' | 'availability'>('plans');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<DatePlan | null>(null);
  const [expandedPlans, setExpandedPlans] = useState<Set<number>>(new Set());

  // New plan form state
  const [newPlan, setNewPlan] = useState({
    title: '',
    description: '',
    date_idea_type: 'custom',
    proposed_date_time: '',
    duration_minutes: 120,
    location_name: '',
    location_address: '',
    venue_id: '',
    estimated_budget: '',
  });

  useEffect(() => {
    fetchPlans();
    fetchSuggestions();
    fetchAvailability();
  }, []);

  useEffect(() => {
    if (matchedUserId && activeTab === 'availability') {
      fetchMutualAvailability(matchedUserId);
    }
  }, [matchedUserId, activeTab]);

  const fetchPlans = async () => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/date-planner/plans', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch date plans');

      const data = await response.json();
      setPlans(data.plans || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestions = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/date-planner/suggestions', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch date suggestions');

      const data = await response.json();
      setSuggestions(data || []);
    } catch (err) {
      console.error('Failed to fetch suggestions:', err);
    }
  };

  const fetchAvailability = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/date-planner/availability', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch availability');

      const data = await response.json();
      setAvailability(data || []);
    } catch (err) {
      console.error('Failed to fetch availability:', err);
    }
  };

  const fetchMutualAvailability = async (userId: number) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/date-planner/availability/${userId}/mutual`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch mutual availability');

      const data = await response.json();
      setMutualAvailability(data.available_slots || []);
    } catch (err) {
      console.error('Failed to fetch mutual availability:', err);
    }
  };

  const createPlan = async () => {
    if (!matchedUserId) {
      setError('Please select a match first');
      return;
    }

    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/date-planner/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...newPlan,
          user2_id: matchedUserId,
        }),
      });

      if (!response.ok) throw new Error('Failed to create date plan');

      setShowCreateModal(false);
      setNewPlan({
        title: '',
        description: '',
        date_idea_type: 'custom',
        proposed_date_time: '',
        duration_minutes: 120,
        location_name: '',
        location_address: '',
        venue_id: '',
        estimated_budget: '',
      });
      await fetchPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const confirmPlan = async (planId: number, confirmed: boolean) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/date-planner/plans/${planId}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ confirmed }),
      });

      if (!response.ok) throw new Error('Failed to update plan');

      await fetchPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const createFromSuggestion = async (suggestion: DateSuggestion) => {
    if (!matchedUserId) {
      setError('Please select a match first');
      return;
    }

    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      await fetch('/api/date-planner/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          user2_id: matchedUserId,
          title: suggestion.title,
          description: suggestion.description,
          date_idea_type: suggestion.category,
          duration_minutes: suggestion.estimated_duration_minutes,
          location_name: suggestion.location_name || suggestion.venue_name,
          location_address: suggestion.location_address,
          estimated_budget: suggestion.estimated_budget || suggestion.venue_price,
        }),
      });

      await fetchPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const createAvailabilitySlot = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/date-planner/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          slot_type: 'available',
          start_time: newPlan.proposed_date_time,
          end_time: new Date(
            new Date(newPlan.proposed_date_time).getTime() + 2 * 60 * 60 * 1000
          ).toISOString(),
          priority: 5,
        }),
      });

      if (!response.ok) throw new Error('Failed to create availability slot');

      setShowAvailabilityModal(false);
      await fetchAvailability();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      proposed: 'bg-gray-500',
      pending_confirmation: 'bg-yellow-500',
      confirmed: 'bg-green-500',
      scheduled: 'bg-blue-500',
      completed: 'bg-purple-500',
      cancelled: 'bg-red-500',
      rescheduled: 'bg-orange-500',
    };
    return colors[status] || colors.proposed;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      proposed: 'Proposed',
      pending_confirmation: 'Pending Confirmation',
      confirmed: 'Confirmed',
      scheduled: 'Scheduled',
      completed: 'Completed',
      cancelled: 'Cancelled',
      rescheduled: 'Rescheduled',
    };
    return labels[status] || status;
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, React.ReactNode> = {
      coffee: <Coffee className="w-5 h-5" />,
      dinner: <Utensils className="w-5 h-5" />,
      outdoor: <Mountain className="w-5 h-5" />,
      entertainment: <Music className="w-5 h-5" />,
      cultural: <Palette className="w-5 h-5" />,
    };
    return icons[category] || <Sparkles className="w-5 h-5" />;
  };

  const togglePlanExpansion = (planId: number) => {
    const newExpanded = new Set(expandedPlans);
    if (newExpanded.has(planId)) {
      newExpanded.delete(planId);
    } else {
      newExpanded.add(planId);
    }
    setExpandedPlans(newExpanded);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <CalendarClock className="w-6 h-6 text-pink-500" />
              Date Planner
            </h2>
            <p className="text-gray-400 mt-1">
              Schedule dates and find mutual availability
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!matchedUserId}
            className="px-4 py-2 bg-pink-500 hover:bg-pink-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Propose Date
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('plans')}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === 'plans'
                ? 'bg-pink-500 text-white'
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            }`}
          >
            My Dates
          </button>
          <button
            onClick={() => setActiveTab('suggestions')}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === 'suggestions'
                ? 'bg-pink-500 text-white'
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            }`}
          >
            Date Ideas
          </button>
          <button
            onClick={() => setActiveTab('availability')}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === 'availability'
                ? 'bg-pink-500 text-white'
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            }`}
          >
            Availability
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Plans Tab */}
      {activeTab === 'plans' && (
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-pink-500 border-t-transparent"></div>
              <p className="mt-4 text-gray-400">Loading date plans...</p>
            </div>
          ) : plans.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center">
              <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-2">No date plans yet</p>
              <p className="text-gray-500 text-sm">Propose a date to get started</p>
            </div>
          ) : (
            plans.map((plan) => (
              <div key={plan.id} className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                          plan.status
                        )} text-white`}
                      >
                        {getStatusLabel(plan.status)}
                      </span>
                      <span className="text-gray-400 text-sm">
                        with {plan.user1_id === parseInt(localStorage.getItem('userId') || '0') ? plan.user2_name : plan.user1_name}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold mb-2">{plan.title}</h3>
                    {plan.description && (
                      <p className="text-gray-300 text-sm mb-3">{plan.description}</p>
                    )}

                    <div className="flex flex-wrap gap-3 text-sm text-gray-400">
                      {plan.proposed_date_time && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatDate(plan.proposed_date_time)}
                        </div>
                      )}
                      {plan.location_name && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {plan.location_name}
                        </div>
                      )}
                      {plan.duration_minutes && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {plan.duration_minutes} minutes
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {plan.status === 'proposed' || plan.status === 'pending_confirmation' ? (
                    <>
                      <button
                        onClick={() => confirmPlan(plan.id, true)}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg transition flex items-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        Accept
                      </button>
                      <button
                        onClick={() => confirmPlan(plan.id, false)}
                        className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg transition"
                      >
                        Decline
                      </button>
                    </>
                  ) : plan.status === 'confirmed' || plan.status === 'scheduled' ? (
                    <div className="flex items-center gap-2 text-green-400">
                      <Check className="w-4 h-4" />
                      <span>Confirmed</span>
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Suggestions Tab */}
      {activeTab === 'suggestions' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.suggestion_id}
              className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 hover:bg-white/15 transition"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="p-3 bg-pink-500/20 rounded-lg">
                  {getCategoryIcon(suggestion.category)}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold mb-1">{suggestion.title}</h3>
                  <p className="text-gray-400 text-xs capitalize">{suggestion.category}</p>
                </div>
              </div>

              {suggestion.description && (
                <p className="text-gray-300 text-sm mb-4 line-clamp-2">
                  {suggestion.description}
                </p>
              )}

              {/* Ratings */}
              <div className="flex gap-4 mb-4 text-sm">
                <div className="flex items-center gap-1">
                  <MessageCircle className="w-4 h-4 text-blue-400" />
                  <span className="text-gray-400">{suggestion.conversation_rating}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Heart className="w-4 h-4 text-pink-400" />
                  <span className="text-gray-400">{suggestion.romance_rating}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-400" />
                  <span className="text-gray-400">{suggestion.fun_rating}</span>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 text-sm text-gray-400 mb-4">
                {suggestion.estimated_duration_minutes && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>{suggestion.estimated_duration_minutes} minutes</span>
                  </div>
                )}
                {suggestion.estimated_budget && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Budget:</span>
                    <span>{suggestion.estimated_budget}</span>
                  </div>
                )}
              </div>

              {/* Tags */}
              {suggestion.tags && suggestion.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {suggestion.tags.slice(0, 3).map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-white/5 rounded text-xs text-gray-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Action */}
              <button
                onClick={() => createFromSuggestion(suggestion)}
                disabled={!matchedUserId || loading}
                className="w-full px-4 py-2 bg-pink-500 hover:bg-pink-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Propose This Date
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Availability Tab */}
      {activeTab === 'availability' && (
        <div className="space-y-6">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">My Availability</h3>
              <button
                onClick={() => setShowAvailabilityModal(true)}
                className="px-4 py-2 bg-pink-500 hover:bg-pink-600 rounded-lg transition flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Slot
              </button>
            </div>

            {availability.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No availability slots set</p>
              </div>
            ) : (
              <div className="space-y-2">
                {availability.map((slot) => (
                  <div
                    key={slot.id}
                    className="bg-white/5 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold">
                        {formatDate(slot.start_time)}
                      </div>
                      <div className="text-sm text-gray-400">
                        Priority: {slot.priority}/10
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm">
                      Available
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mutual Availability */}
          {matchedUserId && mutualAvailability.length > 0 && (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
              <h3 className="text-xl font-bold mb-4">Mutual Availability</h3>
              <div className="space-y-2">
                {mutualAvailability.map((slot, i) => (
                  <div
                    key={i}
                    className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-pink-300">
                          {formatDate(slot.start)}
                        </div>
                        <div className="text-sm text-gray-400">
                          Priority: {slot.priority.toFixed(1)}
                        </div>
                      </div>
                      <button
                        onClick={() => setNewPlan({ ...newPlan, proposed_date_time: slot.start })}
                        className="px-3 py-1 bg-pink-500 hover:bg-pink-600 rounded-lg text-sm transition"
                      >
                        Select
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Plan Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Propose a Date</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input
                  type="text"
                  value={newPlan.title}
                  onChange={(e) => setNewPlan({ ...newPlan, title: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                  placeholder="Coffee and conversation"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={newPlan.description}
                  onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                  rows={3}
                  placeholder="Describe your date idea..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Date Type</label>
                <select
                  value={newPlan.date_idea_type}
                  onChange={(e) => setNewPlan({ ...newPlan, date_idea_type: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                >
                  <option value="coffee">Coffee</option>
                  <option value="dinner">Dinner</option>
                  <option value="activity">Activity</option>
                  <option value="outdoor">Outdoor</option>
                  <option value="entertainment">Entertainment</option>
                  <option value="cultural">Cultural</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Date & Time *</label>
                <input
                  type="datetime-local"
                  value={newPlan.proposed_date_time}
                  onChange={(e) => setNewPlan({ ...newPlan, proposed_date_time: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Duration (minutes)</label>
                  <input
                    type="number"
                    value={newPlan.duration_minutes}
                    onChange={(e) => setNewPlan({ ...newPlan, duration_minutes: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                    placeholder="120"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Estimated Budget</label>
                  <input
                    type="text"
                    value={newPlan.estimated_budget}
                    onChange={(e) => setNewPlan({ ...newPlan, estimated_budget: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                    placeholder="$20-40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Location Name</label>
                <input
                  type="text"
                  value={newPlan.location_name}
                  onChange={(e) => setNewPlan({ ...newPlan, location_name: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                  placeholder="Cafe XYZ"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Address</label>
                <input
                  type="text"
                  value={newPlan.location_address}
                  onChange={(e) => setNewPlan({ ...newPlan, location_address: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                  placeholder="123 Main St"
                />
              </div>

              <button
                onClick={createPlan}
                disabled={!newPlan.title || !newPlan.proposed_date_time || loading}
                className="w-full px-6 py-3 bg-pink-500 hover:bg-pink-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition flex items-center justify-center gap-2"
              >
                <Send className="w-5 h-5" />
                Propose Date
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
