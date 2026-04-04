/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Users,
  Calendar,
  MapPin,
  Sparkles,
  Edit,
  Save,
  Eye,
  Trash2,
  CheckCircle,
  Clock,
  MessageCircle,
  Heart,
  Zap,
  Moon,
  Wind,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface BlueprintParticipant {
  user_id: string;
  display_name: string;
  photos?: string[];
  primary_photo_index?: number;
}

interface BlueprintContribution {
  id: string;
  user_id: string;
  contributor_name: string;
  action: string;
  section_affected: string;
  change_description?: string;
  created_at: string;
}

interface FantasyBlueprint {
  id: string;
  created_by: string;
  creator_name?: string;
  title: string;
  description?: string;
  participant_ids: string[];
  participants?: BlueprintParticipant[];
  status: string;
  scenario_type?: string;
  mood?: string[];
  pace?: string;
  content: Record<string, any>;
  allow_edits: boolean;
  require_approval: boolean;
  scheduled_for?: string;
  location_preference?: string;
  everyone_agreed: boolean;
  agreements?: string[];
  contributions?: BlueprintContribution[];
  created_at: string;
  updated_at: string;
}

interface MatchUser {
  user_id: string;
  display_name: string;
  photos?: string[];
}

interface FantasyBlueprintProps {
  matches?: MatchUser[];
}

