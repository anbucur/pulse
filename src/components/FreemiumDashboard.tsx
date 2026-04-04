/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Crown,
  Sparkles,
  TrendingUp,
  Check,
  X,
  Zap,
  Shield,
  Eye,
  MessageSquare,
  RefreshCw,
  Calendar,
  Gift,
  Star,
  Award,
  Lock,
  ArrowRight,
  CreditCard,
  History,
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock,
  Heart,
  Filter,
} from 'lucide-react';

interface Feature {
  feature: string;
  usage: number;
  limit: number;
  remaining: number;
  premium_unlimited: boolean;
}

interface Subscription {
  id: string;
  tier: string;
  status: string;
  start_date: string;
  end_date?: string;
  auto_renew: boolean;
}

interface SubscriptionHistory {
  id: string;
  event_type: string;
  from_tier?: string;
  to_tier?: string;
  created_at: string;
}

export default function FreemiumDashboard() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [history, setHistory] = useState<SubscriptionHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'features' | 'history'>('overview');

  // Modals
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Pricing
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      // Fetch subscription status
      const subResponse = await fetch('/api/subscription/status', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const subData = await subResponse.json();
      setSubscription(subData);

      // Fetch usage stats
      const usageResponse = await fetch('/api/subscription/usage', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const usageData = await usageResponse.json();
      setFeatures(usageData.features || []);

      // Fetch history
      const historyResponse = await fetch('/api/subscription/history', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const historyData = await historyResponse.json();
      setHistory(historyData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/subscription/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          billing_provider: 'stripe',
          provider_subscription_id: `sub_${Date.now()}`,
        }),
      });

      if (!response.ok) throw new Error('Failed to upgrade');

      setShowUpgradeModal(false);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upgrade subscription');
    }
  };

  const handleCancel = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to cancel');

      setShowCancelModal(false);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    }
  };

  const getFeatureIcon = (feature: string) => {
    const icons: Record<string, JSX.Element> = {
      daily_likes: <Heart className="w-5 h-5" />,
      slow_dating_matches: <Clock className="w-5 h-5" />,
      profile_boosts: <TrendingUp className="w-5 h-5" />,
      see_who_liked: <Eye className="w-5 h-5" />,
      advanced_filters: <Filter className="w-5 h-5" />,
      read_receipts: <MessageSquare className="w-5 h-5" />,
      unlimited_rewinds: <RefreshCw className="w-5 h-5" />,
      incognito_mode: <Shield className="w-5 h-5" />,
    };
    return icons[feature] || <Star className="w-5 h-5" />;
  };

  const getFeatureDisplayName = (feature: string) => {
    const names: Record<string, string> = {
      daily_likes: 'Daily Likes',
      slow_dating_matches: 'Slow Dating Matches',
      profile_boosts: 'Profile Boosts',
      see_who_liked: 'See Who Liked You',
      advanced_filters: 'Advanced Filters',
      read_receipts: 'Read Receipts',
      unlimited_rewinds: 'Unlimited Rewinds',
      incognito_mode: 'Incognito Mode',
    };
    return names[feature] || feature;
  };

  const getEventTypeIcon = (eventType: string) => {
    const icons: Record<string, JSX.Element> = {
      created: <CheckCircle2 className="w-4 h-4 text-green-500" />,
      upgraded: <TrendingUp className="w-4 h-4 text-blue-500" />,
      downgraded: <ArrowRight className="w-4 h-4 text-orange-500" />,
      cancelled: <XCircle className="w-4 h-4 text-red-500" />,
      renewed: <RefreshCw className="w-4 h-4 text-purple-500" />,
      expired: <Clock className="w-4 h-4 text-gray-500" />,
    };
    return icons[eventType] || <Clock className="w-4 h-4" />;
  };

  const isPremium = subscription?.tier === 'premium';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            {isPremium ? (
              <Crown className="w-8 h-8 text-yellow-500" />
            ) : (
              <Sparkles className="w-8 h-8 text-gray-400" />
            )}
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                {isPremium ? 'Premium Member' : 'Free Tier'}
              </h2>
              <p className="text-gray-400 mt-1">
                {isPremium
                  ? 'Enjoy unlimited access to all features'
                  : 'Upgrade to Premium for the full experience'}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            {!isPremium && (
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 rounded-lg transition flex items-center gap-2 font-semibold"
              >
                <Crown className="w-5 h-5" />
                Upgrade to Premium
              </button>
            )}
            {isPremium && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg transition"
              >
                Cancel Subscription
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-6">
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
            onClick={() => setActiveTab('features')}
            className={`px-6 py-2 rounded-lg transition ${
              activeTab === 'features'
                ? 'bg-pink-500 text-white'
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            }`}
          >
            Features
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-2 rounded-lg transition ${
              activeTab === 'history'
                ? 'bg-pink-500 text-white'
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            }`}
          >
            History
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

      {!loading && subscription && (
        <>
          {activeTab === 'overview' && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Subscription Status */}
              <div className={`bg-white/10 backdrop-blur-lg rounded-2xl p-6 ${isPremium ? 'ring-2 ring-yellow-500' : ''}`}>
                <div className="flex items-center gap-3 mb-4">
                  {isPremium ? (
                    <Crown className="w-8 h-8 text-yellow-500" />
                  ) : (
                    <Sparkles className="w-8 h-8 text-gray-400" />
                  )}
                  <div>
                    <h3 className="text-xl font-bold capitalize">{subscription.tier} Plan</h3>
                    <p className="text-gray-400 text-sm capitalize">{subscription.status}</p>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Started</span>
                    <span>{new Date(subscription.start_date).toLocaleDateString()}</span>
                  </div>
                  {subscription.end_date && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Ends</span>
                      <span>{new Date(subscription.end_date).toLocaleDateString()}</span>
                    </div>
                  )}
                  {subscription.auto_renew && isPremium && (
                    <div className="flex items-center gap-2 text-green-400">
                      <RefreshCw className="w-4 h-4" />
                      <span>Auto-renews</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-pink-500" />
                  Today's Usage
                </h3>
                <div className="space-y-3">
                  {features.slice(0, 4).map((feature) => (
                    <div key={feature.feature} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getFeatureIcon(feature.feature)}
                        <span className="text-sm">{getFeatureDisplayName(feature.feature)}</span>
                      </div>
                      <span className="text-sm font-semibold">
                        {feature.usage} / {isPremium && feature.premium_unlimited ? '∞' : feature.limit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Premium Benefits */}
              <div className="bg-gradient-to-br from-pink-500/20 to-purple-500/20 backdrop-blur-lg rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-yellow-500" />
                  Premium Benefits
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    Unlimited likes daily
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    More slow dating matches
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    See who liked you
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    Advanced filters
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    Read receipts
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    Profile boosts
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    Incognito mode
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'features' && (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
              <h3 className="text-xl font-bold mb-6">Feature Usage</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {features.map((feature) => {
                  const percentage = feature.limit > 0 ? (feature.usage / feature.limit) * 100 : 0;
                  const isNearLimit = percentage >= 80 && percentage < 100;
                  const isAtLimit = percentage >= 100;

                  return (
                    <div
                      key={feature.feature}
                      className={`bg-white/5 rounded-lg p-4 ${isAtLimit ? 'ring-2 ring-red-500' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {getFeatureIcon(feature.feature)}
                          <span className="font-semibold">{getFeatureDisplayName(feature.feature)}</span>
                        </div>
                        {!isPremium && !feature.premium_unlimited && feature.limit === 0 && (
                          <Lock className="w-4 h-4 text-gray-500" />
                        )}
                        {isPremium && feature.premium_unlimited && (
                          <Zap className="w-4 h-4 text-yellow-500" />
                        )}
                      </div>

                      {/* Progress bar */}
                      {feature.limit > 0 && !isPremium && (
                        <div className="mb-2">
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                isAtLimit
                                  ? 'bg-red-500'
                                  : isNearLimit
                                    ? 'bg-yellow-500'
                                    : 'bg-pink-500'
                              }`}
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Used today</span>
                        <span className={`font-semibold ${isAtLimit ? 'text-red-400' : ''}`}>
                          {feature.usage} / {isPremium && feature.premium_unlimited ? '∞' : feature.limit}
                        </span>
                      </div>

                      {isAtLimit && !isPremium && (
                        <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Resets at midnight
                        </p>
                      )}

                      {feature.limit === 0 && !isPremium && (
                        <button
                          onClick={() => setShowUpgradeModal(true)}
                          className="mt-3 w-full py-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 rounded-lg transition text-sm font-semibold"
                        >
                          Unlock with Premium
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <History className="w-5 h-5" />
                Subscription History
              </h3>
              <div className="space-y-3">
                {history.map((event) => (
                  <div key={event.id} className="bg-white/5 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      {getEventTypeIcon(event.event_type)}
                      <div className="flex-1">
                        <div className="font-semibold capitalize">{event.event_type}</div>
                        {event.from_tier && event.to_tier && (
                          <div className="text-sm text-gray-400">
                            {event.from_tier} → {event.to_tier}
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-gray-400">
                        {new Date(event.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
                {history.length === 0 && (
                  <div className="text-center text-gray-400 py-8">
                    No subscription history yet
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Crown className="w-6 h-6 text-yellow-500" />
                  Upgrade to Premium
                </h2>
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Plan Selection */}
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <button
                  onClick={() => setSelectedPlan('monthly')}
                  className={`p-4 rounded-lg border-2 transition ${
                    selectedPlan === 'monthly'
                      ? 'border-pink-500 bg-pink-500/10'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="font-bold text-lg">Monthly</div>
                  <div className="text-3xl font-bold text-pink-500 my-2">$9.99</div>
                  <div className="text-gray-400 text-sm">per month</div>
                </button>
                <button
                  onClick={() => setSelectedPlan('yearly')}
                  className={`p-4 rounded-lg border-2 transition relative ${
                    selectedPlan === 'yearly'
                      ? 'border-pink-500 bg-pink-500/10'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="absolute -top-2 right-2 bg-green-500 text-xs px-2 py-1 rounded-full font-semibold">
                    Save 40%
                  </div>
                  <div className="font-bold text-lg">Yearly</div>
                  <div className="text-3xl font-bold text-pink-500 my-2">$71.88</div>
                  <div className="text-gray-400 text-sm">$5.99 per month</div>
                </button>
              </div>

              {/* Features */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-500" />
                  <span>Unlimited likes every day</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-500" />
                  <span>More slow dating matches (10 vs 5)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-500" />
                  <span>See who liked your profile</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-500" />
                  <span>Advanced search filters</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-500" />
                  <span>Read receipts on messages</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-500" />
                  <span>3 profile boosts per day</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-500" />
                  <span>Incognito browsing mode</span>
                </div>
              </div>

              {/* Upgrade Button */}
              <button
                onClick={handleUpgrade}
                className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 rounded-lg transition font-bold text-lg flex items-center justify-center gap-2"
              >
                <CreditCard className="w-5 h-5" />
                Upgrade Now
              </button>

              <p className="text-xs text-gray-400 text-center mt-4">
                Cancel anytime. No questions asked.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-4">Cancel Subscription?</h2>
            <p className="text-gray-400 mb-6">
              Your premium benefits will continue until the end of your current billing period.
              After that, you'll revert to the free tier.
            </p>

            <div className="bg-white/5 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-yellow-500 mb-2">
                <Clock className="w-5 h-5" />
                <span className="font-semibold">You'll keep premium until:</span>
              </div>
              <div className="text-lg font-bold">
                {subscription?.end_date
                  ? new Date(subscription.end_date).toLocaleDateString()
                  : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-lg transition"
              >
                Keep Premium
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 rounded-lg transition font-semibold"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
