/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Gift,
  Users,
  Trophy,
  Share2,
  Copy,
  Check,
  Crown,
  Calendar,
  TrendingUp,
  Award,
  Mail,
  Link,
  Twitter,
  Facebook,
  MessageCircle,
  Star,
  Zap,
  Target,
  RefreshCw,
  X,
  ExternalLink,
} from 'lucide-react';

interface ReferralCode {
  id: string;
  code: string;
  reward_type: string;
  reward_amount: number;
  total_uses: number;
  max_uses: number;
  expires_at: string;
}

interface Referral {
  id: string;
  referred_id?: string;
  status: string;
  completed_at?: string;
  username?: string;
  display_name?: string;
  profile_photo?: string;
}

interface Reward {
  id: string;
  reward_type: string;
  reward_amount: number;
  status: string;
  expires_at?: string;
  applied_at?: string;
  created_at: string;
}

interface LeaderboardEntry {
  user_id: string;
  username: string;
  display_name: string;
  profile_photo?: string;
  total_referrals: number;
  successful_referrals: number;
  total_rewards_earned: number;
  rank_position: number;
}

interface UserRank {
  total_referrals: number;
  successful_referrals: number;
  total_rewards_earned: number;
  rank_position?: number;
}

export default function ReferralSystem() {
  const [referralCode, setReferralCode] = useState<ReferralCode | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<UserRank | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'referrals' | 'rewards' | 'leaderboard'>('overview');

  // Modals
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      // Fetch referral code
      const codeResponse = await fetch('/api/referrals/my-code', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const codeData = await codeResponse.json();
      setReferralCode(codeData);

      // Fetch referrals
      const referralsResponse = await fetch('/api/referrals/my-referrals', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const referralsData = await referralsResponse.json();
      setReferrals(referralsData);

      // Fetch rewards
      const rewardsResponse = await fetch('/api/referrals/rewards', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const rewardsData = await rewardsResponse.json();
      setRewards(rewardsData);

      // Fetch leaderboard
      const leaderboardResponse = await fetch('/api/referrals/leaderboard?limit=50');
      const leaderboardData = await leaderboardResponse.json();
      setLeaderboard(leaderboardData);

      // Fetch user rank
      const rankResponse = await fetch('/api/referrals/my-rank', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const rankData = await rankResponse.json();
      setUserRank(rankData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load referral data');
    } finally {
      setLoading(false);
    }
  };

  const copyReferralCode = async () => {
    if (!referralCode) return;

    const shareLink = `${window.location.origin}?ref=${referralCode.code}`;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  const shareToPlatform = async (platform: string) => {
    if (!referralCode) return;

    const shareLink = `${window.location.origin}?ref=${referralCode.code}`;
    const message = `Join me on Pulse! Use my referral code ${referralCode.code} for ${referralCode.reward_amount} days of free Premium!`;

    const token = localStorage.getItem('token');
    await fetch('/api/referrals/share', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ platform }),
    });

    let url = '';
    switch (platform) {
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(shareLink)}`;
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}`;
        break;
      case 'whatsapp':
        url = `https://wa.me/?text=${encodeURIComponent(message + ' ' + shareLink)}`;
        break;
      case 'email':
        url = `mailto:?subject=Join me on Pulse!&body=${encodeURIComponent(message + ' ' + shareLink)}`;
        break;
    }

    if (url) {
      window.open(url, '_blank', 'width=600,height=400');
    }
  };

  const claimReward = async (rewardId: string) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/referrals/rewards/${rewardId}/claim`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to claim reward');

      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim reward');
    }
  };

  const getRewardIcon = (type: string) => {
    const icons: Record<string, JSX.Element> = {
      premium_time: <Crown className="w-5 h-5 text-yellow-500" />,
      swipes: <RefreshCw className="w-5 h-5 text-blue-500" />,
      boosts: <TrendingUp className="w-5 h-5 text-purple-500" />,
    };
    return icons[type] || <Gift className="w-5 h-5 text-pink-500" />;
  };

  const getRewardText = (reward: Reward) => {
    switch (reward.reward_type) {
      case 'premium_time':
        return `${reward.reward_amount} days of Premium`;
      case 'swipes':
        return `${reward.reward_amount} extra likes`;
      case 'boosts':
        return `${reward.reward_amount} profile boosts`;
      default:
        return `${reward.reward_amount} ${reward.reward_type}`;
    }
  };

  const successfulReferrals = referrals.filter(r => r.status === 'completed' || r.status === 'rewarded').length;
  const pendingReferrals = referrals.filter(r => r.status === 'pending').length;
  const availableRewards = rewards.filter(r => r.status === 'available').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <Gift className="w-8 h-8 text-pink-500" />
            <div>
              <h2 className="text-2xl font-bold">Referral Program</h2>
              <p className="text-gray-400 mt-1">
                Invite friends, earn Premium time together
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowShareModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 rounded-lg transition flex items-center gap-2 font-semibold"
          >
            <Share2 className="w-5 h-5" />
            Invite Friends
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-6 flex-wrap">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-2 rounded-lg transition ${
              activeTab === 'overview'
                ? 'bg-pink-500 text-white'
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('referrals')}
            className={`px-6 py-2 rounded-lg transition ${
              activeTab === 'referrals'
                ? 'bg-pink-500 text-white'
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            }`}
          >
            My Referrals
          </button>
          <button
            onClick={() => setActiveTab('rewards')}
            className={`px-6 py-2 rounded-lg transition relative ${
              activeTab === 'rewards'
                ? 'bg-pink-500 text-white'
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            }`}
          >
            Rewards
            {availableRewards > 0 && (
              <span className="absolute -top-1 -right-1 bg-green-500 text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {availableRewards}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-6 py-2 rounded-lg transition ${
              activeTab === 'leaderboard'
                ? 'bg-pink-500 text-white'
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            }`}
          >
            Leaderboard
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {loading && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-pink-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      )}

      {!loading && (
        <>
          {activeTab === 'overview' && (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Referral Code Card */}
              <div className="md:col-span-2 bg-gradient-to-br from-pink-500/20 to-purple-500/20 backdrop-blur-lg rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Link className="w-5 h-5 text-pink-500" />
                  Your Referral Code
                </h3>
                <div className="bg-white/5 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <code className="text-2xl font-mono font-bold tracking-wider">
                      {referralCode?.code.toUpperCase()}
                    </code>
                    <button
                      onClick={copyReferralCode}
                      className="p-2 hover:bg-white/10 rounded-lg transition"
                    >
                      {copied ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <Copy className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="text-sm text-gray-400 mb-4">
                  Share this code with friends. When they sign up, both of you get{' '}
                  <span className="text-pink-400 font-semibold">{referralCode?.reward_amount} days of Premium</span>!
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowShareModal(true)}
                    className="flex-1 py-2 bg-pink-500 hover:bg-pink-600 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    Share Now
                  </button>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Users className="w-8 h-8 text-green-500" />
                  <div>
                    <div className="text-3xl font-bold">{successfulReferrals}</div>
                    <div className="text-gray-400 text-sm">Successful Referrals</div>
                  </div>
                </div>
                <div className="text-sm text-gray-400">
                  {pendingReferrals > 0 && (
                    <div className="text-yellow-400">
                      {pendingReferrals} pending signup{pendingReferrals > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Crown className="w-8 h-8 text-yellow-500" />
                  <div>
                    <div className="text-3xl font-bold">
                      {userRank?.total_rewards_earned || 0}
                    </div>
                    <div className="text-gray-400 text-sm">Days Earned</div>
                  </div>
                </div>
                <div className="text-sm text-gray-400">
                  {availableRewards > 0 && (
                    <div className="text-green-400">
                      {availableRewards} reward{availableRewards > 1 ? 's' : ''} available
                    </div>
                  )}
                </div>
              </div>

              {/* How It Works */}
              <div className="md:col-span-2 bg-white/10 backdrop-blur-lg rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  How It Works
                </h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-pink-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-2xl font-bold text-pink-500">1</span>
                    </div>
                    <div className="font-semibold mb-1">Share Your Code</div>
                    <div className="text-sm text-gray-400">
                      Send your unique code to friends
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-2xl font-bold text-purple-500">2</span>
                    </div>
                    <div className="font-semibold mb-1">Friends Sign Up</div>
                    <div className="text-sm text-gray-400">
                      They use your code when joining
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-2xl font-bold text-yellow-500">3</span>
                    </div>
                    <div className="font-semibold mb-1">Both Get Rewards</div>
                    <div className="text-sm text-gray-400">
                      {referralCode?.reward_amount} days Premium for both
                    </div>
                  </div>
                </div>
              </div>

              {/* Leaderboard Preview */}
              <div className="md:col-span-2 bg-white/10 backdrop-blur-lg rounded-2xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    Top Referrers
                  </h3>
                  <button
                    onClick={() => setActiveTab('leaderboard')}
                    className="text-pink-400 hover:text-pink-300 text-sm flex items-center gap-1"
                  >
                    View All <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  {leaderboard.slice(0, 3).map((entry, idx) => (
                    <div key={entry.user_id} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        idx === 0 ? 'bg-yellow-500 text-black' :
                        idx === 1 ? 'bg-gray-400 text-black' :
                        idx === 2 ? 'bg-orange-600 text-black' :
                        'bg-white/10'
                      }`}>
                        {idx + 1}
                      </div>
                      {entry.profile_photo ? (
                        <img
                          src={entry.profile_photo}
                          alt={entry.display_name || entry.username}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                          <Users className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="font-semibold">{entry.display_name || entry.username}</div>
                        <div className="text-sm text-gray-400">
                          {entry.successful_referrals} referrals
                        </div>
                      </div>
                      <div className="text-yellow-500 font-semibold">
                        {entry.total_rewards_earned} days
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'referrals' && (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
              <h3 className="text-xl font-bold mb-6">My Referrals</h3>
              <div className="space-y-3">
                {referrals.map((referral) => (
                  <div
                    key={referral.id}
                    className="bg-white/5 rounded-lg p-4 flex items-center gap-4"
                  >
                    {referral.profile_photo ? (
                      <img
                        src={referral.profile_photo}
                        alt={referral.display_name || referral.username}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                        <Users className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="font-semibold">
                        {referral.display_name || referral.username || 'Pending Signup'}
                      </div>
                      <div className="text-sm text-gray-400 capitalize flex items-center gap-2">
                        {referral.status === 'completed' && (
                          <>
                            <Check className="w-3 h-3 text-green-500" />
                            Joined
                          </>
                        )}
                        {referral.status === 'rewarded' && (
                          <>
                            <Crown className="w-3 h-3 text-yellow-500" />
                            Rewarded
                          </>
                        )}
                        {referral.status === 'pending' && (
                          <>
                            <Clock className="w-3 h-3 text-yellow-500" />
                            Waiting to join
                          </>
                        )}
                      </div>
                      {referral.completed_at && (
                        <div className="text-xs text-gray-500">
                          {new Date(referral.completed_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {referrals.length === 0 && (
                  <div className="text-center text-gray-400 py-12">
                    <Gift className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>No referrals yet. Start sharing your code!</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'rewards' && (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
              <h3 className="text-xl font-bold mb-6">My Rewards</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {rewards.map((reward) => (
                  <div
                    key={reward.id}
                    className={`bg-white/5 rounded-lg p-4 ${
                      reward.status === 'available' ? 'ring-2 ring-green-500' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {getRewardIcon(reward.reward_type)}
                      <div className="flex-1">
                        <div className="font-semibold">{getRewardText(reward)}</div>
                        <div className="text-sm text-gray-400 capitalize flex items-center gap-1">
                          {reward.status === 'available' && (
                            <>
                              <Zap className="w-3 h-3 text-green-500" />
                              Ready to claim
                            </>
                          )}
                          {reward.status === 'applied' && (
                            <>
                              <Check className="w-3 h-3 text-blue-500" />
                              Applied on {new Date(reward.applied_at!).toLocaleDateString()}
                            </>
                          )}
                          {reward.status === 'expired' && (
                            <>
                              <X className="w-3 h-3 text-red-500" />
                              Expired
                            </>
                          )}
                        </div>
                        {reward.expires_at && reward.status === 'available' && (
                          <div className="text-xs text-gray-500 mt-1">
                            Expires {new Date(reward.expires_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                    {reward.status === 'available' && reward.reward_type === 'premium_time' && (
                      <button
                        onClick={() => claimReward(reward.id)}
                        className="mt-3 w-full py-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 rounded-lg transition text-sm font-semibold"
                      >
                        Claim Now
                      </button>
                    )}
                  </div>
                ))}
                {rewards.length === 0 && (
                  <div className="col-span-full text-center text-gray-400 py-12">
                    <Award className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>No rewards yet. Refer friends to earn!</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'leaderboard' && (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  Referral Leaderboard
                </h3>
                {userRank && userRank.rank_position && (
                  <div className="text-sm text-gray-400">
                    Your rank: <span className="text-pink-400 font-bold">#{userRank.rank_position}</span>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                {leaderboard.map((entry, idx) => {
                  const isUser = entry.user_id === localStorage.getItem('token');
                  return (
                    <div
                      key={entry.user_id}
                      className={`bg-white/5 rounded-lg p-4 flex items-center gap-4 ${
                        isUser ? 'ring-2 ring-pink-500' : ''
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        idx === 0 ? 'bg-yellow-500 text-black' :
                        idx === 1 ? 'bg-gray-400 text-black' :
                        idx === 2 ? 'bg-orange-600 text-black' :
                        'bg-white/10'
                      }`}>
                        {entry.rank_position || idx + 1}
                      </div>
                      {entry.profile_photo ? (
                        <img
                          src={entry.profile_photo}
                          alt={entry.display_name || entry.username}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                          <Users className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="font-semibold">
                          {entry.display_name || entry.username}
                          {isUser && <span className="ml-2 text-xs text-pink-400">(You)</span>}
                        </div>
                        <div className="text-sm text-gray-400">
                          {entry.successful_referrals} successful referrals
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-yellow-500 font-bold">
                          {entry.total_rewards_earned} days
                        </div>
                        <div className="text-xs text-gray-400">earned</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Share2 className="w-6 h-6 text-pink-500" />
                Share Your Code
              </h2>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Copy Link */}
            <div className="bg-white/5 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Link className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-400">Your referral link</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={`${window.location.origin}?ref=${referralCode?.code}`}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm"
                />
                <button
                  onClick={copyReferralCode}
                  className="px-4 py-2 bg-pink-500 hover:bg-pink-600 rounded-lg transition"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Share Options */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => shareToPlatform('twitter')}
                className="py-3 bg-[#1DA1F2] hover:bg-[#1a8cd8] rounded-lg transition flex items-center justify-center gap-2 font-semibold"
              >
                <Twitter className="w-5 h-5" />
                Twitter
              </button>
              <button
                onClick={() => shareToPlatform('facebook')}
                className="py-3 bg-[#4267B2] hover:bg-[#365899] rounded-lg transition flex items-center justify-center gap-2 font-semibold"
              >
                <Facebook className="w-5 h-5" />
                Facebook
              </button>
              <button
                onClick={() => shareToPlatform('whatsapp')}
                className="py-3 bg-[#25D366] hover:bg-[#128C7E] rounded-lg transition flex items-center justify-center gap-2 font-semibold"
              >
                <MessageCircle className="w-5 h-5" />
                WhatsApp
              </button>
              <button
                onClick={() => shareToPlatform('email')}
                className="py-3 bg-gray-600 hover:bg-gray-700 rounded-lg transition flex items-center justify-center gap-2 font-semibold"
              >
                <Mail className="w-5 h-5" />
                Email
              </button>
            </div>

            <div className="mt-6 text-center text-sm text-gray-400">
              When friends sign up with your code, both of you get{' '}
              <span className="text-pink-400 font-semibold">{referralCode?.reward_amount} days of Premium</span>!
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
