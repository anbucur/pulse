/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Award,
  Star,
  Target,
  TrendingUp,
  Calendar,
  Gift,
  Lock,
  Unlock,
  Check,
  Flame,
  Zap,
  Crown,
  Sparkles,
  X,
  ChevronRight,
  Circle,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface CompletionData {
  completion_percent: number;
  filled_fields: string[];
  missing_fields: string[];
  next_milestone: Milestone | null;
}

interface Milestone {
  id: string;
  milestone_key: string;
  milestone_name: string;
  description: string;
  milestone_category: string;
  required_completion_percent: number;
  reward_type: string;
  reward_value: number;
  reward_duration_hours: number;
  icon: string;
  badge_url: string;
  user_progress?: {
    achieved_at: string;
    reward_claimed: boolean;
    reward_claimed_at: string;
    reward_expires_at: string;
  };
}

interface UserMilestone extends Milestone {
  achieved_at: string;
  reward_claimed: boolean;
  reward_claimed_at: string;
  reward_expires_at: string;
}

interface Reward {
  id: string;
  reward_type: string;
  reward_value: number;
  reward_status: string;
  expires_at: string;
  milestone_name: string;
  icon: string;
}

interface StreakData {
  current_streak_days: number;
  longest_streak_days: number;
  last_update: string;
  milestones: {
    7: boolean;
    30: boolean;
    100: boolean;
  };
}

interface ProfileCompletionProps {
  onProfileUpdate?: () => void;
}