export default function FantasyBlueprint({ matches = [] }: FantasyBlueprintProps) {
  const [blueprints, setBlueprints] = useState<FantasyBlueprint[]>([]);
  const [selectedBlueprint, setSelectedBlueprint] = useState<FantasyBlueprint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showContributions, setShowContributions] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [sectionContent, setSectionContent] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // New blueprint form
  const [newBlueprint, setNewBlueprint] = useState({
    title: '',
    description: '',
    scenarioType: '',
    mood: [] as string[],
    pace: '',
    participantIds: [] as string[],
    allowEdits: true,
    requireApproval: false,
    scheduledFor: '',
    locationPreference: '',
    isPrivate: false
  });

  useEffect(() => {
    fetchBlueprints();
  }, [filterStatus]);

  const fetchBlueprints = async () => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      let url = '/api/fantasy';
      if (filterStatus) url += `?status=${filterStatus}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch blueprints');

      const data = await response.json();
      setBlueprints(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchBlueprintDetails = async (id: string) => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/fantasy/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch blueprint');

      const data = await response.json();
      setSelectedBlueprint(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const createBlueprint = async () => {
    if (!newBlueprint.title) {
      setError('Title is required');
      return;
    }

    if (newBlueprint.participantIds.length === 0) {
      setError('At least one participant is required');
      return;
    }

    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/fantasy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newBlueprint,
          content: {
            scenario: '',
            activities: [],
            boundaries: '',
            notes: ''
          }
        })
      });

      if (!response.ok) throw new Error('Failed to create blueprint');

      setShowCreateModal(false);
      setNewBlueprint({
        title: '',
        description: '',
        scenarioType: '',
        mood: [],
        pace: '',
        participantIds: [],
        allowEdits: true,
        requireApproval: false,
        scheduledFor: '',
        locationPreference: '',
        isPrivate: false
      });
      await fetchBlueprints();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create blueprint');
    }
  };

  const updateBlueprint = async (updates: Partial<FantasyBlueprint>) => {
    if (!selectedBlueprint) return;

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/fantasy/${selectedBlueprint.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) throw new Error('Failed to update blueprint');

      const data = await response.json();
      setSelectedBlueprint(data);
      await fetchBlueprints();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update blueprint');
    }
  };

  const updateSectionContent = async (section: string) => {
    if (!selectedBlueprint) return;

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/fantasy/${selectedBlueprint.id}/content`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          section,
          content: sectionContent,
          previousContent: selectedBlueprint.content?.[section]
        })
      });

      if (!response.ok) throw new Error('Failed to update content');

      const data = await response.json();
      setSelectedBlueprint(data);
      setEditingSection(null);
      setSectionContent('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update content');
    }
  };

  const addAgreement = async () => {
    if (!selectedBlueprint) return;

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/fantasy/${selectedBlueprint.id}/agree`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to add agreement');

      const data = await response.json();
      if (data.allAgreed) {
        await updateBlueprint({ everyone_agreed: true });
      }
      await fetchBlueprintDetails(selectedBlueprint.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add agreement');
    }
  };

  const removeAgreement = async () => {
    if (!selectedBlueprint) return;

    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/fantasy/${selectedBlueprint.id}/agree`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      await fetchBlueprintDetails(selectedBlueprint.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove agreement');
    }
  };

  const deleteBlueprint = async () => {
    if (!selectedBlueprint) return;
    if (!confirm('Are you sure you want to delete this blueprint?')) return;

    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/fantasy/${selectedBlueprint.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setSelectedBlueprint(null);
      await fetchBlueprints();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete blueprint');
    }
  };

  const toggleMood = (mood: string) => {
    if (newBlueprint.mood.includes(mood)) {
      setNewBlueprint({
        ...newBlueprint,
        mood: newBlueprint.mood.filter(m => m !== mood)
      });
    } else {
      setNewBlueprint({
        ...newBlueprint,
        mood: [...newBlueprint.mood, mood]
      });
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-500',
      in_progress: 'bg-blue-500',
      review: 'bg-yellow-500',
      agreed: 'bg-green-500',
      scheduled: 'bg-purple-500'
    };
    return colors[status] || colors.draft;
  };

  const scenarioTypes = ['Romantic', 'Playful', 'Adventurous', 'Intimate', 'Casual', 'Spontaneous'];
  const paceOptions = ['Slow & Gentle', 'Moderate', 'Fast & Intense', 'Flexible'];
  const moodOptions = ['Romantic', 'Playful', 'Adventurous', 'Intimate', 'Passionate', 'Relaxed', 'Energetic', 'Sensual'];

  const renderContentSection = (title: string, key: string, icon: React.ReactNode) => {
    const content = selectedBlueprint?.content?.[key] || '';

    return (
      <div className="bg-white/5 rounded-lg p-4">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-semibold flex items-center gap-2">
            {icon}
            {title}
          </h4>
          {editingSection === key ? (
            <div className="flex gap-2">
              <button
                onClick={() => updateSectionContent(key)}
                className="px-3 py-1 bg-green-500 hover:bg-green-600 rounded text-sm transition"
              >
                <Save className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setEditingSection(null);
                  setSectionContent('');
                }}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setEditingSection(key);
                setSectionContent(content);
              }}
              disabled={!selectedBlueprint?.allow_edits}
              className="p-1 hover:bg-white/10 rounded transition disabled:opacity-50"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
        </div>

        {editingSection === key ? (
          <textarea
            value={sectionContent}
            onChange={(e) => setSectionContent(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none min-h-[120px]"
            placeholder={`Describe your ${title.toLowerCase()}...`}
            autoFocus
          />
        ) : (
          <p className="text-gray-300 whitespace-pre-wrap">{content || <span className="text-gray-500">Not yet described</span>}</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="w-6 h-6 text-purple-500" />
              Fantasy Blueprint
            </h2>
            <p className="text-gray-400 mt-1">
              Co-write your fantasy with matches before meeting
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Blueprint
          </button>
        </div>

        {/* Status Filter */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => setFilterStatus('')}
            className={`px-3 py-1 rounded-lg text-sm transition ${filterStatus === '' ? 'bg-purple-500' : 'bg-white/5 hover:bg-white/10'}`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStatus('draft')}
            className={`px-3 py-1 rounded-lg text-sm transition ${filterStatus === 'draft' ? 'bg-purple-500' : 'bg-white/5 hover:bg-white/10'}`}
          >
            Draft
          </button>
          <button
            onClick={() => setFilterStatus('in_progress')}
            className={`px-3 py-1 rounded-lg text-sm transition ${filterStatus === 'in_progress' ? 'bg-purple-500' : 'bg-white/5 hover:bg-white/10'}`}
          >
            In Progress
          </button>
          <button
            onClick={() => setFilterStatus('agreed')}
            className={`px-3 py-1 rounded-lg text-sm transition ${filterStatus === 'agreed' ? 'bg-purple-500' : 'bg-white/5 hover:bg-white/10'}`}
          >
            Agreed
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {/* Blueprints List */}
      {!selectedBlueprint && (
        <div className="grid gap-4">
          {loading ? (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
              <p className="mt-4 text-gray-400">Loading blueprints...</p>
            </div>
          ) : blueprints.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center">
              <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No blueprints yet. Create one with a match!</p>
            </div>
          ) : (
            blueprints.map((blueprint) => (
              <div
                key={blueprint.id}
                onClick={() => fetchBlueprintDetails(blueprint.id)}
                className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 cursor-pointer hover:bg-white/15 transition"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(blueprint.status)}`}>
                        {blueprint.status.replace('_', ' ')}
                      </span>
                      {blueprint.everyone_agreed && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-300 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          All Agreed
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl font-bold mb-2">{blueprint.title}</h3>
                    {blueprint.description && (
                      <p className="text-gray-300 text-sm mb-3 line-clamp-2">{blueprint.description}</p>
                    )}

                    <div className="flex flex-wrap gap-3 text-sm text-gray-400">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {blueprint.participant_ids.length} participants
                      </div>
                      {blueprint.scenario_type && (
                        <div className="flex items-center gap-1">
                          <Sparkles className="w-4 h-4" />
                          {blueprint.scenario_type}
                        </div>
                      )}
                      {blueprint.scheduled_for && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(blueprint.scheduled_for).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    {blueprint.mood && blueprint.mood.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {blueprint.mood.slice(0, 3).map((mood, i) => (
                          <span key={i} className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs">
                            {mood}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <Eye className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Blueprint Detail View */}
      {selectedBlueprint && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl">
          {/* Detail Header */}
          <div className="p-6 border-b border-white/10">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedBlueprint.status)}`}>
                    {selectedBlueprint.status.replace('_', ' ')}
                  </span>
                  {selectedBlueprint.everyone_agreed && (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-300 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Everyone Agreed
                    </span>
                  )}
                </div>

                <h2 className="text-2xl font-bold mb-2">{selectedBlueprint.title}</h2>
                {selectedBlueprint.description && (
                  <p className="text-gray-300">{selectedBlueprint.description}</p>
                )}

                <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-400">
                  {selectedBlueprint.scenario_type && (
                    <div className="flex items-center gap-1">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      {selectedBlueprint.scenario_type}
                    </div>
                  )}
                  {selectedBlueprint.pace && (
                    <div className="flex items-center gap-1">
                      <Wind className="w-4 h-4 text-blue-400" />
                      {selectedBlueprint.pace}
                    </div>
                  )}
                  {selectedBlueprint.scheduled_for && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-pink-400" />
                      {new Date(selectedBlueprint.scheduled_for).toLocaleString()}
                    </div>
                  )}
                  {selectedBlueprint.location_preference && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4 text-red-400" />
                      {selectedBlueprint.location_preference}
                    </div>
                  )}
                </div>

                {selectedBlueprint.mood && selectedBlueprint.mood.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {selectedBlueprint.mood.map((mood, i) => (
                      <span key={i} className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm flex items-center gap-1">
                        <Heart className="w-3 h-3" />
                        {mood}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedBlueprint(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Participants */}
            {selectedBlueprint.participants && selectedBlueprint.participants.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <h4 className="text-sm font-semibold text-gray-400 mb-2">Participants</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedBlueprint.participants.map((participant) => (
                    <div key={participant.user_id} className="flex items-center gap-2 bg-white/5 rounded-full px-3 py-1">
                      {participant.photos && participant.photos.length > 0 && (
                        <img
                          src={participant.photos[participant.primary_photo_index || 0]}
                          alt={participant.display_name}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      )}
                      <span className="text-sm">{participant.display_name}</span>
                      {selectedBlueprint.agreements?.includes(participant.user_id) && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Content Sections */}
          <div className="p-6 space-y-4">
            {renderContentSection('The Scenario', 'scenario', <Sparkles className="w-4 h-4" />)}
            {renderContentSection('Activities', 'activities', <Zap className="w-4 h-4" />)}
            {renderContentSection('Boundaries', 'boundaries', <Shield className="w-4 h-4" />)}
            {renderContentSection('Notes', 'notes', <MessageCircle className="w-4 h-4" />)}
          </div>

          {/* Actions */}
          <div className="p-6 border-t border-white/10">
            <div className="flex justify-between items-center">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowContributions(!showContributions)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition flex items-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  History ({selectedBlueprint.contributions?.length || 0})
                </button>
                <button
                  onClick={deleteBlueprint}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>

              <button
                onClick={() => {
                  const userId = JSON.parse(atob(localStorage.getItem('token')!.split('.')[1])).userId || JSON.parse(atob(localStorage.getItem('token')!.split('.')[1])).sub;
                  if (selectedBlueprint.agreements?.includes(userId)) {
                    removeAgreement();
                  } else {
                    addAgreement();
                  }
                }}
                className={`px-6 py-3 rounded-lg transition flex items-center gap-2 ${
                  selectedBlueprint.agreements?.includes(userId())
                    ? 'bg-gray-700 hover:bg-gray-600'
                    : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                <CheckCircle className="w-5 h-5" />
                {selectedBlueprint.agreements?.includes(userId()) ? 'Agreed' : 'Agree to Blueprint'}
              </button>
            </div>

            {/* Contributions */}
            {showContributions && selectedBlueprint.contributions && selectedBlueprint.contributions.length > 0 && (
              <div className="mt-4 bg-white/5 rounded-lg p-4 max-h-64 overflow-y-auto">
                <h4 className="font-semibold mb-3">Edit History</h4>
                <div className="space-y-2">
                  {selectedBlueprint.contributions.map((contribution) => (
                    <div key={contribution.id} className="text-sm">
                      <span className="font-semibold">{contribution.contributor_name}</span>
                      <span className="text-gray-400">{` ${contribution.action.replace('_', ' ')} `}</span>
                      <span className="text-purple-400">{contribution.section_affected}</span>
                      <span className="text-gray-500"> · {new Date(contribution.created_at).toLocaleString()}</span>
                      {contribution.change_description && (
                        <p className="text-gray-400 mt-1 italic">"{contribution.change_description}"</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Blueprint Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Create Fantasy Blueprint</h2>
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
                  value={newBlueprint.title}
                  onChange={(e) => setNewBlueprint({ ...newBlueprint, title: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-purple-500 focus:outline-none"
                  placeholder="Our Special Evening..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={newBlueprint.description}
                  onChange={(e) => setNewBlueprint({ ...newBlueprint, description: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-purple-500 focus:outline-none"
                  rows={3}
                  placeholder="Describe the fantasy you want to co-create..."
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Scenario Type</label>
                  <select
                    value={newBlueprint.scenarioType}
                    onChange={(e) => setNewBlueprint({ ...newBlueprint, scenarioType: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-purple-500 focus:outline-none"
                  >
                    <option value="">Select type...</option>
                    {scenarioTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Pace</label>
                  <select
                    value={newBlueprint.pace}
                    onChange={(e) => setNewBlueprint({ ...newBlueprint, pace: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-purple-500 focus:outline-none"
                  >
                    <option value="">Select pace...</option>
                    {paceOptions.map(pace => (
                      <option key={pace} value={pace}>{pace}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Mood (select multiple)</label>
                <div className="flex flex-wrap gap-2">
                  {moodOptions.map(mood => (
                    <button
                      key={mood}
                      onClick={() => toggleMood(mood)}
                      className={`px-3 py-1 rounded-full text-sm transition ${
                        newBlueprint.mood.includes(mood)
                          ? 'bg-purple-500 text-white'
                          : 'bg-white/5 hover:bg-white/10 text-gray-300'
                      }`}
                    >
                      {mood}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Participants *</label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {matches.map(match => (
                    <label key={match.user_id} className="flex items-center gap-3 p-2 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10">
                      <input
                        type="checkbox"
                        checked={newBlueprint.participantIds.includes(match.user_id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewBlueprint({
                              ...newBlueprint,
                              participantIds: [...newBlueprint.participantIds, match.user_id]
                            });
                          } else {
                            setNewBlueprint({
                              ...newBlueprint,
                              participantIds: newBlueprint.participantIds.filter(id => id !== match.user_id)
                            });
                          }
                        }}
                        className="w-4 h-4 rounded border-white/20"
                      />
                      {match.photos && match.photos.length > 0 && (
                        <img src={match.photos[0]} alt={match.display_name} className="w-8 h-8 rounded-full object-cover" />
                      )}
                      <span>{match.display_name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Scheduled For (optional)</label>
                  <input
                    type="datetime-local"
                    value={newBlueprint.scheduledFor}
                    onChange={(e) => setNewBlueprint({ ...newBlueprint, scheduledFor: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Location Preference (optional)</label>
                  <input
                    type="text"
                    value={newBlueprint.locationPreference}
                    onChange={(e) => setNewBlueprint({ ...newBlueprint, locationPreference: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-purple-500 focus:outline-none"
                    placeholder="e.g., My place, Hotel, Restaurant..."
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newBlueprint.allowEdits}
                    onChange={(e) => setNewBlueprint({ ...newBlueprint, allowEdits: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20"
                  />
                  <span className="text-sm">Allow participants to edit</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newBlueprint.requireApproval}
                    onChange={(e) => setNewBlueprint({ ...newBlueprint, requireApproval: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20"
                  />
                  <span className="text-sm">Require approval for changes</span>
                </label>
              </div>

              <button
                onClick={createBlueprint}
                disabled={!newBlueprint.title || newBlueprint.participantIds.length === 0}
                className="w-full px-6 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create Blueprint
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
