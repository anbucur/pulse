/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  MessageCircle,
  Heart,
  Zap,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Info,
  Check,
  X,
} from 'lucide-react';

interface ChemistryPredictorProps {
  targetUserId: string;
  targetUserName?: string;
}

interface ChemistryData {
  id?: string;
  user_id?: string;
  target_user_id?: string;
  communication_style_match: number;
  response_time_compatibility: number;
  social_battery_compatibility: number;
  activity_level_compatibility: number;
  attachment_compatibility: number;
  emotional_needs_compatibility: number;
  conflict_style_compatibility: number;
  overall_compatibility: number;
  strengths: string[];
  potential_challenges: string[];
  conversation_icebreakers: string[];
  communication_pattern_analysis?: {
    has_chat_history: boolean;
  };
  calculated_at?: string;
}

export default function ChemistryPredictor({ targetUserId, targetUserName }: ChemistryPredictorProps) {
  const [chemistry, setChemistry] = useState<ChemistryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    fetchChemistry();
  }, [targetUserId]);

  const fetchChemistry = async () => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/chemistry/${targetUserId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to analyze chemistry');
      }

      const data = await response.json();
      setChemistry(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Moderate';
    return 'Low';
  };

  const getOverallLabel = (score: number): string => {
    if (score >= 80) return 'High Chemistry Potential';
    if (score >= 60) return 'Good Compatibility';
    if (score >= 40) return 'Moderate Match';
    return 'Challenging Match';
  };

  const getScoreWidth = (score: number): string => {
    return `${score}%`;
  };

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-pink-500 border-t-transparent"></div>
        <p className="mt-4 text-gray-400">Analyzing chemistry...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-pink-500" />
              Chemistry Predictor
            </h2>
            <p className="text-gray-400 mt-1">
              {targetUserName
                ? `Compatibility analysis with ${targetUserName}`
                : 'AI-powered compatibility analysis based on profiles'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="p-2 hover:bg-white/10 rounded-lg transition"
              title="How it works"
            >
              <Info className="w-5 h-5" />
            </button>
            <button
              onClick={fetchChemistry}
              className="p-2 hover:bg-white/10 rounded-lg transition"
              title="Refresh analysis"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Info Panel */}
        {showInfo && (
          <div className="mt-4 p-4 bg-white/5 rounded-lg">
            <h3 className="font-semibold mb-2">How Chemistry Prediction Works</h3>
            <p className="text-sm text-gray-300 mb-2">
              Our AI analyzes your profile data to predict interpersonal chemistry across multiple dimensions:
            </p>
            <ul className="text-sm space-y-1 text-gray-300">
              <li>• <strong>Communication Style:</strong> How you prefer to connect</li>
              <li>• <strong>Social Battery:</strong> Energy levels and social needs</li>
              <li>• <strong>Attachment Style:</strong> Emotional bonding patterns</li>
              <li>• <strong>Love Languages:</strong> How you express and receive affection</li>
              <li>• <strong>Interests & Lifestyle:</strong> Shared activities and values</li>
            </ul>
            <p className="text-sm text-gray-400 mt-3">
              Predictions are cached for 7 days. Last updated: {chemistry?.calculated_at ? new Date(chemistry.calculated_at).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {chemistry && (
        <>
          {/* Overall Score */}
          <div className="bg-gradient-to-br from-pink-500/20 to-purple-500/20 backdrop-blur-lg rounded-2xl p-8 text-center">
            <div className="mb-4">
              <Heart className="w-16 h-16 text-pink-500 mx-auto mb-4" />
              <h3 className="text-3xl font-bold mb-2">{getOverallLabel(chemistry.overall_compatibility)}</h3>
              <div className="text-6xl font-bold text-pink-500 mb-2">
                {chemistry.overall_compatibility}%
              </div>
              <p className="text-gray-300">Overall Compatibility Score</p>
            </div>

            <div className="max-w-md mx-auto">
              <div className="h-4 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-1000"
                  style={{ width: getScoreWidth(chemistry.overall_compatibility) }}
                ></div>
              </div>
            </div>
          </div>

          {/* Detailed Scores */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-pink-500" />
              Compatibility Breakdown
            </h3>

            <div className="space-y-4">
              {/* Communication Style Match */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    Communication Style
                  </span>
                  <span className={`font-bold ${getScoreColor(chemistry.communication_style_match)}`}>
                    {chemistry.communication_style_match}%
                  </span>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      chemistry.communication_style_match >= 80
                        ? 'bg-green-500'
                        : chemistry.communication_style_match >= 60
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: getScoreWidth(chemistry.communication_style_match) }}
                  ></div>
                </div>
                <p className="text-xs text-gray-400 mt-1">{getScoreLabel(chemistry.communication_style_match)}</p>
              </div>

              {/* Social Battery Compatibility */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Social Battery & Energy
                  </span>
                  <span className={`font-bold ${getScoreColor(chemistry.social_battery_compatibility)}`}>
                    {chemistry.social_battery_compatibility}%
                  </span>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      chemistry.social_battery_compatibility >= 80
                        ? 'bg-green-500'
                        : chemistry.social_battery_compatibility >= 60
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: getScoreWidth(chemistry.social_battery_compatibility) }}
                  ></div>
                </div>
                <p className="text-xs text-gray-400 mt-1">{getScoreLabel(chemistry.social_battery_compatibility)}</p>
              </div>

              {/* Attachment Compatibility */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="flex items-center gap-2">
                    <Heart className="w-4 h-4" />
                    Attachment & Emotional Needs
                  </span>
                  <span className={`font-bold ${getScoreColor(chemistry.attachment_compatibility)}`}>
                    {chemistry.attachment_compatibility}%
                  </span>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      chemistry.attachment_compatibility >= 80
                        ? 'bg-green-500'
                        : chemistry.attachment_compatibility >= 60
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: getScoreWidth(chemistry.attachment_compatibility) }}
                  ></div>
                </div>
                <p className="text-xs text-gray-400 mt-1">{getScoreLabel(chemistry.attachment_compatibility)}</p>
              </div>

              {/* Activity Level Compatibility */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Activities & Lifestyle
                  </span>
                  <span className={`font-bold ${getScoreColor(chemistry.activity_level_compatibility)}`}>
                    {chemistry.activity_level_compatibility}%
                  </span>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      chemistry.activity_level_compatibility >= 80
                        ? 'bg-green-500'
                        : chemistry.activity_level_compatibility >= 60
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: getScoreWidth(chemistry.activity_level_compatibility) }}
                  ></div>
                </div>
                <p className="text-xs text-gray-400 mt-1">{getScoreLabel(chemistry.activity_level_compatibility)}</p>
              </div>

              {/* Conflict Style Compatibility */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Conflict Resolution Style
                  </span>
                  <span className={`font-bold ${getScoreColor(chemistry.conflict_style_compatibility)}`}>
                    {chemistry.conflict_style_compatibility}%
                  </span>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      chemistry.conflict_style_compatibility >= 80
                        ? 'bg-green-500'
                        : chemistry.conflict_style_compatibility >= 60
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: getScoreWidth(chemistry.conflict_style_compatibility) }}
                  ></div>
                </div>
                <p className="text-xs text-gray-400 mt-1">{getScoreLabel(chemistry.conflict_style_compatibility)}</p>
              </div>
            </div>
          </div>

          {/* Expandable Sections */}
          <div className="space-y-4">
            {/* Strengths */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl overflow-hidden">
              <button
                onClick={() => setExpandedSection(expandedSection === 'strengths' ? null : 'strengths')}
                className="w-full p-6 flex justify-between items-center hover:bg-white/5 transition"
              >
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-500" />
                  Relationship Strengths
                  {chemistry.strengths?.length > 0 && (
                    <span className="text-sm text-gray-400">({chemistry.strengths.length})</span>
                  )}
                </h3>
                {expandedSection === 'strengths' ? (
                  <X className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>
              {expandedSection === 'strengths' && (
                <div className="px-6 pb-6">
                  {chemistry.strengths && chemistry.strengths.length > 0 ? (
                    <ul className="space-y-2">
                      {chemistry.strengths.map((strength, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-400">No specific strengths identified yet.</p>
                  )}
                </div>
              )}
            </div>

            {/* Potential Challenges */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl overflow-hidden">
              <button
                onClick={() => setExpandedSection(expandedSection === 'challenges' ? null : 'challenges')}
                className="w-full p-6 flex justify-between items-center hover:bg-white/5 transition"
              >
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  Potential Challenges
                  {chemistry.potential_challenges?.length > 0 && (
                    <span className="text-sm text-gray-400">({chemistry.potential_challenges.length})</span>
                  )}
                </h3>
                {expandedSection === 'challenges' ? (
                  <X className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>
              {expandedSection === 'challenges' && (
                <div className="px-6 pb-6">
                  {chemistry.potential_challenges && chemistry.potential_challenges.length > 0 ? (
                    <ul className="space-y-2">
                      {chemistry.potential_challenges.map((challenge, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-500 mt-1 flex-shrink-0" />
                          <span>{challenge}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-400">No significant challenges identified.</p>
                  )}
                </div>
              )}
            </div>

            {/* Conversation Starters */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl overflow-hidden">
              <button
                onClick={() => setExpandedSection(expandedSection === 'icebreakers' ? null : 'icebreakers')}
                className="w-full p-6 flex justify-between items-center hover:bg-white/5 transition"
              >
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-pink-500" />
                  Conversation Icebreakers
                  {chemistry.conversation_icebreakers?.length > 0 && (
                    <span className="text-sm text-gray-400">({chemistry.conversation_icebreakers.length})</span>
                  )}
                </h3>
                {expandedSection === 'icebreakers' ? (
                  <X className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>
              {expandedSection === 'icebreakers' && (
                <div className="px-6 pb-6">
                  {chemistry.conversation_icebreakers && chemistry.conversation_icebreakers.length > 0 ? (
                    <ul className="space-y-2">
                      {chemistry.conversation_icebreakers.map((icebreaker, i) => (
                        <li
                          key={i}
                          className="p-3 bg-white/5 rounded-lg hover:bg-white/10 transition cursor-pointer"
                          onClick={() => {
                            navigator.clipboard.writeText(icebreaker);
                          }}
                        >
                          "{icebreaker}"
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-400">No icebreakers available yet.</p>
                  )}
                  <p className="text-xs text-gray-500 mt-3">Click an icebreaker to copy it</p>
                </div>
              )}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="bg-white/5 rounded-lg p-4 text-sm text-gray-400">
            <p>
              <strong>Note:</strong> This analysis is based on profile data and should be used as a guide,
              not a definitive prediction. Real chemistry develops through interaction and communication.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// Add ChevronDown icon import
import { ChevronDown } from 'lucide-react';