export default function ProfileCompletion({ onProfileUpdate }: ProfileCompletionProps) {
  const [completion, setCompletion] = useState<CompletionData | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [achievedMilestones, setAchievedMilestones] = useState<UserMilestone[]>([]);
  const [activeRewards, setActiveRewards] = useState<Reward[]>([]);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showMilestones, setShowMilestones] = useState(false);
  const [showRewards, setShowRewards] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    calculateCompletion();
    fetchMilestones();
    fetchAchievedMilestones();
    fetchActiveRewards();
    fetchStreak();
  }, []);

  const calculateCompletion = async () => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/completion/calculate', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to calculate completion');
      }

      const data = await response.json();
      setCompletion(data);

      // Check for new milestones
      await checkMilestones();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchMilestones = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/completion/milestones', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMilestones(data);
      }
    } catch {
      // Silent fail
    }
  };

  const fetchAchievedMilestones = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/completion/milestones/achieved', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAchievedMilestones(data);
      }
    } catch {
      // Silent fail
    }
  };

  const fetchActiveRewards = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/completion/rewards/active', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setActiveRewards(data);
      }
    } catch {
      // Silent fail
    }
  };

  const fetchStreak = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/completion/streak', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStreak(data);
      }
    } catch {
      // Silent fail
    }
  };

  const checkMilestones = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/completion/check-milestones', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.newly_achieved && data.newly_achieved.length > 0) {
          await fetchAchievedMilestones();
        }
      }
    } catch {
      // Silent fail
    }
  };

  const claimReward = async (milestoneId: string) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/completion/milestones/${milestoneId}/claim`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to claim reward');
      }

      await fetchMilestones();
      await fetchAchievedMilestones();
      await fetchActiveRewards();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const getIcon = (iconName: string) => {
    const icons: Record<string, any> = {
      user: <Target className="w-5 h-5" />,
      image: <Star className="w-5 h-5" />,
      'file-text': <Sparkles className="w-5 h-5" />,
      heart: <Flame className="w-5 h-5" />,
      mail: <Check className="w-5 h-5" />,
      images: <Award className="w-5 h-5" />,
      star: <Trophy className="w-5 h-5" />,
      mic: <Sparkles className="w-5 h-5" />,
      award: <Crown className="w-5 h-5" />,
      trophy: <Trophy className="w-5 h-5" />,
      phone: <Lock className="w-5 h-5" />,
      shield: <Zap className="w-5 h-5" />,
      flame: <Flame className="w-5 h-5" />,
    };
    return icons[iconName] || <Star className="w-5 h-5" />;
  };

  const getRewardIcon = (rewardType: string) => {
    const icons: Record<string, any> = {
      more_matches: <TrendingUp className="w-5 h-5" />,
      visibility_boost: <Sparkles className="w-5 h-5" />,
      badge: <Award className="w-5 h-5" />,
      priority: <Crown className="w-5 h-5" />,
      daily_swipes: <Zap className="w-5 h-5" />,
      super_like: <Star className="w-5 h-5" />,
    };
    return icons[rewardType] || <Gift className="w-5 h-5" />;
  };

  const getRewardLabel = (rewardType: string, rewardValue: number) => {
    const labels: Record<string, string> = {
      more_matches: `${rewardValue}% more matches`,
      visibility_boost: `${rewardValue}% profile boost`,
      badge: 'exclusive badge',
      priority: 'priority matching',
      daily_swipes: `+${rewardValue} daily swipes`,
      super_like: `${rewardValue} super likes`,
    };
    return labels[rewardType] || 'special reward';
  };

  const getFieldLabel = (field: string) => {
    const labels: Record<string, string> = {
      photos: 'Photos',
      bio: 'Bio',
      location: 'Location',
      gender: 'Gender',
      age: 'Age',
      interests: 'Interests',
      email_verified: 'Email Verification',
      phone_verified: 'Phone Verification',
      photo_verified: 'Photo Verification',
      voice_profile: 'Voice Profile',
      kink_profile: 'Kink Profile',
    };
    return labels[field] || field;
  };

  const getCompletionColor = (percent: number) => {
    if (percent >= 100) return 'bg-green-500';
    if (percent >= 75) return 'bg-blue-500';
    if (percent >= 50) return 'bg-yellow-500';
    if (percent >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Main Progress Card */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Trophy className="w-6 h-6 text-pink-500" />
              Profile Completion
            </h2>
            <p className="text-gray-400 mt-1">
              Complete your profile to unlock rewards
            </p>
          </div>
          <button
            onClick={calculateCompletion}
            className="px-4 py-2 bg-pink-500 hover:bg-pink-600 rounded-lg transition flex items-center gap-2"
          >
            <Target className="w-4 h-4" />
            Update Progress
          </button>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300 mb-4">
            {error}
          </div>
        )}

        {loading && !completion ? (
          <div className="py-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-pink-500 border-t-transparent"></div>
            <p className="mt-4 text-gray-400">Calculating completion...</p>
          </div>
        ) : completion ? (
          <>
            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-lg font-semibold">{completion.completion_percent}% Complete</span>
                {completion.next_milestone && (
                  <span className="text-sm text-gray-400">
                    Next: {completion.next_milestone.milestone_name} at {completion.next_milestone.required_completion_percent}%
                  </span>
                )}
              </div>
              <div className="h-4 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getCompletionColor(completion.completion_percent)} transition-all duration-500`}
                  style={{ width: `${completion.completion_percent}%` }}
                />
              </div>
            </div>

            {/* Filled/Missing Fields */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-green-400">
                  <CheckCircle2 className="w-5 h-5" />
                  Completed ({completion.filled_fields.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {completion.filled_fields.map((field) => (
                    <span key={field} className="px-3 py-1 bg-green-500/20 text-green-300 rounded-lg text-sm">
                      {getFieldLabel(field)}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-orange-400">
                  <AlertCircle className="w-5 h-5" />
                  Missing ({completion.missing_fields.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {completion.missing_fields.map((field) => (
                    <span key={field} className="px-3 py-1 bg-orange-500/20 text-orange-300 rounded-lg text-sm">
                      {getFieldLabel(field)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Streak Info */}
            {streak && streak.current_streak_days > 0 && (
              <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-lg p-4 border border-orange-500/30">
                <div className="flex items-center gap-3">
                  <Flame className="w-8 h-8 text-orange-500" />
                  <div>
                    <p className="font-semibold">{streak.current_streak_days} Day Streak!</p>
                    <p className="text-sm text-gray-400">
                      Longest: {streak.longest_streak_days} days • Keep it up!
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 text-center">
          <Trophy className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
          <p className="text-2xl font-bold">{achievedMilestones.length}</p>
          <p className="text-sm text-gray-400">Milestones Achieved</p>
        </div>
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 text-center">
          <Gift className="w-8 h-8 text-pink-500 mx-auto mb-2" />
          <p className="text-2xl font-bold">{activeRewards.length}</p>
          <p className="text-sm text-gray-400">Active Rewards</p>
        </div>
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 text-center">
          <Flame className="w-8 h-8 text-orange-500 mx-auto mb-2" />
          <p className="text-2xl font-bold">{streak?.current_streak_days || 0}</p>
          <p className="text-sm text-gray-400">Day Streak</p>
        </div>
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 text-center">
          <Target className="w-8 h-8 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-bold">{completion?.completion_percent || 0}%</p>
          <p className="text-sm text-gray-400">Complete</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => { setShowMilestones(true); setShowRewards(false); }}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
            showMilestones
              ? 'bg-pink-500 text-white'
              : 'bg-white/5 hover:bg-white/10 text-gray-300'
          }`}
        >
          <Trophy className="w-4 h-4" />
          Milestones
        </button>
        <button
          onClick={() => { setShowMilestones(false); setShowRewards(true); }}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
            showRewards
              ? 'bg-pink-500 text-white'
              : 'bg-white/5 hover:bg-white/10 text-gray-300'
          }`}
        >
          <Gift className="w-4 h-4" />
          Active Rewards
        </button>
      </div>

      {/* Milestones List */}
      {showMilestones && (
        <div className="space-y-4">
          {milestones.map((milestone) => {
            const isAchieved = !!milestone.user_progress?.achieved_at;
            const canClaim = isAchieved && !milestone.user_progress?.reward_claimed;

            return (
              <div
                key={milestone.id}
                className={`bg-white/10 backdrop-blur-lg rounded-xl p-4 ${
                  canClaim ? 'border-2 border-yellow-500' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${
                    isAchieved ? 'bg-green-500/20' : 'bg-white/5'
                  }`}>
                    <div className={isAchieved ? 'text-green-500' : 'text-gray-500'}>
                      {getIcon(milestone.icon)}
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold flex items-center gap-2">
                          {milestone.milestone_name}
                          {isAchieved && (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          )}
                          {canClaim && (
                            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-300 rounded text-xs">
                              Ready to Claim!
                            </span>
                          )}
                        </h4>
                        <p className="text-sm text-gray-400">{milestone.description}</p>
                      </div>
                      <span className="text-sm text-gray-400">
                        {milestone.required_completion_percent}%
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-1 text-sm text-gray-400">
                        {getRewardIcon(milestone.reward_type)}
                        <span>{getRewardLabel(milestone.reward_type, milestone.reward_value)}</span>
                      </div>
                      {milestone.reward_duration_hours && (
                        <span className="text-xs text-gray-500">
                          for {milestone.reward_duration_hours}h
                        </span>
                      )}
                    </div>

                    {canClaim && (
                      <button
                        onClick={() => claimReward(milestone.id)}
                        className="mt-3 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 rounded-lg transition flex items-center gap-2"
                      >
                        <Gift className="w-4 h-4" />
                        Claim Reward
                      </button>
                    )}

                    {milestone.user_progress?.reward_claimed && (
                      <div className="mt-2 text-sm text-gray-400">
                        Claimed on {new Date(milestone.user_progress.reward_claimed_at).toLocaleDateString()}
                        {milestone.user_progress.reward_expires_at && (
                          <span> • Expires {new Date(milestone.user_progress.reward_expires_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active Rewards */}
      {showRewards && (
        <div className="space-y-4">
          {activeRewards.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-12 text-center">
              <Gift className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No active rewards. Complete milestones to earn rewards!</p>
            </div>
          ) : (
            activeRewards.map((reward) => (
              <div key={reward.id} className="bg-white/10 backdrop-blur-lg rounded-xl p-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-pink-500/20 text-pink-500">
                    {getRewardIcon(reward.reward_type)}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">{reward.milestone_name}</h4>
                    <p className="text-sm text-gray-400">
                      {getRewardLabel(reward.reward_type, reward.reward_value)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-green-400 mb-1">
                      <Unlock className="w-4 h-4" />
                      <span className="text-sm font-medium">Active</span>
                    </div>
                    {reward.expires_at && (
                      <p className="text-xs text-gray-500">
                        Expires {new Date(reward.expires_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
