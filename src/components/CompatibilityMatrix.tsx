import React, { useState, useEffect } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from 'recharts';
import { Loader2, Sparkles, Target, AlertTriangle } from 'lucide-react';

interface CompatibilityData {
  id: string;
  target_user_id: string;
  communication_score: number;
  lifestyle_score: number;
  values_score: number;
  intimacy_score: number;
  conflict_resolution_score: number;
  growth_score: number;
  overall_score: number;
  strengths: string[];
  potential_challenges: string[];
  recommendations: string[];
  calculated_at: string;
}

interface CompatibilityMatrixProps {
  targetUserId: string;
  targetUserName?: string;
}

export default function CompatibilityMatrix({ targetUserId, targetUserName = 'This person' }: CompatibilityMatrixProps) {
  const [compatibility, setCompatibility] = useState<CompatibilityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    calculateCompatibility();
  }, [targetUserId]);

  const calculateCompatibility = async (forceRecalculate = false) => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/features/compatibility/${targetUserId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ forceRecalculate }),
      });

      if (!response.ok) {
        throw new Error('Failed to calculate compatibility');
      }

      const data = await response.json();
      setCompatibility(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <div className="flex items-center justify-center gap-2 text-gray-300">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Analyzing compatibility...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!compatibility) {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <p className="text-gray-400">No compatibility data available.</p>
      </div>
    );
  }

  const radarData = [
    { subject: 'Communication', score: compatibility.communication_score, fullMark: 100 },
    { subject: 'Lifestyle', score: compatibility.lifestyle_score, fullMark: 100 },
    { subject: 'Values', score: compatibility.values_score, fullMark: 100 },
    { subject: 'Intimacy', score: compatibility.intimacy_score, fullMark: 100 },
    { subject: 'Conflict Resolution', score: compatibility.conflict_resolution_score, fullMark: 100 },
    { subject: 'Growth', score: compatibility.growth_score, fullMark: 100 },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Target className="w-5 h-5 text-pink-500" />
            Compatibility Matrix
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Your compatibility with {targetUserName}
          </p>
        </div>
        <div className="text-right">
          <div className={`text-4xl font-bold ${getScoreColor(compatibility.overall_score)}`}>
            {compatibility.overall_score}%
          </div>
          <p className="text-sm text-gray-400">Overall Score</p>
        </div>
      </div>

      {/* Radar Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData}>
            <PolarGrid stroke="rgba(255,255,255,0.2)" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#fff' }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#fff' }} />
            <Radar
              name="Compatibility"
              dataKey="score"
              stroke="#ec4899"
              fill="#ec4899"
              fillOpacity={0.6}
            />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Strengths */}
      {compatibility.strengths.length > 0 && (
        <div>
          <h4 className="font-semibold text-green-400 mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Strengths
          </h4>
          <ul className="space-y-1">
            {compatibility.strengths.map((strength, i) => (
              <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                <span className="text-green-400">•</span>
                {strength}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Potential Challenges */}
      {compatibility.potential_challenges.length > 0 && (
        <div>
          <h4 className="font-semibold text-yellow-400 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Potential Challenges
          </h4>
          <ul className="space-y-1">
            {compatibility.potential_challenges.map((challenge, i) => (
              <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                <span className="text-yellow-400">•</span>
                {challenge}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {compatibility.recommendations.length > 0 && (
        <div>
          <h4 className="font-semibold text-blue-400 mb-2">Recommendations</h4>
          <ul className="space-y-1">
            {compatibility.recommendations.map((recommendation, i) => (
              <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                <span className="text-blue-400">•</span>
                {recommendation}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recalculate Button */}
      <button
        onClick={() => calculateCompatibility(true)}
        className="w-full px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg transition flex items-center justify-center gap-2"
      >
        <Sparkles className="w-4 h-4" />
        Recalculate with AI
      </button>
    </div>
  );
}
