/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Heart,
  Shield,
  Star,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  User,
  Send,
  X,
  ThumbsUp,
  ThumbsDown,
  Coffee,
  Lightbulb,
  Phone,
  Globe,
  Info,
} from 'lucide-react';

interface DatePair {
  id: string;
  user1_id: string;
  user2_id: string;
  user1_name: string;
  user2_name: string;
  user1_photos: string[];
  user2_photos: string[];
  user1_photo_index: number;
  user2_photo_index: number;
  scheduled_date: string;
  met_at: string;
  status: string;
  has_submitted?: boolean;
}

interface CheckIn {
  id: string;
  rating: number;
  would_see_again: boolean;
  felt_safe: boolean;
  what_went_well: string[];
  could_improve: string[];
  boundaries_respected: boolean;
  communication_rating: number;
  safety_concerns: boolean;
  safety_report?: string;
  wants_second_date: boolean;
  second_date_suggestions: string[];
}

interface SafetyResource {
  name: string;
  description: string;
  phone: string;
  website: string;
}

export default function AftercareCheckIn() {
  const [pendingDates, setPendingDates] = useState<DatePair[]>([]);
  const [pastCheckins, setPastCheckins] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<DatePair | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCheckinForm, setShowCheckinForm] = useState(false);
  const [showSafetyResources, setShowSafetyResources] = useState(false);
  const [mutualMatch, setMutualMatch] = useState(false);
  const [safetyResources, setSafetyResources] = useState<SafetyResource[]>([]);

  // Check-in form state
  const [checkinData, setCheckinData] = useState({
    rating: 0,
    would_see_again: false,
    felt_safe: true,
    what_went_well: [] as string[],
    could_improve: [] as string[],
    boundaries_respected: true,
    communication_rating: 0,
    safety_concerns: false,
    safety_report: '',
    report_anonymous: true,
    wants_second_date: false,
    second_date_suggestions: [] as string[],
  });

  const [newWellItem, setNewWellItem] = useState('');
  const [newImproveItem, setNewImproveItem] = useState('');
  const [newDateSuggestion, setNewDateSuggestion] = useState('');

  useEffect(() => {
    fetchPendingDates();
    fetchPastCheckins();
    fetchSafetyResources();
  }, []);

  const fetchPendingDates = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/aftercare/pending', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch pending dates');

      const data = await response.json();
      setPendingDates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchPastCheckins = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/aftercare', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) return;

      const data = await response.json();
      setPastCheckins(data);
    } catch (err) {
      console.error('Error fetching past check-ins:', err);
    }
  };

  const fetchSafetyResources = async () => {
    try {
      const response = await fetch('/api/aftercare/resources/safety');
      if (response.ok) {
        const data = await response.json();
        setSafetyResources(data);
      }
    } catch (err) {
      console.error('Error fetching safety resources:', err);
    }
  };

  const submitCheckin = async () => {
    if (!selectedDate) return;

    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/aftercare/${selectedDate.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(checkinData),
      });

      if (!response.ok) throw new Error('Failed to submit check-in');

      const data = await response.json();
      setMutualMatch(data.mutualMatch);
      setShowCheckinForm(false);
      await fetchPendingDates();
      await fetchPastCheckins();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const addWellItem = () => {
    if (newWellItem.trim()) {
      setCheckinData({
        ...checkinData,
        what_went_well: [...checkinData.what_went_well, newWellItem.trim()],
      });
      setNewWellItem('');
    }
  };

  const removeWellItem = (index: number) => {
    setCheckinData({
      ...checkinData,
      what_went_well: checkinData.what_went_well.filter((_, i) => i !== index),
    });
  };

  const addImproveItem = () => {
    if (newImproveItem.trim()) {
      setCheckinData({
        ...checkinData,
        could_improve: [...checkinData.could_improve, newImproveItem.trim()],
      });
      setNewImproveItem('');
    }
  };

  const removeImproveItem = (index: number) => {
    setCheckinData({
      ...checkinData,
      could_improve: checkinData.could_improve.filter((_, i) => i !== index),
    });
  };

  const addDateSuggestion = () => {
    if (newDateSuggestion.trim()) {
      setCheckinData({
        ...checkinData,
        second_date_suggestions: [...checkinData.second_date_suggestions, newDateSuggestion.trim()],
      });
      setNewDateSuggestion('');
    }
  };

  const removeDateSuggestion = (index: number) => {
    setCheckinData({
      ...checkinData,
      second_date_suggestions: checkinData.second_date_suggestions.filter((_, i) => i !== index),
    });
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

  const getPartnerName = (datePair: DatePair) => {
    const currentUserId = localStorage.getItem('userId');
    if (datePair.user1_id === currentUserId) {
      return datePair.user2_name;
    }
    return datePair.user1_name;
  };

  const getPartnerPhoto = (datePair: DatePair) => {
    const currentUserId = localStorage.getItem('userId');
    if (datePair.user1_id === currentUserId) {
      return datePair.user2_photos?.[datePair.user2_photo_index || 0];
    }
    return datePair.user1_photos?.[datePair.user1_photo_index || 0];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Heart className="w-6 h-6 text-pink-500" />
              Aftercare Check-In
            </h2>
            <p className="text-gray-400 mt-1">
              Share your experience, stay safe, and help improve future dates
            </p>
          </div>
          <button
            onClick={() => setShowSafetyResources(!showSafetyResources)}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg transition flex items-center gap-2"
          >
            <Shield className="w-4 h-4" />
            Safety Resources
          </button>
        </div>
      </div>

      {/* Safety Resources */}
      {showSafetyResources && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-500" />
            Safety & Support Resources
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            {safetyResources.map((resource, i) => (
              <div key={i} className="bg-white/5 rounded-lg p-4">
                <h4 className="font-semibold mb-1">{resource.name}</h4>
                <p className="text-sm text-gray-400 mb-2">{resource.description}</p>
                <div className="flex flex-wrap gap-2 text-sm">
                  <a
                    href={`tel:${resource.phone}`}
                    className="flex items-center gap-1 text-purple-400 hover:text-purple-300"
                  >
                    <Phone className="w-3 h-3" />
                    {resource.phone}
                  </a>
                  <a
                    href={resource.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-purple-400 hover:text-purple-300"
                  >
                    <Globe className="w-3 h-3" />
                    Website
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {/* Pending Check-Ins */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-pink-500" />
          Pending Check-Ins
        </h3>

        {loading && pendingDates.length === 0 ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-pink-500 border-t-transparent"></div>
          </div>
        ) : pendingDates.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Coffee className="w-12 h-12 mx-auto mb-3 text-gray-600" />
            <p>No pending check-ins</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {pendingDates.map((date) => (
              <div key={date.id} className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {getPartnerPhoto(date) && (
                      <img
                        src={getPartnerPhoto(date)}
                        alt={getPartnerName(date)}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    )}
                    <div>
                      <h4 className="font-semibold">{getPartnerName(date)}</h4>
                      <p className="text-sm text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(date.met_at || date.scheduled_date)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedDate(date);
                      setShowCheckinForm(true);
                      setCheckinData({
                        rating: 0,
                        would_see_again: false,
                        felt_safe: true,
                        what_went_well: [],
                        could_improve: [],
                        boundaries_respected: true,
                        communication_rating: 0,
                        safety_concerns: false,
                        safety_report: '',
                        report_anonymous: true,
                        wants_second_date: false,
                        second_date_suggestions: [],
                      });
                    }}
                    className="px-4 py-2 bg-pink-500 hover:bg-pink-600 rounded-lg transition flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Check In
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past Check-Ins */}
      {pastCheckins.length > 0 && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            Past Check-Ins
          </h3>

          <div className="grid gap-4">
            {pastCheckins.map((checkin) => (
              <div key={checkin.id} className="bg-white/5 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    {checkin.user1_photos && checkin.user1_photos.length > 0 && (
                      <img
                        src={checkin.user1_photos[checkin.user1_photo_index || 0]}
                        alt={checkin.user1_name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    )}
                    <div>
                      <h4 className="font-semibold">{checkin.user2_name}</h4>
                      <div className="flex items-center gap-1 mt-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-4 h-4 ${
                              star <= checkin.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-sm text-gray-400 mt-1">
                        {formatDate(checkin.met_at || checkin.scheduled_date)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {checkin.would_see_again && (
                      <span className="text-green-400 flex items-center gap-1 text-sm">
                        <ThumbsUp className="w-3 h-3" />
                        Would see again
                      </span>
                    )}
                    {checkin.felt_safe && (
                      <span className="text-green-400 flex items-center gap-1 text-sm mt-1">
                        <Shield className="w-3 h-3" />
                        Felt safe
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Check-In Form Modal */}
      {showCheckinForm && selectedDate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Date Check-In</h2>
                <button
                  onClick={() => setShowCheckinForm(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <p className="text-gray-400 mt-2">
                How was your date with {getPartnerName(selectedDate)}?
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Overall Rating */}
              <div>
                <label className="block text-sm font-medium mb-3">Overall Rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setCheckinData({ ...checkinData, rating: star })}
                      className="text-3xl transition"
                    >
                      <Star
                        className={`w-10 h-10 ${
                          star <= checkinData.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Would See Again */}
              <div>
                <label className="block text-sm font-medium mb-3">Would you see them again?</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setCheckinData({ ...checkinData, would_see_again: true })}
                    className={`flex-1 px-4 py-3 rounded-lg transition flex items-center justify-center gap-2 ${
                      checkinData.would_see_again
                        ? 'bg-green-500 text-white'
                        : 'bg-white/5 hover:bg-white/10 text-gray-300'
                    }`}
                  >
                    <ThumbsUp className="w-5 h-5" />
                    Yes
                  </button>
                  <button
                    onClick={() => setCheckinData({ ...checkinData, would_see_again: false })}
                    className={`flex-1 px-4 py-3 rounded-lg transition flex items-center justify-center gap-2 ${
                      !checkinData.would_see_again && checkinData.rating > 0
                        ? 'bg-red-500 text-white'
                        : 'bg-white/5 hover:bg-white/10 text-gray-300'
                    }`}
                  >
                    <ThumbsDown className="w-5 h-5" />
                    No
                  </button>
                </div>
              </div>

              {/* Safety */}
              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Shield className="w-5 h-5 text-purple-500" />
                  <span className="font-medium">Safety Check</span>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkinData.felt_safe}
                      onChange={(e) => setCheckinData({ ...checkinData, felt_safe: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                    <span>I felt safe during this date</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkinData.boundaries_respected}
                      onChange={(e) => setCheckinData({ ...checkinData, boundaries_respected: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                    <span>My boundaries were respected</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkinData.safety_concerns}
                      onChange={(e) => setCheckinData({ ...checkinData, safety_concerns: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                    <span className="text-red-400">I have safety concerns to report</span>
                  </label>
                </div>

                {checkinData.safety_concerns && (
                  <div className="mt-4 space-y-3">
                    <textarea
                      value={checkinData.safety_report}
                      onChange={(e) => setCheckinData({ ...checkinData, safety_report: e.target.value })}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-red-500 focus:outline-none"
                      rows={3}
                      placeholder="Describe your concerns... This will be sent to our safety team."
                    />
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checkinData.report_anonymous}
                        onChange={(e) => setCheckinData({ ...checkinData, report_anonymous: e.target.checked })}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm text-gray-400">Submit report anonymously</span>
                    </label>
                  </div>
                )}
              </div>

              {/* What Went Well */}
              <div>
                <label className="block text-sm font-medium mb-3 flex items-center gap-2">
                  <ThumbsUp className="w-4 h-4 text-green-500" />
                  What Went Well
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newWellItem}
                    onChange={(e) => setNewWellItem(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addWellItem()}
                    className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                    placeholder="Something good..."
                  />
                  <button
                    onClick={addWellItem}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg transition"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {checkinData.what_went_well.map((item, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm flex items-center gap-2"
                    >
                      {item}
                      <button onClick={() => removeWellItem(i)} className="hover:text-green-100">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Could Improve */}
              <div>
                <label className="block text-sm font-medium mb-3 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-yellow-500" />
                  Could Be Improved
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newImproveItem}
                    onChange={(e) => setNewImproveItem(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addImproveItem()}
                    className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                    placeholder="Something to improve..."
                  />
                  <button
                    onClick={addImproveItem}
                    className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 rounded-lg transition"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {checkinData.could_improve.map((item, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-yellow-500/20 text-yellow-300 rounded-full text-sm flex items-center gap-2"
                    >
                      {item}
                      <button onClick={() => removeImproveItem(i)} className="hover:text-yellow-100">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Communication Rating */}
              <div>
                <label className="block text-sm font-medium mb-3">Communication Rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setCheckinData({ ...checkinData, communication_rating: star })}
                      className={`px-3 py-2 rounded-lg transition ${
                        star === checkinData.communication_rating
                          ? 'bg-purple-500 text-white'
                          : 'bg-white/5 hover:bg-white/10 text-gray-300'
                      }`}
                    >
                      {star}
                    </button>
                  ))}
                </div>
              </div>

              {/* Second Date Suggestions */}
              {checkinData.would_see_again && (
                <div className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-4">
                  <label className="block text-sm font-medium mb-3 flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-pink-500" />
                    Second Date Ideas
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newDateSuggestion}
                      onChange={(e) => setNewDateSuggestion(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addDateSuggestion()}
                      className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                      placeholder="Fun date idea..."
                    />
                    <button
                      onClick={addDateSuggestion}
                      className="px-4 py-2 bg-pink-500 hover:bg-pink-600 rounded-lg transition"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {checkinData.second_date_suggestions.map((item, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-pink-500/20 text-pink-300 rounded-full text-sm flex items-center gap-2"
                      >
                        {item}
                        <button onClick={() => removeDateSuggestion(i)} className="hover:text-pink-100">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={submitCheckin}
                disabled={checkinData.rating === 0 || loading}
                className="w-full px-6 py-3 bg-pink-500 hover:bg-pink-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition flex items-center justify-center gap-2"
              >
                <Send className="w-5 h-5" />
                Submit Check-In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mutual Match Notification */}
      {mutualMatch && (
        <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-6 text-center">
          <Heart className="w-12 h-12 text-green-400 mx-auto mb-3 fill-green-400" />
          <h3 className="text-xl font-bold text-green-300 mb-2">It's a Match!</h3>
          <p className="text-green-200">
            You both had a great time and want to see each other again. Time to plan date #2!
          </p>
        </div>
      )}
    </div>
  );
}
